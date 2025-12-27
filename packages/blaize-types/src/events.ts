/**
 * EventBus Type Definitions
 * 
 * Foundational types for the BlaizeJS EventBus system.
 * These types define the contract for event-driven communication
 * within and across BlaizeJS server instances.
 * 
 * @module @blaizejs/types/events
 * @since 0.4.0
 */

import type { z } from 'zod';

/**
 * Event schema map for typed event validation
 * 
 * Maps event type strings to Zod schemas for runtime validation.
 * Used by TypedEventBus to provide compile-time and runtime type safety.
 * 
 * @example
 * ```typescript
 * import { z } from 'zod';
 * 
 * const schemas = {
 *   'user:created': z.object({
 *     userId: z.string().uuid(),
 *     email: z.string().email(),
 *   }),
 *   'order:placed': z.object({
 *     orderId: z.string(),
 *     total: z.number().positive(),
 *   }),
 * } satisfies EventSchemas;
 * ```
 * 
 * @see TypedEventBus
 */
export type EventSchemas = Record<string, z.ZodType<unknown>>;

/**
 * Core event structure for BlaizeJS EventBus
 * 
 * Represents a single event with associated metadata.
 * All events follow this structure whether published locally
 * or distributed across servers via adapters.
 * 
 * @template T - Type of the event data payload
 * 
 * @example Basic event
 * ```typescript
 * const event: BlaizeEvent<{ userId: string }> = {
 *   type: 'user:created',
 *   data: { userId: '123' },
 *   timestamp: Date.now(),
 *   serverId: 'server-1',
 * };
 * ```
 * 
 * @example Event with correlation ID
 * ```typescript
 * const event: BlaizeEvent<{ orderId: string }> = {
 *   type: 'order:placed',
 *   data: { orderId: 'ord_123' },
 *   timestamp: Date.now(),
 *   serverId: 'server-1',
 *   correlationId: 'req_abc',
 * };
 * ```
 * 
 * @example Event with no data
 * ```typescript
 * const event: BlaizeEvent<undefined> = {
 *   type: 'system:ready',
 *   data: undefined,
 *   timestamp: Date.now(),
 *   serverId: 'server-1',
 * };
 * ```
 */
export interface BlaizeEvent<T = unknown> {
  /**
   * Event type identifier
   * 
   * Typically follows namespace:action convention (e.g., 'user:created').
   * Used for pattern matching and routing to subscribers.
   * 
   * Must be non-empty. Very long type names (>256 chars) may cause
   * performance issues with pattern matching.
   * 
   * @example
   * - 'user:created'
   * - 'order:placed'
   * - 'cache:invalidated'
   * - 'system:shutdown'
   */
  type: string;

  /**
   * Event data payload
   * 
   * Can be any JSON-serializable value, including:
   * - Objects: `{ userId: '123' }`
   * - Primitives: `'completed'`, `42`, `true`
   * - Arrays: `['item1', 'item2']`
   * - null/undefined: Indicates no data
   * 
   * Type parameter T provides compile-time type safety.
   */
  data: T;

  /**
   * Unix timestamp (milliseconds) when event was created
   * 
   * Set automatically by EventBus.publish().
   * Used for event ordering and debugging.
   */
  timestamp: number;

  /**
   * ID of the server that published this event
   * 
   * Automatically set by EventBus based on server configuration.
   * Used to:
   * - Prevent echo when using distributed adapters
   * - Track event origin for debugging
   * - Implement server-specific routing
   */
  serverId: string;

  /**
   * Optional correlation ID for request tracing
   * 
   * Links this event to a specific request or operation.
   * Propagates through the system for distributed tracing.
   * 
   * @example
   * ```typescript
   * // In a route handler
   * const correlationId = ctx.correlationId;
   * await eventBus.publish('user:created', { userId }, correlationId);
   * ```
   */
  correlationId?: string;
}

/**
 * Event handler function signature
 * 
 * Receives a BlaizeEvent and processes it.
 * Can be synchronous or asynchronous.
 * 
 * @template T - Type of the event data payload
 * 
 * @param event - The event to handle
 * @returns void or Promise<void>
 * 
 * @example Synchronous handler
 * ```typescript
 * const handler: EventHandler<{ userId: string }> = (event) => {
 *   console.log('User created:', event.data.userId);
 * };
 * ```
 * 
 * @example Async handler
 * ```typescript
 * const handler: EventHandler<{ userId: string }> = async (event) => {
 *   await database.saveUser(event.data.userId);
 *   await cache.invalidate(`user:${event.data.userId}`);
 * };
 * ```
 * 
 * @example Handler with error handling
 * ```typescript
 * const handler: EventHandler<{ orderId: string }> = async (event) => {
 *   try {
 *     await processOrder(event.data.orderId);
 *   } catch (error) {
 *     logger.error('Order processing failed', {
 *       orderId: event.data.orderId,
 *       error,
 *       correlationId: event.correlationId,
 *     });
 *   }
 * };
 * ```
 */
export type EventHandler<T = unknown> = (event: BlaizeEvent<T>) => void | Promise<void>;

/**
 * Function to unsubscribe from events
 * 
 * Returned by EventBus.subscribe() and EventBusAdapter.subscribe().
 * Calling this function removes the subscription.
 * 
 * Must be idempotent - calling multiple times should be safe.
 * 
 * @example
 * ```typescript
 * const unsubscribe = eventBus.subscribe('user:*', handler);
 * 
 * // Later, remove subscription
 * unsubscribe();
 * 
 * // Safe to call again
 * unsubscribe(); // No-op
 * ```
 * 
 * @example Cleanup on component unmount
 * ```typescript
 * let unsubscribe: Unsubscribe;
 * 
 * onMount(() => {
 *   unsubscribe = eventBus.subscribe('data:updated', handleUpdate);
 * });
 * 
 * onUnmount(() => {
 *   unsubscribe?.();
 * });
 * ```
 */
export type Unsubscribe = () => void;

/**
 * Adapter interface for distributed event systems
 * 
 * Adapters enable EventBus to work with external message brokers
 * like Redis Pub/Sub, RabbitMQ, or cloud messaging services.
 * 
 * The adapter handles:
 * - Connection management
 * - Message serialization/deserialization
 * - Cross-server event propagation
 * - Health monitoring
 * 
 * @example Redis adapter implementation
 * ```typescript
 * class RedisEventBusAdapter implements EventBusAdapter {
 *   async connect(): Promise<void> {
 *     await this.redis.connect();
 *   }
 * 
 *   async disconnect(): Promise<void> {
 *     await this.redis.quit();
 *   }
 * 
 *   async publish(event: BlaizeEvent): Promise<void> {
 *     await this.redis.publish(
 *       'blaize:events',
 *       JSON.stringify(event)
 *     );
 *   }
 * 
 *   async subscribe(
 *     pattern: string,
 *     handler: EventHandler
 *   ): Promise<Unsubscribe> {
 *     const channel = `blaize:events:${pattern}`;
 *     await this.redis.subscribe(channel, handler);
 *     
 *     return () => {
 *       this.redis.unsubscribe(channel);
 *     };
 *   }
 * 
 *   async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
 *     try {
 *       await this.redis.ping();
 *       return { healthy: true };
 *     } catch (error) {
 *       return { 
 *         healthy: false, 
 *         message: 'Redis connection failed' 
 *       };
 *     }
 *   }
 * }
 * ```
 * 
 * @see EventBus.setAdapter
 */
export interface EventBusAdapter {
  /**
   * Establish connection to the underlying message broker
   * 
   * Must be idempotent - safe to call multiple times.
   * Should throw if connection cannot be established.
   * 
   * @throws {Error} If connection fails
   * 
   * @example
   * ```typescript
   * await adapter.connect();
   * console.log('Connected to message broker');
   * ```
   */
  connect(): Promise<void>;

  /**
   * Close connection to the underlying message broker
   * 
   * Must be idempotent - safe to call multiple times.
   * Should gracefully handle cases where already disconnected.
   * 
   * @example
   * ```typescript
   * await adapter.disconnect();
   * console.log('Disconnected from message broker');
   * ```
   */
  disconnect(): Promise<void>;

  /**
   * Publish an event to the distributed system
   * 
   * The adapter is responsible for:
   * - Serializing the event
   * - Publishing to appropriate channels/topics
   * - Handling transient failures with retries
   * 
   * @param event - The event to publish
   * @throws {Error} If publish fails after retries
   * 
   * @example
   * ```typescript
   * const event: BlaizeEvent = {
   *   type: 'user:created',
   *   data: { userId: '123' },
   *   timestamp: Date.now(),
   *   serverId: 'server-1',
   * };
   * 
   * await adapter.publish(event);
   * ```
   */
  publish(event: BlaizeEvent): Promise<void>;

  /**
   * Subscribe to events matching a pattern
   * 
   * The pattern format is adapter-specific:
   * - Redis: 'user:*' matches 'user:created', 'user:updated'
   * - RabbitMQ: Routing key patterns
   * - Custom: Regex or glob patterns
   * 
   * @param pattern - Event type pattern to match
   * @param handler - Function to call for matching events
   * @returns Unsubscribe function
   * 
   * @example
   * ```typescript
   * const unsubscribe = await adapter.subscribe(
   *   'user:*',
   *   async (event) => {
   *     console.log('User event:', event.type);
   *   }
   * );
   * 
   * // Later
   * unsubscribe();
   * ```
   */
  subscribe(pattern: string, handler: EventHandler): Promise<Unsubscribe>;

  /**
   * Check adapter health and connectivity
   * 
   * Optional method to verify the adapter is functioning correctly.
   * Used by monitoring systems and health check endpoints.
   * 
   * @returns Health status with optional message
   * 
   * @example Healthy adapter
   * ```typescript
   * const health = await adapter.healthCheck?.();
   * // { healthy: true }
   * ```
   * 
   * @example Unhealthy adapter
   * ```typescript
   * const health = await adapter.healthCheck?.();
   * // { healthy: false, message: 'Connection timeout' }
   * ```
   */
  healthCheck?(): Promise<{ healthy: boolean; message?: string }>;
}

/**
 * Main EventBus interface for event-driven communication
 * 
 * EventBus provides a publish-subscribe pattern for decoupled
 * communication within a BlaizeJS application.
 * 
 * Features:
 * - Type-safe event publishing and subscription
 * - Pattern-based routing (wildcards, regex)
 * - Optional distributed mode via adapters
 * - Automatic server identification
 * - Correlation ID propagation
 * 
 * @example Basic usage
 * ```typescript
 * import { createEventBus } from '@blaizejs/core';
 * 
 * const eventBus = createEventBus({ serverId: 'server-1' });
 * 
 * // Subscribe to events
 * const unsubscribe = eventBus.subscribe('user:created', async (event) => {
 *   console.log('New user:', event.data);
 *   await sendWelcomeEmail(event.data.email);
 * });
 * 
 * // Publish an event
 * await eventBus.publish('user:created', {
 *   userId: '123',
 *   email: 'user@example.com',
 * });
 * 
 * // Cleanup
 * unsubscribe();
 * ```
 * 
 * @example With adapter for distributed events
 * ```typescript
 * import { createEventBus } from '@blaizejs/core';
 * import { RedisEventBusAdapter } from '@blaizejs/adapter-redis';
 * 
 * const eventBus = createEventBus({ serverId: 'server-1' });
 * 
 * // Enable distributed mode
 * const adapter = new RedisEventBusAdapter({
 *   host: 'localhost',
 *   port: 6379,
 * });
 * 
 * await eventBus.setAdapter(adapter);
 * 
 * // Events now propagate across all servers
 * await eventBus.publish('cache:invalidate', { key: 'users' });
 * ```
 * 
 * @example Pattern matching
 * ```typescript
 * // Wildcard pattern
 * eventBus.subscribe('user:*', handler);
 * 
 * // Regex pattern
 * eventBus.subscribe(/^(user|admin):/, handler);
 * 
 * // Exact match
 * eventBus.subscribe('system:shutdown', handler);
 * ```
 * 
 * @see createEventBus
 * @see TypedEventBus
 */
export interface EventBus {
  /**
   * Publish an event to all matching subscribers
   * 
   * The event is delivered to:
   * - All local subscribers with matching patterns
   * - All remote subscribers (if adapter is set)
   * 
   * Publishing is fire-and-forget. If a handler throws,
   * the error is logged but doesn't fail the publish operation.
   * 
   * @param type - Event type identifier
   * @param data - Event data payload (optional)
   * @returns Promise that resolves when event is published
   * 
   * @example Publish with data
   * ```typescript
   * await eventBus.publish('user:created', {
   *   userId: '123',
   *   email: 'user@example.com',
   * });
   * ```
   * 
   * @example Publish without data
   * ```typescript
   * await eventBus.publish('system:ready');
   * ```
   * 
   * @example Publish with correlation ID
   * ```typescript
   * // Inside a route handler
   * async ({ ctx, eventBus }) => {
   *   await eventBus.publish('order:placed', 
   *     { orderId: '123' },
   *     ctx.correlationId
   *   );
   * }
   * ```
   */
  publish(type: string, data?: unknown): Promise<void>;

  /**
   * Subscribe to events matching a pattern
   * 
   * Patterns can be:
   * - Exact string: 'user:created'
   * - Wildcard: 'user:*' (matches user:created, user:updated, etc.)
   * - RegExp: /^user:/ (matches any event starting with 'user:')
   * 
   * The subscription is active immediately.
   * Handlers are called in the order they were registered.
   * 
   * @param pattern - Event type pattern (string or RegExp)
   * @param handler - Function to call for matching events
   * @returns Unsubscribe function
   * 
   * @example String pattern
   * ```typescript
   * const unsubscribe = eventBus.subscribe(
   *   'user:created',
   *   async (event) => {
   *     await sendWelcomeEmail(event.data.email);
   *   }
   * );
   * ```
   * 
   * @example Wildcard pattern
   * ```typescript
   * eventBus.subscribe('user:*', (event) => {
   *   console.log('User event:', event.type, event.data);
   * });
   * ```
   * 
   * @example RegExp pattern
   * ```typescript
   * eventBus.subscribe(/^(user|admin):created$/, (event) => {
   *   auditLog.record(event);
   * });
   * ```
   * 
   * @example Cleanup
   * ```typescript
   * const unsubscribe = eventBus.subscribe('data:updated', handler);
   * 
   * // Later
   * unsubscribe();
   * ```
   */
  subscribe(pattern: string | RegExp, handler: EventHandler): Unsubscribe;

  /**
   * Set or replace the distributed adapter
   * 
   * Enables cross-server event propagation.
   * Automatically connects the adapter.
   * 
   * If an adapter is already set, it will be disconnected first.
   * 
   * @param adapter - EventBusAdapter implementation
   * @returns Promise that resolves when adapter is connected
   * 
   * @example
   * ```typescript
   * import { RedisEventBusAdapter } from '@blaizejs/adapter-redis';
   * 
   * const adapter = new RedisEventBusAdapter({
   *   host: 'localhost',
   *   port: 6379,
   * });
   * 
   * await eventBus.setAdapter(adapter);
   * console.log('Distributed mode enabled');
   * ```
   */
  setAdapter(adapter: EventBusAdapter): Promise<void>;

  /**
   * Disconnect and cleanup
   * 
   * Disconnects the adapter (if set) and clears all subscriptions.
   * Should be called during server shutdown.
   * 
   * @returns Promise that resolves when cleanup is complete
   * 
   * @example
   * ```typescript
   * // During server shutdown
   * await eventBus.disconnect();
   * ```
   */
  disconnect(): Promise<void>;

  /**
   * Server ID for this EventBus instance
   * 
   * Used to:
   * - Identify event origin
   * - Prevent echo in distributed mode
   * - Debug event flow
   * 
   * Automatically set during EventBus creation.
   * 
   * @readonly
   * 
   * @example
   * ```typescript
   * console.log('Server ID:', eventBus.serverId);
   * // Output: 'server-1' or auto-generated UUID
   * ```
   */
  readonly serverId: string;
}