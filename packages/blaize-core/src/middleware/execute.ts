import type {
  EventSchemas,
  TypedEventBus,
  Context,
  BlaizeLogger,
  Middleware,
  NextFunction,
} from '@blaize-types';

/**
 * Execute a single middleware, handling both function and object forms
 *
 * handle undefined middleware and skip logic
 *
 *  @param middleware - The middleware to execute (or undefined)
 *  @param ctx - The Blaize context object
 *  @param next - Function to invoke the next middleware in the chain
 *  @param logger - Logger instance for logging within the middleware
 *
 *  @returns A Promise that resolves when middleware execution is complete
 *
 *  @example
 * ```typescript
 * const logger = createLogger();
 * await execute(myMiddleware, ctx, next, logger);
 * ```
 */
export function execute(
  middleware: Middleware | undefined,
  ctx: Context,
  next: NextFunction,
  logger: BlaizeLogger,
  eventBus: TypedEventBus<EventSchemas>
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
    const result = middleware.execute({ ctx, next, logger, eventBus });

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
