/* eslint-disable @typescript-eslint/no-empty-object-type */
/**
 * Logger Middleware
 *
 * Provides request-scoped logger via ctx.services.log with automatic
 * correlation ID tracking and request metadata.
 *
 * @packageDocumentation
 */

import { getCorrelationId } from '../../tracing/correlation';
import { create as createMiddleware } from '../create';

import type { BlaizeLogger, LogMetadata } from '@blaize-types/logger';

/**
 * Creates logger middleware that provides ctx.services.log
 *
 * The middleware creates a child logger for each request with:
 * - Correlation ID (from request or generated)
 * - HTTP method
 * - Request path
 *
 * This logger is available as `ctx.services.log` in all downstream
 * middleware and route handlers.
 *
 * @param serverLogger - The base logger instance from server configuration
 * @returns Middleware that contributes { log: BlaizeLogger } to services
 *
 * @example
 * ```typescript
 * // In server/create.ts
 * const loggerMiddleware = createLoggerMiddleware(serverLogger);
 *
 * // In route handler
 * export const handler = createGetRoute<typeof loggerMiddleware>({
 *   handler: async (ctx) => {
 *     ctx.services.log.info('Processing request', { userId: '123' });
 *     return { data: 'success' };
 *   }
 * });
 * ```
 */
export function createLoggerMiddleware(serverLogger: BlaizeLogger) {
  return createMiddleware<{}, { log: BlaizeLogger }>({
    name: '__logger',
    handler: async (ctx, next) => {
      // Get or generate correlation ID
      const correlationId = getCorrelationId();

      // Create request-scoped metadata
      const requestMeta: LogMetadata = {
        correlationId,
        method: ctx.request.method,
        path: ctx.request.path,
      };

      // Create child logger with request context
      ctx.services.log = serverLogger.child(requestMeta);

      // Continue to next middleware
      await next();
    },
  });
}
