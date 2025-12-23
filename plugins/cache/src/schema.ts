/**
 * Cache Plugin Route Schemas
 *
 * Type-safe schemas for cache route validation using Zod.
 * These schemas validate query parameters, response bodies, and SSE events.
 *
 * @module @blaizejs/plugin-cache/schemas
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
// SSE Event Schemas
// ============================================================================

/**
 * Cache set event (key was added/updated)
 */
export const cacheSetEventSchema = z.object({
  type: z.literal('set'),
  key: z.string().min(1),
  value: z.string().optional(),
  timestamp: z.string(),
  serverId: z.string().optional(),
  sequence: z.number().int().optional(),
});

/**
 * Cache delete event (key was removed)
 */
export const cacheDeleteEventSchema = z.object({
  type: z.literal('delete'),
  key: z.string().min(1),
  timestamp: z.string(),
  serverId: z.string().optional(),
  sequence: z.number().int().optional(),
});

/**
 * Cache eviction event (key was evicted due to LRU or TTL)
 */
export const cacheEvictionEventSchema = z.object({
  type: z.literal('eviction'),
  key: z.string().min(1),
  reason: z.enum(['lru', 'ttl']).optional(),
  timestamp: z.string(),
  serverId: z.string().optional(),
  sequence: z.number().int().optional(),
});

/**
 * Discriminated union of all cache event types
 *
 * Used for SSE event validation.
 */
export const cacheEventsSchema = {
  'cache.set': cacheSetEventSchema,
  'cache.delete': cacheDeleteEventSchema,
  'cache.eviction': cacheEvictionEventSchema,
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
 * Cache set event (inferred from schema)
 */
export type CacheSetEvent = z.infer<typeof cacheSetEventSchema>;

/**
 * Cache delete event (inferred from schema)
 */
export type CacheDeleteEvent = z.infer<typeof cacheDeleteEventSchema>;

/**
 * Cache eviction event (inferred from schema)
 */
export type CacheEvictionEvent = z.infer<typeof cacheEvictionEventSchema>;
