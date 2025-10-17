/**
 * Metrics Collector Core
 *
 * Coordinates HTTP tracking, process monitoring, and custom metrics collection.
 * Implements the MetricsCollector interface with full lifecycle management.
 *
 * @module @blaizejs/plugin-metrics/collector
 */

import { HttpRequestTracker } from './http-tracker';
import { ProcessHealthTracker } from './process-tracker';

import type {
  MetricsCollector,
  MetricsSnapshot,
  CustomMetrics,
  HistogramStats,
  HistogramData,
} from './types';

/**
 * Metrics Collector Implementation
 *
 * Coordinates all metrics collection including HTTP requests, process health,
 * and custom application metrics. Provides a unified interface for tracking
 * and periodic collection.
 *
 * @example
 * ```typescript
 * const collector = new MetricsCollectorImpl({
 *   histogramLimit: 1000,
 *   collectionInterval: 60000,
 * });
 *
 * // Start periodic collection
 * collector.startCollection();
 *
 * // Track custom metrics
 * collector.increment('orders.created');
 * collector.gauge('queue.size', 42);
 *
 * const stopTimer = collector.startTimer('db.query');
 * await db.query('SELECT * FROM users');
 * stopTimer();
 *
 * // Get snapshot
 * const snapshot = collector.getSnapshot();
 *
 * // Stop collection
 * collector.stopCollection();
 * ```
 */
export class MetricsCollectorImpl implements MetricsCollector {
  private readonly httpTracker: HttpRequestTracker;
  private readonly processTracker: ProcessHealthTracker;
  private readonly histogramLimit: number;

  private maxCardinality: number;
  private cardinalityWarnings = new Set<number>(); // Track which % we've warned about
  private onCardinalityLimit: 'drop' | 'warn' | 'error';

  // Custom metrics storage
  private counters = new Map<string, number>();
  private gauges = new Map<string, number>();
  private histograms = new Map<string, HistogramData>();
  private timers = new Map<string, HistogramData>();

  // Periodic collection
  private collectionInterval: number;
  private collectionTimer: NodeJS.Timeout | null = null;
  private lastEventLoopLag = 0;

  /**
   * Create a new metrics collector
   *
   * @param options - Configuration options
   * @param options.histogramLimit - Maximum samples per histogram (default: 1000)
   * @param options.collectionInterval - Periodic collection interval in ms (default: 60000)
   * @param options.maxCardinality - Maximum unique metric names (default: 10000)
   * @param options.onCardinalityLimit - Action on cardinality limit ('drop', 'warn', 'error') (default: 'drop')
   */
  constructor(
    options: {
      histogramLimit?: number;
      collectionInterval?: number;
      maxCardinality?: number;
      onCardinalityLimit?: 'drop' | 'warn' | 'error';
    } = {}
  ) {
    this.histogramLimit = options.histogramLimit ?? 1000;
    this.collectionInterval = options.collectionInterval ?? 60000;
    this.maxCardinality = options.maxCardinality ?? 10000;
    this.onCardinalityLimit = options.onCardinalityLimit ?? 'drop';

    this.httpTracker = new HttpRequestTracker(this.histogramLimit);
    this.processTracker = new ProcessHealthTracker();
  }

  /**
   * Get current cardinality (total unique metrics)
   */
  private getCardinality(): number {
    return this.counters.size + this.gauges.size + this.histograms.size + this.timers.size;
  }

  /**
   * Check if we can add a new metric
   * Logs warnings at 80%, 90%, 100% capacity
   */
  private canAddMetric(metricName: string, metricType: string): boolean {
    const currentCardinality = this.getCardinality();

    // If metric already exists, always allow update
    if (
      this.counters.has(metricName) ||
      this.gauges.has(metricName) ||
      this.histograms.has(metricName) ||
      this.timers.has(metricName)
    ) {
      return true;
    }

    // Check if we're already at the limit
    if (currentCardinality >= this.maxCardinality) {
      const message = `Metric cardinality limit reached (${this.maxCardinality}). Dropping new ${metricType}: "${metricName}"`;

      switch (this.onCardinalityLimit) {
        case 'error':
          throw new Error(message);
        case 'warn':
          console.warn(`⚠️ ${message}`);
          break;
        case 'drop':
          // Silent drop - only log at 100% if we haven't already
          if (!this.cardinalityWarnings.has(100)) {
            console.warn(
              `⚠️ Metric cardinality limit reached (${this.maxCardinality}). New metrics will be dropped.`
            );
            this.cardinalityWarnings.add(100);
          }
          break;
      }

      return false;
    }

    // ✅ Calculate what percentage we'll be at AFTER adding this metric
    const newCardinality = currentCardinality + 1;
    const percentUsed = Math.floor((newCardinality / this.maxCardinality) * 100);

    if (percentUsed >= 90 && !this.cardinalityWarnings.has(90)) {
      console.warn(
        `⚠️ Metric cardinality at ${percentUsed}% (${newCardinality}/${this.maxCardinality}). ` +
          `Consider increasing maxCardinality or reducing metric dimensions.`
      );
      this.cardinalityWarnings.add(90);
    } else if (percentUsed >= 80 && !this.cardinalityWarnings.has(80)) {
      console.warn(
        `⚠️ Metric cardinality at ${percentUsed}% (${newCardinality}/${this.maxCardinality}).`
      );
      this.cardinalityWarnings.add(80);
    }

    return true;
  }

  /**
   * Increment a counter metric
   *
   * @param name - Metric name
   * @param value - Amount to increment (default: 1)
   *
   * @example
   * ```typescript
   * collector.increment('api.requests');
   * collector.increment('bytes.sent', 1024);
   * collector.increment('errors.validation', 1);
   * ```
   */
  increment(name: string, value = 1): void {
    if (!this.canAddMetric(name, 'counter')) {
      return;
    }
    const current = this.counters.get(name) ?? 0;
    this.counters.set(name, current + value);
  }

  /**
   * Set a gauge metric
   *
   * @param name - Metric name
   * @param value - Current value
   *
   * @example
   * ```typescript
   * collector.gauge('active.connections', 150);
   * collector.gauge('queue.size', 42);
   * collector.gauge('cache.hit.ratio', 0.95);
   * ```
   */
  gauge(name: string, value: number): void {
    if (!this.canAddMetric(name, 'gauge')) {
      return;
    }
    this.gauges.set(name, value);
  }

  /**
   * Record a histogram value
   *
   * @param name - Metric name
   * @param value - Value to record
   *
   * @example
   * ```typescript
   * collector.histogram('order.value', 99.99);
   * collector.histogram('response.size', 2048);
   * collector.histogram('query.rows', 150);
   * ```
   */
  histogram(name: string, value: number): void {
    if (!this.canAddMetric(name, 'histogram')) {
      return;
    }
    let histogram = this.histograms.get(name);

    if (!histogram) {
      histogram = {
        samples: [],
        limit: this.histogramLimit,
      };
      this.histograms.set(name, histogram);
    }

    // Add sample with FIFO eviction
    histogram.samples.push(value);
    if (histogram.samples.length > histogram.limit) {
      histogram.samples.shift();
    }
  }

  /**
   * Start a timer for duration measurement
   *
   * @param name - Metric name
   * @returns Function to stop the timer and record duration
   *
   * @example
   * ```typescript
   * const stopTimer = collector.startTimer('database.query');
   * try {
   *   await db.query('SELECT * FROM users');
   * } finally {
   *   stopTimer(); // Records duration automatically
   * }
   *
   * // Or with inline usage
   * const stop = collector.startTimer('api.external.call');
   * const result = await fetch('https://api.example.com');
   * stop();
   * ```
   */
  startTimer(name: string): () => void {
    if (!this.canAddMetric(name, 'timer')) {
      return () => {
        /* no-op */
      };
    }
    const start = Date.now();

    return () => {
      const duration = Date.now() - start;

      let timer = this.timers.get(name);

      if (!timer) {
        timer = {
          samples: [],
          limit: this.histogramLimit,
        };
        this.timers.set(name, timer);
      }

      // Add sample with FIFO eviction
      timer.samples.push(duration);
      if (timer.samples.length > timer.limit) {
        timer.samples.shift();
      }
    };
  }

  /**
   * Get a complete snapshot of all metrics
   *
   * @returns Complete metrics snapshot
   *
   * @example
   * ```typescript
   * const snapshot = collector.getSnapshot();
   *
   * console.log('HTTP requests:', snapshot.http.totalRequests);
   * console.log('Memory used:', snapshot.process.memoryUsage.heapUsed);
   * console.log('Custom counters:', snapshot.custom.counters);
   * console.log('P95 latency:', snapshot.http.latency.p95);
   * ```
   */
  getSnapshot(): MetricsSnapshot {
    return {
      timestamp: Date.now(),
      http: this.httpTracker.getMetrics(),
      process: {
        ...this.processTracker.collect(),
        eventLoopLag: this.lastEventLoopLag,
      },
      custom: this.getCustomMetrics(),
      _meta: {
        cardinality: this.getCardinality(),
        maxCardinality: this.maxCardinality,
        cardinalityUsagePercent: Math.floor((this.getCardinality() / this.maxCardinality) * 100),
      },
    };
  }

  /**
   * Reset all metrics to initial state
   *
   * Clears HTTP tracker, custom metrics, and resets process tracker baseline.
   *
   * @example
   * ```typescript
   * collector.reset();
   *
   * const snapshot = collector.getSnapshot();
   * console.log(snapshot.http.totalRequests); // 0
   * console.log(snapshot.custom.counters);    // {}
   * ```
   */
  reset(): void {
    this.httpTracker.reset();
    this.processTracker.resetCPUBaseline();
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    this.timers.clear();
    this.cardinalityWarnings.clear();
    this.lastEventLoopLag = 0;
  }

  /**
   * Start periodic metrics collection
   *
   * Begins automatic collection at the configured interval.
   * Measures event loop lag periodically.
   *
   * @example
   * ```typescript
   * collector.startCollection();
   *
   * // Metrics are now being collected automatically
   * // Event loop lag is measured periodically
   * ```
   */
  startCollection(): void {
    if (this.collectionTimer !== null) {
      return; // Already running
    }

    // Start periodic collection
    this.collectionTimer = setInterval(() => {
      this.collectPeriodic();
    }, this.collectionInterval);

    // Don't prevent process exit
    if (this.collectionTimer.unref) {
      this.collectionTimer.unref();
    }

    // Initial collection
    this.collectPeriodic();
  }

  /**
   * Stop periodic metrics collection
   *
   * Stops automatic collection. Metrics can still be collected manually.
   *
   * @example
   * ```typescript
   * collector.stopCollection();
   *
   * // Periodic collection stopped
   * // Manual collection still works
   * const snapshot = collector.getSnapshot();
   * ```
   */
  stopCollection(): void {
    if (this.collectionTimer !== null) {
      clearInterval(this.collectionTimer);
      this.collectionTimer = null;
    }
  }

  /**
   * Check if periodic collection is active
   *
   * @returns True if collection is running
   *
   * @example
   * ```typescript
   * if (collector.isCollecting()) {
   *   console.log('Metrics being collected automatically');
   * }
   * ```
   */
  isCollecting(): boolean {
    return this.collectionTimer !== null;
  }

  /**
   * Start tracking an HTTP request
   *
   * Increments the active request counter in the HTTP tracker.
   * Should be called at the start of request processing.
   *
   * @example
   * ```typescript
   * collector.startHttpRequest();
   * // ... handle request ...
   * collector.recordHttpRequest('GET', '/api/users', 200, duration);
   * ```
   */
  startHttpRequest(): void {
    this.httpTracker.startRequest();
  }

  /**
   * Record a completed HTTP request
   *
   * Records the request method, path, status code, and duration.
   * Decrements the active request counter.
   *
   * @param method - HTTP method (GET, POST, etc.)
   * @param path - Request path
   * @param statusCode - HTTP status code
   * @param duration - Request duration in milliseconds
   *
   * @example
   * ```typescript
   * const start = performance.now();
   * // ... handle request ...
   * const duration = performance.now() - start;
   * collector.recordHttpRequest('GET', '/api/users', 200, duration);
   * ```
   */
  recordHttpRequest(method: string, path: string, statusCode: number, duration: number): void {
    this.httpTracker.recordRequest(method, path, statusCode, duration);
  }

  /**
   * Get the HTTP request tracker instance
   *
   * Provides access to the underlying HTTP tracker for advanced use cases.
   *
   * @returns HTTP request tracker
   *
   * @example
   * ```typescript
   * const httpTracker = collector.getHttpTracker();
   * httpTracker.startRequest();
   * // ... handle request ...
   * httpTracker.recordRequest('GET', '/api/users', 200, 45.5);
   * ```
   */
  getHttpTracker(): HttpRequestTracker {
    return this.httpTracker;
  }

  /**
   * Get the process health tracker instance
   *
   * Provides access to the underlying process tracker for advanced use cases.
   *
   * @returns Process health tracker
   *
   * @example
   * ```typescript
   * const processTracker = collector.getProcessTracker();
   * const cpuPercent = processTracker.getCPUPercentage();
   * console.log('CPU usage:', cpuPercent.toFixed(2), '%');
   * ```
   */
  getProcessTracker(): ProcessHealthTracker {
    return this.processTracker;
  }

  /**
   * Get configured histogram limit
   *
   * @returns Maximum samples per histogram
   */
  getHistogramLimit(): number {
    return this.histogramLimit;
  }

  /**
   * Get configured collection interval
   *
   * @returns Collection interval in milliseconds
   */
  getCollectionInterval(): number {
    return this.collectionInterval;
  }

  /**
   * Perform periodic collection tasks
   *
   * @private
   */
  private async collectPeriodic(): Promise<void> {
    // Measure event loop lag
    try {
      this.lastEventLoopLag = await this.processTracker.getEventLoopLag();
    } catch {
      // Ignore errors in background collection
      this.lastEventLoopLag = 0;
    }
  }

  /**
   * Get custom metrics snapshot
   *
   * @private
   * @returns Custom metrics
   */
  private getCustomMetrics(): CustomMetrics {
    return {
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      histograms: this.getHistogramMetrics(this.histograms),
      timers: this.getHistogramMetrics(this.timers),
    };
  }

  /**
   * Convert histogram data to statistics
   *
   * @private
   * @param histograms - Map of histogram data
   * @returns Map of histogram statistics
   */
  private getHistogramMetrics(
    histograms: Map<string, HistogramData>
  ): Record<string, HistogramStats> {
    const result: Record<string, HistogramStats> = {};

    for (const [name, data] of histograms.entries()) {
      result[name] = this.calculateHistogramStats(data.samples);
    }

    return result;
  }

  /**
   * Calculate histogram statistics from samples
   *
   * @private
   * @param samples - Array of sample values
   * @returns Histogram statistics
   */
  private calculateHistogramStats(samples: number[]): HistogramStats {
    if (samples.length === 0) {
      return {
        count: 0,
        sum: 0,
        min: 0,
        max: 0,
        mean: 0,
        p50: 0,
        p95: 0,
        p99: 0,
      };
    }

    const sorted = [...samples].sort((a, b) => a - b);
    const count = sorted.length;
    const sum = sorted.reduce((acc, val) => acc + val, 0);
    const mean = sum / count;

    return {
      count,
      sum,
      min: sorted[0]!,
      max: sorted[count - 1]!,
      mean,
      p50: this.calculatePercentile(sorted, 0.5),
      p95: this.calculatePercentile(sorted, 0.95),
      p99: this.calculatePercentile(sorted, 0.99),
    };
  }

  /**
   * Calculate a percentile from sorted samples
   *
   * @private
   * @param sorted - Sorted array of samples
   * @param percentile - Percentile to calculate (0.0 to 1.0)
   * @returns Percentile value
   */
  private calculatePercentile(sorted: number[], percentile: number): number {
    if (sorted.length === 0) {
      return 0;
    }

    if (sorted.length === 1) {
      return sorted[0]!;
    }

    const index = (sorted.length - 1) * percentile;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;

    if (lower === upper) {
      return sorted[lower]!;
    }

    return sorted[lower]! * (1 - weight) + sorted[upper]! * weight;
  }
}
