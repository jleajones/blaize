/**
 * @file Prometheus Exporter tests
 * @description Comprehensive tests for Prometheus text format generation
 */

import { exportPrometheus, sanitizeMetricName, escapeLabel } from './prometheus-formatter';
import type { MetricsSnapshot } from './types';

describe('exportPrometheus', () => {
  function createTestSnapshot(): MetricsSnapshot {
    return {
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
        counters: {
          'orders.created': 42,
          'users.registered': 150,
        },
        gauges: {
          'queue.size': 10,
          'cache.hit.ratio': 0.95,
        },
        histograms: {
          'order.value': {
            count: 42,
            sum: 4200,
            min: 10,
            max: 500,
            mean: 100,
            p50: 95,
            p95: 300,
            p99: 450,
          },
        },
        timers: {
          'db.query': {
            count: 100,
            sum: 5000,
            min: 10,
            max: 200,
            mean: 50,
            p50: 45,
            p95: 120,
            p99: 180,
          },
        },
      },
    };
  }

  describe('Format validation', () => {
    test('exports valid Prometheus text format', () => {
      const snapshot = createTestSnapshot();
      const output = exportPrometheus(snapshot);

      expect(output).toBeTruthy();
      expect(output.endsWith('\n')).toBe(true);
    });

    test('includes HELP and TYPE comments', () => {
      const snapshot = createTestSnapshot();
      const output = exportPrometheus(snapshot);

      expect(output).toContain('# HELP');
      expect(output).toContain('# TYPE');
    });

    test('all lines are properly formatted', () => {
      const snapshot = createTestSnapshot();
      const output = exportPrometheus(snapshot);
      const lines = output.split('\n').filter(l => l.trim());

      for (const line of lines) {
        // Should be comment or metric line
        expect(line.startsWith('#') || /^[a-zA-Z_:]/.test(line)).toBe(true);
      }
    });
  });

  describe('HTTP metrics', () => {
    test('exports total requests counter', () => {
      const snapshot = createTestSnapshot();
      const output = exportPrometheus(snapshot);

      expect(output).toContain('# HELP http_requests_total');
      expect(output).toContain('# TYPE http_requests_total counter');
      expect(output).toContain('http_requests_total 1000');
    });

    test('exports active requests gauge', () => {
      const snapshot = createTestSnapshot();
      const output = exportPrometheus(snapshot);

      expect(output).toContain('# HELP http_requests_active');
      expect(output).toContain('# TYPE http_requests_active gauge');
      expect(output).toContain('http_requests_active 5');
    });

    test('exports requests per second', () => {
      const snapshot = createTestSnapshot();
      const output = exportPrometheus(snapshot);

      expect(output).toContain('# HELP http_requests_per_second');
      expect(output).toContain('http_requests_per_second 10.500');
    });

    test('exports status codes with labels', () => {
      const snapshot = createTestSnapshot();
      const output = exportPrometheus(snapshot);

      expect(output).toContain('http_requests_by_status_total{status="200"} 950');
      expect(output).toContain('http_requests_by_status_total{status="404"} 30');
      expect(output).toContain('http_requests_by_status_total{status="500"} 20');
    });

    test('exports request duration histogram', () => {
      const snapshot = createTestSnapshot();
      const output = exportPrometheus(snapshot);

      expect(output).toContain('# TYPE http_request_duration_seconds histogram');
      expect(output).toContain('http_request_duration_seconds_bucket');
      expect(output).toContain('http_request_duration_seconds_sum');
      expect(output).toContain('http_request_duration_seconds_count 1000');
    });

    test('converts milliseconds to seconds for duration', () => {
      const snapshot = createTestSnapshot();
      const output = exportPrometheus(snapshot);

      // Sum should be 50000ms = 50 seconds
      expect(output).toContain('http_request_duration_seconds_sum 50.000000');
    });

    test('includes histogram buckets with le labels', () => {
      const snapshot = createTestSnapshot();
      const output = exportPrometheus(snapshot);

      expect(output).toContain('le="0.005"');
      expect(output).toContain('le="0.01"');
      expect(output).toContain('le="0.1"');
      expect(output).toContain('le="1"');
      expect(output).toContain('le="+Inf"');
    });

    test('exports by method metrics', () => {
      const snapshot = createTestSnapshot();
      const output = exportPrometheus(snapshot);

      expect(output).toContain('http_requests_by_method_total{method="GET"} 800');
      expect(output).toContain('http_requests_by_method_total{method="POST"} 200');
    });

    test('exports by route metrics with escaped paths', () => {
      const snapshot = createTestSnapshot();
      const output = exportPrometheus(snapshot);

      expect(output).toContain('http_requests_by_route_total{route="/api/users"} 600');
      expect(output).toContain('http_requests_by_route_total{route="/api/orders"} 400');
    });
  });

  describe('Process metrics', () => {
    test('exports memory metrics in bytes', () => {
      const snapshot = createTestSnapshot();
      const output = exportPrometheus(snapshot);

      expect(output).toContain('process_memory_heap_used_bytes 50000000');
      expect(output).toContain('process_memory_heap_total_bytes 100000000');
      expect(output).toContain('process_memory_external_bytes 1000000');
      expect(output).toContain('process_memory_rss_bytes 120000000');
    });

    test('exports CPU metrics in seconds', () => {
      const snapshot = createTestSnapshot();
      const output = exportPrometheus(snapshot);

      // 1000000 microseconds = 1 second
      expect(output).toContain('process_cpu_user_seconds_total 1.000000');
      // 500000 microseconds = 0.5 seconds
      expect(output).toContain('process_cpu_system_seconds_total 0.500000');
    });

    test('exports uptime in seconds', () => {
      const snapshot = createTestSnapshot();
      const output = exportPrometheus(snapshot);

      expect(output).toContain('process_uptime_seconds 3600.500');
    });

    test('exports event loop lag in seconds', () => {
      const snapshot = createTestSnapshot();
      const output = exportPrometheus(snapshot);

      // 5.5ms = 0.0055 seconds
      expect(output).toContain('process_event_loop_lag_seconds 0.005500');
    });
  });

  describe('Custom metrics', () => {
    test('exports custom counters', () => {
      const snapshot = createTestSnapshot();
      const output = exportPrometheus(snapshot);

      expect(output).toContain('# TYPE orders_created counter');
      expect(output).toContain('orders_created 42');
      expect(output).toContain('# TYPE users_registered counter');
      expect(output).toContain('users_registered 150');
    });

    test('exports custom gauges', () => {
      const snapshot = createTestSnapshot();
      const output = exportPrometheus(snapshot);

      expect(output).toContain('# TYPE queue_size gauge');
      expect(output).toContain('queue_size 10');
      expect(output).toContain('# TYPE cache_hit_ratio gauge');
      expect(output).toContain('cache_hit_ratio 0.95');
    });

    test('exports custom histograms', () => {
      const snapshot = createTestSnapshot();
      const output = exportPrometheus(snapshot);

      expect(output).toContain('# TYPE order_value histogram');
      expect(output).toContain('order_value_bucket');
      expect(output).toContain('order_value_sum 4200');
      expect(output).toContain('order_value_count 42');
    });

    test('exports custom timers in seconds', () => {
      const snapshot = createTestSnapshot();
      const output = exportPrometheus(snapshot);

      expect(output).toContain('# TYPE db_query_seconds histogram');
      expect(output).toContain('db_query_seconds_bucket');
      // 5000ms = 5 seconds
      expect(output).toContain('db_query_seconds_sum 5.000000');
      expect(output).toContain('db_query_seconds_count 100');
    });
  });

  describe('Global labels', () => {
    test('applies labels to all metrics', () => {
      const snapshot = createTestSnapshot();
      const output = exportPrometheus(snapshot, {
        service: 'api',
        environment: 'production',
      });

      // Check various metric types have labels
      expect(output).toContain('http_requests_total{service="api",environment="production"}');
      expect(output).toContain(
        'process_memory_heap_used_bytes{service="api",environment="production"}'
      );
      expect(output).toContain('orders_created{service="api",environment="production"}');
    });

    test('combines global labels with metric-specific labels', () => {
      const snapshot = createTestSnapshot();
      const output = exportPrometheus(snapshot, {
        service: 'api',
      });

      expect(output).toContain('http_requests_by_status_total{service="api",status="200"}');
      expect(output).toContain('http_requests_by_method_total{service="api",method="GET"}');
    });

    test('handles empty labels', () => {
      const snapshot = createTestSnapshot();
      const output = exportPrometheus(snapshot, {});

      // Should work without labels
      expect(output).toContain('http_requests_total 1000');
    });
  });

  describe('Metric name sanitization', () => {
    test('sanitizes special characters in custom metric names', () => {
      const snapshot = createTestSnapshot();
      snapshot.custom.counters['my-metric.name'] = 10;
      snapshot.custom.counters['metric/with/slashes'] = 20;

      const output = exportPrometheus(snapshot);

      expect(output).toContain('my_metric_name 10');
      expect(output).toContain('metric_with_slashes 20');
    });

    test('ensures metric names start with valid character', () => {
      const snapshot = createTestSnapshot();
      snapshot.custom.counters['123metric'] = 10;

      const output = exportPrometheus(snapshot);

      expect(output).toContain('_123metric 10');
    });
  });

  describe('Label value escaping', () => {
    test('escapes special characters in label values', () => {
      const snapshot = createTestSnapshot();
      snapshot.http.byRoute['/api/test"quote'] = { count: 1, avgLatency: 50 };
      snapshot.http.byRoute['/api/test\\backslash'] = { count: 1, avgLatency: 50 };

      const output = exportPrometheus(snapshot);

      expect(output).toContain('route="/api/test\\"quote"');
      expect(output).toContain('route="/api/test\\\\backslash"');
    });

    test('escapes newlines in labels', () => {
      const snapshot = createTestSnapshot();
      const output = exportPrometheus(snapshot, {
        description: 'Line 1\nLine 2',
      });

      expect(output).toContain('description="Line 1\\nLine 2"');
    });
  });

  describe('Edge cases', () => {
    test('handles empty metrics snapshot', () => {
      const snapshot: MetricsSnapshot = {
        timestamp: Date.now(),
        http: {
          totalRequests: 0,
          activeRequests: 0,
          requestsPerSecond: 0,
          statusCodes: {},
          latency: { count: 0, sum: 0, min: 0, max: 0, mean: 0, p50: 0, p95: 0, p99: 0 },
          byMethod: {},
          byRoute: {},
        },
        process: {
          memoryUsage: { heapUsed: 0, heapTotal: 0, external: 0, rss: 0 },
          cpuUsage: { user: 0, system: 0 },
          uptime: 0,
          eventLoopLag: 0,
        },
        custom: {
          counters: {},
          gauges: {},
          histograms: {},
          timers: {},
        },
      };

      const output = exportPrometheus(snapshot);
      expect(output).toBeTruthy();
      expect(output).toContain('http_requests_total 0');
    });

    test('handles very large numbers', () => {
      const snapshot = createTestSnapshot();
      snapshot.http.totalRequests = 1000000000;

      const output = exportPrometheus(snapshot);
      expect(output).toContain('http_requests_total 1000000000');
    });

    test('handles zero values correctly', () => {
      const snapshot = createTestSnapshot();
      snapshot.http.activeRequests = 0;

      const output = exportPrometheus(snapshot);
      expect(output).toContain('http_requests_active 0');
    });

    test('handles fractional values', () => {
      const snapshot = createTestSnapshot();
      snapshot.custom.gauges['test'] = 0.123456789;

      const output = exportPrometheus(snapshot);
      expect(output).toContain('test 0.123456789');
    });
  });
});

describe('sanitizeMetricName', () => {
  test('replaces invalid characters with underscore', () => {
    expect(sanitizeMetricName('metric-name')).toBe('metric_name');
    expect(sanitizeMetricName('metric.name')).toBe('metric_name');
    expect(sanitizeMetricName('metric/name')).toBe('metric_name');
    expect(sanitizeMetricName('metric name')).toBe('metric_name');
  });

  test('preserves valid characters', () => {
    expect(sanitizeMetricName('metric_name')).toBe('metric_name');
    expect(sanitizeMetricName('metric:name')).toBe('metric:name');
    expect(sanitizeMetricName('MetricName123')).toBe('MetricName123');
  });

  test('ensures name starts with letter or underscore', () => {
    expect(sanitizeMetricName('123metric')).toBe('_123metric');
    expect(sanitizeMetricName('9test')).toBe('_9test');
  });

  test('handles empty string', () => {
    expect(sanitizeMetricName('')).toBe('_');
  });

  test('handles multiple consecutive invalid characters', () => {
    expect(sanitizeMetricName('metric---name')).toBe('metric___name');
  });
});

describe('escapeLabel', () => {
  test('escapes backslash', () => {
    expect(escapeLabel('test\\value')).toBe('test\\\\value');
  });

  test('escapes double quotes', () => {
    expect(escapeLabel('test"value')).toBe('test\\"value');
  });

  test('escapes newlines', () => {
    expect(escapeLabel('test\nvalue')).toBe('test\\nvalue');
  });

  test('escapes multiple special characters', () => {
    expect(escapeLabel('test\\"\nvalue')).toBe('test\\\\\\"\\nvalue');
  });

  test('handles strings without special characters', () => {
    expect(escapeLabel('test value')).toBe('test value');
  });

  test('handles empty string', () => {
    expect(escapeLabel('')).toBe('');
  });
});
