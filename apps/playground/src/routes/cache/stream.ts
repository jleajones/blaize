/**
 * Cache Events Stream Route (SSE)
 *
 * GET /cache/events
 *
 * Server-Sent Events stream for real-time cache monitoring.
 * Query params:
 * - pattern: Optional - Glob pattern or regex for key filtering
 *   - Examples: user:*, session:*, manifest:federata-*
 *
 * Events:
 * - cache.set: { type: 'set', key, timestamp }
 * - cache.delete: { type: 'delete', key, timestamp }
 * - cache.eviction: { type: 'eviction', key, reason, timestamp }
 *
 * Usage Examples:
 * - All events: curl -N http://localhost:7485/cache/events
 * - User pattern: curl -N http://localhost:7485/cache/events?pattern=user:*
 * - Session pattern: curl -N http://localhost:7485/cache/events?pattern=session:*
 * - Manifest pattern: curl -N http://localhost:7485/cache/events?pattern=manifest:*
 */

import {
  cacheEventsHandler,
  cacheEventsQuerySchema,
  cacheEventsSchema,
} from '@blaizejs/plugin-cache';

import { appRouter } from '../../app-router';

export const getCacheEvents = appRouter.sse({
  schema: {
    query: cacheEventsQuerySchema,
    events: cacheEventsSchema,
  },
  handler: cacheEventsHandler,
});
