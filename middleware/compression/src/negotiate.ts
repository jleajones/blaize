/**
 * @file Content negotiation for compression middleware (RFC 7231 §5.3.4)
 * @module @blaizejs/middleware-compression/negotiate
 */

import type { CompressionAlgorithm } from './types';

/**
 * Parsed entry from an Accept-Encoding header.
 */
interface EncodingEntry {
  encoding: string;
  quality: number;
}

/**
 * Parse an Accept-Encoding header value into sorted entries.
 *
 * Handles quality values (e.g. `gzip;q=0.8`), wildcards (`*`),
 * and malformed input (returns empty array, never throws).
 */
function parseAcceptEncoding(header: string): EncodingEntry[] {
  const entries: EncodingEntry[] = [];

  for (const part of header.split(',')) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const segments = trimmed.split(';');
    const encoding = (segments[0] ?? '').trim().toLowerCase();
    if (!encoding) continue;

    let quality = 1.0;
    for (let i = 1; i < segments.length; i++) {
      const param = (segments[i] ?? '').trim().toLowerCase();
      if (param.startsWith('q=')) {
        const parsed = parseFloat(param.slice(2));
        if (!Number.isNaN(parsed)) {
          quality = Math.max(0, Math.min(1, parsed));
        }
      }
    }

    entries.push({ encoding, quality });
  }

  return entries;
}

/**
 * Negotiate the best compression encoding based on the client's Accept-Encoding
 * header and the server's available algorithms.
 *
 * Follows RFC 7231 §5.3.4 semantics:
 * - Quality values determine client preference (`q=0` means "not acceptable")
 * - When multiple algorithms have the same quality, server preference (order in `available`) wins
 * - The `*` wildcard matches any available algorithm
 * - `identity` always returns `null` (it's not a compression algorithm)
 *
 * @param acceptEncoding - The raw Accept-Encoding header value
 * @param available - Server's available algorithms in preference order
 * @returns The best matching algorithm, or `null` if none is acceptable
 */
export function negotiateEncoding(
  acceptEncoding: string,
  available: CompressionAlgorithm[],
): CompressionAlgorithm | null {
  if (!acceptEncoding || !acceptEncoding.trim()) {
    return null;
  }

  const entries = parseAcceptEncoding(acceptEncoding);
  if (entries.length === 0) {
    return null;
  }

  // Build a map of encoding → quality for quick lookup
  const qualityMap = new Map<string, number>();
  for (const entry of entries) {
    qualityMap.set(entry.encoding, entry.quality);
  }

  const wildcardQuality = qualityMap.get('*');

  let bestAlgorithm: CompressionAlgorithm | null = null;
  let bestQuality = -1;

  for (const algorithm of available) {
    // Skip identity — it's not a compression algorithm
    if (algorithm === 'identity') continue;

    const algoLower = algorithm.toLowerCase();
    let quality: number | undefined = qualityMap.get(algoLower);

    // If not explicitly listed, check wildcard
    if (quality === undefined && wildcardQuality !== undefined) {
      quality = wildcardQuality;
    }

    // If still undefined, client didn't mention it — skip
    if (quality === undefined) continue;

    // q=0 means explicitly rejected
    if (quality === 0) continue;

    // Higher quality wins; on tie, first in available (server preference) wins
    if (quality > bestQuality) {
      bestQuality = quality;
      bestAlgorithm = algorithm;
    }
  }

  return bestAlgorithm;
}

/**
 * Check if the Accept-Encoding header is empty or absent.
 *
 * @param acceptEncoding - The raw Accept-Encoding header value (may be undefined)
 * @returns `true` if the header is undefined, empty, or whitespace-only
 */
export function isAcceptEncodingEmpty(acceptEncoding: string | undefined): boolean {
  return acceptEncoding === undefined || acceptEncoding.trim() === '';
}

