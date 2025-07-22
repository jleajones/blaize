import type { Middleware, MiddlewareOptions, MiddlewareFunction } from '@blaize-types/middleware';

/**
 * Create a middleware
 */
export function create(handlerOrOptions: MiddlewareFunction | MiddlewareOptions): Middleware {
  // If handlerOrOptions is a function, convert it to our middleware object format
  if (typeof handlerOrOptions === 'function') {
    return {
      name: 'anonymous', // Default name for function middleware
      execute: handlerOrOptions,
      debug: false,
    };
  }

  // Otherwise, handle it as middleware options
  const { name = 'anonymous', handler, skip, debug = false } = handlerOrOptions;

  // Create base middleware object with required properties
  const middleware: Middleware = {
    name,
    execute: handler,
    debug,
  };

  if (skip !== undefined) {
    return {
      ...middleware,
      skip,
    };
  }

  return middleware;
}
