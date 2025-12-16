/**
 * Integration Tests for RedisAdapter
 *
 * Tests with real Redis instance from Docker Compose.
 *
 * Run with: pnpm test redis.test.ts
 * Requires: docker-compose up -d redis
 */

import { RedisAdapter } from './redis';
import { CacheConnectionError, CacheOperationError, CacheValidationError } from '../../errors';

import type { RedisAdapterConfig } from '../../types';

// ============================================================================
// Test Configuration
// ============================================================================

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);

const TEST_CONFIG: RedisAdapterConfig = {
  host: REDIS_HOST,
  port: REDIS_PORT,
  db: 15, // Use db 15 for tests to avoid conflicts
};

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Wait for a specified time
 */
function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a test adapter
 */
function createTestAdapter(config: Partial<RedisAdapterConfig> = {}): RedisAdapter {
  return new RedisAdapter({
    ...TEST_CONFIG,
    ...config,
  });
}

// ============================================================================
// Test Suite
// ============================================================================

describe('RedisAdapter Integration Tests', () => {
  let adapter: RedisAdapter;

  beforeAll(async () => {
    // Verify Redis is available
    const testAdapter = createTestAdapter();
    try {
      await testAdapter.connect();
      await testAdapter.disconnect();
    } catch (error) {
      console.error('Redis not available. Start with: docker-compose up -d redis');
      throw error;
    }
  });

  beforeEach(async () => {
    adapter = createTestAdapter();
    await adapter.connect();
  });

  afterAll(async () => {
    if (adapter) {
      await adapter.disconnect();
    }
  });

  // ==========================================================================
  // Connection Tests
  // ==========================================================================

  describe('Connection Management', () => {
    test('connects to Redis successfully', async () => {
      const testAdapter = createTestAdapter();

      await expect(testAdapter.connect()).resolves.toBeUndefined();

      const health = await testAdapter.healthCheck();
      expect(health.healthy).toBe(true);

      await testAdapter.disconnect();
    });

    test('disconnects gracefully', async () => {
      const testAdapter = createTestAdapter();
      await testAdapter.connect();

      await expect(testAdapter.disconnect()).resolves.toBeUndefined();
    });

    test('throws error on connection to invalid host', async () => {
      const testAdapter = createTestAdapter({
        host: 'invalid-host-that-does-not-exist',
        port: 9999,
        connectTimeout: 1000,
        retryStrategy: () => null, // Don't retry
      });

      await expect(testAdapter.connect()).rejects.toThrow(CacheConnectionError);
    });

    test('retries connection with retry strategy', async () => {
      let retryCount = 0;

      const testAdapter = createTestAdapter({
        host: 'invalid-host',
        port: 9999,
        connectTimeout: 500,
        retryStrategy: times => {
          retryCount = times;
          if (times > 2) return null;
          return 100;
        },
      });

      await expect(testAdapter.connect()).rejects.toThrow();
      expect(retryCount).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Basic Operations
  // ==========================================================================

  describe('Basic Operations', () => {
    test('set and get a value', async () => {
      await adapter.set('test:key', 'test:value');
      const value = await adapter.get('test:key');

      expect(value).toBe('test:value');
    });

    test('returns null for non-existent key', async () => {
      const value = await adapter.get('non:existent:key');
      expect(value).toBeNull();
    });

    test('deletes existing key', async () => {
      await adapter.set('test:delete', 'value');

      const deleted = await adapter.delete('test:delete');
      expect(deleted).toBe(true);

      const value = await adapter.get('test:delete');
      expect(value).toBeNull();
    });

    test('delete returns false for non-existent key', async () => {
      const deleted = await adapter.delete('non:existent:key');
      expect(deleted).toBe(false);
    });

    test('overwrites existing value', async () => {
      await adapter.set('test:overwrite', 'original');
      await adapter.set('test:overwrite', 'updated');

      const value = await adapter.get('test:overwrite');
      expect(value).toBe('updated');
    });
  });

  // ==========================================================================
  // TTL Tests
  // ==========================================================================

  describe('TTL Expiration', () => {
    test('sets value with TTL', async () => {
      await adapter.set('test:ttl', 'expires-soon', 2);

      // Should exist immediately
      let value = await adapter.get('test:ttl');
      expect(value).toBe('expires-soon');

      // Wait for expiration
      await wait(2100);

      // Should be gone
      value = await adapter.get('test:ttl');
      expect(value).toBeNull();
    });

    test('TTL does not affect permanent values', async () => {
      await adapter.set('test:permanent', 'no-ttl');

      await wait(1000);

      const value = await adapter.get('test:permanent');
      expect(value).toBe('no-ttl');
    });

    test('updates TTL on overwrite', async () => {
      await adapter.set('test:ttl-update', 'first', 1);
      await adapter.set('test:ttl-update', 'second', 10);

      await wait(1100);

      // Should still exist (new 10s TTL)
      const value = await adapter.get('test:ttl-update');
      expect(value).toBe('second');
    });

    test('validates TTL must be positive', async () => {
      await expect(adapter.set('test:key', 'value', -1)).rejects.toThrow(CacheValidationError);
    });

    test('validates TTL must be finite', async () => {
      await expect(adapter.set('test:key', 'value', Infinity)).rejects.toThrow(
        CacheValidationError
      );
    });
  });

  // ==========================================================================
  // Batch Operations
  // ==========================================================================

  describe('Batch Operations', () => {
    test('mget retrieves multiple values', async () => {
      await adapter.set('user:1', '{"name":"Alice"}');
      await adapter.set('user:2', '{"name":"Bob"}');
      await adapter.set('user:3', '{"name":"Carol"}');

      const values = await adapter.mget(['user:1', 'user:2', 'user:3']);

      expect(values).toEqual(['{"name":"Alice"}', '{"name":"Bob"}', '{"name":"Carol"}']);
    });

    test('mget handles missing keys', async () => {
      await adapter.set('exists:1', 'value1');

      const values = await adapter.mget(['exists:1', 'missing:1', 'missing:2']);

      expect(values).toEqual(['value1', null, null]);
    });

    test('mget with empty array returns empty array', async () => {
      const values = await adapter.mget([]);
      expect(values).toEqual([]);
    });

    test('mset sets multiple values', async () => {
      await adapter.mset([
        ['batch:1', 'value1'],
        ['batch:2', 'value2'],
        ['batch:3', 'value3'],
      ]);

      const values = await adapter.mget(['batch:1', 'batch:2', 'batch:3']);
      expect(values).toEqual(['value1', 'value2', 'value3']);
    });

    test('mset with TTL per entry', async () => {
      await adapter.mset([
        ['ttl:1', 'expires-fast', 1],
        ['ttl:2', 'no-ttl'],
        ['ttl:3', 'expires-slow', 10],
      ]);

      // All should exist immediately
      let values = await adapter.mget(['ttl:1', 'ttl:2', 'ttl:3']);
      expect(values).toEqual(['expires-fast', 'no-ttl', 'expires-slow']);

      // Wait for first to expire
      await wait(1100);

      values = await adapter.mget(['ttl:1', 'ttl:2', 'ttl:3']);
      expect(values).toEqual([null, 'no-ttl', 'expires-slow']);
    });

    test('mset with empty array does nothing', async () => {
      await expect(adapter.mset([])).resolves.toBeUndefined();
    });
  });

  // ==========================================================================
  // Statistics
  // ==========================================================================

  describe('Statistics', () => {
    test('getStats returns valid statistics', async () => {
      await adapter.set('stats:1', 'value1');
      await adapter.set('stats:2', 'value2');
      await adapter.get('stats:1'); // Hit
      await adapter.get('missing'); // Miss

      const stats = await adapter.getStats();

      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('evictions');
      expect(stats).toHaveProperty('memoryUsage');
      expect(stats).toHaveProperty('entryCount');
      expect(stats).toHaveProperty('uptime');

      expect(stats.hits).toBeGreaterThanOrEqual(1);
      expect(stats.misses).toBeGreaterThanOrEqual(1);
      expect(stats.memoryUsage).toBeGreaterThan(0);
      expect(stats.uptime).toBeGreaterThan(0);
    });

    test('tracks hit/miss ratio', async () => {
      const testAdapter = createTestAdapter();
      await testAdapter.connect();

      await testAdapter.set('track:1', 'value1');

      // 2 hits
      await testAdapter.get('track:1');
      await testAdapter.get('track:1');

      // 3 misses
      await testAdapter.get('missing:1');
      await testAdapter.get('missing:2');
      await testAdapter.get('missing:3');

      const stats = await testAdapter.getStats();

      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(3);

      await testAdapter.disconnect();
    });
  });

  // ==========================================================================
  // Health Check
  // ==========================================================================

  describe('Health Check', () => {
    test('returns healthy when connected', async () => {
      const health = await adapter.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.message).toBe('Redis responding');
      expect(health.details).toHaveProperty('latency');
      expect(health.details?.connected).toBe(true);
    });

    test('includes connection details', async () => {
      const health = await adapter.healthCheck();

      expect(health.details).toMatchObject({
        host: REDIS_HOST,
        port: REDIS_PORT,
        db: 15,
        connected: true,
      });
    });

    test('measures latency', async () => {
      const health = await adapter.healthCheck();

      expect(health.details?.latency).toBeGreaterThan(0);
      expect(health.details?.latency).toBeLessThan(1000); // < 1 second
    });
  });

  // ==========================================================================
  // Validation
  // ==========================================================================

  describe('Input Validation', () => {
    test('rejects empty key in get', async () => {
      await expect(adapter.get('')).rejects.toThrow(CacheValidationError);
    });

    test('rejects empty key in set', async () => {
      await expect(adapter.set('', 'value')).rejects.toThrow(CacheValidationError);
    });

    test('rejects empty key in delete', async () => {
      await expect(adapter.delete('')).rejects.toThrow(CacheValidationError);
    });

    test('rejects whitespace-only key', async () => {
      await expect(adapter.get('   ')).rejects.toThrow(CacheValidationError);
    });
  });

  // ==========================================================================
  // Error Handling
  // ==========================================================================

  describe('Error Handling', () => {
    test('wraps Redis errors with CacheOperationError', async () => {
      await adapter.disconnect();

      try {
        await adapter.get('test:key');
        throw new Error('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(CacheOperationError);
        expect((error as CacheOperationError).details?.adapter).toBe('RedisAdapter');
      }
    });

    test('includes original error message', async () => {
      await adapter.disconnect();

      try {
        await adapter.set('test:key', 'value');
        throw new Error('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(CacheOperationError);
        expect((error as CacheOperationError).details?.originalError).toBeDefined();
      }
    });
  });

  // ==========================================================================
  // Large Data Tests
  // ==========================================================================

  describe('Large Data Handling', () => {
    test('handles large values', async () => {
      const largeValue = 'x'.repeat(1024 * 100); // 100KB

      await adapter.set('large:value', largeValue);
      const retrieved = await adapter.get('large:value');

      expect(retrieved).toBe(largeValue);
    });

    test('handles many keys', async () => {
      const entries: [string, string][] = [];
      for (let i = 0; i < 100; i++) {
        entries.push([`many:${i}`, `value${i}`]);
      }

      await adapter.mset(entries);

      const keys = entries.map(([key]) => key);
      const values = await adapter.mget(keys);

      expect(values).toHaveLength(100);
      expect(values.every((v, i) => v === `value${i}`)).toBe(true);
    });
  });

  // ==========================================================================
  // Special Characters
  // ==========================================================================

  describe('Special Characters', () => {
    test('handles keys with special characters', async () => {
      const key = 'test:key:with:colons:and-dashes_and_underscores';
      await adapter.set(key, 'value');

      const value = await adapter.get(key);
      expect(value).toBe('value');
    });

    test('handles values with special characters', async () => {
      const value = 'Value with "quotes", \\backslashes\\, and \nnewlines\n';
      await adapter.set('special:value', value);

      const retrieved = await adapter.get('special:value');
      expect(retrieved).toBe(value);
    });

    test('handles JSON values', async () => {
      const json = JSON.stringify({
        name: 'Alice',
        age: 30,
        nested: { key: 'value' },
      });

      await adapter.set('json:value', json);
      const retrieved = await adapter.get('json:value');

      expect(JSON.parse(retrieved!)).toEqual(JSON.parse(json));
    });
  });

  // ==========================================================================
  // Concurrent Operations
  // ==========================================================================

  describe('Concurrent Operations', () => {
    test('handles concurrent gets', async () => {
      await adapter.set('concurrent:key', 'value');

      const promises = Array.from({ length: 10 }, () => adapter.get('concurrent:key'));

      const results = await Promise.all(promises);

      expect(results.every(v => v === 'value')).toBe(true);
    });

    test('handles concurrent sets', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        adapter.set(`concurrent:${i}`, `value${i}`)
      );

      await Promise.all(promises);

      const keys = Array.from({ length: 10 }, (_, i) => `concurrent:${i}`);
      const values = await adapter.mget(keys);

      expect(values.every((v, i) => v === `value${i}`)).toBe(true);
    });
  });
});
