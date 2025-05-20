import type { Context } from './context';

/**
 * Function to pass control to the next middleware
 */
export type NextFunction = () => Promise<void> | void;

/**
 * Middleware function signature
 */
export type MiddlewareFunction = (ctx: Context, next: NextFunction) => Promise<void> | void;

/**
 * Named middleware options
 */
export interface MiddlewareOptions {
  /** Name of the middleware for debugging and logging */
  name?: string;

  /** The middleware handler function */
  handler: MiddlewareFunction;

  /** Skip function to conditionally bypass middleware */
  skip?: ((ctx: Context) => boolean) | undefined;

  /** Enable debugging for this middleware */
  debug?: boolean;
}

/**
 * Middleware type
 */
export interface Middleware {
  name: string;
  execute: MiddlewareFunction;
  skip?: ((ctx: Context) => boolean) | undefined;
  debug?: boolean | undefined;
}
