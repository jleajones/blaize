/**
 * BlaizeJS Router Module
 *
 * Provides the file-based routing system.
 */

import { Context } from '../context';

import type { Middleware } from '../middleware';

/**
 * HTTP methods supported by the router
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

/**
 * Route handler function
 */
export type RouteHandler<TParams = any, TQuery = any, TBody = any, TResponse = any> = (context: {
  /** The request context */
  ctx: Context;

  /** Parsed route parameters */
  params: TParams;

  /** Parsed query parameters */
  query: TQuery;

  /** Request body (if applicable) */
  body: TBody;

  /** Request object */
  request: Context['request'];

  /** Response object */
  response: Context['response'];

  /** State storage */
  state: Context['state'];
}) => Promise<TResponse> | TResponse;

/**
 * Schema for route validation
 */
export interface RouteSchema<_TParams = any, _TQuery = any, _TBody = any, _TResponse = any> {
  /** Parameter schema for validation */
  params?: any;

  /** Query schema for validation */
  query?: any;

  /** Body schema for validation */
  body?: any;

  /** Response schema for validation */
  response?: any;
}

/**
 * Options for a route method
 */
export interface RouteMethodOptions<TParams = any, TQuery = any, TBody = any, TResponse = any> {
  /** Handler function for the route */
  handler: RouteHandler<TParams, TQuery, TBody, TResponse>;

  /** Middleware to apply to this route */
  middleware?: Middleware[];

  /** Schema for request/response validation */
  schema?: RouteSchema<TParams, TQuery, TBody, TResponse>;

  /** Route-specific options */
  options?: Record<string, any>;
}

/**
 * Route definition mapping HTTP methods to handlers
 */
export interface RouteDefinition {
  GET?: RouteMethodOptions;
  POST?: RouteMethodOptions;
  PUT?: RouteMethodOptions;
  DELETE?: RouteMethodOptions;
  PATCH?: RouteMethodOptions;
  HEAD?: RouteMethodOptions;
  OPTIONS?: RouteMethodOptions;
}

/**
 * Route object
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
 * Create a new route definition
 */
export function createRoute(_definition: RouteDefinition, _options: RouteOptions = {}): Route {
  // Implementation placeholder
  throw new Error('Router implementation not yet available');
}
