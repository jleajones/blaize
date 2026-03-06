import { describe, it, expect } from 'vitest';

import { CompressionConfigurationError } from './errors';
import { parseCompressionOptions } from './validation';

describe('parseCompressionOptions', () => {
  describe('defaults', () => {
    it('should apply all defaults when given an empty object', () => {
      const result = parseCompressionOptions({});
      expect(result.algorithms).toEqual(['br', 'gzip', 'deflate']);
      expect(result.level).toBe('default');
      expect(result.threshold).toBe(1024);
      expect(result.vary).toBe(true);
      expect(result.flush).toBe(false);
      expect(result.memoryLevel).toBe(8);
    });

    it('should not override explicitly provided values with defaults', () => {
      const result = parseCompressionOptions({ threshold: 512, vary: false });
      expect(result.threshold).toBe(512);
      expect(result.vary).toBe(false);
      // Other defaults still applied
      expect(result.algorithms).toEqual(['br', 'gzip', 'deflate']);
      expect(result.level).toBe('default');
    });
  });

  describe('valid configurations', () => {
    it('should accept a full valid config', () => {
      const result = parseCompressionOptions({
        algorithms: ['br', 'gzip', 'deflate'],
        level: 'default',
        threshold: 1024,
        vary: true,
        flush: false,
        memoryLevel: 8,
        windowBits: 15,
        brotliQuality: 4,
        preset: 'balanced',
      });
      expect(result.algorithms).toEqual(['br', 'gzip', 'deflate']);
      expect(result.level).toBe('default');
      expect(result.threshold).toBe(1024);
      expect(result.memoryLevel).toBe(8);
    });

    it('should accept level as a number', () => {
      const result = parseCompressionOptions({ level: 6 });
      expect(result.level).toBe(6);
    });

    it('should accept level preset "fastest"', () => {
      const result = parseCompressionOptions({ level: 'fastest' });
      expect(result.level).toBe('fastest');
    });

    it('should accept level preset "best"', () => {
      const result = parseCompressionOptions({ level: 'best' });
      expect(result.level).toBe('best');
    });

    it('should accept identity algorithm', () => {
      const result = parseCompressionOptions({ algorithms: ['identity'] });
      expect(result.algorithms).toEqual(['identity']);
    });

    it('should accept contentTypeFilter as config object', () => {
      const result = parseCompressionOptions({
        contentTypeFilter: { include: ['text/*'], exclude: ['text/event-stream'] },
      });
      expect(result.contentTypeFilter).toEqual({
        include: ['text/*'],
        exclude: ['text/event-stream'],
      });
    });
  });

  describe('boundary values', () => {
    it('should accept threshold of 0', () => {
      const result = parseCompressionOptions({ threshold: 0 });
      expect(result.threshold).toBe(0);
    });

    it('should accept memoryLevel of 1', () => {
      const result = parseCompressionOptions({ memoryLevel: 1 });
      expect(result.memoryLevel).toBe(1);
    });

    it('should accept memoryLevel of 9', () => {
      const result = parseCompressionOptions({ memoryLevel: 9 });
      expect(result.memoryLevel).toBe(9);
    });

    it('should accept brotliQuality of 0', () => {
      const result = parseCompressionOptions({ brotliQuality: 0 });
      expect(result.brotliQuality).toBe(0);
    });

    it('should accept brotliQuality of 11', () => {
      const result = parseCompressionOptions({ brotliQuality: 11 });
      expect(result.brotliQuality).toBe(11);
    });
  });

  describe('invalid configurations', () => {
    it('should throw for invalid algorithm', () => {
      expect(() =>
        parseCompressionOptions({ algorithms: ['lz4' as any] })
      ).toThrow(CompressionConfigurationError);
    });

    it('should throw for empty algorithms array', () => {
      expect(() =>
        parseCompressionOptions({ algorithms: [] })
      ).toThrow(CompressionConfigurationError);
    });

    it('should throw for negative threshold', () => {
      expect(() =>
        parseCompressionOptions({ threshold: -1 })
      ).toThrow(CompressionConfigurationError);
    });

    it('should throw for non-integer threshold', () => {
      expect(() =>
        parseCompressionOptions({ threshold: 1.5 })
      ).toThrow(CompressionConfigurationError);
    });

    it('should throw for memoryLevel below 1', () => {
      expect(() =>
        parseCompressionOptions({ memoryLevel: 0 })
      ).toThrow(CompressionConfigurationError);
    });

    it('should throw for memoryLevel above 9', () => {
      expect(() =>
        parseCompressionOptions({ memoryLevel: 10 })
      ).toThrow(CompressionConfigurationError);
    });

    it('should throw for brotliQuality above 11', () => {
      expect(() =>
        parseCompressionOptions({ brotliQuality: 12 })
      ).toThrow(CompressionConfigurationError);
    });

    it('should throw for brotliQuality below 0', () => {
      expect(() =>
        parseCompressionOptions({ brotliQuality: -1 })
      ).toThrow(CompressionConfigurationError);
    });

    it('should throw for invalid preset', () => {
      expect(() =>
        parseCompressionOptions({ preset: 'turbo' as any })
      ).toThrow(CompressionConfigurationError);
    });

    it('should include field name in error details', () => {
      try {
        parseCompressionOptions({ threshold: -1 });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(CompressionConfigurationError);
        expect((error as CompressionConfigurationError).details).toHaveProperty('field', 'threshold');
      }
    });
  });
});

