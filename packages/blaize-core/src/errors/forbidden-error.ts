/**
 * ForbiddenError class for authorization failures
 *
 * This error is thrown when a user lacks permission to access a resource.
 * It provides context about required permissions and access control.
 */

import { BlaizeError, ErrorType } from '@blaize-types/errors';

import { getCorrelationId } from '../tracing/correlation';

import type { ForbiddenErrorDetails } from '@blaize-types/errors';

/**
 * Error thrown when user lacks permission to access a resource
 *
 * Automatically sets HTTP status to 403 and provides permission context.
 *
 * @example Basic usage:
 * ```typescript
 * throw new ForbiddenError('Access denied');
 * ```
 *
 * @example With permission details:
 * ```typescript
 * throw new ForbiddenError('Insufficient permissions', {
 *   requiredPermission: 'admin:users:delete',
 *   userPermissions: ['admin:users:read'],
 *   resource: 'user-123',
 *   action: 'delete'
 * });
 * ```
 */
export class ForbiddenError extends BlaizeError<ForbiddenErrorDetails> {
  /**
   * Creates a new ForbiddenError instance
   *
   * @param title - Human-readable error message
   * @param details - Optional permission context
   * @param correlationId - Optional correlation ID (uses current context if not provided)
   */
  constructor(
    title: string,
    details: ForbiddenErrorDetails | undefined = undefined,
    correlationId: string | undefined = undefined
  ) {
    super(
      ErrorType.FORBIDDEN,
      title,
      403, // HTTP 403 Forbidden
      correlationId ?? getCorrelationId(),
      details
    );
  }
}
