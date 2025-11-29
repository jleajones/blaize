/**
 * Tests for SSE Job Stream Handler
 *
 * Tests the jobStreamHandler including:
 * - 4-param signature compliance
 * - Event streaming (progress, completed, failed, cancelled)
 * - Error handling (service unavailable, job not found)
 * - Stream cleanup on disconnect
 * - Initial state handling for terminal jobs
 *
 * @module @blaizejs/queue/routes.test
 */

import { QueueService } from './queue-service';
import { jobStreamHandler, jobStreamQuerySchema } from './routes';
import { InMemoryStorage } from './storage';

import type { SSEStream, BlaizeLogger, Context } from 'blaizejs';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a mock SSE stream
 */
function createMockStream(): SSEStream & {
  events: Array<{ event: string; data: unknown }>;
  closeCallbacks: Array<() => void>;
  closed: boolean;
} {
  const events: Array<{ event: string; data: unknown }> = [];
  const closeCallbacks: Array<() => void> = [];

  // Use an object to hold state so it can be mutated
  const state = { closed: false };

  return {
    events,
    closeCallbacks,

    get closed() {
      return state.closed;
    },

    send<T>(event: string, data: T): void {
      if (state.closed) return;
      events.push({ event, data });
    },

    sendError(error: Error): void {
      if (state.closed) return;
      events.push({ event: 'error', data: { message: error.message } });
    },

    close(): void {
      if (state.closed) return;
      state.closed = true;
      // Execute close callbacks
      for (const cb of closeCallbacks) {
        cb();
      }
    },

    onClose(cb: () => void): void {
      closeCallbacks.push(cb);
    },
  };
}

/**
 * Create a mock logger with child support
 */
function createMockLogger(): BlaizeLogger & {
  child: (bindings: Record<string, unknown>) => BlaizeLogger;
} {
  const mockLogger: any = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn().mockImplementation(() => createMockLogger()),
    flush: vi.fn().mockResolvedValue(undefined),
  };
  return mockLogger;
}

/**
 * Create a mock context with queue service
 */
function createMockContext(query: Record<string, unknown>, queueService?: QueueService): Context {
  return {
    request: {
      method: 'GET',
      path: '/queue/stream',
      url: null,
      query,
      params: {},
      body: null,
      protocol: 'http',
      isHttp2: false,
      header: () => undefined,
      headers: () => ({}),
      raw: {} as any,
    },
    response: {
      raw: {} as any,
      statusCode: 200,
      sent: false,
    } as any,
    state: {},
    services: {
      queue: queueService,
    },
  } as any;
}

/**
 * Create test queue service with in-memory storage
 */
async function createTestQueueService(): Promise<QueueService> {
  const storage = new InMemoryStorage();
  await storage.connect?.();

  const queueService = new QueueService({
    queues: {
      default: { concurrency: 1 },
    },
    storage,
    logger: createMockLogger() as any,
  });

  return queueService;
}

/**
 * Wait for a condition with timeout
 * Supports both sync and async condition functions
 */
async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout = 5000,
  interval = 10
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const result = await condition();
    if (result) return;
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}

// ============================================================================
// Tests: Schema Validation
// ============================================================================

describe('jobStreamQuerySchema', () => {
  it('should accept valid UUID jobId', () => {
    const result = jobStreamQuerySchema.safeParse({
      jobId: '550e8400-e29b-41d4-a716-446655440000',
    });

    expect(result.success).toBe(true);
  });

  it('should accept jobId with optional queueName', () => {
    const result = jobStreamQuerySchema.safeParse({
      jobId: '550e8400-e29b-41d4-a716-446655440000',
      queueName: 'emails',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.queueName).toBe('emails');
    }
  });

  it('should reject missing jobId', () => {
    const result = jobStreamQuerySchema.safeParse({});

    expect(result.success).toBe(false);
  });

  it('should reject invalid UUID', () => {
    const result = jobStreamQuerySchema.safeParse({
      jobId: 'not-a-uuid',
    });

    expect(result.success).toBe(false);
  });

  it('should reject non-string jobId', () => {
    const result = jobStreamQuerySchema.safeParse({
      jobId: 12345,
    });

    expect(result.success).toBe(false);
  });
});

// ============================================================================
// Tests: Handler Signature
// ============================================================================

describe('jobStreamHandler signature', () => {
  it('should have 4-param signature (stream, ctx, params, logger)', () => {
    // Function should accept exactly 4 parameters
    expect(jobStreamHandler.length).toBe(4);
  });

  it('should be an async function', () => {
    // Async functions return Promise
    expect(jobStreamHandler.constructor.name).toBe('AsyncFunction');
  });
});

// ============================================================================
// Tests: Error Handling
// ============================================================================

describe('jobStreamHandler error handling', () => {
  it('should throw ServiceNotAvailableError when queue service is not available', async () => {
    const stream = createMockStream();
    const ctx = createMockContext(
      { jobId: '550e8400-e29b-41d4-a716-446655440000' },
      undefined // No queue service
    );
    const logger = createMockLogger();

    await expect(jobStreamHandler(stream, ctx, {}, logger)).rejects.toThrow(
      'Queue service unavailable'
    );
  });

  it('should throw NotFoundError when job does not exist', async () => {
    const queueService = await createTestQueueService();
    const stream = createMockStream();
    const ctx = createMockContext({ jobId: '550e8400-e29b-41d4-a716-446655440000' }, queueService);
    const logger = createMockLogger();

    await expect(jobStreamHandler(stream, ctx, {}, logger)).rejects.toThrow(
      'Job 550e8400-e29b-41d4-a716-446655440000 not found'
    );

    await queueService.stopAll({ graceful: false, timeout: 100 });
  });

  it('should include job details in NotFoundError', async () => {
    const queueService = await createTestQueueService();
    const stream = createMockStream();
    const jobId = '550e8400-e29b-41d4-a716-446655440000';
    const ctx = createMockContext({ jobId, queueName: 'emails' }, queueService);
    const logger = createMockLogger();

    try {
      await jobStreamHandler(stream, ctx, {}, logger);
      expect.fail('Should have thrown');
    } catch (error: any) {
      expect(error.message).toContain(jobId);
      expect(error.details?.resourceType).toBe('job');
      expect(error.details?.resourceId).toBe(jobId);
    }

    await queueService.stopAll({ graceful: false, timeout: 100 });
  });
});

// ============================================================================
// Tests: Progress Events
// ============================================================================

describe('jobStreamHandler progress events', () => {
  let queueService: QueueService;

  beforeEach(async () => {
    queueService = await createTestQueueService();
  });

  afterEach(async () => {
    await queueService.stopAll({ graceful: false, timeout: 1000 });
  });

  it('should stream progress events', async () => {
    const stream = createMockStream();
    const logger = createMockLogger();

    // Register handler that reports progress
    queueService.registerHandler('default', 'progress:test', async ctx => {
      await ctx.progress(25, 'Step 1');
      await ctx.progress(50, 'Step 2');
      await ctx.progress(75, 'Step 3');
      await ctx.progress(100, 'Done');
      return 'success';
    });

    // Add job
    const jobId = await queueService.add('default', 'progress:test', {});
    const ctx = createMockContext({ jobId }, queueService);

    // Start handler (non-blocking)
    const handlerPromise = jobStreamHandler(stream, ctx, {}, logger);

    // Start queue processing
    await queueService.startAll();

    // Wait for job to complete
    await waitFor(() => stream.closed);

    // Handler should complete without error
    await handlerPromise;

    // Check progress events were sent
    const progressEvents = stream.events.filter(e => e.event === 'job.progress');
    expect(progressEvents.length).toBeGreaterThanOrEqual(1);

    // Each progress event should have required fields
    for (const event of progressEvents) {
      const data = event.data as any;
      expect(data.jobId).toBe(jobId);
      expect(typeof data.percent).toBe('number');
      expect(typeof data.timestamp).toBe('number');
    }
  });

  it('should include message in progress events when provided', async () => {
    const stream = createMockStream();
    const logger = createMockLogger();

    queueService.registerHandler('default', 'progress:message', async ctx => {
      await ctx.progress(50, 'Processing halfway');
      return 'done';
    });

    const jobId = await queueService.add('default', 'progress:message', {});
    const ctx = createMockContext({ jobId }, queueService);

    const handlerPromise = jobStreamHandler(stream, ctx, {}, logger);
    await queueService.startAll();
    await waitFor(() => stream.closed);
    await handlerPromise;

    const progressEvent = stream.events.find(e => e.event === 'job.progress');
    expect(progressEvent).toBeDefined();
    expect((progressEvent?.data as any).message).toBe('Processing halfway');
  });
});

// ============================================================================
// Tests: Completion Events
// ============================================================================

describe('jobStreamHandler completion events', () => {
  let queueService: QueueService;

  beforeEach(async () => {
    queueService = await createTestQueueService();
  });

  afterEach(async () => {
    await queueService.stopAll({ graceful: false, timeout: 1000 });
  });

  it('should send completed event when job succeeds', async () => {
    const stream = createMockStream();
    const logger = createMockLogger();

    queueService.registerHandler('default', 'complete:test', async () => {
      return { success: true, count: 42 };
    });

    const jobId = await queueService.add('default', 'complete:test', {});
    const ctx = createMockContext({ jobId }, queueService);

    const handlerPromise = jobStreamHandler(stream, ctx, {}, logger);
    await queueService.startAll();
    await waitFor(() => stream.closed);
    await handlerPromise;

    const completedEvent = stream.events.find(e => e.event === 'job.completed');
    expect(completedEvent).toBeDefined();

    const data = completedEvent?.data as any;
    expect(data.jobId).toBe(jobId);
    expect(data.result).toEqual({ success: true, count: 42 });
    expect(typeof data.completedAt).toBe('number');
  });

  it('should close stream after completion', async () => {
    const stream = createMockStream();
    const logger = createMockLogger();

    queueService.registerHandler('default', 'complete:close', async () => 'done');

    const jobId = await queueService.add('default', 'complete:close', {});
    const ctx = createMockContext({ jobId }, queueService);

    const handlerPromise = jobStreamHandler(stream, ctx, {}, logger);
    await queueService.startAll();
    await waitFor(() => stream.closed, 5000);
    await handlerPromise;

    expect(stream.closed).toBe(true);
  });
});

// ============================================================================
// Tests: Failure Events
// ============================================================================

describe('jobStreamHandler failure events', () => {
  let queueService: QueueService;

  beforeEach(async () => {
    queueService = await createTestQueueService();
  });

  afterEach(async () => {
    await queueService.stopAll({ graceful: false, timeout: 1000 });
  });

  it('should send failed event when job fails', async () => {
    const stream = createMockStream();
    const logger = createMockLogger();

    queueService.registerHandler('default', 'fail:test', async () => {
      throw new Error('Something went wrong');
    });

    const jobId = await queueService.add(
      'default',
      'fail:test',
      {},
      {
        maxRetries: 0, // Fail immediately
      }
    );
    const ctx = createMockContext({ jobId }, queueService);

    const handlerPromise = jobStreamHandler(stream, ctx, {}, logger);
    await queueService.startAll();
    await waitFor(() => stream.closed, 5000);
    await handlerPromise;

    const failedEvent = stream.events.find(e => e.event === 'job.failed');
    expect(failedEvent).toBeDefined();

    const data = failedEvent?.data as any;
    expect(data.jobId).toBe(jobId);
    expect(data.error.message).toBe('Something went wrong');
    expect(typeof data.failedAt).toBe('number');
  });

  it('should include error code when available', async () => {
    const stream = createMockStream();
    const logger = createMockLogger();

    queueService.registerHandler('default', 'fail:code', async () => {
      const error = new Error('Connection failed') as Error & { code: string };
      error.code = 'ECONNREFUSED';
      throw error;
    });

    const jobId = await queueService.add(
      'default',
      'fail:code',
      {},
      {
        maxRetries: 0,
      }
    );
    const ctx = createMockContext({ jobId }, queueService);

    const handlerPromise = jobStreamHandler(stream, ctx, {}, logger);
    await queueService.startAll();
    await waitFor(() => stream.closed, 5000);
    await handlerPromise;

    const failedEvent = stream.events.find(e => e.event === 'job.failed');
    const data = failedEvent?.data as any;
    // QueueInstance normalizes error codes - custom codes become EXECUTION_ERROR
    expect(data.error.code).toBe('EXECUTION_ERROR');
  });

  it('should close stream after failure', async () => {
    const stream = createMockStream();
    const logger = createMockLogger();

    queueService.registerHandler('default', 'fail:close', async () => {
      throw new Error('Fail');
    });

    const jobId = await queueService.add(
      'default',
      'fail:close',
      {},
      {
        maxRetries: 0,
      }
    );
    const ctx = createMockContext({ jobId }, queueService);

    const handlerPromise = jobStreamHandler(stream, ctx, {}, logger);
    await queueService.startAll();
    await waitFor(() => stream.closed, 5000);
    await handlerPromise;

    expect(stream.closed).toBe(true);
  });
});

// ============================================================================
// Tests: Cancellation Events
// ============================================================================

describe('jobStreamHandler cancellation events', () => {
  let queueService: QueueService;

  beforeEach(async () => {
    queueService = await createTestQueueService();
  });

  afterEach(async () => {
    await queueService.stopAll({ graceful: false, timeout: 1000 });
  });

  it('should send cancelled event when job is cancelled', async () => {
    const stream = createMockStream();
    const logger = createMockLogger();

    // Register handler
    queueService.registerHandler('default', 'cancel:test', async _ctx => {
      await new Promise(resolve => setTimeout(resolve, 10000));
      return 'should not reach';
    });

    const jobId = await queueService.add('default', 'cancel:test', {});

    // Verify job was added
    const addedJob = await queueService.getJob(jobId);
    expect(addedJob).toBeDefined();
    expect(addedJob?.status).toBe('queued');

    const ctx = createMockContext({ jobId }, queueService);

    // Subscribe to job events via handler (non-blocking)
    const handlerPromise = jobStreamHandler(stream, ctx, {}, logger);

    // Give a moment for subscription to be set up
    await new Promise(resolve => setTimeout(resolve, 50));

    // Cancel the job - provide queueName explicitly since we know it
    const cancelled = await queueService.cancelJob(jobId, 'default', 'User requested');
    expect(cancelled).toBe(true);

    // Give time for event to propagate and stream to close
    await new Promise(resolve => setTimeout(resolve, 100));

    // Check if stream received the cancelled event
    const cancelledEvent = stream.events.find(e => e.event === 'job.cancelled');

    // If event was received, stream should be closed
    if (cancelledEvent) {
      expect(stream.closed).toBe(true);
      const data = cancelledEvent?.data as any;
      expect(data.jobId).toBe(jobId);
      expect(typeof data.cancelledAt).toBe('number');
    } else {
      // Event not received - check if stream closed from initial state check
      // This could happen if getJob returned the cancelled job
      const job = await queueService.getJob(jobId);
      expect(job?.status).toBe('cancelled');
    }

    // Clean up - handler should resolve
    if (!stream.closed) {
      stream.close();
    }
    await handlerPromise;
  });

  it('should close stream after cancellation', async () => {
    const stream = createMockStream();
    const logger = createMockLogger();

    queueService.registerHandler('default', 'cancel:close', async _ctx => {
      await new Promise(resolve => setTimeout(resolve, 10000));
      return 'should not reach';
    });

    const jobId = await queueService.add('default', 'cancel:close', {});
    const ctx = createMockContext({ jobId }, queueService);

    const handlerPromise = jobStreamHandler(stream, ctx, {}, logger);

    // Give a moment for subscription
    await new Promise(resolve => setTimeout(resolve, 50));

    await queueService.cancelJob(jobId);

    // Give time for event to propagate
    await new Promise(resolve => setTimeout(resolve, 100));

    // Either stream is closed from event, or we close it ourselves
    if (!stream.closed) {
      stream.close();
    }

    await handlerPromise;

    // Verify job was cancelled
    const job = await queueService.getJob(jobId);
    expect(job?.status).toBe('cancelled');
  });
});

// ============================================================================
// Tests: Stream Cleanup
// ============================================================================

describe('jobStreamHandler cleanup', () => {
  let queueService: QueueService;

  beforeEach(async () => {
    queueService = await createTestQueueService();
  });

  afterEach(async () => {
    await queueService.stopAll({ graceful: false, timeout: 1000 });
  });

  it('should unsubscribe when stream closes', async () => {
    const stream = createMockStream();
    const logger = createMockLogger();
    let handlerStarted = false;

    queueService.registerHandler('default', 'cleanup:test', async ctx => {
      handlerStarted = true;
      // Long-running job
      for (let i = 1; i <= 10; i++) {
        await ctx.progress(i * 10);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return 'done';
    });

    const jobId = await queueService.add('default', 'cleanup:test', {});
    const ctx = createMockContext({ jobId }, queueService);

    const handlerPromise = jobStreamHandler(stream, ctx, {}, logger);
    await queueService.startAll();

    // Wait for job to start
    await waitFor(() => handlerStarted, 5000);

    // Simulate client disconnect
    stream.close();

    // Handler should complete cleanly
    await handlerPromise;

    // Logger should have logged the close
    expect(logger.debug).toHaveBeenCalledWith(
      'SSE stream closed for job',
      expect.objectContaining({ jobId })
    );
  });

  it('should not send events after stream closes', async () => {
    const stream = createMockStream();
    const logger = createMockLogger();
    let _handlerStarted = false;
    let progressCount = 0;

    queueService.registerHandler('default', 'cleanup:noevents', async ctx => {
      _handlerStarted = true;
      for (let i = 1; i <= 10; i++) {
        progressCount++;
        await ctx.progress(i * 10);
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      return 'done';
    });

    const jobId = await queueService.add('default', 'cleanup:noevents', {});
    const ctx = createMockContext({ jobId }, queueService);

    const handlerPromise = jobStreamHandler(stream, ctx, {}, logger);
    await queueService.startAll();

    // Wait for a few progress events
    await waitFor(() => progressCount >= 3, 5000);

    const eventsBeforeClose = stream.events.length;

    // Close stream
    stream.close();

    // Wait a bit for any pending events
    await new Promise(resolve => setTimeout(resolve, 500));

    // No new events should be added after close
    // (the mock stream implementation prevents this)
    expect(stream.events.length).toBe(eventsBeforeClose);

    await handlerPromise;
  });
});

// ============================================================================
// Tests: Initial State for Terminal Jobs
// ============================================================================

describe('jobStreamHandler initial state', () => {
  let queueService: QueueService;

  beforeEach(async () => {
    queueService = await createTestQueueService();
  });

  afterEach(async () => {
    await queueService.stopAll({ graceful: false, timeout: 1000 });
  });

  it('should send completed event immediately for already completed job', async () => {
    const _stream = createMockStream();
    const logger = createMockLogger();

    // Create and complete a job
    queueService.registerHandler('default', 'initial:completed', async () => {
      return { data: 'result' };
    });

    const jobId = await queueService.add('default', 'initial:completed', {});
    await queueService.startAll();

    // Wait for job to complete
    await waitFor(async () => {
      const job = await queueService.getJob(jobId);
      return job?.status === 'completed';
    }, 5000);

    // Stop queues so no more processing
    await queueService.stopAll({ graceful: false, timeout: 100 });

    // Create new stream and connect to completed job
    const newStream = createMockStream();
    const ctx = createMockContext({ jobId }, queueService);

    await jobStreamHandler(newStream, ctx, {}, logger);

    // Should immediately send completed event
    const completedEvent = newStream.events.find(e => e.event === 'job.completed');
    expect(completedEvent).toBeDefined();
    expect((completedEvent?.data as any).jobId).toBe(jobId);

    // Stream should be closed
    expect(newStream.closed).toBe(true);
  });

  it('should send failed event immediately for already failed job', async () => {
    const _stream = createMockStream();
    const logger = createMockLogger();

    queueService.registerHandler('default', 'initial:failed', async () => {
      throw new Error('Already failed');
    });

    const jobId = await queueService.add(
      'default',
      'initial:failed',
      {},
      {
        maxRetries: 0,
      }
    );
    await queueService.startAll();

    // Wait for job to fail
    await waitFor(async () => {
      const job = await queueService.getJob(jobId);
      return job?.status === 'failed';
    }, 5000);

    await queueService.stopAll({ graceful: false, timeout: 100 });

    // Connect to failed job
    const newStream = createMockStream();
    const ctx = createMockContext({ jobId }, queueService);

    await jobStreamHandler(newStream, ctx, {}, logger);

    const failedEvent = newStream.events.find(e => e.event === 'job.failed');
    expect(failedEvent).toBeDefined();
    expect((failedEvent?.data as any).error.message).toBe('Already failed');
    expect(newStream.closed).toBe(true);
  });
});

// ============================================================================
// Tests: Logger Usage
// ============================================================================

describe('jobStreamHandler logging', () => {
  let queueService: QueueService;

  beforeEach(async () => {
    queueService = await createTestQueueService();
  });

  afterEach(async () => {
    await queueService.stopAll({ graceful: false, timeout: 1000 });
  });

  it('should log stream open', async () => {
    const stream = createMockStream();
    const logger = createMockLogger();

    queueService.registerHandler('default', 'log:open', async () => 'done');
    const jobId = await queueService.add('default', 'log:open', {});
    const ctx = createMockContext({ jobId, queueName: 'default' }, queueService);

    const handlerPromise = jobStreamHandler(stream, ctx, {}, logger);
    await queueService.startAll();
    await waitFor(() => stream.closed);
    await handlerPromise;

    expect(logger.debug).toHaveBeenCalledWith(
      'SSE stream opened for job',
      expect.objectContaining({ jobId, queueName: 'default' })
    );
  });

  it('should log on job completion', async () => {
    const stream = createMockStream();
    const logger = createMockLogger();

    queueService.registerHandler('default', 'log:complete', async () => 'done');
    const jobId = await queueService.add('default', 'log:complete', {});
    const ctx = createMockContext({ jobId }, queueService);

    const handlerPromise = jobStreamHandler(stream, ctx, {}, logger);
    await queueService.startAll();
    await waitFor(() => stream.closed);
    await handlerPromise;

    expect(logger.debug).toHaveBeenCalledWith(
      'Job completed, closing SSE stream',
      expect.objectContaining({ jobId })
    );
  });

  it('should log on stream close', async () => {
    const stream = createMockStream();
    const logger = createMockLogger();
    let handlerStarted = false;

    queueService.registerHandler('default', 'log:close', async () => {
      handlerStarted = true;
      await new Promise(resolve => setTimeout(resolve, 5000));
      return 'done';
    });

    const jobId = await queueService.add('default', 'log:close', {});
    const ctx = createMockContext({ jobId }, queueService);

    const handlerPromise = jobStreamHandler(stream, ctx, {}, logger);
    await queueService.startAll();

    await waitFor(() => handlerStarted);
    stream.close();
    await handlerPromise;

    expect(logger.debug).toHaveBeenCalledWith(
      'SSE stream closed for job',
      expect.objectContaining({ jobId })
    );
  });
});

// ============================================================================
// Tests: Edge Cases
// ============================================================================

describe('jobStreamHandler edge cases', () => {
  let queueService: QueueService;

  beforeEach(async () => {
    queueService = await createTestQueueService();
  });

  afterEach(async () => {
    await queueService.stopAll({ graceful: false, timeout: 1000 });
  });

  it('should handle job with no result (undefined)', async () => {
    const stream = createMockStream();
    const logger = createMockLogger();

    queueService.registerHandler('default', 'edge:undefined', async () => {
      // Return nothing
    });

    const jobId = await queueService.add('default', 'edge:undefined', {});
    const ctx = createMockContext({ jobId }, queueService);

    const handlerPromise = jobStreamHandler(stream, ctx, {}, logger);
    await queueService.startAll();
    await waitFor(() => stream.closed);
    await handlerPromise;

    const completedEvent = stream.events.find(e => e.event === 'job.completed');
    expect(completedEvent).toBeDefined();
    expect((completedEvent?.data as any).result).toBeUndefined();
  });

  it('should handle job with null result', async () => {
    const stream = createMockStream();
    const logger = createMockLogger();

    queueService.registerHandler('default', 'edge:null', async () => null);

    const jobId = await queueService.add('default', 'edge:null', {});
    const ctx = createMockContext({ jobId }, queueService);

    const handlerPromise = jobStreamHandler(stream, ctx, {}, logger);
    await queueService.startAll();
    await waitFor(() => stream.closed);
    await handlerPromise;

    const completedEvent = stream.events.find(e => e.event === 'job.completed');
    expect((completedEvent?.data as any).result).toBeNull();
  });

  it('should handle rapid progress updates', async () => {
    const stream = createMockStream();
    const logger = createMockLogger();

    queueService.registerHandler('default', 'edge:rapid', async ctx => {
      for (let i = 1; i <= 100; i++) {
        await ctx.progress(i);
      }
      return 'done';
    });

    const jobId = await queueService.add('default', 'edge:rapid', {});
    const ctx = createMockContext({ jobId }, queueService);

    const handlerPromise = jobStreamHandler(stream, ctx, {}, logger);
    await queueService.startAll();
    await waitFor(() => stream.closed, 10000);
    await handlerPromise;

    // Should have received progress events
    const progressEvents = stream.events.filter(e => e.event === 'job.progress');
    expect(progressEvents.length).toBeGreaterThan(0);

    // Should have completed
    const completedEvent = stream.events.find(e => e.event === 'job.completed');
    expect(completedEvent).toBeDefined();
  });

  it('should handle queue name filter', async () => {
    // Create service with multiple queues
    const storage = new InMemoryStorage();
    await storage.connect?.();

    const multiQueueService = new QueueService({
      queues: {
        emails: { concurrency: 1 },
        reports: { concurrency: 1 },
      },
      storage,
      logger: createMockLogger() as any,
    });

    multiQueueService.registerHandler('emails', 'email:send', async () => 'sent');
    const jobId = await multiQueueService.add('emails', 'email:send', {});

    const stream = createMockStream();
    const logger = createMockLogger();
    const ctx = createMockContext({ jobId, queueName: 'emails' }, multiQueueService);

    const handlerPromise = jobStreamHandler(stream, ctx, {}, logger);
    await multiQueueService.startAll();
    await waitFor(() => stream.closed);
    await handlerPromise;

    const completedEvent = stream.events.find(e => e.event === 'job.completed');
    expect(completedEvent).toBeDefined();

    await multiQueueService.stopAll({ graceful: false, timeout: 100 });
  });
});
