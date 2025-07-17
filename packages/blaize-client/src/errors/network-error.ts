/**
 * NetworkError class for client-side network failures
 *
 * This error is thrown when network requests fail due to connectivity issues,
 * DNS failures, connection refused, or other network-level problems.
 */

import { BlaizeError, ErrorType } from '../../../blaize-types/src/index';

import type { NetworkErrorContext } from '../../../blaize-types/src/index';

/**
 * Error thrown when network requests fail
 *
 * Automatically sets HTTP status to 0 (client-side error) and provides
 * comprehensive network context for debugging connectivity issues.
 *
 * @example Basic usage:
 * ```typescript
 * const context: NetworkErrorContext = {
 *   url: 'https://api.example.com/users',
 *   method: 'GET',
 *   correlationId: 'client_123',
 *   originalError: new Error('Connection failed')
 * };
 *
 * throw new NetworkError('Network request failed', context);
 * ```
 *
 * @example With detailed network context:
 * ```typescript
 * const context: NetworkErrorContext = {
 *   url: 'https://api.example.com/data',
 *   method: 'POST',
 *   correlationId: 'client_456',
 *   timeout: 5000,
 *   originalError: new Error('ETIMEDOUT'),
 *   networkDetails: {
 *     isTimeout: true,
 *     isDnsFailure: false,
 *     isConnectionRefused: false
 *   }
 * };
 *
 * throw new NetworkError('Request timeout', context);
 * ```
 */
export class NetworkError extends BlaizeError<NetworkErrorContext> {
  /**
   * Creates a new NetworkError instance
   *
   * @param title - Human-readable error message
   * @param context - Network request context and failure details
   * @param correlationId - Optional correlation ID (uses context.correlationId if not provided)
   */
  constructor(
    title: string,
    context: NetworkErrorContext,
    correlationId: string | undefined = undefined
  ) {
    super(
      ErrorType.NETWORK_ERROR,
      title,
      0, // Client-side errors have no HTTP status
      correlationId ?? context.correlationId,
      context
    );
  }
}
