/**
 * Unit Tests for QueueInstance
 *
 * Tests verify:
 * - Constructor with (config, storage, logger) signature
 * - Job submission and retrieval
 * - Handler registration
 * - Event emission (job:queued, job:started, job:completed, etc.)
 * - Job cancellation
 * - Queue start/stop lifecycle
 * - Concurrency control
 * - Statistics
 *
 * @since 0.4.0
 */
import { createMockLogger, MockLogger } from '@blaizejs/testing-utils';

import { HandlerAlreadyRegisteredError } from './errors';
import { QueueInstance } from './queue-instance';
import { InMemoryStorage } from './storage/in-memory';

import type { JobHandler, QueueStorageAdapter, QueueConfig } from './types';

// ============================================================================
// Test Helpers
// ============================================================================

function createTestConfig(overrides?: Partial<QueueConfig>): QueueConfig {
  return {
    name: 'test-queue',
    concurrency: 5,
    defaultTimeout: 30000,
    defaultMaxRetries: 3,
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('QueueInstance', () => {
  let storage: QueueStorageAdapter;
  let logger: MockLogger;
  let queue: QueueInstance;

  beforeEach(() => {
    storage = new InMemoryStorage();
    logger = createMockLogger();
    queue = new QueueInstance(createTestConfig(), storage, logger);
  });

  afterEach(async () => {
    // Ensure queue is stopped
    if (queue.running) {
      await queue.stop({ graceful: false });
    }
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Constructor
  // ==========================================================================
  describe('Constructor', () => {
    it('should create instance with config, storage, and logger', () => {
      expect(queue.name).toBe('test-queue');
      expect(queue.running).toBe(false);
      expect(queue.shuttingDown).toBe(false);
      expect(queue.runningJobCount).toBe(0);
    });

    it('should create child logger with queue context', () => {
      expect(logger.child).toHaveBeenCalledWith({ queue: 'test-queue' });
    });

    it('should log creation', () => {
      // The child logger is used for the debug call
      const childLogger = (logger.child as any).mock.results[0]?.value;
      if (childLogger) {
        expect(childLogger.debug).toHaveBeenCalledWith(
          'QueueInstance created',
          expect.objectContaining({
            queue: 'test-queue',
            concurrency: 5,
            defaultTimeout: 30000,
            defaultMaxRetries: 3,
          })
        );
      }
    });

    it('should set max listeners for SSE support', () => {
      expect(queue.getMaxListeners()).toBe(1000);
    });

    it('should accept storage adapter as second parameter', () => {
      const customStorage = new InMemoryStorage();
      const q = new QueueInstance(
        createTestConfig({ name: 'custom-queue' }),
        customStorage,
        logger
      );
      expect(q.name).toBe('custom-queue');
    });
  });

  // ==========================================================================
  // Job Submission (add)
  // ==========================================================================
  describe('add()', () => {
    it('should add a job and return job ID', async () => {
      const jobId = await queue.add('email:send', {
        to: 'user@example.com',
        subject: 'Hello',
      });

      expect(jobId).toBeDefined();
      expect(typeof jobId).toBe('string');
      expect(jobId.length).toBeGreaterThan(0);
    });

    it('should store job in storage', async () => {
      const jobId = await queue.add('email:send', {
        to: 'user@example.com',
        subject: 'Hello',
      });

      const job = await storage.getJob(jobId, 'test-queue');
      expect(job).not.toBeNull();
      expect(job?.id).toBe(jobId);
      expect(job?.type).toBe('email:send');
      expect(job?.status).toBe('queued');
      expect(job?.data).toEqual({ to: 'user@example.com', subject: 'Hello' });
    });

    it('should apply default priority', async () => {
      const jobId = await queue.add('email:send', { data: 'test' });
      const job = await storage.getJob(jobId, 'test-queue');
      expect(job?.priority).toBe(5); // DEFAULT_PRIORITY
    });

    it('should apply custom priority', async () => {
      const jobId = await queue.add('email:send', { data: 'test' }, { priority: 10 });
      const job = await storage.getJob(jobId, 'test-queue');
      expect(job?.priority).toBe(10);
    });

    it('should apply default timeout', async () => {
      const jobId = await queue.add('email:send', { data: 'test' });
      const job = await storage.getJob(jobId, 'test-queue');
      expect(job?.timeout).toBe(30000);
    });

    it('should apply custom timeout', async () => {
      const jobId = await queue.add('email:send', { data: 'test' }, { timeout: 60000 });
      const job = await storage.getJob(jobId, 'test-queue');
      expect(job?.timeout).toBe(60000);
    });

    it('should apply default maxRetries', async () => {
      const jobId = await queue.add('email:send', { data: 'test' });
      const job = await storage.getJob(jobId, 'test-queue');
      expect(job?.maxRetries).toBe(3);
    });

    it('should apply custom maxRetries', async () => {
      const jobId = await queue.add('email:send', { data: 'test' }, { maxRetries: 5 });
      const job = await storage.getJob(jobId, 'test-queue');
      expect(job?.maxRetries).toBe(5);
    });

    it('should apply metadata', async () => {
      const jobId = await queue.add(
        'email:send',
        { data: 'test' },
        {
          metadata: { userId: '123', source: 'api' },
        }
      );
      const job = await storage.getJob(jobId, 'test-queue');
      expect(job?.metadata).toEqual({ userId: '123', source: 'api' });
    });

    it('should emit job:queued event', async () => {
      const eventSpy = vi.fn();
      queue.on('job:queued', eventSpy);

      await queue.add('email:send', { to: 'user@example.com' });

      expect(eventSpy).toHaveBeenCalledTimes(1);
      expect(eventSpy.mock.calls[0]![0].type).toBe('email:send');
      expect(eventSpy.mock.calls[0]![0].status).toBe('queued');
    });
  });

  // ==========================================================================
  // Handler Registration
  // ==========================================================================
  describe('registerHandler()', () => {
    it('should register a handler for a job type', () => {
      const handler: JobHandler<unknown, unknown> = async () => {};
      queue.registerHandler('email:send', handler);
      expect(queue.hasHandler('email:send')).toBe(true);
    });

    it('should throw HandlerAlreadyRegisteredError for duplicate registration', () => {
      queue.registerHandler('email:send', async () => {});
      expect(() => {
        queue.registerHandler('email:send', async () => {});
      }).toThrow(HandlerAlreadyRegisteredError);
    });

    it('should allow registering different handlers for different job types', () => {
      queue.registerHandler('email:send', async () => {});
      queue.registerHandler('report:generate', async () => {});
      expect(queue.hasHandler('email:send')).toBe(true);
      expect(queue.hasHandler('report:generate')).toBe(true);
    });
  });

  describe('hasHandler()', () => {
    it('should return false for unregistered handler', () => {
      expect(queue.hasHandler('unknown')).toBe(false);
    });

    it('should return true for registered handler', () => {
      queue.registerHandler('email:send', async () => {});
      expect(queue.hasHandler('email:send')).toBe(true);
    });
  });

  // ==========================================================================
  // Job Retrieval
  // ==========================================================================
  describe('getJob()', () => {
    it('should return job by ID', async () => {
      const jobId = await queue.add('email:send', { to: 'test@example.com' });
      const job = await queue.getJob(jobId);

      expect(job).toBeDefined();
      expect(job?.id).toBe(jobId);
    });

    it('should return undefined for non-existent job', async () => {
      const job = await queue.getJob('non-existent');
      expect(job).toBeUndefined();
    });
  });

  describe('listJobs()', () => {
    beforeEach(async () => {
      await queue.add('email:send', { to: 'a@test.com' });
      await queue.add('email:send', { to: 'b@test.com' });
      await queue.add('report:generate', { reportId: '123' });
    });

    it('should list all jobs', async () => {
      const jobs = await queue.listJobs();
      expect(jobs).toHaveLength(3);
    });

    it('should filter by status', async () => {
      const jobs = await queue.listJobs({ status: 'queued' });
      expect(jobs).toHaveLength(3);
      expect(jobs.every(j => j.status === 'queued')).toBe(true);
    });

    it('should limit results', async () => {
      const jobs = await queue.listJobs({ limit: 2 });
      expect(jobs).toHaveLength(2);
    });
  });

  // ==========================================================================
  // Statistics
  // ==========================================================================
  describe('getStats()', () => {
    it('should return queue statistics', async () => {
      await queue.add('email:send', { to: 'test@example.com' });
      await queue.add('email:send', { to: 'test2@example.com' });

      const stats = await queue.getStats();

      expect(stats.total).toBe(2);
      expect(stats.queued).toBe(2);
      expect(stats.running).toBe(0);
      expect(stats.completed).toBe(0);
      expect(stats.failed).toBe(0);
      expect(stats.cancelled).toBe(0);
    });
  });

  // ==========================================================================
  // Job Cancellation
  // ==========================================================================
  describe('cancelJob()', () => {
    it('should cancel a queued job', async () => {
      const jobId = await queue.add('email:send', { to: 'test@example.com' });
      const cancelled = await queue.cancelJob(jobId, 'Testing');

      expect(cancelled).toBe(true);

      const job = await queue.getJob(jobId);
      expect(job?.status).toBe('cancelled');
    });

    it('should emit job:cancelled event', async () => {
      const eventSpy = vi.fn();
      queue.on('job:cancelled', eventSpy);

      const jobId = await queue.add('email:send', { to: 'test@example.com' });
      await queue.cancelJob(jobId, 'Testing');

      expect(eventSpy).toHaveBeenCalledTimes(1);
      expect(eventSpy.mock.calls[0]![0].id).toBe(jobId);
      expect(eventSpy.mock.calls[0]![1]).toBe('Testing');
    });

    it('should return false for non-existent job', async () => {
      const cancelled = await queue.cancelJob('non-existent');
      expect(cancelled).toBe(false);
    });
  });

  // ==========================================================================
  // Lifecycle Methods
  // ==========================================================================
  describe('start()', () => {
    it('should set running flag', async () => {
      await queue.start();
      expect(queue.running).toBe(true);
    });

    it('should not start twice', async () => {
      await queue.start();
      await queue.start();

      // Verify only one start log
      const childLogger = (logger.child as any).mock.results[0]?.value;
      if (childLogger) {
        const startCalls = (childLogger.info as any).mock.calls.filter(
          (call: any[]) => call[0] === 'Queue started'
        );
        expect(startCalls).toHaveLength(1);
      }
    });
  });

  describe('stop()', () => {
    it('should set running to false', async () => {
      await queue.start();
      await queue.stop();
      expect(queue.running).toBe(false);
    });

    it('should set shuttingDown flag', async () => {
      await queue.start();
      await queue.stop();
      expect(queue.shuttingDown).toBe(true);
    });

    it('should accept graceful option', async () => {
      await queue.start();
      await queue.stop({ graceful: true });
      expect(queue.running).toBe(false);
    });

    it('should accept timeout option', async () => {
      await queue.start();
      await queue.stop({ graceful: true, timeout: 5000 });
      expect(queue.running).toBe(false);
    });

    it('should force stop when graceful is false', async () => {
      await queue.start();
      await queue.stop({ graceful: false });
      expect(queue.running).toBe(false);
    });

    it('should not stop twice', async () => {
      await queue.start();
      await queue.stop();
      await queue.stop();

      // Verify only one stop log
      const childLogger = (logger.child as any).mock.results[0]?.value;
      if (childLogger) {
        const stopCalls = (childLogger.info as any).mock.calls.filter(
          (call: any[]) => call[0] === 'Queue stopping'
        );
        expect(stopCalls).toHaveLength(1);
      }
    });
  });

  // ==========================================================================
  // Processing Loop
  // ==========================================================================
  describe('Processing Loop', () => {
    beforeEach(() => {
      queue.registerHandler('email:send', async () => ({ sent: true }));
      queue.registerHandler('report:generate', async () => ({ generated: true }));
    });

    it('should process queued jobs when started', async () => {
      const jobId = await queue.add('email:send', { to: 'test@example.com' });

      const completedSpy = vi.fn();
      queue.on('job:completed', completedSpy);

      await queue.start();

      // Wait for job to be processed
      await vi.waitFor(
        () => {
          expect(completedSpy).toHaveBeenCalled();
        },
        { timeout: 1000 }
      );

      await queue.stop();

      const job = await queue.getJob(jobId);
      expect(job?.status).toBe('completed');
    });

    it('should emit job:started event', async () => {
      const jobId = await queue.add('email:send', { to: 'test@example.com' });

      const startedSpy = vi.fn();
      queue.on('job:started', startedSpy);

      await queue.start();

      await vi.waitFor(
        () => {
          expect(startedSpy).toHaveBeenCalled();
        },
        { timeout: 1000 }
      );

      await queue.stop();

      expect(startedSpy.mock.calls[0]![0].id).toBe(jobId);
    });

    it('should emit job:completed event with result', async () => {
      await queue.add('email:send', { to: 'test@example.com' });

      const completedSpy = vi.fn();
      queue.on('job:completed', completedSpy);

      await queue.start();

      await vi.waitFor(
        () => {
          expect(completedSpy).toHaveBeenCalled();
        },
        { timeout: 1000 }
      );

      await queue.stop();

      expect(completedSpy.mock.calls[0]![1]).toEqual({ sent: true });
    });

    it('should process multiple jobs', async () => {
      await queue.add('email:send', { to: 'a@test.com' });
      await queue.add('email:send', { to: 'b@test.com' });
      await queue.add('email:send', { to: 'c@test.com' });

      const completedSpy = vi.fn();
      queue.on('job:completed', completedSpy);

      await queue.start();

      await vi.waitFor(
        () => {
          expect(completedSpy).toHaveBeenCalledTimes(3);
        },
        { timeout: 2000 }
      );

      await queue.stop();
    });

    it('should respect concurrency limit', async () => {
      const lowConcurrencyQueue = new QueueInstance(
        createTestConfig({ name: 'low-concurrency', concurrency: 2 }),
        storage,
        createMockLogger()
      );

      let maxConcurrent = 0;
      let currentConcurrent = 0;

      lowConcurrencyQueue.registerHandler('email:send', async () => {
        currentConcurrent++;
        maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
        await new Promise(resolve => setTimeout(resolve, 50));
        currentConcurrent--;
        return {};
      });

      for (let i = 0; i < 5; i++) {
        await lowConcurrencyQueue.add('email:send', { index: i });
      }

      await lowConcurrencyQueue.start();

      await vi.waitFor(
        async () => {
          const stats = await lowConcurrencyQueue.getStats();
          expect(stats.completed).toBe(5);
        },
        { timeout: 3000 }
      );

      await lowConcurrencyQueue.stop();

      expect(maxConcurrent).toBeLessThanOrEqual(2);
    });

    it('should emit job:failed event when no handler is registered', async () => {
      const noHandlerQueue = new QueueInstance(
        createTestConfig({ name: 'no-handler' }),
        storage,
        createMockLogger()
      );

      const jobId = await noHandlerQueue.add('unknown:job', { data: 'test' });

      const failedSpy = vi.fn();
      noHandlerQueue.on('job:failed', failedSpy);

      await noHandlerQueue.start();

      await vi.waitFor(
        () => {
          expect(failedSpy).toHaveBeenCalled();
        },
        { timeout: 1000 }
      );

      await noHandlerQueue.stop();

      const job = await noHandlerQueue.getJob(jobId);
      expect(job?.status).toBe('failed');
      expect(job?.error?.code).toBe('HANDLER_NOT_FOUND');
    });

    it('should emit job:failed event on handler error', async () => {
      const errorQueue = new QueueInstance(
        createTestConfig({ name: 'error-queue' }),
        storage,
        createMockLogger()
      );

      errorQueue.registerHandler('failing:job', async () => {
        throw new Error('Handler failed!');
      });

      await errorQueue.add('failing:job', { data: 'test' });

      const failedSpy = vi.fn();
      errorQueue.on('job:failed', failedSpy);

      await errorQueue.start();

      await vi.waitFor(
        () => {
          expect(failedSpy).toHaveBeenCalled();
        },
        { timeout: 1000 }
      );

      await errorQueue.stop();

      expect(failedSpy.mock.calls[0]![1].message).toBe('Handler failed!');
      expect(failedSpy.mock.calls[0]![1].code).toBe('EXECUTION_ERROR');
    });

    it('should emit job:progress event', async () => {
      const progressQueue = new QueueInstance(
        createTestConfig({ name: 'progress-queue' }),
        storage,
        createMockLogger()
      );

      progressQueue.registerHandler('progress:job', async ctx => {
        await ctx.progress(50, 'Halfway there');
        await ctx.progress(100, 'Done');
        return { success: true };
      });

      await progressQueue.add('progress:job', {});

      const progressSpy = vi.fn();
      progressQueue.on('job:progress', progressSpy);

      await progressQueue.start();

      await vi.waitFor(
        () => {
          expect(progressSpy).toHaveBeenCalledTimes(2);
        },
        { timeout: 1000 }
      );

      await progressQueue.stop();

      expect(progressSpy.mock.calls[0]![1]).toBe(50);
      expect(progressSpy.mock.calls[0]![2]).toBe('Halfway there');
      expect(progressSpy.mock.calls[1]![1]).toBe(100);
    });

    it('should wait for running jobs on graceful stop', async () => {
      const slowQueue = new QueueInstance(
        createTestConfig({ name: 'slow-queue', concurrency: 1 }),
        storage,
        createMockLogger()
      );

      let jobCompleted = false;
      slowQueue.registerHandler('slow:job', async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
        jobCompleted = true;
        return {};
      });

      await slowQueue.add('slow:job', {});

      await slowQueue.start();

      // Wait for job to start
      await new Promise(resolve => setTimeout(resolve, 50));

      // Graceful stop should wait for the job
      await slowQueue.stop({ graceful: true, timeout: 5000 });

      expect(jobCompleted).toBe(true);
    });

    it('should timeout job that exceeds timeout limit', async () => {
      const timeoutQueue = new QueueInstance(
        createTestConfig({
          name: 'timeout-queue',
          defaultTimeout: 100, // Very short timeout
        }),
        storage,
        createMockLogger()
      );

      timeoutQueue.registerHandler('slow:job', async () => {
        // This will take longer than the 100ms timeout
        await new Promise(resolve => setTimeout(resolve, 500));
        return { shouldNotReach: true };
      });

      const jobId = await timeoutQueue.add('slow:job', {});

      const failedSpy = vi.fn();
      timeoutQueue.on('job:failed', failedSpy);

      await timeoutQueue.start();

      await vi.waitFor(
        () => {
          expect(failedSpy).toHaveBeenCalled();
        },
        { timeout: 2000 }
      );

      await timeoutQueue.stop();

      const job = await timeoutQueue.getJob(jobId);
      expect(job?.status).toBe('failed');
      expect(job?.error?.code).toBe('JOB_TIMEOUT');
    });

    it('should pass abort signal to handler', async () => {
      const signalQueue = new QueueInstance(
        createTestConfig({ name: 'signal-queue' }),
        storage,
        createMockLogger()
      );

      let receivedSignal: AbortSignal | undefined;
      signalQueue.registerHandler('signal:job', async ctx => {
        receivedSignal = ctx.signal;
        return { signalReceived: true };
      });

      await signalQueue.add('signal:job', {});

      const completedSpy = vi.fn();
      signalQueue.on('job:completed', completedSpy);

      await signalQueue.start();

      await vi.waitFor(
        () => {
          expect(completedSpy).toHaveBeenCalled();
        },
        { timeout: 1000 }
      );

      await signalQueue.stop();

      expect(receivedSignal).toBeDefined();
      expect(receivedSignal).toBeInstanceOf(AbortSignal);
    });

    it('should provide job-scoped logger with context', async () => {
      const loggerQueue = new QueueInstance(
        createTestConfig({ name: 'logger-queue' }),
        storage,
        createMockLogger()
      );

      let receivedLogger: any;
      loggerQueue.registerHandler('logger:job', async ctx => {
        receivedLogger = ctx.logger;
        ctx.logger.info('Test log from handler');
        return {};
      });

      await loggerQueue.add('logger:job', {});

      const completedSpy = vi.fn();
      loggerQueue.on('job:completed', completedSpy);

      await loggerQueue.start();

      await vi.waitFor(
        () => {
          expect(completedSpy).toHaveBeenCalled();
        },
        { timeout: 1000 }
      );

      await loggerQueue.stop();

      expect(receivedLogger).toBeDefined();
      // Logger should have child() method called
      expect(typeof receivedLogger.info).toBe('function');
    });

    it('should update job progress in storage', async () => {
      const progressQueue = new QueueInstance(
        createTestConfig({ name: 'progress-storage-queue' }),
        storage,
        createMockLogger()
      );

      let jobIdCapture: string | undefined;
      progressQueue.registerHandler('progress:job', async ctx => {
        jobIdCapture = ctx.jobId;
        await ctx.progress(25, 'Quarter done');
        await ctx.progress(75, 'Three quarters');
        return {};
      });

      const jobId = await progressQueue.add('progress:job', {});

      await progressQueue.start();

      await vi.waitFor(
        async () => {
          const job = await progressQueue.getJob(jobId);
          return job?.status === 'completed';
        },
        { timeout: 1000 }
      );

      await progressQueue.stop();

      const job = await progressQueue.getJob(jobId);
      expect(job?.progress).toBe(100); // Final progress after completion
      expect(jobIdCapture).toBe(jobId);
    });

    it('should handle cancellation during execution', async () => {
      const cancelQueue = new QueueInstance(
        createTestConfig({ name: 'cancel-queue', concurrency: 1 }),
        storage,
        createMockLogger()
      );

      let handlerStarted = false;
      cancelQueue.registerHandler('cancel:job', async ctx => {
        handlerStarted = true;
        // Wait long enough for cancellation to happen
        await new Promise(resolve => setTimeout(resolve, 500));
        // Check if we were cancelled
        if (ctx.signal.aborted) {
          throw new Error('Job was cancelled');
        }
        return {};
      });

      const jobId = await cancelQueue.add('cancel:job', {});

      await cancelQueue.start();

      // Wait for job to actually start running
      await vi.waitFor(
        () => {
          expect(handlerStarted).toBe(true);
        },
        { timeout: 1000 }
      );

      // Small delay to ensure job is fully in handler
      await new Promise(resolve => setTimeout(resolve, 50));

      // Cancel the job
      const cancelled = await cancelQueue.cancelJob(jobId, 'Test cancellation');
      expect(cancelled).toBe(true);

      // Wait for handler to notice cancellation
      await new Promise(resolve => setTimeout(resolve, 600));

      await cancelQueue.stop({ graceful: false });

      // The job should be cancelled, not failed
      const job = await cancelQueue.getJob(jobId);
      expect(job?.status).toBe('cancelled');
    });
  });

  // ==========================================================================
  // Job Context (T7)
  // ==========================================================================
  describe('JobContext', () => {
    it('should provide all required context properties', async () => {
      let capturedContext: any;

      queue.registerHandler('context:job', async ctx => {
        capturedContext = {
          jobId: ctx.jobId,
          data: ctx.data,
          hasLogger: !!ctx.logger,
          hasSignal: !!ctx.signal,
          hasProgress: typeof ctx.progress === 'function',
        };
        return {};
      });

      const testData = { foo: 'bar', count: 42 };
      await queue.add('context:job', testData);

      const completedSpy = vi.fn();
      queue.on('job:completed', completedSpy);

      await queue.start();

      await vi.waitFor(
        () => {
          expect(completedSpy).toHaveBeenCalled();
        },
        { timeout: 1000 }
      );

      await queue.stop();

      expect(capturedContext.jobId).toBeDefined();
      expect(capturedContext.data).toEqual(testData);
      expect(capturedContext.hasLogger).toBe(true);
      expect(capturedContext.hasSignal).toBe(true);
      expect(capturedContext.hasProgress).toBe(true);
    });

    it('should provide logger with job context', async () => {
      const mockLogger = createMockLogger();
      const contextQueue = new QueueInstance(
        createTestConfig({ name: 'context-logger-queue' }),
        storage,
        mockLogger
      );

      let loggerUsed = false;
      contextQueue.registerHandler('log:job', async ctx => {
        ctx.logger.info('Handler logging test');
        loggerUsed = true;
        return {};
      });

      await contextQueue.add('log:job', {});

      await contextQueue.start();

      await vi.waitFor(
        () => {
          expect(loggerUsed).toBe(true);
        },
        { timeout: 1000 }
      );

      await contextQueue.stop();

      // The child logger should have been created with job context
      expect(mockLogger.child).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Internal Helpers
  // ==========================================================================
  describe('Getters', () => {
    it('should expose running getter', () => {
      expect(queue.running).toBe(false);
    });

    it('should expose shuttingDown getter', () => {
      expect(queue.shuttingDown).toBe(false);
    });

    it('should expose runningJobCount getter', () => {
      expect(queue.runningJobCount).toBe(0);
    });
  });
});
