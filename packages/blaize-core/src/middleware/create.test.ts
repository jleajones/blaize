import { Context, MiddlewareFunction, Middleware, MiddlewareOptions } from '@blaizejs/types';

import { create } from './create';

describe('createMiddleware', () => {
  // Shared test data and utilities
  const mockNext = vi.fn();

  // Helper to create a test middleware function
  function createTestMiddlewareFunction(): MiddlewareFunction {
    return vi.fn((ctx, next) => next());
  }

  // Helper to create test middleware options with all fields
  function createTestMiddlewareOptions(
    overrides: Partial<MiddlewareOptions> = {}
  ): MiddlewareOptions {
    const testFn = createTestMiddlewareFunction();

    return {
      name: overrides.name || 'test-middleware',
      handler: overrides.handler || testFn,
      skip: overrides.skip || undefined,
      debug: overrides.debug ?? false,
    };
  }

  // Reset mocks before each test
  beforeEach(() => {
    mockNext.mockReset();
  });

  it('should create middleware from a function', () => {
    // Create a simple middleware function
    const testFn = createTestMiddlewareFunction();

    // Create middleware from the function
    const middleware = create(testFn);

    // Verify middleware structure
    expect(middleware.name).toBe('anonymous');
    expect(middleware.execute).toBe(testFn);
    expect(middleware.debug).toBe(false);
    expect(middleware.skip).toBeUndefined();
  });

  it('should create middleware from options with only handler', () => {
    // Create a middleware handler
    const testHandler = createTestMiddlewareFunction();

    // Create middleware from options
    const middleware = create({ handler: testHandler });

    // Verify middleware structure
    expect(middleware.name).toBe('anonymous'); // Default name
    expect(middleware.execute).toBe(testHandler);
    expect(middleware.debug).toBe(false); // Default debug setting
    expect(middleware.skip).toBeUndefined();
  });

  it('should create middleware with custom name and debug setting', () => {
    // Create middleware with custom options
    const options = createTestMiddlewareOptions({
      name: 'custom-middleware',
      debug: true,
    });

    const middleware = create(options);

    // Verify middleware structure
    expect(middleware.name).toBe('custom-middleware');
    expect(middleware.execute).toBe(options.handler);
    expect(middleware.debug).toBe(true);
    expect(middleware.skip).toBeUndefined();
  });

  it('should create middleware with skip function', () => {
    // Create a skip function
    const testSkip = (ctx: Context) => ctx.request?.method === 'GET';

    // Create middleware with skip function
    const options = createTestMiddlewareOptions({ skip: testSkip });
    const middleware = create(options);

    // Verify middleware structure
    expect(middleware.name).toBe('test-middleware');
    expect(middleware.execute).toBe(options.handler);
    expect(middleware.skip).toBe(testSkip);
    expect(middleware.debug).toBe(false);
  });

  it('should create middleware with all options', () => {
    // Create middleware with all options
    const testSkip = (ctx: Context) => ctx.request?.method === 'GET';
    const options = createTestMiddlewareOptions({
      name: 'full-options-middleware',
      skip: testSkip,
      debug: true,
    });

    const middleware = create(options);

    // Verify middleware structure
    expect(middleware.name).toBe('full-options-middleware');
    expect(middleware.execute).toBe(options.handler);
    expect(middleware.skip).toBe(testSkip);
    expect(middleware.debug).toBe(true);
  });

  it('should return a middleware that satisfies the Middleware interface', () => {
    // Create a simple middleware function
    const testFn = createTestMiddlewareFunction();

    // Create middleware from the function
    const middleware = create(testFn);

    // Check that it matches the Middleware interface
    const isValidMiddleware =
      typeof middleware === 'object' &&
      typeof middleware.name === 'string' &&
      typeof middleware.execute === 'function' &&
      (middleware.skip === undefined || typeof middleware.skip === 'function') &&
      typeof middleware.debug === 'boolean';

    expect(isValidMiddleware).toBe(true);

    // TypeScript type check (this is more for compilation than runtime)
    const typedCheck = (_m: Middleware): boolean => true;
    expect(typedCheck(middleware)).toBe(true);
  });
});
