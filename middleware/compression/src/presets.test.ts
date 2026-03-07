import { describe, it, expect } from 'vitest';

import { compressionPresets } from './presets';
import { parseCompressionOptions } from './validation';

describe('compressionPresets', () => {
  describe('all presets pass Zod validation', () => {
    const presetNames = Object.keys(compressionPresets) as Array<keyof typeof compressionPresets>;

    it.each(presetNames)('preset "%s" passes parseCompressionOptions', (name) => {
      expect(() => parseCompressionOptions(compressionPresets[name])).not.toThrow();
    });
  });

  describe('default preset', () => {
    it('should have threshold 1024', () => {
      expect(compressionPresets.default.threshold).toBe(1024);
    });

    it('should have flush false', () => {
      expect(compressionPresets.default.flush).toBe(false);
    });

    it('should have level "default"', () => {
      expect(compressionPresets.default.level).toBe('default');
    });
  });

  describe('fast preset', () => {
    it('should have threshold 1024', () => {
      expect(compressionPresets.fast.threshold).toBe(1024);
    });

    it('should have flush false', () => {
      expect(compressionPresets.fast.flush).toBe(false);
    });

    it('should have level "fastest"', () => {
      expect(compressionPresets.fast.level).toBe('fastest');
    });
  });

  describe('best preset', () => {
    it('should have threshold 512', () => {
      expect(compressionPresets.best.threshold).toBe(512);
    });

    it('should have flush false', () => {
      expect(compressionPresets.best.flush).toBe(false);
    });

    it('should have level "best"', () => {
      expect(compressionPresets.best.level).toBe('best');
    });
  });

  describe('text-only preset', () => {
    it('should have threshold 1024', () => {
      expect(compressionPresets['text-only'].threshold).toBe(1024);
    });

    it('should have flush false', () => {
      expect(compressionPresets['text-only'].flush).toBe(false);
    });

    it('should have level "default"', () => {
      expect(compressionPresets['text-only'].level).toBe('default');
    });

    it('should have contentTypeFilter with include text/*', () => {
      expect(compressionPresets['text-only'].contentTypeFilter).toEqual({
        include: ['text/*'],
      });
    });
  });

  describe('streaming preset', () => {
    it('should have threshold 0', () => {
      expect(compressionPresets.streaming.threshold).toBe(0);
    });

    it('should have flush true', () => {
      expect(compressionPresets.streaming.flush).toBe(true);
    });

    it('should have level "default"', () => {
      expect(compressionPresets.streaming.level).toBe('default');
    });
  });

  describe('preset count', () => {
    it('should have exactly 5 presets', () => {
      expect(Object.keys(compressionPresets)).toHaveLength(5);
    });

    it('should have all expected preset names', () => {
      expect(Object.keys(compressionPresets).sort()).toEqual(
        ['best', 'default', 'fast', 'streaming', 'text-only'].sort(),
      );
    });
  });
});

