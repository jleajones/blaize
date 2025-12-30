/* eslint-disable @typescript-eslint/no-unsafe-function-type */
/**
 * @module sse/create.test
 * @description Comprehensive test suite for SSE route creator
 */

import { z } from 'zod';

import {
  createMockEventBus,
  createMockLogger,
  createMockMiddleware,
  createSSEMockContext,
} from '@blaizejs/testing-utils';

import { createSSERoute } from './create';
import { SSENotAcceptableError } from '../errors/sse-not-acceptable-error';

import type {
  TypedEventBus,
  EventSchemas,
  BlaizeEvent,
  State,
  Services,
  BlaizeLogger,
} from '@blaize-types';

// ============================================================================
// Mock Setup
// ============================================================================

// Mock dependencies
vi.mock('./stream', () => ({
  createSSEStream: vi.fn(() => ({
    id: 'test-stream-id',
    state: 'connected',
    bufferSize: 0,
    isWritable: true,
    send: vi.fn(),
    sendError: vi.fn(),
    close: vi.fn(),
    onClose: vi.fn(),
    ping: vi.fn(),
    setRetry: vi.fn(),
    flush: vi.fn(),
  })),
}));

vi.mock('../router/create', () => ({
  getRoutePath: vi.fn(() => '/test/path'),
}));

// ============================================================================
// Test Suites
// ============================================================================

describe('createSSERoute', () => {
  let mockLogger: BlaizeLogger;
  let mockEventBus: TypedEventBus<EventSchemas>;
  beforeEach(() => {
    mockLogger = createMockLogger();
    mockEventBus = createMockEventBus();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // Basic Functionality
  // ==========================================================================

  describe('Basic functionality', () => {
    test('creates SSE route with minimal config', () => {
      const handler = vi.fn();
      const result = createSSERoute()({
        handler,
      });

      expect(result).toHaveProperty('GET');
      expect(result).toHaveProperty('path');
      expect(result.path).toBe('/test/path');
      expect(result.GET).toHaveProperty('handler');
      expect(typeof result.GET.handler).toBe('function');
    });

    test('validates handler is required', () => {
      expect(() => {
        // @ts-expect-error - testing invalid config
        createSSERoute()({});
      }).toThrow('SSE route handler must be a function');
    });

    test('validates handler is a function', () => {
      expect(() => {
        createSSERoute()({
          // @ts-expect-error - testing invalid config
          handler: 'not-a-function',
        });
      }).toThrow('SSE route handler must be a function');
    });

    test('validates middleware is an array', () => {
      expect(() => {
        createSSERoute()({
          handler: vi.fn(),
          // @ts-expect-error - testing invalid config
          middleware: 'not-an-array',
        });
      }).toThrow('Middleware for SSE route must be an array');
    });
  });

  // ==========================================================================
  // Schema Validation
  // ==========================================================================

  describe('Schema validation', () => {
    test('accepts valid params schema', () => {
      const result = createSSERoute()({
        schema: {
          params: z.object({ id: z.string() }),
        },
        handler: vi.fn(),
      });

      expect(result.GET.schema).toHaveProperty('params');
      expect(result.GET.schema?.params).toBeDefined();
    });

    test('accepts valid query schema', () => {
      const result = createSSERoute()({
        schema: {
          query: z.object({ filter: z.string().optional() }),
        },
        handler: vi.fn(),
      });

      expect(result.GET.schema).toHaveProperty('query');
      expect(result.GET.schema?.query).toBeDefined();
    });

    test('accepts event map schema', () => {
      const result = createSSERoute()({
        schema: {
          events: {
            message: z.object({ text: z.string() }),
            status: z.object({ online: z.boolean() }),
          },
        },
        handler: vi.fn(),
      });

      expect(result.GET).toBeDefined();
      // Events are not passed to route schema, only used internally
      expect(result.GET.schema).toBeUndefined();
    });

    test('validates invalid params schema', () => {
      expect(() => {
        createSSERoute()({
          schema: {
            params: { not: 'a-zod-schema' },
          },
          handler: vi.fn(),
        });
      }).toThrow('Params schema for SSE must be a valid Zod schema');
    });

    test('validates invalid query schema', () => {
      expect(() => {
        createSSERoute()({
          schema: {
            query: { not: 'a-zod-schema' },
          },
          handler: vi.fn(),
        });
      }).toThrow('Query schema for SSE must be a valid Zod schema');
    });

    test('validates invalid event schema in event map', () => {
      expect(() => {
        createSSERoute()({
          schema: {
            events: {
              badEvent: 'not-a-schema',
            },
          },
          handler: vi.fn(),
        });
      }).toThrow("Event schema for 'badEvent' must be a valid Zod schema");
    });

    test('accepts single event schema', () => {
      const result = createSSERoute()({
        schema: {
          events: z.object({ data: z.string() }),
        },
        handler: vi.fn(),
      });

      expect(result.GET).toBeDefined();
    });
  });

  // ==========================================================================
  // Handler Wrapping and Execution
  // ==========================================================================

  describe('Handler wrapping and execution', () => {
    test('wrapped handler creates stream and calls user handler', async () => {
      const { createSSEStream } = await import('./stream');
      const userHandler = vi.fn();

      const route = createSSERoute()({
        handler: userHandler,
      });

      const ctx = createSSEMockContext({
        withEventEmitter: true,
        headers: { accept: 'text/event-stream' },
      });
      const params = { id: '123' };
      route.GET.handler(ctx, params, mockLogger, mockEventBus);

      expect(createSSEStream).toHaveBeenCalledWith(ctx, undefined);
      expect(userHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          stream: expect.any(Object),
          ctx: expect.any(Object),
          params: expect.objectContaining({ id: '123' }),
          logger: expect.any(Object),
          eventBus: expect.any(Object),
        })
      );
    });

    test('validates SSE accept header', async () => {
      const route = createSSERoute()({
        handler: vi.fn(),
      });

      const ctx = createSSEMockContext({
        headers: { accept: 'application/json' }, // Wrong accept header
      });

      await expect(route.GET.handler(ctx, {}, mockLogger, mockEventBus)).rejects.toThrow(
        SSENotAcceptableError
      );
    });

    test('allows wildcard accept header', async () => {
      const route = createSSERoute()({
        handler: vi.fn(),
      });

      const ctx = createSSEMockContext({
        headers: { accept: '*/*' },
      });

      await expect(route.GET.handler(ctx, {}, mockLogger, mockEventBus)).resolves.not.toThrow();
    });

    test('allows missing accept header', async () => {
      const route = createSSERoute()({
        handler: vi.fn(),
      });

      const ctx = createSSEMockContext({
        headers: {}, // No accept header
      });

      await expect(route.GET.handler(ctx, {}, mockLogger, mockEventBus)).resolves.not.toThrow();
    });

    test('registers close handler on client disconnect', async () => {
      const { createSSEStream } = await import('./stream');
      const mockStream = {
        close: vi.fn(),
        onClose: vi.fn(),
        isWritable: true,
        send: vi.fn(),
        sendError: vi.fn(),
        ping: vi.fn(),
        setRetry: vi.fn(),
        flush: vi.fn(),
        state: 'connected',
        bufferSize: 0,
      };
      vi.mocked(createSSEStream).mockReturnValueOnce(mockStream as any);

      const route = createSSERoute()({
        handler: vi.fn(),
      });

      const ctx = createSSEMockContext({
        withEventEmitter: true,
        headers: { accept: 'text/event-stream' },
      });

      // Capture the close handler when it's registered
      let closeHandler: Function | undefined;
      const onMock = ctx.request.raw.on as ReturnType<typeof vi.fn>;
      onMock.mockImplementation((event: string, handler: Function) => {
        if (event === 'close') {
          closeHandler = handler;
        }
        return ctx.request.raw;
      });

      await route.GET.handler(ctx, {}, mockLogger, mockEventBus);

      expect(ctx.request.raw.on).toHaveBeenCalledWith('close', expect.any(Function));

      // Simulate client disconnect
      if (closeHandler) {
        closeHandler();
        expect(mockStream.close).toHaveBeenCalled();
      }
    });

    test('sends error to stream on handler failure', async () => {
      const { createSSEStream } = await import('./stream');
      const mockStream = {
        close: vi.fn(),
        onClose: vi.fn(),
        isWritable: true,
        send: vi.fn(),
        sendError: vi.fn(),
        ping: vi.fn(),
        setRetry: vi.fn(),
        flush: vi.fn(),
        state: 'connected',
        bufferSize: 0,
      };
      vi.mocked(createSSEStream).mockReturnValueOnce(mockStream as any);

      const error = new Error('Handler failed');
      const route = createSSERoute()({
        handler: vi.fn().mockRejectedValue(error),
      });

      const ctx = createSSEMockContext({
        withEventEmitter: true,
        headers: { accept: 'text/event-stream' },
      });

      await expect(route.GET.handler(ctx, {}, mockLogger, mockEventBus)).rejects.toThrow(error);
      expect(mockStream.sendError).toHaveBeenCalledWith(error);
      expect(mockStream.close).toHaveBeenCalled();
    });

    test('passes options to stream creation', async () => {
      const { createSSEStream } = await import('./stream');
      const options = { autoClose: true, maxBufferSize: 100 };

      const route = createSSERoute()({
        handler: vi.fn(),
        options,
      });

      const ctx = createSSEMockContext({
        withEventEmitter: true,
        headers: { accept: 'text/event-stream' },
      });

      await route.GET.handler(ctx, {}, mockLogger, mockEventBus);

      expect(createSSEStream).toHaveBeenCalledWith(ctx, options);
    });
  });

  // ==========================================================================
  // Typed Stream Creation
  // ==========================================================================

  describe('Typed stream creation', () => {
    test('creates typed stream when event schemas provided', async () => {
      const { createSSEStream } = await import('./stream');
      const baseStream = {
        close: vi.fn(),
        onClose: vi.fn(),
        isWritable: true,
        send: vi.fn(),
        sendError: vi.fn(),
        ping: vi.fn(),
        setRetry: vi.fn(),
        flush: vi.fn(),
        state: 'connected',
        bufferSize: 0,
      };
      vi.mocked(createSSEStream).mockReturnValueOnce(baseStream as any);

      const eventSchemas = {
        message: z.object({ text: z.string() }),
        status: z.object({ online: z.boolean() }),
      };

      const userHandler = vi.fn();
      const route = createSSERoute()({
        schema: { events: eventSchemas },
        handler: userHandler,
      });

      const ctx = createSSEMockContext({
        withEventEmitter: true,
        headers: { accept: 'text/event-stream' },
      });

      await route.GET.handler(ctx, {}, mockLogger, mockEventBus);

      // Check that handler received a stream
      expect(userHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          stream: expect.any(Object),
          ctx: expect.any(Object),
          logger: expect.any(Object),
          eventBus: expect.any(Object),
        })
      );

      // Get the typed stream passed to handler
      const handlerContext = userHandler.mock.calls[0]![0];
      const typedStream = handlerContext.stream;

      // Test validation works
      typedStream.send('message', { text: 'hello' });
      expect(baseStream.send).toHaveBeenCalledWith('message', { text: 'hello' });

      // Test validation failure
      baseStream.send.mockClear();
      typedStream.send('message', { wrong: 'field' });
      expect(baseStream.sendError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("Event 'message' validation failed"),
        })
      );
    });

    test('uses base stream when no event schemas provided', async () => {
      const { createSSEStream } = await import('./stream');
      const baseStream = {
        close: vi.fn(),
        onClose: vi.fn(),
        isWritable: true,
        send: vi.fn(),
        sendError: vi.fn(),
        ping: vi.fn(),
        setRetry: vi.fn(),
        flush: vi.fn(),
        state: 'connected',
        bufferSize: 0,
      };
      vi.mocked(createSSEStream).mockReturnValueOnce(baseStream as any);

      const userHandler = vi.fn();
      const route = createSSERoute()({
        handler: userHandler,
      });

      const ctx = createSSEMockContext({
        withEventEmitter: true,
        headers: { accept: 'text/event-stream' },
      });

      await route.GET.handler(ctx, {}, mockLogger, mockEventBus);

      const handlerContext = userHandler.mock.calls[0]![0];
      const stream = handlerContext.stream;
      expect(stream).toBe(baseStream);
    });

    test('allows sending events not in schema when using typed stream', async () => {
      const { createSSEStream } = await import('./stream');
      const baseStream = {
        close: vi.fn(),
        onClose: vi.fn(),
        isWritable: true,
        send: vi.fn(),
        sendError: vi.fn(),
        ping: vi.fn(),
        setRetry: vi.fn(),
        flush: vi.fn(),
        state: 'connected',
        bufferSize: 0,
      };
      vi.mocked(createSSEStream).mockReturnValueOnce(baseStream as any);

      const eventSchemas = {
        message: z.object({ text: z.string() }),
      };

      const userHandler = vi.fn();
      const route = createSSERoute()({
        schema: { events: eventSchemas },
        handler: userHandler,
      });

      const ctx = createSSEMockContext({
        withEventEmitter: true,
        headers: { accept: 'text/event-stream' },
      });

      await route.GET.handler(ctx, {}, mockLogger, mockEventBus);

      const handlerContext = userHandler.mock.calls[0]![0];
      const typedStream = handlerContext.stream;

      // Send event not in schema - should pass through without validation
      typedStream.send('unknown', { any: 'data' });
      expect(baseStream.send).toHaveBeenCalledWith('unknown', { any: 'data' });
    });
  });

  // ==========================================================================
  // Type Inference
  // ==========================================================================

  describe('Type inference', () => {
    test('infers param types from schema', () => {
      const paramSchema = z.object({
        userId: z.string(),
        postId: z.string(),
      });

      createSSERoute()({
        schema: { params: paramSchema },
        handler: ({ params }) => {
          // TypeScript should know params shape
          const _userId: string = params.userId;
          const _postId: string = params.postId;
          // @ts-expect-error - unknown field
          const _unknown = params.unknownField;
        },
      });

      expect(true).toBe(true); // Type test only
    });

    test('infers query types from schema', () => {
      const querySchema = z.object({
        page: z.string().optional(),
        limit: z.string().optional(),
      });

      createSSERoute()({
        schema: { query: querySchema },
        handler: ({ ctx }) => {
          // TypeScript should know query shape
          const _page: string | undefined = ctx.request.query.page;
          const _limit: string | undefined = ctx.request.query.limit;
        },
      });

      expect(true).toBe(true); // Type test only
    });

    test('infers stream type from event schemas', () => {
      const eventSchemas = {
        message: z.object({ content: z.string(), author: z.string() }),
        typing: z.object({ userId: z.string(), isTyping: z.boolean() }),
      };

      createSSERoute()({
        schema: { events: eventSchemas },
        handler: ({ stream }) => {
          // TypeScript should know valid events
          stream.send('message', { content: 'hi', author: 'bot' });
          stream.send('typing', { userId: '123', isTyping: true });

          // @ts-expect-error - unknown event
          stream.send('unknown', {});

          // @ts-expect-error - wrong shape
          stream.send('message', { wrong: 'shape' });
        },
      });

      expect(true).toBe(true); // Type test only
    });
  });

  // ==========================================================================
  // Integration with State and Services
  // ==========================================================================

  describe('Integration with state and services', () => {
    interface TestState extends State {
      user?: { id: string; name: string };
      requestId: string;
    }

    interface TestServices extends Services {
      database: { query: (sql: string) => Promise<any> };
      cache: { get: (key: string) => any };
    }

    test('preserves state and services types', () => {
      createSSERoute<TestState, TestServices>()({
        handler: ({ ctx }) => {
          // State should be typed
          const _user = ctx.state.user;
          const _requestId: string = ctx.state.requestId;

          // Services should be typed
          const _db = ctx.services.database;
          const _cache = ctx.services.cache;
        },
      });

      expect(true).toBe(true); // Type test only
    });

    test('state and services are accessible in handler', async () => {
      const route = createSSERoute<TestState, TestServices>()({
        handler: ({ ctx }) => {
          expect(ctx.state.requestId).toBe('req-123');
          expect(ctx.services.database).toBeDefined();
          expect(ctx.services.cache).toBeDefined();
        },
      });

      const ctx = createSSEMockContext<TestState, TestServices>({
        withEventEmitter: true,
        headers: { accept: 'text/event-stream' },
        initialState: { requestId: 'req-123' },
        initialServices: {
          database: { query: vi.fn() },
          cache: { get: vi.fn() },
        },
      });

      await route.GET.handler(ctx, {}, mockLogger, mockEventBus);
    });
  });

  // ==========================================================================
  // Middleware Support
  // ==========================================================================

  describe('Middleware support', () => {
    test('includes middleware in route definition', () => {
      const middleware1 = createMockMiddleware({
        name: 'middleware1',
      });
      const middleware2 = createMockMiddleware({
        name: 'middleware2',
      });

      const result = createSSERoute()({
        handler: vi.fn(),
        middleware: [middleware1, middleware2],
      });

      expect(result.GET.middleware).toEqual([middleware1, middleware2]);
    });

    test('works without middleware', () => {
      const result = createSSERoute()({
        handler: vi.fn(),
      });

      expect(result.GET.middleware).toBeUndefined();
    });

    test('empty middleware array is preserved', () => {
      const result = createSSERoute()({
        handler: vi.fn(),
        middleware: [],
      });

      expect(result.GET.middleware).toEqual([]);
    });
  });

  // ==========================================================================
  // Options Support
  // ==========================================================================

  describe('Options support', () => {
    test('includes options in route definition', () => {
      const options = {
        customOption: 'value',
        anotherOption: 123,
        nested: { option: true },
      };

      const result = createSSERoute()({
        handler: vi.fn(),
        options,
      });

      expect(result.GET.options).toEqual(options);
    });

    test('works without options', () => {
      const result = createSSERoute()({
        handler: vi.fn(),
      });

      expect(result.GET.options).toBeUndefined();
    });
  });

  // ==========================================================================
  // Real-world Scenarios
  // ==========================================================================

  describe('Real-world scenarios', () => {
    test('chat room with typed events', async () => {
      const { createSSEStream } = await import('./stream');
      const mockStream = {
        close: vi.fn(),
        onClose: vi.fn(),
        isWritable: true,
        send: vi.fn(),
        sendError: vi.fn(),
        ping: vi.fn(),
        setRetry: vi.fn(),
        flush: vi.fn(),
        state: 'connected',
        bufferSize: 0,
      };
      vi.mocked(createSSEStream).mockReturnValueOnce(mockStream as any);

      const eventSchemas = {
        message: z.object({
          id: z.string(),
          content: z.string(),
          author: z.string(),
          timestamp: z.number(),
        }),
        typing: z.object({
          userId: z.string(),
          isTyping: z.boolean(),
        }),
        presence: z.object({
          users: z.array(
            z.object({
              id: z.string(),
              name: z.string(),
              status: z.enum(['online', 'away', 'offline']),
            })
          ),
        }),
      };

      const result = createSSERoute()({
        schema: {
          params: z.object({ roomId: z.string() }),
          query: z.object({
            since: z.string().optional(),
            limit: z.string().optional(),
          }),
          events: eventSchemas,
        },
        handler: async ({ stream, ctx, params }) => {
          // Simulate chat room logic
          expect(params.roomId).toBeDefined();
          expect(ctx.request.query.since).toBeDefined();

          // Send initial presence
          stream.send('presence', {
            users: [
              { id: '1', name: 'Alice', status: 'online' },
              { id: '2', name: 'Bob', status: 'away' },
            ],
          });

          // Send a message
          stream.send('message', {
            id: 'msg1',
            content: 'Welcome to the chat!',
            author: 'System',
            timestamp: Date.now(),
          });
        },
      });

      const ctx = createSSEMockContext({
        withEventEmitter: true,
        headers: { accept: 'text/event-stream' },
        query: { since: '2024-01-01', limit: '50' },
      });

      await result.GET.handler(ctx, { roomId: 'room123' }, mockLogger, mockEventBus);

      // Verify the typed stream was created and events were sent
      const _handler = vi.mocked(result.GET.handler);
      expect(mockStream.send).toHaveBeenCalledTimes(2); // Base stream not called directly
      // The typed stream wrapper would have called the base stream
    });

    test('progress tracking with heartbeat', async () => {
      const result = createSSERoute()({
        schema: {
          events: {
            progress: z.object({
              percent: z.number().min(0).max(100),
              message: z.string(),
            }),
            complete: z.object({
              success: z.boolean(),
              result: z.any().optional(),
            }),
            heartbeat: z.object({
              timestamp: z.number(),
            }),
          },
        },
        handler: async ({ stream }) => {
          // Simulate long-running task
          // eslint-disable-next-line prefer-const
          let heartbeatInterval: NodeJS.Timeout;

          stream.onClose(() => {
            if (heartbeatInterval) clearInterval(heartbeatInterval);
          });

          // Send heartbeat every 30 seconds
          heartbeatInterval = setInterval(() => {
            stream.send('heartbeat', { timestamp: Date.now() });
          }, 30000);

          // Simulate progress updates
          for (let i = 0; i <= 100; i += 10) {
            stream.send('progress', {
              percent: i,
              message: `Processing... ${i}%`,
            });
            await new Promise(resolve => setTimeout(resolve, 100));
          }

          stream.send('complete', {
            success: true,
            result: { processedItems: 42 },
          });

          clearInterval(heartbeatInterval);
          stream.close();
        },
      });

      expect(result.GET).toBeDefined();
      expect(typeof result.GET.handler).toBe('function');
    });
  });

  // ==========================================================================
  // Event Bus Integration
  // ==========================================================================
  describe('EventBus integration', () => {
    it('provides eventBus to handler', async () => {
      const { createSSEStream } = await import('./stream');
      const baseStream = {
        close: vi.fn(),
        onClose: vi.fn(),
        isWritable: true,
        send: vi.fn(),
        sendError: vi.fn(),
        ping: vi.fn(),
        setRetry: vi.fn(),
        flush: vi.fn(),
        state: 'connected',
        bufferSize: 0,
      };
      vi.mocked(createSSEStream).mockReturnValueOnce(baseStream as any);

      const handler = vi.fn(async ({ eventBus }) => {
        await eventBus.publish('test', { data: 'test' });
      });

      const route = createSSERoute()({ handler });
      const ctx = createSSEMockContext({
        headers: { accept: 'text/event-stream' },
      });

      await route.GET.handler(ctx, {}, mockLogger, mockEventBus);

      expect(handler.mock.calls[0]![0].eventBus).toBe(mockEventBus);
    });

    it('supports subscriptions with cleanup', async () => {
      const { createSSEStream } = await import('./stream');
      const baseStream = {
        close: vi.fn(),
        onClose: vi.fn(),
        isWritable: true,
        send: vi.fn(),
        sendError: vi.fn(),
        ping: vi.fn(),
        setRetry: vi.fn(),
        flush: vi.fn(),
        state: 'connected',
        bufferSize: 0,
      };
      vi.mocked(createSSEStream).mockReturnValueOnce(baseStream as any);

      const unsubscribe = vi.fn();
      vi.spyOn(mockEventBus, 'subscribe').mockReturnValue(unsubscribe);

      const handler = vi.fn(async ({ eventBus, stream }) => {
        const unsub = eventBus.subscribe('user:*', (event: BlaizeEvent) => {
          stream.send('user-event', event.data);
        });
        stream.onClose(unsub);
      });

      const route = createSSERoute()({ handler });
      const ctx = createSSEMockContext({
        headers: { accept: 'text/event-stream' },
      });

      await route.GET.handler(ctx, {}, mockLogger, mockEventBus);

      expect(mockEventBus.subscribe).toHaveBeenCalled();
      expect(baseStream.onClose).toHaveBeenCalled();

      baseStream.onClose.mock.calls[0]![0]();
      expect(unsubscribe).toHaveBeenCalled();
    });
  });
});
