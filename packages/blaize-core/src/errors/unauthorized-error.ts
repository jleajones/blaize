/**
 * UnauthorizedError class for authentication failures
 *
 * This error is thrown when authentication is required or has failed.
 * It provides context about authentication requirements and failure reasons.
 */

import { ErrorType, BlaizeError } from '../index';
import { getCurrentCorrelationId } from './correlation';

import type { UnauthorizedErrorDetails } from '../index';

/**
 * Error thrown when authentication is required or has failed
 *
 * Automatically sets HTTP status to 401 and provides authentication context.
 *
 * @example Basic usage:
 * ```typescript
 * throw new UnauthorizedError('Authentication required');
 * ```
 *
 * @example With authentication details:
 * ```typescript
 * throw new UnauthorizedError('Token expired', {
 *   reason: 'expired_token',
 *   authScheme: 'Bearer',
 *   loginUrl: '/auth/login'
 * });
 * ```
 */
export class UnauthorizedError extends BlaizeError<UnauthorizedErrorDetails> {
  /**
   * Creates a new UnauthorizedError instance
   *
   * @param title - Human-readable error message
   * @param details - Optional authentication context
   * @param correlationId - Optional correlation ID (uses current context if not provided)
   */
  constructor(
    title: string,
    details: UnauthorizedErrorDetails | undefined = undefined,
    correlationId: string | undefined = undefined
  ) {
    super(
      ErrorType.UNAUTHORIZED,
      title,
      401, // HTTP 401 Unauthorized
      correlationId ?? getCurrentCorrelationId(),
      details
    );
  }
}
