/**
 * Console Transport for Development
 *
 * Pretty-prints logs with colors for human-readable development output.
 * Uses Node.js built-in util.inspect for metadata formatting.
 *
 * @packageDocumentation
 */

import { inspect } from 'node:util';

import { serializeMetadata } from '../utils';

import type { BlaizeLogTransport, LogLevel, LogMetadata } from '@blaize-types/logger';

/**
 * ANSI color codes for log levels
 */
const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: '\x1b[36m', // Cyan
  info: '\x1b[32m', // Green
  warn: '\x1b[33m', // Yellow
  error: '\x1b[31m', // Red
};

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

/**
 * Console transport for development logging
 *
 * Outputs colorized, human-readable logs to the console.
 * Uses console.log/warn/error appropriately based on log level.
 *
 * Features:
 * - Colorized log levels (debug=gray, info=blue, warn=yellow, error=red)
 * - Pretty-printed metadata with util.inspect
 * - Error objects automatically serialized with stack traces
 * - Stateless - safe for concurrent logging
 *
 * @example
 * ```typescript
 * import { ConsoleTransport } from './transports';
 *
 * const transport = new ConsoleTransport();
 *
 * transport.write('info', 'User login', {
 *   userId: '123',
 *   method: 'oauth',
 *   timestamp: '2025-10-20T15:30:00Z'
 * });
 *
 * // Output:
 * // [INFO] User login
 * // {
 * //   userId: '123',
 * //   method: 'oauth',
 * //   timestamp: '2025-10-20T15:30:00Z'
 * // }
 * ```
 */
export class ConsoleTransport implements BlaizeLogTransport {
  /**
   * Write a log entry to the console
   *
   * @param level - Log level
   * @param message - Log message
   * @param meta - Structured metadata
   */
  write(level: LogLevel, message: string, meta: LogMetadata): void {
    // Serialize errors in metadata
    const serializedMeta = serializeMetadata(meta);

    // Format level with color
    const levelColor = LEVEL_COLORS[level];
    const levelText = `${levelColor}${BOLD}[${level.toUpperCase()}]${RESET}`;

    // Format message
    const formattedMessage = `${levelText} ${message}`;

    // Pretty-print metadata if present
    const hasMetadata = Object.keys(serializedMeta).length > 0;
    const metadataText = hasMetadata
      ? `\n
        ${inspect(serializedMeta, {
          colors: true,
          depth: 3,
          compact: false,
          breakLength: 80,
        })}`
      : '';

    // Use appropriate console method based on level
    switch (level) {
      case 'error':
        console.error(formattedMessage + metadataText);
        break;
      case 'warn':
        console.warn(formattedMessage + metadataText);
        break;
      case 'debug':
      case 'info':
      default:
        console.log(formattedMessage + metadataText);
        break;
    }
  }
}
