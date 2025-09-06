/* eslint-disable @typescript-eslint/no-empty-object-type */
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
  skip?: ((ctx: Context<any, any>) => boolean) | undefined;

  /** Enable debugging for this middleware */
  debug?: boolean;
}

/**
 * Middleware type with generic parameters for type-safe state and service contributions
 * @template TState - Type of state this middleware contributes to the context
 * @template TServices - Type of services this middleware contributes to the context
 */
export interface Middleware<TState = {}, TServices = {}> {
  name: string;
  execute: MiddlewareFunction;
  skip?: ((ctx: Context) => boolean) | undefined;
  debug?: boolean | undefined;

  /**
   * Type carriers for compile-time type information
   * These properties are never used at runtime and exist only for TypeScript's type system
   * @internal
   */
  _state?: TState;
  _services?: TServices;
}
