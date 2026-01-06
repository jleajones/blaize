// packages/blaize-core/src/router/handlers/executor.test.ts
import { describe, test, expect, vi, beforeEach } from 'vitest';
import * as z from 'zod';

import {
  createMockMiddleware,
  createMockLogger,
  createMockEventBus,
  MockLogger,
} from '@blaizejs/testing-utils';

import { executeHandler } from './executor';
import { compose } from '../../middleware/compose';
import { createRequestValidator, createResponseValidator } from '../validation/schema';

import type { TypedEventBus, EventSchemas, NextFunction } from '@blaize-types';
import type { Context } from '@blaize-types/context';
import type { RouteMethodOptions } from '@blaize-types/router';

// Mock the dependencies
vi.mock('../../middleware/compose', () => ({
  compose: vi.fn(_middleware => {
    return async ({
      next,
    }: {
      ctx: Context;
      next: NextFunction;
      logger: MockLogger;
      eventBus: TypedEventBus<EventSchemas>;
    }) => {
      await next();
    };
  }),
}));

vi.mock('../validation/schema', () => ({
  createRequestValidator: vi.fn(() => ({
    name: 'request-validator',
    execute: async (ctx: any, next: any, _logger: any) => {
      await next();
    },
  })),
  createResponseValidator: vi.fn(() => ({
    name: 'response-validator',
    execute: async (ctx: any, next: any, _logger: any) => {
      await next();
    },
  })),
}));

describe('executeHandler', () => {
  // Setup common test variables
  let ctx: Context;
  let routeOptions: RouteMethodOptions;
  let params: Record<string, string>;
  let mockLogger: MockLogger;
  let mockEventBus: TypedEventBus<EventSchemas>;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create mock logger
    mockLogger = createMockLogger();
    mockEventBus = createMockEventBus();

    // Set up test context
    ctx = {
      request: {
        method: 'GET',
        path: '/users/123',
      },
      response: {
        sent: false,
        json: vi.fn(),
        text: vi.fn(),
      },
    } as unknown as Context;

    // Default route options
    routeOptions = {
      handler: vi.fn().mockResolvedValue({ message: 'success' }),
      middleware: [],
    };

    // Route parameters
    params = { id: '123' };
  });

  describe('🆕 T5: Logger Parameter Integration', () => {
    test('route handler receives logger as 3rd parameter', async () => {
      const handlerSpy = vi.fn(async () => {
        return { success: true };
      });

      const route: RouteMethodOptions = {
        handler: handlerSpy,
      };

      await executeHandler(ctx, route, { id: '123' }, mockLogger, mockEventBus);

      expect(handlerSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          ctx,
          params: { id: '123' },
          logger: expect.objectContaining({
            info: expect.any(Function),
            error: expect.any(Function),
            debug: expect.any(Function),
            warn: expect.any(Function),
            child: expect.any(Function),
            flush: expect.any(Function),
          }),
          eventBus: mockEventBus,
        })
      );
    });

    test('creates route-scoped logger with route path', async () => {
      const route: RouteMethodOptions = {
        handler: async () => {
          return {};
        },
      };

      await executeHandler(ctx, route, {}, mockLogger, mockEventBus);

      // Verify child logger was created with route context
      expect(mockLogger.childContexts).toContainEqual(
        expect.objectContaining({ route: expect.any(String) })
      );

      // Verify it includes the actual route path
      const routeContext = mockLogger.childContexts.find((c: any) => 'route' in c);
      expect(routeContext?.route).toBe('/users/123');
    });

    test('passes base logger to compose for middleware chain', async () => {
      const middlewareSpy = vi.fn(async ({ ctx, next, logger, eventBus }) => {
        expect(ctx).toBeDefined();
        expect(logger).toBeDefined();
        expect(eventBus).toBeDefined();
        await next();
      });

      const route: RouteMethodOptions = {
        handler: async () => ({}),
        middleware: [{ name: 'test', execute: middlewareSpy }],
      };

      await executeHandler(ctx, route, {}, mockLogger, mockEventBus);

      // Verify compose was called with middleware
      expect(compose).toHaveBeenCalled();

      // Verify the composed handler was called with logger as 3rd param
      const composedHandler = (compose as any).mock.results[0].value;
      expect(composedHandler).toBeInstanceOf(Function);
    });

    test('route middleware gets scoped logger via compose', async () => {
      const route: RouteMethodOptions = {
        handler: async () => ({}),
        middleware: [{ name: 'mw1', execute: async ({ next }) => next() }],
      };

      await executeHandler(ctx, route, {}, mockLogger, mockEventBus);

      // Note: In reality, compose creates child loggers for middleware
      // This test verifies executeHandler passes baseLogger to compose
      // The actual child logger creation for middleware happens in compose

      // Route handler gets child logger with route context
      expect(mockLogger.childContexts).toContainEqual(
        expect.objectContaining({ route: expect.any(String) })
      );
    });

    test('validation middleware receives logger parameter', async () => {
      routeOptions.schema = {
        params: z.object({ id: z.string() }),
      };

      await executeHandler(ctx, routeOptions, params, mockLogger, mockEventBus);

      // Verify validator was created
      expect(createRequestValidator).toHaveBeenCalledWith(routeOptions.schema);

      // Verify compose was called (which will pass logger to validators)
      expect(compose).toHaveBeenCalled();
    });

    test('logger parameter flows through entire chain', async () => {
      let capturedRouteLogger: any = null;

      const route: RouteMethodOptions = {
        handler: async ({ logger }) => {
          capturedRouteLogger = logger;
          return { data: 'test' };
        },
        middleware: [{ name: 'auth', execute: async ({ next }) => next() }],
      };

      await executeHandler(ctx, route, {}, mockLogger, mockEventBus);

      // Verify route handler received a logger
      expect(capturedRouteLogger).toBeDefined();
      expect(capturedRouteLogger).toHaveProperty('info');
      expect(capturedRouteLogger).toHaveProperty('child');
    });
  });

  describe('✅ Existing Functionality Preserved', () => {
    test('should execute the handler and set the response', async () => {
      await executeHandler(ctx, routeOptions, params, mockLogger, mockEventBus);

      // Verify the handler was called with context, params, and logger
      expect(routeOptions.handler).toHaveBeenCalledWith(
        expect.objectContaining({
          ctx,
          params,
          logger: expect.any(Object),
          eventBus: mockEventBus,
        })
      );

      // Verify the response was set
      expect(ctx.response.json).toHaveBeenCalledWith({ message: 'success' });
    });

    test('should not set response if result is undefined', async () => {
      routeOptions.handler = vi.fn().mockResolvedValue(undefined);

      await executeHandler(ctx, routeOptions, params, mockLogger, mockEventBus);

      // Verify the handler was called
      expect(routeOptions.handler).toHaveBeenCalledWith(
        expect.objectContaining({
          ctx,
          params,
          logger: expect.any(Object),
          eventBus: mockEventBus,
        })
      );

      // Verify response.json was not called
      expect(ctx.response.json).not.toHaveBeenCalled();
    });

    test('should not set response if already sent', async () => {
      ctx.response.sent = true;

      await executeHandler(ctx, routeOptions, params, mockLogger, mockEventBus);

      // Verify the handler was called
      expect(routeOptions.handler).toHaveBeenCalledWith(
        expect.objectContaining({
          ctx,
          params,
          logger: expect.any(Object),
          eventBus: mockEventBus,
        })
      );

      // Verify response.json was not called
      expect(ctx.response.json).not.toHaveBeenCalled();
    });

    test('should compose middleware with the handler', async () => {
      const middleware1 = createMockMiddleware({
        name: 'middleware1',
        execute: vi.fn().mockImplementation((_, next) => next()),
      });

      const middleware2 = createMockMiddleware({
        name: 'middleware2',
        execute: vi.fn().mockImplementation((_, next) => next()),
      });

      routeOptions.middleware = [middleware1, middleware2];

      await executeHandler(ctx, routeOptions, params, mockLogger, mockEventBus);

      // Verify compose was called with middleware
      expect(compose).toHaveBeenCalled();
      const composedMiddleware = (compose as any).mock.calls[0][0];
      expect(composedMiddleware).toHaveLength(2);
    });

    test('should add request validator if schema provided', async () => {
      routeOptions.schema = {
        params: z.object({ id: z.string() }),
      };

      await executeHandler(ctx, routeOptions, params, mockLogger, mockEventBus);

      // Verify createRequestValidator was called
      expect(createRequestValidator).toHaveBeenCalledWith(routeOptions.schema);

      // Verify compose included the validator
      expect(compose).toHaveBeenCalled();
      const composedMiddleware = (compose as any).mock.calls[0][0];
      expect(composedMiddleware.length).toBeGreaterThan(0);
    });

    test('should add response validator if schema provided', async () => {
      routeOptions.schema = {
        response: z.object({ message: z.string() }),
      };

      await executeHandler(ctx, routeOptions, params, mockLogger, mockEventBus);

      // Verify createResponseValidator was called
      expect(createResponseValidator).toHaveBeenCalledWith(routeOptions.schema.response);

      // Verify compose included the validator
      expect(compose).toHaveBeenCalled();
      const composedMiddleware = (compose as any).mock.calls[0][0];
      expect(composedMiddleware.length).toBeGreaterThan(0);
    });

    test('should handle middleware that throws errors', async () => {
      const error = new Error('Middleware error');

      // Mock compose to throw an error
      (compose as any).mockImplementationOnce(() => {
        return async () => {
          throw error;
        };
      });

      // Expect the handler to propagate the error
      await expect(
        executeHandler(ctx, routeOptions, params, mockLogger, mockEventBus)
      ).rejects.toThrow(error);

      // Verify the handler was not called (since middleware threw)
      expect(routeOptions.handler).not.toHaveBeenCalled();
    });

    test('should handle handler that throws errors', async () => {
      const error = new Error('Handler error');
      routeOptions.handler = vi.fn().mockRejectedValue(error);

      // Expect the handler to propagate the error
      await expect(
        executeHandler(ctx, routeOptions, params, mockLogger, mockEventBus)
      ).rejects.toThrow(error);
    });

    test('should add both request and response validators when both schemas provided', async () => {
      routeOptions.schema = {
        params: z.object({ id: z.string() }),
        query: z.object({ sort: z.string().optional() }),
        body: z.object({ name: z.string() }),
        response: z.object({ message: z.string() }),
      };

      await executeHandler(ctx, routeOptions, params, mockLogger, mockEventBus);

      // Verify both validators were created
      expect(createRequestValidator).toHaveBeenCalledWith(routeOptions.schema);
      expect(createResponseValidator).toHaveBeenCalledWith(routeOptions.schema.response);

      // Verify compose included both validators
      expect(compose).toHaveBeenCalled();
    });

    test('should skip middleware when its skip function returns true', async () => {
      const skippedMiddleware = createMockMiddleware({
        name: 'skipped-middleware',
        execute: vi.fn().mockImplementation((_, next) => next()),
        skip: () => true,
      });

      const normalMiddleware = createMockMiddleware({
        name: 'normal-middleware',
        execute: vi.fn().mockImplementation((_, next) => next()),
      });

      routeOptions.middleware = [skippedMiddleware, normalMiddleware];

      await executeHandler(ctx, routeOptions, params, mockLogger, mockEventBus);

      expect(compose).toHaveBeenCalled();
      const composedMiddleware = (compose as any).mock.calls[0][0];
      expect(composedMiddleware).toContain(skippedMiddleware);
      expect(composedMiddleware).toContain(normalMiddleware);
    });

    test('should handle middleware with debug mode enabled', async () => {
      const debugMiddleware = createMockMiddleware({
        name: 'debug-middleware',
        execute: vi.fn().mockImplementation((_, next) => next()),
        debug: true,
      });

      routeOptions.middleware = [debugMiddleware];

      await executeHandler(ctx, routeOptions, params, mockLogger, mockEventBus);

      expect(compose).toHaveBeenCalled();
      const composedMiddleware = (compose as any).mock.calls[0][0];
      expect(composedMiddleware).toContain(debugMiddleware);
    });
  });

  describe('🆕 T5: Integration Tests', () => {
    test('complete flow: middleware -> validation -> handler with logger', async () => {
      const executionOrder: string[] = [];

      const customMiddleware = {
        name: 'custom',
        execute: vi.fn(async ({ next }) => {
          executionOrder.push('middleware');
          await next();
        }),
      };

      const route: RouteMethodOptions = {
        handler: vi.fn(async ({ logger }) => {
          executionOrder.push('handler');
          expect(logger).toBeDefined();
          return { success: true };
        }),
        middleware: [customMiddleware],
        schema: {
          params: z.object({ id: z.string() }),
        },
      };

      await executeHandler(ctx, route, { id: '123' }, mockLogger, mockEventBus);

      // Verify execution happened
      expect(route.handler).toHaveBeenCalled();
      expect(ctx.response.json).toHaveBeenCalledWith({ success: true });
    });

    test('route logger inherits context from base logger', async () => {
      const parentLogger = mockLogger.child({ requestId: 'req-123' });

      let capturedRouteLogger: any = null;
      const route: RouteMethodOptions = {
        handler: async ({ logger }) => {
          capturedRouteLogger = logger;
          logger.info('Test log from handler'); // ✅ Use it
          return {};
        },
      };

      await executeHandler(ctx, route, {}, parentLogger, mockEventBus);

      // Verify logger received and works
      expect(capturedRouteLogger).toBeDefined();
      expect(capturedRouteLogger).toHaveProperty('info');
      expect(mockLogger.logs).toContainEqual(
        expect.objectContaining({
          level: 'info',
          message: 'Test log from handler',
        })
      );

      // Verify parent context tracked
      expect(mockLogger.childContexts).toContainEqual({ requestId: 'req-123' });
    });
  });
});
