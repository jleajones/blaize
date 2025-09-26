// packages/blaize-client/src/sse/reconnect-strategies.ts

import type { ReconnectStrategy } from '@blaize-types/sse-client';

/**
 * Exponential backoff with jitter
 */
export const exponentialBackoff = (initialDelay = 1000, maxDelay = 30000): ReconnectStrategy => {
  return (attempt: number) => {
    const delay = Math.min(initialDelay * Math.pow(2, attempt), maxDelay);
    return delay + Math.random() * 1000; // Add jitter
  };
};

/**
 * Linear backoff
 */
export const linearBackoff = (delayIncrement = 1000, maxDelay = 30000): ReconnectStrategy => {
  return (attempt: number) => {
    return Math.min(delayIncrement * (attempt + 1), maxDelay);
  };
};

/**
 * Fixed delay
 */
export const fixedDelay = (delay = 5000): ReconnectStrategy => {
  return () => delay;
};

/**
 * Fibonacci backoff (gentler than exponential)
 */
export const fibonacciBackoff = (baseDelay = 1000, maxDelay = 30000): ReconnectStrategy => {
  const fib = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55];
  return (attempt: number) => {
    const multiplier = fib[Math.min(attempt, fib.length - 1)];
    return Math.min(baseDelay * multiplier!, maxDelay);
  };
};
