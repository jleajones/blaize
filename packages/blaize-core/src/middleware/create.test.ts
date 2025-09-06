/* eslint-disable @typescript-eslint/no-empty-object-type */
import { create, serviceMiddleware, stateMiddleware } from './create';

import type { Context } from '@blaize-types/context';
import type { Middleware, MiddlewareOptions, MiddlewareFunction } from '@blaize-types/middleware';

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

  describe('create() with generic parameters', () => {
    test('should create untyped middleware from function', () => {
      const handler: MiddlewareFunction = async (ctx, next) => {
        await next();
      };

      const middleware = create(handler);

      expect(middleware.name).toBe('anonymous');
      expect(middleware.execute).toBe(handler);
      expect(middleware.debug).toBe(false);
      expect(middleware.skip).toBeUndefined();
    });

    test('should create typed middleware with state', () => {
      interface AuthState {
        user: { id: string; name: string };
      }

      const middleware = create<AuthState>({
        name: 'auth',
        handler: async (ctx, next) => {
          // In real usage, ctx.state.user would be typed
          await next();
        },
      });

      expect(middleware.name).toBe('auth');
      // Type carriers (_state, _services) are compile-time only
      expect('_state' in middleware).toBe(false);
      expect('_services' in middleware).toBe(false);
    });

    test('should create typed middleware with services', () => {
      interface DbService {
        db: { query: (sql: string) => Promise<any> };
      }

      const middleware = create<{}, DbService>({
        name: 'database',
        handler: async (ctx, next) => {
          // In real usage, ctx.services.db would be typed
          await next();
        },
      });

      expect(middleware.name).toBe('database');
    });

    test('should create typed middleware with both state and services', () => {
      interface AppState {
        requestId: string;
      }

      interface AppServices {
        logger: { log: (msg: string) => void };
      }

      const middleware = create<AppState, AppServices>({
        name: 'app-middleware',
        handler: async (ctx, next) => {
          // Both ctx.state and ctx.services would be typed
          await next();
        },
        debug: true,
      });

      expect(middleware.name).toBe('app-middleware');
      expect(middleware.debug).toBe(true);
    });

    test('should preserve skip function', () => {
      const skipFn = (ctx: Context) => ctx.request.path === '/health';

      const middleware = create({
        name: 'conditional',
        handler: async (ctx, next) => next(),
        skip: skipFn,
      });

      expect(middleware.skip).toBe(skipFn);
    });
  });

  describe('stateMiddleware() helper', () => {
    test('should create middleware that only contributes state', () => {
      interface UserState {
        userId: string;
        userName: string;
      }

      const handler: MiddlewareFunction = async (ctx, next) => {
        // Would set ctx.state.userId and ctx.state.userName
        await next();
      };

      const middleware = stateMiddleware<UserState>(handler);

      expect(middleware.name).toBe('state-middleware');
      expect(middleware.execute).toBe(handler);

      // Verify it's typed as Middleware<UserState, {}>
      const _typeTest: Middleware<UserState> = middleware;
    });

    test('should work with complex state types', () => {
      interface ComplexState {
        user: {
          id: string;
          profile: {
            name: string;
            email: string;
          };
        };
        session: {
          token: string;
          expiresAt: Date;
        };
      }

      const middleware = stateMiddleware<ComplexState>(async (ctx, next) => {
        await next();
      });

      expect(middleware.name).toBe('state-middleware');
    });
  });

  describe('serviceMiddleware() helper', () => {
    test('should create middleware that only contributes services', () => {
      interface CacheService {
        cache: {
          get: (key: string) => any;
          set: (key: string, value: any) => void;
        };
      }

      const handler: MiddlewareFunction = async (ctx, next) => {
        // Would set ctx.services.cache
        await next();
      };

      const middleware = serviceMiddleware<CacheService>(handler);

      expect(middleware.name).toBe('service-middleware');
      expect(middleware.execute).toBe(handler);

      // Verify it's typed as Middleware<{}, CacheService>
      const _typeTest: Middleware<{}, CacheService> = middleware;
    });

    test('should work with multiple services', () => {
      interface MultipleServices {
        db: { query: (sql: string) => Promise<any> };
        cache: Map<string, any>;
        logger: { log: (msg: string) => void };
      }

      const middleware = serviceMiddleware<MultipleServices>(async (ctx, next) => {
        await next();
      });

      expect(middleware.name).toBe('service-middleware');
    });
  });

  describe('Type preservation', () => {
    test('generic parameters should be preserved at compile time', () => {
      // These tests verify TypeScript compilation, not runtime behavior

      interface State1 {
        a: string;
      }
      interface Service1 {
        b: number;
      }

      const m1 = create<State1, Service1>({ handler: async (ctx, next) => next() });
      const m2 = stateMiddleware<State1>(async (ctx, next) => next());
      const m3 = serviceMiddleware<Service1>(async (ctx, next) => next());

      // Type tests - these would fail compilation if types weren't preserved
      const _t1: Middleware<State1, Service1> = m1;
      const _t2: Middleware<State1> = m2;
      const _t3: Middleware<{}, Service1> = m3;

      // All middleware should have the base properties
      expect(m1.name).toBeDefined();
      expect(m2.name).toBeDefined();
      expect(m3.name).toBeDefined();
    });
  });

  describe('Middleware composition compatibility', () => {
    test('should work with compose function', async () => {
      // Middleware should still be composable
      const m1 = create(async (ctx, next) => next());
      const m2 = stateMiddleware<{ user: string }>(async (ctx, next) => next());
      const m3 = serviceMiddleware<{ db: any }>(async (ctx, next) => next());

      // Array of middleware should be valid
      const middlewareStack: Middleware[] = [m1, m2, m3];

      expect(middlewareStack).toHaveLength(3);
      expect(middlewareStack[0]).toBe(m1);
      expect(middlewareStack[1]).toBe(m2);
      expect(middlewareStack[2]).toBe(m3);
    });
  });
});
