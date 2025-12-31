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

import type { BlaizeError, EventValidationErrorDetails } from './errors';
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

// ============================================================================
// TypedEventBus Types
// ============================================================================

/**
 * Helper to determine which events match a given pattern
 *
 * Performs compile-time pattern matching to extract event types
 * that match a subscription pattern.
 *
 * Pattern matching rules:
 * - `*` matches all events
 * - `prefix:*` matches all events starting with `prefix:`
 * - Exact string matches only that event
 * - Non-matching patterns return `never`
 *
 * @template TSchemas - Event schema map
 * @template TPattern - Pattern string to match
 *
 * @example Match all events
 * ```typescript
 * type Schemas = {
 *   'user:created': z.ZodObject<...>;
 *   'user:updated': z.ZodObject<...>;
 *   'order:placed': z.ZodObject<...>;
 * };
 *
 * // Result: 'user:created' | 'user:updated' | 'order:placed'
 * type AllEvents = MatchingEvents<Schemas, '*'>;
 * ```
 *
 * @example Match namespace wildcard
 * ```typescript
 * // Result: 'user:created' | 'user:updated'
 * type UserEvents = MatchingEvents<Schemas, 'user:*'>;
 * ```
 *
 * @example Match exact event
 * ```typescript
 * // Result: 'user:created'
 * type ExactMatch = MatchingEvents<Schemas, 'user:created'>;
 * ```
 *
 * @example Deep nesting
 * ```typescript
 * type Schemas = {
 *   'a:b:c': z.ZodObject<...>;
 *   'a:b:d': z.ZodObject<...>;
 *   'a:x:y': z.ZodObject<...>;
 * };
 *
 * // Result: 'a:b:c' | 'a:b:d'
 * type DeepMatch = MatchingEvents<Schemas, 'a:b:*'>;
 * ```
 *
 * @example No match
 * ```typescript
 * // Result: never
 * type NoMatch = MatchingEvents<Schemas, 'nonexistent:*'>;
 * ```
 */
export type MatchingEvents<TSchemas extends EventSchemas, TPattern extends string> =
  // Match all events with '*'
  TPattern extends '*'
    ? keyof TSchemas
    : // Match wildcard patterns like 'prefix:*'
      TPattern extends `${infer Prefix}:*`
      ? Extract<keyof TSchemas, `${Prefix}:${string}`>
      : // Match exact event type
        TPattern extends keyof TSchemas
        ? TPattern
        : // No match
          never;

/**
 * Helper to extract a union of data types from matching events
 *
 * Takes a pattern and returns a union type of all event data types
 * that match that pattern. Uses Zod's type inference to extract
 * the TypeScript types from schemas.
 *
 * @template TSchemas - Event schema map
 * @template TPattern - Pattern string to match
 *
 * @example Single event type
 * ```typescript
 * type Schemas = {
 *   'user:created': z.ZodObject<{ userId: z.ZodString }>;
 * };
 *
 * // Result: { userId: string }
 * type UserCreatedData = EventDataUnion<Schemas, 'user:created'>;
 * ```
 *
 * @example Union of multiple event types
 * ```typescript
 * type Schemas = {
 *   'user:created': z.ZodObject<{ userId: z.ZodString }>;
 *   'user:updated': z.ZodObject<{ userId: z.ZodString; email: z.ZodString }>;
 * };
 *
 * // Result: { userId: string } | { userId: string; email: string }
 * type UserEventData = EventDataUnion<Schemas, 'user:*'>;
 * ```
 *
 * @example All events
 * ```typescript
 * type Schemas = {
 *   'user:created': z.ZodObject<{ userId: z.ZodString }>;
 *   'order:placed': z.ZodObject<{ orderId: z.ZodString }>;
 * };
 *
 * // Result: { userId: string } | { orderId: string }
 * type AllEventData = EventDataUnion<Schemas, '*'>;
 * ```
 *
 * @example No matching events
 * ```typescript
 * // Result: never
 * type NoData = EventDataUnion<Schemas, 'nonexistent:*'>;
 * ```
 */
export type EventDataUnion<TSchemas extends EventSchemas, TPattern extends string> =
  MatchingEvents<TSchemas, TPattern> extends never
    ? never
    : TSchemas[MatchingEvents<TSchemas, TPattern>] extends z.ZodType<infer T>
      ? T
      : never;

/**
 * Type-safe EventBus wrapper with Zod schema validation
 *
 * Provides compile-time and runtime type safety for event publishing
 * and subscription. All event types and data shapes are validated
 * against the provided Zod schemas.
 *
 * Features:
 * - Type-safe publish: Only known events with correct data types
 * - Type-safe subscribe: Handlers receive correctly typed event data
 * - Pattern matching: Wildcard support with type inference
 * - Runtime validation: Optional Zod validation on publish/receive
 * - Error handling: Configurable validation error behavior
 *
 * @template TSchemas - Map of event types to Zod schemas
 *
 * @example Basic usage
 * ```typescript
 * import { z } from 'zod';
 * import { createTypedEventBus } from '@blaizejs/core';
 *
 * const schemas = {
 *   'user:created': z.object({
 *     userId: z.string().uuid(),
 *     email: z.string().email(),
 *   }),
 *   'user:updated': z.object({
 *     userId: z.string().uuid(),
 *     email: z.string().email(),
 *   }),
 *   'order:placed': z.object({
 *     orderId: z.string(),
 *     total: z.number().positive(),
 *   }),
 * } satisfies EventSchemas;
 *
 * const typedBus = createTypedEventBus(baseBus, { schemas });
 *
 * // Type-safe publish
 * await typedBus.publish('user:created', {
 *   userId: '123',
 *   email: 'user@example.com',
 * });
 *
 * // TypeScript error: wrong data type
 * await typedBus.publish('user:created', {
 *   userId: 123, // Error: should be string
 * });
 *
 * // TypeScript error: unknown event
 * await typedBus.publish('unknown:event', {}); // Error
 * ```
 *
 * @example Pattern-based subscriptions
 * ```typescript
 * // Subscribe to all user events
 * typedBus.subscribe('user:*', async (event) => {
 *   // event.data is { userId: string; email: string }
 *   // (union of user:created and user:updated)
 *   console.log('User event:', event.type, event.data.userId);
 * });
 *
 * // Subscribe to specific event
 * typedBus.subscribe('order:placed', async (event) => {
 *   // event.data is { orderId: string; total: number }
 *   await processOrder(event.data.orderId);
 * });
 *
 * // Subscribe to all events
 * typedBus.subscribe('*', async (event) => {
 *   // event.data is union of all event data types
 *   auditLog.record(event);
 * });
 * ```
 *
 * @example With validation
 * ```typescript
 * const typedBus = createTypedEventBus(baseBus, {
 *   schemas,
 *   unknownEventBehavior: 'warn',
 *   onValidationError: (error) => {
 *     logger.error('Validation failed', { error });
 *   },
 * });
 *
 * // Validation always runs on publish
 * try {
 *   await typedBus.publish('user:created', {
 *     userId: 'invalid-uuid', // Fails UUID validation
 *   });
 * } catch (error) {
 *   // EventValidationError thrown
 * }
 *
 * // Validation always runs on receive (invalid events dropped)
 * typedBus.subscribe('user:created', async (event) => {
 *   // Only valid events reach this handler
 *   // Extra fields are stripped automatically
 * });
 * ```
 *
 * @see createTypedEventBus
 * @see EventSchemas
 * @see TypedEventBusOptions
 */
export interface TypedEventBus<TSchemas extends EventSchemas> {
  /**
   * Publish a type-safe event
   *
   * Only allows publishing events that exist in the schema map,
   * and the data must match the schema's inferred type.
   *
   * **Validation**: The data is always validated against the Zod
   * schema at runtime. Extra fields are stripped automatically (Zod's
   * default `.strip()` behavior).
   *
   * @template K - Event type (must be a key in TSchemas)
   * @param type - Event type to publish
   * @param data - Event data matching the schema's type
   * @returns Promise that resolves when event is published
   *
   * @throws {EventValidationError} If validation fails
   *
   * @example
   * ```typescript
   * await typedBus.publish('user:created', {
   *   userId: '123',
   *   email: 'user@example.com',
   * });
   * ```
   *
   * @example Extra fields are stripped
   * ```typescript
   * await typedBus.publish('user:created', {
   *   userId: '123',
   *   email: 'user@example.com',
   *   extraField: 'ignored', // Stripped automatically
   * });
   * ```
   */
  publish<K extends keyof TSchemas & string>(type: K, data: z.input<TSchemas[K]>): Promise<void>;

  /**
   * Subscribe to events matching a pattern with type-safe handlers
   *
   * Supports exact matches, namespace wildcards (`prefix:*`),
   * and all events (`*`). The handler receives events with
   * correctly typed data based on the pattern.
   *
   * @template TPattern - Pattern string (event type, wildcard, or '*')
   * @param pattern - Event type pattern to match
   * @param handler - Handler function with typed event data
   * @returns Unsubscribe function
   *
   * @example Exact match
   * ```typescript
   * typedBus.subscribe('user:created', async (event) => {
   *   // event.data is { userId: string; email: string }
   *   await sendWelcomeEmail(event.data.email);
   * });
   * ```
   *
   * @example Wildcard pattern
   * ```typescript
   * typedBus.subscribe('user:*', async (event) => {
   *   // event.data is union of all user:* event data types
   *   if (event.type === 'user:created') {
   *     // Type narrowing works here
   *   }
   * });
   * ```
   *
   * @example All events
   * ```typescript
   * typedBus.subscribe('*', async (event) => {
   *   // event.data is union of all event data types
   *   auditLog.record(event);
   * });
   * ```
   */
  subscribe<TPattern extends (keyof TSchemas & string) | '*' | `${string}:*`>(
    pattern: TPattern,
    handler: (event: BlaizeEvent<EventDataUnion<TSchemas, TPattern>>) => void | Promise<void>
  ): Unsubscribe;

  /**
   * Set or replace the distributed adapter
   *
   * @param adapter - EventBusAdapter implementation
   * @returns Promise that resolves when adapter is connected
   *
   * @see EventBus.setAdapter
   */
  setAdapter(adapter: EventBusAdapter): Promise<void>;

  /**
   * Disconnect and cleanup
   *
   * @returns Promise that resolves when cleanup is complete
   *
   * @see EventBus.disconnect
   */
  disconnect(): Promise<void>;

  /**
   * Server ID for this EventBus instance
   *
   * @readonly
   * @see EventBus.serverId
   */
  readonly serverId: string;

  /**
   * Reference to the underlying EventBus
   *
   * Provides access to the base EventBus for advanced use cases
   * or when you need to bypass type safety temporarily.
   *
   * @readonly
   *
   * @example
   * ```typescript
   * // Access base bus for untyped operations
   * typedBus.base.publish('dynamic:event', dynamicData);
   * ```
   */
  readonly base: EventBus;
}

/**
 * Configuration options for TypedEventBus
 *
 * Controls validation behavior, error handling, and how
 * unknown events are processed.
 *
 * **Validation Philosophy**: TypedEventBus always validates on both
 * publish and receive. Zod's default `.strip()` behavior automatically
 * removes extra fields, making this safe for rolling deployments with
 * schema changes.
 *
 * @template TSchemas - Event schema map
 *
 * @example Basic usage
 * ```typescript
 * const options: TypedEventBusOptions<typeof schemas> = {
 *   schemas,
 * };
 * ```
 *
 * @example Strict unknown event handling
 * ```typescript
 * const options: TypedEventBusOptions<typeof schemas> = {
 *   schemas,
 *   unknownEventBehavior: 'error',
 * };
 * ```
 *
 * @example Custom error handling
 * ```typescript
 * const options: TypedEventBusOptions<typeof schemas> = {
 *   schemas,
 *   onValidationError: (error) => {
 *     logger.error('Event validation failed', {
 *       eventType: error.details.eventType,
 *       errors: error.details.errors,
 *     });
 *     // Send to monitoring service
 *     monitoring.trackError(error);
 *   },
 * };
 * ```
 */
export interface TypedEventBusOptions<TSchemas extends EventSchemas> {
  /**
   * Event schema map
   *
   * Maps event type strings to Zod schemas that define
   * the shape and validation rules for each event's data.
   *
   * **Important**: Schemas are automatically configured to strip
   * extra fields (Zod's default behavior), making them safe for
   * rolling deployments where old services may send extra fields.
   *
   * @example
   * ```typescript
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
   */
  schemas: TSchemas;

  /**
   * How to handle events not defined in schemas
   *
   * - `'error'`: Throw EventValidationError
   * - `'warn'`: Log warning and allow through (default)
   * - `'allow'`: Silently allow through
   *
   * **Note**: This only affects unknown event types, not validation
   * failures of known events (which always throw on publish and drop
   * on receive).
   *
   * @default 'warn'
   *
   * @example Error on unknown events
   * ```typescript
   * const options = {
   *   schemas,
   *   unknownEventBehavior: 'error' as const,
   * };
   *
   * // Publishing unknown event throws
   * await typedBus.publish('unknown:event', {}); // Throws
   * ```
   *
   * @example Warn on unknown events (default)
   * ```typescript
   * const options = {
   *   schemas,
   *   unknownEventBehavior: 'warn' as const,
   * };
   *
   * // Logs warning but continues
   * await typedBus.publish('unknown:event', {}); // Logs + allows
   * ```
   *
   * @example Allow unknown events silently
   * ```typescript
   * const options = {
   *   schemas,
   *   unknownEventBehavior: 'allow' as const,
   * };
   *
   * // Passes through without validation
   * await typedBus.publish('unknown:event', {}); // Passes through
   * ```
   */
  unknownEventBehavior?: 'error' | 'warn' | 'allow';

  /**
   * Custom validation error handler
   *
   * Called when validation fails (on publish or receive) or when
   * unknown events are encountered. Invoked before throwing (publish)
   * or dropping (receive) the event.
   *
   * **Use cases**:
   * - Custom logging
   * - Monitoring and alerting
   * - Error tracking services
   *
   * @param error - The validation error (BlaizeError with EventValidationErrorDetails)
   *
   * @example
   * ```typescript
   * const options = {
   *   schemas,
   *   onValidationError: (error) => {
   *     console.error('Validation error:', error.message);
   *     console.error('Event type:', error.details?.eventType);
   *     console.error('Context:', error.details?.context);
   *     console.error('Validation errors:', error.details?.zodError?.issues);
   *
   *     // Send to error tracking service
   *     Sentry.captureException(error);
   *   },
   * };
   * ```
   */
  onValidationError?: (error: BlaizeError<EventValidationErrorDetails>) => void;
}

/**
 * Subscription entry tracking pattern and handler
 */
export interface Subscription {
  /** Unique ID for this subscription */
  id: string;
  /** Pattern to match against event types */
  pattern: string | RegExp;
  /** Compiled regex for matching (cached) */
  matcher: RegExp;
  /** Handler function to call for matching events */
  handler: EventHandler;
}
