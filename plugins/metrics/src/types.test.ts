/**
 * @file Type definition tests
 * @description Tests for TypeScript interfaces and type guards
 */

import { isMetricsPluginConfig } from './types';

import type {
  MetricsPluginConfig,
  MetricsCollector,
  MetricsSnapshot,
  HttpMetrics,
  ProcessMetrics,
  CustomMetrics,
  HistogramStats,
  RouteMetrics,
  HistogramData,
} from './types';

describe('Type definitions', () => {
  describe('MetricsPluginConfig', () => {
    test('accepts valid configuration', () => {
      const config: MetricsPluginConfig = {
        enabled: true,
        excludePaths: ['/health', '/metrics'],
        histogramLimit: 1000,
        collectionInterval: 60000,
        labels: {
          service: 'api',
          environment: 'production',
        },
        reporter: snapshot => {
          console.log(snapshot.timestamp);
        },
      };

      expect(config).toBeDefined();
      expectTypeOf(config).toEqualTypeOf<MetricsPluginConfig>();
    });

    test('all properties are optional', () => {
      const config: MetricsPluginConfig = {};
      expect(config).toBeDefined();
      expectTypeOf(config).toEqualTypeOf<MetricsPluginConfig>();
    });

    test('enabled is boolean', () => {
      const config: MetricsPluginConfig = { enabled: true };
      expectTypeOf(config.enabled).toEqualTypeOf<boolean | undefined>();
    });

    test('excludePaths is string array', () => {
      const config: MetricsPluginConfig = { excludePaths: ['/test'] };
      expectTypeOf(config.excludePaths).toEqualTypeOf<string[] | undefined>();
    });

    test('histogramLimit is number', () => {
      const config: MetricsPluginConfig = { histogramLimit: 500 };
      expectTypeOf(config.histogramLimit).toEqualTypeOf<number | undefined>();
    });

    test('collectionInterval is number', () => {
      const config: MetricsPluginConfig = { collectionInterval: 30000 };
      expectTypeOf(config.collectionInterval).toEqualTypeOf<number | undefined>();
    });

    test('labels is string record', () => {
      const config: MetricsPluginConfig = { labels: { key: 'value' } };
      expectTypeOf(config.labels).toEqualTypeOf<Record<string, string> | undefined>();
    });

    test('reporter is function', () => {
      const config: MetricsPluginConfig = {
        reporter: snapshot => {
          console.log(snapshot);
        },
      };
      expectTypeOf(config.reporter).toMatchTypeOf<
        ((snapshot: MetricsSnapshot) => void | Promise<void>) | undefined
      >();
    });
  });

  describe('MetricsCollector', () => {
    test('has required methods', () => {
      const mockCollector: MetricsCollector = {
        increment: (_name: string, _value?: number) => {},
        gauge: (_name: string, _value: number) => {},
        histogram: (_name: string, _value: number) => {},
        startTimer: (_name: string) => () => {},
        startHttpRequest: () => {},
        recordHttpRequest: (
          _method: string,
          _path: string,
          _statusCode: number,
          _duration: number
        ) => {},
        getSnapshot: () => ({}) as MetricsSnapshot,
        reset: () => {},
        startCollection: () => {},
        stopCollection: () => {},
        isCollecting: () => false,
      };

      expectTypeOf(mockCollector).toMatchTypeOf<MetricsCollector>();
    });

    test('increment signature is correct', () => {
      expectTypeOf<MetricsCollector['increment']>().toEqualTypeOf<
        (name: string, value?: number) => void
      >();
    });

    test('gauge signature is correct', () => {
      expectTypeOf<MetricsCollector['gauge']>().toEqualTypeOf<
        (name: string, value: number) => void
      >();
    });

    test('histogram signature is correct', () => {
      expectTypeOf<MetricsCollector['histogram']>().toEqualTypeOf<
        (name: string, value: number) => void
      >();
    });

    test('startTimer returns function', () => {
      expectTypeOf<MetricsCollector['startTimer']>().returns.toEqualTypeOf<() => void>();
    });

    test('getSnapshot returns MetricsSnapshot', () => {
      expectTypeOf<MetricsCollector['getSnapshot']>().returns.toEqualTypeOf<MetricsSnapshot>();
    });

    test('reset returns void', () => {
      expectTypeOf<MetricsCollector['reset']>().returns.toEqualTypeOf<void>();
    });
  });

  describe('MetricsSnapshot', () => {
    test('has required properties', () => {
      const snapshot: MetricsSnapshot = {
        timestamp: Date.now(),
        http: {} as HttpMetrics,
        process: {} as ProcessMetrics,
        custom: {} as CustomMetrics,
      };

      expectTypeOf(snapshot).toMatchTypeOf<MetricsSnapshot>();
    });

    test('timestamp is number', () => {
      expectTypeOf<MetricsSnapshot['timestamp']>().toEqualTypeOf<number>();
    });

    test('http is HttpMetrics', () => {
      expectTypeOf<MetricsSnapshot['http']>().toEqualTypeOf<HttpMetrics>();
    });

    test('process is ProcessMetrics', () => {
      expectTypeOf<MetricsSnapshot['process']>().toEqualTypeOf<ProcessMetrics>();
    });

    test('custom is CustomMetrics', () => {
      expectTypeOf<MetricsSnapshot['custom']>().toEqualTypeOf<CustomMetrics>();
    });
  });

  describe('HttpMetrics', () => {
    test('has required properties', () => {
      const metrics: HttpMetrics = {
        totalRequests: 1000,
        activeRequests: 5,
        requestsPerSecond: 10.5,
        statusCodes: { '200': 950 },
        latency: {} as HistogramStats,
        byMethod: {},
        byRoute: {},
      };

      expectTypeOf(metrics).toEqualTypeOf<HttpMetrics>();
    });

    test('all numeric properties are numbers', () => {
      expectTypeOf<HttpMetrics['totalRequests']>().toEqualTypeOf<number>();
      expectTypeOf<HttpMetrics['activeRequests']>().toEqualTypeOf<number>();
      expectTypeOf<HttpMetrics['requestsPerSecond']>().toEqualTypeOf<number>();
    });

    test('statusCodes is number record', () => {
      expectTypeOf<HttpMetrics['statusCodes']>().toEqualTypeOf<Record<string, number>>();
    });

    test('latency is HistogramStats', () => {
      expectTypeOf<HttpMetrics['latency']>().toEqualTypeOf<HistogramStats>();
    });

    test('byMethod is RouteMetrics record', () => {
      expectTypeOf<HttpMetrics['byMethod']>().toEqualTypeOf<Record<string, RouteMetrics>>();
    });

    test('byRoute is RouteMetrics record', () => {
      expectTypeOf<HttpMetrics['byRoute']>().toEqualTypeOf<Record<string, RouteMetrics>>();
    });
  });

  describe('ProcessMetrics', () => {
    test('has required properties', () => {
      const metrics: ProcessMetrics = {
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
        uptime: 3600,
        eventLoopLag: 5,
      };

      expectTypeOf(metrics).toMatchTypeOf<ProcessMetrics>();
    });

    test('memoryUsage has correct structure', () => {
      expectTypeOf<ProcessMetrics['memoryUsage']>().toEqualTypeOf<{
        heapUsed: number;
        heapTotal: number;
        external: number;
        rss: number;
      }>();
    });

    test('cpuUsage has correct structure', () => {
      expectTypeOf<ProcessMetrics['cpuUsage']>().toEqualTypeOf<{
        user: number;
        system: number;
      }>();
    });

    test('uptime is number', () => {
      expectTypeOf<ProcessMetrics['uptime']>().toEqualTypeOf<number>();
    });

    test('eventLoopLag is number', () => {
      expectTypeOf<ProcessMetrics['eventLoopLag']>().toEqualTypeOf<number>();
    });
  });

  describe('CustomMetrics', () => {
    test('has required properties', () => {
      const metrics: CustomMetrics = {
        counters: {},
        gauges: {},
        histograms: {},
        timers: {},
      };

      expectTypeOf(metrics).toMatchTypeOf<CustomMetrics>();
    });

    test('counters is number record', () => {
      expectTypeOf<CustomMetrics['counters']>().toEqualTypeOf<Record<string, number>>();
    });

    test('gauges is number record', () => {
      expectTypeOf<CustomMetrics['gauges']>().toEqualTypeOf<Record<string, number>>();
    });

    test('histograms is HistogramStats record', () => {
      expectTypeOf<CustomMetrics['histograms']>().toEqualTypeOf<Record<string, HistogramStats>>();
    });

    test('timers is HistogramStats record', () => {
      expectTypeOf<CustomMetrics['timers']>().toEqualTypeOf<Record<string, HistogramStats>>();
    });
  });

  describe('HistogramStats', () => {
    test('has all required properties', () => {
      const stats: HistogramStats = {
        count: 100,
        sum: 5000,
        min: 10,
        max: 200,
        mean: 50,
        p50: 45,
        p95: 120,
        p99: 180,
      };

      expectTypeOf(stats).toEqualTypeOf<HistogramStats>();
    });

    test('all properties are numbers', () => {
      expectTypeOf<HistogramStats['count']>().toEqualTypeOf<number>();
      expectTypeOf<HistogramStats['sum']>().toEqualTypeOf<number>();
      expectTypeOf<HistogramStats['min']>().toEqualTypeOf<number>();
      expectTypeOf<HistogramStats['max']>().toEqualTypeOf<number>();
      expectTypeOf<HistogramStats['mean']>().toEqualTypeOf<number>();
      expectTypeOf<HistogramStats['p50']>().toEqualTypeOf<number>();
      expectTypeOf<HistogramStats['p95']>().toEqualTypeOf<number>();
      expectTypeOf<HistogramStats['p99']>().toEqualTypeOf<number>();
    });
  });

  describe('RouteMetrics', () => {
    test('has required properties', () => {
      const metrics: RouteMetrics = {
        count: 1000,
        avgLatency: 50,
      };

      expectTypeOf(metrics).toMatchTypeOf<RouteMetrics>();
    });

    test('count is number', () => {
      expectTypeOf<RouteMetrics['count']>().toEqualTypeOf<number>();
    });

    test('avgLatency is number', () => {
      expectTypeOf<RouteMetrics['avgLatency']>().toEqualTypeOf<number>();
    });
  });

  describe('HistogramData (internal)', () => {
    test('has correct structure', () => {
      const data: HistogramData = {
        samples: [1, 2, 3],
        limit: 1000,
      };

      expectTypeOf(data).toEqualTypeOf<HistogramData>();
    });

    test('samples is number array', () => {
      expectTypeOf<HistogramData['samples']>().toEqualTypeOf<number[]>();
    });

    test('limit is number', () => {
      expectTypeOf<HistogramData['limit']>().toEqualTypeOf<number>();
    });
  });
});

describe('isMetricsPluginConfig type guard', () => {
  test('returns true for valid empty config', () => {
    expect(isMetricsPluginConfig({})).toBe(true);
  });

  test('returns true for valid full config', () => {
    const config: MetricsPluginConfig = {
      enabled: true,
      excludePaths: ['/health'],
      histogramLimit: 1000,
      collectionInterval: 60000,
      labels: { service: 'api' },
      reporter: () => {},
    };

    expect(isMetricsPluginConfig(config)).toBe(true);
  });

  test('returns false for null', () => {
    expect(isMetricsPluginConfig(null)).toBe(false);
  });

  test('returns false for undefined', () => {
    expect(isMetricsPluginConfig(undefined)).toBe(false);
  });

  test('returns false for non-object', () => {
    expect(isMetricsPluginConfig('string')).toBe(false);
    expect(isMetricsPluginConfig(123)).toBe(false);
    expect(isMetricsPluginConfig(true)).toBe(false);
  });

  test('returns false for invalid enabled type', () => {
    expect(isMetricsPluginConfig({ enabled: 'true' })).toBe(false);
  });

  test('returns false for invalid excludePaths type', () => {
    expect(isMetricsPluginConfig({ excludePaths: 'not-array' })).toBe(false);
    expect(isMetricsPluginConfig({ excludePaths: [1, 2, 3] })).toBe(false);
  });

  test('returns false for invalid histogramLimit type', () => {
    expect(isMetricsPluginConfig({ histogramLimit: '1000' })).toBe(false);
  });

  test('returns false for invalid collectionInterval type', () => {
    expect(isMetricsPluginConfig({ collectionInterval: '60000' })).toBe(false);
  });

  test('returns false for invalid labels type', () => {
    expect(isMetricsPluginConfig({ labels: 'not-object' })).toBe(false);
    expect(isMetricsPluginConfig({ labels: null })).toBe(false);
    expect(isMetricsPluginConfig({ labels: { key: 123 } })).toBe(false);
  });

  test('returns false for invalid logToConsole type', () => {
    expect(isMetricsPluginConfig({ logToConsole: 'true' })).toBe(false);
  });

  test('returns false for invalid reporter type', () => {
    expect(isMetricsPluginConfig({ reporter: 'not-function' })).toBe(false);
  });

  test('returns true for partial valid config', () => {
    expect(isMetricsPluginConfig({ enabled: true })).toBe(true);
    expect(isMetricsPluginConfig({ excludePaths: ['/test'] })).toBe(true);
    expect(isMetricsPluginConfig({ histogramLimit: 500 })).toBe(true);
    expect(isMetricsPluginConfig({ labels: { key: 'value' } })).toBe(true);
  });

  test('narrows type correctly', () => {
    const value: unknown = { enabled: true };

    if (isMetricsPluginConfig(value)) {
      // TypeScript should know value is MetricsPluginConfig here
      expectTypeOf(value).toMatchTypeOf<MetricsPluginConfig>();
      expect(value.enabled).toBe(true);
    }
  });
});

describe('Type safety - no any types', () => {
  test('MetricsPluginConfig has no any types', () => {
    const config: MetricsPluginConfig = {
      enabled: true,
      // @ts-expect-error - should not accept any type
      invalidProp: 'invalid',
    };

    expect(config).toBeDefined();
  });

  test('MetricsCollector has no any types', () => {
    const collector: MetricsCollector = {
      increment: (_name: string, _value?: number) => {},
      gauge: (_name: string, _value: number) => {},
      histogram: (_name: string, _value: number) => {},
      startTimer: (_name: string) => () => {},
      getSnapshot: () => ({}) as MetricsSnapshot,
      reset: () => {},
      // @ts-expect-error - should not accept any type
      invalidMethod: () => {},
    };

    expect(collector).toBeDefined();
  });

  test('MetricsSnapshot has no any types', () => {
    const snapshot: MetricsSnapshot = {
      timestamp: Date.now(),
      http: {} as HttpMetrics,
      process: {} as ProcessMetrics,
      custom: {} as CustomMetrics,
      // @ts-expect-error - should not accept any type
      invalidProp: 'invalid',
    };

    expect(snapshot).toBeDefined();
  });
});

describe('Documentation examples compile', () => {
  test('MetricsPluginConfig example compiles', () => {
    const config: MetricsPluginConfig = {
      enabled: true,
      excludePaths: ['/health', '/metrics'],
      histogramLimit: 1000,
      collectionInterval: 60000,
      labels: {
        service: 'api',
        environment: 'production',
      },
    };

    expect(config).toBeDefined();
  });

  test('MetricsCollector example compiles', () => {
    // Mock context for example
    const mockCollector: MetricsCollector = {
      increment: (_name: string, _value?: number) => {},
      gauge: (_name: string, _value: number) => {},
      histogram: (_name: string, _value: number) => {},
      startTimer: (_name: string) => () => {},
      getSnapshot: () => ({}) as MetricsSnapshot,
      reset: () => {},
      startHttpRequest: () => {},
      recordHttpRequest: (
        _method: string,
        _path: string,
        _statusCode: number,
        _duration: number
      ) => {},
      startCollection: () => {},
      stopCollection: () => {},
      isCollecting: () => false,
    };

    // Example usage
    mockCollector.increment('orders.created');
    mockCollector.gauge('queue.size', 42);
    mockCollector.histogram('order.value', 99.99);

    const stopTimer = mockCollector.startTimer('db.query');
    stopTimer();

    expect(mockCollector).toBeDefined();
  });

  test('HistogramStats example compiles', () => {
    const stats: HistogramStats = {
      count: 100,
      sum: 5000,
      min: 10,
      max: 200,
      mean: 50,
      p50: 45,
      p95: 120,
      p99: 180,
    };

    expect(stats.p95).toBe(120);
  });
});
