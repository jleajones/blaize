import { createLogger, Logger } from './logger';
import { ConsoleTransport } from './transports/console';

import type { BlaizeLogger, LoggerConfig } from '@blaize-types/index';

// ==========================================
// GLOBAL LOGGER INSTANCE
// ==========================================

/**
 * Global logger singleton instance
 *
 * This instance is available before server creation and can be used
 * anywhere in your application. When the server starts, it will be
 * configured with the server's logging options.
 *
 * @example
 * ```typescript
 * import { logger } from '@blaizejs/logger';
 *
 * logger.info('Application starting');
 * ```
 */
export const logger: BlaizeLogger = createLogger({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  transport: new ConsoleTransport(),
  includeTimestamp: true,
  redactKeys: [],
});

// Keep internal reference for update
let _globalLoggerInstance = logger as Logger;

/**
 * Configure the global logger instance
 *
 * This function updates the global logger in-place so that all existing
 * imports automatically receive the new configuration. Called internally
 * by the server during creation.
 *
 * @param config - Partial logger configuration
 *
 * @example
 * ```typescript
 * import { configureGlobalLogger } from '@blaizejs/logger';
 *
 * configureGlobalLogger({
 *   level: 'warn',
 *   redactKeys: ['password', 'apiKey']
 * });
 * ```
 */
export function configureGlobalLogger(config: Partial<LoggerConfig>): void {
  // Create new logger with config
  const newLogger = createLogger(config);

  // Update internal reference
  _globalLoggerInstance = newLogger;

  // Update the exported logger object in-place
  // This ensures all existing imports get the new config
  Object.assign(logger, newLogger);
}

/**
 * Get a reference to the current global logger instance
 *
 * @internal - For testing purposes only
 */
export function _getGlobalLogger(): Logger {
  return _globalLoggerInstance;
}

export { ConsoleTransport } from './transports/console';
export { JSONTransport } from './transports/json';
export { NullTransport } from './transports/null';

export { createLogger, Logger } from './logger';
