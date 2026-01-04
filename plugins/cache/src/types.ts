/**
 * Cache plugin type definitions
 *
 * @packageDocumentation
 */
import type { CacheService } from './cache-service';
import type { BlaizeLogger, EventBus, Services } from 'blaizejs';

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
  type: 'set' | 'delete' | 'eviction';

  /** Cache key */
  key: string;

  /** Value (for 'set' events) */
  value?: string;

  /** Event timestamp in ISO 8601 format */
  timestamp: string;

  /** Server ID for multi-server coordination (optional) */
  serverId?: string;

  /** Sequence number for event ordering (optional) */
  sequence?: number;
}

/**
 * Cache watch handler function
 */
export type CacheWatchHandler = (event: CacheChangeEvent) => void | Promise<void>;

/**
 * Cache service options
 */
export interface CacheServiceOptions {
  /** Cache adapter implementation */
  adapter: CacheAdapter;

  /**
   * EventBus for cross-server cache invalidation
   *
   * Use server.eventBus for multi-server coordination.
   * Events published: `cache:invalidated`
   *
   * @example
   * ```typescript
   * const service = new CacheService({
   *   adapter,
   *   eventBus: server.eventBus,
   *   serverId: 'server-a',
   *   logger
   * });
   * ```
   */
  eventBus?: EventBus;

  /**
   * Server ID for multi-server setups
   *
   * Required when using eventBus to prevent event echoes.
   * Should be unique per server instance.
   *
   * @example
   * ```typescript
   * serverId: `server-${process.env.POD_NAME || 'local'}`
   * ```
   */
  serverId?: string;

  /** Logger instance for structured logging */
  logger: BlaizeLogger;
}

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

  /**
   * Server ID for multi-server coordination
   *
   * Required when using EventBus for cross-server cache invalidation.
   * Should be unique per server instance.
   *
   * When provided, the plugin automatically uses server.eventBus for
   * cross-server cache coordination. No additional setup needed!
   *
   * @example
   * ```typescript
   * createCachePlugin({
   *   adapter: new RedisAdapter({ host: 'localhost' }),
   *   serverId: `server-${process.env.POD_NAME || 'local'}`,
   *   // EventBus from server.eventBus is used automatically
   * })
   * ```
   */
  serverId?: string;
}

/**
 * Services provided by cache plugin
 */
export interface CachePluginServices extends Services {
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

/**
 * Redis adapter configuration
 *
 * Configuration options for connecting to Redis server.
 *
 * @example Basic configuration
 * ```typescript
 * const config: RedisAdapterConfig = {
 *   host: 'localhost',
 *   port: 6379
 * };
 * ```
 *
 * @example Production with auth
 * ```typescript
 * const config: RedisAdapterConfig = {
 *   host: process.env.REDIS_HOST,
 *   port: 6379,
 *   password: process.env.REDIS_PASSWORD,
 *   db: 1,
 *   retryStrategy: (times) => Math.min(times * 100, 3000)
 * };
 * ```
 */
export interface RedisAdapterConfig {
  /** Redis server hostname */
  host: string;

  /** Redis server port */
  port: number;

  /** Optional password for authentication */
  password?: string;

  /** Redis database number (0-15) */
  db?: number;

  /**
   * Retry strategy for connection failures
   *
   * Function that returns delay in milliseconds based on attempt number.
   * Return null to stop retrying.
   *
   * @param times - Number of connection attempts
   * @returns Delay in milliseconds, or null to stop
   *
   * @default Exponential backoff: min(times * 50, 2000)
   */
  retryStrategy?: (times: number) => number | null;

  /**
   * Connection timeout in milliseconds
   *
   * @default 10000 (10 seconds)
   */
  connectTimeout?: number;

  /**
   * Command timeout in milliseconds
   *
   * @default 5000 (5 seconds)
   */
  commandTimeout?: number;

  /**
   * Maximum number of retry attempts
   *
   * @default 10
   */
  maxRetriesPerRequest?: number;

  /**
   * Enable offline queue
   *
   * When true, commands are queued while disconnected.
   *
   * @default true
   */
  enableOfflineQueue?: boolean;
}

/**
 * Redis Pub/Sub interface for cross-server event propagation
 *
 * Enables cache invalidation events to propagate across multiple servers
 * connected to the same Redis instance.
 *
 * **Pattern Subscriptions:**
 * - Uses Redis PSUBSCRIBE for pattern matching
 * - Patterns like "cache:*" match all cache events
 * - Each subscriber creates a separate Redis connection
 *
 * **Event Flow:**
 * 1. Server A: `cache.set('user:123', data)` → publishes event
 * 2. Redis: Broadcasts event to all subscribers
 * 3. Server B: Receives event → invalidates local cache
 *
 * @example Basic pub/sub
 * ```typescript
 * const pubsub = adapter.createPubSub('server-a');
 * await pubsub.connect();
 *
 * // Subscribe to all cache events
 * const unsubscribe = pubsub.subscribe('cache:*', (event) => {
 *   console.log('Cache change:', event.key);
 * });
 *
 * // Publish an event
 * await pubsub.publish('cache:*', {
 *   type: 'set',
 *   key: 'user:123',
 *   value: 'data',
 *   timestamp: Date.now(),
 *   serverId: 'server-a'
 * });
 *
 * // Cleanup
 * unsubscribe();
 * await pubsub.disconnect();
 * ```
 *
 * @example Multi-server coordination
 * ```typescript
 * // Server A
 * const pubsubA = adapterA.createPubSub('server-a');
 * await pubsubA.connect();
 * pubsubA.subscribe('cache:*', (event) => {
 *   if (event.serverId !== 'server-a') {
 *     // Event from another server - invalidate local cache
 *     localCache.delete(event.key);
 *   }
 * });
 *
 * // Server B
 * const pubsubB = adapterB.createPubSub('server-b');
 * await pubsubB.connect();
 * pubsubB.subscribe('cache:*', (event) => {
 *   if (event.serverId !== 'server-b') {
 *     localCache.delete(event.key);
 *   }
 * });
 * ```
 */
export interface RedisPubSub {
  /**
   * Publish event to pattern
   *
   * Broadcasts event to all servers subscribed to the pattern.
   * Event is serialized to JSON before publishing.
   *
   * @param pattern - Redis pattern (e.g., "cache:*")
   * @param event - Cache change event
   *
   * @throws {CacheOperationError} If publish fails
   *
   * @example
   * ```typescript
   * await pubsub.publish('cache:*', {
   *   type: 'set',
   *   key: 'user:123',
   *   value: '{"name":"Alice"}',
   *   timestamp: Date.now(),
   *   serverId: 'server-a'
   * });
   * ```
   */
  publish(pattern: string, event: CacheChangeEvent): Promise<void>;

  /**
   * Subscribe to pattern
   *
   * Receives events from all servers publishing to the pattern.
   * Uses Redis PSUBSCRIBE for pattern matching.
   *
   * **Important:** Subscriptions are maintained across reconnections.
   *
   * @param pattern - Redis pattern (e.g., "cache:*")
   * @param handler - Event handler function
   * @returns Cleanup function to unsubscribe
   *
   * @example
   * ```typescript
   * const unsubscribe = pubsub.subscribe('cache:user:*', (event) => {
   *   console.log(`User ${event.key} changed:`, event.type);
   * });
   *
   * // Later: cleanup
   * unsubscribe();
   * ```
   */
  subscribe(pattern: string, handler: (event: CacheChangeEvent) => void): Promise<() => void>;

  /**
   * Connect to Redis pub/sub
   *
   * Creates a separate Redis connection for pub/sub.
   * **Note:** This is separate from the main adapter connection.
   *
   * @throws {CacheConnectionError} If connection fails
   *
   * @example
   * ```typescript
   * const pubsub = adapter.createPubSub('server-a');
   * await pubsub.connect();
   * ```
   */
  connect(): Promise<void>;

  /**
   * Disconnect from Redis pub/sub
   *
   * Closes the pub/sub connection and cleans up subscriptions.
   *
   * @example
   * ```typescript
   * await pubsub.disconnect();
   * ```
   */
  disconnect(): Promise<void>;
}

/**
 * Dashboard data structure
 */
export interface DashboardData {
  /** Cache statistics */
  stats: CacheStats;

  /** Calculated hit rate (0-1) */
  hitRate: number;

  /** Recent cache keys (last 50) */
  recentKeys: Array<{
    key: string;
    size: number;
    ttl: number | null;
  }>;

  /** Current timestamp */
  timestamp: number;
}
