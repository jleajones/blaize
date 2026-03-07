/**
 * @file Flush mode configuration for compression middleware
 * @module @blaizejs/middleware-compression/flush
 */

import zlib from 'node:zlib';
import type { Transform } from 'node:stream';

/**
 * Wrap a transform stream's `write` method to call `flush` with the given
 * flush constant after each write.
 *
 * @param transform - The transform stream to wrap
 * @param flushConstant - The zlib flush constant to use (e.g., Z_SYNC_FLUSH)
 * @returns The modified transform stream
 */
export function wrapWriteWithFlush(transform: Transform, flushConstant: number): Transform {
  const originalWrite = transform.write.bind(transform);
  // zlib transform streams have a flush() method not present on the base Transform type
  const zlibFlush = (transform as any).flush.bind(transform);

  transform.write = function (
    this: Transform,
    chunk: any,
    encodingOrCallback?: BufferEncoding | ((error: Error | null | undefined) => void),
    callback?: (error: Error | null | undefined) => void,
  ): boolean {
    // Handle overloaded signatures
    if (typeof encodingOrCallback === 'function') {
      const result = originalWrite(chunk, (err: Error | null | undefined) => {
        if (err) {
          encodingOrCallback(err);
          return;
        }
        zlibFlush(flushConstant, () => encodingOrCallback(null));
      });
      return result;
    }

    const encoding = encodingOrCallback as BufferEncoding;
    const result = originalWrite(chunk, encoding, (err: Error | null | undefined) => {
      if (err) {
        callback?.(err);
        return;
      }
      zlibFlush(flushConstant, () => callback?.(null));
    });
    return result;
  } as typeof transform.write;

  return transform;
}

/**
 * Configure the flush mode for a compression transform stream.
 *
 * @param transform - The compression transform stream
 * @param flush - Flush mode: `false`/`'none'` = no-op, `true`/`'sync'` = Z_SYNC_FLUSH,
 *                `'partial'` = Z_PARTIAL_FLUSH (falls back to no-op if unavailable)
 * @returns The (potentially modified) transform stream
 */
export function configureFlushMode(transform: Transform, flush: boolean | string): Transform {
  if (flush === false || flush === 'none') {
    return transform;
  }

  if (flush === true || flush === 'sync') {
    return wrapWriteWithFlush(transform, zlib.constants.Z_SYNC_FLUSH);
  }

  if (flush === 'partial') {
    // Z_PARTIAL_FLUSH may not exist on older Node.js versions.
    // If unavailable, fall back silently (no-op, no logging, no errors).
    const partialFlush = (zlib.constants as Record<string, unknown>).Z_PARTIAL_FLUSH;
    if (typeof partialFlush === 'number') {
      return wrapWriteWithFlush(transform, partialFlush);
    }
    // Fallback: no-op — return transform unmodified
    return transform;
  }

  return transform;
}

