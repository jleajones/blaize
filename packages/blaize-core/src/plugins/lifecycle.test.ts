/* eslint-disable import/order */
import {
  createMockLogger,
  createMockServerWithPlugins,
  createMockPlugin,
} from '@blaizejs/testing-utils';
import type { MockLogger } from '@blaizejs/testing-utils';

import { createPluginLifecycleManager } from './lifecycle';

import type { Plugin, PluginLifecycleManager } from '@blaize-types/plugins';
import type { Server } from '@blaize-types/server';

// Mock the logger module
vi.mock('../logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(),
    flush: vi.fn(),
  },
}));

import { logger } from '../logger';

describe('PluginLifecycleManager', () => {
  let server: Server<any, any>;
  let manager: PluginLifecycleManager;
  let mockLogger: MockLogger;

  beforeEach(() => {
    // Create mock server with plugins
    const { server: mockServer } = createMockServerWithPlugins(3); // Start with 3 plugins
    server = mockServer;

    // Create default manager
    manager = createPluginLifecycleManager();

    // Create mock logger and reset the module mock
    mockLogger = createMockLogger();
    vi.mocked(logger.debug).mockImplementation(mockLogger.debug.bind(mockLogger));
    vi.mocked(logger.info).mockImplementation(mockLogger.info.bind(mockLogger));
    vi.mocked(logger.error).mockImplementation(mockLogger.error.bind(mockLogger));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initializePlugins', () => {
    test('should initialize all plugins with initialize method', async () => {
      const plugin1 = server.plugins[0]!;
      const plugin2 = server.plugins[1]!;
      const plugin3 = server.plugins[2]!;

      await manager.initializePlugins(server);

      expect(plugin1.initialize).toHaveBeenCalledWith(server);
      expect(plugin2.initialize).toHaveBeenCalledWith(server);
      expect(plugin3.initialize).toHaveBeenCalledWith(server);
    });

    test('should skip plugins without initialize method', async () => {
      // Remove initialize from one plugin
      const pluginWithoutInit = createMockPlugin({ name: 'no-init-plugin' });
      delete (pluginWithoutInit as Plugin).initialize;

      server.plugins[1] = pluginWithoutInit;

      await manager.initializePlugins(server);

      // Should still call initialize on other plugins
      expect(server.plugins[0]!.initialize).toHaveBeenCalledWith(server);
      expect(server.plugins[2]!.initialize).toHaveBeenCalledWith(server);

      // Should not fail even though middle plugin has no initialize
      expect(server.plugins[1]!.initialize).toBeUndefined();
    });

    test('should initialize plugins in forward order', async () => {
      const callOrder: string[] = [];

      server.plugins.forEach((plugin, index) => {
        (plugin.initialize as any).mockImplementation(() => {
          callOrder.push(`plugin-${index}`);
        });
      });

      await manager.initializePlugins(server);

      expect(callOrder).toEqual(['plugin-0', 'plugin-1', 'plugin-2']);
    });

    test('should log debug messages during initialization', async () => {
      await manager.initializePlugins(server);

      // Should log start
      expect(mockLogger.hasLog('[PluginLifecycle] Initializing plugins', 'debug')).toBe(true);

      // Should log each plugin
      server.plugins.forEach(plugin => {
        const logs = mockLogger.logs.filter(
          l =>
            l.level === 'debug' &&
            l.message === '[PluginLifecycle] Initializing plugin' &&
            l.meta?.plugin === plugin.name
        );
        expect(logs.length).toBeGreaterThan(0);
      });

      // Should log completion
      expect(mockLogger.hasLog('[PluginLifecycle] Plugins initialized', 'info')).toBe(true);
    });

    test('should include plugin count and names in completion log', async () => {
      await manager.initializePlugins(server);

      const completionLog = mockLogger.logs.find(
        l => l.level === 'info' && l.message === '[PluginLifecycle] Plugins initialized'
      );

      expect(completionLog).toBeDefined();
      expect(completionLog?.meta).toMatchObject({
        count: 3,
        plugins: ['test-plugin-1', 'test-plugin-2', 'test-plugin-3'],
      });
    });
  });

  describe('terminatePlugins', () => {
    test('should terminate all plugins with terminate method', async () => {
      await manager.terminatePlugins(server);

      expect(server.plugins[0]!.terminate).toHaveBeenCalledWith(server);
      expect(server.plugins[1]!.terminate).toHaveBeenCalledWith(server);
      expect(server.plugins[2]!.terminate).toHaveBeenCalledWith(server);
    });

    test('should terminate plugins in reverse order', async () => {
      const callOrder: string[] = [];

      server.plugins.forEach((plugin, index) => {
        (plugin.terminate as any).mockImplementation(() => {
          callOrder.push(`plugin-${index}`);
        });
      });

      await manager.terminatePlugins(server);

      // Should be called in reverse order: 2, 1, 0
      expect(callOrder).toEqual(['plugin-2', 'plugin-1', 'plugin-0']);
    });

    test('should skip plugins without terminate method', async () => {
      const pluginWithoutTerminate = createMockPlugin({ name: 'no-terminate-plugin' });
      delete (pluginWithoutTerminate as any).terminate;

      server.plugins[1] = pluginWithoutTerminate;

      await manager.terminatePlugins(server);

      expect(server.plugins[0]!.terminate).toHaveBeenCalledWith(server);
      expect(server.plugins[2]!.terminate).toHaveBeenCalledWith(server);
      expect(server.plugins[1]!.terminate).toBeUndefined();
    });

    test('should log termination completion', async () => {
      await manager.terminatePlugins(server);

      expect(mockLogger.hasLog('[PluginLifecycle] Plugins terminated', 'info')).toBe(true);

      const completionLog = mockLogger.logs.find(
        l => l.level === 'info' && l.message === '[PluginLifecycle] Plugins terminated'
      );

      expect(completionLog?.meta).toMatchObject({
        count: 3,
      });
    });
  });

  describe('onServerStart', () => {
    test('should notify all plugins of server start', async () => {
      const mockHttpServer = { listen: vi.fn() };

      await manager.onServerStart(server, mockHttpServer);

      server.plugins.forEach(plugin => {
        expect(plugin.onServerStart).toHaveBeenCalledWith(mockHttpServer);
      });
    });

    test('should notify plugins in forward order', async () => {
      const callOrder: string[] = [];
      const mockHttpServer = { listen: vi.fn() };

      server.plugins.forEach((plugin, index) => {
        (plugin.onServerStart as any).mockImplementation(() => {
          callOrder.push(`plugin-${index}`);
        });
      });

      await manager.onServerStart(server, mockHttpServer);

      expect(callOrder).toEqual(['plugin-0', 'plugin-1', 'plugin-2']);
    });

    test('should log debug messages for server start', async () => {
      const mockHttpServer = { listen: vi.fn() };

      await manager.onServerStart(server, mockHttpServer);

      expect(
        mockLogger.hasLog('[PluginLifecycle] Notifying plugins of server start', 'debug')
      ).toBe(true);

      server.plugins.forEach(plugin => {
        const logs = mockLogger.logs.filter(
          l =>
            l.level === 'debug' &&
            l.message === '[PluginLifecycle] Notifying plugin of server start' &&
            l.meta?.plugin === plugin.name
        );
        expect(logs.length).toBeGreaterThan(0);
      });
    });
  });

  describe('onServerStop', () => {
    test('should notify all plugins of server stop', async () => {
      const mockHttpServer = { close: vi.fn() };

      await manager.onServerStop(server, mockHttpServer);

      server.plugins.forEach(plugin => {
        expect(plugin.onServerStop).toHaveBeenCalledWith(mockHttpServer);
      });
    });

    test('should notify plugins in reverse order', async () => {
      const callOrder: string[] = [];
      const mockHttpServer = { close: vi.fn() };

      server.plugins.forEach((plugin, index) => {
        (plugin.onServerStop as any).mockImplementation(() => {
          callOrder.push(`plugin-${index}`);
        });
      });

      await manager.onServerStop(server, mockHttpServer);

      // Should be called in reverse order: 2, 1, 0
      expect(callOrder).toEqual(['plugin-2', 'plugin-1', 'plugin-0']);
    });
  });

  describe('error handling', () => {
    describe('with continueOnError=true (default)', () => {
      test('should continue initializing other plugins when one fails', async () => {
        const errorPlugin = createMockPlugin({
          name: 'failing-plugin',
          initialize: vi.fn().mockRejectedValue(new Error('Plugin init failed')),
        });

        // Replace middle plugin with failing one
        server.plugins[1] = errorPlugin;

        // Should not throw
        await expect(manager.initializePlugins(server)).resolves.not.toThrow();

        // Should still call other plugins
        expect(server.plugins[0]!.initialize).toHaveBeenCalledWith(server);
        expect(server.plugins[2]!.initialize).toHaveBeenCalledWith(server);

        // Should log error
        const errorLogs = mockLogger.getLogsByLevel('error');
        expect(errorLogs.length).toBeGreaterThan(0);
        expect(errorLogs[0]?.message).toContain('failing-plugin');
        expect(errorLogs[0]?.message).toContain('initialize');
      });

      test('should continue terminating other plugins when one fails', async () => {
        const errorPlugin = createMockPlugin({
          name: 'failing-terminate-plugin',
          terminate: vi.fn().mockRejectedValue(new Error('Plugin terminate failed')),
        });

        server.plugins[1] = errorPlugin;

        await expect(manager.terminatePlugins(server)).resolves.not.toThrow();

        // Should still call other plugins (in reverse order)
        expect(server.plugins[2]!.terminate).toHaveBeenCalledWith(server);
        expect(server.plugins[0]!.terminate).toHaveBeenCalledWith(server);

        // Should log error
        const errorLogs = mockLogger.getLogsByLevel('error');
        expect(errorLogs.length).toBeGreaterThan(0);
        expect(errorLogs[0]?.message).toContain('failing-terminate-plugin');
        expect(errorLogs[0]?.message).toContain('terminate');
      });
    });

    describe('with continueOnError=false', () => {
      beforeEach(() => {
        // Create manager with strict error handling
        manager = createPluginLifecycleManager({ continueOnError: false });
      });

      test('should throw and stop initialization when plugin fails', async () => {
        const errorPlugin = createMockPlugin({
          name: 'failing-plugin',
          initialize: vi.fn().mockRejectedValue(new Error('Plugin init failed')),
        });

        server.plugins[1] = errorPlugin;

        await expect(manager.initializePlugins(server)).rejects.toThrow(
          'Plugin failing-plugin failed during initialize: Plugin init failed'
        );

        // Should have called first plugin but not third (due to failure)
        expect(server.plugins[0]!.initialize).toHaveBeenCalledWith(server);
        expect(server.plugins[2]!.initialize).not.toHaveBeenCalled();
      });

      test('should throw and stop termination when plugin fails', async () => {
        const errorPlugin = createMockPlugin({
          name: 'failing-terminate-plugin',
          terminate: vi.fn().mockRejectedValue(new Error('Plugin terminate failed')),
        });

        // Put failing plugin at the end (will be called first in reverse order)
        server.plugins[2] = errorPlugin;

        await expect(manager.terminatePlugins(server)).rejects.toThrow(
          'Plugin failing-terminate-plugin failed during terminate: Plugin terminate failed'
        );

        // Should not have called other plugins due to early failure
        expect(server.plugins[1]!.terminate).not.toHaveBeenCalled();
        expect(server.plugins[0]!.terminate).not.toHaveBeenCalled();
      });
    });

    describe('with custom error handler', () => {
      test('should call custom error handler instead of logger.error', async () => {
        const customErrorHandler = vi.fn();
        manager = createPluginLifecycleManager({
          onError: customErrorHandler,
        });

        const error = new Error('Plugin init failed');
        const errorPlugin = createMockPlugin({
          name: 'failing-plugin',
          initialize: vi.fn().mockRejectedValue(error),
        });

        server.plugins[1] = errorPlugin;

        await manager.initializePlugins(server);

        expect(customErrorHandler).toHaveBeenCalledWith(errorPlugin, 'initialize', error);

        // Should not use logger.error when custom handler is provided
        const errorLogs = mockLogger.getLogsByLevel('error');
        expect(errorLogs).toHaveLength(0);
      });
    });
  });

  describe('logging behavior', () => {
    test('should log at debug level for step-by-step operations', async () => {
      await manager.initializePlugins(server);

      const debugLogs = mockLogger.getLogsByLevel('debug');
      expect(debugLogs.length).toBeGreaterThan(0);

      // Should have debug logs for each plugin
      expect(debugLogs.length).toBeGreaterThanOrEqual(server.plugins.length);
    });

    test('should log at info level for completed milestones', async () => {
      await manager.initializePlugins(server);

      const infoLogs = mockLogger.getLogsByLevel('info');
      expect(infoLogs.length).toBeGreaterThan(0);

      // Should have completion log
      expect(infoLogs[0]?.message).toBe('[PluginLifecycle] Plugins initialized');
    });

    test('should include structured metadata in all logs', async () => {
      await manager.initializePlugins(server);

      // Check that logs have metadata
      mockLogger.logs.forEach(log => {
        expect(log.meta).toBeDefined();
      });

      // Check specific metadata structure
      const initLog = mockLogger.logs.find(
        l => l.message === '[PluginLifecycle] Initializing plugins'
      );
      expect(initLog?.meta).toHaveProperty('count');
    });
  });

  describe('edge cases', () => {
    test('should handle empty plugin array', async () => {
      server.plugins = [];

      await expect(manager.initializePlugins(server)).resolves.not.toThrow();
      await expect(manager.terminatePlugins(server)).resolves.not.toThrow();
      await expect(manager.onServerStart(server, {})).resolves.not.toThrow();
      await expect(manager.onServerStop(server, {})).resolves.not.toThrow();

      // Should still log completion
      expect(mockLogger.hasLog('[PluginLifecycle] Plugins initialized', 'info')).toBe(true);
      expect(mockLogger.hasLog('[PluginLifecycle] Plugins terminated', 'info')).toBe(true);
    });

    test('should handle plugins with only some lifecycle methods', async () => {
      const partialPlugin = createMockPlugin({
        name: 'partial-plugin',
        // Only has register, missing other lifecycle methods
      });
      delete (partialPlugin as any).initialize;
      delete (partialPlugin as any).terminate;
      delete (partialPlugin as any).onServerStart;
      delete (partialPlugin as any).onServerStop;

      server.plugins = [partialPlugin];

      // Should not throw for any method
      await expect(manager.initializePlugins(server)).resolves.not.toThrow();
      await expect(manager.terminatePlugins(server)).resolves.not.toThrow();
      await expect(manager.onServerStart(server, {})).resolves.not.toThrow();
      await expect(manager.onServerStop(server, {})).resolves.not.toThrow();
    });

    test('should maintain plugin order even with mixed sync/async methods', async () => {
      const callOrder: string[] = [];

      // Mix of sync and async plugins
      server.plugins[0]!.initialize = vi.fn(() => {
        callOrder.push('plugin-0');
        return Promise.resolve();
      });

      server.plugins[1]!.initialize = vi.fn(() => {
        callOrder.push('plugin-1');
        // Sync return
      });

      server.plugins[2]!.initialize = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        callOrder.push('plugin-2');
      });

      await manager.initializePlugins(server);

      expect(callOrder).toEqual(['plugin-0', 'plugin-1', 'plugin-2']);
    });
  });
});
