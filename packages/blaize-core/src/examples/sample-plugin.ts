/**
 * Example metrics plugin with full type safety
 * Demonstrates how to create typed plugins for BlaizeJS
 */

import type { Plugin, Server } from '@blaize-types/index';

/**
 * Metrics plugin configuration
 */
export interface MetricsConfig {
  /** Whether to enable metrics collection */
  enabled?: boolean;
  /** Interval for reporting metrics (ms) */
  reportInterval?: number;
  /** Whether to log metrics to console */
  logToConsole?: boolean;
  /** Custom reporter function */
  reporter?: (metrics: MetricsSnapshot) => void;
}

/**
 * State contributed by metrics plugin
 */
export interface MetricsState {
  metricsEnabled: boolean;
  metricsStartTime: number;
}

/**
 * Services contributed by metrics plugin
 */
export interface MetricsServices {
  metrics: MetricsService;
}

/**
 * Metrics service interface
 */
export interface MetricsService {
  /** Increment a counter */
  increment: (name: string, value?: number) => void;
  /** Record a gauge value */
  gauge: (name: string, value: number) => void;
  /** Record a histogram value */
  histogram: (name: string, value: number) => void;
  /** Start a timer */
  startTimer: (name: string) => () => void;
  /** Get current metrics snapshot */
  getSnapshot: () => MetricsSnapshot;
  /** Reset all metrics */
  reset: () => void;
}

/**
 * Metrics snapshot
 */
export interface MetricsSnapshot {
  timestamp: number;
  uptime: number;
  counters: Record<string, number>;
  gauges: Record<string, number>;
  histograms: Record<string, number[]>;
  timers: Record<string, number[]>;
}

/**
 * Internal metrics storage
 */
class MetricsStore {
  private startTime = Date.now();
  private counters = new Map<string, number>();
  private gauges = new Map<string, number>();
  private histograms = new Map<string, number[]>();
  private timers = new Map<string, number[]>();

  increment(name: string, value = 1): void {
    const current = this.counters.get(name) || 0;
    this.counters.set(name, current + value);
  }

  gauge(name: string, value: number): void {
    this.gauges.set(name, value);
  }

  histogram(name: string, value: number): void {
    const values = this.histograms.get(name) || [];
    values.push(value);
    this.histograms.set(name, values);
  }

  recordTimer(name: string, duration: number): void {
    const values = this.timers.get(name) || [];
    values.push(duration);
    this.timers.set(name, values);
  }

  getSnapshot(): MetricsSnapshot {
    return {
      timestamp: Date.now(),
      uptime: Date.now() - this.startTime,
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      histograms: Object.fromEntries(this.histograms),
      timers: Object.fromEntries(this.timers),
    };
  }

  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    this.timers.clear();
    this.startTime = Date.now();
  }
}

/**
 * Creates a metrics plugin
 */
export function createMetricsPlugin(
  config: MetricsConfig = {}
): Plugin<MetricsState, MetricsServices> {
  const {
    enabled = true,
    reportInterval = 60000, // 1 minute default
    logToConsole = false,
    reporter,
  } = config;

  const store = new MetricsStore();
  let reportTimer: NodeJS.Timeout | null = null;

  // Create the metrics service
  const metricsService: MetricsService = {
    increment: (name, value) => {
      if (enabled) {
        store.increment(name, value);
      }
    },
    gauge: (name, value) => {
      if (enabled) {
        store.gauge(name, value);
      }
    },
    histogram: (name, value) => {
      if (enabled) {
        store.histogram(name, value);
      }
    },
    startTimer: name => {
      const startTime = Date.now();
      return () => {
        if (enabled) {
          const duration = Date.now() - startTime;
          store.recordTimer(name, duration);
        }
      };
    },
    getSnapshot: () => store.getSnapshot(),
    reset: () => store.reset(),
  };

  // Report function
  const report = () => {
    const snapshot = store.getSnapshot();

    if (logToConsole) {
      console.log('📊 Metrics Report:', {
        uptime: `${Math.floor(snapshot.uptime / 1000)}s`,
        counters: snapshot.counters,
        gauges: snapshot.gauges,
        histograms: Object.fromEntries(
          Object.entries(snapshot.histograms).map(([key, values]) => [
            key,
            {
              count: values.length,
              min: Math.min(...values),
              max: Math.max(...values),
              avg: values.reduce((a, b) => a + b, 0) / values.length,
            },
          ])
        ),
        timers: Object.fromEntries(
          Object.entries(snapshot.timers).map(([key, values]) => [
            key,
            {
              count: values.length,
              min: Math.min(...values),
              max: Math.max(...values),
              avg: values.reduce((a, b) => a + b, 0) / values.length,
              p95: values.sort((a, b) => a - b)[Math.floor(values.length * 0.95)],
            },
          ])
        ),
      });
    }

    if (reporter) {
      reporter(snapshot);
    }
  };

  return {
    name: 'metrics',
    version: '1.0.0',

    register: async (server: Server<any, any>) => {
      // Add state to indicate metrics are enabled
      (server as any).metricsEnabled = enabled;
      (server as any).metricsStartTime = Date.now();

      // Add the metrics service
      (server as any).metrics = metricsService;

      // Track basic server metrics
      metricsService.increment('server.registered');
      metricsService.gauge('server.port', server.port);
    },

    initialize: async _server => {
      metricsService.increment('server.initialized');

      // Start reporting if enabled
      if (enabled && reportInterval > 0) {
        reportTimer = setInterval(report, reportInterval);
      }
    },

    onServerStart: async _server => {
      metricsService.increment('server.started');
      metricsService.gauge('server.status', 1); // 1 = running
    },

    onServerStop: async _server => {
      metricsService.increment('server.stopped');
      metricsService.gauge('server.status', 0); // 0 = stopped

      // Final report
      if (enabled) {
        report();
      }

      // Clear the report timer
      if (reportTimer) {
        clearInterval(reportTimer);
        reportTimer = null;
      }
    },

    terminate: async _server => {
      // Clean up
      if (reportTimer) {
        clearInterval(reportTimer);
        reportTimer = null;
      }
      store.reset();
    },
  };
}

/**
 * Simple metrics plugin with console logging
 */
export function simpleMetrics(): Plugin<MetricsState, MetricsServices> {
  return createMetricsPlugin({
    enabled: true,
    logToConsole: true,
    reportInterval: 30000, // 30 seconds
  });
}

/**
 * Production metrics plugin with custom reporter
 */
export function productionMetrics(
  reporter: (metrics: MetricsSnapshot) => void
): Plugin<MetricsState, MetricsServices> {
  return createMetricsPlugin({
    enabled: true,
    logToConsole: false,
    reportInterval: 60000, // 1 minute
    reporter,
  });
}
