/**
 * Correlation ID system for request tracing across async operations
 *
 * This module provides utilities for generating, storing, and accessing
 * correlation IDs that follow requests through the entire application stack.
 * Uses AsyncLocalStorage for automatic context propagation.
 */

import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * AsyncLocalStorage instance for storing correlation IDs
 * Separate from the main context storage to allow independent lifecycle management
 */
const correlationStorage = new AsyncLocalStorage<string>();

/**
 * Generates a new unique correlation ID
 *
 * Format: req_[timestamp_base36]_[random_base36]
 * Example: req_k3x2m1_9z8y7w6v
 *
 * @returns A unique correlation ID string
 */
export function generateCorrelationId(): string {
  const timestamp = Date.now().toString(36); // Base36 encoded timestamp
  const random = Math.random().toString(36).substr(2, 9); // Base36 random string
  return `req_${timestamp}_${random}`;
}

/**
 * Gets the current correlation ID from AsyncLocalStorage
 *
 * @returns The current correlation ID, or 'unknown' if none is set
 */
export function getCurrentCorrelationId(): string {
  const stored = correlationStorage.getStore();
  return stored && stored.trim() ? stored : 'unknown';
}

/**
 * Sets the correlation ID in the current AsyncLocalStorage context
 *
 * This will affect the current execution context and any subsequent
 * async operations that inherit from it.
 *
 * @param correlationId - The correlation ID to set
 */
export function setCorrelationId(correlationId: string): void {
  correlationStorage.enterWith(correlationId);
}

/**
 * Runs a function with a specific correlation ID
 *
 * Creates a new AsyncLocalStorage context with the provided correlation ID.
 * The correlation ID will be available to the function and any async operations
 * it spawns, but will not affect the parent context.
 *
 * @param correlationId - The correlation ID to use for this context
 * @param fn - The function to run with the correlation ID
 * @returns The result of the function
 *
 * @example
 * ```typescript
 * const result = await withCorrelationId('req_123', async () => {
 *   console.log(getCurrentCorrelationId()); // 'req_123'
 *   return await processRequest();
 * });
 * ```
 */
export function withCorrelationId<T>(
  correlationId: string,
  fn: () => T | Promise<T>
): T | Promise<T> {
  return correlationStorage.run(correlationId, fn);
}

/**
 * Extracts correlation ID from headers or generates a new one
 *
 * Looks for the 'x-correlation-id' header and uses it if present.
 * If not found, empty, or undefined, generates a new correlation ID.
 *
 * @param headers - HTTP headers object
 * @returns A correlation ID (either from headers or newly generated)
 *
 * @example
 * ```typescript
 * // From incoming request headers
 * const correlationId = getOrGenerateCorrelationId(request.headers);
 *
 * // Use in request processing
 * await withCorrelationId(correlationId, async () => {
 *   // Process request with correlation tracking
 * });
 * ```
 */
export function getOrGenerateCorrelationId(headers: Record<string, string | undefined>): string {
  const headerCorrelationId = headers['x-correlation-id'];

  // Use header value if it exists and is not empty
  if (headerCorrelationId && headerCorrelationId.trim()) {
    return headerCorrelationId;
  }

  // Generate new correlation ID if header is missing or empty
  return generateCorrelationId();
}

/**
 * Creates a middleware function for setting correlation ID from request headers
 *
 * This is a utility for integrating correlation ID handling into the middleware stack.
 * It extracts or generates a correlation ID and sets it for the request processing.
 *
 * @returns Middleware function that sets correlation ID
 *
 * @example
 * ```typescript
 * import { createServer } from 'blaizejs';
 * import { createCorrelationMiddleware } from './correlation';
 *
 * const server = createServer({
 *   middleware: [
 *     createCorrelationMiddleware(),
 *     // ... other middleware
 *   ]
 * });
 * ```
 */
export function createCorrelationMiddleware() {
  return {
    name: 'correlation',
    execute: async (context: any, next: () => Promise<void>) => {
      // Extract headers from context (adapting to BlaizeJS context structure)
      const headers = context.request.headers();
      const correlationId = getOrGenerateCorrelationId(headers);

      // Set correlation ID and process request
      await withCorrelationId(correlationId, next);
    },
    debug: () => ({ stage: 'correlation-id-setup' }),
  };
}

/**
 * Type-safe wrapper for functions that need correlation ID context
 *
 * Ensures that a function always has access to a correlation ID,
 * either from the current context or by generating a new one.
 *
 * @param fn - Function that requires correlation ID context
 * @returns Wrapped function that guarantees correlation ID availability
 */
export function withEnsuredCorrelation<T extends any[], R>(
  fn: (...args: T) => R | Promise<R>
): (...args: T) => R | Promise<R> {
  return (...args: T): R | Promise<R> => {
    const currentCorrelationId = getCurrentCorrelationId();

    // If we already have a correlation ID, just run the function
    if (currentCorrelationId !== 'unknown') {
      return fn(...args);
    }

    // Generate new correlation ID and run function in that context
    const newCorrelationId = generateCorrelationId();
    return withCorrelationId(newCorrelationId, () => fn(...args));
  };
}

/**
 * Debugging utility to get correlation storage information
 *
 * @internal This is for debugging purposes only
 */
export function _getCorrelationStorageInfo() {
  return {
    hasActiveStore: correlationStorage.getStore() !== undefined,
    currentCorrelationId: correlationStorage.getStore() ?? null,
  };
}
