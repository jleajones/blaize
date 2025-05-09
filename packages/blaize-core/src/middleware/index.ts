/**
 * BlaizeJS Middleware Module
 *
 * Provides the middleware system for processing requests and responses.
 */

import { Context } from '../context';

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
  skip?: (ctx: Context) => boolean;

  /** Enable debugging for this middleware */
  debug?: boolean;
}

/**
 * Middleware type
 */
export type Middleware =
  | MiddlewareFunction
  | {
      name: string;
      execute: MiddlewareFunction;
      skip?: (ctx: Context) => boolean;
      debug?: boolean;
    };

/**
 * Create a middleware
 */
export function createMiddleware(
  _handlerOrOptions: MiddlewareFunction | MiddlewareOptions
): Middleware {
  // Implementation placeholder
  throw new Error('Middleware implementation not yet available');
}

/**
 * Compose multiple middleware functions into a single middleware
 */
export function compose(_middleware: Middleware[]): Middleware {
  // Implementation placeholder
  throw new Error('Middleware composition not yet available');
}
