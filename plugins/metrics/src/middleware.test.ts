/**
 * @file HTTP Metrics Middleware tests
 * @description Comprehensive tests for metrics middleware
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { createMetricsMiddleware, shouldExcludePath, getErrorStatusCode } from './middleware';
import { MetricsCollectorImpl } from './collector';
import type { Context } from 'blaizejs';
import type { MetricsCollector } from './types';

// Define the Context type with metrics in services
type MetricsContext = Context<{}, { metrics: MetricsCollector }>;

describe('createMetricsMiddleware', () => {
  let collector: MetricsCollectorImpl;
  let middleware: ReturnType<typeof createMetricsMiddleware>;

  beforeEach(() => {
    collector = new MetricsCollectorImpl();
    middleware = createMetricsMiddleware({
      collector,
      excludePaths: ['/health', '/metrics', '/internal/*'],
    });
  });

  describe('Middleware creation', () => {
    test('creates middleware with correct structure', () => {
      expect(middleware).toHaveProperty('name');
      expect(middleware).toHaveProperty('execute');
      expect(middleware.name).toBe('metrics');
      expect(typeof middleware.execute).toBe('function');
    });

    test('creates middleware with default options', () => {
      const defaultMiddleware = createMetricsMiddleware({ collector });
      expect(defaultMiddleware).toBeDefined();
      expect(defaultMiddleware.name).toBe('metrics');
    });

    test('creates middleware with empty excludePaths', () => {
      const mw = createMetricsMiddleware({
        collector,
        excludePaths: [],
      });
      expect(mw).toBeDefined();
    });
  });

  describe('Context injection', () => {
    test('injects metrics collector into ctx.services', async () => {
      const ctx = createMockContext({ path: '/api/test' });
      const next = vi.fn().mockResolvedValue(undefined);

      await middleware.execute(ctx, next);

      expect(ctx.services.metrics).toBe(collector);
    });

    test('metrics collector is available in route handler', async () => {
      const ctx = createMockContext({ path: '/api/users' });
      const next = vi.fn(async () => {
        // Simulate route handler using metrics
        expect(ctx.services.metrics).toBeDefined();
        ctx.services.metrics.increment('route.called');
      });

      await middleware.execute(ctx, next);

      const snapshot = collector.getSnapshot();
      expect(snapshot.custom.counters['route.called']).toBe(1);
    });
  });

  describe('Request tracking', () => {
    test('tracks successful request', async () => {
      const ctx = createMockContext({
        method: 'GET',
        path: '/api/users',
        status: 200,
      });
      const next = vi.fn().mockResolvedValue(undefined);

      await middleware.execute(ctx, next);

      const snapshot = collector.getSnapshot();
      expect(snapshot.http.totalRequests).toBe(1);
      expect(snapshot.http.statusCodes['200']).toBe(1);
      expect(snapshot.http.byMethod['GET']?.count).toBe(1);
      expect(snapshot.http.byRoute['/api/users']?.count).toBe(1);
    });

    test('tracks request timing accurately', async () => {
      const ctx = createMockContext({
        method: 'POST',
        path: '/api/orders',
        status: 201,
      });
      const next = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      await middleware.execute(ctx, next);

      const snapshot = collector.getSnapshot();
      const latency = snapshot.http.latency.mean;

      // Should be around 50ms (allow variance)
      expect(latency).toBeGreaterThanOrEqual(40);
      expect(latency).toBeLessThan(100);
    });

    test('tracks multiple requests', async () => {
      const requests = [
        { method: 'GET', path: '/api/users', status: 200 },
        { method: 'POST', path: '/api/orders', status: 201 },
        { method: 'GET', path: '/api/products', status: 200 },
      ];

      for (const req of requests) {
        const ctx = createMockContext(req);
        const next = vi.fn().mockResolvedValue(undefined);
        await middleware.execute(ctx, next);
      }

      const snapshot = collector.getSnapshot();
      expect(snapshot.http.totalRequests).toBe(3);
      expect(snapshot.http.statusCodes['200']).toBe(2);
      expect(snapshot.http.statusCodes['201']).toBe(1);
    });

    test('calls next() middleware', async () => {
      const ctx = createMockContext({ path: '/test' });
      const next = vi.fn().mockResolvedValue(undefined);

      await middleware.execute(ctx, next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    test('handles missing request properties gracefully', async () => {
      const ctx = createMockContext({
        method: undefined,
        path: undefined,
        status: undefined,
      });
      // Override to actually have undefined values
      (ctx.request as any).method = undefined;
      (ctx.request as any).path = undefined;

      const next = vi.fn().mockResolvedValue(undefined);

      await middleware.execute(ctx, next);

      const snapshot = collector.getSnapshot();
      expect(snapshot.http.totalRequests).toBe(1);
      // Should use defaults: UNKNOWN method, / path, 200 status
      expect(snapshot.http.byMethod['UNKNOWN']?.count).toBe(1);
      expect(snapshot.http.byRoute['/']?.count).toBe(1);
    });
  });

  describe('Error handling', () => {
    test('tracks error status codes', async () => {
      const ctx = createMockContext({
        method: 'GET',
        path: '/api/missing',
      });
      const error = new Error('Not found');
      (error as any).status = 404;
      const next = vi.fn().mockRejectedValue(error);

      await expect(middleware.execute(ctx, next)).rejects.toThrow('Not found');

      const snapshot = collector.getSnapshot();
      expect(snapshot.http.totalRequests).toBe(1);
      expect(snapshot.http.statusCodes['404']).toBe(1);
    });

    test('tracks 500 errors', async () => {
      const ctx = createMockContext({
        method: 'POST',
        path: '/api/crash',
      });
      const next = vi.fn().mockRejectedValue(new Error('Internal error'));

      await expect(middleware.execute(ctx, next)).rejects.toThrow();

      const snapshot = collector.getSnapshot();
      expect(snapshot.http.statusCodes['500']).toBe(1);
    });

    test('re-throws errors after recording metrics', async () => {
      const ctx = createMockContext({ path: '/test' });
      const error = new Error('Test error');
      const next = vi.fn().mockRejectedValue(error);

      await expect(middleware.execute(ctx, next)).rejects.toThrow('Test error');

      // Metrics should still be recorded
      const snapshot = collector.getSnapshot();
      expect(snapshot.http.totalRequests).toBe(1);
    });

    test('records timing even when error occurs', async () => {
      const ctx = createMockContext({ path: '/test' });
      const next = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 20));
        throw new Error('Test error');
      });

      await expect(middleware.execute(ctx, next)).rejects.toThrow();

      const snapshot = collector.getSnapshot();
      expect(snapshot.http.latency.mean).toBeGreaterThan(0);
    });

    test('handles non-Error throws', async () => {
      const ctx = createMockContext({ path: '/test' });
      const next = vi.fn().mockRejectedValue('string error');

      await expect(middleware.execute(ctx, next)).rejects.toBe('string error');

      const snapshot = collector.getSnapshot();
      expect(snapshot.http.totalRequests).toBe(1);
    });

    test('never crashes request on metrics recording error', async () => {
      const ctx = createMockContext({ path: '/test' });
      const next = vi.fn().mockResolvedValue(undefined);

      // Mock collector to throw error
      const brokenCollector = new MetricsCollectorImpl();
      vi.spyOn(brokenCollector, 'recordHttpRequest').mockImplementation(() => {
        throw new Error('Metrics recording failed');
      });

      const brokenMiddleware = createMetricsMiddleware({
        collector: brokenCollector,
      });

      // Should not throw despite metrics error
      await expect(brokenMiddleware.execute(ctx, next)).resolves.toBeUndefined();
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Path exclusions', () => {
    test('excludes exact path matches', async () => {
      const ctx = createMockContext({ path: '/health' });
      const next = vi.fn().mockResolvedValue(undefined);

      await middleware.execute(ctx, next);

      const snapshot = collector.getSnapshot();
      expect(snapshot.http.totalRequests).toBe(0);
      expect(next).toHaveBeenCalledTimes(1);
    });

    test('excludes paths matching wildcard prefix', async () => {
      const ctx = createMockContext({ path: '/internal/status' });
      const next = vi.fn().mockResolvedValue(undefined);

      await middleware.execute(ctx, next);

      const snapshot = collector.getSnapshot();
      expect(snapshot.http.totalRequests).toBe(0);
    });

    test('tracks non-excluded paths', async () => {
      const ctx = createMockContext({ path: '/api/users' });
      const next = vi.fn().mockResolvedValue(undefined);

      await middleware.execute(ctx, next);

      const snapshot = collector.getSnapshot();
      expect(snapshot.http.totalRequests).toBe(1);
    });

    test('handles empty excludePaths array', async () => {
      const noExclusionMw = createMetricsMiddleware({
        collector,
        excludePaths: [],
      });

      const ctx = createMockContext({ path: '/health' });
      const next = vi.fn().mockResolvedValue(undefined);

      await noExclusionMw.execute(ctx, next);

      const snapshot = collector.getSnapshot();
      expect(snapshot.http.totalRequests).toBe(1);
    });

    test('still injects metrics even for excluded paths', async () => {
      const ctx = createMockContext({ path: '/health' });
      const next = vi.fn().mockResolvedValue(undefined);

      await middleware.execute(ctx, next);

      expect(ctx.services.metrics).toBe(collector);
    });
  });

  describe('Status code extraction', () => {
    test('extracts status from ctx.response.status', async () => {
      const ctx = createMockContext({
        method: 'GET',
        path: '/test',
        status: 404,
      });
      const next = vi.fn().mockResolvedValue(undefined);

      await middleware.execute(ctx, next);

      const snapshot = collector.getSnapshot();
      expect(snapshot.http.statusCodes['404']).toBe(1);
    });

    test('defaults to 200 when no status available', async () => {
      const ctx = createMockContext({
        method: 'GET',
        path: '/test',
      });
      delete (ctx.response as any).status;

      const next = vi.fn().mockResolvedValue(undefined);

      await middleware.execute(ctx, next);

      const snapshot = collector.getSnapshot();
      expect(snapshot.http.statusCodes['200']).toBe(1);
    });
  });

  describe('Method and path extraction', () => {
    test('extracts method from ctx.request.method', async () => {
      const ctx = createMockContext({ method: 'PUT', path: '/test' });
      const next = vi.fn().mockResolvedValue(undefined);

      await middleware.execute(ctx, next);

      const snapshot = collector.getSnapshot();
      expect(snapshot.http.byMethod['PUT']?.count).toBe(1);
    });

    test('defaults to UNKNOWN method', async () => {
      const ctx = createMockContext({ path: '/test' });
      delete (ctx.request as any).method;

      const next = vi.fn().mockResolvedValue(undefined);

      await middleware.execute(ctx, next);

      const snapshot = collector.getSnapshot();
      expect(snapshot.http.byMethod['UNKNOWN']?.count).toBe(1);
    });

    test('extracts path from ctx.request.path', async () => {
      const ctx = createMockContext({ method: 'GET', path: '/api/custom/path' });
      const next = vi.fn().mockResolvedValue(undefined);

      await middleware.execute(ctx, next);

      const snapshot = collector.getSnapshot();
      expect(snapshot.http.byRoute['/api/custom/path']?.count).toBe(1);
    });

    test('defaults to / path', async () => {
      const ctx = createMockContext({ method: 'GET' });
      delete (ctx.request as any).path;

      const next = vi.fn().mockResolvedValue(undefined);

      await middleware.execute(ctx, next);

      const snapshot = collector.getSnapshot();
      expect(snapshot.http.byRoute['/']?.count).toBe(1);
    });
  });

  describe('Performance', () => {
    test('minimal overhead for excluded paths', async () => {
      const ctx = createMockContext({ path: '/health' });
      const next = vi.fn().mockResolvedValue(undefined);

      const start = performance.now();
      await middleware.execute(ctx, next);
      const elapsed = performance.now() - start;

      // Should be very fast (< 5ms) since no tracking
      expect(elapsed).toBeLessThan(5);
    });

    test('handles high request throughput', async () => {
      const requests = Array.from({ length: 100 }, (_, i) => ({
        method: 'GET',
        path: `/api/test/${i}`,
        status: 200,
      }));

      const start = performance.now();

      for (const req of requests) {
        const ctx = createMockContext(req);
        const next = vi.fn().mockResolvedValue(undefined);
        await middleware.execute(ctx, next);
      }

      const elapsed = performance.now() - start;

      // Should complete 100 requests quickly (< 100ms)
      expect(elapsed).toBeLessThan(100);

      const snapshot = collector.getSnapshot();
      expect(snapshot.http.totalRequests).toBe(100);
    });
  });
});

describe('shouldExcludePath', () => {
  test('matches exact paths', () => {
    expect(shouldExcludePath('/health', ['/health'])).toBe(true);
    expect(shouldExcludePath('/metrics', ['/health', '/metrics'])).toBe(true);
  });

  test('matches wildcard prefix patterns', () => {
    expect(shouldExcludePath('/internal/status', ['/internal/*'])).toBe(true);
    expect(shouldExcludePath('/internal/health', ['/internal/*'])).toBe(true);
    expect(shouldExcludePath('/internal', ['/internal/*'])).toBe(true);
  });

  test('does not match non-matching paths', () => {
    expect(shouldExcludePath('/api/users', ['/health'])).toBe(false);
    expect(shouldExcludePath('/api/orders', ['/internal/*'])).toBe(false);
  });

  test('handles empty exclude list', () => {
    expect(shouldExcludePath('/any/path', [])).toBe(false);
  });

  test('handles multiple patterns', () => {
    const excludes = ['/health', '/metrics', '/internal/*', '/admin/*'];

    expect(shouldExcludePath('/health', excludes)).toBe(true);
    expect(shouldExcludePath('/internal/test', excludes)).toBe(true);
    expect(shouldExcludePath('/api/users', excludes)).toBe(false);
  });

  test('wildcard does not match partial prefixes', () => {
    expect(shouldExcludePath('/internalabc', ['/internal/*'])).toBe(false);
    expect(shouldExcludePath('/xinternal/test', ['/internal/*'])).toBe(false);
  });

  test('exact match takes precedence', () => {
    expect(shouldExcludePath('/test', ['/test', '/test/*'])).toBe(true);
  });

  test('handles root path', () => {
    expect(shouldExcludePath('/', ['/'])).toBe(true);
    expect(shouldExcludePath('/', ['/*'])).toBe(true);
  });

  test('case sensitive matching', () => {
    expect(shouldExcludePath('/Health', ['/health'])).toBe(false);
    expect(shouldExcludePath('/INTERNAL/test', ['/internal/*'])).toBe(false);
  });
});

describe('getErrorStatusCode', () => {
  test('extracts status property', () => {
    const error = { status: 404 };
    expect(getErrorStatusCode(error)).toBe(404);
  });

  test('extracts statusCode property', () => {
    const error = { statusCode: 400 };
    expect(getErrorStatusCode(error)).toBe(400);
  });

  test('extracts code property', () => {
    const error = { code: 403 };
    expect(getErrorStatusCode(error)).toBe(403);
  });

  test('defaults to 500 for unknown errors', () => {
    expect(getErrorStatusCode(new Error('Unknown'))).toBe(500);
    expect(getErrorStatusCode({})).toBe(500);
    expect(getErrorStatusCode('string error')).toBe(500);
    expect(getErrorStatusCode(null)).toBe(500);
    expect(getErrorStatusCode(undefined)).toBe(500);
  });

  test('prioritizes status over statusCode', () => {
    const error = { status: 404, statusCode: 400 };
    expect(getErrorStatusCode(error)).toBe(404);
  });

  test('prioritizes statusCode over code', () => {
    const error = { statusCode: 400, code: 403 };
    expect(getErrorStatusCode(error)).toBe(400);
  });

  test('handles Error instances with status', () => {
    const error = new Error('Not found');
    (error as any).status = 404;
    expect(getErrorStatusCode(error)).toBe(404);
  });

  test('ignores non-number status properties', () => {
    const error = { status: 'not a number' };
    expect(getErrorStatusCode(error)).toBe(500);
  });
});

/**
 * Helper to create mock BlaizeJS context
 */
function createMockContext(
  options: {
    method?: string;
    path?: string;
    status?: number;
  } = {}
): MetricsContext {
  const mockRes = {
    statusCode: options.status || 200,
  };

  return {
    request: {
      method: options.method || 'GET',
      path: options.path || '/test',
    } as any,
    response: {
      raw: mockRes,
    } as any,
    services: {} as any,
    state: {} as any,
  } as MetricsContext;
}
