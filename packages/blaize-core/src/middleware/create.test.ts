import { create } from './create';

import type { Context, State } from '@blaize-types/context';
import type {
  Middleware,
  MiddlewareOptions,
  MiddlewareFunction,
  ComposeStates,
} from '@blaize-types/middleware';

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

  describe('Basic middleware creation (backward compatible)', () => {
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
      expect(middleware._types).toBeDefined();
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
      expect(middleware._types).toBeDefined();
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

  describe('Typed middleware with state modifications', () => {
    it('should create middleware with state type parameter', () => {
      interface AppState extends State {
        user: { id: string; name: string };
        authenticated: boolean;
      }

      const handler: MiddlewareFunction<AppState> = vi.fn(async (ctx, next) => {
        ctx.state.user = { id: '123', name: 'Test User' };
        ctx.state.authenticated = true;
        await next();
      });

      const middleware = create<AppState>({
        name: 'auth-middleware',
        handler,
      });

      expect(middleware.name).toBe('auth-middleware');
      expect(middleware.execute).toBe(handler);
      expect(middleware._types).toBeDefined();
      expect(middleware._types?.state).toBeUndefined(); // Type manifest placeholder
    });

    it('should handle complex nested state', () => {
      interface ComplexState extends State {
        session: {
          id: string;
          user: {
            profile: {
              name: string;
              settings: Record<string, unknown>;
            };
          };
        };
      }

      const middleware = create<ComplexState>({
        name: 'complex-state',
        handler: async (ctx, next) => {
          ctx.state.session = {
            id: 'sess-123',
            user: {
              profile: {
                name: 'Test',
                settings: { theme: 'dark' },
              },
            },
          };
          await next();
        },
      });

      expect(middleware.name).toBe('complex-state');
    });
  });

  describe('Typed middleware with context additions', () => {
    it('should create middleware that adds to context', () => {
      interface LoggerContext {
        logger: {
          info: (msg: string) => void;
          error: (msg: string, err?: Error) => void;
        };
      }

      const middleware = create<State, LoggerContext>({
        name: 'logger',
        handler: async (ctx, next) => {
          ctx.logger = {
            info: msg => console.log(msg),
            error: (msg, err) => console.error(msg, err),
          };
          await next();
        },
      });

      expect(middleware.name).toBe('logger');
      expect(middleware._types).toBeDefined();
    });

    it('should create database middleware with context additions', () => {
      interface DbContext {
        db: {
          query: <T>(sql: string, params?: any[]) => Promise<T[]>;
          findOne: <T>(table: string, id: string) => Promise<T | null>;
        };
      }

      const middleware = create<State, DbContext>({
        name: 'database',
        handler: async (ctx, next) => {
          ctx.db = {
            query: async () => [],
            findOne: async () => null,
          };
          await next();
        },
      });

      expect(middleware.name).toBe('database');
    });
  });

  describe('Typed middleware with request body', () => {
    it('should create middleware with typed request', () => {
      interface LoginRequest {
        email: string;
        password: string;
      }

      const middleware = create<State, unknown, LoginRequest>({
        name: 'login-validator',
        handler: async (ctx, next) => {
          const { email, password } = ctx.request.body;
          // Validate email and password
          if (!email || !password) {
            ctx.response.status(400).json({ error: 'Invalid credentials' });
            return;
          }
          await next();
        },
      });

      expect(middleware.name).toBe('login-validator');
    });
  });

  describe('Type composition', () => {
    it('should compose state from multiple middleware', () => {
      interface AuthState extends State {
        user: { id: string };
      }

      interface SessionState extends State {
        sessionId: string;
      }

      const authMiddleware: Middleware<AuthState> = {
        name: 'auth',
        execute: vi.fn(),
        _types: { state: undefined as any },
      };

      const sessionMiddleware: Middleware<SessionState> = {
        name: 'session',
        execute: vi.fn(),
        _types: { state: undefined as any },
      };

      // Type-level test - verify composition works
      type _ComposedState = ComposeStates<[typeof authMiddleware, typeof sessionMiddleware]>;

      // Runtime test
      const middlewareStack = [authMiddleware, sessionMiddleware];
      expect(middlewareStack).toHaveLength(2);
    });

    it('should handle composition depth limiting', () => {
      // Create 12 middleware to test depth limiting
      const createTestMiddleware = (index: number) =>
        create({
          name: `middleware-${index}`,
          handler: async (ctx, next) => next(),
        });

      const middlewareStack = Array.from({ length: 12 }, (_, i) => createTestMiddleware(i));

      // Should handle more than 10 middleware gracefully
      expect(middlewareStack).toHaveLength(12);
      expect(middlewareStack[0]!.name).toBe('middleware-0');
      expect(middlewareStack[11]!.name).toBe('middleware-11');

      // Type composition will degrade after 10, but runtime still works
      type _TestComposition = ComposeStates<typeof middlewareStack>;
      // After 10 levels, falls back to State
    });
  });

  describe('Edge cases', () => {
    it('should handle empty middleware arrays', () => {
      const emptyStack: Middleware[] = [];

      // Type composition of empty array
      type _EmptyComposition = ComposeStates<typeof emptyStack>;

      expect(emptyStack).toHaveLength(0);
    });

    it('should handle middleware with all type parameters', () => {
      interface TestState extends State {
        test: boolean;
      }

      interface TestContext {
        helper: () => void;
      }

      interface TestRequest {
        data: string;
      }

      const middleware = create<TestState, TestContext, TestRequest>({
        name: 'full-typed',
        handler: async (ctx, next) => {
          ctx.state.test = true;
          ctx.helper = () => {};
          const _data = ctx.request.body.data;
          await next();
        },
      });

      expect(middleware.name).toBe('full-typed');
      expect(middleware._types).toBeDefined();
    });

    it('should handle middleware with conflicting state properties', () => {
      interface Middleware1State extends State {
        value: string;
      }

      interface Middleware2State extends State {
        value: number; // Conflicting type
      }

      const m1 = create<Middleware1State>({
        name: 'm1',
        handler: async (ctx, next) => {
          ctx.state.value = 'string';
          await next();
        },
      });

      const m2 = create<Middleware2State>({
        name: 'm2',
        handler: async (ctx, next) => {
          ctx.state.value = 123;
          await next();
        },
      });

      // TypeScript will catch this conflict at compile time
      // The last middleware's type wins in intersection
      expect(m1.name).toBe('m1');
      expect(m2.name).toBe('m2');
    });
  });
});
