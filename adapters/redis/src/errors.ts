/**
 * Redis Adapter Error Types
 *
 * Custom error classes for Redis operations, connection failures,
 * and circuit breaker states. All errors extend BlaizeError for
 * consistent error handling across the framework.
 *
 * @module @blaizejs/adapter-redis/errors
 * @since 0.1.0
 */

import { randomUUID } from 'node:crypto';

import { ErrorType, BlaizeError } from 'blaizejs';

import type {
  CircuitBreakerErrorDetails,
  RedisConnectionErrorDetails,
  RedisOperationErrorDetails,
} from './types';

/**
 * Error thrown when Redis connection fails
 *
 * This error indicates that the adapter could not establish or maintain
 * a connection to the Redis server. Common causes include network issues,
 * authentication failures, or Redis server being down.
 *
 * @example Basic usage
 * ```typescript
 * throw new RedisConnectionError('Failed to connect to Redis', {
 *   host: 'localhost',
 *   port: 6379,
 *   reason: 'CONNECTION_REFUSED',
 *   originalError: error.message,
 * });
 * ```
 *
 * @example With correlation ID
 * ```typescript
 * throw new RedisConnectionError(
 *   'Redis authentication failed',
 *   {
 *     host: 'redis.example.com',
 *     port: 6379,
 *     reason: 'AUTH_FAILED',
 *   },
 *   correlationId
 * );
 * ```
 */
export class RedisConnectionError extends BlaizeError<RedisConnectionErrorDetails> {
  /**
   * Create a new RedisConnectionError
   *
   * @param message - Human-readable error message
   * @param details - Connection error details
   * @param correlationId - Optional correlation ID for tracing
   */
  constructor(message: string, details: RedisConnectionErrorDetails, correlationId?: string) {
    // Truncate originalError if it's very long (>1000 chars)
    const truncatedDetails = {
      ...details,
      originalError: details.originalError
        ? details.originalError.length > 1000
          ? details.originalError.substring(0, 1000) + '... (truncated)'
          : details.originalError
        : undefined,
    };

    super(
      ErrorType.INTERNAL_SERVER_ERROR,
      message,
      500,
      correlationId ?? randomUUID(),
      truncatedDetails
    );
  }
}

/**
 * Error thrown when a Redis operation fails
 *
 * This error indicates that a specific Redis command failed to execute.
 * The operation type and key are included in the details to help with
 * debugging and monitoring.
 *
 * @example Basic usage
 * ```typescript
 * throw new RedisOperationError('GET operation failed', {
 *   operation: 'GET',
 *   key: 'user:123',
 *   originalError: error.message,
 * });
 * ```
 *
 * @example Publish operation failure
 * ```typescript
 * throw new RedisOperationError('Failed to publish event', {
 *   operation: 'PUBLISH',
 *   key: 'events:user-created',
 *   originalError: error.message,
 * });
 * ```
 */
export class RedisOperationError extends BlaizeError<RedisOperationErrorDetails> {
  /**
   * Create a new RedisOperationError
   *
   * @param message - Human-readable error message
   * @param details - Operation error details
   * @param correlationId - Optional correlation ID for tracing
   */
  constructor(message: string, details: RedisOperationErrorDetails, correlationId?: string) {
    // Truncate originalError if it's very long (>1000 chars)
    const truncatedDetails = {
      ...details,
      originalError: details.originalError
        ? details.originalError.length > 1000
          ? details.originalError.substring(0, 1000) + '... (truncated)'
          : details.originalError
        : undefined,
    };

    super(
      ErrorType.INTERNAL_SERVER_ERROR,
      message,
      500,
      correlationId ?? randomUUID(),
      truncatedDetails
    );
  }
}

/**
 * Error thrown when circuit breaker is open
 *
 * This error indicates that the circuit breaker has detected too many
 * failures and is preventing further requests to protect the system.
 * The circuit will automatically attempt to close after the reset timeout.
 *
 * @example Basic usage
 * ```typescript
 * throw new CircuitBreakerOpenError('Circuit breaker is open', {
 *   state: 'OPEN',
 *   failures: 5,
 *   lastFailure: new Date(),
 *   resetTimeout: 30000,
 * });
 * ```
 *
 * @example In HALF_OPEN state
 * ```typescript
 * throw new CircuitBreakerOpenError('Circuit breaker test call failed', {
 *   state: 'HALF_OPEN',
 *   failures: 1,
 *   resetTimeout: 30000,
 * });
 * ```
 */
export class CircuitBreakerOpenError extends BlaizeError<CircuitBreakerErrorDetails> {
  /**
   * Create a new CircuitBreakerOpenError
   *
   * Note: CircuitBreakerOpenError does not accept a correlationId parameter
   * because circuit breaker errors are not tied to specific requests.
   *
   * @param message - Human-readable error message
   * @param details - Circuit breaker state details
   */
  constructor(message: string, details: CircuitBreakerErrorDetails) {
    super(ErrorType.SERVICE_UNAVAILABLE, message, 503, randomUUID(), details);
  }
}
