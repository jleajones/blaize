/**
 * Tests for JSONTransport
 *
 * Verifies JSON output format, circular reference handling,
 * error serialization, and single-line output.
 */

import { JSONTransport } from './json';

describe('JSONTransport', () => {
  let transport: JSONTransport;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    transport = new JSONTransport();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('JSON output format', () => {
    test('outputs valid JSON', () => {
      transport.write('info', 'Test message', { userId: '123' });

      const output = consoleLogSpy.mock.calls[0]![0] as string;

      // Should be parseable JSON
      expect(() => JSON.parse(output)).not.toThrow();
    });

    test('includes level and message fields', () => {
      transport.write('info', 'User login', { userId: '123' });

      const output = consoleLogSpy.mock.calls[0]![0] as string;
      const parsed = JSON.parse(output);

      expect(parsed).toHaveProperty('level', 'info');
      expect(parsed).toHaveProperty('message', 'User login');
    });

    test('flattens metadata into top-level fields', () => {
      transport.write('info', 'Test', {
        userId: '123',
        action: 'login',
        timestamp: '2025-10-20T15:30:00Z',
      });

      const output = consoleLogSpy.mock.calls[0]![0] as string;
      const parsed = JSON.parse(output);

      expect(parsed.level).toBe('info');
      expect(parsed.message).toBe('Test');
      expect(parsed.userId).toBe('123');
      expect(parsed.action).toBe('login');
      expect(parsed.timestamp).toBe('2025-10-20T15:30:00Z');
    });

    test('outputs single line (no pretty-printing)', () => {
      transport.write('info', 'Test', {
        nested: {
          deep: {
            value: 'data',
          },
        },
      });

      const output = consoleLogSpy.mock.calls[0]![0] as string;

      // Single line should not contain newlines (except the trailing one from console.log)
      const lines = output.split('\n').filter(line => line.length > 0);
      expect(lines).toHaveLength(1);
    });

    test('handles empty metadata', () => {
      transport.write('info', 'Simple message', {});

      const output = consoleLogSpy.mock.calls[0]![0] as string;
      const parsed = JSON.parse(output);

      expect(parsed.level).toBe('info');
      expect(parsed.message).toBe('Simple message');
      expect(Object.keys(parsed)).toEqual(['level', 'message']);
    });
  });

  describe('Log levels', () => {
    test('outputs debug level', () => {
      transport.write('debug', 'Debug message', {});

      const output = consoleLogSpy.mock.calls[0]![0] as string;
      const parsed = JSON.parse(output);

      expect(parsed.level).toBe('debug');
    });

    test('outputs info level', () => {
      transport.write('info', 'Info message', {});

      const output = consoleLogSpy.mock.calls[0]![0] as string;
      const parsed = JSON.parse(output);

      expect(parsed.level).toBe('info');
    });

    test('outputs warn level', () => {
      transport.write('warn', 'Warning message', {});

      const output = consoleLogSpy.mock.calls[0]![0] as string;
      const parsed = JSON.parse(output);

      expect(parsed.level).toBe('warn');
    });

    test('outputs error level', () => {
      transport.write('error', 'Error message', {});

      const output = consoleLogSpy.mock.calls[0]![0] as string;
      const parsed = JSON.parse(output);

      expect(parsed.level).toBe('error');
    });
  });

  describe('Error serialization', () => {
    test('serializes Error objects', () => {
      const error = new Error('Test error');
      error.stack = 'Error: Test error\n    at testFunction';

      transport.write('error', 'Operation failed', { error });

      const output = consoleLogSpy.mock.calls[0]![0] as string;
      const parsed = JSON.parse(output);

      expect(parsed.error).toEqual({
        message: 'Test error',
        name: 'Error',
        stack: 'Error: Test error\n    at testFunction',
      });
    });

    test('includes stack traces', () => {
      const error = new Error('Database error');

      transport.write('error', 'DB failed', { error });

      const output = consoleLogSpy.mock.calls[0]![0] as string;
      const parsed = JSON.parse(output);

      expect(parsed.error).toHaveProperty('stack');
      expect(typeof parsed.error.stack).toBe('string');
      expect(parsed.error.stack).toContain('Database error');
    });

    test('handles multiple Error objects', () => {
      const error1 = new Error('First error');
      const error2 = new Error('Second error');

      transport.write('error', 'Multiple failures', {
        error1,
        error2,
        count: 2,
      });

      const output = consoleLogSpy.mock.calls[0]![0] as string;
      const parsed = JSON.parse(output);

      expect(parsed.error1.message).toBe('First error');
      expect(parsed.error2.message).toBe('Second error');
      expect(parsed.count).toBe(2);
    });

    test('handles Error in nested objects', () => {
      const error = new Error('Nested error');

      transport.write('error', 'Test', {
        details: {
          error,
          severity: 'high',
        },
      });

      const output = consoleLogSpy.mock.calls[0]![0] as string;
      const parsed = JSON.parse(output);

      expect(parsed.details.error.message).toBe('Nested error');
      expect(parsed.details.severity).toBe('high');
    });

    test('handles Error in arrays', () => {
      const errors = [new Error('Error 1'), new Error('Error 2')];

      transport.write('error', 'Multiple errors', { errors });

      const output = consoleLogSpy.mock.calls[0]![0] as string;
      const parsed = JSON.parse(output);

      expect(parsed.errors[0].message).toBe('Error 1');
      expect(parsed.errors[1].message).toBe('Error 2');
    });
  });

  describe('Circular reference handling', () => {
    test('handles circular references in objects', () => {
      const circular: Record<string, unknown> = { name: 'test' };
      circular.self = circular; // Create circular reference

      transport.write('info', 'Circular test', { data: circular });

      const output = consoleLogSpy.mock.calls[0]![0] as string;

      // Should not throw, and should include [Circular] marker
      expect(() => JSON.parse(output)).not.toThrow();
      expect(output).toContain('[Circular]');
    });

    test('handles deeply nested circular references', () => {
      const obj1: Record<string, unknown> = { id: 1 };
      const obj2: Record<string, unknown> = { id: 2, parent: obj1 };
      obj1.child = obj2; // Create circular reference

      transport.write('info', 'Deep circular', { data: obj1 });

      const output = consoleLogSpy.mock.calls[0]![0] as string;

      expect(() => JSON.parse(output)).not.toThrow();
      expect(output).toContain('[Circular]');
    });

    test('handles self-referencing arrays', () => {
      const arr: unknown[] = [1, 2, 3];
      arr.push(arr); // Self-reference

      transport.write('info', 'Array circular', { data: arr });

      const output = consoleLogSpy.mock.calls[0]![0] as string;

      expect(() => JSON.parse(output)).not.toThrow();
      expect(output).toContain('[Circular]');
    });
  });

  describe('Data type handling', () => {
    test('handles strings', () => {
      transport.write('info', 'Test', { text: 'Hello World' });

      const output = consoleLogSpy.mock.calls[0]![0] as string;
      const parsed = JSON.parse(output);

      expect(parsed.text).toBe('Hello World');
    });

    test('handles numbers', () => {
      transport.write('info', 'Test', {
        integer: 42,
        float: 3.14,
        negative: -10,
      });

      const output = consoleLogSpy.mock.calls[0]![0] as string;
      const parsed = JSON.parse(output);

      expect(parsed.integer).toBe(42);
      expect(parsed.float).toBe(3.14);
      expect(parsed.negative).toBe(-10);
    });

    test('handles booleans', () => {
      transport.write('info', 'Test', {
        isTrue: true,
        isFalse: false,
      });

      const output = consoleLogSpy.mock.calls[0]![0] as string;
      const parsed = JSON.parse(output);

      expect(parsed.isTrue).toBe(true);
      expect(parsed.isFalse).toBe(false);
    });

    test('handles null', () => {
      transport.write('info', 'Test', { nullValue: null });

      const output = consoleLogSpy.mock.calls[0]![0] as string;
      const parsed = JSON.parse(output);

      expect(parsed.nullValue).toBe(null);
    });

    test('handles undefined as null', () => {
      transport.write('info', 'Test', { undefinedValue: undefined });

      const output = consoleLogSpy.mock.calls[0]![0] as string;
      const parsed = JSON.parse(output);

      // JSON.stringify converts undefined to null in objects
      // or omits the key entirely
      expect(parsed.undefinedValue).toBeUndefined();
    });

    test('handles dates', () => {
      const date = new Date('2025-10-20T15:30:00Z');
      transport.write('info', 'Test', { timestamp: date });

      const output = consoleLogSpy.mock.calls[0]![0] as string;
      const parsed = JSON.parse(output);

      // Dates are serialized as ISO strings
      expect(parsed.timestamp).toBe('2025-10-20T15:30:00.000Z');
    });

    test('handles arrays', () => {
      transport.write('info', 'Test', {
        tags: ['auth', 'login', 'success'],
        numbers: [1, 2, 3],
      });

      const output = consoleLogSpy.mock.calls[0]![0] as string;
      const parsed = JSON.parse(output);

      expect(parsed.tags).toEqual(['auth', 'login', 'success']);
      expect(parsed.numbers).toEqual([1, 2, 3]);
    });

    test('handles nested objects', () => {
      transport.write('info', 'Test', {
        user: {
          id: '123',
          profile: {
            name: 'Alice',
            age: 30,
          },
        },
      });

      const output = consoleLogSpy.mock.calls[0]![0] as string;
      const parsed = JSON.parse(output);

      expect(parsed.user.id).toBe('123');
      expect(parsed.user.profile.name).toBe('Alice');
      expect(parsed.user.profile.age).toBe(30);
    });
  });

  describe('flush() method', () => {
    test('flush resolves immediately', async () => {
      await expect(transport.flush()).resolves.toBeUndefined();
    });

    test('flush can be called multiple times', async () => {
      await transport.flush();
      await transport.flush();
      await transport.flush();

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('Stateless behavior', () => {
    test('multiple writes are independent', () => {
      transport.write('info', 'First', { id: 1 });
      transport.write('info', 'Second', { id: 2 });
      transport.write('info', 'Third', { id: 3 });

      expect(consoleLogSpy).toHaveBeenCalledTimes(3);

      const outputs = consoleLogSpy.mock.calls.map(call => JSON.parse(call[0] as string));

      expect(outputs[0].id).toBe(1);
      expect(outputs[1].id).toBe(2);
      expect(outputs[2].id).toBe(3);
    });
  });
});
