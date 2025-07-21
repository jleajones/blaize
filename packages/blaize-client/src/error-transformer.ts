/**
 * Error Transformation System for BlaizeJS Client
 * Location: packages/blaize-client/src/error-transformer.ts
 *
 * This module ensures that ALL errors reaching client applications are BlaizeError
 * instances. It provides a consistent error interface so developers never need
 * to check "what type of error is this?"
 *
 * Key Principles:
 * - All functions throw errors, never return them
 * - Correlation IDs are preserved through all transformations
 * - Server errors are parsed and re-thrown as BlaizeError instances
 * - Client errors are transformed to appropriate BlaizeError subclasses
 * - No type guards needed in client code - framework guarantees BlaizeError
 */

import { NetworkError } from './errors/network-error';
import { ParseError } from './errors/parse-error';
import { TimeoutError } from './errors/timeout-error';
import { BlaizeError, ErrorType } from '../../blaize-types/src/errors';

import type {
  BlaizeErrorResponse,
  NetworkErrorContext,
  TimeoutErrorContext,
  ParseErrorContext,
  ErrorTransformContext,
} from '../../blaize-types/src/errors';


/**
 * Generates a unique correlation ID for client-side operations
 *
 * Format: client_[timestamp_base36]_[random_base36]
 * Example: client_k3x2m1_9z8y7w6v
 *
 * @returns A unique client correlation ID
 *
 * @example
 * ```typescript
 * const correlationId = generateClientCorrelationId();
 * console.log(correlationId); // "client_k3x2m1_9z8y7w6v"
 * ```
 */
export function generateClientCorrelationId(): string {
  const timestamp = Date.now().toString(36); // Base36 encoded timestamp
  const random = Math.random().toString(36).substr(2, 9); // Base36 random string
  return `client_${timestamp}_${random}`;
}

/**
 * Parses server error responses and throws appropriate BlaizeError instances
 *
 * This function handles server responses that indicate errors and transforms
 * them into BlaizeError instances with preserved correlation IDs and context.
 *
 * @param response - The HTTP response object from the server
 * @throws {BlaizeError} Always throws - either parsed server error or generic error
 *
 * @example Server BlaizeError response:
 * ```typescript
 * try {
 *   await parseAndThrowErrorResponse(response);
 * } catch (error) {
 *   // error is guaranteed to be a BlaizeError instance
 *   console.log(error.type); // "VALIDATION_ERROR"
 *   console.log(error.correlationId); // "req_server_123"
 * }
 * ```
 */
export async function parseAndThrowErrorResponse(response: Response): Promise<never> {
  const correlationId = response.headers.get('x-correlation-id') || generateClientCorrelationId();

  try {
    const responseData = await response.json();

    // Check if it's a proper BlaizeError response from the server
    if (isBlaizeErrorResponse(responseData)) {
      // Create and throw a new BlaizeError instance with server data
      throw createBlaizeErrorFromResponse(responseData);
    }

    // Handle non-BlaizeError server responses (legacy or third-party APIs)
    throw createGenericHttpError(response, correlationId, responseData);
  } catch (error) {
    // If error is already a BlaizeError, re-throw it
    if (error instanceof BlaizeError) {
      throw error;
    }

    // Handle JSON parsing failures
    if (error instanceof SyntaxError) {
      throw new ParseError(
        'Failed to parse server error response as JSON',
        {
          url: response.url,
          method: 'UNKNOWN', // Response doesn't have method info
          correlationId,
          statusCode: response.status,
          contentType: response.headers.get('content-type') || 'unknown',
          expectedFormat: 'json',
          responseSample: 'Unable to parse response',
          originalError: error,
        },
        correlationId
      );
    }

    // Fallback for any other parsing errors
    throw createGenericHttpError(response, correlationId);
  }
}

/**
 * Transforms client-side errors into appropriate BlaizeError instances
 *
 * This is the main transformation function that ensures all client errors
 * become BlaizeError instances with preserved context and correlation IDs.
 *
 * @param error - The original error to transform
 * @param context - Context information about the request/operation
 * @throws {BlaizeError} Always throws - never returns
 *
 * @example Network error transformation:
 * ```typescript
 * try {
 *   await fetch('/api/data');
 * } catch (error) {
 *   transformClientError(error, {
 *     url: '/api/data',
 *     method: 'GET',
 *     correlationId: 'client_123'
 *   });
 * }
 * ```
 */
export function transformClientError(error: unknown, context: ErrorTransformContext): never {
  // If it's already a BlaizeError, preserve it as-is
  if (error instanceof BlaizeError) {
    throw error;
  }

  // Transform based on error type and characteristics
  if (isNetworkError(error)) {
    throw createNetworkError(error, context);
  }

  if (isTimeoutError(error)) {
    throw createTimeoutError(error, context);
  }

  if (isParseError(error)) {
    throw createParseError(error, context);
  }

  // Fallback for unknown error types
  throw createGenericBlaizeError(error, context.correlationId);
}

/**
 * Checks if an error is a native JavaScript error (not a BlaizeError)
 *
 * @param error - The error to check
 * @returns True if it's a native JavaScript error
 */
export function isNativeError(error: unknown): error is Error {
  return error instanceof Error && !(error instanceof BlaizeError);
}

/**
 * Creates a generic BlaizeError from unknown error types
 *
 * @param error - The original error (any type)
 * @param correlationId - The correlation ID to preserve
 * @returns A new BlaizeError instance
 */
export function createGenericBlaizeError(error: unknown, correlationId: string): BlaizeError {
  let title: string;
  let details: any;

  if (error instanceof Error) {
    title = error.message || 'Unknown error occurred';
    details = {
      originalError: error,
      errorType: error.constructor.name,
    };
  } else if (typeof error === 'string') {
    title = error;
    details = {
      originalError: error,
      errorType: 'string',
    };
  } else {
    title = 'Unknown error occurred';
    details = {
      originalError: error,
      errorType: typeof error,
    };
  }

  return new (BlaizeError as any)(
    ErrorType.HTTP_ERROR,
    title,
    0, // Client-side errors have no HTTP status
    correlationId,
    details
  );
}

// Helper functions for error type detection

/**
 * Checks if an error is a network-related error
 */
function isNetworkError(error: unknown): error is TypeError {
  return (
    error instanceof TypeError &&
    (error.message.includes('fetch') ||
      error.message.includes('network') ||
      error.message.includes('Failed to fetch'))
  );
}

/**
 * Checks if an error is a timeout-related error
 */
function isTimeoutError(error: unknown): error is Error {
  return (
    error instanceof Error &&
    (error.name === 'AbortError' ||
      error.message.includes('timeout') ||
      error.message.includes('aborted'))
  );
}

/**
 * Checks if an error is a parsing-related error
 */
function isParseError(error: unknown): error is SyntaxError {
  return (
    error instanceof SyntaxError ||
    (error instanceof Error &&
      (error.message.includes('JSON') ||
        error.message.includes('parse') ||
        error.message.includes('Unexpected token')))
  );
}

/**
 * Checks if a response object is a proper BlaizeError response
 */
function isBlaizeErrorResponse(data: any): data is BlaizeErrorResponse {
  return (
    data &&
    typeof data === 'object' &&
    typeof data.type === 'string' &&
    typeof data.title === 'string' &&
    typeof data.status === 'number' &&
    typeof data.correlationId === 'string' &&
    typeof data.timestamp === 'string'
  );
}

/**
 * Creates a BlaizeError instance from a server BlaizeError response
 */
function createBlaizeErrorFromResponse(response: BlaizeErrorResponse): BlaizeError {
  return new (BlaizeError as any)(
    response.type,
    response.title,
    response.status,
    response.correlationId,
    response.details
  );
}

/**
 * Creates a generic HTTP error for non-BlaizeError server responses
 */
function createGenericHttpError(
  response: Response,
  correlationId: string,
  responseData?: any
): BlaizeError {
  const title = response.statusText || `HTTP ${response.status}`;

  return new (BlaizeError as any)(ErrorType.HTTP_ERROR, title, response.status, correlationId, {
    url: response.url,
    statusCode: response.status,
    statusText: response.statusText,
    responseData: responseData || null,
  });
}

/**
 * Creates a NetworkError from a network-related error
 */
function createNetworkError(error: Error, context: ErrorTransformContext): NetworkError {
  const networkContext: NetworkErrorContext = {
    url: context.url,
    method: context.method,
    correlationId: context.correlationId,
    originalError: error,
    networkDetails: {
      isTimeout: false,
      isDnsFailure: error.message.includes('ENOTFOUND'),
      isConnectionRefused: error.message.includes('ECONNREFUSED'),
    },
  };

  return new NetworkError(
    `Network request failed: ${error.message}`,
    networkContext,
    context.correlationId
  );
}

/**
 * Creates a TimeoutError from a timeout-related error
 */
function createTimeoutError(error: Error, context: ErrorTransformContext): TimeoutError {
  const timeoutContext: TimeoutErrorContext = {
    url: context.url,
    method: context.method,
    correlationId: context.correlationId,
    timeoutMs: context.timeoutMs || 0,
    elapsedMs: context.elapsedMs || 0,
    timeoutType: error.name === 'AbortError' ? 'request' : 'connection',
  };

  return new TimeoutError(
    `Request timeout: ${error.message}`,
    timeoutContext,
    context.correlationId
  );
}

/**
 * Creates a ParseError from a parsing-related error
 */
function createParseError(error: Error, context: ErrorTransformContext): ParseError {
  const parseContext: ParseErrorContext = {
    url: context.url,
    method: context.method,
    correlationId: context.correlationId,
    statusCode: context.statusCode || 0,
    contentType: context.contentType || 'unknown',
    expectedFormat: 'json',
    responseSample: context.responseSample || 'Unable to capture response',
    originalError: error,
  };

  return new ParseError(
    `Failed to parse response: ${error.message}`,
    parseContext,
    context.correlationId
  );
}
