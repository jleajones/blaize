/**
 * Unit tests for security() middleware function
 */

import { createMockContext, createMockLogger, MockLogger } from '@blaizejs/testing-utils';

import { createSecurityMiddleware as security } from './index.js';

import type { SecurityOptions } from './types.js';
import type { NextFunction } from 'blaizejs';

// Mock next function - FIXED VERSION
const createNextFn = (): { fn: NextFunction; getCalls: () => number } => {
  let calls = 0;
  const fn: NextFunction = async () => {
    calls++;
  };
  return {
    fn,
    getCalls: () => calls, // Return a function to get current calls
  };
};

describe('security middleware', () => {
  let mockLogger: MockLogger;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLogger = createMockLogger();
  });
  describe('Middleware structure', () => {
    it('should return middleware object with correct properties', () => {
      const middleware = security();

      expect(middleware).toHaveProperty('name');
      expect(middleware).toHaveProperty('execute');
      expect(middleware).toHaveProperty('skip');
      expect(middleware.name).toBe('security');
      expect(typeof middleware.execute).toBe('function');
      expect(typeof middleware.skip).toBe('function');
    });

    it('should have name property set to "security"', () => {
      const middleware = security();

      expect(middleware.name).toBe('security');
    });

    it('should have handler that is an async function', () => {
      const middleware = security();

      expect(middleware.execute).toBeInstanceOf(Function);
      expect(middleware.execute.constructor.name).toBe('AsyncFunction');
    });

    it('should have skip function', () => {
      const middleware = security();

      expect(middleware.skip).toBeInstanceOf(Function);
    });
  });

  describe('Skip conditions', () => {
    it('should skip /health endpoint', () => {
      const middleware = security();
      const ctx = createMockContext({ path: '/health' });

      const shouldSkip = middleware.skip!(ctx);

      expect(shouldSkip).toBe(true);
    });

    it('should skip /healthz endpoint', () => {
      const middleware = security();
      const ctx = createMockContext({ path: '/healthz' });

      const shouldSkip = middleware.skip!(ctx);

      expect(shouldSkip).toBe(true);
    });

    it('should not skip other endpoints', () => {
      const middleware = security();
      const paths = ['/', '/api', '/admin', '/health-check', '/healthcheck'];

      paths.forEach(path => {
        const ctx = createMockContext({ path });
        const shouldSkip = middleware.skip!(ctx);
        expect(shouldSkip).toBe(false);
      });
    });

    it('should not skip paths that contain health but are not exact matches', () => {
      const middleware = security();
      const ctx1 = createMockContext({ path: '/api/health' });
      const ctx2 = createMockContext({ path: '/health/status' });
      const ctx3 = createMockContext({ path: '/healthz/check' });

      expect(middleware.skip!(ctx1)).toBe(false);
      expect(middleware.skip!(ctx2)).toBe(false);
      expect(middleware.skip!(ctx3)).toBe(false);
    });
  });

  describe('Enabled/disabled state', () => {
    it('should apply headers when enabled is not specified (default)', async () => {
      const middleware = security({
        noSniff: true,
      });
      const ctx = createMockContext();
      const { fn: next, getCalls } = createNextFn();

      await middleware.execute(ctx, next, mockLogger);

      expect(ctx.response.header).toHaveBeenCalled();
      expect(getCalls()).toBe(1);
    });

    it('should apply headers when enabled is true', async () => {
      const middleware = security({
        enabled: true,
        noSniff: true,
      });
      const ctx = createMockContext();
      const { fn: next, getCalls } = createNextFn();

      await middleware.execute(ctx, next, mockLogger);

      expect(ctx.response.header).toHaveBeenCalled();
      expect(getCalls()).toBe(1);
    });

    it('should skip all headers when enabled is false', async () => {
      const middleware = security({
        enabled: false,
        csp: {
          directives: {
            defaultSrc: ["'self'"],
          },
        },
        hsts: {
          maxAge: 31536000,
        },
        noSniff: true,
      });
      const ctx = createMockContext();
      const { fn: next, getCalls } = createNextFn();

      await middleware.execute(ctx, next, mockLogger);

      expect(ctx.response.header).not.toHaveBeenCalled();
      expect(getCalls()).toBe(1);
    });
  });

  describe('Headers already sent', () => {
    it('should skip when headers already sent', async () => {
      const middleware = security({
        noSniff: true,
      });
      const ctx = createMockContext();
      ctx.response.sent = true;
      const { fn: next, getCalls } = createNextFn();

      await middleware.execute(ctx, next, mockLogger);

      expect(ctx.response.header).not.toHaveBeenCalled();
      expect(getCalls()).toBe(1);
    });

    it('should apply headers when headersSent is false', async () => {
      const middleware = security({
        noSniff: true,
      });
      const ctx = createMockContext();
      ctx.response.sent = false;
      const { fn: next, getCalls } = createNextFn();

      await middleware.execute(ctx, next, mockLogger);

      expect(ctx.response.header).toHaveBeenCalled();
      expect(getCalls()).toBe(1);
    });
  });

  describe('Middleware chain', () => {
    it('should call next() to continue middleware chain', async () => {
      const middleware = security();
      const ctx = createMockContext();
      const { fn: next, getCalls } = createNextFn();

      await middleware.execute(ctx, next, mockLogger);

      expect(getCalls()).toBe(1);
    });

    it('should call next() even when enabled is false', async () => {
      const middleware = security({ enabled: false });
      const ctx = createMockContext();
      const { fn: next, getCalls } = createNextFn();

      await middleware.execute(ctx, next, mockLogger);

      expect(getCalls()).toBe(1);
    });

    it('should call next() even when headers already sent', async () => {
      const middleware = security();
      const ctx = createMockContext();
      ctx.response.sent = true;
      const { fn: next, getCalls } = createNextFn();

      await middleware.execute(ctx, next, mockLogger);

      expect(getCalls()).toBe(1);
    });
  });

  describe('Zero-config usage', () => {
    it('should work with no options provided', async () => {
      const middleware = security();
      const ctx = createMockContext();
      const { fn: next } = createNextFn();

      await expect(middleware.execute(ctx, next, mockLogger)).resolves.not.toThrow();
    });

    it('should work with undefined options', async () => {
      const middleware = security(undefined);
      const ctx = createMockContext();
      const { fn: next } = createNextFn();

      await expect(middleware.execute(ctx, next, mockLogger)).resolves.not.toThrow();
    });

    it('should work with empty options object', async () => {
      const middleware = security({});
      const ctx = createMockContext();
      const { fn: next } = createNextFn();

      await expect(middleware.execute(ctx, next, mockLogger)).resolves.not.toThrow();
    });
  });

  describe('CSP header application', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('should apply CSP header when csp is configured', async () => {
      const middleware = security({
        csp: {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", 'https://cdn.example.com'],
          },
        },
      });
      const ctx = createMockContext();
      const { fn: next } = createNextFn();

      await middleware.execute(ctx, next, mockLogger);

      expect(ctx.response.header).toHaveBeenCalledWith(
        'Content-Security-Policy',
        expect.stringContaining("default-src 'self'")
      );
      expect(ctx.response.header).toHaveBeenCalledWith(
        'Content-Security-Policy',
        expect.stringContaining('script-src')
      );
    });

    it('should apply Content-Security-Policy-Report-Only when reportOnly is true', async () => {
      const middleware = security({
        csp: {
          directives: {
            defaultSrc: ["'self'"],
          },
          reportOnly: true,
        },
      });
      const ctx = createMockContext();
      const { fn: next } = createNextFn();

      await middleware.execute(ctx, next, mockLogger);

      expect(ctx.response.header).toHaveBeenCalledWith(
        'Content-Security-Policy-Report-Only',
        expect.any(String)
      );
      expect(ctx.response.header).not.toHaveBeenCalledWith(
        'Content-Security-Policy',
        expect.any(String)
      );
    });

    it('should skip CSP header when csp is false', async () => {
      const middleware = security({
        csp: false,
      });
      const ctx = createMockContext();
      const { fn: next } = createNextFn();

      await middleware.execute(ctx, next, mockLogger);

      expect(ctx.response.header).not.toHaveBeenCalledWith(
        'Content-Security-Policy',
        expect.any(String)
      );
      expect(ctx.response.header).not.toHaveBeenCalledWith(
        'Content-Security-Policy-Report-Only',
        expect.any(String)
      );
    });

    it('should skip CSP header when csp is false', async () => {
      const middleware = security({
        csp: false,
      });
      const ctx = createMockContext();
      const { fn: next } = createNextFn();

      await middleware.execute(ctx, next, mockLogger);

      expect(ctx.response.header).not.toHaveBeenCalledWith(
        'Content-Security-Policy',
        expect.any(String)
      );
    });
  });

  describe('HSTS header application', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('should apply HSTS header when hsts is configured', async () => {
      const middleware = security({
        hsts: {
          maxAge: 31536000,
          includeSubDomains: true,
        },
      });
      const ctx = createMockContext();
      const { fn: next } = createNextFn();

      await middleware.execute(ctx, next, mockLogger);

      expect(ctx.response.header).toHaveBeenCalledWith(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains'
      );
    });

    it('should skip HSTS header when hsts is false', async () => {
      const middleware = security({
        hsts: false,
      });
      const ctx = createMockContext();
      const { fn: next } = createNextFn();

      await middleware.execute(ctx, next, mockLogger);

      expect(ctx.response.header).not.toHaveBeenCalledWith(
        'Strict-Transport-Security',
        expect.any(String)
      );
    });
  });

  describe('Other security headers', () => {
    it('should apply X-Frame-Options when frameOptions is configured', async () => {
      const middleware = security({
        frameOptions: 'DENY',
      });
      const ctx = createMockContext();
      const { fn: next } = createNextFn();

      await middleware.execute(ctx, next, mockLogger);

      expect(ctx.response.header).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
    });

    it('should apply X-Content-Type-Options when noSniff is true', async () => {
      const middleware = security({
        noSniff: true,
      });
      const ctx = createMockContext();
      const { fn: next } = createNextFn();

      await middleware.execute(ctx, next, mockLogger);

      expect(ctx.response.header).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    });

    it('should apply X-XSS-Protection when xssFilter is true', async () => {
      const middleware = security({
        xssFilter: true,
      });
      const ctx = createMockContext();
      const { fn: next } = createNextFn();

      await middleware.execute(ctx, next, mockLogger);

      expect(ctx.response.header).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block');
    });

    it('should apply Referrer-Policy when configured', async () => {
      const middleware = security({
        referrerPolicy: 'strict-origin-when-cross-origin',
      });
      const ctx = createMockContext();
      const { fn: next } = createNextFn();

      await middleware.execute(ctx, next, mockLogger);

      expect(ctx.response.header).toHaveBeenCalledWith(
        'Referrer-Policy',
        'strict-origin-when-cross-origin'
      );
    });
  });

  describe('Combined configurations', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('should apply all headers when fully configured', async () => {
      const middleware = security({
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
      });
      const ctx = createMockContext();
      const { fn: next } = createNextFn();

      await middleware.execute(ctx, next, mockLogger);

      // Verify all headers are set
      expect(ctx.response.header).toHaveBeenCalledWith(
        'Content-Security-Policy',
        expect.any(String)
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

    it('should apply only selected headers', async () => {
      const middleware = security({
        csp: false,
        hsts: false,
        frameOptions: 'SAMEORIGIN',
        noSniff: true,
        xssFilter: false,
        referrerPolicy: false,
      });
      const ctx = createMockContext();
      const { fn: next } = createNextFn();

      await middleware.execute(ctx, next, mockLogger);

      expect(ctx.response.header).toHaveBeenCalledWith('X-Frame-Options', 'SAMEORIGIN');
      expect(ctx.response.header).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');

      // Verify 2 headers set (Frame, NoSniff)
      expect(ctx.response.header).toHaveBeenCalledTimes(2);

      // Verify disabled headers NOT set
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
  });

  describe('Type exports', () => {
    it('should export SecurityOptions type', () => {
      // Type-level test - will fail at compile time if export missing
      const options: SecurityOptions = {
        enabled: true,
        csp: {
          directives: {
            defaultSrc: ["'self'"],
          },
        },
      };

      expect(options).toBeDefined();
    });
  });

  describe('Preset exports', () => {
    it('should re-export securityPresets', async () => {
      const { securityPresets } = await import('./index.js');

      expect(securityPresets).toBeDefined();
      expect(securityPresets.development).toBeDefined();
      expect(securityPresets.production).toBeDefined();
      expect(securityPresets.api).toBeDefined();
      expect(securityPresets.spa).toBeDefined();
    });
  });

  describe('Real-world scenarios', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('should handle SPA configuration', async () => {
      const middleware = security({
        csp: {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", 'https://cdn.example.com'],
            styleSrc: ["'self'", "'unsafe-inline'"], // SPA might need this
            imgSrc: ["'self'", 'data:', 'https:'],
          },
        },
        hsts: {
          maxAge: 31536000,
          includeSubDomains: true,
        },
        frameOptions: 'SAMEORIGIN',
        noSniff: true,
      });
      const ctx = createMockContext();
      const { fn: next } = createNextFn();

      await middleware.execute(ctx, next, mockLogger);

      expect(ctx.response.header).toHaveBeenCalledWith(
        'Content-Security-Policy',
        expect.stringContaining("script-src 'self' https://cdn.example.com")
      );
    });

    it('should handle API configuration', async () => {
      const middleware = security({
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
      });
      const ctx = createMockContext();
      const { fn: next } = createNextFn();

      await middleware.execute(ctx, next, mockLogger);

      expect(ctx.response.header).toHaveBeenCalledWith(
        'Content-Security-Policy',
        expect.stringContaining("default-src 'none'")
      );
      expect(ctx.response.header).not.toHaveBeenCalledWith('X-Frame-Options', expect.any(String));
    });

    it('should handle development configuration', async () => {
      process.env.NODE_ENV = 'development';

      const middleware = security({
        csp: {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            connectSrc: ["'self'", 'ws:', 'wss:'],
          },
        },
        hsts: false,
        frameOptions: 'SAMEORIGIN',
        noSniff: true,
      });
      const ctx = createMockContext();
      const { fn: next } = createNextFn();

      await middleware.execute(ctx, next, mockLogger);

      expect(ctx.response.header).toHaveBeenCalledWith(
        'Content-Security-Policy',
        expect.stringContaining("'unsafe-inline'")
      );
      expect(ctx.response.header).not.toHaveBeenCalledWith(
        'Strict-Transport-Security',
        expect.any(String)
      );
    });
  });

  describe('Edge cases', () => {
    test('should merge empty CSP directives with defaults', async () => {
      const middleware = security({
        csp: { directives: {} },
      });

      const ctx = createMockContext();
      const { fn: next } = createNextFn();
      await middleware.execute(ctx, next, mockLogger);

      // Should have CSP from environment defaults
      expect(ctx.response.header).toHaveBeenCalledWith(
        'Content-Security-Policy',
        expect.stringContaining("default-src 'self'")
      );
    });
    it('should handle context with missing request properties gracefully', async () => {
      const middleware = security();
      const ctx = createMockContext();
      const { fn: next } = createNextFn();

      await expect(middleware.execute(ctx, next, mockLogger)).resolves.not.toThrow();
    });
  });
});
