/**
 * @file HTML Dashboard Renderer tests
 * @description Comprehensive tests for dashboard HTML generation
 */

import { renderDashboard, formatUptime, formatBytes } from './dashboard';
import type { MetricsSnapshot } from './types';

describe('renderDashboard', () => {
  function createTestSnapshot(): MetricsSnapshot {
    return {
      timestamp: new Date('2025-01-15T12:00:00Z').getTime(),
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
          '/api/products': { count: 300, avgLatency: 55 },
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

  describe('HTML structure', () => {
    test('generates valid HTML5 document', () => {
      const snapshot = createTestSnapshot();
      const html = renderDashboard(snapshot);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="en">');
      expect(html).toContain('</html>');
    });

    test('includes required meta tags', () => {
      const snapshot = createTestSnapshot();
      const html = renderDashboard(snapshot);

      expect(html).toContain('<meta charset="UTF-8">');
      expect(html).toContain('<meta name="viewport"');
      expect(html).toContain('<meta name="description"');
    });

    test('includes semantic HTML5 elements', () => {
      const snapshot = createTestSnapshot();
      const html = renderDashboard(snapshot);

      expect(html).toContain('<header');
      expect(html).toContain('<main');
      expect(html).toContain('<footer');
      expect(html).toContain('<section');
    });

    test('has proper title', () => {
      const snapshot = createTestSnapshot();
      const html = renderDashboard(snapshot);

      expect(html).toContain('<title>BlaizeJS Metrics Dashboard</title>');
    });
  });

  describe('Inline dependencies', () => {
    test('includes inline CSS', () => {
      const snapshot = createTestSnapshot();
      const html = renderDashboard(snapshot);

      expect(html).toContain('<style>');
      expect(html).toContain('</style>');
      expect(html).toMatch(/body\s*\{/);
      expect(html).toMatch(/\.card\s*\{/);
    });

    test('includes inline JavaScript', () => {
      const snapshot = createTestSnapshot();
      const html = renderDashboard(snapshot);

      expect(html).toContain('<script>');
      expect(html).toContain('</script>');
    });

    test('has no external dependencies', () => {
      const snapshot = createTestSnapshot();
      const html = renderDashboard(snapshot);

      // Should not have external CSS or JS links
      expect(html).not.toContain('<link rel="stylesheet"');
      expect(html).not.toContain('<script src="');
    });
  });

  describe('BlaizeJS branding', () => {
    test('includes BlaizeJS title', () => {
      const snapshot = createTestSnapshot();
      const html = renderDashboard(snapshot);

      expect(html).toContain('BlaizeJS Metrics');
    });

    test('includes purple gradient styling', () => {
      const snapshot = createTestSnapshot();
      const html = renderDashboard(snapshot);

      // Check for purple gradient colors (#7b2ff7, #f107a3)
      expect(html).toMatch(/#7b2ff7/i);
      expect(html).toMatch(/#f107a3/i);
      expect(html).toContain('gradient');
    });

    test('includes flame emoji', () => {
      const snapshot = createTestSnapshot();
      const html = renderDashboard(snapshot);

      expect(html).toContain('🔥');
    });
  });

  describe('Metric cards', () => {
    test('displays total requests', () => {
      const snapshot = createTestSnapshot();
      const html = renderDashboard(snapshot);

      expect(html).toContain('Total Requests');
      expect(html).toContain('1,000');
    });

    test('displays active requests', () => {
      const snapshot = createTestSnapshot();
      const html = renderDashboard(snapshot);

      expect(html).toContain('Active Requests');
      expect(html).toContain('>5<');
    });

    test('displays average response time', () => {
      const snapshot = createTestSnapshot();
      const html = renderDashboard(snapshot);

      expect(html).toContain('Avg Response Time');
      expect(html).toContain('50.00ms');
    });

    test('displays formatted uptime', () => {
      const snapshot = createTestSnapshot();
      const html = renderDashboard(snapshot);

      expect(html).toContain('Uptime');
      expect(html).toContain('1h 0m');
    });

    test('displays formatted memory', () => {
      const snapshot = createTestSnapshot();
      const html = renderDashboard(snapshot);

      expect(html).toContain('Memory Used');
      expect(html).toContain('47.7 MB');
    });

    test('displays event loop lag', () => {
      const snapshot = createTestSnapshot();
      const html = renderDashboard(snapshot);

      expect(html).toContain('Event Loop Lag');
      expect(html).toContain('5.50ms');
    });
  });

  describe('HTTP statistics', () => {
    test('displays requests per second', () => {
      const snapshot = createTestSnapshot();
      const html = renderDashboard(snapshot);

      expect(html).toContain('Requests/Second');
      expect(html).toContain('10.50');
    });

    test('displays latency percentiles', () => {
      const snapshot = createTestSnapshot();
      const html = renderDashboard(snapshot);

      expect(html).toContain('P50 Latency');
      expect(html).toContain('45.00ms');
      expect(html).toContain('P95 Latency');
      expect(html).toContain('120.00ms');
      expect(html).toContain('P99 Latency');
      expect(html).toContain('200.00ms');
    });
  });

  describe('Routes table', () => {
    test('displays top routes', () => {
      const snapshot = createTestSnapshot();
      const html = renderDashboard(snapshot);

      expect(html).toContain('/api/users');
      expect(html).toContain('/api/orders');
      expect(html).toContain('/api/products');
    });

    test('includes route request counts', () => {
      const snapshot = createTestSnapshot();
      const html = renderDashboard(snapshot);

      expect(html).toContain('600');
      expect(html).toContain('400');
      expect(html).toContain('300');
    });

    test('includes route latencies', () => {
      const snapshot = createTestSnapshot();
      const html = renderDashboard(snapshot);

      expect(html).toContain('40.00ms');
      expect(html).toContain('65.00ms');
      expect(html).toContain('55.00ms');
    });

    test('table has sortable headers', () => {
      const snapshot = createTestSnapshot();
      const html = renderDashboard(snapshot);

      expect(html).toContain('class="sortable"');
      expect(html).toContain('data-column="route"');
      expect(html).toContain('data-column="count"');
      expect(html).toContain('data-column="latency"');
    });

    test('limits to top 10 routes', () => {
      const snapshot = createTestSnapshot();
      // Add many routes
      for (let i = 1; i <= 20; i++) {
        snapshot.http.byRoute[`/api/route${i}`] = { count: i, avgLatency: 50 };
      }

      const html = renderDashboard(snapshot);
      const routeMatches = html.match(/\/api\/route\d+/g);

      expect(routeMatches).toBeTruthy();
      expect(routeMatches!.length).toBeLessThanOrEqual(10);
    });

    test('shows empty state when no routes', () => {
      const snapshot = createTestSnapshot();
      snapshot.http.byRoute = {};

      const html = renderDashboard(snapshot);

      expect(html).toContain('No routes recorded yet');
    });
  });

  describe('Status code badges', () => {
    test('displays status codes with counts', () => {
      const snapshot = createTestSnapshot();
      const html = renderDashboard(snapshot);

      expect(html).toContain('200: 950');
      expect(html).toContain('404: 30');
      expect(html).toContain('500: 20');
    });

    test('applies correct badge classes', () => {
      const snapshot = createTestSnapshot();
      const html = renderDashboard(snapshot);

      expect(html).toContain('badge-success'); // 200
      expect(html).toContain('badge-warning'); // 404
      expect(html).toContain('badge-error'); // 500
    });

    test('shows empty state when no status codes', () => {
      const snapshot = createTestSnapshot();
      snapshot.http.statusCodes = {};

      const html = renderDashboard(snapshot);

      expect(html).toContain('No status codes recorded yet');
    });
  });

  describe('Process metrics', () => {
    test('displays memory metrics', () => {
      const snapshot = createTestSnapshot();
      const html = renderDashboard(snapshot);

      expect(html).toContain('Heap Total');
      expect(html).toContain('95.4 MB');
      expect(html).toContain('RSS');
      expect(html).toContain('114.4 MB');
    });

    test('displays CPU metrics', () => {
      const snapshot = createTestSnapshot();
      const html = renderDashboard(snapshot);

      expect(html).toContain('CPU User');
      expect(html).toContain('1.00s');
      expect(html).toContain('CPU System');
      expect(html).toContain('0.50s');
    });
  });

  describe('Custom metrics', () => {
    test('displays custom counters', () => {
      const snapshot = createTestSnapshot();
      const html = renderDashboard(snapshot);

      expect(html).toContain('Custom Metrics');
      expect(html).toContain('Counters');
      expect(html).toContain('orders.created');
      expect(html).toContain('42');
      expect(html).toContain('users.registered');
      expect(html).toContain('150');
    });

    test('displays custom gauges', () => {
      const snapshot = createTestSnapshot();
      const html = renderDashboard(snapshot);

      expect(html).toContain('Gauges');
      expect(html).toContain('queue.size');
      expect(html).toContain('10');
      expect(html).toContain('cache.hit.ratio');
      expect(html).toContain('0.950');
    });

    test('displays custom histograms', () => {
      const snapshot = createTestSnapshot();
      const html = renderDashboard(snapshot);

      expect(html).toContain('Histograms');
      expect(html).toContain('order.value');
      expect(html).toContain('Count: 42');
      expect(html).toContain('Mean: 100.00');
      expect(html).toContain('P95: 300.00');
    });

    test('displays custom timers', () => {
      const snapshot = createTestSnapshot();
      const html = renderDashboard(snapshot);

      expect(html).toContain('Timers');
      expect(html).toContain('db.query');
      expect(html).toContain('Count: 100');
      expect(html).toContain('Mean: 50.00ms');
      expect(html).toContain('P95: 120.00ms');
    });

    test('hides custom metrics section when empty', () => {
      const snapshot = createTestSnapshot();
      snapshot.custom = {
        counters: {},
        gauges: {},
        histograms: {},
        timers: {},
      };

      const html = renderDashboard(snapshot);

      expect(html).not.toContain('Custom Metrics');
    });
  });

  describe('Responsive design', () => {
    test('includes viewport meta tag', () => {
      const snapshot = createTestSnapshot();
      const html = renderDashboard(snapshot);

      expect(html).toContain('width=device-width');
      expect(html).toContain('initial-scale=1.0');
    });

    test('includes responsive CSS', () => {
      const snapshot = createTestSnapshot();
      const html = renderDashboard(snapshot);

      expect(html).toContain('@media (max-width: 768px)');
      expect(html).toContain('@media (max-width: 375px)');
    });

    test('uses flexible grid layouts', () => {
      const snapshot = createTestSnapshot();
      const html = renderDashboard(snapshot);

      expect(html).toContain('grid-template-columns');
      expect(html).toContain('auto-fit');
    });
  });

  describe('Timestamp display', () => {
    test('displays formatted timestamp', () => {
      const snapshot = createTestSnapshot();
      const html = renderDashboard(snapshot);

      expect(html).toContain('Last updated:');
      // Should contain date components
      expect(html).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
    });
  });

  describe('Footer', () => {
    test('includes BlaizeJS branding', () => {
      const snapshot = createTestSnapshot();
      const html = renderDashboard(snapshot);

      expect(html).toContain('Powered by');
      expect(html).toContain('BlaizeJS');
    });

    test('includes link to Prometheus endpoint', () => {
      const snapshot = createTestSnapshot();
      const html = renderDashboard(snapshot);

      expect(html).toContain('/metrics');
      expect(html).toContain('Prometheus Endpoint');
    });
  });

  describe('HTML escaping', () => {
    test('escapes special characters in route names', () => {
      const snapshot = createTestSnapshot();
      snapshot.http.byRoute['<script>alert("xss")</script>'] = { count: 1, avgLatency: 50 };

      const html = renderDashboard(snapshot);

      expect(html).not.toContain('<script>alert("xss")</script>');
      expect(html).toContain('&lt;script&gt;');
      expect(html).toContain('&lt;/script&gt;');
    });

    test('escapes special characters in custom metric names', () => {
      const snapshot = createTestSnapshot();
      snapshot.custom.counters['<dangerous>'] = 1;

      const html = renderDashboard(snapshot);

      expect(html).not.toContain('<dangerous>');
      expect(html).toContain('&lt;dangerous&gt;');
    });

    test('escapes quotes in attribute values', () => {
      const snapshot = createTestSnapshot();
      snapshot.http.byRoute['/api/test"quote'] = { count: 1, avgLatency: 50 };

      const html = renderDashboard(snapshot);

      expect(html).toContain('&quot;');
    });
  });

  describe('Edge cases', () => {
    test('handles zero values correctly', () => {
      const snapshot = createTestSnapshot();
      snapshot.http.totalRequests = 0;
      snapshot.http.activeRequests = 0;
      snapshot.http.latency.count = 0;

      const html = renderDashboard(snapshot);

      expect(html).toContain('Total Requests');
      expect(html).toContain('>0<');
      expect(html).toContain('Avg Response Time');
      expect(html).toContain('0ms');
    });

    test('handles very large numbers', () => {
      const snapshot = createTestSnapshot();
      snapshot.http.totalRequests = 1000000000;

      const html = renderDashboard(snapshot);

      expect(html).toContain('1,000,000,000');
    });

    test('handles fractional values', () => {
      const snapshot = createTestSnapshot();
      snapshot.custom.gauges['test'] = 0.123456789;

      const html = renderDashboard(snapshot);

      expect(html).toContain('0.123');
    });
  });

  describe('Sorting functionality', () => {
    test('includes sorting script', () => {
      const snapshot = createTestSnapshot();
      const html = renderDashboard(snapshot);

      expect(html).toContain('sortTable');
      expect(html).toContain('addEventListener');
    });

    test('sorting script handles all columns', () => {
      const snapshot = createTestSnapshot();
      const html = renderDashboard(snapshot);

      expect(html).toContain("column === 'route'");
      expect(html).toContain("column === 'count'");
      expect(html).toContain("column === 'latency'");
    });
  });
});

describe('formatUptime', () => {
  test('formats hours and minutes', () => {
    expect(formatUptime(7200)).toBe('2h 0m');
    expect(formatUptime(3665)).toBe('1h 1m');
    expect(formatUptime(7260)).toBe('2h 1m');
  });

  test('formats minutes and seconds', () => {
    expect(formatUptime(90)).toBe('1m 30s');
    expect(formatUptime(125)).toBe('2m 5s');
    expect(formatUptime(60)).toBe('1m 0s');
  });

  test('formats seconds only', () => {
    expect(formatUptime(45)).toBe('45s');
    expect(formatUptime(1)).toBe('1s');
    expect(formatUptime(0)).toBe('0s');
  });

  test('handles fractional seconds', () => {
    expect(formatUptime(3600.5)).toBe('1h 0m');
    expect(formatUptime(90.7)).toBe('1m 30s');
    expect(formatUptime(45.9)).toBe('45s');
  });

  test('handles very large values', () => {
    expect(formatUptime(86400)).toBe('24h 0m'); // 1 day
    expect(formatUptime(90000)).toBe('25h 0m'); // Over 1 day
  });
});

describe('formatBytes', () => {
  test('formats bytes', () => {
    expect(formatBytes(0)).toBe('0.0 B');
    expect(formatBytes(500)).toBe('500.0 B');
    expect(formatBytes(1023)).toBe('1023.0 B');
  });

  test('formats kilobytes', () => {
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
  });

  test('formats megabytes', () => {
    expect(formatBytes(1048576)).toBe('1.0 MB');
    expect(formatBytes(50000000)).toBe('47.7 MB');
    expect(formatBytes(104857600)).toBe('100.0 MB');
  });

  test('formats gigabytes', () => {
    expect(formatBytes(1073741824)).toBe('1.0 GB');
    expect(formatBytes(2147483648)).toBe('2.0 GB');
    expect(formatBytes(5368709120)).toBe('5.0 GB');
  });

  test('formats terabytes', () => {
    expect(formatBytes(1099511627776)).toBe('1.0 TB');
    expect(formatBytes(2199023255552)).toBe('2.0 TB');
  });

  test('uses one decimal place', () => {
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(1638400)).toBe('1.6 MB');
    expect(formatBytes(1181116006)).toBe('1.1 GB');
  });

  test('handles very small values', () => {
    expect(formatBytes(1)).toBe('1.0 B');
    expect(formatBytes(10)).toBe('10.0 B');
  });

  test('handles very large values', () => {
    expect(formatBytes(10995116277760)).toBe('10.0 TB');
  });
});
