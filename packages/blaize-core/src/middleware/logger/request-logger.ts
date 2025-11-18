/**
 * Request Logger Middleware
 *
 * Creates a child logger with request context and optionally logs request lifecycle events.
 * This middleware ALWAYS runs FIRST in the middleware chain to ensure all logs have request context.
 *
 * @packageDocumentation
 */

import { BlaizeError } from '@blaize-types/errors';

import { create as createMiddleware } from '../../middleware/create';

import type { RequestLoggerOptions, LogMetadata, BlaizeLogger } from '@blaize-types/logger';
import type { Middleware } from '@blaize-types/middleware';
/**
 * Default safe headers to include when includeHeaders is true
 *
 * These headers are considered safe and do not contain sensitive information.
 * Sensitive headers (authorization, cookie, etc.) are NEVER included, even if
 * they appear in a custom whitelist.
 */
const DEFAULT_SAFE_HEADERS = ['accept', 'content-type', 'user-agent', 'x-correlation-id'];

/**
 * Headers that are ALWAYS redacted, regardless of whitelist
 *
 * These headers may contain sensitive authentication or session information
 * and must never be logged for security reasons.
 */
const ALWAYS_REDACT_HEADERS = ['authorization', 'cookie', 'x-api-key', 'proxy-authorization'];

/**
 * Filter headers based on whitelist and redaction rules
 *
 * @param headers - Request headers
 * @param whitelist - Allowed header names (case-insensitive)
 * @returns Filtered headers with sensitive values redacted
 */
function filterHeaders(
  headers: Record<string, string | undefined>,
  whitelist: string[]
): LogMetadata {
  const filtered: LogMetadata = {};

  // Create case-insensitive sets for efficient lookup
  const whitelistLower = new Set(whitelist.map(h => h.toLowerCase()));
  const redactSetLower = new Set(ALWAYS_REDACT_HEADERS.map(h => h.toLowerCase()));

  for (const [name, value] of Object.entries(headers)) {
    const nameLower = name.toLowerCase();

    // Check if header is in whitelist
    if (whitelistLower.has(nameLower)) {
      // Check if header should be redacted (security override)
      if (redactSetLower.has(nameLower)) {
        filtered[name] = '[REDACTED]';
      } else {
        filtered[name] = value;
      }
    }
  }

  return filtered;
}

/**
 * Request logger middleware factory
 *
 * Creates middleware that:
 * 1. ALWAYS creates a child logger with request context (correlationId, method, path, ip)
 * 2. Replaces ctx.services.log with the child logger
 * 3. Optionally logs request lifecycle events if requestLogging is true
 *
 * The child logger ensures that all logs during the request lifecycle automatically
 * include request context, even if requestLogging is false.
 *
 * @param options - Request logger options (headers, query, etc.)
 * @returns Middleware function
 *
 * @example Basic Usage (with lifecycle logging)
 * ```typescript
 * import { createServer } from 'blaizejs';
 * import { requestLoggerMiddleware } from './logger/middleware';
 *
 * const server = createServer({
 *   port: 3000,
 *   logging: {
 *     level: 'info',
 *     requestLogging: true, // Enable lifecycle logs
 *     requestLoggerOptions: {
 *       includeHeaders: true,
 *       includeQuery: true
 *     }
 *   }
 * });
 * ```
 *
 * @example Without Lifecycle Logging
 * ```typescript
 * const server = createServer({
 *   logging: {
 *     level: 'info',
 *     requestLogging: false // No automatic logs, but ctx.services.log still has request context
 *   }
 * });
 *
 * // In route handler:
 * export const GET = appRoute.get({
 *   handler: async (ctx) => {
 *     // ctx.services.log still includes correlationId, method, path automatically
 *     ctx.services.log.info('Custom log message');
 *     return { data: 'response' };
 *   }
 * });
 * ```
 *
 * @example With Header Filtering
 * ```typescript
 * const middleware = requestLoggerMiddleware({
 *   includeHeaders: true,
 *   headerWhitelist: ['content-type', 'user-agent', 'accept']
 * }, true);
 *
 * // Logs will include only whitelisted headers
 * // Sensitive headers (authorization, cookie) are ALWAYS redacted
 * ```
 */
export function requestLoggerMiddleware(options?: RequestLoggerOptions): Middleware {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  return createMiddleware<{}, {}>({
    name: 'requestLogger',
    handler: async (ctx, next, logger: BlaizeLogger) => {
      // Start timer for duration calculation
      const startTime = Date.now();

      // Extract IP address from socket if available
      let ip: string | undefined;
      if ('socket' in ctx.request.raw) {
        ip = ctx.request.raw.socket?.remoteAddress;
      }

      // Build metadata for request start log
      const startMeta: LogMetadata = {
        timestamp: new Date().toISOString(),
      };

      // Add IP if available
      if (ip) {
        startMeta.ip = ip;
      }

      // Add headers if requested
      if (options?.includeHeaders) {
        const whitelist = options.headerWhitelist || DEFAULT_SAFE_HEADERS;
        const allHeaders = ctx.request.headers();
        const safeHeaders = filterHeaders(allHeaders, whitelist);

        if (Object.keys(safeHeaders).length > 0) {
          startMeta.headers = safeHeaders;
        }
      }

      // Add query parameters if requested
      if (options?.includeQuery) {
        const query = ctx.request.query;
        if (query && Object.keys(query).length > 0) {
          startMeta.query = query;
        }
      }

      // Log request started (if lifecycle logging enabled)
      logger.info('Request started', startMeta);

      // Execute middleware chain and capture result/error
      let error: unknown;
      try {
        await next();
      } catch (err) {
        error = err;
      } finally {
        // Log request completed/failed (if lifecycle logging enabled)
        const duration = Date.now() - startTime;

        if (error) {
          // Request failed - log error details
          const errorMeta: LogMetadata = {
            duration,
            timestamp: new Date().toISOString(),
          };

          // Extract error details based on error type
          if (error instanceof BlaizeError) {
            // BlaizeError has structured error information
            errorMeta.error = {
              type: error.type,
              title: error.title,
              status: error.status,
              message: error.message,
              details: error.details,
              // Include stack trace for server errors (5xx)
              ...(error.status >= 500 && error.stack ? { stack: error.stack } : {}),
            };
          } else if (error instanceof Error) {
            // Standard Error object
            errorMeta.error = {
              message: error.message,
              name: error.name,
              stack: error.stack,
            };
          } else {
            // Non-Error value thrown
            errorMeta.error = String(error);
          }

          logger.error('Request failed', errorMeta);
        } else {
          // Request completed successfully
          const statusCode = ctx.response.statusCode || 200;

          logger.info('Request completed', {
            statusCode,
            duration,
            timestamp: new Date().toISOString(),
          });
        }

        // Re-throw error if one occurred
        if (error) {
          // eslint-disable-next-line no-unsafe-finally
          throw error;
        }
      }
    },
  });
}
