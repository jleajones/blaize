import { createTestContext } from '@blaizejs/testing-utils';

import { createCorsMiddleware } from './cors.js';

import type { Context } from 'blaizejs';

describe('CORS Middleware', () => {
  let mockNext: ReturnType<typeof vi.fn>;
  let ctx: Context;

  beforeEach(() => {
    mockNext = vi.fn();
    ctx = createTestContext({
      method: 'GET',
      path: '/api/test',
      headers: {
        origin: 'https://example.com',
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Origin Handling', () => {
    test('should allow all origins with wildcard', async () => {
      const cors = createCorsMiddleware({ origin: '*' });

      await cors.execute(ctx, mockNext);

      expect(ctx.response.header).toHaveBeenCalledWith(
        'Access-Control-Allow-Origin',
        'https://example.com'
      );
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    test('should allow specific origin', async () => {
      const cors = createCorsMiddleware({
        origin: 'https://example.com',
      });

      await cors.execute(ctx, mockNext);

      expect(ctx.response.header).toHaveBeenCalledWith(
        'Access-Control-Allow-Origin',
        'https://example.com'
      );
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    test('should reject unauthorized origin', async () => {
      const cors = createCorsMiddleware({
        origin: 'https://allowed.com',
      });

      await cors.execute(ctx, mockNext);

      expect(ctx.response.status).toHaveBeenCalledWith(403);
      expect(ctx.response.json).toHaveBeenCalledWith({
        error: 'CORS: Origin not allowed',
        origin: 'https://example.com',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should handle array of allowed origins', async () => {
      const cors = createCorsMiddleware({
        origin: ['https://example.com', 'https://test.com'],
      });

      await cors.execute(ctx, mockNext);

      expect(ctx.response.header).toHaveBeenCalledWith(
        'Access-Control-Allow-Origin',
        'https://example.com'
      );
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    test('should handle RegExp origin patterns', async () => {
      const cors = createCorsMiddleware({
        origin: /^https:\/\/.*\.example\.com$/,
      });

      const subdomainCtx = createTestContext({
        headers: { origin: 'https://api.example.com' },
      });

      await cors.execute(subdomainCtx, mockNext);

      expect(subdomainCtx.response.header).toHaveBeenCalledWith(
        'Access-Control-Allow-Origin',
        'https://api.example.com'
      );
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    test('should handle function-based origin validation', async () => {
      const originValidator = vi.fn().mockResolvedValue(true);
      const cors = createCorsMiddleware({ origin: originValidator });

      await cors.execute(ctx, mockNext);

      expect(originValidator).toHaveBeenCalledWith('https://example.com', ctx);
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    test('should handle async function origin validation', async () => {
      const originValidator = vi.fn().mockImplementation(async origin => {
        // Simulate async database lookup
        await new Promise(resolve => setTimeout(resolve, 10));
        return origin === 'https://example.com';
      });

      const cors = createCorsMiddleware({ origin: originValidator });

      await cors.execute(ctx, mockNext);

      expect(originValidator).toHaveBeenCalledWith('https://example.com', ctx);
      expect(mockNext).toHaveBeenCalledTimes(1);
    });
  });

  describe('Preflight Handling', () => {
    beforeEach(() => {
      ctx = createTestContext({
        method: 'OPTIONS',
        path: '/api/test',
        headers: {
          origin: 'https://example.com',
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'Content-Type, Authorization',
        },
      });
    });

    test('should handle preflight requests', async () => {
      const cors = createCorsMiddleware({
        origin: 'https://example.com',
        methods: ['GET', 'POST', 'PUT'],
        allowedHeaders: ['Content-Type', 'Authorization'],
      });

      await cors.execute(ctx, mockNext);

      expect(ctx.response.header).toHaveBeenCalledWith(
        'Access-Control-Allow-Origin',
        'https://example.com'
      );
      expect(ctx.response.header).toHaveBeenCalledWith(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT'
      );
      expect(ctx.response.header).toHaveBeenCalledWith(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization'
      );
      expect(ctx.response.status).toHaveBeenCalledWith(204);
      expect(ctx.response.end).toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should respect custom options success status', async () => {
      const cors = createCorsMiddleware({
        optionsSuccessStatus: 200,
      });

      await cors.execute(ctx, mockNext);

      expect(ctx.response.status).toHaveBeenCalledWith(200);
    });

    test('should continue to next middleware when preflightContinue is true', async () => {
      const cors = createCorsMiddleware({
        preflightContinue: true,
      });

      await cors.execute(ctx, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    test('should set max-age header', async () => {
      const cors = createCorsMiddleware({
        maxAge: 3600,
      });

      await cors.execute(ctx, mockNext);

      expect(ctx.response.header).toHaveBeenCalledWith('Access-Control-Max-Age', '3600');
    });
  });

  describe('Credentials Handling', () => {
    test('should set credentials header when enabled', async () => {
      const cors = createCorsMiddleware({
        credentials: true,
        origin: 'https://example.com',
      });

      await cors.execute(ctx, mockNext);

      expect(ctx.response.header).toHaveBeenCalledWith('Access-Control-Allow-Credentials', 'true');
    });

    test('should not set credentials header when disabled', async () => {
      const cors = createCorsMiddleware({
        credentials: false,
      });

      await cors.execute(ctx, mockNext);

      expect(ctx.response.header).not.toHaveBeenCalledWith(
        'Access-Control-Allow-Credentials',
        expect.any(String)
      );
    });
  });

  describe('Header Management', () => {
    test('should handle string headers', async () => {
      const cors = createCorsMiddleware({
        allowedHeaders: 'Content-Type, Authorization, X-Custom',
        exposedHeaders: 'X-Total-Count, X-Page-Count',
      });

      ctx = createTestContext({
        method: 'OPTIONS',
        headers: { origin: 'https://example.com' },
      });

      await cors.execute(ctx, mockNext);

      expect(ctx.response.header).toHaveBeenCalledWith(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-Custom'
      );
    });

    test('should handle array headers', async () => {
      const cors = createCorsMiddleware({
        exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
      });

      await cors.execute(ctx, mockNext);

      expect(ctx.response.header).toHaveBeenCalledWith(
        'Access-Control-Expose-Headers',
        'X-Total-Count, X-Page-Count'
      );
    });

    test('should set Vary header correctly', async () => {
      const cors = createCorsMiddleware({ credentials: true });

      await cors.execute(ctx, mockNext);

      expect(ctx.response.header).toHaveBeenCalledWith(
        'Vary',
        'Origin, Access-Control-Request-Headers'
      );
    });
  });

  describe('Performance Optimizations', () => {
    test('should cache preflight responses', async () => {
      const cors = createCorsMiddleware({
        cachePreflightResponse: true,
        maxAge: 3600,
      });

      const preflightCtx = createTestContext({
        method: 'OPTIONS',
        path: '/api/test',
        headers: { origin: 'https://example.com' },
      });

      // First request - should process normally
      await cors.execute(preflightCtx, mockNext);

      // Second request - should use cache
      const secondCtx = createTestContext({
        method: 'OPTIONS',
        path: '/api/test',
        headers: { origin: 'https://example.com' },
      });

      await cors.execute(secondCtx, mockNext);

      expect(secondCtx.response.header).toHaveBeenCalled();
      expect(secondCtx.response.status).toHaveBeenCalledWith(204);
    });

    test('should allow custom cache key generation', async () => {
      const customCacheKey = vi.fn().mockReturnValue('custom-key');
      const cors = createCorsMiddleware({
        preflightCacheKey: customCacheKey,
      });

      const preflightCtx = createTestContext({
        method: 'OPTIONS',
        headers: { origin: 'https://example.com' },
      });

      await cors.execute(preflightCtx, mockNext);

      expect(customCacheKey).toHaveBeenCalledWith(preflightCtx);
    });
  });

  describe('Debug Mode', () => {
    test('should log debug information when enabled', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const cors = createCorsMiddleware({
        debug: true,
        origin: 'https://example.com',
      });

      await cors.execute(ctx, mockNext);

      expect(consoleSpy).toHaveBeenCalledWith(
        '[CORS] Processing GET request from origin: https://example.com'
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Edge Cases', () => {
    test('should handle requests without origin header', async () => {
      const ctxNoOrigin = createTestContext({
        method: 'GET',
        path: '/api/test',
        // No origin header
      });

      const cors = createCorsMiddleware({ origin: 'https://example.com' });

      await cors.execute(ctxNoOrigin, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    test('should handle empty origin', async () => {
      const ctxEmptyOrigin = createTestContext({
        method: 'GET',
        path: '/api/test',
        headers: { origin: '' },
      });

      const cors = createCorsMiddleware();

      await cors.execute(ctxEmptyOrigin, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    test('should handle malformed origin', async () => {
      const ctxMalformedOrigin = createTestContext({
        method: 'GET',
        path: '/api/test',
        headers: { origin: 'not-a-valid-origin' },
      });

      const cors = createCorsMiddleware({ origin: /^https:\/\// });

      await cors.execute(ctxMalformedOrigin, mockNext);

      expect(ctx.response.status).toHaveBeenCalledWith(403);
    });
  });
});
