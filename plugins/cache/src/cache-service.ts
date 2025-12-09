/**
 * Cache service with automatic event emission
 *
 * @packageDocumentation
 */

import { EventEmitter } from 'node:events';

import type { CacheAdapter, CacheChangeEvent, CacheStats, CacheWatchHandler } from './types';

/**
 * Cache service with automatic event emission
 *
 * Extends EventEmitter to provide:
 * - Automatic event emission on all mutations (set, delete, mset)
 * - Pattern-based watching (exact string or regex)
 * - Multi-server coordination support
 * - SSE integration
 *
 * @example
 * ```typescript
 * const adapter = new MemoryAdapter();
 * const service = new CacheService(adapter);
 *
 * // Watch for changes
 * const unsubscribe = service.watch('user:*', (event) => {
 *   console.log('Cache changed:', event.key, event.type);
 * });
 *
 * // Automatic event emission
 * await service.set('user:123', 'data'); // Emits 'cache:change' event
 *
 * // Cleanup
 * unsubscribe();
 * ```
 */
export class CacheService extends EventEmitter {
  private adapter: CacheAdapter;
  private serverId?: string;

  /**
   * Create a new CacheService
   *
   * @param adapter - Cache adapter implementation
   * @param serverId - Optional server ID for multi-server coordination
   */
  constructor(adapter: CacheAdapter, serverId?: string) {
    super();
    this.adapter = adapter;
    this.serverId = serverId;

    // Increase listener limit for SSE subscriptions
    this.setMaxListeners(1000);
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
    return this.adapter.get(key);
  }

  /**
   * Set value with optional TTL
   *
   * Automatically emits 'cache:change' event after successful write.
   *
   * @param key - Cache key
   * @param value - Value to store
   * @param ttl - Time to live in seconds (optional)
   */
  async set(key: string, value: string, ttl?: number): Promise<void> {
    await this.adapter.set(key, value, ttl);

    // Emit event after successful write
    this.emitChange({
      type: 'set',
      key,
      value,
      timestamp: Date.now(),
      serverId: this.serverId,
    });
  }

  /**
   * Delete key from cache
   *
   * Automatically emits 'cache:change' event if key existed.
   *
   * @param key - Cache key
   * @returns true if key existed and was deleted, false otherwise
   */
  async delete(key: string): Promise<boolean> {
    const existed = await this.adapter.delete(key);

    // Only emit event if key actually existed
    if (existed) {
      this.emitChange({
        type: 'delete',
        key,
        timestamp: Date.now(),
        serverId: this.serverId,
      });
    }

    return existed;
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
   *
   * @param entries - Array of [key, value, ttl?] tuples
   */
  async mset(entries: [string, string, number?][]): Promise<void> {
    await this.adapter.mset(entries);

    // Emit event for each entry
    const timestamp = Date.now();
    for (const [key, value] of entries) {
      this.emitChange({
        type: 'set',
        key,
        value,
        timestamp,
        serverId: this.serverId,
      });
    }
  }

  /**
   * Watch for cache changes matching pattern
   *
   * Supports both exact string matching and regex patterns.
   * Returns cleanup function for unsubscribing.
   *
   * @param pattern - Exact key string or regex pattern
   * @param handler - Function to call when matching change occurs
   * @returns Cleanup function to remove listener
   *
   * @example
   * ```typescript
   * // Exact string match
   * const unsub1 = service.watch('user:123', (event) => {
   *   console.log('User 123 changed');
   * });
   *
   * // Regex pattern
   * const unsub2 = service.watch(/^user:/, (event) => {
   *   console.log('Any user changed:', event.key);
   * });
   *
   * // Cleanup
   * unsub1();
   * unsub2();
   * ```
   */
  watch(pattern: string | RegExp, handler: CacheWatchHandler): () => void {
    const eventHandler = (event: CacheChangeEvent) => {
      try {
        // Pattern matching
        const matches =
          typeof pattern === 'string' ? event.key === pattern : pattern.test(event.key);

        if (matches) {
          // Call handler (may be sync or async)
          const result = handler(event);

          // Handle async errors
          if (result instanceof Promise) {
            result.catch(error => {
              // Emit error event instead of crashing
              this.emit('error', error);
            });
          }
        }
      } catch (error) {
        // Emit error event instead of crashing
        this.emit('error', error);
      }
    };

    this.on('cache:change', eventHandler);

    // Return cleanup function
    return () => {
      this.off('cache:change', eventHandler);
    };
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
   * Also removes all event listeners.
   */
  async disconnect(): Promise<void> {
    if (this.adapter.disconnect) {
      await this.adapter.disconnect();
    }

    // Remove all listeners
    this.removeAllListeners();
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  /**
   * Emit cache change event
   *
   * Error handling prevents listener crashes from breaking service.
   *
   * @param event - Cache change event
   */
  private emitChange(event: CacheChangeEvent): void {
    try {
      this.emit('cache:change', event);
    } catch (error) {
      // Emit error event instead of crashing service
      this.emit('error', error);
    }
  }
}
