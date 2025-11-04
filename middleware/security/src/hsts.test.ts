/**
 * Unit tests for HSTS header builder
 */

import { buildHSTSHeader } from './hsts.js';

import type { HSTSOptions } from './types.js';

describe('buildHSTSHeader', () => {
  // Store original NODE_ENV
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    // Reset NODE_ENV before each test
    process.env.NODE_ENV = originalEnv;
  });

  afterEach(() => {
    // Restore original NODE_ENV after each test
    process.env.NODE_ENV = originalEnv;
  });

  describe('Environment-based behavior', () => {
    it('should return null in development environment', () => {
      process.env.NODE_ENV = 'development';

      const result = buildHSTSHeader({
        maxAge: 31536000,
        includeSubDomains: true,
      });

      expect(result).toBeNull();
    });

    it('should return null when NODE_ENV is not set', () => {
      delete process.env.NODE_ENV;

      const result = buildHSTSHeader({
        maxAge: 31536000,
      });

      expect(result).toBeNull();
    });

    it('should return null in test environment', () => {
      process.env.NODE_ENV = 'test';

      const result = buildHSTSHeader({
        maxAge: 31536000,
      });

      expect(result).toBeNull();
    });

    it('should build header in production environment', () => {
      process.env.NODE_ENV = 'production';

      const result = buildHSTSHeader({
        maxAge: 31536000,
      });

      expect(result).not.toBeNull();
      expect(result).toBe('max-age=31536000');
    });
  });

  describe('Production environment header building', () => {
    beforeEach(() => {
      // Set production for all tests in this suite
      process.env.NODE_ENV = 'production';
    });

    describe('max-age directive', () => {
      it('should include max-age directive', () => {
        const result = buildHSTSHeader({
          maxAge: 31536000,
        });

        expect(result).toBe('max-age=31536000');
      });

      it('should handle different max-age values', () => {
        expect(buildHSTSHeader({ maxAge: 300 })).toBe('max-age=300');
        expect(buildHSTSHeader({ maxAge: 31536000 })).toBe('max-age=31536000');
        expect(buildHSTSHeader({ maxAge: 63072000 })).toBe('max-age=63072000');
      });

      it('should handle max-age of 0', () => {
        const result = buildHSTSHeader({
          maxAge: 0,
        });

        expect(result).toBe('max-age=0');
      });

      it('should always start with max-age', () => {
        const result = buildHSTSHeader({
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true,
        });

        expect(result).toMatch(/^max-age=/);
      });
    });

    describe('includeSubDomains directive', () => {
      it('should include includeSubDomains when true', () => {
        const result = buildHSTSHeader({
          maxAge: 31536000,
          includeSubDomains: true,
        });

        expect(result).toBe('max-age=31536000; includeSubDomains');
      });

      it('should omit includeSubDomains when false', () => {
        const result = buildHSTSHeader({
          maxAge: 31536000,
          includeSubDomains: false,
        });

        expect(result).toBe('max-age=31536000');
      });

      it('should omit includeSubDomains when undefined', () => {
        const result = buildHSTSHeader({
          maxAge: 31536000,
        });

        expect(result).toBe('max-age=31536000');
        expect(result).not.toContain('includeSubDomains');
      });
    });

    describe('preload directive', () => {
      it('should include preload when true', () => {
        const result = buildHSTSHeader({
          maxAge: 63072000,
          preload: true,
        });

        expect(result).toBe('max-age=63072000; preload');
      });

      it('should omit preload when false', () => {
        const result = buildHSTSHeader({
          maxAge: 63072000,
          preload: false,
        });

        expect(result).toBe('max-age=63072000');
      });

      it('should omit preload when undefined', () => {
        const result = buildHSTSHeader({
          maxAge: 63072000,
        });

        expect(result).toBe('max-age=63072000');
        expect(result).not.toContain('preload');
      });
    });

    describe('Combined directives', () => {
      it('should handle max-age only', () => {
        const result = buildHSTSHeader({
          maxAge: 31536000,
        });

        expect(result).toBe('max-age=31536000');
      });

      it('should handle max-age + includeSubDomains', () => {
        const result = buildHSTSHeader({
          maxAge: 31536000,
          includeSubDomains: true,
        });

        expect(result).toBe('max-age=31536000; includeSubDomains');
      });

      it('should handle max-age + preload', () => {
        const result = buildHSTSHeader({
          maxAge: 63072000,
          preload: true,
        });

        expect(result).toBe('max-age=63072000; preload');
      });

      it('should handle all directives enabled', () => {
        const result = buildHSTSHeader({
          maxAge: 63072000,
          includeSubDomains: true,
          preload: true,
        });

        expect(result).toBe('max-age=63072000; includeSubDomains; preload');
      });

      it('should handle includeSubDomains=true, preload=false', () => {
        const result = buildHSTSHeader({
          maxAge: 31536000,
          includeSubDomains: true,
          preload: false,
        });

        expect(result).toBe('max-age=31536000; includeSubDomains');
      });

      it('should handle includeSubDomains=false, preload=true', () => {
        const result = buildHSTSHeader({
          maxAge: 63072000,
          includeSubDomains: false,
          preload: true,
        });

        expect(result).toBe('max-age=63072000; preload');
      });

      it('should handle all directives disabled', () => {
        const result = buildHSTSHeader({
          maxAge: 31536000,
          includeSubDomains: false,
          preload: false,
        });

        expect(result).toBe('max-age=31536000');
      });
    });

    describe('Directive ordering', () => {
      it('should always order as: max-age, includeSubDomains, preload', () => {
        const result = buildHSTSHeader({
          maxAge: 63072000,
          includeSubDomains: true,
          preload: true,
        });

        const parts = result!.split('; ');
        expect(parts[0]).toBe('max-age=63072000');
        expect(parts[1]).toBe('includeSubDomains');
        expect(parts[2]).toBe('preload');
      });

      it('should maintain order when only some directives present', () => {
        const result = buildHSTSHeader({
          maxAge: 31536000,
          preload: true,
        });

        const parts = result!.split('; ');
        expect(parts[0]).toBe('max-age=31536000');
        expect(parts[1]).toBe('preload');
        expect(parts).toHaveLength(2);
      });
    });

    describe('Directive separator', () => {
      it('should use semicolon-space as separator', () => {
        const result = buildHSTSHeader({
          maxAge: 31536000,
          includeSubDomains: true,
        });

        expect(result).toContain('; ');
        expect(result).not.toContain(';includeSubDomains');
      });

      it('should not add trailing semicolon', () => {
        const result = buildHSTSHeader({
          maxAge: 31536000,
          includeSubDomains: true,
        });

        expect(result).not.toMatch(/;$/);
      });
    });
  });

  describe('Real-world configurations', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('should build recommended production config', () => {
      const result = buildHSTSHeader({
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
      });

      expect(result).toBe('max-age=31536000; includeSubDomains');
    });

    it('should build preload-ready config', () => {
      const result = buildHSTSHeader({
        maxAge: 63072000, // 2 years (preload requirement)
        includeSubDomains: true,
        preload: true,
      });

      expect(result).toBe('max-age=63072000; includeSubDomains; preload');
    });

    it('should build minimal production config', () => {
      const result = buildHSTSHeader({
        maxAge: 31536000,
      });

      expect(result).toBe('max-age=31536000');
    });

    it('should build testing config (short max-age)', () => {
      const result = buildHSTSHeader({
        maxAge: 300, // 5 minutes for testing
      });

      expect(result).toBe('max-age=300');
    });
  });

  describe('Edge cases', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('should handle very large max-age values', () => {
      const result = buildHSTSHeader({
        maxAge: 999999999,
      });

      expect(result).toBe('max-age=999999999');
    });

    it('should handle max-age of 1', () => {
      const result = buildHSTSHeader({
        maxAge: 1,
      });

      expect(result).toBe('max-age=1');
    });

    it('should return string with correct type in production', () => {
      const result = buildHSTSHeader({
        maxAge: 31536000,
      });

      expect(typeof result).toBe('string');
      expect(result).not.toBeNull();
    });

    it('should return null with correct type in development', () => {
      process.env.NODE_ENV = 'development';

      const result = buildHSTSHeader({
        maxAge: 31536000,
      });

      expect(result).toBeNull();
    });
  });

  describe('HSTS specification compliance', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('should format max-age with equals sign', () => {
      const result = buildHSTSHeader({
        maxAge: 31536000,
      });

      expect(result).toMatch(/^max-age=\d+/);
    });

    it('should use correct case for includeSubDomains', () => {
      const result = buildHSTSHeader({
        maxAge: 31536000,
        includeSubDomains: true,
      });

      expect(result).toContain('includeSubDomains');
      expect(result).not.toContain('includesubdomains');
      expect(result).not.toContain('IncludeSubDomains');
    });

    it('should use correct case for preload', () => {
      const result = buildHSTSHeader({
        maxAge: 63072000,
        preload: true,
      });

      expect(result).toContain('preload');
      expect(result).not.toContain('Preload');
      expect(result).not.toContain('PRELOAD');
    });

    it('should not include values for boolean directives', () => {
      const result = buildHSTSHeader({
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      });

      expect(result).not.toContain('includeSubDomains=');
      expect(result).not.toContain('preload=');
    });
  });

  describe('Type safety', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('should accept HSTSOptions type', () => {
      const options: HSTSOptions = {
        maxAge: 31536000,
        includeSubDomains: true,
      };

      const result = buildHSTSHeader(options);

      expect(result).toBe('max-age=31536000; includeSubDomains');
    });

    it('should accept minimal HSTSOptions', () => {
      const options: HSTSOptions = {
        maxAge: 31536000,
      };

      const result = buildHSTSHeader(options);

      expect(result).toBe('max-age=31536000');
    });

    it('should accept full HSTSOptions', () => {
      const options: HSTSOptions = {
        maxAge: 63072000,
        includeSubDomains: true,
        preload: true,
      };

      const result = buildHSTSHeader(options);

      expect(result).toBe('max-age=63072000; includeSubDomains; preload');
    });
  });
});
