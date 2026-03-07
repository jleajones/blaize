/**
 * @file Algorithm registry and runtime detection for compression middleware
 * @module @blaizejs/middleware-compression/algorithms
 */

import zlib from 'node:zlib';
import type { Transform } from 'node:stream';

import { ALGORITHM_LEVELS } from './constants';

import type { CompressibleAlgorithm, CompressionAlgorithm, CompressionLevel } from './types';

/**
 * Zstd compression level parameter key.
 * In the zstd C API, ZSTD_c_compressionLevel has the integer value 3.
 * We read it from zlib.constants when available, falling back to the
 * known value (3) for Node.js versions where the constant exists but
 * isn't yet exposed in the type definitions.
 */
const ZSTD_C_COMPRESSION_LEVEL =
  (zlib.constants as any).ZSTD_c_compressionLevel ?? 3;

/**
 * Check if zstd compression is available in the current Node.js runtime.
 * zstd support was added in Node.js 22.15.0 / 24.0.0.
 */
function hasZstd(): boolean {
  return typeof (zlib as any).createZstdCompress === 'function';
}

/**
 * Check if Brotli compression is available in the current Node.js runtime.
 * Brotli support was added in Node.js 10.16.0.
 */
function hasBrotli(): boolean {
  return typeof zlib.createBrotliCompress === 'function';
}

/**
 * Detect which of the requested algorithms are available on the current runtime.
 *
 * Returns algorithms in input order, filtered to what's available.
 * gzip and deflate are always available. Brotli and zstd depend on Node.js version.
 *
 * This function has NO side effects — no logging, no console output.
 *
 * @param requested - Algorithms to check, in preference order
 * @returns Available algorithms in the same order as requested
 */
export function detectAvailableAlgorithms(
  requested: readonly CompressionAlgorithm[],
): CompressionAlgorithm[] {
  return requested.filter((algorithm) => {
    switch (algorithm) {
      case 'zstd':
        return hasZstd();
      case 'br':
        return hasBrotli();
      case 'gzip':
      case 'deflate':
        return true;
      case 'identity':
        return true;
      default:
        return false;
    }
  });
}

/**
 * Options for creating a compressor stream.
 */
export interface CompressorStreamOptions {
  /** Compression level (numeric) */
  level?: number;
  /** Memory level for zlib-based algorithms */
  memoryLevel?: number;
  /** Window bits for zlib-based algorithms */
  windowBits?: number;
  /** Whether to flush on each write */
  flush?: boolean;
}

/**
 * Create a compressor transform stream for the given algorithm.
 *
 * @param algorithm - The compression algorithm to use
 * @param options - Compression options
 * @returns A zlib Transform stream configured for the algorithm
 * @throws {Error} If the algorithm is not available or not supported
 */
export function createCompressorStream(
  algorithm: CompressibleAlgorithm,
  options: CompressorStreamOptions = {},
): Transform {
  const { level, memoryLevel, windowBits, flush } = options;

  switch (algorithm) {
    case 'zstd': {
      const createZstdCompress = (zlib as any).createZstdCompress;
      if (typeof createZstdCompress !== 'function') {
        throw new Error('zstd compression is not available in this Node.js version');
      }
      return createZstdCompress({
        params: {
          ...(level !== undefined && { [ZSTD_C_COMPRESSION_LEVEL]: level }),
        },
        ...(flush && { flush: (zlib.constants as any).ZSTD_e_flush }),
      });
    }
    case 'br': {
      if (typeof zlib.createBrotliCompress !== 'function') {
        throw new Error('Brotli compression is not available in this Node.js version');
      }
      return zlib.createBrotliCompress({
        params: {
          ...(level !== undefined && {
            [zlib.constants.BROTLI_PARAM_QUALITY]: level,
          }),
        },
        ...(flush && { flush: zlib.constants.BROTLI_OPERATION_FLUSH }),
      });
    }
    case 'gzip':
      return zlib.createGzip({
        ...(level !== undefined && { level }),
        ...(memoryLevel !== undefined && { memLevel: memoryLevel }),
        ...(windowBits !== undefined && { windowBits }),
        ...(flush && { flush: zlib.constants.Z_SYNC_FLUSH }),
      });
    case 'deflate':
      return zlib.createDeflate({
        ...(level !== undefined && { level }),
        ...(memoryLevel !== undefined && { memLevel: memoryLevel }),
        ...(windowBits !== undefined && { windowBits }),
        ...(flush && { flush: zlib.constants.Z_SYNC_FLUSH }),
      });
    default:
      throw new Error(`Unsupported compression algorithm: ${algorithm}`);
  }
}

/**
 * Compress a complete buffer synchronously.
 *
 * Used by buffered response wrappers so they preserve the synchronous
 * response semantics expected by the BlaizeJS request handler.
 */
export function compressBufferSync(
  body: Buffer,
  algorithm: CompressibleAlgorithm,
  options: CompressorStreamOptions = {},
): Buffer {
  const { level, memoryLevel, windowBits } = options;

  switch (algorithm) {
    case 'zstd': {
      const zstdCompressSync = (zlib as any).zstdCompressSync;
      if (typeof zstdCompressSync !== 'function') {
        throw new Error('zstd synchronous compression is not available in this Node.js version');
      }

      return zstdCompressSync(body, {
        params: {
          ...(level !== undefined && { [ZSTD_C_COMPRESSION_LEVEL]: level }),
        },
      });
    }
    case 'br': {
      if (typeof zlib.brotliCompressSync !== 'function') {
        throw new Error('Brotli compression is not available in this Node.js version');
      }

      return zlib.brotliCompressSync(body, {
        params: {
          [zlib.constants.BROTLI_PARAM_QUALITY]: level ?? zlib.constants.BROTLI_DEFAULT_QUALITY,
        },
      });
    }
    case 'gzip':
      return zlib.gzipSync(body, {
        ...(level !== undefined && { level }),
        ...(memoryLevel !== undefined && { memLevel: memoryLevel }),
        ...(windowBits !== undefined && { windowBits }),
      });
    case 'deflate':
      return zlib.deflateSync(body, {
        ...(level !== undefined && { level }),
        ...(memoryLevel !== undefined && { memLevel: memoryLevel }),
        ...(windowBits !== undefined && { windowBits }),
      });
    default:
      throw new Error(`Unsupported compression algorithm: ${algorithm}`);
  }
}

/**
 * Get the numeric compression level for an algorithm given a named or numeric level.
 *
 * Named levels:
 * - 'fastest' → algorithm-specific fast level
 * - 'default' → algorithm-specific default level
 * - 'best' → algorithm max level
 *
 * Numeric levels are clamped to the algorithm's valid range [minLevel, maxLevel].
 *
 * @param algorithm - The compression algorithm
 * @param level - Named preset or numeric level
 * @returns Numeric compression level
 */
export function getCompressionLevel(
  algorithm: CompressionAlgorithm,
  level: CompressionLevel = 'default',
): number {
  const config = ALGORITHM_LEVELS[algorithm];
  if (!config) {
    return typeof level === 'number' ? level : 6;
  }

  if (typeof level === 'number') {
    return Math.max(config.minLevel, Math.min(level, config.maxLevel));
  }

  switch (level) {
    case 'fastest':
      return config.fastestLevel;
    case 'default':
      return config.defaultLevel;
    case 'best':
      return config.maxLevel;
    default:
      return config.defaultLevel;
  }
}

