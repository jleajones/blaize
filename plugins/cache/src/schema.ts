/**
 * Cache Plugin Schemas
 *
 * Type-safe schemas for cache route validation and event bus coordination using Zod.
 *
 * ## Schema Categories:
 * 1. **Query Parameters** - Route query validation
 * 2. **Response Bodies** - HTTP response validation
 * 3. **SSE Events** - Server-Sent Events for browser clients
 * 4. **EventBus Events** - Server-to-server coordination
 *
 * @module @blaizejs/plugin-cache/schema
 * @packageDocumentation
 */

import { z } from 'zod';

// ============================================================================
// Query Parameter Schemas
// ============================================================================

/**
 * Cache events SSE query parameters
 *
 * @example
 * ```typescript
 * // Match all user keys
 * GET /cache/events?pattern=user:*
 *
 * // Match specific pattern
 * GET /cache/events?pattern=session:.*
 * ```
 */
export const cacheEventsQuerySchema = z.object({
  /**
   * Key pattern to filter events (glob or regex)
   *
   * Examples:
   * - "user:*" - All user keys
   * - "session:.*" - All session keys (regex)
   * - ".*" - All keys (default)
   */
  pattern: z.string().optional(),
});

/**
 * Cache dashboard query parameters
 *
 * @example
 * ```typescript
 * // Auto-refresh every 30 seconds
 * GET /cache/dashboard?refresh=30
 * ```
 */
export const cacheDashboardQuerySchema = z.object({
  /**
   * Auto-refresh interval in seconds
   *
   * When provided, dashboard will automatically reload.
   */
  refresh: z.string().optional(),
});

// ============================================================================
// Response Schemas
// ============================================================================

/**
 * Cache statistics response schema
 */
export const cacheStatsResponseSchema = z.object({
  /**
   * Raw cache statistics from adapter
   */
  stats: z.object({
    /** Total cache hits */
    hits: z.number().int().min(0),

    /** Total cache misses */
    misses: z.number().int().min(0),

    /** Total evictions (LRU + TTL) */
    evictions: z.number().int().min(0),

    /** Memory usage in bytes */
    memoryUsage: z.number().int().min(0),

    /** Current number of entries */
    entryCount: z.number().int().min(0),

    /** Uptime in milliseconds (optional) */
    uptime: z.number().int().min(0).optional(),
  }),

  /**
   * Calculated hit rate (hits / total requests)
   *
   * Range: 0.0 - 1.0
   */
  hitRate: z.number().min(0).max(1),

  /**
   * Response timestamp in milliseconds
   */
  timestamp: z.number().int().positive(),
});

// ============================================================================
// SSE Event Schemas (Server → Browser Clients)
// ============================================================================

/**
 * Cache set event (key was added/updated)
 *
 * Sent to browser clients via SSE when cache entries are modified.
 */
export const cacheSseSetEventSchema = z.object({
  type: z.literal('set'),
  key: z.string().min(1),
  value: z.string().optional(),
  timestamp: z.string(),
  serverId: z.string().optional(),
  sequence: z.number().int().optional(),
});

/**
 * Cache delete event (key was removed)
 *
 * Sent to browser clients via SSE when cache entries are deleted.
 */
export const cacheSseDeleteEventSchema = z.object({
  type: z.literal('delete'),
  key: z.string().min(1),
  timestamp: z.string(),
  serverId: z.string().optional(),
  sequence: z.number().int().optional(),
});

/**
 * Cache eviction event (key was evicted due to LRU or TTL)
 *
 * Sent to browser clients via SSE when cache entries are evicted.
 */
export const cacheSseEvictionEventSchema = z.object({
  type: z.literal('eviction'),
  key: z.string().min(1),
  reason: z.enum(['lru', 'ttl']).optional(),
  timestamp: z.string(),
  serverId: z.string().optional(),
  sequence: z.number().int().optional(),
});

/**
 * SSE event schemas for cache monitoring routes
 *
 * Used for Server-Sent Events to browser clients.
 * Provides real-time cache change notifications.
 *
 * @example
 * ```typescript
 * // SSE route definition
 * export const getCacheEvents = appRouter.sse({
 *   schema: {
 *     query: cacheEventsQuerySchema,
 *     events: cacheSseEventSchemas,  // ← SSE events for browsers
 *   },
 *   handler: cacheEventsHandler,
 * });
 * ```
 *
 * @example Browser client
 * ```javascript
 * const eventSource = new EventSource('/cache/events');
 *
 * eventSource.addEventListener('cache.set', (e) => {
 *   const data = JSON.parse(e.data);
 *   console.log('Key set:', data.key, data.value);
 * });
 *
 * eventSource.addEventListener('cache.delete', (e) => {
 *   const data = JSON.parse(e.data);
 *   console.log('Key deleted:', data.key);
 * });
 * ```
 */
export const cacheSseEventSchemas = {
  'cache.set': cacheSseSetEventSchema,
  'cache.delete': cacheSseDeleteEventSchema,
  'cache.eviction': cacheSseEvictionEventSchema,
} as const;

// ============================================================================
// EventBus Event Schemas (Server → Server Coordination)
// ============================================================================

/**
 * Cache invalidation event schema
 *
 * Published when cache entries are modified (set, delete, eviction).
 * Used for cross-server cache coordination via EventBus.
 *
 * @example
 * ```typescript
 * // Server A sets a key
 * await server.eventBus.publish('cache:invalidated', {
 *   operation: 'set',
 *   key: 'user:123',
 *   value: '{"name":"Alice"}',
 *   timestamp: Date.now(),
 *   serverId: 'server-a',
 * });
 *
 * // Server B receives the event and updates its local cache
 * server.eventBus.subscribe('cache:invalidated', async (event) => {
 *   if (event.data.operation === 'delete') {
 *     await localCache.delete(event.data.key);
 *   }
 * });
 * ```
 */
export const cacheInvalidationEventSchema = z.object({
  /**
   * Type of cache operation that triggered invalidation
   */
  operation: z.enum(['set', 'delete', 'eviction']),

  /**
   * Cache key that was invalidated
   */
  key: z.string(),

  /**
   * New value (for 'set' operations only)
   */
  value: z.string().optional(),

  /**
   * Timestamp when invalidation occurred (milliseconds since epoch)
   */
  timestamp: z.number(),

  /**
   * ID of server that triggered the invalidation
   */
  serverId: z.string(),

  /**
   * Sequence number for ordering events from same server
   */
  sequence: z.number().optional(),
});

/**
 * EventBus schemas for server-to-server cache coordination
 *
 * Export these schemas to include in your server configuration.
 * The server will automatically type the EventBus with all provided schemas.
 *
 * @example Include in server config
 * ```typescript
 * import { createServer } from 'blaizejs';
 * import { cacheEventBusSchemas } from '@blaizejs/plugin-cache';
 *
 * const server = createServer({
 *   eventSchemas: {
 *     ...cacheEventBusSchemas,     // Cache plugin events
 *     // ... other plugin schemas
 *     // ... your app schemas
 *   },
 *   plugins: [
 *     createCachePlugin({ serverId: 'server-a' }),
 *   ],
 * });
 *
 * // server.eventBus is now fully typed with cache events!
 * server.eventBus.subscribe('cache:invalidated', (event) => {
 *   // event.data is automatically typed as CacheInvalidationEvent
 *   console.log(event.data.operation);
 * });
 * ```
 *
 * @example Type extraction for utilities
 * ```typescript
 * import type { CacheInvalidationEvent } from '@blaizejs/plugin-cache';
 *
 * function handleCacheInvalidation(data: CacheInvalidationEvent) {
 *   if (data.operation === 'delete') {
 *     console.log('Cache deleted:', data.key);
 *   }
 * }
 * ```
 */
export const cacheEventBusSchemas = {
  'cache:invalidated': cacheInvalidationEventSchema,
} as const;

// ============================================================================
// Inferred TypeScript Types
// ============================================================================

/**
 * Cache events query parameters (inferred from schema)
 */
export type CacheEventsQuery = z.infer<typeof cacheEventsQuerySchema>;

/**
 * Cache dashboard query parameters (inferred from schema)
 */
export type CacheDashboardQuery = z.infer<typeof cacheDashboardQuerySchema>;

/**
 * Cache stats response (inferred from schema)
 */
export type CacheStatsResponse = z.infer<typeof cacheStatsResponseSchema>;

/**
 * Cache SSE set event (inferred from schema)
 */
export type CacheSseSetEvent = z.infer<typeof cacheSseSetEventSchema>;

/**
 * Cache SSE delete event (inferred from schema)
 */
export type CacheSseDeleteEvent = z.infer<typeof cacheSseDeleteEventSchema>;

/**
 * Cache SSE eviction event (inferred from schema)
 */
export type CacheSseEvictionEvent = z.infer<typeof cacheSseEvictionEventSchema>;

/**
 * Cache invalidation event for EventBus (inferred from schema)
 */
export type CacheInvalidationEvent = z.infer<typeof cacheInvalidationEventSchema>;
