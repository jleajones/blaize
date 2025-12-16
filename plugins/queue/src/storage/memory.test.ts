/**
 * Unit Tests for InMemoryStorage Adapter
 *
 * Tests verify all CRUD operations, filtering, statistics,
 * and edge cases.
 */
import { InMemoryStorage, createInMemoryStorage } from './memory';

import type { Job, JobPriority } from '../types';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a test job with default values
 */
function createTestJob(overrides: Partial<Job> = {}): Job {
  const id = overrides.id ?? `job_${Math.random().toString(36).slice(2, 10)}`;
  return {
    id,
    type: 'test:job',
    queueName: 'default',
    data: { test: true },
    status: 'queued',
    priority: 5,
    progress: 0,
    queuedAt: Date.now(),
    retries: 0,
    maxRetries: 3,
    timeout: 30000,
    metadata: {},
    ...overrides,
  } as Job;
}

// ============================================================================
// Tests
// ============================================================================

describe('InMemoryStorage', () => {
  let storage: InMemoryStorage;

  beforeEach(() => {
    storage = new InMemoryStorage();
  });

  // ==========================================================================
  // Factory Function
  // ==========================================================================
  describe('createInMemoryStorage()', () => {
    it('should create a QueueStorageAdapter instance', () => {
      const adapter = createInMemoryStorage();

      expect(adapter).toBeDefined();
      expect(typeof adapter.enqueue).toBe('function');
      expect(typeof adapter.dequeue).toBe('function');
      expect(typeof adapter.getJob).toBe('function');
    });

    it('should create independent instances', async () => {
      const adapter1 = createInMemoryStorage();
      const adapter2 = createInMemoryStorage();

      const job = createTestJob({ id: 'job_1' });
      await adapter1.enqueue('default', job);

      const found1 = await adapter1.getJob('job_1');
      const found2 = await adapter2.getJob('job_1');

      expect(found1).not.toBeNull();
      expect(found2).toBeNull();
    });
  });

  // ==========================================================================
  // Enqueue
  // ==========================================================================
  describe('enqueue()', () => {
    it('should enqueue a job', async () => {
      const job = createTestJob({ id: 'job_1' });

      await storage.enqueue('default', job);

      const found = await storage.getJob('job_1');
      expect(found).toEqual(job);
    });

    it('should create queue if it does not exist', async () => {
      const job = createTestJob({ id: 'job_1', queueName: 'new-queue' });

      await storage.enqueue('new-queue', job);

      const stats = await storage.getQueueStats('new-queue');
      expect(stats.total).toBe(1);
    });

    it('should update statistics on enqueue', async () => {
      const job = createTestJob({ status: 'queued' });

      await storage.enqueue('default', job);

      const stats = await storage.getQueueStats('default');
      expect(stats.total).toBe(1);
      expect(stats.queued).toBe(1);
    });

    it('should handle multiple jobs', async () => {
      await storage.enqueue('default', createTestJob({ id: 'job_1' }));
      await storage.enqueue('default', createTestJob({ id: 'job_2' }));
      await storage.enqueue('default', createTestJob({ id: 'job_3' }));

      const stats = await storage.getQueueStats('default');
      expect(stats.total).toBe(3);
    });
  });

  // ==========================================================================
  // Dequeue
  // ==========================================================================
  describe('dequeue()', () => {
    it('should dequeue highest priority job', async () => {
      await storage.enqueue('default', createTestJob({ id: 'low', priority: 1 }));
      await storage.enqueue('default', createTestJob({ id: 'high', priority: 10 }));
      await storage.enqueue('default', createTestJob({ id: 'medium', priority: 5 }));

      const job = await storage.dequeue('default');
      expect(job?.id).toBe('high');
    });

    it('should return null for empty queue', async () => {
      const job = await storage.dequeue('default');
      expect(job).toBeNull();
    });

    it('should return null for non-existent queue', async () => {
      const job = await storage.dequeue('non-existent');
      expect(job).toBeNull();
    });

    it('should dequeue in FIFO order for same priority', async () => {
      // Add small delays to ensure different timestamps
      await storage.enqueue('default', createTestJob({ id: 'first', priority: 5 }));
      await new Promise(r => setTimeout(r, 5));
      await storage.enqueue('default', createTestJob({ id: 'second', priority: 5 }));
      await new Promise(r => setTimeout(r, 5));
      await storage.enqueue('default', createTestJob({ id: 'third', priority: 5 }));

      expect((await storage.dequeue('default'))?.id).toBe('first');
      expect((await storage.dequeue('default'))?.id).toBe('second');
      expect((await storage.dequeue('default'))?.id).toBe('third');
    });

    it('should keep job in jobs map after dequeue', async () => {
      const job = createTestJob({ id: 'job_1' });
      await storage.enqueue('default', job);

      await storage.dequeue('default');

      // Job should still be retrievable by ID
      const found = await storage.getJob('job_1');
      expect(found).toEqual(job);
    });
  });

  // ==========================================================================
  // Peek
  // ==========================================================================
  describe('peek()', () => {
    it('should peek highest priority job without removing', async () => {
      await storage.enqueue('default', createTestJob({ id: 'low', priority: 1 }));
      await storage.enqueue('default', createTestJob({ id: 'high', priority: 10 }));

      const peeked = await storage.peek('default');
      expect(peeked?.id).toBe('high');

      // Should still be there
      const dequeued = await storage.dequeue('default');
      expect(dequeued?.id).toBe('high');
    });

    it('should return null for empty queue', async () => {
      const job = await storage.peek('default');
      expect(job).toBeNull();
    });

    it('should return null for non-existent queue', async () => {
      const job = await storage.peek('non-existent');
      expect(job).toBeNull();
    });
  });

  // ==========================================================================
  // GetJob
  // ==========================================================================
  describe('getJob()', () => {
    it('should get job by ID', async () => {
      const job = createTestJob({ id: 'job_1' });
      await storage.enqueue('default', job);

      const found = await storage.getJob('job_1');
      expect(found).toEqual(job);
    });

    it('should return null for non-existent job', async () => {
      const found = await storage.getJob('non-existent');
      expect(found).toBeNull();
    });

    it('should filter by queue name when provided', async () => {
      const job = createTestJob({ id: 'job_1', queueName: 'queue-a' });
      await storage.enqueue('queue-a', job);

      // Should find in correct queue
      const found1 = await storage.getJob('job_1', 'queue-a');
      expect(found1).toEqual(job);

      // Should not find in wrong queue
      const found2 = await storage.getJob('job_1', 'queue-b');
      expect(found2).toBeNull();

      // Should find without queue filter
      const found3 = await storage.getJob('job_1');
      expect(found3).toEqual(job);
    });
  });

  // ==========================================================================
  // ListJobs
  // ==========================================================================
  describe('listJobs()', () => {
    beforeEach(async () => {
      // Set up test data
      await storage.enqueue(
        'default',
        createTestJob({ id: 'job_1', status: 'queued', type: 'type-a', priority: 5 })
      );
      await storage.enqueue(
        'default',
        createTestJob({ id: 'job_2', status: 'running', type: 'type-b', priority: 3 })
      );
      await storage.enqueue(
        'default',
        createTestJob({ id: 'job_3', status: 'completed', type: 'type-a', priority: 8 })
      );
      await storage.enqueue(
        'default',
        createTestJob({ id: 'job_4', status: 'failed', type: 'type-b', priority: 1 })
      );
      await storage.enqueue(
        'default',
        createTestJob({ id: 'job_5', status: 'queued', type: 'type-a', priority: 10 })
      );
    });

    it('should list all jobs without filters', async () => {
      const jobs = await storage.listJobs('default');
      expect(jobs).toHaveLength(5);
    });

    it('should filter by single status', async () => {
      const jobs = await storage.listJobs('default', { status: 'queued' });
      expect(jobs).toHaveLength(2);
      expect(jobs.every((j: Job) => j.status === 'queued')).toBe(true);
    });

    it('should filter by multiple statuses', async () => {
      const jobs = await storage.listJobs('default', { status: ['queued', 'running'] });
      expect(jobs).toHaveLength(3);
      expect(jobs.every((j: Job) => ['queued', 'running'].includes(j.status))).toBe(true);
    });

    it('should filter by job type', async () => {
      const jobs = await storage.listJobs('default', { jobType: 'type-a' });
      expect(jobs).toHaveLength(3);
      expect(jobs.every((j: Job) => j.type === 'type-a')).toBe(true);
    });

    it('should combine filters', async () => {
      const jobs = await storage.listJobs('default', {
        status: 'queued',
        jobType: 'type-a',
      });
      expect(jobs).toHaveLength(2);
    });

    it('should apply limit', async () => {
      const jobs = await storage.listJobs('default', { limit: 2 });
      expect(jobs).toHaveLength(2);
    });

    it('should apply offset', async () => {
      const allJobs = await storage.listJobs('default', { sortBy: 'queuedAt', sortOrder: 'asc' });
      const offsetJobs = await storage.listJobs('default', {
        offset: 2,
        sortBy: 'queuedAt',
        sortOrder: 'asc',
      });

      expect(offsetJobs).toHaveLength(3);
      expect(offsetJobs[0]).toEqual(allJobs[2]);
    });

    it('should sort by priority', async () => {
      const jobs = await storage.listJobs('default', { sortBy: 'priority', sortOrder: 'desc' });

      for (let i = 1; i < jobs.length; i++) {
        expect(jobs[i - 1]!.priority).toBeGreaterThanOrEqual(jobs[i]!.priority);
      }
    });

    it('should sort by status', async () => {
      const jobs = await storage.listJobs('default', { sortBy: 'status', sortOrder: 'asc' });

      for (let i = 1; i < jobs.length; i++) {
        expect(jobs[i - 1]!.status.localeCompare(jobs[i]!.status)).toBeLessThanOrEqual(0);
      }
    });

    it('should return empty array for non-existent queue', async () => {
      const jobs = await storage.listJobs('non-existent');
      expect(jobs).toEqual([]);
    });

    it('should return empty array when no jobs match filter', async () => {
      const jobs = await storage.listJobs('default', { status: 'cancelled' });
      expect(jobs).toEqual([]);
    });
  });

  // ==========================================================================
  // UpdateJob
  // ==========================================================================
  describe('updateJob()', () => {
    it('should update job properties', async () => {
      const job = createTestJob({ id: 'job_1', status: 'queued' });
      await storage.enqueue('default', job);

      await storage.updateJob('job_1', {
        status: 'running',
        startedAt: 12345,
      });

      const updated = await storage.getJob('job_1');
      expect(updated?.status).toBe('running');
      expect(updated?.startedAt).toBe(12345);
    });

    it('should update statistics on status change', async () => {
      const job = createTestJob({ id: 'job_1', status: 'queued' });
      await storage.enqueue('default', job);

      let stats = await storage.getQueueStats('default');
      expect(stats.queued).toBe(1);
      expect(stats.running).toBe(0);

      await storage.updateJob('job_1', { status: 'running' });

      stats = await storage.getQueueStats('default');
      expect(stats.queued).toBe(0);
      expect(stats.running).toBe(1);
    });

    it('should handle status transitions correctly', async () => {
      const job = createTestJob({ id: 'job_1', status: 'queued' });
      await storage.enqueue('default', job);

      // queued -> running
      await storage.updateJob('job_1', { status: 'running' });
      let stats = await storage.getQueueStats('default');
      expect(stats.queued).toBe(0);
      expect(stats.running).toBe(1);

      // running -> completed
      await storage.updateJob('job_1', { status: 'completed' });
      stats = await storage.getQueueStats('default');
      expect(stats.running).toBe(0);
      expect(stats.completed).toBe(1);
    });

    it('should silently ignore non-existent job', async () => {
      // Should not throw
      await storage.updateJob('non-existent', { status: 'running' });
    });

    it('should not change stats when status unchanged', async () => {
      const job = createTestJob({ id: 'job_1', status: 'queued' });
      await storage.enqueue('default', job);

      await storage.updateJob('job_1', { progress: 50 });

      const stats = await storage.getQueueStats('default');
      expect(stats.queued).toBe(1);
    });
  });

  // ==========================================================================
  // RemoveJob
  // ==========================================================================
  describe('removeJob()', () => {
    it('should remove job and return true', async () => {
      const job = createTestJob({ id: 'job_1' });
      await storage.enqueue('default', job);

      const removed = await storage.removeJob('job_1');
      expect(removed).toBe(true);

      const found = await storage.getJob('job_1');
      expect(found).toBeNull();
    });

    it('should return false for non-existent job', async () => {
      const removed = await storage.removeJob('non-existent');
      expect(removed).toBe(false);
    });

    it('should update statistics on remove', async () => {
      const job = createTestJob({ id: 'job_1', status: 'completed' });
      await storage.enqueue('default', job);

      let stats = await storage.getQueueStats('default');
      expect(stats.total).toBe(1);
      expect(stats.completed).toBe(1);

      await storage.removeJob('job_1');

      stats = await storage.getQueueStats('default');
      expect(stats.total).toBe(0);
      expect(stats.completed).toBe(0);
    });
  });

  // ==========================================================================
  // GetQueueStats
  // ==========================================================================
  describe('getQueueStats()', () => {
    it('should return default stats for new queue', async () => {
      const stats = await storage.getQueueStats('new-queue');

      expect(stats).toEqual({
        total: 0,
        queued: 0,
        running: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
      });
    });

    it('should track all status types', async () => {
      await storage.enqueue('default', createTestJob({ id: 'j1', status: 'queued' }));
      await storage.enqueue('default', createTestJob({ id: 'j2', status: 'running' }));
      await storage.enqueue('default', createTestJob({ id: 'j3', status: 'completed' }));
      await storage.enqueue('default', createTestJob({ id: 'j4', status: 'failed' }));
      await storage.enqueue('default', createTestJob({ id: 'j5', status: 'cancelled' }));

      const stats = await storage.getQueueStats('default');

      expect(stats.total).toBe(5);
      expect(stats.queued).toBe(1);
      expect(stats.running).toBe(1);
      expect(stats.completed).toBe(1);
      expect(stats.failed).toBe(1);
      expect(stats.cancelled).toBe(1);
    });

    it('should return a copy (not reference)', async () => {
      await storage.enqueue('default', createTestJob({ id: 'job_1' }));

      const stats1 = await storage.getQueueStats('default');
      stats1.total = 999; // Modify the returned object

      const stats2 = await storage.getQueueStats('default');
      expect(stats2.total).toBe(1); // Original should be unchanged
    });
  });

  // ==========================================================================
  // Lifecycle Methods
  // ==========================================================================
  describe('Lifecycle Methods', () => {
    it('connect() should resolve successfully', async () => {
      await expect(storage.connect()).resolves.toBeUndefined();
    });

    it('disconnect() should resolve successfully', async () => {
      await expect(storage.disconnect()).resolves.toBeUndefined();
    });

    it('healthCheck() should return true', async () => {
      const healthy = await storage.healthCheck();
      expect(healthy).toBe(true);
    });
  });

  // ==========================================================================
  // Multiple Queues Isolation
  // ==========================================================================
  describe('Multiple Queues Isolation', () => {
    it('should isolate jobs between queues', async () => {
      await storage.enqueue('queue-a', createTestJob({ id: 'job_a', queueName: 'queue-a' }));
      await storage.enqueue('queue-b', createTestJob({ id: 'job_b', queueName: 'queue-b' }));

      const statsA = await storage.getQueueStats('queue-a');
      const statsB = await storage.getQueueStats('queue-b');

      expect(statsA.total).toBe(1);
      expect(statsB.total).toBe(1);
    });

    it('should dequeue from correct queue', async () => {
      await storage.enqueue('queue-a', createTestJob({ id: 'job_a', priority: 10 }));
      await storage.enqueue('queue-b', createTestJob({ id: 'job_b', priority: 1 }));

      const jobA = await storage.dequeue('queue-a');
      const jobB = await storage.dequeue('queue-b');

      expect(jobA?.id).toBe('job_a');
      expect(jobB?.id).toBe('job_b');
    });

    it('should list jobs from correct queue', async () => {
      await storage.enqueue('queue-a', createTestJob({ id: 'job_a1' }));
      await storage.enqueue('queue-a', createTestJob({ id: 'job_a2' }));
      await storage.enqueue('queue-b', createTestJob({ id: 'job_b1' }));

      const jobsA = await storage.listJobs('queue-a');
      const jobsB = await storage.listJobs('queue-b');

      expect(jobsA).toHaveLength(2);
      expect(jobsB).toHaveLength(1);
    });

    it('should track stats separately per queue', async () => {
      await storage.enqueue('queue-a', createTestJob({ id: 'j1', status: 'queued' }));
      await storage.enqueue('queue-a', createTestJob({ id: 'j2', status: 'completed' }));
      await storage.enqueue('queue-b', createTestJob({ id: 'j3', status: 'failed' }));

      const statsA = await storage.getQueueStats('queue-a');
      const statsB = await storage.getQueueStats('queue-b');

      expect(statsA.queued).toBe(1);
      expect(statsA.completed).toBe(1);
      expect(statsA.failed).toBe(0);

      expect(statsB.queued).toBe(0);
      expect(statsB.completed).toBe(0);
      expect(statsB.failed).toBe(1);
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================
  describe('Edge Cases', () => {
    it('should handle job with all optional fields', async () => {
      const job = createTestJob({
        id: 'job_full',
        progressMessage: 'Working...',
        startedAt: 1000,
        completedAt: 2000,
        result: { success: true },
        error: { message: 'Test error' },
      });

      await storage.enqueue('default', job);
      const found = await storage.getJob('job_full');

      expect(found).toEqual(job);
    });

    it('should handle rapid enqueue/dequeue', async () => {
      for (let i = 0; i < 100; i++) {
        await storage.enqueue(
          'default',
          createTestJob({ id: `job_${i}`, priority: ((i % 10) + 1) as JobPriority })
        );
      }

      let dequeued = 0;
      while (true) {
        const job = await storage.dequeue('default');
        if (!job) break;
        dequeued++;
      }

      expect(dequeued).toBe(100);
    });

    it('should handle stats not going negative', async () => {
      const job = createTestJob({ id: 'job_1', status: 'queued' });
      await storage.enqueue('default', job);

      // Remove the job
      await storage.removeJob('job_1');

      // Try to remove again (should be no-op)
      await storage.removeJob('job_1');

      const stats = await storage.getQueueStats('default');
      expect(stats.queued).toBe(0);
      expect(stats.total).toBe(0);
    });

    it('should handle updating job multiple times', async () => {
      const job = createTestJob({ id: 'job_1', status: 'queued' });
      await storage.enqueue('default', job);

      await storage.updateJob('job_1', { progress: 25 });
      await storage.updateJob('job_1', { progress: 50 });
      await storage.updateJob('job_1', { progress: 75 });
      await storage.updateJob('job_1', { progress: 100, status: 'completed' });

      const updated = await storage.getJob('job_1');
      expect(updated?.progress).toBe(100);
      expect(updated?.status).toBe('completed');
    });
  });
});
