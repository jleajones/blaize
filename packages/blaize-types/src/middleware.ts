/* eslint-disable @typescript-eslint/no-empty-object-type */
import type { Context, Services, State } from './context';
import type { EventSchemas } from './events';
import type { MiddlewareContext } from './handler-context';

/**
 * Function to pass control to the next middleware
 */
export type NextFunction = () => Promise<void> | void;

/**
 * Middleware function signature
 *
 *  @param ctx - The Blaize context object
 *  @param next - Function to invoke the next middleware in the chain
 *  @param logger - Logger instance for logging within the middleware
 *
 *  @example
 *  const myMiddleware: MiddlewareFunction = async (ctx, next, logger) => {
 *    logger.info('Executing my middleware');
 *    // Middleware logic here
 *    await next();
 *  };
 */
export type MiddlewareFunction<TEvents extends EventSchemas = EventSchemas> = (
  mc: MiddlewareContext<TEvents>
) => Promise<void> | void;

/**
 * Named middleware options
 */
export interface MiddlewareOptions<TEvents extends EventSchemas = EventSchemas> {
  /** Name of the middleware for debugging and logging */
  name?: string;

  /** The middleware handler function */
  handler: MiddlewareFunction<TEvents>;

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
export interface Middleware<
  TState extends State = State,
  TServices extends Services = Services,
  TEvents extends EventSchemas = EventSchemas,
> {
  name: string;
  execute: MiddlewareFunction<TEvents>;
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
