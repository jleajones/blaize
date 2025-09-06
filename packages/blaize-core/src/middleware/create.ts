/* eslint-disable @typescript-eslint/no-empty-object-type */
import type { Middleware, MiddlewareOptions, MiddlewareFunction } from '@blaize-types/middleware';

/**
 * Create a middleware
 */
export function create<TState = {}, TServices = {}>(
  handlerOrOptions: MiddlewareFunction | MiddlewareOptions
): Middleware<TState, TServices> {
  // If handlerOrOptions is a function, convert it to our middleware object format
  if (typeof handlerOrOptions === 'function') {
    return {
      name: 'anonymous', // Default name for function middleware
      execute: handlerOrOptions,
      debug: false,
    } as Middleware<TState, TServices>;
  }

  // Otherwise, handle it as middleware options
  const { name = 'anonymous', handler, skip, debug = false } = handlerOrOptions;

  // Create base middleware object with required properties
  const middleware = {
    name,
    execute: handler,
    debug,
    ...(skip !== undefined && { skip }),
  } as Middleware<TState, TServices>;

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
 */
export function stateMiddleware<T = {}>(handler: MiddlewareFunction): Middleware<T, {}> {
  return create<T, {}>({
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
 */
export function serviceMiddleware<T = {}>(handler: MiddlewareFunction): Middleware<{}, T> {
  return create<{}, T>({
    name: 'service-middleware',
    handler,
  });
}
