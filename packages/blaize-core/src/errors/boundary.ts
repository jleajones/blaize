import { BlaizeError } from '@blaize-types/errors';

import { InternalServerError } from './internal-server-error';
import { generateCorrelationId } from '../tracing/correlation';

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
  const correlationId = generateCorrelationId();
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
 */
export function extractOrGenerateCorrelationId(
  headerGetter: (name: string) => string | undefined
): string {
  return headerGetter('x-correlation-id') ?? generateCorrelationId();
}

/**
 * Sets response headers for error responses
 */
export function setErrorResponseHeaders(
  headerSetter: (name: string, value: string) => void,
  correlationId: string
): void {
  headerSetter('x-correlation-id', correlationId);
  // Add any other standard error headers here if needed
}
