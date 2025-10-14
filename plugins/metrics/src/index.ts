/**
 * @blaizejs/plugin-metrics
 *
 * Production-ready metrics collection and observability plugin for BlaizeJS.
 *
 * Features:
 * - HTTP request tracking (latency, status codes, active requests)
 * - Custom metrics (counters, gauges, histograms, timers)
 * - Prometheus/OpenMetrics format export
 * - Process metrics (memory, CPU, event loop)
 * - Zero-config setup with sensible defaults
 *
 * @example
 * ```typescript
 * import { Blaize } from 'blaizejs';
 * import { createMetricsPlugin } from '@blaizejs/plugin-metrics';
 *
 * const app = Blaize.createServer({
 *   plugins: [
 *     createMetricsPlugin({
 *       enabled: true,
 *       excludePaths: ['/health', '/metrics'],
 *     }),
 *   ],
 * });
 * ```
 *
 * @module @blaizejs/plugin-metrics
 * @version 0.1.0
 */

/**
 * Plugin version
 */
export const VERSION = '0.1.0';

/**
 * Placeholder for main plugin export
 *
 * This will be implemented in future tasks.
 *
 * @returns Plugin metadata
 */
export function createMetricsPlugin() {
  return {
    name: '@blaizejs/plugin-metrics',
    version: VERSION,
  };
}

// Re-export everything (types, utilities, etc. will be added in future tasks)
export * from './types';
export type {
  MetricsPluginConfig,
  MetricsCollector,
  MetricsSnapshot,
  HttpMetrics,
  ProcessMetrics,
  CustomMetrics,
  HistogramStats,
  RouteMetrics,
} from './types';
