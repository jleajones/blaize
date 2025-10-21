import { SpyTransport } from './transport';

import type { LogLevel } from '../../../blaize-types/src';

describe('SpyTransport', () => {
  let spy: SpyTransport;

  beforeEach(() => {
    spy = new SpyTransport();
  });

  describe('write', () => {
    it('should capture log entries', () => {
      spy.write('info', 'Test message', { userId: '123' });

      expect(spy.count).toBe(1);
      const logs = spy.getLogs();
      expect(logs[0]).toEqual({
        level: 'info',
        message: 'Test message',
        meta: { userId: '123' },
      });
    });

    it('should capture multiple log entries', () => {
      spy.write('info', 'Message 1', { id: 1 });
      spy.write('error', 'Message 2', { id: 2 });
      spy.write('debug', 'Message 3', { id: 3 });

      expect(spy.count).toBe(3);
    });

    it('should capture logs with different levels', () => {
      const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];

      levels.forEach((level, index) => {
        spy.write(level, `Message ${index}`, { index });
      });

      expect(spy.count).toBe(4);
      const logs = spy.getLogs();
      expect(logs.map(l => l.level)).toEqual(levels);
    });

    it('should capture logs with empty metadata', () => {
      spy.write('info', 'No metadata', {});

      expect(spy.count).toBe(1);
      expect(spy.firstLog?.meta).toEqual({});
    });

    it('should capture logs with complex metadata', () => {
      const complexMeta = {
        user: { id: '123', name: 'John' },
        request: { method: 'GET', path: '/api/users' },
        nested: { deep: { value: 42 } },
      };

      spy.write('info', 'Complex', complexMeta);

      expect(spy.firstLog?.meta).toEqual(complexMeta);
    });
  });

  describe('getLogs', () => {
    it('should return empty array when no logs captured', () => {
      expect(spy.getLogs()).toEqual([]);
    });

    it('should return all captured logs', () => {
      spy.write('info', 'Log 1', {});
      spy.write('error', 'Log 2', {});

      const logs = spy.getLogs();
      expect(logs).toHaveLength(2);
      expect(logs[0]!.message).toBe('Log 1');
      expect(logs[1]!.message).toBe('Log 2');
    });

    it('should return a copy of logs (immutable)', () => {
      spy.write('info', 'Original', {});

      const logs1 = spy.getLogs();
      const logs2 = spy.getLogs();

      // Should be different array instances
      expect(logs1).not.toBe(logs2);

      // Modifying returned array should not affect internal state
      logs1.push({ level: 'error', message: 'Fake', meta: {} });

      expect(spy.count).toBe(1); // Still only 1 log
      expect(spy.getLogs()).toHaveLength(1);
    });
  });

  describe('getLogsByLevel', () => {
    beforeEach(() => {
      spy.write('info', 'Info 1', {});
      spy.write('error', 'Error 1', {});
      spy.write('info', 'Info 2', {});
      spy.write('debug', 'Debug 1', {});
      spy.write('error', 'Error 2', {});
    });

    it('should filter logs by level', () => {
      const infoLogs = spy.getLogsByLevel('info');
      expect(infoLogs).toHaveLength(2);
      expect(infoLogs.every(log => log.level === 'info')).toBe(true);
    });

    it('should return empty array for level with no logs', () => {
      const warnLogs = spy.getLogsByLevel('warn');
      expect(warnLogs).toEqual([]);
    });

    it('should return all logs for a single level', () => {
      const errorLogs = spy.getLogsByLevel('error');
      expect(errorLogs).toHaveLength(2);
      expect(errorLogs[0]!.message).toBe('Error 1');
      expect(errorLogs[1]!.message).toBe('Error 2');
    });

    it('should return copy of filtered logs', () => {
      const infoLogs1 = spy.getLogsByLevel('info');
      const infoLogs2 = spy.getLogsByLevel('info');

      expect(infoLogs1).not.toBe(infoLogs2);
    });
  });

  describe('findLog', () => {
    beforeEach(() => {
      spy.write('info', 'User login', { userId: '123', action: 'login' });
      spy.write('error', 'Failed login', { userId: '456', action: 'login' });
      spy.write('info', 'User logout', { userId: '123', action: 'logout' });
    });

    it('should find log by predicate', () => {
      const log = spy.findLog(l => l.meta.userId === '123' && l.meta.action === 'login');

      expect(log).toBeDefined();
      expect(log?.message).toBe('User login');
    });

    it('should return undefined if no log matches', () => {
      const log = spy.findLog(l => l.meta.userId === '999');

      expect(log).toBeUndefined();
    });

    it('should find log by message', () => {
      const log = spy.findLog(l => l.message.includes('Failed'));

      expect(log).toBeDefined();
      expect(log?.level).toBe('error');
    });

    it('should find log by level', () => {
      const log = spy.findLog(l => l.level === 'error');

      expect(log).toBeDefined();
      expect(log?.message).toBe('Failed login');
    });

    it('should return first matching log', () => {
      const log = spy.findLog(l => l.meta.userId === '123');

      // Should return first match (login, not logout)
      expect(log?.meta.action).toBe('login');
    });
  });

  describe('findLogs', () => {
    beforeEach(() => {
      spy.write('info', 'User 123 login', { userId: '123' });
      spy.write('info', 'User 456 login', { userId: '456' });
      spy.write('info', 'User 123 logout', { userId: '123' });
    });

    it('should find all logs matching predicate', () => {
      const logs = spy.findLogs(l => l.meta.userId === '123');

      expect(logs).toHaveLength(2);
      expect(logs[0]!.message).toContain('login');
      expect(logs[1]!.message).toContain('logout');
    });

    it('should return empty array if no logs match', () => {
      const logs = spy.findLogs(l => l.meta.userId === '999');

      expect(logs).toEqual([]);
    });

    it('should find logs by message pattern', () => {
      const logs = spy.findLogs(l => l.message.includes('login'));

      expect(logs).toHaveLength(2);
    });
  });

  describe('clear', () => {
    it('should clear all captured logs', () => {
      spy.write('info', 'Log 1', {});
      spy.write('error', 'Log 2', {});

      expect(spy.count).toBe(2);

      spy.clear();

      expect(spy.count).toBe(0);
      expect(spy.getLogs()).toEqual([]);
      expect(spy.isEmpty).toBe(true);
    });

    it('should allow new logs after clear', () => {
      spy.write('info', 'Before clear', {});
      spy.clear();
      spy.write('info', 'After clear', {});

      expect(spy.count).toBe(1);
      expect(spy.firstLog?.message).toBe('After clear');
    });

    it('should isolate tests', () => {
      // Test 1
      spy.write('info', 'Test 1', {});
      expect(spy.count).toBe(1);

      // Clear between tests
      spy.clear();

      // Test 2
      spy.write('error', 'Test 2', {});
      expect(spy.count).toBe(1);
      expect(spy.firstLog?.level).toBe('error');
    });
  });

  describe('count', () => {
    it('should return 0 for empty spy', () => {
      expect(spy.count).toBe(0);
    });

    it('should return number of captured logs', () => {
      spy.write('info', 'Log 1', {});
      expect(spy.count).toBe(1);

      spy.write('error', 'Log 2', {});
      expect(spy.count).toBe(2);

      spy.write('debug', 'Log 3', {});
      expect(spy.count).toBe(3);
    });

    it('should update after clear', () => {
      spy.write('info', 'Log', {});
      expect(spy.count).toBe(1);

      spy.clear();
      expect(spy.count).toBe(0);
    });
  });

  describe('isEmpty', () => {
    it('should return true for empty spy', () => {
      expect(spy.isEmpty).toBe(true);
    });

    it('should return false when logs are captured', () => {
      spy.write('info', 'Log', {});
      expect(spy.isEmpty).toBe(false);
    });

    it('should return true after clear', () => {
      spy.write('info', 'Log', {});
      spy.clear();
      expect(spy.isEmpty).toBe(true);
    });
  });

  describe('lastLog', () => {
    it('should return undefined for empty spy', () => {
      expect(spy.lastLog).toBeUndefined();
    });

    it('should return last captured log', () => {
      spy.write('info', 'First', {});
      spy.write('error', 'Last', {});

      expect(spy.lastLog?.message).toBe('Last');
      expect(spy.lastLog?.level).toBe('error');
    });

    it('should update with each new log', () => {
      spy.write('info', 'Log 1', {});
      expect(spy.lastLog?.message).toBe('Log 1');

      spy.write('error', 'Log 2', {});
      expect(spy.lastLog?.message).toBe('Log 2');
    });
  });

  describe('firstLog', () => {
    it('should return undefined for empty spy', () => {
      expect(spy.firstLog).toBeUndefined();
    });

    it('should return first captured log', () => {
      spy.write('info', 'First', {});
      spy.write('error', 'Second', {});

      expect(spy.firstLog?.message).toBe('First');
      expect(spy.firstLog?.level).toBe('info');
    });

    it('should not change with new logs', () => {
      spy.write('info', 'First', {});
      const first = spy.firstLog;

      spy.write('error', 'Second', {});

      expect(spy.firstLog).toEqual(first);
      expect(spy.firstLog?.message).toBe('First');
    });
  });

  describe('integration scenarios', () => {
    it('should support test assertion patterns', () => {
      // Simulate application logging
      spy.write('info', 'Request started', { correlationId: 'req-123', method: 'GET' });
      spy.write('debug', 'Processing request', { correlationId: 'req-123' });
      spy.write('info', 'Request completed', { correlationId: 'req-123', statusCode: 200 });

      // Test assertions
      expect(spy.count).toBe(3);
      expect(spy.getLogsByLevel('info')).toHaveLength(2);

      const startLog = spy.findLog(l => l.message === 'Request started');
      expect(startLog?.meta.method).toBe('GET');

      const completedLog = spy.lastLog;
      expect(completedLog?.meta.statusCode).toBe(200);
    });

    it('should support error tracking', () => {
      spy.write('info', 'Operation started', {});
      spy.write('error', 'Operation failed', { error: 'Connection timeout' });
      spy.write('error', 'Retry failed', { error: 'Max retries exceeded' });

      const errors = spy.getLogsByLevel('error');
      expect(errors).toHaveLength(2);
      expect(errors.every(e => e.meta.error)).toBe(true);
    });

    it('should support multi-user logging', () => {
      spy.write('info', 'User action', { userId: '123', action: 'login' });
      spy.write('info', 'User action', { userId: '456', action: 'login' });
      spy.write('info', 'User action', { userId: '123', action: 'logout' });

      const user123Logs = spy.findLogs(l => l.meta.userId === '123');
      expect(user123Logs).toHaveLength(2);

      const loginLogs = spy.findLogs(l => l.meta.action === 'login');
      expect(loginLogs).toHaveLength(2);
    });
  });
});
