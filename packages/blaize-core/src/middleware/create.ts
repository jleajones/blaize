import type { State } from '@blaize-types/context';
import type { Middleware, MiddlewareOptions, MiddlewareFunction } from '@blaize-types/middleware';

/**
 * Create a typed middleware from a function or options
 * @template TState - State modifications this middleware makes
 * @template TContext - Additional properties/methods added to context
 * @template TRequest - Request body type the middleware expects
 */
export function create<TState extends State = State, TContext = unknown, TRequest = unknown>(
  handlerOrOptions:
    | MiddlewareFunction<TState, TContext, TRequest>
    | MiddlewareOptions<TState, TContext, TRequest>
): Middleware<TState, TContext, TRequest> {
  // If handlerOrOptions is a function, convert it to middleware object
  if (typeof handlerOrOptions === 'function') {
    return {
      name: 'anonymous',
      execute: handlerOrOptions,
      debug: false,
      _types: {
        state: undefined as unknown as TState,
        context: undefined as unknown as TContext,
        request: undefined as unknown as TRequest,
      },
    };
  }

  // Handle as middleware options
  const { name = 'anonymous', handler, skip, debug = false } = handlerOrOptions;

  // Create middleware object
  const middleware: Middleware<TState, TContext, TRequest> = {
    name,
    execute: handler,
    debug,
    _types: {
      state: undefined as unknown as TState,
      context: undefined as unknown as TContext,
      request: undefined as unknown as TRequest,
    },
  };

  // Add skip function if provided
  if (skip !== undefined) {
    middleware.skip = skip;
  }

  return middleware;
}
