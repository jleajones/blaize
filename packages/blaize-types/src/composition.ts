/* eslint-disable @typescript-eslint/no-empty-object-type */
/**
 * Type composition utilities for extracting and composing middleware type contributions
 * @module composition
 * @since v0.4.0
 */

import type { Middleware } from './middleware';

/**
 * Extracts the State type contribution from a middleware
 * @template T - The middleware type to extract from
 * @returns The state type if present, empty object otherwise
 */
export type ExtractState<T> = T extends Middleware<infer S, any> ? S : {};

/**
 * Extracts the Services type contribution from a middleware
 * @template T - The middleware type to extract from
 * @returns The services type if present, empty object otherwise
 */
export type ExtractServices<T> = T extends Middleware<any, infer S> ? S : {};

/**
 * Utility type to convert a union type to an intersection type
 * This is the magic that allows us to compose multiple middleware contributions
 *
 * @example
 * type U = { a: string } | { b: number }
 * type I = UnionToIntersection<U> // { a: string } & { b: number }
 *
 * @internal
 */
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void
  ? I
  : never;

/**
 * Composes state contributions from an array of middleware
 * Merges all state types into a single intersection type
 *
 * @template T - ReadonlyArray of Middleware
 * @returns Intersection of all state contributions
 *
 * @example
 * const middlewares = [authMiddleware, loggerMiddleware] as const;
 * type ComposedState = ComposeStates<typeof middlewares>;
 * // Result: { user: User } & { requestId: string }
 */
export type ComposeStates<T extends ReadonlyArray<Middleware>> = T extends readonly []
  ? {}
  : UnionToIntersection<ExtractState<T[number]>>;

/**
 * Composes service contributions from an array of middleware
 * Merges all service types into a single intersection type
 *
 * @template T - ReadonlyArray of Middleware
 * @returns Intersection of all service contributions
 *
 * @example
 * const middlewares = [dbMiddleware, cacheMiddleware] as const;
 * type ComposedServices = ComposeServices<typeof middlewares>;
 * // Result: { db: Database } & { cache: Cache }
 */
export type ComposeServices<T extends ReadonlyArray<Middleware>> = T extends readonly []
  ? {}
  : UnionToIntersection<ExtractServices<T[number]>>;

/**
 * Helper type to check if a type is never
 * @internal
 */
type IsNever<T> = [T] extends [never] ? true : false;

/**
 * Helper type to check if a type is any
 * @internal
 */
type IsAny<T> = 0 extends 1 & T ? true : false;

/**
 * Safe version of ExtractState that handles edge cases
 * @template T - The middleware type to extract from
 * @returns The state type, handling never/any/unknown gracefully
 */
export type SafeExtractState<T> =
  IsNever<T> extends true
    ? {}
    : IsAny<T> extends true
      ? {}
      : T extends Middleware<infer S, any>
        ? unknown extends S
          ? {}
          : S
        : {};

/**
 * Safe version of ExtractServices that handles edge cases
 * @template T - The middleware type to extract from
 * @returns The services type, handling never/any/unknown gracefully
 */
export type SafeExtractServices<T> =
  IsNever<T> extends true
    ? {}
    : IsAny<T> extends true
      ? {}
      : T extends Middleware<any, infer S>
        ? unknown extends S
          ? {}
          : S
        : {};

/**
 * Composes state with better edge case handling
 * @template T - ReadonlyArray of Middleware
 * @returns Safely composed state types
 */
export type SafeComposeStates<T extends ReadonlyArray<Middleware>> = T extends readonly []
  ? {}
  : T extends readonly [infer First, ...infer Rest]
    ? First extends Middleware
      ? Rest extends ReadonlyArray<Middleware>
        ? SafeExtractState<First> & SafeComposeStates<Rest>
        : SafeExtractState<First>
      : {}
    : UnionToIntersection<SafeExtractState<T[number]>>;

/**
 * Composes services with better edge case handling
 * @template T - ReadonlyArray of Middleware
 * @returns Safely composed service types
 */
export type SafeComposeServices<T extends ReadonlyArray<Middleware>> = T extends readonly []
  ? {}
  : T extends readonly [infer First, ...infer Rest]
    ? First extends Middleware
      ? Rest extends ReadonlyArray<Middleware>
        ? SafeExtractServices<First> & SafeComposeServices<Rest>
        : SafeExtractServices<First>
      : {}
    : UnionToIntersection<SafeExtractServices<T[number]>>;

/**
 * Utility to merge two state types
 * Handles conflicts by using the rightmost (latest) type
 *
 * @template A - First state type
 * @template B - Second state type
 * @returns Merged state with B taking precedence
 */
export type MergeStates<A, B> = Omit<A, keyof B> & B;

/**
 * Utility to merge two service types
 * Handles conflicts by using the rightmost (latest) type
 *
 * @template A - First services type
 * @template B - Second services type
 * @returns Merged services with B taking precedence
 */
export type MergeServices<A, B> = Omit<A, keyof B> & B;

/**
 * Extract both state and services from a middleware at once
 * @template T - The middleware type
 * @returns Object with state and services types
 */
export type ExtractMiddlewareTypes<T> = {
  state: ExtractState<T>;
  services: ExtractServices<T>;
};

/**
 * Compose both state and services from middleware array at once
 * @template T - ReadonlyArray of Middleware
 * @returns Object with composed state and services
 */
export type ComposeMiddlewareTypes<T extends ReadonlyArray<Middleware>> = {
  state: ComposeStates<T>;
  services: ComposeServices<T>;
};

/**
 * Type guard to check if a value is a Middleware
 * @param value - Value to check
 * @returns True if value is a Middleware
 */
export function isMiddleware(value: unknown): value is Middleware {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    'execute' in value &&
    typeof (value as any).name === 'string' &&
    typeof (value as any).execute === 'function'
  );
}

/**
 * Type helper for middleware arrays
 * Ensures proper readonly array typing for composition
 *
 * @example
 * const middlewares = asMiddlewareArray([auth, logger, cache]);
 * type State = ComposeStates<typeof middlewares>;
 */
export function asMiddlewareArray<T extends ReadonlyArray<Middleware>>(middlewares: T): T {
  return middlewares;
}

/**
 * Create a typed middleware array with inferred types
 * Useful for getting proper const assertions
 *
 * @example
 * const middlewares = createMiddlewareArray(auth, logger, cache);
 * type State = ComposeStates<typeof middlewares>;
 */
export function createMiddlewareArray<T extends ReadonlyArray<Middleware>>(...middlewares: T): T {
  return middlewares;
}
