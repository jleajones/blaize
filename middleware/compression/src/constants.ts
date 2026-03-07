/**
 * @file Constants for compression middleware
 * @module @blaizejs/middleware-compression/constants
 */

import type { CompressionAlgorithm } from './types';

/**
 * Default algorithm preference order.
 * Algorithms are tried in this order when negotiating with the client.
 */
export const DEFAULT_ALGORITHMS = ['zstd', 'br', 'gzip', 'deflate'] as const;

/**
 * MIME types that are compressible by default.
 * Includes text types and compressible application types.
 */
export const COMPRESSIBLE_TYPES: readonly string[] = [
  'text/html',
  'text/css',
  'text/plain',
  'text/javascript',
  'text/xml',
  'text/csv',
  'text/markdown',
  'text/calendar',
  'text/vcard',
  'application/json',
  'application/javascript',
  'application/xml',
  'application/xhtml+xml',
  'application/rss+xml',
  'application/atom+xml',
  'application/ld+json',
  'application/manifest+json',
  'application/vnd.api+json',
  'application/graphql+json',
  'application/geo+json',
  'application/wasm',
  'application/x-javascript',
  'application/x-www-form-urlencoded',
  'image/svg+xml',
  'image/x-icon',
  'application/x-font-ttf',
  'font/opentype',
  'font/ttf',
  'font/woff',
] as const;

/**
 * MIME types that should never be compressed (already compressed binary formats).
 */
export const SKIP_TYPES: readonly string[] = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/bmp',
  'image/tiff',
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/mpeg',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'audio/webm',
  'application/zip',
  'application/gzip',
  'application/x-gzip',
  'application/x-bzip2',
  'application/x-xz',
  'application/x-7z-compressed',
  'application/x-rar-compressed',
  'application/x-tar',
  'application/pdf',
  'application/octet-stream',
  'application/woff2',
] as const;

/**
 * Per-algorithm configuration: default and maximum compression levels.
 *
 * Based on FR-1 table:
 * - zstd: default 3, max 22
 * - br (brotli): default 4, max 11
 * - gzip: default 6 (Z_DEFAULT_COMPRESSION), max 9
 * - deflate: default 6, max 9
 */
export interface AlgorithmLevelConfig {
  /** Default compression level */
  readonly defaultLevel: number;
  /** Maximum compression level */
  readonly maxLevel: number;
  /** Minimum compression level */
  readonly minLevel: number;
  /** Level used for 'fastest' preset */
  readonly fastestLevel: number;
}

/**
 * Algorithm-specific level configurations.
 */
export const ALGORITHM_LEVELS: Readonly<Record<string, AlgorithmLevelConfig>> = {
  zstd: {
    defaultLevel: 3,
    maxLevel: 22,
    minLevel: 1,
    fastestLevel: 1,
  },
  br: {
    defaultLevel: 4,
    maxLevel: 11,
    minLevel: 0,
    fastestLevel: 1,
  },
  gzip: {
    defaultLevel: 6,
    maxLevel: 9,
    minLevel: 1,
    fastestLevel: 1,
  },
  deflate: {
    defaultLevel: 6,
    maxLevel: 9,
    minLevel: 1,
    fastestLevel: 1,
  },
} as const;

