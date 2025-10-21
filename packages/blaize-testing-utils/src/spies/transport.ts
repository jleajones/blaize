import type { BlaizeLogTransport, LogLevel, LogMetadata } from '../../../blaize-types/src';

/**
 * Captured log entry for test assertions
 */
export interface CapturedLog {
  level: LogLevel;
  message: string;
  meta: LogMetadata;
}

/**
 * SpyTransport - A test utility that captures all log calls for assertions
 *
 * Use this transport in tests to verify logging behavior without actual I/O.
 * Provides query methods for easy test assertions.
 *
 * @example
 * ```typescript
 * const spy = new SpyTransport();
 * const logger = createLogger({ transport: spy });
 *
 * logger.info('User login', { userId: '123' });
 *
 * const logs = spy.getLogs();
 * expect(logs).toHaveLength(1);
 * expect(logs[0].message).toBe('User login');
 * ```
 */
export class SpyTransport implements BlaizeLogTransport {
  private logs: CapturedLog[] = [];

  /**
   * Write a log entry (implements ILogTransport.write)
   */
  write(level: LogLevel, message: string, meta: LogMetadata): void {
    this.logs.push({ level, message, meta });
  }

  /**
   * Get all captured logs (returns a copy for immutability)
   */
  getLogs(): CapturedLog[] {
    return [...this.logs];
  }

  /**
   * Get logs filtered by level
   *
   * @example
   * ```typescript
   * const errorLogs = spy.getLogsByLevel('error');
   * expect(errorLogs).toHaveLength(2);
   * ```
   */
  getLogsByLevel(level: LogLevel): CapturedLog[] {
    return this.logs.filter(log => log.level === level);
  }

  /**
   * Find a log entry matching a predicate
   *
   * @example
   * ```typescript
   * const userLog = spy.findLog(log =>
   *   log.meta.userId === '123'
   * );
   * expect(userLog).toBeDefined();
   * ```
   */
  findLog(predicate: (log: CapturedLog) => boolean): CapturedLog | undefined {
    return this.logs.find(predicate);
  }

  /**
   * Find all log entries matching a predicate
   *
   * @example
   * ```typescript
   * const userLogs = spy.findLogs(log =>
   *   log.meta.userId === '123'
   * );
   * expect(userLogs).toHaveLength(3);
   * ```
   */
  findLogs(predicate: (log: CapturedLog) => boolean): CapturedLog[] {
    return this.logs.filter(predicate);
  }

  /**
   * Clear all captured logs (useful for test isolation)
   *
   * @example
   * ```typescript
   * beforeEach(() => {
   *   spy.clear();
   * });
   * ```
   */
  clear(): void {
    this.logs = [];
  }

  /**
   * Get the number of captured logs
   */
  get count(): number {
    return this.logs.length;
  }

  /**
   * Check if any logs were captured
   */
  get isEmpty(): boolean {
    return this.logs.length === 0;
  }

  /**
   * Get the most recent log entry
   */
  get lastLog(): CapturedLog | undefined {
    return this.logs[this.logs.length - 1];
  }

  /**
   * Get the first log entry
   */
  get firstLog(): CapturedLog | undefined {
    return this.logs[0];
  }
}
