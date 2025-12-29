/**
 * TypedEventBus Implementation
 *
 * Type-safe wrapper around EventBus with runtime Zod validation.
 * Always validates on both publish and receive, with automatic field stripping.
 *
 * @module @blaizejs/core/events
 * @since 0.4.0
 */

import { z } from 'zod';

import { EventValidationError } from '../errors/event-validation-error';
import { createLogger } from '../logger';

import type {
  EventBus,
  EventSchemas,
  TypedEventBus,
  TypedEventBusOptions,
  BlaizeEvent,
  Unsubscribe,
  EventBusAdapter,
  BlaizeLogger,
  BlaizeError,
  EventValidationErrorDetails,
} from '@blaize-types';

/**
 * Internal configuration with resolved defaults
 */
interface ResolvedTypedEventBusOptions<TSchemas extends EventSchemas> {
  schemas: TSchemas;
  unknownEventBehavior: 'error' | 'warn' | 'allow';
  onValidationError?: (error: BlaizeError<EventValidationErrorDetails>) => void;
}

/**
 * TypedEventBusImpl - Private implementation of TypedEventBus
 *
 * Wraps a base EventBus with type-safe publish/subscribe and runtime
 * Zod validation. Always validates on both publish and receive.
 *
 * @template TSchemas - Event schema map
 */
class TypedEventBusImpl<TSchemas extends EventSchemas> implements TypedEventBus<TSchemas> {
  /**
   * Underlying EventBus instance
   */
  public readonly base: EventBus;

  /**
   * Event schemas for validation
   */
  private readonly schemas: TSchemas;

  /**
   * Resolved configuration options
   */
  private readonly options: ResolvedTypedEventBusOptions<TSchemas>;

  /**
   * Logger instance for warnings and errors
   */
  private readonly logger: BlaizeLogger;

  /**
   * Create a new TypedEventBusImpl instance
   *
   * @param base - Underlying EventBus instance
   * @param options - Configuration options
   * @param logger - Optional logger instance
   */
  constructor(base: EventBus, options: TypedEventBusOptions<TSchemas>, logger?: BlaizeLogger) {
    this.base = base;
    this.schemas = options.schemas;

    // Resolve options with defaults
    this.options = {
      schemas: options.schemas,
      unknownEventBehavior: options.unknownEventBehavior ?? 'warn',
      onValidationError: options.onValidationError,
    };

    // Create logger
    if (logger) {
      this.logger = logger.child({ component: 'TypedEventBus', serverId: base.serverId });
    } else {
      this.logger = createLogger().child({ component: 'TypedEventBus', serverId: base.serverId });
    }
  }

  /**
   * Publish a type-safe event with validation
   *
   * Always validates the event data against the schema before publishing.
   * Throws EventValidationError if validation fails.
   *
   * @template K - Event type key
   * @param type - Event type to publish
   * @param data - Event data (validated and transformed)
   * @returns Promise that resolves when event is published
   *
   * @throws {EventValidationError} If validation fails or unknown event (when configured)
   */
  async publish<K extends keyof TSchemas & string>(
    type: K,
    data: z.infer<TSchemas[K]>
  ): Promise<void> {
    // Validate and transform the data
    const validatedData = this.validateEvent(type, data, 'publish');

    // Publish to base EventBus with validated data
    await this.base.publish(type, validatedData);
  }

  /**
   * Subscribe to events with type-safe handler and validation
   *
   * Always validates received events against their schemas.
   * Invalid events are dropped (not passed to handler).
   *
   * @template TPattern - Pattern string type
   * @param pattern - Event type pattern to match
   * @param handler - Handler function with typed event data
   * @returns Unsubscribe function
   */
  subscribe<TPattern extends (keyof TSchemas & string) | '*' | `${string}:*`>(
    pattern: TPattern,
    handler: (event: BlaizeEvent<any>) => void | Promise<void>
  ): Unsubscribe {
    // Subscribe to base EventBus with validation wrapper
    return this.base.subscribe(pattern as string, async (event: BlaizeEvent) => {
      try {
        // Validate and transform the event data
        const validatedData = this.validateEvent(event.type, event.data, 'receive');

        // Create validated event with transformed data
        const validatedEvent: BlaizeEvent = {
          ...event,
          data: validatedData,
        };

        // Call handler with validated event
        await handler(validatedEvent);
      } catch (error) {
        // Validation failed on receive - drop event gracefully
        if (error instanceof EventValidationError) {
          this.logger.error('Receive validation failed, dropping event', {
            eventType: event.type,
            serverId: event.serverId,
            correlationId: event.correlationId,
            validationErrors: error.details?.zodError?.issues,
          });

          // Don't rethrow - drop event gracefully
          return;
        }

        // Other errors should be logged and rethrown
        this.logger.error('Handler error', {
          eventType: event.type,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        throw error;
      }
    });
  }

  /**
   * Set or replace the distributed adapter
   *
   * @param adapter - EventBusAdapter implementation
   * @returns Promise that resolves when adapter is connected
   */
  async setAdapter(adapter: EventBusAdapter): Promise<void> {
    await this.base.setAdapter(adapter);
  }

  /**
   * Disconnect and cleanup
   *
   * @returns Promise that resolves when cleanup is complete
   */
  async disconnect(): Promise<void> {
    await this.base.disconnect();
  }

  /**
   * Server ID for this EventBus instance
   */
  get serverId(): string {
    return this.base.serverId;
  }

  /**
   * Validate event data against schema
   *
   * Handles both known and unknown events based on configuration.
   * Always throws on publish, drops on receive.
   *
   * @param type - Event type
   * @param data - Event data to validate
   * @param context - Validation context ('publish' or 'receive')
   * @returns Validated and transformed data
   *
   * @throws {EventValidationError} If validation fails (publish) or unknown event (based on config)
   *
   * @private
   */
  private validateEvent(type: string, data: unknown, context: 'publish' | 'receive'): unknown {
    // Check if schema exists for this event type
    const schema = this.schemas[type];

    if (!schema) {
      // Unknown event - handle based on configuration
      return this.handleUnknownEvent(type, data, context);
    }

    // Validate with Zod
    try {
      // Parse with Zod - this will apply transforms, defaults, and strip extra fields
      const result = schema.parse(data);
      return result;
    } catch (error) {
      // Validation failed - create detailed error
      const validationError = new EventValidationError(`Event validation failed for "${type}"`, {
        eventType: type,
        context,
        zodError: error instanceof z.ZodError ? error : undefined,
        data,
      });

      // Call error callback if provided (before throwing/dropping)
      if (this.options.onValidationError) {
        this.options.onValidationError(validationError);
      }

      // Always throw - caller decides whether to rethrow or drop
      throw validationError;
    }
  }

  /**
   * Handle unknown event based on configuration
   *
   * @param type - Event type
   * @param data - Event data
   * @param context - Validation context
   * @returns Data (if allowed) or throws
   *
   * @throws {EventValidationError} If unknownEventBehavior is 'error'
   *
   * @private
   */
  private handleUnknownEvent(type: string, data: unknown, context: 'publish' | 'receive'): unknown {
    const behavior = this.options.unknownEventBehavior;

    if (behavior === 'error') {
      // Throw error for unknown event
      const error = new EventValidationError(`Unknown event type: "${type}"`, {
        eventType: type,
        context,
        data,
      });

      // Call error callback if provided
      if (this.options.onValidationError) {
        this.options.onValidationError(error);
      }

      throw error;
    }

    if (behavior === 'warn') {
      // Log warning and allow through
      this.logger.warn('Unknown event type, allowing through', {
        eventType: type,
        context,
      });
    }

    // 'allow' or 'warn' - pass through unvalidated
    return data;
  }
}

/**
 * Create a TypedEventBus wrapper around a base EventBus
 *
 * Provides compile-time and runtime type safety with Zod validation.
 * Always validates on both publish and receive.
 *
 * @template TSchemas - Event schema map
 * @param base - Base EventBus instance
 * @param options - Configuration options
 * @param logger - Optional logger instance
 * @returns TypedEventBus instance
 *
 * @example Basic usage
 * ```typescript
 * import { z } from 'zod';
 * import { createTypedEventBus, MemoryEventBus } from '@blaizejs/core';
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
 *
 * const baseBus = new MemoryEventBus('server-1');
 * const typedBus = createTypedEventBus(baseBus, { schemas });
 *
 * // Type-safe publish with validation
 * await typedBus.publish('user:created', {
 *   userId: '123',
 *   email: 'user@example.com',
 * });
 *
 * // Type-safe subscribe with validation
 * typedBus.subscribe('user:*', async (event) => {
 *   console.log('User event:', event.type, event.data);
 * });
 * ```
 *
 * @example With error handling
 * ```typescript
 * const typedBus = createTypedEventBus(baseBus, {
 *   schemas,
 *   unknownEventBehavior: 'error',
 *   onValidationError: (error) => {
 *     logger.error('Validation failed', { error });
 *     Sentry.captureException(error);
 *   },
 * });
 * ```
 */
export function createTypedEventBus<TSchemas extends EventSchemas>(
  base: EventBus,
  options: TypedEventBusOptions<TSchemas>,
  logger?: BlaizeLogger
): TypedEventBus<TSchemas> {
  return new TypedEventBusImpl(base, options, logger);
}
