import { createMockServerWithPlugins, createMockHttpServer } from '@blaizejs/testing-utils';

import { stopServer, registerSignalHandlers } from './stop';

import type { Server } from '../index';

describe('Server Module', () => {
  let serverInstance: Server;
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
        const routerCloseSpy = vi.fn().mockImplementation(() => 
          new Promise(() => {}) // Never resolves
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
        const onServerStopSpy = vi.spyOn(serverInstance.pluginManager, 'onServerStop').mockResolvedValue();
        const terminatePluginsSpy = vi.spyOn(serverInstance.pluginManager, 'terminatePlugins').mockResolvedValue();

        const originalServer = serverInstance.server;

        await stopServer(serverInstance);

        expect(onServerStopSpy).toHaveBeenCalledWith(serverInstance, originalServer);
        expect(terminatePluginsSpy).toHaveBeenCalledWith(serverInstance);
        expect(onServerStopSpy).toHaveBeenCalledBefore(terminatePluginsSpy);
      });

      test('should handle pluginManager.onServerStop timeout gracefully', async () => {
        vi.spyOn(serverInstance.pluginManager, 'onServerStop').mockImplementation(() => 
          new Promise(() => {}) // Never resolves
        );
        vi.spyOn(serverInstance.pluginManager, 'terminatePlugins').mockResolvedValue();

        // Should not hang due to plugin timeout
        await stopServer(serverInstance, { timeout: 100 });

        expect(serverInstance.server).toBeNull();
      });

      test('should handle pluginManager.terminatePlugins timeout gracefully', async () => {
        vi.spyOn(serverInstance.pluginManager, 'onServerStop').mockResolvedValue();
        vi.spyOn(serverInstance.pluginManager, 'terminatePlugins').mockImplementation(() => 
          new Promise(() => {}) // Never resolves
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
          })
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

        await expect(
          stopServer(serverInstance, { timeout: 10 })
        ).rejects.toThrow('Server shutdown timeout');

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