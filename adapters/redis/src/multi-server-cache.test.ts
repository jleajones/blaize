/**
 * Integration Tests for Multi-Server Cache Coordination
 *
 * Tests cache synchronization across multiple servers using EventBus with Redis.
 *
 * Each server has:
 * - Its own EventBus instance with unique serverId
 * - Its own Redis adapter for EventBus pub/sub
 * - Shared Redis channel prefix (for multi-server communication)
 *
 * Run with: pnpm test multi-server-cache.test.ts
 * Requires: docker compose -f compose.test.yaml up
 *
 * @module @blaizejs/adapter-redis/multi-server-cache.test
 */

import { MemoryEventBus } from 'blaizejs';

import { CacheService } from '@blaizejs/plugin-cache';
import { createMockLogger } from '@blaizejs/testing-utils';

import { RedisCacheAdapter } from './cache-adapter';
import { createRedisClient } from './client';
import { RedisEventBusAdapter } from './event-bus-adapter';

import type { EventBus } from 'blaizejs';

// ============================================================================
// Test Configuration
// ============================================================================

const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  db: 13, // Dedicated test database
};

const SHARED_CHANNEL_PREFIX = 'test:cache:events';
const EVENT_PROPAGATION_DELAY = 100; // ms to wait for Redis pub/sub

// ============================================================================
// Types
// ============================================================================

interface TrackedEvent {
  type: 'set' | 'delete';
  key: string;
  timestamp: number;
  serverId?: string;
}

interface TestServer {
  id: string;
  cache: CacheService;
  eventBus: EventBus;
  cleanup: () => Promise<void>;
}

interface EventTracker {
  events: TrackedEvent[];
  cleanup: () => void;
  waitFor: (predicate: (events: TrackedEvent[]) => boolean, timeout?: number) => Promise<void>;
  findEvent: (predicate: (event: TrackedEvent) => boolean) => TrackedEvent | undefined;
  filterByServerId: (serverId: string) => TrackedEvent[];
  filterByKey: (key: string) => TrackedEvent[];
}

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
 * Create event tracker with enhanced querying capabilities
 */
function createEventTracker(eventBus: EventBus, pattern?: RegExp | string): EventTracker {
  const events: TrackedEvent[] = [];
  const unsubscribers: (() => void)[] = [];

  // Convert pattern to regex
  const regex = pattern
    ? typeof pattern === 'string'
      ? new RegExp(`^${pattern}$`)
      : pattern
    : /.*/;

  // Subscribe to cache:set events
  unsubscribers.push(
    eventBus.subscribe('cache:set', event => {
      const data = event.data as any;
      if (!regex.test(data.key)) return;

      events.push({
        type: 'set',
        key: data.key,
        timestamp: data.timestamp,
        serverId: event.serverId,
      });
    })
  );

  // Subscribe to cache:delete events
  unsubscribers.push(
    eventBus.subscribe('cache:delete', event => {
      const data = event.data as any;
      if (!regex.test(data.key)) return;

      events.push({
        type: 'delete',
        key: data.key,
        timestamp: data.timestamp,
        serverId: event.serverId,
      });
    })
  );

  return {
    events,
    cleanup: () => unsubscribers.forEach(unsub => unsub()),

    waitFor: async (predicate: (events: TrackedEvent[]) => boolean, timeout = 5000) => {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        if (predicate(events)) return;
        await wait(10);
      }
      throw new Error(`Timeout waiting for event condition after ${timeout}ms`);
    },

    findEvent: (predicate: (event: TrackedEvent) => boolean) => {
      return events.find(predicate);
    },

    filterByServerId: (serverId: string) => {
      return events.filter(e => e.serverId === serverId);
    },

    filterByKey: (key: string) => {
      return events.filter(e => e.key === key);
    },
  };
}

/**
 * Create test server with EventBus and CacheService
 *
 * Each server gets its own EventBus with unique serverId,
 * but all share the same Redis channels for coordination
 */
async function createTestServer(serverId: string): Promise<TestServer> {
  const logger = createMockLogger();

  // ========================================================================
  // Cache Storage (Redis)
  // ========================================================================
  const cacheRedisClient = createRedisClient(REDIS_CONFIG);
  await cacheRedisClient.connect();

  const cacheAdapter = new RedisCacheAdapter(cacheRedisClient, {
    keyPrefix: `test:cache:${serverId}:`,
    logger: createMockLogger(),
  });
  await cacheAdapter.connect();

  // ========================================================================
  // EventBus with Redis Adapter
  // ========================================================================

  // Create EventBus with THIS server's ID
  const eventBus = new MemoryEventBus(serverId, logger);

  // Create Redis client for EventBus pub/sub
  const eventBusRedisClient = createRedisClient(REDIS_CONFIG);
  await eventBusRedisClient.connect();

  // Create Redis adapter with SHARED channel prefix
  const redisAdapter = new RedisEventBusAdapter(eventBusRedisClient, {
    channelPrefix: SHARED_CHANNEL_PREFIX,
    logger: createMockLogger(),
  });
  await redisAdapter.connect();

  // Attach Redis adapter to EventBus
  (eventBus as any).setAdapter(redisAdapter);

  // ========================================================================
  // Cache Service
  // ========================================================================
  const cache = new CacheService({
    adapter: cacheAdapter,
    eventBus,
    serverId,
    logger,
  });

  // ========================================================================
  // Cleanup Function
  // ========================================================================
  const cleanup = async () => {
    await cache.disconnect();
    await cacheAdapter.disconnect();
    await cacheRedisClient.disconnect();
    await redisAdapter.disconnect();
    await eventBusRedisClient.disconnect();
  };

  return { id: serverId, cache, eventBus, cleanup };
}

/**
 * Clean Redis database before tests
 */
async function cleanRedis(): Promise<void> {
  const client = createRedisClient(REDIS_CONFIG);
  await client.connect();
  await client.getConnection().flushdb();
  await client.disconnect();
  await wait(200);
}

// ============================================================================
// Test Suite
// ============================================================================

describe('Multi-Server Cache Coordination', () => {
  let serverA: TestServer;
  let serverB: TestServer;

  // Clean database before all tests
  beforeAll(async () => {
    await cleanRedis();
  });

  beforeEach(async () => {
    // Create two servers
    serverA = await createTestServer('server-a');
    serverB = await createTestServer('server-b');
  });

  afterEach(async () => {
    await serverA.cleanup();
    await serverB.cleanup();
    await wait(300);
  });

  afterAll(async () => {
    await wait(500);
  });

  // ==========================================================================
  // Event Propagation Tests
  // ==========================================================================

  describe('Event Propagation', () => {
    it('should propagate set events from A to B', async () => {
      const tracker = createEventTracker(serverB.eventBus, /^user:/);

      await serverA.cache.set('user:123', 'alice');
      await wait(EVENT_PROPAGATION_DELAY);

      expect(tracker.events).toHaveLength(1);
      expect(tracker.events[0]).toMatchObject({
        type: 'set',
        key: 'user:123',
        serverId: 'server-a',
      });

      tracker.cleanup();
    });

    it('should propagate delete events from B to A', async () => {
      const tracker = createEventTracker(serverA.eventBus);

      // Set and then delete
      await serverB.cache.set('temp:key', 'value');
      await wait(EVENT_PROPAGATION_DELAY);
      tracker.events.length = 0; // Clear set event

      await serverB.cache.delete('temp:key');
      await wait(EVENT_PROPAGATION_DELAY);

      const deleteEvent = tracker.findEvent(e => e.type === 'delete' && e.key === 'temp:key');
      expect(deleteEvent).toBeDefined();
      expect(deleteEvent!.serverId).toBe('server-b');

      tracker.cleanup();
    });

    it('should propagate events bidirectionally', async () => {
      const trackerA = createEventTracker(serverA.eventBus);
      const trackerB = createEventTracker(serverB.eventBus);

      await serverA.cache.set('from-a', 'data-a');
      await serverB.cache.set('from-b', 'data-b');
      await wait(EVENT_PROPAGATION_DELAY);

      // A receives from B
      const aReceivedFromB = trackerA.filterByServerId('server-b').some(e => e.key === 'from-b');
      expect(aReceivedFromB).toBe(true);

      // B receives from A
      const bReceivedFromA = trackerB.filterByServerId('server-a').some(e => e.key === 'from-a');
      expect(bReceivedFromA).toBe(true);

      trackerA.cleanup();
      trackerB.cleanup();
    });
  });

  // ==========================================================================
  // Event Metadata Tests
  // ==========================================================================

  describe('Event Metadata', () => {
    it('should include serverId in events', async () => {
      const tracker = createEventTracker(serverB.eventBus);

      await serverA.cache.set('test:key', 'value');
      await wait(EVENT_PROPAGATION_DELAY);

      const event = tracker.filterByServerId('server-a')[0];
      expect(event).toBeDefined();
      expect(event!.serverId).toBe('server-a');
      expect(event!.key).toBe('test:key');

      tracker.cleanup();
    });

    it('should include timestamp in events', async () => {
      const tracker = createEventTracker(serverB.eventBus);
      const before = Date.now();

      await serverA.cache.set('test:key', 'value');
      await wait(EVENT_PROPAGATION_DELAY);

      const after = Date.now();
      const event = tracker.events[0];

      expect(event).toBeDefined();
      expect(event!.timestamp).toBeGreaterThanOrEqual(before);
      expect(event!.timestamp).toBeLessThanOrEqual(after);

      tracker.cleanup();
    });

    it('should allow filtering by serverId', async () => {
      const tracker = createEventTracker(serverA.eventBus);

      await serverB.cache.set('b:1', 'value1');
      await serverB.cache.set('b:2', 'value2');
      await serverA.cache.set('a:1', 'value1');
      await wait(EVENT_PROPAGATION_DELAY);

      const fromB = tracker.filterByServerId('server-b');
      expect(fromB).toHaveLength(2);
      expect(fromB.every(e => e.serverId === 'server-b')).toBe(true);

      tracker.cleanup();
    });
  });

  // ==========================================================================
  // Pattern Filtering Tests
  // ==========================================================================

  describe('Pattern Filtering', () => {
    it('should filter events by regex pattern', async () => {
      const tracker = createEventTracker(serverB.eventBus, /^user:/);

      await serverA.cache.set('user:123', 'alice');
      await serverA.cache.set('session:abc', 'data');
      await serverA.cache.set('user:456', 'bob');
      await wait(EVENT_PROPAGATION_DELAY);

      expect(tracker.events).toHaveLength(2);
      expect(tracker.events.every(e => e.key.startsWith('user:'))).toBe(true);

      tracker.cleanup();
    });

    it('should filter events by exact key', async () => {
      const tracker = createEventTracker(serverB.eventBus, 'config:feature-flag');

      await serverA.cache.set('config:feature-flag', 'true');
      await serverA.cache.set('config:other', 'value');
      await serverA.cache.set('config:feature-flag', 'false');
      await wait(EVENT_PROPAGATION_DELAY);

      expect(tracker.events).toHaveLength(2);
      expect(tracker.events.every(e => e.key === 'config:feature-flag')).toBe(true);

      tracker.cleanup();
    });

    it('should support multiple patterns per server', async () => {
      const userTracker = createEventTracker(serverB.eventBus, /^user:/);
      const sessionTracker = createEventTracker(serverB.eventBus, /^session:/);

      await serverA.cache.set('user:1', 'alice');
      await serverA.cache.set('session:a', 'data');
      await serverA.cache.set('user:2', 'bob');
      await wait(EVENT_PROPAGATION_DELAY);

      expect(userTracker.events).toHaveLength(2);
      expect(sessionTracker.events).toHaveLength(1);

      userTracker.cleanup();
      sessionTracker.cleanup();
    });
  });

  // ==========================================================================
  // Batch Operations Tests
  // ==========================================================================

  describe('Batch Operations', () => {
    it('should emit events for each key in mset', async () => {
      const tracker = createEventTracker(serverB.eventBus, /^batch:/);

      await serverA.cache.mset([
        ['batch:1', 'value1'],
        ['batch:2', 'value2'],
        ['batch:3', 'value3'],
      ]);
      await wait(EVENT_PROPAGATION_DELAY);

      expect(tracker.events).toHaveLength(3);

      const keys = tracker.events.map(e => e.key);
      expect(keys).toContain('batch:1');
      expect(keys).toContain('batch:2');
      expect(keys).toContain('batch:3');

      tracker.cleanup();
    });

    it('should handle rapid sequential writes', async () => {
      const tracker = createEventTracker(serverB.eventBus, /^counter:/);

      await serverA.cache.set('counter:1', 'v1');
      await serverA.cache.set('counter:2', 'v2');
      await serverA.cache.set('counter:3', 'v3');
      await wait(EVENT_PROPAGATION_DELAY);

      expect(tracker.events).toHaveLength(3);
      expect(tracker.events[0]!.key).toBe('counter:1');
      expect(tracker.events[1]!.key).toBe('counter:2');
      expect(tracker.events[2]!.key).toBe('counter:3');

      tracker.cleanup();
    });
  });

  // ==========================================================================
  // Three Server Scenario
  // ==========================================================================

  describe('Three Server Scenario', () => {
    let serverC: TestServer;

    beforeEach(async () => {
      serverC = await createTestServer('server-c');
    });

    afterEach(async () => {
      await serverC.cleanup();
      await wait(200);
    });

    it('should propagate events to all three servers', async () => {
      const trackerA = createEventTracker(serverA.eventBus);
      const trackerB = createEventTracker(serverB.eventBus);
      const trackerC = createEventTracker(serverC.eventBus);

      await serverA.cache.set('shared:data', 'from-a');
      await wait(EVENT_PROPAGATION_DELAY);

      // B and C should receive from A
      expect(trackerB.filterByServerId('server-a').some(e => e.key === 'shared:data')).toBe(true);
      expect(trackerC.filterByServerId('server-a').some(e => e.key === 'shared:data')).toBe(true);

      trackerA.cleanup();
      trackerB.cleanup();
      trackerC.cleanup();
    });

    it('should allow each server to filter its own events', async () => {
      const trackerA = createEventTracker(serverA.eventBus);
      const trackerB = createEventTracker(serverB.eventBus);
      const trackerC = createEventTracker(serverC.eventBus);

      await serverA.cache.set('from-a', 'data');
      await serverB.cache.set('from-b', 'data');
      await serverC.cache.set('from-c', 'data');
      await wait(EVENT_PROPAGATION_DELAY * 2);

      // A should see B and C (not itself)
      const aFromOthers = trackerA.events.filter(e => e.serverId !== 'server-a');
      expect(aFromOthers).toHaveLength(2);
      expect(aFromOthers.some(e => e.serverId === 'server-b')).toBe(true);
      expect(aFromOthers.some(e => e.serverId === 'server-c')).toBe(true);

      // B should see A and C (not itself)
      const bFromOthers = trackerB.events.filter(e => e.serverId !== 'server-b');
      expect(bFromOthers).toHaveLength(2);
      expect(bFromOthers.some(e => e.serverId === 'server-a')).toBe(true);
      expect(bFromOthers.some(e => e.serverId === 'server-c')).toBe(true);

      // C should see A and B (not itself)
      const cFromOthers = trackerC.events.filter(e => e.serverId !== 'server-c');
      expect(cFromOthers).toHaveLength(2);
      expect(cFromOthers.some(e => e.serverId === 'server-a')).toBe(true);
      expect(cFromOthers.some(e => e.serverId === 'server-b')).toBe(true);

      trackerA.cleanup();
      trackerB.cleanup();
      trackerC.cleanup();
    });
  });

  // ==========================================================================
  // Local Mode (No EventBus)
  // ==========================================================================

  describe('Local Mode', () => {
    it('should work without EventBus', async () => {
      const redisClient = createRedisClient(REDIS_CONFIG);
      await redisClient.connect();

      const adapter = new RedisCacheAdapter(redisClient, {
        keyPrefix: 'test:local:',
      });
      await adapter.connect();

      const localCache = new CacheService({
        adapter,
        logger: createMockLogger(),
        // No eventBus, no serverId
      });

      await localCache.set('local:key', 'value');
      const value = await localCache.get('local:key');
      expect(value).toBe('value');

      await localCache.disconnect();
      await adapter.disconnect();
      await redisClient.disconnect();
    });
  });

  // ==========================================================================
  // Error Handling
  // ==========================================================================

  describe('Error Handling', () => {
    it('should continue after EventBus publish errors', async () => {
      const tracker = createEventTracker(serverB.eventBus);

      // Make multiple changes
      await serverA.cache.set('test:1', 'value1');
      await serverA.cache.set('test:2', 'value2');
      await wait(EVENT_PROPAGATION_DELAY);

      // Service should continue working
      expect(tracker.events.length).toBeGreaterThanOrEqual(2);

      tracker.cleanup();
    });

    it('should handle subscriber errors gracefully', async () => {
      let callCount = 0;

      // Subscribe with handler that throws
      const unsub = serverB.eventBus.subscribe('cache:set', () => {
        callCount++;
        throw new Error('Subscriber error');
      });

      // Should not throw
      await expect(serverA.cache.set('test:key', 'value')).resolves.toBeUndefined();
      await wait(EVENT_PROPAGATION_DELAY);

      expect(callCount).toBe(1);

      unsub();
    });
  });

  // ==========================================================================
  // Real-World Scenarios
  // ==========================================================================

  describe('Real-World Scenarios', () => {
    it('should coordinate cache invalidation across servers', async () => {
      const trackerB = createEventTracker(serverB.eventBus, /^user:/);

      // Server A caches user data
      await serverA.cache.set('user:123', JSON.stringify({ name: 'Alice', role: 'admin' }));
      await wait(EVENT_PROPAGATION_DELAY);

      // Server B sees the cache event
      expect(trackerB.events).toHaveLength(1);

      // Server A updates and invalidates
      await serverA.cache.set('user:123', JSON.stringify({ name: 'Alice', role: 'user' }));
      await wait(EVENT_PROPAGATION_DELAY);

      // Server B sees the update
      expect(trackerB.events).toHaveLength(2);
      expect(trackerB.events.every(e => e.key === 'user:123')).toBe(true);

      trackerB.cleanup();
    });

    it('should handle session cleanup across servers', async () => {
      const trackerB = createEventTracker(serverB.eventBus, /^session:/);

      // Create sessions on different servers
      await serverA.cache.set('session:user-1', 'data', 300);
      await serverB.cache.set('session:user-2', 'data', 300);
      await wait(EVENT_PROPAGATION_DELAY);

      // Both servers see session creation
      const fromA = trackerB.filterByServerId('server-a');
      expect(fromA).toHaveLength(1);

      // Server A cleans up all sessions
      await serverA.cache.clear('session:*');
      await wait(EVENT_PROPAGATION_DELAY);

      // Server B sees the deletes
      const deleteEvents = trackerB.events.filter(e => e.type === 'delete');
      expect(deleteEvents.length).toBeGreaterThan(0);

      trackerB.cleanup();
    });

    it('should coordinate cache warming across servers', async () => {
      const trackerB = createEventTracker(serverB.eventBus, /^config:/);

      // Server A warms cache with configuration
      const configs = [
        ['config:feature-flags', JSON.stringify({ darkMode: true, beta: false })],
        ['config:rate-limits', JSON.stringify({ maxRequests: 100, window: 60 })],
        ['config:api-keys', JSON.stringify({ service: 'sk_prod_123' })],
      ];

      await serverA.cache.mset(configs as unknown as [string, string][]);
      await wait(EVENT_PROPAGATION_DELAY);

      // Server B sees all config events
      expect(trackerB.events).toHaveLength(3);
      expect(trackerB.events.every(e => e.type === 'set')).toBe(true);
      expect(trackerB.events.every(e => e.serverId === 'server-a')).toBe(true);

      trackerB.cleanup();
    });
  });
});
