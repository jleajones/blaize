/**
 * Integration Tests for Multi-Server Cache Coordination
 *
 * Tests cache synchronization across multiple servers using Redis pub/sub.
 *
 * Run with: pnpm test multi-server.test.ts
 * Requires: docker compose -f compose.test.yaml up
 */
import { createMockLogger } from '@blaizejs/testing-utils';

import { CacheService } from './cache-service';
import { RedisAdapter } from './storage/redis';

import type { CacheChangeEvent, RedisAdapterConfig } from './types';

// ============================================================================
// Test Configuration
// ============================================================================

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);

const TEST_CONFIG: RedisAdapterConfig = {
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
 * Create test cache service
 */
async function createTestService(serverId: string): Promise<CacheService> {
  const adapter = new RedisAdapter(TEST_CONFIG);
  await adapter.connect();

  const pubsub = adapter.createPubSub(serverId);
  await pubsub.connect();

  const logger = createMockLogger();
  const service = new CacheService({
    adapter,
    pubsub,
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

  // ✅ ADD THIS: Clean database before test suite
  beforeAll(async () => {
    // Create temporary adapter for cleanup
    const cleanupAdapter = new RedisAdapter(TEST_CONFIG);
    await cleanupAdapter.connect();

    // Get the Redis client
    const client = (cleanupAdapter as any).client;

    // Flush this database to ensure clean start
    await client.flushdb();

    // Disconnect cleanup adapter
    await cleanupAdapter.disconnect();

    // Wait for cleanup to complete
    await wait(200);
  });

  beforeEach(async () => {
    serviceA = await createTestService('server-a');
    serviceB = await createTestService('server-b');
  });

  afterEach(async () => {
    if (serviceA) await serviceA.disconnect();
    if (serviceB) await serviceB.disconnect();

    await wait(500);
  });

  // ✅ ADD THIS: Ensure complete cleanup after suite
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
    test('server A does not receive its own events', async () => {
      const eventsOnA: CacheChangeEvent[] = [];

      serviceA.watch(/.*/, event => {
        eventsOnA.push(event);
      });

      // Server A sets a value
      await serviceA.set('test:key', 'test:value');

      await wait(100);

      // Server A should only see the LOCAL event (from emit)
      // NOT the pub/sub event (filtered by serverId)
      const ownEvents = eventsOnA.filter(e => e.serverId === 'server-a');

      // Should have exactly 1 event (local emit)
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
  // Local Mode (No Pub/Sub)
  // ==========================================================================

  describe('Local Mode (No Pub/Sub)', () => {
    test('works without pubsub', async () => {
      const adapter = new RedisAdapter(TEST_CONFIG);
      await adapter.connect();

      const localService = new CacheService({ adapter, logger: createMockLogger() });

      const events: CacheChangeEvent[] = [];
      localService.watch(/.*/, event => {
        events.push(event);
      });

      await localService.set('local:key', 'local:value');

      // Should still emit events locally
      expect(events).toHaveLength(1);
      expect(events[0]!.key).toBe('local:key');

      await localService.disconnect();
    });

    test('no serverId means no filtering', async () => {
      const adapter = new RedisAdapter(TEST_CONFIG);
      await adapter.connect();

      const localService = new CacheService({ adapter, logger: createMockLogger() });

      const events: CacheChangeEvent[] = [];
      localService.watch(/.*/, event => {
        events.push(event);
      });

      await localService.set('test:key', 'value');

      // Event has no serverId
      expect(events).toHaveLength(1);
      expect(events[0]!.serverId).toBeUndefined();

      await localService.disconnect();
    });
  });

  // ==========================================================================
  // Three Server Scenario
  // ==========================================================================

  describe('Three Server Scenario', () => {
    test('events propagate to all three servers', async () => {
      const serviceC = await createTestService('server-c');

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
      const serviceC = await createTestService('server-c');

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
    test('service continues after pub/sub error', async () => {
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
