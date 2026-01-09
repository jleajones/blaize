/**
 * Cache service with automatic event emission via EventBus
 *
 * @packageDocumentation
 */

import type { CacheAdapter, CacheStats, CacheServiceOptions } from './types';
import type { BlaizeLogger, EventBus } from 'blaizejs';

/**
 * Cache service with automatic event emission
 *
 * Extends EventEmitter to provide:
 * - Automatic event emission on all mutations (set, delete, mset)
 * - Pattern-based watching (exact string or regex)
 * - Multi-server coordination via EventBus
 * - SSE integration
 *
 * **Multi-Server Coordination:**
 * When eventBus is provided, cache changes are propagated to all servers.
 * Each server filters its own events by serverId to prevent echoes.
 *
 * **IMPORTANT:** Call `init()` after construction to set up event subscriptions.
 *
 * @example Local mode (single server)
 * ```typescript
 * const adapter = new MemoryAdapter();
 * const service = new CacheService({ adapter, logger });
 * await service.init();
 *
 * // Watch for changes
 * service.watch('user:*', (event) => {
 *   console.log('Cache changed:', event.key);
 * });
 * ```
 *
 * @example Multi-server mode with EventBus
 * ```typescript
 * const service = new CacheService({
 *   adapter,
 *   eventBus: server.eventBus,
 *   serverId: 'server-a',
 *   logger
 * });
 * await service.init();
 *
 * // Changes propagate to all servers via EventBus
 * await service.set('user:123', 'data');
 * ```
 */
export class CacheService {
  private adapter: CacheAdapter;
  private eventBus?: EventBus;
  private serverId?: string;
  private logger: BlaizeLogger;
  private eventBusUnsubscribe?: () => void;

  /**
   * Create a new CacheService
   *
   * **IMPORTANT:** Call `init()` after construction.
   *
   * @param options - Service configuration options
   *
   * @example Local mode
   * ```typescript
   * const service = new CacheService({
   *   adapter: new MemoryAdapter(),
   *   logger
   * });
   * await service.init();
   * ```
   *
   * @example Multi-server mode with EventBus
   * ```typescript
   * const service = new CacheService({
   *   adapter,
   *   eventBus: server.eventBus,
   *   serverId: 'server-a',
   *   logger
   * });
   * await service.init();
   * ```
   */
  constructor(options: CacheServiceOptions) {
    this.adapter = options.adapter;
    this.eventBus = options.eventBus;
    this.serverId = options.serverId;
    this.logger = options.logger.child({
      service: 'CacheService',
      serverId: options.serverId,
    });
  }

  /**
   * Publish cache event to EventBus
   *
   * @param type - Event type to publish
   * @param data - Event data payload
   * @private
   */
  private async publishEvent(type: string, data: unknown): Promise<void> {
    if (!this.eventBus) {
      return; // EventBus not configured, skip silently
    }

    try {
      await this.eventBus.publish(type, data);

      this.logger.debug('Cache event published', {
        eventType: type,
        serverId: this.serverId,
      });
    } catch (error) {
      this.logger.error('Failed to publish cache event', {
        eventType: type,
        serverId: this.serverId,
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't rethrow - cache operation succeeded even if event publish failed
    }
  }

  /**
   * Get value by key
   *
   * Does not emit events (read-only operation).
   *
   * @param key - Cache key
   * @returns Value if exists, null otherwise
   */
  async get(key: string): Promise<string | null> {
    const value = await this.adapter.get(key);
    // ✅ Publish hit or miss
    if (value !== null) {
      await this.publishEvent('cache:hit', { key });
    } else {
      await this.publishEvent('cache:miss', { key });
    }
    return value;
  }

  /**
   * Set value with optional TTL
   *
   * Automatically emits 'cache:change' event after successful write.
   * In multi-server mode, event propagates to all connected servers via EventBus.
   *
   * @param key - Cache key
   * @param value - Value to store
   * @param ttl - Time to live in seconds (optional)
   */
  async set(key: string, value: string, ttl?: number): Promise<void> {
    await this.adapter.set(key, value, ttl);

    await this.publishEvent('cache:set', {
      key,
      ttl,
      timestamp: Date.now(),
      size: value.length,
    });
  }

  /**
   * Delete key from cache
   *
   * Automatically emits 'cache:change' event if key existed.
   * In multi-server mode, event propagates to all connected servers via EventBus.
   *
   * @param key - Cache key
   * @returns true if key existed and was deleted, false otherwise
   */
  async delete(key: string): Promise<boolean> {
    const deleted = await this.adapter.delete(key);

    // Only emit event if key actually existed
    if (deleted) {
      await this.publishEvent('cache:delete', {
        key,
        timestamp: Date.now(),
      });
    }

    return deleted;
  }

  /**
   * Get multiple keys
   *
   * Does not emit events (read-only operation).
   *
   * @param keys - Array of cache keys
   * @returns Array of values (null for missing keys)
   */
  async mget(keys: string[]): Promise<(string | null)[]> {
    return this.adapter.mget(keys);
  }

  /**
   * Set multiple keys
   *
   * Automatically emits 'cache:change' event for each key.
   * In multi-server mode, events propagate to all connected servers via EventBus.
   *
   * @param entries - Array of [key, value, ttl?] tuples
   */
  async mset(entries: [string, string, number?][]): Promise<void> {
    await this.adapter.mset(entries);

    for (const [key, value, ttl] of entries) {
      await this.publishEvent('cache:set', {
        key,
        ttl,
        timestamp: Date.now(),
        size: value.length,
      });
    }
  }

  /**
   * List keys matching a pattern
   *
   * Does not emit events (read-only operation).
   *
   * @param pattern - Glob pattern (default: '*' for all keys)
   * @returns Array of matching cache keys
   */
  async keys(pattern?: string): Promise<string[]> {
    return this.adapter.keys(pattern);
  }

  /**
   * Clear keys matching a pattern
   *
   * Automatically emits 'cache:change' event for each deleted key.
   * In multi-server mode, events propagate to all connected servers via EventBus.
   *
   * @param pattern - Glob pattern (default: '*' for all keys)
   * @returns Number of keys deleted
   */
  async clear(pattern?: string): Promise<number> {
    // Get keys before deletion so we can emit events
    const keysToDelete = await this.adapter.keys(pattern);
    const deletedCount = await this.adapter.clear(pattern);

    for (const key of keysToDelete) {
      await this.publishEvent('cache:delete', {
        key,
        timestamp: Date.now(),
      });
    }

    return deletedCount;
  }

  /**
   * Get value with TTL information
   *
   * @param key - Cache key
   * @returns Object with value and TTL
   */
  async getWithTTL(key: string): Promise<{ value: string | null; ttl: number | null }> {
    const value = await this.adapter.get(key);

    if (!value) {
      return { value: null, ttl: null };
    }

    // Get TTL if adapter supports it
    const ttl = this.adapter.getTTL ? await this.adapter.getTTL(key) : null;

    return { value, ttl };
  }

  /**
   * Get adapter statistics
   *
   * @returns Cache statistics
   */
  async getStats(): Promise<CacheStats> {
    return this.adapter.getStats();
  }

  /**
   * Get adapter health status
   *
   * @returns Health check result
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    message?: string;
    details?: Record<string, unknown>;
  }> {
    if (this.adapter.healthCheck) {
      return this.adapter.healthCheck();
    }

    // Default: assume healthy if no healthCheck method
    return {
      healthy: true,
      message: 'Adapter does not implement healthCheck',
    };
  }

  /**
   * Connect to adapter
   *
   * Calls adapter's connect method if available.
   */
  async connect(): Promise<void> {
    if (this.adapter.connect) {
      await this.adapter.connect();
    }
  }

  /**
   * Disconnect from adapter
   *
   * Calls adapter's disconnect method if available.
   * Also removes all event listeners and cleans up EventBus subscriptions.
   *
   * Errors during disconnect are logged but do not throw.
   */
  async disconnect(): Promise<void> {
    this.logger.debug('Disconnecting cache service');

    // Cleanup EventBus subscription
    if (this.eventBusUnsubscribe) {
      this.eventBusUnsubscribe();
      this.eventBusUnsubscribe = undefined;
    }

    // Disconnect adapter
    if (this.adapter.disconnect) {
      try {
        await this.adapter.disconnect();
      } catch (error) {
        this.logger.error('Error disconnecting adapter', {
          error: {
            message: (error as Error).message,
            stack: (error as Error).stack,
            name: (error as Error).name,
          },
        });
      }
    }

    this.logger.info('Cache service disconnected');
  }
}
