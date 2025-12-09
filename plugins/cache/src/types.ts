/**
 * Cache plugin type definitions
 *
 * @packageDocumentation
 */

/**
 * Cache adapter statistics
 */
export interface CacheStats {
  /** Number of cache hits */
  hits: number;

  /** Number of cache misses */
  misses: number;

  /** Number of entries evicted (LRU or TTL) */
  evictions: number;

  /** Approximate memory usage in bytes */
  memoryUsage: number;

  /** Current number of entries in cache */
  entryCount: number;

  /** Uptime in milliseconds since adapter started */
  uptime?: number;
}

/**
 * Cache adapter interface
 *
 * All cache adapters must implement this interface.
 * Lifecycle methods (connect, disconnect, healthCheck) are optional.
 *
 * @example
 * ```typescript
 * class MemoryAdapter implements CacheAdapter {
 *   async get(key: string): Promise<string | null> {
 *     return this.store.get(key) ?? null;
 *   }
 *
 *   async set(key: string, value: string, ttl?: number): Promise<void> {
 *     this.store.set(key, value);
 *     if (ttl) this.setExpiration(key, ttl);
 *   }
 * }
 * ```
 */
export interface CacheAdapter {
  /**
   * Get value by key
   *
   * @param key - Cache key
   * @returns Value if exists, null otherwise
   */
  get(key: string): Promise<string | null>;

  /**
   * Set value with optional TTL
   *
   * @param key - Cache key
   * @param value - Value to store
   * @param ttl - Time to live in seconds (optional)
   */
  set(key: string, value: string, ttl?: number): Promise<void>;

  /**
   * Delete key from cache
   *
   * @param key - Cache key
   * @returns true if key existed and was deleted, false otherwise
   */
  delete(key: string): Promise<boolean>;

  /**
   * Get multiple keys
   *
   * @param keys - Array of cache keys
   * @returns Array of values (null for missing keys)
   */
  mget(keys: string[]): Promise<(string | null)[]>;

  /**
   * Set multiple keys
   *
   * @param entries - Array of [key, value, ttl?] tuples
   */
  mset(entries: [string, string, number?][]): Promise<void>;

  /**
   * Get adapter statistics
   *
   * @returns Cache statistics
   */
  getStats(): Promise<CacheStats>;

  // ========================================================================
  // Optional Lifecycle Methods
  // ========================================================================

  /**
   * Connect to adapter (optional)
   *
   * Called during plugin initialization.
   */
  connect?(): Promise<void>;

  /**
   * Disconnect from adapter (optional)
   *
   * Called during plugin termination.
   */
  disconnect?(): Promise<void>;

  /**
   * Health check (optional)
   *
   * @returns Health status with optional message and details
   */
  healthCheck?(): Promise<{
    healthy: boolean;
    message?: string;
    details?: Record<string, unknown>;
  }>;
}

/**
 * Memory adapter configuration
 */
export interface MemoryAdapterConfig {
  /**
   * Maximum number of entries before LRU eviction
   *
   * @default 1000
   */
  maxEntries?: number;

  /**
   * Default TTL in seconds (if not specified per set)
   *
   * @default undefined (no expiration)
   */
  defaultTtl?: number;
}
