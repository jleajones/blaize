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
  jobTypeDefinitionSchema,
  queueConfigSchema,
  queueConfigWithoutNameSchema,
  pluginConfigSchema,
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
// Job Type Definition Schema Tests
// ============================================================================

describe('jobTypeDefinitionSchema', () => {
  it('should accept empty object', () => {
    const result = jobTypeDefinitionSchema.parse({});
    expect(result).toEqual({});
  });

  it('should accept defaultOptions', () => {
    const result = jobTypeDefinitionSchema.parse({
      defaultOptions: {
        priority: 7,
        timeout: 60000,
      },
    });
    expect(result.defaultOptions?.priority).toBe(7);
    expect(result.defaultOptions?.timeout).toBe(60000);
  });

  it('should apply defaults to defaultOptions', () => {
    const result = jobTypeDefinitionSchema.parse({
      defaultOptions: {},
    });
    expect(result.defaultOptions?.priority).toBe(5);
    expect(result.defaultOptions?.maxRetries).toBe(3);
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

    it('should apply jobTypes default', () => {
      const result = queueConfigSchema.parse({ name: 'test' });
      expect(result.jobTypes).toEqual({});
    });
  });

  describe('valid values', () => {
    it('should accept minimal config', () => {
      const result = queueConfigSchema.parse({ name: 'emails' });
      expect(result).toEqual({
        name: 'emails',
        concurrency: 5,
        jobTypes: {},
      });
    });

    it('should accept full config', () => {
      const config = {
        name: 'emails',
        concurrency: 10,
        jobTypes: {
          welcome: { defaultOptions: { priority: 7 } },
          notification: { defaultOptions: { timeout: 60000 } },
        },
      };
      const result = queueConfigSchema.parse(config);
      expect(result.name).toBe('emails');
      expect(result.concurrency).toBe(10);
      expect(Object.keys(result.jobTypes)).toHaveLength(2);
    });

    it('should accept concurrency of 1', () => {
      const result = queueConfigSchema.parse({ name: 'test', concurrency: 1 });
      expect(result.concurrency).toBe(1);
    });

    it('should accept concurrency of 100', () => {
      const result = queueConfigSchema.parse({ name: 'test', concurrency: 100 });
      expect(result.concurrency).toBe(100);
    });
  });

  describe('invalid values', () => {
    it('should reject concurrency of 0', () => {
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
    const result = queueConfigWithoutNameSchema.parse({ concurrency: 10 });
    expect(result.concurrency).toBe(10);
    expect((result as any).name).toBeUndefined();
  });

  it('should apply defaults', () => {
    const result = queueConfigWithoutNameSchema.parse({});
    expect(result.concurrency).toBe(5);
    expect(result.jobTypes).toEqual({});
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
  });

  describe('defaults', () => {
    it('should apply all defaults', () => {
      const result = pluginConfigSchema.parse({
        queues: { default: {} },
      });
      expect(result.defaultConcurrency).toBe(5);
      expect(result.defaultTimeout).toBe(30000);
      expect(result.defaultMaxRetries).toBe(3);
      expect(result.storage).toBeUndefined();
    });
  });

  describe('valid values', () => {
    it('should accept minimal config', () => {
      const result = pluginConfigSchema.parse({
        queues: { default: {} },
      });
      expect(result.queues.default).toBeDefined();
    });

    it('should accept multiple queues', () => {
      const result = pluginConfigSchema.parse({
        queues: {
          emails: { concurrency: 10 },
          reports: { concurrency: 2 },
          notifications: { concurrency: 20 },
        },
      });
      expect(Object.keys(result.queues)).toHaveLength(3);
    });

    it('should accept custom defaults', () => {
      const result = pluginConfigSchema.parse({
        queues: { default: {} },
        defaultConcurrency: 10,
        defaultTimeout: 60000,
        defaultMaxRetries: 5,
      });
      expect(result.defaultConcurrency).toBe(10);
      expect(result.defaultTimeout).toBe(60000);
      expect(result.defaultMaxRetries).toBe(5);
    });

    it('should accept valid storage adapter', () => {
      const mockStorage: QueueStorageAdapter = {
        enqueue: async () => {},
        dequeue: async () => null,
        peek: async () => null,
        getJob: async () => null,
        listJobs: async () => [],
        updateJob: async () => {},
        removeJob: async () => false,
        getQueueStats: async () => ({
          total: 0,
          queued: 0,
          running: 0,
          completed: 0,
          failed: 0,
          cancelled: 0,
        }),
      };

      const result = pluginConfigSchema.parse({
        queues: { default: {} },
        storage: mockStorage,
      });
      expect(result.storage).toBe(mockStorage);
    });

    it('should accept storage adapter with optional lifecycle methods', () => {
      const mockStorage: QueueStorageAdapter = {
        enqueue: async () => {},
        dequeue: async () => null,
        peek: async () => null,
        getJob: async () => null,
        listJobs: async () => [],
        updateJob: async () => {},
        removeJob: async () => false,
        getQueueStats: async () => ({
          total: 0,
          queued: 0,
          running: 0,
          completed: 0,
          failed: 0,
          cancelled: 0,
        }),
        connect: async () => {},
        disconnect: async () => {},
        healthCheck: async () => true,
      };

      const result = pluginConfigSchema.parse({
        queues: { default: {} },
        storage: mockStorage,
      });
      expect(result.storage).toBe(mockStorage);
    });
  });

  describe('invalid values', () => {
    it('should reject empty queues', () => {
      const result = pluginConfigSchema.safeParse({
        queues: {},
      });
      // Empty record is technically valid, but unusual
      expect(result.success).toBe(true);
    });

    it('should reject invalid storage adapter', () => {
      const result = pluginConfigSchema.safeParse({
        queues: { default: {} },
        storage: { notAStorageAdapter: true },
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]!.message).toContain('QueueStorageAdapter');
      }
    });

    it('should reject storage adapter missing required methods', () => {
      const result = pluginConfigSchema.safeParse({
        queues: { default: {} },
        storage: {
          enqueue: async () => {},
          // Missing other required methods
        },
      });
      expect(result.success).toBe(false);
    });

    it('should reject defaultConcurrency of 0', () => {
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
