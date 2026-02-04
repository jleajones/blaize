/**
 * Integration Tests for Advanced Template (T2.9)
 *
 * These tests are INCLUDED in the template to teach users:
 * - How to test BlaizeJS routes
 * - How to use testing-utils helpers
 * - Integration testing with Redis
 * - Mocking strategies
 * - Coverage best practices
 *
 * Contains:
 * - src/__tests__/setup.ts - Test setup and global config
 * - src/__tests__/routes/*.test.ts - Route unit tests with mocks
 * - src/__tests__/integration/*.test.ts - Integration tests with Redis
 */

import type { TemplateFile } from '@/types';

export const integrationTests: TemplateFile[] = [
  // ==========================================================================
  // TEST SETUP - Global test configuration
  // ==========================================================================
  {
    path: 'src/__tests__/setup.ts',
    content: `/**
 * Test Setup
 * 
 * Global configuration for all tests.
 * This file runs before any tests execute.
 */

import { beforeAll, afterAll } from 'vitest';

// Global test timeout (for slow integration tests)
beforeAll(() => {
  console.log('🧪 Starting test suite...');
});

afterAll(() => {
  console.log('✅ Test suite complete');
});

// Export test helpers
export const TEST_TIMEOUT = 10000; // 10 seconds

/**
 * Wait for a condition to be true
 * Useful for async operations in tests
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout = 5000
): Promise<void> {
  const start = Date.now();
  
  while (!(await condition())) {
    if (Date.now() - start > timeout) {
      throw new Error(\`Timeout waiting for condition after \${timeout}ms\`);
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}
`,
  },

  // ==========================================================================
  // HEALTH ROUTE TESTS - Simple unit test example
  // ==========================================================================
  {
    path: 'src/__tests__/routes/health.test.ts',
    content: `/**
 * Health Route Tests
 * 
 * Demonstrates:
 * - Basic route testing
 * - Using createRouteTestContext()
 * - Mocking services
 * - Schema validation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createRouteTestContext } from '@blaizejs/testing-utils';
import { getHealth } from '../../routes/health';

describe('GET /health', () => {
  let context: ReturnType<typeof createRouteTestContext>;

  beforeEach(() => {
    context = createRouteTestContext();
  });

  it('should return healthy status when all services are up', async () => {
    // Mock cache health check to return healthy
    const mockCache = {
      healthCheck: async () => ({ healthy: true, details: { latency: 5 } }),
    };

    const result = await getHealth.handler({
      ctx: {
        services: {
          cache: mockCache,
          queue: {},
        },
      } as any,
      logger: context.logger,
    });

    expect(result.status).toBe('healthy');
    expect(result.checks.redis.status).toBe('up');
    expect(result.checks.cache.status).toBe('connected');
  });

  it('should return degraded status when Redis is down', async () => {
    // Mock cache health check to return unhealthy
    const mockCache = {
      healthCheck: async () => ({ healthy: false }),
    };

    const result = await getHealth.handler({
      ctx: {
        services: {
          cache: mockCache,
          queue: {},
        },
      } as any,
      logger: context.logger,
    });

    expect(result.status).toBe('degraded');
    expect(result.checks.redis.status).toBe('down');
  });

  it('should return unhealthy status on error', async () => {
    // Mock cache to throw error
    const mockCache = {
      healthCheck: async () => {
        throw new Error('Connection failed');
      },
    };

    const result = await getHealth.handler({
      ctx: {
        services: {
          cache: mockCache,
          queue: {},
        },
      } as any,
      logger: context.logger,
    });

    expect(result.status).toBe('unhealthy');
    expect(result.checks.redis.status).toBe('down');
  });

  it('should include uptime in response', async () => {
    const mockCache = {
      healthCheck: async () => ({ healthy: true }),
    };

    const result = await getHealth.handler({
      ctx: {
        services: {
          cache: mockCache,
          queue: {},
        },
      } as any,
      logger: context.logger,
    });

    expect(result.uptime).toBeGreaterThan(0);
    expect(typeof result.timestamp).toBe('number');
  });
});
`,
  },

  // ==========================================================================
  // QUEUE DEMO ROUTE TESTS - Complex mocking example
  // ==========================================================================
  {
    path: 'src/__tests__/routes/queue-demo.test.ts',
    content: `/**
 * Queue Demo Route Tests
 * 
 * Demonstrates:
 * - Mocking complex services (QueueService)
 * - Testing job creation
 * - Verifying service calls
 * - Query parameter handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRouteTestContext } from '@blaizejs/testing-utils';
import { getQueueDemo } from '../../routes/queue/demo';

describe('GET /queue/demo', () => {
  let context: ReturnType<typeof createRouteTestContext>;
  let mockQueue: any;

  beforeEach(() => {
    context = createRouteTestContext();
    
    // Mock QueueService
    mockQueue = {
      add: vi.fn().mockImplementation(() => {
        return \`job_\${Date.now()}_\${Math.random().toString(36).slice(2, 8)}\`;
      }),
    };
  });

  it('should create demo jobs', async () => {
    const result = await getQueueDemo.handler({
      ctx: {
        request: {
          query: {
            includeUnreliable: 'false',
            includeLongRunning: 'true',
          },
        },
        services: {
          queue: mockQueue,
        },
      } as any,
      logger: context.logger,
    });

    expect(result.jobCount).toBeGreaterThan(0);
    expect(result.jobs).toBeInstanceOf(Array);
    expect(mockQueue.add).toHaveBeenCalled();
  });

  it('should create email jobs', async () => {
    await getQueueDemo.handler({
      ctx: {
        request: {
          query: {
            includeUnreliable: 'false',
            includeLongRunning: 'false',
          },
        },
        services: {
          queue: mockQueue,
        },
      } as any,
      logger: context.logger,
    });

    // Verify email jobs were created
    const emailCalls = mockQueue.add.mock.calls.filter(
      (call: any[]) => call[0] === 'emails'
    );
    
    expect(emailCalls.length).toBeGreaterThan(0);
  });

  it('should include long-running jobs when requested', async () => {
    const result = await getQueueDemo.handler({
      ctx: {
        request: {
          query: {
            includeUnreliable: 'false',
            includeLongRunning: 'true',
          },
        },
        services: {
          queue: mockQueue,
        },
      } as any,
      logger: context.logger,
    });

    const longJobs = result.jobs.filter((j: any) => j.queue === 'longRunning');
    expect(longJobs.length).toBeGreaterThan(0);
  });

  it('should exclude long-running jobs when not requested', async () => {
    const result = await getQueueDemo.handler({
      ctx: {
        request: {
          query: {
            includeUnreliable: 'false',
            includeLongRunning: 'false',
          },
        },
        services: {
          queue: mockQueue,
        },
      } as any,
      logger: context.logger,
    });

    const longJobs = result.jobs.filter((j: any) => j.queue === 'longRunning');
    expect(longJobs.length).toBe(0);
  });

  it('should provide helpful links in response', async () => {
    const result = await getQueueDemo.handler({
      ctx: {
        request: {
          query: {
            includeUnreliable: 'false',
            includeLongRunning: 'true',
          },
        },
        services: {
          queue: mockQueue,
        },
      } as any,
      logger: context.logger,
    });

    expect(result.links.dashboard).toBeDefined();
    expect(result.links.status).toBeDefined();
    expect(result.tips).toBeInstanceOf(Array);
    expect(result.tips.length).toBeGreaterThan(0);
  });

  it('should log job creation', async () => {
    await getQueueDemo.handler({
      ctx: {
        request: {
          query: {
            includeUnreliable: 'false',
            includeLongRunning: 'false',
          },
        },
        services: {
          queue: mockQueue,
        },
      } as any,
      logger: context.logger,
    });

    // Verify logging occurred
    context.logger.assertInfoCalled('Creating demo jobs');
    context.logger.assertInfoCalled('Demo jobs created');
  });
});
`,
  },

  // ==========================================================================
  // CACHE DEMO ROUTE TESTS - Cache service mocking
  // ==========================================================================
  {
    path: 'src/__tests__/routes/cache-demo.test.ts',
    content: `/**
 * Cache Demo Route Tests
 * 
 * Demonstrates:
 * - Mocking CacheService
 * - Testing cache operations
 * - Query parameter handling
 * - Response validation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRouteTestContext } from '@blaizejs/testing-utils';
import { getCacheDemo, deleteCacheDemo } from '../../routes/cache/demo';

describe('GET /cache/demo', () => {
  let context: ReturnType<typeof createRouteTestContext>;
  let mockCache: any;

  beforeEach(() => {
    context = createRouteTestContext();
    
    // Mock CacheService
    mockCache = {
      set: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue(null),
      clear: vi.fn().mockResolvedValue(0),
    };
  });

  it('should create cache entries', async () => {
    const result = await getCacheDemo.handler({
      ctx: {
        request: {
          query: {
            includeUsers: 'true',
            includeSessions: 'true',
            includeConfig: 'true',
            includeApiKeys: 'true',
          },
        },
        services: {
          cache: mockCache,
        },
      } as any,
      logger: context.logger,
    });

    expect(result.operationCount).toBeGreaterThan(0);
    expect(result.operations).toBeInstanceOf(Array);
    expect(mockCache.set).toHaveBeenCalled();
  });

  it('should cache users when included', async () => {
    await getCacheDemo.handler({
      ctx: {
        request: {
          query: {
            includeUsers: 'true',
            includeSessions: 'false',
            includeConfig: 'false',
            includeApiKeys: 'false',
          },
        },
        services: {
          cache: mockCache,
        },
      } as any,
      logger: context.logger,
    });

    const userCalls = mockCache.set.mock.calls.filter((call: any[]) =>
      call[0].startsWith('user:')
    );
    
    expect(userCalls.length).toBeGreaterThan(0);
  });

  it('should set TTL for sessions', async () => {
    await getCacheDemo.handler({
      ctx: {
        request: {
          query: {
            includeUsers: 'false',
            includeSessions: 'true',
            includeConfig: 'false',
            includeApiKeys: 'false',
          },
        },
        services: {
          cache: mockCache,
        },
      } as any,
      logger: context.logger,
    });

    // Find session cache calls
    const sessionCalls = mockCache.set.mock.calls.filter((call: any[]) =>
      call[0].startsWith('session:')
    );
    
    expect(sessionCalls.length).toBeGreaterThan(0);
    
    // Verify TTL is set (third parameter)
    sessionCalls.forEach((call: any[]) => {
      expect(call[2]).toBeGreaterThan(0); // TTL should be positive
    });
  });

  it('should provide helpful links and tips', async () => {
    const result = await getCacheDemo.handler({
      ctx: {
        request: {
          query: {},
        },
        services: {
          cache: mockCache,
        },
      } as any,
      logger: context.logger,
    });

    expect(result.links.sseStream).toBeDefined();
    expect(result.links.sseFiltered).toBeDefined();
    expect(result.tips).toBeInstanceOf(Array);
    expect(result.tips.length).toBeGreaterThan(0);
  });
});

describe('DELETE /cache/demo', () => {
  let context: ReturnType<typeof createRouteTestContext>;
  let mockCache: any;

  beforeEach(() => {
    context = createRouteTestContext();
    
    mockCache = {
      clear: vi.fn().mockResolvedValue(5), // 5 entries deleted
    };
  });

  it('should clear cache entries', async () => {
    const result = await deleteCacheDemo.handler({
      ctx: {
        request: {
          query: {
            pattern: 'session:*',
          },
        },
        services: {
          cache: mockCache,
        },
      } as any,
      logger: context.logger,
    });

    expect(result.deletedCount).toBe(5);
    expect(mockCache.clear).toHaveBeenCalledWith('session:*');
  });

  it('should use default pattern if not provided', async () => {
    await deleteCacheDemo.handler({
      ctx: {
        request: {
          query: {},
        },
        services: {
          cache: mockCache,
        },
      } as any,
      logger: context.logger,
    });

    expect(mockCache.clear).toHaveBeenCalledWith('*');
  });

  it('should log clear operation', async () => {
    await deleteCacheDemo.handler({
      ctx: {
        request: {
          query: { pattern: 'user:*' },
        },
        services: {
          cache: mockCache,
        },
      } as any,
      logger: context.logger,
    });

    context.logger.assertInfoCalled('Clearing cache');
    context.logger.assertInfoCalled('Cache cleared');
  });
});
`,
  },

  // ==========================================================================
  // USER SIGNUP TESTS - Complex integration example
  // ==========================================================================
  {
    path: 'src/__tests__/routes/user-signup.test.ts',
    content: `/**
 * User Signup Route Tests
 * 
 * Demonstrates:
 * - Testing routes that use multiple services
 * - Mocking Queue, Cache, and EventBus together
 * - Verifying service integrations
 * - Testing error conditions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRouteTestContext } from '@blaizejs/testing-utils';
import { postUserSignup } from '../../routes/user/signup';

// Mock the user data module
vi.mock('../../data/users', () => ({
  emailExists: vi.fn(() => false),
  createUser: vi.fn((data) => ({
    id: 'user_123',
    name: data.name,
    email: data.email,
    avatar: data.avatar,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })),
}));

import { emailExists, createUser } from '../../data/users';

describe('POST /user/signup', () => {
  let context: ReturnType<typeof createRouteTestContext>;
  let mockQueue: any;
  let mockCache: any;

  beforeEach(() => {
    context = createRouteTestContext();
    
    // Reset mocks
    vi.clearAllMocks();
    (emailExists as any).mockReturnValue(false);
    
    // Mock QueueService
    mockQueue = {
      add: vi.fn().mockImplementation(() => \`job_\${Date.now()}\`),
    };
    
    // Mock CacheService
    mockCache = {
      set: vi.fn().mockResolvedValue(undefined),
    };
  });

  it('should create user and queue jobs', async () => {
    const result = await postUserSignup.handler({
      ctx: {
        request: {
          body: {
            name: 'Alice Johnson',
            email: 'alice@example.com',
          },
        },
        services: {
          queue: mockQueue,
          cache: mockCache,
        },
      } as any,
      logger: context.logger,
      eventBus: context.eventBus,
    });

    expect(result.user.name).toBe('Alice Johnson');
    expect(result.user.email).toBe('alice@example.com');
    expect(result.jobs.emailJobId).toBeDefined();
  });

  it('should publish user:created event', async () => {
    await postUserSignup.handler({
      ctx: {
        request: {
          body: {
            name: 'Bob Smith',
            email: 'bob@example.com',
          },
        },
        services: {
          queue: mockQueue,
          cache: mockCache,
        },
      } as any,
      logger: context.logger,
      eventBus: context.eventBus,
    });

    // Verify event was published
    context.eventBus.assertPublished('user:created', {
      email: 'bob@example.com',
    });
  });

  it('should cache user data', async () => {
    await postUserSignup.handler({
      ctx: {
        request: {
          body: {
            name: 'Carol White',
            email: 'carol@example.com',
          },
        },
        services: {
          queue: mockQueue,
          cache: mockCache,
        },
      } as any,
      logger: context.logger,
      eventBus: context.eventBus,
    });

    // Verify cache was called with user data and TTL
    expect(mockCache.set).toHaveBeenCalled();
    const cacheCall = mockCache.set.mock.calls[0];
    expect(cacheCall[0]).toMatch(/^user:/); // Key starts with user:
    expect(cacheCall[2]).toBe(1800); // 30 minute TTL
  });

  it('should queue welcome email', async () => {
    await postUserSignup.handler({
      ctx: {
        request: {
          body: {
            name: 'David Lee',
            email: 'david@example.com',
          },
        },
        services: {
          queue: mockQueue,
          cache: mockCache,
        },
      } as any,
      logger: context.logger,
      eventBus: context.eventBus,
    });

    // Verify email job was queued
    const emailCalls = mockQueue.add.mock.calls.filter(
      (call: any[]) => call[0] === 'emails' && call[1] === 'send'
    );
    
    expect(emailCalls.length).toBe(1);
    expect(emailCalls[0][2].to).toBe('david@example.com');
    expect(emailCalls[0][2].subject).toContain('Welcome');
  });

  it('should queue avatar processing when avatar provided', async () => {
    const result = await postUserSignup.handler({
      ctx: {
        request: {
          body: {
            name: 'Eve Brown',
            email: 'eve@example.com',
            avatar: 'https://example.com/avatar.jpg',
          },
        },
        services: {
          queue: mockQueue,
          cache: mockCache,
        },
      } as any,
      logger: context.logger,
      eventBus: context.eventBus,
    });

    expect(result.jobs.avatarJobId).toBeDefined();
    
    // Verify avatar job was queued
    const avatarCalls = mockQueue.add.mock.calls.filter(
      (call: any[]) => call[0] === 'processing' && call[1] === 'image'
    );
    
    expect(avatarCalls.length).toBe(1);
  });

  it('should not queue avatar processing without avatar', async () => {
    const result = await postUserSignup.handler({
      ctx: {
        request: {
          body: {
            name: 'Frank Green',
            email: 'frank@example.com',
          },
        },
        services: {
          queue: mockQueue,
          cache: mockCache,
        },
      } as any,
      logger: context.logger,
      eventBus: context.eventBus,
    });

    expect(result.jobs.avatarJobId).toBeUndefined();
  });

  it('should throw error if email already exists', async () => {
    // Mock email exists
    (emailExists as any).mockReturnValue(true);

    await expect(
      postUserSignup.handler({
        ctx: {
          request: {
            body: {
              name: 'Grace Taylor',
              email: 'existing@example.com',
            },
          },
          services: {
            queue: mockQueue,
            cache: mockCache,
          },
        } as any,
        logger: context.logger,
        eventBus: context.eventBus,
      })
    ).rejects.toThrow('Email already registered');
  });

  it('should provide next steps in response', async () => {
    const result = await postUserSignup.handler({
      ctx: {
        request: {
          body: {
            name: 'Henry Wilson',
            email: 'henry@example.com',
          },
        },
        services: {
          queue: mockQueue,
          cache: mockCache,
        },
      } as any,
      logger: context.logger,
      eventBus: context.eventBus,
    });

    expect(result.nextSteps).toBeInstanceOf(Array);
    expect(result.nextSteps.length).toBeGreaterThan(0);
    expect(result.message).toContain('success');
  });

  it('should log signup process', async () => {
    await postUserSignup.handler({
      ctx: {
        request: {
          body: {
            name: 'Iris Martinez',
            email: 'iris@example.com',
          },
        },
        services: {
          queue: mockQueue,
          cache: mockCache,
        },
      } as any,
      logger: context.logger,
      eventBus: context.eventBus,
    });

    context.logger.assertInfoCalled('User signup initiated');
    context.logger.assertInfoCalled('User created');
    context.logger.assertInfoCalled('User cached');
    context.logger.assertInfoCalled('Welcome email queued');
  });
});
`,
  },

  // ==========================================================================
  // REDIS INTEGRATION TESTS - Real Redis testing
  // ==========================================================================
  {
    path: 'src/__tests__/integration/redis.test.ts',
    content: `/**
 * Redis Integration Tests
 * 
 * These tests require Redis to be running.
 * Start Redis with: docker compose up -d
 * 
 * Demonstrates:
 * - Testing with real Redis
 * - Cache adapter integration
 * - Event adapter integration
 * - Cleanup patterns
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Redis from 'ioredis';
import { RedisCacheAdapter } from '@blaizejs/adapter-redis';
import { RedisEventBusAdapter } from '@blaizejs/adapter-redis';
import { Blaize } from 'blaizejs';
import { REDIS_CONFIG } from '../../config';

describe('Redis Integration', () => {
  let redis: Redis;
  let cacheAdapter: RedisCacheAdapter;
  let eventBusAdapter: RedisEventBusAdapter;

  beforeAll(async () => {
    // Connect to Redis
    redis = new Redis({
      ...REDIS_CONFIG,
      db: 15, // Use separate database for tests
    });

    // Create adapters
    cacheAdapter = new RedisCacheAdapter(redis, {
      keyPrefix: 'test:cache:',
      logger: Blaize.logger,
    });

    eventBusAdapter = new RedisEventBusAdapter(redis, {
      channelPrefix: 'test:events',
      logger: Blaize.logger,
    });

    await eventBusAdapter.connect();
  });

  afterAll(async () => {
    // Cleanup
    await eventBusAdapter.disconnect();
    await redis.quit();
  });

  beforeEach(async () => {
    // Clear test database
    await redis.flushdb();
  });

  describe('Cache Adapter', () => {
    it('should set and get values', async () => {
      await cacheAdapter.set('test-key', 'test-value');
      
      const result = await cacheAdapter.get('test-key');
      
      expect(result).toBe('test-value');
    });

    it('should respect TTL', async () => {
      await cacheAdapter.set('ttl-key', 'ttl-value', 1); // 1 second TTL
      
      const immediate = await cacheAdapter.get('ttl-key');
      expect(immediate).toBe('ttl-value');
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      const expired = await cacheAdapter.get('ttl-key');
      expect(expired).toBeNull();
    });

    it('should delete values', async () => {
      await cacheAdapter.set('delete-key', 'delete-value');
      await cacheAdapter.delete('delete-key');
      
      const result = await cacheAdapter.get('delete-key');
      expect(result).toBeNull();
    });

    it('should clear by pattern', async () => {
      await cacheAdapter.set('user:1', 'alice');
      await cacheAdapter.set('user:2', 'bob');
      await cacheAdapter.set('session:1', 'session-data');
      
      const cleared = await cacheAdapter.clear('user:*');
      expect(cleared).toBe(2);
      
      const user1 = await cacheAdapter.get('user:1');
      const session1 = await cacheAdapter.get('session:1');
      
      expect(user1).toBeNull();
      expect(session1).toBe('session-data');
    });

    it('should perform health check', async () => {
      const health = await cacheAdapter.healthCheck();
      
      expect(health.healthy).toBe(true);
      expect(health.details?.latency).toBeGreaterThan(0);
    });
  });

  describe('EventBus Adapter', () => {
    it('should publish and receive events', async () => {
      const events: any[] = [];
      
      // Subscribe
      const unsubscribe = eventBusAdapter.subscribe('test:event', (event) => {
        events.push(event);
      });
      
      // Wait for subscription to be ready
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Publish
      await eventBusAdapter.publish('test:event', {
        message: 'Hello from test',
        timestamp: Date.now(),
      });
      
      // Wait for event to be received
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(events.length).toBe(1);
      expect(events[0].type).toBe('test:event');
      expect(events[0].data.message).toBe('Hello from test');
      
      unsubscribe();
    });

    it('should support wildcard subscriptions', async () => {
      const events: any[] = [];
      
      const unsubscribe = eventBusAdapter.subscribe('user:*', (event) => {
        events.push(event);
      });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      await eventBusAdapter.publish('user:created', { userId: '123' });
      await eventBusAdapter.publish('user:updated', { userId: '123' });
      await eventBusAdapter.publish('order:placed', { orderId: '456' });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(events.length).toBe(2); // Only user events
      expect(events[0].type).toBe('user:created');
      expect(events[1].type).toBe('user:updated');
      
      unsubscribe();
    });

    it('should handle multiple subscribers', async () => {
      const events1: any[] = [];
      const events2: any[] = [];
      
      const unsub1 = eventBusAdapter.subscribe('test:multi', (e) => events1.push(e));
      const unsub2 = eventBusAdapter.subscribe('test:multi', (e) => events2.push(e));
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      await eventBusAdapter.publish('test:multi', { data: 'test' });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(events1.length).toBe(1);
      expect(events2.length).toBe(1);
      
      unsub1();
      unsub2();
    });

    it('should unsubscribe correctly', async () => {
      const events: any[] = [];
      
      const unsubscribe = eventBusAdapter.subscribe('test:unsub', (e) => events.push(e));
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      await eventBusAdapter.publish('test:unsub', { count: 1 });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      unsubscribe();
      
      await eventBusAdapter.publish('test:unsub', { count: 2 });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(events.length).toBe(1); // Only first event received
    });
  });

  describe('Combined Cache + EventBus', () => {
    it('should work together in realistic scenario', async () => {
      const notifications: any[] = [];
      
      // Subscribe to cache events
      const unsubscribe = eventBusAdapter.subscribe('cache:*', (event) => {
        notifications.push(event);
      });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Perform cache operations that trigger events
      await cacheAdapter.set('user:123', 'Alice');
      await eventBusAdapter.publish('cache:set', {
        key: 'user:123',
        timestamp: Date.now(),
      });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(notifications.length).toBeGreaterThan(0);
      
      unsubscribe();
    });
  });
});
`,
  },

  // ==========================================================================
  // QUEUE PROCESSING INTEGRATION TESTS
  // ==========================================================================
  {
    path: 'src/__tests__/integration/queue-processing.test.ts',
    content: `/**
 * Queue Processing Integration Tests
 * 
 * Requires Redis running: docker compose up -d
 * 
 * Demonstrates:
 * - Testing queue job execution
 * - Waiting for async job completion
 * - Testing handlers
 * - Integration with Redis queue adapter
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Redis from 'ioredis';
import { RedisQueueAdapter } from '@blaizejs/adapter-redis';
import { Blaize } from 'blaizejs';
import { REDIS_CONFIG } from '../../config';
import { sendEmailHandler } from '../../handlers/email';
import { waitFor } from '../setup';

describe('Queue Processing Integration', () => {
  let redis: Redis;
  let queueAdapter: RedisQueueAdapter;

  beforeAll(async () => {
    redis = new Redis({
      ...REDIS_CONFIG,
      db: 15, // Separate test database
    });

    queueAdapter = new RedisQueueAdapter(redis, {
      keyPrefix: 'test:queue:',
      logger: Blaize.logger,
    });
  });

  afterAll(async () => {
    await redis.quit();
  });

  beforeEach(async () => {
    // Clear test database
    await redis.flushdb();
  });

  it('should add job to queue', async () => {
    const jobId = await queueAdapter.add('emails', {
      handlerName: 'send',
      data: {
        to: 'test@example.com',
        subject: 'Test',
        body: 'Test email',
      },
      priority: 5,
    });

    expect(jobId).toBeDefined();
    expect(typeof jobId).toBe('string');
  });

  it('should fetch job from queue', async () => {
    // Add job
    const jobId = await queueAdapter.add('emails', {
      handlerName: 'send',
      data: {
        to: 'test@example.com',
        subject: 'Test',
        body: 'Test email',
      },
      priority: 5,
    });

    // Fetch job
    const job = await queueAdapter.fetch('emails');

    expect(job).toBeDefined();
    expect(job?.id).toBe(jobId);
    expect(job?.data.to).toBe('test@example.com');
  });

  it('should mark job as completed', async () => {
    const jobId = await queueAdapter.add('emails', {
      handlerName: 'send',
      data: { to: 'test@example.com', subject: 'Test', body: 'Test' },
      priority: 5,
    });

    const job = await queueAdapter.fetch('emails');
    expect(job).toBeDefined();

    await queueAdapter.complete(jobId, { messageId: 'msg-123', sentAt: Date.now() });

    const status = await queueAdapter.getJob(jobId);
    expect(status?.status).toBe('completed');
  });

  it('should handle job failures', async () => {
    const jobId = await queueAdapter.add('emails', {
      handlerName: 'send',
      data: { to: 'test@example.com', subject: 'Test', body: 'Test' },
      priority: 5,
    });

    await queueAdapter.fail(jobId, new Error('Test failure'));

    const status = await queueAdapter.getJob(jobId);
    expect(status?.status).toBe('failed');
    expect(status?.error).toContain('Test failure');
  });

  it('should respect priority ordering', async () => {
    // Add jobs with different priorities
    await queueAdapter.add('emails', {
      handlerName: 'send',
      data: { to: 'low@example.com', subject: 'Low', body: 'Low' },
      priority: 1,
    });

    await queueAdapter.add('emails', {
      handlerName: 'send',
      data: { to: 'high@example.com', subject: 'High', body: 'High' },
      priority: 9,
    });

    // Fetch should get high priority first
    const job = await queueAdapter.fetch('emails');
    expect(job?.data.to).toBe('high@example.com');
  });

  it('should handle concurrent job fetching', async () => {
    // Add multiple jobs
    await queueAdapter.add('emails', {
      handlerName: 'send',
      data: { to: 'job1@example.com', subject: 'Job 1', body: 'Job 1' },
      priority: 5,
    });

    await queueAdapter.add('emails', {
      handlerName: 'send',
      data: { to: 'job2@example.com', subject: 'Job 2', body: 'Job 2' },
      priority: 5,
    });

    // Fetch concurrently
    const [job1, job2] = await Promise.all([
      queueAdapter.fetch('emails'),
      queueAdapter.fetch('emails'),
    ]);

    // Should get different jobs
    expect(job1?.data.to).not.toBe(job2?.data.to);
  });
});
`,
  },

  // ==========================================================================
  // README - Test documentation
  // ==========================================================================
  {
    path: 'src/__tests__/README.md',
    content: `# Tests

This directory contains tests for the {{projectName}} application.

## Test Structure

\`\`\`
src/__tests__/
├── setup.ts                 # Global test configuration
├── routes/                  # Unit tests for routes (mocked)
│   ├── health.test.ts
│   ├── queue-demo.test.ts
│   ├── cache-demo.test.ts
│   └── user-signup.test.ts
└── integration/            # Integration tests (require Redis)
    ├── redis.test.ts
    └── queue-processing.test.ts
\`\`\`

---

## Running Tests

### All Tests (Unit + Integration)

\`\`\`bash
npm test
\`\`\`

### Unit Tests Only (No Redis Required)

\`\`\`bash
npm test src/__tests__/routes
\`\`\`

### Integration Tests (Requires Redis)

\`\`\`bash
# Start Redis first
docker compose up -d

# Run integration tests
npm test src/__tests__/integration
\`\`\`

### Watch Mode

\`\`\`bash
npm run test:watch
\`\`\`

### Coverage

\`\`\`bash
npm run test:coverage
\`\`\`

---

## Test Types

### Unit Tests (routes/)

**What:** Test individual routes in isolation  
**Mocking:** All services (Queue, Cache, EventBus) are mocked  
**Speed:** Fast (~ms per test)  
**Redis:** Not required

**Example:**
\`\`\`typescript
it('should return healthy status', async () => {
  const mockCache = {
    healthCheck: async () => ({ healthy: true }),
  };
  
  const result = await getHealth.handler({
    ctx: { services: { cache: mockCache } },
    logger: mockLogger,
  });
  
  expect(result.status).toBe('healthy');
});
\`\`\`

### Integration Tests (integration/)

**What:** Test with real Redis  
**Mocking:** Minimal or none  
**Speed:** Slower (~100ms-1s per test)  
**Redis:** Required

**Example:**
\`\`\`typescript
it('should cache and retrieve values', async () => {
  await cacheAdapter.set('key', 'value');
  const result = await cacheAdapter.get('key');
  expect(result).toBe('value');
});
\`\`\`

---

## Writing Tests

### Basic Route Test

\`\`\`typescript
import { describe, it, expect } from 'vitest';
import { createRouteTestContext } from '@blaizejs/testing-utils';
import { getYourRoute } from '../../routes/your-route';

describe('GET /your-route', () => {
  it('should return expected data', async () => {
    const { logger, cleanup } = createRouteTestContext();
    
    const result = await getYourRoute.handler({
      ctx: { /* mock ctx */ },
      logger,
    });
    
    expect(result).toBeDefined();
    cleanup();
  });
});
\`\`\`

### Testing with EventBus

\`\`\`typescript
it('should publish event', async () => {
  const { eventBus } = createRouteTestContext();
  
  await yourHandler({ eventBus });
  
  // Assert event was published
  eventBus.assertPublished('event:type', { data: 'expected' });
});
\`\`\`

### Testing with Mocked Queue

\`\`\`typescript
const mockQueue = {
  add: vi.fn().mockResolvedValue('job-123'),
};

await yourHandler({
  ctx: { services: { queue: mockQueue } },
});

expect(mockQueue.add).toHaveBeenCalledWith(
  'queue-name',
  'handler-name',
  { /* data */ }
);
\`\`\`

---

## Test Utilities

### createRouteTestContext()

Creates pre-configured mock logger and eventBus with assertion helpers.

\`\`\`typescript
const { logger, eventBus, cleanup } = createRouteTestContext();

// Logger with assertions
logger.info('message', { meta: 'data' });
logger.assertInfoCalled('message', { meta: 'data' });

// EventBus with assertions
await eventBus.publish('event:type', { data: 'value' });
eventBus.assertPublished('event:type', { data: 'value' });

// Cleanup after test
cleanup();
\`\`\`

### waitFor()

Wait for an async condition to be true.

\`\`\`typescript
await waitFor(() => events.length > 0, 5000);
\`\`\`

---

## Coverage Requirements

- **Overall:** 80%+
- **Routes:** 80%+ (all main paths covered)
- **Handlers:** 80%+ (happy path + error handling)
- **Integration:** Key flows validated

View coverage report:
\`\`\`bash
npm run test:coverage
open coverage/index.html
\`\`\`

---

## CI/CD

Tests run automatically in CI/CD:

\`\`\`yaml
test:
  services:
    redis:
      image: redis:8-alpine
  script:
    - npm ci
    - npm test
\`\`\`

---

## Troubleshooting

### Redis Connection Errors

**Error:** \`ECONNREFUSED\`

**Solution:** Start Redis
\`\`\`bash
docker compose up -d
\`\`\`

### Tests Timing Out

**Error:** Test exceeds timeout

**Solutions:**
1. Increase timeout in test: \`{ timeout: 10000 }\`
2. Check if Redis is running
3. Check for infinite loops

### Mock Not Working

**Issue:** Mock not being called

**Solutions:**
1. Verify mock is passed to handler
2. Check if using correct mock API
3. Clear mocks between tests: \`vi.clearAllMocks()\`

---

## Best Practices

1. **Isolation:** Each test should be independent
2. **Cleanup:** Always clean up resources (databases, subscriptions)
3. **Descriptive:** Test names should describe what they test
4. **Fast:** Keep unit tests fast (<100ms)
5. **Comprehensive:** Cover happy path + error cases
6. **Realistic:** Integration tests should mimic production

---

## Learn More

- [Vitest Documentation](https://vitest.dev)
- [@blaizejs/testing-utils](https://docs.blaizejs.dev/testing-utils)
- [BlaizeJS Testing Guide](https://docs.blaizejs.dev/guides/testing)
`,
  },
];
