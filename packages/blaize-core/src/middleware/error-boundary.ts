import {
  formatErrorResponse,
  extractOrGenerateCorrelationId,
  setErrorResponseHeaders,
} from '../errors/boundary';

import type { Context } from '@blaize-types/context';
import type { Middleware, MiddlewareFunction, NextFunction } from '@blaize-types/middleware';

/**
 * Options for configuring the error boundary middleware
 */
export interface ErrorBoundaryOptions {
  /** Enable debug logging of caught errors */
  debug?: boolean;
}

/**
 * Creates an error boundary middleware that catches all errors and converts them to proper HTTP responses
 *
 * This middleware should be placed early in the middleware chain to catch all downstream errors.
 * It ensures that:
 * - All BlaizeError instances are properly formatted as HTTP responses
 * - Unexpected errors are wrapped in InternalServerError and logged
 * - Correlation IDs are preserved and added to response headers
 * - No unhandled errors escape the middleware chain
 */
export function createErrorBoundary(options: ErrorBoundaryOptions = {}): Middleware {
  const { debug = false } = options;

  const middlewareFn: MiddlewareFunction = async (ctx: Context, next: NextFunction) => {
    try {
      await next();
    } catch (error) {
      // Don't handle errors if response was already sent
      if (ctx.response.sent) {
        if (debug) {
          console.error('Error occurred after response was sent:', error);
        }
        return;
      }

      // Log error in debug mode
      if (debug) {
        console.error('Error boundary caught error:', error);
      }

      // Extract or generate correlation ID from request
      const correlationId = extractOrGenerateCorrelationId(ctx.request.header);

      // Format the error as a proper response
      const errorResponse = formatErrorResponse(error);

      // Ensure correlation ID is consistent
      errorResponse.correlationId = correlationId;

      // Set appropriate response headers
      setErrorResponseHeaders(ctx.response.header, correlationId);

      // Send the formatted error response
      ctx.response.status(errorResponse.status).json(errorResponse);
    }
  };

  return {
    name: 'ErrorBoundary',
    execute: middlewareFn,
    debug,
  };
}
