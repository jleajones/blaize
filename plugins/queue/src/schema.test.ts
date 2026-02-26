/**
 * Unit Tests for Zod Configuration Schemas
 *
 * Tests verify:
 * - Valid configurations pass validation
 * - Invalid configurations fail with descriptive errors
 * - Default values are applied correctly
 * - Type inference works as expected
 */
import {
  jobPrioritySchema,
  jobOptionsSchema,
  queueConfigSchema,
  queueConfigWithoutNameSchema,
  pluginConfigSchema,
  jobStatusEnumSchema,
  jobErrorSchema,
  jobSchema,
  queueStatsSchema,
  queueWithJobsSchema,
  queueStatusResponseSchema,
  jobDetailsResponseSchema,
  createJobResponseSchema,
  cancelJobResponseSchema,
  // EventBus Integration - SSE Event Schemas
  jobSseEnqueuedEventSchema,
  jobSseStartedEventSchema,
  jobSseProgressEventSchema,
  jobSseCompletedEventSchema,
  jobSseFailedEventSchema,
  jobSseCancelledEventSchema,
  jobSseEventSchemas,
  // EventBus Integration - EventBus Schemas
  queueEventBusSchemas,
  // EventBus Integration - Query Schemas
  jobEventsQuerySchema,
  jobEnqueuedEventSchema,
  jobStartedEventSchema,
  jobCancelledEventBusSchema,
  jobCompletedEventBusSchema,
  jobFailedEventBusSchema,
  jobProgressEventBusSchema,
} from './schema';

import type { QueueStorageAdapter } from './types';

// ============================================================================
// Job Priority Schema Tests
// ============================================================================

describe('jobPrioritySchema', () => {
  describe('valid values', () => {
    it('should accept priority 1 (minimum)', () => {
      expect(jobPrioritySchema.parse(1)).toBe(1);
    });

    it('should accept priority 5 (default)', () => {
      expect(jobPrioritySchema.parse(5)).toBe(5);
    });

    it('should accept priority 10 (maximum)', () => {
      expect(jobPrioritySchema.parse(10)).toBe(10);
    });

    it('should accept all values 1-10', () => {
      for (let i = 1; i <= 10; i++) {
        expect(jobPrioritySchema.parse(i)).toBe(i);
      }
    });
  });

  describe('invalid values', () => {
    it('should reject priority 0 (below minimum)', () => {
      const result = jobPrioritySchema.safeParse(0);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]!.message).toContain('at least 1');
      }
    });

    it('should reject priority 11 (above maximum)', () => {
      const result = jobPrioritySchema.safeParse(11);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]!.message).toContain('at most 10');
      }
    });

    it('should reject non-integer values', () => {
      const result = jobPrioritySchema.safeParse(5.5);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]!.message).toContain('integer');
      }
    });

    it('should reject non-number values', () => {
      const result = jobPrioritySchema.safeParse('5');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]!.message).toContain('must be a number');
      }
    });

    it('should reject negative values', () => {
      const result = jobPrioritySchema.safeParse(-1);
      expect(result.success).toBe(false);
    });
  });
});

// ============================================================================
// Job Options Schema Tests
// ============================================================================

describe('jobOptionsSchema', () => {
  describe('defaults', () => {
    it('should apply all defaults for empty object', () => {
      const result = jobOptionsSchema.parse({});
      expect(result).toEqual({
        priority: 5,
        maxRetries: 3,
        timeout: 30000,
        metadata: {},
      });
    });

    it('should apply priority default', () => {
      const result = jobOptionsSchema.parse({ maxRetries: 5 });
      expect(result.priority).toBe(5);
    });

    it('should apply maxRetries default', () => {
      const result = jobOptionsSchema.parse({ priority: 10 });
      expect(result.maxRetries).toBe(3);
    });

    it('should apply timeout default', () => {
      const result = jobOptionsSchema.parse({});
      expect(result.timeout).toBe(30000);
    });

    it('should apply metadata default', () => {
      const result = jobOptionsSchema.parse({});
      expect(result.metadata).toEqual({});
    });
  });

  describe('valid values', () => {
    it('should accept all valid fields', () => {
      const options = {
        priority: 10,
        maxRetries: 5,
        timeout: 60000,
        metadata: { userId: '123', source: 'api' },
      };
      const result = jobOptionsSchema.parse(options);
      expect(result).toEqual(options);
    });

    it('should accept minimum timeout (1 second)', () => {
      const result = jobOptionsSchema.parse({ timeout: 1000 });
      expect(result.timeout).toBe(1000);
    });

    it('should accept maximum timeout (1 hour)', () => {
      const result = jobOptionsSchema.parse({ timeout: 3600000 });
      expect(result.timeout).toBe(3600000);
    });

    it('should accept maxRetries of 0', () => {
      const result = jobOptionsSchema.parse({ maxRetries: 0 });
      expect(result.maxRetries).toBe(0);
    });

    it('should accept maxRetries of 10', () => {
      const result = jobOptionsSchema.parse({ maxRetries: 10 });
      expect(result.maxRetries).toBe(10);
    });

    it('should accept complex metadata', () => {
      const metadata = {
        userId: '123',
        tags: ['important', 'urgent'],
        nested: { key: 'value' },
        count: 42,
        active: true,
      };
      const result = jobOptionsSchema.parse({ metadata });
      expect(result.metadata).toEqual(metadata);
    });
  });

  describe('invalid values', () => {
    it('should reject timeout below minimum', () => {
      const result = jobOptionsSchema.safeParse({ timeout: 999 });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]!.message).toContain('at least 1000ms');
      }
    });

    it('should reject timeout above maximum', () => {
      const result = jobOptionsSchema.safeParse({ timeout: 3600001 });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]!.message).toContain('at most 3600000ms');
      }
    });

    it('should reject maxRetries above 10', () => {
      const result = jobOptionsSchema.safeParse({ maxRetries: 11 });
      expect(result.success).toBe(false);
    });

    it('should reject negative maxRetries', () => {
      const result = jobOptionsSchema.safeParse({ maxRetries: -1 });
      expect(result.success).toBe(false);
    });

    it('should reject non-integer timeout', () => {
      const result = jobOptionsSchema.safeParse({ timeout: 1000.5 });
      expect(result.success).toBe(false);
    });
  });
});

// ============================================================================
// Queue Config Schema Tests
// ============================================================================

describe('queueConfigSchema', () => {
  describe('required fields', () => {
    it('should require name', () => {
      const result = queueConfigSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should reject empty name', () => {
      const result = queueConfigSchema.safeParse({ name: '' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]!.message).toContain('at least 1 character');
      }
    });
  });

  describe('defaults', () => {
    it('should apply concurrency default', () => {
      const result = queueConfigSchema.parse({ name: 'test' });
      expect(result.concurrency).toBe(5);
    });

    it('should apply jobs default', () => {
      const result = queueConfigSchema.parse({ name: 'test' });
      expect(result.jobs).toEqual({});
    });
  });

  describe('valid values', () => {
    it('should accept all valid fields', () => {
      const config = {
        name: 'emails',
        concurrency: 10,
        jobs: {
          welcome: { _type: 'definition', input: {}, output: {}, handler: () => {} },
          notification: { _type: 'definition', input: {}, output: {}, handler: () => {} },
        },
      };
      const result = queueConfigSchema.parse(config);
      expect(result.name).toBe('emails');
      expect(result.concurrency).toBe(10);
      expect(Object.keys(result.jobs)).toEqual(['welcome', 'notification']);
    });

    it('should accept minimum concurrency (1)', () => {
      const result = queueConfigSchema.parse({ name: 'test', concurrency: 1 });
      expect(result.concurrency).toBe(1);
    });

    it('should accept maximum concurrency (100)', () => {
      const result = queueConfigSchema.parse({ name: 'test', concurrency: 100 });
      expect(result.concurrency).toBe(100);
    });

    it('should accept empty jobs', () => {
      const result = queueConfigSchema.parse({ name: 'test', jobs: {} });
      expect(result.jobs).toEqual({});
    });
  });

  describe('invalid values', () => {
    it('should reject concurrency below 1', () => {
      const result = queueConfigSchema.safeParse({ name: 'test', concurrency: 0 });
      expect(result.success).toBe(false);
    });

    it('should reject concurrency above 100', () => {
      const result = queueConfigSchema.safeParse({ name: 'test', concurrency: 101 });
      expect(result.success).toBe(false);
    });

    it('should reject non-integer concurrency', () => {
      const result = queueConfigSchema.safeParse({ name: 'test', concurrency: 5.5 });
      expect(result.success).toBe(false);
    });
  });
});

// ============================================================================
// Queue Config Without Name Schema Tests
// ============================================================================

describe('queueConfigWithoutNameSchema', () => {
  it('should accept config without name', () => {
    const result = queueConfigWithoutNameSchema.parse({
      concurrency: 10,
    });
    expect(result.concurrency).toBe(10);
  });

  it('should apply defaults', () => {
    const result = queueConfigWithoutNameSchema.parse({});
    expect(result.concurrency).toBe(5);
    expect(result.jobs).toEqual({});
  });
});

// ============================================================================
// Plugin Config Schema Tests
// ============================================================================

describe('pluginConfigSchema', () => {
  describe('required fields', () => {
    it('should require queues', () => {
      const result = pluginConfigSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should accept minimal config', () => {
      const result = pluginConfigSchema.parse({
        queues: {
          default: {},
        },
      });
      expect(result.queues).toHaveProperty('default');
    });
  });

  describe('defaults', () => {
    it('should apply all defaults', () => {
      const result = pluginConfigSchema.parse({
        queues: { default: {} },
      });
      expect(result.defaultConcurrency).toBe(5);
      expect(result.defaultTimeout).toBe(30000);
      expect(result.defaultMaxRetries).toBe(3);
    });
  });

  describe('valid values', () => {
    it('should accept full config', () => {
      const mockStorage: QueueStorageAdapter = {
        enqueue: async () => {},
        dequeue: async () => null,
        peek: async () => null,
        getJob: async () => null,
        listJobs: async () => [],
        updateJob: async () => {},
        removeJob: async () => true,
        getQueueStats: async () => ({
          total: 0,
          queued: 0,
          running: 0,
          completed: 0,
          failed: 0,
          cancelled: 0,
        }),
      };

      const config = {
        queues: {
          emails: { concurrency: 10 },
          reports: { concurrency: 2 },
        },
        storage: mockStorage,
        defaultConcurrency: 5,
        defaultTimeout: 30000,
        defaultMaxRetries: 3,
      };
      const result = pluginConfigSchema.parse(config);
      expect(result.queues).toHaveProperty('emails');
      expect(result.queues).toHaveProperty('reports');
    });

    it('should accept multiple queues', () => {
      const result = pluginConfigSchema.parse({
        queues: {
          emails: { concurrency: 10 },
          reports: { concurrency: 2 },
          notifications: {},
        },
      });
      expect(Object.keys(result.queues)).toHaveLength(3);
    });
  });

  describe('invalid values', () => {
    it('should reject defaultConcurrency below 1', () => {
      const result = pluginConfigSchema.safeParse({
        queues: { default: {} },
        defaultConcurrency: 0,
      });
      expect(result.success).toBe(false);
    });

    it('should reject defaultConcurrency above 100', () => {
      const result = pluginConfigSchema.safeParse({
        queues: { default: {} },
        defaultConcurrency: 101,
      });
      expect(result.success).toBe(false);
    });

    it('should reject defaultTimeout below 1000', () => {
      const result = pluginConfigSchema.safeParse({
        queues: { default: {} },
        defaultTimeout: 999,
      });
      expect(result.success).toBe(false);
    });

    it('should reject defaultMaxRetries above 10', () => {
      const result = pluginConfigSchema.safeParse({
        queues: { default: {} },
        defaultMaxRetries: 11,
      });
      expect(result.success).toBe(false);
    });
  });
});

// ============================================================================
// Error Message Quality Tests
// ============================================================================

describe('Error Messages', () => {
  it('should provide descriptive error for invalid priority', () => {
    const result = jobPrioritySchema.safeParse(11);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]!.message).toBe('Priority must be at most 10');
    }
  });

  it('should provide descriptive error for invalid timeout', () => {
    const result = jobOptionsSchema.safeParse({ timeout: 500 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]!.message).toBe('timeout must be at least 1000ms (1 second)');
    }
  });

  it('should provide descriptive error for empty queue name', () => {
    const result = queueConfigSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]!.message).toBe('Queue name must be at least 1 character');
    }
  });

  it('should provide descriptive error for invalid storage adapter', () => {
    const result = pluginConfigSchema.safeParse({
      queues: { default: {} },
      storage: {},
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]!.message).toContain('QueueStorageAdapter');
    }
  });
});

// ============================================================================
// Response Schema Tests (T19)
// ============================================================================

describe('Response Schemas (T19)', () => {
  describe('jobStatusEnumSchema', () => {
    it('should accept valid status values', () => {
      expect(jobStatusEnumSchema.parse('queued')).toBe('queued');
      expect(jobStatusEnumSchema.parse('running')).toBe('running');
      expect(jobStatusEnumSchema.parse('completed')).toBe('completed');
      expect(jobStatusEnumSchema.parse('failed')).toBe('failed');
      expect(jobStatusEnumSchema.parse('cancelled')).toBe('cancelled');
    });

    it('should reject invalid status values', () => {
      const result = jobStatusEnumSchema.safeParse('pending');
      expect(result.success).toBe(false);
    });

    it('should reject non-string values', () => {
      const result = jobStatusEnumSchema.safeParse(123);
      expect(result.success).toBe(false);
    });
  });

  describe('jobErrorSchema', () => {
    it('should accept valid error with message only', () => {
      const result = jobErrorSchema.parse({ message: 'Something went wrong' });
      expect(result.message).toBe('Something went wrong');
      expect(result.code).toBeUndefined();
    });

    it('should accept error with message and code', () => {
      const result = jobErrorSchema.parse({
        message: 'Connection failed',
        code: 'ECONNREFUSED',
      });
      expect(result.message).toBe('Connection failed');
      expect(result.code).toBe('ECONNREFUSED');
    });

    it('should accept error with stack trace', () => {
      const result = jobErrorSchema.parse({
        message: 'Error',
        stack: 'Error\n  at foo.js:1',
      });
      expect(result.stack).toBe('Error\n  at foo.js:1');
    });

    it('should reject missing message', () => {
      const result = jobErrorSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('jobSchema', () => {
    const validJob = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      type: 'send-email',
      queueName: 'emails',
      status: 'completed',
      priority: 5,
      data: { to: 'user@example.com' },
      progress: 1,
      retries: 0,
      maxRetries: 3,
      queuedAt: 1699123456789,
    };

    it('should accept valid job', () => {
      const result = jobSchema.parse(validJob);
      expect(result.id).toBe(validJob.id);
      expect(result.type).toBe(validJob.type);
      expect(result.status).toBe('completed');
    });

    it('should accept job with optional fields', () => {
      const result = jobSchema.parse({
        ...validJob,
        result: { sent: true },
        error: { message: 'Failed attempt 1', code: 'TEMP_ERROR' },
        progressMessage: 'Processing...',
        startedAt: 1699123456800,
        completedAt: 1699123457000,
      });
      expect(result.result).toEqual({ sent: true });
      expect(result.error?.message).toBe('Failed attempt 1');
      expect(result.progressMessage).toBe('Processing...');
    });

    it('should reject invalid UUID', () => {
      const result = jobSchema.safeParse({ ...validJob, id: 'not-a-uuid' });
      expect(result.success).toBe(false);
    });

    it('should reject invalid status', () => {
      const result = jobSchema.safeParse({ ...validJob, status: 'pending' });
      expect(result.success).toBe(false);
    });

    it('should reject invalid priority', () => {
      const result1 = jobSchema.safeParse({ ...validJob, priority: 0 });
      expect(result1.success).toBe(false);

      const result2 = jobSchema.safeParse({ ...validJob, priority: 11 });
      expect(result2.success).toBe(false);
    });

    it('should reject invalid progress', () => {
      const result1 = jobSchema.safeParse({ ...validJob, progress: -1 });
      expect(result1.success).toBe(false);

      const result2 = jobSchema.safeParse({ ...validJob, progress: 101 });
      expect(result2.success).toBe(false);
    });
  });

  describe('queueStatsSchema', () => {
    const validStats = {
      total: 100,
      queued: 10,
      running: 5,
      completed: 80,
      failed: 3,
      cancelled: 2,
    };

    it('should accept valid stats', () => {
      const result = queueStatsSchema.parse(validStats);
      expect(result).toEqual(validStats);
    });

    it('should accept stats with zero values', () => {
      const result = queueStatsSchema.parse({
        total: 0,
        queued: 0,
        running: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
      });
      expect(result.total).toBe(0);
    });

    it('should reject missing required fields', () => {
      const result = queueStatsSchema.safeParse({ total: 100 });
      expect(result.success).toBe(false);
    });

    it('should reject non-number values', () => {
      const result = queueStatsSchema.safeParse({ ...validStats, total: '100' });
      expect(result.success).toBe(false);
    });
  });

  describe('queueWithJobsSchema', () => {
    it('should accept valid queue with jobs', () => {
      const result = queueWithJobsSchema.parse({
        name: 'emails',
        stats: {
          total: 100,
          queued: 10,
          running: 5,
          completed: 80,
          failed: 3,
          cancelled: 2,
        },
        jobs: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            type: 'send-email',
            queueName: 'emails',
            status: 'completed',
            priority: 5,
            data: {},
            retries: 0,
            maxRetries: 3,
            queuedAt: 1699123456789,
          },
        ],
      });
      expect(result.name).toBe('emails');
      expect(result.jobs).toHaveLength(1);
    });

    it('should accept queue with empty jobs array', () => {
      const result = queueWithJobsSchema.parse({
        name: 'empty',
        stats: {
          total: 0,
          queued: 0,
          running: 0,
          completed: 0,
          failed: 0,
          cancelled: 0,
        },
        jobs: [],
      });
      expect(result.jobs).toHaveLength(0);
    });
  });

  describe('queueStatusResponseSchema', () => {
    it('should accept valid response', () => {
      const result = queueStatusResponseSchema.parse({
        queues: [
          {
            name: 'emails',
            stats: {
              total: 100,
              queued: 10,
              running: 5,
              completed: 80,
              failed: 3,
              cancelled: 2,
            },
            jobs: [],
          },
        ],
        timestamp: 1699123456789,
      });
      expect(result.queues).toHaveLength(1);
      expect(result.timestamp).toBe(1699123456789);
    });

    it('should accept response with empty queues', () => {
      const result = queueStatusResponseSchema.parse({
        queues: [],
        timestamp: Date.now(),
      });
      expect(result.queues).toHaveLength(0);
    });

    it('should reject missing timestamp', () => {
      const result = queueStatusResponseSchema.safeParse({
        queues: [],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('jobDetailsResponseSchema', () => {
    const validJob = {
      job: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        type: 'send-email',
        queueName: 'emails',
        status: 'completed',
        priority: 5,
        data: { to: 'user@example.com' },
        retries: 0,
        maxRetries: 3,
        queuedAt: 1699123456789,
      },
      timestamp: 1699123457100,
    };

    it('should accept valid job details', () => {
      const result = jobDetailsResponseSchema.parse(validJob);
      expect(result.job.id).toBe(validJob.job.id);
      expect(result.timestamp).toBe(validJob.timestamp);
    });

    it('should accept details with optional fields', () => {
      const result = jobDetailsResponseSchema.parse({
        job: {
          ...validJob.job,
          progressMessage: 'All done!',
          result: { messageId: 'abc123' },
          startedAt: 1699123456800,
          completedAt: 1699123457000,
        },
        timestamp: validJob.timestamp,
      });
      expect(result.job.progressMessage).toBe('All done!');
      expect(result.job.result).toEqual({ messageId: 'abc123' });
    });

    it('should accept details with error', () => {
      const result = jobDetailsResponseSchema.parse({
        job: {
          ...validJob.job,
          status: 'failed',
          error: { message: 'Connection refused', code: 'ECONNREFUSED' },
        },
        timestamp: validJob.timestamp,
      });
      expect(result.job.error?.message).toBe('Connection refused');
    });

    it('should reject missing required fields', () => {
      const result = jobDetailsResponseSchema.safeParse({
        job: {
          id: validJob.job.id,
          type: validJob.job.type,
          // missing other required fields
        },
      });
      expect(result.success).toBe(false);
    });
  });

  describe('createJobResponseSchema', () => {
    it('should accept valid response', () => {
      const result = createJobResponseSchema.parse({
        jobId: '550e8400-e29b-41d4-a716-446655440000',
        queueName: 'emails',
        jobType: 'send-welcome',
        status: 'queued',
        priority: 5,
        queuedAt: 1699123456789,
      });
      expect(result.jobId).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(result.queueName).toBe('emails');
      expect(result.status).toBe('queued');
    });

    it('should reject invalid UUID for jobId', () => {
      const result = createJobResponseSchema.safeParse({
        jobId: 'not-a-uuid',
        queueName: 'emails',
        jobType: 'send-welcome',
        status: 'queued',
        priority: 5,
        queuedAt: Date.now(),
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing queueName', () => {
      const result = createJobResponseSchema.safeParse({
        jobId: '550e8400-e29b-41d4-a716-446655440000',
        jobType: 'send-welcome',
        status: 'queued',
        priority: 5,
        queuedAt: Date.now(),
      });
      expect(result.success).toBe(false);
    });

    it('should reject status other than queued', () => {
      const result = createJobResponseSchema.safeParse({
        jobId: '550e8400-e29b-41d4-a716-446655440000',
        queueName: 'emails',
        jobType: 'send-welcome',
        status: 'running',
        priority: 5,
        queuedAt: Date.now(),
      });
      expect(result.success).toBe(false);
    });
  });

  describe('cancelJobResponseSchema', () => {
    it('should accept valid response', () => {
      const result = cancelJobResponseSchema.parse({
        jobId: '550e8400-e29b-41d4-a716-446655440000',
        cancelled: true,
        cancelledAt: 1699123456789,
      });
      expect(result.cancelled).toBe(true);
    });

    it('should accept cancelled: false', () => {
      const result = cancelJobResponseSchema.parse({
        jobId: '550e8400-e29b-41d4-a716-446655440000',
        cancelled: false,
        cancelledAt: 1699123456789,
      });
      expect(result.cancelled).toBe(false);
    });

    it('should reject invalid UUID for jobId', () => {
      const result = cancelJobResponseSchema.safeParse({
        jobId: 'not-a-uuid',
        cancelled: true,
        cancelledAt: Date.now(),
      });
      expect(result.success).toBe(false);
    });

    it('should reject non-boolean cancelled', () => {
      const result = cancelJobResponseSchema.safeParse({
        jobId: '550e8400-e29b-41d4-a716-446655440000',
        cancelled: 'true',
        cancelledAt: Date.now(),
      });
      expect(result.success).toBe(false);
    });
  });
});

// ============================================================================
// EventBus Integration - SSE Event Schema Tests
// ============================================================================

describe('EventBus Integration - SSE Event Schemas', () => {
  const timestamp = Date.now();

  describe('jobSseEnqueuedEventSchema', () => {
    it('should accept valid enqueued event with all fields', () => {
      const event = {
        type: 'enqueued',
        jobId: 'job-123',
        queueName: 'emails',
        jobType: 'send-email',
        priority: 5,
        timestamp,
        serverId: 'server-a',
      };
      const result = jobSseEnqueuedEventSchema.parse(event);
      expect(result.type).toBe('enqueued');
      expect(result.jobId).toBe('job-123');
      expect(result.serverId).toBe('server-a');
    });

    it('should accept event without serverId', () => {
      const event = {
        type: 'enqueued',
        jobId: 'job-123',
        queueName: 'emails',
        jobType: 'send-email',
        priority: 5,
        timestamp,
      };
      const result = jobSseEnqueuedEventSchema.parse(event);
      expect(result.serverId).toBeUndefined();
    });

    it('should reject invalid priority', () => {
      const result = jobSseEnqueuedEventSchema.safeParse({
        type: 'enqueued',
        jobId: 'job-123',
        queueName: 'emails',
        jobType: 'send-email',
        priority: 11,
        timestamp,
      });
      expect(result.success).toBe(false);
    });

    it('should reject wrong type literal', () => {
      const result = jobSseEnqueuedEventSchema.safeParse({
        type: 'started',
        jobId: 'job-123',
        queueName: 'emails',
        jobType: 'send-email',
        priority: 5,
        timestamp,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('jobSseStartedEventSchema', () => {
    it('should accept valid started event', () => {
      const event = {
        type: 'started',
        jobId: 'job-123',
        queueName: 'emails',
        jobType: 'send-email',
        timestamp,
        serverId: 'server-a',
      };
      const result = jobSseStartedEventSchema.parse(event);
      expect(result.type).toBe('started');
      expect(result.jobId).toBe('job-123');
    });

    it('should accept event without serverId', () => {
      const event = {
        type: 'started',
        jobId: 'job-123',
        queueName: 'emails',
        jobType: 'send-email',
        timestamp,
      };
      const result = jobSseStartedEventSchema.parse(event);
      expect(result.serverId).toBeUndefined();
    });

    it('should reject missing required fields', () => {
      const result = jobSseStartedEventSchema.safeParse({
        type: 'started',
        jobId: 'job-123',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('jobSseProgressEventSchema', () => {
    it('should accept valid progress event with message', () => {
      const event = {
        type: 'progress',
        jobId: 'job-123',
        queueName: 'emails',
        progress: 0.5,
        message: 'Halfway done',
        timestamp,
        serverId: 'server-a',
      };
      const result = jobSseProgressEventSchema.parse(event);
      expect(result.progress).toBe(0.5);
      expect(result.message).toBe('Halfway done');
    });

    it('should accept progress event without message', () => {
      const event = {
        type: 'progress',
        jobId: 'job-123',
        queueName: 'emails',
        progress: 0.75,
        timestamp,
      };
      const result = jobSseProgressEventSchema.parse(event);
      expect(result.message).toBeUndefined();
    });

    it('should accept progress 0 (start)', () => {
      const event = {
        type: 'progress',
        jobId: 'job-123',
        queueName: 'emails',
        progress: 0,
        timestamp,
      };
      const result = jobSseProgressEventSchema.parse(event);
      expect(result.progress).toBe(0);
    });

    it('should accept progress 1 (complete)', () => {
      const event = {
        type: 'progress',
        jobId: 'job-123',
        queueName: 'emails',
        progress: 1,
        timestamp,
      };
      const result = jobSseProgressEventSchema.parse(event);
      expect(result.progress).toBe(1);
    });

    it('should reject progress below 0', () => {
      const result = jobSseProgressEventSchema.safeParse({
        type: 'progress',
        jobId: 'job-123',
        queueName: 'emails',
        progress: -0.1,
        timestamp,
      });
      expect(result.success).toBe(false);
    });

    it('should reject progress above 1', () => {
      const result = jobSseProgressEventSchema.safeParse({
        type: 'progress',
        jobId: 'job-123',
        queueName: 'emails',
        progress: 1.1,
        timestamp,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('jobSseCompletedEventSchema', () => {
    it('should accept valid completed event with result', () => {
      const event = {
        type: 'completed',
        jobId: 'job-123',
        queueName: 'emails',
        jobType: 'send-email',
        result: { emailsSent: 100, success: true },
        timestamp,
        serverId: 'server-a',
      };
      const result = jobSseCompletedEventSchema.parse(event);
      expect(result.result).toEqual({ emailsSent: 100, success: true });
    });

    it('should accept completed event without result', () => {
      const event = {
        type: 'completed',
        jobId: 'job-123',
        queueName: 'emails',
        jobType: 'send-email',
        timestamp,
      };
      const result = jobSseCompletedEventSchema.parse(event);
      expect(result.result).toBeUndefined();
    });

    it('should accept any result type', () => {
      const results = [{ data: 'string' }, 42, 'plain string', [1, 2, 3], null];

      results.forEach(resultData => {
        const event = {
          type: 'completed',
          jobId: 'job-123',
          queueName: 'emails',
          jobType: 'send-email',
          result: resultData,
          timestamp,
        };
        const parsed = jobSseCompletedEventSchema.parse(event);
        expect(parsed.result).toEqual(resultData);
      });
    });
  });

  describe('jobSseFailedEventSchema', () => {
    it('should accept valid failed event with code', () => {
      const event = {
        type: 'failed',
        jobId: 'job-123',
        queueName: 'emails',
        jobType: 'send-email',
        error: {
          message: 'Connection timeout',
          code: 'ETIMEDOUT',
        },
        timestamp,
        serverId: 'server-a',
      };
      const result = jobSseFailedEventSchema.parse(event);
      expect(result.error.message).toBe('Connection timeout');
      expect(result.error.code).toBe('ETIMEDOUT');
    });

    it('should accept failed event without error code', () => {
      const event = {
        type: 'failed',
        jobId: 'job-123',
        queueName: 'emails',
        jobType: 'send-email',
        error: {
          message: 'Unknown error',
        },
        timestamp,
      };
      const result = jobSseFailedEventSchema.parse(event);
      expect(result.error.code).toBeUndefined();
    });

    it('should reject missing error', () => {
      const result = jobSseFailedEventSchema.safeParse({
        type: 'failed',
        jobId: 'job-123',
        queueName: 'emails',
        jobType: 'send-email',
        timestamp,
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing error message', () => {
      const result = jobSseFailedEventSchema.safeParse({
        type: 'failed',
        jobId: 'job-123',
        queueName: 'emails',
        jobType: 'send-email',
        error: { code: 'ERROR' },
        timestamp,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('jobSseCancelledEventSchema', () => {
    it('should accept valid cancelled event with reason', () => {
      const event = {
        type: 'cancelled',
        jobId: 'job-123',
        queueName: 'emails',
        reason: 'User requested',
        timestamp,
        serverId: 'server-a',
      };
      const result = jobSseCancelledEventSchema.parse(event);
      expect(result.reason).toBe('User requested');
    });

    it('should accept cancelled event without reason', () => {
      const event = {
        type: 'cancelled',
        jobId: 'job-123',
        queueName: 'emails',
        timestamp,
      };
      const result = jobSseCancelledEventSchema.parse(event);
      expect(result.reason).toBeUndefined();
    });

    it('should reject missing required fields', () => {
      const result = jobSseCancelledEventSchema.safeParse({
        type: 'cancelled',
        jobId: 'job-123',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('jobSseEventSchemas', () => {
    it('should contain all SSE event schemas', () => {
      expect(jobSseEventSchemas).toHaveProperty('job.enqueued');
      expect(jobSseEventSchemas).toHaveProperty('job.started');
      expect(jobSseEventSchemas).toHaveProperty('job.progress');
      expect(jobSseEventSchemas).toHaveProperty('job.completed');
      expect(jobSseEventSchemas).toHaveProperty('job.failed');
      expect(jobSseEventSchemas).toHaveProperty('job.cancelled');
    });

    it('should have exactly 6 event schemas', () => {
      expect(Object.keys(jobSseEventSchemas)).toHaveLength(6);
    });

    it('should have correct schema types', () => {
      expect(jobSseEventSchemas['job.enqueued']).toBe(jobSseEnqueuedEventSchema);
      expect(jobSseEventSchemas['job.started']).toBe(jobSseStartedEventSchema);
      expect(jobSseEventSchemas['job.progress']).toBe(jobSseProgressEventSchema);
      expect(jobSseEventSchemas['job.completed']).toBe(jobSseCompletedEventSchema);
      expect(jobSseEventSchemas['job.failed']).toBe(jobSseFailedEventSchema);
      expect(jobSseEventSchemas['job.cancelled']).toBe(jobSseCancelledEventSchema);
    });
  });
});

// ============================================================================
// EventBus Integration - EventBus Event Schema Tests
// ============================================================================

describe('EventBus Integration - EventBus Event Schemas', () => {
  const timestamp = Date.now();

  describe('jobEnqueuedEventSchema', () => {
    it('should accept valid enqueued event', () => {
      const event = {
        jobId: 'job-123',
        queueName: 'emails',
        jobType: 'send-email',
        priority: 5,
        timestamp,
        serverId: 'server-a',
      };
      const result = jobEnqueuedEventSchema.parse(event);
      expect(result.jobId).toBe('job-123');
      expect(result.priority).toBe(5);
    });

    it('should reject invalid priority', () => {
      const result = jobEnqueuedEventSchema.safeParse({
        jobId: 'job-123',
        queueName: 'emails',
        jobType: 'send-email',
        priority: 11,
        timestamp,
        serverId: 'server-a',
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing required fields', () => {
      const result = jobEnqueuedEventSchema.safeParse({
        jobId: 'job-123',
        priority: 5,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('jobStartedEventSchema', () => {
    it('should accept valid started event with attempt', () => {
      const event = {
        jobId: 'job-123',
        queueName: 'emails',
        jobType: 'send-email',
        attempt: 2,
        timestamp,
        serverId: 'server-a',
      };
      const result = jobStartedEventSchema.parse(event);
      expect(result.jobId).toBe('job-123');
      expect(result.attempt).toBe(2);
    });

    it('should accept started event without attempt', () => {
      const event = {
        jobId: 'job-123',
        queueName: 'emails',
        jobType: 'send-email',
        timestamp,
        serverId: 'server-a',
      };
      const result = jobStartedEventSchema.parse(event);
      expect(result.attempt).toBeUndefined();
    });

    it('should reject missing required fields', () => {
      const result = jobStartedEventSchema.safeParse({
        jobId: 'job-123',
        timestamp,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('jobProgressEventBusSchema', () => {
    it('should accept valid progress event with message', () => {
      const event = {
        jobId: 'job-123',
        progress: 0.5,
        message: 'Halfway done',
        timestamp,
      };
      const result = jobProgressEventBusSchema.parse(event);
      expect(result.progress).toBe(0.5);
      expect(result.message).toBe('Halfway done');
    });

    it('should accept progress event without message', () => {
      const event = {
        jobId: 'job-123',
        progress: 0.75,
        timestamp,
      };
      const result = jobProgressEventBusSchema.parse(event);
      expect(result.message).toBeUndefined();
    });

    it('should accept progress 0 (start)', () => {
      const event = {
        jobId: 'job-123',
        progress: 0,
        timestamp,
      };
      const result = jobProgressEventBusSchema.parse(event);
      expect(result.progress).toBe(0);
    });

    it('should accept progress 100 (complete)', () => {
      const event = {
        jobId: 'job-123',
        progress: 1,
        timestamp,
      };
      const result = jobProgressEventBusSchema.parse(event);
      expect(result.progress).toBe(1);
    });

    it('should reject progress below 0', () => {
      const result = jobProgressEventBusSchema.safeParse({
        jobId: 'job-123',
        progress: -1,
        timestamp,
      });
      expect(result.success).toBe(false);
    });

    it('should reject progress above 1', () => {
      const result = jobProgressEventBusSchema.safeParse({
        jobId: 'job-123',
        progress: 1.01,
        timestamp,
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing required fields', () => {
      const result = jobProgressEventBusSchema.safeParse({
        jobId: 'job-123',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('jobCompletedEventBusSchema', () => {
    it('should accept valid completed event with result', () => {
      const event = {
        jobId: 'job-123',
        queueName: 'emails',
        jobType: 'send-email',
        durationMs: 1500,
        result: { emailsSent: 100, success: true },
        timestamp,
        serverId: 'server-a',
      };
      const result = jobCompletedEventBusSchema.parse(event);
      expect(result.result).toEqual({ emailsSent: 100, success: true });
      expect(result.durationMs).toBe(1500);
    });

    it('should accept completed event without result', () => {
      const event = {
        jobId: 'job-123',
        queueName: 'emails',
        jobType: 'send-email',
        timestamp,
        serverId: 'server-a',
      };
      const result = jobCompletedEventBusSchema.parse(event);
      expect(result.result).toBeUndefined();
      expect(result.durationMs).toBeUndefined();
    });

    it('should accept any result type', () => {
      const results = [{ data: 'string' }, 42, 'plain string', [1, 2, 3], null];

      results.forEach(resultData => {
        const event = {
          jobId: 'job-123',
          queueName: 'emails',
          jobType: 'send-email',
          result: resultData,
          timestamp,
          serverId: 'server-a',
        };
        const parsed = jobCompletedEventBusSchema.parse(event);
        expect(parsed.result).toEqual(resultData);
      });
    });

    it('should reject missing required fields', () => {
      const result = jobCompletedEventBusSchema.safeParse({
        jobId: 'job-123',
        timestamp,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('jobFailedEventBusSchema', () => {
    it('should accept valid failed event', () => {
      const event = {
        jobId: 'job-123',
        queueName: 'emails',
        jobType: 'send-email',
        error: 'Connection timeout',
        willRetry: true,
        timestamp,
        serverId: 'server-a',
      };
      const result = jobFailedEventBusSchema.parse(event);
      expect(result.error).toBe('Connection timeout');
      expect(result.willRetry).toBe(true);
    });

    it('should accept willRetry false', () => {
      const event = {
        jobId: 'job-123',
        queueName: 'emails',
        jobType: 'send-email',
        error: 'Fatal error',
        willRetry: false,
        timestamp,
        serverId: 'server-a',
      };
      const result = jobFailedEventBusSchema.parse(event);
      expect(result.willRetry).toBe(false);
    });

    it('should reject missing error', () => {
      const result = jobFailedEventBusSchema.safeParse({
        jobId: 'job-123',
        queueName: 'emails',
        jobType: 'send-email',
        willRetry: true,
        timestamp,
        serverId: 'server-a',
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing willRetry', () => {
      const result = jobFailedEventBusSchema.safeParse({
        jobId: 'job-123',
        queueName: 'emails',
        jobType: 'send-email',
        error: 'Error message',
        timestamp,
        serverId: 'server-a',
      });
      expect(result.success).toBe(false);
    });

    it('should reject non-boolean willRetry', () => {
      const result = jobFailedEventBusSchema.safeParse({
        jobId: 'job-123',
        queueName: 'emails',
        jobType: 'send-email',
        error: 'Error message',
        willRetry: 'true',
        timestamp,
        serverId: 'server-a',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('jobCancelledEventBusSchema', () => {
    it('should accept valid cancelled event with reason', () => {
      const event = {
        jobId: 'job-123',
        queueName: 'emails',
        reason: 'User requested',
        timestamp,
        serverId: 'server-a',
      };
      const result = jobCancelledEventBusSchema.parse(event);
      expect(result.reason).toBe('User requested');
    });

    it('should accept cancelled event without reason', () => {
      const event = {
        jobId: 'job-123',
        queueName: 'emails',
        timestamp,
        serverId: 'server-a',
      };
      const result = jobCancelledEventBusSchema.parse(event);
      expect(result.reason).toBeUndefined();
    });

    it('should reject missing required fields', () => {
      const result = jobCancelledEventBusSchema.safeParse({
        jobId: 'job-123',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('queueEventBusSchemas', () => {
    it('should contain all 6 queue event schemas', () => {
      expect(queueEventBusSchemas).toHaveProperty('queue:job:enqueued');
      expect(queueEventBusSchemas).toHaveProperty('queue:job:started');
      expect(queueEventBusSchemas).toHaveProperty('queue:job:progress');
      expect(queueEventBusSchemas).toHaveProperty('queue:job:completed');
      expect(queueEventBusSchemas).toHaveProperty('queue:job:failed');
      expect(queueEventBusSchemas).toHaveProperty('queue:job:cancelled');
    });

    it('should have exactly 6 event schemas', () => {
      expect(Object.keys(queueEventBusSchemas)).toHaveLength(6);
    });

    it('should have correct schema types', () => {
      expect(queueEventBusSchemas['queue:job:enqueued']).toBe(jobEnqueuedEventSchema);
      expect(queueEventBusSchemas['queue:job:started']).toBe(jobStartedEventSchema);
      expect(queueEventBusSchemas['queue:job:progress']).toBe(jobProgressEventBusSchema);
      expect(queueEventBusSchemas['queue:job:completed']).toBe(jobCompletedEventBusSchema);
      expect(queueEventBusSchemas['queue:job:failed']).toBe(jobFailedEventBusSchema);
      expect(queueEventBusSchemas['queue:job:cancelled']).toBe(jobCancelledEventBusSchema);
    });

    it('should validate enqueued events', () => {
      const schema = queueEventBusSchemas['queue:job:enqueued'];
      const event = {
        jobId: 'job-123',
        queueName: 'emails',
        jobType: 'send-email',
        priority: 5,
        timestamp: Date.now(),
        serverId: 'server-a',
      };
      const result = schema.parse(event);
      expect(result.jobId).toBe('job-123');
    });

    it('should validate started events', () => {
      const schema = queueEventBusSchemas['queue:job:started'];
      const event = {
        jobId: 'job-123',
        queueName: 'emails',
        jobType: 'send-email',
        timestamp: Date.now(),
        serverId: 'server-a',
      };
      const result = schema.parse(event);
      expect(result.jobId).toBe('job-123');
    });

    it('should validate progress events', () => {
      const schema = queueEventBusSchemas['queue:job:progress'];
      const event = {
        jobId: 'job-123',
        progress: 0.5,
        message: 'Working on it',
        timestamp: Date.now(),
      };
      const result = schema.parse(event);
      expect(result.progress).toBe(0.5);
    });

    it('should validate completed events', () => {
      const schema = queueEventBusSchemas['queue:job:completed'];
      const event = {
        jobId: 'job-123',
        queueName: 'emails',
        jobType: 'send-email',
        result: { success: true },
        timestamp: Date.now(),
        serverId: 'server-a',
      };
      const result = schema.parse(event);
      expect(result.result).toEqual({ success: true });
    });

    it('should validate failed events', () => {
      const schema = queueEventBusSchemas['queue:job:failed'];
      const event = {
        jobId: 'job-123',
        queueName: 'emails',
        jobType: 'send-email',
        error: 'Failed',
        willRetry: false,
        timestamp: Date.now(),
        serverId: 'server-a',
      };
      const result = schema.parse(event);
      expect(result.error).toBe('Failed');
    });

    it('should validate cancelled events', () => {
      const schema = queueEventBusSchemas['queue:job:cancelled'];
      const event = {
        jobId: 'job-123',
        queueName: 'emails',
        reason: 'User cancelled',
        timestamp: Date.now(),
        serverId: 'server-a',
      };
      const result = schema.parse(event);
      expect(result.reason).toBe('User cancelled');
    });
  });
});

// ============================================================================
// EventBus Integration - Query Schema Tests
// ============================================================================

describe('EventBus Integration - Query Schemas', () => {
  describe('jobEventsQuerySchema', () => {
    it('should accept query with all fields', () => {
      const query = {
        jobId: 'job-123',
        queueName: 'emails',
        jobType: 'send-email',
      };
      const result = jobEventsQuerySchema.parse(query);
      expect(result).toEqual(query);
    });

    it('should accept query with only jobId', () => {
      const query = { jobId: 'job-123' };
      const result = jobEventsQuerySchema.parse(query);
      expect(result.jobId).toBe('job-123');
      expect(result.queueName).toBeUndefined();
      expect(result.jobType).toBeUndefined();
    });

    it('should accept query with only queueName', () => {
      const query = { queueName: 'emails' };
      const result = jobEventsQuerySchema.parse(query);
      expect(result.queueName).toBe('emails');
      expect(result.jobId).toBeUndefined();
    });

    it('should accept query with only jobType', () => {
      const query = { jobType: 'send-email' };
      const result = jobEventsQuerySchema.parse(query);
      expect(result.jobType).toBe('send-email');
    });

    it('should accept empty query', () => {
      const result = jobEventsQuerySchema.parse({});
      expect(result.jobId).toBeUndefined();
      expect(result.queueName).toBeUndefined();
      expect(result.jobType).toBeUndefined();
    });

    it('should accept jobId and queueName combination', () => {
      const query = {
        jobId: 'job-123',
        queueName: 'emails',
      };
      const result = jobEventsQuerySchema.parse(query);
      expect(result.jobId).toBe('job-123');
      expect(result.queueName).toBe('emails');
    });

    it('should accept queueName and jobType combination', () => {
      const query = {
        queueName: 'emails',
        jobType: 'send-email',
      };
      const result = jobEventsQuerySchema.parse(query);
      expect(result.queueName).toBe('emails');
      expect(result.jobType).toBe('send-email');
    });

    it('should reject non-string values', () => {
      const result1 = jobEventsQuerySchema.safeParse({ jobId: 123 });
      expect(result1.success).toBe(false);

      const result2 = jobEventsQuerySchema.safeParse({ queueName: 456 });
      expect(result2.success).toBe(false);

      const result3 = jobEventsQuerySchema.safeParse({ jobType: true });
      expect(result3.success).toBe(false);
    });
  });
});
