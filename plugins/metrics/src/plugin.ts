/**
 * BlaizeJS Metrics Plugin
 *
 * Official metrics collection plugin for BlaizeJS applications.
 * Provides automatic HTTP request tracking, process health monitoring,
 * and custom application metrics.
 *
 * @module @blaizejs/plugin-metrics
 */

import { createMiddleware, createPlugin } from 'blaizejs';

import config from '../package.json';
import { MetricsCollectorImpl } from './collector';

import type {
  MetricsPluginConfig,
  MetricsCollector,
  MetricsPluginState,
  MetricsPluginServices,
} from './types';
import type { Server } from 'blaizejs';

// ========================================================================
// Service Factory
// ========================================================================
let _metricsCollector: MetricsCollector | null = null;

export function getMetricsCollector(): MetricsCollector {
  if (!_metricsCollector) {
    throw new Error(
      'Metrics collector not initialized. ' +
        'Make sure you have registered the metrics plugin with createMetricsPlugin().'
    );
  }
  return _metricsCollector;
}

function _initializeMetricsCollector(collector: MetricsCollector) {
  _metricsCollector = collector;
}

function _terminateMetricsCollector() {
  _metricsCollector = null;
}

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

export const createMetricsPlugin = createPlugin<
  MetricsPluginConfig,
  MetricsPluginState,
  MetricsPluginServices
>({
  name: config.name,
  version: config.version,
  defaultConfig: DEFAULT_CONFIG,
  setup: ({ config, logger }) => {
    let reportInterval: NodeJS.Timeout | null = null;

    // Return the plugin object directly (not using createPlugin)
    return {
      register: async (server: Server<any, any>) => {
        // Skip if disabled
        if (!config.enabled) {
          return;
        }

        // 2. Add typed middleware - provides access to the singleton
        server.use(
          // eslint-disable-next-line @typescript-eslint/no-empty-object-type
          createMiddleware<{}, MetricsPluginServices>({
            name: 'metrics',
            handler: async ({ ctx, next }) => {
              // ✅ Use factory to get collector
              const collector = getMetricsCollector();
              // Inject collector into context (reference to singleton)
              ctx.services.metrics = collector;

              // Check if path should be excluded
              const path = ctx.request?.path || '/';
              if (config.excludePaths && shouldExcludePath(path, config.excludePaths)) {
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
                    logger.error('Error recording:', { metricsError });
                  }
                }
              }
            },
          })
        );
      },

      // 3. Initialize resources
      initialize: async () => {
        if (!config.enabled) {
          logger.info('Disabled by configuration');
          return;
        }

        // Create collector instance
        const collector = new MetricsCollectorImpl({
          histogramLimit: config.histogramLimit,
          collectionInterval: config.collectionInterval,
          maxCardinality: config.maxCardinality,
          onCardinalityLimit: config.onCardinalityLimit,
          logger,
        });

        // ✅ Initialize factory
        _initializeMetricsCollector(collector);

        collector.startCollection();

        logger.info('Initialized and collecting metrics');
      },

      // 4. Start reporting when server starts
      onServerStart: async () => {
        if (!config.enabled) return;

        // ✅ Get collector from factory
        const collector = getMetricsCollector();

        if (config.reporter) {
          reportInterval = setInterval(() => {
            const snapshot = collector.getSnapshot();
            Promise.resolve(config.reporter!(snapshot)).catch(error => {
              logger.error('Reporter error:', error);
            });
          }, config.collectionInterval);

          if (reportInterval.unref) {
            reportInterval.unref();
          }
        }

        const consoleInterval = setInterval(() => {
          const snapshot = collector.getSnapshot();
          logger.info('Snapshot:', {
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
        }, config.collectionInterval);

        if (consoleInterval.unref) {
          consoleInterval.unref();
        }

        if (!reportInterval) {
          reportInterval = consoleInterval;
        }

        logger.info('Server started, metrics collection active');
      },

      // 5. Stop reporting when server stops
      onServerStop: async () => {
        if (!config.enabled) return;

        // ✅ Get collector from factory
        const collector = getMetricsCollector();

        if (reportInterval) {
          clearInterval(reportInterval);
          reportInterval = null;
        }

        if (config.reporter) {
          try {
            const snapshot = collector.getSnapshot();
            await Promise.resolve(config.reporter(snapshot));
          } catch (error) {
            logger.error('Final report error:', { error });
          }
        }

        const snapshot = collector.getSnapshot();
        logger.info('Final snapshot:', {
          totalRequests: snapshot.http.totalRequests,
          uptime: `${Math.floor(snapshot.process.uptime)}s`,
        });
      },

      // 6. Clean up resources
      terminate: async () => {
        if (!config.enabled) return;

        // ✅ Get collector from factory
        const collector = getMetricsCollector();

        collector.stopCollection();

        if (reportInterval) {
          clearInterval(reportInterval);
          reportInterval = null;
        }

        // ✅ Clear factory
        _terminateMetricsCollector();

        logger.info('Terminated');
      },
    };
  },
});
