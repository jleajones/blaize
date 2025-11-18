/**
 * Mock Logger for Testing
 *
 * Provides a mock implementation of BlaizeLogger for testing middleware
 * and route handlers with tracking capabilities.
 *
 * @packageDocumentation
 */

import type { BlaizeLogger, LogMetadata } from '@blaize-types/logger';

/**
 * Mock logger for testing with tracking capabilities
 *
 * Tracks all log calls and child logger creations for assertion in tests.
 * All log methods are Vitest spies, so you can use assertions like:
 * - expect(logger.info).toHaveBeenCalled()
 * - expect(logger.warn).toHaveBeenCalledWith('message', { meta })
 *
 * @example
 * ```typescript
 * import { createMockLogger } from '@blaizejs/testing-utils';
 *
 * const mockLogger = createMockLogger();
 * await middleware.execute(ctx, next, mockLogger);
 *
 * expect(mockLogger.info).toHaveBeenCalledWith('Processing request');
 * expect(mockLogger.childContexts).toContainEqual({ middleware: 'auth' });
 * ```
 */
export class MockLogger implements BlaizeLogger {
  public logs: Array<{ level: string; message: string; meta?: LogMetadata }> = [];
  public childContexts: LogMetadata[] = [];

  // Use spies for all log methods so they can be asserted with toHaveBeenCalled
  public debug = vi.fn((message: string, meta?: LogMetadata): void => {
    this.logs.push({ level: 'debug', message, meta });
  });

  public info = vi.fn((message: string, meta?: LogMetadata): void => {
    this.logs.push({ level: 'info', message, meta });
  });

  public warn = vi.fn((message: string, meta?: LogMetadata): void => {
    this.logs.push({ level: 'warn', message, meta });
  });

  public error = vi.fn((message: string, meta?: LogMetadata): void => {
    this.logs.push({ level: 'error', message, meta });
  });

  public child = vi.fn((context: LogMetadata): BlaizeLogger => {
    this.childContexts.push(context);
    const childLogger = new MockLogger();
    childLogger.logs = this.logs; // Share logs array for easier testing
    return childLogger;
  });

  public flush = vi.fn(async (): Promise<void> => {});

  /**
   * Clear all tracked data
   */
  clear(): void {
    this.logs = [];
    this.childContexts = [];
  }

  /**
   * Get logs by level
   */
  getLogsByLevel(level: string) {
    return this.logs.filter(l => l.level === level);
  }

  /**
   * Get last log entry
   */
  getLastLog() {
    return this.logs[this.logs.length - 1];
  }

  /**
   * Check if a log with specific message exists
   */
  hasLog(message: string, level?: string) {
    return this.logs.some(l => l.message === message && (!level || l.level === level));
  }
}

/**
 * Factory function for creating mock loggers
 */
export function createMockLogger(): MockLogger {
  return new MockLogger();
}
