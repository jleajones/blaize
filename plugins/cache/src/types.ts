/**
 * Cache plugin type definitions
 *
 * @packageDocumentation
 */

import { CacheService } from './cache-service';

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

/**
 * Cache entry with value and metadata
 */
export interface CacheEntry {
  value: string;
  /** Expiration timestamp in milliseconds (0 = no expiration) */
  expiresAt: number;
  /** Approximate size in bytes */
  size: number;
}

/**
 * Cache change event
 */
export interface CacheChangeEvent {
  /** Event type */
  type: 'set' | 'delete';

  /** Cache key */
  key: string;

  /** Value (for 'set' events) */
  value?: string;

  /** Event timestamp in milliseconds */
  timestamp: number;

  /** Server ID for multi-server coordination (optional) */
  serverId?: string;
}

/**
 * Cache watch handler function
 */
export type CacheWatchHandler = (event: CacheChangeEvent) => void | Promise<void>;

/**
 * Cache plugin configuration
 */
export interface CachePluginConfig {
  /** Cache adapter implementation (defaults to MemoryAdapter) */
  adapter?: CacheAdapter;

  /** Maximum number of entries (only for MemoryAdapter) */
  maxEntries?: number;

  /** Default TTL in seconds (only for MemoryAdapter) */
  defaultTtl?: number;

  /** Server ID for multi-server coordination (optional) */
  serverId?: string;
}

/**
 * Services provided by cache plugin
 */
export interface CachePluginServices {
  /** Cache service instance */
  cache: CacheService;
}

// ============================================================================
// Error Details Interfaces
// ============================================================================

/**
 * Base cache error details
 *
 * Common fields included in all cache error details.
 */
export interface CacheErrorDetails {
  /** Operation that failed (e.g., 'get', 'set') */
  operation?: string;

  /** Cache key involved in the error */
  key?: string;

  /** Adapter name (e.g., 'MemoryAdapter', 'RedisAdapter') */
  adapter?: string;
}

/**
 * Connection error details
 *
 * Details specific to cache adapter connection failures.
 */
export interface CacheConnectionErrorDetails extends CacheErrorDetails {
  /** Host address of the cache server */
  host?: string;

  /** Port number of the cache server */
  port?: number;

  /** Reason for connection failure */
  reason?: string;

  /** Original error message from underlying driver */
  originalError?: string;
}

/**
 * Operation error details
 *
 * Details specific to cache operation failures.
 */
export interface CacheOperationErrorDetails extends CacheErrorDetails {
  /** Cache method that failed */
  method?: 'get' | 'set' | 'delete' | 'mget' | 'mset';

  /** TTL value if applicable */
  ttl?: number;

  /** Value involved (truncated for large values) */
  value?: unknown;

  /** Original error message from underlying driver */
  originalError?: string;
}

/**
 * Validation error details
 *
 * Details specific to cache validation failures.
 */
export interface CacheValidationErrorDetails extends CacheErrorDetails {
  /** Field that failed validation */
  field?: string;

  /** Expected type or constraint */
  expectedType?: string;

  /** Type that was actually received */
  receivedType?: string;

  /** Validation constraint that failed */
  constraint?: string;

  /** Value that failed validation */
  value?: unknown;
}
