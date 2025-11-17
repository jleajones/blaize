/**
 * Tests for NullTransport
 *
 * Verifies that no output is generated and all operations are no-ops.
 */

import { NullTransport } from './null';

describe('NullTransport', () => {
  let transport: NullTransport;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    transport = new NullTransport();

    // Spy on console methods to verify nothing is output
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('write() method', () => {
    test('produces no output for debug level', () => {
      transport.write('debug', 'Debug message', { userId: '123' });

      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    test('produces no output for info level', () => {
      transport.write('info', 'Info message', { userId: '123' });

      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    test('produces no output for warn level', () => {
      transport.write('warn', 'Warning message', { count: 95 });

      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    test('produces no output for error level', () => {
      const error = new Error('Test error');
      transport.write('error', 'Error message', { error });

      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    test('handles empty metadata', () => {
      transport.write('info', 'Simple message', {});

      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    test('handles complex metadata without output', () => {
      transport.write('info', 'Complex log', {
        user: {
          id: '123',
          profile: {
            name: 'Alice',
            tags: ['admin', 'verified'],
          },
        },
        timestamp: new Date(),
        error: new Error('Test'),
      });

      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    test('multiple writes produce no output', () => {
      transport.write('debug', 'First', {});
      transport.write('info', 'Second', {});
      transport.write('warn', 'Third', {});
      transport.write('error', 'Fourth', {});

      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('flush() method', () => {
    test('flush resolves immediately', async () => {
      await expect(transport.flush()).resolves.toBeUndefined();
    });

    test('flush produces no output', async () => {
      await transport.flush();

      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    test('flush can be called multiple times', async () => {
      await transport.flush();
      await transport.flush();
      await transport.flush();

      // Should not throw
      expect(true).toBe(true);
    });

    test('flush after writes produces no output', async () => {
      transport.write('info', 'Test 1', {});
      transport.write('error', 'Test 2', {});
      await transport.flush();

      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('Performance characteristics', () => {
    test('handles high volume of logs efficiently', () => {
      const start = performance.now();

      // Write 10,000 logs
      for (let i = 0; i < 10000; i++) {
        transport.write('info', `Message ${i}`, {
          id: i,
          timestamp: new Date(),
          data: { nested: 'value' },
        });
      }

      const end = performance.now();
      const duration = end - start;

      // Should be extremely fast (< 5ms for 10k no-ops)
      expect(duration).toBeLessThan(5);

      // Verify no output was produced
      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('Stateless behavior', () => {
    test('multiple instances are independent', () => {
      const transport1 = new NullTransport();
      const transport2 = new NullTransport();

      transport1.write('info', 'Transport 1', {});
      transport2.write('error', 'Transport 2', {});

      // Both should produce no output
      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    test('write does not mutate metadata', () => {
      const meta = { userId: '123', action: 'test' };
      const metaCopy = { ...meta };

      transport.write('info', 'Test', meta);

      // Metadata should be unchanged
      expect(meta).toEqual(metaCopy);
    });
  });

  describe('Usage in tests', () => {
    test('can be used to suppress log output in tests', () => {
      // Simulate a service that logs
      class TestService {
        constructor(private transport: NullTransport) {}

        performOperation() {
          this.transport.write('info', 'Starting operation', {});
          this.transport.write('debug', 'Step 1', {});
          this.transport.write('debug', 'Step 2', {});
          this.transport.write('info', 'Operation complete', {});
          return 'success';
        }
      }

      const service = new TestService(transport);
      const result = service.performOperation();

      // Service works, but no logs produced
      expect(result).toBe('success');
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });
});
