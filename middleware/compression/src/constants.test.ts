import { describe, it, expect } from 'vitest';

import {
  COMPRESSIBLE_TYPES,
  SKIP_TYPES,
  DEFAULT_ALGORITHMS,
  ALGORITHM_LEVELS,
} from './constants';

describe('constants', () => {
  describe('DEFAULT_ALGORITHMS', () => {
    it('should be a readonly array', () => {
      expect(Array.isArray(DEFAULT_ALGORITHMS)).toBe(true);
    });

    it('should contain zstd, br, gzip, deflate in order', () => {
      expect(DEFAULT_ALGORITHMS).toEqual(['zstd', 'br', 'gzip', 'deflate']);
    });

    it('should have exactly 4 algorithms', () => {
      expect(DEFAULT_ALGORITHMS).toHaveLength(4);
    });
  });

  describe('COMPRESSIBLE_TYPES', () => {
    it('should be a non-empty readonly array', () => {
      expect(Array.isArray(COMPRESSIBLE_TYPES)).toBe(true);
      expect(COMPRESSIBLE_TYPES.length).toBeGreaterThan(0);
    });

    it('should include common text types', () => {
      expect(COMPRESSIBLE_TYPES).toContain('text/html');
      expect(COMPRESSIBLE_TYPES).toContain('text/css');
      expect(COMPRESSIBLE_TYPES).toContain('text/plain');
      expect(COMPRESSIBLE_TYPES).toContain('text/javascript');
    });

    it('should include common application types', () => {
      expect(COMPRESSIBLE_TYPES).toContain('application/json');
      expect(COMPRESSIBLE_TYPES).toContain('application/javascript');
      expect(COMPRESSIBLE_TYPES).toContain('application/xml');
    });

    it('should include SVG', () => {
      expect(COMPRESSIBLE_TYPES).toContain('image/svg+xml');
    });

    it('should contain only strings', () => {
      for (const type of COMPRESSIBLE_TYPES) {
        expect(typeof type).toBe('string');
      }
    });
  });

  describe('SKIP_TYPES', () => {
    it('should be a non-empty readonly array', () => {
      expect(Array.isArray(SKIP_TYPES)).toBe(true);
      expect(SKIP_TYPES.length).toBeGreaterThan(0);
    });

    it('should include common image types', () => {
      expect(SKIP_TYPES).toContain('image/png');
      expect(SKIP_TYPES).toContain('image/jpeg');
      expect(SKIP_TYPES).toContain('image/webp');
    });

    it('should include common video types', () => {
      expect(SKIP_TYPES).toContain('video/mp4');
      expect(SKIP_TYPES).toContain('video/webm');
    });

    it('should include compressed archive types', () => {
      expect(SKIP_TYPES).toContain('application/zip');
      expect(SKIP_TYPES).toContain('application/gzip');
    });

    it('should not overlap with COMPRESSIBLE_TYPES', () => {
      for (const type of SKIP_TYPES) {
        expect(COMPRESSIBLE_TYPES).not.toContain(type);
      }
    });

    it('should contain only strings', () => {
      for (const type of SKIP_TYPES) {
        expect(typeof type).toBe('string');
      }
    });
  });

  describe('ALGORITHM_LEVELS', () => {
    it('should have config for all non-identity algorithms', () => {
      expect(ALGORITHM_LEVELS).toHaveProperty('zstd');
      expect(ALGORITHM_LEVELS).toHaveProperty('br');
      expect(ALGORITHM_LEVELS).toHaveProperty('gzip');
      expect(ALGORITHM_LEVELS).toHaveProperty('deflate');
    });

    it('should have correct zstd levels', () => {
      expect(ALGORITHM_LEVELS['zstd']!.defaultLevel).toBe(3);
      expect(ALGORITHM_LEVELS['zstd']!.maxLevel).toBe(22);
    });

    it('should have correct brotli levels', () => {
      expect(ALGORITHM_LEVELS['br']!.defaultLevel).toBe(4);
      expect(ALGORITHM_LEVELS['br']!.maxLevel).toBe(11);
    });

    it('should have correct gzip levels', () => {
      expect(ALGORITHM_LEVELS['gzip']!.defaultLevel).toBe(6);
      expect(ALGORITHM_LEVELS['gzip']!.maxLevel).toBe(9);
    });

    it('should have correct deflate levels', () => {
      expect(ALGORITHM_LEVELS['deflate']!.defaultLevel).toBe(6);
      expect(ALGORITHM_LEVELS['deflate']!.maxLevel).toBe(9);
    });

    it('should have minLevel <= defaultLevel <= maxLevel for all algorithms', () => {
      for (const [, config] of Object.entries(ALGORITHM_LEVELS)) {
        expect(config.minLevel).toBeLessThanOrEqual(config.defaultLevel);
        expect(config.defaultLevel).toBeLessThanOrEqual(config.maxLevel);
      }
    });

    it('should have fastestLevel >= minLevel for all algorithms', () => {
      for (const [, config] of Object.entries(ALGORITHM_LEVELS)) {
        expect(config.fastestLevel).toBeGreaterThanOrEqual(config.minLevel);
      }
    });
  });
});

