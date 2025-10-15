/**
 * Type definitions for @blaizejs/plugin-metrics
 *
 * This module provides all TypeScript interfaces and types for the metrics plugin,
 * including configuration, collectors, snapshots, and metric data structures.
 *
 * @module @blaizejs/plugin-metrics/types
 */

/**
 * Configuration options for the metrics plugin
 *
 * @example
 * ```typescript
 * const config: MetricsPluginConfig = {
 *   enabled: true,
 *   excludePaths: ['/health', '/metrics'],
 *   histogramLimit: 1000,
 *   collectionInterval: 60000,
 *   labels: {
 *     service: 'api',
 *     environment: 'production',
 *   },
 * };
 * ```
 */
export interface MetricsPluginConfig {
  /**
   * Enable or disable metrics collection
   * @default true
   */
  enabled?: boolean;

  /**
   * Array of URL paths to exclude from HTTP metrics tracking
   * Supports exact matches and wildcards
   *
   * @default []
   * @example ['/health', '/metrics', '/internal/*']
   */
  excludePaths?: string[];

  /**
   * Maximum number of histogram samples to keep in memory per metric
   * Older samples are discarded (FIFO) when limit is reached
   *
   * @default 1000
   */
  histogramLimit?: number;

  /**
   * Interval in milliseconds for automatic metrics collection
   * Set to 0 to disable automatic collection
   *
   * @default 60000 (1 minute)
   */
  collectionInterval?: number;

  /**
   * Global labels to attach to all metrics
   * Useful for service identification, environment tags, etc.
   *
   * @default {}
   * @example { service: 'api', version: '1.0.0', environment: 'production' }
   */
  labels?: Record<string, string>;

  /**
   * Enable logging metrics to console
   * Useful for development and debugging
   *
   * @default false
   */
  logToConsole?: boolean;

  /**
   * Custom reporter function called when metrics are collected
   * Receives a snapshot of all metrics
   *
   * @example
   * ```typescript
   * reporter: (snapshot) => {
   *   console.log('HTTP Requests:', snapshot.http.totalRequests);
   *   // Send to external monitoring service
   *   sendToDatadog(snapshot);
   * }
   * ```
   */
  reporter?: (snapshot: MetricsSnapshot) => void | Promise<void>;
}

/**
 * State contributed by metrics plugin to context.state
 * Available in all route handlers when plugin is installed
 *
 * @example
 * ```typescript
 * export const GET = appRoute.get({
 *   handler: async (ctx) => {
 *     console.log('Metrics enabled:', ctx.state.metricsEnabled);
 *     console.log('Request start time:', ctx.state.metricsStartTime);
 *   }
 * });
 * ```
 */
export interface MetricsPluginState {
  /**
   * Whether metrics collection is enabled
   */
  metricsEnabled?: boolean;

  /**
   * Timestamp when metrics tracking started for this request
   */
  metricsStartTime?: number;

  /**
   * Index signature to satisfy BlaizeJS State constraint
   */
  [key: string]: any;
}

/**
 * Services contributed by metrics plugin to context.services
 * Available in all route handlers when plugin is installed
 *
 * @example
 * ```typescript
 * export const POST = appRoute.post({
 *   handler: async (ctx) => {
 *     // Access metrics collector
 *     ctx.services.metrics.increment('orders.created');
 *     ctx.services.metrics.gauge('queue.size', 42);
 *   }
 * });
 * ```
 */
export interface MetricsPluginServices {
  /**
   * Metrics collector instance
   * Provides methods for tracking custom metrics
   */
  metrics: MetricsCollector;

  /**
   * Index signature to satisfy BlaizeJS State constraint
   */
  [key: string]: any;
}

/**
 * Core metrics collector interface
 *
 * Provides methods for tracking different types of metrics:
 * - Counters: monotonically increasing values
 * - Gauges: arbitrary values that can go up or down
 * - Histograms: distribution of values
 * - Timers: duration measurements
 *
 * @example
 * ```typescript
 * // In a route handler
 * export default async (ctx: Context) => {
 *   const { metrics } = ctx.services;
 *
 *   // Counter
 *   metrics.increment('orders.created');
 *
 *   // Gauge
 *   metrics.gauge('queue.size', 42);
 *
 *   // Histogram
 *   metrics.histogram('order.value', 99.99);
 *
 *   // Timer
 *   const stopTimer = metrics.startTimer('db.query');
 *   await db.query('SELECT * FROM orders');
 *   stopTimer();
 *
 *   return { success: true };
 * };
 * ```
 */
export interface MetricsCollector {
  /**
   * Increment a counter metric by a specified value
   *
   * @param name - Metric name (e.g., 'http.requests', 'orders.created')
   * @param value - Amount to increment by (default: 1)
   *
   * @example
   * ```typescript
   * metrics.increment('api.calls');
   * metrics.increment('bytes.sent', 1024);
   * ```
   */
  increment(name: string, value?: number): void;

  /**
   * Set a gauge metric to a specific value
   * Gauges can go up or down
   *
   * @param name - Metric name (e.g., 'queue.size', 'active.connections')
   * @param value - Current value
   *
   * @example
   * ```typescript
   * metrics.gauge('active.users', 150);
   * metrics.gauge('memory.used', process.memoryUsage().heapUsed);
   * ```
   */
  gauge(name: string, value: number): void;

  /**
   * Record a value in a histogram
   * Histograms track distributions of values (min, max, mean, percentiles)
   *
   * @param name - Metric name (e.g., 'order.value', 'file.size')
   * @param value - Value to record
   *
   * @example
   * ```typescript
   * metrics.histogram('response.size', responseBody.length);
   * metrics.histogram('order.amount', 99.99);
   * ```
   */
  histogram(name: string, value: number): void;

  /**
   * Start a timer for duration measurement
   * Returns a function that stops the timer and records the duration
   *
   * @param name - Metric name (e.g., 'db.query', 'api.request')
   * @returns Function to stop the timer
   *
   * @example
   * ```typescript
   * const stopTimer = metrics.startTimer('database.query');
   * try {
   *   await db.query('SELECT * FROM users');
   * } finally {
   *   stopTimer(); // Records duration in milliseconds
   * }
   * ```
   */
  startTimer(name: string): () => void;

  /**
   * Start tracking an HTTP request
   *
   * Increments the active request counter.
   * Should be called at the start of request processing.
   *
   * @example
   * ```typescript
   * metrics.startHttpRequest();
   * // ... handle request ...
   * metrics.recordHttpRequest('GET', '/api/users', 200, duration);
   * ```
   */
  startHttpRequest(): void;

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
   * metrics.recordHttpRequest('GET', '/api/users', 200, duration);
   * ```
   */
  recordHttpRequest(method: string, path: string, statusCode: number, duration: number): void;

  /**
   * Get a snapshot of all current metrics
   *
   * @returns Complete metrics snapshot
   *
   * @example
   * ```typescript
   * const snapshot = metrics.getSnapshot();
   * console.log('Total requests:', snapshot.http.totalRequests);
   * console.log('P95 latency:', snapshot.http.latency.p95);
   * ```
   */
  getSnapshot(): MetricsSnapshot;

  /**
   * Reset all metrics to initial state
   * Useful for testing or periodic resets
   *
   * @example
   * ```typescript
   * metrics.reset(); // Clear all counters, gauges, histograms
   * ```
   */
  reset(): void;
  /**
   * Start periodic metrics collection
   */
  startCollection(): void;

  /**
   * Stop periodic metrics collection
   */
  stopCollection(): void;

  /**
   * Check if periodic collection is active
   */
  isCollecting(): boolean;
}

/**
 * Complete snapshot of all collected metrics
 *
 * @example
 * ```typescript
 * const snapshot: MetricsSnapshot = {
 *   timestamp: Date.now(),
 *   http: {
 *     totalRequests: 1000,
 *     activeRequests: 5,
 *     requestsPerSecond: 10.5,
 *     statusCodes: { '200': 950, '404': 30, '500': 20 },
 *     latency: {
 *       min: 10,
 *       max: 500,
 *       mean: 50,
 *       p50: 45,
 *       p95: 120,
 *       p99: 200,
 *     },
 *   },
 *   process: {
 *     memoryUsage: {
 *       heapUsed: 50000000,
 *       heapTotal: 100000000,
 *       external: 1000000,
 *       rss: 120000000,
 *     },
 *     cpuUsage: {
 *       user: 1000000,
 *       system: 500000,
 *     },
 *     uptime: 3600,
 *     eventLoopLag: 5,
 *   },
 *   custom: {
 *     counters: { 'orders.created': 42 },
 *     gauges: { 'queue.size': 10 },
 *     histograms: {
 *       'order.value': {
 *         count: 42,
 *         sum: 4200,
 *         min: 10,
 *         max: 500,
 *         mean: 100,
 *         p50: 95,
 *         p95: 300,
 *         p99: 450,
 *       },
 *     },
 *     timers: {
 *       'db.query': {
 *         count: 100,
 *         sum: 5000,
 *         min: 10,
 *         max: 200,
 *         mean: 50,
 *         p50: 45,
 *         p95: 120,
 *         p99: 180,
 *       },
 *     },
 *   },
 * };
 * ```
 */
export interface MetricsSnapshot {
  /**
   * Timestamp when the snapshot was taken (milliseconds since epoch)
   */
  timestamp: number;

  /**
   * HTTP request metrics
   */
  http: HttpMetrics;

  /**
   * Node.js process metrics
   */
  process: ProcessMetrics;

  /**
   * Custom application metrics
   */
  custom: CustomMetrics;
}

/**
 * HTTP request tracking metrics
 * Automatically collected by the metrics middleware
 *
 * @example
 * ```typescript
 * const httpMetrics: HttpMetrics = {
 *   totalRequests: 1000,
 *   activeRequests: 5,
 *   requestsPerSecond: 10.5,
 *   statusCodes: {
 *     '200': 950,
 *     '404': 30,
 *     '500': 20,
 *   },
 *   latency: {
 *     min: 10,
 *     max: 500,
 *     mean: 50,
 *     p50: 45,
 *     p95: 120,
 *     p99: 200,
 *   },
 *   byMethod: {
 *     GET: { count: 800, avgLatency: 45 },
 *     POST: { count: 150, avgLatency: 80 },
 *     PUT: { count: 30, avgLatency: 90 },
 *     DELETE: { count: 20, avgLatency: 60 },
 *   },
 *   byRoute: {
 *     '/api/users': { count: 400, avgLatency: 50 },
 *     '/api/orders': { count: 300, avgLatency: 70 },
 *   },
 * };
 * ```
 */
export interface HttpMetrics {
  /**
   * Total number of HTTP requests processed
   */
  totalRequests: number;

  /**
   * Number of requests currently being processed
   */
  activeRequests: number;

  /**
   * Average requests per second (calculated over collection interval)
   */
  requestsPerSecond: number;

  /**
   * Distribution of HTTP status codes
   * Key is status code (e.g., '200', '404', '500')
   * Value is count of responses with that status
   */
  statusCodes: Record<string, number>;

  /**
   * Request latency statistics in milliseconds
   */
  latency: HistogramStats;

  /**
   * Metrics grouped by HTTP method
   */
  byMethod: Record<string, RouteMetrics>;

  /**
   * Metrics grouped by route path
   */
  byRoute: Record<string, RouteMetrics>;
}

/**
 * Node.js process metrics
 * Collected from process.memoryUsage() and process.cpuUsage()
 *
 * @example
 * ```typescript
 * const processMetrics: ProcessMetrics = {
 *   memoryUsage: {
 *     heapUsed: 50000000,      // 50 MB
 *     heapTotal: 100000000,    // 100 MB
 *     external: 1000000,       // 1 MB
 *     rss: 120000000,          // 120 MB
 *   },
 *   cpuUsage: {
 *     user: 1000000,           // microseconds
 *     system: 500000,          // microseconds
 *   },
 *   uptime: 3600,              // seconds
 *   eventLoopLag: 5,           // milliseconds
 * };
 * ```
 */
export interface ProcessMetrics {
  /**
   * Memory usage statistics in bytes
   */
  memoryUsage: {
    /**
     * Heap memory currently used
     */
    heapUsed: number;

    /**
     * Total heap memory allocated
     */
    heapTotal: number;

    /**
     * Memory used by C++ objects bound to JavaScript
     */
    external: number;

    /**
     * Resident Set Size - total memory allocated for the process
     */
    rss: number;
  };

  /**
   * CPU usage statistics in microseconds
   */
  cpuUsage: {
    /**
     * CPU time spent in user mode
     */
    user: number;

    /**
     * CPU time spent in system mode
     */
    system: number;
  };

  /**
   * Process uptime in seconds
   */
  uptime: number;

  /**
   * Event loop lag in milliseconds
   * Measures how long it takes to execute a setImmediate callback
   */
  eventLoopLag: number;
}

/**
 * Custom application metrics
 * User-defined counters, gauges, histograms, and timers
 *
 * @example
 * ```typescript
 * const customMetrics: CustomMetrics = {
 *   counters: {
 *     'orders.created': 42,
 *     'users.registered': 150,
 *   },
 *   gauges: {
 *     'queue.size': 10,
 *     'active.connections': 25,
 *   },
 *   histograms: {
 *     'order.value': {
 *       count: 42,
 *       sum: 4200,
 *       min: 10,
 *       max: 500,
 *       mean: 100,
 *       p50: 95,
 *       p95: 300,
 *       p99: 450,
 *     },
 *   },
 *   timers: {
 *     'db.query': {
 *       count: 100,
 *       sum: 5000,
 *       min: 10,
 *       max: 200,
 *       mean: 50,
 *       p50: 45,
 *       p95: 120,
 *       p99: 180,
 *     },
 *   },
 * };
 * ```
 */
export interface CustomMetrics {
  /**
   * Counter metrics (monotonically increasing values)
   * Key is metric name, value is current count
   */
  counters: Record<string, number>;

  /**
   * Gauge metrics (arbitrary values that can go up or down)
   * Key is metric name, value is current value
   */
  gauges: Record<string, number>;

  /**
   * Histogram metrics (distribution statistics)
   * Key is metric name, value is histogram statistics
   */
  histograms: Record<string, HistogramStats>;

  /**
   * Timer metrics (duration measurements)
   * Key is metric name, value is timer statistics
   */
  timers: Record<string, HistogramStats>;
}

/**
 * Statistics calculated from histogram data
 *
 * @example
 * ```typescript
 * const stats: HistogramStats = {
 *   count: 100,
 *   sum: 5000,
 *   min: 10,
 *   max: 200,
 *   mean: 50,
 *   p50: 45,   // median
 *   p95: 120,  // 95th percentile
 *   p99: 180,  // 99th percentile
 * };
 * ```
 */
export interface HistogramStats {
  /**
   * Number of samples
   */
  count: number;

  /**
   * Sum of all samples
   */
  sum: number;

  /**
   * Minimum value
   */
  min: number;

  /**
   * Maximum value
   */
  max: number;

  /**
   * Arithmetic mean (average)
   */
  mean: number;

  /**
   * 50th percentile (median)
   */
  p50: number;

  /**
   * 95th percentile
   */
  p95: number;

  /**
   * 99th percentile
   */
  p99: number;
}

/**
 * Metrics for a specific route or HTTP method
 *
 * @example
 * ```typescript
 * const routeMetrics: RouteMetrics = {
 *   count: 1000,
 *   avgLatency: 50,
 * };
 * ```
 */
export interface RouteMetrics {
  /**
   * Number of requests
   */
  count: number;

  /**
   * Average latency in milliseconds
   */
  avgLatency: number;
}

/**
 * Internal histogram data structure (not exposed in public API)
 * Used for storing raw samples before calculating statistics
 *
 * @internal
 */
export interface HistogramData {
  /**
   * Array of sample values
   */
  samples: number[];

  /**
   * Maximum number of samples to keep
   */
  limit: number;
}

/**
 * Type guard to check if a value is a valid MetricsPluginConfig
 *
 * @param value - Value to check
 * @returns True if value is a valid MetricsPluginConfig
 *
 * @example
 * ```typescript
 * if (isMetricsPluginConfig(config)) {
 *   // TypeScript knows config is MetricsPluginConfig
 *   console.log(config.enabled);
 * }
 * ```
 */
export function isMetricsPluginConfig(value: unknown): value is MetricsPluginConfig {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const config = value as Record<string, unknown>;

  // Check optional properties
  if ('enabled' in config && typeof config.enabled !== 'boolean') {
    return false;
  }

  if ('excludePaths' in config) {
    if (!Array.isArray(config.excludePaths)) {
      return false;
    }
    if (!config.excludePaths.every(path => typeof path === 'string')) {
      return false;
    }
  }

  if ('histogramLimit' in config && typeof config.histogramLimit !== 'number') {
    return false;
  }

  if ('collectionInterval' in config && typeof config.collectionInterval !== 'number') {
    return false;
  }

  if ('labels' in config) {
    if (typeof config.labels !== 'object' || config.labels === null) {
      return false;
    }
    const labels = config.labels as Record<string, unknown>;
    if (!Object.values(labels).every(value => typeof value === 'string')) {
      return false;
    }
  }

  if ('logToConsole' in config && typeof config.logToConsole !== 'boolean') {
    return false;
  }

  if ('reporter' in config && typeof config.reporter !== 'function') {
    return false;
  }

  return true;
}
