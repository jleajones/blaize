/**
 * @blaizejs/plugin-cache
 *
 * Event-driven cache plugin for BlaizeJS with Redis support
 * and multi-server coordination via pub/sub.
 *
 * @packageDocumentation
 */

import { createPlugin, createMiddleware } from 'blaizejs';

import { CacheService } from './cache-service';
import { MemoryAdapter, RedisAdapter } from './storage';
import pkg from '../package.json';

import type { CacheAdapter, CachePluginConfig, CachePluginServices, RedisPubSub } from './types';
import type { Server } from 'blaizejs';

/**
 * Create cache plugin for BlaizeJS
 *
 * Provides event-driven cache with automatic event emission,
 * pattern-based watching, and multi-server coordination.
 *
 * @param config - Plugin configuration
 * @returns BlaizeJS plugin
 *
 * @example
 * ```typescript
 * import { createServer } from 'blaizejs';
 * import { createCachePlugin } from '@blaizejs/plugin-cache';
 *
 * const server = createServer({
 *   plugins: [
 *     createCachePlugin({
 *       maxEntries: 1000,
 *       defaultTtl: 3600,
 *     }),
 *   ],
 * });
 * ```
 *
 * @example With custom adapter
 * ```typescript
 * import { createCachePlugin, RedisAdapter } from '@blaizejs/plugin-cache';
 *
 * const server = createServer({
 *   plugins: [
 *     createCachePlugin({
 *       adapter: new RedisAdapter({
 *         host: 'localhost',
 *         port: 6379,
 *       }),
 *     }),
 *   ],
 * });
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export const createCachePlugin = createPlugin<CachePluginConfig, {}, CachePluginServices>({
  name: pkg.name,
  version: pkg.version,

  defaultConfig: {
    maxEntries: 1000,
    defaultTtl: 3600,
  },

  setup: ({ config, logger }) => {
    // ========================================================================
    // Plugin Logger
    // ========================================================================

    const pluginLogger = logger.child({
      plugin: pkg.name,
      version: pkg.version,
    });

    // ========================================================================
    // Closure Variables (Singletons)
    // ========================================================================

    let adapter: CacheAdapter;
    let pubsub: RedisPubSub | undefined;
    let cacheService: CacheService;

    // ========================================================================
    // Lifecycle Hooks
    // ========================================================================

    return {
      /**
       * Register hook - Add middleware to server
       *
       * ⚠️ CRITICAL: Middleware MUST be registered here, NOT in setup body.
       * This ensures middleware is added during the correct lifecycle phase.
       */
      register: async (server: Server<any, any>) => {
        pluginLogger.debug('Registering cache middleware');

        server.use(
          // eslint-disable-next-line @typescript-eslint/no-empty-object-type
          createMiddleware<{}, CachePluginServices>({
            name: 'cache',
            handler: async ({ ctx, next }) => {
              // Expose cache service to routes via ctx.services
              ctx.services.cache = cacheService;
              await next();
            },
          })
        );

        pluginLogger.info('Cache middleware registered', {
          middleware: 'cache',
        });
      },

      /**
       * Initialize hook - Create resources before server starts
       *
       * Called before server.listen().
       * This is where we create the adapter and service.
       */
      initialize: async () => {
        pluginLogger.info('Initializing cache plugin', {
          adapterProvided: !!config.adapter,
          maxEntries: config.maxEntries,
          defaultTtl: config.defaultTtl,
          serverId: config.serverId,
        });

        // Create adapter (use provided or default to MemoryAdapter)
        adapter =
          config.adapter ??
          new MemoryAdapter({
            maxEntries: config.maxEntries ?? 1000,
            defaultTtl: config.defaultTtl,
          });

        // Connect to adapter if it supports connections
        if (adapter.connect) {
          pluginLogger.debug('Connecting to cache adapter');
          await adapter.connect();
          pluginLogger.info('Cache adapter connected', {
            adapter: adapter.constructor.name,
          });
        }

        if (config.serverId && adapter instanceof RedisAdapter) {
          pubsub = adapter.createPubSub(config.serverId);
          await pubsub.connect();

          pluginLogger.info('Redis pub/sub connected', {
            serverId: config.serverId,
          });
        }

        // Create cache service
        cacheService = new CacheService({
          adapter,
          pubsub,
          serverId: config.serverId,
          logger: pluginLogger,
        });

        // Initialize service
        await cacheService.init();

        pluginLogger.info('Cache plugin initialized', {
          adapter: adapter.constructor.name,
        });
      },

      /**
       * Server start hook - Called after server starts listening
       *
       * Optional: Can be used for warmup, health checks, etc.
       */
      onServerStart: async () => {
        pluginLogger.info('Cache plugin started', {
          adapter: adapter.constructor.name,
        });

        // Optional: Perform health check
        const health = await cacheService.healthCheck();
        if (!health.healthy) {
          pluginLogger.warn('Cache health check failed', {
            message: health.message,
            details: health.details,
          });
        }
      },

      /**
       * Server stop hook - Called when server.close() is initiated
       *
       * Optional: Can be used to stop accepting new work.
       */
      onServerStop: async () => {
        pluginLogger.info('Cache plugin stopping');
      },

      /**
       * Terminate hook - Cleanup resources after server stops
       *
       * Called after server is closed.
       * This is where we disconnect the adapter and cleanup.
       */
      terminate: async () => {
        pluginLogger.info('Terminating cache plugin');

        // Disconnect adapter if it supports connections
        if (adapter?.disconnect) {
          pluginLogger.debug('Disconnecting cache adapter');
          await adapter.disconnect();
          pluginLogger.info('Cache adapter disconnected');
        }

        // Disconnect service (removes all listeners)
        if (cacheService) {
          await cacheService.disconnect();
        }

        pluginLogger.info('Cache plugin terminated');
      },
    };
  },
});
