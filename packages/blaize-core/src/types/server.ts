/**
 * Type inference utilities for BlaizeJS
 * Minimal set of utilities needed for type-safe routing
 */

import type { Server, Context, State, Services } from '@blaize-types/index';

/**
 * Infers the context type from a server instance
 *
 * @example
 * ```typescript
 * const server = createServer().use(authMiddleware);
 * type AppContext = InferContext<typeof server>;
 * ```
 */
export type InferContext<T> =
  T extends Server<infer TState, infer TServices>
    ? TState extends State
      ? TServices extends Services
        ? Context<TState, TServices, any, any>
        : Context<State, Services, any, any>
      : Context<State, Services, any, any>
    : Context<State, Services, any, any>;

/**
 * Extracts just the state type from a server
 */
export type InferServerState<T> =
  T extends Server<infer TState, any> ? (TState extends State ? TState : State) : State;

/**
 * Extracts just the services type from a server
 */
export type InferServerServices<T> =
  T extends Server<any, infer TServices>
    ? TServices extends Services
      ? TServices
      : Services
    : Services;

/**
 * Runtime helper that provides type hints for development
 * Returns an empty object but gives TypeScript the correct context type
 *
 * @param _server - The server instance (not used at runtime)
 * @returns An empty object typed as the server's context
 */
export function inferContext<TState extends State, TServices extends Services>(
  _server: Server<TState, TServices>
): InferContext<Server<TState, TServices>> {
  return {} as InferContext<Server<TState, TServices>>;
}
