import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Blaize } from 'blaizejs';

import {
  createRedisClient,
  RedisCacheAdapter,
  RedisEventBusAdapter,
  RedisQueueAdapter,
} from '@blaizejs/adapter-redis';
import { createCompressionMiddleware } from '@blaizejs/middleware-compression';
import { createSecurityMiddleware } from '@blaizejs/middleware-security';
import { createCachePlugin } from '@blaizejs/plugin-cache';
import { createMetricsPlugin } from '@blaizejs/plugin-metrics';
import { createQueuePlugin } from '@blaizejs/plugin-queue';

import { REDIS_CONFIG } from './config';
import { playgroundEvents } from './events';
import {
  dataSyncJob,
  generateReportJob,
  processImageJob,
  sendEmailJob,
  sendNotificationJob,
  unreliableTaskJob,
  verifyEmailJob,
  dataMigrationJob,
  generateLongReportJob,
  processVideoJob,
} from './handlers';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create Redis clients for each adapter
Blaize.logger.info('Connecting to Redis', REDIS_CONFIG);
const redisClient = createRedisClient(REDIS_CONFIG);
Blaize.logger.info('✅ All Redis clients connected');

// ============================================================================
// Redis Adapters
// ============================================================================

// EventBus Adapter - Distributed event propagation
const eventBusAdapter = new RedisEventBusAdapter(redisClient, {
  channelPrefix: 'playground:events',
  logger: Blaize.logger,
});
await eventBusAdapter.connect();

// Cache Adapter - Distributed caching with TTL
const cacheAdapter = new RedisCacheAdapter(redisClient, {
  keyPrefix: 'cache:',
  logger: Blaize.logger,
});

// Queue Adapter - Distributed job queue with priority
const queueAdapter = new RedisQueueAdapter(redisClient, {
  keyPrefix: 'queue:',
  logger: Blaize.logger,
});

Blaize.logger.info('✅ All Redis adapters configured');

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
    redis: 'enabled',
  },
});

// ============================================================================
// Queue Plugin
// ============================================================================
const queuePlugin = createQueuePlugin({
  storage: queueAdapter,
  serverId: 'playground-server-1',
  // Define queues with different configurations and job definitions
  queues: {
    // Email queue - medium concurrency, fast jobs
    emails: {
      concurrency: 5,
      defaultTimeout: 30000, // 30 seconds
      defaultMaxRetries: 3,
      jobs: {
        send: sendEmailJob,
        verify: verifyEmailJob,
      },
    },

    // Reports queue - low concurrency, long-running jobs
    reports: {
      concurrency: 2,
      defaultTimeout: 120000, // 2 minutes
      defaultMaxRetries: 1, // Don't retry expensive operations
      jobs: {
        generate: generateReportJob,
      },
    },

    // Processing queue - medium concurrency, variable duration
    processing: {
      concurrency: 3,
      defaultTimeout: 60000, // 1 minute
      defaultMaxRetries: 2,
      jobs: {
        image: processImageJob,
        'data-sync': dataSyncJob,
      },
    },

    // Notifications queue - high concurrency, quick jobs
    notifications: {
      concurrency: 10,
      defaultTimeout: 10000, // 10 seconds
      defaultMaxRetries: 5,
      jobs: {
        send: sendNotificationJob,
      },
    },

    // Testing queue - for unreliable tasks
    testing: {
      concurrency: 2,
      defaultTimeout: 30000,
      defaultMaxRetries: 3,
      jobs: {
        unreliable: unreliableTaskJob,
      },
    },
    longRunning: {
      concurrency: 2,
      defaultTimeout: 60000,
      defaultMaxRetries: 1,
      jobs: {
        'long-report': generateLongReportJob,
        video: processVideoJob,
        migration: dataMigrationJob,
      },
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
const cachePlugin = createCachePlugin({
  // Use Redis adapter for distributed caching
  adapter: cacheAdapter,
});

// ============================================================================
// Security Middleware
// ============================================================================
const securityMiddleware = createSecurityMiddleware();

// ============================================================================
// Compression Middleware
// ============================================================================
const compressionMiddleware = createCompressionMiddleware();

// ============================================================================
// Create and Start the Server
// ============================================================================
export const server = Blaize.createServer({
  port: 7485,
  routesDir: path.resolve(__dirname, './routes'),
  http2: {
    enabled: true,
  },
  middleware: [
    compressionMiddleware,
    securityMiddleware,
    Blaize.Middleware.requestLoggerMiddleware({
      includeHeaders: true,
      headerWhitelist: ['content-type', 'authorization', 'cookie'],
    }),
  ],
  plugins: [metricsPlugin, queuePlugin, cachePlugin] as const,
  eventSchemas: playgroundEvents,
});

server.eventBus.setAdapter(eventBusAdapter);
Blaize.logger.info('✅ EventBus Redis adapter configured');

try {
  Blaize.logger.info(path.resolve(__dirname, './routes'));
  // Create the server instance

  // Start the server
  await server.listen();

  Blaize.logger.info('🚀 Playground server ready!');
  Blaize.logger.info('');
  Blaize.logger.info('📖 Try these demos:');
  Blaize.logger.info('   Dashboard: GET  http://localhost:7485');
  Blaize.logger.info('   Cache:     GET  http://localhost:7485/cache/demo');
  Blaize.logger.info('   Queue:     GET  http://localhost:7485/queue/demo');
  Blaize.logger.info('   Events:    POST http://localhost:7485/events/trigger');
  Blaize.logger.info('   SSE Cache: GET  http://localhost:7485/cache/events');
  Blaize.logger.info('   SSE Queue: GET  http://localhost:7485/queue/stream?jobId=<id>');
  Blaize.logger.info('   SSE User:  GET  http://localhost:7485/user/:userId/notifications');
  Blaize.logger.info('   Compress:  GET  http://localhost:7485/compression/json');
  Blaize.logger.info('   Stream:    GET  http://localhost:7485/compression/stream');
  Blaize.logger.info('   Info:      GET  http://localhost:7485/compression/info');
  Blaize.logger.info('');
  Blaize.logger.info('🔄 Events published from route handlers');
  Blaize.logger.info('📡 SSE routes subscribe and stream events to clients');
  Blaize.logger.info('');

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
