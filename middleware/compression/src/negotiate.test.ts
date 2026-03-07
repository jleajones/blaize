import { describe, it, expect } from 'vitest';

import { negotiateEncoding, isAcceptEncodingEmpty } from './negotiate';
import type { CompressionAlgorithm } from './types';

describe('negotiate', () => {
  describe('negotiateEncoding', () => {
    it('should return server-preferred algorithm when multiple are accepted with equal quality', () => {
      const result = negotiateEncoding('gzip, zstd, br', ['zstd', 'br', 'gzip', 'deflate']);
      expect(result).toBe('zstd');
    });

    it('should prefer higher quality over server preference', () => {
      const result = negotiateEncoding('gzip;q=0.8, br;q=0.9', ['gzip', 'br']);
      expect(result).toBe('br');
    });

    it('should return the only matching algorithm', () => {
      const result = negotiateEncoding('gzip', ['gzip']);
      expect(result).toBe('gzip');
    });

    it('should return null for identity encoding', () => {
      const result = negotiateEncoding('identity', ['gzip', 'identity']);
      expect(result).toBeNull();
    });

    it('should match wildcard to first available algorithm', () => {
      const result = negotiateEncoding('*', ['zstd', 'br', 'gzip']);
      expect(result).toBe('zstd');
    });

    it('should skip identity;q=0 and return gzip', () => {
      const result = negotiateEncoding('identity;q=0, gzip', ['gzip']);
      expect(result).toBe('gzip');
    });

    it('should return null for malformed header without throwing', () => {
      expect(() => negotiateEncoding(';;;;', ['gzip'])).not.toThrow();
      const result = negotiateEncoding(';;;;', ['gzip']);
      expect(result).toBeNull();
    });

    it('should handle Chrome real-world Accept-Encoding header', () => {
      const result = negotiateEncoding('gzip, deflate, br, zstd', [
        'zstd',
        'br',
        'gzip',
        'deflate',
      ]);
      expect(result).toBe('zstd');
    });

    it('should return null for empty header', () => {
      expect(negotiateEncoding('', ['gzip'])).toBeNull();
    });

    it('should return null for whitespace-only header', () => {
      expect(negotiateEncoding('   ', ['gzip'])).toBeNull();
    });

    it('should handle case insensitivity', () => {
      const result = negotiateEncoding('GZIP', ['gzip']);
      expect(result).toBe('gzip');
    });

    it('should return null when no available algorithms match', () => {
      const result = negotiateEncoding('br', ['gzip', 'deflate']);
      expect(result).toBeNull();
    });

    it('should handle q=0 to reject an algorithm', () => {
      const result = negotiateEncoding('gzip;q=0, br', ['gzip', 'br']);
      expect(result).toBe('br');
    });

    it('should handle mixed quality values with server preference as tiebreaker', () => {
      const result = negotiateEncoding('gzip;q=0.5, br;q=0.5', ['br', 'gzip']);
      expect(result).toBe('br');
    });

    it('should handle wildcard with explicit rejections', () => {
      const result = negotiateEncoding('*, gzip;q=0', ['gzip', 'br', 'zstd']);
      expect(result).toBe('br');
    });

    it('should return null when all algorithms are rejected', () => {
      const result = negotiateEncoding('gzip;q=0, br;q=0', ['gzip', 'br']);
      expect(result).toBeNull();
    });

    it('should return null when identity wins negotiation via wildcard', () => {
      // identity is first in available, wildcard gives both q=1, identity wins
      const result = negotiateEncoding('*', ['identity', 'gzip'] as CompressionAlgorithm[]);
      expect(result).toBeNull();
    });

    it('should return null when identity is explicitly preferred over compression', () => {
      const result = negotiateEncoding('identity;q=1.0, gzip;q=0.5', [
        'gzip',
        'identity',
      ] as CompressionAlgorithm[]);
      expect(result).toBeNull();
    });

    it('should return gzip when *;q=0 rejects everything except explicit gzip', () => {
      const result = negotiateEncoding('*;q=0, gzip;q=1.0', ['gzip']);
      expect(result).toBe('gzip');
    });

    it('should return null when *;q=0 with no explicit algorithms', () => {
      const result = negotiateEncoding('*;q=0', ['gzip', 'br']);
      expect(result).toBeNull();
    });
  });

  describe('isAcceptEncodingEmpty', () => {
    it('should return true for undefined', () => {
      expect(isAcceptEncodingEmpty(undefined)).toBe(true);
    });

    it('should return true for empty string', () => {
      expect(isAcceptEncodingEmpty('')).toBe(true);
    });

    it('should return true for whitespace-only string', () => {
      expect(isAcceptEncodingEmpty('   ')).toBe(true);
    });

    it('should return false for non-empty header', () => {
      expect(isAcceptEncodingEmpty('gzip')).toBe(false);
    });

    it('should return false for wildcard', () => {
      expect(isAcceptEncodingEmpty('*')).toBe(false);
    });
  });
});

