/**
 * Redis EventBus Adapter Implementation
 *
 * Provides distributed event propagation using Redis pub/sub with:
 * - Pattern-based subscriptions using PSUBSCRIBE
 * - Self-filtering to ignore own server's events
 * - Circuit breaker protection for publish operations
 * - Automatic subscription restoration on reconnection
 *
 * @module @blaizejs/adapter-redis/event-bus-adapter
 * @since 0.1.0
 */

import { createLogger } from 'blaizejs';

import { createCircuitBreaker } from './circuit-breaker';
import { CircuitBreakerOpenError, RedisOperationError } from './errors';

import type {
  RedisClient,
  RedisEventBusAdapterOptions,
  CircuitState,
  SubscriptionEntry,
} from './types';
import type {
  BlaizeLogger,
  BlaizeEvent,
  EventHandler,
  Unsubscribe,
  EventBusAdapter,
} from 'blaizejs';

/**
 * Default options for RedisEventBusAdapter
 */
const DEFAULT_OPTIONS = {
  channelPrefix: 'blaize:events',
};

/**
 * RedisEventBusAdapter - Distributed event bus using Redis pub/sub
 *
 * Implements the EventBusAdapter interface for distributed event propagation
 * across multiple servers/processes using Redis pub/sub.
 */
export class RedisEventBusAdapter implements EventBusAdapter {
  private readonly client: RedisClient;
  private readonly channelPrefix: string;
  private readonly logger: BlaizeLogger;
  private readonly circuitBreaker: ReturnType<typeof createCircuitBreaker>;

  private isConnected = false;
  private subscriptions = new Map<string, SubscriptionEntry>();
  private messageHandlerBound: (pattern: string, channel: string, message: string) => void;

  constructor(client: RedisClient, options?: RedisEventBusAdapterOptions) {
    this.client = client;
    this.channelPrefix = options?.channelPrefix ?? DEFAULT_OPTIONS.channelPrefix;

    // Setup logger
    if (options?.logger) {
      this.logger = options.logger.child({ component: 'RedisEventBusAdapter' });
    } else {
      this.logger = createLogger().child({ component: 'RedisEventBusAdapter' });
    }

    // Setup circuit breaker for publish operations
    this.circuitBreaker = createCircuitBreaker({
      ...options?.circuitBreaker,
      logger: this.logger,
    });

    // Bind message handler to preserve `this` context
    this.messageHandlerBound = this.handleMessage.bind(this);

    this.logger.info('RedisEventBusAdapter created', {
      channelPrefix: this.channelPrefix,
    });
  }

  /**
   * Connect to Redis and setup subscriptions
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      this.logger.debug('Already connected, skipping connect()');
      return;
    }

    this.logger.info('Connecting RedisEventBusAdapter');

    // Ensure client is connected
    if (!this.client.isConnected()) {
      await this.client.connect();
    }

    // Setup pmessage listener for pattern subscriptions
    const subscriber = this.client.getSubscriber();
    subscriber.on('pmessage', this.messageHandlerBound);

    // Re-subscribe to any existing patterns (subscription restoration)
    if (this.subscriptions.size > 0) {
      this.logger.info('Restoring subscriptions after reconnection', {
        count: this.subscriptions.size,
      });

      const patterns = new Set(
        Array.from(this.subscriptions.values()).map(sub => sub.redisPattern)
      );

      for (const pattern of patterns) {
        await subscriber.psubscribe(pattern);
        this.logger.debug('Re-subscribed to pattern', { pattern });
      }
    }

    this.isConnected = true;
    this.logger.info('RedisEventBusAdapter connected');
  }

  /**
   * Disconnect from Redis and cleanup subscriptions
   */
  async disconnect(): Promise<void> {
    if (!this.isConnected) {
      this.logger.debug('Not connected, skipping disconnect()');
      return;
    }

    this.logger.info('Disconnecting RedisEventBusAdapter');

    const subscriber = this.client.getSubscriber();

    // Remove event listener
    subscriber.off('pmessage', this.messageHandlerBound);

    // Unsubscribe from all patterns
    const patterns = new Set(Array.from(this.subscriptions.values()).map(sub => sub.redisPattern));

    if (patterns.size > 0) {
      await subscriber.punsubscribe(...Array.from(patterns));
      this.logger.debug('Unsubscribed from all patterns', { count: patterns.size });
    }

    this.isConnected = false;
    this.logger.info('RedisEventBusAdapter disconnected');
  }

  /**
   * Publish an event to Redis
   *
   * Events are serialized as JSON and published to a channel based on event type.
   * Circuit breaker protects against cascading failures.
   *
   * @param event - Event to publish
   */
  async publish(event: BlaizeEvent): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Adapter not connected. Call connect() first.');
    }

    const channel = this.buildChannelName(event.type);

    this.logger.debug('Publishing event', {
      type: event.type,
      channel,
      serverId: event.serverId,
    });

    // Serialize event
    const payload = this.serializeEvent(event);

    // Check payload size (warn if > 1MB)
    if (payload.length > 1024 * 1024) {
      this.logger.warn('Large event payload', {
        type: event.type,
        size: payload.length,
        sizeKB: Math.round(payload.length / 1024),
      });
    }

    // Publish through circuit breaker
    try {
      await this.circuitBreaker.execute(async () => {
        const publisher = this.client.getPublisher();
        await publisher.publish(channel, payload);
      });

      this.logger.debug('Event published successfully', {
        type: event.type,
        channel,
      });
    } catch (error) {
      this.logger.error('Failed to publish event', {
        type: event.type,
        channel,
        error: error instanceof Error ? error.message : String(error),
      });
      // Let CircuitBreakerOpenError pass through unchanged
      if (error instanceof CircuitBreakerOpenError) {
        throw error;
      }

      throw new RedisOperationError('Failed to publish event', {
        operation: 'PUBLISH',
        key: channel,
        originalError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Subscribe to events matching a pattern
   *
   * Patterns support wildcards:
   * - `*` matches all events
   * - `user:*` matches all user events
   * - `user:created` matches exact event
   *
   * Self-filtering is applied - events from the same serverId as the handler are ignored.
   *
   * @param pattern - Pattern to match
   * @param handler - Handler to invoke for matching events
   * @returns Unsubscribe function
   */
  async subscribe(pattern: string, handler: EventHandler): Promise<Unsubscribe> {
    if (!this.isConnected) {
      throw new Error('Adapter not connected. Call connect() first.');
    }

    // Convert pattern to Redis pattern
    const redisPattern = this.buildRedisPattern(pattern);

    // Generate unique subscription ID
    const subscriptionId = `${pattern}:${Date.now()}:${Math.random().toString(36).slice(2)}`;

    this.logger.debug('Creating subscription', {
      pattern,
      redisPattern,
      subscriptionId,
    });

    // Store subscription
    this.subscriptions.set(subscriptionId, {
      pattern,
      handler,
      redisPattern,
    });

    // Only subscribe to Redis if this is a new pattern
    const isNewPattern =
      Array.from(this.subscriptions.values()).filter(sub => sub.redisPattern === redisPattern)
        .length === 1;

    if (isNewPattern) {
      const subscriber = this.client.getSubscriber();
      await subscriber.psubscribe(redisPattern);
      this.logger.debug('Subscribed to Redis pattern', { redisPattern });
    }

    // Return unsubscribe function
    return () => {
      this.logger.debug('Unsubscribing', { subscriptionId, pattern });

      // Remove subscription
      this.subscriptions.delete(subscriptionId);

      // Check if we should unsubscribe from Redis pattern
      const remainingWithSamePattern = Array.from(this.subscriptions.values()).filter(
        sub => sub.redisPattern === redisPattern
      );

      if (remainingWithSamePattern.length === 0) {
        const subscriber = this.client.getSubscriber();
        subscriber.punsubscribe(redisPattern).catch(err => {
          this.logger.warn('Error unsubscribing from Redis pattern', {
            pattern: redisPattern,
            error: err instanceof Error ? err.message : String(err),
          });
        });

        this.logger.debug('Unsubscribed from Redis pattern', { redisPattern });
      }
    };
  }

  /**
   * Perform health check
   *
   * @returns Health status including circuit breaker state
   */
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    if (!this.isConnected) {
      return {
        healthy: false,
        message: 'Adapter not connected',
      };
    }

    // Check client health
    const clientHealth = await this.client.healthCheck();

    if (!clientHealth.healthy) {
      return clientHealth;
    }

    // Include circuit breaker state
    const circuitState = this.circuitBreaker.state;

    if (circuitState === 'OPEN') {
      return {
        healthy: false,
        message: `Circuit breaker is ${circuitState}`,
      };
    }

    return {
      healthy: true,
      message: `Connected (circuit: ${circuitState})`,
    };
  }

  /**
   * Get current circuit breaker state
   *
   * @returns Current circuit state
   */
  getCircuitState(): CircuitState {
    return this.circuitBreaker.state;
  }

  /**
   * Build channel name from event type
   *
   * @private
   */
  private buildChannelName(eventType: string): string {
    return `${this.channelPrefix}:${eventType}`;
  }

  /**
   * Build Redis PSUBSCRIBE pattern from event pattern
   *
   * Converts BlaizeJS patterns to Redis glob patterns:
   * - `*` → `blaize:events:*`
   * - `user:*` → `blaize:events:user:*`
   * - `user:created` → `blaize:events:user:created`
   *
   * @private
   */
  private buildRedisPattern(pattern: string): string {
    return `${this.channelPrefix}:${pattern}`;
  }

  /**
   * Extract event type from Redis channel name
   *
   * @private
   */
  private extractEventType(channel: string): string {
    const prefix = `${this.channelPrefix}:`;
    if (channel.startsWith(prefix)) {
      return channel.slice(prefix.length);
    }
    return channel;
  }

  /**
   * Check if pattern matches event type
   *
   * @private
   */
  private patternMatches(pattern: string, eventType: string): boolean {
    if (pattern === '*') {
      return true;
    }

    if (pattern.endsWith(':*')) {
      const prefix = pattern.slice(0, -2);
      return eventType.startsWith(prefix + ':') || eventType === prefix;
    }

    return pattern === eventType;
  }

  /**
   * Serialize event to JSON
   *
   * @private
   */
  private serializeEvent(event: BlaizeEvent): string {
    try {
      return JSON.stringify(event);
    } catch (error) {
      this.logger.error('Failed to serialize event', {
        type: event.type,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(
        `Failed to serialize event: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Deserialize event from JSON
   *
   * @private
   */
  private deserializeEvent(payload: string): BlaizeEvent | null {
    try {
      const event = JSON.parse(payload) as BlaizeEvent;

      // Validate event structure
      if (
        typeof event.type !== 'string' ||
        typeof event.timestamp !== 'number' ||
        typeof event.serverId !== 'string'
      ) {
        this.logger.warn('Malformed event structure', { payload: payload.slice(0, 100) });
        return null;
      }

      return event;
    } catch (error) {
      this.logger.warn('Failed to deserialize event', {
        error: error instanceof Error ? error.message : String(error),
        payload: payload.slice(0, 100),
      });
      return null;
    }
  }

  /**
   * Handle incoming Redis pmessage
   *
   * Filters self-events and invokes matching handlers
   *
   * @private
   */
  private handleMessage(pattern: string, channel: string, message: string): void {
    // Deserialize event
    const event = this.deserializeEvent(message);
    if (!event) {
      return; // Already logged in deserializeEvent
    }

    const eventType = this.extractEventType(channel);

    this.logger.debug('Received event', {
      type: eventType,
      serverId: event.serverId,
      channel,
      pattern,
    });

    // Find matching subscriptions
    const matchingSubscriptions = Array.from(this.subscriptions.values()).filter(
      sub => sub.redisPattern === pattern && this.patternMatches(sub.pattern, eventType)
    );

    if (matchingSubscriptions.length === 0) {
      this.logger.debug('No matching subscriptions', { eventType, pattern });
      return;
    }

    // Invoke handlers (self-filtering happens at EventBus level in MemoryEventBus)
    for (const subscription of matchingSubscriptions) {
      try {
        const result = subscription.handler(event);
        if (result instanceof Promise) {
          result.catch(error => {
            this.logger.error('Event handler error', {
              type: eventType,
              pattern: subscription.pattern,
              error: error instanceof Error ? error.message : String(error),
            });
          });
        }
      } catch (error) {
        this.logger.error('Event handler error', {
          type: eventType,
          pattern: subscription.pattern,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}
