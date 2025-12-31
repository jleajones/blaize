/**
 * Middleware Testing Utilities
 *
 * Helper functions for testing middleware with context object signature
 */

import { createMockContext } from './context';
import { createMockEventBus } from './event-bus';
import { createMockLogger } from './logger';

import type { MockLogger } from './logger';
import type { Middleware, Context, NextFunction, TypedEventBus, EventSchemas } from '@blaize-types';

/**
 * Result from executing middleware in tests
 */
export interface MiddlewareTestResult {
  context: Context;
  nextCalled: boolean;
  logger: MockLogger;
  eventBus: TypedEventBus<EventSchemas>;
  error?: Error;
}

/**
 * Execute a single middleware and track if next() was called
 * This eliminates the repetitive nextCalled tracking in tests
 */
export async function executeMiddleware(
  middleware: Middleware,
  context?: Context,
  logger?: MockLogger,
  eventBus?: TypedEventBus<EventSchemas>
): Promise<MiddlewareTestResult> {
  const ctx = context || createMockContext();
  const mockLogger = logger || createMockLogger();
  const mockEventBus = eventBus || createMockEventBus();
  let nextCalled = false;
  let error: Error | undefined;

  const next: NextFunction = vi.fn().mockImplementation(async () => {
    nextCalled = true;
  });

  try {
    await middleware.execute({
      ctx,
      next,
      logger: mockLogger,
      eventBus: mockEventBus,
    });
  } catch (err) {
    error = err as Error;
  }

  const result: MiddlewareTestResult = {
    context: ctx,
    nextCalled,
    logger: mockLogger,
    eventBus: mockEventBus,
  };

  if (error) {
    result.error = error;
  }

  return result;
}

/**
 * Test middleware execution order in a chain
 * This replaces the manual executionOrder tracking pattern
 */
export async function trackMiddlewareOrder(
  middlewares: Middleware[],
  context?: Context,
  logger?: MockLogger,
  eventBus?: TypedEventBus<EventSchemas>
): Promise<{
  context: Context;
  executionOrder: string[];
  logger: MockLogger;
  eventBus: TypedEventBus<EventSchemas>;
  error?: Error;
}> {
  const ctx = context || createMockContext();
  const mockLogger = logger || createMockLogger();
  const mockEventBus = eventBus || createMockEventBus();
  const executionOrder: string[] = [];
  let error: Error | undefined;

  // Wrap middlewares to track their execution
  const trackedMiddlewares = middlewares.map(middleware => ({
    ...middleware,
    execute: async (mc: {
      ctx: Context;
      next: NextFunction;
      logger: MockLogger;
      eventBus: TypedEventBus<EventSchemas>;
    }) => {
      executionOrder.push(`${middleware.name}-before`);
      try {
        await middleware.execute(mc);
        executionOrder.push(`${middleware.name}-after`);
      } catch (err) {
        executionOrder.push(`${middleware.name}-error`);
        throw err;
      }
    },
  }));

  const finalHandler = async () => {
    executionOrder.push('final-handler');
  };

  try {
    // Simple chain execution
    let index = 0;
    async function dispatch(): Promise<void> {
      if (index >= trackedMiddlewares.length) {
        await finalHandler();
        return;
      }
      const middleware = trackedMiddlewares[index++];
      if (!middleware) {
        throw new Error('Middleware is undefined - this should not happen');
      }
      await middleware.execute({
        ctx,
        next: dispatch,
        logger: mockLogger,
        eventBus: mockEventBus,
      });
    }
    await dispatch();
  } catch (err) {
    error = err as Error;
  }

  const result = {
    context: ctx,
    executionOrder,
    logger: mockLogger,
    eventBus: mockEventBus,
  };

  if (error) {
    return { ...result, error };
  }

  return result;
}

/**
 * Enhanced createMockMiddleware that covers common test scenarios
 */
export function createMockMiddleware(
  config: {
    name?: string;
    execute?: (mc: {
      ctx: Context;
      next: NextFunction;
      logger: MockLogger;
      eventBus: TypedEventBus<EventSchemas>;
    }) => Promise<void> | void;
    behavior?: 'pass' | 'block' | 'error';
    errorMessage?: string;
    stateChanges?: Record<string, unknown>;
    skip?: (ctx: Context) => boolean;
    debug?: boolean;
  } = {}
): Middleware {
  const {
    name = 'test-middleware',
    execute,
    behavior = 'pass',
    errorMessage = 'Test error',
    stateChanges = {},
    skip,
    debug,
  } = config;

  return {
    name,
    skip,
    debug,
    execute: vi
      .fn()
      .mockImplementation(
        async (mc: {
          ctx: Context;
          next: NextFunction;
          logger: MockLogger;
          eventBus: TypedEventBus<EventSchemas>;
        }) => {
          // If custom execute function provided, use that
          if (execute) {
            return execute(mc);
          }

          // Apply any state changes
          Object.assign(mc.ctx.state, stateChanges);

          switch (behavior) {
            case 'pass':
              await mc.next();
              break;
            case 'block':
              mc.ctx.response.status(403).json({ error: 'Blocked' });
              // Don't call next()
              break;
            case 'error':
              throw new Error(errorMessage);
          }
        }
      ),
  };
}
