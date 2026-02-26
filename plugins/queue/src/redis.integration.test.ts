/**
 * Integration Tests for Queue Plugin with RedisQueueAdapter
 *
 * Tests job persistence and processing with Redis backend.
 *
 * Run with: pnpm test redis-integration.test.ts
 * Requires: docker compose -f compose.test.yaml up
 */
// ✅ Import from adapter-redis package
import { z } from 'zod';

import { createRedisClient, RedisQueueAdapter } from '@blaizejs/adapter-redis';
import type { RedisClient } from '@blaizejs/adapter-redis';
import { createMockLogger, createWorkingMockEventBus } from '@blaizejs/testing-utils';

import { QueueService } from './queue-service';

import type { HandlerRegistration, JobHandler } from './types';

// ============================================================================
// Test Configuration
// ============================================================================

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);

const TEST_REDIS_CONFIG = {
  host: REDIS_HOST,
  port: REDIS_PORT,
  db: 14, // Use db 14 for queue tests (different from cache tests)
};

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Wait for a specified time
 */
function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create test queue service with RedisQueueAdapter
 */
async function createTestQueueService(): Promise<{
  service: QueueService;
  redisClient: RedisClient;
  adapter: RedisQueueAdapter;
  handlerRegistry: Map<string, HandlerRegistration>;
}> {
  // Create Redis client
  const redisClient = createRedisClient(TEST_REDIS_CONFIG);
  await redisClient.connect();

  // Create RedisQueueAdapter
  const adapter = new RedisQueueAdapter(redisClient, {
    keyPrefix: 'test:queue:',
    logger: createMockLogger(),
  });
  await adapter.connect();

  const eventBus = createWorkingMockEventBus();
  const handlerRegistry = new Map<string, HandlerRegistration>();

  // Create QueueService
  const service = new QueueService({
    queues: {
      default: { concurrency: 5, jobs: {} },
      emails: { concurrency: 10, jobs: {} },
      reports: { concurrency: 2, jobs: {} },
    },
    storage: adapter,
    logger: createMockLogger(),
    eventBus,
    handlerRegistry,
  });

  return { service, redisClient, adapter, handlerRegistry };
}

/**
 * Cleanup queue service and connections
 */
async function cleanupQueueService(
  service: QueueService,
  adapter: RedisQueueAdapter,
  redisClient: RedisClient
): Promise<void> {
  // Stop all queues
  await service.stopAll();

  // Disconnect adapter
  await adapter.disconnect();

  // Disconnect Redis client
  await redisClient.disconnect();
}

// ============================================================================
// Test Suite
// ============================================================================

describe('Queue Plugin Redis Integration', () => {
  let cleanupClient: RedisClient;

  // Clean database before test suite
  beforeAll(async () => {
    // Create temporary client for cleanup
    cleanupClient = createRedisClient(TEST_REDIS_CONFIG);
    await cleanupClient.connect();

    // Flush this database to ensure clean start
    await cleanupClient.getConnection().flushdb();

    // Wait for cleanup to complete
    await wait(200);
  });

  beforeEach(async () => {
    // Flush Redis before EACH test to ensure isolation
    if (cleanupClient) {
      await cleanupClient.getConnection().flushdb();
      await wait(100);
    }
  });

  afterAll(async () => {
    // Final cleanup
    if (cleanupClient) {
      await cleanupClient.getConnection().flushdb();
      await cleanupClient.disconnect();
    }
  });

  // ==========================================================================
  // Basic Job Operations
  // ==========================================================================

  describe('Basic Job Operations', () => {
    let service: QueueService;
    let adapter: RedisQueueAdapter;
    let redisClient: RedisClient;
    let handlerRegistry: Map<string, HandlerRegistration>;

    beforeEach(async () => {
      const setup = await createTestQueueService();
      service = setup.service;
      adapter = setup.adapter;
      redisClient = setup.redisClient;
      handlerRegistry = setup.handlerRegistry;
    });

    afterEach(async () => {
      await cleanupQueueService(service, adapter, redisClient);
    });

    it('should persist jobs in Redis', async () => {
      handlerRegistry.set('default:test:job', { handler: vi.fn(async () => ({})), inputSchema: z.any(), outputSchema: z.any() });
      const jobId = await service.add('default', 'test:job', { message: 'Hello Redis' });

      expect(jobId).toBeDefined();

      // Job should exist in Redis
      const job = await service.getJob(jobId);
      expect(job).toBeDefined();
      expect(job!.id).toBe(jobId);
      expect(job!.type).toBe('test:job');
      expect(job!.data).toEqual({ message: 'Hello Redis' });
      expect(job!.status).toBe('queued');
    });

    it('should retrieve job after restart (persistence)', async () => {
      handlerRegistry.set('default:persist:test', { handler: vi.fn(async () => ({})), inputSchema: z.any(), outputSchema: z.any() });
      const jobId = await service.add('default', 'persist:test', { value: 42 });

      // Simulate restart by disconnecting and reconnecting
      await cleanupQueueService(service, adapter, redisClient);

      // Create new service instance
      const newSetup = await createTestQueueService();
      service = newSetup.service;
      adapter = newSetup.adapter;
      redisClient = newSetup.redisClient;

      // Job should still exist after "restart"
      const job = await service.getJob(jobId);
      expect(job).toBeDefined();
      expect(job!.id).toBe(jobId);
      expect(job!.data).toEqual({ value: 42 });
    });

    it('should process jobs with priority ordering', async () => {
      const processedJobs: string[] = [];

      // Register handler
      const handler: JobHandler = vi.fn(async ctx => {
        processedJobs.push(ctx.data.type as string);
        return { processed: true };
      });

      handlerRegistry.set('default:low', { handler, inputSchema: z.any(), outputSchema: z.any() });
      handlerRegistry.set('default:high', { handler, inputSchema: z.any(), outputSchema: z.any() });
      handlerRegistry.set('default:medium', { handler, inputSchema: z.any(), outputSchema: z.any() });

      // Start queue processing
      await service.startAll();

      // Add jobs in random order with different priorities
      await service.add('default', 'low', { type: 'low' }, { priority: 1 });
      await service.add('default', 'high', { type: 'high' }, { priority: 10 });
      await service.add('default', 'medium', { type: 'medium' }, { priority: 5 });

      // Wait for processing
      await wait(500);

      // Should process in priority order: high → medium → low
      expect(processedJobs).toEqual(['high', 'medium', 'low']);

      await service.stopAll();
    });

    it('should handle job completion correctly', async () => {
      const handler = vi.fn<JobHandler>(async () => {
        return { result: 'success' };
      });

      handlerRegistry.set('default:complete:test', { handler, inputSchema: z.any(), outputSchema: z.any() });

      await service.startAll();
      await wait(100); // Give queue time to start

      const jobId = await service.add('default', 'complete:test', { test: 'data' });

      await wait(200);

      const finalJob = await service.getJob(jobId);

      expect(handler).toHaveBeenCalled(); // First check if handler ran at all
      expect(finalJob!.status).toBe('completed');
      expect(finalJob!.result).toEqual({ result: 'success' });

      await service.stopAll();
    });

    it('should handle job failures with retries', async () => {
      let attempts = 0;
      const handler: JobHandler = vi.fn(async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Simulated failure');
        }
        return { succeeded: true };
      });

      handlerRegistry.set('default:retry:test', { handler, inputSchema: z.any(), outputSchema: z.any() });
      await service.startAll();
      await wait(200); // Give queue time to start

      const jobId = await service.add('default', 'retry:test', {}, { maxRetries: 5 });

      // ✅ Use manual polling loop instead of vi.waitFor
      const startTime = Date.now();
      const timeout = 10000;
      let tJob;

      while (Date.now() - startTime < timeout) {
        tJob = await service.getJob(jobId);
        if (tJob?.status === 'completed') {
          break;
        }

        await wait(200);
      }

      const job = await service.getJob(jobId);
      expect(job!.status).toBe('completed');
      expect(job!.retries).toBe(2); // Failed twice, succeeded on third attempt
      expect(attempts).toBe(3);

      await service.stopAll();
    });
  });

  // ==========================================================================
  // Multi-Queue Operations
  // ==========================================================================

  describe('Multi-Queue Operations', () => {
    let service: QueueService;
    let adapter: RedisQueueAdapter;
    let redisClient: RedisClient;
    let handlerRegistry: Map<string, HandlerRegistration>;

    beforeEach(async () => {
      const setup = await createTestQueueService();
      service = setup.service;
      adapter = setup.adapter;
      redisClient = setup.redisClient;
      handlerRegistry = setup.handlerRegistry;
    });

    afterEach(async () => {
      await cleanupQueueService(service, adapter, redisClient);
    });

    it('should handle multiple queues independently', async () => {
      const emailsProcessed: string[] = [];
      const reportsProcessed: string[] = [];

      // Register handlers for different queues
      handlerRegistry.set('emails:send', {
        handler: async ctx => {
          emailsProcessed.push(ctx.jobId);
          return { sent: true };
        },
        inputSchema: z.any(),
        outputSchema: z.any(),
      });

      handlerRegistry.set('reports:generate', {
        handler: async ctx => {
          reportsProcessed.push(ctx.jobId);
          return { generated: true };
        },
        inputSchema: z.any(),
        outputSchema: z.any(),
      });

      // Start both queues
      await service.startAll();

      // Add jobs to both queues
      const emailId = await service.add('emails', 'send', { to: 'test@example.com' });
      const reportId = await service.add('reports', 'generate', { reportId: 'R-123' });

      // Wait for processing
      await wait(500);

      // Both queues should have processed their jobs
      expect(emailsProcessed).toContain(emailId);
      expect(reportsProcessed).toContain(reportId);

      await service.stopAll();
    });

    it('should respect per-queue concurrency limits', async () => {
      let emailsConcurrent = 0;
      let maxEmailsConcurrent = 0;
      let reportsConcurrent = 0;
      let maxReportsConcurrent = 0;

      // Slow handler that tracks concurrency
      const emailHandler: JobHandler = vi.fn(async () => {
        emailsConcurrent++;
        maxEmailsConcurrent = Math.max(maxEmailsConcurrent, emailsConcurrent);
        await wait(100);
        emailsConcurrent--;
        return { sent: true };
      });

      const reportHandler: JobHandler = vi.fn(async () => {
        reportsConcurrent++;
        maxReportsConcurrent = Math.max(maxReportsConcurrent, reportsConcurrent);
        await wait(100);
        reportsConcurrent--;
        return { generated: true };
      });

      handlerRegistry.set('emails:send', { handler: emailHandler, inputSchema: z.any(), outputSchema: z.any() });
      handlerRegistry.set('reports:generate', { handler: reportHandler, inputSchema: z.any(), outputSchema: z.any() });

      await service.startAll(); // Starts all queues

      // Add multiple jobs
      for (let i = 0; i < 15; i++) {
        await service.add('emails', 'send', { email: `test${i}@example.com` });
      }
      for (let i = 0; i < 10; i++) {
        await service.add('reports', 'generate', { reportId: `R-${i}` });
      }

      // Wait for all jobs to complete
      await wait(2000);

      // Verify concurrency limits were respected
      expect(maxEmailsConcurrent).toBeLessThanOrEqual(10);
      expect(maxReportsConcurrent).toBeLessThanOrEqual(2);

      await service.stopAll();
    });
  });

  // ==========================================================================
  // Job Listing and Filtering
  // ==========================================================================

  describe('Job Listing and Filtering', () => {
    let service: QueueService;
    let adapter: RedisQueueAdapter;
    let redisClient: RedisClient;
    let handlerRegistry: Map<string, HandlerRegistration>;

    beforeEach(async () => {
      const setup = await createTestQueueService();
      service = setup.service;
      adapter = setup.adapter;
      redisClient = setup.redisClient;
      handlerRegistry = setup.handlerRegistry;
    });

    afterEach(async () => {
      await cleanupQueueService(service, adapter, redisClient);
    });

    it('should list jobs by status', async () => {
      const handler: JobHandler = vi.fn(async () => {
        await wait(1000); // Keep jobs running
        return { done: true };
      });

      handlerRegistry.set('default:list:test', { handler, inputSchema: z.any(), outputSchema: z.any() });

      // Add multiple jobs
      await service.add('default', 'list:test', { index: 1 });
      await service.add('default', 'list:test', { index: 2 });
      await service.add('default', 'list:test', { index: 3 });

      // Start processing (will start processing jobs)
      await service.startAll();
      await wait(100); // Give time for jobs to start

      // List queued jobs
      const queuedJobs = await service.listJobs('default', { status: 'queued' });

      // List running jobs
      const runningJobs = await service.listJobs('default', { status: 'running' });

      // Should have mix of queued and running
      expect(queuedJobs.length + runningJobs.length).toBe(3);

      await service.stopAll({ graceful: true, timeout: 2000 });
    });

    it('should limit number of jobs returned', async () => {
      handlerRegistry.set('default:limit:test', { handler: vi.fn(async () => ({})), inputSchema: z.any(), outputSchema: z.any() });
      // Add 10 jobs
      for (let i = 0; i < 10; i++) {
        await service.add('default', 'limit:test', { index: i });
      }

      // Get only first 5
      const limitedJobs = await service.listJobs('default', { limit: 5 });
      expect(limitedJobs).toHaveLength(5);

      // Get all
      const allJobs = await service.listJobs('default');
      expect(allJobs).toHaveLength(10);
    });

    it('should list all jobs when no filters provided', async () => {
      handlerRegistry.set('default:all:test1', { handler: vi.fn(async () => ({})), inputSchema: z.any(), outputSchema: z.any() });
      handlerRegistry.set('default:all:test2', { handler: vi.fn(async () => ({})), inputSchema: z.any(), outputSchema: z.any() });
      handlerRegistry.set('default:all:test3', { handler: vi.fn(async () => ({})), inputSchema: z.any(), outputSchema: z.any() });
      await service.add('default', 'all:test1', {});
      await service.add('default', 'all:test2', {});
      await service.add('default', 'all:test3', {});

      const allJobs = await service.listJobs('default');
      expect(allJobs).toHaveLength(3);
      expect(allJobs.every(j => j.status === 'queued')).toBe(true);
    });
  });

  // ==========================================================================
  // Queue Statistics
  // ==========================================================================

  describe('Queue Statistics', () => {
    let service: QueueService;
    let adapter: RedisQueueAdapter;
    let redisClient: RedisClient;
    let handlerRegistry: Map<string, HandlerRegistration>;

    beforeEach(async () => {
      const setup = await createTestQueueService();
      service = setup.service;
      adapter = setup.adapter;
      redisClient = setup.redisClient;
      handlerRegistry = setup.handlerRegistry;
    });

    afterEach(async () => {
      await cleanupQueueService(service, adapter, redisClient);
    });

    it('should provide accurate queue statistics', async () => {
      const slowHandler: JobHandler = vi.fn(async () => {
        await wait(500);
        return { done: true };
      });

      handlerRegistry.set('default:stats:test', { handler: slowHandler, inputSchema: z.any(), outputSchema: z.any() });

      // Add multiple jobs
      await service.add('default', 'stats:test', {});
      await service.add('default', 'stats:test', {});
      await service.add('default', 'stats:test', {});

      // Start processing
      await service.startAll();
      await wait(100);

      // Get statistics
      const stats = await service.getQueueStats('default');

      expect(stats.total).toBe(3);
      expect(stats.queued + stats.running).toBe(3);

      await service.stopAll({ graceful: true, timeout: 2000 });
    });
  });

  // ==========================================================================
  // Job Cancellation
  // ==========================================================================

  describe('Job Cancellation', () => {
    let service: QueueService;
    let adapter: RedisQueueAdapter;
    let redisClient: RedisClient;
    let handlerRegistry: Map<string, HandlerRegistration>;

    beforeEach(async () => {
      const setup = await createTestQueueService();
      service = setup.service;
      adapter = setup.adapter;
      redisClient = setup.redisClient;
      handlerRegistry = setup.handlerRegistry;
    });

    afterEach(async () => {
      await cleanupQueueService(service, adapter, redisClient);
    });

    it('should cancel queued jobs', async () => {
      handlerRegistry.set('default:cancel:test', { handler: vi.fn(async () => ({})), inputSchema: z.any(), outputSchema: z.any() });
      const jobId = await service.add('default', 'cancel:test', {});

      // Cancel before processing
      const cancelled = await service.cancelJob(jobId);
      expect(cancelled).toBe(true);

      const job = await service.getJob(jobId);
      expect(job!.status).toBe('cancelled');
    });

    it('should persist cancelled status in Redis', async () => {
      handlerRegistry.set('default:cancel:persist', { handler: vi.fn(async () => ({})), inputSchema: z.any(), outputSchema: z.any() });
      const jobId = await service.add('default', 'cancel:persist', {});
      await service.cancelJob(jobId);

      // Simulate restart
      await cleanupQueueService(service, adapter, redisClient);

      const newSetup = await createTestQueueService();
      service = newSetup.service;
      adapter = newSetup.adapter;
      redisClient = newSetup.redisClient;

      // Cancelled status should persist
      const job = await service.getJob(jobId);
      expect(job!.status).toBe('cancelled');
    });
  });

  // ==========================================================================
  // Health Check
  // ==========================================================================

  describe('Health Check', () => {
    let service: QueueService;
    let adapter: RedisQueueAdapter;
    let redisClient: RedisClient;

    beforeEach(async () => {
      const setup = await createTestQueueService();
      service = setup.service;
      adapter = setup.adapter;
      redisClient = setup.redisClient;
    });

    afterEach(async () => {
      await cleanupQueueService(service, adapter, redisClient);
    });

    it('should report healthy when connected', async () => {
      const healthy = await adapter.healthCheck();
      expect(healthy).toBe(true);
    });

    it('should report unhealthy when disconnected', async () => {
      await adapter.disconnect();

      const healthy = await adapter.healthCheck();
      expect(healthy).toBe(false);
    });
  });
});
