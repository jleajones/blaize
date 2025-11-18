import { logger } from '../logger';

import type { Plugin, PluginLifecycleManager, PluginLifecycleOptions } from '@blaize-types/plugins';
import type { UnknownServer } from '@blaize-types/server';

/**
 * Create a plugin lifecycle manager
 */
export function createPluginLifecycleManager(
  options: PluginLifecycleOptions = {}
): PluginLifecycleManager {
  const { continueOnError = true, onError } = options;

  /**
   * Handle plugin errors
   */
  function handleError(plugin: Plugin, phase: string, error: Error) {
    const errorMessage = `Plugin ${plugin.name} failed during ${phase}: ${error.message}`;

    if (onError) {
      onError(plugin, phase, error);
    } else {
      logger.error(`[PluginLifecycle] ${errorMessage}`, {
        plugin: plugin.name,
        phase,
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name,
        },
      });
    }

    if (!continueOnError) {
      throw new Error(errorMessage);
    }
  }

  return {
    /**
     * Initialize all plugins
     */
    async initializePlugins(server: UnknownServer): Promise<void> {
      logger.debug('[PluginLifecycle] Initializing plugins', { count: server.plugins.length });

      for (const plugin of server.plugins) {
        if (plugin.initialize) {
          try {
            logger.debug(`[PluginLifecycle] Initializing plugin`, {
              plugin: plugin.name,
            });
            await plugin.initialize(server);
          } catch (error) {
            handleError(plugin, 'initialize', error as Error);
          }
        }
      }

      logger.info('[PluginLifecycle] Plugins initialized', {
        count: server.plugins.length,
        plugins: server.plugins.map(p => p.name),
      });
    },

    /**
     * Terminate all plugins in reverse order
     */
    async terminatePlugins(server: UnknownServer): Promise<void> {
      logger.debug('[PluginLifecycle] Terminating plugins', { count: server.plugins.length });

      const pluginsToTerminate = [...server.plugins].reverse();

      for (const plugin of pluginsToTerminate) {
        if (plugin.terminate) {
          try {
            logger.debug(`[PluginLifecycle] Terminating plugin`, {
              plugin: plugin.name,
            });
            await plugin.terminate(server);
          } catch (error) {
            handleError(plugin, 'terminate', error as Error);
          }
        }
      }
      logger.info('[PluginLifecycle] Plugins terminated', { count: pluginsToTerminate.length });
    },

    /**
     * Notify plugins that the server has started
     */
    async onServerStart(server: UnknownServer, httpServer: any): Promise<void> {
      logger.debug('[PluginLifecycle] Notifying plugins of server start');

      for (const plugin of server.plugins) {
        if (plugin.onServerStart) {
          try {
            logger.debug(`[PluginLifecycle] Notifying plugin of server start`, {
              plugin: plugin.name,
            });
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
    async onServerStop(server: UnknownServer, httpServer: any): Promise<void> {
      logger.debug('[PluginLifecycle] Notifying plugins of server stop...');

      const pluginsToNotify = [...server.plugins].reverse();

      for (const plugin of pluginsToNotify) {
        if (plugin.onServerStop) {
          try {
            logger.debug(`[PluginLifecycle] Notifying plugin of server stop: ${plugin.name}`);
            await plugin.onServerStop(httpServer);
          } catch (error) {
            handleError(plugin, 'onServerStop', error as Error);
          }
        }
      }
    },
  };
}
