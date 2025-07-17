/**
 * ValidationError class for request validation failures
 *
 * This error is thrown when request validation fails (params, query, body, or response).
 * It provides structured information about which fields failed validation and why.
 */

import { getCurrentCorrelationId } from './correlation';
import { BlaizeError, ErrorType } from '../index';

import type { ValidationErrorDetails } from '../index';

/**
 * Error thrown when request validation fails
 *
 * Automatically sets HTTP status to 400 and provides structured
 * validation error information for better client debugging.
 *
 * @example Basic usage:
 * ```typescript
 * throw new ValidationError('Email is required');
 * ```
 *
 * @example With detailed field information:
 * ```typescript
 * throw new ValidationError('Validation failed', {
 *   fields: [
 *     {
 *       field: 'email',
 *       messages: ['Email is required', 'Email must be valid'],
 *       rejectedValue: '',
 *       expectedType: 'string'
 *     }
 *   ],
 *   errorCount: 1,
 *   section: 'body'
 * });
 * ```
 */
export class ValidationError extends BlaizeError<ValidationErrorDetails> {
  /**
   * Creates a new ValidationError instance
   *
   * @param title - Human-readable error message
   * @param details - Optional structured validation details
   * @param correlationId - Optional correlation ID (uses current context if not provided)
   */
  constructor(
    title: string,
    details: ValidationErrorDetails | undefined = undefined,
    correlationId: string | undefined = undefined
  ) {
    super(
      ErrorType.VALIDATION_ERROR,
      title,
      400, // HTTP 400 Bad Request
      correlationId ?? getCurrentCorrelationId(),
      details
    );
  }
}
