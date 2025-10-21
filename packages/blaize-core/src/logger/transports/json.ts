/**
 * JSON Transport for Production
 *
 * Outputs single-line JSON logs for log aggregators and monitoring systems.
 * Handles circular references and serializes Error objects.
 *
 * @packageDocumentation
 */

import { serializeMetadata, createCircularReplacer } from '../utils';

import type { BlaizeLogTransport, LogLevel, LogMetadata } from '@blaize-types/logger';

/**
 * JSON log entry structure
 */
interface JSONLogEntry {
  level: LogLevel;
  message: string;
  [key: string]: unknown;
}

/**
 * JSON transport for production logging
 *
 * Outputs single-line JSON to stdout for log aggregators (CloudWatch,
 * Datadog, Splunk, etc.). Handles circular references safely and
 * serializes Error objects with stack traces.
 *
 * Features:
 * - Single-line JSON output (no pretty-printing)
 * - Circular reference handling via replacer function
 * - Error objects serialized with message, name, and stack
 * - Stateless - safe for concurrent logging
 * - All metadata flattened into top-level JSON object
 *
 * @example
 * ```typescript
 * import { JSONTransport } from './transports';
 *
 * const transport = new JSONTransport();
 *
 * transport.write('info', 'User login', {
 *   userId: '123',
 *   method: 'oauth',
 *   timestamp: '2025-10-20T15:30:00Z',
 *   correlationId: 'req_abc123'
 * });
 *
 * // Output (single line):
 * // {"level":"info","message":"User login","userId":"123","method":"oauth","timestamp":"2025-10-20T15:30:00Z","correlationId":"req_abc123"}
 * ```
 *
 * @example With Error Object
 * ```typescript
 * const error = new Error('Database connection failed');
 *
 * transport.write('error', 'Operation failed', {
 *   error,
 *   retryCount: 3
 * });
 *
 * // Output:
 * // {"level":"error","message":"Operation failed","error":{"message":"Database connection failed","name":"Error","stack":"Error: Database..."},"retryCount":3}
 * ```
 */
export class JSONTransport implements BlaizeLogTransport {
  /**
   * Write a log entry as single-line JSON to stdout
   *
   * @param level - Log level
   * @param message - Log message
   * @param meta - Structured metadata
   */
  write(level: LogLevel, message: string, meta: LogMetadata): void {
    // Serialize errors in metadata
    const serializedMeta = serializeMetadata(meta);

    // Create log entry with flattened structure
    // Level and message are top-level fields, metadata is spread
    const logEntry: JSONLogEntry = {
      level,
      message,
      ...serializedMeta,
    };

    // Stringify with circular reference handling
    // No indentation - single line for log aggregators
    const json = JSON.stringify(logEntry, createCircularReplacer());

    // Write to stdout (console.log adds newline automatically)
    console.log(json);
  }

  /**
   * Flush any buffered logs (optional)
   *
   * Currently a no-op since we write directly to stdout.
   * Can be implemented for batching in the future if needed.
   *
   * @returns Promise that resolves immediately
   */
  async flush(): Promise<void> {
    // No buffering currently, so nothing to flush
    // This method exists to satisfy the ILogTransport interface
    // and allow for future batching implementations
    return Promise.resolve();
  }
}
