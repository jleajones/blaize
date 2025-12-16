/**
 * Cache Prometheus Metrics Route
 *
 * GET /cache/prometheus
 *
 * Returns Prometheus/OpenMetrics format metrics for cache monitoring.
 * Includes:
 * - blaize_cache_hits_total
 * - blaize_cache_misses_total
 * - blaize_cache_evictions_total
 * - blaize_cache_memory_bytes
 * - blaize_cache_entries
 * - blaize_cache_hit_rate
 * - blaize_cache_uptime_seconds
 */
import { cachePrometheusHandler } from '@blaizejs/plugin-cache';

import { appRouter } from '../../app-router';

export const getCachePrometheus = appRouter.get({
  handler: cachePrometheusHandler,
});
