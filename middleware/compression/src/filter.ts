/**
 * @file Content type filtering for compression middleware
 * @module @blaizejs/middleware-compression/filter
 */

import type { Context } from '@blaize-types/context';
import type { ContentTypeFilter, ContentTypeFilterConfig } from './types';
import { COMPRESSIBLE_TYPES, SKIP_TYPES } from './constants';

/**
 * Extract the MIME type from a Content-Type header value.
 * Strips parameters (e.g., charset) and lowercases the result.
 *
 * @param contentType - The Content-Type header value
 * @returns The extracted MIME type, or null if undefined/empty
 */
export function extractMimeType(contentType: string | undefined): string | null {
  if (!contentType) {
    return null;
  }

  const mime = contentType.split(';')[0]?.trim().toLowerCase();
  return mime || null;
}

/**
 * Check if a MIME type matches a pattern.
 * Supports exact match and wildcard patterns like `text/*`.
 */
function matchesMimePattern(mimeType: string, pattern: string): boolean {
  const lowerMime = mimeType.toLowerCase();
  const lowerPattern = pattern.toLowerCase();

  if (lowerPattern === lowerMime) {
    return true;
  }

  // Wildcard matching: text/* matches text/html, text/plain, etc.
  if (lowerPattern.endsWith('/*')) {
    const prefix = lowerPattern.slice(0, -1); // "text/"
    return lowerMime.startsWith(prefix);
  }

  return false;
}

/**
 * Check if a MIME type is compressible based on the default lists.
 *
 * @param mimeType - The MIME type to check (may include parameters)
 * @returns true if the type is compressible
 */
export function isCompressible(mimeType: string): boolean {
  const mime = extractMimeType(mimeType);
  if (!mime) {
    return false;
  }

  // Check skip types first (already compressed formats)
  for (const skipType of SKIP_TYPES) {
    if (matchesMimePattern(mime, skipType)) {
      return false;
    }
  }

  // Check compressible types (including wildcard support)
  for (const compressibleType of COMPRESSIBLE_TYPES) {
    if (matchesMimePattern(mime, compressibleType)) {
      return true;
    }
  }

  // Also match broad categories: any text/* type is compressible
  if (mime.startsWith('text/')) {
    return true;
  }

  return false;
}

/**
 * Create a content type filter predicate from a ContentTypeFilter configuration.
 *
 * Handles four shapes:
 * 1. Function — use directly
 * 2. Boolean — true = compress all, false = compress none
 * 3. Config object with include/exclude arrays — exclude takes precedence
 * 4. Undefined — fall back to isCompressible
 *
 * @param config - The content type filter configuration
 * @returns A predicate function (mimeType, ctx) => boolean
 */
export function createContentTypeFilter(
  config?: ContentTypeFilter | boolean,
): (mimeType: string, ctx: Context) => boolean {
  // Shape 4: undefined — fall back to isCompressible
  if (config === undefined || config === null) {
    return (mimeType: string) => isCompressible(mimeType);
  }

  // Shape 2: boolean
  if (typeof config === 'boolean') {
    return () => config;
  }

  // Shape 1: function
  if (typeof config === 'function') {
    return (mimeType: string) => config(mimeType);
  }

  // Shape 3: config object with include/exclude
  const filterConfig = config as ContentTypeFilterConfig;
  const { include, exclude } = filterConfig;

  return (mimeType: string) => {
    const mime = extractMimeType(mimeType) ?? mimeType.toLowerCase();

    // Exclude takes precedence over include
    if (exclude) {
      for (const pattern of exclude) {
        if (matchesMimePattern(mime, pattern)) {
          return false;
        }
      }
    }

    // If include is specified, mime must match at least one pattern
    if (include) {
      for (const pattern of include) {
        if (matchesMimePattern(mime, pattern)) {
          return true;
        }
      }
      return false;
    }

    // No include specified — fall back to isCompressible
    return isCompressible(mime);
  };
}

