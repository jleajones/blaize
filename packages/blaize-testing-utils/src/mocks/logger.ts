/**
 * Mock Logger for Testing
 *
 * Provides a mock implementation of BlaizeLogger for testing middleware
 * and route handlers with tracking capabilities and assertion helpers.
 *
 * @packageDocumentation
 */

import type { BlaizeLogger, LogMetadata } from '@blaize-types/logger';

/**
 * Log entry for internal tracking
 */
type LogEntry = {
  level: 'info' | 'debug' | 'warn' | 'error';
  message: string;
  meta?: LogMetadata;
};

/**
 * Mock logger for testing with tracking capabilities and assertion helpers
 *
 * Tracks all log calls and child logger creations for assertion in tests.
 * All log methods are Vitest spies, so you can use assertions like:
 * - expect(logger.info).toHaveBeenCalled()
 * - expect(logger.warn).toHaveBeenCalledWith('message', { meta })
 *
 * NEW in 0.6.0: Assertion helpers reduce test boilerplate by ~70%:
 * - logger.assertInfoCalled('message', { meta })
 * - logger.assertErrorCalled('Error occurred')
 * - logger.getLogsByLevel('warn')
 * - logger.clear()
 *
 * @example
 * ```typescript
 * import { createMockLogger } from '@blaizejs/testing-utils';
 *
 * const logger = createMockLogger();
 * await middleware.execute(ctx, next, logger);
 *
 * // Old way - verbose
 * expect(logger.info).toHaveBeenCalledWith('Processing request');
 *
 * // New way - concise
 * logger.assertInfoCalled('Processing request');
 * ```
 *
 * @example Partial meta matching
 * ```typescript
 * logger.info('User created', { userId: '123', timestamp: 1234567890 });
 *
 * // Only check userId, ignore timestamp
 * logger.assertInfoCalled('User created', { userId: '123' });
 * ```
 */
export class MockLogger implements BlaizeLogger {
  /**
   * All log entries captured by this logger
   * @internal
   */
  private logs: LogEntry[] = [];

  /**
   * Child logger contexts created
   */
  public childContexts: LogMetadata[] = [];

  // Use spies for all log methods so they can be asserted with toHaveBeenCalled
  /**
   * Log a debug message
   */
  public debug = vi.fn((message: string, meta?: LogMetadata): void => {
    this.logs.push({ level: 'debug', message, meta });
  });

  /**
   * Log an info message
   */
  public info = vi.fn((message: string, meta?: LogMetadata): void => {
    this.logs.push({ level: 'info', message, meta });
  });

  /**
   * Log a warning message
   */
  public warn = vi.fn((message: string, meta?: LogMetadata): void => {
    this.logs.push({ level: 'warn', message, meta });
  });

  /**
   * Log an error message
   */
  public error = vi.fn((message: string, meta?: LogMetadata): void => {
    this.logs.push({ level: 'error', message, meta });
  });

  /**
   * Create a child logger with additional context
   *
   * Returns a new independent MockLogger instance (does not share logs)
   */
  public child = vi.fn((context: LogMetadata): BlaizeLogger => {
    this.childContexts.push(context);
    // Return fresh instance - child loggers are independent
    return createMockLogger();
  });

  /**
   * Flush any pending logs (no-op for mock)
   */
  public flush = vi.fn(async (): Promise<void> => {});

  /**
   * Assert that an info log with the given message was called
   *
   * Optionally validates metadata using partial matching (toMatchObject).
   * This means you only need to specify the fields you care about.
   *
   * @param message - The expected log message
   * @param meta - Optional metadata to validate (partial match)
   * @throws {Error} If the log was not called, with helpful error message listing actual logs
   *
   * @example
   * ```typescript
   * logger.info('User created', { userId: '123', extra: 'data' });
   *
   * // Pass - exact match
   * logger.assertInfoCalled('User created', { userId: '123', extra: 'data' });
   *
   * // Pass - partial match (only check userId)
   * logger.assertInfoCalled('User created', { userId: '123' });
   *
   * // Throw - message not found
   * logger.assertInfoCalled('Missing message'); // Error with actual logs listed
   *
   * // Throw - meta doesn't match
   * logger.assertInfoCalled('User created', { userId: '456' }); // Error
   * ```
   */
  assertInfoCalled(message: string, meta?: Record<string, unknown>): void {
    const found = this.logs.find(l => l.level === 'info' && l.message === message);

    if (!found) {
      const actualMessages = this.logs
        .filter(l => l.level === 'info')
        .map(l => l.message)
        .join(', ');

      throw new Error(
        `Expected info log "${message}" was not called.\n` +
          `Actual info logs: [${actualMessages || 'none'}]`
      );
    }

    if (meta !== undefined) {
      expect(found.meta).toMatchObject(meta);
    }
  }

  /**
   * Assert that a debug log with the given message was called
   *
   * @param message - The expected log message
   * @param meta - Optional metadata to validate (partial match)
   * @throws {Error} If the log was not called
   *
   * @example
   * ```typescript
   * logger.debug('Query executed', { duration: 42 });
   * logger.assertDebugCalled('Query executed', { duration: 42 });
   * ```
   */
  assertDebugCalled(message: string, meta?: Record<string, unknown>): void {
    const found = this.logs.find(l => l.level === 'debug' && l.message === message);

    if (!found) {
      const actualMessages = this.logs
        .filter(l => l.level === 'debug')
        .map(l => l.message)
        .join(', ');

      throw new Error(
        `Expected debug log "${message}" was not called.\n` +
          `Actual debug logs: [${actualMessages || 'none'}]`
      );
    }

    if (meta !== undefined) {
      expect(found.meta).toMatchObject(meta);
    }
  }

  /**
   * Assert that a warn log with the given message was called
   *
   * @param message - The expected log message
   * @param meta - Optional metadata to validate (partial match)
   * @throws {Error} If the log was not called
   *
   * @example
   * ```typescript
   * logger.warn('Rate limit approaching', { remaining: 10 });
   * logger.assertWarnCalled('Rate limit approaching', { remaining: 10 });
   * ```
   */
  assertWarnCalled(message: string, meta?: Record<string, unknown>): void {
    const found = this.logs.find(l => l.level === 'warn' && l.message === message);

    if (!found) {
      const actualMessages = this.logs
        .filter(l => l.level === 'warn')
        .map(l => l.message)
        .join(', ');

      throw new Error(
        `Expected warn log "${message}" was not called.\n` +
          `Actual warn logs: [${actualMessages || 'none'}]`
      );
    }

    if (meta !== undefined) {
      expect(found.meta).toMatchObject(meta);
    }
  }

  /**
   * Assert that an error log with the given message was called
   *
   * @param message - The expected log message
   * @param meta - Optional metadata to validate (partial match)
   * @throws {Error} If the log was not called
   *
   * @example
   * ```typescript
   * logger.error('Database connection failed', { error: dbError });
   * logger.assertErrorCalled('Database connection failed');
   * ```
   */
  assertErrorCalled(message: string, meta?: Record<string, unknown>): void {
    const found = this.logs.find(l => l.level === 'error' && l.message === message);

    if (!found) {
      const actualMessages = this.logs
        .filter(l => l.level === 'error')
        .map(l => l.message)
        .join(', ');

      throw new Error(
        `Expected error log "${message}" was not called.\n` +
          `Actual error logs: [${actualMessages || 'none'}]`
      );
    }

    if (meta !== undefined) {
      expect(found.meta).toMatchObject(meta);
    }
  }

  /**
   * Get all logs for a specific level
   *
   * Returns a copy of the logs array to prevent external mutation.
   *
   * @param level - The log level to filter by
   * @returns Array of log entries (message and meta)
   *
   * @example
   * ```typescript
   * logger.info('First');
   * logger.debug('Debug');
   * logger.info('Second');
   *
   * const infoLogs = logger.getLogsByLevel('info');
   * console.log(infoLogs);
   * // [
   * //   { message: 'First', meta: undefined },
   * //   { message: 'Second', meta: undefined }
   * // ]
   * ```
   */
  getLogsByLevel(level: 'info' | 'debug' | 'warn' | 'error'): Array<{
    message: string;
    meta?: LogMetadata;
  }> {
    return this.logs
      .filter(l => l.level === level)
      .map(l => ({ message: l.message, meta: l.meta }));
  }

  /**
   * Clear all tracked data and reset mock state
   *
   * Clears:
   * - All log entries
   * - Child logger contexts
   * - Vitest mock call history
   *
   * @example
   * ```typescript
   * logger.info('Test');
   * logger.clear();
   *
   * logger.getLogsByLevel('info'); // []
   * expect(logger.info).not.toHaveBeenCalled(); // ✅ Pass
   * ```
   */
  clear(): void {
    this.logs.length = 0; // Clear array
    this.childContexts.length = 0; // Clear child contexts
    vi.clearAllMocks(); // Clear vitest mock state
  }

  /**
   * Get last log entry (legacy method, kept for backwards compatibility)
   * @deprecated Use getLogsByLevel() instead
   */
  getLastLog() {
    return this.logs[this.logs.length - 1];
  }

  /**
   * Check if a log with specific message exists (legacy method)
   * @deprecated Use assertion helpers instead
   */
  hasLog(message: string, level?: string) {
    return this.logs.some(l => l.message === message && (!level || l.level === level));
  }
}

/**
 * Factory function for creating mock loggers
 *
 * @returns A new MockLogger instance with assertion helpers
 *
 * @example
 * ```typescript
 * import { createMockLogger } from '@blaizejs/testing-utils';
 *
 * const logger = createMockLogger();
 * logger.info('Test message', { userId: '123' });
 * logger.assertInfoCalled('Test message', { userId: '123' });
 * ```
 */
export function createMockLogger(): MockLogger {
  return new MockLogger();
}
