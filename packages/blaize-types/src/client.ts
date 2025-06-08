import { z } from 'zod';

import { Infer, RouteMethodOptions } from './router';

// Extract the parameter types from a RouteMethodOptions
export type ExtractParams<T> =
  T extends RouteMethodOptions<infer P, any, any, any>
    ? P extends z.ZodType
      ? Infer<P>
      : Record<string, string>
    : never;

// Extract the query types
export type ExtractQuery<T> =
  T extends RouteMethodOptions<any, infer Q, any, any>
    ? Q extends z.ZodType
      ? Infer<Q>
      : Record<string, string | string[] | undefined>
    : never;

// Extract the body types
export type ExtractBody<T> =
  T extends RouteMethodOptions<any, any, infer B, any>
    ? B extends z.ZodType
      ? Infer<B>
      : unknown
    : never;

// Extract the response types
export type ExtractResponse<T> =
  T extends RouteMethodOptions<any, any, any, infer R>
    ? R extends z.ZodType
      ? Infer<R>
      : unknown
    : never;

// Extract HTTP method from a route definition
export type ExtractMethod<T> = T extends { GET: any }
  ? 'GET'
  : T extends { POST: any }
    ? 'POST'
    : T extends { PUT: any }
      ? 'PUT'
      : T extends { DELETE: any }
        ? 'DELETE'
        : T extends { PATCH: any }
          ? 'PATCH'
          : T extends { HEAD: any }
            ? 'HEAD'
            : T extends { OPTIONS: any }
              ? 'OPTIONS'
              : never;

// Build the method-grouped registry
// We need to preserve the entire route object, not just the method
export type BuildRoutesRegistry<TRoutes extends Record<string, any>> = {
  [Method in ExtractMethod<TRoutes[keyof TRoutes]> as `$${Lowercase<Method>}`]: {
    [K in keyof TRoutes as ExtractMethod<TRoutes[K]> extends Method ? K : never]: TRoutes[K]
    // This preserves the full route object: { GET: RouteMethodOptions, path: string }
  }
}

// We need to exclude the 'path' property and only get the HTTP method
type GetRouteMethod<TRoute> = TRoute extends { path: string }
  ? Omit<TRoute, 'path'>[keyof Omit<TRoute, 'path'>]
  : never;

// Fixed client method creator
type CreateClientMethod<TRoute> =
  GetRouteMethod<TRoute> extends RouteMethodOptions<any, any, any, any>
    ? (args?: {
        params?: ExtractParams<GetRouteMethod<TRoute>>;
        query?: ExtractQuery<GetRouteMethod<TRoute>>;
        body?: ExtractBody<GetRouteMethod<TRoute>>;
      }) => Promise<ExtractResponse<GetRouteMethod<TRoute>>>
    : never;

// Transform the entire routes registry into a client
export type CreateClient<TRoutes extends Record<string, Record<string, any>>> = {
  [Method in keyof TRoutes]: {
    [RouteName in keyof TRoutes[Method]]: CreateClientMethod<TRoutes[Method][RouteName]>;
  };
};

export interface ClientConfig {
  baseUrl: string;
  defaultHeaders?: Record<string, string>;
  timeout?: number;
}

export interface RequestArgs {
  params?: Record<string, string>;
  query?: Record<string, any>;
  body?: unknown;
}

export interface RequestOptions {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
  timeout: number;
}