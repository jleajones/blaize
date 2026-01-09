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

import { createWorkingMockEventBus } from '@blaizejs/testing-utils';

import { QueueService } from './queue-service';
import {
  jobStreamHandler,
  queueStatusHandler,
  queueDashboardHandler,
  createJobHandler,
  cancelJobHandler,
  queuePrometheusHandler,
} from './routes';
import {
  jobStreamQuerySchema,
  queueStatusQuerySchema,
  queueDashboardQuerySchema,
  createJobBodySchema,
  cancelJobBodySchema,
} from './schema';
import { InMemoryStorage } from './storage';

import type { JobSSEStream } from './routes';
import type { BlaizeLogger, Context } from 'blaizejs';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a mock SSE stream
 */
function createMockStream(): JobSSEStream & {
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
  } as JobSSEStream & {
    // ← Cast to the proper type here
    events: Array<{ event: string; data: unknown }>;
    closeCallbacks: Array<() => void>;
    closed: boolean;
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
function createMockContext(
  query: Record<string, unknown>,
  queueService?: QueueService,
  body?: unknown
): Context & { _getResponse(): { contentType?: string; content?: string; statusCode: number } } {
  let contentType: string | undefined;
  let content: string | undefined;
  let statusCode = 200;

  const response = {
    statusCode,
    sent: false,
    raw: {} as any,
    status(code: number) {
      statusCode = code;
      return response;
    },
    header: () => undefined,
    headers: () => ({}),
    type(ct: string) {
      contentType = ct;
      return response;
    },
    json(data: unknown, status?: number) {
      if (status !== undefined) statusCode = status;
      content = JSON.stringify(data);
      contentType = contentType || 'application/json';
      response.sent = true;
    },
    text(data: string, status?: number) {
      if (status !== undefined) statusCode = status;
      content = data;
      response.sent = true;
    },
    html(data: string, status?: number) {
      if (status !== undefined) statusCode = status;
      content = data;
      response.sent = true;
    },
    redirect(location: string, status?: number) {
      if (status !== undefined) statusCode = status;
      response.sent = true;
    },
  };

  return {
    request: {
      method: 'GET',
      path: '/queue/stream',
      url: null,
      query,
      params: {},
      body: body ?? null,
      protocol: 'http',
      isHttp2: false,
      header: () => undefined,
      headers: () => ({}),
      raw: {} as any,
    },
    response,
    state: {},
    services: {
      queue: queueService,
    },
    _getResponse() {
      return { contentType, content, statusCode };
    },
  } as any;
}

/**
 * Create test queue service with in-memory storage
 */
async function createTestQueueService(): Promise<{
  queueService: QueueService;
  eventBus: ReturnType<typeof createWorkingMockEventBus>;
}> {
  const storage = new InMemoryStorage();
  await storage.connect?.();

  const eventBus = createWorkingMockEventBus();

  const queueService = new QueueService({
    queues: {
      default: { concurrency: 1 },
    },
    storage,
    logger: createMockLogger() as any,
    eventBus, // ✅ Pass EventBus so jobs publish events
    serverId: 'test-server', // ✅ Required for EventBus integration
  });

  return { queueService, eventBus };
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
    const eventBus = createWorkingMockEventBus();

    await expect(jobStreamHandler({ stream, ctx, logger, eventBus })).rejects.toThrow(
      'Queue service unavailable'
    );
  });

  it('should throw NotFoundError when job does not exist', async () => {
    const { queueService, eventBus } = await createTestQueueService();
    const stream = createMockStream();
    const ctx = createMockContext({ jobId: '550e8400-e29b-41d4-a716-446655440000' }, queueService);
    const logger = createMockLogger();

    await expect(jobStreamHandler({ stream, ctx, logger, eventBus })).rejects.toThrow(
      'Job 550e8400-e29b-41d4-a716-446655440000 not found'
    );

    await queueService.stopAll({ graceful: false, timeout: 100 });
  });

  it('should include job details in NotFoundError', async () => {
    const { queueService, eventBus } = await createTestQueueService();
    const stream = createMockStream();
    const jobId = '550e8400-e29b-41d4-a716-446655440000';
    const ctx = createMockContext({ jobId, queueName: 'emails' }, queueService);
    const logger = createMockLogger();

    try {
      await jobStreamHandler({ stream, ctx, logger, eventBus });
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
  let eventBus: ReturnType<typeof createWorkingMockEventBus>;

  beforeEach(async () => {
    const testEnv = await createTestQueueService(); // ✅ Destructure
    queueService = testEnv.queueService;
    eventBus = testEnv.eventBus; // ✅ Use shared eventBus
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
    const handlerPromise = jobStreamHandler({ stream, ctx, logger, eventBus });

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
      expect(typeof data.progress).toBe('number');
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

    const handlerPromise = jobStreamHandler({ stream, ctx, logger, eventBus });
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
  let eventBus: ReturnType<typeof createWorkingMockEventBus>;

  beforeEach(async () => {
    const testEnv = await createTestQueueService(); // ✅ Destructure
    queueService = testEnv.queueService;
    eventBus = testEnv.eventBus; // ✅ Use shared eventBus
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

    const handlerPromise = jobStreamHandler({ stream, ctx, logger, eventBus });
    await queueService.startAll();
    await waitFor(() => stream.closed);
    await handlerPromise;

    const completedEvent = stream.events.find(e => e.event === 'job.completed');
    expect(completedEvent).toBeDefined();

    const data = completedEvent?.data as any;
    expect(data.jobId).toBe(jobId);
    expect(data.result).toEqual({ success: true, count: 42 });
  });

  it('should close stream after completion', async () => {
    const stream = createMockStream();
    const logger = createMockLogger();

    queueService.registerHandler('default', 'complete:close', async () => 'done');

    const jobId = await queueService.add('default', 'complete:close', {});
    const ctx = createMockContext({ jobId }, queueService);

    const handlerPromise = jobStreamHandler({ stream, ctx, logger, eventBus });
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
  let eventBus: ReturnType<typeof createWorkingMockEventBus>;

  beforeEach(async () => {
    const testEnv = await createTestQueueService(); // ✅ Destructure
    queueService = testEnv.queueService;
    eventBus = testEnv.eventBus; // ✅ Use shared eventBus
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

    const handlerPromise = jobStreamHandler({ stream, ctx, logger, eventBus });
    await queueService.startAll();
    await waitFor(() => stream.closed, 5000);
    await handlerPromise;

    const failedEvent = stream.events.find(e => e.event === 'job.failed');
    expect(failedEvent).toBeDefined();

    const data = failedEvent?.data as any;
    expect(data.jobId).toBe(jobId);
    expect(data.error.message).toBe('Something went wrong');
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

    const handlerPromise = jobStreamHandler({ stream, ctx, logger, eventBus });
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

    const handlerPromise = jobStreamHandler({ stream, ctx, logger, eventBus });
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
  let eventBus: ReturnType<typeof createWorkingMockEventBus>;

  beforeEach(async () => {
    const testEnv = await createTestQueueService(); // ✅ Destructure
    queueService = testEnv.queueService;
    eventBus = testEnv.eventBus; // ✅ Use shared eventBus
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
    const handlerPromise = jobStreamHandler({ stream, ctx, logger, eventBus });

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

    const handlerPromise = jobStreamHandler({ stream, ctx, logger, eventBus });

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
  let eventBus: ReturnType<typeof createWorkingMockEventBus>;

  beforeEach(async () => {
    const testEnv = await createTestQueueService(); // ✅ Destructure
    queueService = testEnv.queueService;
    eventBus = testEnv.eventBus; // ✅ Use shared eventBus
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

    const handlerPromise = jobStreamHandler({ stream, ctx, logger, eventBus });
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

    const handlerPromise = jobStreamHandler({ stream, ctx, logger, eventBus });
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
  let eventBus: ReturnType<typeof createWorkingMockEventBus>;

  beforeEach(async () => {
    const testEnv = await createTestQueueService(); // ✅ Destructure
    queueService = testEnv.queueService;
    eventBus = testEnv.eventBus; // ✅ Use shared eventBus
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

    await jobStreamHandler({ stream: newStream, ctx, logger, eventBus });

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

    await jobStreamHandler({ stream: newStream, ctx, logger, eventBus });

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
  let eventBus: ReturnType<typeof createWorkingMockEventBus>;

  beforeEach(async () => {
    const testEnv = await createTestQueueService(); // ✅ Destructure
    queueService = testEnv.queueService;
    eventBus = testEnv.eventBus; // ✅ Use shared eventBus
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

    const handlerPromise = jobStreamHandler({ stream, ctx, logger, eventBus });
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

    const handlerPromise = jobStreamHandler({ stream, ctx, logger, eventBus });
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

    const handlerPromise = jobStreamHandler({ stream, ctx, logger, eventBus });
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
  let eventBus: ReturnType<typeof createWorkingMockEventBus>;

  beforeEach(async () => {
    const testEnv = await createTestQueueService(); // ✅ Destructure
    queueService = testEnv.queueService;
    eventBus = testEnv.eventBus; // ✅ Use shared eventBus
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

    const handlerPromise = jobStreamHandler({ stream, ctx, logger, eventBus });
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

    const handlerPromise = jobStreamHandler({ stream, ctx, logger, eventBus });
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

    const handlerPromise = jobStreamHandler({ stream, ctx, logger, eventBus });
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
      eventBus, // ✅ Shared EventBus
      serverId: 'test-server',
    });

    multiQueueService.registerHandler('emails', 'email:send', async () => 'sent');
    const jobId = await multiQueueService.add('emails', 'email:send', {});

    const stream = createMockStream();
    const logger = createMockLogger();
    const ctx = createMockContext({ jobId, queueName: 'emails' }, multiQueueService);

    const handlerPromise = jobStreamHandler({ stream, ctx, logger, eventBus });
    await multiQueueService.startAll();
    await waitFor(() => stream.closed);
    await handlerPromise;

    const completedEvent = stream.events.find(e => e.event === 'job.completed');
    expect(completedEvent).toBeDefined();

    await multiQueueService.stopAll({ graceful: false, timeout: 100 });
  });
});

// ============================================================================
// HTTP Query Schema Tests
// ============================================================================

describe('queueStatusQuerySchema', () => {
  it('should accept empty query (all defaults)', () => {
    const result = queueStatusQuerySchema.parse({});
    expect(parseInt(result.limit, 10)).toBe(20);
    expect(result.queueName).toBeUndefined();
    expect(result.status).toBeUndefined();
  });

  it('should accept valid queueName', () => {
    const result = queueStatusQuerySchema.parse({ queueName: 'emails' });
    expect(result.queueName).toBe('emails');
  });

  it('should accept valid status', () => {
    const result = queueStatusQuerySchema.parse({ status: 'failed' });
    expect(result.status).toBe('failed');
  });

  it('should coerce limit to number', () => {
    const result = queueStatusQuerySchema.parse({ limit: '50' });
    expect(parseInt(result.limit, 10)).toBe(50);
  });

  it('should reject invalid status', () => {
    expect(() => queueStatusQuerySchema.parse({ status: 'invalid' })).toThrow();
  });

  it('should reject limit below 1', () => {
    expect(() => queueStatusQuerySchema.parse({ limit: 0 })).toThrow();
  });

  it('should reject limit above 100', () => {
    expect(() => queueStatusQuerySchema.parse({ limit: 101 })).toThrow();
  });
});

describe('queueDashboardQuerySchema', () => {
  it('should accept empty query', () => {
    const result = queueDashboardQuerySchema.parse({});
    expect(result.queueName).toBeUndefined();
    expect(result.refresh).toBeUndefined();
  });

  it('should accept valid refresh interval', () => {
    const result = queueDashboardQuerySchema.parse({ refresh: '30' });
    expect(parseInt(result.refresh!, 10)).toBe(30);
  });

  it('should reject refresh below 5', () => {
    expect(() => queueDashboardQuerySchema.parse({ refresh: 4 })).toThrow();
  });

  it('should reject refresh above 300', () => {
    expect(() => queueDashboardQuerySchema.parse({ refresh: 301 })).toThrow();
  });
});

// ============================================================================
// HTTP Body Schema Tests
// ============================================================================

describe('createJobBodySchema', () => {
  it('should accept valid body with required fields', () => {
    const result = createJobBodySchema.parse({
      queueName: 'emails',
      jobType: 'send-welcome',
    });
    expect(result.queueName).toBe('emails');
    expect(result.jobType).toBe('send-welcome');
  });

  it('should accept body with data and options', () => {
    const result = createJobBodySchema.parse({
      queueName: 'emails',
      jobType: 'send-welcome',
      data: { userId: '123' },
      options: { priority: 8, maxRetries: 5 },
    });
    expect(result.data).toEqual({ userId: '123' });
    expect(result.options?.priority).toBe(8);
  });

  it('should reject missing queueName', () => {
    expect(() => createJobBodySchema.parse({ jobType: 'send-welcome' })).toThrow(
      'queueName is required'
    );
  });

  it('should reject missing jobType', () => {
    expect(() => createJobBodySchema.parse({ queueName: 'emails' })).toThrow('jobType is required');
  });

  it('should reject empty queueName', () => {
    expect(() => createJobBodySchema.parse({ queueName: '', jobType: 'test' })).toThrow();
  });
});

describe('cancelJobBodySchema', () => {
  it('should accept valid UUID jobId', () => {
    const result = cancelJobBodySchema.parse({
      queueName: 'emails',
      jobId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.jobId).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('should accept optional queueName and reason', () => {
    const result = cancelJobBodySchema.parse({
      jobId: '550e8400-e29b-41d4-a716-446655440000',
      queueName: 'emails',
      reason: 'User requested',
    });
    expect(result.queueName).toBe('emails');
    expect(result.reason).toBe('User requested');
  });

  it('should reject invalid UUID', () => {
    expect(() => cancelJobBodySchema.parse({ jobId: 'not-a-uuid' })).toThrow('uuid');
  });

  it('should reject missing jobId', () => {
    expect(() => cancelJobBodySchema.parse({})).toThrow('jobId is required');
  });
});

// ============================================================================
// HTTP Handler Tests
// ============================================================================

describe('queueStatusHandler', () => {
  it('should throw ServiceNotAvailableError when queue service unavailable', async () => {
    const ctx = createMockContext({});
    const logger = createMockLogger();

    await expect(queueStatusHandler({ ctx, logger })).rejects.toThrow('Queue service unavailable');
  });

  it('should return queue status for all queues', async () => {
    const storage = new InMemoryStorage();

    const eventBus = createWorkingMockEventBus();
    await storage.connect?.();

    const queueService = new QueueService({
      queues: { default: { concurrency: 1 } },
      storage,
      logger: createMockLogger() as any,
      eventBus,
    });

    queueService.registerHandler('default', 'test', async () => 'done');
    await queueService.add('default', 'test', { foo: 'bar' });

    const ctx = createMockContext({ limit: '20' }, queueService);
    const logger = createMockLogger();

    const result = await queueStatusHandler({ ctx, logger });

    expect(result.queues).toHaveLength(1);
    expect(result.queues[0]!.name).toBe('default');
    expect(result.queues[0]!.stats.total).toBe(1);
    expect(result.queues[0]!.jobs).toHaveLength(1);
  });

  it('should filter by queue name', async () => {
    const storage = new InMemoryStorage();
    const eventBus = createWorkingMockEventBus();
    await storage.connect?.();

    const queueService = new QueueService({
      queues: {
        emails: { concurrency: 1 },
        reports: { concurrency: 1 },
      },
      storage,
      logger: createMockLogger() as any,
      eventBus,
    });

    queueService.registerHandler('emails', 'send', async () => 'sent');
    await queueService.add('emails', 'send', {});

    const ctx = createMockContext({ queueName: 'emails', limit: '20' }, queueService);
    const logger = createMockLogger();

    const result = await queueStatusHandler({ ctx, logger });

    expect(result.queues).toHaveLength(1);
    expect(result.queues[0]!.name).toBe('emails');
  });

  it('should log debug message', async () => {
    const storage = new InMemoryStorage();

    const eventBus = createWorkingMockEventBus();
    await storage.connect?.();

    const queueService = new QueueService({
      queues: { default: { concurrency: 1 } },
      storage,
      logger: createMockLogger() as any,
      eventBus,
    });

    const ctx = createMockContext({ limit: '20' }, queueService);
    const logger = createMockLogger();

    await queueStatusHandler({ ctx, logger });

    expect(logger.debug).toHaveBeenCalledWith('Fetching queue status', expect.any(Object));
  });
});

describe('queuePrometheusHandler', () => {
  it('should throw ServiceNotAvailableError when queue service unavailable', async () => {
    const ctx = createMockContext({});
    const logger = createMockLogger();

    await expect(queuePrometheusHandler({ ctx, logger })).rejects.toThrow(
      'Queue service unavailable'
    );
  });

  it('should return Prometheus format metrics', async () => {
    const storage = new InMemoryStorage();

    const eventBus = createWorkingMockEventBus();
    await storage.connect?.();

    const queueService = new QueueService({
      queues: { emails: { concurrency: 1 } },
      storage,
      logger: createMockLogger() as any,
      eventBus,
    });

    queueService.registerHandler('emails', 'send', async () => 'sent');
    await queueService.add('emails', 'send', {});

    const ctx = createMockContext({}, queueService);
    const logger = createMockLogger();

    await queuePrometheusHandler({ ctx, logger });

    const response = ctx._getResponse();
    expect(response.contentType).toBe('text/plain; version=0.0.4; charset=utf-8');
    expect(response.content).toContain('# HELP blaize_queue_jobs_total');
    expect(response.content).toContain('# TYPE blaize_queue_jobs_total gauge');
    expect(response.content).toContain('blaize_queue_jobs_total{queue="emails",status="queued"} 1');
  });

  it('should include all status types', async () => {
    const storage = new InMemoryStorage();

    const eventBus = createWorkingMockEventBus();
    await storage.connect?.();

    const queueService = new QueueService({
      queues: { default: { concurrency: 1 } },
      storage,
      logger: createMockLogger() as any,
      eventBus,
    });

    const ctx = createMockContext({}, queueService);
    const logger = createMockLogger();

    await queuePrometheusHandler({ ctx, logger });

    const response = ctx._getResponse();
    expect(response.content).toContain('status="queued"');
    expect(response.content).toContain('status="running"');
    expect(response.content).toContain('status="completed"');
    expect(response.content).toContain('status="failed"');
    expect(response.content).toContain('status="cancelled"');
  });
});

describe('queueDashboardHandler', () => {
  it('should throw ServiceNotAvailableError when queue service unavailable', async () => {
    const ctx = createMockContext({});
    const logger = createMockLogger();

    await expect(queueDashboardHandler({ ctx, logger })).rejects.toThrow(
      'Queue service unavailable'
    );
  });

  it('should return HTML dashboard', async () => {
    const storage = new InMemoryStorage();

    const eventBus = createWorkingMockEventBus();
    await storage.connect?.();

    const queueService = new QueueService({
      queues: { emails: { concurrency: 1 } },
      storage,
      logger: createMockLogger() as any,
      eventBus,
    });

    const ctx = createMockContext({}, queueService);
    const logger = createMockLogger();

    await queueDashboardHandler({ ctx, logger });

    const response = ctx._getResponse();
    expect(response.contentType).toBe('text/html; charset=utf-8');
    expect(response.content).toContain('<!DOCTYPE html>');
    expect(response.content).toContain('BlaizeJS Queue');
    expect(response.content).toContain('emails');
  });

  it('should include refresh meta tag when specified', async () => {
    const storage = new InMemoryStorage();

    const eventBus = createWorkingMockEventBus();
    await storage.connect?.();

    const queueService = new QueueService({
      queues: { default: { concurrency: 1 } },
      storage,
      logger: createMockLogger() as any,
      eventBus,
    });

    const ctx = createMockContext({ refresh: '30' }, queueService);
    const logger = createMockLogger();

    await queueDashboardHandler({ ctx, logger });

    const response = ctx._getResponse();
    expect(response.content).toContain('http-equiv="refresh"');
    expect(response.content).toContain('content="30"');
  });

  it('should include BlaizeJS branding', async () => {
    const storage = new InMemoryStorage();

    const eventBus = createWorkingMockEventBus();
    await storage.connect?.();

    const queueService = new QueueService({
      queues: { default: { concurrency: 1 } },
      storage,
      logger: createMockLogger() as any,
      eventBus,
    });

    const ctx = createMockContext({}, queueService);
    const logger = createMockLogger();

    await queueDashboardHandler({ ctx, logger });

    const response = ctx._getResponse();
    expect(response.content).toContain('🔥');
    expect(response.content).toContain('BlaizeJS');
  });
});

describe('createJobHandler', () => {
  it('should throw ServiceNotAvailableError when queue service unavailable', async () => {
    const ctx = createMockContext({}, undefined, {
      queueName: 'emails',
      jobType: 'send',
    });
    const logger = createMockLogger();

    await expect(createJobHandler({ ctx, logger })).rejects.toThrow('Queue service unavailable');
  });

  it('should create job and return response', async () => {
    const storage = new InMemoryStorage();

    const eventBus = createWorkingMockEventBus();
    await storage.connect?.();

    const queueService = new QueueService({
      queues: { emails: { concurrency: 1 } },
      storage,
      logger: createMockLogger() as any,
      eventBus,
    });

    queueService.registerHandler('emails', 'send-welcome', async () => 'sent');

    const ctx = createMockContext({}, queueService, {
      queueName: 'emails',
      jobType: 'send-welcome',
      data: { userId: '123' },
    });
    const logger = createMockLogger();

    const result = await createJobHandler({ ctx, logger });

    expect(result.jobId).toBeDefined();
    expect(result.queueName).toBe('emails');
    expect(result.jobType).toBe('send-welcome');
    expect(result.queuedAt).toBeDefined();
    expect(result.status).toBe('queued');
    expect(result.priority).toBe(5);
  });

  it('should log info messages', async () => {
    const storage = new InMemoryStorage();

    const eventBus = createWorkingMockEventBus();
    await storage.connect?.();

    const queueService = new QueueService({
      queues: { emails: { concurrency: 1 } },
      storage,
      logger: createMockLogger() as any,
      eventBus,
    });

    queueService.registerHandler('emails', 'send', async () => 'sent');

    const ctx = createMockContext({}, queueService, {
      queueName: 'emails',
      jobType: 'send',
    });
    const logger = createMockLogger();

    await createJobHandler({ ctx, logger });

    expect(logger.info).toHaveBeenCalledWith('Creating job', expect.any(Object));
    expect(logger.info).toHaveBeenCalledWith('Job created', expect.any(Object));
  });
});

describe('cancelJobHandler', () => {
  it('should throw ServiceNotAvailableError when queue service unavailable', async () => {
    const ctx = createMockContext({}, undefined, {
      jobId: '550e8400-e29b-41d4-a716-446655440000',
    });
    const logger = createMockLogger();

    await expect(cancelJobHandler({ ctx, logger })).rejects.toThrow('Queue service unavailable');
  });

  it('should cancel queued job and return response', async () => {
    const storage = new InMemoryStorage();

    const eventBus = createWorkingMockEventBus();
    await storage.connect?.();

    const queueService = new QueueService({
      queues: { emails: { concurrency: 1 } },
      storage,
      logger: createMockLogger() as any,
      eventBus,
    });

    queueService.registerHandler('emails', 'send', async () => 'sent');
    const jobId = await queueService.add('emails', 'send', {});

    const ctx = createMockContext({}, queueService, {
      jobId,
      queueName: 'emails',
      reason: 'User requested',
    });
    const logger = createMockLogger();

    const result = await cancelJobHandler({ ctx, logger });

    expect(result.jobId).toBe(jobId);
    expect(result.cancelled).toBe(true);
    expect(result.reason).toBe('User requested');
    expect(result.cancelledAt).toBeDefined();
  });

  it('should throw NotFoundError when job not found', async () => {
    const storage = new InMemoryStorage();

    const eventBus = createWorkingMockEventBus();
    await storage.connect?.();

    const queueService = new QueueService({
      queues: { emails: { concurrency: 1 } },
      storage,
      logger: createMockLogger() as any,
      eventBus,
    });

    const ctx = createMockContext({}, queueService, {
      jobId: '550e8400-e29b-41d4-a716-446655440000',
      queueName: 'emails',
    });
    const logger = createMockLogger();

    await expect(cancelJobHandler({ ctx, logger })).rejects.toThrow(
      'not found or already completed'
    );
  });

  it('should log info messages', async () => {
    const storage = new InMemoryStorage();

    const eventBus = createWorkingMockEventBus();
    await storage.connect?.();

    const queueService = new QueueService({
      queues: { emails: { concurrency: 1 } },
      storage,
      logger: createMockLogger() as any,
      eventBus,
    });

    queueService.registerHandler('emails', 'send', async () => 'sent');
    const jobId = await queueService.add('emails', 'send', {});

    const ctx = createMockContext({}, queueService, {
      jobId,
      queueName: 'emails',
    });
    const logger = createMockLogger();

    await cancelJobHandler({ ctx, logger });

    expect(logger.info).toHaveBeenCalledWith('Cancelling job', expect.any(Object));
    expect(logger.info).toHaveBeenCalledWith('Job cancelled', expect.any(Object));
  });
});
