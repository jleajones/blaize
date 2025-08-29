import { execute } from './execute';

import type { Context } from '@blaize-types/context';
import type {
  Middleware,
  NextFunction,
  MiddlewareFunction,
  ComposeStates,
  ComposeContexts,
  ComposeRequests,
} from '@blaize-types/middleware';

/**
 * Compose multiple middleware into a single middleware
 * @param middlewareStack Array of middleware to compose
 * @returns A Middleware object with composed types
 */
export function compose<TMiddlewares extends readonly Middleware[]>(
  middlewareStack: TMiddlewares
): Middleware<
  ComposeStates<TMiddlewares>,
  ComposeContexts<TMiddlewares>,
  ComposeRequests<TMiddlewares>
> {
  // Runtime validation for development mode
  if (process.env.NODE_ENV === 'development' && middlewareStack.length > 10) {
    console.warn(
      `[BlaizeJS] Composing ${middlewareStack.length} middleware. ` +
        `Type tracking degrades after 10. Consider nested composition for better type safety.`
    );
  }

  // No middleware? Return a pass-through middleware
  if (middlewareStack.length === 0) {
    return {
      name: 'empty-compose',
      execute: async (_, next) => {
        await Promise.resolve(next());
      },
      _types: {} as any,
    };
  }

  // Create the composed execution function
  const composedExecute: MiddlewareFunction = async function (
    ctx: Context,
    finalHandler: NextFunction
  ): Promise<void> {
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

  // Return a full Middleware object
  return {
    name: `composed(${middlewareStack.map(m => m.name || 'unnamed').join(',')})`,
    execute: composedExecute,
    _types: {} as any, // Type carrier to preserve composition types
  };
}
