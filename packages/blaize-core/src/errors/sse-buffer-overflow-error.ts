/**
 * SSEBufferOverflowError class for SSE buffer overflow conditions
 *
 * This error is thrown when an SSE stream buffer exceeds its configured limits.
 * It provides context about the overflow and the strategy applied.
 */

import { BlaizeError, ErrorType } from '@blaize-types/errors';

import { getCorrelationId } from '../tracing/correlation';

import type { SSEBufferOverflowErrorDetails } from '@blaize-types/errors';

/**
 * Error thrown when SSE buffer overflows
 *
 * Automatically sets HTTP status to 503 (Service Unavailable) indicating
 * the server cannot handle the request due to overload.
 *
 * @example Basic usage with required details:
 * ```typescript
 * throw new SSEBufferOverflowError('SSE buffer limit exceeded', {
 *   currentSize: 1000,
 *   maxSize: 1000,
 *   strategy: 'drop-oldest'
 * });
 * ```
 *
 * @example With full context:
 * ```typescript
 * throw new SSEBufferOverflowError('Buffer overflow on high-frequency stream', {
 *   clientId: 'client-123',
 *   currentSize: 5000,
 *   maxSize: 5000,
 *   eventsDropped: 25,
 *   strategy: 'drop-oldest',
 *   triggeringEvent: 'market-data-update'
 * });
 * ```
 *
 * @example Stream closed due to overflow:
 * ```typescript
 * throw new SSEBufferOverflowError('Stream closed due to buffer overflow', {
 *   clientId: 'client-456',
 *   currentSize: 1000,
 *   maxSize: 1000,
 *   strategy: 'close',
 *   eventsDropped: 0
 * });
 * ```
 */
export class SSEBufferOverflowError extends BlaizeError<SSEBufferOverflowErrorDetails> {
  /**
   * Creates a new SSEBufferOverflowError instance
   *
   * @param title - Human-readable error message
   * @param details - Required context about the buffer overflow
   * @param correlationId - Optional correlation ID (uses current context if not provided)
   */
  constructor(
    title: string,
    details: SSEBufferOverflowErrorDetails,
    correlationId: string | undefined = undefined
  ) {
    super(
      ErrorType.SSE_BUFFER_OVERFLOW,
      title,
      503, // HTTP 503 Service Unavailable - server cannot handle the request
      correlationId ?? getCorrelationId(),
      details
    );
  }
}
