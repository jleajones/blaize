import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import zlib from 'node:zlib';
import { Transform } from 'node:stream';

import {
  detectAvailableAlgorithms,
  createCompressorStream,
  getCompressionLevel,
} from './algorithms';

describe('detectAvailableAlgorithms', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should always include gzip and deflate', () => {
    const result = detectAvailableAlgorithms(['gzip', 'deflate']);
    expect(result).toEqual(['gzip', 'deflate']);
  });

  it('should include identity', () => {
    const result = detectAvailableAlgorithms(['identity']);
    expect(result).toEqual(['identity']);
  });

  it('should preserve input order', () => {
    const result = detectAvailableAlgorithms(['deflate', 'gzip']);
    expect(result).toEqual(['deflate', 'gzip']);
  });

  it('should include brotli when available', () => {
    // Brotli is available in Node.js 10.16+
    const result = detectAvailableAlgorithms(['br', 'gzip']);
    expect(result).toContain('br');
  });

  it('should silently exclude zstd when not available', () => {
    // Save original
    const original = (zlib as any).createZstdCompress;
    // Remove zstd support
    (zlib as any).createZstdCompress = undefined;

    vi.spyOn(console, 'warn');
    vi.spyOn(console, 'log');

    try {
      const result = detectAvailableAlgorithms(['zstd', 'br', 'gzip', 'deflate']);

      expect(result).not.toContain('zstd');
      expect(result).toContain('br');
      expect(result).toContain('gzip');
      expect(result).toContain('deflate');

      // Verify NO log output occurred
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.log).not.toHaveBeenCalled();
    } finally {
      // Restore original
      (zlib as any).createZstdCompress = original;
    }
  });

  it('should silently exclude brotli when not available', () => {
    const originalBrotli = zlib.createBrotliCompress;
    Object.defineProperty(zlib, 'createBrotliCompress', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    try {
      const result = detectAvailableAlgorithms(['br', 'gzip']);

      expect(result).not.toContain('br');
      expect(result).toContain('gzip');
    } finally {
      Object.defineProperty(zlib, 'createBrotliCompress', {
        value: originalBrotli,
        writable: false,
        configurable: true,
      });
    }
  });

  it('should return empty array when no algorithms are available', () => {
    const originalZstd = (zlib as any).createZstdCompress;
    const originalBrotli = zlib.createBrotliCompress;
    (zlib as any).createZstdCompress = undefined;
    Object.defineProperty(zlib, 'createBrotliCompress', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    try {
      const result = detectAvailableAlgorithms(['zstd', 'br']);
      expect(result).toEqual([]);
    } finally {
      (zlib as any).createZstdCompress = originalZstd;
      Object.defineProperty(zlib, 'createBrotliCompress', {
        value: originalBrotli,
        writable: false,
        configurable: true,
      });
    }
  });

  it('should return empty array for empty input', () => {
    const result = detectAvailableAlgorithms([]);
    expect(result).toEqual([]);
  });
});

describe('createCompressorStream', () => {
  it('should return a Transform stream for gzip', () => {
    const stream = createCompressorStream('gzip');
    expect(stream).toBeInstanceOf(Transform);
    stream.destroy();
  });

  it('should return a Transform stream for deflate', () => {
    const stream = createCompressorStream('deflate');
    expect(stream).toBeInstanceOf(Transform);
    stream.destroy();
  });

  it('should return a Transform stream for brotli', () => {
    const stream = createCompressorStream('br');
    expect(stream).toBeInstanceOf(Transform);
    stream.destroy();
  });

  it('should accept compression level option', () => {
    const stream = createCompressorStream('gzip', { level: 9 });
    expect(stream).toBeInstanceOf(Transform);
    stream.destroy();
  });

  it('should accept memoryLevel option for gzip', () => {
    const stream = createCompressorStream('gzip', { memoryLevel: 4 });
    expect(stream).toBeInstanceOf(Transform);
    stream.destroy();
  });

  it('should throw for unsupported algorithm', () => {
    // 'identity' is excluded from CompressibleAlgorithm at the type level,
    // but we verify runtime behavior with a cast
    expect(() => createCompressorStream('identity' as any)).toThrow('Unsupported');
  });

  it('should throw for zstd when not available', () => {
    const original = (zlib as any).createZstdCompress;
    (zlib as any).createZstdCompress = undefined;

    expect(() => createCompressorStream('zstd')).toThrow('not available');

    (zlib as any).createZstdCompress = original;
  });
});

describe('getCompressionLevel', () => {
  it('should return default level for each algorithm', () => {
    expect(getCompressionLevel('zstd', 'default')).toBe(3);
    expect(getCompressionLevel('br', 'default')).toBe(4);
    expect(getCompressionLevel('gzip', 'default')).toBe(6);
    expect(getCompressionLevel('deflate', 'default')).toBe(6);
  });

  it('should return fastest level for each algorithm', () => {
    expect(getCompressionLevel('zstd', 'fastest')).toBe(1);
    expect(getCompressionLevel('br', 'fastest')).toBe(1);
    expect(getCompressionLevel('gzip', 'fastest')).toBe(1);
    expect(getCompressionLevel('deflate', 'fastest')).toBe(1);
  });

  it('should return best (max) level for each algorithm', () => {
    expect(getCompressionLevel('zstd', 'best')).toBe(22);
    expect(getCompressionLevel('br', 'best')).toBe(11);
    expect(getCompressionLevel('gzip', 'best')).toBe(9);
    expect(getCompressionLevel('deflate', 'best')).toBe(9);
  });

  it('should pass through numeric levels within range', () => {
    expect(getCompressionLevel('gzip', 5)).toBe(5);
    expect(getCompressionLevel('br', 7)).toBe(7);
    expect(getCompressionLevel('zstd', 10)).toBe(10);
  });

  it('should clamp numeric levels to max', () => {
    expect(getCompressionLevel('gzip', 100)).toBe(9);
    expect(getCompressionLevel('br', 15)).toBe(11);
    expect(getCompressionLevel('zstd', 30)).toBe(22);
    expect(getCompressionLevel('deflate', 99)).toBe(9);
  });

  it('should clamp numeric levels to min', () => {
    expect(getCompressionLevel('gzip', 0)).toBe(1);
    expect(getCompressionLevel('br', -1)).toBe(0);
    expect(getCompressionLevel('zstd', 0)).toBe(1);
  });

  it('should default to "default" when no level is provided', () => {
    expect(getCompressionLevel('gzip')).toBe(6);
    expect(getCompressionLevel('br')).toBe(4);
  });

  it('should handle identity algorithm gracefully', () => {
    // identity has no config, should return a reasonable default
    const result = getCompressionLevel('identity', 'default');
    expect(typeof result).toBe('number');
  });
});

