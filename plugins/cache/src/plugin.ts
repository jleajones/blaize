/**
 * @blaizejs/plugin-cache
 *
 * Event-driven cache plugin for BlaizeJS with Redis support
 * and multi-server coordination via EventBus.
 *
 * @packageDocumentation
 */

import { createPlugin, createMiddleware } from 'blaizejs';

import { CacheService } from './cache-service';
import { MemoryAdapter } from './storage';
import pkg from '../package.json';

import type { CacheAdapter, CachePluginConfig, CachePluginServices } from './types';
import type { Server } from 'blaizejs';

// ========================================================================
// Service Factory
// ========================================================================
let _cacheService: CacheService | null = null;

export function getCacheService(): CacheService {
  if (!_cacheService) {
    throw new Error(
      'Cache service not initialized. ' +
        'Make sure you have registered the cache plugin with createCachePlugin().'
    );
  }
  return _cacheService;
}

function _initializeCacheService(service: CacheService) {
  _cacheService = service;
}

function _terminateCacheService() {
  _cacheService = null;
}

/**
 * Create cache plugin for BlaizeJS
 *
 * Provides event-driven cache with automatic event emission,
 * pattern-based watching, and multi-server coordination via EventBus.
 *
 * **Multi-Server Coordination:**
 * The plugin automatically uses `server.eventBus` for cross-server cache invalidation
 * when `serverId` is provided. No additional configuration needed!
 *
 * @param config - Plugin configuration
 * @returns BlaizeJS plugin
 *
 * @example Basic usage (single server)
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
 * @example Multi-server with EventBus
 * ```typescript
 * import { createServer } from 'blaizejs';
 * import { createCachePlugin, RedisAdapter } from '@blaizejs/plugin-cache';
 *
 * const server = createServer({
 *   plugins: [
 *     createCachePlugin({
 *       adapter: new RedisAdapter({ host: 'localhost' }),
 *       serverId: process.env.SERVER_ID || 'server-1',
 *       // EventBus from server.eventBus is used automatically!
 *     }),
 *   ],
 * });
 * ```
 *
 * @example Custom adapter
 * ```typescript
 * createCachePlugin({
 *   adapter: new CustomAdapter(),
 *   serverId: 'my-server',
 * })
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
              ctx.services.cache = getCacheService();
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
      initialize: async (server: Server<any, any>) => {
        pluginLogger.info('Initializing cache plugin', {
          adapterProvided: !!config.adapter,
          maxEntries: config.maxEntries,
          defaultTtl: config.defaultTtl,
          serverId: config.serverId,
          hasEventBus: !!server.eventBus,
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

        // Create cache service with EventBus from server
        _initializeCacheService(
          new CacheService({
            adapter,
            eventBus: server.eventBus, // ← EventBus for multi-server coordination
            serverId: config.serverId,
            logger: pluginLogger,
          })
        );

        pluginLogger.info('Cache plugin initialized', {
          adapter: adapter.constructor.name,
          multiServer: !!server.eventBus && !!config.serverId,
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
        const cacheService = getCacheService();
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
        const cacheService = getCacheService();
        await cacheService.disconnect();
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

        // Disconnect service (removes all listeners and EventBus subscriptions)
        _terminateCacheService();

        pluginLogger.info('Cache plugin terminated');
      },
    };
  },
});
