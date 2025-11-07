/* eslint-disable @typescript-eslint/no-empty-object-type */
import type { Plugin, PluginFactory, CreatePluginOptions } from '@blaize-types/index';

/**
 * Create a type-safe plugin with full IntelliSense support
 *
 * This is the primary way to create plugins in BlaizeJS. It provides:
 * - IntelliSense for all lifecycle hooks
 * - Automatic config merging with defaults
 * - Full type safety for state and services
 * - Consistent DX with createMiddleware
 *
 * @template TConfig - Plugin configuration shape
 * @template TState - State added to context (default: {})
 * @template TServices - Services added to context (default: {})
 *
 * @param options - Plugin creation options
 * @returns Plugin factory function
 *
 * @example Basic plugin with config
 * ```typescript
 * const createDbPlugin = createPlugin<
 *   { host: string; port: number },
 *   {},
 *   { db: Database }
 * >({
 *   name: '@my-app/database',
 *   version: '1.0.0',
 *   defaultConfig: {
 *     host: 'localhost',
 *     port: 5432,
 *   },
 *   setup: (config) => {
 *     let db: Database;
 *
 *     return {
 *       register: async (server) => {
 *         // Add typed middleware
 *         server.use(createMiddleware<{}, { db: Database }>({
 *           handler: async (ctx, next) => {
 *             ctx.services.db = db;
 *             await next();
 *           },
 *         }));
 *       },
 *
 *       initialize: async () => {
 *         db = await Database.connect(config);
 *       },
 *
 *       terminate: async () => {
 *         await db?.close();
 *       },
 *     };
 *   },
 * });
 *
 * // Usage
 * const plugin = createDbPlugin({ host: 'prod.db.com' });
 * ```
 *
 * @example Simple plugin without config
 * ```typescript
 * const loggerPlugin = createPlugin<{}, {}, { logger: Logger }>({
 *   name: '@my-app/logger',
 *   version: '1.0.0',
 *   setup: () => ({
 *     initialize: async () => {
 *       console.log('Logger initialized');
 *     },
 *   }),
 * });
 *
 * // Usage (no config needed)
 * const plugin = loggerPlugin();
 * ```
 */
export function createPlugin<TConfig = {}, TState = {}, TServices = {}>(
  options: CreatePluginOptions<TConfig, TState, TServices>
): PluginFactory<TConfig, TState, TServices> {
  // Validate inputs
  if (!options.name || typeof options.name !== 'string') {
    throw new Error('Plugin name must be a non-empty string');
  }

  if (!options.version || typeof options.version !== 'string') {
    throw new Error('Plugin version must be a non-empty string');
  }

  if (typeof options.setup !== 'function') {
    throw new Error('Plugin setup must be a function');
  }

  // Return factory function
  return function pluginFactory(userConfig?: Partial<TConfig>): Plugin<TState, TServices> {
    // Merge config (defaultConfig + userConfig)
    const config = {
      ...(options.defaultConfig || ({} as TConfig)),
      ...(userConfig || {}),
    } as TConfig;

    // Call setup to get hooks
    const hooks = options.setup(config);

    // Validate hooks (must return object)
    if (hooks === null || typeof hooks !== 'object') {
      throw new Error(
        `Plugin "${options.name}" setup() must return an object with lifecycle hooks`
      );
    }

    // Build plugin with all hooks
    const plugin: Plugin<TState, TServices> = {
      name: options.name,
      version: options.version,

      // Required hook (always present, even if empty)
      register: hooks.register || (async () => {}),

      // Optional hooks (undefined if not provided)
      initialize: hooks.initialize,
      onServerStart: hooks.onServerStart,
      onServerStop: hooks.onServerStop,
      terminate: hooks.terminate,
    };

    return plugin;
  };
}

// Re-export for backward compatibility (deprecate later)
export { createPlugin as create };
