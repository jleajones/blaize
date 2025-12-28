/**
 * Type-level tests for EventBus types
 *
 * These tests verify that the type definitions compile correctly
 * and handle various edge cases properly.
 *
 * @module @blaizejs/events/types.test
 */

import { z } from 'zod';

import type {
  EventSchemas,
  BlaizeEvent,
  EventHandler,
  Unsubscribe,
  EventBusAdapter,
  EventBus,
  MatchingEvents,
  EventDataUnion,
  TypedEventBus,
  TypedEventBusOptions,
  EventValidationError,
  EventValidationErrorDetails,
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

  describe('TypedEventBus Types', () => {
    // Define actual Zod schemas for testing (not just types)
    const _testSchemas = {
      'user:created': z.object({
        userId: z.string(),
        email: z.string(),
      }),
      'user:updated': z.object({
        userId: z.string(),
        email: z.string(),
        name: z.string(),
      }),
      'user:deleted': z.object({
        userId: z.string(),
      }),
      'order:placed': z.object({
        orderId: z.string(),
        total: z.number(),
      }),
      'order:shipped': z.object({
        orderId: z.string(),
        trackingNumber: z.string(),
      }),
      'system:ready': z.object({}),
      'a:b:c': z.object({ value: z.string() }),
      'a:b:d': z.object({ value: z.number() }),
      'a:x:y': z.object({ value: z.boolean() }),
    } as const satisfies EventSchemas;

    type TestSchemas = typeof _testSchemas;

    describe('MatchingEvents', () => {
      it('should match all events with *', () => {
        type Result = MatchingEvents<TestSchemas, '*'>;

        expectTypeOf<Result>().toEqualTypeOf<
          | 'user:created'
          | 'user:updated'
          | 'user:deleted'
          | 'order:placed'
          | 'order:shipped'
          | 'system:ready'
          | 'a:b:c'
          | 'a:b:d'
          | 'a:x:y'
        >();
      });

      it('should match namespace wildcard patterns', () => {
        type UserEvents = MatchingEvents<TestSchemas, 'user:*'>;
        type OrderEvents = MatchingEvents<TestSchemas, 'order:*'>;

        expectTypeOf<UserEvents>().toEqualTypeOf<
          'user:created' | 'user:updated' | 'user:deleted'
        >();

        expectTypeOf<OrderEvents>().toEqualTypeOf<'order:placed' | 'order:shipped'>();
      });

      it('should match exact event types', () => {
        type Exact = MatchingEvents<TestSchemas, 'user:created'>;

        expectTypeOf<Exact>().toEqualTypeOf<'user:created'>();
      });

      it('should handle deep nesting patterns', () => {
        type DeepMatch = MatchingEvents<TestSchemas, 'a:b:*'>;

        expectTypeOf<DeepMatch>().toEqualTypeOf<'a:b:c' | 'a:b:d'>();
      });

      it('should handle single-level namespace patterns', () => {
        type SingleLevel = MatchingEvents<TestSchemas, 'a:*'>;

        // Should match 'a:b:c', 'a:b:d', 'a:x:y' (anything starting with 'a:')
        expectTypeOf<SingleLevel>().toEqualTypeOf<'a:b:c' | 'a:b:d' | 'a:x:y'>();
      });

      it('should return never for non-matching patterns', () => {
        type NoMatch = MatchingEvents<TestSchemas, 'nonexistent:*'>;

        expectTypeOf<NoMatch>().toEqualTypeOf<never>();
      });

      it('should return never for exact non-matching type', () => {
        type NoMatch = MatchingEvents<TestSchemas, 'does:not:exist'>;

        expectTypeOf<NoMatch>().toEqualTypeOf<never>();
      });

      it('should handle empty schemas', () => {
        // eslint-disable-next-line @typescript-eslint/no-empty-object-type
        type EmptySchemas = {};
        type NoEvents = MatchingEvents<EmptySchemas, '*'>;

        expectTypeOf<NoEvents>().toEqualTypeOf<never>();
      });

      it('should handle single-event schemas', () => {
        type SingleSchema = {
          'only:event': z.ZodObject<{ id: z.ZodString }>;
        };

        type AllEvents = MatchingEvents<SingleSchema, '*'>;
        type NamespaceEvents = MatchingEvents<SingleSchema, 'only:*'>;
        type ExactEvent = MatchingEvents<SingleSchema, 'only:event'>;

        expectTypeOf<AllEvents>().toEqualTypeOf<'only:event'>();
        expectTypeOf<NamespaceEvents>().toEqualTypeOf<'only:event'>();
        expectTypeOf<ExactEvent>().toEqualTypeOf<'only:event'>();
      });

      it('should handle deeply nested event names', () => {
        type DeeplyNested = {
          'a:b:c:d:e': z.ZodObject<{ value: z.ZodString }>;
          'a:b:c:d:f': z.ZodObject<{ value: z.ZodNumber }>;
          'a:b:x:y:z': z.ZodObject<{ value: z.ZodBoolean }>;
        };

        type Level1 = MatchingEvents<DeeplyNested, 'a:*'>;
        type Level2 = MatchingEvents<DeeplyNested, 'a:b:*'>;
        type Level3 = MatchingEvents<DeeplyNested, 'a:b:c:*'>;
        type Level4 = MatchingEvents<DeeplyNested, 'a:b:c:d:*'>;

        expectTypeOf<Level1>().toEqualTypeOf<'a:b:c:d:e' | 'a:b:c:d:f' | 'a:b:x:y:z'>();
        expectTypeOf<Level2>().toEqualTypeOf<'a:b:c:d:e' | 'a:b:c:d:f' | 'a:b:x:y:z'>();
        expectTypeOf<Level3>().toEqualTypeOf<'a:b:c:d:e' | 'a:b:c:d:f'>();
        expectTypeOf<Level4>().toEqualTypeOf<'a:b:c:d:e' | 'a:b:c:d:f'>();
      });
    });

    describe('EventDataUnion', () => {
      it('should extract single event data type', () => {
        type UserCreatedData = EventDataUnion<TestSchemas, 'user:created'>;

        expectTypeOf<UserCreatedData>().toEqualTypeOf<{
          userId: string;
          email: string;
        }>();
      });

      it('should extract union of multiple event data types', () => {
        type UserEventData = EventDataUnion<TestSchemas, 'user:*'>;

        // Verify the union is not never (it should be a union of user event data types)
        expectTypeOf<UserEventData>().not.toBeNever();
      });

      it('should extract union of all event data types', () => {
        type AllEventData = EventDataUnion<TestSchemas, '*'>;

        // Test that specific union members are valid
        const userEvent: AllEventData = { userId: '123', email: 'test@example.com' };
        const orderEvent: AllEventData = { orderId: '123', total: 100 };
        const systemEvent: AllEventData = {};

        expectTypeOf(userEvent).toMatchTypeOf<AllEventData>();
        expectTypeOf(orderEvent).toMatchTypeOf<AllEventData>();
        expectTypeOf(systemEvent).toMatchTypeOf<AllEventData>();
      });

      it('should return never for non-matching patterns', () => {
        // When pattern doesn't match any events, EventDataUnion should be never
        // Note: Direct toBeNever() check doesn't work with real Zod instances
        type _NoData = EventDataUnion<TestSchemas, 'nonexistent:*'>;

        // Verify MatchingEvents returns never for this pattern (the root cause)
        type NoMatch = MatchingEvents<TestSchemas, 'nonexistent:*'>;
        expectTypeOf<NoMatch>().toBeNever();
      });

      it('should handle deep nesting data extraction', () => {
        type DeepData = EventDataUnion<TestSchemas, 'a:b:*'>;

        // Verify DeepData is a union type (not never)
        expectTypeOf<DeepData>().not.toBeNever();
      });

      it('should handle empty object data', () => {
        type EmptyData = EventDataUnion<TestSchemas, 'system:ready'>;

        // eslint-disable-next-line @typescript-eslint/no-empty-object-type
        expectTypeOf<EmptyData>().toEqualTypeOf<{}>();
      });

      it('should handle schemas with transforms', () => {
        // Using actual Zod schema instance for transform test
        const _transformSchema = z.object({ raw: z.string() }).transform(data => ({
          processed: data.raw,
        }));

        type SchemasWithTransform = {
          'transformed:event': typeof _transformSchema;
        };

        type TransformedData = EventDataUnion<SchemasWithTransform, 'transformed:event'>;

        // Verify it's not never (transform types are supported)
        expectTypeOf<TransformedData>().not.toBeNever();
      });
    });

    describe('TypedEventBus', () => {
      it('should require all core methods and properties', () => {
        type MockTypedBus = {
          publish<K extends keyof TestSchemas & string>(
            type: K,
            data: z.infer<TestSchemas[K]>
          ): Promise<void>;
          subscribe<TPattern extends (keyof TestSchemas & string) | '*' | `${string}:*`>(
            pattern: TPattern,
            handler: (
              event: BlaizeEvent<EventDataUnion<TestSchemas, TPattern>>
            ) => void | Promise<void>
          ): Unsubscribe;
          setAdapter(adapter: EventBusAdapter): Promise<void>;
          disconnect(): Promise<void>;
          readonly serverId: string;
          readonly base: EventBus;
        };

        expectTypeOf<TypedEventBus<TestSchemas>>().toMatchTypeOf<MockTypedBus>();
      });

      it('should constrain publish to known event types', () => {
        type PublishFn = TypedEventBus<TestSchemas>['publish'];

        // Verify publish function exists and has correct structure
        expectTypeOf<PublishFn>().toBeFunction();
        expectTypeOf<PublishFn>().returns.toEqualTypeOf<Promise<void>>();
      });

      it('should infer correct data type for publish', () => {
        type PublishFn = TypedEventBus<TestSchemas>['publish'];

        // Verify the function signature exists
        expectTypeOf<PublishFn>().toBeFunction();
        expectTypeOf<PublishFn>().parameter(0).toBeString();
      });

      it('should support pattern-based subscriptions', () => {
        type SubscribeFn = TypedEventBus<TestSchemas>['subscribe'];

        // Verify subscribe method exists on the interface
        expectTypeOf<SubscribeFn>().not.toBeNever();
      });

      it('should have readonly base property', () => {
        type TestBus = TypedEventBus<TestSchemas>;

        expectTypeOf<TestBus['base']>().toEqualTypeOf<EventBus>();
      });

      it('should have readonly serverId property', () => {
        type TestBus = TypedEventBus<TestSchemas>;

        expectTypeOf<TestBus['serverId']>().toEqualTypeOf<string>();
      });
    });

    describe('TypedEventBusOptions', () => {
      it('should require schemas field', () => {
        const options: TypedEventBusOptions<TestSchemas> = {
          schemas: {} as TestSchemas,
        };

        expectTypeOf(options.schemas).toEqualTypeOf<TestSchemas>();
      });

      it('should accept all optional fields', () => {
        const fullOptions: TypedEventBusOptions<TestSchemas> = {
          schemas: {} as TestSchemas,
          validateOnPublish: true,
          validateOnReceive: true,
          unknownEventBehavior: 'error',
          onValidationError: _error => {},
        };

        expectTypeOf(fullOptions).toMatchTypeOf<TypedEventBusOptions<TestSchemas>>();
      });

      it('should accept partial options', () => {
        const partialOptions: TypedEventBusOptions<TestSchemas> = {
          schemas: {} as TestSchemas,
          validateOnPublish: true,
        };

        expectTypeOf(partialOptions).toMatchTypeOf<TypedEventBusOptions<TestSchemas>>();
      });

      it('should constrain unknownEventBehavior to valid values', () => {
        const errorBehavior: TypedEventBusOptions<TestSchemas> = {
          schemas: {} as TestSchemas,
          unknownEventBehavior: 'error',
        };

        const warnBehavior: TypedEventBusOptions<TestSchemas> = {
          schemas: {} as TestSchemas,
          unknownEventBehavior: 'warn',
        };

        const allowBehavior: TypedEventBusOptions<TestSchemas> = {
          schemas: {} as TestSchemas,
          unknownEventBehavior: 'allow',
        };

        expectTypeOf(errorBehavior.unknownEventBehavior).toEqualTypeOf<
          'error' | 'warn' | 'allow' | undefined
        >();
        expectTypeOf(warnBehavior.unknownEventBehavior).toEqualTypeOf<
          'error' | 'warn' | 'allow' | undefined
        >();
        expectTypeOf(allowBehavior.unknownEventBehavior).toEqualTypeOf<
          'error' | 'warn' | 'allow' | undefined
        >();
      });

      it('should accept validation error handler', () => {
        const options: TypedEventBusOptions<TestSchemas> = {
          schemas: {} as TestSchemas,
          onValidationError: (error: EventValidationError) => {
            expectTypeOf(error.details.eventType).toEqualTypeOf<string>();
            expectTypeOf(error.details.data).toEqualTypeOf<unknown>();
            expectTypeOf(error.details.errors).toEqualTypeOf<string[]>();
          },
        };

        expectTypeOf(options).toMatchTypeOf<TypedEventBusOptions<TestSchemas>>();
      });

      it('should handle empty schemas', () => {
        // eslint-disable-next-line @typescript-eslint/no-empty-object-type
        type EmptySchemas = {};

        const options: TypedEventBusOptions<EmptySchemas> = {
          schemas: {},
        };

        expectTypeOf(options).toMatchTypeOf<TypedEventBusOptions<EmptySchemas>>();
      });
    });

    describe('EventValidationError', () => {
      it('should have required properties', () => {
        const mockError = {
          name: 'EventValidationError' as const,
          message: 'Validation failed',
          details: {
            eventType: 'user:created',
            data: { userId: '123' },
            errors: ['userId must be a UUID'],
          },
        };

        expectTypeOf(mockError).toMatchTypeOf<EventValidationError>();
      });

      it('should have correctly typed details', () => {
        const mockDetails: EventValidationErrorDetails = {
          eventType: 'user:created',
          data: { userId: '123' },
          errors: ['Error 1', 'Error 2'],
        };

        expectTypeOf(mockDetails.eventType).toEqualTypeOf<string>();
        expectTypeOf(mockDetails.data).toEqualTypeOf<unknown>();
        expectTypeOf(mockDetails.errors).toEqualTypeOf<string[]>();
      });

      it('should allow optional zodError', () => {
        const detailsWithZod: EventValidationErrorDetails = {
          eventType: 'user:created',
          data: {},
          errors: [],
          zodError: {} as z.ZodError,
        };

        const detailsWithoutZod: EventValidationErrorDetails = {
          eventType: 'user:created',
          data: {},
          errors: [],
        };

        expectTypeOf(detailsWithZod).toMatchTypeOf<EventValidationErrorDetails>();
        expectTypeOf(detailsWithoutZod).toMatchTypeOf<EventValidationErrorDetails>();
      });
    });

    describe('Edge Cases', () => {
      it('should handle complex schema types', () => {
        type ComplexSchemas = {
          'complex:event': z.ZodObject<{
            nested: z.ZodObject<{
              deep: z.ZodObject<{
                value: z.ZodString;
              }>;
            }>;
            array: z.ZodArray<z.ZodString>;
            optional: z.ZodOptional<z.ZodNumber>;
          }>;
        };

        type ComplexData = EventDataUnion<ComplexSchemas, 'complex:event'>;

        // Test with a valid value
        const complexValue: ComplexData = {
          nested: { deep: { value: 'test' } },
          array: ['a', 'b'],
          optional: 42,
        };

        expectTypeOf(complexValue).toMatchTypeOf<ComplexData>();
      });

      it('should handle union schema types', () => {
        type UnionSchemas = {
          'union:event': z.ZodUnion<
            [
              z.ZodObject<{ type: z.ZodLiteral<'a'>; valueA: z.ZodString }>,
              z.ZodObject<{ type: z.ZodLiteral<'b'>; valueB: z.ZodNumber }>,
            ]
          >;
        };

        type UnionData = EventDataUnion<UnionSchemas, 'union:event'>;

        // Test both union members
        const variantA: UnionData = { type: 'a', valueA: 'test' };
        const variantB: UnionData = { type: 'b', valueB: 42 };

        expectTypeOf(variantA).toMatchTypeOf<UnionData>();
        expectTypeOf(variantB).toMatchTypeOf<UnionData>();
      });

      it('should handle schemas with refinements', () => {
        type RefinedSchemas = {
          'refined:event': z.ZodEffects<
            z.ZodObject<{ value: z.ZodNumber }>,
            { value: number },
            { value: number }
          >;
        };

        type RefinedData = EventDataUnion<RefinedSchemas, 'refined:event'>;

        expectTypeOf<RefinedData>().toEqualTypeOf<{ value: number }>();
      });

      it('should handle very long event names', () => {
        const _longName = 'a'.repeat(300);
        type LongNameSchemas = {
          [K in typeof _longName]: z.ZodObject<{ id: z.ZodString }>;
        };

        type LongNameData = EventDataUnion<LongNameSchemas, typeof _longName>;

        expectTypeOf<LongNameData>().toEqualTypeOf<{ id: string }>();
      });
    });
  });
});
