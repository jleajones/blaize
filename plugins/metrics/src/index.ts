/**
 * BlaizeJS Metrics Plugin
 *
 * Official metrics collection plugin for BlaizeJS applications.
 * Provides automatic HTTP request tracking, process health monitoring,
 * and custom application metrics.
 *
 * @module @blaizejs/plugin-metrics
 */

// Re-export types for convenience
export type {
  MetricsPluginConfig,
  MetricsCollector,
  MetricsSnapshot,
  MetricsPluginState,
  MetricsPluginServices,
} from './types';

// Re-export route handlers
export { metricsJsonRoute, metricsPrometheusRoute, metricsDashboardRoute } from './routes';

// Re-export formatters
export { exportPrometheus } from './prometheus-formatter';
export { renderDashboard, formatUptime, formatBytes } from './dashboard';
export { createMetricsPlugin, getMetricsCollector } from './plugin';
