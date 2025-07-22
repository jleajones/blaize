/**
 * TimeoutError class for client-side request timeouts
 * Location: packages/blaize-client/src/errors/timeout-error.ts
 *
 * This error is thrown when network requests exceed their timeout limits.
 * It provides detailed timing information for debugging performance issues.
 */

import { BlaizeError, ErrorType } from '../../../blaize-types/src/errors';

import type { TimeoutErrorContext } from '../../../blaize-types/src/errors';

/**
 * Error thrown when requests exceed timeout limits
 *
 * Automatically sets HTTP status to 0 (client-side error) and provides
 * detailed timing information for debugging timeout issues.
 *
 * @example Basic timeout:
 * ```typescript
 * const context: TimeoutErrorContext = {
 *   url: 'https://api.example.com/slow',
 *   method: 'GET',
 *   correlationId: 'client_123',
 *   timeoutMs: 5000,
 *   elapsedMs: 5100,
 *   timeoutType: 'request'
 * };
 *
 * throw new TimeoutError('Request timeout', context);
 * ```
 *
 * @example Connection timeout:
 * ```typescript
 * const context: TimeoutErrorContext = {
 *   url: 'https://unresponsive.example.com/api',
 *   method: 'POST',
 *   correlationId: 'client_456',
 *   timeoutMs: 10000,
 *   elapsedMs: 10200,
 *   timeoutType: 'connection'
 * };
 *
 * throw new TimeoutError('Connection timeout', context);
 * ```
 *
 * @example Response timeout:
 * ```typescript
 * const context: TimeoutErrorContext = {
 *   url: 'https://api.example.com/report',
 *   method: 'POST',
 *   correlationId: 'client_789',
 *   timeoutMs: 30000,
 *   elapsedMs: 30500,
 *   timeoutType: 'response'
 * };
 *
 * throw new TimeoutError('Response timeout', context);
 * ```
 */
export class TimeoutError extends BlaizeError<TimeoutErrorContext> {
  /**
   * Creates a new TimeoutError instance
   *
   * @param title - Human-readable error message
   * @param context - Timeout context with timing details
   * @param correlationId - Optional correlation ID (uses context.correlationId if not provided)
   */
  constructor(
    title: string,
    context: TimeoutErrorContext,
    correlationId: string | undefined = undefined
  ) {
    super(
      ErrorType.TIMEOUT_ERROR,
      title,
      0, // Client-side errors have no HTTP status
      correlationId ?? context.correlationId,
      context
    );
  }
}
