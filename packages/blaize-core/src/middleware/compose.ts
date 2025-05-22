import { Context, Middleware, MiddlewareFunction, NextFunction } from '@blaizejs/types';

import { execute } from './execute';

/**
 * Compose multiple middleware functions into a single middleware function
 */
export function compose(middlewareStack: Middleware[]): MiddlewareFunction {
  // No middleware? Return a pass-through function
  if (middlewareStack.length === 0) {
    return async (_, next) => {
      await Promise.resolve(next());
    };
  }

  // Return a function that executes the middleware stack
  return async function (ctx: Context, finalHandler: NextFunction): Promise<void> {
    // Keep track of which "next" functions have been called
    const called = new Set<number>();

    // Create dispatch function to process middleware stack
    const dispatch = async (i: number): Promise<void> => {
      // If we've reached the end of the stack, execute the final handler
      if (i >= middlewareStack.length) {
        // Ensure we're returning a Promise regardless of what finalHandler returns
        return Promise.resolve(finalHandler());
      }

      // Get current middleware
      const middleware = middlewareStack[i];

      // Create a next function that can only be called once
      const nextDispatch = () => {
        if (called.has(i)) {
          throw new Error('next() called multiple times');
        }

        // Mark this middleware's next as called
        called.add(i);

        // Move to the next middleware
        return dispatch(i + 1);
      };

      // Use the executeMiddleware function we defined
      return execute(middleware, ctx, nextDispatch);
    };

    // Start middleware chain execution
    return dispatch(0);
  };
}
