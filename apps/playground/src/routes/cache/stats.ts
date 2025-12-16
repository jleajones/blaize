/**
 * Cache Stats Route
 *
 * GET /cache/stats
 *
 * Returns JSON with cache statistics including hit rate.
 * Uses the handler from @blaizejs/plugin-cache directly.
 */
import { cacheStatsHandler, cacheStatsResponseSchema } from '@blaizejs/plugin-cache';

import { appRouter } from '../../app-router';

export const getCacheStats = appRouter.get({
  schema: {
    response: cacheStatsResponseSchema,
  },
  handler: cacheStatsHandler,
});
