/**
 * Metrics Route Configuration Exports
 *
 * Provides ready-to-use route handlers for metrics endpoints:
 * - JSON snapshot endpoint
 * - Prometheus text endpoint
 * - HTML dashboard endpoint
 *
 * All routes throw BlaizeJS errors which are handled by the framework's error boundary.
 *
 * @module @blaizejs/plugin-metrics/routes
 */

import { InternalServerError, ServiceNotAvailableError, getCorrelationId } from 'blaizejs';

import { renderDashboard } from './dashboard';
import { exportPrometheus } from './prometheus-formatter';

import type { MetricsCollector } from './types';
import type { Context } from 'blaizejs';

/**
 * Get metrics collector from context or throw
 */
function getCollectorOrThrow(ctx: Context): MetricsCollector {
  const collector = ctx.services.metrics as MetricsCollector | undefined;

  if (!collector) {
    throw new ServiceNotAvailableError(
      'Metrics service unavailable',
      {
        service: 'metrics-collector',
        reason: 'dependency_down',
        suggestion: 'Ensure the metrics plugin is properly registered with the server',
      },
      getCorrelationId()
    );
  }

  return collector;
}

/**
 * Extract global labels from context state
 */
function getGlobalLabels(ctx: Context): Record<string, string> {
  const labels: Record<string, string> = {};

  if (ctx.state.serviceName) {
    labels.service = String(ctx.state.serviceName);
  }

  if (ctx.state.environment) {
    labels.environment = String(ctx.state.environment);
  }

  if (ctx.state.instanceId) {
    labels.instance = String(ctx.state.instanceId);
  }

  return labels;
}

/**
 * JSON metrics snapshot endpoint
 *
 * Returns the raw metrics snapshot as JSON. Useful for custom integrations
 * or debugging.
 *
 * @throws {ServiceNotAvailableError} When metrics collector is not available
 * @throws {InternalServerError} When snapshot generation fails
 *
 * @example
 * ```typescript
 * // In your route file: routes/metrics/index.ts
 * import { metricsJsonRoute } from '@blaizejs/plugin-metrics';
 *
 * export const GET = metricsJsonRoute;
 * ```
 */
export const metricsJsonRoute = {
  handler: async (ctx: Context) => {
    const collector = getCollectorOrThrow(ctx);

    try {
      const snapshot = collector.getSnapshot();
      // TODO: Return snapshot directly insteand of using json()
      ctx.response.json(snapshot);
    } catch (error) {
      throw new InternalServerError(
        'Error generating metrics snapshot',
        {
          originalError: error instanceof Error ? error.message : String(error),
          component: 'metrics-plugin',
          operation: 'getSnapshot',
        },
        getCorrelationId()
      );
    }
  },
};

/**
 * Prometheus metrics endpoint
 *
 * Returns metrics in Prometheus text exposition format v0.0.4.
 *
 * @throws {ServiceNotAvailableError} When metrics collector is not available
 * @throws {InternalServerError} When Prometheus export fails
 *
 * @example
 * ```typescript
 * // In your route file: routes/metrics/prometheus.ts
 * import { metricsPrometheusRoute } from '@blaizejs/plugin-metrics';
 *
 * export const GET = metricsPrometheusRoute;
 * ```
 */
export const metricsPrometheusRoute = {
  handler: async (ctx: Context) => {
    const collector = getCollectorOrThrow(ctx);

    try {
      const snapshot = collector.getSnapshot();
      const globalLabels = getGlobalLabels(ctx);
      const prometheusText = exportPrometheus(snapshot, globalLabels);

      ctx.response.type('text/plain; version=0.0.4; charset=utf-8').text(prometheusText);
    } catch (error) {
      throw new InternalServerError(
        'Error generating Prometheus metrics',
        {
          originalError: error instanceof Error ? error.message : String(error),
          component: 'metrics-plugin',
          operation: 'exportPrometheus',
        },
        getCorrelationId()
      );
    }
  },
};

/**
 * HTML dashboard endpoint
 *
 * Returns interactive HTML dashboard with metrics visualization.
 *
 * @throws {ServiceNotAvailableError} When metrics collector is not available
 * @throws {InternalServerError} When dashboard rendering fails
 *
 * @example
 * ```typescript
 * // In your route file: routes/metrics/dashboard.ts
 * import { metricsDashboardRoute } from '@blaizejs/plugin-metrics';
 *
 * export const GET = metricsDashboardRoute;
 * ```
 */
export const metricsDashboardRoute = {
  handler: async (ctx: Context) => {
    const collector = getCollectorOrThrow(ctx);

    try {
      const snapshot = collector.getSnapshot();
      const html = renderDashboard(snapshot);

      ctx.response.type('text/html; charset=utf-8').html(html);
    } catch (error) {
      throw new InternalServerError(
        'Error generating metrics dashboard',
        {
          originalError: error instanceof Error ? error.message : String(error),
          component: 'metrics-plugin',
          operation: 'renderDashboard',
        },
        getCorrelationId()
      );
    }
  },
};
