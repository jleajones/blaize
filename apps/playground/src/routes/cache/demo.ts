/**
 * Cache Demo Route
 *
 * GET /cache/demo - Create sample cache operations
 * POST /cache/demo - Create custom cache operations
 *
 * Demonstrates:
 * - Cache set/get/delete operations
 * - TTL management
 * - Pattern matching
 * - Multi-client SSE updates
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
    { id: 'user:3', name: 'Carol White', email: 'carol@example.com', role: 'user' },
  ],
  sessions: [
    { id: 'session:abc123', userId: 'user:1', expiresIn: 3600 },
    { id: 'session:def456', userId: 'user:2', expiresIn: 1800 },
    { id: 'session:ghi789', userId: 'user:3', expiresIn: 7200 },
  ],
  manifests: [
    {
      id: 'manifest:federata-v1',
      version: '1.0.0',
      services: ['auth', 'users', 'billing'],
      ttl: 300,
    },
    {
      id: 'manifest:federata-v2',
      version: '2.0.0',
      services: ['auth', 'users', 'billing', 'analytics'],
      ttl: 300,
    },
  ],
  config: [
    { id: 'config:feature-flags', flags: { newUI: true, betaFeatures: false }, ttl: 60 },
    { id: 'config:rate-limits', maxRequests: 1000, windowMs: 60000, ttl: 120 },
  ],
};

/**
 * Create demo cache entries
 */
async function createDemoEntries(
  cache: CacheService,
  options: {
    includeUsers?: boolean;
    includeSessions?: boolean;
    includeManifests?: boolean;
    includeConfig?: boolean;
  } = {}
) {
  const {
    includeUsers = true,
    includeSessions = true,
    includeManifests = true,
    includeConfig = true,
  } = options;

  const operations: Array<{
    key: string;
    pattern: string;
    ttl?: number;
    description: string;
  }> = [];

  // Users (no TTL - cache indefinitely)
  if (includeUsers) {
    for (const user of DEMO_DATA.users) {
      await cache.set(user.id, JSON.stringify(user));
      operations.push({
        key: user.id,
        pattern: 'user:*',
        description: `👤 User: ${user.name} (${user.role})`,
      });
    }
  }

  // Sessions (short TTL - 30-120 seconds for demo)
  if (includeSessions) {
    for (const session of DEMO_DATA.sessions) {
      await cache.set(session.id, JSON.stringify(session), session.expiresIn);
      operations.push({
        key: session.id,
        pattern: 'session:*',
        ttl: session.expiresIn,
        description: `🔐 Session for user ${session.userId} (expires in ${session.expiresIn}s)`,
      });
    }
  }

  // Federata Manifests (medium TTL - 5 minutes)
  if (includeManifests) {
    for (const manifest of DEMO_DATA.manifests) {
      await cache.set(manifest.id, JSON.stringify(manifest), manifest.ttl);
      operations.push({
        key: manifest.id,
        pattern: 'manifest:*',
        ttl: manifest.ttl,
        description: `📦 Federata manifest v${manifest.version} (${manifest.services.length} services, TTL: ${manifest.ttl}s)`,
      });
    }
  }

  // Configuration (short TTL - 60-120 seconds)
  if (includeConfig) {
    for (const config of DEMO_DATA.config) {
      await cache.set(config.id, JSON.stringify(config), config.ttl);
      operations.push({
        key: config.id,
        pattern: 'config:*',
        ttl: config.ttl,
        description: `⚙️ ${config.id.replace('config:', '')} (TTL: ${config.ttl}s)`,
      });
    }
  }

  return operations;
}

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
      includeManifests: z
        .string()
        .optional()
        .transform(val => val !== 'false'), // Default true
      includeConfig: z
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
        dashboard: z.string(),
        stats: z.string(),
        prometheus: z.string(),
        sseEvents: z.string(),
        sseUserPattern: z.string(),
        sseSessionPattern: z.string(),
        sseManifestPattern: z.string(),
      }),
      tips: z.array(z.string()),
    }),
  },
  handler: async (ctx, _params, logger) => {
    const cache = ctx.services.cache as CacheService;
    const { includeUsers, includeSessions, includeManifests, includeConfig } = ctx.request
      .query as any;

    logger.info('Creating demo cache entries', {
      includeUsers,
      includeSessions,
      includeManifests,
      includeConfig,
    });

    const operations = await createDemoEntries(cache, {
      includeUsers,
      includeSessions,
      includeManifests,
      includeConfig,
    });

    logger.info('Demo cache entries created', { count: operations.length });

    return {
      message: '🚀 Demo cache entries created! Watch real-time updates via SSE.',
      operationCount: operations.length,
      operations,
      links: {
        dashboard: '/cache/dashboard?refresh=5',
        stats: '/cache/stats',
        prometheus: '/cache/prometheus',
        sseEvents: '/cache/events',
        sseUserPattern: '/cache/events?pattern=user:*',
        sseSessionPattern: '/cache/events?pattern=session:*',
        sseManifestPattern: '/cache/events?pattern=manifest:*',
      },
      tips: [
        '💡 Visit /cache/dashboard to see all cached entries',
        '📊 Sessions will expire automatically (30s-2min TTL)',
        '🔥 Try SSE: curl -N http://localhost:7485/cache/events?pattern=user:*',
        '⚡ Update cache: POST /cache/demo with custom patterns',
        '🎯 Pattern examples: user:*, session:*, manifest:*, config:*',
        '🔄 Auto-refresh dashboard: /cache/dashboard?refresh=5',
      ],
    };
  },
});

/**
 * POST /cache/demo - Create custom cache operations
 */
export const createCacheDemo = appRouter.post({
  schema: {
    body: z.object({
      operations: z
        .array(
          z.object({
            key: z.string().min(1),
            value: z.string(),
            ttl: z.number().int().positive().optional(),
          })
        )
        .min(1)
        .max(50),
    }),
    response: z.object({
      message: z.string(),
      operationCount: z.number(),
      operations: z.array(
        z.object({
          key: z.string(),
          ttl: z.number().optional(),
          success: z.boolean(),
        })
      ),
      links: z.object({
        dashboard: z.string(),
        stats: z.string(),
        events: z.string(),
      }),
    }),
  },
  handler: async (ctx, _params, logger) => {
    const cache = ctx.services.cache;
    const { operations: requestedOps } = ctx.request.body;

    logger.info('Creating custom cache operations', { count: requestedOps.length });

    const results = [];

    for (const op of requestedOps) {
      try {
        await cache.set(op.key, op.value, op.ttl);
        results.push({
          key: op.key,
          ttl: op.ttl,
          success: true,
        });
        logger.debug('Cache operation succeeded', { key: op.key, ttl: op.ttl });
      } catch (error) {
        results.push({
          key: op.key,
          ttl: op.ttl,
          success: false,
        });
        logger.error('Cache operation failed', {
          key: op.key,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const successCount = results.filter(r => r.success).length;

    return {
      message: `✨ Executed ${successCount}/${requestedOps.length} cache operations successfully`,
      operationCount: successCount,
      operations: results,
      links: {
        dashboard: '/cache/dashboard',
        stats: '/cache/stats',
        events: '/cache/events',
      },
    };
  },
});
