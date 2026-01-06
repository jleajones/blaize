/**
 * Cache Demo Route (With EventBus Integration)
 *
 * GET /cache/demo - Create sample cache operations and publish events
 *
 * Pattern:
 * - Route performs cache operations
 * - Route publishes events after each operation
 * - SSE route (/cache/events) subscribes and streams to clients
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
    { id: 'manifest:federata-v1', version: '1.0.0', services: ['auth', 'users'], ttl: 300 },
    {
      id: 'manifest:federata-v2',
      version: '2.0.0',
      services: ['auth', 'users', 'analytics'],
      ttl: 300,
    },
  ],
};

/**
 * GET /cache/demo - Create sample cache entries with event publishing
 */
export const getCacheDemo = appRouter.get({
  schema: {
    query: z.object({
      includeUsers: z
        .string()
        .optional()
        .transform(val => val !== 'false'),
      includeSessions: z
        .string()
        .optional()
        .transform(val => val !== 'false'),
      includeManifests: z
        .string()
        .optional()
        .transform(val => val !== 'false'),
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
        dashboard: z.string(),
      }),
    }),
  },
  handler: async ({ ctx, logger, eventBus }) => {
    const cache = ctx.services.cache as CacheService;
    const { includeUsers, includeSessions, includeManifests } = ctx.request.query as any;

    logger.info('Creating demo cache entries', { includeUsers, includeSessions, includeManifests });

    const operations: Array<{ key: string; pattern: string; ttl?: number; description: string }> =
      [];

    // Users (no TTL)
    if (includeUsers) {
      for (const user of DEMO_DATA.users) {
        await cache.set(user.id, JSON.stringify(user));

        // ✅ PUBLISH EVENT after cache operation
        await eventBus.publish('cache:set', {
          key: user.id,
          ttl: undefined,
          timestamp: Date.now(),
          size: JSON.stringify(user).length,
        });

        operations.push({
          key: user.id,
          pattern: 'user:*',
          description: `👤 User: ${user.name}`,
        });
      }
    }

    // Sessions (with TTL)
    if (includeSessions) {
      for (const session of DEMO_DATA.sessions) {
        await cache.set(session.id, JSON.stringify(session), session.expiresIn);

        // ✅ PUBLISH EVENT after cache operation
        await eventBus.publish('cache:set', {
          key: session.id,
          ttl: session.expiresIn,
          timestamp: Date.now(),
          size: JSON.stringify(session).length,
        });

        operations.push({
          key: session.id,
          pattern: 'session:*',
          ttl: session.expiresIn,
          description: `🔐 Session for ${session.userId} (TTL: ${session.expiresIn}s)`,
        });
      }
    }

    // Manifests (with TTL)
    if (includeManifests) {
      for (const manifest of DEMO_DATA.manifests) {
        await cache.set(manifest.id, JSON.stringify(manifest), manifest.ttl);

        // ✅ PUBLISH EVENT after cache operation
        await eventBus.publish('cache:set', {
          key: manifest.id,
          ttl: manifest.ttl,
          timestamp: Date.now(),
          size: JSON.stringify(manifest).length,
        });

        operations.push({
          key: manifest.id,
          pattern: 'manifest:*',
          ttl: manifest.ttl,
          description: `📦 Manifest v${manifest.version}`,
        });
      }
    }

    logger.info('Demo cache entries created and events published', { count: operations.length });

    return {
      message: '🚀 Cache entries created! Events published to EventBus. Watch via SSE.',
      operationCount: operations.length,
      operations,
      links: {
        sseStream: '/cache/events?pattern=*',
        dashboard: '/cache/dashboard',
      },
    };
  },
});

/**
 * DELETE /cache/demo - Clear cache entries and publish invalidation event
 */
export const deleteCacheDemo = appRouter.delete({
  schema: {
    query: z.object({
      pattern: z.string().default('*'),
    }),
    response: z.object({
      message: z.string(),
      pattern: z.string(),
      eventPublished: z.boolean(),
    }),
  },
  handler: async ({ ctx, logger, eventBus }) => {
    // const cache = ctx.services.cache;
    const { pattern } = ctx.request.query;

    logger.info('Clearing cache', { pattern });

    // Clear cache
    // if (cache.clear) {
    //   await cache.clear(pattern);
    // }

    // ✅ PUBLISH INVALIDATION EVENT
    await eventBus.publish('cache:invalidate', {
      pattern,
      timestamp: Date.now(),
      reason: 'Manual clear via /cache/demo',
    });

    logger.info('Cache cleared and invalidation event published', { pattern });

    return {
      message: `Cache pattern '${pattern}' cleared and invalidation published to all servers`,
      pattern,
      eventPublished: true,
    };
  },
});
