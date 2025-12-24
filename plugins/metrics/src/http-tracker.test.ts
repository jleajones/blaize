/**
 * @file HTTP Request Tracker tests
 * @description Comprehensive tests for HttpRequestTracker class
 */

import { HttpRequestTracker } from './http-tracker';

describe('HttpRequestTracker', () => {
  let tracker: HttpRequestTracker;

  beforeEach(() => {
    tracker = new HttpRequestTracker(1000);
  });

  describe('Constructor', () => {
    test('creates tracker with default histogram limit', () => {
      const defaultTracker = new HttpRequestTracker();
      expect(defaultTracker.getHistogramLimit()).toBe(1000);
    });

    test('creates tracker with custom histogram limit', () => {
      const customTracker = new HttpRequestTracker(500);
      expect(customTracker.getHistogramLimit()).toBe(500);
    });

    test('throws error for histogram limit <= 0', () => {
      expect(() => new HttpRequestTracker(0)).toThrow('histogramLimit must be greater than 0');
      expect(() => new HttpRequestTracker(-1)).toThrow('histogramLimit must be greater than 0');
    });

    test('initializes with zero metrics', () => {
      const metrics = tracker.getMetrics();
      expect(metrics.totalRequests).toBe(0);
      expect(metrics.activeRequests).toBe(0);
      expect(metrics.requestsPerSecond).toBe(0);
      expect(Object.keys(metrics.statusCodes)).toHaveLength(0);
      expect(metrics.latency.count).toBe(0);
    });
  });

  describe('startRequest', () => {
    test('increments active request counter', () => {
      expect(tracker.getActiveRequests()).toBe(0);

      tracker.startRequest();
      expect(tracker.getActiveRequests()).toBe(1);

      tracker.startRequest();
      expect(tracker.getActiveRequests()).toBe(2);
    });

    test('multiple starts without recording', () => {
      tracker.startRequest();
      tracker.startRequest();
      tracker.startRequest();

      expect(tracker.getActiveRequests()).toBe(3);
    });
  });

  describe('recordRequest', () => {
    test('records basic request metrics', () => {
      tracker.startRequest();
      tracker.recordRequest('GET', '/api/users', 200, 45.5);

      const metrics = tracker.getMetrics();
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.activeRequests).toBe(0);
      expect(metrics.statusCodes['200']).toBe(1);
      expect(metrics.latency.count).toBe(1);
      expect(metrics.latency.mean).toBe(45.5);
    });

    test('decrements active requests', () => {
      tracker.startRequest();
      expect(tracker.getActiveRequests()).toBe(1);

      tracker.recordRequest('GET', '/api/users', 200, 45.5);
      expect(tracker.getActiveRequests()).toBe(0);
    });

    test('handles recording without startRequest call', () => {
      // Should not go negative
      tracker.recordRequest('GET', '/api/users', 200, 45.5);
      expect(tracker.getActiveRequests()).toBe(0);
    });

    test('tracks multiple requests', () => {
      tracker.startRequest();
      tracker.recordRequest('GET', '/api/users', 200, 45.5);

      tracker.startRequest();
      tracker.recordRequest('POST', '/api/orders', 201, 120.3);

      tracker.startRequest();
      tracker.recordRequest('GET', '/api/products', 404, 15.2);

      const metrics = tracker.getMetrics();
      expect(metrics.totalRequests).toBe(3);
      expect(metrics.activeRequests).toBe(0);
    });

    test('tracks status code distribution', () => {
      tracker.recordRequest('GET', '/api/users', 200, 50);
      tracker.recordRequest('GET', '/api/users', 200, 50);
      tracker.recordRequest('GET', '/api/users', 404, 20);
      tracker.recordRequest('POST', '/api/orders', 201, 100);
      tracker.recordRequest('POST', '/api/orders', 500, 150);

      const metrics = tracker.getMetrics();
      expect(metrics.statusCodes['200']).toBe(2);
      expect(metrics.statusCodes['201']).toBe(1);
      expect(metrics.statusCodes['404']).toBe(1);
      expect(metrics.statusCodes['500']).toBe(1);
    });

    test('tracks by HTTP method', () => {
      tracker.recordRequest('GET', '/api/users', 200, 50);
      tracker.recordRequest('GET', '/api/products', 200, 60);
      tracker.recordRequest('POST', '/api/orders', 201, 100);

      const metrics = tracker.getMetrics();
      expect(metrics.byMethod['GET']?.count).toBe(2);
      expect(metrics.byMethod['GET']?.avgLatency).toBe(55); // (50 + 60) / 2
      expect(metrics.byMethod['POST']?.count).toBe(1);
      expect(metrics.byMethod['POST']?.avgLatency).toBe(100);
    });

    test('tracks by route path', () => {
      tracker.recordRequest('GET', '/api/users', 200, 50);
      tracker.recordRequest('POST', '/api/users', 201, 100);
      tracker.recordRequest('GET', '/api/orders', 200, 75);

      const metrics = tracker.getMetrics();
      expect(metrics.byRoute['/api/users']?.count).toBe(2);
      expect(metrics.byRoute['/api/users']?.avgLatency).toBe(75); // (50 + 100) / 2
      expect(metrics.byRoute['/api/orders']?.count).toBe(1);
      expect(metrics.byRoute['/api/orders']?.avgLatency).toBe(75);
    });

    test('handles zero duration', () => {
      tracker.recordRequest('GET', '/api/fast', 200, 0);

      const metrics = tracker.getMetrics();
      expect(metrics.latency.min).toBe(0);
      expect(metrics.latency.mean).toBe(0);
    });

    test('handles very large durations', () => {
      tracker.recordRequest('GET', '/api/slow', 200, 10000);

      const metrics = tracker.getMetrics();
      expect(metrics.latency.max).toBe(10000);
      expect(metrics.latency.mean).toBe(10000);
    });
  });

  describe('FIFO histogram management', () => {
    test('enforces histogram limit with FIFO eviction', () => {
      const smallTracker = new HttpRequestTracker(3);

      // Add 5 samples, should keep only last 3
      smallTracker.recordRequest('GET', '/test', 200, 10);
      smallTracker.recordRequest('GET', '/test', 200, 20);
      smallTracker.recordRequest('GET', '/test', 200, 30);
      smallTracker.recordRequest('GET', '/test', 200, 40);
      smallTracker.recordRequest('GET', '/test', 200, 50);

      const metrics = smallTracker.getMetrics();
      expect(metrics.latency.count).toBe(3); // Only last 3 samples
      expect(metrics.latency.min).toBe(30); // First two (10, 20) evicted
      expect(metrics.latency.max).toBe(50);
      expect(smallTracker.getSampleCount()).toBe(3);
    });

    test('maintains correct statistics after eviction', () => {
      const smallTracker = new HttpRequestTracker(2);

      smallTracker.recordRequest('GET', '/test', 200, 100);
      smallTracker.recordRequest('GET', '/test', 200, 200);
      smallTracker.recordRequest('GET', '/test', 200, 300);

      const metrics = smallTracker.getMetrics();
      // Should only have samples 200 and 300
      expect(metrics.latency.count).toBe(2);
      expect(metrics.latency.mean).toBe(250); // (200 + 300) / 2
      expect(metrics.latency.min).toBe(200);
      expect(metrics.latency.max).toBe(300);
    });

    test('FIFO works with histogram limit of 1', () => {
      const tinyTracker = new HttpRequestTracker(1);

      tinyTracker.recordRequest('GET', '/test', 200, 10);
      tinyTracker.recordRequest('GET', '/test', 200, 20);
      tinyTracker.recordRequest('GET', '/test', 200, 30);

      const metrics = tinyTracker.getMetrics();
      expect(metrics.latency.count).toBe(1);
      expect(metrics.latency.mean).toBe(30); // Only last sample
    });

    test('does not exceed histogram limit under load', () => {
      const limitTracker = new HttpRequestTracker(100);

      // Record 1000 requests
      for (let i = 0; i < 1000; i++) {
        limitTracker.recordRequest('GET', '/test', 200, i);
      }

      expect(limitTracker.getSampleCount()).toBe(100);
      const metrics = limitTracker.getMetrics();
      expect(metrics.latency.count).toBe(100);
      // Should have last 100 samples (900-999)
      expect(metrics.latency.min).toBe(900);
      expect(metrics.latency.max).toBe(999);
    });
  });

  describe('Histogram statistics', () => {
    test('calculates min/max correctly', () => {
      tracker.recordRequest('GET', '/test', 200, 10);
      tracker.recordRequest('GET', '/test', 200, 50);
      tracker.recordRequest('GET', '/test', 200, 30);
      tracker.recordRequest('GET', '/test', 200, 90);
      tracker.recordRequest('GET', '/test', 200, 20);

      const metrics = tracker.getMetrics();
      expect(metrics.latency.min).toBe(10);
      expect(metrics.latency.max).toBe(90);
    });

    test('calculates mean correctly', () => {
      tracker.recordRequest('GET', '/test', 200, 10);
      tracker.recordRequest('GET', '/test', 200, 20);
      tracker.recordRequest('GET', '/test', 200, 30);

      const metrics = tracker.getMetrics();
      expect(metrics.latency.mean).toBe(20); // (10 + 20 + 30) / 3
    });

    test('calculates sum correctly', () => {
      tracker.recordRequest('GET', '/test', 200, 10);
      tracker.recordRequest('GET', '/test', 200, 20);
      tracker.recordRequest('GET', '/test', 200, 30);

      const metrics = tracker.getMetrics();
      expect(metrics.latency.sum).toBe(60);
    });

    test('calculates p50 (median) correctly', () => {
      // Odd number of samples
      tracker.recordRequest('GET', '/test', 200, 10);
      tracker.recordRequest('GET', '/test', 200, 20);
      tracker.recordRequest('GET', '/test', 200, 30);
      tracker.recordRequest('GET', '/test', 200, 40);
      tracker.recordRequest('GET', '/test', 200, 50);

      const metrics = tracker.getMetrics();
      expect(metrics.latency.p50).toBe(30); // Middle value
    });

    test('calculates p95 correctly', () => {
      // Add 100 samples: 1, 2, 3, ..., 100
      for (let i = 1; i <= 100; i++) {
        tracker.recordRequest('GET', '/test', 200, i);
      }

      const metrics = tracker.getMetrics();
      // P95 should be around 95
      expect(metrics.latency.p95).toBeGreaterThanOrEqual(94);
      expect(metrics.latency.p95).toBeLessThanOrEqual(96);
    });

    test('calculates p99 correctly', () => {
      // Add 100 samples: 1, 2, 3, ..., 100
      for (let i = 1; i <= 100; i++) {
        tracker.recordRequest('GET', '/test', 200, i);
      }

      const metrics = tracker.getMetrics();
      // P99 should be around 99
      expect(metrics.latency.p99).toBeGreaterThanOrEqual(98);
      expect(metrics.latency.p99).toBeLessThanOrEqual(100);
    });

    test('handles single sample', () => {
      tracker.recordRequest('GET', '/test', 200, 42);

      const metrics = tracker.getMetrics();
      expect(metrics.latency.count).toBe(1);
      expect(metrics.latency.min).toBe(42);
      expect(metrics.latency.max).toBe(42);
      expect(metrics.latency.mean).toBe(42);
      expect(metrics.latency.p50).toBe(42);
      expect(metrics.latency.p95).toBe(42);
      expect(metrics.latency.p99).toBe(42);
    });

    test('handles two samples', () => {
      tracker.recordRequest('GET', '/test', 200, 10);
      tracker.recordRequest('GET', '/test', 200, 20);

      const metrics = tracker.getMetrics();
      expect(metrics.latency.count).toBe(2);
      expect(metrics.latency.mean).toBe(15);
      expect(metrics.latency.p50).toBe(15); // Interpolated between 10 and 20
    });

    test('returns zeros for empty histogram', () => {
      const metrics = tracker.getMetrics();
      expect(metrics.latency.count).toBe(0);
      expect(metrics.latency.sum).toBe(0);
      expect(metrics.latency.min).toBe(0);
      expect(metrics.latency.max).toBe(0);
      expect(metrics.latency.mean).toBe(0);
      expect(metrics.latency.p50).toBe(0);
      expect(metrics.latency.p95).toBe(0);
      expect(metrics.latency.p99).toBe(0);
    });
  });

  describe('requests per second calculation', () => {
    test('calculates requests per second', async () => {
      // Mock timer
      const now = Date.now();
      vi.useFakeTimers();
      vi.setSystemTime(now);

      const timedTracker = new HttpRequestTracker();

      // Record 10 requests
      for (let i = 0; i < 10; i++) {
        timedTracker.recordRequest('GET', '/test', 200, 50);
      }

      // Advance time by 2 seconds
      vi.advanceTimersByTime(2000);

      const metrics = timedTracker.getMetrics();
      expect(metrics.requestsPerSecond).toBeCloseTo(5, 1); // 10 requests / 2 seconds

      vi.useRealTimers();
    });

    test('handles zero elapsed time', () => {
      tracker.recordRequest('GET', '/test', 200, 50);

      const metrics = tracker.getMetrics();
      // Should not divide by zero
      expect(metrics.requestsPerSecond).toBeGreaterThanOrEqual(0);
    });
  });

  describe('concurrent requests tracking', () => {
    test('tracks concurrent requests correctly', () => {
      tracker.startRequest();
      tracker.startRequest();
      tracker.startRequest();
      expect(tracker.getActiveRequests()).toBe(3);

      tracker.recordRequest('GET', '/test1', 200, 50);
      expect(tracker.getActiveRequests()).toBe(2);

      tracker.recordRequest('GET', '/test2', 200, 60);
      expect(tracker.getActiveRequests()).toBe(1);

      tracker.recordRequest('GET', '/test3', 200, 70);
      expect(tracker.getActiveRequests()).toBe(0);
    });

    test('handles interleaved start and record', () => {
      tracker.startRequest();
      expect(tracker.getActiveRequests()).toBe(1);

      tracker.startRequest();
      expect(tracker.getActiveRequests()).toBe(2);

      tracker.recordRequest('GET', '/test1', 200, 50);
      expect(tracker.getActiveRequests()).toBe(1);

      tracker.startRequest();
      expect(tracker.getActiveRequests()).toBe(2);

      tracker.recordRequest('GET', '/test2', 200, 60);
      expect(tracker.getActiveRequests()).toBe(1);
    });
  });

  describe('reset', () => {
    test('resets all metrics to initial state', () => {
      // Record some data
      tracker.startRequest();
      tracker.recordRequest('GET', '/api/users', 200, 50);
      tracker.recordRequest('POST', '/api/orders', 201, 100);
      tracker.recordRequest('GET', '/api/products', 404, 25);

      // Verify data exists
      let metrics = tracker.getMetrics();
      expect(metrics.totalRequests).toBe(3);
      expect(metrics.latency.count).toBe(3);
      expect(Object.keys(metrics.statusCodes).length).toBeGreaterThan(0);

      // Reset
      tracker.reset();

      // Verify everything is cleared
      metrics = tracker.getMetrics();
      expect(metrics.totalRequests).toBe(0);
      expect(metrics.activeRequests).toBe(0);
      expect(metrics.requestsPerSecond).toBe(0);
      expect(Object.keys(metrics.statusCodes)).toHaveLength(0);
      expect(metrics.latency.count).toBe(0);
      expect(Object.keys(metrics.byMethod)).toHaveLength(0);
      expect(Object.keys(metrics.byRoute)).toHaveLength(0);
      expect(tracker.getSampleCount()).toBe(0);
    });

    test('can record new data after reset', () => {
      tracker.recordRequest('GET', '/test', 200, 50);
      tracker.reset();

      tracker.recordRequest('POST', '/new', 201, 75);

      const metrics = tracker.getMetrics();
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.statusCodes['201']).toBe(1);
      expect(metrics.latency.mean).toBe(75);
    });
  });

  describe('Edge cases', () => {
    test('handles negative durations gracefully', () => {
      // While invalid, should not crash
      tracker.recordRequest('GET', '/test', 200, -10);

      const metrics = tracker.getMetrics();
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.latency.min).toBe(-10);
    });

    test('handles fractional durations', () => {
      tracker.recordRequest('GET', '/test', 200, 45.567);

      const metrics = tracker.getMetrics();
      expect(metrics.latency.mean).toBe(45.567);
    });

    test('handles very long paths', () => {
      const longPath = '/api/' + 'a'.repeat(1000);
      tracker.recordRequest('GET', longPath, 200, 50);

      const metrics = tracker.getMetrics();
      expect(metrics.byRoute[longPath]?.count).toBe(1);
    });

    test('handles unusual HTTP methods', () => {
      tracker.recordRequest('PATCH', '/test', 200, 50);
      tracker.recordRequest('OPTIONS', '/test', 200, 10);
      tracker.recordRequest('HEAD', '/test', 200, 5);

      const metrics = tracker.getMetrics();
      expect(metrics.byMethod['PATCH']?.count).toBe(1);
      expect(metrics.byMethod['OPTIONS']?.count).toBe(1);
      expect(metrics.byMethod['HEAD']?.count).toBe(1);
    });

    test('handles unusual status codes', () => {
      tracker.recordRequest('GET', '/test', 418, 50); // I'm a teapot
      tracker.recordRequest('GET', '/test', 599, 50); // Network Connect Timeout Error

      const metrics = tracker.getMetrics();
      expect(metrics.statusCodes['418']).toBe(1);
      expect(metrics.statusCodes['599']).toBe(1);
    });

    test('handles empty method and path strings', () => {
      tracker.recordRequest('', '', 200, 50);

      const metrics = tracker.getMetrics();
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.byMethod['']?.count).toBe(1);
      expect(metrics.byRoute['']?.count).toBe(1);
    });
  });

  describe('getHistogramLimit', () => {
    test('returns configured histogram limit', () => {
      const tracker500 = new HttpRequestTracker(500);
      expect(tracker500.getHistogramLimit()).toBe(500);

      const tracker2000 = new HttpRequestTracker(2000);
      expect(tracker2000.getHistogramLimit()).toBe(2000);
    });
  });

  describe('getSampleCount', () => {
    test('returns current sample count', () => {
      expect(tracker.getSampleCount()).toBe(0);

      tracker.recordRequest('GET', '/test', 200, 50);
      expect(tracker.getSampleCount()).toBe(1);

      tracker.recordRequest('GET', '/test', 200, 60);
      expect(tracker.getSampleCount()).toBe(2);
    });

    test('does not exceed histogram limit', () => {
      const smallTracker = new HttpRequestTracker(5);

      for (let i = 0; i < 10; i++) {
        smallTracker.recordRequest('GET', '/test', 200, i);
      }

      expect(smallTracker.getSampleCount()).toBe(5);
    });
  });

  describe('getActiveRequests', () => {
    test('returns current active request count', () => {
      expect(tracker.getActiveRequests()).toBe(0);

      tracker.startRequest();
      expect(tracker.getActiveRequests()).toBe(1);

      tracker.startRequest();
      expect(tracker.getActiveRequests()).toBe(2);

      tracker.recordRequest('GET', '/test', 200, 50);
      expect(tracker.getActiveRequests()).toBe(1);
    });
  });
});
