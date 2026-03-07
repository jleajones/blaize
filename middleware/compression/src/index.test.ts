import { describe, it, expect } from 'vitest';
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
});

