import { PluginFactory, PluginHooks, Server } from '@blaizejs/types';

/**
 * Create a plugin with the given name, version, and setup function
 */
export function create<T = any>(
  name: string,
  version: string,
  setup: (app: Server, options: T) => void | PluginHooks | Promise<void> | Promise<PluginHooks>,
  _defaultOptions: Partial<T> = {}
): PluginFactory<T> {
  // Implementation placeholder
  throw new Error('Plugin system not yet available');
}
