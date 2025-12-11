/**
 * Redis Pub/Sub Implementation
 *
 * Handles cross-server event propagation using Redis pub/sub.
 * Each RedisPubSub instance creates a SEPARATE Redis connection.
 *
 * @packageDocumentation
 */

import Redis, { type RedisOptions } from 'ioredis';

import { CacheConnectionError, CacheOperationError } from '../../errors';

import type { CacheChangeEvent, RedisPubSub } from '../../types';

/**
 * Redis pub/sub implementation
 *
 * **Important:** Each instance creates a SEPARATE Redis connection
 * dedicated to pub/sub. This is required by Redis/ioredis architecture.
 *
 * **Pattern Subscriptions:**
 * - Uses Redis PSUBSCRIBE for pattern matching
 * - Pattern "cache:*" matches all cache channels
 * - Multiple patterns can be subscribed independently
 *
 * **Reconnection:**
 * - Automatically resubscribes on reconnection
 * - Maintains subscription handlers across disconnects
 *
 * @example Basic usage
 * ```typescript
 * const pubsub = new RedisPubSubImpl({
 *   host: 'localhost',
 *   port: 6379
 * }, 'server-a');
 *
 * await pubsub.connect();
 *
 * const unsub = pubsub.subscribe('cache:*', (event) => {
 *   console.log('Event:', event);
 * });
 *
 * await pubsub.publish('cache:*', {
 *   type: 'set',
 *   key: 'test',
 *   value: 'data',
 *   timestamp: Date.now(),
 *   serverId: 'server-a'
 * });
 *
 * unsub();
 * await pubsub.disconnect();
 * ```
 */
export class RedisPubSubImpl implements RedisPubSub {
  private subscriber: Redis;
  private publisher: Redis;
  private serverId: string;
  private isConnected: boolean = false;

  // Pattern -> array of handlers
  private subscriptions: Map<string, Array<(event: CacheChangeEvent) => void>> = new Map();

  // Track active patterns for reconnection
  private activePatterns: Set<string> = new Set();

  /**
   * Creates a new RedisPubSub instance
   *
   * **Note:** Does not connect automatically - call connect() explicitly.
   *
   * @param config - Redis connection configuration
   * @param serverId - Unique server identifier
   */
  constructor(config: RedisOptions, serverId: string) {
    this.serverId = serverId;

    // Create separate connections for pub and sub
    // This is REQUIRED by Redis pub/sub architecture
    this.subscriber = new Redis({
      ...config,
      lazyConnect: true,
    });

    this.publisher = new Redis({
      ...config,
      lazyConnect: true,
    });

    // Set up event listeners
    this.setupEventListeners();
  }

  /**
   * Set up Redis client event listeners
   *
   * Handles reconnection and resubscription logic.
   *
   * @private
   */
  private setupEventListeners(): void {
    // Subscriber events
    this.subscriber.on('ready', async () => {
      this.isConnected = true;

      // Resubscribe to all active patterns on reconnection
      if (this.activePatterns.size > 0) {
        for (const pattern of this.activePatterns) {
          await this.subscriber.psubscribe(pattern);
        }
      }
    });

    this.subscriber.on('error', error => {
      console.error('Redis subscriber error:', error.message);
    });

    this.subscriber.on('close', () => {
      this.isConnected = false;
    });

    // Handle pattern messages
    this.subscriber.on('pmessage', (pattern, channel, message) => {
      try {
        const event: CacheChangeEvent = JSON.parse(message);

        // Get handlers for this pattern
        const handlers = this.subscriptions.get(pattern);
        if (handlers) {
          for (const handler of handlers) {
            try {
              handler(event);
            } catch (error) {
              console.error('Error in pub/sub handler:', error);
            }
          }
        }
      } catch (error) {
        console.error('Failed to parse pub/sub message:', error);
      }
    });

    // Publisher events
    this.publisher.on('error', error => {
      console.error('Redis publisher error:', error.message);
    });
  }

  /**
   * Connect to Redis
   *
   * Creates connections for both publisher and subscriber.
   *
   * @throws {CacheConnectionError} If connection fails
   *
   * @example
   * ```typescript
   * await pubsub.connect();
   * console.log('Connected to Redis pub/sub');
   * ```
   */
  async connect(): Promise<void> {
    try {
      // Connect both publisher and subscriber
      await Promise.all([this.publisher.connect(), this.subscriber.connect()]);

      // Verify connections
      const [pubPong, subPong] = await Promise.all([this.publisher.ping(), this.subscriber.ping()]);

      if (pubPong !== 'PONG' || subPong !== 'PONG') {
        throw new Error('PING command did not return PONG');
      }

      this.isConnected = true;
    } catch (error) {
      this.isConnected = false;

      throw new CacheConnectionError('Failed to connect Redis pub/sub', {
        adapter: 'RedisPubSub',
        reason: 'Publisher or subscriber connection failed',
        originalError: (error as Error).message,
      });
    }
  }

  /**
   * Disconnect from Redis
   *
   * Closes both publisher and subscriber connections.
   * Clears all subscriptions.
   *
   * @example
   * ```typescript
   * await pubsub.disconnect();
   * console.log('Disconnected from Redis pub/sub');
   * ```
   */
  async disconnect(): Promise<void> {
    try {
      // Unsubscribe from all patterns
      if (this.activePatterns.size > 0) {
        await this.subscriber.punsubscribe(...Array.from(this.activePatterns));
      }

      // Close connections
      await Promise.all([this.publisher.quit(), this.subscriber.quit()]);

      // Clear state
      this.subscriptions.clear();
      this.activePatterns.clear();
      this.isConnected = false;
    } catch (error) {
      // Force disconnect on error
      await Promise.all([this.publisher.disconnect(), this.subscriber.disconnect()]);

      this.subscriptions.clear();
      this.activePatterns.clear();
      this.isConnected = false;

      throw new CacheConnectionError('Failed to disconnect Redis pub/sub gracefully', {
        adapter: 'RedisPubSub',
        reason: 'QUIT command failed',
        originalError: (error as Error).message,
      });
    }
  }

  /**
   * Publish event to pattern
   *
   * Serializes event to JSON and publishes to Redis.
   * All subscribers to the pattern will receive the event.
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
  async publish(pattern: string, event: CacheChangeEvent): Promise<void> {
    try {
      // Serialize event to JSON
      const message = JSON.stringify(event);

      // Publish to Redis
      // Note: We publish to the channel name (without wildcards)
      // For pattern "cache:*", we publish to "cache:events"
      const channel = pattern.replace('*', 'events');
      await this.publisher.publish(channel, message);
    } catch (error) {
      throw new CacheOperationError('Redis PUBLISH operation failed', {
        operation: 'publish',
        adapter: 'RedisPubSub',
        value: pattern,
        originalError: (error as Error).message,
      });
    }
  }

  /**
   * Subscribe to pattern
   *
   * Receives events from all servers publishing to the pattern.
   * Uses Redis PSUBSCRIBE for pattern matching.
   *
   * **Reconnection:** Subscriptions are automatically restored on reconnection.
   *
   * @param pattern - Redis pattern (e.g., "cache:*")
   * @param handler - Event handler function
   * @returns Cleanup function to unsubscribe
   *
   * @example
   * ```typescript
   * const unsubscribe = pubsub.subscribe('cache:user:*', (event) => {
   *   console.log('User cache event:', event.key);
   * });
   *
   * // Later: cleanup
   * unsubscribe();
   * ```
   */
  async subscribe(
    pattern: string,
    handler: (event: CacheChangeEvent) => void
  ): Promise<() => void> {
    // Get existing handlers for this pattern
    let handlers = this.subscriptions.get(pattern);

    if (!handlers) {
      // First subscription to this pattern
      handlers = [];
      this.subscriptions.set(pattern, handlers);

      // Subscribe to pattern in Redis
      if (this.isConnected) {
        this.subscriber.psubscribe(pattern).catch(error => {
          console.error(`Failed to subscribe to pattern ${pattern}:`, error);
        });
      }

      this.activePatterns.add(pattern);
    }

    // Add handler to list
    handlers.push(handler);

    // Return cleanup function
    return () => {
      const currentHandlers = this.subscriptions.get(pattern);
      if (!currentHandlers) return;

      // Remove this handler
      const index = currentHandlers.indexOf(handler);
      if (index !== -1) {
        currentHandlers.splice(index, 1);
      }

      // If no handlers left, unsubscribe from pattern
      if (currentHandlers.length === 0) {
        this.subscriptions.delete(pattern);
        this.activePatterns.delete(pattern);

        if (this.isConnected) {
          this.subscriber.punsubscribe(pattern).catch(error => {
            console.error(`Failed to unsubscribe from pattern ${pattern}:`, error);
          });
        }
      }
    };
  }
}
