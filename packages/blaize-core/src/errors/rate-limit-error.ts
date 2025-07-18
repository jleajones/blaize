/**
 * RateLimitError class for rate limiting violations
 *
 * This error is thrown when rate limits are exceeded.
 * It provides context about the rate limit and when requests can resume.
 */

import { getCurrentCorrelationId } from './correlation';
import { BlaizeError, ErrorType } from '../../../blaize-types/src/errors';

import type { RateLimitErrorDetails } from '../../../blaize-types/src/errors';

/**
 * Error thrown when rate limits are exceeded
 *
 * Automatically sets HTTP status to 429 and provides rate limit context.
 *
 * @example Basic usage:
 * ```typescript
 * throw new RateLimitError('Too many requests');
 * ```
 *
 * @example With rate limit details:
 * ```typescript
 * throw new RateLimitError('Rate limit exceeded', {
 *   limit: 100,
 *   remaining: 0,
 *   retryAfter: 3600,
 *   window: 'hour',
 *   identifier: 'user-123'
 * });
 * ```
 */
export class RateLimitError extends BlaizeError<RateLimitErrorDetails> {
  /**
   * Creates a new RateLimitError instance
   *
   * @param title - Human-readable error message
   * @param details - Optional rate limit context
   * @param correlationId - Optional correlation ID (uses current context if not provided)
   */
  constructor(
    title: string,
    details: RateLimitErrorDetails | undefined = undefined,
    correlationId: string | undefined = undefined
  ) {
    super(
      ErrorType.RATE_LIMITED,
      title,
      429, // HTTP 429 Too Many Requests
      correlationId ?? getCurrentCorrelationId(),
      details
    );
  }
}
