/**
 * SSE-specific error classes for BlaizeJS Client
 * Location: packages/blaize-client/src/errors/sse-errors.ts
 *
 * These error classes follow the same pattern as NetworkError, ParseError, and TimeoutError,
 * extending BlaizeError to provide consistent error handling for SSE connections.
 */

import {
  BlaizeError,
  ErrorType,
  type SSEConnectionErrorContext,
  type SSEHeartbeatErrorContext,
  type SSEStreamErrorContext,
} from '../../../blaize-types/src/errors';

/**
 * Error thrown when SSE connection fails or is lost
 *
 * @example
 * ```typescript
 * const context: SSEConnectionErrorContext = {
 *   url: 'https://api.example.com/events',
 *   correlationId: 'client_123',
 *   state: 'connecting',
 *   reconnectAttempts: 3
 * };
 *
 * throw new SSEConnectionError('Failed to establish SSE connection', context);
 * ```
 */
export class SSEConnectionError extends BlaizeError<SSEConnectionErrorContext> {
  constructor(title: string, context: SSEConnectionErrorContext, correlationId?: string) {
    super(
      ErrorType.NETWORK_ERROR,
      title,
      0, // Client-side errors have no HTTP status
      correlationId ?? context.correlationId,
      context
    );
    this.name = 'SSEConnectionError';
  }
}

/**
 * Error thrown when server sends an error event through SSE stream
 *
 * @example
 * ```typescript
 * const context: SSEStreamErrorContext = {
 *   url: 'https://api.example.com/events',
 *   correlationId: 'req_server_456',
 *   message: 'Invalid subscription',
 *   code: 'INVALID_SUB'
 * };
 *
 * throw new SSEStreamError('Server reported error', context);
 * ```
 */
export class SSEStreamError extends BlaizeError<SSEStreamErrorContext> {
  constructor(title: string, context: SSEStreamErrorContext, correlationId?: string) {
    super(
      ErrorType.VALIDATION_ERROR, // Server errors are often validation-related
      title,
      0, // SSE events don't have HTTP status codes
      correlationId ?? context.correlationId,
      context
    );
    this.name = 'SSEStreamError';
  }
}

/**
 * Error thrown when SSE heartbeat timeout is detected
 *
 * @example
 * ```typescript
 * const context: SSEHeartbeatErrorContext = {
 *   url: 'https://api.example.com/events',
 *   correlationId: 'client_789',
 *   heartbeatTimeout: 60000,
 *   timeSinceLastEvent: 65000
 * };
 *
 * throw new SSEHeartbeatError('Heartbeat timeout - connection may be stale', context);
 * ```
 */
export class SSEHeartbeatError extends BlaizeError<SSEHeartbeatErrorContext> {
  constructor(title: string, context: SSEHeartbeatErrorContext, correlationId?: string) {
    super(
      ErrorType.TIMEOUT_ERROR,
      title,
      0, // Client-side timeout
      correlationId ?? context.correlationId,
      context
    );
    this.name = 'SSEHeartbeatError';
  }
}

/**
 * Type guard to check if an error is an SSE-related error
 */
export function isSSEError(
  error: unknown
): error is SSEConnectionError | SSEStreamError | SSEHeartbeatError {
  return (
    error instanceof SSEConnectionError ||
    error instanceof SSEStreamError ||
    error instanceof SSEHeartbeatError
  );
}

/**
 * Type guard for SSE connection errors
 */
export function isSSEConnectionError(error: unknown): error is SSEConnectionError {
  return error instanceof SSEConnectionError;
}

/**
 * Type guard for SSE stream errors
 */
export function isSSEStreamError(error: unknown): error is SSEStreamError {
  return error instanceof SSEStreamError;
}

/**
 * Type guard for SSE heartbeat errors
 */
export function isSSEHeartbeatError(error: unknown): error is SSEHeartbeatError {
  return error instanceof SSEHeartbeatError;
}
