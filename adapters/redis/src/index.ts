/**
 * @blaizejs/adapter-redis
 *
 * Redis adapter package for BlaizeJS providing EventBus, Cache, and Queue implementations.
 *
 * @packageDocumentation
 */

// Client and circuit breaker
export { createRedisClient } from './client';
export { createCircuitBreaker } from './circuit-breaker';

export type {
  RedisClientConfig,
  RedisClient,
  CircuitBreakerConfig,
  CircuitBreakerState,
} from './types';

// Error types
export { RedisConnectionError, RedisOperationError, CircuitBreakerOpenError } from './errors';
export type {
  JobPriority,
  QueueJob,
  JobError,
  JobFilters,
  QueueStats,
  RedisConnectionErrorDetails,
  RedisOperationErrorDetails,
  CircuitBreakerErrorDetails,
} from './types';

// Adapters
export { RedisEventBusAdapter } from './event-bus-adapter';
export { RedisCacheAdapter } from './cache-adapter';
export { RedisQueueAdapter } from './queue-adapter';
