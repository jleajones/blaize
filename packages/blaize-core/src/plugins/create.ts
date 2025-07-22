import type { Plugin, PluginFactory, PluginHooks } from '@blaize-types/plugins';
import type { Server } from '@blaize-types/server';

/**
 * Create a plugin with the given name, version, and setup function
 */
export function create<T = any>(
  name: string,
  version: string,
  setup: (
    app: Server,
    options: T
  ) => void | Partial<PluginHooks> | Promise<void> | Promise<Partial<PluginHooks>>,
  defaultOptions: Partial<T> = {}
): PluginFactory<T> {
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
  return function pluginFactory(userOptions?: Partial<T>) {
    // Merge default options with user options
    const mergedOptions = { ...defaultOptions, ...userOptions } as T;

    // Create the base plugin object
    const plugin: Plugin = {
      name,
      version,

      // The register hook calls the user's setup function
      register: async (app: Server) => {
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
