/**
 * @file Routes Configuration tests
 * @description Integration tests for metrics route handlers
 */

import { metricsJsonRoute, metricsPrometheusRoute, metricsDashboardRoute } from './routes';

import type { MetricsCollector, MetricsSnapshot } from './types';
import type { Context } from 'blaizejs';

/**
 * Create a mock context for testing
 */
function createMockContext(
  services: Record<string, any> = {},
  state: Record<string, any> = {}
): Context {
  const headers: Record<string, string> = {};
  let statusCode = 200;
  let responseBody: any = null;
  let contentType: string | null = null;
  let sent = false;

  return {
    request: {
      method: 'GET',
      path: '/metrics',
      url: null,
      query: {},
      params: {},
      body: null,
      protocol: 'http',
      isHttp2: false,
      header: () => undefined,
      headers: () => ({}),
      raw: {} as any,
    },
    response: {
      raw: {} as any,
      statusCode,
      sent,
      status(code: number) {
        statusCode = code;
        return this;
      },
      header(name: string, value: string) {
        headers[name.toLowerCase()] = value;
        return this;
      },
      headers(hdrs: Record<string, string>) {
        Object.entries(hdrs).forEach(([k, v]) => {
          headers[k.toLowerCase()] = v;
        });
        return this;
      },
      type(ct: string) {
        contentType = ct;
        return this;
      },
      json(data: any, status?: number) {
        if (status !== undefined) statusCode = status;
        responseBody = data;
        contentType = contentType || 'application/json';
        sent = true;
      },
      text(data: string, status?: number) {
        if (status !== undefined) statusCode = status;
        responseBody = data;
        sent = true;
      },
      html(data: string, status?: number) {
        if (status !== undefined) statusCode = status;
        responseBody = data;
        sent = true;
      },
      redirect() {
        sent = true;
      },
      stream() {
        sent = true;
      },
    } as any,
    state,
    services,
    // Test helper to get response details
    _getResponse() {
      return { statusCode, responseBody, contentType, headers, sent };
    },
  } as any;
}

/**
 * Create a mock metrics collector
 */
function createMockCollector(): MetricsCollector {
  const snapshot: MetricsSnapshot = {
    timestamp: Date.now(),
    http: {
      totalRequests: 1000,
      activeRequests: 5,
      requestsPerSecond: 10.5,
      statusCodes: {
        '200': 950,
        '404': 30,
        '500': 20,
      },
      latency: {
        count: 1000,
        sum: 50000,
        min: 10,
        max: 500,
        mean: 50,
        p50: 45,
        p95: 120,
        p99: 200,
      },
      byMethod: {
        GET: { count: 800, avgLatency: 45 },
        POST: { count: 200, avgLatency: 80 },
      },
      byRoute: {
        '/api/users': { count: 600, avgLatency: 40 },
        '/api/orders': { count: 400, avgLatency: 65 },
      },
    },
    process: {
      memoryUsage: {
        heapUsed: 50000000,
        heapTotal: 100000000,
        external: 1000000,
        rss: 120000000,
      },
      cpuUsage: {
        user: 1000000,
        system: 500000,
      },
      uptime: 3600.5,
      eventLoopLag: 5.5,
    },
    custom: {
      counters: { 'orders.created': 42 },
      gauges: { 'queue.size': 10 },
      histograms: {},
      timers: {},
    },
  };

  return {
    getSnapshot: vi.fn(() => snapshot),
    trackRequest: vi.fn(),
    recordLatency: vi.fn(),
    incrementCounter: vi.fn(),
    setGauge: vi.fn(),
    recordHistogram: vi.fn(),
    startTimer: vi.fn(),
  } as any;
}

describe('metricsJsonRoute', () => {
  describe('Success cases', () => {
    test('returns JSON snapshot when collector available', async () => {
      const collector = createMockCollector();
      const ctx = createMockContext({ metrics: collector });

      await metricsJsonRoute.handler(ctx);

      const response = (ctx as any)._getResponse();
      expect(response.statusCode).toBe(200);
      expect(response.responseBody).toHaveProperty('timestamp');
      expect(response.responseBody).toHaveProperty('http');
      expect(response.responseBody).toHaveProperty('process');
      expect(response.responseBody).toHaveProperty('custom');
      expect(response.sent).toBe(true);
    });

    test('calls getSnapshot on collector', async () => {
      const collector = createMockCollector();
      const ctx = createMockContext({ metrics: collector });

      await metricsJsonRoute.handler(ctx);

      expect(collector.getSnapshot).toHaveBeenCalledTimes(1);
    });

    test('returns complete snapshot structure', async () => {
      const collector = createMockCollector();
      const ctx = createMockContext({ metrics: collector });

      await metricsJsonRoute.handler(ctx);

      const response = (ctx as any)._getResponse();
      const snapshot = response.responseBody;

      expect(snapshot.http.totalRequests).toBe(1000);
      expect(snapshot.http.activeRequests).toBe(5);
      expect(snapshot.process.uptime).toBe(3600.5);
      expect(snapshot.custom.counters['orders.created']).toBe(42);
    });
  });

  describe('Error cases', () => {
    test('throws ServiceNotAvailableError when metrics service unavailable', async () => {
      const ctx = createMockContext({}, {});

      try {
        await metricsJsonRoute.handler(ctx);
        expect.fail('Should have thrown');
      } catch (error: any) {
        expect(error.status).toBe(503);
        expect(error.title).toBe('Metrics service unavailable');
      }
    });

    test('throws ServiceNotAvailableError with details', async () => {
      const ctx = createMockContext({}, {});

      try {
        await metricsJsonRoute.handler(ctx);
        expect.fail('Should have thrown');
      } catch (error: any) {
        expect(error.details).toMatchObject({
          service: 'metrics-collector',
          reason: 'dependency_down',
          suggestion: expect.stringContaining('properly registered'),
        });
      }
    });

    test('throws InternalServerError when snapshot generation fails', async () => {
      const collector = {
        getSnapshot: vi.fn(() => {
          throw new Error('Snapshot failed');
        }),
      };
      const ctx = createMockContext({ metrics: collector });

      await expect(metricsJsonRoute.handler(ctx)).rejects.toThrow(
        'Error generating metrics snapshot'
      );
    });
  });
});

describe('metricsPrometheusRoute', () => {
  describe('Success cases', () => {
    test('returns Prometheus text format when collector available', async () => {
      const collector = createMockCollector();
      const ctx = createMockContext({ metrics: collector });

      await metricsPrometheusRoute.handler(ctx);

      const response = (ctx as any)._getResponse();
      expect(response.statusCode).toBe(200);
      expect(response.contentType).toBe('text/plain; version=0.0.4; charset=utf-8');
      expect(response.responseBody).toContain('# HELP http_requests_total');
      expect(response.responseBody).toContain('# TYPE http_requests_total counter');
      expect(response.sent).toBe(true);
    });

    test('calls getSnapshot on collector', async () => {
      const collector = createMockCollector();
      const ctx = createMockContext({ metrics: collector });

      await metricsPrometheusRoute.handler(ctx);

      expect(collector.getSnapshot).toHaveBeenCalledTimes(1);
    });

    test('includes metrics data in response', async () => {
      const collector = createMockCollector();
      const ctx = createMockContext({ metrics: collector });

      await metricsPrometheusRoute.handler(ctx);

      const response = (ctx as any)._getResponse();
      expect(response.responseBody).toContain('http_requests_total 1000');
      expect(response.responseBody).toContain('http_requests_active 5');
    });

    test('applies global labels from context state', async () => {
      const collector = createMockCollector();
      const ctx = createMockContext(
        { metrics: collector },
        {
          serviceName: 'api',
          environment: 'production',
          instanceId: 'instance-1',
        }
      );

      await metricsPrometheusRoute.handler(ctx);

      const response = (ctx as any)._getResponse();
      expect(response.responseBody).toContain('service="api"');
      expect(response.responseBody).toContain('environment="production"');
      expect(response.responseBody).toContain('instance="instance-1"');
    });

    test('works without global labels', async () => {
      const collector = createMockCollector();
      const ctx = createMockContext({ metrics: collector }, {});

      await metricsPrometheusRoute.handler(ctx);

      const response = (ctx as any)._getResponse();
      expect(response.statusCode).toBe(200);
      expect(response.responseBody).toContain('http_requests_total 1000');
    });
  });

  describe('Error cases', () => {
    test('throws ServiceNotAvailableError when metrics service unavailable', async () => {
      const ctx = createMockContext({}, {});

      await expect(metricsPrometheusRoute.handler(ctx)).rejects.toThrow(
        'Metrics service unavailable'
      );
    });

    test('throws InternalServerError when export fails', async () => {
      const collector = {
        getSnapshot: vi.fn(() => {
          throw new Error('Export failed');
        }),
      };
      const ctx = createMockContext({ metrics: collector });

      await expect(metricsPrometheusRoute.handler(ctx)).rejects.toThrow(
        'Error generating Prometheus metrics'
      );
    });
  });

  describe('Content-Type header', () => {
    test('sets correct Prometheus content type with version', async () => {
      const collector = createMockCollector();
      const ctx = createMockContext({ metrics: collector });

      await metricsPrometheusRoute.handler(ctx);

      const response = (ctx as any)._getResponse();
      expect(response.contentType).toBe('text/plain; version=0.0.4; charset=utf-8');
    });
  });
});

describe('metricsDashboardRoute', () => {
  describe('Success cases', () => {
    test('returns HTML dashboard when collector available', async () => {
      const collector = createMockCollector();
      const ctx = createMockContext({ metrics: collector });

      await metricsDashboardRoute.handler(ctx);

      const response = (ctx as any)._getResponse();
      expect(response.statusCode).toBe(200);
      expect(response.contentType).toBe('text/html; charset=utf-8');
      expect(response.responseBody).toContain('<!DOCTYPE html>');
      expect(response.responseBody).toContain('BlaizeJS Metrics');
      expect(response.sent).toBe(true);
    });

    test('calls getSnapshot on collector', async () => {
      const collector = createMockCollector();
      const ctx = createMockContext({ metrics: collector });

      await metricsDashboardRoute.handler(ctx);

      expect(collector.getSnapshot).toHaveBeenCalledTimes(1);
    });

    test('includes metrics data in HTML', async () => {
      const collector = createMockCollector();
      const ctx = createMockContext({ metrics: collector });

      await metricsDashboardRoute.handler(ctx);

      const response = (ctx as any)._getResponse();
      expect(response.responseBody).toContain('Total Requests');
      expect(response.responseBody).toContain('1,000');
      expect(response.responseBody).toContain('Active Requests');
      expect(response.responseBody).toContain('>5<');
    });

    test('includes BlaizeJS branding', async () => {
      const collector = createMockCollector();
      const ctx = createMockContext({ metrics: collector });

      await metricsDashboardRoute.handler(ctx);

      const response = (ctx as any)._getResponse();
      expect(response.responseBody).toContain('🔥');
      expect(response.responseBody).toContain('BlaizeJS');
    });
  });

  describe('Error cases', () => {
    test('throws ServiceNotAvailableError when metrics service unavailable', async () => {
      const ctx = createMockContext({}, {});

      await expect(metricsDashboardRoute.handler(ctx)).rejects.toThrow(
        'Metrics service unavailable'
      );
    });

    test('throws InternalServerError when dashboard generation fails', async () => {
      const collector = {
        getSnapshot: vi.fn(() => {
          throw new Error('Dashboard failed');
        }),
      };
      const ctx = createMockContext({ metrics: collector });

      await expect(metricsDashboardRoute.handler(ctx)).rejects.toThrow(
        'Error generating metrics dashboard'
      );
    });
  });

  describe('Content-Type header', () => {
    test('sets correct HTML content type with charset', async () => {
      const collector = createMockCollector();
      const ctx = createMockContext({ metrics: collector });

      await metricsDashboardRoute.handler(ctx);

      const response = (ctx as any)._getResponse();
      expect(response.contentType).toBe('text/html; charset=utf-8');
    });
  });

  describe('Content-Type header', () => {
    test('sets correct HTML content type with charset', async () => {
      const collector = createMockCollector();
      const ctx = createMockContext({ metrics: collector });

      await metricsDashboardRoute.handler(ctx);

      const response = (ctx as any)._getResponse();
      expect(response.contentType).toBe('text/html; charset=utf-8');
    });
  });
});

describe('Route integration', () => {
  test('all three routes can be used together', async () => {
    const collector = createMockCollector();

    const jsonCtx = createMockContext({ metrics: collector });
    const prometheusCtx = createMockContext({ metrics: collector });
    const dashboardCtx = createMockContext({ metrics: collector });

    await metricsJsonRoute.handler(jsonCtx);
    await metricsPrometheusRoute.handler(prometheusCtx);
    await metricsDashboardRoute.handler(dashboardCtx);

    const jsonResponse = (jsonCtx as any)._getResponse();
    const prometheusResponse = (prometheusCtx as any)._getResponse();
    const dashboardResponse = (dashboardCtx as any)._getResponse();

    expect(jsonResponse.statusCode).toBe(200);
    expect(prometheusResponse.statusCode).toBe(200);
    expect(dashboardResponse.statusCode).toBe(200);

    expect(jsonResponse.responseBody).toHaveProperty('timestamp');
    expect(prometheusResponse.contentType).toContain('text/plain');
    expect(dashboardResponse.contentType).toContain('text/html');
  });

  test('routes share same collector instance', async () => {
    const collector = createMockCollector();

    const ctx1 = createMockContext({ metrics: collector });
    const ctx2 = createMockContext({ metrics: collector });
    const ctx3 = createMockContext({ metrics: collector });

    await metricsJsonRoute.handler(ctx1);
    await metricsPrometheusRoute.handler(ctx2);
    await metricsDashboardRoute.handler(ctx3);

    // Should call getSnapshot three times on the same collector
    expect(collector.getSnapshot).toHaveBeenCalledTimes(3);
  });

  test('all routes throw errors when service unavailable', async () => {
    const ctx1 = createMockContext({});
    const ctx2 = createMockContext({});
    const ctx3 = createMockContext({});

    await expect(metricsJsonRoute.handler(ctx1)).rejects.toThrow('Metrics service unavailable');
    await expect(metricsPrometheusRoute.handler(ctx2)).rejects.toThrow(
      'Metrics service unavailable'
    );
    await expect(metricsDashboardRoute.handler(ctx3)).rejects.toThrow(
      'Metrics service unavailable'
    );
  });
});

describe('TypeScript type compatibility', () => {
  test('all handlers are compatible with BlaizeJS routes', () => {
    const h1 = metricsJsonRoute.handler;
    const h2 = metricsPrometheusRoute.handler;
    const h3 = metricsDashboardRoute.handler;

    expect(h1).toBeDefined();
    expect(h2).toBeDefined();
    expect(h3).toBeDefined();
  });
});
