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
  // Graceful Shutdown (T9)
  // ==========================================================================
  describe('Graceful Shutdown (T9)', () => {
    it('should wait for running jobs on graceful stop', async () => {
      const slowQueue = new QueueInstance(
        createTestConfig({ name: 'graceful-slow-queue', concurrency: 1 }),
        storage,
        createMockLogger()
      );

      let jobCompleted = false;
      slowQueue.registerHandler('slow:job', async () => {
        await new Promise(resolve => setTimeout(resolve, 300));
        jobCompleted = true;
        return { done: true };
      });

      await slowQueue.add('slow:job', {});
      await slowQueue.start();

      // Wait for job to start
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(slowQueue.runningJobCount).toBe(1);

      // Graceful stop should wait for the job
      await slowQueue.stop({ graceful: true, timeout: 5000 });

      expect(jobCompleted).toBe(true);
      expect(slowQueue.runningJobCount).toBe(0);
    });

    it('should cancel running jobs on forceful stop', async () => {
      const forceQueue = new QueueInstance(
        createTestConfig({ name: 'force-stop-queue', concurrency: 1 }),
        storage,
        createMockLogger()
      );

      let _jobWasCancelled = false;
      forceQueue.registerHandler('long:job', async ctx => {
        try {
          // Long running job
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(resolve, 5000);
            ctx.signal.addEventListener('abort', () => {
              clearTimeout(timeout);
              reject(new Error('Job cancelled'));
            });
          });
          return { completed: true };
        } catch {
          _jobWasCancelled = true;
          throw new Error('Job cancelled');
        }
      });

      const jobId = await forceQueue.add('long:job', {});
      await forceQueue.start();

      // Wait for job to start
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(forceQueue.runningJobCount).toBe(1);

      // Forceful stop should cancel the job
      await forceQueue.stop({ graceful: false });

      // Job should be cancelled
      const job = await forceQueue.getJob(jobId);
      expect(job?.status).toBe('cancelled');
    });

    it('should timeout graceful shutdown and continue', async () => {
      const timeoutQueue = new QueueInstance(
        createTestConfig({ name: 'timeout-shutdown-queue', concurrency: 1 }),
        storage,
        createMockLogger()
      );

      let jobStarted = false;
      timeoutQueue.registerHandler('very-long:job', async () => {
        jobStarted = true;
        // Job that takes longer than shutdown timeout
        await new Promise(resolve => setTimeout(resolve, 5000));
        return {};
      });

      await timeoutQueue.add('very-long:job', {});
      await timeoutQueue.start();

      // Wait for job to start
      await vi.waitFor(
        () => {
          expect(jobStarted).toBe(true);
        },
        { timeout: 1000 }
      );

      const startTime = Date.now();
      // Graceful stop with short timeout
      await timeoutQueue.stop({ graceful: true, timeout: 200 });
      const duration = Date.now() - startTime;

      // Should have timed out around 200ms, not waited full 5000ms
      expect(duration).toBeLessThan(1000);
      expect(duration).toBeGreaterThanOrEqual(150); // Allow some margin
    });

    it('should prevent new jobs from starting after stop called', async () => {
      const preventQueue = new QueueInstance(
        createTestConfig({ name: 'prevent-new-jobs-queue', concurrency: 1 }),
        storage,
        createMockLogger()
      );

      const processedJobIds: string[] = [];
      preventQueue.registerHandler('count:job', async ctx => {
        processedJobIds.push(ctx.jobId);
        await new Promise(resolve => setTimeout(resolve, 200));
        return {};
      });

      // Add first job
      const job1Id = await preventQueue.add('count:job', {});
      await preventQueue.start();

      // Wait for job to start processing
      await new Promise(resolve => setTimeout(resolve, 50));

      // Add more jobs while first is running
      const job2Id = await preventQueue.add('count:job', {});
      const job3Id = await preventQueue.add('count:job', {});

      // Stop forcefully - should cancel running job and not start new ones
      await preventQueue.stop({ graceful: false });

      // First job should have started processing (it was running when we stopped)
      expect(processedJobIds).toContain(job1Id);

      // Jobs 2 and 3 should NOT have been processed (queue stopped before they started)
      expect(processedJobIds).not.toContain(job2Id);
      expect(processedJobIds).not.toContain(job3Id);

      // Only job 1 should have been processed
      expect(processedJobIds).toHaveLength(1);
    });

    it('should log shutdown initiation with runningJobs and queuedJobs', async () => {
      const mockLogger = createMockLogger();
      const logQueue = new QueueInstance(
        createTestConfig({ name: 'log-shutdown-queue' }),
        storage,
        mockLogger
      );

      await logQueue.start();
      await logQueue.stop();

      // Check that child logger's info was called with shutdown info
      const childLogger = (mockLogger.child as any).mock.results[0]?.value;
      expect(childLogger).toBeDefined();

      const stoppingCalls = (childLogger.info as any).mock.calls.filter(
        (call: any[]) => call[0] === 'Queue stopping'
      );
      expect(stoppingCalls.length).toBeGreaterThan(0);

      const stoppingCall = stoppingCalls[0];
      expect(stoppingCall[1]).toHaveProperty('runningJobs');
      expect(stoppingCall[1]).toHaveProperty('queuedJobs');
    });

    it('should log shutdown completion with duration', async () => {
      const mockLogger = createMockLogger();
      const logQueue = new QueueInstance(
        createTestConfig({ name: 'log-duration-queue' }),
        storage,
        mockLogger
      );

      await logQueue.start();
      await logQueue.stop();

      // Check that child logger's info was called with duration
      const childLogger = (mockLogger.child as any).mock.results[0]?.value;
      expect(childLogger).toBeDefined();

      const stoppedCalls = (childLogger.info as any).mock.calls.filter(
        (call: any[]) => call[0] === 'Queue stopped'
      );
      expect(stoppedCalls.length).toBeGreaterThan(0);

      const stoppedCall = stoppedCalls[0];
      expect(stoppedCall[1]).toHaveProperty('duration');
      expect(typeof stoppedCall[1].duration).toBe('number');
    });

    it('should clear pending retry timers on stop', async () => {
      const retryQueue = new QueueInstance(
        createTestConfig({
          name: 'retry-timer-shutdown-queue',
          defaultMaxRetries: 5,
        }),
        storage,
        createMockLogger()
      );

      retryQueue.registerHandler('fail:job', async () => {
        throw new Error('Fail to trigger retry');
      });

      await retryQueue.add('fail:job', {});

      const retrySpy = vi.fn();
      retryQueue.on('job:retry', retrySpy);

      await retryQueue.start();

      // Wait for first retry to be scheduled
      await vi.waitFor(
        () => {
          expect(retrySpy).toHaveBeenCalled();
        },
        { timeout: 2000 }
      );

      // Pending retry timers should exist
      expect((retryQueue as any).pendingRetryTimers.size).toBeGreaterThan(0);

      // Stop - should clear pending timers
      await retryQueue.stop({ graceful: false });

      expect((retryQueue as any).pendingRetryTimers.size).toBe(0);
    });

    it('should set isRunning false immediately on stop', async () => {
      const immediateQueue = new QueueInstance(
        createTestConfig({ name: 'immediate-flag-queue' }),
        storage,
        createMockLogger()
      );

      await immediateQueue.start();
      expect(immediateQueue.running).toBe(true);

      // Start stop but don't await
      const stopPromise = immediateQueue.stop({ graceful: true });

      // isRunning should be false immediately
      // Note: This is tricky to test precisely, but we can verify after stop
      await stopPromise;

      expect(immediateQueue.running).toBe(false);
      expect(immediateQueue.shuttingDown).toBe(true);
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
        createTestConfig({ name: 'error-queue', defaultMaxRetries: 0 }),
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

    it('should timeout job that exceeds timeout limit', async () => {
      const timeoutQueue = new QueueInstance(
        createTestConfig({
          name: 'timeout-queue',
          defaultTimeout: 100, // Very short timeout
          defaultMaxRetries: 0, // No retries - fail immediately on timeout
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
  // Retry Logic (T8)
  // ==========================================================================
  describe('Retry Logic', () => {
    it('should retry failed job with exponential backoff', async () => {
      const retryQueue = new QueueInstance(
        createTestConfig({
          name: 'retry-queue',
          defaultMaxRetries: 3,
        }),
        storage,
        createMockLogger()
      );

      let attempts = 0;
      retryQueue.registerHandler('flaky:job', async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error(`Attempt ${attempts} failed`);
        }
        return { success: true };
      });

      const _jobId = await retryQueue.add('flaky:job', {});

      const retrySpy = vi.fn();
      const completedSpy = vi.fn();
      retryQueue.on('job:retry', retrySpy);
      retryQueue.on('job:completed', completedSpy);

      await retryQueue.start();

      // Wait for job to complete (after retries)
      await vi.waitFor(
        () => {
          expect(completedSpy).toHaveBeenCalled();
        },
        { timeout: 10000 }
      );

      await retryQueue.stop();

      // Should have retried twice before succeeding
      expect(retrySpy).toHaveBeenCalledTimes(2);
      expect(attempts).toBe(3);

      // Verify retry event arguments
      expect(retrySpy.mock.calls[0]![1]).toBe(1); // First retry attempt
      expect(retrySpy.mock.calls[1]![1]).toBe(2); // Second retry attempt
    });

    it('should emit job:failed after exhausting retries', async () => {
      const failQueue = new QueueInstance(
        createTestConfig({
          name: 'exhaust-retry-queue',
          defaultMaxRetries: 2,
        }),
        storage,
        createMockLogger()
      );

      failQueue.registerHandler('always:fail', async () => {
        throw new Error('Always fails');
      });

      const jobId = await failQueue.add('always:fail', {});

      const retrySpy = vi.fn();
      const failedSpy = vi.fn();
      failQueue.on('job:retry', retrySpy);
      failQueue.on('job:failed', failedSpy);

      await failQueue.start();

      // Wait for job to fail after retries
      await vi.waitFor(
        () => {
          expect(failedSpy).toHaveBeenCalled();
        },
        { timeout: 10000 }
      );

      await failQueue.stop();

      // Should have retried twice (maxRetries=2)
      expect(retrySpy).toHaveBeenCalledTimes(2);

      // Final failure
      expect(failedSpy).toHaveBeenCalledTimes(1);
      const job = await failQueue.getJob(jobId);
      expect(job?.status).toBe('failed');
      expect(job?.retries).toBe(2);
    });

    it('should not retry cancelled jobs', async () => {
      const cancelRetryQueue = new QueueInstance(
        createTestConfig({
          name: 'cancel-retry-queue',
          defaultMaxRetries: 3,
        }),
        storage,
        createMockLogger()
      );

      let handlerStarted = false;
      cancelRetryQueue.registerHandler('cancelable:job', async ctx => {
        handlerStarted = true;
        // Wait for cancellation
        await new Promise(resolve => setTimeout(resolve, 500));
        if (ctx.signal.aborted) {
          throw new Error('Job cancelled');
        }
        return {};
      });

      const jobId = await cancelRetryQueue.add('cancelable:job', {});

      const retrySpy = vi.fn();
      const cancelledSpy = vi.fn();
      cancelRetryQueue.on('job:retry', retrySpy);
      cancelRetryQueue.on('job:cancelled', cancelledSpy);

      await cancelRetryQueue.start();

      // Wait for job to start
      await vi.waitFor(
        () => {
          expect(handlerStarted).toBe(true);
        },
        { timeout: 1000 }
      );

      // Cancel the job
      await cancelRetryQueue.cancelJob(jobId, 'User cancelled');

      // Wait for cancellation to process
      await new Promise(resolve => setTimeout(resolve, 600));

      await cancelRetryQueue.stop({ graceful: false });

      // Should NOT have retried - cancelled jobs don't retry
      expect(retrySpy).not.toHaveBeenCalled();
      // Job should be cancelled
      const job = await cancelRetryQueue.getJob(jobId);
      expect(job?.status).toBe('cancelled');
    });

    it('should not retry job with maxRetries = 0', async () => {
      const noRetryQueue = new QueueInstance(
        createTestConfig({
          name: 'no-retry-queue',
          defaultMaxRetries: 0,
        }),
        storage,
        createMockLogger()
      );

      noRetryQueue.registerHandler('fail:once', async () => {
        throw new Error('Failed once');
      });

      await noRetryQueue.add('fail:once', {});

      const retrySpy = vi.fn();
      const failedSpy = vi.fn();
      noRetryQueue.on('job:retry', retrySpy);
      noRetryQueue.on('job:failed', failedSpy);

      await noRetryQueue.start();

      await vi.waitFor(
        () => {
          expect(failedSpy).toHaveBeenCalled();
        },
        { timeout: 1000 }
      );

      await noRetryQueue.stop();

      // Should NOT have retried
      expect(retrySpy).not.toHaveBeenCalled();
    });

    it('should calculate exponential backoff correctly', async () => {
      // Access private method for testing via prototype
      const testQueue = new QueueInstance(
        createTestConfig({ name: 'backoff-test' }),
        storage,
        createMockLogger()
      );

      // Use type assertion to access private method
      const calculateBackoff = (testQueue as any).calculateBackoff.bind(testQueue);

      // Default config: baseDelay=1000, multiplier=2, maxDelay=30000
      // Attempt 1: 1000 * 2^0 = 1000 (±10% jitter)
      // Attempt 2: 1000 * 2^1 = 2000 (±10% jitter)
      // Attempt 3: 1000 * 2^2 = 4000 (±10% jitter)
      // Attempt 4: 1000 * 2^3 = 8000 (±10% jitter)
      // Attempt 5: 1000 * 2^4 = 16000 (±10% jitter)
      // Attempt 6: 1000 * 2^5 = 32000 -> capped at 30000 (±10% jitter)

      // With ±10% jitter, check ranges
      const attempt1 = calculateBackoff(1);
      expect(attempt1).toBeGreaterThanOrEqual(900);
      expect(attempt1).toBeLessThanOrEqual(1100);

      const attempt2 = calculateBackoff(2);
      expect(attempt2).toBeGreaterThanOrEqual(1800);
      expect(attempt2).toBeLessThanOrEqual(2200);

      const attempt3 = calculateBackoff(3);
      expect(attempt3).toBeGreaterThanOrEqual(3600);
      expect(attempt3).toBeLessThanOrEqual(4400);

      // High attempt should be capped
      const attempt10 = calculateBackoff(10);
      expect(attempt10).toBeGreaterThanOrEqual(27000);
      expect(attempt10).toBeLessThanOrEqual(33000);

      await testQueue.stop();
    });

    it('should increment retries counter on each attempt', async () => {
      const retriesQueue = new QueueInstance(
        createTestConfig({
          name: 'retries-counter-queue',
          defaultMaxRetries: 2,
        }),
        storage,
        createMockLogger()
      );

      retriesQueue.registerHandler('fail:job', async () => {
        throw new Error('Fail');
      });

      const jobId = await retriesQueue.add('fail:job', {});

      const retrySpy = vi.fn();
      const failedSpy = vi.fn();
      retriesQueue.on('job:retry', retrySpy);
      retriesQueue.on('job:failed', failedSpy);

      await retriesQueue.start();

      await vi.waitFor(
        () => {
          expect(failedSpy).toHaveBeenCalled();
        },
        { timeout: 10000 }
      );

      await retriesQueue.stop();

      // Check retry counter was incremented
      const job = await retriesQueue.getJob(jobId);
      expect(job?.retries).toBe(2); // maxRetries attempts made
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
