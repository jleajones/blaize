/**
 * @blaizejs/plugin-cache
 *
 * Event-driven cache plugin for BlaizeJS with Redis support
 * and multi-server coordination via pub/sub.
 *
 * @packageDocumentation
 */
import config from '../package.json';

export type {
  CacheAdapter,
  CacheStats,
  MemoryAdapterConfig,
  CacheChangeEvent,
  CacheWatchHandler,
  CachePluginConfig,
  CachePluginServices,
} from './types';

/**
 * Create cache plugin for BlaizeJS
 */
export { createCachePlugin } from './plugin';

/**
 * Cache service with automatic event emission
 */
export { CacheService } from './cache-service';

/**
 * Memory cache adapter with LRU eviction and TTL support
 */
export { MemoryAdapter } from './storage';

/**
 * Route schema for cache management
 */
export {
  cacheEventsQuerySchema,
  cacheStatsResponseSchema,
  cacheDashboardQuerySchema,
  cacheSseDeleteEventSchema,
  cacheSseEventSchemas,
  cacheSseEvictionEventSchema,
  cacheSseSetEventSchema,
  cacheInvalidationEventSchema,
  cacheEventBusSchemas,
} from './schema';

/**
 * Routes and handlers for cache management
 */
export {
  cacheStatsHandler,
  cacheDashboardHandler,
  cacheEventsHandler,
  cachePrometheusHandler,
} from './routes';

// Placeholder exports - will be implemented in subsequent tasks
export const version = config.version;
