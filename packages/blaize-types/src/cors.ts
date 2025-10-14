/**
 * CORS Types for BlaizeJS Framework
 *
 * Comprehensive type definitions for W3C-compliant CORS middleware
 * with support for string, regex, and async function origin validation.
 *
 * @module @blaizejs/types/cors
 */

import type { Context } from './context';
import type { HttpMethod } from './router';

/**
 * Origin configuration type supporting multiple validation methods
 *
 * @example
 * ```typescript
 * // String origin (exact match)
 * const origin: CorsOrigin = 'https://example.com';
 *
 * // RegExp pattern
 * const origin: CorsOrigin = /^https:\/\/.*\.example\.com$/;
 *
 * // Dynamic validation function
 * const origin: CorsOrigin = async (origin, ctx) => {
 *   return await checkOriginAllowed(origin, ctx?.state.user);
 * };
 *
 * // Array of mixed types
 * const origin: CorsOrigin = [
 *   'https://localhost:3000',
 *   /^https:\/\/.*\.example\.com$/,
 *   (origin) => origin.endsWith('.trusted.com')
 * ];
 * ```
 */
export type CorsOrigin =
  | string
  | RegExp
  | ((origin: string, ctx?: Context<any, any>) => boolean | Promise<boolean>)
  | Array<
      string | RegExp | ((origin: string, ctx?: Context<any, any>) => boolean | Promise<boolean>)
    >;

/**
 * HTTP methods that can be allowed in CORS
 * Based on W3C CORS specification
 */
export type CorsHttpMethod = HttpMethod | 'CONNECT' | 'TRACE';

/**
 * Main CORS configuration options
 *
 * @example
 * ```typescript
 * const corsOptions: CorsOptions = {
 *   origin: 'https://example.com',
 *   methods: ['GET', 'POST'],
 *   credentials: true,
 *   maxAge: 86400
 * };
 * ```
 */
export interface CorsOptions {
  /**
   * Configures the Access-Control-Allow-Origin header
   *
   * Possible values:
   * - `true`: Allow all origins (sets to '*' unless credentials is true, then reflects origin)
   * - `false`: Disable CORS (no headers set)
   * - `string`: Specific origin to allow
   * - `RegExp`: Pattern to match origins
   * - `function`: Custom validation logic
   * - `array`: Multiple origin configurations
   *
   * @default false
   */
  origin?: boolean | CorsOrigin;

  /**
   * Configures the Access-Control-Allow-Methods header
   *
   * @default ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE']
   * @example ['GET', 'POST']
   */
  methods?: CorsHttpMethod[] | string;

  /**
   * Configures the Access-Control-Allow-Headers header
   *
   * Pass an array of allowed headers or a comma-delimited string.
   *
   * @default Request's Access-Control-Request-Headers header value
   * @example ['Content-Type', 'Authorization']
   */
  allowedHeaders?: string[] | string;

  /**
   * Configures the Access-Control-Expose-Headers header
   *
   * Headers that the browser is allowed to access.
   *
   * @default []
   * @example ['Content-Range', 'X-Content-Range']
   */
  exposedHeaders?: string[] | string;

  /**
   * Configures the Access-Control-Allow-Credentials header
   *
   * Set to true to allow credentials (cookies, authorization headers, TLS client certificates).
   * Note: Cannot be used with origin: '*' for security reasons.
   *
   * @default false
   */
  credentials?: boolean;

  /**
   * Configures the Access-Control-Max-Age header in seconds
   *
   * Indicates how long browsers can cache preflight response.
   * Set to -1 to disable caching.
   *
   * @default undefined (browser decides)
   * @example 86400 // 24 hours
   */
  maxAge?: number;

  /**
   * Whether to pass the CORS preflight response to the next handler
   *
   * When false, the preflight response is sent immediately.
   * When true, control passes to the next middleware/handler.
   *
   * @default false
   */
  preflightContinue?: boolean;

  /**
   * HTTP status code for successful OPTIONS requests
   *
   * Some legacy browsers require 200, while 204 is more correct.
   *
   * @default 204
   */
  optionsSuccessStatus?: number;
}

/**
 * Internal CORS validation result
 * Used by middleware implementation
 */
export interface CorsValidationResult {
  /**
   * Whether the origin is allowed
   */
  allowed: boolean;

  /**
   * The origin value to set in the header
   * Can be '*', specific origin, or 'null'
   */
  origin?: string;

  /**
   * Whether to add Vary: Origin header
   */
  vary?: boolean;
}

/**
 * CORS preflight request information
 * Extracted from OPTIONS request headers
 */
export interface CorsPreflightInfo {
  /**
   * The origin making the request
   */
  origin?: string;

  /**
   * The method that will be used in the actual request
   * From Access-Control-Request-Method header
   */
  requestedMethod?: string;

  /**
   * The headers that will be sent in the actual request
   * From Access-Control-Request-Headers header
   */
  requestedHeaders?: string[];
}

/**
 * Cache entry for origin validation results
 * Used for performance optimization
 */
export interface CorsOriginCacheEntry {
  /**
   * Whether the origin is allowed
   */
  allowed: boolean;

  /**
   * When this cache entry expires (timestamp)
   */
  expiresAt: number;

  /**
   * Optional user identifier for cache key
   */
  userId?: string;
}

/**
 * Configuration for CORS origin validation cache
 */
export interface CorsOriginCacheConfig {
  /**
   * Time-to-live for cache entries in milliseconds
   * @default 60000 (1 minute)
   */
  ttl?: number;

  /**
   * Maximum number of entries in the cache
   * @default 1000
   */
  maxSize?: number;

  /**
   * Whether to include user ID in cache key
   * @default true
   */
  includeUserId?: boolean;
}

/**
 * Statistics for CORS middleware performance monitoring
 */
export interface CorsStats {
  /**
   * Total number of CORS requests processed
   */
  totalRequests: number;

  /**
   * Number of preflight requests handled
   */
  preflightRequests: number;

  /**
   * Number of allowed origins
   */
  allowedOrigins: number;

  /**
   * Number of denied origins
   */
  deniedOrigins: number;

  /**
   * Cache hit rate for origin validation
   */
  cacheHitRate: number;

  /**
   * Average origin validation time in milliseconds
   */
  avgValidationTime: number;
}

/**
 * Cache entry type
 */
export interface CacheEntry {
  allowed: boolean;
  expiresAt: number;
  lastAccessed: number;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  ttl: number;
  maxSize: number;
}
