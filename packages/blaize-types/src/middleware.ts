import type { Context, State, QueryParams } from './context';

/**
 * Function to pass control to the next middleware
 */
export type NextFunction = () => Promise<void> | void;

/**
 * Type manifest for middleware type information
 * Carries type information through the middleware chain
 */
export interface MiddlewareTypeManifest<
  TState extends State = State,
  TContext = unknown,
  TRequest = unknown,
> {
  state?: TState;
  context?: TContext;
  request?: TRequest;
}

/**
 * Middleware function signature with type parameters
 * @template TState - State modifications this middleware makes
 * @template TContext - Additional properties/methods added to context
 * @template TRequest - Request body type the middleware expects
 */
export type MiddlewareFunction<
  TState extends State = State,
  TContext = unknown,
  TRequest = unknown,
> = (
  ctx: Context<TState, TRequest, QueryParams> & TContext,
  next: NextFunction
) => Promise<void> | void;

/**
 * Named middleware options with type parameters
 * @template TState - State modifications this middleware makes
 * @template TContext - Additional properties/methods added to context
 * @template TRequest - Request body type the middleware expects
 */
export interface MiddlewareOptions<
  TState extends State = State,
  TContext = unknown,
  TRequest = unknown,
> {
  /** Name of the middleware for debugging and logging */
  name?: string;

  /** The middleware handler function */
  handler: MiddlewareFunction<TState, TContext, TRequest>;

  /** Skip function to conditionally bypass middleware */
  skip?: ((ctx: Context<TState, TRequest, QueryParams> & TContext) => boolean) | undefined;

  /** Enable debugging for this middleware */
  debug?: boolean;
}

/**
 * Middleware interface with type parameters for enhanced type safety
 * @template TState - State modifications this middleware makes
 * @template TContext - Additional properties/methods added to context
 * @template TRequest - Request body type the middleware expects
 */
export interface Middleware<TState extends State = State, TContext = unknown, TRequest = unknown> {
  /** Name of the middleware for debugging and logging */
  name: string;

  /** The middleware execution function */
  execute: MiddlewareFunction<TState, TContext, TRequest>;

  /** Skip function to conditionally bypass middleware */
  skip?: ((ctx: Context<TState, TRequest, QueryParams> & TContext) => boolean) | undefined;

  /** Enable debugging for this middleware */
  debug?: boolean | undefined;

  /** Optional type manifest for carrying type information */
  _types?: MiddlewareTypeManifest<TState, TContext, TRequest>;
}

/**
 * Helper type to extract state modifications from middleware
 */
export type ExtractState<T> = T extends Middleware<infer S, any, any> ? S : State;

/**
 * Helper type to extract context additions from middleware
 */
export type ExtractContext<T> = T extends Middleware<any, infer C, any> ? C : unknown;

/**
 * Helper type to extract request type from middleware
 */
export type ExtractRequest<T> = T extends Middleware<any, any, infer R> ? R : unknown;

/**
 * Compose multiple middleware state types with depth limiting
 * @template T - Array of middleware to compose
 * @template Depth - Internal depth tracking (max 10 levels)
 */
export type ComposeStates<
  T extends readonly Middleware<any, any, any>[],
  Depth extends readonly unknown[] = [],
> = Depth['length'] extends 10
  ? State // Fallback to base State after 10 levels
  : T extends readonly [Middleware<infer S1, any, any>, ...infer Rest]
    ? Rest extends readonly Middleware<any, any, any>[]
      ? S1 & ComposeStates<Rest, [...Depth, unknown]>
      : S1
    : State;

/**
 * Compose multiple middleware context additions with depth limiting
 * @template T - Array of middleware to compose
 * @template Depth - Internal depth tracking (max 10 levels)
 */
export type ComposeContexts<
  T extends readonly Middleware<any, any, any>[],
  Depth extends readonly unknown[] = [],
> = Depth['length'] extends 10
  ? unknown // Fallback to unknown after 10 levels
  : T extends readonly [Middleware<any, infer C1, any>, ...infer Rest]
    ? Rest extends readonly Middleware<any, any, any>[]
      ? C1 & ComposeContexts<Rest, [...Depth, unknown]>
      : C1
    : unknown;

/**
 * Compose multiple middleware request types with depth limiting
 * @template T - Array of middleware to compose
 * @template Depth - Internal depth tracking (max 10 levels)
 */
export type ComposeRequests<
  T extends readonly Middleware<any, any, any>[],
  Depth extends readonly unknown[] = [],
> = Depth['length'] extends 10
  ? Request // Fallback to base Request after 10 levels
  : T extends readonly [Middleware<any, any, infer R1>, ...infer Rest]
    ? Rest extends readonly Middleware<any, any, any>[]
      ? R1 & ComposeRequests<Rest, [...Depth, unknown]>
      : R1
    : unknown;
