import { BlaizeError } from '@blaize-types/errors';

import { InternalServerError } from './internal-server-error';
import {
  getCorrelationId,
  createCorrelationIdFromHeaders,
  getCorrelationHeaderName,
} from '../tracing/correlation';

import type { BlaizeErrorResponse } from '@blaize-types/errors';

/**
 * Checks if an error is a handled BlaizeError instance
 */
export function isHandledError(error: unknown): error is BlaizeError {
  return error instanceof BlaizeError;
}

/**
 * Formats any error into a standardized BlaizeErrorResponse
 */
export function formatErrorResponse(error: unknown): BlaizeErrorResponse {
  // Handle BlaizeError instances - they're already properly formatted
  if (isHandledError(error)) {
    return {
      type: error.type,
      title: error.title,
      status: error.status,
      correlationId: error.correlationId,
      timestamp: error.timestamp.toISOString(),
      details: error.details,
    };
  }

  // Handle unexpected errors by wrapping them in InternalServerError
  const correlationId = getCorrelationId();
  let originalMessage: string;

  if (error instanceof Error) {
    originalMessage = error.message;
  } else if (error === null || error === undefined) {
    originalMessage = 'Unknown error occurred';
  } else {
    originalMessage = String(error);
  }

  // Create InternalServerError for unexpected errors
  const wrappedError = new InternalServerError(
    'Internal Server Error',
    { originalMessage },
    correlationId
  );

  return {
    type: wrappedError.type,
    title: wrappedError.title,
    status: wrappedError.status,
    correlationId: wrappedError.correlationId,
    timestamp: wrappedError.timestamp.toISOString(),
    details: wrappedError.details,
  };
}

/**
 * Extracts correlation ID from request headers or generates a new one
 *
 * Uses the configured header name (default: 'x-correlation-id') to extract
 * the correlation ID from request headers. If not found, generates a new one.
 *
 * @param headerGetter - Function to retrieve header values by name
 * @returns Correlation ID (extracted or generated)
 */
export function extractOrGenerateCorrelationId(
  headerGetter: (name: string) => string | undefined
): string {
  // Get the configured header name
  const headerName = getCorrelationHeaderName();

  // Build a headers object that the correlation module expects
  const headers: Record<string, string | undefined> = {
    [headerName]: headerGetter(headerName),
  };

  // Use the correlation module's function which handles the configured header
  return createCorrelationIdFromHeaders(headers);
}

/**
 * Sets response headers for error responses
 *
 * Sets the correlation ID header using the configured header name
 * (default: 'x-correlation-id'). This ensures error responses always
 * include the correlation ID for tracing.
 *
 * @param headerSetter - Function to set response headers
 * @param correlationId - The correlation ID to include in the response
 */
export function setErrorResponseHeaders(
  headerSetter: (name: string, value: string) => void,
  correlationId: string
): void {
  // Get the configured header name
  const headerName = getCorrelationHeaderName();

  // Set the correlation header with the configured name
  headerSetter(headerName, correlationId);

  // Add any other standard error headers here if needed
  // For example: headerSetter('content-type', 'application/json');
}
