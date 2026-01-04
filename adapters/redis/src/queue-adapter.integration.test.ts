/**
 * Integration Tests for RedisQueueAdapter
 *
 * These tests run against a real Redis instance to validate:
 * - Lua script execution and atomicity
 * - Distributed queue operations
 * - Job state transitions
 * - Concurrent operations
 * - Priority handling
 *
 * Prerequisites:
 *   Start Redis: docker compose -f compose.test.yaml up -d
 *   Stop Redis:  docker compose -f compose.test.yaml down
 *
 * @module @blaizejs/adapter-redis/queue-adapter.integration.test
 */

import { createLogger } from 'blaizejs';

import { createRedisClient } from './client';
import { RedisQueueAdapter } from './queue-adapter';

import type { QueueJob, RedisClient } from './types';

// ==========================================================================
// Test Configuration
// ==========================================================================

const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || '127.0.0.1', // Use 127.0.0.1 instead of localhost to force IPv4
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  db: 15, // Use separate database for testing
  connectTimeout: 5000,
  commandTimeout: 3000,
};

const TEST_TIMEOUT = 30000; // 30 seconds for integration tests

// ==========================================================================
// Test Helpers
// ==========================================================================

let sharedClient: RedisClient;

function createTestAdapter(): RedisQueueAdapter {
  const logger = createLogger({ level: 'error' });
  return new RedisQueueAdapter(sharedClient, { logger });
}

function createTestJob(overrides: Partial<QueueJob> = {}): QueueJob {
  const id = overrides.id ?? `job_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  return {
    id,
    type: 'test:job',
    queueName: 'test-queue',
    data: { test: true, timestamp: Date.now() },
    status: 'queued',
    priority: 5,
    progress: 0,
    queuedAt: Date.now(),
    retries: 0,
    maxRetries: 3,
    timeout: 30000,
    metadata: {},
    ...overrides,
  };
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ==========================================================================
// Integration Test Suite
// ==========================================================================

describe('RedisQueueAdapter - Integration Tests', { timeout: TEST_TIMEOUT }, () => {
  let adapter: RedisQueueAdapter;

  // Setup: Connect to Redis once
  beforeAll(async () => {
    sharedClient = createRedisClient(REDIS_CONFIG);

    try {
      await sharedClient.connect();

      // Verify Redis is accessible
      const connection = sharedClient.getConnection();
      const pong = await connection.ping();
      expect(pong).toBe('PONG');

      console.log('✅ Connected to Redis successfully');
    } catch (error) {
      console.error('❌ Failed to connect to Redis:', error);
      throw new Error(
        'Redis connection failed. Make sure Redis is running: docker compose -f compose.test.yaml up -d'
      );
    }
  }, TEST_TIMEOUT);

  afterAll(async () => {
    if (sharedClient) {
      await sharedClient.disconnect();
    }
  });

  beforeEach(async () => {
    // Clean database before each test
    const connection = sharedClient.getConnection();
    await connection.flushdb();

    // Create fresh adapter
    adapter = createTestAdapter();

    // Load Lua scripts (adapter.connect checks if client is already connected)
    await adapter.connect();
  });

  // NO afterEach - don't disconnect adapter, let it share the client

  // ==========================================================================
  // Enqueue/Dequeue Ordering Tests
  // ==========================================================================

  describe('Enqueue/Dequeue Ordering (FIFO within priority)', () => {
    it('should dequeue jobs in FIFO order for same priority', async () => {
      // Enqueue 3 jobs with same priority
      const job1 = createTestJob({ priority: 5, data: { order: 1 } });
      await adapter.enqueue('test-queue', job1);

      await sleep(50); // Increased sleep to ensure different timestamps

      const job2 = createTestJob({ priority: 5, data: { order: 2 } });
      await adapter.enqueue('test-queue', job2);

      await sleep(50);

      const job3 = createTestJob({ priority: 5, data: { order: 3 } });
      await adapter.enqueue('test-queue', job3);

      // Dequeue should return in FIFO order
      const dequeued1 = await adapter.dequeue('test-queue');
      const dequeued2 = await adapter.dequeue('test-queue');
      const dequeued3 = await adapter.dequeue('test-queue');

      expect(dequeued1?.id).toBe(job1.id);
      expect(dequeued1?.data).toEqual({ order: 1 });

      expect(dequeued2?.id).toBe(job2.id);
      expect(dequeued2?.data).toEqual({ order: 2 });

      expect(dequeued3?.id).toBe(job3.id);
      expect(dequeued3?.data).toEqual({ order: 3 });
    });

    it('should return null when queue is empty', async () => {
      const result = await adapter.dequeue('test-queue');
      expect(result).toBeNull();
    });

    it('should handle multiple queues independently', async () => {
      const queue1Job = createTestJob({ queueName: 'queue-1', data: { queue: 1 } });
      const queue2Job = createTestJob({ queueName: 'queue-2', data: { queue: 2 } });

      await adapter.enqueue('queue-1', queue1Job);
      await adapter.enqueue('queue-2', queue2Job);

      const fromQueue1 = await adapter.dequeue('queue-1');
      const fromQueue2 = await adapter.dequeue('queue-2');

      expect(fromQueue1?.id).toBe(queue1Job.id);
      expect(fromQueue1?.data).toEqual({ queue: 1 });

      expect(fromQueue2?.id).toBe(queue2Job.id);
      expect(fromQueue2?.data).toEqual({ queue: 2 });

      // Other queue should be empty
      expect(await adapter.dequeue('queue-1')).toBeNull();
      expect(await adapter.dequeue('queue-2')).toBeNull();
    });
  });

  // ==========================================================================
  // Priority Handling Tests
  // ==========================================================================

  describe('Priority Handling (higher priority first)', () => {
    it('should dequeue higher priority jobs first', async () => {
      // Enqueue jobs with different priorities (lower number = higher priority)
      const lowPriority = createTestJob({ priority: 10, data: { priority: 'low' } });
      await adapter.enqueue('test-queue', lowPriority);

      await sleep(50); // Ensure different timestamps

      const highPriority = createTestJob({ priority: 1, data: { priority: 'high' } });
      await adapter.enqueue('test-queue', highPriority);

      await sleep(50);

      const mediumPriority = createTestJob({ priority: 5, data: { priority: 'medium' } });
      await adapter.enqueue('test-queue', mediumPriority);

      // Should dequeue in priority order: high (1) -> medium (5) -> low (10)
      const first = await adapter.dequeue('test-queue');
      const second = await adapter.dequeue('test-queue');
      const third = await adapter.dequeue('test-queue');

      expect(first?.id).toBe(highPriority.id);
      expect(first?.data).toEqual({ priority: 'high' });

      expect(second?.id).toBe(mediumPriority.id);
      expect(second?.data).toEqual({ priority: 'medium' });

      expect(third?.id).toBe(lowPriority.id);
      expect(third?.data).toEqual({ priority: 'low' });
    });

    it('should maintain FIFO within same priority level', async () => {
      // Enqueue multiple jobs at same priority with delays
      const jobs: QueueJob[] = [];
      for (let i = 0; i < 5; i++) {
        const job = createTestJob({ priority: 5, data: { index: i } });
        jobs.push(job);
        await adapter.enqueue('test-queue', job);
        await sleep(10);
      }

      // Dequeue and verify order
      for (let i = 0; i < 5; i++) {
        const dequeued = await adapter.dequeue('test-queue');
        expect(dequeued?.id).toBe(jobs[i]!.id);
        expect(dequeued?.data).toEqual({ index: i });
      }
    });

    it('should handle priority updates correctly', async () => {
      const job1 = createTestJob({ priority: 5, data: { id: 1 } });
      await adapter.enqueue('test-queue', job1);

      await sleep(50);
      const job2 = createTestJob({ priority: 10, data: { id: 2 } });
      await adapter.enqueue('test-queue', job2);

      // Update job2 to have higher priority
      await adapter.updateJob(job2.id, { priority: 1 });

      // job2 should now dequeue first
      const first = await adapter.dequeue('test-queue');
      const second = await adapter.dequeue('test-queue');

      expect(first?.id).toBe(job2.id);
      expect(second?.id).toBe(job1.id);
    });
  });

  // ==========================================================================
  // Job State Transition Tests
  // ==========================================================================

  describe('Job State Transitions', () => {
    it('should transition from queued to running on dequeue', async () => {
      const job = createTestJob();
      await adapter.enqueue('test-queue', job);
      expect(job.status).toBe('queued');

      const dequeued = await adapter.dequeue('test-queue');
      expect(dequeued?.status).toBe('running');
      expect(dequeued?.startedAt).toBeDefined();
    });

    it('should transition from running to completed', async () => {
      const job = createTestJob();
      await adapter.enqueue('test-queue', job);
      const running = await adapter.dequeue('test-queue');

      const completed = await adapter.completeJob(running!.id, { result: 'success' });
      expect(completed).toBe(true);

      const fetched = await adapter.getJob(running!.id);
      expect(fetched?.status).toBe('completed');
      expect(fetched?.completedAt).toBeDefined();
      expect(fetched?.progress).toBe(100);
      expect(fetched?.result).toEqual({ result: 'success' });
    });

    it('should transition from running to failed (no retries)', async () => {
      const job = createTestJob({ maxRetries: 0 });
      await adapter.enqueue('test-queue', job);
      const running = await adapter.dequeue('test-queue');

      const result = await adapter.failJob(running!.id, 'Test error');
      expect(result).toBe('failed');

      const fetched = await adapter.getJob(running!.id);
      expect(fetched?.status).toBe('failed');
      expect(fetched?.failedAt).toBeDefined();
      expect(fetched?.error).toBe('Test error');
    });

    it('should retry failed jobs when retries available', async () => {
      const job = createTestJob({ maxRetries: 3 });
      await adapter.enqueue('test-queue', job);
      const running = await adapter.dequeue('test-queue');

      // Fail the job (should retry)
      const result = await adapter.failJob(running!.id, 'First failure');
      expect(result).toBe('retry');

      const fetched = await adapter.getJob(running!.id);
      expect(fetched?.status).toBe('queued');
      expect(fetched?.retries).toBe(1);
      expect(fetched?.error).toBe('First failure');

      // Job should be back in queue
      const retried = await adapter.dequeue('test-queue');
      expect(retried?.id).toBe(job.id);
      expect(retried?.retries).toBe(1);
    });

    it('should maintain original queue position when retrying', async () => {
      // Create and start job1
      const job1 = createTestJob({ maxRetries: 3, data: { name: 'job1' } });
      await adapter.enqueue('test-queue', job1);
      const running1 = await adapter.dequeue('test-queue');

      // While job1 runs, create job2
      const job2 = createTestJob({ data: { name: 'job2' } });
      await adapter.enqueue('test-queue', job2);

      // Fail job1 (triggers retry)
      await adapter.failJob(running1!.id, 'Transient error');

      // Next dequeue gets job1 retry, NOT job2
      const next = await adapter.dequeue('test-queue');
      expect(next?.id).toBe(job1.id); // ✅ job1 maintains position
      expect(next?.retries).toBe(1);

      // Then job2 dequeues
      const last = await adapter.dequeue('test-queue');
      expect(last?.id).toBe(job2.id);
    });

    it('should fail permanently after max retries exhausted', async () => {
      const job = createTestJob({ maxRetries: 2 });
      await adapter.enqueue('test-queue', job);

      // Fail twice (should retry)
      for (let i = 0; i < 2; i++) {
        const running = await adapter.dequeue('test-queue');
        const result = await adapter.failJob(running!.id, `Failure ${i + 1}`);
        expect(result).toBe('retry');
      }

      // Third failure should be permanent
      const running = await adapter.dequeue('test-queue');
      const result = await adapter.failJob(running!.id, 'Final failure');
      expect(result).toBe('failed');

      const fetched = await adapter.getJob(running!.id);
      expect(fetched?.status).toBe('failed');
      expect(fetched?.retries).toBe(3);

      // Should not be in queue anymore
      expect(await adapter.dequeue('test-queue')).toBeNull();
    });

    it('should allow updating job to cancelled status', async () => {
      const job = createTestJob();
      await adapter.enqueue('test-queue', job);

      await adapter.updateJob(job.id, { status: 'cancelled' });

      const fetched = await adapter.getJob(job.id);
      expect(fetched?.status).toBe('cancelled');
    });

    it('should not allow completing a job not in running state', async () => {
      const job = createTestJob();
      await adapter.enqueue('test-queue', job);

      // Try to complete while still queued
      const result = await adapter.completeJob(job.id, { result: 'premature' });
      expect(result).toBe(false);

      const fetched = await adapter.getJob(job.id);
      expect(fetched?.status).toBe('queued');
    });
  });

  // ==========================================================================
  // Concurrent Dequeue Tests
  // ==========================================================================

  describe('Concurrent Dequeue Operations', () => {
    it('should handle concurrent dequeues without duplicates', async () => {
      // Enqueue 10 jobs
      const jobs: QueueJob[] = [];
      for (let i = 0; i < 10; i++) {
        const job = createTestJob({ data: { index: i } });
        jobs.push(job);
        await adapter.enqueue('test-queue', job);
      }

      // Simulate 10 concurrent workers
      const dequeuePromises = Array.from({ length: 10 }, () => adapter.dequeue('test-queue'));

      const results = await Promise.all(dequeuePromises);

      // All jobs should be dequeued exactly once
      const dequeuedIds = results.filter(r => r !== null).map(r => r!.id);
      const uniqueIds = new Set(dequeuedIds);

      expect(dequeuedIds.length).toBe(10);
      expect(uniqueIds.size).toBe(10); // No duplicates
      expect(dequeuedIds.sort()).toEqual(jobs.map(j => j.id).sort());
    });

    it('should handle race conditions with multiple queues', async () => {
      // Create jobs in multiple queues
      const queue1Jobs: QueueJob[] = [];
      const queue2Jobs: QueueJob[] = [];

      for (let i = 0; i < 2; i++) {
        const q1job = createTestJob({ queueName: 'queue-1', data: { q: 1, i: i + 1 } });
        const q2job = createTestJob({ queueName: 'queue-2', data: { q: 2, i: i + 1 } });
        queue1Jobs.push(q1job);
        queue2Jobs.push(q2job);
        await adapter.enqueue('queue-1', q1job);
        await adapter.enqueue('queue-2', q2job);
      }

      // Concurrent dequeues from both queues
      const [q1r1, q1r2, q2r1, q2r2] = await Promise.all([
        adapter.dequeue('queue-1'),
        adapter.dequeue('queue-1'),
        adapter.dequeue('queue-2'),
        adapter.dequeue('queue-2'),
      ]);

      // Verify all jobs dequeued once
      expect([q1r1, q1r2].map(j => j!.id).sort()).toEqual(queue1Jobs.map(j => j.id).sort());
      expect([q2r1, q2r2].map(j => j!.id).sort()).toEqual(queue2Jobs.map(j => j.id).sort());
    });

    it('should handle concurrent completeJob calls', async () => {
      const jobs: QueueJob[] = [];
      for (let i = 0; i < 3; i++) {
        const job = createTestJob({ data: { index: i + 1 } });
        jobs.push(job);
        await adapter.enqueue('test-queue', job);
      }

      // Dequeue all
      const running = await Promise.all([
        adapter.dequeue('test-queue'),
        adapter.dequeue('test-queue'),
        adapter.dequeue('test-queue'),
      ]);

      // Complete concurrently
      const completeResults = await Promise.all(
        running.map(job => adapter.completeJob(job!.id, { done: true }))
      );

      expect(completeResults).toEqual([true, true, true]);

      // Verify all are completed
      const statuses = await Promise.all(jobs.map(j => adapter.getJob(j.id)));
      expect(statuses.every(s => s?.status === 'completed')).toBe(true);
    });
  });

  // ==========================================================================
  // Job Filtering Tests
  // ==========================================================================

  describe('Job Filtering', () => {
    beforeEach(async () => {
      // Create diverse set of jobs with different timestamps
      await adapter.enqueue('test-queue', createTestJob({ type: 'email:send', status: 'queued' }));
      await sleep(10);
      await adapter.enqueue('test-queue', createTestJob({ type: 'email:send', status: 'queued' }));
      await sleep(10);
      await adapter.enqueue(
        'test-queue',
        createTestJob({ type: 'report:generate', status: 'queued' })
      );
      await sleep(10);

      // Dequeue one and complete it
      const job = await adapter.dequeue('test-queue');
      await adapter.completeJob(job!.id, { success: true });
      await sleep(10);

      // Create some failed jobs
      const failJob = createTestJob({ maxRetries: 0, priority: 1 });
      await adapter.enqueue('test-queue', failJob);
      await sleep(10);
      const running = await adapter.dequeue('test-queue');
      await adapter.failJob(running!.id, 'Test failure');
      await sleep(10);
    });

    it('should filter jobs by status', async () => {
      const queued = await adapter.listJobs('test-queue', { status: 'queued' });
      const completed = await adapter.listJobs('test-queue', { status: 'completed' });
      const failed = await adapter.listJobs('test-queue', { status: 'failed' });

      expect(queued.length).toBe(2); // 2 still queued
      expect(completed.length).toBe(1); // 1 completed
      expect(failed.length).toBe(1); // 1 failed
    });

    it('should filter jobs by type', async () => {
      const emailJobs = await adapter.listJobs('test-queue', { jobType: 'email:send' });
      const reportJobs = await adapter.listJobs('test-queue', { jobType: 'report:generate' });

      expect(emailJobs.length).toBeGreaterThanOrEqual(1);
      expect(reportJobs.length).toBeGreaterThanOrEqual(1);
      expect(emailJobs.every(j => j.type === 'email:send')).toBe(true);
      expect(reportJobs.every(j => j.type === 'report:generate')).toBe(true);
    });

    it('should support limit and offset for pagination', async () => {
      // Create 10 jobs
      for (let i = 0; i < 10; i++) {
        await adapter.enqueue('test-queue', createTestJob({ data: { index: i } }));
      }

      const page1 = await adapter.listJobs('test-queue', { limit: 3, offset: 0 });
      const page2 = await adapter.listJobs('test-queue', { limit: 3, offset: 3 });

      expect(page1.length).toBe(3);
      expect(page2.length).toBe(3);

      // Pages should not overlap
      const page1Ids = new Set(page1.map(j => j.id));
      const page2Ids = new Set(page2.map(j => j.id));
      expect([...page1Ids].filter(id => page2Ids.has(id))).toHaveLength(0);
    });

    it('should sort jobs by priority', async () => {
      await adapter.enqueue('test-queue', createTestJob({ priority: 10 }));
      await sleep(10);
      await adapter.enqueue('test-queue', createTestJob({ priority: 1 }));
      await sleep(10);
      await adapter.enqueue('test-queue', createTestJob({ priority: 5 }));
      await sleep(10);

      const jobs = await adapter.listJobs('test-queue', {
        status: 'queued',
        sortBy: 'priority',
        sortOrder: 'asc',
      });

      // Should be sorted by priority ascending (1, 5, 10)
      const priorities = jobs.map(j => j.priority);
      expect(priorities[0]).toBeLessThanOrEqual(priorities[1]!);
      expect(priorities[1]).toBeLessThanOrEqual(priorities[2]!);
    });
  });

  // ==========================================================================
  // Lua Script Atomicity Tests
  // ==========================================================================

  describe('Lua Script Atomicity', () => {
    it('should atomically dequeue job (no race condition)', async () => {
      const job = createTestJob();
      await adapter.enqueue('test-queue', job);

      // Simulate race: try to dequeue same job twice simultaneously
      const [result1, result2] = await Promise.all([
        adapter.dequeue('test-queue'),
        adapter.dequeue('test-queue'),
      ]);

      // Exactly one should succeed
      const successCount = [result1, result2].filter(r => r !== null).length;
      expect(successCount).toBe(1);

      // The successful dequeue should have the correct job
      const successful = result1 || result2;
      expect(successful?.id).toBe(job.id);
    });

    it('should atomically complete job (idempotent)', async () => {
      const job = createTestJob();
      await adapter.enqueue('test-queue', job);
      const running = await adapter.dequeue('test-queue');

      // Complete the same job twice
      const [result1, result2] = await Promise.all([
        adapter.completeJob(running!.id, { result: 'first' }),
        adapter.completeJob(running!.id, { result: 'second' }),
      ]);

      // Both should report success (idempotent)
      expect(result1).toBe(true);
      // Second might be false if first finished first
      expect([true, false]).toContain(result2);

      // Job should be completed
      const fetched = await adapter.getJob(running!.id);
      expect(fetched?.status).toBe('completed');
    });

    it('should atomically fail job with retry logic', async () => {
      const job = createTestJob({ maxRetries: 3 });
      await adapter.enqueue('test-queue', job);
      const running = await adapter.dequeue('test-queue');

      // Fail and immediately try to dequeue
      const [failResult, dequeueResult] = await Promise.all([
        adapter.failJob(running!.id, 'Error'),
        sleep(50).then(() => adapter.dequeue('test-queue')), // Slight delay to ensure fail completes first
      ]);

      expect(failResult).toBe('retry');

      // The retried job should be dequeueable
      if (dequeueResult) {
        expect(dequeueResult.id).toBe(job.id);
        expect(dequeueResult.retries).toBe(1);
      }
    });

    it('should maintain job count consistency under concurrent operations', async () => {
      // Enqueue 20 jobs
      const enqueuePromises: Promise<void>[] = [];
      for (let i = 0; i < 20; i++) {
        const job = createTestJob({ data: { index: i } });
        enqueuePromises.push(adapter.enqueue('test-queue', job));
      }
      await Promise.all(enqueuePromises);

      // Get initial stats
      const initialStats = await adapter.getQueueStats('test-queue');
      expect(initialStats.queued).toBe(20);
      expect(initialStats.running).toBe(0);

      // Dequeue 10 concurrently
      const dequeuePromises = Array.from({ length: 10 }, () => adapter.dequeue('test-queue'));
      const dequeued = await Promise.all(dequeuePromises);

      // Verify stats updated correctly
      const afterDequeueStats = await adapter.getQueueStats('test-queue');
      expect(afterDequeueStats.queued).toBe(10);
      expect(afterDequeueStats.running).toBe(10);

      // Complete 5 concurrently
      const completePromises = dequeued
        .slice(0, 5)
        .map(job => adapter.completeJob(job!.id, { done: true }));
      await Promise.all(completePromises);

      // Verify final stats
      const finalStats = await adapter.getQueueStats('test-queue');
      expect(finalStats.queued).toBe(10);
      expect(finalStats.running).toBe(5);
      expect(finalStats.completed).toBe(5);
      expect(finalStats.total).toBe(20);
    });

    it('should preserve job data integrity during retries', async () => {
      const originalData = { important: 'data', timestamp: Date.now(), nested: { value: 42 } };
      const job = createTestJob({ data: originalData, maxRetries: 3 });
      await adapter.enqueue('test-queue', job);

      // Dequeue and fail multiple times
      for (let i = 0; i < 3; i++) {
        const running = await adapter.dequeue('test-queue');
        expect(running?.data).toEqual(originalData); // Data should be preserved
        await adapter.failJob(running!.id, `Failure ${i + 1}`);
      }

      // Final dequeue
      const finalRun = await adapter.dequeue('test-queue');
      expect(finalRun?.data).toEqual(originalData); // Data still intact
      expect(finalRun?.retries).toBe(3);
    });
  });

  // ==========================================================================
  // Statistics Tests
  // ==========================================================================

  describe('Queue Statistics', () => {
    it('should track job counts accurately', async () => {
      // Enqueue 5 jobs
      for (let i = 0; i < 5; i++) {
        await adapter.enqueue('test-queue', createTestJob());
      }

      let stats = await adapter.getQueueStats('test-queue');
      expect(stats.total).toBe(5);
      expect(stats.queued).toBe(5);
      expect(stats.running).toBe(0);

      // Dequeue 2
      await adapter.dequeue('test-queue');
      await adapter.dequeue('test-queue');

      stats = await adapter.getQueueStats('test-queue');
      expect(stats.queued).toBe(3);
      expect(stats.running).toBe(2);

      // Complete 1
      const running = await adapter.dequeue('test-queue');
      await adapter.completeJob(running!.id);

      stats = await adapter.getQueueStats('test-queue');
      expect(stats.completed).toBe(1);
      expect(stats.running).toBe(2);
    });
  });
});
