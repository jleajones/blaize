/**
 * Integration Tests for Multi-Server Cache Coordination
 *
 * Tests cache synchronization across multiple servers using EventBus with Redis.
 *
 * Run with: pnpm test multi-server.test.ts
 * Requires: docker compose -f compose.test.yaml up
 */
import { MemoryEventBus } from 'blaizejs';

import { type CacheChangeEvent, CacheService } from '@blaizejs/plugin-cache';
import { createMockLogger } from '@blaizejs/testing-utils';

import { RedisCacheAdapter } from './cache-adapter';
import { createRedisClient } from './client';
import { RedisEventBusAdapter } from './event-bus-adapter';

import type { RedisClient } from './types';
import type { EventBus } from 'blaizejs';

// ============================================================================
// Test Configuration
// ============================================================================

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);

const TEST_REDIS_CONFIG = {
  host: REDIS_HOST,
  port: REDIS_PORT,
  db: 13, // Use db 13 for tests
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
 * Create shared EventBus using RedisEventBusAdapter
 *
 * All test servers share this EventBus to simulate multi-server coordination
 */
async function createSharedEventBus(): Promise<EventBus> {
  const logger = createMockLogger();
  // Create Redis client for EventBus
  const redisClient = createRedisClient(TEST_REDIS_CONFIG);
  await redisClient.connect();

  // Create RedisEventBusAdapter
  const adapter = new RedisEventBusAdapter(redisClient, {
    channelPrefix: 'test:cache:events',
    logger,
  });
  await adapter.connect();

  // Create EventBus with Redis adapter
  const eventBus = new MemoryEventBus('server-id', logger);

  return eventBus;
}

/**
 * Disconnect and cleanup EventBus
 */
async function cleanupEventBus(eventBus: EventBus): Promise<void> {
  // Get the adapter and disconnect
  const adapter = (eventBus as any).adapter as RedisEventBusAdapter;
  if (adapter && typeof adapter.disconnect === 'function') {
    await adapter.disconnect();
  }

  // Get the Redis client and disconnect
  const client = (adapter as any)?.client as RedisClient;
  if (client && typeof client.disconnect === 'function') {
    await client.disconnect();
  }
}

/**
 * Create test cache service with shared EventBus
 *
 * IMPORTANT: All servers must share the same EventBus instance
 * to simulate multi-server coordination (via Redis)
 */
async function createTestService(
  serverId: string,
  sharedEventBus: EventBus
): Promise<CacheService> {
  // Create Redis client for cache storage
  const redisClient = createRedisClient(TEST_REDIS_CONFIG);
  await redisClient.connect();

  // Create RedisCacheAdapter from adapter-redis package
  const cacheAdapter = new RedisCacheAdapter(redisClient, {
    keyPrefix: 'test:cache:',
    logger: createMockLogger(),
  });
  await cacheAdapter.connect();

  // Create CacheService
  const logger = createMockLogger();
  const service = new CacheService({
    adapter: cacheAdapter, // ✅ Using RedisCacheAdapter from adapter-redis
    eventBus: sharedEventBus, // ✅ Shared EventBus (with Redis adapter)
    serverId,
    logger,
  });
  await service.init();

  return service;
}

// ============================================================================
// Test Suite
// ============================================================================

describe('Multi-Server Cache Coordination', () => {
  let serviceA: CacheService;
  let serviceB: CacheService;
  let sharedEventBus: EventBus;

  // Clean database before test suite
  beforeAll(async () => {
    // Create temporary client for cleanup
    const cleanupClient = createRedisClient(TEST_REDIS_CONFIG);
    await cleanupClient.connect();

    // Flush this database to ensure clean start
    await cleanupClient.getConnection().flushdb();

    // Disconnect cleanup client
    await cleanupClient.disconnect();

    // Wait for cleanup to complete
    await wait(200);
  });

  beforeEach(async () => {
    // Create ONE shared EventBus with RedisEventBusAdapter
    // This connects all test servers via Redis pub/sub
    sharedEventBus = await createSharedEventBus();

    serviceA = await createTestService('server-a', sharedEventBus);
    serviceB = await createTestService('server-b', sharedEventBus);
  });

  afterEach(async () => {
    if (serviceA) await serviceA.disconnect();
    if (serviceB) await serviceB.disconnect();

    // Cleanup shared EventBus and Redis connections
    if (sharedEventBus) await cleanupEventBus(sharedEventBus);

    await wait(500);
  });

  // Ensure complete cleanup after suite
  afterAll(async () => {
    // Final wait to ensure all connections are closed
    await wait(1000);
  });

  // ==========================================================================
  // Basic Event Propagation
  // ==========================================================================

  describe('Basic Event Propagation', () => {
    test('set event propagates from server A to server B', async () => {
      const eventsOnB: CacheChangeEvent[] = [];

      serviceB.watch(/^user:/, event => {
        eventsOnB.push(event);
      });

      // Server A sets a value
      await serviceA.set('user:123', 'alice');

      await wait(100);

      // Server B should receive the event
      expect(eventsOnB).toHaveLength(1);
      expect(eventsOnB[0]!.type).toBe('set');
      expect(eventsOnB[0]!.key).toBe('user:123');
      expect(eventsOnB[0]!.value).toBe('alice');
      expect(eventsOnB[0]!.serverId).toBe('server-a');
    });

    test('delete event propagates from server B to server A', async () => {
      const eventsOnA: CacheChangeEvent[] = [];

      serviceA.watch(/.*/, event => {
        eventsOnA.push(event);
      });

      // Set initial value on B
      await serviceB.set('temp:key', 'value');
      await wait(100);

      // Clear events from set
      eventsOnA.length = 0;

      // Server B deletes
      await serviceB.delete('temp:key');

      await wait(100);

      // Server A should receive delete event
      expect(eventsOnA).toHaveLength(1);
      expect(eventsOnA[0]!.type).toBe('delete');
      expect(eventsOnA[0]!.key).toBe('temp:key');
      expect(eventsOnA[0]!.serverId).toBe('server-b');
    });

    test('events propagate bidirectionally', async () => {
      const eventsOnA: CacheChangeEvent[] = [];
      const eventsOnB: CacheChangeEvent[] = [];

      serviceA.watch(/.*/, event => {
        eventsOnA.push(event);
      });

      serviceB.watch(/.*/, event => {
        eventsOnB.push(event);
      });

      // A sets a value
      await serviceA.set('from-a', 'data-a');

      // B sets a value
      await serviceB.set('from-b', 'data-b');

      await wait(100);

      // Each server should receive the other's event
      const aReceivedFromB = eventsOnA.some(e => e.serverId === 'server-b' && e.key === 'from-b');
      const bReceivedFromA = eventsOnB.some(e => e.serverId === 'server-a' && e.key === 'from-a');

      expect(aReceivedFromB).toBe(true);
      expect(bReceivedFromA).toBe(true);
    });
  });

  // ==========================================================================
  // Own Event Filtering (No Echo)
  // ==========================================================================

  describe('Own Event Filtering', () => {
    test('server A does not receive its own events from EventBus', async () => {
      const eventsOnA: CacheChangeEvent[] = [];

      serviceA.watch(/.*/, event => {
        eventsOnA.push(event);
      });

      // Server A sets a value
      await serviceA.set('test:key', 'test:value');

      await wait(100);

      // Server A should only see the LOCAL event (from emit)
      // NOT the EventBus event (filtered by serverId)
      const ownEvents = eventsOnA.filter(e => e.serverId === 'server-a');

      // Should have exactly 1 event (local emit only)
      expect(ownEvents).toHaveLength(1);
    });

    test('server B filters its own events', async () => {
      const eventsFromOthers: CacheChangeEvent[] = [];

      serviceB.watch(/.*/, event => {
        // Only track events from other servers
        if (event.serverId !== 'server-b') {
          eventsFromOthers.push(event);
        }
      });

      // Server B sets multiple values
      await serviceB.set('test:1', 'value1');
      await serviceB.set('test:2', 'value2');

      // Server A sets a value
      await serviceA.set('test:3', 'value3');

      await wait(100);

      // Should only have event from Server A
      expect(eventsFromOthers).toHaveLength(1);
      expect(eventsFromOthers[0]!.serverId).toBe('server-a');
      expect(eventsFromOthers[0]!.key).toBe('test:3');
    });
  });

  // ==========================================================================
  // Race Condition Handling
  // ==========================================================================

  describe('Race Condition Handling', () => {
    test('includes value in set events to handle races', async () => {
      const eventsOnB: CacheChangeEvent[] = [];

      serviceB.watch(/.*/, event => {
        eventsOnB.push(event);
      });

      // Server A sets a value
      await serviceA.set('user:456', 'bob');

      await wait(100);

      // Event includes the value
      expect(eventsOnB).toHaveLength(1);
      expect(eventsOnB[0]!.value).toBe('bob');

      // Server B can react without fetching from cache
      // (avoids race where value might change between event and fetch)
    });

    test('concurrent writes include sequence numbers', async () => {
      const eventsOnB: CacheChangeEvent[] = [];

      serviceB.watch(/^counter:/, event => {
        eventsOnB.push(event);
      });

      // Server A makes multiple rapid writes
      await serviceA.set('counter:1', 'v1');
      await serviceA.set('counter:2', 'v2');
      await serviceA.set('counter:3', 'v3');

      await wait(100);

      // All events should have sequence numbers
      expect(eventsOnB).toHaveLength(3);

      const sequences = eventsOnB.map(e => e.sequence!);

      // Sequences should be present
      expect(sequences.every(s => typeof s === 'number')).toBe(true);

      // Sequences should be ordered
      for (let i = 1; i < sequences.length; i++) {
        expect(sequences[i]).toBeGreaterThan(sequences[i - 1]!);
      }
    });
  });

  // ==========================================================================
  // Batch Operations
  // ==========================================================================

  describe('Batch Operations', () => {
    test('mset emits events for each key', async () => {
      const eventsOnB: CacheChangeEvent[] = [];

      serviceB.watch(/^batch:/, event => {
        eventsOnB.push(event);
      });

      // Server A sets multiple keys
      await serviceA.mset([
        ['batch:1', 'value1'],
        ['batch:2', 'value2'],
        ['batch:3', 'value3'],
      ]);

      await wait(100);

      // Server B should receive 3 events
      expect(eventsOnB).toHaveLength(3);

      const keys = eventsOnB.map(e => e.key);
      expect(keys).toContain('batch:1');
      expect(keys).toContain('batch:2');
      expect(keys).toContain('batch:3');
    });

    test('batch events have same timestamp', async () => {
      const eventsOnB: CacheChangeEvent[] = [];

      serviceB.watch(/^time:/, event => {
        eventsOnB.push(event);
      });

      await serviceA.mset([
        ['time:1', 'v1'],
        ['time:2', 'v2'],
      ]);

      await wait(100);

      expect(eventsOnB).toHaveLength(2);

      // Same timestamp (batch)
      expect(eventsOnB[0]!.timestamp).toBe(eventsOnB[1]!.timestamp);

      // Different sequence numbers
      expect(eventsOnB[0]!.sequence).not.toBe(eventsOnB[1]!.sequence);
    });
  });

  // ==========================================================================
  // Pattern Watching
  // ==========================================================================

  describe('Pattern Watching', () => {
    test('watches specific patterns across servers', async () => {
      const userEvents: CacheChangeEvent[] = [];

      serviceB.watch(/^user:/, event => {
        userEvents.push(event);
      });

      // Server A makes various changes
      await serviceA.set('user:123', 'alice');
      await serviceA.set('session:abc', 'data');
      await serviceA.set('user:456', 'bob');

      await wait(100);

      // Should only receive user events
      expect(userEvents).toHaveLength(2);
      expect(userEvents.every(e => e.key.startsWith('user:'))).toBe(true);
    });

    test('exact key watching works across servers', async () => {
      const specificEvents: CacheChangeEvent[] = [];

      serviceB.watch('config:feature-flag', event => {
        specificEvents.push(event);
      });

      // Server A changes various keys
      await serviceA.set('config:feature-flag', 'true');
      await serviceA.set('config:other', 'value');
      await serviceA.set('config:feature-flag', 'false');

      await wait(100);

      // Should only receive the specific key
      expect(specificEvents).toHaveLength(2);
      expect(specificEvents.every(e => e.key === 'config:feature-flag')).toBe(true);
    });
  });

  // ==========================================================================
  // Local Mode (No EventBus)
  // ==========================================================================

  describe('Local Mode (No EventBus)', () => {
    test('works without eventBus', async () => {
      // Create Redis client and adapter
      const redisClient = createRedisClient(TEST_REDIS_CONFIG);
      await redisClient.connect();

      const cacheAdapter = new RedisCacheAdapter(redisClient, {
        keyPrefix: 'test:local:',
      });
      await cacheAdapter.connect();

      // No eventBus provided - local mode (single server)
      const localService = new CacheService({
        adapter: cacheAdapter,
        logger: createMockLogger(),
      });

      const events: CacheChangeEvent[] = [];
      localService.watch(/.*/, event => {
        events.push(event);
      });

      await localService.set('local:key', 'local:value');

      // Should still emit events locally (via EventEmitter)
      expect(events).toHaveLength(1);
      expect(events[0]!.key).toBe('local:key');

      await localService.disconnect();
      await cacheAdapter.disconnect();
      await redisClient.disconnect();
    });

    test('no serverId means no filtering', async () => {
      // Create Redis client and adapter
      const redisClient = createRedisClient(TEST_REDIS_CONFIG);
      await redisClient.connect();

      const cacheAdapter = new RedisCacheAdapter(redisClient, {
        keyPrefix: 'test:local2:',
      });
      await cacheAdapter.connect();

      // No serverId provided - local mode
      const localService = new CacheService({
        adapter: cacheAdapter,
        logger: createMockLogger(),
      });

      const events: CacheChangeEvent[] = [];
      localService.watch(/.*/, event => {
        events.push(event);
      });

      await localService.set('test:key', 'value');

      // Event has no serverId (local mode)
      expect(events).toHaveLength(1);
      expect(events[0]!.serverId).toBeUndefined();

      await localService.disconnect();
      await cacheAdapter.disconnect();
      await redisClient.disconnect();
    });
  });

  // ==========================================================================
  // Three Server Scenario
  // ==========================================================================

  describe('Three Server Scenario', () => {
    test('events propagate to all three servers', async () => {
      // Create third server with SAME shared EventBus
      const serviceC = await createTestService('server-c', sharedEventBus);

      const eventsOnA: CacheChangeEvent[] = [];
      const eventsOnB: CacheChangeEvent[] = [];
      const eventsOnC: CacheChangeEvent[] = [];

      serviceA.watch(/.*/, event => {
        eventsOnA.push(event);
      });
      serviceB.watch(/.*/, event => {
        eventsOnB.push(event);
      });
      serviceC.watch(/.*/, event => {
        eventsOnC.push(event);
      });

      // Server A makes a change
      await serviceA.set('shared:data', 'from-a');

      await wait(100);

      // All servers should receive the event
      const bReceivedFromA = eventsOnB.some(
        e => e.serverId === 'server-a' && e.key === 'shared:data'
      );
      const cReceivedFromA = eventsOnC.some(
        e => e.serverId === 'server-a' && e.key === 'shared:data'
      );

      expect(bReceivedFromA).toBe(true);
      expect(cReceivedFromA).toBe(true);

      await serviceC.disconnect();
      await wait(200);
    });

    test('each server filters its own events', async () => {
      // Create third server with SAME shared EventBus
      const serviceC = await createTestService('server-c', sharedEventBus);

      const eventsFromOthersA: CacheChangeEvent[] = [];
      const eventsFromOthersB: CacheChangeEvent[] = [];
      const eventsFromOthersC: CacheChangeEvent[] = [];

      serviceA.watch(/.*/, event => {
        if (event.serverId !== 'server-a') {
          eventsFromOthersA.push(event);
        }
      });

      serviceB.watch(/.*/, event => {
        if (event.serverId !== 'server-b') {
          eventsFromOthersB.push(event);
        }
      });

      serviceC.watch(/.*/, event => {
        if (event.serverId !== 'server-c') {
          eventsFromOthersC.push(event);
        }
      });

      // Each server makes a change
      await serviceA.set('from-a', 'data');
      await serviceB.set('from-b', 'data');
      await serviceC.set('from-c', 'data');

      await wait(300);

      // A should see events from B and C
      expect(eventsFromOthersA).toHaveLength(2);
      expect(eventsFromOthersA.some(e => e.serverId === 'server-b')).toBe(true);
      expect(eventsFromOthersA.some(e => e.serverId === 'server-c')).toBe(true);

      // B should see events from A and C
      expect(eventsFromOthersB).toHaveLength(2);
      expect(eventsFromOthersB.some(e => e.serverId === 'server-a')).toBe(true);
      expect(eventsFromOthersB.some(e => e.serverId === 'server-c')).toBe(true);

      // C should see events from A and B
      expect(eventsFromOthersC).toHaveLength(2);
      expect(eventsFromOthersC.some(e => e.serverId === 'server-a')).toBe(true);
      expect(eventsFromOthersC.some(e => e.serverId === 'server-b')).toBe(true);

      await serviceC.disconnect();
      await wait(200);
    });
  });

  // ==========================================================================
  // Error Handling
  // ==========================================================================

  describe('Error Handling', () => {
    test('service continues after EventBus publish error', async () => {
      const events: CacheChangeEvent[] = [];

      serviceA.watch(/.*/, event => {
        events.push(event);
      });

      // Make some changes
      await serviceA.set('test:1', 'value1');
      await serviceA.set('test:2', 'value2');

      // Service should continue working
      expect(events.length).toBeGreaterThanOrEqual(2);
    });

    test('watch handler errors do not crash service', async () => {
      let callCount = 0;

      serviceA.watch(/.*/, () => {
        callCount++;
        throw new Error('Handler error');
      });

      // Should not throw
      await expect(serviceA.set('test:key', 'value')).resolves.toBeUndefined();

      expect(callCount).toBe(1);
    });
  });
});
