/**
 * MemoryEventBus Implementation
 *
 * Default in-memory EventBus with pattern matching and optional adapter support.
 * Handles local pub/sub with sophisticated pattern matching and metadata auto-population.
 *
 * @module @blaizejs/core/events
 * @since 0.4.0
 */

import { randomUUID } from 'node:crypto';

import { createLogger } from '../logger';
import { getCorrelationId } from '../tracing/correlation';

import type {
  EventBus,
  EventBusAdapter,
  EventHandler,
  BlaizeEvent,
  Unsubscribe,
  BlaizeLogger,
  Subscription,
} from '@blaize-types/index';

/**
 * Convert glob pattern to RegExp
 *
 * Supports wildcards (*) while escaping other regex special characters.
 * Special case: A single '*' matches everything (including colons).
 * Otherwise, '*' matches any characters except colon (namespace boundary).
 *
 * @param pattern - Glob pattern string
 * @returns RegExp for matching event types
 *
 * @example
 * ```typescript
 * globToRegex('*') // /^.*$/ - matches everything
 * globToRegex('user:*') // /^user:[^:]*$/ - namespace-aware
 * globToRegex('user:created') // /^user:created$/
 * ```
 */
function globToRegex(pattern: string): RegExp {
  // Special case: single wildcard matches everything
  if (pattern === '*') {
    return /^.*$/;
  }

  // Escape special regex characters except *
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    // Convert * to match any characters except colon (namespace boundary)
    .replace(/\*/g, '[^:]*');

  return new RegExp(`^${escaped}$`);
}

/**
 * Create matcher function for a pattern
 *
 * @param pattern - String (exact or glob) or RegExp
 * @returns RegExp for testing event types
 */
function createMatcher(pattern: string | RegExp): RegExp {
  if (pattern instanceof RegExp) {
    return pattern;
  }

  // Check if pattern contains wildcards
  if (pattern.includes('*')) {
    return globToRegex(pattern);
  }

  // Exact match - escape special regex chars
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped}$`);
}

/**
 * MemoryEventBus - Default in-memory EventBus implementation
 *
 * Provides local pub/sub with pattern matching and optional
 * distributed mode via adapters.
 *
 * Features:
 * - Exact, glob (*), and regex pattern matching
 * - Automatic metadata population (timestamp, serverId, correlationId)
 * - Handler error isolation (errors don't crash the bus)
 * - Optional adapter for cross-server events
 * - Self-filtering (ignores own events from adapter)
 *
 * @example Basic usage
 * ```typescript
 * const bus = new MemoryEventBus('server-1');
 *
 * // Subscribe
 * const unsubscribe = bus.subscribe('user:*', async (event) => {
 *   console.log('User event:', event.type, event.data);
 * });
 *
 * // Publish
 * await bus.publish('user:created', { userId: '123' });
 *
 * // Cleanup
 * unsubscribe();
 * await bus.disconnect();
 * ```
 *
 * @example With adapter
 * ```typescript
 * const bus = new MemoryEventBus('server-1');
 * const adapter = new RedisEventBusAdapter(config);
 *
 * await bus.setAdapter(adapter);
 *
 * // Events now propagate across all servers
 * await bus.publish('cache:invalidate', { key: 'users' });
 * ```
 */
export class MemoryEventBus implements EventBus {
  /**
   * Server ID for this instance
   * Used to identify event origin and prevent echo
   */
  public readonly serverId: string;

  /**
   * Map of subscription ID to subscription details
   */
  private subscriptions: Map<string, Subscription> = new Map();

  /**
   * Optional adapter for distributed events
   */
  private adapter?: EventBusAdapter;

  /**
   * Unsubscribe function for adapter subscription
   */
  private adapterUnsubscribe?: Unsubscribe;

  /**
   * Logger instance for error logging
   */
  private logger: BlaizeLogger;

  /**
   * Create a new MemoryEventBus instance
   *
   * @param serverId - Optional server identifier (auto-generated if not provided)
   * @param logger - Optional logger instance (creates child logger if provided)
   *
   * @example With custom server ID and logger
   * ```typescript
   * const bus = new MemoryEventBus('server-1', myLogger);
   * ```
   *
   * @example Auto-generated server ID
   * ```typescript
   * const bus = new MemoryEventBus();
   * console.log(bus.serverId); // UUID
   * ```
   */
  constructor(serverId?: string, logger?: BlaizeLogger) {
    this.serverId = serverId || randomUUID();

    // Create child logger with EventBus component identifier
    if (logger) {
      this.logger = logger.child({ component: 'EventBus', serverId: this.serverId });
    } else {
      this.logger = createLogger().child({ component: 'EventBus', serverId: this.serverId });
    }
  }

  /**
   * Publish an event to all matching subscribers
   *
   * Emits the event to:
   * - All local subscribers with matching patterns
   * - The adapter (if set) for cross-server propagation
   *
   * Event metadata is auto-populated:
   * - timestamp: Current time (Date.now())
   * - serverId: This instance's server ID
   * - correlationId: From AsyncLocalStorage (if available)
   *
   * @param type - Event type identifier
   * @param data - Event data payload (optional)
   * @returns Promise that resolves when event is published
   *
   * @throws {Error} If event type is empty
   *
   * @example
   * ```typescript
   * await bus.publish('user:created', { userId: '123' });
   * await bus.publish('system:ready'); // No data
   * ```
   */
  async publish(type: string, data?: unknown): Promise<void> {
    // Validate event type
    if (!type || type.trim() === '') {
      throw new Error('Event type cannot be empty');
    }

    // Create event with auto-populated metadata
    const event: BlaizeEvent = {
      type,
      data,
      timestamp: Date.now(),
      serverId: this.serverId,
      correlationId: getCorrelationId(),
    };

    // Emit to local subscribers
    await this.emitToSubscribers(event);

    // Delegate to adapter if set
    if (this.adapter) {
      try {
        await this.adapter.publish(event);
      } catch (error) {
        this.logger.error('Adapter publish failed', {
          eventType: type,
          serverId: this.serverId,
          error: error instanceof Error ? error.message : String(error),
        });
        // Don't rethrow - local delivery succeeded
      }
    }
  }

  /**
   * Subscribe to events matching a pattern
   *
   * Patterns can be:
   * - Exact: 'user:created' matches only 'user:created'
   * - Glob: 'user:*' matches 'user:created', 'user:updated', etc.
   * - RegExp: /^user:/ matches any event starting with 'user:'
   *
   * Glob wildcard rules:
   * - `*` matches any characters except colon (:)
   * - This prevents cross-namespace matching
   * - Use RegExp for more complex patterns
   *
   * @param pattern - Event type pattern (string or RegExp)
   * @param handler - Function to call for matching events
   * @returns Unsubscribe function (idempotent)
   *
   * @throws {Error} If pattern is empty string
   *
   * @example Exact match
   * ```typescript
   * bus.subscribe('user:created', (event) => {
   *   console.log('User created:', event.data);
   * });
   * ```
   *
   * @example Glob pattern
   * ```typescript
   * bus.subscribe('user:*', (event) => {
   *   console.log('User event:', event.type);
   * });
   * ```
   *
   * @example RegExp pattern
   * ```typescript
   * bus.subscribe(/^(user|admin):created$/, (event) => {
   *   console.log('Entity created:', event.type);
   * });
   * ```
   */
  subscribe(pattern: string | RegExp, handler: EventHandler): Unsubscribe {
    // Validate pattern
    if (typeof pattern === 'string' && pattern.trim() === '') {
      throw new Error('Pattern cannot be empty');
    }

    // Create subscription
    const id = randomUUID();
    const matcher = createMatcher(pattern);

    const subscription: Subscription = {
      id,
      pattern,
      matcher,
      handler,
    };

    this.subscriptions.set(id, subscription);

    // Return idempotent unsubscribe function
    let unsubscribed = false;
    return () => {
      if (!unsubscribed) {
        this.subscriptions.delete(id);
        unsubscribed = true;
      }
    };
  }

  /**
   * Set or replace the distributed adapter
   *
   * Enables cross-server event propagation via an adapter.
   *
   * Process:
   * 1. Disconnects existing adapter (if any)
   * 2. Connects the new adapter
   * 3. Subscribes to all events from adapter
   * 4. Filters out own serverId to prevent echo
   *
   * @param adapter - EventBusAdapter implementation
   * @returns Promise that resolves when adapter is connected
   *
   * @throws {Error} If adapter connection fails
   *
   * @example
   * ```typescript
   * const adapter = new RedisEventBusAdapter({
   *   host: 'localhost',
   *   port: 6379,
   * });
   *
   * await bus.setAdapter(adapter);
   * console.log('Distributed mode enabled');
   * ```
   */
  async setAdapter(adapter: EventBusAdapter): Promise<void> {
    // Disconnect existing adapter
    if (this.adapter) {
      await this.disconnectAdapter();
    }

    // Store new adapter
    this.adapter = adapter;

    // Connect adapter
    await adapter.connect();

    // Subscribe to all events from adapter
    // Use wildcard pattern to receive everything
    this.adapterUnsubscribe = await adapter.subscribe('*', (event: BlaizeEvent) => {
      // Self-filtering: ignore our own events
      if (event.serverId === this.serverId) {
        return;
      }

      // Emit to local subscribers
      void this.emitToSubscribers(event);
    });

    this.logger.info('Adapter connected', {
      serverId: this.serverId,
      adapterType: adapter.constructor.name,
    });
  }

  /**
   * Disconnect and cleanup
   *
   * - Disconnects the adapter (if set)
   * - Clears all local subscriptions
   * - Should be called during server shutdown
   *
   * @returns Promise that resolves when cleanup is complete
   *
   * @example
   * ```typescript
   * // During server shutdown
   * await bus.disconnect();
   * ```
   */
  async disconnect(): Promise<void> {
    // Disconnect adapter
    if (this.adapter) {
      await this.disconnectAdapter();
    }

    // Clear all subscriptions
    this.subscriptions.clear();

    this.logger.info('EventBus disconnected', { serverId: this.serverId });
  }

  /**
   * Disconnect the current adapter
   *
   * @private
   */
  private async disconnectAdapter(): Promise<void> {
    if (!this.adapter) {
      return;
    }

    // Unsubscribe from adapter events
    if (this.adapterUnsubscribe) {
      this.adapterUnsubscribe();
      this.adapterUnsubscribe = undefined;
    }

    // Disconnect adapter
    try {
      await this.adapter.disconnect();
    } catch (error) {
      this.logger.error('Adapter disconnect failed', {
        serverId: this.serverId,
        error: error instanceof Error ? error.message : String(error),
      });
      // Continue - we're cleaning up anyway
    }

    this.adapter = undefined;
  }

  /**
   * Emit event to all matching local subscribers
   *
   * Handlers are called in parallel.
   * Errors in handlers are caught and logged but don't fail the operation.
   *
   * @param event - Event to emit
   * @private
   */
  private async emitToSubscribers(event: BlaizeEvent): Promise<void> {
    const matchingHandlers: EventHandler[] = [];

    // Find all matching subscribers
    for (const subscription of this.subscriptions.values()) {
      if (subscription.matcher.test(event.type)) {
        matchingHandlers.push(subscription.handler);
      }
    }

    // Call handlers in parallel
    const handlerPromises = matchingHandlers.map(async handler => {
      try {
        await handler(event);
      } catch (error) {
        // Log error but don't rethrow - isolate handler failures
        this.logger.error('Event handler error', {
          eventType: event.type,
          serverId: event.serverId,
          correlationId: event.correlationId,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
      }
    });

    // Wait for all handlers to complete
    await Promise.all(handlerPromises);
  }
}
