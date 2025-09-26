/* eslint-disable @typescript-eslint/no-empty-object-type */
import { z } from 'zod';

import type { Infer, RouteMethodOptions } from './router';
import type { SSEClient, SSEClientOptions } from './sse-client';

// ============================================
// ROUTE ORGANIZATION BY HTTP METHOD
// ============================================

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

// Group routes by HTTP method
export type BuildRoutesRegistry<TRoutes extends Record<string, any>> = {
  [Method in ExtractMethod<TRoutes[keyof TRoutes]> as `$${Lowercase<Method>}`]: {
    [K in keyof TRoutes as ExtractMethod<TRoutes[K]> extends Method ? K : never]: TRoutes[K];
  };
};

// ============================================
// CLIENT METHOD GENERATION - FIXED APPROACH
// ============================================

// Extract the route method options from a route
type GetRouteMethodOptions<TRoute> = TRoute extends { GET: infer M }
  ? M
  : TRoute extends { POST: infer M }
    ? M
    : TRoute extends { PUT: infer M }
      ? M
      : TRoute extends { DELETE: infer M }
        ? M
        : TRoute extends { PATCH: infer M }
          ? M
          : TRoute extends { HEAD: infer M }
            ? M
            : TRoute extends { OPTIONS: infer M }
              ? M
              : never;

// Helper to check if a type is never
type IsNever<T> = [T] extends [never] ? true : false;

// Helper to build the args object with only defined schemas
type BuildArgsObject<P, Q, B> = (IsNever<P> extends true ? {} : { params: Infer<P> }) &
  (IsNever<Q> extends true ? {} : { query: Infer<Q> }) &
  (IsNever<B> extends true ? {} : { body: Infer<B> });

// Check if the args object would be empty
type IsEmptyObject<T> = keyof T extends never ? true : false;

// Build the final args type - either the object or void if empty
type BuildArgs<P, Q, B> =
  IsEmptyObject<BuildArgsObject<P, Q, B>> extends true
    ? void // No arguments needed
    : BuildArgsObject<P, Q, B>; // Return the built object

// Create a client method for a route
type CreateClientMethod<TRoute> =
  GetRouteMethodOptions<TRoute> extends RouteMethodOptions<infer P, infer Q, infer B, infer R>
    ? BuildArgs<P, Q, B> extends void
      ? () => Promise<R extends z.ZodType ? Infer<R> : unknown> // No args needed
      : (args: BuildArgs<P, Q, B>) => Promise<R extends z.ZodType ? Infer<R> : unknown> // With args
    : never;

// Create the client type
export type CreateClient<TRoutes extends Record<string, Record<string, any>>> = {
  [Method in keyof TRoutes]: {
    [RouteName in keyof TRoutes[Method]]: CreateClientMethod<TRoutes[Method][RouteName]>;
  };
};

// ============================================
// CONFIGURATION TYPES
// ============================================

export interface ClientConfig {
  baseUrl: string;
  defaultHeaders?: Record<string, string>;
  timeout?: number;
}

// ============================================
// INTERNAL TYPES (for makeRequest)
// ============================================

export interface InternalRequestArgs {
  params?: Record<string, any>;
  query?: Record<string, any>;
  body?: any;
}

export interface RequestOptions {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
  timeout: number;
}

// ============================================
// SSE ROUTE DETECTION
// ============================================

/**
 * Detect if a route has SSE support
 * SSE routes have a special 'SSE' method key
 */
export type HasSSEMethod<TRoute> = TRoute extends { SSE: any } ? true : false;

/**
 * Extract SSE event types from route schema
 */
export type ExtractSSEEvents<TRoute> = TRoute extends { SSE: { events?: infer E } }
  ? E extends z.ZodType
    ? z.infer<E>
    : Record<string, unknown>
  : Record<string, unknown>;

/**
 * Extract SSE query parameters from route
 */
export type ExtractSSEQuery<TRoute> = TRoute extends { SSE: { schema?: { query?: infer Q } } }
  ? Q extends z.ZodType
    ? z.infer<Q>
    : Record<string, unknown>
  : never;

/**
 * Extract SSE params from route
 */
export type ExtractSSEParams<TRoute> = TRoute extends { SSE: { schema?: { params?: infer P } } }
  ? P extends z.ZodType
    ? z.infer<P>
    : Record<string, string>
  : never;

/**
 * Build SSE method arguments
 */
export type BuildSSEArgs<TRoute> =
  ExtractSSEParams<TRoute> extends never
    ? ExtractSSEQuery<TRoute> extends never
      ? { options?: SSEClientOptions }
      : { query: ExtractSSEQuery<TRoute>; options?: SSEClientOptions }
    : ExtractSSEQuery<TRoute> extends never
      ? { params: ExtractSSEParams<TRoute>; options?: SSEClientOptions }
      : {
          params: ExtractSSEParams<TRoute>;
          query: ExtractSSEQuery<TRoute>;
          options?: SSEClientOptions;
        };

/**
 * Create SSE client method
 */
export type CreateSSEMethod<TRoute> =
  HasSSEMethod<TRoute> extends true
    ? BuildSSEArgs<TRoute> extends { options?: SSEClientOptions }
      ? (args?: BuildSSEArgs<TRoute>) => Promise<SSEClient<ExtractSSEEvents<TRoute>>>
      : (args: BuildSSEArgs<TRoute>) => Promise<SSEClient<ExtractSSEEvents<TRoute>>>
    : never;

/**
 * Extract SSE routes from registry
 */
export type ExtractSSERoutes<TRoutes extends Record<string, any>> = {
  [K in keyof TRoutes as HasSSEMethod<TRoutes[K]> extends true ? K : never]: TRoutes[K];
};

/**
 * Enhanced client with SSE support
 */
export type CreateEnhancedClient<TRoutes extends Record<string, any>, TRegistry> = TRegistry & {
  $sse: {
    [K in keyof ExtractSSERoutes<TRoutes>]: CreateSSEMethod<TRoutes[K]>;
  };
};
