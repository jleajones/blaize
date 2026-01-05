/**
 * Multi-Server EventBus Integration Tests
 *
 * Tests distributed event coordination between multiple servers using RedisEventBusAdapter.
 * Verifies event propagation, self-filtering, and cache invalidation scenarios.
 *
 * @module @blaizejs/adapter-redis/test/integration/multi-server
 * @since 0.1.0
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

import { createRedisClient } from './client';
import { RedisEventBusAdapter } from './event-bus-adapter';

import type { RedisClient } from './types';
import type { BlaizeEvent } from 'blaizejs';

// ============================================================================
// Test Configuration
// ============================================================================

const REDIS_CONFIG = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  db: parseInt(process.env.REDIS_DB ?? '0', 10),
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Wait for a specified duration
 */
function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a mock logger for testing
 */
function createMockLogger() {
  return {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
    child: () => createMockLogger(),
  };
}

/**
 * Wait for a condition to be true with timeout
 */
async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options: { timeout: number; interval: number }
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < options.timeout) {
    try {
      const result = await condition();
      if (result) {
        return true;
      }
    } catch {
      // Continue waiting on error
    }
    await wait(options.interval);
  }

  return false;
}

/**
 * Server instance with EventBus adapter
 */
interface TestServer {
  id: string;
  client: RedisClient;
  eventBus: RedisEventBusAdapter;
  receivedEvents: BlaizeEvent[];
}

/**
 * Create a test server with Redis EventBus adapter
 */
async function createTestServer(serverId: string): Promise<TestServer> {
  const client = createRedisClient(REDIS_CONFIG);
  await client.connect();

  const eventBus = new RedisEventBusAdapter(client, {
    channelPrefix: 'blaize:test:events',
    logger: createMockLogger() as any,
  });

  await eventBus.connect();

  return {
    id: serverId,
    client,
    eventBus,
    receivedEvents: [],
  };
}

/**
 * Cleanup test server
 */
async function cleanupTestServer(server: TestServer): Promise<void> {
  await server.eventBus.disconnect();
  await server.client.disconnect();
}

// ============================================================================
// Integration Tests
// ============================================================================

describe('Multi-Server EventBus Integration', () => {
  let server1: TestServer;
  let server2: TestServer;
  let cleanupClient: RedisClient;

  // ==========================================================================
  // Setup & Teardown
  // ==========================================================================

  beforeAll(async () => {
    // Create cleanup client for flushing test data
    cleanupClient = createRedisClient(REDIS_CONFIG);
    await cleanupClient.connect();

    // Flush test database before starting
    await cleanupClient.getConnection().flushdb();
    await wait(100);
  });

  afterAll(async () => {
    // Final cleanup
    if (cleanupClient) {
      await cleanupClient.getConnection().flushdb();
      await cleanupClient.disconnect();
    }
  });

  beforeEach(async () => {
    // Create two test servers
    server1 = await createTestServer('server-1');
    server2 = await createTestServer('server-2');
  });

  afterEach(async () => {
    // Cleanup servers after each test
    if (server1) {
      await cleanupTestServer(server1);
    }
    if (server2) {
      await cleanupTestServer(server2);
    }
  });

  // ==========================================================================
  // Basic Event Propagation
  // ==========================================================================

  describe('Event Propagation', () => {
    it('should propagate events from server1 to server2', async () => {
      // Subscribe on server2
      const handler2 = (event: BlaizeEvent) => {
        server2.receivedEvents.push(event);
      };
      await server2.eventBus.subscribe('user:created', handler2);

      // Give subscription time to be established
      await wait(100);

      // Publish from server1
      const event: BlaizeEvent = {
        type: 'user:created',
        serverId: server1.id,
        timestamp: Date.now(),
        data: { userId: '123', email: 'test@example.com' },
      };

      await server1.eventBus.publish(event);

      // Wait for propagation
      const received = await waitFor(() => server2.receivedEvents.length > 0, {
        timeout: 2000,
        interval: 50,
      });

      expect(received).toBe(true);
      expect(server2.receivedEvents).toHaveLength(1);
      expect(server2.receivedEvents[0]).toMatchObject({
        type: 'user:created',
        serverId: 'server-1',
        data: { userId: '123', email: 'test@example.com' },
      });
    });

    it('should propagate events from server2 to server1', async () => {
      // Subscribe on server1
      const handler1 = (event: BlaizeEvent) => {
        server1.receivedEvents.push(event);
      };
      await server1.eventBus.subscribe('order:created', handler1);

      await wait(100);

      // Publish from server2
      const event: BlaizeEvent = {
        type: 'order:created',
        serverId: server2.id,
        timestamp: Date.now(),
        data: { orderId: 'order-456', amount: 99.99 },
      };

      await server2.eventBus.publish(event);

      // Wait for propagation
      const received = await waitFor(() => server1.receivedEvents.length > 0, {
        timeout: 2000,
        interval: 50,
      });

      expect(received).toBe(true);
      expect(server1.receivedEvents).toHaveLength(1);
      expect(server1.receivedEvents[0]).toMatchObject({
        type: 'order:created',
        serverId: 'server-2',
        data: { orderId: 'order-456' },
      });
    });

    it('should propagate events to multiple subscribers on different servers', async () => {
      // Subscribe on both servers
      const handler1 = (event: BlaizeEvent) => {
        server1.receivedEvents.push(event);
      };
      const handler2 = (event: BlaizeEvent) => {
        server2.receivedEvents.push(event);
      };

      await server1.eventBus.subscribe('notification:*', handler1);
      await server2.eventBus.subscribe('notification:*', handler2);

      await wait(100);

      // Publish from a third source (simulated by server1 with different serverId)
      const event: BlaizeEvent = {
        type: 'notification:email',
        serverId: 'server-3', // Different server
        timestamp: Date.now(),
        data: { recipient: 'user@example.com' },
      };

      await server1.eventBus.publish(event);

      // Wait for both servers to receive
      const received1 = await waitFor(() => server1.receivedEvents.length > 0, {
        timeout: 2000,
        interval: 50,
      });
      const received2 = await waitFor(() => server2.receivedEvents.length > 0, {
        timeout: 2000,
        interval: 50,
      });

      expect(received1).toBe(true);
      expect(received2).toBe(true);
      expect(server1.receivedEvents).toHaveLength(1);
      expect(server2.receivedEvents).toHaveLength(1);
    });
  });

  // ==========================================================================
  // Pattern Matching
  // ==========================================================================

  describe('Pattern Matching', () => {
    it('should support wildcard patterns across servers', async () => {
      // Subscribe to all user events on server2
      const handler2 = (event: BlaizeEvent) => {
        server2.receivedEvents.push(event);
      };
      await server2.eventBus.subscribe('user:*', handler2);

      await wait(100);

      // Publish different user events from server1
      await server1.eventBus.publish({
        type: 'user:created',
        serverId: server1.id,
        timestamp: Date.now(),
        data: { userId: '1' },
      });

      await server1.eventBus.publish({
        type: 'user:updated',
        serverId: server1.id,
        timestamp: Date.now(),
        data: { userId: '1' },
      });

      await server1.eventBus.publish({
        type: 'user:deleted',
        serverId: server1.id,
        timestamp: Date.now(),
        data: { userId: '1' },
      });

      // Wait for all events
      const received = await waitFor(() => server2.receivedEvents.length === 3, {
        timeout: 2000,
        interval: 50,
      });

      expect(received).toBe(true);
      expect(server2.receivedEvents).toHaveLength(3);
      expect(server2.receivedEvents.map(e => e.type)).toEqual([
        'user:created',
        'user:updated',
        'user:deleted',
      ]);
    });

    it('should support catch-all pattern across servers', async () => {
      // Subscribe to all events on server2
      const handler2 = (event: BlaizeEvent) => {
        server2.receivedEvents.push(event);
      };
      await server2.eventBus.subscribe('*', handler2);

      await wait(100);

      // Publish different event types from server1
      await server1.eventBus.publish({
        type: 'user:created',
        serverId: server1.id,
        timestamp: Date.now(),
        data: {},
      });

      await server1.eventBus.publish({
        type: 'order:placed',
        serverId: server1.id,
        timestamp: Date.now(),
        data: {},
      });

      // Wait for events
      const received = await waitFor(() => server2.receivedEvents.length === 2, {
        timeout: 2000,
        interval: 50,
      });

      expect(received).toBe(true);
      expect(server2.receivedEvents).toHaveLength(2);
    });
  });

  // ==========================================================================
  // Self-Filtering (Note: Handled by EventBus wrapper, not adapter)
  // ==========================================================================

  describe('Server Identity', () => {
    it('should preserve serverId in propagated events', async () => {
      const handler2 = (event: BlaizeEvent) => {
        server2.receivedEvents.push(event);
      };
      await server2.eventBus.subscribe('test:event', handler2);

      await wait(100);

      // Publish from server1
      await server1.eventBus.publish({
        type: 'test:event',
        serverId: 'server-1',
        timestamp: Date.now(),
        data: { message: 'hello' },
      });

      const received = await waitFor(() => server2.receivedEvents.length > 0, {
        timeout: 2000,
        interval: 50,
      });

      expect(received).toBe(true);
      expect(server2.receivedEvents[0]!.serverId).toBe('server-1');
    });

    it('should allow filtering by serverId in handler', async () => {
      const filteredEvents: BlaizeEvent[] = [];

      // Subscribe with manual filter
      const handler = (event: BlaizeEvent) => {
        // Only process events from server-1
        if (event.serverId === 'server-1') {
          filteredEvents.push(event);
        }
      };
      await server2.eventBus.subscribe('*', handler);

      await wait(100);

      // Publish from both servers
      await server1.eventBus.publish({
        type: 'test:event',
        serverId: 'server-1',
        timestamp: Date.now(),
        data: {},
      });

      await server2.eventBus.publish({
        type: 'test:event',
        serverId: 'server-2',
        timestamp: Date.now(),
        data: {},
      });

      await wait(300);

      // Only server-1 event should be in filtered list
      expect(filteredEvents).toHaveLength(1);
      expect(filteredEvents[0]!.serverId).toBe('server-1');
    });
  });

  // ==========================================================================
  // Cache Invalidation Scenario
  // ==========================================================================

  describe('Cache Invalidation Propagation', () => {
    it('should propagate cache invalidation events across servers', async () => {
      const server1Invalidations: string[] = [];
      const server2Invalidations: string[] = [];

      // Subscribe both servers to cache invalidation events
      await server1.eventBus.subscribe('cache:invalidate', (event: BlaizeEvent) => {
        const key = (event.data as any).key;
        if (event.serverId !== 'server-1') {
          server1Invalidations.push(key);
        }
      });

      await server2.eventBus.subscribe('cache:invalidate', (event: BlaizeEvent) => {
        const key = (event.data as any).key;
        if (event.serverId !== 'server-2') {
          server2Invalidations.push(key);
        }
      });

      await wait(100);

      // Server1 invalidates a cache key
      await server1.eventBus.publish({
        type: 'cache:invalidate',
        serverId: 'server-1',
        timestamp: Date.now(),
        data: { key: 'user:123' },
      });

      // Server2 invalidates a different key
      await server2.eventBus.publish({
        type: 'cache:invalidate',
        serverId: 'server-2',
        timestamp: Date.now(),
        data: { key: 'product:456' },
      });

      // Wait for propagation
      await wait(300);

      // Each server should have received the OTHER server's invalidation
      expect(server1Invalidations).toEqual(['product:456']);
      expect(server2Invalidations).toEqual(['user:123']);
    });

    it('should handle batch cache invalidation across servers', async () => {
      const server2Invalidations: string[] = [];

      await server2.eventBus.subscribe('cache:invalidate:*', (event: BlaizeEvent) => {
        server2Invalidations.push(event.type);
      });

      await wait(100);

      // Server1 performs batch invalidation
      const keys = ['user:1', 'user:2', 'user:3'];
      for (const key of keys) {
        await server1.eventBus.publish({
          type: `cache:invalidate:${key}`,
          serverId: 'server-1',
          timestamp: Date.now(),
          data: { key },
        });
      }

      const received = await waitFor(() => server2Invalidations.length === 3, {
        timeout: 2000,
        interval: 50,
      });

      expect(received).toBe(true);
      expect(server2Invalidations).toHaveLength(3);
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle reconnection gracefully', async () => {
      const handler2 = (event: BlaizeEvent) => {
        server2.receivedEvents.push(event);
      };
      await server2.eventBus.subscribe('reconnect:test', handler2);

      await wait(100);

      // Disconnect and reconnect server2
      await server2.eventBus.disconnect();
      await wait(100);
      await server2.eventBus.connect();
      await wait(200); // Extra time for subscription restoration

      // Publish from server1
      await server1.eventBus.publish({
        type: 'reconnect:test',
        serverId: 'server-1',
        timestamp: Date.now(),
        data: { message: 'after reconnect' },
      });

      const received = await waitFor(() => server2.receivedEvents.length > 0, {
        timeout: 2000,
        interval: 50,
      });

      expect(received).toBe(true);
      expect(server2.receivedEvents).toHaveLength(1);
    });

    it('should queue events when subscriber not yet connected', async () => {
      // Publish before server2 subscribes
      await server1.eventBus.publish({
        type: 'early:event',
        serverId: 'server-1',
        timestamp: Date.now(),
        data: { message: 'sent early' },
      });

      await wait(100);

      // Now subscribe on server2
      const handler2 = (event: BlaizeEvent) => {
        server2.receivedEvents.push(event);
      };
      await server2.eventBus.subscribe('early:event', handler2);

      // Publish another event
      await server1.eventBus.publish({
        type: 'early:event',
        serverId: 'server-1',
        timestamp: Date.now(),
        data: { message: 'sent after subscribe' },
      });

      const received = await waitFor(() => server2.receivedEvents.length > 0, {
        timeout: 2000,
        interval: 50,
      });

      expect(received).toBe(true);
      // Should only receive the second event (first was published before subscription)
      expect(server2.receivedEvents).toHaveLength(1);
      expect(server2.receivedEvents[0]!.data).toEqual({ message: 'sent after subscribe' });
    });

    it('should handle unsubscribe correctly', async () => {
      const handler2 = (event: BlaizeEvent) => {
        server2.receivedEvents.push(event);
      };

      // Subscribe and then unsubscribe
      const unsubscribe = await server2.eventBus.subscribe('unsub:test', handler2);
      await wait(100);

      // Publish first event
      await server1.eventBus.publish({
        type: 'unsub:test',
        serverId: 'server-1',
        timestamp: Date.now(),
        data: { count: 1 },
      });

      await wait(200);

      // Unsubscribe
      unsubscribe();
      await wait(100);

      // Publish second event
      await server1.eventBus.publish({
        type: 'unsub:test',
        serverId: 'server-1',
        timestamp: Date.now(),
        data: { count: 2 },
      });

      await wait(200);

      // Should only have received first event
      expect(server2.receivedEvents).toHaveLength(1);
      expect(server2.receivedEvents[0]!.data).toEqual({ count: 1 });
    });

    it('should handle high event volume without loss', async () => {
      const handler2 = (event: BlaizeEvent) => {
        server2.receivedEvents.push(event);
      };
      await server2.eventBus.subscribe('volume:test', handler2);

      await wait(100);

      // Publish 50 events rapidly
      const eventCount = 50;
      const publishPromises = [];

      for (let i = 0; i < eventCount; i++) {
        const promise = server1.eventBus.publish({
          type: 'volume:test',
          serverId: 'server-1',
          timestamp: Date.now(),
          data: { index: i },
        });
        publishPromises.push(promise);
      }

      await Promise.all(publishPromises);

      // Wait for all events to be received
      const received = await waitFor(() => server2.receivedEvents.length === eventCount, {
        timeout: 5000,
        interval: 100,
      });

      expect(received).toBe(true);
      expect(server2.receivedEvents).toHaveLength(eventCount);

      // Verify order is preserved (Redis pub/sub guarantees order)
      const indices = server2.receivedEvents.map(e => (e.data as any).index);
      expect(indices).toEqual(Array.from({ length: eventCount }, (_, i) => i));
    });
  });

  // ==========================================================================
  // Health Check
  // ==========================================================================

  describe('Health Check', () => {
    it('should report healthy when connected', async () => {
      const health1 = await server1.eventBus.healthCheck();
      const health2 = await server2.eventBus.healthCheck();

      expect(health1.healthy).toBe(true);
      expect(health2.healthy).toBe(true);
    });

    it('should report unhealthy when disconnected', async () => {
      await server1.eventBus.disconnect();

      const health = await server1.eventBus.healthCheck();

      expect(health.healthy).toBe(false);
      expect(health.message).toContain('not connected');
    });
  });
});
