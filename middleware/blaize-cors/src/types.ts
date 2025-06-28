import type { Context } from 'blaizejs';

export interface CorsOptions {
  /**
   * Configures the Access-Control-Allow-Origin CORS header.
   * @default '*'
   */
  origin?: CorsOrigin;

  /**
   * Configures the Access-Control-Allow-Methods CORS header.
   * @default ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE']
   */
  methods?: string[] | string;

  /**
   * Configures the Access-Control-Allow-Headers CORS header.
   * @default ['Content-Type', 'Authorization']
   */
  allowedHeaders?: string[] | string;

  /**
   * Configures the Access-Control-Expose-Headers CORS header.
   * @default []
   */
  exposedHeaders?: string[] | string;

  /**
   * Configures the Access-Control-Allow-Credentials CORS header.
   * @default false
   */
  credentials?: boolean;

  /**
   * Configures the Access-Control-Max-Age CORS header.
   * @default 86400 (24 hours)
   */
  maxAge?: number;

  /**
   * Pass the CORS preflight response to the next handler.
   * @default false
   */
  preflightContinue?: boolean;

  /**
   * Provides a status code to use for successful OPTIONS requests.
   * @default 204
   */
  optionsSuccessStatus?: number;

  /**
   * Cache preflight responses for performance optimization.
   * @default true
   */
  cachePreflightResponse?: boolean;

  /**
   * Custom preflight cache key generator.
   */
  preflightCacheKey?: (ctx: Context) => string;

  /**
   * Enable debug logging for CORS processing.
   * @default false
   */
  debug?: boolean;
}

export type CorsOrigin =
  | boolean
  | string
  | RegExp
  | string[]
  | RegExp[]
  | ((origin: string | undefined, ctx: Context) => boolean | Promise<boolean>);

export interface CorsResult {
  origin: string | false;
  credentials: boolean;
  methods: string[];
  allowedHeaders: string[];
  exposedHeaders: string[];
  maxAge: number;
}
