/**
 * SSEStreamClosedError class for operations on closed SSE streams
 *
 * This error is thrown when attempting to perform operations on a closed SSE stream.
 * It provides context about when and why the stream was closed.
 */

import { BlaizeError, ErrorType } from '@blaize-types/errors';

import { getCorrelationId } from '../tracing/correlation';

import type { SSEStreamClosedErrorDetails } from '@blaize-types/errors';

/**
 * Error thrown when attempting operations on a closed SSE stream
 *
 * Automatically sets HTTP status to 410 (Gone) indicating
 * the resource is no longer available.
 *
 * @example Basic usage:
 * ```typescript
 * throw new SSEStreamClosedError('Cannot send event to closed stream');
 * ```
 *
 * @example With closure context:
 * ```typescript
 * throw new SSEStreamClosedError('Stream closed by client', {
 *   clientId: 'client-123',
 *   closedAt: new Date().toISOString(),
 *   closeReason: 'client-disconnect',
 *   canReconnect: true,
 *   retryAfter: 5000
 * });
 * ```
 *
 * @example Timeout closure:
 * ```typescript
 * throw new SSEStreamClosedError('Stream closed due to inactivity', {
 *   clientId: 'client-456',
 *   closedAt: new Date().toISOString(),
 *   closeReason: 'timeout',
 *   canReconnect: true,
 *   retryAfter: 1000
 * });
 * ```
 *
 * @example Permanent closure:
 * ```typescript
 * throw new SSEStreamClosedError('Stream permanently closed', {
 *   clientId: 'client-789',
 *   closedAt: new Date().toISOString(),
 *   closeReason: 'error',
 *   canReconnect: false
 * });
 * ```
 */
export class SSEStreamClosedError extends BlaizeError<SSEStreamClosedErrorDetails> {
  /**
   * Creates a new SSEStreamClosedError instance
   *
   * @param title - Human-readable error message
   * @param details - Optional context about the stream closure
   * @param correlationId - Optional correlation ID (uses current context if not provided)
   */
  constructor(
    title: string,
    details: SSEStreamClosedErrorDetails | undefined = undefined,
    correlationId: string | undefined = undefined
  ) {
    super(
      ErrorType.SSE_STREAM_CLOSED,
      title,
      410, // HTTP 410 Gone - resource no longer available
      correlationId ?? getCorrelationId(),
      details
    );
  }
}
