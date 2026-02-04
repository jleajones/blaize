/**
 * Tests for CORS Preflight Request Handler
 *
 * Tests against W3C CORS specification examples and error scenarios
 */

import { createMockContext } from '@blaizejs/testing-utils';

import * as originValidator from './origin-validator';
import { handlePreflight, isPreflightRequest, createPreflightHandler } from './preflight';
import { ValidationError } from '../../errors/validation-error';

import type { CorsOptions } from '@blaize-types/cors';

// Mock the origin validator
vi.mock('./origin-validator', () => ({
  validateOrigin: vi.fn(),
}));

describe('CORS Preflight Handler', () => {
  let startTime: number;

  beforeEach(() => {
    startTime = Date.now();

    // Reset mocks
    vi.clearAllMocks();

    // Default mock for validateOrigin - allow all
    vi.mocked(originValidator.validateOrigin).mockResolvedValue(true);
  });

  afterEach(() => {
    // Verify response time is reasonable
    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(500); // Should complete within 500ms
  });

  describe('isPreflightRequest', () => {
    it('should identify valid preflight requests', () => {
      const ctx = createMockContext({
        method: 'OPTIONS',
        headers: { 'Access-Control-Request-Method': 'POST' },
      });
      expect(isPreflightRequest(ctx)).toBe(true);

      // Case-insensitive header check
      const ctx2 = createMockContext({
        method: 'OPTIONS',
        headers: { 'access-control-request-method': 'POST' },
      });
      expect(isPreflightRequest(ctx2)).toBe(true);
    });

    it('should reject non-OPTIONS requests', () => {
      const ctx = createMockContext({
        method: 'GET',
        headers: { 'Access-Control-Request-Method': 'POST' },
      });
      expect(isPreflightRequest(ctx)).toBe(false);
    });

    it('should reject OPTIONS without request method header', () => {
      const ctx = createMockContext({
        method: 'OPTIONS',
      });
      expect(isPreflightRequest(ctx)).toBe(false);
    });
  });

  describe('handlePreflight - W3C spec examples', () => {
    it('should handle simple preflight with default options', async () => {
      const ctx = createMockContext({
        method: 'OPTIONS',
        headers: {
          Origin: 'https://example.com',
          'Access-Control-Request-Method': 'POST',
        },
      });

      const options: CorsOptions = {};

      await handlePreflight(ctx, options);

      expect(ctx.response.status).toHaveBeenCalledWith(204);
      expect(ctx.response.header).toHaveBeenCalledWith(
        'Access-Control-Allow-Origin',
        'https://example.com'
      );
      expect(ctx.response.header).toHaveBeenCalledWith(
        'Access-Control-Allow-Methods',
        expect.stringContaining('POST')
      );
      expect(ctx.response.header).toHaveBeenCalledWith('Vary', 'Origin');
    });

    it('should handle preflight with custom headers', async () => {
      const ctx = createMockContext({
        method: 'OPTIONS',
        headers: {
          Origin: 'https://example.com',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'X-Custom-Header, Content-Type',
        },
      });

      const options: CorsOptions = {
        origin: 'https://example.com',
        allowedHeaders: ['X-Custom-Header', 'Content-Type', 'Authorization'],
      };

      await handlePreflight(ctx, options);

      expect(ctx.response.status).toHaveBeenCalledWith(204);
      expect(ctx.response.header).toHaveBeenCalledWith(
        'Access-Control-Allow-Headers',
        'X-Custom-Header, Content-Type, Authorization'
      );
    });

    it('should mirror requested headers when allowedHeaders not specified', async () => {
      const ctx = createMockContext({
        method: 'OPTIONS',
        headers: {
          Origin: 'https://example.com',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'X-Custom-Header, Authorization',
        },
      });

      const options: CorsOptions = {
        origin: true, // Allow all origins
      };

      await handlePreflight(ctx, options);

      expect(ctx.response.header).toHaveBeenCalledWith(
        'Access-Control-Allow-Headers',
        'X-Custom-Header, Authorization'
      );
    });

    it('should set max age when specified', async () => {
      const ctx = createMockContext({
        method: 'OPTIONS',
        headers: {
          Origin: 'https://example.com',
          'Access-Control-Request-Method': 'POST',
        },
      });

      const options: CorsOptions = {
        origin: true,
        maxAge: 86400, // 24 hours
      };

      await handlePreflight(ctx, options);

      expect(ctx.response.header).toHaveBeenCalledWith('Access-Control-Max-Age', '86400');
    });

    it('should handle credentials correctly', async () => {
      const ctx = createMockContext({
        method: 'OPTIONS',
        headers: {
          Origin: 'https://example.com',
          'Access-Control-Request-Method': 'POST',
        },
      });

      const options: CorsOptions = {
        origin: 'https://example.com',
        credentials: true,
      };

      await handlePreflight(ctx, options);

      expect(ctx.response.header).toHaveBeenCalledWith('Access-Control-Allow-Credentials', 'true');
      expect(ctx.response.header).toHaveBeenCalledWith(
        'Access-Control-Allow-Origin',
        'https://example.com'
      );
      expect(ctx.response.header).not.toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
    });

    it('should use wildcard when origin is true and no credentials', async () => {
      const ctx = createMockContext({
        method: 'OPTIONS',
        headers: {
          Origin: 'https://example.com',
          'Access-Control-Request-Method': 'POST',
        },
      });

      const options: CorsOptions = {
        origin: true,
        credentials: false,
      };

      await handlePreflight(ctx, options);

      expect(ctx.response.header).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
      expect(ctx.response.header).not.toHaveBeenCalledWith('Vary', 'Origin');
    });

    it('should handle custom success status', async () => {
      const ctx = createMockContext({
        method: 'OPTIONS',
        headers: {
          Origin: 'https://example.com',
          'Access-Control-Request-Method': 'POST',
        },
      });

      const options: CorsOptions = {
        origin: true,
        optionsSuccessStatus: 200, // Some legacy browsers need 200
      };

      await handlePreflight(ctx, options);

      expect(ctx.response.status).toHaveBeenCalledWith(200);
    });

    it('should continue to next handler when preflightContinue is true', async () => {
      const ctx = createMockContext({
        method: 'OPTIONS',
        headers: {
          Origin: 'https://example.com',
          'Access-Control-Request-Method': 'POST',
        },
      });

      const options: CorsOptions = {
        origin: true,
        preflightContinue: true,
      };

      await handlePreflight(ctx, options);

      expect(ctx.response.text).not.toHaveBeenCalled();
      expect(ctx.response.status).toHaveBeenCalledWith(204);
    });
  });

  describe('handlePreflight - Error scenarios (403 Forbidden)', () => {
    it('should return 403 for missing Origin header', async () => {
      const ctx = createMockContext({
        method: 'OPTIONS',
        headers: {
          'Access-Control-Request-Method': 'POST',
        },
      });

      const options: CorsOptions = {};

      await expect(handlePreflight(ctx, options)).rejects.toThrow(ValidationError);

      try {
        await handlePreflight(ctx, options);
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        // ValidationError always has status 400, but we set response to 403
        expect(ctx.response.status).toHaveBeenCalledWith(403);
        expect((error as ValidationError).title).toContain('missing required headers');
      }
    });

    it('should return 403 for missing Request-Method header', async () => {
      const ctx = createMockContext({
        method: 'OPTIONS',
        headers: {
          Origin: 'https://example.com',
        },
      });

      const options: CorsOptions = {};

      await expect(handlePreflight(ctx, options)).rejects.toThrow(ValidationError);

      try {
        await handlePreflight(ctx, options);
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect(ctx.response.status).toHaveBeenCalledWith(403);
        expect((error as ValidationError).title).toContain('missing required headers');
      }
    });

    it('should return 403 for disallowed origin', async () => {
      const ctx = createMockContext({
        method: 'OPTIONS',
        headers: {
          Origin: 'https://evil.com',
          'Access-Control-Request-Method': 'POST',
        },
      });

      // Mock origin validation to reject
      vi.mocked(originValidator.validateOrigin).mockResolvedValue(false);

      const options: CorsOptions = {
        origin: 'https://example.com',
      };

      try {
        await handlePreflight(ctx, options);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect(ctx.response.status).toHaveBeenCalledWith(403);
        expect((error as ValidationError).title).toBe('CORS origin not allowed');
        const details = (error as ValidationError).details as any;
        expect(details.fields[0].field).toBe('Origin');
        expect(details.fields[0].rejectedValue).toBe('https://evil.com');
      }
    });

    it('should return 403 for disallowed method', async () => {
      const ctx = createMockContext({
        method: 'OPTIONS',
        headers: {
          Origin: 'https://example.com',
          'Access-Control-Request-Method': 'DELETE',
        },
      });

      const options: CorsOptions = {
        origin: true,
        methods: ['GET', 'POST'], // DELETE not allowed
      };

      try {
        await handlePreflight(ctx, options);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect(ctx.response.status).toHaveBeenCalledWith(403);
        expect((error as ValidationError).title).toBe('CORS method not allowed');
        const details = (error as ValidationError).details as any;
        expect(details.fields[0].field).toBe('Access-Control-Request-Method');
        expect(details.fields[0].rejectedValue).toBe('DELETE');
      }
    });

    it('should return 403 for disallowed headers', async () => {
      const ctx = createMockContext({
        method: 'OPTIONS',
        headers: {
          Origin: 'https://example.com',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'X-Evil-Header, X-Good-Header',
        },
      });

      const options: CorsOptions = {
        origin: true,
        allowedHeaders: ['X-Good-Header', 'Content-Type'],
      };

      try {
        await handlePreflight(ctx, options);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect(ctx.response.status).toHaveBeenCalledWith(403);
        expect((error as ValidationError).title).toBe('CORS headers not allowed');
        const details = (error as ValidationError).details as any;
        expect(details.fields[0].field).toBe('Access-Control-Request-Headers');
        expect(details.fields[0].rejectedValue).toContain('x-evil-header');
      }
    });
  });

  describe('createPreflightHandler', () => {
    it('should create a reusable handler function', async () => {
      const ctx = createMockContext({
        method: 'OPTIONS',
        headers: {
          Origin: 'https://example.com',
          'Access-Control-Request-Method': 'POST',
        },
      });

      const options: CorsOptions = {
        origin: 'https://example.com',
        credentials: true,
      };

      const handler = createPreflightHandler(options);

      await handler(ctx);

      expect(ctx.response.status).toHaveBeenCalledWith(204);
      expect(ctx.response.header).toHaveBeenCalledWith(
        'Access-Control-Allow-Origin',
        'https://example.com'
      );
      expect(ctx.response.header).toHaveBeenCalledWith('Access-Control-Allow-Credentials', 'true');
    });

    it('should propagate errors from handler', async () => {
      const ctx = createMockContext({
        method: 'OPTIONS',
        headers: {
          Origin: 'https://evil.com',
          'Access-Control-Request-Method': 'POST',
        },
      });

      vi.mocked(originValidator.validateOrigin).mockResolvedValue(false);

      const options: CorsOptions = {
        origin: 'https://example.com',
      };

      const handler = createPreflightHandler(options);

      await expect(handler(ctx)).rejects.toThrow(ValidationError);
    });
  });
});

describe('Method and Header Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(originValidator.validateOrigin).mockResolvedValue(true);
  });

  describe('Method validation', () => {
    it('should handle methods as comma-delimited string', async () => {
      const ctx = createMockContext({
        method: 'OPTIONS',
        headers: {
          Origin: 'https://example.com',
          'Access-Control-Request-Method': 'PUT',
        },
      });

      const options: CorsOptions = {
        origin: true,
        methods: 'GET, POST, PUT, DELETE', // String format
      };

      await handlePreflight(ctx, options);

      expect(ctx.response.status).toHaveBeenCalledWith(204);
      expect(ctx.response.header).toHaveBeenCalledWith(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, DELETE'
      );
    });

    it('should normalize method case for comparison', async () => {
      const ctx = createMockContext({
        method: 'OPTIONS',
        headers: {
          Origin: 'https://example.com',
          'Access-Control-Request-Method': 'post', // lowercase
        },
      });

      const options: CorsOptions = {
        origin: true,
        methods: ['GET', 'POST'], // uppercase
      };

      await handlePreflight(ctx, options);

      expect(ctx.response.status).toHaveBeenCalledWith(204);
    });
  });

  describe('Header validation', () => {
    it('should handle headers as comma-delimited string', async () => {
      const ctx = createMockContext({
        method: 'OPTIONS',
        headers: {
          Origin: 'https://example.com',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'content-type, authorization',
        },
      });

      const options: CorsOptions = {
        origin: true,
        allowedHeaders: 'Content-Type, Authorization, X-Custom', // String format
      };

      await handlePreflight(ctx, options);

      expect(ctx.response.status).toHaveBeenCalledWith(204);
      expect(ctx.response.header).toHaveBeenCalledWith(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-Custom'
      );
    });

    it('should handle case-insensitive header comparison', async () => {
      const ctx = createMockContext({
        method: 'OPTIONS',
        headers: {
          Origin: 'https://example.com',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'CONTENT-TYPE, AUTHORIZATION',
        },
      });

      const options: CorsOptions = {
        origin: true,
        allowedHeaders: ['content-type', 'authorization'], // Different case
      };

      await handlePreflight(ctx, options);

      expect(ctx.response.status).toHaveBeenCalledWith(204);
    });

    it('should allow empty header requests', async () => {
      const ctx = createMockContext({
        method: 'OPTIONS',
        headers: {
          Origin: 'https://example.com',
          'Access-Control-Request-Method': 'POST',
        },
      });

      const options: CorsOptions = {
        origin: true,
        allowedHeaders: ['Content-Type'], // Has restrictions but none requested
      };

      await handlePreflight(ctx, options);

      expect(ctx.response.status).toHaveBeenCalledWith(204);
    });
  });
});
