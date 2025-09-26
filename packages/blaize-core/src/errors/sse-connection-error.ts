/**
 * SSEConnectionError class for SSE connection failures
 *
 * This error is thrown when an SSE connection cannot be established or fails.
 * It provides context about the connection attempt and failure reason.
 */

import { BlaizeError, ErrorType } from '@blaize-types/errors';

import { getCorrelationId } from '../tracing/correlation';

import type { SSEConnectionErrorDetails } from '@blaize-types/errors';

/**
 * Error thrown when SSE connection cannot be established
 *
 * Automatically sets HTTP status to 502 (Bad Gateway) indicating
 * an upstream connection failure.
 *
 * @example Basic usage:
 * ```typescript
 * throw new SSEConnectionError('Failed to establish SSE connection');
 * ```
 *
 * @example With connection context:
 * ```typescript
 * throw new SSEConnectionError('SSE connection failed', {
 *   clientId: 'client-123',
 *   attemptNumber: 3,
 *   maxRetries: 5,
 *   cause: 'Network timeout',
 *   suggestion: 'Check network connectivity and retry'
 * });
 * ```
 *
 * @example Connection limit reached:
 * ```typescript
 * throw new SSEConnectionError('Connection limit exceeded', {
 *   clientId: 'client-456',
 *   cause: 'Maximum connections reached',
 *   suggestion: 'Wait for existing connections to close'
 * });
 * ```
 */
export class SSEConnectionError extends BlaizeError<SSEConnectionErrorDetails> {
  /**
   * Creates a new SSEConnectionError instance
   *
   * @param title - Human-readable error message
   * @param details - Optional context about the connection failure
   * @param correlationId - Optional correlation ID (uses current context if not provided)
   */
  constructor(
    title: string,
    details: SSEConnectionErrorDetails | undefined = undefined,
    correlationId: string | undefined = undefined
  ) {
    super(
      ErrorType.SSE_CONNECTION_ERROR,
      title,
      502, // HTTP 502 Bad Gateway - upstream connection failed
      correlationId ?? getCorrelationId(),
      details
    );
  }
}
