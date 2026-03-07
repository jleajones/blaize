import { describe, it, expect } from 'vitest';
import type { Context } from '@blaize-types/context';
import { isCompressible, createContentTypeFilter, extractMimeType } from './filter';

const mockCtx = {} as Context;

describe('filter', () => {
  describe('extractMimeType', () => {
    it('should extract mime type from content-type with parameters', () => {
      expect(extractMimeType('application/json; charset=utf-8')).toBe('application/json');
    });

    it('should return null for undefined', () => {
      expect(extractMimeType(undefined)).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(extractMimeType('')).toBeNull();
    });

    it('should lowercase the result', () => {
      expect(extractMimeType('Application/JSON')).toBe('application/json');
    });

    it('should handle content-type without parameters', () => {
      expect(extractMimeType('text/html')).toBe('text/html');
    });
  });

  describe('isCompressible', () => {
    it('should return true for application/json', () => {
      expect(isCompressible('application/json')).toBe(true);
    });

    it('should return false for image/png', () => {
      expect(isCompressible('image/png')).toBe(false);
    });

    it('should return true for text/html', () => {
      expect(isCompressible('text/html')).toBe(true);
    });

    it('should return false for application/octet-stream', () => {
      expect(isCompressible('application/octet-stream')).toBe(false);
    });

    it('should handle content-type with parameters', () => {
      expect(isCompressible('application/json; charset=utf-8')).toBe(true);
    });

    it('should be case-insensitive', () => {
      expect(isCompressible('Application/JSON')).toBe(true);
      expect(isCompressible('TEXT/HTML')).toBe(true);
    });

    it('should return false for empty/undefined mime type', () => {
      expect(isCompressible('')).toBe(false);
    });

    it('should return true for text/* subtypes via broad match', () => {
      expect(isCompressible('text/custom-type')).toBe(true);
    });
  });

  describe('createContentTypeFilter', () => {
    describe('function shape', () => {
      it('should use the provided function directly', () => {
        const filter = createContentTypeFilter((mime) => mime === 'text/html');
        expect(filter('text/html', mockCtx)).toBe(true);
        expect(filter('application/json', mockCtx)).toBe(false);
      });
    });

    describe('boolean shape', () => {
      it('should compress all when true', () => {
        const filter = createContentTypeFilter(true);
        expect(filter('image/png', mockCtx)).toBe(true);
        expect(filter('application/json', mockCtx)).toBe(true);
      });

      it('should compress none when false', () => {
        const filter = createContentTypeFilter(false);
        expect(filter('text/html', mockCtx)).toBe(false);
        expect(filter('application/json', mockCtx)).toBe(false);
      });
    });

    describe('config object shape', () => {
      it('should include matching types', () => {
        const filter = createContentTypeFilter({ include: ['text/*'] });
        expect(filter('text/html', mockCtx)).toBe(true);
        expect(filter('text/plain', mockCtx)).toBe(true);
        expect(filter('application/json', mockCtx)).toBe(false);
      });

      it('should exclude matching types', () => {
        const filter = createContentTypeFilter({ exclude: ['image/*'] });
        expect(filter('text/html', mockCtx)).toBe(true);
        expect(filter('image/png', mockCtx)).toBe(false);
      });

      it('should give exclude precedence over include', () => {
        const filter = createContentTypeFilter({
          include: ['text/*'],
          exclude: ['text/csv'],
        });
        expect(filter('text/html', mockCtx)).toBe(true);
        expect(filter('text/csv', mockCtx)).toBe(false);
      });

      it('should support exact match patterns', () => {
        const filter = createContentTypeFilter({
          include: ['application/json'],
        });
        expect(filter('application/json', mockCtx)).toBe(true);
        expect(filter('application/xml', mockCtx)).toBe(false);
      });
    });

    describe('undefined/default shape', () => {
      it('should fall back to isCompressible', () => {
        const filter = createContentTypeFilter();
        expect(filter('application/json', mockCtx)).toBe(true);
        expect(filter('image/png', mockCtx)).toBe(false);
        expect(filter('text/html', mockCtx)).toBe(true);
      });
    });
  });
});

