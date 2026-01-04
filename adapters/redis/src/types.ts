import type { BlaizeLogger, EventHandler } from 'blaizejs';
import type { Redis } from 'ioredis';

export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export type RedisCommand =
  | 'GET'
  | 'SET'
  | 'SETEX'
  | 'DEL'
  | 'MGET'
  | 'MSET'
  | 'HSET'
  | 'HGETALL'
  | 'PUBLISH'
  | 'SUBSCRIBE'
  | 'LPUSH'
  | 'RPOP'
  | 'ZADD'
  | 'ZRANGE'
  | 'ZCARD'
  | 'ZREM'
  | 'EVALSHA';

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
  operation: RedisCommand;

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

/**
 * Options for RedisEventBusAdapter
 */
export interface RedisEventBusAdapterOptions {
  /** Channel prefix for Redis pub/sub (default: 'blaize:events') */
  channelPrefix?: string;

  /** Circuit breaker configuration */
  circuitBreaker?: CircuitBreakerConfig;

  /** Optional logger instance */
  logger?: BlaizeLogger;
}

/**
 * Options for RedisCacheAdapter
 */
export interface RedisCacheAdapterOptions {
  /** Key prefix for all cache keys (default: 'cache:') */
  keyPrefix?: string;

  /** Optional logger instance */
  logger?: BlaizeLogger;
}

/**
 * Options for RedisQueueAdapter
 */
export interface RedisQueueAdapterOptions {
  /** Key prefix for all queue keys (default: 'queue:') */
  keyPrefix?: string;

  /** Optional logger instance */
  logger?: BlaizeLogger;
}

/**
 * Subscription tracking entry
 */
export interface SubscriptionEntry {
  pattern: string;
  handler: EventHandler;
  redisPattern: string;
}

/**
 * Options for RedisEventBusAdapter
 */
export interface RedisEventBusAdapterOptions {
  /** Channel prefix for Redis pub/sub (default: 'blaize:events') */
  channelPrefix?: string;

  /** Circuit breaker configuration */
  circuitBreaker?: CircuitBreakerConfig;

  /** Optional logger instance */
  logger?: BlaizeLogger;
}

// These types are from @blaize-plugins/queue but we define minimal versions here
// to avoid circular dependencies. In real usage, they'd be imported.
export interface QueueJob {
  id: string;
  type: string;
  queueName: string;
  data: unknown;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  priority: number;
  progress: number;
  queuedAt: number;
  startedAt?: number;
  completedAt?: number;
  failedAt?: number;
  retries: number;
  maxRetries: number;
  timeout: number;
  result?: unknown;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface JobFilters {
  status?: QueueJob['status'] | QueueJob['status'][];
  jobType?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'queuedAt' | 'priority' | 'status';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Cache adapter statistics
 */
export interface CacheStats {
  /** Number of cache hits */
  hits: number;

  /** Number of cache misses */
  misses: number;

  /** Number of entries evicted (LRU or TTL) */
  evictions: number;

  /** Approximate memory usage in bytes */
  memoryUsage: number;

  /** Current number of entries in cache */
  entryCount: number;

  /** Uptime in milliseconds since adapter started */
  uptime?: number;
}

export interface QueueStats {
  total: number;
  queued: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
}
