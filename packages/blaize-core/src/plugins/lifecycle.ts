import type {
  Server,
  Plugin,
  PluginLifecycleManager,
  PluginLifecycleOptions,
} from '@blaizejs/types';

/**
 * Create a plugin lifecycle manager
 */
export function createPluginLifecycleManager(
  options: PluginLifecycleOptions = {}
): PluginLifecycleManager {
  const { continueOnError = true, debug = false, onError } = options;

  /**
   * Log debug messages if enabled
   */
  function log(message: string, ...args: any[]) {
    if (debug) {
      console.log(`[PluginLifecycle] ${message}`, ...args);
    }
  }

  /**
   * Handle plugin errors
   */
  function handleError(plugin: Plugin, phase: string, error: Error) {
    const errorMessage = `Plugin ${plugin.name} failed during ${phase}: ${error.message}`;

    if (onError) {
      onError(plugin, phase, error);
    } else {
      console.error(errorMessage, error);
    }

    if (!continueOnError) {
      throw new Error(errorMessage);
    }
  }

  return {
    /**
     * Initialize all plugins
     */
    async initializePlugins(server: Server): Promise<void> {
      log('Initializing plugins...');

      for (const plugin of server.plugins) {
        if (plugin.initialize) {
          try {
            log(`Initializing plugin: ${plugin.name}`);
            await plugin.initialize(server);
          } catch (error) {
            handleError(plugin, 'initialize', error as Error);
          }
        }
      }

      log(`Initialized ${server.plugins.length} plugins`);
    },

    /**
     * Terminate all plugins in reverse order
     */
    async terminatePlugins(server: Server): Promise<void> {
      log('Terminating plugins...');

      const pluginsToTerminate = [...server.plugins].reverse();

      for (const plugin of pluginsToTerminate) {
        if (plugin.terminate) {
          try {
            log(`Terminating plugin: ${plugin.name}`);
            await plugin.terminate(server);
          } catch (error) {
            handleError(plugin, 'terminate', error as Error);
          }
        }
      }

      log(`Terminated ${pluginsToTerminate.length} plugins`);
    },

    /**
     * Notify plugins that the server has started
     */
    async onServerStart(server: Server, httpServer: any): Promise<void> {
      log('Notifying plugins of server start...');

      for (const plugin of server.plugins) {
        if (plugin.onServerStart) {
          try {
            log(`Notifying plugin of server start: ${plugin.name}`);
            await plugin.onServerStart(httpServer);
          } catch (error) {
            handleError(plugin, 'onServerStart', error as Error);
          }
        }
      }
    },

    /**
     * Notify plugins that the server is stopping
     */
    async onServerStop(server: Server, httpServer: any): Promise<void> {
      log('Notifying plugins of server stop...');

      const pluginsToNotify = [...server.plugins].reverse();

      for (const plugin of pluginsToNotify) {
        if (plugin.onServerStop) {
          try {
            log(`Notifying plugin of server stop: ${plugin.name}`);
            await plugin.onServerStop(httpServer);
          } catch (error) {
            handleError(plugin, 'onServerStop', error as Error);
          }
        }
      }
    },
  };
}
