/**
 * Unit Tests for QueueInstance
 *
 * Tests verify constructor, job submission, handler registration,
 * event emission, subscription, and cancellation.
 */

import {
  HandlerAlreadyRegisteredError,
  JobValidationError,
  JobNotFoundError,
  HandlerNotFoundError,
} from './errors';
import { QueueInstance } from './queue-instance';
import { InMemoryStorage } from './storage/in-memory';

import type { Job, JobHandler, JobTypesSchema, QueueStorageAdapter } from './types';
import type { BlaizeLogger } from 'blaizejs';

// ============================================================================
// Mock Logger
// ============================================================================

function createMockLogger(): BlaizeLogger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn().mockReturnThis(),
    flush: vi.fn().mockResolvedValue(undefined),
  } as unknown as BlaizeLogger;
}

// ============================================================================
// Mock Zod Schema
// ============================================================================

function createMockSchema<T>(validator: (data: unknown) => T | null) {
  return {
    safeParse: (data: unknown) => {
      const result = validator(data);
      if (result !== null) {
        return { success: true as const, data: result };
      }
      return {
        success: false as const,
        error: {
          issues: [{ path: ['data'], message: 'Invalid data', code: 'custom' }],
          message: 'Validation failed',
          format: () => ({}),
        },
      };
    },
    parse: (data: unknown) => {
      const result = validator(data);
      if (result !== null) return result;
      throw new Error('Validation failed');
    },
    _type: {} as T,
    _output: {} as T,
    _input: {} as T,
    _def: { typeName: 'mock' },
  };
}

// ============================================================================
// Test Job Types
// ============================================================================

const emailSchema = createMockSchema<{ to: string; subject: string }>(data => {
  if (
    typeof data === 'object' &&
    data !== null &&
    'to' in data &&
    'subject' in data &&
    typeof (data as { to: unknown }).to === 'string' &&
    typeof (data as { subject: unknown }).subject === 'string'
  ) {
    return data as { to: string; subject: string };
  }
  return null;
});

const reportSchema = createMockSchema<{ reportId: string }>(data => {
  if (
    typeof data === 'object' &&
    data !== null &&
    'reportId' in data &&
    typeof (data as { reportId: unknown }).reportId === 'string'
  ) {
    return data as { reportId: string };
  }
  return null;
});

const testJobTypes = {
  'email:send': {
    schema: emailSchema,
    priority: 5 as const,
    timeout: 30000,
  },
  'report:generate': {
    schema: reportSchema,
    priority: 3 as const,
    timeout: 120000,
  },
} as unknown as JobTypesSchema;

// ============================================================================
// Tests
// ============================================================================

describe('QueueInstance', () => {
  let storage: QueueStorageAdapter;
  let logger: BlaizeLogger;
  let queue: QueueInstance<typeof testJobTypes>;

  beforeEach(() => {
    storage = new InMemoryStorage();
    logger = createMockLogger();
    queue = new QueueInstance({
      name: 'test-queue',
      concurrency: 5,
      jobTypes: testJobTypes,
      storage,
      logger,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Constructor
  // ==========================================================================
  describe('Constructor', () => {
    it('should create instance with required config', () => {
      expect(queue.name).toBe('test-queue');
      expect(queue.processing).toBe(false);
      expect(queue.shuttingDown).toBe(false);
      expect(queue.runningJobCount).toBe(0);
    });

    it('should log creation', () => {
      expect(logger.debug).toHaveBeenCalledWith('QueueInstance created', {
        queue: 'test-queue',
        concurrency: 5,
        jobTypes: ['email:send', 'report:generate'],
      });
    });

    it('should use default concurrency when not specified', () => {
      const q = new QueueInstance({
        name: 'default-queue',
        jobTypes: testJobTypes,
        storage,
        logger,
      });
      expect(q.name).toBe('default-queue');
    });

    it('should set max listeners for SSE support', () => {
      // EventEmitter.getMaxListeners() returns 1000
      expect(queue.getMaxListeners()).toBe(1000);
    });
  });

  // ==========================================================================
  // Job Submission (add)
  // ==========================================================================
  describe('add()', () => {
    it('should add a valid job and return job ID', async () => {
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

    it('should use job type default priority', async () => {
      const jobId = await queue.add('email:send', {
        to: 'test@example.com',
        subject: 'Test',
      });

      const job = await storage.getJob(jobId, 'test-queue');
      expect(job?.priority).toBe(5); // email:send has priority 5
    });

    it('should use job type default timeout', async () => {
      const jobId = await queue.add('report:generate', {
        reportId: 'rpt_123',
      });

      const job = await storage.getJob(jobId, 'test-queue');
      expect(job?.timeout).toBe(120000); // report:generate has timeout 120000
    });

    it('should override defaults with explicit options', async () => {
      const jobId = await queue.add(
        'email:send',
        { to: 'test@example.com', subject: 'Test' },
        { priority: 10, timeout: 60000, maxRetries: 5 }
      );

      const job = await storage.getJob(jobId, 'test-queue');
      expect(job?.priority).toBe(10);
      expect(job?.timeout).toBe(60000);
      expect(job?.maxRetries).toBe(5);
    });

    it('should include metadata', async () => {
      const jobId = await queue.add(
        'email:send',
        { to: 'test@example.com', subject: 'Test' },
        { metadata: { userId: '123', source: 'api' } }
      );

      const job = await storage.getJob(jobId, 'test-queue');
      expect(job?.metadata).toEqual({ userId: '123', source: 'api' });
    });

    it('should emit job.queued event', async () => {
      const eventSpy = vi.fn();
      queue.on('job.queued', eventSpy);

      await queue.add('email:send', {
        to: 'test@example.com',
        subject: 'Test',
      });

      expect(eventSpy).toHaveBeenCalledTimes(1);
      expect(eventSpy.mock.calls[0]![0].type).toBe('email:send');
      expect(eventSpy.mock.calls[0]![0].status).toBe('queued');
    });

    it('should throw JobValidationError for invalid data', async () => {
      await expect(queue.add('email:send', { invalid: 'data' } as any)).rejects.toThrow(
        JobValidationError
      );
    });

    it('should throw HandlerNotFoundError for unknown job type', async () => {
      await expect((queue as any).add('unknown:type', { data: 'test' })).rejects.toThrow(
        HandlerNotFoundError
      );
    });

    it('should log job addition', async () => {
      await queue.add('email:send', {
        to: 'test@example.com',
        subject: 'Test',
      });

      expect(logger.debug).toHaveBeenCalledWith(
        'Job added to queue',
        expect.objectContaining({
          jobType: 'email:send',
          priority: 5,
          queue: 'test-queue',
        })
      );
    });
  });

  // ==========================================================================
  // Handler Registration
  // ==========================================================================
  describe('registerHandler()', () => {
    it('should register a handler', () => {
      const handler: JobHandler<{ to: string; subject: string }, void> = async () => {};

      queue.registerHandler('email:send', handler);

      expect(queue.hasHandler('email:send')).toBe(true);
    });

    it('should log handler registration', () => {
      queue.registerHandler('email:send', async () => {});

      expect(logger.debug).toHaveBeenCalledWith('Handler registered', {
        jobType: 'email:send',
        queue: 'test-queue',
      });
    });

    it('should throw HandlerAlreadyRegisteredError on duplicate', () => {
      queue.registerHandler('email:send', async () => {});

      expect(() => {
        queue.registerHandler('email:send', async () => {});
      }).toThrow(HandlerAlreadyRegisteredError);
    });

    it('should allow different handlers for different job types', () => {
      queue.registerHandler('email:send', async () => {});
      queue.registerHandler('report:generate', async () => {});

      expect(queue.hasHandler('email:send')).toBe(true);
      expect(queue.hasHandler('report:generate')).toBe(true);
    });
  });

  // ==========================================================================
  // hasHandler
  // ==========================================================================
  describe('hasHandler()', () => {
    it('should return false for unregistered handler', () => {
      expect(queue.hasHandler('email:send')).toBe(false);
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
    it('should get job by ID', async () => {
      const jobId = await queue.add('email:send', {
        to: 'test@example.com',
        subject: 'Test',
      });

      const job = await queue.getJob(jobId);

      expect(job).not.toBeNull();
      expect(job?.id).toBe(jobId);
    });

    it('should return null for non-existent job', async () => {
      const job = await queue.getJob('non-existent');
      expect(job).toBeNull();
    });
  });

  describe('listJobs()', () => {
    beforeEach(async () => {
      await queue.add('email:send', { to: 'a@test.com', subject: 'A' });
      await queue.add('email:send', { to: 'b@test.com', subject: 'B' });
      await queue.add('report:generate', { reportId: 'rpt_1' });
    });

    it('should list all jobs without filters', async () => {
      const jobs = await queue.listJobs();
      expect(jobs).toHaveLength(3);
    });

    it('should filter by status', async () => {
      const jobs = await queue.listJobs({ status: 'queued' });
      expect(jobs).toHaveLength(3);
      expect(jobs.every((j: Job) => j.status === 'queued')).toBe(true);
    });

    it('should filter by job type', async () => {
      const jobs = await queue.listJobs({ jobType: 'email:send' });
      expect(jobs).toHaveLength(2);
      expect(jobs.every((j: Job) => j.type === 'email:send')).toBe(true);
    });

    it('should apply limit', async () => {
      const jobs = await queue.listJobs({ limit: 2 });
      expect(jobs).toHaveLength(2);
    });
  });

  // ==========================================================================
  // Statistics
  // ==========================================================================
  describe('getStats()', () => {
    it('should return queue statistics', async () => {
      await queue.add('email:send', { to: 'test@example.com', subject: 'Test' });
      await queue.add('email:send', { to: 'test2@example.com', subject: 'Test2' });

      const stats = await queue.getStats();

      expect(stats.total).toBe(2);
      expect(stats.queued).toBe(2);
      expect(stats.running).toBe(0);
      expect(stats.completed).toBe(0);
    });
  });

  // ==========================================================================
  // Event Subscription
  // ==========================================================================
  describe('subscribe()', () => {
    it('should call onProgress for matching job', async () => {
      const jobId = await queue.add('email:send', {
        to: 'test@example.com',
        subject: 'Test',
      });

      const onProgress = vi.fn();
      queue.subscribe(jobId, { onProgress });

      // Simulate progress event
      const job = await queue.getJob(jobId);
      queue.emit('job.progress', job, 50, 'Half done');

      expect(onProgress).toHaveBeenCalledWith(50, 'Half done');
    });

    it('should not call onProgress for different job', async () => {
      const jobId1 = await queue.add('email:send', { to: 'a@test.com', subject: 'A' });
      const jobId2 = await queue.add('email:send', { to: 'b@test.com', subject: 'B' });

      const onProgress = vi.fn();
      queue.subscribe(jobId1, { onProgress });

      // Emit event for job2
      const job2 = await queue.getJob(jobId2);
      queue.emit('job.progress', job2, 50, 'Progress');

      expect(onProgress).not.toHaveBeenCalled();
    });

    it('should call onCompleted for matching job', async () => {
      const jobId = await queue.add('email:send', {
        to: 'test@example.com',
        subject: 'Test',
      });

      const onCompleted = vi.fn();
      queue.subscribe(jobId, { onCompleted });

      // Update job with result and emit
      await storage.updateJob(jobId, { status: 'completed', result: { sent: true } });
      const job = await queue.getJob(jobId);
      queue.emit('job.completed', job);

      expect(onCompleted).toHaveBeenCalledWith({ sent: true });
    });

    it('should call onFailed for matching job', async () => {
      const jobId = await queue.add('email:send', {
        to: 'test@example.com',
        subject: 'Test',
      });

      const onFailed = vi.fn();
      queue.subscribe(jobId, { onFailed });

      // Update job with error and emit
      const error = { message: 'Send failed', code: 'SMTP_ERROR' };
      await storage.updateJob(jobId, { status: 'failed', error });
      const job = await queue.getJob(jobId);
      queue.emit('job.failed', job);

      expect(onFailed).toHaveBeenCalledWith(error);
    });

    it('should call onCancelled for matching job', async () => {
      const jobId = await queue.add('email:send', {
        to: 'test@example.com',
        subject: 'Test',
      });

      const onCancelled = vi.fn();
      queue.subscribe(jobId, { onCancelled });

      // Emit cancelled event
      const job = await queue.getJob(jobId);
      queue.emit('job.cancelled', job, 'User requested');

      expect(onCancelled).toHaveBeenCalledWith('User requested');
    });

    it('should return unsubscribe function', async () => {
      const jobId = await queue.add('email:send', {
        to: 'test@example.com',
        subject: 'Test',
      });

      const onProgress = vi.fn();
      const unsubscribe = queue.subscribe(jobId, { onProgress });

      // Unsubscribe
      unsubscribe();

      // Emit event - should not trigger callback
      const job = await queue.getJob(jobId);
      queue.emit('job.progress', job, 50, 'Progress');

      expect(onProgress).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Job Cancellation
  // ==========================================================================
  describe('cancel()', () => {
    it('should cancel a queued job', async () => {
      const jobId = await queue.add('email:send', {
        to: 'test@example.com',
        subject: 'Test',
      });

      await queue.cancel(jobId, 'User requested');

      const job = await queue.getJob(jobId);
      expect(job?.status).toBe('cancelled');
    });

    it('should emit job.cancelled event', async () => {
      const jobId = await queue.add('email:send', {
        to: 'test@example.com',
        subject: 'Test',
      });

      const eventSpy = vi.fn();
      queue.on('job.cancelled', eventSpy);

      await queue.cancel(jobId, 'Testing');

      expect(eventSpy).toHaveBeenCalledTimes(1);
      expect(eventSpy.mock.calls[0]![1]).toBe('Testing');
    });

    it('should throw JobNotFoundError for non-existent job', async () => {
      await expect(queue.cancel('non-existent')).rejects.toThrow(JobNotFoundError);
    });

    it('should log cancellation', async () => {
      const jobId = await queue.add('email:send', {
        to: 'test@example.com',
        subject: 'Test',
      });

      await queue.cancel(jobId, 'User requested');

      expect(logger.info).toHaveBeenCalledWith(
        'Job cancelled',
        expect.objectContaining({
          jobId,
          queue: 'test-queue',
          reason: 'User requested',
        })
      );
    });
  });

  // ==========================================================================
  // Lifecycle Methods (Stubs)
  // ==========================================================================
  describe('start()', () => {
    it('should set processing flag', async () => {
      await queue.start();
      expect(queue.processing).toBe(true);
    });

    it('should log start', async () => {
      await queue.start();
      expect(logger.info).toHaveBeenCalledWith('Queue started', { queue: 'test-queue' });
    });

    it('should not start twice', async () => {
      await queue.start();
      await queue.start();

      // Should only log once
      expect(logger.info).toHaveBeenCalledTimes(1);
    });
  });

  describe('stop()', () => {
    it('should set shuttingDown flag', async () => {
      await queue.stop();
      expect(queue.shuttingDown).toBe(true);
    });

    it('should log stop', async () => {
      await queue.stop();
      expect(logger.info).toHaveBeenCalledWith(
        'Queue stopping',
        expect.objectContaining({ queue: 'test-queue' })
      );
    });

    it('should not stop twice', async () => {
      await queue.stop();
      await queue.stop();

      // Should only log once for stop
      const stopCalls = (logger.info as any).mock.calls.filter(
        (call: any[]) => call[0] === 'Queue stopping'
      );
      expect(stopCalls).toHaveLength(1);
    });
  });

  // ==========================================================================
  // Internal Helpers
  // ==========================================================================
  describe('AbortController management', () => {
    it('should track AbortControllers for running jobs', () => {
      const controller = new AbortController();
      queue.setAbortController('job_123', controller);

      expect(queue.getAbortController('job_123')).toBe(controller);
      expect(queue.runningJobCount).toBe(1);
    });

    it('should remove AbortControllers', () => {
      const controller = new AbortController();
      queue.setAbortController('job_123', controller);
      queue.removeAbortController('job_123');

      expect(queue.getAbortController('job_123')).toBeUndefined();
      expect(queue.runningJobCount).toBe(0);
    });
  });
});
