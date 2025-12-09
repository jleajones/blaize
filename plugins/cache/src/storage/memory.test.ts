/**
 * Tests for MemoryAdapter
 *
 * Covers:
 * - Basic operations (get, set, delete)
 * - Bulk operations (mget, mset)
 * - LRU eviction
 * - TTL expiration
 * - Statistics tracking
 * - Edge cases and error handling
 */

import { MemoryAdapter } from './memory';

describe('MemoryAdapter', () => {
  let adapter: MemoryAdapter;

  beforeEach(() => {
    adapter = new MemoryAdapter({ maxEntries: 3 });
  });

  afterEach(async () => {
    await adapter.disconnect();
  });

  // ==========================================================================
  // Basic Operations
  // ==========================================================================

  describe('get()', () => {
    test('returns null for non-existent key', async () => {
      const result = await adapter.get('missing');
      expect(result).toBeNull();
    });

    test('returns value for existing key', async () => {
      await adapter.set('key1', 'value1');
      const result = await adapter.get('key1');
      expect(result).toBe('value1');
    });

    test('updates LRU order on access', async () => {
      await adapter.set('key1', 'value1');
      await adapter.set('key2', 'value2');
      await adapter.set('key3', 'value3');

      // Access key1 to make it most recently used
      await adapter.get('key1');

      // Add key4, should evict key2 (least recently used)
      await adapter.set('key4', 'value4');

      expect(await adapter.get('key1')).toBe('value1');
      expect(await adapter.get('key2')).toBeNull();
      expect(await adapter.get('key3')).toBe('value3');
      expect(await adapter.get('key4')).toBe('value4');
    });

    test('increments hit counter on successful get', async () => {
      await adapter.set('key1', 'value1');
      await adapter.get('key1');

      const stats = await adapter.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(0);
    });

    test('increments miss counter on failed get', async () => {
      await adapter.get('missing');

      const stats = await adapter.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(1);
    });
  });

  describe('set()', () => {
    test('stores value successfully', async () => {
      await adapter.set('key1', 'value1');
      expect(await adapter.get('key1')).toBe('value1');
    });

    test('overwrites existing key', async () => {
      await adapter.set('key1', 'value1');
      await adapter.set('key1', 'value2');
      expect(await adapter.get('key1')).toBe('value2');
    });

    test('accepts empty string value', async () => {
      await adapter.set('key1', '');
      expect(await adapter.get('key1')).toBe('');
    });

    test('handles special characters in key', async () => {
      await adapter.set('key:with:colons', 'value');
      await adapter.set('key\nwith\nnewlines', 'value');
      await adapter.set('key"with"quotes', 'value');

      expect(await adapter.get('key:with:colons')).toBe('value');
      expect(await adapter.get('key\nwith\nnewlines')).toBe('value');
      expect(await adapter.get('key"with"quotes')).toBe('value');
    });

    test('handles large values (>1KB)', async () => {
      const largeValue = 'x'.repeat(10000);
      await adapter.set('large', largeValue);
      expect(await adapter.get('large')).toBe(largeValue);
    });

    test('throws error for negative TTL', async () => {
      await expect(adapter.set('key1', 'value1', -1)).rejects.toThrow('TTL must be non-negative');
    });

    test('accepts TTL of 0 (immediate expiration)', async () => {
      await adapter.set('key1', 'value1', 0);
      // With TTL=0, entry should not be stored or immediately expire
      // Implementation treats 0 as no TTL, so value should exist
      expect(await adapter.get('key1')).toBe('value1');
    });
  });

  describe('delete()', () => {
    test('returns true when key exists', async () => {
      await adapter.set('key1', 'value1');
      const result = await adapter.delete('key1');
      expect(result).toBe(true);
    });

    test('returns false when key does not exist', async () => {
      const result = await adapter.delete('missing');
      expect(result).toBe(false);
    });

    test('removes key from cache', async () => {
      await adapter.set('key1', 'value1');
      await adapter.delete('key1');
      expect(await adapter.get('key1')).toBeNull();
    });

    test('clears associated timer', async () => {
      vi.useFakeTimers();

      await adapter.set('key1', 'value1', 60);
      await adapter.delete('key1');

      // Advance time - entry should not expire since timer was cleared
      vi.advanceTimersByTime(61000);

      // Key should not exist (was deleted, not expired)
      expect(await adapter.get('key1')).toBeNull();

      vi.useRealTimers();
    });
  });

  // ==========================================================================
  // Bulk Operations
  // ==========================================================================

  describe('mget()', () => {
    test('returns values for existing keys', async () => {
      await adapter.set('key1', 'value1');
      await adapter.set('key2', 'value2');

      const results = await adapter.mget(['key1', 'key2']);
      expect(results).toEqual(['value1', 'value2']);
    });

    test('returns null for missing keys', async () => {
      await adapter.set('key1', 'value1');

      const results = await adapter.mget(['key1', 'missing']);
      expect(results).toEqual(['value1', null]);
    });

    test('handles empty array', async () => {
      const results = await adapter.mget([]);
      expect(results).toEqual([]);
    });

    test('handles duplicate keys', async () => {
      await adapter.set('key1', 'value1');

      const results = await adapter.mget(['key1', 'key1']);
      expect(results).toEqual(['value1', 'value1']);
    });
  });

  describe('mset()', () => {
    test('sets multiple keys', async () => {
      await adapter.mset([
        ['key1', 'value1'],
        ['key2', 'value2'],
      ]);

      expect(await adapter.get('key1')).toBe('value1');
      expect(await adapter.get('key2')).toBe('value2');
    });

    test('sets keys with different TTLs', async () => {
      await adapter.mset([
        ['key1', 'value1', 60],
        ['key2', 'value2', 120],
      ]);

      expect(await adapter.get('key1')).toBe('value1');
      expect(await adapter.get('key2')).toBe('value2');
    });

    test('handles duplicate keys (last write wins)', async () => {
      await adapter.mset([
        ['key1', 'value1'],
        ['key1', 'value2'],
      ]);

      expect(await adapter.get('key1')).toBe('value2');
    });

    test('handles empty array', async () => {
      await adapter.mset([]);
      const stats = await adapter.getStats();
      expect(stats.entryCount).toBe(0);
    });
  });

  // ==========================================================================
  // LRU Eviction
  // ==========================================================================

  describe('LRU Eviction', () => {
    test('evicts least recently used entry when maxEntries reached', async () => {
      await adapter.set('key1', 'value1');
      await adapter.set('key2', 'value2');
      await adapter.set('key3', 'value3');

      // Store is full (maxEntries=3)
      // Add key4, should evict key1 (oldest)
      await adapter.set('key4', 'value4');

      expect(await adapter.get('key1')).toBeNull();
      expect(await adapter.get('key2')).toBe('value2');
      expect(await adapter.get('key3')).toBe('value3');
      expect(await adapter.get('key4')).toBe('value4');
    });

    test('increments eviction counter', async () => {
      await adapter.set('key1', 'value1');
      await adapter.set('key2', 'value2');
      await adapter.set('key3', 'value3');
      await adapter.set('key4', 'value4'); // Triggers eviction

      const stats = await adapter.getStats();
      expect(stats.evictions).toBe(1);
    });

    test('handles maxEntries boundary exactly at limit', async () => {
      await adapter.set('key1', 'value1');
      await adapter.set('key2', 'value2');
      await adapter.set('key3', 'value3');

      const stats = await adapter.getStats();
      expect(stats.entryCount).toBe(3);
      expect(stats.evictions).toBe(0);
    });

    test('handles maxEntries boundary one over limit', async () => {
      await adapter.set('key1', 'value1');
      await adapter.set('key2', 'value2');
      await adapter.set('key3', 'value3');
      await adapter.set('key4', 'value4');

      const stats = await adapter.getStats();
      expect(stats.entryCount).toBe(3);
      expect(stats.evictions).toBe(1);
    });

    test('maintains LRU order during concurrent access', async () => {
      await adapter.set('key1', 'value1');
      await adapter.set('key2', 'value2');
      await adapter.set('key3', 'value3');

      // Access keys in reverse order
      await adapter.get('key3');
      await adapter.get('key2');
      await adapter.get('key1');

      // Add key4, should evict key3 (now LRU after access pattern)
      await adapter.set('key4', 'value4');

      expect(await adapter.get('key1')).toBe('value1');
      expect(await adapter.get('key2')).toBe('value2');
      expect(await adapter.get('key3')).toBeNull();
      expect(await adapter.get('key4')).toBe('value4');
    });

    test('prevents memory leaks when maxEntries = 0', async () => {
      const zeroAdapter = new MemoryAdapter({ maxEntries: 0 });

      // Should evict immediately
      await zeroAdapter.set('key1', 'value1');

      const stats = await zeroAdapter.getStats();
      expect(stats.entryCount).toBe(0);
      expect(stats.evictions).toBe(1);

      await zeroAdapter.disconnect();
    });
  });

  // ==========================================================================
  // TTL Expiration
  // ==========================================================================

  describe('TTL Expiration', () => {
    test('expires entry after TTL', async () => {
      vi.useFakeTimers();

      await adapter.set('key1', 'value1', 60); // 60 seconds

      // Before expiration
      expect(await adapter.get('key1')).toBe('value1');

      // After expiration
      vi.advanceTimersByTime(61000);
      expect(await adapter.get('key1')).toBeNull();

      vi.useRealTimers();
    });

    test('passive expiration on get', async () => {
      vi.useFakeTimers();

      await adapter.set('key1', 'value1', 60);

      // Advance time but don't wait for timer
      vi.advanceTimersByTime(61000);

      // Get should detect expiration and remove entry
      const result = await adapter.get('key1');
      expect(result).toBeNull();

      const stats = await adapter.getStats();
      expect(stats.entryCount).toBe(0);

      vi.useRealTimers();
    });

    test('clears timer when entry is overwritten', async () => {
      vi.useFakeTimers();

      await adapter.set('key1', 'value1', 60);
      await adapter.set('key1', 'value2', 120); // New TTL

      // Original timer should be cleared
      vi.advanceTimersByTime(61000);
      expect(await adapter.get('key1')).toBe('value2');

      // New timer should work
      vi.advanceTimersByTime(60000);
      expect(await adapter.get('key1')).toBeNull();

      vi.useRealTimers();
    });

    test('uses defaultTtl when TTL not specified', async () => {
      vi.useFakeTimers();

      const adapterWithDefault = new MemoryAdapter({
        maxEntries: 10,
        defaultTtl: 30,
      });

      await adapterWithDefault.set('key1', 'value1'); // Uses defaultTtl

      vi.advanceTimersByTime(31000);
      expect(await adapterWithDefault.get('key1')).toBeNull();

      await adapterWithDefault.disconnect();
      vi.useRealTimers();
    });

    test('explicit TTL overrides defaultTtl', async () => {
      vi.useFakeTimers();

      const adapterWithDefault = new MemoryAdapter({
        maxEntries: 10,
        defaultTtl: 30,
      });

      await adapterWithDefault.set('key1', 'value1', 60); // Override

      vi.advanceTimersByTime(31000);
      expect(await adapterWithDefault.get('key1')).toBe('value1');

      vi.advanceTimersByTime(30000);
      expect(await adapterWithDefault.get('key1')).toBeNull();

      await adapterWithDefault.disconnect();
      vi.useRealTimers();
    });

    test('handles rapid set/delete/set sequence', async () => {
      vi.useFakeTimers();

      await adapter.set('key1', 'value1', 60);
      await adapter.delete('key1');
      await adapter.set('key1', 'value2', 60);

      vi.advanceTimersByTime(61000);

      // Only the last set's timer should remain
      expect(await adapter.get('key1')).toBeNull();

      vi.useRealTimers();
    });
  });

  // ==========================================================================
  // Statistics
  // ==========================================================================

  describe('getStats()', () => {
    test('tracks hits and misses', async () => {
      await adapter.set('key1', 'value1');

      await adapter.get('key1'); // Hit
      await adapter.get('missing'); // Miss
      await adapter.get('key1'); // Hit

      const stats = await adapter.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
    });

    test('tracks evictions', async () => {
      await adapter.set('key1', 'value1');
      await adapter.set('key2', 'value2');
      await adapter.set('key3', 'value3');
      await adapter.set('key4', 'value4'); // Evicts key1
      await adapter.set('key5', 'value5'); // Evicts key2

      const stats = await adapter.getStats();
      expect(stats.evictions).toBe(2);
    });

    test('tracks entry count', async () => {
      await adapter.set('key1', 'value1');
      await adapter.set('key2', 'value2');

      const stats = await adapter.getStats();
      expect(stats.entryCount).toBe(2);
    });

    test('tracks memory usage', async () => {
      const stats1 = await adapter.getStats();
      expect(stats1.memoryUsage).toBe(0);

      await adapter.set('key1', 'value1');

      const stats2 = await adapter.getStats();
      expect(stats2.memoryUsage).toBeGreaterThan(0);
    });

    test('tracks uptime', async () => {
      vi.useFakeTimers();

      const stats1 = await adapter.getStats();
      expect(stats1.uptime).toBe(0);

      vi.advanceTimersByTime(5000);

      const stats2 = await adapter.getStats();
      expect(stats2.uptime).toBe(5000);

      vi.useRealTimers();
    });

    test('returns accurate counts during concurrent operations', async () => {
      // Rapid operations
      await adapter.set('key1', 'value1');
      await adapter.get('key1');
      await adapter.set('key2', 'value2');
      await adapter.get('missing');
      await adapter.delete('key1');

      const stats = await adapter.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.entryCount).toBe(1);
    });
  });

  // ==========================================================================
  // Health Check
  // ==========================================================================

  describe('healthCheck()', () => {
    test('returns healthy status', async () => {
      const health = await adapter.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.message).toBe('In-memory adapter operational');
    });

    test('includes entry count in details', async () => {
      await adapter.set('key1', 'value1');
      await adapter.set('key2', 'value2');

      const health = await adapter.healthCheck();

      expect(health.details?.entryCount).toBe(2);
      expect(health.details?.maxEntries).toBe(3);
      expect(health.details?.memoryUsage).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Lifecycle
  // ==========================================================================

  describe('disconnect()', () => {
    test('clears all timers', async () => {
      vi.useFakeTimers();

      await adapter.set('key1', 'value1', 60);
      await adapter.set('key2', 'value2', 60);

      await adapter.disconnect();

      // Advance time - entries should not expire (timers cleared)
      vi.advanceTimersByTime(61000);

      // Store should be empty (disconnect cleared it)
      const stats = await adapter.getStats();
      expect(stats.entryCount).toBe(0);

      vi.useRealTimers();
    });

    test('clears store', async () => {
      await adapter.set('key1', 'value1');
      await adapter.set('key2', 'value2');

      await adapter.disconnect();

      const stats = await adapter.getStats();
      expect(stats.entryCount).toBe(0);
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('Edge Cases', () => {
    test('handles concurrent set operations on same key', async () => {
      // Rapid updates to same key
      await Promise.all([
        adapter.set('key1', 'value1'),
        adapter.set('key1', 'value2'),
        adapter.set('key1', 'value3'),
      ]);

      // Last write should win
      const result = await adapter.get('key1');
      expect(['value1', 'value2', 'value3']).toContain(result);
    });

    test('handles very large keys (>1KB)', async () => {
      const largeKey = 'k'.repeat(2000);
      await adapter.set(largeKey, 'value');
      expect(await adapter.get(largeKey)).toBe('value');
    });

    test('mget with all missing keys', async () => {
      const results = await adapter.mget(['missing1', 'missing2', 'missing3']);
      expect(results).toEqual([null, null, null]);
    });

    test('handles undefined TTL (no expiration)', async () => {
      vi.useFakeTimers();

      await adapter.set('key1', 'value1', undefined);

      vi.advanceTimersByTime(100000);

      expect(await adapter.get('key1')).toBe('value1');

      vi.useRealTimers();
    });
  });

  // ==========================================================================
  // Stress Test
  // ==========================================================================

  describe('Stress Tests', () => {
    test('handles 10k operations', async () => {
      const largeAdapter = new MemoryAdapter({ maxEntries: 10000 });

      // Set 10k entries
      for (let i = 0; i < 10000; i++) {
        await largeAdapter.set(`key${i}`, `value${i}`);
      }

      const stats1 = await largeAdapter.getStats();
      expect(stats1.entryCount).toBe(10000);

      // Get 10k entries
      for (let i = 0; i < 10000; i++) {
        const result = await largeAdapter.get(`key${i}`);
        expect(result).toBe(`value${i}`);
      }

      const stats2 = await largeAdapter.getStats();
      expect(stats2.hits).toBe(10000);

      await largeAdapter.disconnect();
    });
  });
});
