/**
 * Tests for MemoryEventBus
 *
 * Comprehensive test suite covering:
 * - Pattern matching (exact, glob, regex)
 * - Event metadata population
 * - Handler error isolation
 * - Adapter delegation
 * - Self-filtering
 * - Edge cases
 */

import { MemoryEventBus } from './memory-event-bus';
import { withCorrelationId } from '../tracing/correlation';

import type { EventBusAdapter, BlaizeEvent, Unsubscribe } from '@blaize-types';

// =============================================================================
// Mock Adapter
// =============================================================================

class MockAdapter implements EventBusAdapter {
  public connected = false;
  public publishedEvents: BlaizeEvent[] = [];
  private subscriptions: Map<string, (event: BlaizeEvent) => void> = new Map();

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.subscriptions.clear();
  }

  async publish(event: BlaizeEvent): Promise<void> {
    if (!this.connected) {
      throw new Error('Not connected');
    }
    this.publishedEvents.push(event);
  }

  async subscribe(pattern: string, handler: (event: BlaizeEvent) => void): Promise<Unsubscribe> {
    const id = Math.random().toString(36);
    this.subscriptions.set(id, handler);

    return () => {
      this.subscriptions.delete(id);
    };
  }

  // Test helper to simulate incoming events from adapter
  simulateIncomingEvent(event: BlaizeEvent): void {
    for (const handler of this.subscriptions.values()) {
      handler(event);
    }
  }
}

// =============================================================================
// Tests
// =============================================================================

describe('MemoryEventBus', () => {
  let bus: MemoryEventBus;

  beforeEach(() => {
    bus = new MemoryEventBus('test-server');
  });

  afterEach(async () => {
    await bus.disconnect();
  });

  // ===========================================================================
  // Constructor & Basic Properties
  // ===========================================================================

  describe('Constructor', () => {
    it('should create bus with provided serverId', () => {
      const bus = new MemoryEventBus('custom-server');
      expect(bus.serverId).toBe('custom-server');
    });

    it('should generate UUID serverId if not provided', () => {
      const bus = new MemoryEventBus();
      expect(bus.serverId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
    });

    it('should have serverId as readonly property', () => {
      const bus = new MemoryEventBus('test');
      expect(bus.serverId).toBe('test');

      // TypeScript readonly is compile-time only
      // Verify it's set but we can't test runtime immutability
      // The TypeScript compiler prevents direct assignment
    });

    it('should accept optional logger and create child logger', () => {
      const mockLogger = {
        child: vi.fn().mockReturnThis(),
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        flush: vi.fn().mockResolvedValue(undefined),
      };

      const _bus = new MemoryEventBus('test-server', mockLogger as any);

      expect(mockLogger.child).toHaveBeenCalledWith({
        component: 'EventBus',
        serverId: 'test-server',
      });
    });

    it('should create default logger with child if none provided', () => {
      // This just ensures it doesn't throw
      const bus = new MemoryEventBus('test-server');
      expect(bus.serverId).toBe('test-server');
    });
  });

  // ===========================================================================
  // Publish - Basic Functionality
  // ===========================================================================

  describe('publish()', () => {
    it('should publish event to matching subscribers', async () => {
      const handler = vi.fn();
      bus.subscribe('user:created', handler);

      await bus.publish('user:created', { userId: '123' });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'user:created',
          data: { userId: '123' },
          serverId: 'test-server',
        })
      );
    });

    it('should publish event without data', async () => {
      const handler = vi.fn();
      bus.subscribe('system:ready', handler);

      await bus.publish('system:ready');

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'system:ready',
          data: undefined,
        })
      );
    });

    it('should auto-populate timestamp', async () => {
      const handler = vi.fn();
      bus.subscribe('test', handler);

      const before = Date.now();
      await bus.publish('test', {});
      const after = Date.now();

      expect(handler).toHaveBeenCalledTimes(1);
      const event = handler.mock.calls[0]![0];
      expect(event.timestamp).toBeGreaterThanOrEqual(before);
      expect(event.timestamp).toBeLessThanOrEqual(after);
    });

    it('should auto-populate serverId', async () => {
      const handler = vi.fn();
      bus.subscribe('test', handler);

      await bus.publish('test', {});

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          serverId: 'test-server',
        })
      );
    });

    it('should auto-populate correlationId from AsyncLocalStorage', async () => {
      const handler = vi.fn();
      bus.subscribe('test', handler);

      await withCorrelationId('test-correlation-id', async () => {
        await bus.publish('test', {});
      });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          correlationId: 'test-correlation-id',
        })
      );
    });

    it('should use "unknown" correlationId when not in AsyncLocalStorage', async () => {
      const handler = vi.fn();
      bus.subscribe('test', handler);

      await bus.publish('test', {});

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          correlationId: 'unknown',
        })
      );
    });

    it('should not error when no subscribers match', async () => {
      await expect(bus.publish('no-subscribers', {})).resolves.toBeUndefined();
    });

    it('should throw error for empty event type', async () => {
      await expect(bus.publish('', {})).rejects.toThrow('Event type cannot be empty');
    });

    it('should throw error for whitespace-only event type', async () => {
      await expect(bus.publish('   ', {})).rejects.toThrow('Event type cannot be empty');
    });
  });

  // ===========================================================================
  // Subscribe - Pattern Matching
  // ===========================================================================

  describe('subscribe() - Exact Pattern Matching', () => {
    it('should match exact event type', async () => {
      const handler = vi.fn();
      bus.subscribe('user:created', handler);

      await bus.publish('user:created', {});
      await bus.publish('user:updated', {});

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should match event type with special characters', async () => {
      const handler = vi.fn();
      bus.subscribe('user.profile:updated', handler);

      await bus.publish('user.profile:updated', {});

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('subscribe() - Glob Pattern Matching', () => {
    it('should match wildcard at end', async () => {
      const handler = vi.fn();
      bus.subscribe('user:*', handler);

      await bus.publish('user:created', {});
      await bus.publish('user:updated', {});
      await bus.publish('user:deleted', {});
      await bus.publish('order:created', {});

      expect(handler).toHaveBeenCalledTimes(3);
    });

    it('should match all events with single wildcard', async () => {
      const handler = vi.fn();
      bus.subscribe('*', handler);

      await bus.publish('user:created', {});
      await bus.publish('order:placed', {});
      await bus.publish('system:ready', {});

      expect(handler).toHaveBeenCalledTimes(3);
    });

    it('should not match across namespace boundaries', async () => {
      const handler = vi.fn();
      bus.subscribe('user:*', handler);

      await bus.publish('user:created', {});
      await bus.publish('user:profile:updated', {}); // Has nested colon

      // Should only match first one (wildcard doesn't cross colons)
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should handle pattern with dots correctly', async () => {
      const handler = vi.fn();
      bus.subscribe('cache.user:*', handler);

      await bus.publish('cache.user:set', {});
      await bus.publish('cache.user:get', {});
      await bus.publish('cache.order:set', {}); // Different prefix

      expect(handler).toHaveBeenCalledTimes(2);
    });
  });

  describe('subscribe() - RegExp Pattern Matching', () => {
    it('should match regex pattern', async () => {
      const handler = vi.fn();
      bus.subscribe(/^user:/, handler);

      await bus.publish('user:created', {});
      await bus.publish('user:updated', {});
      await bus.publish('order:created', {});

      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('should match complex regex pattern', async () => {
      const handler = vi.fn();
      bus.subscribe(/^(user|admin):(created|updated)$/, handler);

      await bus.publish('user:created', {});
      await bus.publish('user:updated', {});
      await bus.publish('admin:created', {});
      await bus.publish('user:deleted', {}); // Not in pattern
      await bus.publish('guest:created', {}); // Not in pattern

      expect(handler).toHaveBeenCalledTimes(3);
    });

    it('should match case-sensitive regex', async () => {
      const handler = vi.fn();
      bus.subscribe(/^User:/, handler);

      await bus.publish('User:created', {});
      await bus.publish('user:created', {}); // Lowercase

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('subscribe() - Edge Cases', () => {
    it('should throw error for empty string pattern', () => {
      expect(() => {
        bus.subscribe('', vi.fn());
      }).toThrow('Pattern cannot be empty');
    });

    it('should throw error for whitespace-only pattern', () => {
      expect(() => {
        bus.subscribe('   ', vi.fn());
      }).toThrow('Pattern cannot be empty');
    });

    it('should handle very long event type (>1000 chars)', async () => {
      const longType = 'a'.repeat(1500);
      const handler = vi.fn();
      bus.subscribe(longType, handler);

      await bus.publish(longType, {});

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should allow subscription during event dispatch', async () => {
      const handler1 = vi.fn(async () => {
        // Subscribe to another pattern during handler execution
        bus.subscribe('nested:event', vi.fn());
        await bus.publish('nested:event', {});
      });

      bus.subscribe('trigger:event', handler1);
      await bus.publish('trigger:event', {});

      expect(handler1).toHaveBeenCalledTimes(1);
    });
  });

  // ===========================================================================
  // Unsubscribe
  // ===========================================================================

  describe('unsubscribe()', () => {
    it('should return unsubscribe function', () => {
      const unsubscribe = bus.subscribe('test', vi.fn());
      expect(typeof unsubscribe).toBe('function');
    });

    it('should stop receiving events after unsubscribe', async () => {
      const handler = vi.fn();
      const unsubscribe = bus.subscribe('test', handler);

      await bus.publish('test', {});
      expect(handler).toHaveBeenCalledTimes(1);

      unsubscribe();

      await bus.publish('test', {});
      expect(handler).toHaveBeenCalledTimes(1); // Still 1
    });

    it('should be idempotent (safe to call multiple times)', () => {
      const handler = vi.fn();
      const unsubscribe = bus.subscribe('test', handler);

      unsubscribe();
      unsubscribe();
      unsubscribe();

      // Should not throw
    });

    it('should not affect other subscriptions', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      const unsubscribe1 = bus.subscribe('test', handler1);
      bus.subscribe('test', handler2);

      unsubscribe1();

      await bus.publish('test', {});

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledTimes(1);
    });
  });

  // ===========================================================================
  // Multiple Subscribers
  // ===========================================================================

  describe('Multiple Subscribers', () => {
    it('should call all matching handlers', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      bus.subscribe('test', handler1);
      bus.subscribe('test', handler2);
      bus.subscribe('test', handler3);

      await bus.publish('test', { value: 1 });

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
      expect(handler3).toHaveBeenCalledTimes(1);
    });

    it('should call handlers for overlapping patterns', async () => {
      const exactHandler = vi.fn();
      const wildcardHandler = vi.fn();
      const regexHandler = vi.fn();

      bus.subscribe('user:created', exactHandler);
      bus.subscribe('user:*', wildcardHandler);
      bus.subscribe(/^user:/, regexHandler);

      await bus.publish('user:created', {});

      expect(exactHandler).toHaveBeenCalledTimes(1);
      expect(wildcardHandler).toHaveBeenCalledTimes(1);
      expect(regexHandler).toHaveBeenCalledTimes(1);
    });

    it('should call handlers in parallel', async () => {
      const delays: number[] = [];
      const createDelayedHandler = (delay: number) => async () => {
        await new Promise(resolve => setTimeout(resolve, delay));
        delays.push(delay);
      };

      bus.subscribe('test', createDelayedHandler(30));
      bus.subscribe('test', createDelayedHandler(20));
      bus.subscribe('test', createDelayedHandler(10));

      await bus.publish('test', {});
      expect(delays).toHaveLength(3);
    });
  });

  // ===========================================================================
  // Error Handling
  // ===========================================================================

  describe('Error Handling', () => {
    it('should catch synchronous handler errors', async () => {
      const errorHandler = vi.fn(() => {
        throw new Error('Sync error');
      });
      const successHandler = vi.fn();

      bus.subscribe('test', errorHandler);
      bus.subscribe('test', successHandler);

      // Should not throw
      await expect(bus.publish('test', {})).resolves.toBeUndefined();

      // Success handler should still be called
      expect(successHandler).toHaveBeenCalledTimes(1);
    });

    it('should catch async handler errors', async () => {
      const errorHandler = vi.fn(async () => {
        throw new Error('Async error');
      });
      const successHandler = vi.fn();

      bus.subscribe('test', errorHandler);
      bus.subscribe('test', successHandler);

      await expect(bus.publish('test', {})).resolves.toBeUndefined();

      expect(successHandler).toHaveBeenCalledTimes(1);
    });

    it('should not crash bus when handler throws', async () => {
      const errorHandler = vi.fn(() => {
        throw new Error('Handler error');
      });

      bus.subscribe('test', errorHandler);

      // First publish should not crash
      await bus.publish('test', { attempt: 1 });

      // Bus should still work for subsequent publishes
      await bus.publish('test', { attempt: 2 });

      expect(errorHandler).toHaveBeenCalledTimes(2);
    });

    it('should handle error in one handler without affecting others', async () => {
      const handler1 = vi.fn();
      const errorHandler = vi.fn(() => {
        throw new Error('Error in handler 2');
      });
      const handler3 = vi.fn();

      bus.subscribe('test', handler1);
      bus.subscribe('test', errorHandler);
      bus.subscribe('test', handler3);

      await bus.publish('test', {});

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(errorHandler).toHaveBeenCalledTimes(1);
      expect(handler3).toHaveBeenCalledTimes(1);
    });
  });

  // ===========================================================================
  // Adapter Integration
  // ===========================================================================

  describe('setAdapter()', () => {
    let adapter: MockAdapter;

    beforeEach(() => {
      adapter = new MockAdapter();
    });

    it('should connect adapter', async () => {
      await bus.setAdapter(adapter);

      expect(adapter.connected).toBe(true);
    });

    it('should delegate publish to adapter', async () => {
      await bus.setAdapter(adapter);

      await bus.publish('test', { value: 1 });

      expect(adapter.publishedEvents).toHaveLength(1);
      expect(adapter.publishedEvents[0]).toMatchObject({
        type: 'test',
        data: { value: 1 },
        serverId: 'test-server',
      });
    });

    it('should receive events from adapter', async () => {
      await bus.setAdapter(adapter);

      const handler = vi.fn();
      bus.subscribe('remote:event', handler);

      // Simulate event from another server
      adapter.simulateIncomingEvent({
        type: 'remote:event',
        data: { from: 'remote' },
        timestamp: Date.now(),
        serverId: 'remote-server',
        correlationId: 'remote-corr',
      });

      // Small delay for async processing
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'remote:event',
          serverId: 'remote-server',
        })
      );
    });

    it('should filter own serverId events from adapter (self-filtering)', async () => {
      await bus.setAdapter(adapter);

      const handler = vi.fn();
      bus.subscribe('test', handler);

      // Simulate echo of own event from adapter
      adapter.simulateIncomingEvent({
        type: 'test',
        data: {},
        timestamp: Date.now(),
        serverId: 'test-server', // Same as bus.serverId
        correlationId: 'test-corr',
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      // Should NOT be called (filtered out)
      expect(handler).not.toHaveBeenCalled();
    });

    it('should disconnect old adapter when setting new one', async () => {
      const adapter1 = new MockAdapter();
      const adapter2 = new MockAdapter();

      await bus.setAdapter(adapter1);
      expect(adapter1.connected).toBe(true);

      await bus.setAdapter(adapter2);
      expect(adapter1.connected).toBe(false);
      expect(adapter2.connected).toBe(true);
    });

    it('should continue local delivery even if adapter publish fails', async () => {
      adapter.publish = vi.fn().mockRejectedValue(new Error('Adapter error'));
      await bus.setAdapter(adapter);

      const handler = vi.fn();
      bus.subscribe('test', handler);

      await bus.publish('test', {});

      // Local handler should still be called
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  // ===========================================================================
  // disconnect()
  // ===========================================================================

  describe('disconnect()', () => {
    it('should disconnect adapter', async () => {
      const adapter = new MockAdapter();
      await bus.setAdapter(adapter);

      await bus.disconnect();

      expect(adapter.connected).toBe(false);
    });

    it('should clear all subscriptions', async () => {
      const handler = vi.fn();
      bus.subscribe('test', handler);

      await bus.disconnect();
      await bus.publish('test', {});

      expect(handler).not.toHaveBeenCalled();
    });

    it('should not throw if no adapter set', async () => {
      await expect(bus.disconnect()).resolves.toBeUndefined();
    });

    it('should handle adapter disconnect errors gracefully', async () => {
      const adapter = new MockAdapter();
      adapter.disconnect = vi.fn().mockRejectedValue(new Error('Disconnect error'));

      await bus.setAdapter(adapter);

      // Should not throw
      await expect(bus.disconnect()).resolves.toBeUndefined();
    });
  });

  // ===========================================================================
  // Memory Leaks
  // ===========================================================================

  describe('Memory Leak Prevention', () => {
    it('should not leak subscriptions after unsubscribe', async () => {
      const handler = vi.fn();

      // Subscribe and unsubscribe many times
      for (let i = 0; i < 1000; i++) {
        const unsubscribe = bus.subscribe('test', handler);
        unsubscribe();
      }

      // Publish event
      await bus.publish('test', {});

      // No handlers should be called
      expect(handler).not.toHaveBeenCalled();
    });

    it('should clean up adapter subscription on disconnect', async () => {
      const adapter = new MockAdapter();
      await bus.setAdapter(adapter);

      const subscriptionCountBefore = adapter['subscriptions'].size;

      await bus.disconnect();

      const subscriptionCountAfter = adapter['subscriptions'].size;

      expect(subscriptionCountBefore).toBeGreaterThan(0);
      expect(subscriptionCountAfter).toBe(0);
    });
  });

  // ===========================================================================
  // Integration Scenarios
  // ===========================================================================

  describe('Integration Scenarios', () => {
    it('should handle complex workflow with multiple patterns', async () => {
      const events: string[] = [];

      bus.subscribe('user:*', event => {
        events.push(`wildcard:${event.type}`);
      });

      bus.subscribe(/created$/, event => {
        events.push(`regex:${event.type}`);
      });

      bus.subscribe('user:created', event => {
        events.push(`exact:${event.type}`);
      });

      await bus.publish('user:created', {});

      expect(events).toEqual(['wildcard:user:created', 'regex:user:created', 'exact:user:created']);
    });

    it('should support event-driven orchestration', async () => {
      const workflow: string[] = [];

      bus.subscribe('order:placed', async event => {
        workflow.push('1:order-placed');
        await bus.publish('payment:process', event.data);
      });

      bus.subscribe('payment:process', async event => {
        workflow.push('2:payment-processing');
        await bus.publish('inventory:reserve', event.data);
      });

      bus.subscribe('inventory:reserve', async event => {
        workflow.push('3:inventory-reserved');
        await bus.publish('order:confirmed', event.data);
      });

      bus.subscribe('order:confirmed', _event => {
        workflow.push('4:order-confirmed');
      });

      await bus.publish('order:placed', { orderId: '123' });

      // Small delay for async chain
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(workflow).toEqual([
        '1:order-placed',
        '2:payment-processing',
        '3:inventory-reserved',
        '4:order-confirmed',
      ]);
    });
  });
});
