import { Context, Middleware, MiddlewareFunction } from '@blaizejs/types';

import { execute } from './execute';

describe('execute', () => {
  // Create shared test objects
  const mockContext = {} as Context;
  const mockNext = vi.fn(() => Promise.resolve());

  // Helper to create test middleware
  function createMockMiddleware(
    options: {
      name?: string;
      execute?: MiddlewareFunction;
      skip?: ((ctx: Context) => boolean) | undefined;
      debug?: boolean;
    } = {}
  ): Middleware {
    return {
      name: options.name || 'test-middleware',
      execute: options.execute || vi.fn((_, next) => next()),
      skip: options.skip,
      debug: options.debug ?? false,
    };
  }

  // Reset mocks before each test
  beforeEach(() => {
    vi.resetAllMocks();
    mockNext.mockImplementation(() => Promise.resolve());
  });

  it('should execute middleware', async () => {
    // Create a spy execute function
    const executeFn = vi.fn((ctx, next) => next());

    // Create a middleware object
    const middleware = createMockMiddleware({ execute: executeFn });

    // Execute the middleware
    await execute(middleware, mockContext, mockNext);

    // Verify the execute function was called with the correct arguments
    expect(executeFn).toHaveBeenCalledWith(mockContext, mockNext);
    // Verify next was called (by the middleware's execute function)
    expect(mockNext).toHaveBeenCalled();
  });

  it('should skip middleware if skip function returns true', async () => {
    // Create a spy execute function that should not be called
    const executeFn = vi.fn((ctx, next) => next());

    // Create middleware with a skip function that returns true
    const middleware = createMockMiddleware({
      execute: executeFn,
      skip: () => true,
    });

    // Execute the middleware
    await execute(middleware, mockContext, mockNext);

    // Verify the execute function was NOT called
    expect(executeFn).not.toHaveBeenCalled();
    // Verify next was called directly
    expect(mockNext).toHaveBeenCalled();
  });

  it('should not skip middleware if skip function returns false', async () => {
    // Create a spy execute function
    const executeFn = vi.fn((ctx, next) => next());

    // Create middleware with a skip function that returns false
    const middleware = createMockMiddleware({
      execute: executeFn,
      skip: () => false,
    });

    // Execute the middleware
    await execute(middleware, mockContext, mockNext);

    // Verify the execute function WAS called
    expect(executeFn).toHaveBeenCalledWith(mockContext, mockNext);
    // Verify next was called (by the middleware's execute function)
    expect(mockNext).toHaveBeenCalled();
  });

  it('should handle undefined middleware by calling next', async () => {
    // Execute with undefined middleware
    await execute(undefined, mockContext, mockNext);

    // Verify next was called directly
    expect(mockNext).toHaveBeenCalled();
  });

  it('should wrap non-promise returns in a promise', async () => {
    // Create a middleware that returns undefined (not a promise)
    const syncExecute: MiddlewareFunction = (ctx, next) => {
      next();
      // Explicitly return undefined to test Promise.resolve wrapping
      return undefined;
    };

    const middleware = createMockMiddleware({ execute: syncExecute });

    // Execute should return a promise
    const result = execute(middleware, mockContext, mockNext);

    // Verify the result is a promise
    expect(result).toBeInstanceOf(Promise);

    // Wait for the promise to resolve
    await result;

    // Verify next was called
    expect(mockNext).toHaveBeenCalled();
  });

  it('should handle async middleware', async () => {
    // Create an async middleware that returns a promise
    const asyncExecute: MiddlewareFunction = async (ctx, next) => {
      // Simulate async operation
      await new Promise(resolve => setTimeout(resolve, 10));
      return next();
    };

    const middleware = createMockMiddleware({ execute: asyncExecute });

    // Execute the async middleware
    await execute(middleware, mockContext, mockNext);

    // Verify next was called
    expect(mockNext).toHaveBeenCalled();
  });

  it('should propagate errors from middleware', async () => {
    // Create middleware that throws an error
    const errorExecute: MiddlewareFunction = () => {
      throw new Error('Test error');
    };

    const middleware = createMockMiddleware({ execute: errorExecute });

    // Execute the middleware and expect it to reject with the error
    await expect(execute(middleware, mockContext, mockNext)).rejects.toThrow('Test error');

    // Verify next was NOT called
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should propagate async errors from middleware', async () => {
    // Create middleware that throws an async error
    const asyncErrorExecute: MiddlewareFunction = async () => {
      // Simulate async operation that throws
      await new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error('Async error')), 10)
      );
    };

    const middleware = createMockMiddleware({ execute: asyncErrorExecute });

    // Execute the middleware and expect it to reject with the error
    await expect(execute(middleware, mockContext, mockNext)).rejects.toThrow('Async error');

    // Verify next was NOT called
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should call next with errors from async middleware rejection', async () => {
    // Create a middleware that rejects with an error
    const errorMiddleware = createMockMiddleware({
      execute: () => Promise.reject(new Error('Rejected Error')),
    });

    // Execute the middleware
    await expect(execute(errorMiddleware, mockContext, mockNext)).rejects.toThrow('Rejected Error');

    // Verify next was NOT called
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should work with both void and Promise<void> return types', async () => {
    // Test with middleware returning void
    const voidMiddleware = createMockMiddleware({
      execute: (_, next) => {
        next();
        // Return void explicitly
        return;
      },
    });

    // Execute void-returning middleware
    await execute(voidMiddleware, mockContext, mockNext);
    expect(mockNext).toHaveBeenCalledTimes(1);

    // Reset mock
    vi.resetAllMocks();
    mockNext.mockImplementation(() => Promise.resolve());

    // Test with middleware returning Promise<void>
    const promiseMiddleware = createMockMiddleware({
      execute: async (_, next) => {
        await next();
        // Return Promise<void> implicitly
      },
    });

    // Execute Promise-returning middleware
    await execute(promiseMiddleware, mockContext, mockNext);
    expect(mockNext).toHaveBeenCalledTimes(1);
  });
});
