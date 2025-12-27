/**
 * Type-level tests for EventBus types
 *
 * These tests verify that the type definitions compile correctly
 * and handle various edge cases properly.
 *
 * @module @blaizejs/types/events.test
 */

import { describe, it, expectTypeOf } from 'vitest';
import { z } from 'zod';

import type {
  EventSchemas,
  BlaizeEvent,
  EventHandler,
  Unsubscribe,
  EventBusAdapter,
  EventBus,
} from '@blaize-types/events';

describe('EventBus Types', () => {
  describe('EventSchemas', () => {
    it('should accept Record of Zod schemas', () => {
      const schemas = {
        'user:created': z.object({ userId: z.string() }),
        'order:placed': z.object({ orderId: z.string(), total: z.number() }),
      } satisfies EventSchemas;

      expectTypeOf(schemas).toMatchTypeOf<EventSchemas>();
    });

    it('should accept any Zod type', () => {
      const schemas = {
        string: z.string(),
        number: z.number(),
        boolean: z.boolean(),
        object: z.object({ id: z.string() }),
        array: z.array(z.string()),
        union: z.union([z.string(), z.number()]),
        optional: z.string().optional(),
      } satisfies EventSchemas;

      expectTypeOf(schemas).toMatchTypeOf<EventSchemas>();
    });

    it('should allow empty schema map', () => {
      const schemas = {} satisfies EventSchemas;

      expectTypeOf(schemas).toMatchTypeOf<EventSchemas>();
    });
  });

  describe('BlaizeEvent', () => {
    it('should require all core fields', () => {
      const event: BlaizeEvent = {
        type: 'user:created',
        data: { userId: '123' },
        timestamp: Date.now(),
        serverId: 'server-1',
      };

      expectTypeOf(event).toMatchTypeOf<BlaizeEvent>();
    });

    it('should allow optional correlationId', () => {
      const event: BlaizeEvent = {
        type: 'user:created',
        data: { userId: '123' },
        timestamp: Date.now(),
        serverId: 'server-1',
        correlationId: 'req-123',
      };

      expectTypeOf(event).toMatchTypeOf<BlaizeEvent>();
    });

    it('should support typed data with generics', () => {
      interface UserData {
        userId: string;
        email: string;
      }

      const event: BlaizeEvent<UserData> = {
        type: 'user:created',
        data: { userId: '123', email: 'user@example.com' },
        timestamp: Date.now(),
        serverId: 'server-1',
      };

      expectTypeOf(event.data).toEqualTypeOf<UserData>();
    });

    it('should handle undefined data', () => {
      const event: BlaizeEvent<undefined> = {
        type: 'system:ready',
        data: undefined,
        timestamp: Date.now(),
        serverId: 'server-1',
      };

      expectTypeOf(event.data).toEqualTypeOf<undefined>();
    });

    it('should handle null data', () => {
      const event: BlaizeEvent<null> = {
        type: 'cache:cleared',
        data: null,
        timestamp: Date.now(),
        serverId: 'server-1',
      };

      expectTypeOf(event.data).toEqualTypeOf<null>();
    });

    it('should handle empty object data', () => {
      // eslint-disable-next-line @typescript-eslint/no-empty-object-type
      const event: BlaizeEvent<{}> = {
        type: 'heartbeat',
        data: {},
        timestamp: Date.now(),
        serverId: 'server-1',
      };

      // eslint-disable-next-line @typescript-eslint/no-empty-object-type
      expectTypeOf(event.data).toEqualTypeOf<{}>();
    });

    it('should handle primitive data types', () => {
      const stringEvent: BlaizeEvent<string> = {
        type: 'message',
        data: 'hello',
        timestamp: Date.now(),
        serverId: 'server-1',
      };

      const numberEvent: BlaizeEvent<number> = {
        type: 'counter',
        data: 42,
        timestamp: Date.now(),
        serverId: 'server-1',
      };

      const booleanEvent: BlaizeEvent<boolean> = {
        type: 'flag',
        data: true,
        timestamp: Date.now(),
        serverId: 'server-1',
      };

      expectTypeOf(stringEvent.data).toEqualTypeOf<string>();
      expectTypeOf(numberEvent.data).toEqualTypeOf<number>();
      expectTypeOf(booleanEvent.data).toEqualTypeOf<boolean>();
    });

    it('should handle array data', () => {
      const event: BlaizeEvent<string[]> = {
        type: 'batch:items',
        data: ['item1', 'item2'],
        timestamp: Date.now(),
        serverId: 'server-1',
      };

      expectTypeOf(event.data).toEqualTypeOf<string[]>();
    });

    it('should handle long event type names', () => {
      // Edge case: Very long type name (>256 chars)
      const longType = 'a'.repeat(300);
      const event: BlaizeEvent = {
        type: longType,
        data: {},
        timestamp: Date.now(),
        serverId: 'server-1',
      };

      expectTypeOf(event.type).toEqualTypeOf<string>();
    });

    it('should handle event types with special characters', () => {
      const specialCharsEvent: BlaizeEvent = {
        type: 'user:created:v2.0',
        data: {},
        timestamp: Date.now(),
        serverId: 'server-1',
      };

      const emojiEvent: BlaizeEvent = {
        type: '🎉:celebration',
        data: {},
        timestamp: Date.now(),
        serverId: 'server-1',
      };

      expectTypeOf(specialCharsEvent.type).toEqualTypeOf<string>();
      expectTypeOf(emojiEvent.type).toEqualTypeOf<string>();
    });

    it('should default to unknown when no generic provided', () => {
      const event: BlaizeEvent = {
        type: 'generic:event',
        data: { anything: 'goes' },
        timestamp: Date.now(),
        serverId: 'server-1',
      };

      expectTypeOf(event.data).toEqualTypeOf<unknown>();
    });
  });

  describe('EventHandler', () => {
    it('should accept sync handler', () => {
      const handler: EventHandler = event => {
        console.log(event.type);
      };

      expectTypeOf(handler).toMatchTypeOf<EventHandler>();
    });

    it('should accept async handler', () => {
      const handler: EventHandler = async event => {
        await Promise.resolve();
        console.log(event.type);
      };

      expectTypeOf(handler).toMatchTypeOf<EventHandler>();
    });

    it('should accept typed handler', () => {
      interface UserData {
        userId: string;
      }

      const handler: EventHandler<UserData> = event => {
        expectTypeOf(event.data).toEqualTypeOf<UserData>();
        console.log(event.data.userId);
      };

      expectTypeOf(handler).toMatchTypeOf<EventHandler<UserData>>();
    });

    it('should accept handler with no return', () => {
      const handler: EventHandler = event => {
        console.log(event.type);
        // No explicit return
      };

      expectTypeOf(handler).toMatchTypeOf<EventHandler>();
    });

    it('should accept handler returning void explicitly', () => {
      const handler: EventHandler = (event): void => {
        console.log(event.type);
      };

      expectTypeOf(handler).toMatchTypeOf<EventHandler>();
    });

    it('should accept handler returning Promise<void>', () => {
      const handler: EventHandler = async (event): Promise<void> => {
        await Promise.resolve();
        console.log(event.type);
      };

      expectTypeOf(handler).toMatchTypeOf<EventHandler>();
    });

    it('should default to unknown when no generic provided', () => {
      const handler: EventHandler = event => {
        expectTypeOf(event.data).toEqualTypeOf<unknown>();
      };

      expectTypeOf(handler).toMatchTypeOf<EventHandler>();
    });
  });

  describe('Unsubscribe', () => {
    it('should be a function with no parameters', () => {
      const unsubscribe: Unsubscribe = () => {
        // Cleanup logic
      };

      expectTypeOf(unsubscribe).toMatchTypeOf<Unsubscribe>();
      expectTypeOf(unsubscribe).parameters.toEqualTypeOf<[]>();
    });

    it('should return void', () => {
      const unsubscribe: Unsubscribe = () => {
        return undefined;
      };

      expectTypeOf(unsubscribe).returns.toEqualTypeOf<void>();
    });
  });

  describe('EventBusAdapter', () => {
    it('should require all core methods', () => {
      const adapter: EventBusAdapter = {
        connect: async () => {},
        disconnect: async () => {},
        publish: async _event => {},
        subscribe: async (_pattern, _handler) => () => {},
      };

      expectTypeOf(adapter).toMatchTypeOf<EventBusAdapter>();
    });

    it('should allow optional healthCheck', () => {
      const adapterWithHealth: EventBusAdapter = {
        connect: async () => {},
        disconnect: async () => {},
        publish: async _event => {},
        subscribe: async (_pattern, _handler) => () => {},
        healthCheck: async () => ({ healthy: true }),
      };

      const adapterWithoutHealth: EventBusAdapter = {
        connect: async () => {},
        disconnect: async () => {},
        publish: async _event => {},
        subscribe: async (_pattern, _handler) => () => {},
      };

      expectTypeOf(adapterWithHealth).toMatchTypeOf<EventBusAdapter>();
      expectTypeOf(adapterWithoutHealth).toMatchTypeOf<EventBusAdapter>();
    });

    it('should accept healthCheck with message', () => {
      const adapter: EventBusAdapter = {
        connect: async () => {},
        disconnect: async () => {},
        publish: async _event => {},
        subscribe: async (_pattern, _handler) => () => {},
        healthCheck: async () => ({
          healthy: false,
          message: 'Connection timeout',
        }),
      };

      expectTypeOf(adapter).toMatchTypeOf<EventBusAdapter>();
    });

    it('should require Promise return types', () => {
      const adapter: EventBusAdapter = {
        connect: async () => {},
        disconnect: async () => {},
        publish: async _event => {},
        subscribe: async (_pattern, _handler) => () => {},
      };

      expectTypeOf(adapter.connect).returns.toEqualTypeOf<Promise<void>>();
      expectTypeOf(adapter.disconnect).returns.toEqualTypeOf<Promise<void>>();
      expectTypeOf(adapter.publish).returns.toEqualTypeOf<Promise<void>>();
      expectTypeOf(adapter.subscribe).returns.toEqualTypeOf<Promise<Unsubscribe>>();
    });

    it('should accept BlaizeEvent in publish', () => {
      const adapter: EventBusAdapter = {
        connect: async () => {},
        disconnect: async () => {},
        publish: async (event: BlaizeEvent) => {
          expectTypeOf(event).toMatchTypeOf<BlaizeEvent>();
        },
        subscribe: async (_pattern, _handler) => () => {},
      };

      expectTypeOf(adapter).toMatchTypeOf<EventBusAdapter>();
    });

    it('should accept string pattern and EventHandler in subscribe', () => {
      const adapter: EventBusAdapter = {
        connect: async () => {},
        disconnect: async () => {},
        publish: async _event => {},
        subscribe: async (pattern: string, handler: EventHandler) => {
          expectTypeOf(pattern).toEqualTypeOf<string>();
          expectTypeOf(handler).toMatchTypeOf<EventHandler>();
          return () => {};
        },
      };

      expectTypeOf(adapter).toMatchTypeOf<EventBusAdapter>();
    });
  });

  describe('EventBus', () => {
    it('should require all core methods and properties', () => {
      const eventBus: EventBus = {
        publish: async (_type, _data?) => {},
        subscribe: (_pattern, _handler) => () => {},
        setAdapter: async _adapter => {},
        disconnect: async () => {},
        serverId: 'server-1',
      };

      expectTypeOf(eventBus).toMatchTypeOf<EventBus>();
    });

    it('should require serverId to be readonly', () => {
      interface TestEventBus {
        readonly serverId: string;
      }

      expectTypeOf<EventBus>().toMatchTypeOf<TestEventBus>();
    });

    it('should accept optional data in publish', () => {
      const eventBus: EventBus = {
        publish: async (type: string, data?: unknown) => {
          expectTypeOf(type).toEqualTypeOf<string>();
          expectTypeOf(data).toEqualTypeOf<unknown>();
        },
        subscribe: (_pattern, _handler) => () => {},
        setAdapter: async _adapter => {},
        disconnect: async () => {},
        serverId: 'server-1',
      };

      expectTypeOf(eventBus).toMatchTypeOf<EventBus>();
    });

    it('should accept string or RegExp pattern in subscribe', () => {
      const eventBus: EventBus = {
        publish: async (_type, _data?) => {},
        subscribe: (pattern: string | RegExp, handler: EventHandler) => {
          expectTypeOf(pattern).toEqualTypeOf<string | RegExp>();
          expectTypeOf(handler).toMatchTypeOf<EventHandler>();
          return () => {};
        },
        setAdapter: async _adapter => {},
        disconnect: async () => {},
        serverId: 'server-1',
      };

      expectTypeOf(eventBus).toMatchTypeOf<EventBus>();
    });

    it('should return Unsubscribe from subscribe', () => {
      const eventBus: EventBus = {
        publish: async (_type, _data?) => {},
        subscribe: (_pattern, _handler) => () => {},
        setAdapter: async _adapter => {},
        disconnect: async () => {},
        serverId: 'server-1',
      };

      expectTypeOf(eventBus.subscribe).returns.toEqualTypeOf<Unsubscribe>();
    });

    it('should accept EventBusAdapter in setAdapter', () => {
      const eventBus: EventBus = {
        publish: async (_type, _data?) => {},
        subscribe: (_pattern, _handler) => () => {},
        setAdapter: async (adapter: EventBusAdapter) => {
          expectTypeOf(adapter).toMatchTypeOf<EventBusAdapter>();
        },
        disconnect: async () => {},
        serverId: 'server-1',
      };

      expectTypeOf(eventBus).toMatchTypeOf<EventBus>();
    });

    it('should require Promise return types for async methods', () => {
      const eventBus: EventBus = {
        publish: async (_type, _data?) => {},
        subscribe: (_pattern, _handler) => () => {},
        setAdapter: async _adapter => {},
        disconnect: async () => {},
        serverId: 'server-1',
      };

      expectTypeOf(eventBus.publish).returns.toEqualTypeOf<Promise<void>>();
      expectTypeOf(eventBus.setAdapter).returns.toEqualTypeOf<Promise<void>>();
      expectTypeOf(eventBus.disconnect).returns.toEqualTypeOf<Promise<void>>();
    });
  });

  describe('Edge Cases', () => {
    it('should handle event with all optional fields omitted except required', () => {
      const minimalEvent: BlaizeEvent = {
        type: 'minimal',
        data: undefined,
        timestamp: Date.now(),
        serverId: 'server-1',
      };

      expectTypeOf(minimalEvent).toMatchTypeOf<BlaizeEvent>();
    });

    it('should handle complex nested data types', () => {
      interface ComplexData {
        user: {
          id: string;
          profile: {
            name: string;
            metadata: Record<string, unknown>;
          };
        };
        tags: string[];
        settings?: {
          enabled: boolean;
        };
      }

      const event: BlaizeEvent<ComplexData> = {
        type: 'complex:event',
        data: {
          user: {
            id: '123',
            profile: {
              name: 'John',
              metadata: { key: 'value' },
            },
          },
          tags: ['tag1', 'tag2'],
        },
        timestamp: Date.now(),
        serverId: 'server-1',
      };

      expectTypeOf(event.data).toEqualTypeOf<ComplexData>();
    });

    it('should handle union data types', () => {
      type UnionData = { type: 'a'; valueA: string } | { type: 'b'; valueB: number };

      const eventA: BlaizeEvent<UnionData> = {
        type: 'union:event',
        data: { type: 'a', valueA: 'test' },
        timestamp: Date.now(),
        serverId: 'server-1',
      };

      const eventB: BlaizeEvent<UnionData> = {
        type: 'union:event',
        data: { type: 'b', valueB: 42 },
        timestamp: Date.now(),
        serverId: 'server-1',
      };

      expectTypeOf(eventA.data).toEqualTypeOf<UnionData>();
      expectTypeOf(eventB.data).toEqualTypeOf<UnionData>();
    });

    it('should handle optional data fields', () => {
      interface OptionalFieldsData {
        required: string;
        optional?: number;
      }

      const withOptional: BlaizeEvent<OptionalFieldsData> = {
        type: 'optional:event',
        data: { required: 'test', optional: 42 },
        timestamp: Date.now(),
        serverId: 'server-1',
      };

      const withoutOptional: BlaizeEvent<OptionalFieldsData> = {
        type: 'optional:event',
        data: { required: 'test' },
        timestamp: Date.now(),
        serverId: 'server-1',
      };

      expectTypeOf(withOptional.data).toEqualTypeOf<OptionalFieldsData>();
      expectTypeOf(withoutOptional.data).toEqualTypeOf<OptionalFieldsData>();
    });
  });
});
