/**
 * Core Logger Implementation
 *
 * Production-ready structured logger with level filtering, metadata redaction,
 * child loggers, and zero-overhead filtering for disabled log levels.
 *
 * @packageDocumentation
 */

import { ConsoleTransport } from './transports/console';
import { JSONTransport } from './transports/json';

import type {
  BlaizeLogger,
  BlaizeLogTransport,
  LogLevel,
  LogMetadata,
  ResolvedLoggerConfig,
} from '@blaize-types/logger';

/**
 * Log level priority values for filtering
 * Higher number = higher priority
 */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Core Logger class implementing ILogger interface
 *
 * Thread-safe via immutable inherited metadata. Supports zero-overhead
 * filtering - logs below the configured level return immediately with
 * no processing overhead.
 *
 * @example Basic Usage
 * ```typescript
 * const logger = new Logger({
 *   level: 'info',
 *   transport: new ConsoleTransport(),
 *   redactKeys: ['password', 'apiKey'],
 *   includeTimestamp: true
 * });
 *
 * logger.info('User login', { userId: '123', method: 'oauth' });
 * ```
 *
 * @example Child Logger
 * ```typescript
 * const parentLogger = createLogger({ level: 'info' });
 * const childLogger = parentLogger.child({ component: 'auth' });
 *
 * childLogger.info('Token verified');
 * // Output includes inherited metadata: { component: 'auth', ... }
 * ```
 */
export class Logger implements BlaizeLogger {
  private readonly config: ResolvedLoggerConfig;
  private readonly inheritedMeta: Readonly<LogMetadata>;
  private readonly minLevelPriority: number;

  /**
   * Create a new Logger instance
   *
   * @param config - Resolved logger configuration
   * @param inheritedMeta - Metadata inherited from parent logger (optional)
   */
  constructor(config: ResolvedLoggerConfig, inheritedMeta?: LogMetadata) {
    this.config = config;

    // Freeze inherited metadata for immutability (thread-safety)
    this.inheritedMeta = inheritedMeta ? Object.freeze({ ...inheritedMeta }) : Object.freeze({});

    // Cache min level priority for fast filtering
    this.minLevelPriority = LOG_LEVEL_PRIORITY[config.level];
  }

  /**
   * Log a debug message
   *
   * @param message - The log message
   * @param meta - Optional metadata to attach
   */
  debug(message: string, meta?: LogMetadata): void {
    this.log('debug', message, meta);
  }

  /**
   * Log an info message
   *
   * @param message - The log message
   * @param meta - Optional metadata to attach
   */
  info(message: string, meta?: LogMetadata): void {
    this.log('info', message, meta);
  }

  /**
   * Log a warning message
   *
   * @param message - The log message
   * @param meta - Optional metadata to attach
   */
  warn(message: string, meta?: LogMetadata): void {
    this.log('warn', message, meta);
  }

  /**
   * Log an error message
   *
   * @param message - The log message
   * @param meta - Optional metadata to attach
   */
  error(message: string, meta?: LogMetadata): void {
    this.log('error', message, meta);
  }

  /**
   * Create a child logger with additional metadata
   *
   * Child loggers inherit all parent metadata and add their own.
   * Child metadata overrides parent metadata for the same keys.
   *
   * @param meta - Additional metadata for the child logger
   * @returns A new logger instance with merged metadata
   *
   * @example
   * ```typescript
   * const parent = createLogger({ level: 'info' });
   * const child = parent.child({ component: 'database' });
   *
   * child.info('Query executed');
   * // Output includes: { component: 'database', ...parent metadata }
   * ```
   */
  child(meta: LogMetadata): BlaizeLogger {
    // Merge parent and child metadata (child overrides parent)
    const mergedMeta: LogMetadata = {
      ...this.inheritedMeta,
      ...meta,
    };

    // Create new logger instance with merged metadata
    return new Logger(this.config, mergedMeta);
  }

  /**
   * Flush any buffered logs and wait for completion
   *
   * Delegates to the transport's flush method if it exists.
   * Use this during graceful shutdown to ensure all logs are written.
   *
   * @returns Promise that resolves when all logs are flushed
   *
   * @example
   * ```typescript
   * process.on('SIGTERM', async () => {
   *   await logger.flush();
   *   process.exit(0);
   * });
   * ```
   */
  async flush(): Promise<void> {
    await this.config.transport.flush?.();
  }

  /**
   * Internal log method that handles all log levels
   *
   * Fast-path: Returns immediately if log level is filtered.
   * This ensures zero overhead for disabled log levels.
   *
   * @param level - The log level
   * @param message - The log message
   * @param meta - Optional metadata to attach
   */
  private log(level: LogLevel, message: string, meta?: LogMetadata): void {
    // Fast-path: Check level filter first (zero overhead for filtered logs)
    if (!this.shouldLog(level)) {
      return;
    }

    // Merge inherited metadata with call-site metadata
    // Call-site metadata overrides inherited metadata
    const mergedMeta: LogMetadata = {
      ...this.inheritedMeta,
      ...(meta || {}),
    };

    // Add timestamp if configured
    let finalMeta = mergedMeta;
    if (this.config.includeTimestamp) {
      finalMeta = {
        timestamp: new Date().toISOString(),
        ...mergedMeta,
      };
    }

    // Redact sensitive keys
    const redactedMeta = this.redact(finalMeta);

    // Write to transport (synchronous, non-blocking)
    this.config.transport.write(level, message, redactedMeta);
  }

  /**
   * Check if a log level should be output
   *
   * @param level - The log level to check
   * @returns true if the level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= this.minLevelPriority;
  }

  /**
   * Redact sensitive keys from metadata
   *
   * Performs case-insensitive shallow redaction. Only top-level keys
   * are checked and redacted - nested objects are not traversed.
   *
   * Matching keys are replaced with the string '[REDACTED]'.
   *
   * @param meta - The metadata to redact
   * @returns New metadata object with sensitive values redacted
   */
  private redact(meta: LogMetadata): LogMetadata {
    // Fast-path: No redaction keys configured
    if (this.config.redactKeys.length === 0) {
      return meta;
    }

    // Create lowercase lookup set for case-insensitive matching
    const redactKeysLower = new Set(this.config.redactKeys.map(key => key.toLowerCase()));

    // Shallow redaction - only check top-level keys
    const redacted: LogMetadata = {};
    for (const [key, value] of Object.entries(meta)) {
      if (redactKeysLower.has(key.toLowerCase())) {
        redacted[key] = '[REDACTED]';
      } else {
        redacted[key] = value;
      }
    }

    return redacted;
  }
}

/**
 * Get default transport based on environment
 *
 * Lazy-loads transports to avoid circular dependencies and unnecessary imports.
 *
 * @returns Default transport instance for current environment
 * @internal
 */
function getDefaultTransport(): BlaizeLogTransport {
  const isDevelopment = process.env.NODE_ENV !== 'production';

  if (isDevelopment) {
    // Development: ConsoleTransport with colors
    return new ConsoleTransport();
  } else {
    // Production: JSONTransport for log aggregators
    return new JSONTransport();
  }
}

/**
 * Create a logger with default configuration
 *
 * Resolves defaults based on environment:
 * - Development: debug level, ConsoleTransport
 * - Production: info level, JSONTransport
 *
 * Core transports (ConsoleTransport, JSONTransport) are lazy-loaded by
 * the logger itself. Custom transports should be provided by application code.
 *
 * @param config - Partial logger configuration (all fields optional)
 * @returns A new Logger instance
 *
 * @example Development Logger (Default)
 * ```typescript
 * const logger = createLogger();
 * // Uses: level='debug', ConsoleTransport, timestamp=true, no redaction
 *
 * logger.debug('Starting application');
 * ```
 *
 * @example Production Logger (Default)
 * ```typescript
 * process.env.NODE_ENV = 'production';
 *
 * const logger = createLogger({
 *   redactKeys: ['password', 'apiKey', 'secret']
 * });
 * // Uses: level='info', JSONTransport, timestamp=true, redaction enabled
 * ```
 *
 * @example Custom Transport (Application Code)
 * ```typescript
 * import { CustomTransport } from './my-transports';
 *
 * const logger = createLogger({
 *   level: 'warn',
 *   transport: new CustomTransport(), // Application provides custom transport
 *   redactKeys: ['ssn', 'creditCard'],
 *   includeTimestamp: false
 * });
 * ```
 */
export function createLogger(config?: Partial<ResolvedLoggerConfig>): Logger {
  const isDevelopment = process.env.NODE_ENV !== 'production';

  // Resolve defaults
  // Core transports are lazy-loaded by getDefaultTransport()
  // Custom transports must be provided by application code
  const resolvedConfig: ResolvedLoggerConfig = {
    level: config?.level ?? (isDevelopment ? 'debug' : 'info'),
    transport: config?.transport ?? getDefaultTransport(),
    redactKeys: config?.redactKeys ?? [],
    includeTimestamp: config?.includeTimestamp ?? true,
  };

  return new Logger(resolvedConfig);
}
