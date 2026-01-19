import { z } from 'zod';

import type { Context, QueryParams, State, Services } from './context';
import type { EventSchemas, TypedEventBus } from './events';
import type { HandlerContext } from './handler-context';
import type { BlaizeLogger } from './logger';
import type { Middleware } from './middleware';

/**
 * Helper type to extract TypeScript type from Zod schema
 */
export type Infer<T> = T extends z.ZodType ? z.output<T> : unknown;

/**
 * HTTP methods supported by the router
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

/**
 * Schema for route validation with generic type parameters
 */
export interface RouteSchema<
  P extends z.ZodType = z.ZodType<any>, // URL parameters schema
  Q extends z.ZodType = z.ZodType<any>, // Query parameters schema
  B extends z.ZodType = z.ZodType<any>, // Body schema
  F extends z.ZodType = z.ZodType<any>, // Files schema (defaults to any for backward compatibility)
  R extends z.ZodType = z.ZodType<any>, // Response schema
  ED extends z.ZodType = z.ZodType<any>, // Error details schema
> {
  /** Parameter schema for validation */
  params?: P;

  /** Query schema for validation */
  query?: Q;

  /** Files schema for multipart/form-data validation */
  files?: F;

  /** Body schema for validation */
  body?: B;

  /** Response schema for validation */
  response?: R;

  /** Error Response Details schema for validation */
  errorResponseDetails?: ED;
}

/**
 * Route handler function with strongly typed params and response
 *
 * **NEW IN v1.0.0:** Handler now receives a single context object instead
 * of positional parameters. This provides better extensibility and DX.
 *
 * **DEPRECATED:** The old signature `(ctx, params, logger) => ...` is still
 * supported for backward compatibility but will be removed in v2.0.0.
 * A deprecation warning is shown at runtime for old handlers.
 *
 * **MIGRATION:** Update handlers to destructure the context object:
 *
 * ```typescript
 * // Before (deprecated):
 * handler: async (ctx, params, logger) => {
 *   logger.info('Request', params);
 *   return { data: params.userId };
 * }
 *
 * // After (recommended):
 * handler: async ({ ctx, params, logger, eventBus }) => {
 *   logger.info('Request', params);
 *   await eventBus.publish('user:viewed', { userId: params.userId });
 *   return { data: params.userId };
 * }
 * ```
 *
 * @template TParams - URL parameters type (from route params like :id)
 * @template TQuery - Query parameters type (from ?key=value)
 * @template TBody - Request body type (validated via schema)
 * @template TResponse - Response data type (validated via schema if provided)
 * @template TState - Accumulated state from middleware (e.g., user, session)
 * @template TServices - Accumulated services from middleware and plugins (e.g., db, cache)
 * @template TEvents - Event schemas for typed EventBus
 * @template TFiles - Uploaded files type (validated via schema.files)
 *
 * @param hc - Handler context containing ctx, params, logger, eventBus
 * @returns Response data of type TResponse (or Promise<TResponse>)
 *
 * @example Basic GET handler
 * ```typescript
 * const handler: RouteHandler = async ({ ctx, params, logger }) => {
 *   logger.info('Fetching user', { userId: params.userId });
 *   const user = await ctx.services.db.getUser(params.userId);
 *   return user;
 * };
 * ```
 *
 * @example POST with events
 * ```typescript
 * const handler: RouteHandler = async ({ ctx, logger, eventBus }) => {
 *   logger.info('Creating user', { email: ctx.body.email });
 *
 *   const user = await ctx.services.db.createUser(ctx.body);
 *
 *   await eventBus.publish('user:created', {
 *     userId: user.id,
 *     email: user.email,
 *   });
 *
 *   return user;
 * };
 * ```
 *
 * @example With typed events
 * ```typescript
 * type UserEvents = {
 *   'user:created': { userId: string; email: string };
 * };
 *
 * const handler: RouteHandler<
 *   any, any, any, any, any, any, UserEvents
 * > = async ({ ctx, eventBus }) => {
 *   const user = await createUser(ctx.body);
 *
 *   // TypeScript enforces event data shape
 *   await eventBus.publish('user:created', {
 *     userId: user.id,
 *     email: user.email,
 *   });
 *
 *   return user;
 * };
 * ```
 */
export type RouteHandler<
  TParams = Record<string, string>,
  TQuery = Record<string, string | string[] | undefined>,
  TBody = unknown,
  TResponse = unknown,
  TState extends State = State,
  TServices extends Services = Services,
  TEvents extends EventSchemas = EventSchemas,
  TFiles = unknown,
> = (
  hc: HandlerContext<TState, TServices, TBody, TQuery, TParams, TEvents, TFiles>
) => Promise<TResponse> | TResponse;

/**
 * Options for a route method with schema-based type inference
 */
export interface RouteMethodOptions<
  P extends z.ZodType = z.ZodType<any>,
  Q extends z.ZodType = z.ZodType<any>,
  B extends z.ZodType = z.ZodType<any>,
  F extends z.ZodType = z.ZodType<any>,
  R extends z.ZodType = z.ZodType<any>,
  ED extends z.ZodType = z.ZodType<any>,
> {
  /** Schema for request/response validation */
  schema?: RouteSchema<P, Q, B, F, R, ED>;

  /** Handler function for the route */
  handler: RouteHandler<
    P extends z.ZodType ? Infer<P> : Record<string, string>,
    Q extends z.ZodType ? Infer<Q> : QueryParams,
    B extends z.ZodType ? Infer<B> : unknown,
    R extends z.ZodType ? Infer<R> : unknown,
    State,
    Services,
    EventSchemas,
    F extends z.ZodType ? Infer<F> : unknown
  >;

  /** Middleware to apply to this route */
  middleware?: Middleware[];

  /** Route-specific options */
  options?: Record<string, unknown>;
}

/**
 * Route definition mapping HTTP methods to handlers
 */
export interface RouteDefinition {
  GET?: RouteMethodOptions<any, any, never, never, any, any>; // GET/HEAD/DELETE/OPTIONS don't have bodies
  POST?: RouteMethodOptions<any, any, any, any, any, any>; // POST can have bodies
  PUT?: RouteMethodOptions<any, any, any, any, any, any>; // PUT can have bodies
  DELETE?: RouteMethodOptions<any, any, never, never, any, any>; // DELETE typically no body
  PATCH?: RouteMethodOptions<any, any, any, any, any, any>; // PATCH can have bodies
  HEAD?: RouteMethodOptions<any, any, never, never, any, any>; // HEAD no body
  OPTIONS?: RouteMethodOptions<any, any, never, never, any, any>; // OPTIONS no body
}

/**
 * Route object with path
 */
export interface Route extends RouteDefinition {
  /** Path of the route */
  path: string;
}

/**
 * Options for route creation
 */
export interface RouteOptions {
  /** Base path for the route */
  basePath?: string;
}

/**
 * Result type for handling success and error responses
 */
export type Result<T, E = { error: string; message: string; details?: unknown }> =
  | { success: true; data: T; status?: number }
  | { success: false; error: E; status?: number };

/**
 * Router options
 */
export interface RouterOptions {
  /** Directory containing route files */
  routesDir: string;
  /** Base path for all routes */
  basePath?: string;
  /** Watch for file changes in development */
  watchMode?: boolean;
}

/**
 * Router interface
 */
export interface Router {
  /** Handle an incoming request */
  handleRequest: (
    ctx: Context,
    logger: BlaizeLogger,
    eventBus: TypedEventBus<EventSchemas>
  ) => Promise<void>;

  /** Get all registered routes */
  getRoutes: () => Route[];

  /** Add a route programmatically */
  addRoute: (route: Route) => void;

  /** Add multiple routes programmatically with batch processing */
  addRoutes: (routes: Route[]) => { added: Route[]; removed: string[]; changed: Route[] };

  /** Add a route directory for plugins */
  addRouteDirectory(directory: string, options?: { prefix?: string }): Promise<void>;

  /** Get route conflicts */
  getRouteConflicts(): Array<{ path: string; sources: string[] }>;

  /** Close watchers and cleanup resources */
  close?: () => Promise<void>;
}

/**
 * Route match result
 */
export interface RouteMatch {
  /** The matched route handler (null if method not allowed) */
  route: RouteMethodOptions | null;

  /** Extracted route parameters */
  params: Record<string, string>;

  /** Flag indicating if the path exists but method isn't allowed */
  methodNotAllowed?: boolean;

  /** List of allowed methods for this path (when method not allowed) */
  allowedMethods?: HttpMethod[];
}

/**
 * Route matcher interface
 */
// TODO: Update to use `Route` type once `method` is added
export interface Matcher {
  /** Add a route to the matcher */
  add: (path: string, method: HttpMethod, route: RouteMethodOptions) => void;

  /** Match a URL path to a route */
  match: (path: string, method: HttpMethod) => RouteMatch | null;

  /** Get all registered routes */
  getRoutes: () => { path: string; method: HttpMethod }[];

  /** Find routes matching a specific path */
  findRoutes: (
    path: string
  ) => { path: string; method: HttpMethod; params: Record<string, string> }[];

  /** Remove a route from the matcher (optional for compatibility) */
  remove: (path: string) => void;

  /** Clear all routes from the matcher (optional for compatibility) */
  clear: () => void;
}

export interface ParsedRoute {
  filePath: string;
  routePath: string;
  params: string[];
}

/**
 * Node in the radix tree for efficient route matching
 */
export interface RouteNode {
  // Route path segment
  segment: string;

  // Parameter name if this is a parameter segment
  paramName: string | null;

  // Is this a wildcard segment?
  isWildcard: boolean;

  // Child nodes
  children: RouteNode[];

  // Route handlers by method (if this is a terminal node)
  handlers: Partial<Record<HttpMethod, RouteMethodOptions>>;

  // Compiled regex pattern for matching (if this is a parameter node)
  pattern: RegExp | null;
}

export interface RouteEntry {
  /** The route path pattern */
  path: string;
  /** The HTTP method */
  method: HttpMethod;
  /** The compiled regex pattern */
  pattern: RegExp;
  /** The parameter names in order */
  paramNames: string[];
  /** The route handler options */
  routeOptions: RouteMethodOptions;
}

export interface ErrorHandlerOptions {
  /** Show detailed errors in response */
  detailed?: boolean;
  /** Log errors to console */
  log?: boolean;
}

export interface ProcessResponseOptions {
  /** Status code to use if not specified */
  defaultStatus?: number;
}

/**
 * Standard error response structure
 */
export interface StandardErrorResponse {
  error: string;
  message: string;
}

export interface FileCache {
  routes: Route[];
  timestamp: number;
  hash: string;
}

export interface ReloadMetrics {
  fileChanges: number;
  totalReloadTime: number;
  averageReloadTime: number;
  slowReloads: Array<{ file: string; time: number }>;
}

export interface WatchOptions {
  debounceMs?: number;
  /** Directories to ignore */
  ignore?: string[];
  /** Callback for new routes */
  onRouteAdded?: (filePath: string, routes: Route[]) => void;
  /** Callback for changed routes */
  onRouteChanged?: (filePath: string, routes: Route[]) => void;
  /** Callback for removed routes */
  onRouteRemoved?: (filePath: string, routes: Route[]) => void;
  /** Callback for errors */
  onError?: (error: Error) => void;
}

export interface RouteRegistry {
  routesByPath: Map<string, Route>;
  routesByFile: Map<string, Set<string>>; // file -> paths
  pathToFile: Map<string, string>; // path -> file
}

export interface FindRouteFilesOptions {
  /** Directories to ignore */
  ignore?: string[] | undefined;
}

/**
 * Configuration for route methods that don't accept a request body
 * Used by: GET, HEAD, DELETE, OPTIONS
 */
export type RouteConfigWithoutBody<
  P = never,
  Q = never,
  R = never,
  TState extends State = State,
  TServices extends Services = Services,
  TEvents extends EventSchemas = EventSchemas,
> = {
  schema?: {
    params?: P extends never ? never : P;
    query?: Q extends never ? never : Q;
    response?: R extends never ? never : R;
  };
  handler: RouteHandler<
    P extends z.ZodType ? Infer<P> : Record<string, string>,
    Q extends z.ZodType ? Infer<Q> : QueryParams,
    never, // No body
    [R] extends [never] ? void : R extends z.ZodType ? Infer<R> : void,
    TState,
    TServices,
    TEvents,
    never
  >;
  middleware?: Middleware[];
  options?: Record<string, unknown>;
};

/**
 * Configuration for route methods that accept a request body
 * Used by: POST, PUT, PATCH
 */
export type RouteConfigWithBody<
  P = never,
  Q = never,
  B = never,
  F = never,
  R = never,
  TState extends State = State,
  TServices extends Services = Services,
  TEvents extends EventSchemas = EventSchemas,
> = {
  schema?: {
    params?: P extends never ? never : P;
    query?: Q extends never ? never : Q;
    body?: B extends never ? never : B;
    files?: F extends never ? never : F;
    response?: R extends never ? never : R;
  };
  handler: RouteHandler<
    P extends z.ZodType ? Infer<P> : Record<string, string>,
    Q extends z.ZodType ? Infer<Q> : QueryParams,
    B extends z.ZodType ? Infer<B> : unknown,
    [R] extends [never] ? void : R extends z.ZodType ? Infer<R> : void,
    TState,
    TServices,
    TEvents,
    F extends z.ZodType ? Infer<F> : unknown
  >;
  middleware?: Middleware[];
  options?: Record<string, unknown>;
};

/**
 * GET route creator with state, services, and event schemas support
 *
 * **NEW IN v1.0.0:** Added TEvents generic for typed EventBus
 *
 * @template TState - Accumulated state from middleware
 * @template TServices - Accumulated services from middleware and plugins
 * @template TEvents - Event schemas for typed EventBus (NEW)
 *
 * @example With typed events
 * ```typescript
 * type UserEvents = {
 *   'user:viewed': { userId: string; timestamp: number };
 * };
 *
 * export const GET = createGetRoute<any, any, UserEvents>()({
 *   handler: async ({ params, eventBus }) => {
 *     await eventBus.publish('user:viewed', {
 *       userId: params.userId,
 *       timestamp: Date.now(),
 *     });
 *
 *     return { userId: params.userId };
 *   },
 * });
 * ```
 */
export type CreateGetRoute = <
  TState extends State = State,
  TServices extends Services = Services,
  TEvents extends EventSchemas = EventSchemas,
>() => <P = never, Q = never, R = never>(
  config: RouteConfigWithoutBody<P, Q, R, TState, TServices, TEvents>
) => {
  GET: RouteMethodOptions<
    P extends never ? never : P extends z.ZodType ? P : never,
    Q extends never ? never : Q extends z.ZodType ? Q : never,
    never,
    never,
    R extends never ? never : R extends z.ZodType ? R : never
  >;
  path: string;
};

/**
 * POST route creator with state, services, and event schemas support
 *
 * @template TState - Accumulated state from middleware
 * @template TServices - Accumulated services from middleware and plugins
 * @template TEvents - Event schemas for typed EventBus (NEW)
 */
export type CreatePostRoute = <
  TState extends State = State,
  TServices extends Services = Services,
  TEvents extends EventSchemas = EventSchemas,
>() => <P = never, Q = never, B = never, F = never, R = never>(
  config: RouteConfigWithBody<P, Q, B, F, R, TState, TServices, TEvents>
) => {
  POST: RouteMethodOptions<
    P extends never ? never : P extends z.ZodType ? P : never,
    Q extends never ? never : Q extends z.ZodType ? Q : never,
    B extends never ? never : B extends z.ZodType ? B : never,
    F extends never ? never : F extends z.ZodType ? F : never,
    R extends never ? never : R extends z.ZodType ? R : never
  >;
  path: string;
};

/**
 * PUT route creator with state and services support
 */
export type CreatePutRoute = <
  TState extends State = State,
  TServices extends Services = Services,
  TEvents extends EventSchemas = EventSchemas,
>() => <P = never, Q = never, B = never, F = never, R = never>(
  config: RouteConfigWithBody<P, Q, B, F, R, TState, TServices, TEvents>
) => {
  PUT: RouteMethodOptions<
    P extends never ? never : P extends z.ZodType ? P : never,
    Q extends never ? never : Q extends z.ZodType ? Q : never,
    B extends never ? never : B extends z.ZodType ? B : never,
    F extends never ? never : F extends z.ZodType ? F : never,
    R extends never ? never : R extends z.ZodType ? R : never
  >;
  path: string;
};

/**
 * DELETE route creator with state and services support
 */
export type CreateDeleteRoute = <
  TState extends State = State,
  TServices extends Services = Services,
  TEvents extends EventSchemas = EventSchemas,
>() => <P = never, Q = never, R = never>(
  config: RouteConfigWithoutBody<P, Q, R, TState, TServices, TEvents>
) => {
  DELETE: RouteMethodOptions<
    P extends never ? never : P extends z.ZodType ? P : never,
    Q extends never ? never : Q extends z.ZodType ? Q : never,
    never,
    never,
    R extends never ? never : R extends z.ZodType ? R : never
  >;
  path: string;
};

/**
 * PATCH route creator with state and services support
 */
export type CreatePatchRoute = <
  TState extends State = State,
  TServices extends Services = Services,
  TEvents extends EventSchemas = EventSchemas,
>() => <P = never, Q = never, B = never, F = never, R = never>(
  config: RouteConfigWithBody<P, Q, B, F, R, TState, TServices, TEvents>
) => {
  PATCH: RouteMethodOptions<
    P extends never ? never : P extends z.ZodType ? P : never,
    Q extends never ? never : Q extends z.ZodType ? Q : never,
    B extends never ? never : B extends z.ZodType ? B : never,
    F extends never ? never : F extends z.ZodType ? F : never,
    R extends never ? never : R extends z.ZodType ? R : never
  >;
  path: string;
};

/**
 * HEAD route creator with state and services support
 */
export type CreateHeadRoute = <
  TState extends State = State,
  TServices extends Services = Services,
  TEvents extends EventSchemas = EventSchemas,
>() => <P = never, Q = never, R = never>(
  config: RouteConfigWithoutBody<P, Q, R, TState, TServices, TEvents>
) => {
  HEAD: RouteMethodOptions<
    P extends never ? never : P extends z.ZodType ? P : never,
    Q extends never ? never : Q extends z.ZodType ? Q : never,
    never,
    never,
    R extends never ? never : R extends z.ZodType ? R : never
  >;
  path: string;
};

/**
 * OPTIONS route creator with state and services support
 */
export type CreateOptionsRoute = <
  TState extends State = State,
  TServices extends Services = Services,
  TEvents extends EventSchemas = EventSchemas,
>() => <P = never, Q = never, R = never>(
  config: RouteConfigWithoutBody<P, Q, R, TState, TServices, TEvents>
) => {
  OPTIONS: RouteMethodOptions<
    P extends never ? never : P extends z.ZodType ? P : never,
    Q extends never ? never : Q extends z.ZodType ? Q : never,
    never,
    never,
    R extends never ? never : R extends z.ZodType ? R : never
  >;
  path: string;
};
