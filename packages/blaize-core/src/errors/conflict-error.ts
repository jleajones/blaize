/**
 * ConflictError class for resource conflicts
 *
 * This error is thrown when a resource conflict occurs, such as duplicate keys,
 * version mismatches, or concurrent modifications.
 */

import { BlaizeError, ErrorType } from '@blaize-types/errors';

import { getCurrentCorrelationId } from './correlation';

import type { ConflictErrorDetails } from '@blaize-types/errors';

/**
 * Error thrown when a resource conflict occurs
 *
 * Automatically sets HTTP status to 409 and provides conflict context.
 *
 * @example Basic usage:
 * ```typescript
 * throw new ConflictError('Email already exists');
 * ```
 *
 * @example With conflict details:
 * ```typescript
 * throw new ConflictError('Version conflict', {
 *   conflictType: 'version_mismatch',
 *   currentVersion: '2',
 *   expectedVersion: '1',
 *   resolution: 'Fetch the latest version and retry'
 * });
 * ```
 */
export class ConflictError extends BlaizeError<ConflictErrorDetails> {
  /**
   * Creates a new ConflictError instance
   *
   * @param title - Human-readable error message
   * @param details - Optional conflict context
   * @param correlationId - Optional correlation ID (uses current context if not provided)
   */
  constructor(
    title: string,
    details: ConflictErrorDetails | undefined = undefined,
    correlationId: string | undefined = undefined
  ) {
    super(
      ErrorType.CONFLICT,
      title,
      409, // HTTP 409 Conflict
      correlationId ?? getCurrentCorrelationId(),
      details
    );
  }
}
