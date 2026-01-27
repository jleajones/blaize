/**
 * Core Infrastructure Files for Advanced Template
 *
 * Contains:
 * - config.ts - Redis configuration
 * - events.ts - Event type definitions
 * - handlers/* - Job handler implementations
 * - app-router.ts - Route factory
 * - index.ts - Server setup with plugins
 * - app-type.ts - Route registry
 */

import type { TemplateFile } from '@/types';

export const coreFiles: TemplateFile[] = [
  // ==========================================================================
  // 1. CONFIG.TS - Redis Configuration
  // ==========================================================================
  {
    path: 'src/config.ts',
    content: `export const REDIS_CONFIG = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  db: parseInt(process.env.REDIS_DB ?? '0', 10),
  keyPrefix: 'playground:',
};
`,
  },

  // ==========================================================================
  // 2. EVENTS.TS - Event Schemas
  // ==========================================================================
  {
    path: 'src/events.ts',
    content: `/**
 * Event Schemas
 *
 * Defines all event types for the application:
 * - User lifecycle events
 * - Order processing events
 * - System events
 * - Notification events
 * - Plugin events (cache, queue) imported from plugins
 */

import { z } from 'zod';

import { cacheEventBusSchemas } from '@blaizejs/plugin-cache';
import { queueEventBusSchemas } from '@blaizejs/plugin-queue';

export const playgroundEvents = {
  // ==========================================================================
  // User Events
  // ==========================================================================
  'user:created': z.object({
    userId: z.string(),
    email: z.string().email(),
    timestamp: z.number(),
    metadata: z.record(z.unknown()).optional(),
  }),

  'user:login': z.object({
    userId: z.string(),
    ip: z.string().optional(),
    timestamp: z.number().optional(),
  }),

  'user:logout': z.object({
    userId: z.string(),
    sessionDuration: z.number().optional(),
  }),

  // ==========================================================================
  // Order Events
  // ==========================================================================
  'order:placed': z.object({
    orderId: z.string(),
    userId: z.string(),
    total: z.number(),
    items: z.number(),
    timestamp: z.number().optional(),
  }),

  'order:shipped': z.object({
    orderId: z.string(),
    trackingNumber: z.string(),
    carrier: z.string().optional(),
  }),

  'order:delivered': z.object({
    orderId: z.string(),
    deliveredAt: z.number(),
    signedBy: z.string().optional(),
  }),

  // ==========================================================================
  // Cache Events (from plugin)
  // ==========================================================================
  ...cacheEventBusSchemas,

  // ==========================================================================
  // Queue Events (from plugin)
  // ==========================================================================
  ...queueEventBusSchemas,

  // ==========================================================================
  // Report Events
  // ==========================================================================
  'report:requested': z.object({
    reportId: z.string(),
    reportType: z.enum(['daily', 'weekly', 'monthly', 'annual', 'custom']),
    requestedBy: z.string(),
  }),

  'report:generated': z.object({
    reportId: z.string(),
    reportType: z.string(),
    generatedAt: z.number(),
    result: z.unknown(),
    durationMs: z.number().optional(),
  }),

  // ==========================================================================
  // System Events
  // ==========================================================================
  'system:alert': z.object({
    type: z.enum(['info', 'warning', 'error', 'critical']),
    message: z.string(),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    component: z.string().optional(),
    timestamp: z.number().optional(),
  }),

  'system:maintenance': z.object({
    action: z.enum(['start', 'end', 'scheduled']),
    scheduledAt: z.number().optional(),
    duration: z.number().optional(),
    affectedServices: z.array(z.string()).optional(),
  }),

  'system:health': z.object({
    status: z.enum(['healthy', 'degraded', 'unhealthy']),
    services: z.record(
      z.object({
        status: z.enum(['up', 'down', 'degraded']),
        latencyMs: z.number().optional(),
      })
    ),
  }),

  // ==========================================================================
  // Notification Events
  // ==========================================================================
  'notification:sent': z.object({
    notificationId: z.string(),
    userId: z.string(),
    type: z.enum(['email', 'sms', 'push', 'in-app']),
    delivered: z.boolean(),
  }),

  'notification:failed': z.object({
    notificationId: z.string(),
    userId: z.string(),
    type: z.string(),
    error: z.string(),
    willRetry: z.boolean(),
  }),
} as const;

export type PlaygroundEvents = typeof playgroundEvents;
`,
  },

  // ==========================================================================
  // 3. HANDLERS/UTILITIES.TS - Helper Functions
  // ==========================================================================
  {
    path: 'src/handlers/utilities.ts',
    content: `/**
 * Utility functions for job handlers
 */

/**
 * Sleep helper for simulating async work
 */
export const sleep = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));
`,
  },

  // ==========================================================================
  // 4. HANDLERS/EMAIL.TS - Email Handlers
  // ==========================================================================
  {
    path: 'src/handlers/email.ts',
    content: `import type { JobContext } from '@blaizejs/plugin-queue';

import { sleep } from './utilities';

// ============================================================================
// Email Queue Handlers
// ============================================================================

interface SendEmailData {
  to: string;
  subject: string;
  body: string;
}

/**
 * Send email handler - Medium duration (2-3 seconds)
 * Simulates sending an email with progress updates
 */
export const sendEmailHandler = async (
  ctx: JobContext<SendEmailData>
): Promise<{ messageId: string; sentAt: number }> => {
  const { logger, progress, signal } = ctx;
  const { to, subject } = ctx.data;

  logger.info('Starting email send', { to, subject });

  // Step 1: Validate
  await progress(10, 'Validating recipient');
  await sleep(300);

  if (signal.aborted) throw new Error('Job cancelled');

  // Step 2: Prepare
  await progress(30, 'Preparing email content');
  await sleep(500);

  if (signal.aborted) throw new Error('Job cancelled');

  // Step 3: Connect to SMTP
  await progress(50, 'Connecting to mail server');
  await sleep(400);

  if (signal.aborted) throw new Error('Job cancelled');

  // Step 4: Send
  await progress(80, 'Sending email');
  await sleep(600);

  // Step 5: Verify
  await progress(100, 'Email sent successfully');
  const messageId = \`msg-\${Date.now()}-\${Math.random().toString(36).slice(2, 8)}\`;

  logger.info('Email sent', { messageId, to });

  return { messageId, sentAt: Date.now() };
};

interface VerifyEmailData {
  email: string;
}

/**
 * Verify email handler - Short duration (0.5-1 second)
 */
export const verifyEmailHandler = async (
  ctx: JobContext<VerifyEmailData>
): Promise<{ email: string; isValid: boolean; provider: string }> => {
  const { email } = ctx.data;

  ctx.logger.info('Verifying email', { email });

  await ctx.progress(30, 'Checking format');
  await sleep(200);

  await ctx.progress(60, 'Looking up MX records');
  await sleep(300);

  await ctx.progress(100, 'Verification complete');

  // Simulate validation
  const isValid = email.includes('@') && email.includes('.');
  const provider = email.split('@')[1] || 'unknown';

  return { email, isValid, provider };
};
`,
  },

  // ==========================================================================
  // 5. HANDLERS/PROCESSING.TS - Processing Handlers
  // ==========================================================================
  {
    path: 'src/handlers/processing.ts',
    content: `import type { JobContext } from '@blaizejs/plugin-queue';

import { sleep } from './utilities';

// ============================================================================
// Processing Queue Handlers
// ============================================================================

interface ProcessImageData {
  imageId: string;
  operations: string[];
}

/**
 * Process image handler - Medium duration (5 seconds)
 */
export const processImageHandler = async (
  ctx: JobContext<ProcessImageData>
): Promise<{ imageId: string; processedUrl: string }> => {
  const { imageId, operations } = ctx.data;

  ctx.logger.info('Starting image processing', { imageId, operations });

  await ctx.progress(20, 'Loading image');
  await sleep(1000);

  await ctx.progress(40, 'Applying filters');
  await sleep(1500);

  await ctx.progress(60, 'Resizing');
  await sleep(1000);

  await ctx.progress(80, 'Optimizing');
  await sleep(1000);

  await ctx.progress(100, 'Processing complete');
  await sleep(500);

  return {
    imageId,
    processedUrl: \`https://cdn.example.com/images/\${imageId}-processed.jpg\`,
  };
};

interface DataSyncData {
  syncId: string;
  recordCount: number;
}

/**
 * Data sync handler - Longer duration (8 seconds)
 */
export const dataSyncHandler = async (
  ctx: JobContext<DataSyncData>
): Promise<{ syncId: string; synced: number }> => {
  const { syncId, recordCount } = ctx.data;

  ctx.logger.info('Starting data sync', { syncId, recordCount });

  await ctx.progress(10, 'Connecting to source');
  await sleep(1000);

  await ctx.progress(30, 'Fetching records');
  await sleep(2000);

  await ctx.progress(60, 'Transforming data');
  await sleep(2000);

  await ctx.progress(80, 'Writing to destination');
  await sleep(2000);

  await ctx.progress(100, 'Sync complete');
  await sleep(1000);

  return { syncId, synced: recordCount };
};
`,
  },

  // ==========================================================================
  // 6. HANDLERS/REPORTS.TS - Report Handler
  // ==========================================================================
  {
    path: 'src/handlers/reports.ts',
    content: `import type { JobContext } from '@blaizejs/plugin-queue';

import { sleep } from './utilities';

// ============================================================================
// Report Queue Handlers
// ============================================================================

interface GenerateReportData {
  reportId: string;
  reportType: string;
  dateRange: {
    start: string;
    end: string;
  };
}

/**
 * Generate report handler - Long duration (10 seconds)
 * Demonstrates detailed progress reporting
 */
export const generateReportHandler = async (
  ctx: JobContext<GenerateReportData>
): Promise<{ reportId: string; url: string }> => {
  const { reportId, reportType } = ctx.data;

  ctx.logger.info('Starting report generation', { reportId, reportType });

  // Phase 1: Data collection
  await ctx.progress(10, 'Querying database');
  await sleep(1500);

  await ctx.progress(20, 'Aggregating data');
  await sleep(1500);

  // Phase 2: Processing
  await ctx.progress(40, 'Calculating metrics');
  await sleep(2000);

  await ctx.progress(60, 'Generating charts');
  await sleep(2000);

  // Phase 3: Rendering
  await ctx.progress(80, 'Formatting report');
  await sleep(1500);

  await ctx.progress(90, 'Creating PDF');
  await sleep(1500);

  await ctx.progress(100, 'Report complete');

  return {
    reportId,
    url: \`https://reports.example.com/\${reportId}.pdf\`,
  };
};
`,
  },

  // ==========================================================================
  // 7. HANDLERS/NOTIFICATIONS.TS - Notification Handler
  // ==========================================================================
  {
    path: 'src/handlers/notifications.ts',
    content: `import type { JobContext } from '@blaizejs/plugin-queue';

import { sleep } from './utilities';

// ============================================================================
// Notification Queue Handlers
// ============================================================================

interface SendNotificationData {
  userId: string;
  message: string;
  type: 'email' | 'sms' | 'push';
}

/**
 * Send notification handler - Fast (1 second)
 */
export const sendNotificationHandler = async (
  ctx: JobContext<SendNotificationData>
): Promise<{ notificationId: string; delivered: boolean }> => {
  const { userId, message, type } = ctx.data;

  ctx.logger.info('Sending notification', { userId, type });

  await ctx.progress(50, \`Sending \${type} notification\`);
  await sleep(500);

  await ctx.progress(100, 'Notification sent');
  await sleep(500);

  return {
    notificationId: \`notif-\${Date.now()}\`,
    delivered: true,
  };
};
`,
  },

  // ==========================================================================
  // 8. HANDLERS/LONG-RUNNING.TS - Long Running Handlers
  // ==========================================================================
  {
    path: 'src/handlers/long-running.ts',
    content: `import type { JobContext } from '@blaizejs/plugin-queue';

import { sleep } from './utilities';

// ============================================================================
// Long-Running Queue Handlers
// ============================================================================

interface GenerateLongReportData {
  reportId: string;
  complexity: 'simple' | 'medium' | 'complex';
}

/**
 * Generate long report - 20 seconds with detailed progress
 */
export const generateLongReportHandler = async (
  ctx: JobContext<GenerateLongReportData>
): Promise<{ reportId: string; pages: number; duration: number }> => {
  const startTime = Date.now();
  const { reportId } = ctx.data;

  ctx.logger.info('Starting long report generation', { reportId });

  // Phase 1: Data gathering (5 seconds)
  await ctx.progress(5, 'Connecting to databases');
  await sleep(1000);

  await ctx.progress(10, 'Querying historical data');
  await sleep(2000);

  await ctx.progress(20, 'Loading reference data');
  await sleep(2000);

  // Phase 2: Analysis (5 seconds)
  await ctx.progress(30, 'Running statistical analysis');
  await sleep(2000);

  await ctx.progress(45, 'Computing trends');
  await sleep(2000);

  await ctx.progress(55, 'Generating insights');
  await sleep(1000);

  // Phase 3: Chart generation (5 seconds)
  await ctx.progress(60, 'Creating charts');
  await sleep(2000);

  await ctx.progress(65, 'Rendering graphs');
  await sleep(2000);

  await ctx.progress(70, 'Finalizing charts');
  await sleep(1000);

  // Phase 4: PDF rendering (5 seconds)
  await ctx.progress(75, 'Rendering pages 1-3');
  await sleep(1000);

  await ctx.progress(80, 'Rendering pages 4-6');
  await sleep(1000);

  await ctx.progress(85, 'Rendering pages 7-9');
  await sleep(1000);

  await ctx.progress(90, 'Rendering page 10');
  await sleep(1000);

  await ctx.progress(95, 'Finalizing PDF');
  await sleep(1000);

  await ctx.progress(100, 'Report complete');

  const duration = Date.now() - startTime;

  return { reportId, pages: 10, duration };
};

interface VideoProcessingData {
  videoId: string;
  resolution: '720p' | '1080p' | '4k';
  duration: number;
}

/**
 * Process video - 30 seconds with very detailed progress
 */
export const processVideoHandler = async (
  ctx: JobContext<VideoProcessingData>
): Promise<{ videoId: string; outputUrl: string; processingTime: number }> => {
  const startTime = Date.now();
  const { videoId, resolution } = ctx.data;

  ctx.logger.info('Starting video processing', { videoId, resolution });

  // Phase 1: Upload & validation (3 seconds)
  await ctx.progress(2, 'Uploading video file');
  await sleep(1000);

  await ctx.progress(5, 'Validating video format');
  await sleep(1000);

  await ctx.progress(8, 'Checking video codec');
  await sleep(1000);

  // Phase 2: Transcoding (15 seconds)
  await ctx.progress(10, \`Transcoding to \${resolution} - 0%\`);
  await sleep(1500);

  await ctx.progress(20, \`Transcoding to \${resolution} - 10%\`);
  await sleep(1500);

  await ctx.progress(30, \`Transcoding to \${resolution} - 25%\`);
  await sleep(1500);

  await ctx.progress(40, \`Transcoding to \${resolution} - 40%\`);
  await sleep(1500);

  await ctx.progress(50, \`Transcoding to \${resolution} - 55%\`);
  await sleep(1500);

  await ctx.progress(60, \`Transcoding to \${resolution} - 70%\`);
  await sleep(1500);

  await ctx.progress(70, \`Transcoding to \${resolution} - 85%\`);
  await sleep(1500);

  await ctx.progress(75, \`Transcoding to \${resolution} - 95%\`);
  await sleep(1500);

  await ctx.progress(80, 'Transcoding complete');
  await sleep(1500);

  // Phase 3: Thumbnail generation (5 seconds)
  await ctx.progress(82, 'Generating thumbnails');
  await sleep(2000);

  await ctx.progress(85, 'Creating preview sprite');
  await sleep(3000);

  // Phase 4: Upload to CDN (7 seconds)
  await ctx.progress(90, 'Uploading to CDN - 0%');
  await sleep(2000);

  await ctx.progress(95, 'Uploading to CDN - 50%');
  await sleep(2000);

  await ctx.progress(98, 'Uploading to CDN - 90%');
  await sleep(2000);

  await ctx.progress(100, 'Video processing complete');
  await sleep(1000);

  const processingTime = Date.now() - startTime;
  const outputUrl = \`https://cdn.example.com/videos/\${videoId}-\${resolution}.mp4\`;

  return { videoId, outputUrl, processingTime };
};

interface DataMigrationData {
  migrationId: string;
  tables: string[];
}

/**
 * Data migration - Very long (40 seconds)
 */
export const dataMigrationHandler = async (
  ctx: JobContext<DataMigrationData>
): Promise<{ migrationId: string; recordsMigrated: number }> => {
  const { migrationId, tables } = ctx.data;

  ctx.logger.info('Starting data migration', { migrationId, tables });

  let progress = 0;
  const increment = 100 / (tables.length * 4);

  for (const table of tables) {
    await ctx.progress(progress, \`Backing up \${table}\`);
    await sleep(2000);
    progress += increment;

    await ctx.progress(progress, \`Migrating \${table}\`);
    await sleep(4000);
    progress += increment;

    await ctx.progress(progress, \`Validating \${table}\`);
    await sleep(2000);
    progress += increment;

    await ctx.progress(progress, \`Indexing \${table}\`);
    await sleep(2000);
    progress += increment;
  }

  await ctx.progress(100, 'Migration complete');

  return { migrationId, recordsMigrated: tables.length * 1000 };
};
`,
  },

  // ==========================================================================
  // 9. HANDLERS/INDEX.TS - Handler Exports
  // ==========================================================================
  {
    path: 'src/handlers/index.ts',
    content: `/**
 * Job Handlers for Queue Plugin
 *
 * These handlers demonstrate different job types with varying durations
 * to allow testing SSE monitoring, dashboard, and status endpoints.
 */
import type { JobContext } from '@blaizejs/plugin-queue';

import { sleep } from './utilities';

export { sendEmailHandler, verifyEmailHandler } from './email';
export { sendNotificationHandler } from './notifications';
export { processImageHandler, dataSyncHandler } from './processing';
export { generateReportHandler } from './reports';
export {
  dataMigrationHandler,
  generateLongReportHandler,
  processVideoHandler,
} from './long-running';

// ============================================================================
// Failing Job Handler (for testing error handling)
// ============================================================================

interface UnreliableTaskData {
  taskId: string;
  failureRate: number; // 0-1
}

/**
 * Unreliable task handler - May fail randomly (for testing retries)
 */
export const unreliableTaskHandler = async (
  ctx: JobContext<UnreliableTaskData>
): Promise<{ taskId: string; attempt: number }> => {
  const { taskId, failureRate } = ctx.data;

  ctx.logger.info('Starting unreliable task', { taskId, failureRate });

  await ctx.progress(25, 'Phase 1');
  await sleep(300);

  await ctx.progress(50, 'Phase 2');
  await sleep(300);

  // Random failure based on failure rate
  if (Math.random() < failureRate) {
    ctx.logger.error('Task failed randomly', { taskId });
    throw new Error(\`Random failure for task \${taskId}\`);
  }

  await ctx.progress(75, 'Phase 3');
  await sleep(300);

  await ctx.progress(100, 'Complete');

  return { taskId, attempt: 1 };
};
`,
  },

  // ==========================================================================
  // 10. APP-ROUTER.TS - Route Factory
  // ==========================================================================
  {
    path: 'src/app-router.ts',
    content: `import { Blaize, type InferContext } from 'blaizejs';

import { server } from './index';

import type { PlaygroundEvents } from './events';

type AppContext = InferContext<typeof server>;

export const appRouter = Blaize.Router.createRouteFactory<
  AppContext['state'],
  AppContext['services'],
  PlaygroundEvents
>();
`,
  },

  // ==========================================================================
  // 11. INDEX.TS - Server Setup
  // ==========================================================================
  {
    path: 'src/index.ts',
    content: `import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Blaize } from 'blaizejs';

import {
  createRedisClient,
  RedisCacheAdapter,
  RedisEventBusAdapter,
  RedisQueueAdapter,
} from '@blaizejs/adapter-redis';
import { createSecurityMiddleware } from '@blaizejs/middleware-security';
import { createCachePlugin } from '@blaizejs/plugin-cache';
import { createMetricsPlugin } from '@blaizejs/plugin-metrics';
import { createQueuePlugin } from '@blaizejs/plugin-queue';

import { REDIS_CONFIG } from './config';
import { playgroundEvents } from './events';
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

// ============================================================================
// Redis Client & Adapters
// ============================================================================

Blaize.logger.info('Connecting to Redis', REDIS_CONFIG);
const redisClient = createRedisClient(REDIS_CONFIG);

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

Blaize.logger.info('✅ Redis adapters configured');

// ============================================================================
// Metrics Plugin
// ============================================================================
const metricsPlugin = createMetricsPlugin({
  enabled: true,
  excludePaths: ['/health', '/favicon.ico'],
  histogramLimit: 1000,
  collectionInterval: 60000, // Report every 60 seconds
  maxCardinality: 10,
  onCardinalityLimit: 'warn',
  labels: {
    service: '{{projectName}}',
    environment: process.env.NODE_ENV || 'development',
    redis: 'enabled',
  },
});

// ============================================================================
// Queue Plugin
// ============================================================================
const queuePlugin = createQueuePlugin({
  storage: queueAdapter,
  serverId: '{{projectName}}-server-1',
  
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

    // Long-running queue
    longRunning: {
      concurrency: 2,
      defaultTimeout: 60000,
      defaultMaxRetries: 1,
    },
  },

  // Register handlers
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
const cachePlugin = createCachePlugin({
  adapter: cacheAdapter,
});

// ============================================================================
// Security Middleware
// ============================================================================
const securityMiddleware = createSecurityMiddleware();

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
    securityMiddleware,
    Blaize.Middleware.requestLoggerMiddleware({
      includeHeaders: true,
      headerWhitelist: ['content-type', 'authorization', 'cookie'],
    }),
  ],
  plugins: [metricsPlugin, queuePlugin, cachePlugin],
  eventSchemas: playgroundEvents,
});

server.eventBus.setAdapter(eventBusAdapter);
Blaize.logger.info('✅ EventBus Redis adapter configured');

try {
  // Start the server
  await server.listen();

  Blaize.logger.info('🚀 Server started');
  Blaize.logger.info(\`📍 https://\${server.host}:\${server.port}\`);
  Blaize.logger.info('');
  Blaize.logger.info('📖 Quick Start:');
  Blaize.logger.info('   Dashboard:    GET  /');
  Blaize.logger.info('   Cache Demo:   GET  /cache/demo');
  Blaize.logger.info('   Queue Demo:   GET  /queue/demo');
  Blaize.logger.info('   Metrics:      GET  /metrics/json');
  Blaize.logger.info('');
  Blaize.logger.info('📚 See README.md for all endpoints');

  // Handle process termination signals
  ['SIGINT', 'SIGTERM', 'SIGQUIT'].forEach(signal => {
    process.on(signal, async () => {
      Blaize.logger.info(\`Received \${signal}, shutting down server...\`);
      try {
        await server.close();
        Blaize.logger.info('Server shutdown completed');
        process.exit(0);
      } catch (error) {
        Blaize.logger.error('Error during shutdown', { error });
        process.exit(1);
      }
    });
  });
} catch (err) {
  Blaize.logger.error('Server error', { error: err });
}
`,
  },

  // ==========================================================================
  // 12. APP-TYPE.TS - Route Registry (Skeleton)
  // ==========================================================================
  {
    path: 'src/app-type.ts',
    content: `/**
 * Route Registry
 * 
 * This file will be populated as routes are added in subsequent tasks.
 * For now, it's an empty skeleton.
 */

export const routes = {
  // Routes will be added here in T2.2-T2.6
} as const;
`,
  },
];
