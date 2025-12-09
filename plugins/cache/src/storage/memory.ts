/**
 * In-memory cache adapter with LRU eviction and TTL support
 *
 * @packageDocumentation
 */

import type { CacheAdapter, CacheStats, MemoryAdapterConfig } from '../types';

/**
 * Cache entry with value and metadata
 */
interface CacheEntry {
  value: string;
  /** Expiration timestamp in milliseconds (0 = no expiration) */
  expiresAt: number;
  /** Approximate size in bytes */
  size: number;
}

/**
 * In-memory cache adapter with LRU eviction
 *
 * Features:
 * - LRU (Least Recently Used) eviction when maxEntries reached
 * - TTL (Time To Live) expiration with automatic cleanup
 * - Memory usage tracking (approximate)
 * - Thread-safe operations
 * - Passive expiration on get operations
 *
 * @example
 * ```typescript
 * const adapter = new MemoryAdapter({
 *   maxEntries: 1000,
 *   defaultTtl: 3600, // 1 hour
 * });
 *
 * await adapter.set('user:123', JSON.stringify({ name: 'Alice' }), 300);
 * const user = await adapter.get('user:123');
 * ```
 */
export class MemoryAdapter implements CacheAdapter {
  private store: Map<string, CacheEntry>;
  private timers: Map<string, NodeJS.Timeout>;
  private maxEntries: number;
  private defaultTtl?: number;

  // Statistics
  private hits = 0;
  private misses = 0;
  private evictions = 0;
  private startTime = Date.now();

  /**
   * Create a new MemoryAdapter
   *
   * @param config - Adapter configuration
   */
  constructor(config: MemoryAdapterConfig = {}) {
    this.store = new Map();
    this.timers = new Map();
    this.maxEntries = config.maxEntries ?? 1000;
    this.defaultTtl = config.defaultTtl;
  }

  /**
   * Get value by key
   *
   * Performs passive expiration: if key is expired, removes it and returns null.
   * Updates LRU order by moving key to end of Map.
   *
   * @param key - Cache key
   * @returns Value if exists and not expired, null otherwise
   */
  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);

    if (!entry) {
      this.misses++;
      return null;
    }

    // Check expiration (passive)
    if (entry.expiresAt > 0 && Date.now() >= entry.expiresAt) {
      this.delete(key); // Clean up expired entry
      this.misses++;
      return null;
    }

    // Update LRU order (move to end)
    this.store.delete(key);
    this.store.set(key, entry);

    this.hits++;
    return entry.value;
  }

  /**
   * Set value with optional TTL
   *
   * If maxEntries is reached, evicts least recently used entry.
   * Sets up automatic expiration via setTimeout if TTL provided.
   *
   * @param key - Cache key
   * @param value - Value to store
   * @param ttl - Time to live in seconds (optional, uses defaultTtl if not provided)
   */
  async set(key: string, value: string, ttl?: number): Promise<void> {
    // Validate inputs
    if (ttl !== undefined && ttl < 0) {
      throw new Error('TTL must be non-negative');
    }

    // Clean up existing timer if key exists
    const existingTimer = this.timers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.timers.delete(key);
    }

    // Remove existing entry (will re-add at end for LRU)
    if (this.store.has(key)) {
      this.store.delete(key);
    }

    // LRU eviction if at capacity
    if (this.store.size >= this.maxEntries) {
      this.evictLRU();
    }

    // Calculate expiration
    const effectiveTtl = ttl ?? this.defaultTtl;
    const expiresAt = effectiveTtl ? Date.now() + effectiveTtl * 1000 : 0;

    // Calculate approximate size (key + value + overhead)
    const size = this.estimateSize(key, value);

    // Store entry
    const entry: CacheEntry = {
      value,
      expiresAt,
      size,
    };

    this.store.set(key, entry);

    while (this.store.size > this.maxEntries) {
      this.evictLRU();
    }

    // Set up expiration timer if TTL provided
    if (effectiveTtl && effectiveTtl > 0) {
      const timer = setTimeout(() => {
        this.delete(key);
      }, effectiveTtl * 1000);

      // Prevent timer from keeping process alive
      timer.unref();

      this.timers.set(key, timer);
    }
  }

  /**
   * Delete key from cache
   *
   * Cleans up associated timer if exists.
   *
   * @param key - Cache key
   * @returns true if key existed and was deleted, false otherwise
   */
  async delete(key: string): Promise<boolean> {
    // Clean up timer
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }

    // Delete from store
    const existed = this.store.delete(key);

    return existed;
  }

  /**
   * Get multiple keys
   *
   * @param keys - Array of cache keys
   * @returns Array of values (null for missing/expired keys)
   */
  async mget(keys: string[]): Promise<(string | null)[]> {
    const results: (string | null)[] = [];

    for (const key of keys) {
      results.push(await this.get(key));
    }

    return results;
  }

  /**
   * Set multiple keys
   *
   * If duplicate keys exist in entries array, last write wins.
   *
   * @param entries - Array of [key, value, ttl?] tuples
   */
  async mset(entries: [string, string, number?][]): Promise<void> {
    for (const [key, value, ttl] of entries) {
      await this.set(key, value, ttl);
    }
  }

  /**
   * Get adapter statistics
   *
   * @returns Cache statistics including hits, misses, evictions, memory usage
   */
  async getStats(): Promise<CacheStats> {
    return {
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      memoryUsage: this.calculateMemoryUsage(),
      entryCount: this.store.size,
      uptime: Date.now() - this.startTime,
    };
  }

  /**
   * Health check
   *
   * @returns Health status (always healthy for in-memory adapter)
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    message?: string;
    details?: Record<string, unknown>;
  }> {
    return {
      healthy: true,
      message: 'In-memory adapter operational',
      details: {
        entryCount: this.store.size,
        maxEntries: this.maxEntries,
        memoryUsage: this.calculateMemoryUsage(),
      },
    };
  }

  /**
   * Disconnect (cleanup)
   *
   * Clears all timers and store.
   */
  async disconnect(): Promise<void> {
    // Clear all timers
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();

    // Clear store
    this.store.clear();
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  /**
   * Evict least recently used entry
   *
   * Map maintains insertion order, so first entry is LRU.
   */
  private evictLRU(): void {
    const firstKey = this.store.keys().next().value;

    if (firstKey !== undefined) {
      this.delete(firstKey);
      this.evictions++;
    }
  }

  /**
   * Estimate size of entry in bytes
   *
   * Approximate calculation:
   * - Each character in key/value: 2 bytes (UTF-16)
   * - Object overhead: ~40 bytes
   *
   * @param key - Cache key
   * @param value - Cache value
   * @returns Approximate size in bytes
   */
  private estimateSize(key: string, value: string): number {
    const keySize = key.length * 2;
    const valueSize = value.length * 2;
    const overhead = 40; // Approximate object overhead

    return keySize + valueSize + overhead;
  }

  /**
   * Calculate total memory usage
   *
   * @returns Approximate total memory usage in bytes
   */
  private calculateMemoryUsage(): number {
    let total = 0;

    for (const entry of this.store.values()) {
      total += entry.size;
    }

    return total;
  }
}
