/**
 * Error Classes for Cache Plugin
 *
 * Custom error classes for cache-specific error conditions.
 * All errors extend BlaizeError for consistent error handling
 * across the BlaizeJS ecosystem.
 *
 * @module @blaizejs/plugin-cache/errors
 */

import { BlaizeError, ErrorType, getCorrelationId } from 'blaizejs';

import type {
  CacheConnectionErrorDetails,
  CacheOperationErrorDetails,
  CacheValidationErrorDetails,
} from './types';

// ============================================================================
// CacheConnectionError
// ============================================================================

/**
 * Error thrown when cache adapter connection fails
 *
 * Used when cache adapter cannot establish or maintain connection
 * to underlying storage (Redis, memory, etc.).
 *
 * **HTTP Status**: 503 Service Unavailable
 *
 * @example Redis connection failure
 * ```typescript
 * throw new CacheConnectionError('Redis connection failed', {
 *   adapter: 'RedisAdapter',
 *   host: 'localhost',
 *   port: 6379,
 *   reason: 'Connection timeout after 5s'
 * });
 * ```
 *
 * @example Generic connection failure
 * ```typescript
 * try {
 *   await redisClient.connect();
 * } catch (error) {
 *   throw new CacheConnectionError('Failed to connect to Redis', {
 *     adapter: 'RedisAdapter',
 *     host: config.host,
 *     port: config.port,
 *     originalError: error.message
 *   });
 * }
 * ```
 *
 * @example In adapter connect() method
 * ```typescript
 * class RedisAdapter implements CacheAdapter {
 *   async connect(): Promise<void> {
 *     try {
 *       await this.client.connect();
 *       await this.client.ping();
 *     } catch (error) {
 *       throw new CacheConnectionError(
 *         `Failed to connect to Redis at ${this.config.host}:${this.config.port}`,
 *         {
 *           adapter: 'RedisAdapter',
 *           host: this.config.host,
 *           port: this.config.port,
 *           reason: 'PING command failed',
 *           originalError: (error as Error).message
 *         }
 *       );
 *     }
 *   }
 * }
 * ```
 */
export class CacheConnectionError extends BlaizeError<CacheConnectionErrorDetails> {
  /**
   * Creates a new CacheConnectionError
   *
   * @param message - Human-readable error message
   * @param details - Additional error context
   * @param correlationId - Optional correlation ID (auto-generated if not provided)
   */
  constructor(message: string, details?: CacheConnectionErrorDetails, correlationId?: string) {
    super(
      ErrorType.INTERNAL_SERVER_ERROR,
      message,
      503, // Service Unavailable
      correlationId ?? getCorrelationId(),
      details
    );
    this.name = 'CacheConnectionError';
  }
}

// ============================================================================
// CacheOperationError
// ============================================================================

/**
 * Error thrown when a cache operation fails
 *
 * Used when cache operations (get, set, delete, etc.) fail due to
 * adapter errors, timeouts, or other operational issues.
 *
 * **HTTP Status**: 500 Internal Server Error
 *
 * @example Set operation failure
 * ```typescript
 * throw new CacheOperationError('Failed to set cache key', {
 *   operation: 'set',
 *   method: 'set',
 *   key: 'user:123',
 *   adapter: 'RedisAdapter',
 *   ttl: 3600
 * });
 * ```
 *
 * @example Get operation with error details
 * ```typescript
 * try {
 *   return await this.adapter.get(key);
 * } catch (error) {
 *   throw new CacheOperationError('Cache get operation failed', {
 *     operation: 'get',
 *     method: 'get',
 *     key,
 *     adapter: this.adapter.constructor.name,
 *     originalError: (error as Error).message
 *   });
 * }
 * ```
 *
 * @example Batch operation failure
 * ```typescript
 * try {
 *   await this.adapter.mset(entries);
 * } catch (error) {
 *   throw new CacheOperationError('Batch set operation failed', {
 *     operation: 'mset',
 *     method: 'mset',
 *     adapter: 'RedisAdapter',
 *     value: `${entries.length} entries`,
 *     originalError: (error as Error).message
 *   });
 * }
 * ```
 */
export class CacheOperationError extends BlaizeError<CacheOperationErrorDetails> {
  /**
   * Creates a new CacheOperationError
   *
   * @param message - Human-readable error message
   * @param details - Additional error context
   * @param correlationId - Optional correlation ID (auto-generated if not provided)
   */
  constructor(message: string, details?: CacheOperationErrorDetails, correlationId?: string) {
    super(
      ErrorType.INTERNAL_SERVER_ERROR,
      message,
      500, // Internal Server Error
      correlationId ?? getCorrelationId(),
      details
    );
    this.name = 'CacheOperationError';
  }
}

// ============================================================================
// CacheValidationError
// ============================================================================

/**
 * Error thrown when cache input validation fails
 *
 * Used when cache operations receive invalid input, such as:
 * - Invalid key format
 * - Invalid TTL value
 * - Missing required parameters
 * - Type mismatches
 *
 * **HTTP Status**: 400 Bad Request
 *
 * @example Invalid TTL
 * ```typescript
 * if (ttl !== undefined && (ttl < 0 || !Number.isFinite(ttl))) {
 *   throw new CacheValidationError('TTL must be a positive number', {
 *     field: 'ttl',
 *     expectedType: 'positive number',
 *     receivedType: typeof ttl,
 *     value: ttl,
 *     constraint: 'ttl >= 0 && finite'
 *   });
 * }
 * ```
 *
 * @example Empty key validation
 * ```typescript
 * if (!key || key.trim().length === 0) {
 *   throw new CacheValidationError('Cache key cannot be empty', {
 *     field: 'key',
 *     expectedType: 'non-empty string',
 *     receivedType: typeof key,
 *     value: key,
 *     constraint: 'key.length > 0'
 *   });
 * }
 * ```
 *
 * @example Type validation
 * ```typescript
 * if (typeof value !== 'string') {
 *   throw new CacheValidationError('Cache value must be a string', {
 *     operation: 'set',
 *     field: 'value',
 *     expectedType: 'string',
 *     receivedType: typeof value,
 *     constraint: 'typeof value === "string"'
 *   });
 * }
 * ```
 *
 * @example Handling validation errors
 * ```typescript
 * try {
 *   await cache.set('', 'value');
 * } catch (error) {
 *   if (error instanceof CacheValidationError) {
 *     console.error(`Validation failed for '${error.details.field}':`, error.title);
 *     console.error('Expected:', error.details.expectedType);
 *     console.error('Received:', error.details.receivedType);
 *   }
 * }
 * ```
 */
export class CacheValidationError extends BlaizeError<CacheValidationErrorDetails> {
  /**
   * Creates a new CacheValidationError
   *
   * @param message - Human-readable error message
   * @param details - Additional error context
   * @param correlationId - Optional correlation ID (auto-generated if not provided)
   */
  constructor(message: string, details?: CacheValidationErrorDetails, correlationId?: string) {
    super(
      ErrorType.VALIDATION_ERROR,
      message,
      400, // Bad Request
      correlationId ?? getCorrelationId(),
      details
    );
    this.name = 'CacheValidationError';
  }
}
