/**
 * Redis adapter error types
 *
 * This module will be implemented in Task T3.2
 */

import { BlaizeError, ErrorType, getCorrelationId } from 'blaizejs';

export interface RedisConnectionErrorDetails {
  host: string;
  port: number;
  originalError?: string;
}

export interface RedisOperationErrorDetails {
  operation: string;
  key?: string;
  originalError?: string;
}

export interface CircuitBreakerOpenErrorDetails {
  state: string;
  failureCount: number;
  threshold: number;
}

/**
 * Error thrown when Redis connection fails
 */
export class RedisConnectionError extends BlaizeError<RedisConnectionErrorDetails> {
  constructor(message: string, details: RedisConnectionErrorDetails, correlationId?: string) {
    super(
      ErrorType.INTERNAL_SERVER_ERROR,
      message,
      500,
      correlationId ?? getCorrelationId(),
      details
    );
  }
}

/**
 * Error thrown when Redis operation fails
 */
export class RedisOperationError extends BlaizeError<RedisOperationErrorDetails> {
  constructor(message: string, details: RedisOperationErrorDetails, correlationId?: string) {
    super(
      ErrorType.INTERNAL_SERVER_ERROR,
      message,
      500,
      correlationId ?? getCorrelationId(),
      details
    );
  }
}

/**
 * Error thrown when circuit breaker is open
 */
export class CircuitBreakerOpenError extends BlaizeError<CircuitBreakerOpenErrorDetails> {
  constructor(message: string, details: CircuitBreakerOpenErrorDetails, correlationId?: string) {
    super(
      ErrorType.SERVICE_UNAVAILABLE,
      message,
      503,
      correlationId ?? getCorrelationId(),
      details
    );
  }
}
