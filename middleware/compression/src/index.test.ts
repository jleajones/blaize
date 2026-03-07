import { describe, it, expect, vi } from 'vitest';
import {
  CompressionConfigurationError,
  compression,
  getCompressionPreset,
  compressionFast,
  compressionBest,
  compressionTextOnly,
  compressionStreaming,
  compressionPresets,
} from './index';

describe('@blaizejs/middleware-compression', () => {
  it('should export CompressionConfigurationError', () => {
    expect(CompressionConfigurationError).toBeDefined();
    expect(typeof CompressionConfigurationError).toBe('function');
  });

  it('should allow instantiating CompressionConfigurationError', () => {
    const error = new CompressionConfigurationError('test', 'field');
    expect(error).toBeInstanceOf(CompressionConfigurationError);
    expect(error).toBeInstanceOf(Error);
  });

  describe('compression()', () => {
    it('should return a middleware object with default options', () => {
      const mw = compression();
      expect(mw).toBeDefined();
      expect(mw.name).toBe('compression');
      expect(typeof mw.execute).toBe('function');
    });

    it('should accept custom options', () => {
      const mw = compression({ threshold: 512, level: 'fastest' });
      expect(mw).toBeDefined();
      expect(mw.name).toBe('compression');
    });
  });

  describe('getCompressionPreset()', () => {
    it('should return options for the "fast" preset', () => {
      const opts = getCompressionPreset('fast');
      expect(opts).toEqual(compressionPresets.fast);
    });

    it('should return options for the "best" preset', () => {
      const opts = getCompressionPreset('best');
      expect(opts).toEqual(compressionPresets.best);
    });

    it('should return options for the "text-only" preset', () => {
      const opts = getCompressionPreset('text-only');
      expect(opts).toEqual(compressionPresets['text-only']);
    });

    it('should return options for the "streaming" preset', () => {
      const opts = getCompressionPreset('streaming');
      expect(opts).toEqual(compressionPresets.streaming);
    });

    it('should return options for the "default" preset', () => {
      const opts = getCompressionPreset('default');
      expect(opts).toEqual(compressionPresets.default);
    });

    it('should throw CompressionConfigurationError for an invalid preset name', () => {
      expect(() => getCompressionPreset('invalid' as any)).toThrow(CompressionConfigurationError);
      expect(() => getCompressionPreset('invalid' as any)).toThrow(/Unknown compression preset: "invalid"/);
    });
  });

  describe('convenience factories', () => {
    it('compressionFast() should return named middleware', () => {
      const mw = compressionFast();
      expect(mw.name).toBe('compression');
      expect(typeof mw.execute).toBe('function');
    });

    it('compressionBest() should return named middleware', () => {
      const mw = compressionBest();
      expect(mw.name).toBe('compression');
      expect(typeof mw.execute).toBe('function');
    });

    it('compressionTextOnly() should return named middleware', () => {
      const mw = compressionTextOnly();
      expect(mw.name).toBe('compression');
      expect(typeof mw.execute).toBe('function');
    });

    it('compressionStreaming() should return named middleware', () => {
      const mw = compressionStreaming();
      expect(mw.name).toBe('compression');
      expect(typeof mw.execute).toBe('function');
    });
  });

  describe('ctx.response.sent tracking after compression', () => {
    it('should return true for ctx.response.sent when res.writableEnded is true', async () => {
      const mw = compression({ threshold: 0 });

      // Create a mock context where shouldCompress will skip (no accept-encoding)
      // so we can test the sent override independently
      const rawRes = {
        statusCode: 200,
        setHeader: vi.fn(),
        getHeader: vi.fn(),
        removeHeader: vi.fn(),
        end: vi.fn(),
        pipe: vi.fn(),
        on: vi.fn(),
        writableEnded: false,
        headersSent: false,
      };

      const ctx = {
        request: {
          raw: {} as any,
          method: 'GET',
          path: '/',
          url: null,
          query: {},
          params: {},
          protocol: 'http',
          isHttp2: false,
          header: (name: string) => name === 'accept-encoding' ? 'gzip' : undefined,
          headers: () => ({ 'accept-encoding': 'gzip' }),
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
      } as any;

      const mockLogger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        child: vi.fn().mockReturnThis(),
        flush: vi.fn(),
      };

      const mockEventBus = {
        serverId: 'test',
        publish: vi.fn(),
        subscribe: vi.fn(),
        setAdapter: vi.fn(),
        disconnect: vi.fn(),
      };

      // Execute the middleware — shouldCompress may or may not find an algorithm,
      // but the sent getter override is installed before compressResponse is called.
      await mw.execute({
        ctx,
        next: vi.fn(),
        logger: mockLogger as any,
        eventBus: mockEventBus as any,
      });

      // Simulate res.end() having been called (e.g. by compressResponse)
      rawRes.writableEnded = true;
      rawRes.headersSent = true;

      // The overridden getter should now return true
      expect(ctx.response.sent).toBe(true);
    });
  });
});

