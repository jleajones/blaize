/**
 * Unit tests for MockEventBus with assertion helpers
 *
 * Tests all new assertion methods and helper functions to ensure
 * they reduce test boilerplate and provide helpful error messages.
 *
 * Coverage target: 90%+
 */

import { createMockEventBus, createWorkingMockEventBus } from './event-bus';

import type { MockEventBusHelpers } from './event-bus';
import type { TypedEventBus, EventSchemas } from '@blaize-types/events';

type TestEventBus = TypedEventBus<EventSchemas> & MockEventBusHelpers;

describe('createMockEventBus', () => {
  let eventBus: TestEventBus;

  beforeEach(() => {
    eventBus = createMockEventBus();
  });

  describe('Basic event publishing', () => {
    it('should track published events', async () => {
      await eventBus.publish('user:created', { userId: '123' });

      expect(eventBus.publish).toHaveBeenCalledWith('user:created', { userId: '123' });
      const events = eventBus.getPublishedEvents();
      expect(events).toHaveLength(1);
      expect(events[0]!.type).toBe('user:created');
    });

    it('should track multiple events', async () => {
      await eventBus.publish('user:created', { userId: '123' });
      await eventBus.publish('user:updated', { userId: '123' });
      await eventBus.publish('user:deleted', { userId: '123' });

      const events = eventBus.getPublishedEvents();
      expect(events).toHaveLength(3);
    });

    it('should track events without data', async () => {
      await eventBus.publish('system:ready', undefined);

      const events = eventBus.getPublishedEvents();
      expect(events).toHaveLength(1);
      expect(events[0]!.data).toBeUndefined();
    });

    it('should include timestamp in tracked events', async () => {
      const before = Date.now();
      await eventBus.publish('user:created', { userId: '123' });
      const after = Date.now();

      const events = eventBus.getPublishedEvents();
      expect(events[0]!.timestamp).toBeGreaterThanOrEqual(before);
      expect(events[0]!.timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('assertPublished', () => {
    it('should pass when event exists', async () => {
      await eventBus.publish('user:created', { userId: '123' });

      expect(() => eventBus.assertPublished('user:created')).not.toThrow();
    });

    it('should throw when event missing', async () => {
      await eventBus.publish('user:created', { userId: '123' });

      expect(() => eventBus.assertPublished('user:deleted')).toThrow(
        'Expected event "user:deleted" was not published'
      );
    });

    it('should validate data with partial match', async () => {
      await eventBus.publish('user:created', {
        userId: '123',
        email: 'test@example.com',
        extra: 'data',
      });

      // Should pass with partial match
      expect(() => eventBus.assertPublished('user:created', { userId: '123' })).not.toThrow();
    });

    it('should validate data with exact match', async () => {
      await eventBus.publish('user:created', {
        userId: '123',
        email: 'test@example.com',
      });

      expect(() =>
        eventBus.assertPublished('user:created', {
          userId: '123',
          email: 'test@example.com',
        })
      ).not.toThrow();
    });

    it('should throw when data does not match', async () => {
      await eventBus.publish('user:created', { userId: '123' });

      expect(() => eventBus.assertPublished('user:created', { userId: '456' })).toThrow();
    });

    it('should show actual events in error message', async () => {
      await eventBus.publish('user:created', { userId: '123' });
      await eventBus.publish('user:updated', { userId: '123' });
      await eventBus.publish('user:deleted', { userId: '123' });

      try {
        eventBus.assertPublished('order:created');
        throw new Error('Should have thrown');
      } catch (error: any) {
        expect(error.message).toContain('user:created, user:updated, user:deleted');
        expect(error.message).toContain('Expected event "order:created" was not published');
      }
    });

    it('should show "none" when no events exist', async () => {
      try {
        eventBus.assertPublished('user:created');
        throw new Error('Should have thrown');
      } catch (error: any) {
        expect(error.message).toContain('Published events: [none]');
      }
    });

    it('should pass when data is undefined and not provided', async () => {
      await eventBus.publish('system:ready', undefined);

      expect(() => eventBus.assertPublished('system:ready')).not.toThrow();
    });

    it('should work with complex data objects', async () => {
      await eventBus.publish('order:placed', {
        orderId: 'order-123',
        items: [
          { id: 'item-1', quantity: 2 },
          { id: 'item-2', quantity: 1 },
        ],
        total: 99.99,
      });

      expect(() =>
        eventBus.assertPublished('order:placed', {
          orderId: 'order-123',
          total: 99.99,
        })
      ).not.toThrow();
    });

    it('should work with nested object matching', async () => {
      await eventBus.publish('user:profile:updated', {
        userId: '123',
        profile: {
          name: 'John Doe',
          settings: { theme: 'dark' },
        },
      });

      expect(() =>
        eventBus.assertPublished('user:profile:updated', {
          profile: { settings: { theme: 'dark' } },
        })
      ).not.toThrow();
    });

    it('should work with array data', async () => {
      await eventBus.publish('batch:processed', {
        ids: ['1', '2', '3'],
      });

      expect(() =>
        eventBus.assertPublished('batch:processed', { ids: ['1', '2', '3'] })
      ).not.toThrow();
    });
  });

  describe('assertNotPublished', () => {
    it('should pass when event was not published', async () => {
      await eventBus.publish('user:created', { userId: '123' });

      expect(() => eventBus.assertNotPublished('user:deleted')).not.toThrow();
    });

    it('should throw when event was published', async () => {
      await eventBus.publish('user:created', { userId: '123' });

      expect(() => eventBus.assertNotPublished('user:created')).toThrow(
        'Expected event "user:created" to NOT be published, but it was'
      );
    });

    it('should include event data in error message', async () => {
      await eventBus.publish('user:created', { userId: '123', email: 'test@example.com' });

      try {
        eventBus.assertNotPublished('user:created');
        throw new Error('Should have thrown');
      } catch (error: any) {
        expect(error.message).toContain('userId');
        expect(error.message).toContain('123');
      }
    });

    it('should pass when no events published at all', () => {
      expect(() => eventBus.assertNotPublished('user:created')).not.toThrow();
    });

    it('should distinguish between similar event types', async () => {
      await eventBus.publish('user:created', { userId: '123' });

      expect(() => eventBus.assertNotPublished('user:create')).not.toThrow();
      expect(() => eventBus.assertNotPublished('user:created:v2')).not.toThrow();
    });
  });

  describe('getPublishedEvents', () => {
    it('should return all events when no filter', async () => {
      await eventBus.publish('user:created', { userId: '123' });
      await eventBus.publish('order:placed', { orderId: '456' });
      await eventBus.publish('user:updated', { userId: '123' });

      const events = eventBus.getPublishedEvents();

      expect(events).toHaveLength(3);
      expect(events[0]!.type).toBe('user:created');
      expect(events[1]!.type).toBe('order:placed');
      expect(events[2]!.type).toBe('user:updated');
    });

    it('should filter events by type', async () => {
      await eventBus.publish('user:created', { userId: '123' });
      await eventBus.publish('order:placed', { orderId: '456' });
      await eventBus.publish('user:created', { userId: '789' });

      const userEvents = eventBus.getPublishedEvents('user:created');

      expect(userEvents).toHaveLength(2);
      expect(userEvents[0]!.data).toEqual({ userId: '123' });
      expect(userEvents[1]!.data).toEqual({ userId: '789' });
    });

    it('should return empty array when no events match filter', async () => {
      await eventBus.publish('user:created', { userId: '123' });

      const events = eventBus.getPublishedEvents('order:placed');

      expect(events).toEqual([]);
    });

    it('should return empty array when no events exist', () => {
      const events = eventBus.getPublishedEvents();

      expect(events).toEqual([]);
    });

    it('should include all event properties', async () => {
      await eventBus.publish('user:created', { userId: '123' });

      const events = eventBus.getPublishedEvents();

      expect(events[0]).toHaveProperty('type');
      expect(events[0]).toHaveProperty('data');
      expect(events[0]).toHaveProperty('timestamp');
    });

    it('should not mutate original events when returned array is modified', async () => {
      await eventBus.publish('user:created', { userId: '123' });

      const events = eventBus.getPublishedEvents();
      events.push({ type: 'fake:event', data: {}, timestamp: Date.now() });

      const freshEvents = eventBus.getPublishedEvents();
      expect(freshEvents).toHaveLength(1);
      expect(freshEvents[0]!.type).toBe('user:created');
    });

    it('should handle hundreds of events efficiently', async () => {
      for (let i = 0; i < 1000; i++) {
        await eventBus.publish('event:batch', { index: i });
      }

      const events = eventBus.getPublishedEvents('event:batch');
      expect(events).toHaveLength(1000);
    });
  });

  describe('clear', () => {
    it('should reset published events array', async () => {
      await eventBus.publish('user:created', { userId: '123' });
      await eventBus.publish('user:updated', { userId: '123' });

      eventBus.clear();

      const events = eventBus.getPublishedEvents();
      expect(events).toHaveLength(0);
    });

    it('should clear mock call state', async () => {
      await eventBus.publish('user:created', { userId: '123' });

      eventBus.clear();

      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('should allow publishing after clear', async () => {
      await eventBus.publish('user:created', { userId: '123' });
      eventBus.clear();
      await eventBus.publish('user:updated', { userId: '456' });

      const events = eventBus.getPublishedEvents();
      expect(events).toHaveLength(1);
      expect(events[0]!.type).toBe('user:updated');
    });

    it('should clear filters', async () => {
      await eventBus.publish('user:created', { userId: '123' });
      eventBus.clear();

      const events = eventBus.getPublishedEvents('user:created');
      expect(events).toHaveLength(0);
    });
  });

  describe('Mock methods', () => {
    it('should have publish as vitest spy', async () => {
      await eventBus.publish('test:event', { data: 'value' });

      expect(eventBus.publish).toHaveBeenCalledWith('test:event', { data: 'value' });
    });

    it('should have subscribe as vitest spy', () => {
      const handler = vi.fn();
      eventBus.subscribe('test:*', handler);

      expect(eventBus.subscribe).toHaveBeenCalledWith('test:*', handler);
    });

    it('should have setAdapter as vitest spy', async () => {
      await eventBus.setAdapter({} as any);

      expect(eventBus.setAdapter).toHaveBeenCalled();
    });

    it('should have disconnect as vitest spy', async () => {
      await eventBus.disconnect();

      expect(eventBus.disconnect).toHaveBeenCalled();
    });

    it('should have serverId property', () => {
      expect(eventBus.serverId).toBe('mock-eventbus-server');
    });

    it('should return unsubscribe function from subscribe', () => {
      const unsubscribe = eventBus.subscribe('test:*', vi.fn());

      expect(typeof unsubscribe).toBe('function');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty string event type', async () => {
      await eventBus.publish('', { data: 'value' });

      expect(() => eventBus.assertPublished('')).not.toThrow();
    });

    it('should handle event types with special characters', async () => {
      await eventBus.publish('user:email-verified', { userId: '123' });

      expect(() => eventBus.assertPublished('user:email-verified')).not.toThrow();
    });

    it('should handle very long event types', async () => {
      const longType = 'a'.repeat(1000);
      await eventBus.publish(longType, { data: 'value' });

      expect(() => eventBus.assertPublished(longType)).not.toThrow();
    });

    it('should handle data with null values', async () => {
      await eventBus.publish('event:null', { value: null });

      expect(() => eventBus.assertPublished('event:null', { value: null })).not.toThrow();
    });

    it('should handle data with undefined values', async () => {
      await eventBus.publish('event:undefined', { value: undefined });

      const events = eventBus.getPublishedEvents();
      expect(events[0]!.data).toHaveProperty('value');
    });

    it('should handle circular references in data', async () => {
      const circular: any = { name: 'test' };
      circular.self = circular;

      await eventBus.publish('event:circular', circular);

      const events = eventBus.getPublishedEvents();
      expect(events).toHaveLength(1);
    });
  });

  describe('Multiple assertions in sequence', () => {
    it('should handle multiple assertions on same event bus', async () => {
      await eventBus.publish('user:created', { userId: '123' });
      await eventBus.publish('order:placed', { orderId: '456' });
      await eventBus.publish('email:sent', { to: 'test@example.com' });

      expect(() => eventBus.assertPublished('user:created')).not.toThrow();
      expect(() => eventBus.assertPublished('order:placed')).not.toThrow();
      expect(() => eventBus.assertPublished('email:sent')).not.toThrow();
    });

    it('should handle assertions in any order', async () => {
      await eventBus.publish('first', {});
      await eventBus.publish('second', {});
      await eventBus.publish('third', {});

      expect(() => eventBus.assertPublished('third')).not.toThrow();
      expect(() => eventBus.assertPublished('first')).not.toThrow();
      expect(() => eventBus.assertPublished('second')).not.toThrow();
    });
  });

  describe('TypeScript generics', () => {
    it('should work with typed event schemas', async () => {
      // Note: EventSchemas maps to Zod types, but the mock doesn't enforce validation
      // This test just verifies the generic typing compiles correctly
      const typedBus = createMockEventBus();

      await typedBus.publish('user:created', { userId: '123' });
      await typedBus.publish('order:placed', { orderId: '456', total: 99.99 });

      expect(() => typedBus.assertPublished('user:created', { userId: '123' })).not.toThrow();
      expect(() => typedBus.assertPublished('order:placed', { total: 99.99 })).not.toThrow();
    });
  });

  describe('Overrides', () => {
    it('should accept method overrides', () => {
      const customPublish = vi.fn();
      const eventBus = createMockEventBus({ publish: customPublish });

      expect(eventBus.publish).toBe(customPublish);
    });

    it('should merge overrides with default implementation', async () => {
      const customServerId = 'custom-server-id';
      const eventBus = createMockEventBus({ serverId: customServerId });

      expect(eventBus.serverId).toBe(customServerId);
      expect(eventBus.publish).toBeDefined();
      expect(eventBus.assertPublished).toBeDefined();
    });
  });
});

describe('createWorkingMockEventBus', () => {
  let eventBus: ReturnType<typeof createWorkingMockEventBus>;

  beforeEach(() => {
    eventBus = createWorkingMockEventBus('test-server');
  });

  describe('Pub/Sub functionality', () => {
    it('should call subscribers when event published', async () => {
      const handler = vi.fn();
      eventBus.subscribe('user:created', handler);

      await eventBus.publish('user:created', { userId: '123' });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'user:created',
          data: { userId: '123' },
          serverId: 'test-server',
        })
      );
    });

    it('should support wildcard subscriptions', async () => {
      const handler = vi.fn();
      eventBus.subscribe('user:*', handler);

      await eventBus.publish('user:created', { userId: '123' });
      await eventBus.publish('user:updated', { userId: '456' });
      await eventBus.publish('order:placed', { orderId: '789' });

      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('should support global wildcard', async () => {
      const handler = vi.fn();
      eventBus.subscribe('*', handler);

      await eventBus.publish('user:created', {});
      await eventBus.publish('order:placed', {});

      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('should unsubscribe correctly', async () => {
      const handler = vi.fn();
      const unsubscribe = eventBus.subscribe('user:created', handler);

      await eventBus.publish('user:created', {});
      expect(handler).toHaveBeenCalledTimes(1);

      unsubscribe();

      await eventBus.publish('user:created', {});
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple subscribers', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      eventBus.subscribe('user:created', handler1);
      eventBus.subscribe('user:created', handler2);

      await eventBus.publish('user:created', { userId: '123' });

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('should use provided serverId', () => {
      expect(eventBus.serverId).toBe('test-server');
    });

    it('should default to "mock-server" if no serverId provided', () => {
      const bus = createWorkingMockEventBus();
      expect(bus.serverId).toBe('mock-server');
    });
  });
});
