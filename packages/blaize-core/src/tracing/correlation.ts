/**
 * Correlation ID system for request tracing across async operations
 *
 * This module provides utilities for generating, storing, and accessing
 * correlation IDs that follow requests through the entire application stack.
 * Uses AsyncLocalStorage for automatic context propagation.
 */

import { AsyncLocalStorage } from 'node:async_hooks';

import type { CorrelationConfig } from '@blaize-types/tracing';

/**
 * Default configuration values
 * @internal
 */
const DEFAULT_CONFIG: CorrelationConfig = {
  headerName: 'x-correlation-id',
  generator: defaultCorrelationIdGenerator,
};

/**
 * Current configuration (mutable for server customization)
 * @internal
 */
let currentConfig: CorrelationConfig = { ...DEFAULT_CONFIG };

/**
 * AsyncLocalStorage instance for storing correlation IDs
 * Separate from the main context storage to allow independent lifecycle management
 */
const correlationStorage = new AsyncLocalStorage<string>();

/**
 * Default correlation ID generator
 *
 * Format: req_[timestamp_base36]_[random_base36]
 * Example: req_k3x2m1_9z8y7w6v
 *
 * @internal
 */
function defaultCorrelationIdGenerator(): string {
  const timestamp = Date.now().toString(36); // Base36 encoded timestamp
  const random = Math.random().toString(36).substr(2, 9); // Base36 random string
  return `req_${timestamp}_${random}`;
}

/**
 * Sets the correlation configuration (internal use only)
 *
 * This function is called by the server during initialization to configure
 * the correlation ID system. It should not be called directly by application code.
 *
 * @param headerName - The HTTP header name to use for correlation IDs
 * @param generator - Custom correlation ID generator function
 * @internal
 */
export function _setCorrelationConfig(headerName?: string, generator?: () => string): void {
  currentConfig = {
    headerName: headerName || DEFAULT_CONFIG.headerName,
    generator: generator || DEFAULT_CONFIG.generator,
  };
}

/**
 * Gets the configured correlation header name
 *
 * @returns The configured header name (defaults to 'x-correlation-id')
 * @internal
 */
export function getCorrelationHeaderName(): string {
  return currentConfig.headerName;
}

/**
 * Resets the correlation configuration to defaults
 *
 * Primarily used for testing to ensure clean state between tests
 *
 * @internal
 */
export function _resetCorrelationConfig(): void {
  currentConfig = { ...DEFAULT_CONFIG };
}

/**
 * Generates a new unique correlation ID
 *
 * Uses the configured generator function, which defaults to the format:
 * req_[timestamp_base36]_[random_base36]
 * Example: req_k3x2m1_9z8y7w6v
 *
 * @returns A unique correlation ID string
 */
export function generateCorrelationId(): string {
  return currentConfig.generator();
}

/**
 * Gets the current correlation ID from AsyncLocalStorage
 *
 * @returns The current correlation ID, or 'unknown' if none is set
 */
export function getCorrelationId(): string {
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
 * Looks for the configured correlation header (default: 'x-correlation-id').
 * If not found, empty, or undefined, generates a new correlation ID.
 * Supports both string and string[] header values for compatibility.
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
export function createCorrelationIdFromHeaders(
  headers: Record<string, string | string[] | undefined>
): string {
  const headerName = currentConfig.headerName;
  const headerValue = headers[headerName];

  // Handle both string and string[] header values
  let correlationId: string | undefined;

  if (Array.isArray(headerValue)) {
    // Take the first value if it's an array
    correlationId = headerValue[0];
  } else if (typeof headerValue === 'string') {
    correlationId = headerValue;
  }

  // Use header value if it exists and is not empty
  if (correlationId && correlationId.trim()) {
    return correlationId;
  }

  // Generate new correlation ID if header is missing or empty
  return generateCorrelationId();
}

// Note: Correlation middleware is not needed since we're integrating
// at the request handler level (see Task T6). The request handler
// will directly use getOrGenerateCorrelationId() and withCorrelationId()
// to establish correlation context for the entire request lifecycle.

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
    const currentCorrelationId = getCorrelationId();

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
    config: {
      headerName: currentConfig.headerName,
      generatorType:
        currentConfig.generator === defaultCorrelationIdGenerator ? 'default' : 'custom',
    },
  };
}
