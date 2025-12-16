import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Blaize } from 'blaizejs';

import { createSecurityMiddleware } from '@blaizejs/middleware-security';
import { createCachePlugin } from '@blaizejs/plugin-cache';
import { createMetricsPlugin } from '@blaizejs/plugin-metrics';
import { createQueuePlugin } from '@blaizejs/plugin-queue';

import {
  dataSyncHandler,
  generateReportHandler,
  processImageHandler,
  sendEmailHandler,
  sendNotificationHandler,
  unreliableTaskHandler,
  verifyEmailHandler,
  dataMigrationHandler,
  generateLongReportHandler,
  processVideoHandler,
} from './handlers';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===========================================================================
// Metrics Plugin
// ===========================================================================
const metricsPlugin = createMetricsPlugin({
  enabled: true,
  excludePaths: ['/health', '/favicon.ico'], // Don't track health checks
  histogramLimit: 1000,
  collectionInterval: 60000, // Report every 60 seconds
  maxCardinality: 10,
  onCardinalityLimit: 'warn',
  labels: {
    service: 'playground-app',
    environment: process.env.NODE_ENV || 'development',
  },
});

// ============================================================================
// Queue Plugin
// ============================================================================
const queuePlugin = createQueuePlugin({
  // Define queues with different configurations
  queues: {
    // Email queue - medium concurrency, fast jobs
    emails: {
      concurrency: 5,
      defaultTimeout: 30000, // 30 seconds
      defaultMaxRetries: 3,
    },

    // Reports queue - low concurrency, long-running jobs
    reports: {
      concurrency: 2,
      defaultTimeout: 120000, // 2 minutes
      defaultMaxRetries: 1, // Don't retry expensive operations
    },

    // Processing queue - medium concurrency, variable duration
    processing: {
      concurrency: 3,
      defaultTimeout: 60000, // 1 minute
      defaultMaxRetries: 2,
    },

    // Notifications queue - high concurrency, quick jobs
    notifications: {
      concurrency: 10,
      defaultTimeout: 10000, // 10 seconds
      defaultMaxRetries: 5,
    },

    // Testing queue - for unreliable tasks
    testing: {
      concurrency: 2,
      defaultTimeout: 30000,
      defaultMaxRetries: 3,
    },
    longRunning: {
      concurrency: 2,
      defaultTimeout: 60000,
      defaultMaxRetries: 1,
    },
  },

  // Register handlers declaratively
  handlers: {
    emails: {
      send: sendEmailHandler,
      verify: verifyEmailHandler,
    },
    reports: {
      generate: generateReportHandler,
    },
    processing: {
      image: processImageHandler,
      'data-sync': dataSyncHandler,
    },
    notifications: {
      send: sendNotificationHandler,
    },
    testing: {
      unreliable: unreliableTaskHandler,
    },
    longRunning: {
      'long-report': generateLongReportHandler,
      video: processVideoHandler,
      migration: dataMigrationHandler,
    },
  },

  // Global defaults
  defaultConcurrency: 5,
  defaultTimeout: 30000,
  defaultMaxRetries: 3,
});

// ============================================================================
// Cache Plugin
// ============================================================================
const cachePlugin = createCachePlugin({});

// ============================================================================
// Security Middleware
// ============================================================================
const securityMiddleware = createSecurityMiddleware();

export const server = Blaize.createServer({
  port: 7485,
  routesDir: path.resolve(__dirname, './routes'),
  http2: {
    enabled: true,
  },
  middleware: [
    securityMiddleware,
    Blaize.Middleware.requestLoggerMiddleware({
      includeHeaders: true,
      headerWhitelist: ['content-type', 'authorization', 'cookie'],
    }),
  ],
  plugins: [metricsPlugin, queuePlugin, cachePlugin],
});

try {
  Blaize.logger.info(path.resolve(__dirname, './routes'));
  // Create the server instance

  // Start the server
  server.listen();

  // Handle process termination signals
  ['SIGINT', 'SIGTERM', 'SIGQUIT'].forEach(signal => {
    process.on(signal, async () => {
      Blaize.logger.info(`🔥 Received ${signal}, shutting down server...`);
      try {
        await server.close();
        Blaize.logger.info('🚪 Server shutdown completed, exiting.');
        process.exit(0);
      } catch (error) {
        Blaize.logger.error('❌ Error during shutdown:', { error });
        process.exit(1);
      }
    });
  });
} catch (err) {
  Blaize.logger.error('❌ Error:', { error: err });
}
