import type { Plugin, PluginFactory, PluginSetup } from '@blaize-types/plugins';

/**
 * Create a typed plugin with server and context type tracking
 * @template T - Options type
 * @template TServerMods - Server modifications this plugin makes
 * @template TContextMods - Context modifications this plugin makes
 */
export function create<T = any, TServerMods = unknown, TContextMods = unknown>(
  name: string,
  version: string,
  setup: PluginSetup<T, TServerMods>,
  defaultOptions: Partial<T> = {}
): PluginFactory<T, TServerMods, TContextMods> {
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
    const plugin: Plugin<TServerMods, TContextMods> = {
      name,
      version,

      // Type manifest for compile-time tracking
      _types: {
        serverMods: undefined as unknown as TServerMods,
        contextMods: undefined as unknown as TContextMods,
      },

      // The register hook calls the user's setup function
      register: async app => {
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
