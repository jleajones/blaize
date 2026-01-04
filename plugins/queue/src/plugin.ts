/* eslint-disable @typescript-eslint/no-empty-object-type */
/**
 * Queue Plugin Factory
 *
 * Creates a BlaizeJS plugin for background job processing.
 * Manages storage adapter lifecycle, QueueService creation,
 * and middleware registration.
 *
 * @packageDocumentation
 */
import { createPlugin, createMiddleware } from 'blaizejs';

import config from '../package.json';
import { QueueService } from './queue-service';
import { createInMemoryStorage } from './storage';

import type { QueuePluginConfig, QueuePluginServices, QueueStorageAdapter } from './types';
import type { Server } from 'blaizejs';

// ============================================================================
// Constants
// ============================================================================

/** Plugin name */
const PLUGIN_NAME = config.name;

/** Plugin version */
const PLUGIN_VERSION = config.version;

/** Default configuration values */
const DEFAULT_CONFIG = {
  defaultConcurrency: 5,
  defaultTimeout: 30000,
  defaultMaxRetries: 3,
} as const;

// ============================================================================
// Plugin Factory
// ============================================================================

/**
 * Create a queue plugin for BlaizeJS
 *
 * The queue plugin provides:
 * - Background job processing with priority scheduling
 * - Configurable retry logic with exponential backoff
 * - Multiple named queues with independent configurations
 * - Swappable storage backends (default: in-memory)
 * - Integration with BlaizeJS lifecycle and logging
 *
 * @example Basic usage with in-memory storage
 * ```typescript
 * import { createServer } from 'blaizejs';
 * import { createQueuePlugin } from '@blaizejs/queue';
 *
 * const server = createServer({
 *   plugins: [
 *     createQueuePlugin({
 *       queues: {
 *         emails: { concurrency: 5 },
 *         reports: { concurrency: 2, defaultTimeout: 120000 },
 *       },
 *     }),
 *   ],
 * });
 * ```
 *
 * @example With custom storage adapter
 * ```typescript
 * import { createQueuePlugin, createRedisStorage } from '@blaizejs/queue';
 *
 * const server = createServer({
 *   plugins: [
 *     createQueuePlugin({
 *       storage: createRedisStorage({ url: 'redis://localhost:6379' }),
 *       queues: {
 *         emails: { concurrency: 10 },
 *       },
 *     }),
 *   ],
 * });
 * ```
 *
 * @example Accessing queue in routes
 * ```typescript
 * import { createPostRoute } from 'blaizejs';
 *
 * export default createPostRoute()({
 *   handler: async (ctx) => {
 *     const jobId = await ctx.services.queue.add('emails', 'email:send', {
 *       to: 'user@example.com',
 *       subject: 'Hello',
 *     });
 *     return { jobId };
 *   },
 * });
 * ```
 */
export const createQueuePlugin = createPlugin<QueuePluginConfig, {}, QueuePluginServices>({
  name: PLUGIN_NAME,
  version: PLUGIN_VERSION,

  defaultConfig: {
    queues: {},
    defaultConcurrency: DEFAULT_CONFIG.defaultConcurrency,
    defaultTimeout: DEFAULT_CONFIG.defaultTimeout,
    defaultMaxRetries: DEFAULT_CONFIG.defaultMaxRetries,
  },

  setup: ({ config, logger }) => {
    // ========================================================================
    // Plugin-Scoped State (Closure Variables)
    // ========================================================================

    /**
     * Child logger with plugin context
     */
    const pluginLogger = logger.child({
      plugin: PLUGIN_NAME,
      version: PLUGIN_VERSION,
    });

    /**
     * Storage adapter instance
     * Initialized in `initialize()`, cleaned up in `onServerStop()`
     */
    let storage: QueueStorageAdapter;

    /**
     * Queue service instance
     * Created in `initialize()`, started in `onServerStart()`,
     * stopped in `onServerStop()`, cleaned up in `terminate()`
     */
    let queueService: QueueService;

    // ========================================================================
    // Lifecycle Hooks
    // ========================================================================

    return {
      /**
       * Register middleware and routes
       *
       * Called during `server.register()`.
       * Middleware exposes `QueueService` via `ctx.services.queue`.
       */
      register: async (server: Server<any, any>) => {
        pluginLogger.debug('Registering queue middleware');

        // Type assertion for server.use method
        const serverWithUse = server as { use: (middleware: unknown) => void };

        serverWithUse.use(
          createMiddleware<Record<string, never>, QueuePluginServices>({
            name: 'queue',

            handler: async ({ ctx, next }) => {
              // Expose queue service to route handlers
              ctx.services.queue = queueService;
              await next();
            },
          })
        );

        pluginLogger.info('Queue middleware registered');
      },

      /**
       * Initialize resources
       *
       * Called before `server.listen()`.
       * Sets up storage adapter and creates QueueService.
       */
      initialize: async () => {
        pluginLogger.info('Initializing queue plugin', {
          queues: Object.keys(config.queues),
          queueCount: Object.keys(config.queues).length,
          hasCustomStorage: !!config.storage,
        });

        // Use provided storage or default to in-memory
        storage = config.storage ?? createInMemoryStorage();

        // Connect if adapter supports it
        if (storage.connect) {
          pluginLogger.info('Connecting to storage adapter...');
          try {
            await storage.connect();
            pluginLogger.info('Storage adapter connected');
          } catch (error) {
            pluginLogger.error('Failed to connect storage adapter', {
              error: error instanceof Error ? error.message : String(error),
            });
            throw error;
          }
        }

        // Build queue configurations with defaults applied
        const queuesConfig: Record<
          string,
          {
            concurrency?: number;
            defaultTimeout?: number;
            defaultMaxRetries?: number;
          }
        > = {};

        for (const [name, queueConfig] of Object.entries(config.queues)) {
          queuesConfig[name] = {
            concurrency: queueConfig.concurrency ?? config.defaultConcurrency,
            defaultTimeout: queueConfig.defaultTimeout ?? config.defaultTimeout,
            defaultMaxRetries: queueConfig.defaultMaxRetries ?? config.defaultMaxRetries,
          };
        }

        // Create queue service
        queueService = new QueueService({
          queues: queuesConfig,
          storage,
          logger: pluginLogger,
        });

        // Register handlers from config
        if (config.handlers) {
          let handlerCount = 0;

          for (const [queueName, jobTypes] of Object.entries(config.handlers)) {
            for (const [jobType, handler] of Object.entries(jobTypes)) {
              queueService.registerHandler(queueName, jobType, handler);
              handlerCount++;
              pluginLogger.debug('Handler registered from config', {
                queueName,
                jobType,
              });
            }
          }

          pluginLogger.info('Handlers registered from config', {
            handlerCount,
            queues: Object.keys(config.handlers),
          });
        }

        pluginLogger.info('Queue plugin initialized', {
          queues: Object.keys(config.queues),
        });
      },

      /**
       * Server started listening
       *
       * Called after `server.listen()` succeeds.
       * Starts queue processing.
       */
      onServerStart: async () => {
        pluginLogger.info('Starting queue processing');

        try {
          await queueService.startAll();
          pluginLogger.info('Queue processing started', {
            queues: queueService.listQueues(),
          });
        } catch (error) {
          pluginLogger.error('Failed to start queue processing', {
            error: error instanceof Error ? error.message : String(error),
          });
          throw error;
        }
      },

      /**
       * Server stopping
       *
       * Called when `server.close()` is initiated.
       * Stops queue processing and disconnects storage.
       */
      onServerStop: async () => {
        pluginLogger.info('Stopping queue plugin');

        // Stop all queues gracefully
        try {
          await queueService.stopAll({ graceful: true, timeout: 30000 });
          pluginLogger.info('Queue processing stopped');
        } catch (error) {
          pluginLogger.error('Error stopping queue processing', {
            error: error instanceof Error ? error.message : String(error),
          });
          // Continue cleanup even if stop fails
        }

        // Disconnect storage if adapter supports it
        if (storage.disconnect) {
          pluginLogger.info('Disconnecting storage adapter...');
          try {
            await storage.disconnect();
            pluginLogger.info('Storage adapter disconnected');
          } catch (error) {
            pluginLogger.error('Error disconnecting storage adapter', {
              error: error instanceof Error ? error.message : String(error),
            });
            // Continue cleanup even if disconnect fails
          }
        }

        // Flush logs before exit
        if (pluginLogger.flush) {
          await pluginLogger.flush();
        }
      },

      /**
       * Cleanup resources
       *
       * Called after server is closed.
       * Final cleanup of references.
       */
      terminate: async () => {
        pluginLogger.debug('Terminating queue plugin');

        // Clear references to allow garbage collection
        queueService = null as unknown as QueueService;
        storage = null as unknown as QueueStorageAdapter;

        pluginLogger.debug('Queue plugin terminated');
      },
    };
  },
});

// ============================================================================
// Re-exports for Convenience
// ============================================================================

/**
 * Re-export QueueService for type declarations
 */
export { QueueService };
