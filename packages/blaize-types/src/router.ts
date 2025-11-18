import { z } from 'zod';

import type { Context, QueryParams, State, Services } from './context';
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
  R extends z.ZodType = z.ZodType<any>, // Response schema
  ED extends z.ZodType = z.ZodType<any>, // Error details schema
> {
  /** Parameter schema for validation */
  params?: P;

  /** Query schema for validation */
  query?: Q;

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
 *  @param ctx - The Blaize context object
 *  @param params - Extracted route parameters
 *  @param logger - Logger instance for logging within the handler
 *
 *  @returns The response data of type TResponse
 *
 *  @example
 *  const myRouteHandler: RouteHandler = async (ctx, params, logger) => {
 *    logger.info('Handling route with params:', params);
 *   // Handler logic here
 *    return { message: 'Success' }
 *  };
 */
export type RouteHandler<
  TParams = Record<string, string>,
  TQuery = Record<string, string | string[] | undefined>,
  TBody = unknown,
  TResponse = unknown,
  TState extends State = State, // NEW in v0.4.0
  TServices extends Services = Services,
> = (
  ctx: Context<TState, TServices, TBody, TQuery>,
  params: TParams,
  logger: BlaizeLogger
) => Promise<TResponse> | TResponse;

/**
 * Options for a route method with schema-based type inference
 */
export interface RouteMethodOptions<
  P extends z.ZodType = z.ZodType<any>,
  Q extends z.ZodType = z.ZodType<any>,
  B extends z.ZodType = z.ZodType<any>,
  R extends z.ZodType = z.ZodType<any>,
  ED extends z.ZodType = z.ZodType<any>,
> {
  /** Schema for request/response validation */
  schema?: RouteSchema<P, Q, B, R, ED>;

  /** Handler function for the route */
  handler: RouteHandler<
    P extends z.ZodType ? Infer<P> : Record<string, string>,
    Q extends z.ZodType ? Infer<Q> : QueryParams,
    B extends z.ZodType ? Infer<B> : unknown,
    R extends z.ZodType ? Infer<R> : unknown
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
  GET?: RouteMethodOptions<any, any, never, any, any>; // GET/HEAD/DELETE/OPTIONS don't have bodies
  POST?: RouteMethodOptions<any, any, any, any, any>; // POST can have bodies
  PUT?: RouteMethodOptions<any, any, any, any, any>; // PUT can have bodies
  DELETE?: RouteMethodOptions<any, any, never, any, any>; // DELETE typically no body
  PATCH?: RouteMethodOptions<any, any, any, any, any>; // PATCH can have bodies
  HEAD?: RouteMethodOptions<any, any, never, any, any>; // HEAD no body
  OPTIONS?: RouteMethodOptions<any, any, never, any, any>; // OPTIONS no body
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
  handleRequest: (ctx: Context, logger: BlaizeLogger) => Promise<void>;

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
 * GET route creator with state and services support
 * Now returns a higher-order function to handle generics properly
 */
export type CreateGetRoute = <
  TState extends State = State,
  TServices extends Services = Services,
>() => <P = never, Q = never, R = never>(config: {
  schema?: {
    params?: P extends never ? never : P;
    query?: Q extends never ? never : Q;
    response?: R extends never ? never : R;
  };
  handler: RouteHandler<
    P extends z.ZodType ? Infer<P> : Record<string, string>,
    Q extends z.ZodType ? Infer<Q> : QueryParams,
    never, // GET never has body
    [R] extends [never] ? void : R extends z.ZodType ? Infer<R> : void,
    TState,
    TServices
  >;
  middleware?: Middleware[];
  options?: Record<string, unknown>;
}) => {
  GET: RouteMethodOptions<
    P extends never ? never : P extends z.ZodType ? P : never,
    Q extends never ? never : Q extends z.ZodType ? Q : never,
    never,
    R extends never ? never : R extends z.ZodType ? R : never
  >;
  path: string;
};

/**
 * POST route creator with state and services support
 */
export type CreatePostRoute = <
  TState extends State = State,
  TServices extends Services = Services,
>() => <P = never, Q = never, B = never, R = never>(config: {
  schema?: {
    params?: P extends never ? never : P;
    query?: Q extends never ? never : Q;
    body?: B extends never ? never : B;
    response?: R extends never ? never : R;
  };
  handler: RouteHandler<
    P extends z.ZodType ? Infer<P> : Record<string, string>,
    Q extends z.ZodType ? Infer<Q> : QueryParams,
    B extends z.ZodType ? Infer<B> : unknown,
    [R] extends [never] ? void : R extends z.ZodType ? Infer<R> : void,
    TState,
    TServices
  >;
  middleware?: Middleware[];
  options?: Record<string, unknown>;
}) => {
  POST: RouteMethodOptions<
    P extends never ? never : P extends z.ZodType ? P : never,
    Q extends never ? never : Q extends z.ZodType ? Q : never,
    B extends never ? never : B extends z.ZodType ? B : never,
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
>() => <P = never, Q = never, B = never, R = never>(config: {
  schema?: {
    params?: P extends never ? never : P;
    query?: Q extends never ? never : Q;
    body?: B extends never ? never : B;
    response?: R extends never ? never : R;
  };
  handler: RouteHandler<
    P extends z.ZodType ? Infer<P> : Record<string, string>,
    Q extends z.ZodType ? Infer<Q> : QueryParams,
    B extends z.ZodType ? Infer<B> : unknown,
    [R] extends [never] ? void : R extends z.ZodType ? Infer<R> : void,
    TState,
    TServices
  >;
  middleware?: Middleware[];
  options?: Record<string, unknown>;
}) => {
  PUT: RouteMethodOptions<
    P extends never ? never : P extends z.ZodType ? P : never,
    Q extends never ? never : Q extends z.ZodType ? Q : never,
    B extends never ? never : B extends z.ZodType ? B : never,
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
>() => <P = never, Q = never, R = never>(config: {
  schema?: {
    params?: P extends never ? never : P;
    query?: Q extends never ? never : Q;
    response?: R extends never ? never : R;
  };
  handler: RouteHandler<
    P extends z.ZodType ? Infer<P> : Record<string, string>,
    Q extends z.ZodType ? Infer<Q> : QueryParams,
    never, // DELETE never has body
    [R] extends [never] ? void : R extends z.ZodType ? Infer<R> : void,
    TState,
    TServices
  >;
  middleware?: Middleware[];
  options?: Record<string, unknown>;
}) => {
  DELETE: RouteMethodOptions<
    P extends never ? never : P extends z.ZodType ? P : never,
    Q extends never ? never : Q extends z.ZodType ? Q : never,
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
>() => <P = never, Q = never, B = never, R = never>(config: {
  schema?: {
    params?: P extends never ? never : P;
    query?: Q extends never ? never : Q;
    body?: B extends never ? never : B;
    response?: R extends never ? never : R;
  };
  handler: RouteHandler<
    P extends z.ZodType ? Infer<P> : Record<string, string>,
    Q extends z.ZodType ? Infer<Q> : QueryParams,
    B extends z.ZodType ? Infer<B> : unknown,
    [R] extends [never] ? void : R extends z.ZodType ? Infer<R> : void,
    TState,
    TServices
  >;
  middleware?: Middleware[];
  options?: Record<string, unknown>;
}) => {
  PATCH: RouteMethodOptions<
    P extends never ? never : P extends z.ZodType ? P : never,
    Q extends never ? never : Q extends z.ZodType ? Q : never,
    B extends never ? never : B extends z.ZodType ? B : never,
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
>() => <P = never, Q = never, R = never>(config: {
  schema?: {
    params?: P extends never ? never : P;
    query?: Q extends never ? never : Q;
    response?: R extends never ? never : R;
  };
  handler: RouteHandler<
    P extends z.ZodType ? Infer<P> : Record<string, string>,
    Q extends z.ZodType ? Infer<Q> : QueryParams,
    never, // HEAD never has body
    [R] extends [never] ? void : R extends z.ZodType ? Infer<R> : void,
    TState,
    TServices
  >;
  middleware?: Middleware[];
  options?: Record<string, unknown>;
}) => {
  HEAD: RouteMethodOptions<
    P extends never ? never : P extends z.ZodType ? P : never,
    Q extends never ? never : Q extends z.ZodType ? Q : never,
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
>() => <P = never, Q = never, R = never>(config: {
  schema?: {
    params?: P extends never ? never : P;
    query?: Q extends never ? never : Q;
    response?: R extends never ? never : R;
  };
  handler: RouteHandler<
    P extends z.ZodType ? Infer<P> : Record<string, string>,
    Q extends z.ZodType ? Infer<Q> : QueryParams,
    never, // OPTIONS never has body
    [R] extends [never] ? void : R extends z.ZodType ? Infer<R> : void,
    TState,
    TServices
  >;
  middleware?: Middleware[];
  options?: Record<string, unknown>;
}) => {
  OPTIONS: RouteMethodOptions<
    P extends never ? never : P extends z.ZodType ? P : never,
    Q extends never ? never : Q extends z.ZodType ? Q : never,
    never,
    R extends never ? never : R extends z.ZodType ? R : never
  >;
  path: string;
};
