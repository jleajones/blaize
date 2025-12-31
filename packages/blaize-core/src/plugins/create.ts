/* eslint-disable @typescript-eslint/no-empty-object-type */
import { createLogger } from '../logger';

import type {
  Plugin,
  PluginFactory,
  CreatePluginOptions,
  BlaizeLogger,
  State,
  Services,
} from '@blaize-types/index';

/**
 * Create a type-safe plugin with full IntelliSense support
 *
 * This is the primary way to create plugins in BlaizeJS. It provides:
 * - IntelliSense for all lifecycle hooks
 * - Automatic config merging with defaults
 * - Full type safety for state and services
 * - EventBus integration for event-driven architecture
 * - Consistent DX with createMiddleware
 *
 * @template TConfig - Plugin configuration shape
 * @template TState - State added to context (default: {})
 * @template TServices - Services added to context (default: {})
 * @template TEvents - Event schemas for the EventBus (default: EventSchemas)
 *
 * @param options - Plugin creation options
 * @returns Plugin factory function
 *
 * @example Basic plugin with config and EventBus
 * ```typescript
 * const createDbPlugin = create<
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
 *   setup: ({ config, logger, eventBus }) => {
 *     let db: Database;
 *
 *     // Subscribe to events during setup
 *     eventBus.subscribe('server:shutdown', async () => {
 *       logger.info('Shutting down database connection');
 *     });
 *
 *     return {
 *       register: async (server) => {
 *         // Add typed middleware
 *         server.use(createMiddleware<{}, { db: Database }>({
 *           handler: async ({ ctx, next }) => {
 *             ctx.services.db = db;
 *             await next();
 *           },
 *         }));
 *       },
 *
 *       initialize: async () => {
 *         db = await Database.connect(config);
 *         // Publish event when ready
 *         await eventBus.publish('db:connected', { host: config.host });
 *       },
 *
 *       terminate: async () => {
 *         await eventBus.publish('db:disconnecting', {});
 *         await db?.close();
 *       },
 *     };
 *   },
 * });
 *
 * // Usage - pass eventBus from server
 * const plugin = createDbPlugin({ host: 'prod.db.com' }, server.eventBus);
 * ```
 *
 * @example Simple plugin without config
 * ```typescript
 * const loggerPlugin = create<{}, {}, { logger: Logger }>({
 *   name: '@my-app/logger',
 *   version: '1.0.0',
 *   setup: ({ logger, eventBus }) => ({
 *     initialize: async () => {
 *       logger.info('Logger initialized');
 *       await eventBus.publish('logger:ready', {});
 *     },
 *   }),
 * });
 *
 * // Usage - eventBus still required
 * const plugin = loggerPlugin(undefined, server.eventBus);
 * ```
 */

export function create<
  TConfig = {},
  TState extends State = State,
  TServices extends Services = Services,
>(
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

    // Create plugin-specific child logger with context
    const pluginLogger: BlaizeLogger = createLogger().child({
      plugin: options.name,
      version: options.version,
    });

    let hooks: ReturnType<typeof options.setup> | null = null;
    let setupComplete = false;

    // Build plugin with all hooks
    const plugin: Plugin<TState, TServices> = {
      name: options.name,
      version: options.version,

      // Required hook (always present, even if empty)
      register: async server => {
        if (!setupComplete) {
          hooks = options.setup({
            config,
            logger: pluginLogger,
            eventBus: server.eventBus,
          });

          // Validate hooks (must return object)
          if (hooks === null || typeof hooks !== 'object') {
            throw new Error(
              `Plugin "${options.name}" setup() must return an object with lifecycle hooks`
            );
          }
          setupComplete = true;
        }
        if (hooks?.register) {
          await hooks.register(server);
        } else {
          pluginLogger.debug('Plugin registered (no register hook)');
        }
      },

      // Optional hooks (undefined if not provided)
      initialize: async server => {
        if (!setupComplete) {
          throw new Error(
            `Plugin "${options.name}" initialize() called before register(). ` +
              `Plugins must be registered to the server before initialization.`
          );
        }

        if (hooks?.initialize) {
          await hooks.initialize(server);
        }
      },
      onServerStart: async server => {
        if (!setupComplete) {
          throw new Error(
            `Plugin "${options.name}" onServerStart() called before register(). ` +
              `Plugins must be registered to the server before initialization.`
          );
        }

        if (hooks?.onServerStart) {
          await hooks.onServerStart(server);
        }
      },
      onServerStop: async server => {
        if (!setupComplete) {
          return;
        }

        if (hooks?.onServerStop) {
          await hooks.onServerStop(server);
        }
      },
      terminate: async server => {
        if (!setupComplete) {
          return;
        }

        if (hooks?.terminate) {
          await hooks.terminate(server);
        }
      },
    };

    return plugin;
  };
}
