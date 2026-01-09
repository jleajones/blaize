/**
 * Cache Demo Route (Improved)
 *
 * GET /cache/demo - Create sample cache operations
 * DELETE /cache/demo - Clear cache entries
 *
 * Improvements:
 * - Removed manual event publishing (CacheService handles this!)
 * - Added variety of cache patterns
 * - Added helpful tips and SSE examples
 * - Better organized with clear categories
 */
import { z } from 'zod';

import type { CacheService } from '@blaizejs/plugin-cache';

import { appRouter } from '../../app-router';

/**
 * Simulated data for cache demo
 */
const DEMO_DATA = {
  users: [
    { id: 'user:1', name: 'Alice Johnson', email: 'alice@example.com', role: 'admin' },
    { id: 'user:2', name: 'Bob Smith', email: 'bob@example.com', role: 'user' },
    { id: 'user:3', name: 'Carol White', email: 'carol@example.com', role: 'moderator' },
  ],
  sessions: [
    { id: 'session:abc123', userId: 'user:1', expiresIn: 3600 }, // 1 hour
    { id: 'session:def456', userId: 'user:2', expiresIn: 1800 }, // 30 min
    { id: 'session:ghi789', userId: 'user:3', expiresIn: 300 }, // 5 min (short!)
  ],
  config: [
    { id: 'config:feature-flags', enabled: true, features: ['darkMode', 'beta'], ttl: 600 },
    { id: 'config:rate-limits', maxRequests: 100, window: 60, ttl: 300 },
  ],
  apiKeys: [
    { id: 'apikey:service-a', key: 'sk_test_123', scopes: ['read', 'write'], ttl: 7200 },
    { id: 'apikey:service-b', key: 'sk_test_456', scopes: ['read'], ttl: 3600 },
  ],
};

/**
 * GET /cache/demo - Create sample cache entries
 */
export const getCacheDemo = appRouter.get({
  schema: {
    query: z.object({
      includeUsers: z
        .string()
        .optional()
        .transform(val => val !== 'false'), // Default true
      includeSessions: z
        .string()
        .optional()
        .transform(val => val !== 'false'), // Default true
      includeConfig: z
        .string()
        .optional()
        .transform(val => val !== 'false'), // Default true
      includeApiKeys: z
        .string()
        .optional()
        .transform(val => val !== 'false'), // Default true
    }),
    response: z.object({
      message: z.string(),
      operationCount: z.number(),
      operations: z.array(
        z.object({
          key: z.string(),
          pattern: z.string(),
          ttl: z.number().optional(),
          description: z.string(),
        })
      ),
      links: z.object({
        sseStream: z.string(),
        sseFiltered: z.string(),
        dashboard: z.string(),
        stats: z.string(),
      }),
      tips: z.array(z.string()),
    }),
  },
  handler: async ({ ctx, logger }) => {
    const cache = ctx.services.cache as CacheService;
    const { includeUsers, includeSessions, includeConfig, includeApiKeys } = ctx.request
      .query as any;

    logger.info('Creating demo cache entries', {
      includeUsers,
      includeSessions,
      includeConfig,
      includeApiKeys,
    });

    const operations: Array<{
      key: string;
      pattern: string;
      ttl?: number;
      description: string;
    }> = [];

    // ========================================================================
    // Users (no TTL - permanent until explicitly deleted)
    // ========================================================================
    if (includeUsers) {
      for (const user of DEMO_DATA.users) {
        await cache.set(user.id, JSON.stringify(user));
        // ✅ No manual event publishing - CacheService does this automatically!

        operations.push({
          key: user.id,
          pattern: 'user:*',
          description: `👤 User: ${user.name} (${user.role})`,
        });
      }
    }

    // ========================================================================
    // Sessions (short TTL - great for testing expiration!)
    // ========================================================================
    if (includeSessions) {
      for (const session of DEMO_DATA.sessions) {
        await cache.set(session.id, JSON.stringify(session), session.expiresIn);
        // ✅ No manual event publishing!

        const minutes = Math.floor(session.expiresIn / 60);
        operations.push({
          key: session.id,
          pattern: 'session:*',
          ttl: session.expiresIn,
          description: `🔐 Session for ${session.userId} (expires in ${minutes}m)`,
        });
      }
    }

    // ========================================================================
    // Config (medium TTL - application settings)
    // ========================================================================
    if (includeConfig) {
      for (const config of DEMO_DATA.config) {
        await cache.set(config.id, JSON.stringify(config), config.ttl);

        const minutes = Math.floor(config.ttl / 60);
        operations.push({
          key: config.id,
          pattern: 'config:*',
          ttl: config.ttl,
          description: `⚙️ Config: ${config.id.split(':')[1]} (TTL: ${minutes}m)`,
        });
      }
    }

    // ========================================================================
    // API Keys (long TTL - credentials)
    // ========================================================================
    if (includeApiKeys) {
      for (const apiKey of DEMO_DATA.apiKeys) {
        await cache.set(apiKey.id, JSON.stringify(apiKey), apiKey.ttl);

        const hours = Math.floor(apiKey.ttl / 3600);
        operations.push({
          key: apiKey.id,
          pattern: 'apikey:*',
          ttl: apiKey.ttl,
          description: `🔑 API Key: ${apiKey.id.split(':')[1]} (TTL: ${hours}h)`,
        });
      }
    }

    logger.info('Demo cache entries created', { count: operations.length });

    return {
      message: '🚀 Cache entries created! Events automatically published via EventBus.',
      operationCount: operations.length,
      operations,
      links: {
        sseStream: '/cache/events?pattern=*',
        sseFiltered: '/cache/events?pattern=session:*',
        dashboard: '/cache/dashboard?refresh=10',
        stats: '/cache/stats',
      },
      tips: [
        '💡 Visit /cache/dashboard to see all cache entries',
        '📊 All cache operations publish events automatically!',
        '🔥 Try: curl -N http://localhost:7485/cache/events?pattern=session:*',
        '⏱️ Session entries expire quickly (5m, 30m, 1h) - great for testing TTL',
        '🎯 Filter events by pattern: ?pattern=user:* or ?pattern=config:*',
        '🗑️ DELETE /cache/demo to clear all entries and trigger delete events',
      ],
    };
  },
});

/**
 * DELETE /cache/demo - Clear cache entries and watch events stream
 */
export const deleteCacheDemo = appRouter.delete({
  schema: {
    query: z.object({
      pattern: z.string().default('*'),
    }),
    response: z.object({
      message: z.string(),
      pattern: z.string(),
      deletedCount: z.number(),
      tip: z.string(),
    }),
  },
  handler: async ({ ctx, logger }) => {
    const cache = ctx.services.cache as CacheService;
    const { pattern } = ctx.request.query;

    logger.info('Clearing cache', { pattern });

    // Clear cache - this publishes cache:delete events automatically!
    const deletedCount = await cache.clear(pattern);
    // ✅ No manual event publishing - cache.clear() does this!

    logger.info('Cache cleared', { pattern, deletedCount });

    return {
      message: `✨ Cleared ${deletedCount} cache entries matching '${pattern}'`,
      pattern,
      deletedCount,
      tip:
        deletedCount > 0
          ? `Watch the delete events: curl -N http://localhost:7485/cache/events?pattern=${pattern}`
          : 'No entries matched the pattern',
    };
  },
});
