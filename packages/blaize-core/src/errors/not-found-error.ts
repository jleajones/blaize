/**
 * NotFoundError class for resource not found errors
 *
 * This error is thrown when a requested resource cannot be found.
 * It provides context about what resource was being looked for and how.
 */

import { BlaizeError, ErrorType } from '@blaize-types/errors';

import { getCurrentCorrelationId } from './correlation';

import type { NotFoundErrorDetails } from '@blaize-types/errors';
/**
 * Error thrown when a requested resource cannot be found
 *
 * Automatically sets HTTP status to 404 and provides context
 * about the missing resource for better debugging and user experience.
 *
 * @example Basic usage:
 * ```typescript
 * throw new NotFoundError('User not found');
 * ```
 *
 * @example With resource context:
 * ```typescript
 * throw new NotFoundError('User not found', {
 *   resourceType: 'User',
 *   resourceId: 'user-123',
 *   suggestion: 'Check if the user ID is correct'
 * });
 * ```
 *
 * @example API endpoint not found:
 * ```typescript
 * throw new NotFoundError('Endpoint not found', {
 *   path: '/api/v1/unknown',
 *   method: 'GET',
 *   suggestion: 'Check the API documentation'
 * });
 * ```
 */
export class NotFoundError extends BlaizeError<NotFoundErrorDetails> {
  /**
   * Creates a new NotFoundError instance
   *
   * @param title - Human-readable error message
   * @param details - Optional context about the missing resource
   * @param correlationId - Optional correlation ID (uses current context if not provided)
   */
  constructor(
    title: string,
    details: NotFoundErrorDetails | undefined = undefined,
    correlationId: string | undefined = undefined
  ) {
    super(
      ErrorType.NOT_FOUND,
      title,
      404, // HTTP 404 Not Found
      correlationId ?? getCurrentCorrelationId(),
      details
    );
  }
}
