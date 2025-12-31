/**
 * @blaizejs/adapter-redis
 *
 * Redis adapter package for BlaizeJS providing EventBus, Cache, and Queue implementations.
 *
 * @packageDocumentation
 */

// Re-export all public APIs

// Client and circuit breaker
export { createRedisClient } from './client';
export type { RedisClientConfig, RedisClient } from './client';

export { CircuitBreaker } from './circuit-breaker';
export type { CircuitBreakerConfig, CircuitBreakerState } from './circuit-breaker';

// Error types
export { RedisConnectionError, RedisOperationError, CircuitBreakerOpenError } from './errors';
export type {
  RedisConnectionErrorDetails,
  RedisOperationErrorDetails,
  CircuitBreakerOpenErrorDetails,
} from './errors';

// Adapters
export { RedisEventBusAdapter } from './event-bus-adapter';
export type { RedisEventBusAdapterOptions } from './event-bus-adapter';

export { RedisCacheAdapter } from './cache-adapter';
export type { RedisCacheAdapterOptions } from './cache-adapter';

export { RedisQueueAdapter } from './queue-adapter';
export type { RedisQueueAdapterOptions, QueueJob } from './queue-adapter';
