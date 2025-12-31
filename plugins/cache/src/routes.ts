/**
 * Cache Plugin Route Handlers
 *
 * This module provides ready-to-use route handlers and schemas
 * for cache monitoring and real-time event streaming.
 *
 * ## SSE Handler (4-param signature)
 * - `cacheEventsHandler(stream, ctx, params, logger)` - Real-time cache change events
 *
 * ## HTTP Handlers (3-param signature)
 * - `cacheStatsHandler(ctx, params, logger)` - Cache statistics JSON
 * - `cachePrometheusHandler(ctx, params, logger)` - Prometheus metrics
 * - `cacheDashboardHandler(ctx, params, logger)` - HTML dashboard
 *
 * ## Query Schemas
 * - `cacheEventsQuerySchema` - SSE stream query params
 * - `cacheDashboardQuerySchema` - Dashboard query params
 *
 * ## Response Schemas
 * - `cacheStatsResponseSchema` - Stats endpoint response
 * - `cacheEventsSchema` - SSE event schemas (discriminated union)
 *
 * @example SSE Route Assembly
 * ```typescript
 * // routes/cache/events.ts
 * import { createSSERoute } from 'blaizejs';
 * import {
 *   cacheEventsHandler,
 *   cacheEventsQuerySchema,
 *   cacheEventsSchema,
 * } from '@blaizejs/plugin-cache';
 *
 * export default createSSERoute()({
 *   schema: {
 *     query: cacheEventsQuerySchema,
 *     events: cacheEventsSchema,
 *   },
 *   handler: cacheEventsHandler,
 * });
 * ```
 *
 * @example HTTP Route Assembly
 * ```typescript
 * // routes/cache/stats.ts
 * import { createGetRoute } from 'blaizejs';
 * import { cacheStatsHandler } from '@blaizejs/plugin-cache';
 *
 * export default createGetRoute()({
 *   handler: cacheStatsHandler,
 * });
 * ```
 *
 * @module @blaizejs/plugin-cache/routes
 * @packageDocumentation
 */

import { ServiceNotAvailableError, InternalServerError, getCorrelationId } from 'blaizejs';

import { gatherDashboardData, renderDashboard } from './dashboard';

import type { CacheService } from './cache-service';
import type {
  CacheDashboardQuery,
  CacheEventsQuery,
  cacheEventsSchema,
  CacheStatsResponse,
} from './schema';
import type { TypedSSEStream, Context, BlaizeLogger } from 'blaizejs';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get CacheService from context or throw ServiceNotAvailableError
 *
 * @param ctx - BlaizeJS context object
 * @returns CacheService instance
 * @throws ServiceNotAvailableError if cache service is not available
 *
 * @internal
 */
function getCacheServiceOrThrow(ctx: Context): CacheService {
  // Type assertion: cache plugin middleware injects CacheService into services
  const services = ctx.services as { cache?: CacheService };

  if (!services.cache) {
    throw new ServiceNotAvailableError(
      'Cache service unavailable',
      {
        service: 'cache',
        reason: 'dependency_down',
        suggestion: 'Ensure the cache plugin is properly registered with the server',
      },
      getCorrelationId()
    );
  }

  return services.cache;
}

// Create a type alias for your specific stream type
export type CacheSSEStream = TypedSSEStream<typeof cacheEventsSchema>;

// ============================================================================
// Route Handlers
// ============================================================================

/**
 * Cache statistics handler
 *
 * Returns cache statistics as JSON including hits, misses, evictions,
 * memory usage, and uptime.
 *
 * ## Response Shape
 * ```json
 * {
 *   "stats": {
 *     "hits": 1234,
 *     "misses": 56,
 *     "evictions": 12,
 *     "memoryUsage": 1048576,
 *     "entryCount": 450,
 *     "uptime": 3600000
 *   },
 *   "hitRate": 0.956,
 *   "timestamp": 1234567890
 * }
 * ```
 *
 * @example Route assembly
 * ```typescript
 * // routes/cache/stats.ts
 * import { createGetRoute } from 'blaizejs';
 * import { cacheStatsHandler } from '@blaizejs/plugin-cache';
 *
 * export default createGetRoute()({
 *   handler: cacheStatsHandler,
 * });
 * ```
 *
 * @param ctx - BlaizeJS request context
 * @param params - Route parameters (unused)
 * @param logger - BlaizeJS logger instance
 * @throws ServiceNotAvailableError if cache service unavailable
 * @throws InternalServerError if stats retrieval fails
 */
export const cacheStatsHandler = async ({
  ctx,
  logger,
}: {
  ctx: Context;
  logger: BlaizeLogger;
}): Promise<CacheStatsResponse> => {
  const cache = getCacheServiceOrThrow(ctx);

  logger.debug('Fetching cache statistics');

  try {
    const stats = await cache.getStats();
    const totalRequests = stats.hits + stats.misses;
    const hitRate = totalRequests > 0 ? stats.hits / totalRequests : 0;

    return {
      stats,
      hitRate: parseFloat(hitRate.toFixed(3)),
      timestamp: Date.now(),
    };
  } catch (error) {
    throw new InternalServerError(
      'Failed to retrieve cache statistics',
      {
        originalError: error instanceof Error ? error.message : String(error),
        component: 'cache-plugin',
        operation: 'getStats',
      },
      getCorrelationId()
    );
  }
};

/**
 * Prometheus metrics handler
 *
 * Returns cache metrics in Prometheus/OpenMetrics text format.
 * Suitable for scraping by Prometheus, Grafana Agent, or compatible tools.
 *
 * ## Metrics Exported
 * - `blaize_cache_hits_total` - Total cache hits
 * - `blaize_cache_misses_total` - Total cache misses
 * - `blaize_cache_evictions_total` - Total evictions (LRU + TTL)
 * - `blaize_cache_memory_bytes` - Current memory usage
 * - `blaize_cache_entries` - Current number of entries
 * - `blaize_cache_hit_rate` - Cache hit rate (0-1)
 *
 * @example Route assembly
 * ```typescript
 * // routes/cache/prometheus.ts
 * import { createGetRoute } from 'blaizejs';
 * import { cachePrometheusHandler } from '@blaizejs/plugin-cache';
 *
 * export default createGetRoute()({
 *   handler: cachePrometheusHandler,
 * });
 * ```
 *
 * @param ctx - BlaizeJS request context
 * @param params - Route parameters (unused)
 * @param logger - BlaizeJS logger instance
 * @throws ServiceNotAvailableError if cache service unavailable
 * @throws InternalServerError if metrics generation fails
 */
export const cachePrometheusHandler = async ({
  ctx,
  logger,
}: {
  ctx: Context;
  logger: BlaizeLogger;
}): Promise<void> => {
  const cache = getCacheServiceOrThrow(ctx);

  logger.debug('Generating Prometheus metrics');

  try {
    const stats = await cache.getStats();
    const totalRequests = stats.hits + stats.misses;
    const hitRate = totalRequests > 0 ? stats.hits / totalRequests : 0;

    const metrics: string[] = [
      '# HELP blaize_cache_hits_total Total number of cache hits',
      '# TYPE blaize_cache_hits_total counter',
      `blaize_cache_hits_total ${stats.hits}`,
      '',
      '# HELP blaize_cache_misses_total Total number of cache misses',
      '# TYPE blaize_cache_misses_total counter',
      `blaize_cache_misses_total ${stats.misses}`,
      '',
      '# HELP blaize_cache_evictions_total Total number of cache evictions',
      '# TYPE blaize_cache_evictions_total counter',
      `blaize_cache_evictions_total ${stats.evictions}`,
      '',
      '# HELP blaize_cache_memory_bytes Current cache memory usage in bytes',
      '# TYPE blaize_cache_memory_bytes gauge',
      `blaize_cache_memory_bytes ${stats.memoryUsage}`,
      '',
      '# HELP blaize_cache_entries Current number of cache entries',
      '# TYPE blaize_cache_entries gauge',
      `blaize_cache_entries ${stats.entryCount}`,
      '',
      '# HELP blaize_cache_hit_rate Cache hit rate (hits / total requests)',
      '# TYPE blaize_cache_hit_rate gauge',
      `blaize_cache_hit_rate ${hitRate.toFixed(3)}`,
    ];

    if (stats.uptime !== undefined) {
      metrics.push(
        '',
        '# HELP blaize_cache_uptime_seconds Cache uptime in seconds',
        '# TYPE blaize_cache_uptime_seconds counter',
        `blaize_cache_uptime_seconds ${(stats.uptime / 1000).toFixed(0)}`
      );
    }

    ctx.response.type('text/plain; version=0.0.4; charset=utf-8').text(metrics.join('\n'));
  } catch (error) {
    throw new InternalServerError(
      'Failed to generate Prometheus metrics',
      {
        originalError: error instanceof Error ? error.message : String(error),
        component: 'cache-plugin',
        operation: 'exportPrometheus',
      },
      getCorrelationId()
    );
  }
};

/**
 * HTML dashboard handler
 *
 * Renders a visual dashboard showing cache statistics and recent keys.
 * Supports optional auto-refresh via query parameter.
 *
 * ## Features
 * - Summary cards (hits, misses, hit rate, memory)
 * - Recent keys table (last 50 with TTL)
 * - Auto-refresh support (`?refresh=30`)
 * - BlaizeJS branding
 *
 * @example Route assembly
 * ```typescript
 * // routes/cache/dashboard.ts
 * import { createGetRoute } from 'blaizejs';
 * import { cacheDashboardHandler, cacheDashboardQuerySchema } from '@blaizejs/plugin-cache';
 *
 * export default createGetRoute()({
 *   schema: { query: cacheDashboardQuerySchema },
 *   handler: cacheDashboardHandler,
 * });
 * ```
 *
 * @param ctx - BlaizeJS request context
 * @param params - Route parameters (unused)
 * @param logger - BlaizeJS logger instance
 * @throws ServiceNotAvailableError if cache service unavailable
 * @throws InternalServerError if dashboard rendering fails
 */
export const cacheDashboardHandler = async ({
  ctx,
  logger,
}: {
  ctx: Context;
  logger: BlaizeLogger;
}): Promise<void> => {
  const cache = getCacheServiceOrThrow(ctx);
  const { refresh } = ctx.request.query as unknown as CacheDashboardQuery;
  const refreshInterval = refresh ? parseInt(refresh, 10) : undefined;

  logger.debug('Rendering cache dashboard', { refreshInterval });

  try {
    const data = await gatherDashboardData(cache);
    const html = renderDashboard(data, refreshInterval);

    ctx.response.type('text/html; charset=utf-8').html(html);
  } catch (error) {
    throw new InternalServerError(
      'Failed to render cache dashboard',
      {
        originalError: error instanceof Error ? error.message : String(error),
        component: 'cache-plugin',
        operation: 'renderDashboard',
      },
      getCorrelationId()
    );
  }
};

/**
 * SSE cache events handler
 *
 * Streams real-time cache change events using Server-Sent Events.
 * Clients can subscribe to specific key patterns using glob patterns.
 *
 * ## Event Types
 * - `cache.set`: Key was set/updated
 * - `cache.delete`: Key was deleted
 * - `cache.eviction`: Key was evicted (LRU or TTL)
 *
 * ## Query Parameters
 * - `pattern` (optional): Key pattern to filter events (e.g., "user:*")
 *
 * @example Route assembly
 * ```typescript
 * // routes/cache/events.ts
 * import { createSSERoute } from 'blaizejs';
 * import {
 *   cacheEventsHandler,
 *   cacheEventsQuerySchema,
 *   cacheEventsSchema,
 * } from '@blaizejs/plugin-cache';
 *
 * export default createSSERoute()({
 *   schema: {
 *     query: cacheEventsQuerySchema,
 *     events: cacheEventsSchema,
 *   },
 *   handler: cacheEventsHandler,
 * });
 * ```
 *
 * @example Client usage
 * ```typescript
 * const eventSource = new EventSource('/cache/events?pattern=user:*');
 *
 * eventSource.addEventListener('cache.set', (event) => {
 *   const data = JSON.parse(event.data);
 *   console.log('Key set:', data.key, data.value);
 * });
 *
 * eventSource.addEventListener('cache.delete', (event) => {
 *   const data = JSON.parse(event.data);
 *   console.log('Key deleted:', data.key);
 * });
 * ```
 *
 * @param stream - TypedSSEStream for sending events
 * @param ctx - BlaizeJS request context
 * @param params - Route parameters (unused)
 * @param logger - BlaizeJS logger instance
 * @throws ServiceNotAvailableError if cache service unavailable
 */
export const cacheEventsHandler = async ({
  stream,
  ctx,
  logger,
}: {
  stream: CacheSSEStream;
  ctx: Context;
  logger: BlaizeLogger;
}): Promise<void> => {
  const cache = getCacheServiceOrThrow(ctx);
  const { pattern } = ctx.request.query as unknown as CacheEventsQuery;

  // Default pattern matches all keys
  const watchPattern = pattern || '.*';

  logger.debug('Starting cache events stream', {
    pattern: watchPattern,
    correlationId: getCorrelationId(),
  });

  // Convert glob pattern to regex if needed
  const regex = watchPattern.includes('*')
    ? new RegExp('^' + watchPattern.replace(/\*/g, '.*') + '$')
    : new RegExp(watchPattern);

  // Subscribe to cache changes
  const unsubscribe = cache.watch(regex, async event => {
    try {
      // Map event type to SSE event name
      const eventName =
        event.type === 'set'
          ? 'cache.set'
          : event.type === 'delete'
            ? 'cache.delete'
            : 'cache.eviction';

      await stream.send(eventName as any, event);

      logger.debug('Cache event sent', {
        eventType: eventName,
        key: event.key,
        correlationId: getCorrelationId(),
      });
    } catch (error) {
      logger.error('Error sending cache event', {
        error: {
          message: (error as Error).message,
          stack: (error as Error).stack,
        },
        event,
        correlationId: getCorrelationId(),
      });
    }
  });

  // Handle client disconnect
  stream.onClose(() => {
    unsubscribe();
    logger.debug('Cache events stream closed', {
      pattern: watchPattern,
      correlationId: getCorrelationId(),
    });
  });
};
