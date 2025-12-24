/**
 * Cache Dashboard Route
 *
 * GET /cache/dashboard
 *
 * Returns HTML dashboard with cache visualization.
 * Query params:
 * - refresh: Auto-refresh interval in seconds (e.g., ?refresh=5)
 *
 * Features:
 * - Summary cards (hits, misses, hit rate, memory, evictions)
 * - Recent keys table with TTL information
 * - Auto-refresh support for live monitoring
 * - BlaizeJS branding and gradient design
 */
import { cacheDashboardHandler, cacheDashboardQuerySchema } from '@blaizejs/plugin-cache';

import { appRouter } from '../../app-router';

export const getCacheDashboard = appRouter.get({
  schema: { query: cacheDashboardQuerySchema },
  handler: cacheDashboardHandler,
});
