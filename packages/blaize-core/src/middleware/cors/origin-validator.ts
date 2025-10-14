/**
 * Origin Validation Module for CORS
 *
 * Provides origin validation with LRU caching for performance optimization.
 * Supports string matching, regex patterns, and async function evaluation
 * with timeout protection.
 */

import type { Context } from '@blaize-types/context';
import type { CacheConfig, CacheEntry, CorsOrigin } from '@blaize-types/cors';

/**
 * Create an LRU cache for origin validation
 *
 * Using a functional approach with closure for state management
 */
function createOriginCache(ttl: number = 60000, maxSize: number = 1000) {
  const cache = new Map<string, CacheEntry>();
  const config: CacheConfig = { ttl, maxSize };

  /**
   * Generate cache key from origin, configured origin identifier, and optional user ID
   * We need to include a representation of the configured origin to prevent incorrect cache hits
   */
  const getCacheKey = (origin: string, configOriginId: string, userId?: string): string => {
    return `${origin}:${configOriginId}:${userId || 'anonymous'}`;
  };

  /**
   * Evict least recently used entry when at capacity
   */
  const evictLRU = (): void => {
    if (cache.size === 0) return;

    let lruKey: string | null = null;
    let lruTime = Infinity; // Start with Infinity, not Date.now()

    // Find least recently used entry (oldest lastAccessed time)
    for (const [key, entry] of cache.entries()) {
      if (entry.lastAccessed < lruTime) {
        lruTime = entry.lastAccessed;
        lruKey = key;
      }
    }

    if (lruKey) {
      cache.delete(lruKey);
    }
  };

  /**
   * Get cached validation result if not expired
   */
  const get = (origin: string, configOriginId: string, userId?: string): boolean | null => {
    const key = getCacheKey(origin, configOriginId, userId);
    const entry = cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    const now = Date.now();
    if (now > entry.expiresAt) {
      cache.delete(key);
      return null;
    }

    // Update last accessed time for LRU
    entry.lastAccessed = now;
    return entry.allowed;
  };

  /**
   * Set validation result in cache
   */
  const set = (origin: string, allowed: boolean, configOriginId: string, userId?: string): void => {
    const key = getCacheKey(origin, configOriginId, userId);
    const now = Date.now();

    // If key already exists, just update it
    if (cache.has(key)) {
      cache.set(key, {
        allowed,
        expiresAt: now + config.ttl,
        lastAccessed: now,
      });
      return;
    }

    // Adding new key - check if we need to evict
    if (cache.size >= config.maxSize) {
      evictLRU();
    }

    cache.set(key, {
      allowed,
      expiresAt: now + config.ttl,
      lastAccessed: now,
    });
  };

  /**
   * Clear all cache entries
   */
  const clear = (): void => {
    cache.clear();
  };

  /**
   * Clean up expired entries
   */
  const cleanExpired = (): number => {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of cache.entries()) {
      if (now > entry.expiresAt) {
        cache.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  };

  /**
   * Get cache statistics
   */
  const getStats = () => ({
    size: cache.size,
    maxSize: config.maxSize,
    ttl: config.ttl,
  });

  return {
    get,
    set,
    clear,
    cleanExpired,
    getStats,
  };
}

/**
 * Default cache instance (module-level singleton)
 */
let defaultCache = createOriginCache();

/**
 * Replace the default cache (useful for testing)
 */
export function setOriginCache(ttl: number = 60000, maxSize: number = 1000): void {
  defaultCache = createOriginCache(ttl, maxSize);
}

/**
 * Reset to default cache configuration
 */
export function resetOriginCache(): void {
  defaultCache = createOriginCache();
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return defaultCache.getStats();
}

/**
 * Clean expired cache entries
 */
export function cleanExpiredCacheEntries(): number {
  return defaultCache.cleanExpired();
}

/**
 * Determine if a configured origin is cacheable
 * Only string and RegExp origins are cacheable
 */
function isCacheable(configuredOrigin: CorsOrigin | boolean): boolean {
  // Booleans are instant - no need to cache
  if (typeof configuredOrigin === 'boolean') {
    return false;
  }

  // Functions are unpredictable - shouldn't cache
  if (typeof configuredOrigin === 'function') {
    return false;
  }

  // Arrays may contain functions - check all elements
  if (Array.isArray(configuredOrigin)) {
    return configuredOrigin.every(origin => typeof origin === 'string' || origin instanceof RegExp);
  }

  // String and RegExp are cacheable
  return typeof configuredOrigin === 'string' || configuredOrigin instanceof RegExp;
}

/**
 * Generate a stable identifier for a configured origin
 * This is used as part of the cache key
 * Only called for cacheable origins
 */
function getConfigOriginId(configuredOrigin: CorsOrigin | boolean): string {
  if (typeof configuredOrigin === 'string') {
    return `str:${configuredOrigin}`;
  }
  if (configuredOrigin instanceof RegExp) {
    return `regex:${configuredOrigin.source}:${configuredOrigin.flags}`;
  }
  if (Array.isArray(configuredOrigin)) {
    // For arrays, create a composite ID from the elements
    return `array:[${configuredOrigin
      .map(o => {
        if (typeof o === 'string') return `str:${o}`;
        if (o instanceof RegExp) return `regex:${o.source}:${o.flags}`;
        return 'unknown';
      })
      .join(',')}]`;
  }
  // This shouldn't be reached for cacheable origins
  return 'unknown';
}

/**
 * Validate origin string against configured origin
 */
async function validateStringOrigin(
  requestOrigin: string,
  configuredOrigin: string
): Promise<boolean> {
  // Handle wildcard
  if (configuredOrigin === '*') {
    return true;
  }

  // Exact match (case-sensitive as per spec)
  return requestOrigin === configuredOrigin;
}

/**
 * Validate origin against regex pattern
 */
async function validateRegExpOrigin(
  requestOrigin: string,
  configuredOrigin: RegExp
): Promise<boolean> {
  return configuredOrigin.test(requestOrigin);
}

/**
 * Validate origin using async function with timeout
 */
async function validateFunctionOrigin(
  requestOrigin: string,
  configuredOrigin: (origin: string, ctx?: Context<any, any>) => boolean | Promise<boolean>,
  ctx?: Context<any, any>,
  timeoutMs: number = 100
): Promise<boolean> {
  let timeoutId: NodeJS.Timeout | undefined;

  try {
    // Create a timeout promise that resolves (not rejects) with a timeout flag
    const timeoutPromise = new Promise<{ timedOut: true }>(resolve => {
      timeoutId = setTimeout(() => {
        resolve({ timedOut: true });
      }, timeoutMs);
    });

    // Race between the validation function and timeout
    const result = await Promise.race([
      Promise.resolve(configuredOrigin(requestOrigin, ctx)).then(r => ({ result: r })),
      timeoutPromise,
    ]);

    // Clear timeout if validation completed
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // Check if we timed out
    if ('timedOut' in result) {
      console.warn(
        `CORS origin validation function timed out after ${timeoutMs}ms for origin: ${requestOrigin}`
      );
      return false;
    }

    return result.result;
  } catch (error) {
    // Clear timeout on error
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    console.error('CORS origin validation function error:', error);
    return false; // Deny on error
  }
}

/**
 * Validate origin against an array of validators
 */
async function validateArrayOrigin(
  requestOrigin: string,
  configuredOrigins: Array<
    string | RegExp | ((origin: string, ctx?: Context<any, any>) => boolean | Promise<boolean>)
  >,
  ctx?: Context<any, any>
): Promise<boolean> {
  // Check each origin in parallel for performance
  const validations = configuredOrigins.map(origin =>
    validateSingleOrigin(requestOrigin, origin, ctx)
  );

  const results = await Promise.all(validations);
  return results.some(result => result === true);
}

/**
 * Validate a single origin (handles all non-array types)
 */
async function validateSingleOrigin(
  requestOrigin: string,
  configuredOrigin:
    | string
    | RegExp
    | ((origin: string, ctx?: Context<any, any>) => boolean | Promise<boolean>),
  ctx?: Context<any, any>
): Promise<boolean> {
  if (typeof configuredOrigin === 'string') {
    return validateStringOrigin(requestOrigin, configuredOrigin);
  }

  if (configuredOrigin instanceof RegExp) {
    return validateRegExpOrigin(requestOrigin, configuredOrigin);
  }

  if (typeof configuredOrigin === 'function') {
    return validateFunctionOrigin(requestOrigin, configuredOrigin, ctx);
  }

  // Unknown type, deny for safety
  console.warn('Unknown CORS origin type:', typeof configuredOrigin);
  return false;
}

/**
 * Main origin validation function with caching
 *
 * @param requestOrigin - The Origin header from the request
 * @param configuredOrigin - The configured CORS origin setting
 * @param ctx - Optional context for user-based caching
 * @returns Promise resolving to whether origin is allowed
 */
export async function validateOrigin(
  requestOrigin: string,
  configuredOrigin: CorsOrigin | boolean,
  ctx?: Context<any, any>
): Promise<boolean> {
  // Handle boolean shortcuts
  if (configuredOrigin === true) {
    return true; // Allow all origins
  }
  if (configuredOrigin === false) {
    return false; // Deny all origins
  }

  // Determine if this origin configuration is cacheable
  const cacheable = isCacheable(configuredOrigin);

  // Only use cache for cacheable origins (string, RegExp, or arrays of them)
  if (cacheable) {
    // Get user ID for cache key (if available)
    const userId = ctx?.state?.user?.id || ctx?.state?.userId;

    // Generate a stable identifier for the configured origin
    const configOriginId = getConfigOriginId(configuredOrigin);

    // Check cache first
    const cached = defaultCache.get(requestOrigin, configOriginId, userId);
    if (cached !== null) {
      return cached;
    }

    // Perform validation
    let allowed: boolean;

    if (Array.isArray(configuredOrigin)) {
      // Type assertion to ensure array elements are the right type
      allowed = await validateArrayOrigin(
        requestOrigin,
        configuredOrigin as Array<
          | string
          | RegExp
          | ((origin: string, ctx?: Context<any, any>) => boolean | Promise<boolean>)
        >,
        ctx
      );
    } else {
      allowed = await validateSingleOrigin(requestOrigin, configuredOrigin, ctx);
    }

    // Cache the result
    defaultCache.set(requestOrigin, allowed, configOriginId, userId);

    return allowed;
  } else {
    // Non-cacheable origin (function, boolean, or array with functions)
    // Perform validation without caching
    if (Array.isArray(configuredOrigin)) {
      return validateArrayOrigin(
        requestOrigin,
        configuredOrigin as Array<
          | string
          | RegExp
          | ((origin: string, ctx?: Context<any, any>) => boolean | Promise<boolean>)
        >,
        ctx
      );
    } else {
      return validateSingleOrigin(requestOrigin, configuredOrigin, ctx);
    }
  }
}

/**
 * Validate that credentials aren't used with wildcard origin
 * This should be called during configuration validation
 */
export function validateCredentialsWithOrigin(
  configuredOrigin: CorsOrigin | boolean,
  credentials: boolean
): void {
  if (!credentials) {
    return; // No restriction when credentials are false
  }

  // Check for wildcard with credentials
  if (configuredOrigin === true || configuredOrigin === '*') {
    throw new Error(
      'CORS security violation: Cannot use wildcard origin with credentials=true. ' +
        'Specify explicit origins when credentials are enabled.'
    );
  }

  // Check for wildcard in array
  if (Array.isArray(configuredOrigin)) {
    const hasWildcard = configuredOrigin.some(origin => origin === '*');
    if (hasWildcard) {
      throw new Error(
        'CORS security violation: Cannot include wildcard (*) in origin array with credentials=true.'
      );
    }
  }
}

/**
 * Performance optimization: Pre-validate common origins
 * Can be called during server startup
 */
export async function prevalidateOrigins(
  origins: string[],
  configuredOrigin: CorsOrigin | boolean,
  ctx?: Context<any, any>
): Promise<void> {
  const validations = origins.map(origin => validateOrigin(origin, configuredOrigin, ctx));

  await Promise.all(validations);
}

/**
 * Periodically clean expired cache entries (optional)
 * Returns a cleanup function to stop the interval
 */
export function startCacheCleanup(intervalMs: number = 60000): () => void {
  const interval = setInterval(() => {
    const cleaned = defaultCache.cleanExpired();
    if (cleaned > 0) {
      console.debug(`Cleaned ${cleaned} expired CORS cache entries`);
    }
  }, intervalMs);

  return () => clearInterval(interval);
}
