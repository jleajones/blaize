# @blaizejs/plugin-cache

> **Event-driven cache plugin** for BlaizeJS with Redis support and multi-server coordination

[![npm version](https://badge.fury.io/js/%40blaizejs%2Fplugin-cache.svg)](https://badge.fury.io/js/%40blaizejs%2Fplugin-cache)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

## 🚀 Features

- 🎯 **Zero Configuration** - Works locally with in-memory adapter by default
- 🔄 **Event-Driven** - Automatic event emission on cache changes
- 🌐 **Multi-Server** - Redis pub/sub for distributed cache coordination
- 📊 **Monitoring** - Built-in stats endpoint and SSE event streaming
- ⚡ **High Performance** - <5ms p95 (memory), <10ms p95 (Redis)
- 🔒 **Type-Safe** - Full TypeScript support with strict typing
- 🧪 **Well Tested** - >90% test coverage

## 📦 Installation

```bash
# Using pnpm (recommended)
pnpm add @blaizejs/plugin-cache

# Using npm
npm install @blaizejs/plugin-cache

# Using yarn
yarn add @blaizejs/plugin-cache
```

## 🏃 Quick Start

```typescript
import { createServer } from 'blaizejs';
import { createCachePlugin } from '@blaizejs/plugin-cache';

const server = createServer({
  plugins: [
    // Zero configuration - uses in-memory adapter
    createCachePlugin({
      maxEntries: 1000,
      defaultTtl: 3600, // 1 hour
    }),
  ],
});

await server.listen(3000);

// Use cache in routes
export default createGetRoute()({
  handler: async ctx => {
    // Check cache first
    const cached = await ctx.services.cache.get('user:123');

    if (cached) {
      return JSON.parse(cached);
    }

    // Fetch from database
    const user = await db.users.findById('123');

    // Cache for 1 hour
    await ctx.services.cache.set('user:123', JSON.stringify(user), 3600);

    return user;
  },
});
```

## 📖 Usage Patterns

### In Route Handlers (via ctx.services)

Most common usage - cache data from API endpoints:

```typescript
// routes/users/[id].ts
export default createGetRoute()({
  handler: async ctx => {
    const userId = ctx.params.id;
    const cacheKey = `user:${userId}`;

    // ✅ Use ctx.services.cache in routes
    const cached = await ctx.services.cache.get(cacheKey);

    if (cached) {
      ctx.logger.info('Cache hit', { userId });
      return JSON.parse(cached);
    }

    // Cache miss - fetch from database
    const user = await db.users.findById(userId);

    // Cache for 30 minutes
    await ctx.services.cache.set(cacheKey, JSON.stringify(user), 1800);

    return user;
  },
});
```

### In Job Handlers (direct import)

Warm cache or invalidate keys from background jobs:

```typescript
// queues/cache/warm-popular-products.ts
import { getCacheService } from '@blaizejs/plugin-cache';
import type { JobContext } from '@blaizejs/plugin-queue';

export const warmPopularProducts = async (ctx: JobContext) => {
  // ✅ Import cache directly in job handlers
  const cache = getCacheService();

  ctx.progress(10, 'Fetching popular products...');
  const products = await db.products.findPopular(100);

  ctx.progress(50, 'Warming cache...');

  for (const product of products) {
    await cache.set(
      `product:${product.id}`,
      JSON.stringify(product),
      3600 // 1 hour
    );
  }

  ctx.progress(100, 'Cache warmed');
  ctx.logger.info('Warmed cache for popular products', {
    count: products.length,
  });

  return { productsWarmed: products.length };
};
```

### In Utility Functions

Share caching logic across your application:

```typescript
// lib/cache-utils.ts
import { getCacheService } from '@blaizejs/plugin-cache';

/**
 * Get user from cache or database
 */
export async function getUserFromCache(userId: string) {
  const cache = getCacheService();

  const cached = await cache.get(`user:${userId}`);
  if (cached) {
    return JSON.parse(cached);
  }

  const user = await db.users.findById(userId);

  if (user) {
    await cache.set(
      `user:${userId}`,
      JSON.stringify(user),
      1800 // 30 minutes
    );
  }

  return user;
}

/**
 * Invalidate user cache
 */
export async function invalidateUserCache(userId: string) {
  const cache = getCacheService();

  await cache.delete(`user:${userId}`);

  // Also invalidate related keys
  const relatedKeys = await cache.keys(`user:${userId}:*`);

  for (const key of relatedKeys) {
    await cache.delete(key);
  }
}

/**
 * Warm cache with fresh data
 */
export async function warmUserCache(userId: string) {
  const cache = getCacheService();

  const user = await db.users.findById(userId);

  if (user) {
    await cache.set(
      `user:${userId}`,
      JSON.stringify(user),
      3600 // 1 hour
    );

    return true;
  }

  return false;
}
```

### In Background Tasks

Periodic cache maintenance and cleanup:

```typescript
// scripts/cache-cleanup.ts
import { getCacheService } from '@blaizejs/plugin-cache';

async function cleanupExpiredCache() {
  const cache = getCacheService();

  // Get all keys
  const allKeys = await cache.keys('*');

  let expiredCount = 0;

  for (const key of allKeys) {
    const ttl = await cache.getTTL(key);

    // Remove keys with no TTL (shouldn't happen, but defensive)
    if (ttl === -1) {
      await cache.delete(key);
      expiredCount++;
    }
  }

  console.log('Cache cleanup complete:', {
    totalKeys: allKeys.length,
    expiredRemoved: expiredCount,
  });

  // Get cache stats
  const stats = await cache.getStats();
  console.log('Cache stats:', stats);
}

// Run every hour
setInterval(cleanupExpiredCache, 3600000);
```

### Why Two Access Patterns?

BlaizeJS provides two ways to access the cache service:

- **`ctx.services.cache`** - For route handlers

  - ✅ Convenient within HTTP request/response cycle
  - ✅ Middleware automatically provides service
  - ✅ No imports needed

- **`getCacheService()`** - For job handlers, utilities, scripts
  - ✅ Works outside HTTP context
  - ✅ Portable across different environments
  - ✅ Direct import, no framework dependency

**Important:** Both patterns access the **same CacheService instance**.

## 📖 Main Exports

### Service Factory

```typescript
getCacheService(): CacheService  // Direct access to cache service
```

### Plugin Factory

```typescript
createCachePlugin(config?: CachePluginConfig): Plugin
```

### Cache Service API (via `ctx.services.cache` or `getCacheService()`)

```typescript
// Basic operations
get(key: string): Promise<string | null>
set(key: string, value: string, ttl?: number): Promise<void>
delete(key: string): Promise<boolean>

// Batch operations
mget(keys: string[]): Promise<(string | null)[]>
mset(entries: Array<[string, string, number?]>): Promise<void>

// Pattern operations
keys(pattern: string): Promise<string[]>
clear(pattern?: string): Promise<number>

// Metadata
getTTL(key: string): Promise<number>
getStats(): Promise<CacheStats>

// Lifecycle
disconnect(): Promise<void>
healthCheck(): Promise<{ healthy: boolean; message?: string }>
```

### Configuration Type

```typescript
interface CachePluginConfig {
  adapter?: CacheAdapter; // Custom adapter (default: MemoryAdapter)
  maxEntries?: number; // Max entries (default: 1000)
  defaultTtl?: number; // Default TTL in seconds (default: 3600)
  serverId?: string; // Server ID for multi-server coordination
}
```

## 🧪 Testing

### Mocking in Route Tests

```typescript
import { vi } from 'vitest';

describe('GET /users/:id', () => {
  it('returns cached user when available', async () => {
    // Routes use ctx.services
    const mockCache = {
      get: vi.fn().mockResolvedValue('{"id":"123","name":"Alice"}'),
      set: vi.fn(),
    };

    const ctx = createMockContext({
      params: { id: '123' },
      services: { cache: mockCache },
    });

    const result = await GET.handler({ ctx });

    expect(mockCache.get).toHaveBeenCalledWith('user:123');
    expect(result).toEqual({ id: '123', name: 'Alice' });
  });

  it('fetches from database on cache miss', async () => {
    const mockCache = {
      get: vi.fn().mockResolvedValue(null), // Cache miss
      set: vi.fn(),
    };

    const ctx = createMockContext({
      params: { id: '456' },
      services: { cache: mockCache },
    });

    const result = await GET.handler({ ctx });

    expect(mockCache.get).toHaveBeenCalledWith('user:456');
    expect(mockCache.set).toHaveBeenCalledWith('user:456', expect.any(String), 1800);
  });
});
```

### Mocking in Job Handler Tests

```typescript
import { vi } from 'vitest';

// Mock the factory function
vi.mock('@blaizejs/plugin-cache', () => ({
  getCacheService: vi.fn(() => mockCache),
}));

const mockCache = {
  set: vi.fn(),
  get: vi.fn(),
  keys: vi.fn(),
};

describe('warmPopularProducts handler', () => {
  it('warms cache with popular products', async () => {
    const products = [
      { id: '1', name: 'Product 1' },
      { id: '2', name: 'Product 2' },
    ];

    // Mock database call
    vi.spyOn(db.products, 'findPopular').mockResolvedValue(products);

    const result = await warmPopularProducts({
      jobId: 'job-1',
      data: {},
      logger: mockLogger,
      signal: new AbortController().signal,
      progress: vi.fn(),
    });

    expect(mockCache.set).toHaveBeenCalledTimes(2);
    expect(mockCache.set).toHaveBeenCalledWith('product:1', JSON.stringify(products[0]), 3600);
    expect(result.productsWarmed).toBe(2);
  });
});
```

## 🌐 Redis Adapter

For production multi-server deployments:

```typescript
import { createCachePlugin } from '@blaizejs/plugin-cache';
import { RedisAdapter } from '@blaizejs/adapter-redis';

const server = createServer({
  plugins: [
    createCachePlugin({
      adapter: new RedisAdapter({
        host: 'localhost',
        port: 6379,
        // Optional password
        password: process.env.REDIS_PASSWORD,
      }),
      serverId: process.env.SERVER_ID || 'server-1',
    }),
  ],
});
```

## 📊 Cache Statistics

```typescript
// Get cache statistics
const stats = await ctx.services.cache.getStats();

console.log(stats);
// {
//   entries: 245,
//   hits: 1250,
//   misses: 180,
//   hitRate: 0.874,
//   evictions: 5
// }
```

---

## 🧪 Testing Infrastructure

### Test Environment Setup

The cache plugin includes a Docker Compose configuration for running integration tests against a real Redis instance.

#### Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+

#### Connection Details

| Service | URL                      | Database | Password |
| ------- | ------------------------ | -------- | -------- |
| Redis   | `redis://localhost:6379` | 0        | None     |

**⚠️ Security Note**: This configuration is for **development and testing only**. The Redis instance has no password and should never be exposed to production environments.

#### Starting Test Services

```bash
# Start Redis in detached mode
docker-compose -f compose.test.yml up -d

# Verify Redis is healthy (should show "healthy")
docker-compose -f compose.test.yml ps

# View Redis logs
docker-compose -f compose.test.yml logs -f redis
```

#### Running Tests

```bash
# Run all tests (requires Redis to be running)
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage
```

#### Stopping Test Services

```bash
# Stop services (preserves data volumes)
docker-compose -f compose.test.yml down

# Stop and remove volumes (full cleanup)
docker-compose -f compose.test.yml down -v
```

#### Health Checks

Redis includes a health check that runs every 5 seconds:

```bash
# Check if Redis is ready
docker-compose -f compose.test.yml exec redis redis-cli ping
# Expected output: PONG
```

The health check ensures Redis is fully operational before integration tests begin running.

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](../../CONTRIBUTING.md) for details.

---

## 📄 License

MIT © J.Lea-Jones

---

**Built with ❤️ by the BlaizeJS team**

_Lightning-fast caching that scales - from simple API response caching to distributed multi-server coordination with Redis._
