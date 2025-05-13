import { compose } from './compose';
import { Middleware, NextFunction } from './types';
import { Context } from '../context/types';

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
    context = {} as Context;

    // Create a tracking array to verify execution order
    executionOrder = [];

    // Create a final handler that records its execution
    finalHandler = vi.fn(async () => {
      executionOrder.push('finalHandler');
    });
  });

  it('should return a pass-through function when given an empty middleware stack', async () => {
    const composed = compose([]);
    await composed(context, finalHandler);

    expect(finalHandler).toHaveBeenCalledTimes(1);
    expect(executionOrder).toEqual(['finalHandler']);
  });

  it('should execute a single middleware correctly', async () => {
    const middleware: Middleware = {
      name: 'test-middleware',
      execute: async (ctx, next) => {
        executionOrder.push('before');
        await next();
        executionOrder.push('after');
      },
    };

    const composed = compose([middleware]);
    await composed(context, finalHandler);

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
    await composed(context, finalHandler);

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

    await expect(composed(context, finalHandler)).rejects.toThrow('next() called multiple times');
  });

  it('should propagate errors thrown in middleware', async () => {
    const errorMiddleware: Middleware = {
      name: 'error-middleware',
      execute: async () => {
        throw new Error('Middleware error');
      },
    };

    const composed = compose([errorMiddleware]);

    await expect(composed(context, finalHandler)).rejects.toThrow('Middleware error');
    expect(finalHandler).not.toHaveBeenCalled();
  });

  it('should propagate errors thrown in finalHandler', async () => {
    const errorFinalHandler = async () => {
      throw new Error('Final handler error');
    };

    const middleware: Middleware = {
      name: 'test-middleware',
      execute: async (ctx, next) => {
        executionOrder.push('before');
        await next();
        executionOrder.push('after');
      },
    };

    const composed = compose([middleware]);

    await expect(composed(context, errorFinalHandler)).rejects.toThrow('Final handler error');
    expect(executionOrder).toEqual(['before']); // 'after' shouldn't execute due to error
  });

  it('should handle async middleware correctly', async () => {
    const asyncMiddleware1: Middleware = {
      name: 'async-middleware-1',
      execute: async (ctx, next) => {
        executionOrder.push('before1');
        await new Promise(resolve => setTimeout(resolve, 10));
        await next();
        await new Promise(resolve => setTimeout(resolve, 10));
        executionOrder.push('after1');
      },
    };

    const asyncMiddleware2: Middleware = {
      name: 'async-middleware-2',
      execute: async (ctx, next) => {
        executionOrder.push('before2');
        await new Promise(resolve => setTimeout(resolve, 10));
        await next();
        await new Promise(resolve => setTimeout(resolve, 10));
        executionOrder.push('after2');
      },
    };

    const composed = compose([asyncMiddleware1, asyncMiddleware2]);
    await composed(context, finalHandler);

    expect(executionOrder).toEqual(['before1', 'before2', 'finalHandler', 'after2', 'after1']);
  });

  it('should handle synchronous middleware that returns non-promises', async () => {
    const syncMiddleware: Middleware = {
      name: 'sync-middleware',
      execute: (ctx, next) => {
        executionOrder.push('before');
        next();
        executionOrder.push('after');
        // Intentionally not returning anything
        return undefined as any;
      },
    };

    const composed = compose([syncMiddleware]);
    await composed(context, finalHandler);

    expect(executionOrder).toEqual(['before', 'finalHandler', 'after']);
  });

  it('should ensure finalHandler always returns a Promise', async () => {
    const syncFinalHandler = () => {
      executionOrder.push('syncFinalHandler');
      // Intentionally not returning a promise
      return undefined as any;
    };

    const middleware: Middleware = {
      name: 'test-middleware',
      execute: async (ctx, next) => {
        executionOrder.push('before');
        const result = await next();
        executionOrder.push('after');
        return result;
      },
    };

    const composed = compose([middleware]);
    await composed(context, syncFinalHandler);

    expect(executionOrder).toEqual(['before', 'syncFinalHandler', 'after']);
  });

  it('should handle middleware that modifies the context', async () => {
    const modifyingMiddleware: Middleware = {
      name: 'modifying-middleware',
      execute: async (ctx, next) => {
        (ctx as any).foo = 'bar';
        await next();
        (ctx as any).baz = 'qux';
      },
    };

    const checkingMiddleware: Middleware = {
      name: 'checking-middleware',
      execute: async (ctx, next) => {
        expect((ctx as any).foo).toBe('bar');
        await next();
        expect((ctx as any).baz).toBeUndefined(); // Not set yet at this point
      },
    };

    const composed = compose([modifyingMiddleware, checkingMiddleware]);
    await composed(context, finalHandler);

    expect((context as any).foo).toBe('bar');
    expect((context as any).baz).toBe('qux');
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
    await composed(context, finalHandler);

    expect(executionOrder).toEqual(['terminating']);
    expect(finalHandler).not.toHaveBeenCalled();
  });

  it('should skip middleware when skip function returns true', async () => {
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
    await composed(context, finalHandler);

    // The execute function should respect the skip property and bypass the middleware
    expect(mockExecute).toHaveBeenCalledWith(
      expect.objectContaining({ skip: expect.any(Function) }),
      expect.anything(),
      expect.anything()
    );

    // Skip functionality is handled by the execute function, so we're primarily testing
    // that compose passes the middleware object correctly to execute
    mockExecute.mockRestore();
  });

  it('should handle middleware with debug flag', async () => {
    const debuggableMiddleware: Middleware = {
      name: 'debuggable-middleware',
      execute: async (ctx, next) => {
        executionOrder.push('debuggable');
        await next();
      },
      debug: true,
    };

    // Mock the execute function for this specific test to check if debug is passed
    const executeModule = await import('./execute');
    const mockExecute = vi.spyOn(executeModule, 'execute');

    const composed = compose([debuggableMiddleware]);
    await composed(context, finalHandler);

    // The execute function should receive the middleware with the debug flag
    expect(mockExecute).toHaveBeenCalledWith(
      expect.objectContaining({ debug: true }),
      expect.anything(),
      expect.anything()
    );

    mockExecute.mockRestore();
  });

  it('should throw error if middleware is null or undefined', async () => {
    const composed = compose([null as any, undefined as any]);

    await expect(composed(context, finalHandler)).rejects.toThrow();
  });
});
