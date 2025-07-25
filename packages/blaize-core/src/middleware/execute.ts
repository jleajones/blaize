import type { Context } from '@blaize-types/context';
import type { Middleware, NextFunction } from '@blaize-types/middleware';

/**
 * Execute a single middleware, handling both function and object forms
 */
export function execute(
  middleware: Middleware | undefined,
  ctx: Context,
  next: NextFunction
): Promise<void> {
  // Handle undefined middleware (safety check)
  if (!middleware) {
    return Promise.resolve(next());
  }

  // Handle middleware with skip function
  if (middleware.skip && middleware.skip(ctx)) {
    return Promise.resolve(next());
  }

  try {
    // Execute middleware
    const result = middleware.execute(ctx, next);

    // Handle both Promise and non-Promise returns
    if (result instanceof Promise) {
      // Return the promise directly to allow errors to propagate
      return result;
    } else {
      // Only wrap non-Promise returns
      return Promise.resolve(result);
    }
  } catch (error) {
    // Handle synchronous errors
    return Promise.reject(error);
  }
}
