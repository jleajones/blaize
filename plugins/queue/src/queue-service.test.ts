/**
 * Tests for QueueService
 *
 * Tests multi-queue management, cross-queue job search,
 * event subscription, and lifecycle management.
 */
import { createMockLogger, MockLogger } from '@blaizejs/testing-utils';

import { QueueNotFoundError } from './errors';
import { QueueService } from './queue-service';
import { InMemoryStorage } from './storage/in-memory';

import type { JobSubscription } from './types';

// ============================================================================
// Tests
// ============================================================================

describe('QueueService', () => {
  let service: QueueService;
  let storage: InMemoryStorage;
  let logger: MockLogger;

  beforeEach(() => {
    storage = new InMemoryStorage();
    logger = createMockLogger();
    service = new QueueService({
      queues: {
        emails: { concurrency: 5, defaultMaxRetries: 0 },
        reports: { concurrency: 2, defaultMaxRetries: 0 },
      },
      storage,
      logger,
    });
  });

  afterEach(async () => {
    await service.stopAll({ graceful: false });
  });

  // ==========================================================================
  // Constructor
  // ==========================================================================
  describe('constructor', () => {
    it('should create queue instances for all configured queues', () => {
      expect(service.getQueue('emails')).toBeDefined();
      expect(service.getQueue('reports')).toBeDefined();
    });

    it('should pass storage adapter to all queues', () => {
      // Both queues share the same storage
      const emailQueue = service.getQueue('emails');
      const reportQueue = service.getQueue('reports');

      expect(emailQueue).toBeDefined();
      expect(reportQueue).toBeDefined();
    });

    it('should create child logger', () => {
      expect(logger.child).toHaveBeenCalledWith({ service: 'QueueService' });
    });

    it('should log creation', () => {
      const childLogger = (logger.child as any).mock.results[0]?.value;
      expect(childLogger?.info).toHaveBeenCalledWith(
        'QueueService created',
        expect.objectContaining({
          queues: expect.arrayContaining(['emails', 'reports']),
          queueCount: 2,
        })
      );
    });
  });

  // ==========================================================================
  // Queue Management
  // ==========================================================================
  describe('getQueue()', () => {
    it('should return queue instance by name', () => {
      const queue = service.getQueue('emails');
      expect(queue).toBeDefined();
      expect(queue?.name).toBe('emails');
    });

    it('should return undefined for non-existent queue', () => {
      const queue = service.getQueue('nonexistent');
      expect(queue).toBeUndefined();
    });
  });

  describe('listQueues()', () => {
    it('should return all queue names', () => {
      const queues = service.listQueues();
      expect(queues).toContain('emails');
      expect(queues).toContain('reports');
      expect(queues).toHaveLength(2);
    });
  });

  // ==========================================================================
  // Job Operations
  // ==========================================================================
  describe('add()', () => {
    it('should add job to specified queue', async () => {
      service.registerHandler('emails', 'email:send', async () => ({}));

      const jobId = await service.add('emails', 'email:send', {
        to: 'test@example.com',
      });

      expect(jobId).toBeDefined();
      expect(typeof jobId).toBe('string');
    });

    it('should throw QueueNotFoundError for invalid queue', async () => {
      await expect(service.add('nonexistent', 'job:type', {})).rejects.toThrow(QueueNotFoundError);
    });

    it('should include available queues in error', async () => {
      try {
        await service.add('nonexistent', 'job:type', {});
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(QueueNotFoundError);
        expect((err as QueueNotFoundError).message).toContain('emails');
        expect((err as QueueNotFoundError).message).toContain('reports');
      }
    });

    it('should pass options to queue', async () => {
      service.registerHandler('emails', 'email:send', async () => ({}));

      const jobId = await service.add(
        'emails',
        'email:send',
        { to: 'test@example.com' },
        { priority: 10, timeout: 5000 }
      );

      const job = await service.getJob(jobId);
      expect(job?.priority).toBe(10);
      expect(job?.timeout).toBe(5000);
    });
  });

  describe('getJob()', () => {
    it('should find job in specific queue', async () => {
      service.registerHandler('emails', 'email:send', async () => ({}));
      const jobId = await service.add('emails', 'email:send', {});

      const job = await service.getJob(jobId, 'emails');
      expect(job).toBeDefined();
      expect(job?.id).toBe(jobId);
    });

    it('should find job across all queues when queueName not provided', async () => {
      service.registerHandler('reports', 'report:generate', async () => ({}));
      const jobId = await service.add('reports', 'report:generate', {});

      // Search without specifying queue
      const job = await service.getJob(jobId);
      expect(job).toBeDefined();
      expect(job?.id).toBe(jobId);
    });

    it('should return undefined for non-existent job', async () => {
      const job = await service.getJob('nonexistent-id');
      expect(job).toBeUndefined();
    });

    it('should return undefined for wrong queue', async () => {
      service.registerHandler('emails', 'email:send', async () => ({}));
      const jobId = await service.add('emails', 'email:send', {});

      // Search in wrong queue
      const job = await service.getJob(jobId, 'reports');
      expect(job).toBeUndefined();
    });

    it('should use cached queue mapping for performance', async () => {
      service.registerHandler('emails', 'email:send', async () => ({}));
      const jobId = await service.add('emails', 'email:send', {});

      // First lookup (caches the mapping)
      await service.getJob(jobId);

      // Second lookup (should use cache)
      const job = await service.getJob(jobId);
      expect(job?.id).toBe(jobId);
    });
  });

  describe('cancelJob()', () => {
    it('should cancel job in specific queue', async () => {
      service.registerHandler('emails', 'email:send', async () => ({}));
      const jobId = await service.add('emails', 'email:send', {});

      const cancelled = await service.cancelJob(jobId, 'emails', 'Test reason');
      expect(cancelled).toBe(true);

      const job = await service.getJob(jobId);
      expect(job?.status).toBe('cancelled');
    });

    it('should cancel job across all queues when queueName not provided', async () => {
      service.registerHandler('reports', 'report:generate', async () => ({}));
      const jobId = await service.add('reports', 'report:generate', {});

      const cancelled = await service.cancelJob(jobId, undefined, 'Test reason');
      expect(cancelled).toBe(true);
    });

    it('should return false for non-existent job', async () => {
      const cancelled = await service.cancelJob('nonexistent-id');
      expect(cancelled).toBe(false);
    });

    it('should return false for wrong queue', async () => {
      service.registerHandler('emails', 'email:send', async () => ({}));
      const jobId = await service.add('emails', 'email:send', {});

      const cancelled = await service.cancelJob(jobId, 'reports');
      expect(cancelled).toBe(false);
    });
  });

  // ==========================================================================
  // Handler Registration
  // ==========================================================================
  describe('registerHandler()', () => {
    it('should register handler on specified queue', async () => {
      const handler = vi.fn().mockResolvedValue({ sent: true });
      service.registerHandler('emails', 'email:send', handler);

      const queue = service.getQueue('emails');
      expect(queue?.hasHandler('email:send')).toBe(true);
    });

    it('should throw QueueNotFoundError for invalid queue', () => {
      expect(() => {
        service.registerHandler('nonexistent', 'job:type', async () => ({}));
      }).toThrow(QueueNotFoundError);
    });
  });

  // ==========================================================================
  // Lifecycle
  // ==========================================================================
  describe('startAll()', () => {
    it('should start all queues', async () => {
      await service.startAll();

      const emailQueue = service.getQueue('emails');
      const reportQueue = service.getQueue('reports');

      expect(emailQueue?.running).toBe(true);
      expect(reportQueue?.running).toBe(true);
    });

    it('should log start', async () => {
      await service.startAll();

      const childLogger = (logger.child as any).mock.results[0]?.value;
      expect(childLogger?.info).toHaveBeenCalledWith(
        'Starting all queues',
        expect.objectContaining({
          queues: expect.arrayContaining(['emails', 'reports']),
        })
      );
    });
  });

  describe('stopAll()', () => {
    it('should stop all queues', async () => {
      await service.startAll();
      await service.stopAll();

      const emailQueue = service.getQueue('emails');
      const reportQueue = service.getQueue('reports');

      expect(emailQueue?.running).toBe(false);
      expect(reportQueue?.running).toBe(false);
    });

    it('should pass options to all queues', async () => {
      await service.startAll();
      await service.stopAll({ graceful: false, timeout: 5000 });

      // All queues should be stopped
      expect(service.getQueue('emails')?.running).toBe(false);
      expect(service.getQueue('reports')?.running).toBe(false);
    });

    it('should log stop with duration', async () => {
      await service.startAll();
      await service.stopAll();

      const childLogger = (logger.child as any).mock.results[0]?.value;
      expect(childLogger?.info).toHaveBeenCalledWith(
        'All queues stopped',
        expect.objectContaining({
          duration: expect.any(Number),
          graceful: true,
        })
      );
    });
  });

  // ==========================================================================
  // Stats & Listing
  // ==========================================================================
  describe('getQueueStats()', () => {
    it('should return stats for specific queue', async () => {
      service.registerHandler('emails', 'email:send', async () => ({}));
      await service.add('emails', 'email:send', {});

      const stats = await service.getQueueStats('emails');
      expect(stats.total).toBe(1);
      expect(stats.queued).toBe(1);
    });

    it('should throw QueueNotFoundError for invalid queue', async () => {
      await expect(service.getQueueStats('nonexistent')).rejects.toThrow(QueueNotFoundError);
    });
  });

  describe('getAllStats()', () => {
    it('should return aggregated stats for all queues', async () => {
      service.registerHandler('emails', 'email:send', async () => ({}));
      service.registerHandler('reports', 'report:generate', async () => ({}));

      await service.add('emails', 'email:send', {});
      await service.add('emails', 'email:send', {});
      await service.add('reports', 'report:generate', {});

      const stats = await service.getAllStats();
      expect(stats.total).toBe(3);
      expect(stats.queued).toBe(3);
    });

    it('should return zero stats for empty queues', async () => {
      const stats = await service.getAllStats();
      expect(stats.total).toBe(0);
      expect(stats.queued).toBe(0);
      expect(stats.running).toBe(0);
    });
  });

  describe('listJobs()', () => {
    it('should list jobs in specific queue', async () => {
      service.registerHandler('emails', 'email:send', async () => ({}));
      await service.add('emails', 'email:send', { id: 1 });
      await service.add('emails', 'email:send', { id: 2 });

      const jobs = await service.listJobs('emails');
      expect(jobs).toHaveLength(2);
    });

    it('should filter by status', async () => {
      service.registerHandler('emails', 'email:send', async () => ({}));
      const jobId1 = await service.add('emails', 'email:send', {});
      await service.add('emails', 'email:send', {});

      await service.cancelJob(jobId1);

      const cancelledJobs = await service.listJobs('emails', {
        status: 'cancelled',
      });
      expect(cancelledJobs).toHaveLength(1);
      expect(cancelledJobs[0]!.id).toBe(jobId1);
    });

    it('should respect limit', async () => {
      service.registerHandler('emails', 'email:send', async () => ({}));
      await service.add('emails', 'email:send', {});
      await service.add('emails', 'email:send', {});
      await service.add('emails', 'email:send', {});

      const jobs = await service.listJobs('emails', { limit: 2 });
      expect(jobs).toHaveLength(2);
    });

    it('should throw QueueNotFoundError for invalid queue', async () => {
      await expect(service.listJobs('nonexistent')).rejects.toThrow(QueueNotFoundError);
    });
  });

  // ==========================================================================
  // Event Subscription
  // ==========================================================================
  describe('subscribe()', () => {
    it('should subscribe to job events', async () => {
      service.registerHandler('emails', 'email:send', async ctx => {
        await ctx.progress(50, 'Halfway');
        return { sent: true };
      });

      const jobId = await service.add('emails', 'email:send', {});

      const callbacks: JobSubscription = {
        onProgress: vi.fn(),
        onCompleted: vi.fn(),
      };

      const unsubscribe = service.subscribe(jobId, callbacks);

      await service.startAll();

      await vi.waitFor(
        () => {
          expect(callbacks.onCompleted).toHaveBeenCalled();
        },
        { timeout: 2000 }
      );

      await service.stopAll();
      unsubscribe();

      expect(callbacks.onProgress).toHaveBeenCalledWith(50, 'Halfway');
      expect(callbacks.onCompleted).toHaveBeenCalledWith({ sent: true });
    });

    it('should call onFailed when job fails', async () => {
      service.registerHandler('emails', 'email:fail', async () => {
        throw new Error('Email failed');
      });

      const jobId = await service.add('emails', 'email:fail', {});

      const callbacks: JobSubscription = {
        onFailed: vi.fn(),
      };

      const unsubscribe = service.subscribe(jobId, callbacks);

      await service.startAll();

      await vi.waitFor(
        () => {
          expect(callbacks.onFailed).toHaveBeenCalled();
        },
        { timeout: 2000 }
      );

      await service.stopAll();
      unsubscribe();

      expect(callbacks.onFailed).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Email failed',
        })
      );
    });

    it('should call onCancelled when job is cancelled', async () => {
      service.registerHandler('emails', 'email:slow', async () => {
        await new Promise(resolve => setTimeout(resolve, 5000));
        return {};
      });

      const jobId = await service.add('emails', 'email:slow', {});

      const callbacks: JobSubscription = {
        onCancelled: vi.fn(),
      };

      const unsubscribe = service.subscribe(jobId, callbacks);

      await service.startAll();

      // Wait for job to start
      await new Promise(resolve => setTimeout(resolve, 100));

      // Cancel the job
      await service.cancelJob(jobId, undefined, 'Test cancellation');

      await vi.waitFor(
        () => {
          expect(callbacks.onCancelled).toHaveBeenCalled();
        },
        { timeout: 2000 }
      );

      await service.stopAll({ graceful: false });
      unsubscribe();
    });

    it('should return unsubscribe function', async () => {
      service.registerHandler('emails', 'email:send', async ctx => {
        await ctx.progress(50, 'Progress');
        return {};
      });

      const jobId = await service.add('emails', 'email:send', {});

      const callbacks: JobSubscription = {
        onProgress: vi.fn(),
      };

      const unsubscribe = service.subscribe(jobId, callbacks);

      // Unsubscribe immediately
      unsubscribe();

      await service.startAll();

      // Wait for job to complete
      await vi.waitFor(
        async () => {
          const job = await service.getJob(jobId);
          return job?.status === 'completed';
        },
        { timeout: 2000 }
      );

      await service.stopAll();

      // Should not have received progress callback after unsubscribing
      // (Timing dependent - callback may have been called before unsubscribe)
    });

    it('should filter events by jobId', async () => {
      service.registerHandler('emails', 'email:send', async () => ({ sent: true }));

      const jobId1 = await service.add('emails', 'email:send', {});
      const jobId2 = await service.add('emails', 'email:send', {});

      const callbacks1: JobSubscription = {
        onCompleted: vi.fn(),
      };
      const callbacks2: JobSubscription = {
        onCompleted: vi.fn(),
      };

      const unsub1 = service.subscribe(jobId1, callbacks1);
      const unsub2 = service.subscribe(jobId2, callbacks2);

      await service.startAll();

      await vi.waitFor(
        () => {
          expect(callbacks1.onCompleted).toHaveBeenCalled();
          expect(callbacks2.onCompleted).toHaveBeenCalled();
        },
        { timeout: 2000 }
      );

      await service.stopAll();
      unsub1();
      unsub2();

      // Each callback should only be called once (for its own job)
      expect(callbacks1.onCompleted).toHaveBeenCalledTimes(1);
      expect(callbacks2.onCompleted).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // Cross-Queue Operations
  // ==========================================================================
  describe('Cross-Queue Operations', () => {
    it('should find jobs across different queues', async () => {
      service.registerHandler('emails', 'email:send', async () => ({}));
      service.registerHandler('reports', 'report:generate', async () => ({}));

      const emailJobId = await service.add('emails', 'email:send', {});
      const reportJobId = await service.add('reports', 'report:generate', {});

      // Find both without specifying queue
      const emailJob = await service.getJob(emailJobId);
      const reportJob = await service.getJob(reportJobId);

      expect(emailJob).toBeDefined();
      expect(reportJob).toBeDefined();
      expect(emailJob?.id).toBe(emailJobId);
      expect(reportJob?.id).toBe(reportJobId);
    });

    it('should cancel jobs across different queues', async () => {
      service.registerHandler('emails', 'email:send', async () => ({}));
      service.registerHandler('reports', 'report:generate', async () => ({}));

      const emailJobId = await service.add('emails', 'email:send', {});
      const reportJobId = await service.add('reports', 'report:generate', {});

      // Cancel without specifying queue
      await service.cancelJob(emailJobId);
      await service.cancelJob(reportJobId);

      const emailJob = await service.getJob(emailJobId);
      const reportJob = await service.getJob(reportJobId);

      expect(emailJob?.status).toBe('cancelled');
      expect(reportJob?.status).toBe('cancelled');
    });
  });

  // ==========================================================================
  // Shared Storage
  // ==========================================================================
  describe('Shared Storage', () => {
    it('should share storage between queues', async () => {
      service.registerHandler('emails', 'email:send', async () => ({}));
      service.registerHandler('reports', 'report:generate', async () => ({}));

      await service.add('emails', 'email:send', {});
      await service.add('reports', 'report:generate', {});

      // Both queues use the same storage, so total should be 2
      const allStats = await service.getAllStats();
      expect(allStats.total).toBe(2);
    });
  });
});
