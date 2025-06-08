import { createMockServerWithPlugins, createMockHttpServer } from '@blaizejs/testing-utils';
import type { Server } from '@blaizejs/types';

import { stopServer, registerSignalHandlers } from './stop';

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
        const onServerStopSpy = vi.spyOn(serverInstance.pluginManager, 'onServerStop');
        const terminatePluginsSpy = vi.spyOn(serverInstance.pluginManager, 'terminatePlugins');

        // Store the server reference before it gets nullified
        const originalServer = serverInstance.server;

        await stopServer(serverInstance);

        expect(onServerStopSpy).toHaveBeenCalledWith(serverInstance, originalServer);
        expect(terminatePluginsSpy).toHaveBeenCalledWith(serverInstance);
        expect(onServerStopSpy).toHaveBeenCalledBefore(terminatePluginsSpy);
      });

      test('should handle pluginManager.onServerStop errors', async () => {
        const error = new Error('Plugin manager onServerStop failed');
        vi.spyOn(serverInstance.pluginManager, 'onServerStop').mockRejectedValue(error);
        const emitSpy = vi.spyOn(serverInstance.events, 'emit');

        await expect(stopServer(serverInstance)).rejects.toThrow(
          'Plugin manager onServerStop failed'
        );
        expect(emitSpy).toHaveBeenCalledWith('error', error);
      });

      test('should handle pluginManager.terminatePlugins errors', async () => {
        const error = new Error('Plugin termination failed');
        vi.spyOn(serverInstance.pluginManager, 'terminatePlugins').mockRejectedValue(error);
        const emitSpy = vi.spyOn(serverInstance.events, 'emit');

        await expect(stopServer(serverInstance)).rejects.toThrow('Plugin termination failed');
        expect(emitSpy).toHaveBeenCalledWith('error', error);
      });
    });

    describe('error handling', () => {
      test('should handle server close errors', async () => {
        mockServerClose.mockImplementation(callback => {
          callback(new Error('Close error'));
        });
        const emitSpy = vi.spyOn(serverInstance.events, 'emit');

        await expect(stopServer(serverInstance)).rejects.toThrow('Close error');
        expect(emitSpy).toHaveBeenCalledWith('error', expect.any(Error));
      });

      test('should timeout if server takes too long to close', async () => {
        // Don't use fake timers - use real ones with short timeout
        const hangingServer = createMockHttpServer({
          close: vi.fn(), // Never calls callback
        });
        serverInstance.server = hangingServer;
        const emitSpy = vi.spyOn(serverInstance.events, 'emit');

        // Use very short timeout for fast test
        await expect(
          stopServer(serverInstance, { timeout: 10 }) // 10ms timeout
        ).rejects.toThrow('Server shutdown timed out waiting for requests to complete');

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

    beforeEach(() => {
      originalProcessOn = process.on;
      originalProcessRemoveListener = process.removeListener;
      process.on = vi.fn();
      process.removeListener = vi.fn();
    });

    afterEach(() => {
      process.on = originalProcessOn;
      process.removeListener = originalProcessRemoveListener;
    });

    test('should register SIGINT and SIGTERM handlers', () => {
      const stopFn = vi.fn().mockResolvedValue(undefined);

      registerSignalHandlers(stopFn);

      expect(process.on).toHaveBeenCalledTimes(2);
      expect(process.on).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      expect(process.on).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    });

    test('should unregister handlers when requested', () => {
      const stopFn = vi.fn().mockResolvedValue(undefined);

      const { unregister } = registerSignalHandlers(stopFn);
      unregister();

      expect(process.removeListener).toHaveBeenCalledTimes(2);
      expect(process.removeListener).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      expect(process.removeListener).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    });

    test('should call stopFn when signals are received', async () => {
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

    test('should log errors when stopFn fails', async () => {
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
