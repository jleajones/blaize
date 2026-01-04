/**
 * Tests for Handler Context Types
 *
 * Comprehensive type-level tests to verify correct type inference,
 * generic parameter flow, and destructuring patterns.
 *
 * Location: packages/blaize-core/src/types/handler-context.test.ts
 */

import { z } from 'zod';

import type { ExtractMiddlewareState } from '@blaize-types';
import type { Context, State, Services, QueryParams } from '@blaize-types/context';
import type { EventSchemas, TypedEventBus } from '@blaize-types/events';
import type {
  HandlerContext,
  SSEHandlerContext,
  MiddlewareContext,
  PluginSetupContext,
} from '@blaize-types/handler-context';
import type { BlaizeLogger } from '@blaize-types/logger';
import type { Middleware, NextFunction } from '@blaize-types/middleware';
import type { SSEStreamExtended } from '@blaize-types/sse';

describe('Handler Context Types', () => {
  // ==========================================================================
  // HandlerContext Tests
  // ==========================================================================

  describe('HandlerContext', () => {
    describe('Default Generics', () => {
      it('should use default types when no generics specified', () => {
        const context: HandlerContext = {} as HandlerContext;

        expectTypeOf(context.ctx).toEqualTypeOf<Context<State, Services, unknown, QueryParams>>();
        expectTypeOf(context.params).toEqualTypeOf<Record<string, string>>();
        expectTypeOf(context.logger).toEqualTypeOf<BlaizeLogger>();
        expectTypeOf(context.eventBus).toEqualTypeOf<TypedEventBus<EventSchemas>>();
      });

      it('should allow destructuring with defaults', () => {
        const handler = ({ ctx, params, logger, eventBus }: HandlerContext) => {
          expectTypeOf(ctx).toEqualTypeOf<Context<State, Services, unknown, QueryParams>>();
          expectTypeOf(params).toEqualTypeOf<Record<string, string>>();
          expectTypeOf(logger).toEqualTypeOf<BlaizeLogger>();
          expectTypeOf(eventBus).toEqualTypeOf<TypedEventBus<EventSchemas>>();
        };

        expectTypeOf(handler).toBeFunction();
      });
    });

    describe('Custom State and Services', () => {
      interface AppState extends State {
        user: { id: string; role: string };
        requestId: string;
      }

      interface AppServices extends Services {
        db: { query: (sql: string) => Promise<unknown> };
        cache: { get: (key: string) => Promise<string | null> };
      }

      it('should accept custom state and services', () => {
        // Test the type directly without accessing runtime properties
        type TestContext = HandlerContext<AppState, AppServices>;
        type CtxType = TestContext['ctx'];
        type StateType = CtxType['state'];
        type ServicesType = CtxType['services'];

        expectTypeOf<CtxType>().toEqualTypeOf<
          Context<AppState, AppServices, unknown, QueryParams>
        >();
        expectTypeOf<StateType['user']>().toEqualTypeOf<{ id: string; role: string }>();
        expectTypeOf<ServicesType['db']>().toEqualTypeOf<{
          query: (sql: string) => Promise<unknown>;
        }>();
      });

      it('should allow destructuring with custom types', () => {
        const handler = ({ ctx }: HandlerContext<AppState, AppServices>) => {
          expectTypeOf(ctx.state.user.id).toEqualTypeOf<string>();
          expectTypeOf(ctx.state.user.role).toEqualTypeOf<string>();
          expectTypeOf(ctx.services.db.query).toBeFunction();
          expectTypeOf(ctx.services.cache.get).toBeFunction();
        };

        expectTypeOf(handler).toBeFunction();
      });
    });

    describe('Typed Request Body and Query', () => {
      interface CreateUserBody {
        name: string;
        email: string;
      }

      interface UserQuery {
        includeDeleted?: boolean;
        limit: string;
      }

      it('should type body and query correctly', () => {
        type TestContext = HandlerContext<State, Services, CreateUserBody, UserQuery>;
        type RequestType = TestContext['ctx']['request'];

        expectTypeOf<RequestType['body']>().toEqualTypeOf<CreateUserBody>();
        expectTypeOf<RequestType['query']>().toEqualTypeOf<UserQuery>();
      });

      it('should allow body access in handlers', () => {
        const handler = ({ ctx }: HandlerContext<State, Services, CreateUserBody>) => {
          expectTypeOf(ctx.request.body.name).toEqualTypeOf<string>();
          expectTypeOf(ctx.request.body.email).toEqualTypeOf<string>();
        };

        expectTypeOf(handler).toBeFunction();
      });
    });

    describe('Typed URL Parameters', () => {
      interface RouteParams {
        userId: string;
        postId: string;
      }

      it('should type params correctly', () => {
        type TestContext = HandlerContext<State, Services, unknown, QueryParams, RouteParams>;
        type ParamsType = TestContext['params'];

        expectTypeOf<ParamsType>().toEqualTypeOf<RouteParams>();
        expectTypeOf<ParamsType['userId']>().toEqualTypeOf<string>();
        expectTypeOf<ParamsType['postId']>().toEqualTypeOf<string>();
      });

      it('should allow params destructuring', () => {
        const handler = ({
          params,
        }: HandlerContext<State, Services, unknown, QueryParams, RouteParams>) => {
          expectTypeOf(params.userId).toEqualTypeOf<string>();
          expectTypeOf(params.postId).toEqualTypeOf<string>();
        };

        expectTypeOf(handler).toBeFunction();
      });
    });

    describe('Typed Event Schemas', () => {
      const _eventSchemas = {
        'user:created': z.object({ userId: z.string() }),
        'user:updated': z.object({ userId: z.string(), changes: z.record(z.unknown()) }),
      } as const satisfies EventSchemas;

      type AppEventSchemas = typeof _eventSchemas;

      it('should type eventBus with custom schemas', () => {
        const context: HandlerContext<
          State,
          Services,
          unknown,
          QueryParams,
          Record<string, string>,
          AppEventSchemas
        > = {} as HandlerContext<
          State,
          Services,
          unknown,
          QueryParams,
          Record<string, string>,
          AppEventSchemas
        >;

        expectTypeOf(context.eventBus).toEqualTypeOf<TypedEventBus<AppEventSchemas>>();
      });
    });

    describe('Partial Destructuring', () => {
      it('should allow destructuring only needed properties', () => {
        const handler1 = ({ ctx, logger }: HandlerContext) => {
          expectTypeOf(ctx).not.toBeNever();
          expectTypeOf(logger).not.toBeNever();
        };

        const handler2 = ({ params, eventBus }: HandlerContext) => {
          expectTypeOf(params).not.toBeNever();
          expectTypeOf(eventBus).not.toBeNever();
        };

        const handler3 = ({ ctx }: HandlerContext) => {
          expectTypeOf(ctx).not.toBeNever();
        };

        expectTypeOf(handler1).toBeFunction();
        expectTypeOf(handler2).toBeFunction();
        expectTypeOf(handler3).toBeFunction();
      });
    });

    describe('Nested Destructuring', () => {
      it('should allow nested destructuring of ctx', () => {
        const handler = ({ ctx: { state, services, request }, params }: HandlerContext) => {
          expectTypeOf(state).toEqualTypeOf<State>();
          expectTypeOf(services).toEqualTypeOf<Services>();
          expectTypeOf(request).not.toBeNever();
          expectTypeOf(params).toEqualTypeOf<Record<string, string>>();
        };

        expectTypeOf(handler).toBeFunction();
      });

      it('should allow nested destructuring with custom types', () => {
        interface AppState extends State {
          user: { id: string };
        }

        const handler = ({
          ctx: {
            state: { user },
          },
          params: { userId },
        }: HandlerContext<AppState, Services, unknown, QueryParams, { userId: string }>) => {
          expectTypeOf(user).toEqualTypeOf<{ id: string }>();
          expectTypeOf(userId).toEqualTypeOf<string>();
        };

        expectTypeOf(handler).toBeFunction();
      });
    });
  });

  // ==========================================================================
  // SSEHandlerContext Tests
  // ==========================================================================

  describe('SSEHandlerContext', () => {
    describe('Default Generics', () => {
      it('should use default types when no generics specified', () => {
        const context: SSEHandlerContext = {} as SSEHandlerContext;

        expectTypeOf(context.stream).toEqualTypeOf<SSEStreamExtended>();
        expectTypeOf(context.ctx).toEqualTypeOf<Context<State, Services, never, QueryParams>>();
        expectTypeOf(context.params).toEqualTypeOf<Record<string, string>>();
        expectTypeOf(context.logger).toEqualTypeOf<BlaizeLogger>();
        expectTypeOf(context.eventBus).toEqualTypeOf<TypedEventBus<EventSchemas>>();
      });

      it('should allow destructuring with defaults', () => {
        const handler = ({ stream, ctx, params, logger, eventBus }: SSEHandlerContext) => {
          expectTypeOf(stream).toEqualTypeOf<SSEStreamExtended>();
          expectTypeOf(ctx).toEqualTypeOf<Context<State, Services, never, QueryParams>>();
          expectTypeOf(params).toEqualTypeOf<Record<string, string>>();
          expectTypeOf(logger).toEqualTypeOf<BlaizeLogger>();
          expectTypeOf(eventBus).toEqualTypeOf<TypedEventBus<EventSchemas>>();
        };

        expectTypeOf(handler).toBeFunction();
      });
    });

    describe('Body Type as Never', () => {
      it('should type ctx.request.body as never', () => {
        type TestContext = SSEHandlerContext;
        type RequestBodyType = TestContext['ctx']['request']['body'];

        expectTypeOf<RequestBodyType>().toEqualTypeOf<never>();
      });

      it('should not allow body access in SSE handlers', () => {
        const handler = ({ ctx }: SSEHandlerContext) => {
          // This should be a type error
          expectTypeOf(ctx.request.body).toEqualTypeOf<never>();

          const _body: string = ctx.request.body;
        };

        expectTypeOf(handler).toBeFunction();
      });
    });

    describe('Custom Stream Type', () => {
      interface CustomStream extends SSEStreamExtended {
        customMethod(): void;
      }

      it('should accept custom stream type', () => {
        type TestContext = SSEHandlerContext<CustomStream>;
        type StreamType = TestContext['stream'];

        expectTypeOf<StreamType>().toEqualTypeOf<CustomStream>();
        expectTypeOf<StreamType['customMethod']>().toBeFunction();
      });
    });

    describe('Typed Query Parameters', () => {
      interface SSEQuery {
        channel: string;
        filter?: string;
      }

      it('should type query correctly', () => {
        type TestContext = SSEHandlerContext<SSEStreamExtended, State, Services, SSEQuery>;
        type QueryType = TestContext['ctx']['request']['query'];

        expectTypeOf<QueryType>().toEqualTypeOf<SSEQuery>();
      });

      it('should allow query access in handlers', () => {
        const handler = ({
          ctx,
        }: SSEHandlerContext<SSEStreamExtended, State, Services, SSEQuery>) => {
          expectTypeOf(ctx.request.query.channel).toEqualTypeOf<string>();
          expectTypeOf(ctx.request.query.filter).toEqualTypeOf<string | undefined>();
        };

        expectTypeOf(handler).toBeFunction();
      });
    });

    describe('Partial Destructuring', () => {
      it('should allow destructuring only needed properties', () => {
        const handler1 = ({ stream, logger }: SSEHandlerContext) => {
          expectTypeOf(stream).not.toBeNever();
          expectTypeOf(logger).not.toBeNever();
        };

        const handler2 = ({ stream, eventBus }: SSEHandlerContext) => {
          expectTypeOf(stream).not.toBeNever();
          expectTypeOf(eventBus).not.toBeNever();
        };

        expectTypeOf(handler1).toBeFunction();
        expectTypeOf(handler2).toBeFunction();
      });
    });
  });

  // ==========================================================================
  // MiddlewareContext Tests
  // ==========================================================================

  describe('MiddlewareContext', () => {
    describe('Default Generics', () => {
      it('should use default types when no generics specified', () => {
        const context: MiddlewareContext = {} as MiddlewareContext;

        expectTypeOf(context.ctx).toEqualTypeOf<Context<State, Services>>();
        expectTypeOf(context.next).toEqualTypeOf<NextFunction>();
        expectTypeOf(context.logger).toEqualTypeOf<BlaizeLogger>();
        expectTypeOf(context.eventBus).toEqualTypeOf<TypedEventBus<EventSchemas>>();
      });

      it('should allow destructuring with defaults', () => {
        const middleware = ({ ctx, next, logger, eventBus }: MiddlewareContext) => {
          expectTypeOf(ctx).toEqualTypeOf<Context<State, Services>>();
          expectTypeOf(next).toEqualTypeOf<NextFunction>();
          expectTypeOf(logger).toEqualTypeOf<BlaizeLogger>();
          expectTypeOf(eventBus).toEqualTypeOf<TypedEventBus<EventSchemas>>();
        };

        expectTypeOf(middleware).toBeFunction();
      });
    });

    describe('Custom State and Services', () => {
      interface AppState extends State {
        user: { id: string };
      }

      interface AppServices extends Services {
        db: { query: () => Promise<void> };
      }

      it('should accept custom state and services on Middleware interface', () => {
        type TestMiddleware = Middleware<AppState, AppServices>;

        // Test the type carriers (these enable composition)
        expectTypeOf<TestMiddleware['_state']>().toEqualTypeOf<AppState | undefined>();
        expectTypeOf<TestMiddleware['_services']>().toEqualTypeOf<AppServices | undefined>();
      });

      it('should receive base Context in middleware function', () => {
        // Middleware ALWAYS receives base Context
        const middleware: Middleware<AppState, AppServices> = {
          name: 'test',
          execute: async ({ ctx, next }) => {
            // ctx is base Context at runtime
            expectTypeOf(ctx).toEqualTypeOf<Context>();

            // We mutate it to add our properties
            ctx.state.user = { id: '123' };
            ctx.services.db = { query: async () => {} };

            await next();
          },
        };

        expectTypeOf(middleware).toEqualTypeOf<Middleware<AppState, AppServices>>();
      });

      it('should support type composition', () => {
        const _m1: Middleware<{ user: { id: string } }> = {
          name: 'm1',
          execute: async ({ ctx, next }) => {
            ctx.state.user = { id: '123' };
            await next();
          },
        };

        // Verify type extraction works
        type State1 = ExtractMiddlewareState<typeof _m1>;
        expectTypeOf<State1>().toEqualTypeOf<{ user: { id: string } }>();
      });
    });
    describe('Partial Destructuring', () => {
      it('should allow destructuring only needed properties', () => {
        const middleware1 = ({ ctx, next }: MiddlewareContext) => {
          expectTypeOf(ctx).not.toBeNever();
          expectTypeOf(next).not.toBeNever();
        };

        const middleware2 = ({ logger, eventBus }: MiddlewareContext) => {
          expectTypeOf(logger).not.toBeNever();
          expectTypeOf(eventBus).not.toBeNever();
        };

        expectTypeOf(middleware1).toBeFunction();
        expectTypeOf(middleware2).toBeFunction();
      });
    });
  });

  // ==========================================================================
  // PluginSetupContext Tests
  // ==========================================================================

  describe('PluginSetupContext', () => {
    describe('Default Generics', () => {
      it('should use unknown for config when no generic specified', () => {
        const context: PluginSetupContext = {} as PluginSetupContext;

        expectTypeOf(context.config).toEqualTypeOf<unknown>();
        expectTypeOf(context.logger).toEqualTypeOf<BlaizeLogger>();
        expectTypeOf(context.eventBus).toEqualTypeOf<TypedEventBus<EventSchemas>>();
      });

      it('should allow destructuring with defaults', () => {
        const setup = ({ config, logger, eventBus }: PluginSetupContext) => {
          expectTypeOf(config).toEqualTypeOf<unknown>();
          expectTypeOf(logger).toEqualTypeOf<BlaizeLogger>();
          expectTypeOf(eventBus).toEqualTypeOf<TypedEventBus<EventSchemas>>();
        };

        expectTypeOf(setup).toBeFunction();
      });
    });

    describe('Custom Config Type', () => {
      interface CacheConfig {
        provider: 'redis' | 'memory';
        ttl: number;
        maxSize: number;
      }

      it('should accept custom config type', () => {
        type TestContext = PluginSetupContext<CacheConfig>;
        type ConfigType = TestContext['config'];

        expectTypeOf<ConfigType>().toEqualTypeOf<CacheConfig>();
        expectTypeOf<ConfigType['provider']>().toEqualTypeOf<'redis' | 'memory'>();
        expectTypeOf<ConfigType['ttl']>().toEqualTypeOf<number>();
      });

      it('should allow destructuring with custom config', () => {
        const setup = ({ config, logger }: PluginSetupContext<CacheConfig>) => {
          expectTypeOf(config.provider).toEqualTypeOf<'redis' | 'memory'>();
          expectTypeOf(config.ttl).toEqualTypeOf<number>();
          expectTypeOf(config.maxSize).toEqualTypeOf<number>();
          expectTypeOf(logger).toEqualTypeOf<BlaizeLogger>();
        };

        expectTypeOf(setup).toBeFunction();
      });
    });

    describe('Nested Config Destructuring', () => {
      interface DatabaseConfig {
        connection: {
          host: string;
          port: number;
        };
        pool: {
          min: number;
          max: number;
        };
      }

      it('should allow nested destructuring of config', () => {
        const setup = ({
          config: {
            connection: { host, port },
            pool,
          },
        }: PluginSetupContext<DatabaseConfig>) => {
          expectTypeOf(host).toEqualTypeOf<string>();
          expectTypeOf(port).toEqualTypeOf<number>();
          expectTypeOf(pool).toEqualTypeOf<{ min: number; max: number }>();
        };

        expectTypeOf(setup).toBeFunction();
      });
    });

    describe('Partial Destructuring', () => {
      it('should allow destructuring only needed properties', () => {
        const setup1 = ({ config, logger }: PluginSetupContext) => {
          expectTypeOf(config).not.toBeNever();
          expectTypeOf(logger).not.toBeNever();
        };

        const setup2 = ({ eventBus }: PluginSetupContext) => {
          expectTypeOf(eventBus).not.toBeNever();
        };

        expectTypeOf(setup1).toBeFunction();
        expectTypeOf(setup2).toBeFunction();
      });
    });
  });

  // ==========================================================================
  // Cross-Context Type Consistency
  // ==========================================================================

  describe('Cross-Context Type Consistency', () => {
    it('should use same logger type across all contexts', () => {
      const handler: HandlerContext = {} as HandlerContext;
      const sseHandler: SSEHandlerContext = {} as SSEHandlerContext;
      const middleware: MiddlewareContext = {} as MiddlewareContext;
      const plugin: PluginSetupContext = {} as PluginSetupContext;

      expectTypeOf(handler.logger).toEqualTypeOf(sseHandler.logger);
      expectTypeOf(handler.logger).toEqualTypeOf(middleware.logger);
      expectTypeOf(handler.logger).toEqualTypeOf(plugin.logger);
    });

    it('should use same eventBus type across all contexts', () => {
      const handler: HandlerContext = {} as HandlerContext;
      const sseHandler: SSEHandlerContext = {} as SSEHandlerContext;
      const middleware: MiddlewareContext = {} as MiddlewareContext;
      const plugin: PluginSetupContext = {} as PluginSetupContext;

      expectTypeOf(handler.eventBus).toEqualTypeOf(sseHandler.eventBus);
      expectTypeOf(handler.eventBus).toEqualTypeOf(middleware.eventBus);
      expectTypeOf(handler.eventBus).toEqualTypeOf(plugin.eventBus);
    });

    it('should use consistent context types', () => {
      interface AppState extends State {
        user: { id: string };
      }
      interface AppServices extends Services {
        db: unknown;
      }

      type HandlerCtx = HandlerContext<AppState, AppServices>;
      type MiddlewareCtx = MiddlewareContext;

      expectTypeOf<HandlerCtx['ctx']>().toEqualTypeOf<Context<AppState, AppServices>>();
      expectTypeOf<MiddlewareCtx['ctx']>().toEqualTypeOf<Context>();
    });
  });
});
