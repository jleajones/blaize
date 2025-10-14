/**
 * HTTP Metrics Middleware
 *
 * BlaizeJS middleware that automatically tracks HTTP request metrics including
 * timing, status codes, and request counts. Integrates with MetricsCollector.
 *
 * @module @blaizejs/plugin-metrics/middleware
 */

import type { Context, Middleware } from 'blaizejs';
import type { MetricsCollector } from './types';

/**
 * Metrics middleware options
 */
export interface MetricsMiddlewareOptions {
  /**
   * Paths to exclude from metrics tracking
   * Supports exact matches and prefix patterns
   *
   * @example ['/health', '/metrics', '/internal/*']
   */
  excludePaths?: string[];

  /**
   * Metrics collector instance
   */
  collector: MetricsCollector;
}

/**
 * Create HTTP metrics tracking middleware
 *
 * Automatically tracks request timing, status codes, and counts.
 * Injects metrics collector into context.services for route access.
 *
 * @param options - Middleware configuration
 * @returns BlaizeJS middleware
 *
 * @example
 * ```typescript
 * import { createMetricsMiddleware } from '@blaizejs/plugin-metrics';
 *
 * const collector = new MetricsCollectorImpl();
 *
 * const middleware = createMetricsMiddleware({
 *   collector,
 *   excludePaths: ['/health', '/metrics'],
 * });
 *
 * server.use(middleware);
 * ```
 */
export function createMetricsMiddleware(
  options: MetricsMiddlewareOptions
): Middleware<{}, { metrics: MetricsCollector }> {
  const { excludePaths = [], collector } = options;

  return {
    name: 'metrics',
    execute: async (ctx, next) => {
      // Inject metrics collector into context
      ctx.services.metrics = collector;

      // Check if path should be excluded
      const path = ctx.request?.path || '/';
      if (shouldExcludePath(path, excludePaths)) {
        return next();
      }

      // Start tracking request
      collector.startHttpRequest();

      // Record start time
      const startTime = performance.now();
      let statusCode = 200; // Default status
      let recordingError: Error | null = null;

      try {
        // Process request
        await next();

        // Capture status code from raw response object
        // BlaizeJS sets statusCode on the underlying Node.js response
        statusCode = ctx.response.raw?.statusCode || 200;
      } catch (error) {
        // Capture error status
        statusCode = getErrorStatusCode(error);
        recordingError = error instanceof Error ? error : new Error(String(error));

        // Re-throw to let error handling middleware deal with it
        throw error;
      } finally {
        // Always record metrics, even on errors
        try {
          const duration = performance.now() - startTime;
          const method = ctx.request?.method || 'UNKNOWN';

          collector.recordHttpRequest(method, path, statusCode, duration);
        } catch (metricsError) {
          // Never let metrics recording errors crash the request
          // Log error if possible, but don't throw
          if (process.env.NODE_ENV !== 'production') {
            console.error('[Metrics Middleware] Error recording metrics:', metricsError);
          }
        }
      }
    },
  };
}

/**
 * Check if a path should be excluded from metrics
 *
 * Supports exact matches and wildcard patterns (suffix *)
 *
 * @param path - Request path to check
 * @param excludePaths - Array of exclusion patterns
 * @returns True if path should be excluded
 *
 * @example
 * ```typescript
 * shouldExcludePath('/health', ['/health']); // true
 * shouldExcludePath('/internal/status', ['/internal/*']); // true
 * shouldExcludePath('/api/users', ['/health']); // false
 * ```
 */
export function shouldExcludePath(path: string, excludePaths: string[]): boolean {
  for (const pattern of excludePaths) {
    if (pattern.endsWith('/*')) {
      // Prefix match for wildcard patterns
      const prefix = pattern.slice(0, -2); // Remove /*
      if (path === prefix || path.startsWith(prefix + '/')) {
        return true;
      }
    } else if (path === pattern) {
      // Exact match
      return true;
    }
  }

  return false;
}

/**
 * Extract HTTP status code from error
 *
 * Attempts to extract status code from common error formats.
 * Defaults to 500 for unknown errors.
 *
 * @param error - Error object
 * @returns HTTP status code
 *
 * @example
 * ```typescript
 * getErrorStatusCode(new NotFoundError()); // 404
 * getErrorStatusCode(new ValidationError()); // 400
 * getErrorStatusCode(new Error('Unknown')); // 500
 * ```
 */
export function getErrorStatusCode(error: unknown): number {
  if (typeof error === 'object' && error !== null) {
    // Check for status property
    if ('status' in error && typeof error.status === 'number') {
      return error.status;
    }

    // Check for statusCode property
    if ('statusCode' in error && typeof error.statusCode === 'number') {
      return error.statusCode;
    }

    // Check for code property (sometimes used for HTTP codes)
    if ('code' in error && typeof error.code === 'number') {
      return error.code;
    }
  }

  // Default to 500 Internal Server Error
  return 500;
}
