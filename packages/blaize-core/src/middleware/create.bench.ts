import { bench } from 'vitest';

import { createMockContext } from '@blaizejs/testing-utils';

import { create } from './create';

import type { Context, State } from '@blaize-types/context';
import type {
  Middleware,
  MiddlewareFunction,
  MiddlewareOptions,
  ExtractState,
  ExtractContext,
  ExtractRequest,
  ComposeStates,
  ComposeContexts,
} from '@blaize-types/middleware';

// Sample state types for benchmarking
interface UserState extends State {
  user?: { id: string; name: string };
}

interface AuthState extends State {
  authenticated: boolean;
  token?: string;
}

interface SessionState extends State {
  sessionId: string;
  expiresAt: number;
}

// Sample context extensions
interface LoggerContext {
  log: (message: string) => void;
}

interface DatabaseContext {
  db: {
    query: (sql: string) => Promise<any>;
  };
}

// Sample request types
interface LoginRequest {
  username: string;
  password: string;
}

interface CreateUserRequest {
  email: string;
  name: string;
  age: number;
}

describe('Middleware Creation Performance', () => {
  // Benchmark simple function middleware creation
  bench('create middleware from function', () => {
    const handler: MiddlewareFunction = async (ctx, next) => {
      await next();
    };

    const middleware = create(handler);
    // Force evaluation to prevent optimization
    void middleware.name;
  });

  // Benchmark typed middleware creation from function
  bench('create typed middleware from function', () => {
    const handler: MiddlewareFunction<UserState, LoggerContext, LoginRequest> = async (
      ctx,
      next
    ) => {
      ctx.state.user = { id: '1', name: 'test' };
      ctx.log('user logged in');
      await next();
    };

    const middleware = create<UserState, LoggerContext, LoginRequest>(handler);
    void middleware.name;
  });

  // Benchmark middleware creation with options
  bench('create middleware with options', () => {
    const options: MiddlewareOptions = {
      name: 'auth',
      handler: async (ctx, next) => {
        await next();
      },
      debug: true,
    };

    const middleware = create(options);
    void middleware.name;
  });

  // Benchmark middleware creation with skip function
  bench('create middleware with skip function', () => {
    const options: MiddlewareOptions<AuthState> = {
      name: 'auth-check',
      handler: async (ctx, next) => {
        ctx.state.authenticated = true;
        await next();
      },
      skip: ctx => ctx.state.authenticated === true,
      debug: false,
    };

    const middleware = create(options);
    void middleware.skip;
  });

  // Benchmark complex typed middleware
  bench('create complex typed middleware', () => {
    const options: MiddlewareOptions<
      UserState & AuthState & SessionState,
      LoggerContext & DatabaseContext,
      CreateUserRequest
    > = {
      name: 'complex-middleware',
      handler: async (ctx, next) => {
        ctx.state.user = { id: '1', name: 'test' };
        ctx.state.authenticated = true;
        ctx.state.sessionId = 'session-123';
        ctx.state.expiresAt = Date.now() + 3600000;

        await ctx.db.query('SELECT * FROM users');
        ctx.log('Complex operation completed');

        await next();
      },
      skip: ctx => !ctx.state.authenticated,
      debug: true,
    };

    const middleware = create(options);
    void middleware._types;
  });

  // Benchmark batch middleware creation
  bench('create 100 middleware instances', () => {
    const middlewares: Middleware[] = [];

    for (let i = 0; i < 100; i++) {
      middlewares.push(
        create({
          name: `middleware-${i}`,
          handler: async (ctx, next) => {
            await next();
          },
        })
      );
    }

    void middlewares.length;
  });

  // Benchmark middleware creation with different state sizes
  bench('create middleware with large state object', () => {
    interface LargeState extends State {
      prop1: string;
      prop2: number;
      prop3: boolean;
      prop4: { nested1: string; nested2: number };
      prop5: string[];
      prop6: Map<string, any>;
      prop7: Set<number>;
      prop8: Date;
      prop9: RegExp;
      prop10: Promise<void>;
    }

    const middleware = create<LargeState>({
      name: 'large-state',
      handler: async (ctx, next) => {
        ctx.state.prop1 = 'value';
        ctx.state.prop2 = 42;
        ctx.state.prop3 = true;
        await next();
      },
    });

    void middleware._types;
  });
});

describe('Type Extraction Performance', () => {
  // Create sample middleware for type extraction
  const authMiddleware = create<AuthState, LoggerContext>({
    name: 'auth',
    handler: async (ctx, next) => {
      ctx.state.authenticated = true;
      await next();
    },
  });

  const userMiddleware = create<UserState, DatabaseContext, LoginRequest>({
    name: 'user',
    handler: async (ctx, next) => {
      ctx.state.user = { id: '1', name: 'test' };
      await next();
    },
  });

  const sessionMiddleware = create<SessionState>({
    name: 'session',
    handler: async (ctx, next) => {
      ctx.state.sessionId = 'session-123';
      await next();
    },
  });

  // Benchmark type extraction utilities
  bench('extract state type from middleware', () => {
    type AuthStateType = ExtractState<typeof authMiddleware>;
    type UserStateType = ExtractState<typeof userMiddleware>;
    type SessionStateType = ExtractState<typeof sessionMiddleware>;

    // Force type evaluation through assignment
    const _auth: AuthStateType = { authenticated: true };
    const _user: UserStateType = { user: { id: '1', name: 'test' } };
    const _session: SessionStateType = { sessionId: 'test', expiresAt: Date.now() + 3600000 };

    void _auth;
    void _user;
    void _session;
  });

  bench('extract context type from middleware', () => {
    type LoggerContextType = ExtractContext<typeof authMiddleware>;
    type DatabaseContextType = ExtractContext<typeof userMiddleware>;

    // Force type evaluation
    const _logger: LoggerContextType = { log: () => {} };
    const _db: DatabaseContextType = { db: { query: async () => ({}) } };

    void _logger;
    void _db;
  });

  bench('extract request type from middleware', () => {
    type LoginRequestType = ExtractRequest<typeof userMiddleware>;

    // Force type evaluation
    const _request: LoginRequestType = { username: 'test', password: 'pass' };

    void _request;
  });

  bench('compose states from middleware array', () => {
    const _middlewares = [authMiddleware, userMiddleware, sessionMiddleware] as const;

    type ComposedState = ComposeStates<typeof _middlewares>;

    // Force type evaluation
    const _composed: ComposedState = {
      authenticated: true,
      user: { id: '1', name: 'test' },
      sessionId: 'session-123',
      expiresAt: Date.now(),
    };

    void _composed;
  });

  bench('compose contexts from middleware array', () => {
    const _middlewares = [authMiddleware, userMiddleware] as const;

    type ComposedContext = ComposeContexts<typeof _middlewares>;

    // Force type evaluation
    const _composed: ComposedContext = {
      log: () => {},
      db: { query: async () => ({}) },
    };

    void _composed;
  });

  // Benchmark deeply nested type composition (up to depth limit)
  bench('compose deeply nested middleware types', () => {
    // Create 10 middleware instances (max depth)
    const m1 = create<{ prop1: string }>({ name: 'm1', handler: async (ctx, next) => next() });
    const m2 = create<{ prop2: number }>({ name: 'm2', handler: async (ctx, next) => next() });
    const m3 = create<{ prop3: boolean }>({ name: 'm3', handler: async (ctx, next) => next() });
    const m4 = create<{ prop4: string[] }>({ name: 'm4', handler: async (ctx, next) => next() });
    const m5 = create<{ prop5: Date }>({ name: 'm5', handler: async (ctx, next) => next() });
    const m6 = create<{ prop6: RegExp }>({ name: 'm6', handler: async (ctx, next) => next() });
    const m7 = create<{ prop7: Map<string, any> }>({
      name: 'm7',
      handler: async (ctx, next) => next(),
    });
    const m8 = create<{ prop8: Set<number> }>({ name: 'm8', handler: async (ctx, next) => next() });
    const m9 = create<{ prop9: Promise<void> }>({
      name: 'm9',
      handler: async (ctx, next) => next(),
    });
    const m10 = create<{ prop10: object }>({ name: 'm10', handler: async (ctx, next) => next() });

    const _deepMiddlewares = [m1, m2, m3, m4, m5, m6, m7, m8, m9, m10] as const;

    type DeepComposedState = ComposeStates<typeof _deepMiddlewares>;

    // Force type evaluation
    const _deep: DeepComposedState = {
      prop1: 'test',
      prop2: 42,
      prop3: true,
      prop4: ['a', 'b'],
      prop5: new Date(),
      prop6: /test/,
      prop7: new Map(),
      prop8: new Set(),
      prop9: Promise.resolve(),
      prop10: {},
    };

    void _deep;
  });
});

describe('Middleware Execution Performance', () => {
  // Mock context for execution benchmarks
  const mockContext = createMockContext() as Context;

  bench('execute simple middleware', async () => {
    const middleware = create({
      name: 'simple',
      handler: async (ctx, next) => {
        ctx.state.executed = true;
        await next();
      },
    });

    await middleware.execute(mockContext, async () => {});
  });

  bench('execute middleware with skip check', async () => {
    const middleware = create({
      name: 'with-skip',
      handler: async (ctx, next) => {
        ctx.state.executed = true;
        await next();
      },
      skip: ctx => ctx.state.skipMe === true,
    });

    if (!middleware.skip || !middleware.skip(mockContext)) {
      await middleware.execute(mockContext, async () => {});
    }
  });

  bench('execute middleware chain (5 middlewares)', async () => {
    const middlewares = Array.from({ length: 5 }, (_, i) =>
      create({
        name: `middleware-${i}`,
        handler: async (ctx, next) => {
          ctx.state[`executed${i}`] = true;
          await next();
        },
      })
    );

    // Simulate middleware chain execution
    let index = 0;
    const executeNext = async (): Promise<void> => {
      if (index < middlewares.length) {
        const current = middlewares[index++]!;
        await current.execute(mockContext, executeNext);
      }
    };

    await executeNext();
  });

  bench('execute middleware with complex state manipulation', async () => {
    const mockContext = createMockContext<UserState & AuthState & SessionState>({
      initialState: {
        // You can provide initial state values if needed
        authenticated: false,
      },
    });

    const middleware = create<UserState & AuthState & SessionState>({
      name: 'complex-state',
      handler: async (ctx, next) => {
        // Simulate complex state manipulation
        ctx.state.user = { id: '1', name: 'test' };
        ctx.state.authenticated = true;
        ctx.state.token = 'token-123';
        ctx.state.sessionId = 'session-456';
        ctx.state.expiresAt = Date.now() + 3600000;

        // Simulate some computation
        const hash = Buffer.from(ctx.state.token).toString('base64');
        ctx.state.token = hash;

        await next();
      },
    });

    await middleware.execute(mockContext, async () => {});
  });

  bench('execute middleware with error handling', async () => {
    const middleware = create({
      name: 'with-error-handling',
      handler: async (ctx, next) => {
        try {
          ctx.state.beforeError = true;
          await next();
          ctx.state.afterError = false;
        } catch {
          ctx.state.errorHandled = true;
        }
      },
    });

    await middleware.execute(mockContext, async () => {
      // Simulate potential error
      if (Math.random() > 0.5) {
        throw new Error('Random error');
      }
    });
  });
});

describe('Memory and Allocation Benchmarks', () => {
  bench('memory allocation for middleware creation', () => {
    const middlewares: Middleware[] = [];

    // Create and store many middleware instances
    for (let i = 0; i < 1000; i++) {
      middlewares.push(
        create({
          name: `mem-test-${i}`,
          handler: async (ctx, next) => {
            ctx.state[`prop${i}`] = i;
            await next();
          },
          skip: i % 2 === 0 ? _ctx => false : undefined,
          debug: i % 3 === 0,
        })
      );
    }

    // Ensure references are kept
    void middlewares[0]!.name;
    void middlewares[middlewares.length - 1]!.name;
  });

  bench('middleware with closure over large data', () => {
    const largeData = Array.from({ length: 1000 }, (_, i) => ({
      id: i,
      data: `data-${i}`,
      nested: { value: i * 2 },
    }));

    const middleware = create({
      name: 'closure-middleware',
      handler: async (ctx, next) => {
        // Access closure data
        ctx.state.dataLength = largeData.length;
        ctx.state.firstItem = largeData[0];
        await next();
      },
    });

    void middleware.execute;
  });
});
