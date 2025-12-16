/**
 * Unit tests for Logger class
 *
 * Tests level filtering, redaction, child loggers, timestamps,
 * immutability, and performance characteristics.
 */

import { Logger, createLogger } from './logger';

import type { BlaizeLogTransport, LogLevel, LogMetadata } from '@blaize-types/logger';

/**
 * Mock transport for testing
 */
class MockTransport implements BlaizeLogTransport {
  public logs: Array<{ level: LogLevel; message: string; meta: LogMetadata }> = [];
  public flushCalled = false;

  write(level: LogLevel, message: string, meta: LogMetadata): void {
    this.logs.push({ level, message, meta });
  }

  async flush(): Promise<void> {
    this.flushCalled = true;
  }

  clear(): void {
    this.logs = [];
    this.flushCalled = false;
  }

  getLastLog() {
    return this.logs[this.logs.length - 1];
  }

  findLog(predicate: (log: (typeof this.logs)[0]) => boolean) {
    return this.logs.find(predicate);
  }
}

describe('Logger', () => {
  let transport: MockTransport;

  beforeEach(() => {
    transport = new MockTransport();
  });

  describe('Basic logging', () => {
    test('logs debug message', () => {
      const logger = new Logger({
        level: 'debug',
        transport,
        redactKeys: [],
        includeTimestamp: false,
      });

      logger.debug('Debug message', { key: 'value' });

      expect(transport.logs).toHaveLength(1);
      expect(transport.logs[0]).toMatchObject({
        level: 'debug',
        message: 'Debug message',
        meta: { key: 'value' },
      });
    });

    test('logs info message', () => {
      const logger = new Logger({
        level: 'info',
        transport,
        redactKeys: [],
        includeTimestamp: false,
      });

      logger.info('Info message', { userId: '123' });

      expect(transport.logs).toHaveLength(1);
      expect(transport.logs[0]).toMatchObject({
        level: 'info',
        message: 'Info message',
        meta: { userId: '123' },
      });
    });

    test('logs warn message', () => {
      const logger = new Logger({
        level: 'warn',
        transport,
        redactKeys: [],
        includeTimestamp: false,
      });

      logger.warn('Warning message', { count: 95 });

      expect(transport.logs).toHaveLength(1);
      expect(transport.logs[0]).toMatchObject({
        level: 'warn',
        message: 'Warning message',
        meta: { count: 95 },
      });
    });

    test('logs error message', () => {
      const logger = new Logger({
        level: 'error',
        transport,
        redactKeys: [],
        includeTimestamp: false,
      });

      const error = new Error('Test error');
      logger.error('Error occurred', { error });

      expect(transport.logs).toHaveLength(1);
      expect(transport.logs[0]).toMatchObject({
        level: 'error',
        message: 'Error occurred',
        meta: { error },
      });
    });

    test('logs without metadata', () => {
      const logger = new Logger({
        level: 'info',
        transport,
        redactKeys: [],
        includeTimestamp: false,
      });

      logger.info('Simple message');

      expect(transport.logs).toHaveLength(1);
      expect(transport.logs[0]).toMatchObject({
        level: 'info',
        message: 'Simple message',
        meta: {},
      });
    });
  });

  describe('Level filtering', () => {
    test('filters debug logs when level is info', () => {
      const logger = new Logger({
        level: 'info',
        transport,
        redactKeys: [],
        includeTimestamp: false,
      });

      logger.debug('Should be filtered');
      logger.info('Should be logged');

      expect(transport.logs).toHaveLength(1);
      expect(transport.logs[0]!.level).toBe('info');
    });

    test('filters debug and info logs when level is warn', () => {
      const logger = new Logger({
        level: 'warn',
        transport,
        redactKeys: [],
        includeTimestamp: false,
      });

      logger.debug('Filtered');
      logger.info('Filtered');
      logger.warn('Logged');
      logger.error('Logged');

      expect(transport.logs).toHaveLength(2);
      expect(transport.logs[0]!.level).toBe('warn');
      expect(transport.logs[1]!.level).toBe('error');
    });

    test('only logs errors when level is error', () => {
      const logger = new Logger({
        level: 'error',
        transport,
        redactKeys: [],
        includeTimestamp: false,
      });

      logger.debug('Filtered');
      logger.info('Filtered');
      logger.warn('Filtered');
      logger.error('Logged');

      expect(transport.logs).toHaveLength(1);
      expect(transport.logs[0]!.level).toBe('error');
    });

    test('logs all levels when level is debug', () => {
      const logger = new Logger({
        level: 'debug',
        transport,
        redactKeys: [],
        includeTimestamp: false,
      });

      logger.debug('Debug');
      logger.info('Info');
      logger.warn('Warn');
      logger.error('Error');

      expect(transport.logs).toHaveLength(4);
      expect(transport.logs.map(l => l.level)).toEqual(['debug', 'info', 'warn', 'error']);
    });

    test('zero-overhead filtering - no processing for filtered logs', () => {
      const logger = new Logger({
        level: 'error',
        transport,
        redactKeys: ['password'], // Redaction should not run for filtered logs
        includeTimestamp: true,
      });

      // This should return immediately without any processing
      logger.debug('Expensive operation', { password: 'secret', nested: { deep: 'value' } });

      expect(transport.logs).toHaveLength(0);
    });
  });

  describe('Redaction', () => {
    test('redacts configured keys', () => {
      const logger = new Logger({
        level: 'info',
        transport,
        redactKeys: ['password', 'apiKey'],
        includeTimestamp: false,
      });

      logger.info('User login', {
        username: 'alice',
        password: 'secret123',
        apiKey: 'key-abc',
        email: 'alice@example.com',
      });

      const log = transport.getLastLog()!;
      expect(log.meta).toEqual({
        username: 'alice',
        password: '[REDACTED]',
        apiKey: '[REDACTED]',
        email: 'alice@example.com',
      });
    });

    test('redaction is case-insensitive', () => {
      const logger = new Logger({
        level: 'info',
        transport,
        redactKeys: ['password', 'apikey'], // lowercase
        includeTimestamp: false,
      });

      logger.info('Test', {
        PASSWORD: 'secret', // uppercase
        ApiKey: 'key', // mixed case
        Password: 'secret2', // title case
      });

      const log = transport.getLastLog()!;
      expect(log.meta).toEqual({
        PASSWORD: '[REDACTED]',
        ApiKey: '[REDACTED]',
        Password: '[REDACTED]',
      });
    });

    test('redaction is shallow only', () => {
      const logger = new Logger({
        level: 'info',
        transport,
        redactKeys: ['password'],
        includeTimestamp: false,
      });

      logger.info('Test', {
        password: 'secret', // Top-level - should be redacted
        user: {
          password: 'nested-secret', // Nested - should NOT be redacted
        },
      });

      const log = transport.getLastLog()!;
      expect(log.meta).toEqual({
        password: '[REDACTED]',
        user: {
          password: 'nested-secret', // Not redacted (shallow only)
        },
      });
    });

    test('handles empty redactKeys array', () => {
      const logger = new Logger({
        level: 'info',
        transport,
        redactKeys: [],
        includeTimestamp: false,
      });

      logger.info('Test', { password: 'secret', apiKey: 'key' });

      const log = transport.getLastLog()!;
      expect(log.meta).toEqual({
        password: 'secret', // Not redacted
        apiKey: 'key', // Not redacted
      });
    });

    test('handles null and undefined values', () => {
      const logger = new Logger({
        level: 'info',
        transport,
        redactKeys: ['nullKey', 'undefinedKey'],
        includeTimestamp: false,
      });

      logger.info('Test', {
        nullKey: null,
        undefinedKey: undefined,
        normalKey: 'value',
      });

      const log = transport.getLastLog()!;
      expect(log.meta).toEqual({
        nullKey: '[REDACTED]',
        undefinedKey: '[REDACTED]',
        normalKey: 'value',
      });
    });
  });

  describe('Child loggers', () => {
    test('creates child logger with merged metadata', () => {
      const parent = new Logger({
        level: 'info',
        transport,
        redactKeys: [],
        includeTimestamp: false,
      });

      const child = parent.child({ component: 'auth' });
      child.info('Token verified', { userId: '123' });

      const log = transport.getLastLog()!;
      expect(log.meta).toEqual({
        component: 'auth',
        userId: '123',
      });
    });

    test('child metadata overrides parent metadata', () => {
      const parent = new Logger(
        {
          level: 'info',
          transport,
          redactKeys: [],
          includeTimestamp: false,
        },
        { component: 'parent', env: 'dev' }
      );

      const child = parent.child({ component: 'child', feature: 'auth' });
      child.info('Test');

      const log = transport.getLastLog()!;
      expect(log.meta).toEqual({
        component: 'child', // Overridden
        env: 'dev', // Inherited
        feature: 'auth', // Added
      });
    });

    test('nested child loggers merge metadata correctly', () => {
      const parent = new Logger(
        {
          level: 'info',
          transport,
          redactKeys: [],
          includeTimestamp: false,
        },
        { level1: 'parent' }
      );

      const child = parent.child({ level2: 'child' });
      const grandchild = child.child({ level3: 'grandchild' });

      grandchild.info('Test');

      const log = transport.getLastLog()!;
      expect(log.meta).toEqual({
        level1: 'parent',
        level2: 'child',
        level3: 'grandchild',
      });
    });

    test('call-site metadata overrides inherited metadata', () => {
      const logger = new Logger(
        {
          level: 'info',
          transport,
          redactKeys: [],
          includeTimestamp: false,
        },
        { userId: 'inherited', action: 'default' }
      );

      logger.info('Test', { userId: 'override', extra: 'data' });

      const log = transport.getLastLog()!;
      expect(log.meta).toEqual({
        userId: 'override', // Overridden
        action: 'default', // Inherited
        extra: 'data', // Added
      });
    });

    test('inherited metadata is immutable', () => {
      const parent = new Logger(
        {
          level: 'info',
          transport,
          redactKeys: [],
          includeTimestamp: false,
        },
        { immutable: 'value' }
      );

      const child = parent.child({ newKey: 'newValue' });

      // Attempt to modify inherited metadata (should be frozen)
      expect(() => {
        // Access inherited metadata via a public method or property
        // For example, if Logger has a getInheritedMeta() method:
        (child as any).meta.immutable = 'modified';
      }).toThrow();
    });
  });

  describe('Timestamp support', () => {
    test('adds timestamp when includeTimestamp is true', () => {
      const logger = new Logger({
        level: 'info',
        transport,
        redactKeys: [],
        includeTimestamp: true,
      });

      const before = Date.now();
      logger.info('Test', { userId: '123' });
      const after = Date.now();

      const log = transport.getLastLog()!;
      expect(log.meta).toHaveProperty('timestamp');
      expect(typeof log.meta.timestamp).toBe('string');

      // Verify timestamp is ISO 8601 format
      const timestamp = new Date(log.meta.timestamp as string).getTime();
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);

      // Verify other metadata is preserved
      expect(log.meta.userId).toBe('123');
    });

    test('does not add timestamp when includeTimestamp is false', () => {
      const logger = new Logger({
        level: 'info',
        transport,
        redactKeys: [],
        includeTimestamp: false,
      });

      logger.info('Test', { userId: '123' });

      const log = transport.getLastLog()!;
      expect(log.meta).not.toHaveProperty('timestamp');
      expect(log.meta).toEqual({ userId: '123' });
    });

    test('timestamp is added before redaction', () => {
      const logger = new Logger({
        level: 'info',
        transport,
        redactKeys: ['password'],
        includeTimestamp: true,
      });

      logger.info('Test', { password: 'secret' });

      const log = transport.getLastLog()!;
      expect(log.meta).toHaveProperty('timestamp');
      expect(log.meta.password).toBe('[REDACTED]');
    });
  });

  describe('flush() method', () => {
    test('calls transport flush when available', async () => {
      const logger = new Logger({
        level: 'info',
        transport,
        redactKeys: [],
        includeTimestamp: false,
      });

      await logger.flush();

      expect(transport.flushCalled).toBe(true);
    });

    test('handles transport without flush method', async () => {
      const noFlushTransport: BlaizeLogTransport = {
        write: vi.fn(),
        // No flush method
      };

      const logger = new Logger({
        level: 'info',
        transport: noFlushTransport,
        redactKeys: [],
        includeTimestamp: false,
      });

      // Should not throw
      await expect(logger.flush()).resolves.toBeUndefined();
    });
  });

  describe('createLogger() factory', () => {
    test('uses debug level in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const logger = createLogger({
        transport, // Provide transport explicitly
      });

      logger.debug('Test');
      expect(transport.logs).toHaveLength(1);

      process.env.NODE_ENV = originalEnv;
    });

    test('uses info level in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const logger = createLogger({
        transport, // Provide transport explicitly
      });

      logger.debug('Should be filtered');
      logger.info('Should be logged');

      expect(transport.logs).toHaveLength(1);
      expect(transport.logs[0]!.level).toBe('info');

      process.env.NODE_ENV = originalEnv;
    });

    test('respects provided level override', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const logger = createLogger({
        level: 'debug',
        transport,
      });

      logger.debug('Should be logged');
      expect(transport.logs).toHaveLength(1);

      process.env.NODE_ENV = originalEnv;
    });

    test('includes timestamp by default', () => {
      const logger = createLogger({
        transport,
      });

      logger.info('Test');
      expect(transport.logs[0]!.meta).toHaveProperty('timestamp');
    });

    test('respects includeTimestamp override', () => {
      const logger = createLogger({
        transport,
        includeTimestamp: false,
      });

      logger.info('Test');
      expect(transport.logs[0]!.meta).not.toHaveProperty('timestamp');
    });

    test('applies redactKeys', () => {
      const logger = createLogger({
        transport,
        redactKeys: ['password', 'secret'],
      });

      logger.info('Test', { password: 'abc', secret: 'xyz' });

      const log = transport.getLastLog()!;
      expect(log.meta.password).toBe('[REDACTED]');
      expect(log.meta.secret).toBe('[REDACTED]');
    });

    test('uses provided transport when given', () => {
      const customTransport = new MockTransport();

      const logger = createLogger({
        transport: customTransport,
      });

      logger.info('Test');

      // Should use custom transport, not default
      expect(customTransport.logs).toHaveLength(1);
      expect(transport.logs).toHaveLength(0);
    });

    test('creates logger with minimal config', () => {
      // Should not throw when only transport is provided
      expect(() => createLogger({ transport })).not.toThrow();
    });

    test('creates logger with full config', () => {
      const logger = createLogger({
        level: 'warn',
        transport,
        redactKeys: ['password', 'apiKey'],
        includeTimestamp: true,
      });

      logger.warn('Test', { password: 'secret', userId: '123' });

      expect(transport.logs).toHaveLength(1);
      expect(transport.logs[0]!.meta.password).toBe('[REDACTED]');
      expect(transport.logs[0]!.meta.userId).toBe('123');
      expect(transport.logs[0]!.meta).toHaveProperty('timestamp');
    });
  });
});
