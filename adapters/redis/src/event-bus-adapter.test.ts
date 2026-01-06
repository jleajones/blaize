/**
 * Unit tests for RedisEventBusAdapter
 *
 * @module @blaizejs/adapter-redis/event-bus-adapter
 */

import { RedisOperationError, CircuitBreakerOpenError } from './errors';
import { RedisEventBusAdapter } from './event-bus-adapter';

import type { RedisClient } from './types';
import type { BlaizeEvent } from 'blaizejs';

describe('RedisEventBusAdapter', () => {
  let adapter: RedisEventBusAdapter;
  let mockClient: any;
  let mockPublisher: any;
  let mockSubscriber: any;
  let mockLogger: any;

  beforeEach(() => {
    // Create mock Redis connections
    mockPublisher = {
      publish: vi.fn().mockResolvedValue(1),
    };

    mockSubscriber = {
      on: vi.fn(),
      off: vi.fn(),
      psubscribe: vi.fn().mockResolvedValue(undefined),
      punsubscribe: vi.fn().mockResolvedValue(undefined),
    };

    // Create mock client
    mockClient = {
      getPublisher: vi.fn().mockReturnValue(mockPublisher),
      getSubscriber: vi.fn().mockReturnValue(mockSubscriber),
      isConnected: vi.fn().mockReturnValue(true),
      connect: vi.fn().mockResolvedValue(undefined),
      healthCheck: vi.fn().mockResolvedValue({ healthy: true }),
    };

    // Create mock logger
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      child: vi.fn(),
    };
    mockLogger.child.mockReturnValue(mockLogger);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Constructor', () => {
    it('should create adapter with default options', () => {
      adapter = new RedisEventBusAdapter(mockClient as RedisClient);

      expect(adapter).toBeInstanceOf(RedisEventBusAdapter);
      expect(mockLogger.child).not.toHaveBeenCalled(); // No logger provided
    });

    it('should create adapter with custom channel prefix', () => {
      adapter = new RedisEventBusAdapter(mockClient as RedisClient, {
        channelPrefix: 'custom:events',
        logger: mockLogger,
      });

      expect(mockLogger.child).toHaveBeenCalledWith({ component: 'RedisEventBusAdapter' });
      expect(mockLogger.info).toHaveBeenCalledWith(
        'RedisEventBusAdapter created',
        expect.objectContaining({
          channelPrefix: 'custom:events',
        })
      );
    });

    it('should initialize circuit breaker with custom config', () => {
      adapter = new RedisEventBusAdapter(mockClient as RedisClient, {
        circuitBreaker: {
          failureThreshold: 3,
          resetTimeout: 5000,
        },
      });

      expect(adapter.getCircuitState()).toBe('CLOSED');
    });
  });

  describe('connect()', () => {
    beforeEach(() => {
      adapter = new RedisEventBusAdapter(mockClient as RedisClient, {
        logger: mockLogger,
      });
    });

    it('should connect and setup pmessage listener', async () => {
      await adapter.connect();

      expect(mockClient.isConnected).toHaveBeenCalled();
      expect(mockSubscriber.on).toHaveBeenCalledWith('pmessage', expect.any(Function));
      expect(mockLogger.info).toHaveBeenCalledWith('RedisEventBusAdapter connected');
    });

    it('should connect client if not already connected', async () => {
      mockClient.isConnected.mockReturnValue(false);

      await adapter.connect();

      expect(mockClient.connect).toHaveBeenCalled();
    });

    it('should not connect client if already connected', async () => {
      mockClient.isConnected.mockReturnValue(true);

      await adapter.connect();

      expect(mockClient.connect).not.toHaveBeenCalled();
    });

    it('should be no-op if already connected', async () => {
      await adapter.connect();

      mockLogger.debug.mockClear();
      mockSubscriber.on.mockClear();

      await adapter.connect();

      expect(mockLogger.debug).toHaveBeenCalledWith('Already connected, skipping connect()');
      expect(mockSubscriber.on).not.toHaveBeenCalled();
    });

    it('should restore subscriptions after reconnection', async () => {
      // First connect
      await adapter.connect();

      // Create subscription
      await adapter.subscribe('user:*', vi.fn());

      // Disconnect
      await adapter.disconnect();

      // Reconnect - should restore subscriptions
      await adapter.connect();

      expect(mockSubscriber.psubscribe).toHaveBeenCalledWith('blaize:events:user:*');
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Restoring subscriptions after reconnection',
        expect.objectContaining({ count: 1 })
      );
    });
  });

  describe('disconnect()', () => {
    beforeEach(async () => {
      adapter = new RedisEventBusAdapter(mockClient as RedisClient, {
        logger: mockLogger,
      });
      await adapter.connect();
    });

    it('should disconnect and cleanup listeners', async () => {
      await adapter.disconnect();

      expect(mockSubscriber.off).toHaveBeenCalledWith('pmessage', expect.any(Function));
      expect(mockLogger.info).toHaveBeenCalledWith('RedisEventBusAdapter disconnected');
    });

    it('should unsubscribe from all patterns', async () => {
      // Create subscriptions
      await adapter.subscribe('user:*', vi.fn());
      await adapter.subscribe('order:*', vi.fn());

      mockSubscriber.punsubscribe.mockClear();

      await adapter.disconnect();

      expect(mockSubscriber.punsubscribe).toHaveBeenCalledWith(
        'blaize:events:user:*',
        'blaize:events:order:*'
      );
    });

    it('should be no-op if not connected', async () => {
      await adapter.disconnect();

      mockLogger.debug.mockClear();
      mockSubscriber.off.mockClear();

      await adapter.disconnect();

      expect(mockLogger.debug).toHaveBeenCalledWith('Not connected, skipping disconnect()');
      expect(mockSubscriber.off).not.toHaveBeenCalled();
    });
  });

  describe('publish()', () => {
    beforeEach(async () => {
      adapter = new RedisEventBusAdapter(mockClient as RedisClient, {
        logger: mockLogger,
      });
      await adapter.connect();
    });

    it('should publish event to correct channel', async () => {
      const event: BlaizeEvent = {
        type: 'user:created',
        data: { userId: '123' },
        timestamp: Date.now(),
        serverId: 'server-1',
      };

      await adapter.publish(event);

      expect(mockPublisher.publish).toHaveBeenCalledWith(
        'blaize:events:user:created',
        expect.stringContaining('"type":"user:created"')
      );
    });

    it('should serialize event as JSON', async () => {
      const event: BlaizeEvent = {
        type: 'test',
        data: { value: 42 },
        timestamp: 1234567890,
        serverId: 'server-1',
        correlationId: 'corr-123',
      };

      await adapter.publish(event);

      const payload = mockPublisher.publish.mock.calls[0][1];
      const parsed = JSON.parse(payload);

      expect(parsed).toEqual(event);
    });

    it('should throw if not connected', async () => {
      await adapter.disconnect();

      const event: BlaizeEvent = {
        type: 'test',
        data: {},
        timestamp: Date.now(),
        serverId: 'server-1',
      };

      await expect(adapter.publish(event)).rejects.toThrow('not connected');
    });

    it('should warn for large payloads (> 1MB)', async () => {
      const largeData = 'x'.repeat(1024 * 1024 + 1);
      const event: BlaizeEvent = {
        type: 'large',
        data: { content: largeData },
        timestamp: Date.now(),
        serverId: 'server-1',
      };

      await adapter.publish(event);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Large event payload',
        expect.objectContaining({
          type: 'large',
        })
      );
    });

    it('should throw RedisOperationError on publish failure', async () => {
      mockPublisher.publish.mockRejectedValue(new Error('Redis error'));

      const event: BlaizeEvent = {
        type: 'test',
        data: {},
        timestamp: Date.now(),
        serverId: 'server-1',
      };

      await expect(adapter.publish(event)).rejects.toThrow(RedisOperationError);
    });

    it('should use circuit breaker for publish operations', async () => {
      // Trigger circuit breaker by failing multiple times
      mockPublisher.publish.mockRejectedValue(new Error('Redis down'));

      const event: BlaizeEvent = {
        type: 'test',
        data: {},
        timestamp: Date.now(),
        serverId: 'server-1',
      };

      // Fail 5 times (default threshold)
      for (let i = 0; i < 5; i++) {
        await expect(adapter.publish(event)).rejects.toThrow();
      }

      expect(adapter.getCircuitState()).toBe('OPEN');

      // Next publish should fail immediately with CircuitBreakerOpenError
      await expect(adapter.publish(event)).rejects.toThrow(CircuitBreakerOpenError);
    });
  });

  describe('subscribe()', () => {
    beforeEach(async () => {
      adapter = new RedisEventBusAdapter(mockClient as RedisClient, {
        logger: mockLogger,
      });
      await adapter.connect();
    });

    it('should subscribe to pattern and return unsubscribe function', async () => {
      const handler = vi.fn();

      const unsubscribe = await adapter.subscribe('user:*', handler);

      expect(mockSubscriber.psubscribe).toHaveBeenCalledWith('blaize:events:user:*');
      expect(unsubscribe).toBeInstanceOf(Function);
    });

    it('should not duplicate Redis subscriptions for same pattern', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      await adapter.subscribe('user:*', handler1);
      mockSubscriber.psubscribe.mockClear();

      await adapter.subscribe('user:*', handler2);

      // Should not call psubscribe again
      expect(mockSubscriber.psubscribe).not.toHaveBeenCalled();
    });

    it('should throw if not connected', async () => {
      await adapter.disconnect();

      await expect(adapter.subscribe('test', vi.fn())).rejects.toThrow('not connected');
    });

    it('should unsubscribe from Redis when last handler removed', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      const unsub1 = await adapter.subscribe('user:*', handler1);
      const unsub2 = await adapter.subscribe('user:*', handler2);

      mockSubscriber.punsubscribe.mockClear();

      // Remove first subscription
      unsub1();

      // Should not unsubscribe from Redis yet
      expect(mockSubscriber.punsubscribe).not.toHaveBeenCalled();

      // Remove second subscription
      unsub2();

      // Now should unsubscribe from Redis
      expect(mockSubscriber.punsubscribe).toHaveBeenCalledWith('blaize:events:user:*');
    });

    it('should handle punsubscribe errors gracefully', async () => {
      mockSubscriber.punsubscribe.mockRejectedValue(new Error('Unsubscribe failed'));

      const unsubscribe = await adapter.subscribe('user:*', vi.fn());

      // Should not throw
      expect(() => unsubscribe()).not.toThrow();

      // Wait for async error handling to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Error unsubscribing from Redis pattern',
        expect.any(Object)
      );
    });
  });

  describe('Message handling', () => {
    let pmessageHandler: any;

    beforeEach(async () => {
      adapter = new RedisEventBusAdapter(mockClient as RedisClient, {
        logger: mockLogger,
      });
      await adapter.connect();

      // Capture the pmessage handler
      pmessageHandler = mockSubscriber.on.mock.calls.find(
        (call: any) => call[0] === 'pmessage'
      )?.[1];
    });

    it('should invoke matching handlers for received events', async () => {
      const handler = vi.fn();
      await adapter.subscribe('user:*', handler);

      const event: BlaizeEvent = {
        type: 'user:created',
        data: { userId: '123' },
        timestamp: Date.now(),
        serverId: 'server-2',
      };

      // Simulate Redis pmessage
      pmessageHandler('blaize:events:user:*', 'blaize:events:user:created', JSON.stringify(event));

      expect(handler).toHaveBeenCalledWith(event);
    });

    it('should handle wildcard pattern (*)', async () => {
      const handler = vi.fn();
      await adapter.subscribe('*', handler);

      const event: BlaizeEvent = {
        type: 'anything',
        data: {},
        timestamp: Date.now(),
        serverId: 'server-2',
      };

      pmessageHandler('blaize:events:*', 'blaize:events:anything', JSON.stringify(event));

      expect(handler).toHaveBeenCalledWith(event);
    });

    it('should handle prefix patterns (user:*)', async () => {
      const handler = vi.fn();
      await adapter.subscribe('user:*', handler);

      const event1: BlaizeEvent = {
        type: 'user:created',
        data: {},
        timestamp: Date.now(),
        serverId: 'server-2',
      };

      const event2: BlaizeEvent = {
        type: 'user:updated',
        data: {},
        timestamp: Date.now(),
        serverId: 'server-2',
      };

      pmessageHandler('blaize:events:user:*', 'blaize:events:user:created', JSON.stringify(event1));
      pmessageHandler('blaize:events:user:*', 'blaize:events:user:updated', JSON.stringify(event2));

      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('should ignore malformed JSON', async () => {
      const handler = vi.fn();
      await adapter.subscribe('*', handler);

      pmessageHandler('blaize:events:*', 'blaize:events:test', 'invalid json{');

      expect(handler).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to deserialize event',
        expect.any(Object)
      );
    });

    it('should ignore events with missing required fields', async () => {
      const handler = vi.fn();
      await adapter.subscribe('*', handler);

      const malformed = JSON.stringify({ type: 'test' }); // Missing timestamp, serverId

      pmessageHandler('blaize:events:*', 'blaize:events:test', malformed);

      expect(handler).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith('Malformed event structure', expect.any(Object));
    });

    it('should handle async handler errors gracefully', async () => {
      const handler = vi.fn().mockRejectedValue(new Error('Handler error'));
      await adapter.subscribe('*', handler);

      const event: BlaizeEvent = {
        type: 'test',
        data: {},
        timestamp: Date.now(),
        serverId: 'server-2',
      };

      pmessageHandler('blaize:events:*', 'blaize:events:test', JSON.stringify(event));

      // Wait for promise to reject
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Event handler error',
        expect.objectContaining({
          type: 'test',
        })
      );
    });

    it('should handle sync handler errors gracefully', async () => {
      const handler = vi.fn().mockImplementation(() => {
        throw new Error('Sync error');
      });
      await adapter.subscribe('*', handler);

      const event: BlaizeEvent = {
        type: 'test',
        data: {},
        timestamp: Date.now(),
        serverId: 'server-2',
      };

      // Should not throw
      expect(() => {
        pmessageHandler('blaize:events:*', 'blaize:events:test', JSON.stringify(event));
      }).not.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith('Event handler error', expect.any(Object));
    });
  });

  describe('healthCheck()', () => {
    beforeEach(async () => {
      adapter = new RedisEventBusAdapter(mockClient as RedisClient);
      await adapter.connect();
    });

    it('should return unhealthy when not connected', async () => {
      await adapter.disconnect();

      const health = await adapter.healthCheck();

      expect(health.healthy).toBe(false);
      expect(health.message).toBe('Adapter not connected');
    });

    it('should return client health status', async () => {
      mockClient.healthCheck.mockResolvedValue({
        healthy: true,
        latency: 5,
      });

      const health = await adapter.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.message).toContain('circuit: CLOSED');
    });

    it('should return unhealthy when client unhealthy', async () => {
      mockClient.healthCheck.mockResolvedValue({
        healthy: false,
        message: 'Redis down',
      });

      const health = await adapter.healthCheck();

      expect(health.healthy).toBe(false);
      expect(health.message).toBe('Redis down');
    });

    it('should return unhealthy when circuit is OPEN', async () => {
      // Trigger circuit breaker
      mockPublisher.publish.mockRejectedValue(new Error('Redis error'));

      const event: BlaizeEvent = {
        type: 'test',
        data: {},
        timestamp: Date.now(),
        serverId: 'server-1',
      };

      for (let i = 0; i < 5; i++) {
        await expect(adapter.publish(event)).rejects.toThrow();
      }

      const health = await adapter.healthCheck();

      expect(health.healthy).toBe(false);
      expect(health.message).toContain('Circuit breaker is OPEN');
    });
  });

  describe('getCircuitState()', () => {
    beforeEach(() => {
      adapter = new RedisEventBusAdapter(mockClient as RedisClient);
    });

    it('should return current circuit state', () => {
      expect(adapter.getCircuitState()).toBe('CLOSED');
    });
  });

  describe('Edge cases', () => {
    beforeEach(async () => {
      adapter = new RedisEventBusAdapter(mockClient as RedisClient, {
        logger: mockLogger,
      });
      await adapter.connect();
    });

    it('should handle patterns with special Redis glob chars', async () => {
      const handler = vi.fn();

      // Redis glob chars: * ? [ ]
      await adapter.subscribe('user:*:details', handler);

      expect(mockSubscriber.psubscribe).toHaveBeenCalledWith('blaize:events:user:*:details');
    });

    it('should handle very long event types', async () => {
      const longType = 'a'.repeat(256);
      const event: BlaizeEvent = {
        type: longType,
        data: {},
        timestamp: Date.now(),
        serverId: 'server-1',
      };

      await adapter.publish(event);

      expect(mockPublisher.publish).toHaveBeenCalledWith(
        `blaize:events:${longType}`,
        expect.any(String)
      );
    });

    it('should handle events with undefined data', async () => {
      const event: BlaizeEvent = {
        type: 'test',
        data: undefined,
        timestamp: Date.now(),
        serverId: 'server-1',
      };

      await adapter.publish(event);

      const payload = mockPublisher.publish.mock.calls[0][1];
      const parsed = JSON.parse(payload);

      expect(parsed.data).toBeUndefined();
    });

    it('should handle events with null data', async () => {
      const event: BlaizeEvent = {
        type: 'test',
        data: null,
        timestamp: Date.now(),
        serverId: 'server-1',
      };

      await adapter.publish(event);

      const payload = mockPublisher.publish.mock.calls[0][1];
      const parsed = JSON.parse(payload);

      expect(parsed.data).toBeNull();
    });
  });
});
