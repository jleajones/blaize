/**
 * @file ETag utilities for compression middleware
 * @module @blaizejs/middleware-compression/etag
 */

/**
 * Convert a strong ETag to a weak ETag.
 *
 * Compression changes the byte representation of a response, so strong ETags
 * are no longer valid — they must be weakened to indicate semantic equivalence.
 *
 * @param etag - The ETag header value
 * @returns Weakened ETag, or `undefined` if input is `undefined` or empty
 *
 * @example
 * ```ts
 * weakenEtag('"abc123"');      // → 'W/"abc123"'
 * weakenEtag('W/"abc123"');    // → 'W/"abc123"' (unchanged)
 * weakenEtag(undefined);       // → undefined
 * ```
 */
export function weakenEtag(etag: string | undefined): string | undefined {
  if (etag === undefined || etag === '') {
    return undefined;
  }

  // Already a weak ETag — return unchanged
  if (etag.startsWith('W/')) {
    return etag;
  }

  // Convert strong ETag to weak
  return `W/${etag}`;
}

