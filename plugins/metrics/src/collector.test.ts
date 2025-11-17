/**
 * @file Metrics Collector tests
 * @description Comprehensive tests for MetricsCollectorImpl
 */

import { createMockLogger } from '@blaizejs/testing-utils';

import { MetricsCollectorImpl } from './collector';

import type { MetricsCollector } from './types';

describe('MetricsCollectorImpl', () => {
  let collector: MetricsCollectorImpl;

  beforeEach(() => {
    collector = new MetricsCollectorImpl({
      histogramLimit: 100,
      collectionInterval: 1000,
      logger: createMockLogger(),
    });
  });

  afterEach(() => {
    collector.stopCollection();
    vi.useRealTimers();
  });

  describe('Constructor', () => {
    test('creates collector with default options', () => {
      const defaultCollector = new MetricsCollectorImpl({
        logger: createMockLogger(),
      });
      expect(defaultCollector).toBeInstanceOf(MetricsCollectorImpl);
      expect(defaultCollector.getHistogramLimit()).toBe(1000);
      expect(defaultCollector.getCollectionInterval()).toBe(60000);
    });

    test('creates collector with custom options', () => {
      const customCollector = new MetricsCollectorImpl({
        histogramLimit: 500,
        collectionInterval: 30000,
        logger: createMockLogger(),
      });

      expect(customCollector.getHistogramLimit()).toBe(500);
      expect(customCollector.getCollectionInterval()).toBe(30000);
    });

    test('initializes HTTP and process trackers', () => {
      expect(collector.getHttpTracker()).toBeDefined();
      expect(collector.getProcessTracker()).toBeDefined();
    });

    test('implements MetricsCollector interface', () => {
      const metricsCollector: MetricsCollector = collector;
      expect(metricsCollector.increment).toBeDefined();
      expect(metricsCollector.gauge).toBeDefined();
      expect(metricsCollector.histogram).toBeDefined();
      expect(metricsCollector.startTimer).toBeDefined();
      expect(metricsCollector.getSnapshot).toBeDefined();
      expect(metricsCollector.reset).toBeDefined();
    });
  });

  describe('increment', () => {
    test('increments counter by 1 (default)', () => {
      collector.increment('test.counter');

      const snapshot = collector.getSnapshot();
      expect(snapshot.custom.counters['test.counter']).toBe(1);
    });

    test('increments counter by custom value', () => {
      collector.increment('bytes.sent', 1024);

      const snapshot = collector.getSnapshot();
      expect(snapshot.custom.counters['bytes.sent']).toBe(1024);
    });

    test('accumulates multiple increments', () => {
      collector.increment('requests');
      collector.increment('requests');
      collector.increment('requests', 3);

      const snapshot = collector.getSnapshot();
      expect(snapshot.custom.counters['requests']).toBe(5);
    });

    test('tracks multiple counters independently', () => {
      collector.increment('counter.a', 10);
      collector.increment('counter.b', 20);
      collector.increment('counter.a', 5);

      const snapshot = collector.getSnapshot();
      expect(snapshot.custom.counters['counter.a']).toBe(15);
      expect(snapshot.custom.counters['counter.b']).toBe(20);
    });

    test('handles negative increments', () => {
      collector.increment('test', 10);
      collector.increment('test', -3);

      const snapshot = collector.getSnapshot();
      expect(snapshot.custom.counters['test']).toBe(7);
    });

    test('handles zero increment', () => {
      collector.increment('test', 0);

      const snapshot = collector.getSnapshot();
      expect(snapshot.custom.counters['test']).toBe(0);
    });

    test('handles fractional increments', () => {
      collector.increment('bytes', 1024.5);
      collector.increment('bytes', 0.5);

      const snapshot = collector.getSnapshot();
      expect(snapshot.custom.counters['bytes']).toBe(1025);
    });
  });

  describe('gauge', () => {
    test('sets gauge value', () => {
      collector.gauge('queue.size', 42);

      const snapshot = collector.getSnapshot();
      expect(snapshot.custom.gauges['queue.size']).toBe(42);
    });

    test('overwrites previous gauge value', () => {
      collector.gauge('connections', 10);
      collector.gauge('connections', 25);

      const snapshot = collector.getSnapshot();
      expect(snapshot.custom.gauges['connections']).toBe(25);
    });

    test('tracks multiple gauges independently', () => {
      collector.gauge('gauge.a', 100);
      collector.gauge('gauge.b', 200);
      collector.gauge('gauge.a', 150);

      const snapshot = collector.getSnapshot();
      expect(snapshot.custom.gauges['gauge.a']).toBe(150);
      expect(snapshot.custom.gauges['gauge.b']).toBe(200);
    });

    test('handles zero value', () => {
      collector.gauge('test', 0);

      const snapshot = collector.getSnapshot();
      expect(snapshot.custom.gauges['test']).toBe(0);
    });

    test('handles negative values', () => {
      collector.gauge('temperature', -5.5);

      const snapshot = collector.getSnapshot();
      expect(snapshot.custom.gauges['temperature']).toBe(-5.5);
    });

    test('handles fractional values', () => {
      collector.gauge('cpu.usage', 45.67);

      const snapshot = collector.getSnapshot();
      expect(snapshot.custom.gauges['cpu.usage']).toBe(45.67);
    });
  });

  describe('histogram', () => {
    test('records histogram value', () => {
      collector.histogram('response.time', 45.5);

      const snapshot = collector.getSnapshot();
      expect(snapshot.custom.histograms['response.time']).toBeDefined();
      expect(snapshot.custom.histograms['response.time']?.count).toBe(1);
      expect(snapshot.custom.histograms['response.time']?.mean).toBe(45.5);
    });

    test('records multiple values', () => {
      collector.histogram('test', 10);
      collector.histogram('test', 20);
      collector.histogram('test', 30);

      const snapshot = collector.getSnapshot();
      const hist = snapshot.custom.histograms['test'];
      expect(hist?.count).toBe(3);
      expect(hist?.min).toBe(10);
      expect(hist?.max).toBe(30);
      expect(hist?.mean).toBe(20);
    });

    test('calculates percentiles correctly', () => {
      // Add 100 samples: 1, 2, 3, ..., 100
      for (let i = 1; i <= 100; i++) {
        collector.histogram('test', i);
      }

      const snapshot = collector.getSnapshot();
      const hist = snapshot.custom.histograms['test'];
      // Linear interpolation means p50 of 1-100 is 50.5 (between index 49 and 50)
      expect(hist?.p50).toBeCloseTo(50.5, 1);
      expect(hist?.p95).toBeCloseTo(95, 1);
      expect(hist?.p99).toBeCloseTo(99, 1);
    });

    test('enforces histogram limit with FIFO', () => {
      const smallCollector = new MetricsCollectorImpl({
        histogramLimit: 3,
        logger: createMockLogger(),
      });

      smallCollector.histogram('test', 10);
      smallCollector.histogram('test', 20);
      smallCollector.histogram('test', 30);
      smallCollector.histogram('test', 40);
      smallCollector.histogram('test', 50);

      const snapshot = smallCollector.getSnapshot();
      const hist = snapshot.custom.histograms['test'];
      expect(hist?.count).toBe(3);
      expect(hist?.min).toBe(30); // First two evicted
      expect(hist?.max).toBe(50);
    });

    test('tracks multiple histograms independently', () => {
      collector.histogram('hist.a', 100);
      collector.histogram('hist.b', 200);
      collector.histogram('hist.a', 150);

      const snapshot = collector.getSnapshot();
      expect(snapshot.custom.histograms['hist.a']?.count).toBe(2);
      expect(snapshot.custom.histograms['hist.b']?.count).toBe(1);
    });

    test('handles zero values', () => {
      collector.histogram('test', 0);

      const snapshot = collector.getSnapshot();
      expect(snapshot.custom.histograms['test']?.mean).toBe(0);
    });

    test('handles negative values', () => {
      collector.histogram('test', -10);
      collector.histogram('test', -5);

      const snapshot = collector.getSnapshot();
      const hist = snapshot.custom.histograms['test'];
      expect(hist?.min).toBe(-10);
      expect(hist?.max).toBe(-5);
    });
  });

  describe('startTimer', () => {
    test('returns a function', () => {
      const stopTimer = collector.startTimer('test');
      expect(typeof stopTimer).toBe('function');
    });

    test('records duration when stop function is called', async () => {
      const stopTimer = collector.startTimer('test.timer');

      await new Promise(resolve => setTimeout(resolve, 50));
      stopTimer();

      const snapshot = collector.getSnapshot();
      const timer = snapshot.custom.timers['test.timer'];
      expect(timer).toBeDefined();
      expect(timer?.count).toBe(1);
      expect(timer?.mean).toBeGreaterThanOrEqual(40); // Allow variance
      expect(timer?.mean).toBeLessThan(100);
    });

    test('records multiple durations', async () => {
      const stop1 = collector.startTimer('test');
      await new Promise(resolve => setTimeout(resolve, 10));
      stop1();

      const stop2 = collector.startTimer('test');
      await new Promise(resolve => setTimeout(resolve, 20));
      stop2();

      const snapshot = collector.getSnapshot();
      const timer = snapshot.custom.timers['test'];
      expect(timer?.count).toBe(2);
    });

    test('handles immediate stop (zero duration)', () => {
      const stopTimer = collector.startTimer('test');
      stopTimer(); // Immediate

      const snapshot = collector.getSnapshot();
      const timer = snapshot.custom.timers['test'];
      expect(timer?.count).toBe(1);
      expect(timer?.mean).toBeGreaterThanOrEqual(0);
      expect(timer?.mean).toBeLessThan(10); // Very small
    });

    test('tracks multiple timers independently', async () => {
      const stop1 = collector.startTimer('timer.a');
      const stop2 = collector.startTimer('timer.b');

      await new Promise(resolve => setTimeout(resolve, 10));
      stop1();

      await new Promise(resolve => setTimeout(resolve, 10));
      stop2();

      const snapshot = collector.getSnapshot();
      expect(snapshot.custom.timers['timer.a']?.count).toBe(1);
      expect(snapshot.custom.timers['timer.b']?.count).toBe(1);
      expect(snapshot.custom.timers['timer.b']?.mean).toBeGreaterThan(
        snapshot.custom.timers['timer.a']!.mean
      );
    });

    test('stop function can be called multiple times safely', () => {
      const stopTimer = collector.startTimer('test');
      stopTimer();
      stopTimer(); // Second call

      const snapshot = collector.getSnapshot();
      // Should record two separate durations
      expect(snapshot.custom.timers['test']?.count).toBe(2);
    });

    test('enforces histogram limit with FIFO', async () => {
      const smallCollector = new MetricsCollectorImpl({
        histogramLimit: 2,
        logger: createMockLogger(),
      });

      for (let i = 0; i < 5; i++) {
        const stop = smallCollector.startTimer('test');
        await new Promise(resolve => setTimeout(resolve, 5));
        stop();
      }

      const snapshot = smallCollector.getSnapshot();
      expect(snapshot.custom.timers['test']?.count).toBe(2);
    });

    test('works with try-finally pattern', async () => {
      const stopTimer = collector.startTimer('operation');

      try {
        await new Promise(resolve => setTimeout(resolve, 20));
        // Simulate operation
      } finally {
        stopTimer();
      }

      const snapshot = collector.getSnapshot();
      expect(snapshot.custom.timers['operation']?.count).toBe(1);
    });
  });

  describe('getSnapshot', () => {
    test('returns complete MetricsSnapshot structure', () => {
      const snapshot = collector.getSnapshot();

      expect(snapshot).toHaveProperty('timestamp');
      expect(snapshot).toHaveProperty('http');
      expect(snapshot).toHaveProperty('process');
      expect(snapshot).toHaveProperty('custom');
    });

    test('timestamp is current time', () => {
      const before = Date.now();
      const snapshot = collector.getSnapshot();
      const after = Date.now();

      expect(snapshot.timestamp).toBeGreaterThanOrEqual(before);
      expect(snapshot.timestamp).toBeLessThanOrEqual(after);
    });

    test('includes HTTP metrics', () => {
      const snapshot = collector.getSnapshot();

      expect(snapshot.http).toHaveProperty('totalRequests');
      expect(snapshot.http).toHaveProperty('activeRequests');
      expect(snapshot.http).toHaveProperty('latency');
    });

    test('includes process metrics', () => {
      const snapshot = collector.getSnapshot();

      expect(snapshot.process).toHaveProperty('memoryUsage');
      expect(snapshot.process).toHaveProperty('cpuUsage');
      expect(snapshot.process).toHaveProperty('uptime');
      expect(snapshot.process).toHaveProperty('eventLoopLag');
    });

    test('includes custom metrics', () => {
      const snapshot = collector.getSnapshot();

      expect(snapshot.custom).toHaveProperty('counters');
      expect(snapshot.custom).toHaveProperty('gauges');
      expect(snapshot.custom).toHaveProperty('histograms');
      expect(snapshot.custom).toHaveProperty('timers');
    });

    test('reflects current custom metrics state', () => {
      collector.increment('test.counter', 42);
      collector.gauge('test.gauge', 99);
      collector.histogram('test.histogram', 50);

      const snapshot = collector.getSnapshot();

      expect(snapshot.custom.counters['test.counter']).toBe(42);
      expect(snapshot.custom.gauges['test.gauge']).toBe(99);
      expect(snapshot.custom.histograms['test.histogram']?.mean).toBe(50);
    });

    test('multiple snapshots are independent', () => {
      collector.increment('test', 10);
      const snapshot1 = collector.getSnapshot();

      collector.increment('test', 20);
      const snapshot2 = collector.getSnapshot();

      expect(snapshot1.custom.counters['test']).toBe(10);
      expect(snapshot2.custom.counters['test']).toBe(30);
    });

    test('handles empty metrics', () => {
      const snapshot = collector.getSnapshot();

      expect(Object.keys(snapshot.custom.counters)).toHaveLength(0);
      expect(Object.keys(snapshot.custom.gauges)).toHaveLength(0);
      expect(Object.keys(snapshot.custom.histograms)).toHaveLength(0);
      expect(Object.keys(snapshot.custom.timers)).toHaveLength(0);
    });
  });

  describe('reset', () => {
    test('clears all custom metrics', () => {
      collector.increment('counter', 10);
      collector.gauge('gauge', 20);
      collector.histogram('histogram', 30);

      collector.reset();

      const snapshot = collector.getSnapshot();
      expect(Object.keys(snapshot.custom.counters)).toHaveLength(0);
      expect(Object.keys(snapshot.custom.gauges)).toHaveLength(0);
      expect(Object.keys(snapshot.custom.histograms)).toHaveLength(0);
    });

    test('resets HTTP tracker', () => {
      const httpTracker = collector.getHttpTracker();
      httpTracker.startRequest();
      httpTracker.recordRequest('GET', '/test', 200, 50);

      collector.reset();

      const snapshot = collector.getSnapshot();
      expect(snapshot.http.totalRequests).toBe(0);
    });

    test('resets process tracker CPU baseline', () => {
      const processTracker = collector.getProcessTracker();
      processTracker.getCPUPercentage(); // Establish baseline

      collector.reset();

      const cpuPercent = processTracker.getCPUPercentage();
      expect(cpuPercent).toBe(0); // New baseline
    });

    test('clears event loop lag', () => {
      collector.reset();

      const snapshot = collector.getSnapshot();
      expect(snapshot.process.eventLoopLag).toBe(0);
    });

    test('can collect new metrics after reset', () => {
      collector.increment('test', 10);
      collector.reset();

      collector.increment('test', 5);

      const snapshot = collector.getSnapshot();
      expect(snapshot.custom.counters['test']).toBe(5);
    });
  });

  describe('Periodic collection lifecycle', () => {
    test('startCollection begins periodic collection', () => {
      expect(collector.isCollecting()).toBe(false);

      collector.startCollection();

      expect(collector.isCollecting()).toBe(true);
    });

    test('stopCollection ends periodic collection', () => {
      collector.startCollection();
      expect(collector.isCollecting()).toBe(true);

      collector.stopCollection();

      expect(collector.isCollecting()).toBe(false);
    });

    test('startCollection is idempotent', () => {
      collector.startCollection();
      collector.startCollection();
      collector.startCollection();

      expect(collector.isCollecting()).toBe(true);
    });

    test('stopCollection when not collecting is safe', () => {
      expect(collector.isCollecting()).toBe(false);

      collector.stopCollection();

      expect(collector.isCollecting()).toBe(false);
    });

    test('periodic collection measures event loop lag', async () => {
      vi.useFakeTimers();

      collector.startCollection();

      // Advance past collection interval
      await vi.advanceTimersByTimeAsync(1000);

      // Event loop lag should be measured (though might be 0 in test env)
      const snapshot = collector.getSnapshot();
      expect(snapshot.process.eventLoopLag).toBeGreaterThanOrEqual(0);

      collector.stopCollection();
    });

    test('can restart collection after stopping', () => {
      collector.startCollection();
      collector.stopCollection();

      collector.startCollection();

      expect(collector.isCollecting()).toBe(true);
    });
  });

  describe('HTTP request tracking', () => {
    test('startHttpRequest increments active requests', () => {
      collector.startHttpRequest();

      const snapshot = collector.getSnapshot();
      expect(snapshot.http.activeRequests).toBe(1);
    });

    test('recordHttpRequest records request metrics', () => {
      collector.startHttpRequest();
      collector.recordHttpRequest('GET', '/api/test', 200, 45.5);

      const snapshot = collector.getSnapshot();
      expect(snapshot.http.totalRequests).toBe(1);
      expect(snapshot.http.statusCodes['200']).toBe(1);
      expect(snapshot.http.byMethod['GET']?.count).toBe(1);
      expect(snapshot.http.byRoute['/api/test']?.count).toBe(1);
      expect(snapshot.http.latency.mean).toBe(45.5);
    });

    test('multiple HTTP requests tracked correctly', () => {
      collector.startHttpRequest();
      collector.recordHttpRequest('GET', '/api/users', 200, 50);

      collector.startHttpRequest();
      collector.recordHttpRequest('POST', '/api/orders', 201, 100);

      const snapshot = collector.getSnapshot();
      expect(snapshot.http.totalRequests).toBe(2);
      expect(snapshot.http.statusCodes['200']).toBe(1);
      expect(snapshot.http.statusCodes['201']).toBe(1);
    });

    test('HTTP tracking integrates with custom metrics', () => {
      collector.startHttpRequest();
      collector.recordHttpRequest('GET', '/test', 200, 50);
      collector.increment('custom.counter');

      const snapshot = collector.getSnapshot();
      expect(snapshot.http.totalRequests).toBe(1);
      expect(snapshot.custom.counters['custom.counter']).toBe(1);
    });
  });

  describe('Integration with trackers', () => {
    test('HTTP tracker records requests', () => {
      const httpTracker = collector.getHttpTracker();

      httpTracker.startRequest();
      httpTracker.recordRequest('GET', '/api/test', 200, 45.5);

      const snapshot = collector.getSnapshot();
      expect(snapshot.http.totalRequests).toBe(1);
      expect(snapshot.http.latency.mean).toBe(45.5);
    });

    test('process tracker collects system metrics', () => {
      const snapshot = collector.getSnapshot();

      expect(snapshot.process.memoryUsage.heapUsed).toBeGreaterThan(0);
      expect(snapshot.process.uptime).toBeGreaterThanOrEqual(0);
    });

    test('all metrics types work together', async () => {
      // HTTP
      const httpTracker = collector.getHttpTracker();
      httpTracker.startRequest();
      httpTracker.recordRequest('POST', '/api/orders', 201, 120);

      // Custom metrics
      collector.increment('orders.created');
      collector.gauge('queue.size', 10);
      collector.histogram('order.value', 99.99);

      const stopTimer = collector.startTimer('processing');
      await new Promise(resolve => setTimeout(resolve, 20));
      stopTimer();

      const snapshot = collector.getSnapshot();

      // Verify all metrics present
      expect(snapshot.http.totalRequests).toBe(1);
      expect(snapshot.process.uptime).toBeGreaterThan(0);
      expect(snapshot.custom.counters['orders.created']).toBe(1);
      expect(snapshot.custom.gauges['queue.size']).toBe(10);
      expect(snapshot.custom.histograms['order.value']?.mean).toBe(99.99);
      expect(snapshot.custom.timers['processing']?.count).toBe(1);
    });
  });

  describe('Configuration', () => {
    test('getHistogramLimit returns configured limit', () => {
      expect(collector.getHistogramLimit()).toBe(100);
    });

    test('getCollectionInterval returns configured interval', () => {
      expect(collector.getCollectionInterval()).toBe(1000);
    });

    test('histogram limit applies to custom histograms', () => {
      const smallCollector = new MetricsCollectorImpl({
        histogramLimit: 2,
        logger: createMockLogger(),
      });

      smallCollector.histogram('test', 1);
      smallCollector.histogram('test', 2);
      smallCollector.histogram('test', 3);

      const snapshot = smallCollector.getSnapshot();
      expect(snapshot.custom.histograms['test']?.count).toBe(2);
    });

    test('histogram limit applies to timers', async () => {
      const smallCollector = new MetricsCollectorImpl({
        histogramLimit: 2,
        logger: createMockLogger(),
      });

      for (let i = 0; i < 3; i++) {
        const stop = smallCollector.startTimer('test');
        stop();
      }

      const snapshot = smallCollector.getSnapshot();
      expect(snapshot.custom.timers['test']?.count).toBe(2);
    });
  });

  describe('Edge cases', () => {
    test('handles empty metric names', () => {
      collector.increment('');
      collector.gauge('', 10);

      const snapshot = collector.getSnapshot();
      expect(snapshot.custom.counters['']).toBe(1);
      expect(snapshot.custom.gauges['']).toBe(10);
    });

    test('handles very long metric names', () => {
      const longName = 'a'.repeat(1000);
      collector.increment(longName, 1);

      const snapshot = collector.getSnapshot();
      expect(snapshot.custom.counters[longName]).toBe(1);
    });

    test('handles special characters in metric names', () => {
      collector.increment('metric.with-dash_and.dots');
      collector.gauge('metric/with/slashes', 10);

      const snapshot = collector.getSnapshot();
      expect(snapshot.custom.counters['metric.with-dash_and.dots']).toBe(1);
      expect(snapshot.custom.gauges['metric/with/slashes']).toBe(10);
    });

    test('handles very large counter values', () => {
      collector.increment('test', Number.MAX_SAFE_INTEGER);

      const snapshot = collector.getSnapshot();
      expect(snapshot.custom.counters['test']).toBe(Number.MAX_SAFE_INTEGER);
    });

    test('handles many concurrent timers', async () => {
      const promises: Promise<void>[] = [];

      for (let i = 0; i < 100; i++) {
        promises.push(
          new Promise(resolve => {
            const stop = collector.startTimer('concurrent');
            setTimeout(() => {
              stop();
              resolve();
            }, Math.random() * 10);
          })
        );
      }

      await Promise.all(promises);

      const snapshot = collector.getSnapshot();
      expect(snapshot.custom.timers['concurrent']?.count).toBeGreaterThan(0);
    });
  });

  describe('Cardinality Limits', () => {
    describe('Basic Cardinality Tracking', () => {
      test('tracks cardinality correctly', () => {
        const collector = new MetricsCollectorImpl({
          histogramLimit: 100,
          maxCardinality: 10000,
          logger: createMockLogger(),
        });

        collector.increment('counter1');
        collector.increment('counter2');
        collector.gauge('gauge1', 42);
        collector.histogram('hist1', 100);

        const snapshot = collector.getSnapshot();
        expect(snapshot._meta?.cardinality).toBe(4);
      });

      test('does not count duplicate metric names', () => {
        const collector = new MetricsCollectorImpl({
          histogramLimit: 100,
          maxCardinality: 10000,
          logger: createMockLogger(),
        });

        collector.increment('metric1');
        collector.increment('metric1'); // Same metric
        collector.increment('metric1');

        const snapshot = collector.getSnapshot();
        expect(snapshot._meta?.cardinality).toBe(1);
      });

      test('counts across different metric types', () => {
        const collector = new MetricsCollectorImpl({
          histogramLimit: 100,
          maxCardinality: 10000,
          logger: createMockLogger(),
        });

        collector.increment('counter1');
        collector.gauge('gauge1', 10);
        collector.histogram('hist1', 50);
        const stop = collector.startTimer('timer1');
        stop();

        const snapshot = collector.getSnapshot();
        expect(snapshot._meta?.cardinality).toBe(4);
      });
    });

    describe('Limit Enforcement', () => {
      test('drops new metrics when limit reached', () => {
        const logger = createMockLogger();
        const collector = new MetricsCollectorImpl({
          histogramLimit: 100,
          maxCardinality: 5,
          onCardinalityLimit: 'drop',
          logger,
        });

        // Add 5 metrics (at limit)
        collector.increment('metric1');
        collector.increment('metric2');
        collector.increment('metric3');
        collector.increment('metric4');
        collector.increment('metric5');

        expect(collector.getSnapshot()._meta?.cardinality).toBe(5);

        // Try to add 6th metric (should be dropped)
        collector.increment('metric6');

        expect(collector.getSnapshot()._meta?.cardinality).toBe(5);
        expect(collector.getSnapshot().custom.counters['metric6']).toBeUndefined();
        expect(logger.warn).toHaveBeenCalled();
      });

      test('allows updates to existing metrics even at limit', () => {
        const collector = new MetricsCollectorImpl({
          histogramLimit: 100,
          maxCardinality: 3,
          onCardinalityLimit: 'drop',
          logger: createMockLogger(),
        });

        collector.increment('metric1');
        collector.increment('metric2');
        collector.increment('metric3');

        // At limit, but updating existing metric should work
        collector.increment('metric1', 10);

        expect(collector.getSnapshot().custom.counters['metric1']).toBe(11);
      });

      test('works across different metric types', () => {
        const collector = new MetricsCollectorImpl({
          histogramLimit: 100,
          maxCardinality: 4,
          onCardinalityLimit: 'drop',
          logger: createMockLogger(),
        });

        collector.increment('counter1');
        collector.gauge('gauge1', 42);
        collector.histogram('hist1', 100);
        const stop = collector.startTimer('timer1');
        stop();

        // All 4 slots used
        expect(collector.getSnapshot()._meta?.cardinality).toBe(4);

        // Try to add 5th metric (different type, should still be dropped)
        collector.increment('counter2');

        expect(collector.getSnapshot()._meta?.cardinality).toBe(4);
        expect(collector.getSnapshot().custom.counters['counter2']).toBeUndefined();
      });

      test('allows gauge updates at limit', () => {
        const collector = new MetricsCollectorImpl({
          histogramLimit: 100,
          maxCardinality: 2,
          onCardinalityLimit: 'drop',
          logger: createMockLogger(),
        });

        collector.gauge('gauge1', 100);
        collector.gauge('gauge2', 200);

        // At limit, update existing gauge
        collector.gauge('gauge1', 150);

        expect(collector.getSnapshot().custom.gauges['gauge1']).toBe(150);
        expect(collector.getSnapshot()._meta?.cardinality).toBe(2);
      });

      test('allows histogram updates at limit', () => {
        const collector = new MetricsCollectorImpl({
          histogramLimit: 100,
          maxCardinality: 2,
          onCardinalityLimit: 'drop',
          logger: createMockLogger(),
        });

        collector.histogram('hist1', 10);
        collector.histogram('hist2', 20);

        // At limit, add to existing histogram
        collector.histogram('hist1', 30);

        const snapshot = collector.getSnapshot();
        expect(snapshot.custom.histograms['hist1']?.count).toBe(2);
        expect(snapshot._meta?.cardinality).toBe(2);
      });

      test('allows timer updates at limit', () => {
        const collector = new MetricsCollectorImpl({
          histogramLimit: 100,
          maxCardinality: 2,
          onCardinalityLimit: 'drop',
          logger: createMockLogger(),
        });

        const stop1 = collector.startTimer('timer1');
        stop1();
        const stop2 = collector.startTimer('timer2');
        stop2();

        // At limit, record another duration for existing timer
        const stop3 = collector.startTimer('timer1');
        stop3();

        const snapshot = collector.getSnapshot();
        expect(snapshot.custom.timers['timer1']?.count).toBe(2);
        expect(snapshot._meta?.cardinality).toBe(2);
      });
    });

    describe('Warning Levels', () => {
      test('warns at 80% capacity', () => {
        const logger = createMockLogger();
        const collector = new MetricsCollectorImpl({
          histogramLimit: 100,
          maxCardinality: 10,
          onCardinalityLimit: 'drop',
          logger,
        });

        // Add 8 metrics (80%)
        for (let i = 1; i <= 8; i++) {
          collector.increment(`metric${i}`);
        }

        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('80%'));
      });

      test('warns at 90% capacity', () => {
        const logger = createMockLogger();
        const collector = new MetricsCollectorImpl({
          histogramLimit: 100,
          maxCardinality: 10,
          onCardinalityLimit: 'drop',
          logger,
        });

        // Add 9 metrics (90%)
        for (let i = 1; i <= 9; i++) {
          collector.increment(`metric${i}`);
        }

        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('90%'));

        // Add 9 metrics (90%)
        for (let i = 1; i <= 9; i++) {
          collector.increment(`metric${i}`);
        }

        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('90%'));
      });

      test('only warns once per threshold', () => {
        const logger = createMockLogger();
        const collector = new MetricsCollectorImpl({
          histogramLimit: 100,
          maxCardinality: 10,
          onCardinalityLimit: 'drop',
          logger,
        });

        const consoleWarn = vi.spyOn(logger, 'warn').mockImplementation(() => {});

        // Add metrics to reach 80% multiple times (via updates)
        for (let i = 1; i <= 8; i++) {
          collector.increment(`metric${i}`);
        }

        const warningCount = consoleWarn.mock.calls.filter(call => call[0].includes('80%')).length;

        expect(warningCount).toBe(1); // Only warned once

        // Add more to same metrics - should not warn again
        for (let i = 1; i <= 8; i++) {
          collector.increment(`metric${i}`, 5);
        }

        const warningCountAfter = consoleWarn.mock.calls.filter(call =>
          call[0].includes('80%')
        ).length;

        expect(warningCountAfter).toBe(1); // Still only once

        consoleWarn.mockRestore();
      });

      test('warns at 100% capacity when trying to add new metric', () => {
        const logger = createMockLogger();
        const collector = new MetricsCollectorImpl({
          histogramLimit: 100,
          maxCardinality: 5,
          onCardinalityLimit: 'drop',
          logger,
        });

        const consoleWarn = vi.spyOn(logger, 'warn').mockImplementation(() => {});

        // Fill to capacity
        for (let i = 1; i <= 5; i++) {
          collector.increment(`metric${i}`);
        }

        // Try to exceed
        collector.increment('metric6');

        expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining('limit reached'));

        consoleWarn.mockRestore();
      });
    });

    describe('onCardinalityLimit Actions', () => {
      test('drops silently when action is "drop"', () => {
        const logger = createMockLogger();
        const collector = new MetricsCollectorImpl({
          histogramLimit: 100,
          maxCardinality: 2,
          onCardinalityLimit: 'drop',
          logger,
        });

        const consoleWarn = vi.spyOn(logger, 'warn').mockImplementation(() => {});

        collector.increment('metric1');
        collector.increment('metric2');

        // Clear warnings from reaching limit
        consoleWarn.mockClear();

        // This should be dropped, with only general warning
        collector.increment('metric3');

        // Should have warned about limit, but not about specific metric
        const calls = consoleWarn.mock.calls;
        const hasGeneralWarning = calls.some(call => call[0].includes('limit reached'));
        const hasSpecificWarning = calls.some(call => call[0].includes('metric3'));

        expect(hasGeneralWarning).toBe(true);
        expect(hasSpecificWarning).toBe(false);

        consoleWarn.mockRestore();
      });

      test('warns with metric name when action is "warn"', () => {
        const logger = createMockLogger();
        const collector = new MetricsCollectorImpl({
          histogramLimit: 100,
          maxCardinality: 2,
          onCardinalityLimit: 'warn',
          logger,
        });

        const consoleWarn = vi.spyOn(logger, 'warn').mockImplementation(() => {});

        collector.increment('metric1');
        collector.increment('metric2');
        collector.increment('metric3');

        expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining('metric3'));

        consoleWarn.mockRestore();
      });

      test('throws error when action is "error"', () => {
        const collector = new MetricsCollectorImpl({
          histogramLimit: 100,
          maxCardinality: 2,
          onCardinalityLimit: 'error',
          logger: createMockLogger(),
        });

        collector.increment('metric1');
        collector.increment('metric2');

        expect(() => collector.increment('metric3')).toThrow(/cardinality limit reached/i);
      });

      test('error action throws for gauge', () => {
        const collector = new MetricsCollectorImpl({
          histogramLimit: 100,
          maxCardinality: 1,
          onCardinalityLimit: 'error',
          logger: createMockLogger(),
        });

        collector.gauge('gauge1', 10);

        expect(() => collector.gauge('gauge2', 20)).toThrow(/cardinality limit reached/i);
      });

      test('error action throws for histogram', () => {
        const collector = new MetricsCollectorImpl({
          histogramLimit: 100,
          maxCardinality: 1,
          onCardinalityLimit: 'error',
          logger: createMockLogger(),
        });

        collector.histogram('hist1', 10);

        expect(() => collector.histogram('hist2', 20)).toThrow(/cardinality limit reached/i);
      });

      test('error action throws for timer', () => {
        const collector = new MetricsCollectorImpl({
          histogramLimit: 100,
          maxCardinality: 1,
          onCardinalityLimit: 'error',
          logger: createMockLogger(),
        });
        const stop1 = collector.startTimer('timer1');
        stop1();

        // ✅ The error should be thrown when calling startTimer, not stop()
        expect(() => collector.startTimer('timer2')).toThrow(/cardinality limit reached/i);
      });
    });

    describe('Reset Behavior with Cardinality', () => {
      test('resets cardinality warnings', () => {
        const logger = createMockLogger();
        const collector = new MetricsCollectorImpl({
          histogramLimit: 100,
          maxCardinality: 10,
          onCardinalityLimit: 'drop',
          logger,
        });

        const consoleWarn = vi.spyOn(logger, 'warn').mockImplementation(() => {});

        // Trigger 80% warning
        for (let i = 1; i <= 8; i++) {
          collector.increment(`metric${i}`);
        }

        expect(consoleWarn).toHaveBeenCalled();
        consoleWarn.mockClear();

        // Reset
        collector.reset();

        // Should warn again after reset
        for (let i = 1; i <= 8; i++) {
          collector.increment(`metric${i}`);
        }

        expect(consoleWarn).toHaveBeenCalled();

        consoleWarn.mockRestore();
      });

      test('resets cardinality count', () => {
        const collector = new MetricsCollectorImpl({
          histogramLimit: 100,
          maxCardinality: 10,
          logger: createMockLogger(),
        });

        collector.increment('metric1');
        collector.gauge('metric2', 10);
        collector.histogram('metric3', 50);

        expect(collector.getSnapshot()._meta?.cardinality).toBe(3);

        collector.reset();

        expect(collector.getSnapshot()._meta?.cardinality).toBe(0);
      });
    });

    describe('Snapshot Metadata', () => {
      test('includes cardinality stats in snapshot', () => {
        const collector = new MetricsCollectorImpl({
          histogramLimit: 100,
          maxCardinality: 100,
          logger: createMockLogger(),
        });

        collector.increment('metric1');
        collector.increment('metric2');
        collector.gauge('metric3', 42);

        const snapshot = collector.getSnapshot();

        expect(snapshot._meta).toEqual({
          cardinality: 3,
          maxCardinality: 100,
          cardinalityUsagePercent: 3,
        });
      });

      test('calculates usage percentage correctly', () => {
        const collector = new MetricsCollectorImpl({
          histogramLimit: 100,
          maxCardinality: 10,
          logger: createMockLogger(),
        });

        // Add 5 metrics (50%)
        for (let i = 1; i <= 5; i++) {
          collector.increment(`metric${i}`);
        }

        const snapshot = collector.getSnapshot();
        expect(snapshot._meta?.cardinalityUsagePercent).toBe(50);
      });

      test('handles 0% usage', () => {
        const collector = new MetricsCollectorImpl({
          histogramLimit: 100,
          maxCardinality: 100,
          logger: createMockLogger(),
        });

        const snapshot = collector.getSnapshot();
        expect(snapshot._meta?.cardinalityUsagePercent).toBe(0);
      });

      test('handles 100% usage', () => {
        const collector = new MetricsCollectorImpl({
          histogramLimit: 100,
          maxCardinality: 5,
          logger: createMockLogger(),
        });

        for (let i = 1; i <= 5; i++) {
          collector.increment(`metric${i}`);
        }

        const snapshot = collector.getSnapshot();
        expect(snapshot._meta?.cardinalityUsagePercent).toBe(100);
      });

      test('rounds down percentage', () => {
        const collector = new MetricsCollectorImpl({
          histogramLimit: 100,
          maxCardinality: 7,
          logger: createMockLogger(),
        });

        // Add 2 metrics (28.57%)
        collector.increment('metric1');
        collector.increment('metric2');

        const snapshot = collector.getSnapshot();
        expect(snapshot._meta?.cardinalityUsagePercent).toBe(28); // Floor
      });
    });

    describe('Integration with existing tests', () => {
      test('cardinality tracking works with existing counter tests', () => {
        collector.increment('test.counter');
        collector.increment('test.counter');

        const snapshot = collector.getSnapshot();
        expect(snapshot.custom.counters['test.counter']).toBe(2);
        expect(snapshot._meta?.cardinality).toBe(1); // Still only 1 unique metric
      });

      test('cardinality tracking works with histogram limit', () => {
        const smallCollector = new MetricsCollectorImpl({
          histogramLimit: 3,
          maxCardinality: 10,
          logger: createMockLogger(),
        });

        for (let i = 1; i <= 5; i++) {
          smallCollector.histogram('test', i * 10);
        }

        const snapshot = smallCollector.getSnapshot();
        expect(snapshot.custom.histograms['test']?.count).toBe(3); // Histogram limit
        expect(snapshot._meta?.cardinality).toBe(1); // Cardinality unaffected
      });

      test('cardinality independent of histogram samples', () => {
        collector.histogram('test', 10);
        collector.histogram('test', 20);
        collector.histogram('test', 30);

        const snapshot = collector.getSnapshot();
        expect(snapshot.custom.histograms['test']?.count).toBe(3); // 3 samples
        expect(snapshot._meta?.cardinality).toBe(1); // 1 unique metric name
      });
    });
  });
});
