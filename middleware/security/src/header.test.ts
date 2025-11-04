/**
 * Unit tests for security headers helper
 */

import { applySecurityHeaders } from './headers.js';

import type { SecurityOptions } from './types.js';
import type { Context } from 'blaizejs';

// Mock BlaizeJS Context
function createMockContext(): Context {
  const headers = new Map<string, string>();

  return {
    request: {} as any,
    response: {
      header: vi.fn((name: string, value: string) => {
        headers.set(name, value);
      }),
      // Helper to get headers for testing
      _getHeaders: () => headers,
    } as any,
  } as Context;
}

describe('applySecurityHeaders', () => {
  let ctx: Context;

  beforeEach(() => {
    // Create fresh mock context for each test
    ctx = createMockContext();
    // Set NODE_ENV to production for HSTS tests
    process.env.NODE_ENV = 'production';
  });

  describe('Content Security Policy (CSP)', () => {
    it('should set Content-Security-Policy header when csp is configured', () => {
      const options: SecurityOptions = {
        csp: {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", 'https://cdn.example.com'],
          },
        },
      };

      applySecurityHeaders(ctx, options);

      expect(ctx.response.header).toHaveBeenCalledWith(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self' https://cdn.example.com"
      );
    });

    it('should set Content-Security-Policy-Report-Only when reportOnly is true', () => {
      const options: SecurityOptions = {
        csp: {
          directives: {
            defaultSrc: ["'self'"],
          },
          reportOnly: true,
        },
      };

      applySecurityHeaders(ctx, options);

      expect(ctx.response.header).toHaveBeenCalledWith(
        'Content-Security-Policy-Report-Only',
        "default-src 'self'"
      );
      expect(ctx.response.header).not.toHaveBeenCalledWith(
        'Content-Security-Policy',
        expect.any(String)
      );
    });

    it('should skip CSP header when csp is false', () => {
      const options: SecurityOptions = {
        csp: false,
      };

      applySecurityHeaders(ctx, options);

      expect(ctx.response.header).not.toHaveBeenCalledWith(
        'Content-Security-Policy',
        expect.any(String)
      );
      expect(ctx.response.header).not.toHaveBeenCalledWith(
        'Content-Security-Policy-Report-Only',
        expect.any(String)
      );
    });

    it('should skip CSP header when csp is undefined', () => {
      const options: SecurityOptions = {};

      applySecurityHeaders(ctx, options);

      expect(ctx.response.header).not.toHaveBeenCalledWith(
        'Content-Security-Policy',
        expect.any(String)
      );
    });
  });

  describe('HTTP Strict Transport Security (HSTS)', () => {
    it('should set Strict-Transport-Security header when hsts is configured', () => {
      const options: SecurityOptions = {
        hsts: {
          maxAge: 31536000,
          includeSubDomains: true,
        },
      };

      applySecurityHeaders(ctx, options);

      expect(ctx.response.header).toHaveBeenCalledWith(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains'
      );
    });

    it('should skip HSTS header when hsts is false', () => {
      const options: SecurityOptions = {
        hsts: false,
      };

      applySecurityHeaders(ctx, options);

      expect(ctx.response.header).not.toHaveBeenCalledWith(
        'Strict-Transport-Security',
        expect.any(String)
      );
    });

    it('should skip HSTS header when hsts is undefined', () => {
      const options: SecurityOptions = {};

      applySecurityHeaders(ctx, options);

      expect(ctx.response.header).not.toHaveBeenCalledWith(
        'Strict-Transport-Security',
        expect.any(String)
      );
    });

    it('should skip HSTS header in development environment', () => {
      process.env.NODE_ENV = 'development';

      const options: SecurityOptions = {
        hsts: {
          maxAge: 31536000,
        },
      };

      applySecurityHeaders(ctx, options);

      expect(ctx.response.header).not.toHaveBeenCalledWith(
        'Strict-Transport-Security',
        expect.any(String)
      );
    });
  });

  describe('X-Frame-Options', () => {
    it('should set X-Frame-Options to DENY', () => {
      const options: SecurityOptions = {
        frameOptions: 'DENY',
      };

      applySecurityHeaders(ctx, options);

      expect(ctx.response.header).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
    });

    it('should set X-Frame-Options to SAMEORIGIN', () => {
      const options: SecurityOptions = {
        frameOptions: 'SAMEORIGIN',
      };

      applySecurityHeaders(ctx, options);

      expect(ctx.response.header).toHaveBeenCalledWith('X-Frame-Options', 'SAMEORIGIN');
    });

    it('should skip X-Frame-Options when frameOptions is false', () => {
      const options: SecurityOptions = {
        frameOptions: false,
      };

      applySecurityHeaders(ctx, options);

      expect(ctx.response.header).not.toHaveBeenCalledWith('X-Frame-Options', expect.any(String));
    });

    it('should skip X-Frame-Options when frameOptions is undefined', () => {
      const options: SecurityOptions = {};

      applySecurityHeaders(ctx, options);

      expect(ctx.response.header).not.toHaveBeenCalledWith('X-Frame-Options', expect.any(String));
    });
  });

  describe('X-Content-Type-Options', () => {
    it('should set X-Content-Type-Options to nosniff when noSniff is true', () => {
      const options: SecurityOptions = {
        noSniff: true,
      };

      applySecurityHeaders(ctx, options);

      expect(ctx.response.header).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    });

    it('should skip X-Content-Type-Options when noSniff is false', () => {
      const options: SecurityOptions = {
        noSniff: false,
      };

      applySecurityHeaders(ctx, options);

      expect(ctx.response.header).not.toHaveBeenCalledWith(
        'X-Content-Type-Options',
        expect.any(String)
      );
    });

    it('should skip X-Content-Type-Options when noSniff is undefined', () => {
      const options: SecurityOptions = {};

      applySecurityHeaders(ctx, options);

      expect(ctx.response.header).not.toHaveBeenCalledWith(
        'X-Content-Type-Options',
        expect.any(String)
      );
    });
  });

  describe('X-XSS-Protection', () => {
    it('should set X-XSS-Protection when xssFilter is true', () => {
      const options: SecurityOptions = {
        xssFilter: true,
      };

      applySecurityHeaders(ctx, options);

      expect(ctx.response.header).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block');
    });

    it('should skip X-XSS-Protection when xssFilter is false', () => {
      const options: SecurityOptions = {
        xssFilter: false,
      };

      applySecurityHeaders(ctx, options);

      expect(ctx.response.header).not.toHaveBeenCalledWith('X-XSS-Protection', expect.any(String));
    });

    it('should skip X-XSS-Protection when xssFilter is undefined', () => {
      const options: SecurityOptions = {};

      applySecurityHeaders(ctx, options);

      expect(ctx.response.header).not.toHaveBeenCalledWith('X-XSS-Protection', expect.any(String));
    });
  });

  describe('Referrer-Policy', () => {
    it('should set Referrer-Policy to strict-origin-when-cross-origin', () => {
      const options: SecurityOptions = {
        referrerPolicy: 'strict-origin-when-cross-origin',
      };

      applySecurityHeaders(ctx, options);

      expect(ctx.response.header).toHaveBeenCalledWith(
        'Referrer-Policy',
        'strict-origin-when-cross-origin'
      );
    });

    it('should set Referrer-Policy to no-referrer', () => {
      const options: SecurityOptions = {
        referrerPolicy: 'no-referrer',
      };

      applySecurityHeaders(ctx, options);

      expect(ctx.response.header).toHaveBeenCalledWith('Referrer-Policy', 'no-referrer');
    });

    it('should set Referrer-Policy to origin', () => {
      const options: SecurityOptions = {
        referrerPolicy: 'origin',
      };

      applySecurityHeaders(ctx, options);

      expect(ctx.response.header).toHaveBeenCalledWith('Referrer-Policy', 'origin');
    });

    it('should set Referrer-Policy to same-origin', () => {
      const options: SecurityOptions = {
        referrerPolicy: 'same-origin',
      };

      applySecurityHeaders(ctx, options);

      expect(ctx.response.header).toHaveBeenCalledWith('Referrer-Policy', 'same-origin');
    });

    it('should skip Referrer-Policy when referrerPolicy is false', () => {
      const options: SecurityOptions = {
        referrerPolicy: false,
      };

      applySecurityHeaders(ctx, options);

      expect(ctx.response.header).not.toHaveBeenCalledWith('Referrer-Policy', expect.any(String));
    });

    it('should skip Referrer-Policy when referrerPolicy is undefined', () => {
      const options: SecurityOptions = {};

      applySecurityHeaders(ctx, options);

      expect(ctx.response.header).not.toHaveBeenCalledWith('Referrer-Policy', expect.any(String));
    });
  });

  describe('Combined headers', () => {
    it('should set all headers when all options are enabled', () => {
      const options: SecurityOptions = {
        csp: {
          directives: {
            defaultSrc: ["'self'"],
          },
        },
        hsts: {
          maxAge: 31536000,
          includeSubDomains: true,
        },
        frameOptions: 'DENY',
        noSniff: true,
        xssFilter: true,
        referrerPolicy: 'strict-origin-when-cross-origin',
      };

      applySecurityHeaders(ctx, options);

      // Verify all headers are set
      expect(ctx.response.header).toHaveBeenCalledWith(
        'Content-Security-Policy',
        "default-src 'self'"
      );
      expect(ctx.response.header).toHaveBeenCalledWith(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains'
      );
      expect(ctx.response.header).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
      expect(ctx.response.header).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
      expect(ctx.response.header).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block');
      expect(ctx.response.header).toHaveBeenCalledWith(
        'Referrer-Policy',
        'strict-origin-when-cross-origin'
      );

      // Verify 6 headers total (CSP, HSTS, Frame, NoSniff, XSS, Referrer)
      expect(ctx.response.header).toHaveBeenCalledTimes(6);
    });

    it('should set no headers when all options are false', () => {
      const options: SecurityOptions = {
        csp: false,
        hsts: false,
        frameOptions: false,
        noSniff: false,
        xssFilter: false,
        referrerPolicy: false,
      };

      applySecurityHeaders(ctx, options);

      expect(ctx.response.header).not.toHaveBeenCalled();
    });

    it('should set only selected headers', () => {
      const options: SecurityOptions = {
        csp: false,
        hsts: false,
        frameOptions: 'SAMEORIGIN',
        noSniff: true,
        xssFilter: false,
        referrerPolicy: false,
      };

      applySecurityHeaders(ctx, options);

      expect(ctx.response.header).toHaveBeenCalledWith('X-Frame-Options', 'SAMEORIGIN');
      expect(ctx.response.header).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');

      // Verify 2 headers set (Frame, NoSniff)
      expect(ctx.response.header).toHaveBeenCalledTimes(2);

      // Verify other headers NOT set
      expect(ctx.response.header).not.toHaveBeenCalledWith(
        'Content-Security-Policy',
        expect.any(String)
      );
      expect(ctx.response.header).not.toHaveBeenCalledWith(
        'Strict-Transport-Security',
        expect.any(String)
      );
      expect(ctx.response.header).not.toHaveBeenCalledWith('X-XSS-Protection', expect.any(String));
      expect(ctx.response.header).not.toHaveBeenCalledWith('Referrer-Policy', expect.any(String));
    });

    it('should handle empty options object', () => {
      const options: SecurityOptions = {};

      applySecurityHeaders(ctx, options);

      expect(ctx.response.header).not.toHaveBeenCalled();
    });
  });

  describe('Real-world configurations', () => {
    it('should apply strict production configuration', () => {
      const options: SecurityOptions = {
        csp: {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            objectSrc: ["'none'"],
            frameSrc: ["'none'"],
          },
        },
        hsts: {
          maxAge: 31536000,
          includeSubDomains: true,
        },
        frameOptions: 'DENY',
        noSniff: true,
        xssFilter: true,
        referrerPolicy: 'strict-origin-when-cross-origin',
      };

      applySecurityHeaders(ctx, options);

      expect(ctx.response.header).toHaveBeenCalledTimes(6);
    });

    it('should apply permissive development configuration', () => {
      process.env.NODE_ENV = 'development';

      const options: SecurityOptions = {
        csp: {
          directives: {
            defaultSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          },
        },
        hsts: false,
        frameOptions: 'SAMEORIGIN',
        noSniff: true,
        xssFilter: false,
        referrerPolicy: 'no-referrer-when-downgrade',
      };

      applySecurityHeaders(ctx, options);

      // CSP, Frame, NoSniff, Referrer (HSTS skipped in dev)
      expect(ctx.response.header).toHaveBeenCalledTimes(4);
    });

    it('should apply API-focused configuration', () => {
      const options: SecurityOptions = {
        csp: {
          directives: {
            defaultSrc: ["'none'"],
            connectSrc: ["'self'"],
          },
        },
        hsts: {
          maxAge: 31536000,
        },
        frameOptions: false,
        noSniff: true,
        xssFilter: false,
        referrerPolicy: false,
      };

      applySecurityHeaders(ctx, options);

      // CSP, HSTS, NoSniff
      expect(ctx.response.header).toHaveBeenCalledTimes(3);
    });

    it('should apply minimal configuration', () => {
      const options: SecurityOptions = {
        noSniff: true,
      };

      applySecurityHeaders(ctx, options);

      expect(ctx.response.header).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
      expect(ctx.response.header).toHaveBeenCalledTimes(1);
    });
  });

  describe('Type safety', () => {
    it('should accept SecurityOptions type', () => {
      const options: SecurityOptions = {
        frameOptions: 'DENY',
        noSniff: true,
      };

      expect(() => applySecurityHeaders(ctx, options)).not.toThrow();
    });

    it('should accept partial SecurityOptions', () => {
      const options: Partial<SecurityOptions> = {
        noSniff: true,
      };

      expect(() => applySecurityHeaders(ctx, options as SecurityOptions)).not.toThrow();
    });
  });
});
