/**
 * BlaizeJS Metrics Plugin
 *
 * Official metrics collection plugin for BlaizeJS applications.
 * Provides automatic HTTP request tracking, process health monitoring,
 * and custom application metrics.
 *
 * @module @blaizejs/plugin-metrics
 */

import { createMiddleware } from 'blaizejs';

import { MetricsCollectorImpl } from './collector';

import type {
  MetricsPluginConfig,
  MetricsCollector,
  MetricsPluginState,
  MetricsPluginServices,
} from './types';
import type { Plugin, Server, Context } from 'blaizejs';

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

/**
 * Default plugin configuration
 */
const DEFAULT_CONFIG: Required<Omit<MetricsPluginConfig, 'reporter'>> & {
  reporter: ((snapshot: any) => void | Promise<void>) | undefined;
} = {
  enabled: true,
  excludePaths: [],
  histogramLimit: 1000,
  collectionInterval: 60000, // 60 seconds
  labels: {},
  logToConsole: false,
  reporter: undefined,
  maxCardinality: 10000, // ✅ NEW
  onCardinalityLimit: 'drop', // ✅ NEW
};

/**
 * Check if a path should be excluded from metrics
 */
function shouldExcludePath(path: string, excludePaths: string[]): boolean {
  for (const pattern of excludePaths) {
    if (pattern.endsWith('/*')) {
      const prefix = pattern.slice(0, -2);
      if (path === prefix || path.startsWith(prefix + '/')) {
        return true;
      }
    } else if (path === pattern) {
      return true;
    }
  }
  return false;
}

/**
 * Extract HTTP status code from error
 */
function getErrorStatusCode(error: unknown): number {
  if (typeof error === 'object' && error !== null) {
    if ('status' in error && typeof error.status === 'number') {
      return error.status;
    }
    if ('statusCode' in error && typeof error.statusCode === 'number') {
      return error.statusCode;
    }
    if ('code' in error && typeof error.code === 'number') {
      return error.code;
    }
  }
  return 500;
}

/**
 * Create metrics plugin for BlaizeJS
 *
 * @example Basic usage
 * ```typescript
 * import { createMetricsPlugin } from '@blaizejs/plugin-metrics';
 *
 * const metricsPlugin = createMetricsPlugin({
 *   enabled: true,
 *   excludePaths: ['/health', '/ready'],
 * });
 *
 * const server = createServer({
 *   plugins: [metricsPlugin],
 * });
 * ```
 */
export function createMetricsPlugin(
  config: MetricsPluginConfig = {}
): Plugin<MetricsPluginState, MetricsPluginServices> {
  // Merge with defaults
  const finalConfig = {
    ...DEFAULT_CONFIG,
    ...config,
    labels: { ...DEFAULT_CONFIG.labels, ...config.labels },
    excludePaths: [...DEFAULT_CONFIG.excludePaths, ...(config.excludePaths || [])],
  };

  // 1. Declare resources in closure (singleton pattern)
  let collector: MetricsCollector;
  let reportInterval: NodeJS.Timeout | null = null;

  // Return the plugin object directly (not using createPlugin)
  return {
    name: '@blaizejs/plugin-metrics',
    version: '1.0.0',

    register: async (server: Server<any, any>) => {
      // Skip if disabled
      if (!finalConfig.enabled) {
        return;
      }

      // 2. Add typed middleware - provides access to the singleton
      server.use(
        // eslint-disable-next-line @typescript-eslint/no-empty-object-type
        createMiddleware<{}, { metrics: MetricsCollector }>({
          name: 'metrics',
          handler: async (ctx: Context, next) => {
            // Inject collector into context (reference to singleton)
            ctx.services.metrics = collector;

            // Check if path should be excluded
            const path = ctx.request?.path || '/';
            if (shouldExcludePath(path, finalConfig.excludePaths)) {
              await next();
              return;
            }

            // Start tracking request
            collector.startHttpRequest();

            // Record start time
            const startTime = performance.now();
            let statusCode = 200;

            try {
              await next();
              statusCode = ctx.response.raw?.statusCode || 200;
            } catch (error) {
              statusCode = getErrorStatusCode(error);
              throw error;
            } finally {
              try {
                const duration = performance.now() - startTime;
                const method = ctx.request?.method || 'UNKNOWN';
                collector.recordHttpRequest(method, path, statusCode, duration);
              } catch (metricsError) {
                if (process.env.NODE_ENV !== 'production') {
                  console.error('[Metrics] Error recording:', metricsError);
                }
              }
            }
          },
        })
      );
    },

    // 3. Initialize resources
    initialize: async () => {
      if (!finalConfig.enabled) {
        if (finalConfig.logToConsole) {
          console.log('[Metrics Plugin] Disabled by configuration');
        }
        return;
      }

      collector = new MetricsCollectorImpl({
        histogramLimit: finalConfig.histogramLimit,
        collectionInterval: finalConfig.collectionInterval,
        maxCardinality: finalConfig.maxCardinality,
        onCardinalityLimit: finalConfig.onCardinalityLimit,
      });

      collector.startCollection();

      if (finalConfig.logToConsole) {
        console.log('[Metrics Plugin] Initialized and collecting metrics');
      }
    },

    // 4. Start reporting when server starts
    onServerStart: async () => {
      if (!finalConfig.enabled || !collector) return;

      if (finalConfig.reporter) {
        reportInterval = setInterval(() => {
          const snapshot = collector.getSnapshot();
          Promise.resolve(finalConfig.reporter!(snapshot)).catch(error => {
            console.error('[Metrics Plugin] Reporter error:', error);
          });
        }, finalConfig.collectionInterval);

        if (reportInterval.unref) {
          reportInterval.unref();
        }
      }

      if (finalConfig.logToConsole) {
        const consoleInterval = setInterval(() => {
          const snapshot = collector.getSnapshot();
          console.log('[Metrics Plugin] Snapshot:', {
            timestamp: new Date(snapshot.timestamp).toISOString(),
            http: {
              totalRequests: snapshot.http.totalRequests,
              activeRequests: snapshot.http.activeRequests,
              requestsPerSecond: snapshot.http.requestsPerSecond.toFixed(2),
            },
            process: {
              uptime: `${Math.floor(snapshot.process.uptime)}s`,
              heapUsed: `${Math.floor(snapshot.process.memoryUsage.heapUsed / 1024 / 1024)}MB`,
            },
          });
        }, finalConfig.collectionInterval);

        if (consoleInterval.unref) {
          consoleInterval.unref();
        }

        if (!reportInterval) {
          reportInterval = consoleInterval;
        }

        console.log('[Metrics Plugin] Server started, metrics collection active');
      }
    },

    // 5. Stop reporting when server stops
    onServerStop: async () => {
      if (!finalConfig.enabled || !collector) return;

      if (reportInterval) {
        clearInterval(reportInterval);
        reportInterval = null;
      }

      if (finalConfig.reporter) {
        try {
          const snapshot = collector.getSnapshot();
          await Promise.resolve(finalConfig.reporter(snapshot));
        } catch (error) {
          console.error('[Metrics Plugin] Final report error:', error);
        }
      }

      if (finalConfig.logToConsole) {
        const snapshot = collector.getSnapshot();
        console.log('[Metrics Plugin] Final snapshot:', {
          totalRequests: snapshot.http.totalRequests,
          uptime: `${Math.floor(snapshot.process.uptime)}s`,
        });
      }
    },

    // 6. Clean up resources
    terminate: async () => {
      if (!finalConfig.enabled || !collector) return;

      collector.stopCollection();

      if (reportInterval) {
        clearInterval(reportInterval);
        reportInterval = null;
      }

      if (finalConfig.logToConsole) {
        console.log('[Metrics Plugin] Terminated');
      }
    },
  };
}
