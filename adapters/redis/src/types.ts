import type { BlaizeLogger } from 'blaizejs';
import type { Redis } from 'ioredis';

export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

/**
 * Configuration options for circuit breaker
 */
export interface CircuitBreakerConfig {
  /** Number of consecutive failures before opening circuit (default: 5) */
  failureThreshold?: number;

  /** Time in milliseconds before attempting to close from OPEN state (default: 30000) */
  resetTimeout?: number;

  /** Number of consecutive successes in HALF_OPEN to close circuit (default: 1) */
  successThreshold?: number;

  /** Callback invoked when circuit transitions to OPEN state */
  onOpen?: () => void;

  /** Callback invoked when circuit transitions to CLOSED state */
  onClose?: () => void;

  /** Callback invoked when circuit transitions to HALF_OPEN state */
  onHalfOpen?: () => void;

  /** Optional logger instance for logging state transitions and errors */
  logger?: BlaizeLogger;
}

/**
 * Circuit breaker interface
 */
export interface CircuitBreaker {
  /** Current state of the circuit breaker */
  readonly state: CircuitState;

  /**
   * Execute a function with circuit breaker protection
   *
   * @param fn - Async function to execute
   * @returns Promise resolving to function result
   * @throws {CircuitBreakerOpenError} When circuit is OPEN or HALF_OPEN with test in progress
   */
  execute<T>(fn: () => Promise<T>): Promise<T>;

  /** Manually open the circuit */
  open(): void;

  /** Manually close the circuit */
  close(): void;

  /** Get current circuit breaker statistics */
  getStats(): CircuitBreakerStats;
}

/**
 * Circuit breaker statistics
 */
export interface CircuitBreakerStats {
  /** Current state */
  state: CircuitState;

  /** Number of consecutive failures */
  failures: number;

  /** Number of consecutive successes (in HALF_OPEN state) */
  successes: number;

  /** Timestamp of last failure */
  lastFailure?: Date;

  /** Timestamp of last success */
  lastSuccess?: Date;
}

/**
 * Details for circuit breaker open errors
 *
 * Provides information about the circuit breaker state and failure history
 * to help with debugging and monitoring.
 */
export interface CircuitBreakerErrorDetails {
  /** Current state of the circuit breaker */
  state: CircuitBreakerState;

  /** Number of consecutive failures that opened the circuit */
  failures: number;

  /** Timestamp of the last failure (if available) */
  lastFailure?: Date;

  /** Time in milliseconds until circuit attempts to close */
  resetTimeout: number;
}

/**
 * Circuit breaker state type
 *
 * Imported from circuit-breaker.ts to avoid circular dependency.
 * This will be properly exported from circuit-breaker.ts in Task T3.3.
 */
export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface RedisCacheAdapterOptions {
  prefix?: string;
  defaultTTL?: number;
}

/**
 * Redis client configuration
 */
export interface RedisClientConfig {
  /** Redis server hostname */
  host: string;

  /** Redis server port (default: 6379) */
  port?: number;

  /** Redis authentication password */
  password?: string;

  /** Redis database number (default: 0) */
  db?: number;

  /** Key prefix for all Redis keys */
  keyPrefix?: string;

  /** Connection timeout in milliseconds (default: 10000) */
  connectTimeout?: number;

  /** Command timeout in milliseconds (default: 5000) */
  commandTimeout?: number;

  /** Maximum retries per request (default: 3) */
  maxRetriesPerRequest?: number;

  /** Enable TLS/SSL connection */
  tls?: boolean;

  /** Custom retry strategy function */
  retryStrategy?: (times: number) => number | null;

  /** Optional logger instance */
  logger?: BlaizeLogger;
}

/**
 * Redis client interface
135 *
136 * Manages three separate Redis connections:
137 * - Main connection for data operations
 * - Publisher connection for pub/sub publishing
 * - Subscriber connection for pub/sub subscribing
 */
export interface RedisClient {
  /**
   * Get the main Redis connection for data operations
   */
  getConnection(): Redis;

  /**
   * Get the publisher connection for pub/sub publishing
   */
  getPublisher(): Redis;

  /**
   * Get the subscriber connection for pub/sub subscribing
   */
  getSubscriber(): Redis;

  /**
   * Connect all three Redis connections
   */
  connect(): Promise<void>;

  /**
   * Disconnect all three Redis connections gracefully
   */
  disconnect(): Promise<void>;

  /**
   * Perform health check by pinging Redis
   *
   * @returns Health status with optional latency measurement
   */
  healthCheck(): Promise<{ healthy: boolean; message?: string; latency?: number }>;

  /**
   * Check if all connections are currently connected
   */
  isConnected(): boolean;

  /**
   * Get the current configuration
   */
  getConfig(): RedisClientConfig;
}

/**
 * Details for Redis operation errors
 *
 * Provides context about which Redis operation failed and on which key.
 */
export interface RedisOperationErrorDetails {
  /** Redis command that failed */
  operation:
    | 'GET'
    | 'SET'
    | 'DEL'
    | 'MGET'
    | 'MSET'
    | 'PUBLISH'
    | 'SUBSCRIBE'
    | 'LPUSH'
    | 'RPOP'
    | 'ZADD'
    | 'ZRANGE'
    | 'EVALSHA';

  /** Redis key that was being operated on (if applicable) */
  key?: string;

  /** Original error message from ioredis (truncated if very long) */
  originalError?: string;
}

/**
 * Details for Redis connection errors
 *
 * Provides actionable information about connection failures including
 * the specific reason and connection parameters.
 */
export interface RedisConnectionErrorDetails {
  /** Redis server hostname */
  host: string;

  /** Redis server port */
  port: number;

  /** Specific reason for connection failure */
  reason: 'CONNECTION_REFUSED' | 'TIMEOUT' | 'AUTH_FAILED' | 'UNKNOWN';

  /** Original error message from ioredis (truncated if very long) */
  originalError?: string;
}

/**
 * Details for Redis operation errors
 *
 * Provides context about which Redis operation failed and on which key.
 */
export interface RedisOperationErrorDetails {
  /** Redis command that failed */
  operation:
    | 'GET'
    | 'SET'
    | 'DEL'
    | 'MGET'
    | 'MSET'
    | 'PUBLISH'
    | 'SUBSCRIBE'
    | 'LPUSH'
    | 'RPOP'
    | 'ZADD'
    | 'ZRANGE'
    | 'EVALSHA';

  /** Redis key that was being operated on (if applicable) */
  key?: string;

  /** Original error message from ioredis (truncated if very long) */
  originalError?: string;
}

/**
 * Details for circuit breaker open errors
 *
 * Provides information about the circuit breaker state and failure history
 * to help with debugging and monitoring.
 */
export interface CircuitBreakerErrorDetails {
  /** Current state of the circuit breaker */
  state: CircuitState;

  /** Number of consecutive failures that opened the circuit */
  failures: number;

  /** Timestamp of the last failure (if available) */
  lastFailure?: Date;

  /** Time in milliseconds until circuit attempts to close */
  resetTimeout: number;
}
