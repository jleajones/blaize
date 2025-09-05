/**
 * InternalServerError class for server-side errors
 *
 * This error is thrown for unexpected server-side errors that are not
 * the client's fault. It provides debugging context while protecting
 * sensitive information in production.
 */

import { BlaizeError, ErrorType } from '@blaize-types/errors';

import { getCorrelationId } from '../tracing/correlation';

import type { InternalServerErrorDetails } from '@blaize-types/errors';
/**
 * Error thrown for internal server errors
 *
 * Automatically sets HTTP status to 500 and provides debugging context.
 * Note: In production, sensitive details should be filtered by error boundary.
 *
 * @example Basic usage:
 * ```typescript
 * throw new InternalServerError('Something went wrong');
 * ```
 *
 * @example With debugging details:
 * ```typescript
 * throw new InternalServerError('Database error', {
 *   originalError: error.message,
 *   component: 'user-service',
 *   operation: 'createUser',
 *   retryable: true
 * });
 * ```
 *
 * @example Wrapping an existing error:
 * ```typescript
 * try {
 *   await database.connect();
 * } catch (error) {
 *   throw new InternalServerError('Database connection failed', {
 *     originalError: error.message,
 *     stackTrace: error.stack,
 *     component: 'database',
 *     retryable: true
 *   });
 * }
 * ```
 */
export class InternalServerError extends BlaizeError<InternalServerErrorDetails> {
  /**
   * Creates a new InternalServerError instance
   *
   * @param title - Human-readable error message
   * @param details - Optional debugging context
   * @param correlationId - Optional correlation ID (uses current context if not provided)
   */
  constructor(
    title: string,
    details: InternalServerErrorDetails | undefined = undefined,
    correlationId: string | undefined = undefined
  ) {
    super(
      ErrorType.INTERNAL_SERVER_ERROR,
      title,
      500, // HTTP 500 Internal Server Error
      correlationId ?? getCorrelationId(),
      details
    );
  }
}
