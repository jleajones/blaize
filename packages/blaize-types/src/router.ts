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
 * Standardized error response structure
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

/**
 * Transform route definition to client types
 */
export type RouteDefinitionToClientType<T> = {
  [K in keyof T]: T[K] extends {
    schema?: {
      params?: infer P;
      query?: infer Q;
      body?: infer B;
      response?: infer R;
    };
    handler?: any;
  }
    ? {
        params: P extends z.ZodType ? z.infer<P> : {};
        query: Q extends z.ZodType ? z.infer<Q> : {};
        body: B extends z.ZodType ? z.infer<B> : never;
        response: R extends z.ZodType ? z.infer<R> : unknown;
        errors: StandardErrorResponse;
      }
    : never;
};

/**
 * Global route registry that gets populated by createRoute calls
 */
export interface RouteRegistry {}

/**
 * Helper type for registering routes in the global registry
 */
export type RegisterRoute<TPath extends string, TDefinition> = {
  [P in TPath]: RouteDefinitionToClientType<TDefinition>;
};

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
  ): typeof definition & {
    path: string;
    __routeRegistry: RegisterRoute<string, typeof definition>;
  };
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
