/**
 * Tests for ConsoleTransport
 *
 * Verifies colored output, pretty-printing, error serialization,
 * and appropriate console method usage.
 */

import { ConsoleTransport } from './console';

describe('ConsoleTransport', () => {
  let transport: ConsoleTransport;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    transport = new ConsoleTransport();

    // Spy on console methods
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Console method selection', () => {
    test('uses console.log for debug level', () => {
      transport.write('debug', 'Debug message', {});

      expect(consoleLogSpy).toHaveBeenCalledOnce();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    test('uses console.log for info level', () => {
      transport.write('info', 'Info message', {});

      expect(consoleLogSpy).toHaveBeenCalledOnce();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    test('uses console.warn for warn level', () => {
      transport.write('warn', 'Warning message', {});

      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledOnce();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    test('uses console.error for error level', () => {
      transport.write('error', 'Error message', {});

      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledOnce();
    });
  });

  describe('Output formatting', () => {
    test('includes colored level indicator', () => {
      transport.write('info', 'Test message', {});

      const output = consoleLogSpy.mock.calls[0]![0] as string;

      // Should contain ANSI color codes
      expect(output).toContain('\x1b['); // ANSI escape sequence
      expect(output).toContain('[INFO]');
      expect(output).toContain('Test message');
    });

    test('formats debug level with cyan color', () => {
      transport.write('debug', 'Debug message', {});

      const output = consoleLogSpy.mock.calls[0]![0] as string;

      // Cyan color code: \x1b[36m
      expect(output).toContain('\x1b[36m');
      expect(output).toContain('[DEBUG]');
    });

    test('formats info level with green color', () => {
      transport.write('info', 'Info message', {});

      const output = consoleLogSpy.mock.calls[0]![0] as string;

      // Green color code: \x1b[32m
      expect(output).toContain('\x1b[32m');
      expect(output).toContain('[INFO]');
    });

    test('formats warn level with yellow color', () => {
      transport.write('warn', 'Warning message', {});

      const output = consoleWarnSpy.mock.calls[0]![0] as string;

      // Yellow color code: \x1b[33m
      expect(output).toContain('\x1b[33m');
      expect(output).toContain('[WARN]');
    });

    test('formats error level with red color', () => {
      transport.write('error', 'Error message', {});

      const output = consoleErrorSpy.mock.calls[0]![0] as string;

      // Red color code: \x1b[31m
      expect(output).toContain('\x1b[31m');
      expect(output).toContain('[ERROR]');
    });

    test('includes message text', () => {
      transport.write('info', 'User logged in successfully', {});

      const output = consoleLogSpy.mock.calls[0]![0] as string;
      expect(output).toContain('User logged in successfully');
    });

    test('does not include metadata when empty', () => {
      transport.write('info', 'Simple message', {});

      const output = consoleLogSpy.mock.calls[0]![0] as string;

      // Should only have level and message, no metadata section
      expect(output).not.toContain('{');
      expect(output).not.toContain('}');
    });

    test('pretty-prints metadata when present', () => {
      transport.write('info', 'User action', {
        userId: '123',
        action: 'login',
        ip: '192.168.1.1',
      });

      const output = consoleLogSpy.mock.calls[0]![0] as string;

      // Should include metadata with formatting (util.inspect adds newlines and indentation)
      expect(output).toContain('userId');
      expect(output).toContain('123');
      expect(output).toContain('action');
      expect(output).toContain('login');
    });
  });

  describe('Error serialization', () => {
    test('serializes Error objects in metadata', () => {
      const error = new Error('Test error');
      error.stack = 'Error: Test error\n    at testFunction';

      transport.write('error', 'Operation failed', { error });

      const output = consoleErrorSpy.mock.calls[0]![0] as string;

      // Should include serialized error with message, name, and stack
      expect(output).toContain('Test error');
      expect(output).toContain('Error');
      expect(output).toContain('testFunction');
    });

    test('handles multiple Error objects', () => {
      const error1 = new Error('First error');
      const error2 = new Error('Second error');

      transport.write('error', 'Multiple failures', {
        error1,
        error2,
        count: 2,
      });

      const output = consoleErrorSpy.mock.calls[0]![0] as string;

      expect(output).toContain('First error');
      expect(output).toContain('Second error');
      expect(output).toContain('count');
    });

    test('handles Error in nested objects', () => {
      const error = new Error('Nested error');

      transport.write('error', 'Test', {
        details: {
          error,
          level: 'critical',
        },
      });

      const output = consoleErrorSpy.mock.calls[0]![0] as string;

      expect(output).toContain('Nested error');
      expect(output).toContain('critical');
    });

    test('handles Error in arrays', () => {
      const errors = [new Error('Error 1'), new Error('Error 2')];

      transport.write('error', 'Multiple errors', { errors });

      const output = consoleErrorSpy.mock.calls[0]![0] as string;

      expect(output).toContain('Error 1');
      expect(output).toContain('Error 2');
    });
  });

  describe('Metadata handling', () => {
    test('handles null values', () => {
      transport.write('info', 'Test', {
        nullValue: null,
        normalValue: 'present',
      });

      const output = consoleLogSpy.mock.calls[0]![0] as string;

      expect(output).toContain('nullValue');
      expect(output).toContain('normalValue');
    });

    test('handles undefined values', () => {
      transport.write('info', 'Test', {
        undefinedValue: undefined,
        normalValue: 'present',
      });

      const output = consoleLogSpy.mock.calls[0]![0] as string;

      expect(output).toContain('normalValue');
    });

    test('handles nested objects', () => {
      transport.write('info', 'Test', {
        user: {
          id: '123',
          profile: {
            name: 'Alice',
            email: 'alice@example.com',
          },
        },
      });

      const output = consoleLogSpy.mock.calls[0]![0] as string;

      expect(output).toContain('user');
      expect(output).toContain('123');
      expect(output).toContain('Alice');
    });

    test('handles arrays', () => {
      transport.write('info', 'Test', {
        tags: ['auth', 'login', 'success'],
        counts: [1, 2, 3],
      });

      const output = consoleLogSpy.mock.calls[0]![0] as string;

      expect(output).toContain('tags');
      expect(output).toContain('auth');
      expect(output).toContain('counts');
    });

    test('handles mixed data types', () => {
      transport.write('info', 'Test', {
        string: 'value',
        number: 123,
        boolean: true,
        date: new Date('2025-01-01'),
        array: [1, 2, 3],
        object: { nested: 'data' },
      });

      const output = consoleLogSpy.mock.calls[0]![0] as string;

      expect(output).toContain('string');
      expect(output).toContain('number');
      expect(output).toContain('boolean');
      expect(output).toContain('date');
    });
  });

  describe('Stateless behavior', () => {
    test('multiple writes do not affect each other', () => {
      transport.write('info', 'First message', { id: 1 });
      transport.write('warn', 'Second message', { id: 2 });
      transport.write('error', 'Third message', { id: 3 });

      expect(consoleLogSpy).toHaveBeenCalledOnce();
      expect(consoleWarnSpy).toHaveBeenCalledOnce();
      expect(consoleErrorSpy).toHaveBeenCalledOnce();

      // Verify each log is independent
      const infoOutput = consoleLogSpy.mock.calls[0]![0] as string;
      const warnOutput = consoleWarnSpy.mock.calls[0]![0] as string;
      const errorOutput = consoleErrorSpy.mock.calls[0]![0] as string;

      expect(infoOutput).toContain('First message');
      expect(warnOutput).toContain('Second message');
      expect(errorOutput).toContain('Third message');
    });
  });
});
