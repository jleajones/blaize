import { createTestContext } from '@blaizejs/testing-utils';

import { createCorsMiddleware } from '../src/cors';

describe('Memory Usage Benchmarks', () => {
  const mockNext = () => Promise.resolve();

  bench('memory footprint - basic middleware creation', () => {
    const cors = createCorsMiddleware({
      origin: '*',
      methods: ['GET', 'POST'],
      allowedHeaders: ['Content-Type'],
    });

    // Force garbage collection hint
    if (global.gc) {
      global.gc();
    }
  });

  bench('memory footprint - complex middleware creation', () => {
    const cors = createCorsMiddleware({
      origin: (origin, ctx) => {
        return Promise.resolve(origin?.includes('example.com') || false);
      },
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'],
      allowedHeaders: Array.from({ length: 50 }, (_, i) => `X-Header-${i}`),
      exposedHeaders: Array.from({ length: 20 }, (_, i) => `X-Exposed-${i}`),
      credentials: true,
      maxAge: 86400,
      cachePreflightResponse: true,
    });

    if (global.gc) {
      global.gc();
    }
  });

  bench('memory footprint - origin cache growth', async () => {
    const cors = createCorsMiddleware({ origin: '*' });

    // Simulate many different origins to test cache growth
    const promises = Array.from({ length: 100 }, async (_, i) => {
      const ctx = createTestContext({
        method: 'GET',
        headers: { origin: `https://app${i}.example.com` },
      });
      return cors.execute(ctx, mockNext);
    });

    await Promise.all(promises);

    if (global.gc) {
      global.gc();
    }
  });

  bench('memory footprint - preflight cache growth', async () => {
    const cors = createCorsMiddleware({
      cachePreflightResponse: true,
    });

    // Simulate many different preflight requests
    const promises = Array.from({ length: 100 }, async (_, i) => {
      const ctx = createTestContext({
        method: 'OPTIONS',
        path: `/api/endpoint${i}`,
        headers: {
          origin: 'https://example.com',
          'access-control-request-method': 'POST',
        },
      });
      return cors.execute(ctx, mockNext);
    });

    await Promise.all(promises);

    if (global.gc) {
      global.gc();
    }
  });
});
