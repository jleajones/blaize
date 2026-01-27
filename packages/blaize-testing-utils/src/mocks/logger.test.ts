/**
 * Unit tests for MockLogger with assertion helpers
 *
 * Tests all new assertion methods and helper functions to ensure
 * they reduce test boilerplate and provide helpful error messages.
 *
 * Coverage target: 90%+
 */

import { createMockLogger, MockLogger } from './logger';

describe('MockLogger', () => {
  let logger: MockLogger;

  beforeEach(() => {
    logger = createMockLogger();
  });

  describe('Basic logging functionality', () => {
    it('should track info logs', () => {
      logger.info('Test message');

      expect(logger.info).toHaveBeenCalledWith('Test message');
      const logs = logger.getLogsByLevel('info');
      expect(logs).toHaveLength(1);
      expect(logs[0]!.message).toBe('Test message');
    });

    it('should track debug logs', () => {
      logger.debug('Debug message', { key: 'value' });

      expect(logger.debug).toHaveBeenCalledWith('Debug message', { key: 'value' });
      const logs = logger.getLogsByLevel('debug');
      expect(logs).toHaveLength(1);
      expect(logs[0]!.meta).toEqual({ key: 'value' });
    });

    it('should track warn logs', () => {
      logger.warn('Warning message');

      expect(logger.warn).toHaveBeenCalledWith('Warning message');
      const logs = logger.getLogsByLevel('warn');
      expect(logs).toHaveLength(1);
    });

    it('should track error logs', () => {
      logger.error('Error message', { error: 'details' });

      expect(logger.error).toHaveBeenCalledWith('Error message', { error: 'details' });
      const logs = logger.getLogsByLevel('error');
      expect(logs).toHaveLength(1);
    });
  });

  describe('assertInfoCalled', () => {
    it('should pass when message exists', () => {
      logger.info('Test message');

      expect(() => logger.assertInfoCalled('Test message')).not.toThrow();
    });

    it('should throw when message missing', () => {
      logger.info('Different message');

      expect(() => logger.assertInfoCalled('Test message')).toThrow(
        'Expected info log "Test message" was not called'
      );
    });

    it('should validate meta with partial match', () => {
      logger.info('Message', { userId: '123', extra: 'data' });

      // Should pass with partial match
      expect(() => logger.assertInfoCalled('Message', { userId: '123' })).not.toThrow();
    });

    it('should validate meta with exact match', () => {
      logger.info('Message', { userId: '123', role: 'admin' });

      expect(() =>
        logger.assertInfoCalled('Message', { userId: '123', role: 'admin' })
      ).not.toThrow();
    });

    it('should throw when meta does not match', () => {
      logger.info('Message', { userId: '123' });

      expect(() => logger.assertInfoCalled('Message', { userId: '456' })).toThrow();
    });

    it('should show actual logs in error message', () => {
      logger.info('First');
      logger.info('Second');
      logger.info('Third');

      try {
        logger.assertInfoCalled('Missing');
        throw new Error('Should have thrown');
      } catch (error: any) {
        expect(error.message).toContain('First, Second, Third');
        expect(error.message).toContain('Expected info log "Missing" was not called');
      }
    });

    it('should show "none" when no info logs exist', () => {
      logger.debug('Debug message');

      try {
        logger.assertInfoCalled('Test');
        throw new Error('Should have thrown');
      } catch (error: any) {
        expect(error.message).toContain('Actual info logs: [none]');
      }
    });

    it('should pass when meta is undefined and not provided', () => {
      logger.info('Message');

      expect(() => logger.assertInfoCalled('Message')).not.toThrow();
    });

    it('should work with complex meta objects', () => {
      logger.info('Request', {
        method: 'POST',
        path: '/api/users',
        body: { name: 'John' },
      });

      expect(() =>
        logger.assertInfoCalled('Request', {
          method: 'POST',
          body: { name: 'John' },
        })
      ).not.toThrow();
    });
  });

  describe('assertDebugCalled', () => {
    it('should pass when debug message exists', () => {
      logger.debug('Debug info');

      expect(() => logger.assertDebugCalled('Debug info')).not.toThrow();
    });

    it('should throw when debug message missing', () => {
      logger.debug('Other debug');

      expect(() => logger.assertDebugCalled('Debug info')).toThrow(
        'Expected debug log "Debug info" was not called'
      );
    });

    it('should validate debug meta with partial match', () => {
      logger.debug('Query', { sql: 'SELECT *', duration: 42 });

      expect(() => logger.assertDebugCalled('Query', { duration: 42 })).not.toThrow();
    });

    it('should throw when debug meta does not match', () => {
      logger.debug('Query', { duration: 42 });

      expect(() => logger.assertDebugCalled('Query', { duration: 100 })).toThrow();
    });

    it('should list actual debug logs in error', () => {
      logger.debug('First debug');
      logger.debug('Second debug');

      try {
        logger.assertDebugCalled('Missing');
        throw new Error('Should have thrown');
      } catch (error: any) {
        expect(error.message).toContain('First debug, Second debug');
      }
    });
  });

  describe('assertWarnCalled', () => {
    it('should pass when warn message exists', () => {
      logger.warn('Rate limit approaching');

      expect(() => logger.assertWarnCalled('Rate limit approaching')).not.toThrow();
    });

    it('should throw when warn message missing', () => {
      logger.warn('Other warning');

      expect(() => logger.assertWarnCalled('Rate limit approaching')).toThrow(
        'Expected warn log "Rate limit approaching" was not called'
      );
    });

    it('should validate warn meta with partial match', () => {
      logger.warn('Rate limit', { remaining: 10, total: 100 });

      expect(() => logger.assertWarnCalled('Rate limit', { remaining: 10 })).not.toThrow();
    });

    it('should throw when warn meta does not match', () => {
      logger.warn('Rate limit', { remaining: 10 });

      expect(() => logger.assertWarnCalled('Rate limit', { remaining: 5 })).toThrow();
    });

    it('should list actual warn logs in error', () => {
      logger.warn('Warning one');
      logger.warn('Warning two');

      try {
        logger.assertWarnCalled('Missing warning');
        throw new Error('Should have thrown');
      } catch (error: any) {
        expect(error.message).toContain('Warning one, Warning two');
      }
    });
  });

  describe('assertErrorCalled', () => {
    it('should pass when error message exists', () => {
      logger.error('Database error');

      expect(() => logger.assertErrorCalled('Database error')).not.toThrow();
    });

    it('should throw when error message missing', () => {
      logger.error('Other error');

      expect(() => logger.assertErrorCalled('Database error')).toThrow(
        'Expected error log "Database error" was not called'
      );
    });

    it('should validate error meta with partial match', () => {
      logger.error('Connection failed', { host: 'db.example.com', port: 5432 });

      expect(() =>
        logger.assertErrorCalled('Connection failed', { host: 'db.example.com' })
      ).not.toThrow();
    });

    it('should throw when error meta does not match', () => {
      logger.error('Connection failed', { host: 'db.example.com' });

      expect(() =>
        logger.assertErrorCalled('Connection failed', { host: 'other.example.com' })
      ).toThrow();
    });

    it('should list actual error logs in error', () => {
      logger.error('Error one');
      logger.error('Error two');

      try {
        logger.assertErrorCalled('Missing error');
        throw new Error('Should have thrown');
      } catch (error: any) {
        expect(error.message).toContain('Error one, Error two');
      }
    });

    it('should handle error objects in meta', () => {
      const error = new Error('Test error');
      logger.error('Operation failed', { error });

      expect(() => logger.assertErrorCalled('Operation failed')).not.toThrow();
    });
  });

  describe('getLogsByLevel', () => {
    it('should return logs for specific level', () => {
      logger.info('Info 1');
      logger.debug('Debug 1');
      logger.info('Info 2');

      const infoLogs = logger.getLogsByLevel('info');

      expect(infoLogs).toHaveLength(2);
      expect(infoLogs[0]!.message).toBe('Info 1');
      expect(infoLogs[1]!.message).toBe('Info 2');
    });

    it('should return empty array when no logs exist', () => {
      const infoLogs = logger.getLogsByLevel('info');

      expect(infoLogs).toEqual([]);
    });

    it('should return empty array when no logs match level', () => {
      logger.info('Info message');
      logger.error('Error message');

      const warnLogs = logger.getLogsByLevel('warn');

      expect(warnLogs).toEqual([]);
    });

    it('should include meta in returned logs', () => {
      logger.info('Message', { userId: '123' });

      const logs = logger.getLogsByLevel('info');

      expect(logs[0]!.meta).toEqual({ userId: '123' });
    });

    it('should return logs for all levels independently', () => {
      logger.debug('Debug');
      logger.info('Info');
      logger.warn('Warn');
      logger.error('Error');

      expect(logger.getLogsByLevel('debug')).toHaveLength(1);
      expect(logger.getLogsByLevel('info')).toHaveLength(1);
      expect(logger.getLogsByLevel('warn')).toHaveLength(1);
      expect(logger.getLogsByLevel('error')).toHaveLength(1);
    });

    it('should not mutate original logs when returned array is modified', () => {
      logger.info('Original');

      const logs = logger.getLogsByLevel('info');
      logs.push({ message: 'Added', meta: undefined });

      const freshLogs = logger.getLogsByLevel('info');
      expect(freshLogs).toHaveLength(1);
      expect(freshLogs[0]!.message).toBe('Original');
    });
  });

  describe('clear', () => {
    it('should reset logs array', () => {
      logger.info('Message');
      logger.debug('Debug');

      logger.clear();

      const infoLogs = logger.getLogsByLevel('info');
      const debugLogs = logger.getLogsByLevel('debug');
      expect(infoLogs).toHaveLength(0);
      expect(debugLogs).toHaveLength(0);
    });

    it('should clear mock call state', () => {
      logger.info('Message');

      logger.clear();

      expect(logger.info).not.toHaveBeenCalled();
    });

    it('should clear all log levels', () => {
      logger.debug('Debug');
      logger.info('Info');
      logger.warn('Warn');
      logger.error('Error');

      logger.clear();

      expect(logger.getLogsByLevel('debug')).toHaveLength(0);
      expect(logger.getLogsByLevel('info')).toHaveLength(0);
      expect(logger.getLogsByLevel('warn')).toHaveLength(0);
      expect(logger.getLogsByLevel('error')).toHaveLength(0);
    });

    it('should clear child contexts', () => {
      logger.child({ context: 'test' });

      logger.clear();

      expect(logger.childContexts).toHaveLength(0);
    });

    it('should clear child logger instances', () => {
      logger.child({ id: '1' });
      logger.child({ id: '2' });

      expect(logger.childLoggers).toHaveLength(2);

      logger.clear();

      expect(logger.childLoggers).toHaveLength(0);
    });

    it('should clear shared logs for all children', () => {
      const child = logger.child({ id: '1' }) as MockLogger;

      logger.info('Parent log');
      child.info('Child log');

      expect(logger.logs).toHaveLength(2);
      expect(child.logs).toHaveLength(2);

      logger.clear();

      // Both parent and child should have empty logs (shared array)
      expect(logger.logs).toHaveLength(0);
      expect(child.logs).toHaveLength(0);
    });

    it('should allow logging after clear', () => {
      logger.info('First');
      logger.clear();
      logger.info('Second');

      const logs = logger.getLogsByLevel('info');
      expect(logs).toHaveLength(1);
      expect(logs[0]!.message).toBe('Second');
    });
  });

  describe('child logger', () => {
    it('should share logs with parent logger', () => {
      const parent = createMockLogger();
      const child = parent.child({ context: 'test' }) as MockLogger;

      parent.info('Parent message');
      child.info('Child message');

      // Both parent and child should see both messages (shared logs array)
      expect(() => parent.assertInfoCalled('Parent message')).not.toThrow();
      expect(() => parent.assertInfoCalled('Child message')).not.toThrow();

      // Child also sees both (same array reference)
      expect(() => child.assertInfoCalled('Parent message')).not.toThrow();
      expect(() => child.assertInfoCalled('Child message')).not.toThrow();

      // Verify same array reference
      expect(child.logs).toBe(parent.logs);
    });

    it('should track child context', () => {
      logger.child({ requestId: '123' });

      expect(logger.childContexts).toHaveLength(1);
      expect(logger.childContexts[0]).toEqual({ requestId: '123' });
    });

    it('should be a vitest spy', () => {
      logger.child({ context: 'test' });

      expect(logger.child).toHaveBeenCalledWith({ context: 'test' });
    });

    it('should share logs across all children', () => {
      const child1 = logger.child({ id: '1' }) as MockLogger;
      const child2 = logger.child({ id: '2' }) as MockLogger;

      child1.info('Child 1 message');
      child2.info('Child 2 message');

      // All loggers share the same logs array
      expect(() => child1.assertInfoCalled('Child 1 message')).not.toThrow();
      expect(() => child1.assertInfoCalled('Child 2 message')).not.toThrow();

      expect(() => child2.assertInfoCalled('Child 2 message')).not.toThrow();
      expect(() => child2.assertInfoCalled('Child 1 message')).not.toThrow();

      expect(() => logger.assertInfoCalled('Child 1 message')).not.toThrow();
      expect(() => logger.assertInfoCalled('Child 2 message')).not.toThrow();

      // Verify all share same array
      expect(child1.logs).toBe(logger.logs);
      expect(child2.logs).toBe(logger.logs);
    });
  });

  describe('getAllLogs', () => {
    it('should return all logs (same as logs property with shared logs)', () => {
      const child = logger.child({ id: '1' }) as MockLogger;

      logger.info('Parent log');
      child.debug('Child log');

      const allLogs = logger.getAllLogs();

      expect(allLogs).toHaveLength(2);
      expect(allLogs[0]!.message).toBe('Parent log');
      expect(allLogs[1]!.message).toBe('Child log');
    });

    it('should return a copy of the logs array', () => {
      logger.info('Test');

      const allLogs = logger.getAllLogs();
      allLogs.push({ level: 'info', message: 'Added', meta: undefined });

      // Original logs should not be modified
      expect(logger.logs).toHaveLength(1);
      expect(logger.getAllLogs()).toHaveLength(1);
    });

    it('should return empty array when no logs exist', () => {
      const allLogs = logger.getAllLogs();
      expect(allLogs).toEqual([]);
    });
  });

  describe('flush', () => {
    it('should be a vitest spy', async () => {
      await logger.flush();

      expect(logger.flush).toHaveBeenCalled();
    });

    it('should not throw errors', async () => {
      await expect(logger.flush()).resolves.toBeUndefined();
    });
  });

  describe('Legacy methods (backwards compatibility)', () => {
    it('should support getLastLog', () => {
      logger.info('First');
      logger.info('Second');

      const last = logger.getLastLog();
      expect(last?.message).toBe('Second');
    });

    it('should return undefined when no logs exist', () => {
      const last = logger.getLastLog();
      expect(last).toBeUndefined();
    });

    it('should support hasLog', () => {
      logger.info('Test message');

      expect(logger.hasLog('Test message')).toBe(true);
      expect(logger.hasLog('Missing')).toBe(false);
    });

    it('should support hasLog with level filter', () => {
      logger.info('Message');
      logger.debug('Message');

      expect(logger.hasLog('Message', 'info')).toBe(true);
      expect(logger.hasLog('Message', 'debug')).toBe(true);
      expect(logger.hasLog('Message', 'warn')).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty string messages', () => {
      logger.info('');

      expect(() => logger.assertInfoCalled('')).not.toThrow();
    });

    it('should handle messages with special characters', () => {
      logger.info('Message with "quotes" and \\backslashes\\');

      expect(() =>
        logger.assertInfoCalled('Message with "quotes" and \\backslashes\\')
      ).not.toThrow();
    });

    it('should handle very long messages', () => {
      const longMessage = 'x'.repeat(1000);
      logger.info(longMessage);

      expect(() => logger.assertInfoCalled(longMessage)).not.toThrow();
    });

    it('should handle meta with null values', () => {
      logger.info('Message', { value: null });

      expect(() => logger.assertInfoCalled('Message', { value: null })).not.toThrow();
    });

    it('should handle meta with undefined values', () => {
      logger.info('Message', { value: undefined });

      const logs = logger.getLogsByLevel('info');
      expect(logs[0]!.meta).toHaveProperty('value');
    });

    it('should handle meta with nested objects', () => {
      logger.info('Message', {
        user: { id: '123', profile: { name: 'John' } },
      });

      expect(() =>
        logger.assertInfoCalled('Message', {
          user: { id: '123' },
        })
      ).not.toThrow();
    });

    it('should handle meta with arrays', () => {
      logger.info('Message', { items: [1, 2, 3] });

      expect(() => logger.assertInfoCalled('Message', { items: [1, 2, 3] })).not.toThrow();
    });

    it('should handle hundreds of log calls efficiently', () => {
      for (let i = 0; i < 1000; i++) {
        logger.info(`Message ${i}`);
      }

      expect(logger.getLogsByLevel('info')).toHaveLength(1000);
      expect(() => logger.assertInfoCalled('Message 500')).not.toThrow();
    });
  });

  describe('Multiple assertions in sequence', () => {
    it('should handle multiple assertions on same logger', () => {
      logger.info('First');
      logger.debug('Second');
      logger.warn('Third');

      expect(() => logger.assertInfoCalled('First')).not.toThrow();
      expect(() => logger.assertDebugCalled('Second')).not.toThrow();
      expect(() => logger.assertWarnCalled('Third')).not.toThrow();
    });

    it('should handle assertions in any order', () => {
      logger.info('First');
      logger.info('Second');
      logger.info('Third');

      expect(() => logger.assertInfoCalled('Third')).not.toThrow();
      expect(() => logger.assertInfoCalled('First')).not.toThrow();
      expect(() => logger.assertInfoCalled('Second')).not.toThrow();
    });
  });

  describe('createMockLogger factory', () => {
    it('should create a new MockLogger instance', () => {
      const logger1 = createMockLogger();
      const logger2 = createMockLogger();

      logger1.info('Logger 1');
      logger2.info('Logger 2');

      expect(() => logger1.assertInfoCalled('Logger 1')).not.toThrow();
      expect(() => logger1.assertInfoCalled('Logger 2')).toThrow();

      expect(() => logger2.assertInfoCalled('Logger 2')).not.toThrow();
      expect(() => logger2.assertInfoCalled('Logger 1')).toThrow();
    });

    it('should create independent instances', () => {
      const logger1 = createMockLogger();
      const logger2 = createMockLogger();

      logger1.info('Test');

      expect(logger1.getLogsByLevel('info')).toHaveLength(1);
      expect(logger2.getLogsByLevel('info')).toHaveLength(0);
    });
  });
});
