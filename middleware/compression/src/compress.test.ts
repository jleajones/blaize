import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Readable } from 'node:stream';
import zlib from 'node:zlib';

import { shouldCompress, compressResponse } from './compress';
import type { ShouldCompressResult, CompressionLogger } from './compress';
import { parseCompressionOptions } from './validation';
import type { ParsedCompressionConfig } from './validation';
import type { Context } from '@blaize-types/context';

/**
 * Create a mock raw response object (ServerResponse-like)
 */
function createMockRawResponse() {
  const headers: Record<string, string> = {};
  return {
    statusCode: 200,
    headersSent: false,
    setHeader: vi.fn((name: string, value: string) => {
      headers[name.toLowerCase()] = value;
    }),
    getHeader: vi.fn((name: string) => headers[name.toLowerCase()]),
    removeHeader: vi.fn((name: string) => {
      delete headers[name.toLowerCase()];
    }),
    end: vi.fn(function (this: { headersSent: boolean }, chunk?: unknown) {
      this.headersSent = true;
      return chunk;
    }),
    pipe: vi.fn(),
    on: vi.fn(),
    _headers: headers,
  };
}

/**
 * Create a mock context for testing
 */
function createMockContext(options: {
  acceptEncoding?: string;
  method?: string;
  path?: string;
} = {}): { ctx: Context; rawRes: ReturnType<typeof createMockRawResponse> } {
  const rawRes = createMockRawResponse();
  const requestHeaders: Record<string, string> = {};
  if (options.acceptEncoding !== undefined) {
    requestHeaders['accept-encoding'] = options.acceptEncoding;
  }

  const ctx = {
    request: {
      raw: {} as any,
      method: options.method || 'GET',
      path: options.path || '/',
      url: null,
      query: {},
      params: {},
      protocol: 'http',
      isHttp2: false,
      header: (name: string) => requestHeaders[name.toLowerCase()],
      headers: () => requestHeaders,
      body: undefined,
      files: undefined,
    },
    response: {
      raw: rawRes as any,
      sent: false,
      statusCode: 200,
      status: vi.fn().mockReturnThis(),
      header: vi.fn().mockReturnThis(),
      headers: vi.fn().mockReturnThis(),
      type: vi.fn().mockReturnThis(),
      json: vi.fn(),
      text: vi.fn(),
      html: vi.fn(),
      redirect: vi.fn(),
      stream: vi.fn(),
    },
    state: {},
    services: {},
  } as unknown as Context;

  return { ctx, rawRes };
}

function createDefaultConfig(overrides: Record<string, any> = {}): ParsedCompressionConfig {
  return parseCompressionOptions({ ...overrides });
}

function createLogger(): CompressionLogger {
  return {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

/**
 * Wait for res.end to be called instead of using flaky setTimeout.
 */
async function waitForResponse(rawRes: ReturnType<typeof createMockRawResponse>) {
  await vi.waitFor(() => {
    expect(rawRes.end).toHaveBeenCalled();
  });
}

describe('compress', () => {
  describe('shouldCompress', () => {
    it('should return compress: true when Accept-Encoding includes gzip', async () => {
      const { ctx } = createMockContext({ acceptEncoding: 'gzip, deflate' });
      const config = createDefaultConfig();
      const result = await shouldCompress(ctx, config);
      expect(result.compress).toBe(true);
      expect(result.reason).toBeNull();
      expect(result.algorithm).toBeDefined();
    });

    it('should return compress: false with skip-function reason when skip returns true', async () => {
      const { ctx } = createMockContext({ acceptEncoding: 'gzip' });
      const config = createDefaultConfig({ skip: () => true });
      const result = await shouldCompress(ctx, config);
      expect(result.compress).toBe(false);
      expect(result.reason).toBe('skip-function');
    });

    it('should handle async skip predicate returning Promise<true>', async () => {
      const { ctx } = createMockContext({ acceptEncoding: 'gzip' });
      const config = createDefaultConfig({ skip: () => Promise.resolve(true) });
      const result = await shouldCompress(ctx, config);
      expect(result.compress).toBe(false);
      expect(result.reason).toBe('skip-function');
    });

    it('should handle async skip predicate returning Promise<false>', async () => {
      const { ctx } = createMockContext({ acceptEncoding: 'gzip' });
      const config = createDefaultConfig({ skip: () => Promise.resolve(false) });
      const result = await shouldCompress(ctx, config);
      expect(result.compress).toBe(true);
    });

    it('should return compress: false with no-accept-encoding when header is empty', async () => {
      const { ctx } = createMockContext({ acceptEncoding: '' });
      const config = createDefaultConfig();
      const result = await shouldCompress(ctx, config);
      expect(result.compress).toBe(false);
      expect(result.reason).toBe('no-accept-encoding');
    });

    it('should return compress: false with no-supported-encoding when no algorithm matches', async () => {
      const { ctx } = createMockContext({ acceptEncoding: 'unsupported-algo' });
      const config = createDefaultConfig({ algorithms: ['gzip'] });
      const result = await shouldCompress(ctx, config);
      expect(result.compress).toBe(false);
      expect(result.reason).toBe('no-supported-encoding');
    });

    it('should return identity-preferred when Accept-Encoding includes identity and no algorithm matches', async () => {
      const { ctx } = createMockContext({ acceptEncoding: 'identity;q=1.0' });
      const config = createDefaultConfig({ algorithms: ['gzip'] });
      const result = await shouldCompress(ctx, config);
      expect(result.compress).toBe(false);
      expect(result.reason).toBe('identity-preferred');
    });

    it('should negotiate the best algorithm based on Accept-Encoding', async () => {
      const { ctx } = createMockContext({ acceptEncoding: 'gzip;q=0.5, deflate;q=1.0' });
      const config = createDefaultConfig({ algorithms: ['gzip', 'deflate'] });
      const result = await shouldCompress(ctx, config);
      expect(result.compress).toBe(true);
      expect(result.algorithm).toBe('deflate');
    });

    it('should compress when Accept-Encoding header is absent (RFC 7231)', async () => {
      const { ctx } = createMockContext(); // no acceptEncoding
      const config = createDefaultConfig({ algorithms: ['gzip'] });
      const result = await shouldCompress(ctx, config);
      expect(result.compress).toBe(true);
      expect(result.algorithm).toBe('gzip');
    });
  });

  describe('compressResponse', () => {
    describe('json wrapper', () => {
      it('should synchronously mark buffered responses as sent before returning', () => {
        const { ctx, rawRes } = createMockContext({ acceptEncoding: 'gzip' });
        const config = createDefaultConfig({ threshold: 10 });

        compressResponse(ctx, config, 'gzip');

        ctx.response.json({ data: 'x'.repeat(2000) });

        expect(rawRes.end).toHaveBeenCalled();
        expect(rawRes.headersSent || ctx.response.sent).toBe(true);
      });

      it('should mark zstd buffered responses as sent even when sync zstd is unavailable', () => {
        const originalZstdCompressSync = (zlib as any).zstdCompressSync;

        Object.defineProperty(zlib, 'zstdCompressSync', {
          value: undefined,
          writable: true,
          configurable: true,
        });

        try {
          const { ctx } = createMockContext({ acceptEncoding: 'zstd' });
          const config = createDefaultConfig({ threshold: 10 });

          compressResponse(ctx, config, 'zstd');

          ctx.response.json({ data: 'x'.repeat(2000) });

          expect(ctx.response.sent).toBe(true);
        } finally {
          Object.defineProperty(zlib, 'zstdCompressSync', {
            value: originalZstdCompressSync,
            writable: true,
            configurable: true,
          });
        }
      });

      it('should compress JSON response when body exceeds threshold', async () => {
        const { ctx, rawRes } = createMockContext({ acceptEncoding: 'gzip' });
        const config = createDefaultConfig({ threshold: 10 });
        const logger = createLogger();

        compressResponse(ctx, config, 'gzip', logger);

        const largeBody = { data: 'x'.repeat(2000) };
        ctx.response.json(largeBody);

        expect(rawRes.setHeader).toHaveBeenCalledWith('Content-Encoding', 'gzip');
        const endArg = rawRes.end.mock.calls[0]?.[0] as Buffer;
        expect(Buffer.isBuffer(endArg)).toBe(true);

        // Verify it's actually gzip compressed
        const decompressed = zlib.gunzipSync(endArg);
        expect(decompressed.toString()).toBe(JSON.stringify(largeBody));
      });

      it('should skip compression when body is below threshold', () => {
        const { ctx, rawRes } = createMockContext({ acceptEncoding: 'gzip' });
        const originalJson = vi.fn();
        ctx.response.json = originalJson;
        const config = createDefaultConfig({ threshold: 10000 });

        compressResponse(ctx, config, 'gzip');

        // Call the wrapped json method with a small body
        ctx.response.json({ small: true });

        // Original method should have been called (fallback)
        expect(originalJson).toHaveBeenCalled();
      });

      it('should skip compression for empty body', () => {
        const { ctx } = createMockContext({ acceptEncoding: 'gzip' });
        const originalText = vi.fn();
        ctx.response.text = originalText;
        const config = createDefaultConfig({ threshold: 0 });

        compressResponse(ctx, config, 'gzip');

        // Empty string body → 0 bytes → should skip
        ctx.response.text('');

        expect(originalText).toHaveBeenCalled();
      });

      it('should set status code when provided', async () => {
        const { ctx, rawRes } = createMockContext({ acceptEncoding: 'gzip' });
        const config = createDefaultConfig({ threshold: 10 });

        compressResponse(ctx, config, 'gzip');

        const largeBody = { data: 'x'.repeat(2000) };
        ctx.response.json(largeBody, 201);

        await waitForResponse(rawRes);

        expect(rawRes.statusCode).toBe(201);
      });
    });

    describe('text wrapper', () => {
      it('should compress text response', async () => {
        const { ctx, rawRes } = createMockContext({ acceptEncoding: 'gzip' });
        const config = createDefaultConfig({ threshold: 10 });

        compressResponse(ctx, config, 'gzip');

        const largeText = 'Hello World! '.repeat(200);
        ctx.response.text(largeText);

        await waitForResponse(rawRes);

        expect(rawRes.setHeader).toHaveBeenCalledWith('Content-Encoding', 'gzip');
        const endArg = rawRes.end.mock.calls[0]?.[0] as Buffer;
        const decompressed = zlib.gunzipSync(endArg);
        expect(decompressed.toString()).toBe(largeText);
      });
    });

    describe('html wrapper', () => {
      it('should compress html response', async () => {
        const { ctx, rawRes } = createMockContext({ acceptEncoding: 'gzip' });
        const config = createDefaultConfig({ threshold: 10 });

        compressResponse(ctx, config, 'gzip');

        const largeHtml = '<html>' + '<p>content</p>'.repeat(200) + '</html>';
        ctx.response.html(largeHtml);

        await waitForResponse(rawRes);

        expect(rawRes.setHeader).toHaveBeenCalledWith('Content-Encoding', 'gzip');
        expect(rawRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/html');
        const endArg = rawRes.end.mock.calls[0]?.[0] as Buffer;
        const decompressed = zlib.gunzipSync(endArg);
        expect(decompressed.toString()).toBe(largeHtml);
      });
    });

    describe('header management', () => {
      it('should set Vary: Accept-Encoding header', async () => {
        const { ctx, rawRes } = createMockContext({ acceptEncoding: 'gzip' });
        const config = createDefaultConfig({ threshold: 10, vary: true });

        compressResponse(ctx, config, 'gzip');

        ctx.response.json({ data: 'x'.repeat(2000) });

        await waitForResponse(rawRes);

        expect(rawRes.setHeader).toHaveBeenCalledWith('Vary', 'Accept-Encoding');
      });

      it('should remove Content-Length header', async () => {
        const { ctx, rawRes } = createMockContext({ acceptEncoding: 'gzip' });
        const config = createDefaultConfig({ threshold: 10 });

        compressResponse(ctx, config, 'gzip');

        ctx.response.json({ data: 'x'.repeat(2000) });

        await waitForResponse(rawRes);

        expect(rawRes.removeHeader).toHaveBeenCalledWith('Content-Length');
      });

      it('should weaken ETag when present', async () => {
        const { ctx, rawRes } = createMockContext({ acceptEncoding: 'gzip' });
        rawRes._headers['etag'] = '"abc123"';
        const config = createDefaultConfig({ threshold: 10 });

        compressResponse(ctx, config, 'gzip');

        ctx.response.json({ data: 'x'.repeat(2000) });

        await waitForResponse(rawRes);

        expect(rawRes.setHeader).toHaveBeenCalledWith('ETag', 'W/"abc123"');
      });

      it('should skip compression when Cache-Control: no-transform is set', () => {
        const { ctx, rawRes } = createMockContext({ acceptEncoding: 'gzip' });
        rawRes._headers['cache-control'] = 'no-transform';
        const originalJson = vi.fn();
        ctx.response.json = originalJson;
        const config = createDefaultConfig({ threshold: 10 });

        compressResponse(ctx, config, 'gzip');

        ctx.response.json({ data: 'x'.repeat(2000) });

        expect(originalJson).toHaveBeenCalled();
      });

      it('should skip compression when Content-Encoding is already set', () => {
        const { ctx, rawRes } = createMockContext({ acceptEncoding: 'gzip' });
        rawRes._headers['content-encoding'] = 'br';
        const originalJson = vi.fn();
        ctx.response.json = originalJson;
        const config = createDefaultConfig({ threshold: 10 });

        compressResponse(ctx, config, 'gzip');

        ctx.response.json({ data: 'x'.repeat(2000) });

        expect(originalJson).toHaveBeenCalled();
      });
    });

    describe('stream wrapper', () => {
      it('should skip compression for SSE streams', () => {
        const { ctx } = createMockContext({ acceptEncoding: 'gzip' });
        const originalStream = vi.fn();
        ctx.response.stream = originalStream;
        const config = createDefaultConfig();

        compressResponse(ctx, config, 'gzip');

        const readable = new Readable({ read() {} });
        ctx.response.stream(readable, { contentType: 'text/event-stream' });

        expect(originalStream).toHaveBeenCalled();
      });

      it('should skip compression for streams with no-transform', () => {
        const { ctx, rawRes } = createMockContext({ acceptEncoding: 'gzip' });
        rawRes._headers['cache-control'] = 'no-transform';
        const originalStream = vi.fn();
        ctx.response.stream = originalStream;
        const config = createDefaultConfig();

        compressResponse(ctx, config, 'gzip');

        const readable = new Readable({ read() {} });
        ctx.response.stream(readable, { contentType: 'text/plain' });

        expect(originalStream).toHaveBeenCalled();
      });

      it('should skip compression for already-compressed streams', () => {
        const { ctx, rawRes } = createMockContext({ acceptEncoding: 'gzip' });
        rawRes._headers['content-encoding'] = 'br';
        const originalStream = vi.fn();
        ctx.response.stream = originalStream;
        const config = createDefaultConfig();

        compressResponse(ctx, config, 'gzip');

        const readable = new Readable({ read() {} });
        ctx.response.stream(readable, { contentType: 'text/plain' });

        expect(originalStream).toHaveBeenCalled();
      });

      it('should pipe through compressor for compressible streams', () => {
        const { ctx, rawRes } = createMockContext({ acceptEncoding: 'gzip' });
        const config = createDefaultConfig();

        compressResponse(ctx, config, 'gzip');

        const readable = new Readable({ read() {} });
        // Mock pipe to return a pipeable object
        const mockCompressorPipe = vi.fn().mockReturnValue(rawRes);
        const mockReadablePipe = vi.fn().mockReturnValue({
          pipe: mockCompressorPipe,
          on: vi.fn(),
        });
        (readable as any).pipe = mockReadablePipe;
        (readable as any).on = vi.fn();

        ctx.response.stream(readable, { contentType: 'text/plain' });

        // Should have set Content-Encoding
        expect(rawRes.setHeader).toHaveBeenCalledWith('Content-Encoding', 'gzip');
        // Should have piped through compressor
        expect(mockReadablePipe).toHaveBeenCalled();
      });
    });

    describe('204/304 status codes', () => {
      it('should skip compression for 204 No Content', () => {
        const { ctx, rawRes } = createMockContext({ acceptEncoding: 'gzip' });
        rawRes.statusCode = 204;
        const originalJson = vi.fn();
        ctx.response.json = originalJson;
        const config = createDefaultConfig({ threshold: 10 });

        compressResponse(ctx, config, 'gzip');

        ctx.response.json({ data: 'x'.repeat(2000) });

        expect(originalJson).toHaveBeenCalled();
      });

      it('should skip compression for 304 Not Modified', () => {
        const { ctx, rawRes } = createMockContext({ acceptEncoding: 'gzip' });
        rawRes.statusCode = 304;
        const originalText = vi.fn();
        ctx.response.text = originalText;
        const config = createDefaultConfig({ threshold: 10 });

        compressResponse(ctx, config, 'gzip');

        ctx.response.text('x'.repeat(2000));

        expect(originalText).toHaveBeenCalled();
      });
    });

    describe('logging', () => {
      it('should log debug message when compression is skipped', () => {
        const { ctx } = createMockContext({ acceptEncoding: 'gzip' });
        const originalJson = vi.fn();
        ctx.response.json = originalJson;
        const config = createDefaultConfig({ threshold: 10000 });
        const logger = createLogger();

        compressResponse(ctx, config, 'gzip', logger);

        ctx.response.json({ small: true });

        expect(logger.debug).toHaveBeenCalledWith(
          'Skipping compression',
          expect.objectContaining({ reason: expect.any(String) }),
        );
      });

      it('should log debug message on successful compression', async () => {
        const { ctx, rawRes } = createMockContext({ acceptEncoding: 'gzip' });
        const config = createDefaultConfig({ threshold: 10 });
        const logger = createLogger();

        compressResponse(ctx, config, 'gzip', logger);

        ctx.response.json({ data: 'x'.repeat(2000) });

        await waitForResponse(rawRes);

        expect(logger.debug).toHaveBeenCalledWith(
          'Compressed response',
          expect.objectContaining({
            algorithm: 'gzip',
            originalSize: expect.any(Number),
            compressedSize: expect.any(Number),
          }),
        );
      });
    });
  });
});
