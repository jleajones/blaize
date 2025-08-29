import { createMockContext, createMockMiddleware } from '@blaizejs/testing-utils';

import { compose } from './compose';

import type { Context } from '@blaize-types/context';
import type { Middleware, NextFunction } from '@blaize-types/middleware';

// Mock the execute function
vi.mock('./execute', () => ({
  execute: vi.fn((middleware, ctx, next) => middleware.execute(ctx, next)),
}));

describe('compose middleware function', () => {
  let context: Context;
  let finalHandler: NextFunction;
  let executionOrder: string[];

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create a simple context for testing
    context = createMockContext();

    // Create a tracking array to verify execution order
    executionOrder = [];

    // Create a final handler that records its execution
    finalHandler = vi.fn(async () => {
      executionOrder.push('finalHandler');
    });
  });

  it('should return a Middleware object', () => {
    const composed = compose([]);

    expect(composed).toHaveProperty('name');
    expect(composed).toHaveProperty('execute');
    expect(composed).toHaveProperty('_types');
    expect(typeof composed.execute).toBe('function');
  });

  it('should execute a pass-through Middleware when given an empty middleware stack', async () => {
    const composed = compose([]);
    await composed.execute(context, finalHandler);

    expect(finalHandler).toHaveBeenCalledTimes(1);
    expect(executionOrder).toEqual(['finalHandler']);
  });

  it('should execute a single middleware correctly', async () => {
    const middleware: Middleware = createMockMiddleware({
      name: 'test-middleware',
      execute: async (ctx, next) => {
        executionOrder.push('before');
        await next();
        executionOrder.push('after');
      },
    });

    const composed = compose([middleware]);
    await composed.execute(context, finalHandler);

    expect(executionOrder).toEqual(['before', 'finalHandler', 'after']);
  });

  it('should execute multiple middleware in correct order', async () => {
    const middleware1: Middleware = {
      name: 'middleware1',
      execute: async (ctx, next) => {
        executionOrder.push('before1');
        await next();
        executionOrder.push('after1');
      },
    };

    const middleware2: Middleware = {
      name: 'middleware2',
      execute: async (ctx, next) => {
        executionOrder.push('before2');
        await next();
        executionOrder.push('after2');
      },
    };

    const middleware3: Middleware = {
      name: 'middleware3',
      execute: async (ctx, next) => {
        executionOrder.push('before3');
        await next();
        executionOrder.push('after3');
      },
    };

    const composed = compose([middleware1, middleware2, middleware3]);
    await composed.execute(context, finalHandler);

    expect(executionOrder).toEqual([
      'before1',
      'before2',
      'before3',
      'finalHandler',
      'after3',
      'after2',
      'after1',
    ]);
  });

  it('should throw an error when next() is called multiple times', async () => {
    const badMiddleware: Middleware = {
      name: 'bad-middleware',
      execute: async (ctx, next) => {
        await next();
        await next(); // This should cause an error
      },
    };

    const composed = compose([badMiddleware]);

    await expect(composed.execute(context, finalHandler)).rejects.toThrow(
      'next() called multiple times'
    );
  });

  it('should propagate errors thrown in middleware', async () => {
    const errorMiddleware: Middleware = {
      name: 'error-middleware',
      execute: async () => {
        throw new Error('Middleware error');
      },
    };

    const composed = compose([errorMiddleware]);

    await expect(composed.execute(context, finalHandler)).rejects.toThrow('Middleware error');
    expect(finalHandler).not.toHaveBeenCalled();
  });

  it('should have a composed name', () => {
    const middleware1: Middleware = { name: 'middleware1', execute: async () => {} };
    const middleware2: Middleware = { name: 'middleware2', execute: async () => {} };

    const composed = compose([middleware1, middleware2]);

    expect(composed.name).toBe('composed(middleware1,middleware2)');
  });

  it('should handle middleware that does not call next()', async () => {
    const terminatingMiddleware: Middleware = {
      name: 'terminating-middleware',
      execute: async () => {
        executionOrder.push('terminating');
        // Intentionally not calling next()
      },
    };

    const nextMiddleware: Middleware = {
      name: 'next-middleware',
      execute: async (_ctx, next) => {
        executionOrder.push('should not be called');
        await next();
      },
    };

    const composed = compose([terminatingMiddleware, nextMiddleware]);
    await composed.execute(context, finalHandler);

    expect(executionOrder).toEqual(['terminating']);
    expect(finalHandler).not.toHaveBeenCalled();
  });

  it('should handle middleware with optional skip method', async () => {
    const skippableMiddleware: Middleware = {
      name: 'skippable-middleware',
      execute: async (_ctx, next) => {
        executionOrder.push('should not be called');
        await next();
      },
      skip: () => true, // Always skip
    };

    const normalMiddleware: Middleware = {
      name: 'normal-middleware',
      execute: async (ctx, next) => {
        executionOrder.push('normal-middleware');
        await next();
      },
    };

    // Mock the execute function for this specific test to check if skip is honored
    const executeModule = await import('./execute');
    const mockExecute = vi.spyOn(executeModule, 'execute');

    const composed = compose([skippableMiddleware, normalMiddleware]);
    await composed.execute(context, finalHandler);

    // The execute function should respect the skip property and bypass the middleware
    expect(mockExecute).toHaveBeenCalledWith(
      expect.objectContaining({ skip: expect.any(Function) }),
      expect.anything(),
      expect.anything()
    );

    mockExecute.mockRestore();
  });

  it('should limit middleware composition warning in development', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const middlewares = Array.from({ length: 11 }, (_, i) => ({
      name: `middleware-${i}`,
      execute: async () => {},
    }));

    const _composed = compose(middlewares);

    expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Composing 11 middleware'));

    // Restore environment and mock
    process.env.NODE_ENV = originalEnv;
    consoleWarnSpy.mockRestore();
  });
});
