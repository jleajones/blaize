import { createMiddleware } from 'blaizejs';

import { normalizeHeaders, setCorsHeaders } from './utils/headers.js';
import { isOriginAllowed } from './utils/origin.js';

import type { CorsOptions } from './types.js';
import type { Context, Middleware } from 'blaizejs';
/**
 * Default CORS configuration optimized for security and performance
 */
const DEFAULT_OPTIONS: Required<CorsOptions> = {
  origin: '*',
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: [],
  credentials: false,
  maxAge: 86400, // 24 hours
  preflightContinue: false,
  optionsSuccessStatus: 204,
  cachePreflightResponse: true,
  preflightCacheKey: ctx => `${ctx.request.method}:${ctx.request.path}`,
  debug: false,
};

/**
 * Preflight response cache for performance optimization
 */
const preflightCache = new Map<
  string,
  {
    headers: Record<string, string>;
    timestamp: number;
    maxAge: number;
  }
>();

/**
 * Create a high-performance CORS middleware
 */
export const createCorsMiddleware = (options: CorsOptions = {}): Middleware => {
  const config = { ...DEFAULT_OPTIONS, ...options };

  // Normalize configuration
  const methods = Array.isArray(config.methods) ? config.methods : [config.methods];

  const allowedHeaders = normalizeHeaders(config.allowedHeaders);
  const exposedHeaders = normalizeHeaders(config.exposedHeaders);

  return createMiddleware({
    name: 'cors',
    debug: config.debug,
    handler: async (ctx: Context, next) => {
      const origin = ctx.request.header('origin');
      const requestMethod = ctx.request.method;

      if (config.debug) {
        console.log(
          `[CORS] Processing ${requestMethod} request from origin: ${origin || 'same-origin'}`
        );
      }

      // Check if origin is allowed
      const isAllowed = await isOriginAllowed(origin, config.origin, ctx);

      if (!isAllowed) {
        if (config.debug) {
          console.log(`[CORS] Origin ${origin} not allowed`);
        }
        return ctx.response.status(403).json({
          error: 'CORS: Origin not allowed',
          origin,
        });
      }

      const corsOrigin =
        config.origin === true || config.origin === '*'
          ? origin || '*'
          : isAllowed
            ? origin || 'null'
            : false;

      // Handle preflight requests
      if (requestMethod === 'OPTIONS') {
        const cacheKey = config.preflightCacheKey(ctx);

        // Check preflight cache
        if (config.cachePreflightResponse && preflightCache.has(cacheKey)) {
          const cached = preflightCache.get(cacheKey)!;
          const isExpired = Date.now() - cached.timestamp > cached.maxAge * 1000;

          if (!isExpired) {
            if (config.debug) {
              console.log(`[CORS] Using cached preflight response for ${cacheKey}`);
            }

            // Apply cached headers
            Object.entries(cached.headers).forEach(([key, value]) => {
              ctx.response.header(key, value);
            });

            return ctx.response.status(config.optionsSuccessStatus).end();
          } else {
            preflightCache.delete(cacheKey);
          }
        }

        // Set CORS headers
        setCorsHeaders(ctx, {
          origin: corsOrigin,
          credentials: config.credentials,
          exposedHeaders,
          methods,
          allowedHeaders,
          maxAge: config.maxAge,
        });

        // Cache preflight response
        if (config.cachePreflightResponse) {
          const headers: Record<string, string> = {};

          // Capture response headers for caching
          const captureHeader = (name: string) => {
            const value = ctx.response.getHeader(name);
            if (value) headers[name] = String(value);
          };

          captureHeader('Access-Control-Allow-Origin');
          captureHeader('Access-Control-Allow-Methods');
          captureHeader('Access-Control-Allow-Headers');
          captureHeader('Access-Control-Max-Age');
          captureHeader('Access-Control-Allow-Credentials');
          captureHeader('Vary');

          preflightCache.set(cacheKey, {
            headers,
            timestamp: Date.now(),
            maxAge: config.maxAge,
          });

          if (config.debug) {
            console.log(`[CORS] Cached preflight response for ${cacheKey}`);
          }
        }

        if (!config.preflightContinue) {
          return ctx.response.status(config.optionsSuccessStatus).end();
        }
      } else {
        // Handle actual requests
        setCorsHeaders(ctx, {
          origin: corsOrigin,
          credentials: config.credentials,
          exposedHeaders,
          methods,
          allowedHeaders,
          maxAge: config.maxAge,
        });
      }

      await next();
    },
  });
};

/**
 * Convenience function for common CORS configurations
 */
export const createCors = createCorsMiddleware;
