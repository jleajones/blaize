import { z } from 'zod';

import type { Context, QueryParams, State } from './context';
import type { Middleware } from './middleware';

/**
 * Helper type to extract TypeScript type from Zod schema
 */
export type Infer<T> = T extends z.ZodType<infer R> ? R : unknown;

/**
 * HTTP methods supported by the router
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

/**
 * Schema for route validation with generic type parameters
 */
export interface RouteSchema<
  P extends z.ZodType = z.ZodType<any>,
  Q extends z.ZodType = z.ZodType<any>,
  B extends z.ZodType = z.ZodType<any>,
  R extends z.ZodType = z.ZodType<any>,
> {
  /** Parameter schema for validation */
  params?: P;

  /** Query schema for validation */
  query?: Q;

  /** Body schema for validation */
  body?: B;

  /** Response schema for validation */
  response?: R;
}

/**
 * Route handler function with strongly typed params and response
 */
export type RouteHandler<
  TParams = Record<string, string>,
  TQuery = Record<string, string | string[] | undefined>,
  TBody = unknown,
  TResponse = unknown,
> = (ctx: Context<State, TBody, TQuery>, params: TParams) => Promise<TResponse> | TResponse;

/**
 * Options for a route method with schema-based type inference
 */
export interface RouteMethodOptions<
  P extends z.ZodType = z.ZodType<any>,
  Q extends z.ZodType = z.ZodType<any>,
  B extends z.ZodType = z.ZodType<any>,
  R extends z.ZodType = z.ZodType<any>,
> {
  /** Schema for request/response validation */
  schema?: RouteSchema<P, Q, B, R>;

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
  GET?: RouteMethodOptions<any, any, any, any>;
  POST?: RouteMethodOptions<any, any, any, any>;
  PUT?: RouteMethodOptions<any, any, any, any>;
  DELETE?: RouteMethodOptions<any, any, any, any>;
  PATCH?: RouteMethodOptions<any, any, any, any>;
  HEAD?: RouteMethodOptions<any, any, any, any>;
  OPTIONS?: RouteMethodOptions<any, any, any, any>;
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
  handleRequest: (ctx: Context) => Promise<void>;

  /** Get all registered routes */
  getRoutes: () => Route[];

  /** Add a route programmatically */
  addRoute: (route: Route) => void;
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
}

export interface ParsedRoute {
  filePath: string;
  routePath: string;
  params: string[];
}

/**
 * Helper type for creating route methods with type inference
 */
export type CreateRoute = {
  <P extends z.ZodType, Q extends z.ZodType, B extends z.ZodType, R extends z.ZodType>(
    definition: {
      GET?: {
        schema?: RouteSchema<P, Q, B, R>;
        handler: RouteHandler<Infer<P>, Infer<Q>, Infer<B>, Infer<R>>;
        middleware?: Middleware[];
        options?: Record<string, unknown>;
      };
      POST?: {
        schema?: RouteSchema<P, Q, B, R>;
        handler: RouteHandler<Infer<P>, Infer<Q>, Infer<B>, Infer<R>>;
        middleware?: Middleware[];
        options?: Record<string, unknown>;
      };
      PUT?: {
        schema?: RouteSchema<P, Q, B, R>;
        handler: RouteHandler<Infer<P>, Infer<Q>, Infer<B>, Infer<R>>;
        middleware?: Middleware[];
        options?: Record<string, unknown>;
      };
      DELETE?: {
        schema?: RouteSchema<P, Q, B, R>;
        handler: RouteHandler<Infer<P>, Infer<Q>, Infer<B>, Infer<R>>;
        middleware?: Middleware[];
        options?: Record<string, unknown>;
      };
      PATCH?: {
        schema?: RouteSchema<P, Q, B, R>;
        handler: RouteHandler<Infer<P>, Infer<Q>, Infer<B>, Infer<R>>;
        middleware?: Middleware[];
        options?: Record<string, unknown>;
      };
      HEAD?: {
        schema?: RouteSchema<P, Q, B, R>;
        handler: RouteHandler<Infer<P>, Infer<Q>, Infer<B>, Infer<R>>;
        middleware?: Middleware[];
        options?: Record<string, unknown>;
      };
      OPTIONS?: {
        schema?: RouteSchema<P, Q, B, R>;
        handler: RouteHandler<Infer<P>, Infer<Q>, Infer<B>, Infer<R>>;
        middleware?: Middleware[];
        options?: Record<string, unknown>;
      };
    },
    options?: RouteOptions
  ): Route;
};

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

/**
 * Transform a route method to client-consumable type
 */
export type RouteMethodToClientType<T extends RouteMethodOptions> = T extends {
  schema?: {
    params?: infer P;
    query?: infer Q;
    body?: infer B;
    response?: infer R;
  };
}
  ? {
      params: P extends z.ZodType ? z.infer<P> : {};
      query: Q extends z.ZodType ? z.infer<Q> : {};
      body: B extends z.ZodType ? z.infer<B> : never;
      response: R extends z.ZodType ? z.infer<R> : unknown;
      errors: StandardErrorResponse;
    }
  : {
      params: {};
      query: {};
      body: never;
      response: unknown;
      errors: StandardErrorResponse;
    };

// For methods without body (GET, DELETE, HEAD, OPTIONS)
export type ExtractMethodWithoutBody<T extends RouteMethodOptions> = T extends { schema?: infer S }
  ? S extends { params?: infer P; query?: infer Q; response?: infer R }
    ? {
        params: P extends z.ZodType ? z.infer<P> : {};
        query: Q extends z.ZodType ? z.infer<Q> : {};
        response: R extends z.ZodType ? z.infer<R> : unknown;
      }
    : { params: {}; query: {}; response: unknown }
  : { params: {}; query: {}; response: unknown };

// For methods with body (POST, PUT, PATCH)
export type ExtractMethodWithBody<T extends RouteMethodOptions> = T extends { schema?: infer S }
  ? S extends { params?: infer P; query?: infer Q; body?: infer B; response?: infer R }
    ? {
        params: P extends z.ZodType ? z.infer<P> : {};
        query: Q extends z.ZodType ? z.infer<Q> : {};
        body: B extends z.ZodType ? z.infer<B> : unknown;
        response: R extends z.ZodType ? z.infer<R> : unknown;
      }
    : { params: {}; query: {}; body: unknown; response: unknown }
  : { params: {}; query: {}; body: unknown; response: unknown };

// Specific method extractors using the base types
export type ExtractGetRoute<T extends RouteMethodOptions> = ExtractMethodWithoutBody<T>;
export type ExtractDeleteRoute<T extends RouteMethodOptions> = ExtractMethodWithoutBody<T>;
export type ExtractHeadRoute<T extends RouteMethodOptions> = ExtractMethodWithoutBody<T>;
export type ExtractOptionsRoute<T extends RouteMethodOptions> = ExtractMethodWithoutBody<T>;

export type ExtractPostRoute<T extends RouteMethodOptions> = ExtractMethodWithBody<T>;
export type ExtractPutRoute<T extends RouteMethodOptions> = ExtractMethodWithBody<T>;
export type ExtractPatchRoute<T extends RouteMethodOptions> = ExtractMethodWithBody<T>;

export type ExtractRouteType<T extends Route> = {
  [K in keyof Omit<T, 'path'>]: K extends 'GET'
    ? T[K] extends RouteMethodOptions
      ? ExtractGetRoute<T[K]>
      : never
    : K extends 'POST'
      ? T[K] extends RouteMethodOptions
        ? ExtractPostRoute<T[K]>
        : never
      : K extends 'PUT'
        ? T[K] extends RouteMethodOptions
          ? ExtractPutRoute<T[K]>
          : never
        : K extends 'DELETE'
          ? T[K] extends RouteMethodOptions
            ? ExtractDeleteRoute<T[K]>
            : never
          : K extends 'PATCH'
            ? T[K] extends RouteMethodOptions
              ? ExtractPatchRoute<T[K]>
              : never
            : K extends 'HEAD'
              ? T[K] extends RouteMethodOptions
                ? ExtractHeadRoute<T[K]>
                : never
              : K extends 'OPTIONS'
                ? T[K] extends RouteMethodOptions
                  ? ExtractOptionsRoute<T[K]>
                  : never
                : never;
};

/**
 * GET route creator - no body schema needed
 */
export type CreateGetRoute = <
  P extends z.ZodType = z.ZodType<any>,
  Q extends z.ZodType = z.ZodType<any>,
  R extends z.ZodType = z.ZodType<any>,
>(
  config: {
    schema?: {
      params?: P;
      query?: Q;
      response?: R;
    };
    handler: RouteHandler<
      P extends z.ZodType ? Infer<P> : Record<string, string>,
      Q extends z.ZodType ? Infer<Q> : QueryParams,
      never,
      R extends z.ZodType ? Infer<R> : unknown
    >;
    middleware?: Middleware[];
    options?: Record<string, unknown>;
  },
  path?: string
) => Route;

/**
 * POST route creator - includes body schema
 */
export type CreatePostRoute = <
  P extends z.ZodType = z.ZodType<any>,
  Q extends z.ZodType = z.ZodType<any>,
  B extends z.ZodType = z.ZodType<any>,
  R extends z.ZodType = z.ZodType<any>,
>(
  config: {
    schema?: {
      params?: P;
      query?: Q;
      body?: B;
      response?: R;
    };
    handler: RouteHandler<
      P extends z.ZodType ? Infer<P> : Record<string, string>,
      Q extends z.ZodType ? Infer<Q> : QueryParams,
      B extends z.ZodType ? Infer<B> : unknown,
      R extends z.ZodType ? Infer<R> : unknown
    >;
    middleware?: Middleware[];
    options?: Record<string, unknown>;
  },
  path?: string
) => Route;

/**
 * PUT route creator - includes body schema
 */
export type CreatePutRoute = CreatePostRoute; // Same signature as POST

/**
 * DELETE route creator - typically no body
 */
export type CreateDeleteRoute = CreateGetRoute; // Same signature as GET

/**
 * PATCH route creator - includes body schema
 */
export type CreatePatchRoute = CreatePostRoute; // Same signature as POST

// Helper to determine what parameters are needed for a client method
type ClientMethodParams<T> = T extends {
  params: infer P;
  query: infer Q;
  body: infer B;
}
  ? (keyof P extends never ? {} : { params: P }) &
      (keyof Q extends never ? {} : { query?: Q }) &
      (keyof B extends never ? {} : { body: B })
  : {};

// Transform route method to client method signature
type RouteMethodToClientMethod<T> = T extends { response: infer R }
  ? ClientMethodParams<T> extends Record<string, never>
    ? () => Promise<R>
    : (options: ClientMethodParams<T>) => Promise<R>
  : () => Promise<unknown>;

// Transform a full route to client methods (handles multiple HTTP methods)
type RouteToClientMethods<T extends Record<string, any>> = {
  [K in keyof T]: RouteMethodToClientMethod<T[K]>;
};

// Transform the entire app routes to client API
export type AppRoutesToClientAPI<T extends Record<string, any>> = {
  [RouteName in keyof T]: T[RouteName] extends Record<string, any>
    ? RouteToClientMethods<T[RouteName]> extends { GET: infer GetMethod }
      ? GetMethod
      : RouteToClientMethods<T[RouteName]> extends { POST: infer PostMethod }
        ? PostMethod
        : RouteToClientMethods<T[RouteName]> extends { PUT: infer PutMethod }
          ? PutMethod
          : RouteToClientMethods<T[RouteName]> extends { DELETE: infer DeleteMethod }
            ? DeleteMethod
            : RouteToClientMethods<T[RouteName]> extends { PATCH: infer PatchMethod }
              ? PatchMethod
              : never
    : never;
};

// Transform a single route type to client API methods
export type RouteTypeToClientAPI<T extends Record<string, any>> = {
  [Method in keyof T]: T[Method] extends {
    params: infer P;
    query: infer Q;
    body: infer B;
    response: infer R;
  }
    ? ClientMethodParams<T[Method]> extends Record<string, never>
      ? () => Promise<R>
      : (options: ClientMethodParams<T[Method]>) => Promise<R>
    : () => Promise<unknown>;
};

// For collections of routes, transform each route to client methods
export type RouteCollectionToClientAPI<T extends Record<string, Record<string, any>>> = {
  [RouteName in keyof T]: T[RouteName] extends Record<string, any>
    ? RouteTypeToClientAPI<T[RouteName]> extends { GET: infer GetMethod }
      ? GetMethod
      : RouteTypeToClientAPI<T[RouteName]> extends { POST: infer PostMethod }
        ? PostMethod
        : RouteTypeToClientAPI<T[RouteName]> extends { PUT: infer PutMethod }
          ? PutMethod
          : RouteTypeToClientAPI<T[RouteName]> extends { DELETE: infer DeleteMethod }
            ? DeleteMethod
            : RouteTypeToClientAPI<T[RouteName]> extends { PATCH: infer PatchMethod }
              ? PatchMethod
              : never
    : never;
};
