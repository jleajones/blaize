/**
 * @file Main middleware factory for compression middleware
 * @module @blaizejs/middleware-compression/middleware
 */

import { createMiddleware } from 'blaizejs';
import type { Middleware } from 'blaizejs';

import { shouldCompress, compressResponse } from './compress';
import { parseCompressionOptions } from './validation';
import { compressionPresets } from './presets';

import type { CompressionOptions, CompressionPreset } from './types';

/**
 * Create a compression middleware instance.
 *
 * Negotiates encoding, checks pre-conditions, and installs response wrappers
 * that compress the body before it is sent.
 *
 * @param options - Compression configuration (defaults to sensible values)
 * @returns Blaize middleware instance
 *
 * @example
 * ```ts
 * import { createServer } from 'blaizejs';
 * import { compression } from '@blaizejs/middleware-compression';
 *
 * const server = createServer();
 * server.use(compression());
 * ```
 */
export function compression(options?: CompressionOptions): Middleware {
  const config = parseCompressionOptions(options ?? {});

  return createMiddleware({
    name: 'compression',
    handler: async ({ ctx, next, logger }) => {
      const { compress, reason, algorithm } = await shouldCompress(ctx, config);

      if (!compress || !algorithm) {
        logger.debug('Compression skipped', { reason });
        await next();
        return;
      }

      compressResponse(ctx, config, algorithm, {
        debug: (msg, meta) => logger.debug(msg, meta),
        warn: (msg, meta) => logger.warn(msg, meta),
        error: (msg, meta) => logger.error(msg, meta),
      });

      await next();
    },
  });
}

/**
 * Get compression options for a named preset.
 *
 * @param name - Preset name
 * @returns CompressionOptions for the preset
 *
 * @example
 * ```ts
 * import { getCompressionPreset, compression } from '@blaizejs/middleware-compression';
 *
 * const opts = getCompressionPreset('fast');
 * server.use(compression(opts));
 * ```
 */
export function getCompressionPreset(name: CompressionPreset): CompressionOptions {
  return compressionPresets[name];
}

/**
 * Convenience factory — fast compression (low latency).
 * Uses the "fast" preset.
 */
export const compressionFast = (): Middleware => compression(compressionPresets.fast);

/**
 * Convenience factory — best compression (maximum ratio).
 * Uses the "best" preset.
 */
export const compressionBest = (): Middleware => compression(compressionPresets.best);

/**
 * Convenience factory — text-only compression.
 * Uses the "text-only" preset.
 */
export const compressionTextOnly = (): Middleware => compression(compressionPresets['text-only']);

/**
 * Convenience factory — streaming-optimised compression.
 * Uses the "streaming" preset.
 */
export const compressionStreaming = (): Middleware => compression(compressionPresets.streaming);

