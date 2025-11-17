/**
 * HTTP Request Tracker
 *
 * Tracks HTTP request metrics including counts, durations, status codes,
 * and active requests. Implements FIFO histogram management with configurable
 * memory limits for efficient tracking at scale.
 *
 * @module @blaizejs/plugin-metrics/http-tracker
 */

import type { HttpMetrics, HistogramStats, RouteMetrics } from './types';

/**
 * HTTP Request Tracker
 *
 * High-performance tracker for HTTP request metrics with O(1) recording
 * and FIFO-based memory management.
 *
 * @example
 * ```typescript
 * const tracker = new HttpRequestTracker(1000);
 *
 * // Start tracking a request
 * tracker.startRequest();
 *
 * // Record completed request
 * tracker.recordRequest('GET', '/api/users', 200, 45.5);
 *
 * // Get current metrics
 * const metrics = tracker.getMetrics();
 * logger.info(metrics.totalRequests); // 1
 * logger.info(metrics.latency.p95);   // 45.5
 *
 * // Reset all metrics
 * tracker.reset();
 * ```
 */
export class HttpRequestTracker {
  private totalRequests = 0;
  private activeRequests = 0;
  private statusCodes = new Map<string, number>();
  private durations: number[] = [];
  private readonly histogramLimit: number;
  private methodStats = new Map<string, MethodRouteStats>();
  private routeStats = new Map<string, MethodRouteStats>();
  private startTime = Date.now();

  /**
   * Create a new HTTP request tracker
   *
   * @param histogramLimit - Maximum number of duration samples to keep (FIFO)
   */
  constructor(histogramLimit = 1000) {
    if (histogramLimit <= 0) {
      throw new Error('histogramLimit must be greater than 0');
    }
    this.histogramLimit = histogramLimit;
  }

  /**
   * Mark the start of an HTTP request
   * Increments the active request counter
   *
   * @example
   * ```typescript
   * tracker.startRequest();
   * // ... handle request ...
   * tracker.recordRequest('GET', '/api/users', 200, duration);
   * ```
   */
  startRequest(): void {
    this.activeRequests++;
  }

  /**
   * Record a completed HTTP request
   *
   * O(1) performance - uses FIFO array for histogram samples
   *
   * @param method - HTTP method (GET, POST, etc.)
   * @param path - Request path
   * @param statusCode - HTTP status code
   * @param duration - Request duration in milliseconds
   *
   * @example
   * ```typescript
   * tracker.recordRequest('GET', '/api/users', 200, 45.5);
   * tracker.recordRequest('POST', '/api/orders', 201, 120.3);
   * tracker.recordRequest('GET', '/api/products', 404, 15.2);
   * ```
   */
  recordRequest(method: string, path: string, statusCode: number, duration: number): void {
    // Decrement active requests
    if (this.activeRequests > 0) {
      this.activeRequests--;
    }

    // Increment total requests
    this.totalRequests++;

    // Track status codes
    const statusKey = statusCode.toString();
    this.statusCodes.set(statusKey, (this.statusCodes.get(statusKey) || 0) + 1);

    // Track duration with FIFO limit
    this.durations.push(duration);
    if (this.durations.length > this.histogramLimit) {
      this.durations.shift(); // Remove oldest sample (FIFO)
    }

    // Track by method
    this.updateMethodRouteStats(this.methodStats, method, duration);

    // Track by route
    this.updateMethodRouteStats(this.routeStats, path, duration);
  }

  /**
   * Get current HTTP metrics snapshot
   *
   * Calculates statistics from collected data including percentiles,
   * averages, and distributions.
   *
   * @returns Complete HTTP metrics
   *
   * @example
   * ```typescript
   * const metrics = tracker.getMetrics();
   * logger.info('Total requests:', metrics.totalRequests);
   * logger.info('Active requests:', metrics.activeRequests);
   * logger.info('P95 latency:', metrics.latency.p95);
   * logger.info('Status codes:', metrics.statusCodes);
   * ```
   */
  getMetrics(): HttpMetrics {
    const now = Date.now();
    const elapsedSeconds = (now - this.startTime) / 1000;
    const requestsPerSecond = elapsedSeconds > 0 ? this.totalRequests / elapsedSeconds : 0;

    return {
      totalRequests: this.totalRequests,
      activeRequests: this.activeRequests,
      requestsPerSecond,
      statusCodes: Object.fromEntries(this.statusCodes),
      latency: this.calculateHistogramStats(this.durations),
      byMethod: this.getMethodRouteMetrics(this.methodStats),
      byRoute: this.getMethodRouteMetrics(this.routeStats),
    };
  }

  /**
   * Reset all metrics to initial state
   *
   * Clears all counters, histograms, and tracking data.
   * Resets the start time for requests-per-second calculation.
   *
   * @example
   * ```typescript
   * tracker.reset();
   * logger.info(tracker.getMetrics().totalRequests); // 0
   * ```
   */
  reset(): void {
    this.totalRequests = 0;
    this.activeRequests = 0;
    this.statusCodes.clear();
    this.durations = [];
    this.methodStats.clear();
    this.routeStats.clear();
    this.startTime = Date.now();
  }

  /**
   * Update method or route statistics
   *
   * @private
   * @param statsMap - Map of method/route to stats
   * @param key - Method or route identifier
   * @param duration - Request duration
   */
  private updateMethodRouteStats(
    statsMap: Map<string, MethodRouteStats>,
    key: string,
    duration: number
  ): void {
    const stats = statsMap.get(key);
    if (stats) {
      stats.count++;
      stats.totalDuration += duration;
    } else {
      statsMap.set(key, {
        count: 1,
        totalDuration: duration,
      });
    }
  }

  /**
   * Get method or route metrics from stats map
   *
   * @private
   * @param statsMap - Map of method/route to stats
   * @returns Record of route metrics
   */
  private getMethodRouteMetrics(
    statsMap: Map<string, MethodRouteStats>
  ): Record<string, RouteMetrics> {
    const result: Record<string, RouteMetrics> = {};
    for (const [key, stats] of statsMap.entries()) {
      result[key] = {
        count: stats.count,
        avgLatency: stats.totalDuration / stats.count,
      };
    }
    return result;
  }

  /**
   * Calculate histogram statistics from samples
   *
   * Computes min, max, mean, and percentiles (p50, p95, p99)
   * from the collected duration samples.
   *
   * @private
   * @param samples - Array of duration samples
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

    // Sort samples for percentile calculation (create copy to avoid mutation)
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
   * Uses linear interpolation for more accurate percentiles
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

    // Linear interpolation between two closest values
    return sorted[lower]! * (1 - weight) + sorted[upper]! * weight;
  }

  /**
   * Get current histogram limit
   *
   * @returns Maximum number of samples kept in histogram
   */
  getHistogramLimit(): number {
    return this.histogramLimit;
  }

  /**
   * Get current number of duration samples
   *
   * @returns Number of samples in histogram
   */
  getSampleCount(): number {
    return this.durations.length;
  }

  /**
   * Get current active request count
   *
   * @returns Number of active requests
   */
  getActiveRequests(): number {
    return this.activeRequests;
  }
}

/**
 * Internal statistics for methods and routes
 *
 * @private
 */
interface MethodRouteStats {
  count: number;
  totalDuration: number;
}
