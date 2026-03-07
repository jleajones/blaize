/**
 * @file Named compression presets for common use cases
 * @module @blaizejs/middleware-compression/presets
 *
 * Provides pre-configured compression option objects for common scenarios.
 * Factory convenience functions that create middleware instances will be
 * available after the middleware factory (T10) is implemented.
 */

import type { CompressionOptions } from './types';

/**
 * Named compression presets — pre-configured CompressionOptions for common use cases.
 *
 * Usage:
 * ```ts
 * import { compressionPresets } from '@blaizejs/middleware-compression';
 *
 * // Use a preset directly as middleware options
 * const options = compressionPresets.fast;
 * ```
 */
export const compressionPresets = {
  /**
   * Balanced preset — good default for most applications.
   * Uses default compression level with a 1KB threshold.
   */
  default: {
    threshold: 1024,
    flush: false,
    level: 'default',
  } satisfies CompressionOptions,

  /**
   * Fast preset — optimized for low latency.
   * Uses fastest compression level to minimize CPU overhead.
   */
  fast: {
    threshold: 1024,
    flush: false,
    level: 'fastest',
  } satisfies CompressionOptions,

  /**
   * Best preset — maximum compression ratio.
   * Uses best compression level with a lower threshold (512 bytes).
   */
  best: {
    threshold: 512,
    flush: false,
    level: 'best',
  } satisfies CompressionOptions,

  /**
   * Text-only preset — compresses only text content types.
   * Useful when binary content should not be compressed.
   */
  'text-only': {
    threshold: 1024,
    flush: false,
    level: 'default',
    contentTypeFilter: {
      include: ['text/*'],
    },
  } satisfies CompressionOptions,

  /**
   * Streaming preset — optimized for streaming responses.
   * Flushes on each write and uses threshold 0 since Content-Length
   * is typically unknown for streamed responses.
   */
  streaming: {
    threshold: 0,
    flush: true,
    level: 'default',
  } satisfies CompressionOptions,
} as const;



