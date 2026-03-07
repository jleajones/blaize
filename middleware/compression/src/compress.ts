/**
 * @file Core compression logic for compression middleware
 * @module @blaizejs/middleware-compression/compress
 */

import type { Context } from '@blaize-types/context';
import type { Transform } from 'node:stream';

import { createCompressorStream, getCompressionLevel } from './algorithms';
import { configureFlushMode } from './flush';
import { weakenEtag } from './etag';
import { extractMimeType, createContentTypeFilter } from './filter';
import { negotiateEncoding, getAcceptEncodingState } from './negotiate';

import type {
  CompressionAlgorithm,
  CompressibleAlgorithm,
  CompressionSkipReason,
} from './types';
import type { ParsedCompressionConfig } from './validation';

/**
 * Result of the shouldCompress check
 */
export interface ShouldCompressResult {
  /** Whether compression should proceed */
  compress: boolean;
  /** Reason compression was skipped (if compress is false) */
  reason: CompressionSkipReason | null;
  /** Negotiated algorithm (if compress is true) */
  algorithm?: CompressionAlgorithm;
}

/**
 * Logger interface for compression operations
 */
export interface CompressionLogger {
  debug: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>) => void;
}

/**
 * No-op logger for when no logger is provided
 */
const noopLogger: CompressionLogger = {
  debug: () => {},
  warn: () => {},
  error: () => {},
};

/**
 * Check entry-level conditions to determine if compression should be attempted.
 *
 * This is a pure function that checks conditions BEFORE the response body is available.
 * It does NOT check body-dependent conditions like threshold or content-type.
 *
 * @param ctx - The request context
 * @param config - Parsed compression configuration
 * @returns Whether to compress and the reason if not
 */
export function shouldCompress(
  ctx: Context,
  config: ParsedCompressionConfig,
): ShouldCompressResult {
  // Check if compression is disabled via skip function
  if (config.skip && config.skip(ctx)) {
    return { compress: false, reason: 'skip-function' };
  }

  // Check Accept-Encoding header
  const acceptEncoding = ctx.request.header('accept-encoding');
  const aeState = getAcceptEncodingState(acceptEncoding);

  if (aeState === 'empty') {
    return { compress: false, reason: 'no-accept-encoding' };
  }

  // Negotiate encoding
  const available = config.algorithms.filter(
    (a): a is CompressionAlgorithm => a !== 'identity',
  );
  const algorithm = negotiateEncoding(acceptEncoding, available);

  if (!algorithm) {
    return { compress: false, reason: 'no-supported-encoding' };
  }

  return { compress: true, reason: null, algorithm };
}

/**
 * Check if a response should be skipped based on body-level conditions.
 *
 * @param body - The response body (as string or Buffer)
 * @param contentType - The Content-Type header value
 * @param ctx - The request context
 * @param config - Parsed compression configuration
 * @returns Skip reason or null if compression should proceed
 */
function checkBodySkipConditions(
  body: Buffer,
  contentType: string | undefined,
  ctx: Context,
  config: ParsedCompressionConfig,
): CompressionSkipReason | null {
  // Check for empty body
  if (body.length === 0) {
    return 'empty-body';
  }

  // Check threshold
  if (body.length < config.threshold) {
    return 'below-threshold';
  }

  // Check Cache-Control: no-transform
  const cacheControl = (ctx.response.raw as any).getHeader?.('cache-control') as string | undefined;
  if (cacheControl && cacheControl.toLowerCase().includes('no-transform')) {
    return 'no-transform';
  }

  // Check if already compressed (Content-Encoding already set)
  const existingEncoding = (ctx.response.raw as any).getHeader?.('content-encoding') as string | undefined;
  if (existingEncoding && existingEncoding !== 'identity') {
    return 'already-compressed';
  }

  // Check content type compressibility
  if (contentType) {
    const filter = createContentTypeFilter(config.contentTypeFilter);
    const mime = extractMimeType(contentType);
    if (mime && !filter(mime, ctx)) {
      return 'content-type-excluded';
    }
  }

  // Check for 204/304 status codes
  const statusCode = ctx.response.raw.statusCode;
  if (statusCode === 204 || statusCode === 304) {
    return 'no-content';
  }

  return null;
}

/**
 * Compress a buffer using the specified algorithm.
 *
 * @param body - The body to compress
 * @param algorithm - The compression algorithm
 * @param config - Parsed compression configuration
 * @returns The compressed buffer
 */
async function compressBuffer(
  body: Buffer,
  algorithm: CompressibleAlgorithm,
  config: ParsedCompressionConfig,
): Promise<Buffer> {
  const level = getCompressionLevel(algorithm, config.level);
  let compressor = createCompressorStream(algorithm, {
    level,
    memoryLevel: config.memoryLevel,
    windowBits: config.windowBits,
  });

  // Apply flush mode if configured
  compressor = configureFlushMode(compressor, config.flush) as Transform;

  const chunks: Buffer[] = [];

  return new Promise<Buffer>((resolve, reject) => {
    compressor.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    compressor.on('end', () => {
      resolve(Buffer.concat(chunks));
    });

    compressor.on('error', (err) => {
      reject(err);
    });

    compressor.end(body);
  });
}

/**
 * Set compression headers on the raw response.
 *
 * @param res - The raw response object
 * @param algorithm - The compression algorithm used
 * @param config - Parsed compression configuration
 */
function setCompressionHeaders(
  res: any,
  algorithm: CompressionAlgorithm,
  config: ParsedCompressionConfig,
): void {
  // Set Content-Encoding
  res.setHeader('Content-Encoding', algorithm);

  // Remove Content-Length (compressed size differs)
  res.removeHeader('Content-Length');

  // Weaken ETag if present
  const etag = res.getHeader('etag') as string | undefined;
  if (etag) {
    const weakened = weakenEtag(etag);
    if (weakened) {
      res.setHeader('ETag', weakened);
    }
  }

  // Set Vary header
  if (config.vary) {
    const existingVary = res.getHeader('vary') as string | undefined;
    if (!existingVary) {
      res.setHeader('Vary', 'Accept-Encoding');
    } else if (!existingVary.toLowerCase().includes('accept-encoding')) {
      res.setHeader('Vary', `${existingVary}, Accept-Encoding`);
    }
  }
}

/**
 * Install compression wrappers on ctx.response methods.
 *
 * This function wraps json, text, html, and stream methods to intercept
 * the response body and compress it before sending.
 *
 * Must be called BEFORE next() in the middleware chain.
 *
 * @param ctx - The request context
 * @param config - Parsed compression configuration
 * @param algorithm - The negotiated compression algorithm
 * @param logger - Optional logger for compression events
 */
export function compressResponse(
  ctx: Context,
  config: ParsedCompressionConfig,
  algorithm: CompressionAlgorithm,
  logger: CompressionLogger = noopLogger,
): void {
  const res = ctx.response.raw as any;

  // Save original methods
  const originalJson = ctx.response.json;
  const originalText = ctx.response.text;
  const originalHtml = ctx.response.html;
  const originalStream = ctx.response.stream;

  /**
   * Create a buffered wrapper for json/text/html methods.
   * Intercepts the body, compresses it, and sends via res.end().
   */
  function createBufferedWrapper(
    originalMethod: (...args: any[]) => void,
    contentType: string,
    serializeBody: (body: any) => string,
  ): (...args: any[]) => void {
    return function wrappedMethod(body: any, status?: number) {
      // Set status if provided
      if (status !== undefined) {
        res.statusCode = status;
      }

      // Set content type
      res.setHeader('Content-Type', contentType);

      // Serialize body to buffer
      const serialized = serializeBody(body);
      const bodyBuffer = Buffer.from(serialized, 'utf-8');

      // Check body-level skip conditions
      const skipReason = checkBodySkipConditions(bodyBuffer, contentType, ctx, config);
      if (skipReason) {
        logger.debug('Skipping compression', { reason: skipReason, contentType });
        // Call original method (send uncompressed)
        originalMethod.call(ctx.response, body, status);
        return;
      }

      // Compress the body
      compressBuffer(bodyBuffer, algorithm as CompressibleAlgorithm, config)
        .then((compressed) => {
          setCompressionHeaders(res, algorithm, config);
          res.end(compressed);
          // Mark response as sent by setting the sent property
          // We need to access the internal state - use Object.defineProperty
          Object.defineProperty(ctx.response, 'sent', { value: true, writable: true, configurable: true });
          logger.debug('Compressed response', {
            algorithm,
            originalSize: bodyBuffer.length,
            compressedSize: compressed.length,
            ratio: compressed.length / bodyBuffer.length,
          });
        })
        .catch((err) => {
          logger.error('Compression failed, sending uncompressed', {
            error: (err as Error).message,
            algorithm,
          });
          // Fallback: send uncompressed
          originalMethod.call(ctx.response, body, status);
        });
    };
  }

  // Wrap json method
  ctx.response.json = createBufferedWrapper(
    originalJson,
    'application/json',
    (body: unknown) => JSON.stringify(body),
  );

  // Wrap text method
  ctx.response.text = createBufferedWrapper(
    originalText,
    'text/plain',
    (body: string) => body,
  );

  // Wrap html method
  ctx.response.html = createBufferedWrapper(
    originalHtml,
    'text/html',
    (body: string) => body,
  );

  // Wrap stream method
  ctx.response.stream = function wrappedStream(
    readable: NodeJS.ReadableStream,
    options: any = {},
  ) {
    const streamContentType = options.contentType || (res.getHeader('content-type') as string | undefined);

    // Check for SSE (text/event-stream) — skip compression
    const mime = extractMimeType(streamContentType);
    if (mime === 'text/event-stream') {
      logger.debug('Skipping compression for SSE stream');
      originalStream.call(ctx.response, readable, options);
      return;
    }

    // Check Cache-Control: no-transform
    const cacheControl = res.getHeader('cache-control') as string | undefined;
    if (cacheControl && cacheControl.toLowerCase().includes('no-transform')) {
      logger.debug('Skipping compression: no-transform');
      originalStream.call(ctx.response, readable, options);
      return;
    }

    // Check if already compressed
    const existingEncoding = res.getHeader('content-encoding') as string | undefined;
    if (existingEncoding && existingEncoding !== 'identity') {
      logger.debug('Skipping compression: already compressed');
      originalStream.call(ctx.response, readable, options);
      return;
    }

    // Check content type compressibility
    if (streamContentType) {
      const filter = createContentTypeFilter(config.contentTypeFilter);
      if (mime && !filter(mime, ctx)) {
        logger.debug('Skipping compression: content type excluded', { contentType: streamContentType });
        originalStream.call(ctx.response, readable, options);
        return;
      }
    }

    // Set up compression pipeline: readable → compressor → res
    const level = getCompressionLevel(algorithm, config.level);
    let compressor = createCompressorStream(algorithm as CompressibleAlgorithm, {
      level,
      memoryLevel: config.memoryLevel,
      windowBits: config.windowBits,
    });

    // Apply flush mode
    compressor = configureFlushMode(compressor, config.flush) as Transform;

    // Set compression headers
    setCompressionHeaders(res, algorithm, config);

    // Set stream options headers
    if (options.status !== undefined) {
      res.statusCode = options.status;
    }
    if (options.contentType) {
      res.setHeader('Content-Type', options.contentType);
    }
    if (options.headers) {
      for (const [name, value] of Object.entries(options.headers)) {
        res.setHeader(name, value as string);
      }
    }

    // Pipe: readable → compressor → res
    readable.pipe(compressor).pipe(res);

    // Handle errors
    compressor.on('error', (err) => {
      logger.error('Stream compression failed', {
        error: (err as Error).message,
        algorithm,
      });
      // Try to end the response
      try {
        res.end();
      } catch {
        // Ignore
      }
    });

    // Mark as sent when done
    readable.on('end', () => {
      Object.defineProperty(ctx.response, 'sent', { value: true, writable: true, configurable: true });
    });
  };
}
