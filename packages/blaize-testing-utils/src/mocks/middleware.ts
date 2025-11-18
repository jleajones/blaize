/**
 * Middleware Testing Utilities
 *
 * Helper functions for testing middleware with the 3-parameter signature
 */

import { createMockContext } from './context';
import { createMockLogger } from './logger';

import type { MockLogger } from './logger';
import type { Middleware, Context, NextFunction } from '@blaize-types/index';
import type { BlaizeLogger } from '@blaize-types/logger';

/**
 * Result from executing middleware in tests
 */
export interface MiddlewareTestResult {
  context: Context;
  nextCalled: boolean;
  logger: MockLogger;
  error?: Error;
}

/**
 * Execute a single middleware and track if next() was called
 * This eliminates the repetitive nextCalled tracking in tests
 */
export async function executeMiddleware(
  middleware: Middleware,
  context?: Context,
  logger?: MockLogger
): Promise<MiddlewareTestResult> {
  const ctx = context || createMockContext();
  const mockLogger = logger || createMockLogger();
  let nextCalled = false;
  let error: Error | undefined;

  const next: NextFunction = vi.fn().mockImplementation(async () => {
    nextCalled = true;
  });

  try {
    await middleware.execute(ctx, next, mockLogger);
  } catch (err) {
    error = err as Error;
  }

  const result: MiddlewareTestResult = {
    context: ctx,
    nextCalled,
    logger: mockLogger,
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
  logger?: MockLogger
): Promise<{
  context: Context;
  executionOrder: string[];
  logger: MockLogger;
  error?: Error;
}> {
  const ctx = context || createMockContext();
  const mockLogger = logger || createMockLogger();
  const executionOrder: string[] = [];
  let error: Error | undefined;

  // Wrap middlewares to track their execution
  const trackedMiddlewares = middlewares.map(middleware => ({
    ...middleware,
    execute: async (ctx: Context, next: NextFunction, logger: BlaizeLogger) => {
      executionOrder.push(`${middleware.name}-before`);
      try {
        await middleware.execute(ctx, next, logger);
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
      await middleware.execute(ctx, dispatch, mockLogger);
    }
    await dispatch();
  } catch (err) {
    error = err as Error;
  }

  const result = {
    context: ctx,
    executionOrder,
    logger: mockLogger,
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
    execute?: (ctx: Context, next: NextFunction, logger: BlaizeLogger) => Promise<void> | void;
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
      .mockImplementation(async (ctx: Context, next: NextFunction, logger: BlaizeLogger) => {
        // If custom execute function provided, use that
        if (execute) {
          return execute(ctx, next, logger);
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
