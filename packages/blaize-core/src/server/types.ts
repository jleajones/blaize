/* eslint-disable @typescript-eslint/no-empty-object-type */
/**
 * Type inference utilities for extracting context types from server instances
 *
 * @module blaize-core/server/types
 * @since 0.4.0
 */

import type { Server, Context } from '@blaize-types/index';

/**
 * Extracts the Context type from a Server instance.
 *
 * This utility type allows you to extract the fully typed Context from a server
 * that has accumulated state and services through middleware and plugins.
 *
 * @template T - The Server instance type to extract from
 * @returns The Context type with accumulated state and services, or never if not a Server
 *
 * @example
 * ```typescript
 * // In server.ts
 * let server = createServer();
 * server = server.use(authMiddleware);
 * server = server.use(loggerMiddleware);
 *
 * // Export the context type for use in routes
 * export type AppContext = InferContext<typeof server>;
 *
 * // In routes/users.ts
 * import type { AppContext } from '../server';
 *
 * export const GET = createGetRoute<
 *   ParamsSchema,
 *   QuerySchema,
 *   ResponseSchema,
 *   AppContext['state'],
 *   AppContext['services']
 * >({
 *   handler: async (ctx) => {
 *     // ctx.state and ctx.services are fully typed!
 *     ctx.state.user;        // From auth middleware
 *     ctx.state.requestId;   // From logger middleware
 *     ctx.services.auth;     // From auth middleware
 *     ctx.services.logger;   // From logger middleware
 *   }
 * });
 * ```
 */
export type InferContext<T> =
  T extends Server<infer TState, infer TServices> ? Context<TState, TServices, any, any> : never;

/**
 * Runtime helper that provides type hints for the Context type.
 *
 * This is a phantom type helper - it returns an empty object cast to the correct type.
 * It's useful during development for exploring what's available in the context type.
 *
 * @template TState - The accumulated state type from middleware
 * @template TServices - The accumulated services type from middleware and plugins
 * @param server - The server instance to infer context from
 * @returns A phantom typed Context (not for runtime use)
 *
 * @example
 * ```typescript
 * const server = createServer()
 *   .use(authMiddleware)
 *   .use(loggerMiddleware);
 *
 * // Use for type exploration during development
 * const ctx = inferContext(server);
 * // Now TypeScript knows:
 * // - ctx.state has { user: User, requestId: string }
 * // - ctx.services has { auth: AuthService, logger: LoggerService }
 *
 * // You can explore available properties with IntelliSense
 * ctx.state. // <-- IntelliSense shows available state
 * ctx.services. // <-- IntelliSense shows available services
 * ```
 *
 * @note This is for type hints only. Do not use the returned value at runtime.
 * @note The returned object is empty - it only exists for TypeScript type inference.
 */
export function inferContext<
  TState extends Record<string, unknown> = {},
  TServices extends Record<string, unknown> = {},
>(server: Server<TState, TServices>): Context<TState, TServices, any, any> {
  // This is a phantom type helper - returns typed empty object
  // Used only for extracting types, not for runtime
  // The parameter is used only for type inference
  void server; // Acknowledge the parameter is intentionally unused
  return {} as Context<TState, TServices, any, any>;
}

/**
 * Helper type to extract just the state from a server
 *
 * @example
 * ```typescript
 * type AppState = InferServerState<typeof server>;
 * ```
 */
export type InferServerState<T> = T extends Server<infer TState, any> ? TState : never;

/**
 * Helper type to extract just the services from a server
 *
 * @example
 * ```typescript
 * type AppServices = InferServerServices<typeof server>;
 * ```
 */
export type InferServerServices<T> = T extends Server<any, infer TServices> ? TServices : never;

/**
 * NOTE: createRouteFactory is deferred to a future release.
 *
 * For now, users should manually specify types when creating routes.
 * While this requires a bit more boilerplate, it provides full type safety.
 *
 * @example
 * ```typescript
 * // ============================================
 * // Step 1: In server.ts, build and export your server
 * // ============================================
 * import { createServer } from 'blaizejs';
 * import { authMiddleware, loggerMiddleware } from './middleware';
 *
 * // Use the reassignment pattern for proper type accumulation
 * let server = createServer();
 * server = server.use(authMiddleware);
 * server = server.use(loggerMiddleware);
 *
 * // Export the context type for routes to use
 * export type AppContext = InferContext<typeof server>;
 *
 * // Export the server for starting the application
 * export { server };
 *
 * // ============================================
 * // Step 2: In route files, import and use the context type
 * // ============================================
 * import { createGetRoute } from 'blaizejs';
 * import type { AppContext } from '../server';
 * import { z } from 'zod';
 *
 * // Define your route schemas
 * const ParamsSchema = z.object({
 *   id: z.string().uuid()
 * });
 *
 * const ResponseSchema = z.object({
 *   user: z.object({
 *     id: z.string(),
 *     name: z.string(),
 *     email: z.string()
 *   })
 * });
 *
 * // Create the route with manual type specification
 * export const GET = createGetRoute<
 *   typeof ParamsSchema,    // Params schema
 *   never,                   // Query schema (not used)
 *   typeof ResponseSchema,   // Response schema
 *   AppContext['state'],     // State from server middleware
 *   AppContext['services']   // Services from server middleware/plugins
 * >({
 *   schema: {
 *     params: ParamsSchema,
 *     response: ResponseSchema
 *   },
 *   handler: async (ctx, params) => {
 *     // Full type safety here!
 *     const userId = params.id;  // Typed from schema
 *
 *     // Access middleware-provided state and services
 *     const currentUser = ctx.state.user;  // From auth middleware
 *     const requestId = ctx.state.requestId;  // From logger middleware
 *
 *     ctx.services.logger.log(`Fetching user ${userId}`);
 *
 *     // Return response matching the schema
 *     return {
 *       user: {
 *         id: userId,
 *         name: 'John Doe',
 *         email: 'john@example.com'
 *       }
 *     };
 *   }
 * });
 * ```
 *
 * A future release will include createRouteFactory to simplify this pattern
 * and remove the need for manual type specification.
 */
