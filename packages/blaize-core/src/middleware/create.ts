/* eslint-disable @typescript-eslint/no-empty-object-type */
import type { EventSchemas, Services, State } from '@blaize-types';
import type { Middleware, MiddlewareOptions, MiddlewareFunction } from '@blaize-types/middleware';

/**
 * Create a middleware
 */
export function create<
  TState extends State = State,
  TServices extends Services = Services,
  TEvents extends EventSchemas = EventSchemas,
>(
  handlerOrOptions: MiddlewareFunction<TEvents> | MiddlewareOptions<TEvents>
): Middleware<TState, TServices, TEvents> {
  // If handlerOrOptions is a function, convert it to our middleware object format
  if (typeof handlerOrOptions === 'function') {
    return {
      name: 'anonymous', // Default name for function middleware
      execute: handlerOrOptions,
      debug: false,
    } as Middleware<TState, TServices, TEvents>;
  }

  // Otherwise, handle it as middleware options
  const { name = 'anonymous', handler, skip, debug = false } = handlerOrOptions;

  // Create base middleware object with required properties
  const middleware = {
    name,
    execute: handler,
    debug,
    ...(skip !== undefined && { skip }),
  } as Middleware<TState, TServices, TEvents>;

  return middleware;
}

/**
 * Create a middleware that only contributes state (no services)
 * Convenience helper for state-only middleware
 *
 * @template T - Type of state to contribute
 * @param handler - Middleware function that adds state
 * @returns Middleware that contributes state only
 *
 * @example
 * ```typescript
 * interface MyState {
 *   requestId: string;
 * }
 *
 * const middleware = stateMiddleware<MyState>(
 *   async ({ ctx, next, logger }) => {
 *     ctx.state.requestId = generateId();
 *     await next();
 *   }
 * );
 * ```
 */
export function stateMiddleware<
  T extends State = State,
  TEvents extends EventSchemas = EventSchemas,
>(handler: MiddlewareFunction<TEvents>): Middleware<T, {}, TEvents> {
  return create<T, {}, TEvents>({
    name: 'state-middleware',
    handler,
  });
}

/**
 * Create a middleware that only contributes services (no state)
 * Convenience helper for service-only middleware
 *
 * @template T - Type of services to contribute
 * @param handler - Middleware function that adds services
 * @returns Middleware that contributes services only
 *
 * @example
 * ```typescript
 * interface MyServices {
 *   database: Database;
 * }
 *
 * const middleware = serviceMiddleware<MyServices>(
 *   async ({ ctx, next, logger }) => {
 *     ctx.services.database = connectToDatabase();
 *     await next();
 *   }
 * );
 * ```
 */
export function serviceMiddleware<
  T extends Services = Services,
  TEvents extends EventSchemas = EventSchemas,
>(handler: MiddlewareFunction<TEvents>): Middleware<{}, T, TEvents> {
  return create<{}, T, TEvents>({
    name: 'service-middleware',
    handler,
  });
}
