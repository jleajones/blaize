import { z } from 'zod';

import type { HttpMethod, RouteDefinition, RouteMethodOptions } from './router';
// Add this improved type extraction
export type ExtractRouteMethodType<
  T extends RouteMethodOptions,
  Method extends HttpMethod = HttpMethod,
> = T extends {
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
      body: Method extends 'GET' | 'HEAD' | 'DELETE' | 'OPTIONS'
        ? never // These methods don't have bodies
        : B extends z.ZodType
          ? z.infer<B>
          : unknown;
      response: R extends z.ZodType ? z.infer<R> : unknown;
    }
  : {
      params: {};
      query: {};
      body: Method extends 'GET' | 'HEAD' | 'DELETE' | 'OPTIONS' ? never : unknown;
      response: unknown; // Always unknown when no schema
    };

// Update ExtractRouteTypes to pass the method
export type ExtractRouteTypes<T extends RouteDefinition> = {
  [K in keyof T]: K extends HttpMethod
    ? T[K] extends RouteMethodOptions<any, any, any, any>
      ? ExtractRouteMethodType<T[K], K>
      : never
    : never;
};

/**
 * Transform route collection to client API types
 */
export type RoutesToClientAPI<T extends Record<string, RouteDefinition>> = {
  [RouteName in keyof T]: ExtractRouteTypes<T[RouteName]>;
};

// Add these types to your types file

/**
 * Transform a route method type into a client method signature
 */
export type RouteMethodToClientMethod<T> = T extends {
  params: infer P;
  query: infer Q;
  body: infer B;
  response: infer R;
}
  ? // Check if we need parameters
    [keyof P, keyof Q, keyof (B extends never ? {} : B)] extends [never, never, never]
    ? () => Promise<R> // No parameters needed
    : (args: {
        params: keyof P extends never ? never : P;
        query: keyof Q extends never ? never : Q;
        body: B extends never ? never : B;
      }) => Promise<R>
  : () => Promise<unknown>;

/**
 * Transform route types into client API methods
 */
export type RouteTypesToClientMethods<T> = {
  [K in keyof T]: T[K] extends { params: any; query: any; body: any; response: any }
    ? RouteMethodToClientMethod<T[K]>
    : never;
};

/**
 * Transform the entire app routes to client API
 */
export type AppRoutesToClientAPI<T extends Record<string, any>> = {
  [RouteName in keyof T]: RouteTypesToClientMethods<T[RouteName]>;
};
