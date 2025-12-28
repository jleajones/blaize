/**
 * Code to append to packages/blaize-types/src/errors.ts
 *
 * Add this after the existing error class definitions
 * Also add: import type { z } from 'zod'; at the top with other imports
 */

import { BlaizeError, ErrorType } from '@blaize-types/errors';

import type { EventValidationErrorDetails } from '@blaize-types/errors';

/**
 * Error thrown when event validation fails in TypedEventBus
 *
 * This error is thrown by TypedEventBus when:
 * - Publishing an event with invalid data (if validateOnPublish is true)
 * - Receiving an event with invalid data (if validateOnReceive is true)
 * - Encountering an unknown event type (if unknownEventBehavior is 'error')
 *
 * **HTTP Status**: 400 Bad Request
 *
 * @example Publishing with invalid data
 * ```typescript
 * const schemas = {
 *   'user:created': z.object({
 *     userId: z.string().uuid(),
 *     email: z.string().email(),
 *   }),
 * };
 *
 * const typedBus = createTypedEventBus(baseBus, {
 *   schemas,
 *   validateOnPublish: true,
 * });
 *
 * try {
 *   await typedBus.publish('user:created', {
 *     userId: 'not-a-uuid',
 *     email: 'invalid-email',
 *   });
 * } catch (error) {
 *   if (error instanceof EventValidationError) {
 *     console.error('Event type:', error.details.eventType);
 *     console.error('Context:', error.details.context);
 *     console.error('Zod errors:', error.details.zodError?.issues);
 *   }
 * }
 * ```
 *
 * @example Receiving invalid event from distributed adapter
 * ```typescript
 * const typedBus = createTypedEventBus(baseBus, {
 *   schemas,
 *   validateOnReceive: true,
 *   onValidationError: (error) => {
 *     logger.error('Received invalid event', {
 *       eventType: error.details.eventType,
 *       context: error.details.context,
 *       issues: error.details.zodError?.issues,
 *     });
 *   },
 * });
 * ```
 *
 * @example Unknown event type
 * ```typescript
 * const typedBus = createTypedEventBus(baseBus, {
 *   schemas,
 *   unknownEventBehavior: 'error',
 * });
 *
 * try {
 *   await typedBus.publish('unknown:event', { data: 'test' });
 * } catch (error) {
 *   if (error instanceof EventValidationError) {
 *     console.error('Unknown event type:', error.details.eventType);
 *   }
 * }
 * ```
 */

export class EventValidationError extends BlaizeError<EventValidationErrorDetails> {
  /**
   * Creates a new EventValidationError
   *
   * @param message - Human-readable error message
   * @param details - Structured validation error details
   * @param correlationId - Optional correlation ID (auto-generated if not provided)
   *
   * @example
   * ```typescript
   * throw new EventValidationError(
   *   'Event validation failed',
   *   {
   *     eventType: 'user:created',
   *     context: 'publish',
   *     zodError: zodError,
   *     data: invalidData,
   *   },
   *   ctx.correlationId
   * );
   * ```
   */
  constructor(message: string, details: EventValidationErrorDetails, correlationId?: string) {
    super(
      ErrorType.VALIDATION_ERROR,
      message,
      400, // Bad Request
      correlationId ?? crypto.randomUUID(),
      details
    );
    this.name = 'EventValidationError';
  }

  /**
   * Serializes the error to a plain object suitable for HTTP responses
   *
   * Overrides the base toJSON() to safely serialize Zod errors,
   * preventing circular references and large error objects.
   *
   * @returns Object representation of the error
   */
  toJSON() {
    const base = {
      type: this.type,
      title: this.title,
      status: this.status,
      correlationId: this.correlationId,
      timestamp: this.timestamp.toISOString(),
    };

    if (this.details) {
      const safeDetails: Record<string, unknown> = {
        eventType: this.details.eventType,
        context: this.details.context,
      };

      // Safely serialize Zod error to avoid circular references
      if (this.details.zodError) {
        safeDetails.errors = this.details.zodError.issues.map(issue => ({
          path: issue.path.join('.'),
          message: issue.message,
          code: issue.code,
        }));
      }

      // Include data if present (be careful with sensitive data)
      if (this.details.data !== undefined) {
        safeDetails.data = this.details.data;
      }

      return { ...base, details: safeDetails };
    }

    return base;
  }

  /**
   * Returns a string representation of the error
   *
   * Includes event type and context for easier debugging
   *
   * @example
   * ```typescript
   * error.toString();
   * // "EventValidationError: Event validation failed for 'user:created' during publish [req_123]"
   * ```
   */
  toString(): string {
    const context = this.details?.context ? ` during ${this.details.context}` : '';
    const eventType = this.details?.eventType ? ` for '${this.details.eventType}'` : '';
    return `${this.name}: ${this.title}${eventType}${context} [${this.correlationId}]`;
  }
}
