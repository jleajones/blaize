/**
 * Logger Type Interfaces for BlaizeJS
 *
 * Comprehensive type definitions for the structured logging system.
 * Integrates with the context system via ctx.services.log and supports
 * request-scoped child loggers with automatic correlation ID propagation.
 *
 * @packageDocumentation
 * @since 0.5.0
 */

/**
 * Log levels supported by the logger system
 *
 * Levels in order of severity (lowest to highest):
 * - `debug`: Detailed diagnostic information for development
 * - `info`: General informational messages about application flow
 * - `warn`: Warning messages for potentially harmful situations
 * - `error`: Error messages for failures that don't stop the application
 *
 * @example
 * ```typescript
 * const level: LogLevel = 'info';
 * ```
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Arbitrary metadata that can be attached to log entries
 *
 * Used to add structured context to logs. Keys are strings and values
 * can be any JSON-serializable data. The logger will handle Error objects
 * specially by extracting message, stack, and name properties.
 *
 * @example
 * ```typescript
 * const meta: LogMetadata = {
 *   userId: '123',
 *   action: 'login',
 *   duration: 145,
 *   tags: ['auth', 'success']
 * };
 * ```
 */
export interface LogMetadata {
  [key: string]: unknown;
}

/**
 * Core logger interface implemented by the Logger class
 *
 * Provides structured logging with automatic metadata enrichment,
 * child logger creation for request-scoped logging, and graceful
 * shutdown support via flush().
 *
 * The logger is available in all route handlers via `ctx.services.log`
 * and automatically includes request context (correlationId, method, path).
 *
 * @example Basic Usage
 * ```typescript
 * // In route handler
 * export const GET = appRoute.get({
 *   handler: async (ctx) => {
 *     ctx.services.log.info('User requested profile', {
 *       userId: ctx.params.userId
 *     });
 *
 *     try {
 *       const user = await getUser(ctx.params.userId);
 *       return user;
 *     } catch (error) {
 *       ctx.services.log.error('Failed to fetch user', {
 *         userId: ctx.params.userId,
 *         error
 *       });
 *       throw error;
 *     }
 *   }
 * });
 * ```
 *
 * @example Child Loggers
 * ```typescript
 * // Create a child logger with additional context
 * const dbLogger = ctx.services.log.child({
 *   component: 'database',
 *   operation: 'user-lookup'
 * });
 *
 * dbLogger.debug('Executing query', { query: 'SELECT * FROM users' });
 * // Output includes: { component: 'database', operation: 'user-lookup', ... }
 * ```
 */
export interface BlaizeLogger {
  /**
   * Log a debug message
   *
   * Use for detailed diagnostic information during development.
   * These logs are typically disabled in production environments.
   *
   * @param message - The log message
   * @param meta - Optional metadata to attach
   *
   * @example
   * ```typescript
   * ctx.services.log.debug('Cache lookup', {
   *   key: 'user:123',
   *   hit: true,
   *   ttl: 3600
   * });
   * ```
   */
  debug(message: string, meta?: LogMetadata): void;

  /**
   * Log an info message
   *
   * Use for general informational messages about application flow.
   * This is the default log level for production environments.
   *
   * @param message - The log message
   * @param meta - Optional metadata to attach
   *
   * @example
   * ```typescript
   * ctx.services.log.info('User login successful', {
   *   userId: '123',
   *   method: 'oauth',
   *   provider: 'google'
   * });
   * ```
   */
  info(message: string, meta?: LogMetadata): void;

  /**
   * Log a warning message
   *
   * Use for potentially harmful situations that don't prevent
   * the application from functioning.
   *
   * @param message - The log message
   * @param meta - Optional metadata to attach
   *
   * @example
   * ```typescript
   * ctx.services.log.warn('Rate limit approaching threshold', {
   *   userId: '123',
   *   currentCount: 95,
   *   limit: 100
   * });
   * ```
   */
  warn(message: string, meta?: LogMetadata): void;

  /**
   * Log an error message
   *
   * Use for error conditions that don't stop the application.
   * The logger automatically extracts stack traces from Error objects.
   *
   * @param message - The log message
   * @param meta - Optional metadata to attach
   *
   * @example
   * ```typescript
   * ctx.services.log.error('Database query failed', {
   *   query: 'SELECT * FROM users',
   *   error: err,  // Error object - stack trace will be extracted
   *   retryCount: 3
   * });
   * ```
   */
  error(message: string, meta?: LogMetadata): void;

  /**
   * Create a child logger with inherited metadata
   *
   * Child loggers inherit all metadata from their parent and add
   * their own. This is useful for adding component-specific context
   * without polluting the parent logger.
   *
   * Child metadata overrides parent metadata for the same keys.
   *
   * @param meta - Metadata to add to all logs from this child
   * @returns A new logger instance with merged metadata
   *
   * @example Component-Scoped Logging
   * ```typescript
   * // Create a child logger for a specific component
   * const authLogger = ctx.services.log.child({
   *   component: 'auth',
   *   action: 'verify-token'
   * });
   *
   * authLogger.debug('Verifying JWT token');
   * // Output includes: { correlationId, method, path, component: 'auth', ... }
   *
   * authLogger.info('Token verified', { userId: '123' });
   * // Output includes all parent + child metadata
   * ```
   *
   * @example Nested Child Loggers
   * ```typescript
   * const dbLogger = ctx.services.log.child({ component: 'database' });
   * const queryLogger = dbLogger.child({ operation: 'select' });
   *
   * queryLogger.debug('Executing query');
   * // Output includes: { correlationId, component: 'database', operation: 'select', ... }
   * ```
   */
  child(meta: LogMetadata): BlaizeLogger;

  /**
   * Flush any buffered logs and wait for completion
   *
   * Call this during graceful shutdown to ensure all logs are written
   * before the process exits. This is especially important for transports
   * that batch writes (e.g., sending logs to external services).
   *
   * If the transport doesn't implement flush(), this is a no-op.
   *
   * @returns Promise that resolves when all logs are flushed
   *
   * @example Graceful Shutdown
   * ```typescript
   * // In server shutdown handler
   * process.on('SIGTERM', async () => {
   *   console.log('Shutting down gracefully...');
   *
   *   // Flush logs before exit
   *   await server._logger.flush();
   *
   *   await server.close();
   *   process.exit(0);
   * });
   * ```
   */
  flush(): Promise<void>;
}

/**
 * Transport adapter interface for log output destinations
 *
 * Transports are responsible for writing log entries to a destination
 * (console, file, external service, etc.). Multiple transports can be
 * used simultaneously.
 *
 * Transports must be stateless to support concurrent logging.
 *
 * @example Console Transport
 * ```typescript
 * class ConsoleTransport implements BlaizeLogTransport {
 *   write(level: LogLevel, message: string, meta: LogMetadata): void {
 *     const timestamp = new Date().toISOString();
 *     const levelUpper = level.toUpperCase();
 *     const metaStr = JSON.stringify(meta);
 *
 *     console.log(`[${timestamp}] ${levelUpper}: ${message} ${metaStr}`);
 *   }
 * }
 * ```
 *
 * @example Custom HTTP Transport
 * ```typescript
 * class HTTPTransport implements BlaizeLogTransport {
 *   constructor(private endpoint: string) {}
 *
 *   write(level: LogLevel, message: string, meta: LogMetadata): void {
 *     // Non-blocking fire-and-forget
 *     fetch(this.endpoint, {
 *       method: 'POST',
 *       headers: { 'Content-Type': 'application/json' },
 *       body: JSON.stringify({ level, message, meta, timestamp: Date.now() })
 *     }).catch(err => console.error('Failed to send log', err));
 *   }
 *
 *   async flush(): Promise<void> {
 *     // Optional: wait for pending requests
 *   }
 * }
 * ```
 */
export interface BlaizeLogTransport {
  /**
   * Write a log entry to the transport destination
   *
   * This method must be synchronous and non-blocking. For transports
   * that need to perform async I/O (network, disk), use fire-and-forget
   * pattern or internal buffering.
   *
   * @param level - The log level
   * @param message - The log message
   * @param meta - Structured metadata (already redacted)
   */
  write(level: LogLevel, message: string, meta: LogMetadata): void;

  /**
   * Flush any buffered logs (optional)
   *
   * Implement this if your transport batches writes or has pending
   * async operations. Called during graceful shutdown via logger.flush().
   *
   * @returns Promise that resolves when all logs are written
   */
  flush?(): Promise<void>;
}

/**
 * Configuration for the logger system
 *
 * Controls logging behavior including log levels, output destinations,
 * sensitive data redaction, and request lifecycle logging.
 *
 * @example Development Configuration
 * ```typescript
 * import { createServer } from 'blaizejs';
 *
 * const server = createServer({
 *   port: 3000,
 *   logging: {
 *     level: 'debug',
 *     // Uses ConsoleTransport by default in development
 *     includeTimestamp: true,
 *     requestLogging: true,
 *     requestLoggerOptions: {
 *       includeHeaders: true,
 *       includeQuery: true
 *     }
 *   }
 * });
 * ```
 *
 * @example Production Configuration
 * ```typescript
 * import { JSONTransport } from 'blaizejs';
 *
 * const server = createServer({
 *   port: 3000,
 *   logging: {
 *     level: 'info',
 *     transport: new JSONTransport(),  // Single-line JSON for log aggregators
 *     redactKeys: ['password', 'apiKey', 'secret', 'token'],
 *     includeTimestamp: true,
 *     requestLogging: true,
 *     requestLoggerOptions: {
 *       includeHeaders: true,
 *       headerWhitelist: ['content-type', 'user-agent']
 *     }
 *   }
 * });
 * ```
 */
export interface LoggerConfig {
  /**
   * Minimum log level to output
   *
   * Logs below this level are filtered out (zero overhead).
   *
   * @default 'debug' in development, 'info' in production
   *
   * @example
   * ```typescript
   * logging: {
   *   level: 'warn'  // Only log warnings and errors
   * }
   * ```
   */
  level?: LogLevel;

  /**
   * Transport adapter for log output
   *
   * Determines where and how logs are written.
   *
   * @default ConsoleTransport in development, JSONTransport in production
   *
   * @example Multiple Transports
   * ```typescript
   * import { ConsoleTransport, JSONTransport } from 'blaizejs';
   *
   * class MultiTransport implements BlaizeLogTransport {
   *   private transports = [
   *     new ConsoleTransport(),
   *     new JSONTransport()
   *   ];
   *
   *   write(level: LogLevel, message: string, meta: LogMetadata): void {
   *     this.transports.forEach(t => t.write(level, message, meta));
   *   }
   * }
   *
   * logging: {
   *   transport: new MultiTransport()
   * }
   * ```
   */
  transport?: BlaizeLogTransport;

  /**
   * Keys to redact from log metadata (case-insensitive)
   *
   * Matching keys are replaced with '[REDACTED]' in the output.
   * Redaction is shallow (only top-level keys are checked).
   *
   * @default []
   *
   * @example
   * ```typescript
   * logging: {
   *   redactKeys: ['password', 'apiKey', 'creditCard', 'ssn']
   * }
   *
   * // Usage
   * ctx.services.log.info('User created', {
   *   email: 'user@example.com',
   *   password: 'secret123'  // Will be '[REDACTED]' in output
   * });
   * ```
   */
  redactKeys?: string[];

  /**
   * Whether to include ISO 8601 timestamps in log metadata
   *
   * @default true
   *
   * @example
   * ```typescript
   * logging: {
   *   includeTimestamp: true
   * }
   *
   * // Output includes: { timestamp: '2025-10-20T15:30:45.123Z', ... }
   * ```
   */
  includeTimestamp?: boolean;

  /**
   * Enable automatic request lifecycle logging
   *
   * When enabled, logs "Request started" and "Request completed/failed"
   * messages automatically for each request. Regardless of this setting,
   * a child logger with request context is ALWAYS created and available
   * via ctx.services.log.
   *
   * @default true
   *
   * @example Disable Lifecycle Logging
   * ```typescript
   * logging: {
   *   requestLogging: false  // No automatic logs, but ctx.services.log still has request context
   * }
   *
   * // You can still manually log:
   * export const GET = appRoute.get({
   *   handler: async (ctx) => {
   *     ctx.services.log.info('Custom request log');  // Still has correlationId, method, path
   *   }
   * });
   * ```
   */
  requestLogging?: boolean;

  /**
   * Options for request logger middleware
   *
   * Controls what additional request data is included in logs.
   * These options only apply when requestLogging is true.
   *
   * @default {}
   *
   * @example
   * ```typescript
   * logging: {
   *   requestLogging: true,
   *   requestLoggerOptions: {
   *     includeHeaders: true,
   *     includeQuery: true,
   *     headerWhitelist: ['user-agent', 'content-type']
   *   }
   * }
   * ```
   */
  requestLoggerOptions?: RequestLoggerOptions;
}

/**
 * Options for request logger middleware
 *
 * Controls what request data is automatically included in log metadata
 * for the child logger created for each request.
 *
 * @example Basic Configuration
 * ```typescript
 * requestLoggerOptions: {
 *   includeHeaders: true,  // Include safe headers
 *   includeQuery: true     // Include query parameters
 * }
 * ```
 *
 * @example Custom Header Whitelist
 * ```typescript
 * requestLoggerOptions: {
 *   includeHeaders: true,
 *   headerWhitelist: [
 *     'content-type',
 *     'user-agent',
 *     'accept',
 *     'x-custom-header'
 *   ]
 * }
 * ```
 */
export interface RequestLoggerOptions {
  /**
   * Include request headers in log metadata
   *
   * Only safe headers are included by default. Sensitive headers
   * (authorization, cookie, x-api-key, proxy-authorization) are
   * ALWAYS redacted even if included in the whitelist.
   *
   * @default false
   *
   * @example
   * ```typescript
   * requestLoggerOptions: {
   *   includeHeaders: true
   * }
   *
   * // Default safe headers included:
   * // - accept
   * // - content-type
   * // - user-agent
   * // - x-correlation-id
   * ```
   */
  includeHeaders?: boolean;

  /**
   * Whitelist of header names to include (case-insensitive)
   *
   * Only used when includeHeaders is true. If not specified,
   * default safe headers are used. Sensitive headers are ALWAYS
   * redacted regardless of this whitelist.
   *
   * @default ['accept', 'content-type', 'user-agent', 'x-correlation-id']
   *
   * @example
   * ```typescript
   * requestLoggerOptions: {
   *   includeHeaders: true,
   *   headerWhitelist: [
   *     'content-type',
   *     'user-agent',
   *     'x-request-id',
   *     'x-custom-header'
   *   ]
   * }
   * ```
   */
  headerWhitelist?: string[];

  /**
   * Include query parameters in log metadata
   *
   * Query parameters are included as a `query` object in metadata.
   * Be careful with sensitive data in query strings.
   *
   * @default false
   *
   * @example
   * ```typescript
   * requestLoggerOptions: {
   *   includeQuery: true
   * }
   *
   * // Request: GET /users?page=1&limit=10
   * // Log includes: { query: { page: '1', limit: '10' }, ... }
   * ```
   */
  includeQuery?: boolean;
}
