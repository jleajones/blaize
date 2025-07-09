import { createMockContext } from './context';
import { Middleware, Context, NextFunction } from '../../../blaize-types/src/index';

/**
 * Result from executing middleware in tests
 */
export interface MiddlewareTestResult {
  context: Context;
  nextCalled: boolean;
  error?: Error;
}

/**
 * Execute a single middleware and track if next() was called
 * This eliminates the repetitive nextCalled tracking in tests
 */
export async function executeMiddleware(
  middleware: Middleware,
  context?: Context
): Promise<MiddlewareTestResult> {
  const ctx = context || createMockContext();
  let nextCalled = false;
  let error: Error | undefined;

  const next: NextFunction = vi.fn().mockImplementation(async () => {
    nextCalled = true;
  });

  try {
    await middleware.execute(ctx, next);
  } catch (err) {
    error = err as Error;
  }

  const result: MiddlewareTestResult = {
    context: ctx,
    nextCalled,
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
  context?: Context
): Promise<{
  context: Context;
  executionOrder: string[];
  error?: Error;
}> {
  const ctx = context || createMockContext();
  const executionOrder: string[] = [];
  let error: Error | undefined;

  // Wrap middlewares to track their execution
  const trackedMiddlewares = middlewares.map(middleware => ({
    ...middleware,
    execute: async (ctx: Context, next: NextFunction) => {
      executionOrder.push(`${middleware.name}-before`);
      try {
        await middleware.execute(ctx, next);
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
      // Add safety check (though this should never be undefined)
      if (!middleware) {
        throw new Error('Middleware is undefined - this should not happen');
      }
      await middleware.execute(ctx, dispatch);
    }
    await dispatch();
  } catch (err) {
    error = err as Error;
  }

  const result = {
    context: ctx,
    executionOrder,
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
    execute?: (ctx: Context, next: NextFunction) => Promise<void> | void;
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
    execute: vi.fn().mockImplementation(async (ctx: Context, next: NextFunction) => {
      // If custom execute function provided, use that
      if (execute) {
        return execute(ctx, next);
      }

      // Apply any state changes
      Object.assign(ctx.state, stateChanges);

      switch (behavior) {
        case 'pass':
          await next();
          break;
        case 'block':
          ctx.response.status(403).json({ error: 'Blocked' });
          // Don't call next()
          break;
        case 'error':
          throw new Error(errorMessage);
      }
    }),
  };
}
