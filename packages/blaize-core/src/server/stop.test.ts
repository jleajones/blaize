import { createMockServerWithPlugins, createMockHttpServer } from '@blaizejs/testing-utils';

import { stopServer, registerSignalHandlers } from './stop';

import type { UnknownServer } from '@blaize-types/server';

describe('Server Module', () => {
  let serverInstance: UnknownServer;
  let mockServerClose: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    const { server } = createMockServerWithPlugins(2);
    serverInstance = server;

    mockServerClose = vi.fn().mockImplementation(callback => {
      if (callback) callback();
    });
    serverInstance.server = { close: mockServerClose } as any;

    // Mock router.close if it exists
    if (serverInstance.router) {
      serverInstance.router.close = vi.fn().mockResolvedValue(undefined);
    }
  });

  describe('stopServer', () => {
    describe('when server is not running', () => {
      test('should do nothing and emit no events', async () => {
        serverInstance.server = undefined;
        const emitSpy = vi.spyOn(serverInstance.events, 'emit');

        await stopServer(serverInstance);

        expect(emitSpy).not.toHaveBeenCalled();
      });
    });

    describe('when server is running', () => {
      test('should close server and emit lifecycle events', async () => {
        const emitSpy = vi.spyOn(serverInstance.events, 'emit');

        await stopServer(serverInstance);

        expect(mockServerClose).toHaveBeenCalledOnce();
        expect(emitSpy).toHaveBeenCalledWith('stopping');
        expect(emitSpy).toHaveBeenCalledWith('stopped');
        expect(serverInstance.server).toBeNull();
      });

      test('should close router watchers if available', async () => {
        const routerCloseSpy = vi.fn().mockResolvedValue(undefined);
        serverInstance.router = { close: routerCloseSpy } as any;

        await stopServer(serverInstance);

        expect(routerCloseSpy).toHaveBeenCalledOnce();
      });

      test('should handle router close timeout gracefully', async () => {
        const routerCloseSpy = vi.fn().mockImplementation(
          () => new Promise(() => {}) // Never resolves
        );
        serverInstance.router = { close: routerCloseSpy } as any;

        // Should not hang due to router timeout
        await stopServer(serverInstance, { timeout: 100 });

        expect(routerCloseSpy).toHaveBeenCalledOnce();
        expect(serverInstance.server).toBeNull();
      });

      test('should call lifecycle hooks in correct order', async () => {
        const onStopping = vi.fn();
        const onStopped = vi.fn();
        const emitSpy = vi.spyOn(serverInstance.events, 'emit');

        await stopServer(serverInstance, { onStopping, onStopped });

        expect(onStopping).toHaveBeenCalledOnce();
        expect(onStopped).toHaveBeenCalledOnce();

        const stoppingEventIndex = emitSpy.mock.calls.findIndex(call => call[0] === 'stopping');
        const stoppedEventIndex = emitSpy.mock.calls.findIndex(call => call[0] === 'stopped');

        expect(stoppingEventIndex).toBeGreaterThan(-1);
        expect(stoppedEventIndex).toBeGreaterThan(-1);
        expect(stoppingEventIndex).toBeLessThan(stoppedEventIndex);
      });
    });

    describe('plugin lifecycle integration', () => {
      test('should call pluginManager methods in correct order', async () => {
        const onServerStopSpy = vi
          .spyOn(serverInstance.pluginManager, 'onServerStop')
          .mockResolvedValue();
        const terminatePluginsSpy = vi
          .spyOn(serverInstance.pluginManager, 'terminatePlugins')
          .mockResolvedValue();

        const originalServer = serverInstance.server;

        await stopServer(serverInstance);

        expect(onServerStopSpy).toHaveBeenCalledWith(serverInstance, originalServer);
        expect(terminatePluginsSpy).toHaveBeenCalledWith(serverInstance);
        expect(onServerStopSpy).toHaveBeenCalledBefore(terminatePluginsSpy);
      });

      test('should handle pluginManager.onServerStop timeout gracefully', async () => {
        vi.spyOn(serverInstance.pluginManager, 'onServerStop').mockImplementation(
          () => new Promise(() => {}) // Never resolves
        );
        vi.spyOn(serverInstance.pluginManager, 'terminatePlugins').mockResolvedValue();

        // Should not hang due to plugin timeout
        await stopServer(serverInstance, { timeout: 100 });

        expect(serverInstance.server).toBeNull();
      });

      test('should handle pluginManager.terminatePlugins timeout gracefully', async () => {
        vi.spyOn(serverInstance.pluginManager, 'onServerStop').mockResolvedValue();
        vi.spyOn(serverInstance.pluginManager, 'terminatePlugins').mockImplementation(
          () => new Promise(() => {}) // Never resolves
        );

        // Should not hang due to plugin timeout
        await stopServer(serverInstance, { timeout: 100 });

        expect(serverInstance.server).toBeNull();
      });
    });

    describe('error handling', () => {
      test('should handle server close errors', async () => {
        const closeError = new Error('Close error');

        // Create a mock server that throws an error when closing
        const errorServer = {
          close: vi.fn().mockImplementation(callback => {
            if (callback) {
              // Call callback with error immediately
              callback(closeError);
            }
          }),
        };

        serverInstance.server = errorServer as any;
        const emitSpy = vi.spyOn(serverInstance.events, 'emit');

        await expect(stopServer(serverInstance)).rejects.toThrow('Close error');
        expect(emitSpy).toHaveBeenCalledWith('error', expect.any(Error));
      });

      test('should timeout if server takes too long to close', async () => {
        const hangingServer = createMockHttpServer({
          close: vi.fn(), // Never calls callback
        });
        serverInstance.server = hangingServer;
        const emitSpy = vi.spyOn(serverInstance.events, 'emit');

        await expect(stopServer(serverInstance, { timeout: 10 })).rejects.toThrow(
          'Server shutdown timeout'
        );

        expect(emitSpy).toHaveBeenCalledWith('error', expect.any(Error));
      }, 1000);

      test('should handle onStopping hook errors', async () => {
        const error = new Error('onStopping hook failed');
        const onStopping = vi.fn().mockRejectedValue(error);
        const emitSpy = vi.spyOn(serverInstance.events, 'emit');

        await expect(stopServer(serverInstance, { onStopping })).rejects.toThrow(
          'onStopping hook failed'
        );
        expect(emitSpy).toHaveBeenCalledWith('error', error);
      });
    });
  });

  // Add this new describe block after the existing 'stopServer' describe block

  describe('Logger Flush on Shutdown', () => {
    let mockLogger: any;
    let consoleErrorSpy: any;

    beforeEach(() => {
      // Create mock logger with flush method
      mockLogger = {
        flush: vi.fn().mockResolvedValue(undefined),
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
        child: vi.fn().mockReturnThis(),
      };

      // Spy on console.error
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Add logger to server instance
      serverInstance._logger = mockLogger;
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    describe('successful flush', () => {
      test('should flush logger if server._logger exists', async () => {
        await stopServer(serverInstance);

        expect(mockLogger.flush).toHaveBeenCalledOnce();
      });

      test('should not attempt to flush if server._logger is undefined', async () => {
        serverInstance._logger = undefined;

        await stopServer(serverInstance);

        // Should not throw or attempt flush
        expect(consoleErrorSpy).not.toHaveBeenCalledWith(
          expect.stringContaining('Failed to flush logger'),
          expect.anything()
        );
      });

      test('should not attempt to flush if server._logger is null', async () => {
        serverInstance._logger = null as any;

        await stopServer(serverInstance);

        // Should not throw or attempt flush
        expect(consoleErrorSpy).not.toHaveBeenCalledWith(
          expect.stringContaining('Failed to flush logger'),
          expect.anything()
        );
      });

      test('should use public logger.flush() method', async () => {
        await stopServer(serverInstance);

        // Verify we're calling the public flush method
        expect(mockLogger.flush).toHaveBeenCalledOnce();
        expect(mockLogger.flush).toHaveBeenCalledWith(); // No arguments
      });
    });

    describe('flush error handling', () => {
      test('should log error if flush fails but continue shutdown', async () => {
        const flushError = new Error('Flush failed');
        mockLogger.flush.mockRejectedValue(flushError);

        // Should not throw - shutdown should complete
        await stopServer(serverInstance);

        // Should log the flush error
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to flush logger during shutdown:',
          flushError
        );

        // Should still close the server
        expect(mockServerClose).toHaveBeenCalledOnce();
        expect(serverInstance.server).toBeNull();
      });

      test('should handle flush throwing synchronous error', async () => {
        const syncError = new Error('Synchronous flush error');
        mockLogger.flush.mockImplementation(() => {
          throw syncError;
        });

        // Should not throw - shutdown should complete
        await stopServer(serverInstance);

        // Should log the error
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to flush logger during shutdown:',
          syncError
        );

        // Should still close the server
        expect(mockServerClose).toHaveBeenCalledOnce();
      });

      test('should handle flush timeout gracefully', async () => {
        // Simulate flush that takes a long time
        mockLogger.flush.mockImplementation(
          () =>
            new Promise(resolve => {
              setTimeout(resolve, 200);
            })
        );

        // Should wait for flush to complete
        await stopServer(serverInstance);

        expect(mockLogger.flush).toHaveBeenCalledOnce();
        expect(mockServerClose).toHaveBeenCalledOnce();
      });
    });

    describe('shutdown order', () => {
      test('should flush logger BEFORE closing HTTP server', async () => {
        const callOrder: string[] = [];

        mockLogger.flush.mockImplementation(async () => {
          callOrder.push('flush');
        });

        mockServerClose.mockImplementation((callback: any) => {
          callOrder.push('server-close');
          if (callback) callback();
        });

        await stopServer(serverInstance);

        expect(callOrder).toEqual(['flush', 'server-close']);
      });

      test('should flush logger BEFORE router close', async () => {
        const callOrder: string[] = [];

        mockLogger.flush.mockImplementation(async () => {
          callOrder.push('flush');
        });

        const routerCloseSpy = vi.fn().mockImplementation(async () => {
          callOrder.push('router-close');
        });
        serverInstance.router = { close: routerCloseSpy } as any;

        await stopServer(serverInstance);

        expect(callOrder[0]).toBe('flush');
        expect(callOrder).toContain('router-close');
      });

      test('should flush logger BEFORE plugin lifecycle hooks', async () => {
        const callOrder: string[] = [];

        mockLogger.flush.mockImplementation(async () => {
          callOrder.push('flush');
        });

        vi.spyOn(serverInstance.pluginManager, 'onServerStop').mockImplementation(async () => {
          callOrder.push('plugin-stop');
        });

        await stopServer(serverInstance);

        expect(callOrder[0]).toBe('flush');
        expect(callOrder).toContain('plugin-stop');
      });

      test('should flush logger BEFORE emitting stopping event', async () => {
        const callOrder: string[] = [];

        mockLogger.flush.mockImplementation(async () => {
          callOrder.push('flush');
        });

        const originalEmit = serverInstance.events.emit;
        serverInstance.events.emit = vi.fn().mockImplementation((event: string, ...args: any[]) => {
          if (event === 'stopping') {
            callOrder.push('stopping-event');
          }
          return originalEmit.call(serverInstance.events, event, ...args);
        });

        await stopServer(serverInstance);

        expect(callOrder[0]).toBe('flush');
        expect(callOrder).toContain('stopping-event');
      });

      test('should close HTTP server even if flush takes time', async () => {
        // Simulate slow flush (50ms)
        mockLogger.flush.mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
        });

        const startTime = Date.now();
        await stopServer(serverInstance);
        const endTime = Date.now();

        // Should have waited for flush
        expect(endTime - startTime).toBeGreaterThanOrEqual(50);

        // Should have closed server after flush
        expect(mockServerClose).toHaveBeenCalledOnce();
      });
    });

    describe('interaction with existing shutdown flow', () => {
      test('should complete full shutdown with logger flush', async () => {
        const callOrder: string[] = [];

        mockLogger.flush.mockImplementation(async () => {
          callOrder.push('flush');
        });

        vi.spyOn(serverInstance.pluginManager, 'onServerStop').mockImplementation(async () => {
          callOrder.push('plugin-stop');
        });

        vi.spyOn(serverInstance.pluginManager, 'terminatePlugins').mockImplementation(async () => {
          callOrder.push('plugin-terminate');
        });

        mockServerClose.mockImplementation((callback: any) => {
          callOrder.push('server-close');
          if (callback) callback();
        });

        await stopServer(serverInstance);

        // Verify flush happens first
        expect(callOrder[0]).toBe('flush');

        // Verify all shutdown steps completed
        expect(callOrder).toContain('plugin-stop');
        expect(callOrder).toContain('server-close');
        expect(callOrder).toContain('plugin-terminate');
      });

      test('should not prevent server close if both flush and server close fail', async () => {
        const flushError = new Error('Flush failed');
        const closeError = new Error('Close failed');

        mockLogger.flush.mockRejectedValue(flushError);
        mockServerClose.mockImplementation((callback: any) => {
          if (callback) callback(closeError);
        });

        await expect(stopServer(serverInstance)).rejects.toThrow('Close failed');

        // Should have attempted flush
        expect(mockLogger.flush).toHaveBeenCalledOnce();

        // Server close will be called twice:
        // 1. During normal shutdown flow (which fails)
        // 2. In the catch block as a forced close attempt
        expect(mockServerClose).toHaveBeenCalledTimes(2);

        // Should have logged flush error
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to flush logger during shutdown:',
          flushError
        );
      });

      test('should handle shutdown when server is not running but logger exists', async () => {
        serverInstance.server = undefined;

        await stopServer(serverInstance);

        // Should not flush if server is not running
        expect(mockLogger.flush).not.toHaveBeenCalled();
      });

      test('should flush logger even during timeout scenarios', async () => {
        // Make router close hang
        const routerCloseSpy = vi.fn().mockImplementation(
          () => new Promise(() => {}) // Never resolves
        );
        serverInstance.router = { close: routerCloseSpy } as any;

        await stopServer(serverInstance, { timeout: 100 });

        // Logger should have been flushed before timeout
        expect(mockLogger.flush).toHaveBeenCalledOnce();
      });

      test('should preserve lifecycle hooks order with logger flush', async () => {
        const onStopping = vi.fn();
        const onStopped = vi.fn();
        const callOrder: string[] = [];

        mockLogger.flush.mockImplementation(async () => {
          callOrder.push('flush');
        });

        onStopping.mockImplementation(() => {
          callOrder.push('onStopping');
        });

        onStopped.mockImplementation(() => {
          callOrder.push('onStopped');
        });

        await stopServer(serverInstance, { onStopping, onStopped });

        // Flush should happen before onStopping
        expect(callOrder.indexOf('flush')).toBeLessThan(callOrder.indexOf('onStopping'));

        // All hooks should execute
        expect(onStopping).toHaveBeenCalledOnce();
        expect(onStopped).toHaveBeenCalledOnce();
      });
    });

    describe('does not access internal transport', () => {
      test('should not access internal _transport property', async () => {
        // Logger with internal transport
        const loggerWithInternals = {
          flush: vi.fn().mockResolvedValue(undefined),
          _transport: { flush: vi.fn() }, // Internal property
          info: vi.fn(),
          error: vi.fn(),
        };

        serverInstance._logger = loggerWithInternals as any;

        await stopServer(serverInstance);

        // Should use public method
        expect(loggerWithInternals.flush).toHaveBeenCalledOnce();

        // Should NOT access internal transport
        expect(loggerWithInternals._transport.flush).not.toHaveBeenCalled();
      });
    });
  });

  describe('registerSignalHandlers', () => {
    let originalProcessOn: typeof process.on;
    let originalProcessRemoveListener: typeof process.removeListener;
    let originalNodeEnv: string | undefined;

    beforeEach(() => {
      originalProcessOn = process.on;
      originalProcessRemoveListener = process.removeListener;
      originalNodeEnv = process.env.NODE_ENV;
      process.on = vi.fn();
      process.removeListener = vi.fn();
    });

    afterEach(() => {
      process.on = originalProcessOn;
      process.removeListener = originalProcessRemoveListener;
      process.env.NODE_ENV = originalNodeEnv;
    });

    test('should register handlers in both development and production', () => {
      // Test development
      process.env.NODE_ENV = 'development';
      const stopFn = vi.fn().mockResolvedValue(undefined);

      registerSignalHandlers(stopFn);

      expect(process.on).toHaveBeenCalledTimes(2);
      expect(process.on).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      expect(process.on).toHaveBeenCalledWith('SIGTERM', expect.any(Function));

      // Reset mocks
      (process.on as any).mockClear();

      // Test production
      process.env.NODE_ENV = 'production';
      registerSignalHandlers(stopFn);

      expect(process.on).toHaveBeenCalledTimes(2);
      expect(process.on).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      expect(process.on).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    });

    test('should unregister handlers when requested', () => {
      process.env.NODE_ENV = 'development';
      const stopFn = vi.fn().mockResolvedValue(undefined);

      const { unregister } = registerSignalHandlers(stopFn);
      unregister();

      expect(process.removeListener).toHaveBeenCalledTimes(2);
      expect(process.removeListener).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      expect(process.removeListener).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    });

    test('should force exit in development mode', () => {
      process.env.NODE_ENV = 'development';
      const originalExit = process.exit;
      const exitSpy = vi.fn();
      process.exit = exitSpy as any;

      let sigintHandler: () => void;
      let sigtermHandler: () => void;

      (process.on as any).mockImplementation((signal: string, handler: () => void) => {
        if (signal === 'SIGINT') sigintHandler = handler;
        if (signal === 'SIGTERM') sigtermHandler = handler;
      });

      const stopFn = vi.fn().mockResolvedValue(undefined);
      registerSignalHandlers(stopFn);

      sigintHandler!();
      expect(exitSpy).toHaveBeenCalledWith(0);
      expect(stopFn).not.toHaveBeenCalled(); // Should not call stopFn in development

      exitSpy.mockClear();
      sigtermHandler!();
      expect(exitSpy).toHaveBeenCalledWith(0);
      expect(stopFn).not.toHaveBeenCalled(); // Should not call stopFn in development

      process.exit = originalExit;
    });

    test('should call stopFn in production mode', async () => {
      process.env.NODE_ENV = 'production';
      const stopFn = vi.fn().mockResolvedValue(undefined);
      let sigintHandler: () => void;
      let sigtermHandler: () => void;

      (process.on as any).mockImplementation((signal: string, handler: () => void) => {
        if (signal === 'SIGINT') sigintHandler = handler;
        if (signal === 'SIGTERM') sigtermHandler = handler;
      });

      registerSignalHandlers(stopFn);

      sigintHandler!();
      expect(stopFn).toHaveBeenCalledTimes(1);

      sigtermHandler!();
      expect(stopFn).toHaveBeenCalledTimes(2);
    });

    test('should log errors when stopFn fails in production', async () => {
      process.env.NODE_ENV = 'production';
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const error = new Error('Stop error');
      const stopFn = vi.fn().mockRejectedValue(error);
      let sigintHandler: () => void;

      (process.on as any).mockImplementation((signal: string, handler: () => void) => {
        if (signal === 'SIGINT') sigintHandler = handler;
      });

      registerSignalHandlers(stopFn);
      sigintHandler!();

      await new Promise(process.nextTick);

      expect(consoleErrorSpy).toHaveBeenCalledWith(error);
      consoleErrorSpy.mockRestore();
    });
  });
});
