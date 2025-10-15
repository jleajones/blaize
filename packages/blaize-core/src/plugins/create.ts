/* eslint-disable @typescript-eslint/no-empty-object-type */
import type { Plugin, PluginFactory, PluginHooks, UnknownServer } from '@blaize-types/index';

/**
 * Create a plugin with the given name, version, and setup function
 */
export function create<TConfig = any, TState = {}, TServices = {}>(
  name: string,
  version: string,
  setup: (
    app: UnknownServer,
    options: TConfig
  ) => void | Partial<PluginHooks> | Promise<void> | Promise<Partial<PluginHooks>>,
  defaultOptions: Partial<TConfig> = {}
): PluginFactory<TConfig, TState, TServices> {
  // Input validation
  if (!name || typeof name !== 'string') {
    throw new Error('Plugin name must be a non-empty string');
  }

  if (!version || typeof version !== 'string') {
    throw new Error('Plugin version must be a non-empty string');
  }

  if (typeof setup !== 'function') {
    throw new Error('Plugin setup must be a function');
  }

  // Return the factory function
  return function pluginFactory(userOptions?: Partial<TConfig>) {
    // Merge default options with user options
    const mergedOptions = { ...defaultOptions, ...userOptions } as TConfig;

    // Create the base plugin object
    const plugin: Plugin<TState, TServices> = {
      name,
      version,

      // The register hook calls the user's setup function
      register: async (app: UnknownServer) => {
        const result = await setup(app, mergedOptions);

        // If setup returns hooks, merge them into this plugin
        if (result && typeof result === 'object') {
          // Now we explicitly assign to our plugin object
          Object.assign(plugin, result);
        }
      },
    };

    return plugin;
  };
}
