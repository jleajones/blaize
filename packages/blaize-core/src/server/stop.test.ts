import { EventEmitter } from 'node:events';

import { Plugin, Server } from '@blaizejs/types';

import { stopServer, registerSignalHandlers } from './stop';

describe('Server Module', () => {
  // Setup mocks
  const mockServer = {
    close: vi.fn(cb => {
      cb();
      return mockServer;
    }),
  };

  // Create a mock server instance
  let serverInstance: Server;

  beforeEach(() => {
    // Reset mocks
    vi.resetAllMocks();

    const plugins: Plugin[] = [
      {
        name: 'test-plugin-1',
        version: '1.0.0',
        register: vi.fn(),
        initialize: vi.fn(),
        terminate: vi.fn().mockResolvedValue(undefined),
      },
      {
        name: 'test-plugin-2',
        version: '1.0.0',
        register: vi.fn(),
        initialize: vi.fn(),
        terminate: vi.fn().mockResolvedValue(undefined),
      },
    ];
    // Create a fresh server instance for each test
    serverInstance = {
      server: mockServer as any,
      port: 3000,
      host: 'localhost',
      events: new EventEmitter(),
      plugins: plugins as Plugin[],
      middleware: [],
      listen: vi.fn(),
      close: vi.fn(),
      use: vi.fn().mockReturnThis(),
      register: vi.fn().mockResolvedValue({}),
      router: {
        handleRequest: vi.fn().mockResolvedValue(undefined),
        getRoutes: vi.fn().mockReturnValue([]),
        addRoute: vi.fn(),
      },
      context: { getStore: vi.fn() } as any,
    };
  });

  describe('stopServer function', () => {
    it('should do nothing if server is not running', async () => {
      // Setup a server instance that's not running
      serverInstance.server = undefined;

      // Add a spy to the events emitter to verify no events are emitted
      const emitSpy = vi.spyOn(serverInstance.events, 'emit');

      await stopServer(serverInstance);

      // Verify no events were emitted
      expect(emitSpy).not.toHaveBeenCalled();
    });

    it('should close the server correctly and emit events', async () => {
      // Add spy to the events emitter
      const emitSpy = vi.spyOn(serverInstance.events, 'emit');

      await stopServer(serverInstance);

      // Verify server was closed and events were emitted
      expect(mockServer.close).toHaveBeenCalled();
      expect(emitSpy).toHaveBeenCalledWith('stopping');
      expect(emitSpy).toHaveBeenCalledWith('stopped');
      expect(serverInstance.server).toBeNull();
    });

    it('should call onStopping and onStopped hooks', async () => {
      // Create mock hooks
      const onStopping = vi.fn();
      const onStopped = vi.fn();

      // Add spy to the events emitter
      const emitSpy = vi.spyOn(serverInstance.events, 'emit');

      await stopServer(serverInstance, { onStopping, onStopped });

      // Verify hooks were called
      expect(onStopping).toHaveBeenCalledOnce();
      expect(onStopped).toHaveBeenCalledOnce();

      // Verify order of operations
      const stoppingEventIndex = emitSpy.mock.calls.findIndex(call => call[0] === 'stopping');
      const stoppedEventIndex = emitSpy.mock.calls.findIndex(call => call[0] === 'stopped');

      expect(stoppingEventIndex).toBeGreaterThan(-1);
      expect(stoppedEventIndex).toBeGreaterThan(-1);

      // Check order: onStopping -> stopping event -> onStopped -> stopped event
      expect(onStopping.mock.invocationCallOrder[0]).toBeLessThan(
        emitSpy.mock.invocationCallOrder[stoppingEventIndex]!
      );
      expect(emitSpy.mock.invocationCallOrder[stoppingEventIndex]).toBeLessThan(
        onStopped.mock.invocationCallOrder[0]!
      );
      expect(onStopped.mock.invocationCallOrder[0]).toBeLessThan(
        emitSpy.mock.invocationCallOrder[stoppedEventIndex]!
      );
    });

    it('should terminate plugins in reverse order', async () => {
      // Access the properly typed plugins for spying
      const plugin1 = serverInstance.plugins[0] as Plugin;
      const plugin2 = serverInstance.plugins[1] as Plugin;

      const pluginsSpy1 = vi.spyOn(plugin1, 'terminate');
      const pluginsSpy2 = vi.spyOn(plugin2, 'terminate');

      await stopServer(serverInstance);

      // Verify plugins were terminated in reverse order
      expect(pluginsSpy1).toHaveBeenCalledOnce();
      expect(pluginsSpy2).toHaveBeenCalledOnce();
      expect(pluginsSpy2).toHaveBeenCalledBefore(pluginsSpy1);
    });

    it('should handle server close errors', async () => {
      // Setup server to emit an error on close
      mockServer.close.mockImplementation(cb => {
        cb(new Error('Close error'));
        return mockServer;
      });

      // Add spy to the events emitter
      const emitSpy = vi.spyOn(serverInstance.events, 'emit');

      // Expect the function to throw
      await expect(stopServer(serverInstance)).rejects.toThrow('Close error');
      expect(emitSpy).toHaveBeenCalledWith('error', expect.any(Error));
    });

    it('should timeout if server takes too long to close', async () => {
      // Setup fake timers
      vi.useFakeTimers();

      // Setup server to never call the callback
      mockServer.close.mockImplementation(() => mockServer);

      // Add spy to the events emitter
      const emitSpy = vi.spyOn(serverInstance.events, 'emit');

      // Start the stop process with a short timeout
      const stopPromise = stopServer(serverInstance, { timeout: 1000 });

      // Advance timers to trigger timeout
      vi.advanceTimersByTime(1001);

      // Expect the promise to reject with timeout error
      await expect(stopPromise).rejects.toThrow('Server shutdown timed out');
      expect(emitSpy).toHaveBeenCalledWith('error', expect.any(Error));

      // Restore real timers
      vi.useRealTimers();
    });

    it('should handle plugin termination errors', async () => {
      // Setup plugin to throw on terminate
      serverInstance.plugins[0]!.terminate = vi.fn().mockRejectedValue(new Error('Plugin error'));

      // Add spy to the events emitter
      const emitSpy = vi.spyOn(serverInstance.events, 'emit');

      // Expect the function to throw
      await expect(stopServer(serverInstance)).rejects.toThrow('Plugin error');
      expect(emitSpy).toHaveBeenCalledWith('error', expect.any(Error));
    });

    it('should skip plugins without terminate method', async () => {
      // Setup a plugin without terminate method
      serverInstance.plugins.push({
        name: 'plugin-without-terminate',
        version: '1.0.0',
        initialize: vi.fn(),
        register: vi.fn(),
      });

      await stopServer(serverInstance);

      // Verify we don't crash and the other plugins are still terminated
      expect(serverInstance.plugins[0]!.terminate).toHaveBeenCalled();
      expect(serverInstance.plugins[1]!.terminate).toHaveBeenCalled();
    });
  });

  describe('registerSignalHandlers', () => {
    const originalProcessOn = process.on;
    const originalProcessRemoveListener = process.removeListener;

    beforeEach(() => {
      process.on = vi.fn();
      process.removeListener = vi.fn();
    });

    afterEach(() => {
      process.on = originalProcessOn;
      process.removeListener = originalProcessRemoveListener;
    });

    it('should register SIGINT and SIGTERM handlers', () => {
      const stopFn = vi.fn().mockResolvedValue(undefined);

      registerSignalHandlers(stopFn);

      // Verify handlers were registered
      expect(process.on).toHaveBeenCalledTimes(2);
      expect(process.on).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      expect(process.on).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    });

    it('should unregister handlers when unregister is called', () => {
      const stopFn = vi.fn().mockResolvedValue(undefined);

      const { unregister } = registerSignalHandlers(stopFn);
      unregister();

      // Verify handlers were unregistered
      expect(process.removeListener).toHaveBeenCalledTimes(2);
      expect(process.removeListener).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      expect(process.removeListener).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    });

    it('should call stopFn when signal handlers are triggered', async () => {
      const stopFn = vi.fn().mockResolvedValue(undefined);

      // Capture the signal handlers
      let sigintHandler: () => void | undefined;
      let sigtermHandler: () => void | undefined;

      (process.on as any).mockImplementation((signal: string, handler: () => void) => {
        if (signal === 'SIGINT') sigintHandler = handler;
        if (signal === 'SIGTERM') sigtermHandler = handler;
      });

      registerSignalHandlers(stopFn);

      // Trigger the handlers
      sigintHandler!();
      expect(stopFn).toHaveBeenCalledTimes(1);

      sigtermHandler!();
      expect(stopFn).toHaveBeenCalledTimes(2);
    });

    it('should log errors if stopFn fails', async () => {
      // Mock console.error
      const consoleErrorMock = vi.spyOn(console, 'error').mockImplementation(() => {});

      const error = new Error('Stop error');
      const stopFn = vi.fn().mockRejectedValue(error);

      // Capture the signal handlers
      let sigintHandler: () => void | undefined;

      (process.on as any).mockImplementation((signal: string, handler: () => void) => {
        if (signal === 'SIGINT') sigintHandler = handler;
      });

      registerSignalHandlers(stopFn);

      // Trigger the handler
      sigintHandler!();

      // Let the promise chain run
      await new Promise(process.nextTick);

      // Verify error was logged
      expect(consoleErrorMock).toHaveBeenCalledWith(error);

      // Clean up
      consoleErrorMock.mockRestore();
    });
  });
});
