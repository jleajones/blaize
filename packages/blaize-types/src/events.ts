/**
 * EventBus Type Definitions for BlaizeJS
 *
 * This module defines the core types for the EventBus system, enabling
 * type-safe event publishing and subscription with optional cross-server
 * propagation through adapters.
 *
 * @module @blaizejs/types/events
 * @since 0.5.0
 */

import type { BlaizeLogger } from './logger';

// ============================================================================
// Core Event Types
// ============================================================================

/**
 * Core event structure for all BlaizeJS events
 *
 * Events flow through the EventBus system and can optionally be propagated
 * across servers via adapters (like Redis).
 *
 * @template TData - Type of the event payload data
 *
 * @example Basic event structure
 * ```typescript
 * const event: BlaizeEvent<{ userId: string }> = {
 *   id: 'evt_abc123',
 *   type: 'user:created',
 *   data: { userId: '12345' },
 *   serverId: 'server-a',
 *   timestamp: Date.now(),
 * };
 * ```
 *
 * @example Event with complex data
 * ```typescript
 * interface OrderData {
 *   orderId: string;
 *   items: Array<{ productId: string; quantity: number }>;
 *   total: number;
 * }
 *
 * const orderEvent: BlaizeEvent<OrderData> = {
 *   id: 'evt_order_456',
 *   type: 'order:placed',
 *   data: {
 *     orderId: 'ord_789',
 *     items: [{ productId: 'prod_1', quantity: 2 }],
 *     total: 99.99,
 *   },
 *   serverId: 'api-server-1',
 *   timestamp: Date.now(),
 * };
 * ```
 */
export interface BlaizeEvent<TData = unknown> {
  /**
   * Unique identifier for this event instance
   *
   * Used for deduplication and tracing. Auto-generated if not provided.
   */
  readonly id: string;

  /**
   * Event type identifier
   *
   * Uses colon-separated naming convention (e.g., 'user:created', 'order:shipped').
   * Supports pattern matching with wildcards (e.g., 'user:*' matches 'user:created').
   */
  readonly type: string;

  /**
   * Event payload data
   *
   * The actual data associated with the event. Type is generic
   * for compile-time type safety.
   */
  readonly data: TData;

  /**
   * Server identifier where the event originated
   *
   * Used for filtering events in multi-server deployments.
   * Allows servers to ignore their own events when needed.
   */
  readonly serverId: string;

  /**
   * Timestamp when the event was created (ms since epoch)
   *
   * Used for event ordering and debugging.
   */
  readonly timestamp: number;

  /**
   * Optional correlation ID for request tracing
   *
   * Links events to specific requests for distributed tracing.
   */
  readonly correlationId?: string;
}

// ============================================================================
// Handler Types
// ============================================================================

/**
 * Event handler function type
 *
 * Handlers receive events and can perform sync or async operations.
 * Errors in handlers are caught and logged but don't affect other handlers.
 *
 * @template TData - Type of the event data the handler expects
 *
 * @example Sync handler
 * ```typescript
 * const handler: EventHandler<{ userId: string }> = (event) => {
 *   console.log('User created:', event.data.userId);
 * };
 * ```
 *
 * @example Async handler
 * ```typescript
 * const handler: EventHandler<{ userId: string }> = async (event) => {
 *   await notifyAdmins(event.data.userId);
 *   await updateAnalytics('user_created', event.data);
 * };
 * ```
 */
export type EventHandler<TData = unknown> = (
  event: BlaizeEvent<TData>
) => void | Promise<void>;

/**
 * Unsubscribe function returned from subscribe()
 *
 * Calling this function removes the subscription.
 * Multiple calls are safe (idempotent).
 *
 * @example
 * ```typescript
 * const unsubscribe = eventBus.subscribe('user:*', handler);
 *
 * // Later, when done:
 * unsubscribe();
 *
 * // Safe to call multiple times:
 * unsubscribe(); // No-op, no error
 * ```
 */
export type Unsubscribe = () => void;

// ============================================================================
// Adapter Types
// ============================================================================

/**
 * EventBus adapter interface for cross-server event propagation
 *
 * Adapters enable events to flow between multiple server instances.
 * The primary implementation is Redis-based for production use.
 *
 * **Adapter Responsibilities:**
 * - Publish events to external message broker
 * - Subscribe to events from other servers
 * - Handle connection lifecycle
 * - Provide health status
 *
 * @example Adapter usage
 * ```typescript
 * const redisAdapter = createRedisEventBusAdapter({
 *   client: redisClient,
 *   channel: 'blaize:events',
 * });
 *
 * await redisAdapter.connect();
 *
 * // Adapter is used internally by EventBus
 * eventBus.setAdapter(redisAdapter);
 * ```
 */
export interface EventBusAdapter {
  /**
   * Publish an event to the external message broker
   *
   * Called by EventBus after local handlers have been notified.
   * Should serialize and send the event to the broker.
   *
   * @param event - The event to publish
   * @returns Promise that resolves when published
   *
   * @throws {EventBusAdapterError} If publish fails
   */
  publish(event: BlaizeEvent): Promise<void>;

  /**
   * Subscribe to events from the external message broker
   *
   * Called by EventBus when a subscription is added.
   * Should set up the subscription on the broker.
   *
   * @param pattern - Event type pattern (supports wildcards like 'user:*')
   * @param handler - Handler to call when matching events arrive
   * @returns Promise resolving to unsubscribe function
   *
   * @throws {EventBusAdapterError} If subscription fails
   */
  subscribe(pattern: string, handler: EventHandler): Promise<Unsubscribe>;

  /**
   * Connect to the external message broker
   *
   * Should be called before any publish/subscribe operations.
   * Idempotent - safe to call if already connected.
   *
   * @returns Promise that resolves when connected
   *
   * @throws {EventBusConnectionError} If connection fails
   */
  connect(): Promise<void>;

  /**
   * Disconnect from the external message broker
   *
   * Should clean up all subscriptions and close connections.
   * Idempotent - safe to call if already disconnected.
   *
   * @returns Promise that resolves when disconnected
   */
  disconnect(): Promise<void>;

  /**
   * Check adapter health and connectivity
   *
   * Used for health checks and monitoring.
   *
   * @returns Health status with optional details
   *
   * @example
   * ```typescript
   * const health = await adapter.healthCheck();
   * if (!health.healthy) {
   *   logger.error('EventBus adapter unhealthy', health);
   * }
   * ```
   */
  healthCheck(): Promise<{
    healthy: boolean;
    message?: string;
    details?: Record<string, unknown>;
  }>;
}

// ============================================================================
// EventBus Interface
// ============================================================================

/**
 * Configuration options for EventBus
 *
 * @example Basic configuration
 * ```typescript
 * const options: EventBusOptions = {
 *   serverId: 'api-server-1',
 * };
 * ```
 *
 * @example With logger
 * ```typescript
 * const options: EventBusOptions = {
 *   serverId: 'api-server-1',
 *   logger: createLogger({ name: 'eventbus' }),
 * };
 * ```
 */
export interface EventBusOptions {
  /**
   * Unique identifier for this server instance
   *
   * Used to identify event sources in multi-server deployments.
   * If not provided, a random UUID will be generated.
   */
  serverId?: string;

  /**
   * Logger instance for EventBus operations
   *
   * If not provided, uses a default console logger.
   */
  logger?: BlaizeLogger;
}

/**
 * Main EventBus interface for event-driven communication
 *
 * The EventBus provides publish/subscribe functionality for decoupled
 * communication between components. It supports:
 * - Local event handling within a single server
 * - Cross-server event propagation via adapters
 * - Pattern-based subscriptions with wildcards
 *
 * **Event Flow:**
 * 1. `publish()` → local handlers notified
 * 2. If adapter set → event forwarded to adapter
 * 3. Adapter broadcasts to other servers
 * 4. Other servers' EventBus instances receive and notify local handlers
 *
 * @example Basic usage
 * ```typescript
 * const eventBus = createEventBus({ serverId: 'server-1' });
 *
 * // Subscribe to user events
 * const unsubscribe = eventBus.subscribe('user:created', async (event) => {
 *   console.log('New user:', event.data.userId);
 *   await sendWelcomeEmail(event.data.userId);
 * });
 *
 * // Publish an event
 * await eventBus.publish('user:created', { userId: '12345' });
 *
 * // Cleanup when done
 * unsubscribe();
 * ```
 *
 * @example Pattern subscriptions
 * ```typescript
 * // Subscribe to ALL user events
 * eventBus.subscribe('user:*', (event) => {
 *   console.log('User event:', event.type, event.data);
 * });
 *
 * // These all match:
 * await eventBus.publish('user:created', { userId: '1' });
 * await eventBus.publish('user:updated', { userId: '1', name: 'New Name' });
 * await eventBus.publish('user:deleted', { userId: '1' });
 * ```
 *
 * @example Multi-server with adapter
 * ```typescript
 * const eventBus = createEventBus({ serverId: 'api-1' });
 * const adapter = createRedisEventBusAdapter({ client: redis });
 *
 * await adapter.connect();
 * eventBus.setAdapter(adapter);
 *
 * // Events now propagate across all servers connected to Redis
 * eventBus.subscribe('cache:invalidated', (event) => {
 *   if (event.serverId !== 'api-1') {
 *     // Event from another server - invalidate local cache
 *     localCache.delete(event.data.key);
 *   }
 * });
 * ```
 */
export interface EventBus {
  /**
   * Server identifier for this EventBus instance
   *
   * Included in all published events for source identification.
   */
  readonly serverId: string;

  /**
   * Publish an event to all matching subscribers
   *
   * Events are delivered to local subscribers first, then forwarded
   * to the adapter (if set) for cross-server propagation.
   *
   * @template TData - Type of the event data
   * @param type - Event type (e.g., 'user:created')
   * @param data - Event payload data (optional for events with no data)
   * @param options - Optional publish options
   * @returns Promise that resolves when local handlers complete
   *
   * @example Simple publish
   * ```typescript
   * await eventBus.publish('user:created', { userId: '123' });
   * ```
   *
   * @example Publish without data
   * ```typescript
   * await eventBus.publish('system:shutdown');
   * ```
   *
   * @example Publish with correlation ID
   * ```typescript
   * await eventBus.publish(
   *   'order:placed',
   *   { orderId: 'ord_123' },
   *   { correlationId: 'req_abc' }
   * );
   * ```
   */
  publish<TData = unknown>(
    type: string,
    data?: TData,
    options?: EventPublishOptions
  ): Promise<void>;

  /**
   * Subscribe to events matching a pattern
   *
   * Patterns support wildcards:
   * - `*` matches any single segment (e.g., 'user:*' matches 'user:created')
   * - Exact strings for exact matches (e.g., 'user:created')
   *
   * @template TData - Type of the event data expected
   * @param pattern - Event type pattern to match
   * @param handler - Handler function called for matching events
   * @returns Unsubscribe function to remove the subscription
   *
   * @example Exact match
   * ```typescript
   * const unsubscribe = eventBus.subscribe('user:created', (event) => {
   *   console.log('User created:', event.data);
   * });
   * ```
   *
   * @example Pattern match
   * ```typescript
   * eventBus.subscribe('order:*', (event) => {
   *   // Matches: order:placed, order:shipped, order:delivered
   *   console.log('Order event:', event.type);
   * });
   * ```
   */
  subscribe<TData = unknown>(
    pattern: string,
    handler: EventHandler<TData>
  ): Unsubscribe;

  /**
   * Set an adapter for cross-server event propagation
   *
   * Only one adapter can be set at a time. Setting a new adapter
   * replaces the previous one.
   *
   * @param adapter - The adapter to use, or null to remove
   *
   * @example Set adapter
   * ```typescript
   * const adapter = createRedisEventBusAdapter({ client: redis });
   * await adapter.connect();
   * eventBus.setAdapter(adapter);
   * ```
   *
   * @example Remove adapter
   * ```typescript
   * eventBus.setAdapter(null);
   * ```
   */
  setAdapter(adapter: EventBusAdapter | null): void;

  /**
   * Get the current adapter (if any)
   *
   * @returns The current adapter or null if none set
   */
  getAdapter(): EventBusAdapter | null;

  /**
   * Check if an adapter is currently set
   *
   * @returns true if an adapter is configured
   */
  hasAdapter(): boolean;
}

/**
 * Options for publishing events
 */
export interface EventPublishOptions {
  /**
   * Correlation ID for request tracing
   *
   * Links this event to a specific request for distributed tracing.
   */
  correlationId?: string;

  /**
   * Custom event ID
   *
   * If not provided, a unique ID is auto-generated.
   */
  id?: string;
}

// ============================================================================
// Error Detail Interfaces
// ============================================================================

/**
 * Base error details for EventBus errors
 *
 * Common fields included in all EventBus error details.
 */
export interface EventBusErrorDetails {
  /** Operation that failed (e.g., 'publish', 'subscribe') */
  operation?: string;

  /** Event type involved */
  eventType?: string;

  /** Server ID where error occurred */
  serverId?: string;

  /** Additional context */
  [key: string]: unknown;
}

/**
 * Error details for EventBus connection failures
 *
 * Used when connecting to external message brokers fails.
 */
export interface EventBusConnectionErrorDetails extends EventBusErrorDetails {
  /** Host address of the message broker */
  host?: string;

  /** Port number of the message broker */
  port?: number;

  /** Reason for connection failure */
  reason?: string;

  /** Original error message from underlying driver */
  originalError?: string;

  /** Number of connection attempts made */
  attempts?: number;
}

/**
 * Error details for EventBus adapter operation failures
 *
 * Used when publish/subscribe operations fail on the adapter.
 */
export interface EventBusAdapterErrorDetails extends EventBusErrorDetails {
  /** Adapter operation that failed */
  adapterOperation?: 'publish' | 'subscribe' | 'unsubscribe' | 'connect' | 'disconnect';

  /** Event pattern involved (for subscriptions) */
  pattern?: string;

  /** Event ID involved (for publish) */
  eventId?: string;

  /** Original error message from adapter */
  originalError?: string;
}

/**
 * Error details for event validation failures
 *
 * Used when event data fails validation.
 */
export interface EventValidationErrorDetails extends EventBusErrorDetails {
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

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Extract event data type from a BlaizeEvent
 *
 * @example
 * ```typescript
 * type UserCreatedEvent = BlaizeEvent<{ userId: string; email: string }>;
 * type UserData = EventData<UserCreatedEvent>;
 * // UserData = { userId: string; email: string }
 * ```
 */
export type EventData<T> = T extends BlaizeEvent<infer TData> ? TData : never;

/**
 * Create a typed event type for a specific event
 *
 * @example
 * ```typescript
 * type UserCreatedEvent = TypedEvent<'user:created', { userId: string }>;
 * ```
 */
export type TypedEvent<TType extends string, TData> = BlaizeEvent<TData> & {
  readonly type: TType;
};

/**
 * Event schema map for defining typed events
 *
 * Used with TypedEventBus for compile-time type safety.
 *
 * @example
 * ```typescript
 * interface MyEventSchemas extends EventSchemas {
 *   'user:created': { userId: string; email: string };
 *   'user:deleted': { userId: string };
 *   'order:placed': { orderId: string; total: number };
 * }
 * ```
 */
export interface EventSchemas {
  [eventType: string]: unknown;
}