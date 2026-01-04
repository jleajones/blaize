/**
 * Cache service with automatic event emission via EventBus
 *
 * @packageDocumentation
 */

import { EventEmitter } from 'node:events';

import type { CacheInvalidationEvent } from './schema';
import type {
  CacheAdapter,
  CacheStats,
  CacheChangeEvent,
  CacheWatchHandler,
  CacheServiceOptions,
} from './types';
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
export class CacheService extends EventEmitter {
  private adapter: CacheAdapter;
  private eventBus?: EventBus;
  private serverId?: string;
  private logger: BlaizeLogger;
  private sequence: number = 0;
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
    super();
    this.adapter = options.adapter;
    this.eventBus = options.eventBus;
    this.serverId = options.serverId;
    this.logger = options.logger.child({
      service: 'CacheService',
      serverId: options.serverId,
    });

    // Increase listener limit for SSE subscriptions
    this.setMaxListeners(1000);
  }

  /**
   * Initialize the cache service
   *
   * Sets up EventBus subscriptions if configured.
   * Must be called after construction before using the service.
   *
   * @throws {Error} If EventBus setup fails
   *
   * @example
   * ```typescript
   * const service = new CacheService({ adapter, eventBus, serverId, logger });
   * await service.init();  // ← Call this before using
   * await service.set('key', 'value');
   * ```
   */
  async init(): Promise<void> {
    this.logger.debug('Initializing cache service', {
      hasEventBus: !!this.eventBus,
      serverId: this.serverId,
    });

    // Setup EventBus subscriptions if available
    if (this.eventBus) {
      await this.setupEventBus();
    }

    this.logger.info('Cache service initialized', {
      multiServer: !!this.eventBus,
    });
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
   * In multi-server mode, event propagates to all connected servers via EventBus.
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
      timestamp: new Date().toISOString(),
      serverId: this.serverId,
      sequence: ++this.sequence,
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
    const existed = await this.adapter.delete(key);

    // Only emit event if key actually existed
    if (existed) {
      this.emitChange({
        type: 'delete',
        key,
        timestamp: new Date().toISOString(),
        serverId: this.serverId,
        sequence: ++this.sequence,
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
   * In multi-server mode, events propagate to all connected servers via EventBus.
   *
   * @param entries - Array of [key, value, ttl?] tuples
   */
  async mset(entries: [string, string, number?][]): Promise<void> {
    await this.adapter.mset(entries);

    // Emit event for each entry
    const timestamp = new Date().toISOString();
    for (const [key, value] of entries) {
      this.emitChange({
        type: 'set',
        key,
        value,
        timestamp,
        serverId: this.serverId,
        sequence: ++this.sequence,
      });
    }
  }

  /**
   * Watch for cache changes matching pattern
   *
   * Supports both exact string matching and regex patterns.
   * Returns cleanup function for unsubscribing.
   *
   * Handler errors are logged but do not crash the service.
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
              this.logger.error('Async watch handler error', {
                error: {
                  message: error.message,
                  stack: error.stack,
                  name: error.name,
                },
                pattern: pattern.toString(),
                event,
              });
            });
          }
        }
      } catch (error) {
        this.logger.error('Watch handler error', {
          error: {
            message: (error as Error).message,
            stack: (error as Error).stack,
            name: (error as Error).name,
          },
          pattern: pattern.toString(),
          event,
        });
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

    // Remove all listeners
    this.removeAllListeners();

    this.logger.info('Cache service disconnected');
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  /**
   * Set up EventBus subscription
   *
   * Subscribes to cache invalidation events from other servers and applies them locally.
   * Filters out own events by serverId to prevent echoes.
   *
   * @throws {Error} If EventBus subscription fails
   * @private
   */
  private async setupEventBus(): Promise<void> {
    if (!this.eventBus) return;

    this.logger.debug('Setting up EventBus subscription', {
      event: 'cache:invalidated',
    });

    // Subscribe to cache invalidation events
    this.eventBusUnsubscribe = this.eventBus.subscribe('cache:invalidated', event => {
      const data = event.data as CacheInvalidationEvent;
      // Filter out own events to prevent echoes
      if (data.serverId === this.serverId) {
        return;
      }

      this.logger.debug('Received cache invalidation event from other server', {
        serverId: data.serverId,
        operation: data.operation,
        key: data.key,
      });

      // Convert EventBus event to CacheChangeEvent format for local watchers
      const cacheEvent: CacheChangeEvent = {
        type: data.operation,
        key: data.key,
        value: data.value,
        timestamp: new Date(data.timestamp).toISOString(),
        serverId: data.serverId,
        sequence: data.sequence,
      };

      // Emit event locally for watchers
      // This allows other servers' changes to trigger local watches
      try {
        this.emit('cache:change', cacheEvent);
      } catch (error) {
        this.logger.error('Error emitting EventBus event locally', {
          error: {
            message: (error as Error).message,
            stack: (error as Error).stack,
            name: (error as Error).name,
          },
          event: cacheEvent,
        });
      }
    });

    this.logger.info('EventBus subscription established');
  }

  /**
   * Emit cache change event
   *
   * Emits event locally and publishes to other servers via EventBus.
   * Errors are logged but do not throw (non-critical operation).
   *
   * @param event - Cache change event
   * @private
   */
  private emitChange(event: CacheChangeEvent): void {
    // Emit locally first
    try {
      this.emit('cache:change', event);
    } catch (error) {
      this.logger.error('Error emitting change event locally', {
        error: {
          message: (error as Error).message,
          stack: (error as Error).stack,
          name: (error as Error).name,
        },
        event,
      });
    }

    // Publish to other servers via EventBus
    if (this.eventBus && this.serverId) {
      this.eventBus
        .publish('cache:invalidated', {
          operation: event.type,
          key: event.key,
          value: event.value,
          timestamp: Date.now(),
          serverId: this.serverId,
          sequence: event.sequence,
        })
        .catch(error => {
          this.logger.error('Error publishing event to EventBus', {
            error: {
              message: (error as Error).message,
              stack: (error as Error).stack,
              name: (error as Error).name,
            },
            event,
          });
        });
    }
  }
}
