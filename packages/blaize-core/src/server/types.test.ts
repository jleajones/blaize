/* eslint-disable @typescript-eslint/no-empty-object-type */
/**
 * Tests for server type inference utilities
 */

import { create as createServer } from '../../src/server/create';
import {
  inferContext,
  type InferContext,
  type InferServerState,
  type InferServerServices,
} from '../../src/server/types';

import type { Middleware, Plugin } from '@blaize-types/index';

describe('Type Inference Utilities', () => {
  it('should extract context type from server', () => {
    // Create typed middleware
    const authMiddleware: Middleware<
      { user: { id: string; name: string } },
      { auth: { verify: () => boolean } }
    > = {
      name: 'auth',
      execute: async (ctx, next) => {
        ctx.state.user = { id: '123', name: 'Test User' };
        (ctx.services as any).auth = { verify: () => true };
        await next();
      },
    };

    const loggerMiddleware: Middleware<
      { requestId: string },
      { logger: { log: (msg: string) => void } }
    > = {
      name: 'logger',
      execute: async (ctx, next) => {
        ctx.state.requestId = 'req_123';
        (ctx.services as any).logger = { log: console.log };
        await next();
      },
    };

    // Create server with middleware
    const server = createServer().use(authMiddleware).use([loggerMiddleware]);

    // Extract context type
    type AppContext = InferContext<typeof server>;

    // Verify types are correct
    expectTypeOf<AppContext['state']['user']>().toEqualTypeOf<{ id: string; name: string }>();
    expectTypeOf<AppContext['state']['requestId']>().toEqualTypeOf<string>();
    expectTypeOf<AppContext['services']['auth']>().toEqualTypeOf<{ verify: () => boolean }>();
    expectTypeOf<AppContext['services']['logger']>().toEqualTypeOf<{
      log: (msg: string) => void;
    }>();

    // Runtime check - server has the middleware
    expect(server.middleware).toHaveLength(2);
  });

  it('should provide runtime type hints with inferContext', () => {
    const authMiddleware: Middleware<{ authenticated: boolean }, {}> = {
      name: 'auth',
      execute: async (ctx, next) => {
        ctx.state.authenticated = true;
        await next();
      },
    };

    const server = createServer().use(authMiddleware);
    const ctx = inferContext(server);

    // This is just for type hints - the actual object is empty
    expectTypeOf<(typeof ctx)['state']['authenticated']>().toEqualTypeOf<boolean>();
    expect(ctx).toEqual({}); // Runtime value is empty object
  });

  it('should work with reassignment pattern', () => {
    const middleware1: Middleware<{ foo: string }, {}> = {
      name: 'm1',
      execute: async (ctx, next) => {
        ctx.state.foo = 'bar';
        await next();
      },
    };

    const middleware2: Middleware<{ bar: number }, {}> = {
      name: 'm2',
      execute: async (ctx, next) => {
        ctx.state.bar = 42;
        await next();
      },
    };

    const server = createServer().use(middleware1).use(middleware2);

    type AppContext = InferContext<typeof server>;

    expectTypeOf<AppContext['state']['foo']>().toEqualTypeOf<string>();
    expectTypeOf<AppContext['state']['bar']>().toEqualTypeOf<number>();

    // Verify both middleware are present
    expect(server.middleware).toHaveLength(2);
  });

  it('should work with plugins contributing to types', () => {
    const middleware: Middleware<{ user: { id: string } }, { auth: { check: () => boolean } }> = {
      name: 'auth',
      execute: async (ctx, next) => {
        ctx.state.user = { id: '123' };
        (ctx.services as any).auth = { check: () => true };
        await next();
      },
    };

    const plugin: Plugin<
      { pluginLoaded: boolean },
      { db: { query: (sql: string) => Promise<any> } }
    > = {
      name: 'database',
      version: '1.0.0',
      register: async () => {},
    };

    // Build server with both middleware and plugins
    const _server = createServer({
      middleware: [middleware] as const,
      plugins: [plugin] as const,
    });

    type AppContext = InferContext<typeof _server>;

    // Should have both middleware and plugin types
    expectTypeOf<AppContext['state']['user']>().toEqualTypeOf<{ id: string }>();
    expectTypeOf<AppContext['state']['pluginLoaded']>().toEqualTypeOf<boolean>();
    expectTypeOf<AppContext['services']['auth']>().toEqualTypeOf<{ check: () => boolean }>();
    expectTypeOf<AppContext['services']['db']>().toEqualTypeOf<{
      query: (sql: string) => Promise<any>;
    }>();
  });

  it('should extract state and services separately', () => {
    const middleware: Middleware<{ count: number }, { counter: { increment: () => void } }> = {
      name: 'counter',
      execute: async (ctx, next) => {
        ctx.state.count = 0;
        (ctx.services as any).counter = { increment: () => {} };
        await next();
      },
    };

    const _server = createServer().use(middleware);

    // Test InferServerState
    type ServerState = InferServerState<typeof _server>;
    expectTypeOf<ServerState['count']>().toEqualTypeOf<number>();

    // Test InferServerServices
    type ServerServices = InferServerServices<typeof _server>;
    expectTypeOf<ServerServices['counter']>().toEqualTypeOf<{ increment: () => void }>();
  });

  it('should handle empty server with no middleware', () => {
    const _server = createServer();

    type EmptyContext = InferContext<typeof _server>;

    // State and services should be empty objects
    expectTypeOf<EmptyContext['state']>().toEqualTypeOf<{}>();
    expectTypeOf<EmptyContext['services']>().toEqualTypeOf<{}>();
  });

  it('should work with array middleware composition', () => {
    const m1: Middleware<{ a: string }, {}> = {
      name: 'm1',
      execute: async (ctx, next) => {
        ctx.state.a = 'a';
        await next();
      },
    };

    const m2: Middleware<{ b: string }, {}> = {
      name: 'm2',
      execute: async (ctx, next) => {
        ctx.state.b = 'b';
        await next();
      },
    };

    const m3: Middleware<{ c: string }, {}> = {
      name: 'm3',
      execute: async (ctx, next) => {
        ctx.state.c = 'c';
        await next();
      },
    };

    // Add multiple middleware at once
    const server = createServer().use([m1, m2, m3] as const);

    type AppContext = InferContext<typeof server>;

    // All three middleware types should be present
    expectTypeOf<AppContext['state']['a']>().toEqualTypeOf<string>();
    expectTypeOf<AppContext['state']['b']>().toEqualTypeOf<string>();
    expectTypeOf<AppContext['state']['c']>().toEqualTypeOf<string>();

    expect(server.middleware).toHaveLength(3);
  });

  it('should demonstrate usage pattern for routes', () => {
    type UserType = { id: string; role: 'admin' | 'user' };
    type AuthServiceType = { hasPermission: (perm: string) => boolean };
    // This test demonstrates the pattern users will follow

    // Step 1: Create server with middleware
    const authMiddleware: Middleware<{ user: UserType }, { auth: AuthServiceType }> = {
      name: 'auth',
      execute: async (ctx, next) => {
        ctx.state.user = { id: '123', role: 'admin' };
        ctx.services.auth = {
          hasPermission: (_perm: string) => {
            const user = ctx.state.user as UserType;
            return user.role === 'admin';
          },
        };
        await next();
      },
    };

    const server = createServer();
    const _serverWAuth = server.use(authMiddleware);

    // Step 2: Export context type
    type AppContext = InferContext<typeof _serverWAuth>;

    // Step 3: Use in route handler (simulated)
    type RouteHandler = (ctx: AppContext) => Promise<any>;

    const handler: RouteHandler = async ctx => {
      // Full type safety!
      const userId = ctx.state.user.id;
      const canEdit = ctx.services.auth.hasPermission('edit');

      return { userId, canEdit };
    };

    // Verify the handler type works
    assertType<RouteHandler>(handler);
  });
});
