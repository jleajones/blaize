/**
 * Redis Cache Adapter
 *
 * Production-ready Redis adapter with connection management,
 * retry logic, and graceful degradation.
 *
 * @packageDocumentation
 */

import Redis, { type RedisOptions } from 'ioredis';

import { RedisPubSubImpl } from './redis-pubsub';
import { CacheConnectionError, CacheOperationError, CacheValidationError } from '../../errors';

import type { CacheAdapter, CacheStats, RedisAdapterConfig, RedisPubSub } from '../../types';

/**
 * Redis cache adapter
 *
 * Production-ready Redis adapter with:
 * - Automatic connection retry with exponential backoff
 * - Graceful degradation on connection loss
 * - Pipeline optimization for batch operations
 * - TTL management with Redis SETEX/PSETEX
 * - Statistics from Redis INFO command
 *
 * @example Basic usage
 * ```typescript
 * const adapter = new RedisAdapter({
 *   host: 'localhost',
 *   port: 6379
 * });
 *
 * await adapter.connect();
 * await adapter.set('key', 'value', 60);
 * const value = await adapter.get('key');
 * await adapter.disconnect();
 * ```
 *
 * @example With retry strategy
 * ```typescript
 * const adapter = new RedisAdapter({
 *   host: 'localhost',
 *   port: 6379,
 *   retryStrategy: (times) => {
 *     if (times > 10) return null;  // Stop after 10 attempts
 *     return Math.min(times * 100, 3000);  // Max 3 second delay
 *   }
 * });
 * ```
 */
export class RedisAdapter implements CacheAdapter {
  private client: Redis;
  private config: RedisAdapterConfig;
  private isConnected: boolean = false;
  private connectionAttempts: number = 0;
  private startTime: number = Date.now();

  // Statistics
  private hits: number = 0;
  private misses: number = 0;

  /**
   * Creates a new RedisAdapter
   *
   * @param config - Redis connection configuration
   */
  constructor(config: RedisAdapterConfig) {
    this.config = config;

    // Default retry strategy: exponential backoff
    const defaultRetryStrategy = (times: number): number | null => {
      this.connectionAttempts = times;
      if (times > 10) {
        return null; // Stop after 10 attempts
      }
      return Math.min(times * 50, 2000); // Max 2 second delay
    };

    // Create Redis client with ioredis
    const redisOptions: RedisOptions = {
      host: config.host,
      port: config.port,
      password: config.password,
      db: config.db ?? 0,
      retryStrategy: config.retryStrategy ?? defaultRetryStrategy,
      connectTimeout: config.connectTimeout ?? 10000,
      commandTimeout: config.commandTimeout ?? 5000,
      maxRetriesPerRequest: config.maxRetriesPerRequest ?? 10,
      enableOfflineQueue: config.enableOfflineQueue ?? true,
      lazyConnect: true, // Don't connect until connect() is called
    };

    this.client = new Redis(redisOptions);

    // Set up event listeners
    this.setupEventListeners();
  }

  /**
   * Set up Redis client event listeners
   *
   * @private
   */
  private setupEventListeners(): void {
    this.client.on('connect', () => {
      this.isConnected = true;
      this.connectionAttempts = 0;
    });

    this.client.on('ready', () => {
      this.isConnected = true;
    });

    this.client.on('error', error => {
      // Errors are handled per-operation
      // This listener prevents unhandled error events
      console.error('Redis client error:', error.message);
    });

    this.client.on('close', () => {
      this.isConnected = false;
    });

    this.client.on('reconnecting', () => {
      this.isConnected = false;
    });
  }

  /**
   * Connect to Redis server
   *
   * Establishes connection with retry logic and validation.
   *
   * @throws {CacheConnectionError} If connection fails
   *
   * @example
   * ```typescript
   * try {
   *   await adapter.connect();
   *   console.log('Connected to Redis');
   * } catch (error) {
   *   console.error('Connection failed:', error);
   * }
   * ```
   */
  async connect(): Promise<void> {
    try {
      await this.client.connect();

      // Verify connection with PING
      const pong = await this.client.ping();
      if (pong !== 'PONG') {
        throw new Error('PING command did not return PONG');
      }

      this.isConnected = true;
      this.connectionAttempts = 0;
    } catch (error) {
      this.isConnected = false;

      throw new CacheConnectionError(
        `Failed to connect to Redis at ${this.config.host}:${this.config.port}`,
        {
          adapter: 'RedisAdapter',
          host: this.config.host,
          port: this.config.port,
          reason: 'Connection or PING failed',
          originalError: (error as Error).message,
        }
      );
    }
  }

  /**
   * Disconnect from Redis server
   *
   * Gracefully closes the connection and cleans up resources.
   *
   * @example
   * ```typescript
   * await adapter.disconnect();
   * console.log('Disconnected from Redis');
   * ```
   */
  async disconnect(): Promise<void> {
    try {
      await this.client.quit();
      this.isConnected = false;
    } catch (error) {
      // Force disconnect on error
      await this.client.disconnect();
      this.isConnected = false;

      throw new CacheConnectionError('Failed to disconnect from Redis gracefully', {
        adapter: 'RedisAdapter',
        host: this.config.host,
        port: this.config.port,
        reason: 'QUIT command failed',
        originalError: (error as Error).message,
      });
    }
  }

  /**
   * Get value by key
   *
   * @param key - Cache key
   * @returns Value if exists, null otherwise
   *
   * @throws {CacheValidationError} If key is empty
   * @throws {CacheOperationError} If Redis operation fails
   *
   * @example
   * ```typescript
   * const value = await adapter.get('user:123');
   * if (value) {
   *   const user = JSON.parse(value);
   *   console.log('Found user:', user.name);
   * } else {
   *   console.log('Cache miss');
   * }
   * ```
   */
  async get(key: string): Promise<string | null> {
    // Validate key
    if (!key || key.trim().length === 0) {
      throw new CacheValidationError('Cache key cannot be empty', {
        field: 'key',
        expectedType: 'non-empty string',
        receivedType: typeof key,
        constraint: 'key.length > 0',
        adapter: 'RedisAdapter',
      });
    }

    try {
      const value = await this.client.get(key);

      // Track statistics
      if (value !== null) {
        this.hits++;
      } else {
        this.misses++;
      }

      return value;
    } catch (error) {
      throw new CacheOperationError('Redis GET operation failed', {
        operation: 'get',
        method: 'get',
        key,
        adapter: 'RedisAdapter',
        originalError: (error as Error).message,
      });
    }
  }

  /**
   * Set value with optional TTL
   *
   * Uses SETEX for TTL in seconds, SET for permanent storage.
   *
   * @param key - Cache key
   * @param value - Value to store
   * @param ttl - Time to live in seconds (optional)
   *
   * @throws {CacheValidationError} If key is empty or TTL is invalid
   * @throws {CacheOperationError} If Redis operation fails
   *
   * @example Without TTL
   * ```typescript
   * await adapter.set('config:theme', 'dark');
   * ```
   *
   * @example With TTL
   * ```typescript
   * // Expire after 1 hour
   * await adapter.set('session:abc', '{"userId":123}', 3600);
   * ```
   */
  async set(key: string, value: string, ttl?: number): Promise<void> {
    // Validate key
    if (!key || key.trim().length === 0) {
      throw new CacheValidationError('Cache key cannot be empty', {
        field: 'key',
        expectedType: 'non-empty string',
        receivedType: typeof key,
        constraint: 'key.length > 0',
        adapter: 'RedisAdapter',
      });
    }

    // Validate TTL
    if (ttl !== undefined && (ttl < 0 || !Number.isFinite(ttl))) {
      throw new CacheValidationError('TTL must be a positive number', {
        field: 'ttl',
        expectedType: 'positive number',
        receivedType: typeof ttl,
        value: ttl,
        constraint: 'ttl >= 0 && Number.isFinite(ttl)',
        adapter: 'RedisAdapter',
      });
    }

    try {
      if (ttl !== undefined && ttl > 0) {
        // Use SETEX for TTL (seconds)
        await this.client.setex(key, ttl, value);
      } else {
        // Use SET for permanent storage
        await this.client.set(key, value);
      }
    } catch (error) {
      throw new CacheOperationError('Redis SET operation failed', {
        operation: 'set',
        method: 'set',
        key,
        ttl,
        adapter: 'RedisAdapter',
        originalError: (error as Error).message,
      });
    }
  }

  /**
   * Delete key from cache
   *
   * @param key - Cache key
   * @returns true if key existed and was deleted, false otherwise
   *
   * @throws {CacheValidationError} If key is empty
   * @throws {CacheOperationError} If Redis operation fails
   *
   * @example
   * ```typescript
   * const deleted = await adapter.delete('user:123');
   * if (deleted) {
   *   console.log('Cache entry removed');
   * } else {
   *   console.log('Key did not exist');
   * }
   * ```
   */
  async delete(key: string): Promise<boolean> {
    // Validate key
    if (!key || key.trim().length === 0) {
      throw new CacheValidationError('Cache key cannot be empty', {
        field: 'key',
        expectedType: 'non-empty string',
        receivedType: typeof key,
        constraint: 'key.length > 0',
        adapter: 'RedisAdapter',
      });
    }

    try {
      const result = await this.client.del(key);
      return result > 0;
    } catch (error) {
      throw new CacheOperationError('Redis DEL operation failed', {
        operation: 'delete',
        method: 'delete',
        key,
        adapter: 'RedisAdapter',
        originalError: (error as Error).message,
      });
    }
  }

  /**
   * Get multiple keys at once
   *
   * More efficient than calling get() multiple times.
   * Uses Redis MGET command.
   *
   * @param keys - Array of cache keys
   * @returns Array of values (null for missing/expired keys)
   *
   * @throws {CacheOperationError} If Redis operation fails
   *
   * @example
   * ```typescript
   * const values = await adapter.mget([
   *   'user:1',
   *   'user:2',
   *   'user:3'
   * ]);
   *
   * values.forEach((value, index) => {
   *   if (value) {
   *     console.log(`User ${index + 1}:`, JSON.parse(value));
   *   }
   * });
   * ```
   */
  async mget(keys: string[]): Promise<(string | null)[]> {
    if (keys.length === 0) {
      return [];
    }

    try {
      const values = await this.client.mget(...keys);

      // Track statistics
      values.forEach(value => {
        if (value !== null) {
          this.hits++;
        } else {
          this.misses++;
        }
      });

      return values;
    } catch (error) {
      throw new CacheOperationError('Redis MGET operation failed', {
        operation: 'mget',
        method: 'mget',
        adapter: 'RedisAdapter',
        value: `${keys.length} keys`,
        originalError: (error as Error).message,
      });
    }
  }

  /**
   * Set multiple keys at once
   *
   * Uses Redis pipeline for efficient batch operations.
   * Each entry can have its own TTL.
   *
   * @param entries - Array of [key, value, ttl?] tuples
   *
   * @throws {CacheOperationError} If Redis operation fails
   *
   * @example
   * ```typescript
   * await adapter.mset([
   *   ['user:1', '{"name":"Alice"}', 3600],
   *   ['user:2', '{"name":"Bob"}'],  // No TTL
   *   ['user:3', '{"name":"Carol"}', 7200]
   * ]);
   * ```
   */
  async mset(entries: [string, string, number?][]): Promise<void> {
    if (entries.length === 0) {
      return;
    }

    try {
      // Use pipeline for efficient batch operations
      const pipeline = this.client.pipeline();

      for (const [key, value, ttl] of entries) {
        if (ttl !== undefined && ttl > 0) {
          pipeline.setex(key, ttl, value);
        } else {
          pipeline.set(key, value);
        }
      }

      await pipeline.exec();
    } catch (error) {
      throw new CacheOperationError('Redis MSET (pipeline) operation failed', {
        operation: 'mset',
        method: 'mset',
        adapter: 'RedisAdapter',
        value: `${entries.length} entries`,
        originalError: (error as Error).message,
      });
    }
  }

  /**
   * Get adapter statistics
   *
   * Retrieves statistics from Redis INFO command and combines
   * with local hit/miss tracking.
   *
   * @returns Cache statistics
   *
   * @throws {CacheOperationError} If Redis INFO command fails
   *
   * @example
   * ```typescript
   * const stats = await adapter.getStats();
   *
   * console.log('Performance:', {
   *   hitRate: stats.hits / (stats.hits + stats.misses),
   *   memoryMB: stats.memoryUsage / 1024 / 1024,
   *   entries: stats.entryCount,
   *   uptime: stats.uptime
   * });
   * ```
   */
  async getStats(): Promise<CacheStats> {
    try {
      // Get Redis INFO for memory and key count
      const info = await this.client.info('stats');
      const memoryInfo = await this.client.info('memory');
      const dbInfo = await this.client.info('keyspace');

      // Parse memory usage
      const memoryMatch = memoryInfo.match(/used_memory:(\d+)/);
      const memoryUsage = memoryMatch?.[1] ? parseInt(memoryMatch[1], 10) : 0;

      // Parse key count from dbinfo (e.g., "db0:keys=100,expires=50")
      const dbMatch = dbInfo.match(/db\d+:keys=(\d+)/);
      const entryCount = dbMatch?.[1] ? parseInt(dbMatch[1], 10) : 0;

      // Evictions from stats
      const evictionsMatch = info.match(/evicted_keys:(\d+)/);
      const evictions = evictionsMatch?.[1] ? parseInt(evictionsMatch[1], 10) : 0;

      // Uptime
      const uptime = Date.now() - this.startTime;

      return {
        hits: this.hits,
        misses: this.misses,
        evictions,
        memoryUsage,
        entryCount,
        uptime,
      };
    } catch (error) {
      throw new CacheOperationError('Redis INFO command failed', {
        operation: 'getStats',
        adapter: 'RedisAdapter',
        originalError: (error as Error).message,
      });
    }
  }

  /**
   * Health check
   *
   * Checks Redis connection health using PING command.
   *
   * @returns Health status with details
   *
   * @example
   * ```typescript
   * const health = await adapter.healthCheck();
   *
   * if (health.healthy) {
   *   console.log('Redis is healthy');
   * } else {
   *   console.error('Redis health check failed:', health.message);
   * }
   * ```
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    message?: string;
    details?: Record<string, unknown>;
  }> {
    try {
      const start = performance.now();
      const pong = await this.client.ping();
      const latency = performance.now() - start;

      if (pong !== 'PONG') {
        return {
          healthy: false,
          message: 'PING did not return PONG',
          details: {
            response: pong,
            connected: this.isConnected,
          },
        };
      }

      return {
        healthy: true,
        message: 'Redis responding',
        details: {
          latency,
          connected: this.isConnected,
          host: this.config.host,
          port: this.config.port,
          db: this.config.db ?? 0,
        },
      };
    } catch (error) {
      return {
        healthy: false,
        message: (error as Error).message,
        details: {
          connected: this.isConnected,
          connectionAttempts: this.connectionAttempts,
        },
      };
    }
  }

  /**
   * Create Redis pub/sub instance for cross-server event propagation
   *
   * Creates a new pub/sub instance with the same connection configuration
   * as this adapter. Each instance maintains separate connections for
   * publishing and subscribing.
   *
   * **Important:** The returned instance is NOT connected automatically.
   * You must call `connect()` on it before using.
   *
   * @param serverId - Unique server identifier for filtering own events
   * @returns New RedisPubSub instance
   *
   * @example Basic usage
   * ```typescript
   * const adapter = new RedisAdapter({
   *   host: 'localhost',
   *   port: 6379
   * });
   *
   * const pubsub = adapter.createPubSub('server-a');
   * await pubsub.connect();
   *
   * pubsub.subscribe('cache:*', (event) => {
   *   console.log('Cache event:', event);
   * });
   *
   * // Cleanup
   * await pubsub.disconnect();
   * ```
   *
   * @example Multi-server coordination
   * ```typescript
   * // Server A
   * const adapterA = new RedisAdapter(config);
   * const pubsubA = adapterA.createPubSub('server-a');
   * await pubsubA.connect();
   *
   * // Server B
   * const adapterB = new RedisAdapter(config);
   * const pubsubB = adapterB.createPubSub('server-b');
   * await pubsubB.connect();
   *
   * // Both subscribe to cache events
   * pubsubA.subscribe('cache:*', (event) => {
   *   if (event.serverId !== 'server-a') {
   *     console.log('Event from another server:', event);
   *   }
   * });
   *
   * pubsubB.subscribe('cache:*', (event) => {
   *   if (event.serverId !== 'server-b') {
   *     console.log('Event from another server:', event);
   *   }
   * });
   * ```
   */
  createPubSub(serverId: string): RedisPubSub {
    // Create RedisOptions matching this adapter's config
    const redisOptions: RedisOptions = {
      host: this.config.host,
      port: this.config.port,
      password: this.config.password,
      db: this.config.db ?? 0,
      retryStrategy: this.config.retryStrategy,
      connectTimeout: this.config.connectTimeout ?? 10000,
      commandTimeout: this.config.commandTimeout ?? 5000,
      maxRetriesPerRequest: this.config.maxRetriesPerRequest ?? 10,
      enableOfflineQueue: this.config.enableOfflineQueue ?? true,
    };

    return new RedisPubSubImpl(redisOptions, serverId);
  }
}
