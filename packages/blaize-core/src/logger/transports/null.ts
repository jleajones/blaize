/**
 * Null Transport for Testing
 *
 * Silent transport that discards all logs. Used in tests to suppress output.
 *
 * @packageDocumentation
 */

import type { BlaizeLogTransport, LogLevel, LogMetadata } from '@blaize-types/logger';

/**
 * Null transport for testing and silent logging
 *
 * Discards all log entries without producing any output. Useful for:
 * - Unit tests that don't care about log output
 * - Benchmarks where logging overhead should be minimal
 * - Temporarily disabling logging without changing code
 *
 * Features:
 * - Zero overhead - no processing or I/O
 * - Stateless - safe for concurrent logging
 * - No output to stdout, stderr, or files
 *
 * @example In Tests
 * ```typescript
 * import { NullTransport } from './transports';
 * import { createLogger } from './Logger';
 *
 * describe('MyService', () => {
 *   const logger = createLogger({
 *     transport: new NullTransport() // Suppress logs in tests
 *   });
 *
 *   test('performs operation', () => {
 *     const service = new MyService(logger);
 *     service.doWork(); // No log output
 *   });
 * });
 * ```
 *
 * @example Temporary Disable
 * ```typescript
 * // Temporarily disable logging without changing business logic
 * const logger = createLogger({
 *   transport: new NullTransport()
 * });
 *
 * logger.info('This message is discarded');
 * logger.error('This error is discarded');
 * ```
 */
export class NullTransport implements BlaizeLogTransport {
  /**
   * Discard a log entry (no-op)
   *
   * @param _level - Log level (unused)
   * @param _message - Log message (unused)
   * @param _meta - Structured metadata (unused)
   */
  write(_level: LogLevel, _message: string, _meta: LogMetadata): void {
    // Intentional no-op - discard all logs
  }

  /**
   * Flush any buffered logs (no-op)
   *
   * Since no logs are written, there's nothing to flush.
   *
   * @returns Promise that resolves immediately
   */
  async flush(): Promise<void> {
    // Intentional no-op - nothing to flush
    return Promise.resolve();
  }
}
