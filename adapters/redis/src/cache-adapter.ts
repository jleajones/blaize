/**
 * Redis Cache Adapter Implementation
 *
 * Provides cache operations using Redis with:
 * - Key prefixing for namespace isolation
 * - Statistics tracking (hits, misses, evictions)
 * - Pipelining for bulk operations
 * - TTL support with SETEX
 *
 * @module @blaizejs/adapter-redis/cache-adapter
 * @since 0.1.0
 */

import { createLogger } from 'blaizejs';

import type { CacheAdapter } from '@blaizejs/plugin-cache';

import { RedisOperationError } from './errors';

import type { RedisClient, RedisCacheAdapterOptions, CacheStats } from './types';
import type { BlaizeLogger } from 'blaizejs';

/**
 * Default options for RedisCacheAdapter
 */
const DEFAULT_OPTIONS = {
  keyPrefix: 'cache:',
};

/**
 * RedisCacheAdapter - Cache adapter using Redis
 *
 * Implements cache operations with Redis backend, providing:
 * - Fast key-value storage
 * - TTL support for automatic expiration
 * - Bulk operations with pipelining
 * - Statistics tracking
 */
export class RedisCacheAdapter implements CacheAdapter {
  private readonly client: RedisClient;
  private readonly keyPrefix: string;
  private readonly logger: BlaizeLogger;

  private isConnected = false;
  private startTime: number = 0;

  // Statistics tracking
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0, // Redis handles evictions, we track DEL operations
  };

  constructor(client: RedisClient, options?: RedisCacheAdapterOptions) {
    this.client = client;
    this.keyPrefix = options?.keyPrefix ?? DEFAULT_OPTIONS.keyPrefix;

    // Setup logger
    if (options?.logger) {
      this.logger = options.logger.child({ component: 'RedisCacheAdapter' });
    } else {
      this.logger = createLogger().child({ component: 'RedisCacheAdapter' });
    }

    this.logger.info('RedisCacheAdapter created', {
      keyPrefix: this.keyPrefix,
    });
  }

  /**
   * Connect to Redis
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      this.logger.debug('Already connected, skipping connect()');
      return;
    }

    this.logger.info('Connecting RedisCacheAdapter');

    // Ensure client is connected
    if (!this.client.isConnected()) {
      await this.client.connect();
    }

    this.isConnected = true;
    this.startTime = Date.now();

    this.logger.info('RedisCacheAdapter connected');
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (!this.isConnected) {
      this.logger.debug('Not connected, skipping disconnect()');
      return;
    }

    this.logger.info('Disconnecting RedisCacheAdapter');

    this.isConnected = false;

    this.logger.info('RedisCacheAdapter disconnected');
  }

  /**
   * Get value by key
   *
   * @param key - Cache key
   * @returns Value if exists, null otherwise
   */
  async get(key: string): Promise<string | null> {
    if (!this.isConnected) {
      throw new Error('Adapter not connected. Call connect() first.');
    }

    const fullKey = this.buildKey(key);

    try {
      const value = await this.client.getConnection().get(fullKey);

      if (value === null) {
        this.stats.misses++;
        this.logger.debug('Cache miss', { key });
        return null;
      }

      this.stats.hits++;
      this.logger.debug('Cache hit', { key });
      return value;
    } catch (error) {
      this.logger.error('GET failed', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new RedisOperationError('GET failed', {
        operation: 'GET',
        key: fullKey,
        originalError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Set value with optional TTL
   *
   * @param key - Cache key
   * @param value - Value to store
   * @param ttl - Time to live in seconds (optional)
   */
  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Adapter not connected. Call connect() first.');
    }

    const fullKey = this.buildKey(key);

    try {
      const connection = this.client.getConnection();

      if (ttl !== undefined && ttl > 0) {
        // Use SETEX for key with TTL
        await connection.setex(fullKey, ttl, value);
        this.logger.debug('Cache set with TTL', { key, ttl });
      } else {
        // Use SET for key without TTL
        await connection.set(fullKey, value);
        this.logger.debug('Cache set', { key });
      }
    } catch (error) {
      this.logger.error('SET failed', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new RedisOperationError('SET failed', {
        operation: ttl !== undefined ? 'SETEX' : 'SET',
        key: fullKey,
        originalError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Delete key from cache
   *
   * @param key - Cache key
   * @returns true if key existed and was deleted, false otherwise
   */
  async delete(key: string): Promise<boolean> {
    if (!this.isConnected) {
      throw new Error('Adapter not connected. Call connect() first.');
    }

    const fullKey = this.buildKey(key);

    try {
      const result = await this.client.getConnection().del(fullKey);

      const deleted = result > 0;

      if (deleted) {
        this.stats.evictions++;
        this.logger.debug('Cache delete', { key });
      }

      return deleted;
    } catch (error) {
      this.logger.error('DEL failed', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new RedisOperationError('DEL failed', {
        operation: 'DEL',
        key: fullKey,
        originalError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get multiple keys using pipelining
   *
   * @param keys - Array of cache keys
   * @returns Array of values (null for missing keys)
   */
  async mget(keys: string[]): Promise<(string | null)[]> {
    if (!this.isConnected) {
      throw new Error('Adapter not connected. Call connect() first.');
    }

    // Handle empty array
    if (keys.length === 0) {
      return [];
    }

    const fullKeys = keys.map(key => this.buildKey(key));

    try {
      const values = await this.client.getConnection().mget(...fullKeys);

      // Track hits and misses
      for (const value of values) {
        if (value === null) {
          this.stats.misses++;
        } else {
          this.stats.hits++;
        }
      }

      this.logger.debug('Cache mget', {
        count: keys.length,
        hits: values.filter(v => v !== null).length,
      });

      return values;
    } catch (error) {
      this.logger.error('MGET failed', {
        count: keys.length,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new RedisOperationError('MGET failed', {
        operation: 'MGET',
        key: fullKeys.join(', '),
        originalError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Set multiple keys using pipelining
   *
   * @param entries - Array of [key, value, ttl?] tuples
   */
  async mset(entries: [string, string, number?][]): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Adapter not connected. Call connect() first.');
    }

    // Handle empty array
    if (entries.length === 0) {
      return;
    }

    try {
      const connection = this.client.getConnection();
      const pipeline = connection.pipeline();

      // Add all SET/SETEX operations to pipeline
      for (const [key, value, ttl] of entries) {
        const fullKey = this.buildKey(key);

        if (ttl !== undefined && ttl > 0) {
          pipeline.setex(fullKey, ttl, value);
        } else {
          pipeline.set(fullKey, value);
        }
      }

      // Execute pipeline
      await pipeline.exec();

      this.logger.debug('Cache mset', { count: entries.length });
    } catch (error) {
      this.logger.error('MSET failed', {
        count: entries.length,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new RedisOperationError('MSET failed', {
        operation: 'MSET',
        key: `${entries.length} entries`,
        originalError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * List keys matching a pattern
   */
  async keys(pattern: string = '*'): Promise<string[]> {
    if (!this.isConnected) {
      throw new Error('Adapter not connected. Call connect() first.');
    }

    const connection = this.client.getConnection();

    const clientPrefix = this.client.getConfig().keyPrefix || '';
    const fullSearchPattern = clientPrefix + this.keyPrefix + pattern;
    try {
      const fullKeys = await connection.keys(fullSearchPattern);

      // Remove prefix from keys
      return fullKeys.map(fullKey =>
        fullKey.startsWith(this.keyPrefix) ? fullKey.slice(this.keyPrefix.length) : fullKey
      );
    } catch (error) {
      this.logger.error('KEYS failed', {
        pattern,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new RedisOperationError('KEYS failed', {
        operation: 'KEYS',
        key: fullSearchPattern,
        originalError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Clear keys matching a pattern
   */
  async clear(pattern: string = '*'): Promise<number> {
    if (!this.isConnected) {
      throw new Error('Adapter not connected. Call connect() first.');
    }

    const connection = this.client.getConnection();

    const clientPrefix = this.client.getConfig().keyPrefix || '';
    const fullSearchPattern = clientPrefix + this.keyPrefix + pattern;

    try {
      const fullKeys = await connection.keys(fullSearchPattern);

      if (fullKeys.length === 0) {
        return 0;
      }

      // Delete all matching keys
      const deletedCount = await connection.del(...fullKeys);

      // Track evictions
      this.stats.evictions += deletedCount;

      this.logger.debug('Cache clear', { pattern, deletedCount });

      return deletedCount;
    } catch (error) {
      this.logger.error('CLEAR failed', {
        pattern,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new RedisOperationError('CLEAR failed', {
        operation: 'DEL',
        key: fullSearchPattern,
        originalError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get TTL for a key (in seconds, null if no TTL)
   */
  async getTTL(key: string): Promise<number | null> {
    if (!this.isConnected) {
      throw new Error('Adapter not connected. Call connect() first.');
    }

    const fullKey = this.buildKey(key); // ✅ Fixed: use buildKey

    try {
      const connection = this.client.getConnection();
      const ttl = await connection.ttl(fullKey);

      // Redis returns -2 if key doesn't exist, -1 if no expiry
      if (ttl === -2) return null; // Key doesn't exist
      if (ttl === -1) return null; // No expiry

      this.logger.debug('Got TTL', { key, ttl });

      return ttl;
    } catch (error) {
      this.logger.error('TTL failed', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new RedisOperationError('TTL failed', {
        operation: 'TTL',
        key: fullKey,
        originalError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get adapter statistics
   *
   * Note: Redis doesn't expose memory usage per prefix, so we use DBSIZE
   * and INFO for approximate values.
   *
   * @returns Cache statistics
   */
  async getStats(): Promise<CacheStats> {
    if (!this.isConnected) {
      return {
        hits: this.stats.hits,
        misses: this.stats.misses,
        evictions: this.stats.evictions,
        memoryUsage: 0,
        entryCount: 0,
        uptime: 0,
      };
    }

    try {
      const connection = this.client.getConnection();

      const clientPrefix = this.client.getConfig().keyPrefix || '';
      const fullPattern = clientPrefix + this.keyPrefix + '*';

      // Get approximate entry count using SCAN with prefix
      let entryCount = 0;
      let cursor = '0';

      do {
        const [nextCursor, keys] = await connection.scan(
          cursor,
          'MATCH',
          fullPattern,
          'COUNT',
          100
        );
        cursor = nextCursor;
        entryCount += keys.length;
      } while (cursor !== '0');

      // Get memory info from Redis INFO
      const info = await connection.info('memory');
      const memoryMatch = info.match(/used_memory:(\d+)/);
      const memoryUsage = memoryMatch && memoryMatch[1] ? parseInt(memoryMatch[1], 10) : 0;

      const uptime = this.startTime > 0 ? Date.now() - this.startTime : undefined;

      return {
        hits: this.stats.hits,
        misses: this.stats.misses,
        evictions: this.stats.evictions,
        memoryUsage,
        entryCount,
        uptime,
      };
    } catch (error) {
      this.logger.error('Failed to get stats', {
        error: error instanceof Error ? error.message : String(error),
      });

      // Return basic stats on error
      return {
        hits: this.stats.hits,
        misses: this.stats.misses,
        evictions: this.stats.evictions,
        memoryUsage: 0,
        entryCount: 0,
        uptime: this.startTime > 0 ? Date.now() - this.startTime : undefined,
      };
    }
  }

  /**
   * Perform health check
   *
   * @returns Health status with optional details
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    message?: string;
    details?: Record<string, unknown>;
  }> {
    if (!this.isConnected) {
      return {
        healthy: false,
        message: 'Adapter not connected',
      };
    }

    // Delegate to client health check
    const clientHealth = await this.client.healthCheck();

    if (!clientHealth.healthy) {
      return {
        healthy: false,
        message: clientHealth.message,
        details: {
          latency: clientHealth.latency,
        },
      };
    }

    // Get stats for additional health details
    const stats = await this.getStats();

    return {
      healthy: true,
      message: 'Connected',
      details: {
        latency: clientHealth.latency,
        hits: stats.hits,
        misses: stats.misses,
        entryCount: stats.entryCount,
      },
    };
  }

  /**
   * Build full key with prefix
   *
   * @private
   */
  private buildKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }
}
