import type { CorsOrigin } from '../types.js';
import type { Context } from 'blaizejs';

/**
 * Performance-optimized origin validation with caching
 */
const originCache = new Map<string, boolean>();
const CACHE_SIZE_LIMIT = 1000;

export const isOriginAllowed = async (
  origin: string | undefined,
  corsOrigin: CorsOrigin,
  ctx: Context
): Promise<boolean> => {
  // Handle no origin (same-origin requests)
  if (!origin) {
    return true;
  }

  // Handle wildcard
  if (corsOrigin === true || corsOrigin === '*') {
    return true;
  }

  // Handle false
  if (corsOrigin === false) {
    return false;
  }

  // Handle string exact match with caching
  if (typeof corsOrigin === 'string') {
    const cacheKey = `${origin}:${corsOrigin}`;

    if (originCache.has(cacheKey)) {
      return originCache.get(cacheKey)!;
    }

    const result = origin === corsOrigin;

    if (originCache.size >= CACHE_SIZE_LIMIT) {
      originCache.clear();
    }

    originCache.set(cacheKey, result);
    return result;
  }

  // Handle RegExp
  if (corsOrigin instanceof RegExp) {
    return corsOrigin.test(origin);
  }

  // Handle array of strings/RegExp
  if (Array.isArray(corsOrigin)) {
    return corsOrigin.some(allowedOrigin => {
      if (typeof allowedOrigin === 'string') {
        return origin === allowedOrigin;
      }
      if (allowedOrigin instanceof RegExp) {
        return allowedOrigin.test(origin);
      }
      return false;
    });
  }

  // Handle function
  if (typeof corsOrigin === 'function') {
    return await corsOrigin(origin, ctx);
  }

  return false;
};
