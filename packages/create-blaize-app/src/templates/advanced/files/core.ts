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
    content: `import { z } from 'zod';

import { defineJob } from '@blaizejs/plugin-queue';

import { sleep } from './utilities';

// ============================================================================
// Email Queue Handlers
// ============================================================================

/**
 * Send email handler - Medium duration (2-3 seconds)
 * Simulates sending an email with progress updates
 */
export const sendEmailJob = defineJob({
  input: z.object({
    to: z.string(),
    subject: z.string(),
    body: z.string(),
  }),
  output: z.object({
    messageId: z.string(),
    sentAt: z.number(),
  }),
  handler: async (ctx) => {
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
  },
});

/**
 * Verify email handler - Short duration (0.5-1 second)
 */
export const verifyEmailJob = defineJob({
  input: z.object({
    email: z.string(),
  }),
  output: z.object({
    email: z.string(),
    isValid: z.boolean(),
    provider: z.string(),
  }),
  handler: async (ctx) => {
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
  },
});
`,
  },

  // ==========================================================================
  // 5. HANDLERS/PROCESSING.TS - Processing Handlers
  // ==========================================================================
  {
    path: 'src/handlers/processing.ts',
    content: `import { z } from 'zod';

import { defineJob } from '@blaizejs/plugin-queue';

import { sleep } from './utilities';

// ============================================================================
// Processing Queue Handlers
// ============================================================================

/**
 * Process image handler - Medium duration (5 seconds)
 */
export const processImageJob = defineJob({
  input: z.object({
    imageId: z.string(),
    operations: z.array(z.string()),
  }),
  output: z.object({
    imageId: z.string(),
    processedUrl: z.string(),
  }),
  handler: async (ctx) => {
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
  },
});

/**
 * Data sync handler - Longer duration (8 seconds)
 */
export const dataSyncJob = defineJob({
  input: z.object({
    syncId: z.string(),
    recordCount: z.number(),
  }),
  output: z.object({
    syncId: z.string(),
    synced: z.number(),
  }),
  handler: async (ctx) => {
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
  },
});
`,
  },

  // ==========================================================================
  // 6. HANDLERS/REPORTS.TS - Report Handler
  // ==========================================================================
  {
    path: 'src/handlers/reports.ts',
    content: `import { z } from 'zod';

import { defineJob } from '@blaizejs/plugin-queue';

import { sleep } from './utilities';

// ============================================================================
// Report Queue Handlers
// ============================================================================

/**
 * Generate report handler - Long duration (10 seconds)
 * Demonstrates detailed progress reporting
 */
export const generateReportJob = defineJob({
  input: z.object({
    reportId: z.string(),
    reportType: z.string(),
    dateRange: z.object({
      start: z.string(),
      end: z.string(),
    }),
  }),
  output: z.object({
    reportId: z.string(),
    url: z.string(),
  }),
  handler: async (ctx) => {
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
  },
});
`,
  },

  // ==========================================================================
  // 7. HANDLERS/NOTIFICATIONS.TS - Notification Handler
  // ==========================================================================
  {
    path: 'src/handlers/notifications.ts',
    content: `import { z } from 'zod';

import { defineJob } from '@blaizejs/plugin-queue';

import { sleep } from './utilities';
// ============================================================================
// Notification Queue Handlers
// ============================================================================

/**
 * Send notification handler - Quick (0.5-1 second)
 */
export const sendNotificationJob = defineJob({
  input: z.object({
    userId: z.string(),
    type: z.enum(['push', 'sms', 'in-app']),
    message: z.string(),
  }),
  output: z.object({
    notificationId: z.string(),
    delivered: z.boolean(),
  }),
  handler: async (ctx) => {
    const { userId, type } = ctx.data;

    ctx.logger.info('Sending notification', { userId, type });

    await ctx.progress(30, \`Preparing \${type} notification\`);
    await sleep(200);

    await ctx.progress(70, 'Delivering notification');
    await sleep(300 + Math.random() * 200);

    await ctx.progress(100, 'Notification sent');

    const notificationId = \`notif-\${Date.now()}-\${userId}\`;
    const delivered = Math.random() > 0.1; // 90% success rate

    ctx.logger.info('Notification result', { notificationId, delivered });

    return { notificationId, delivered };
  },
});
`,
  },

  // ==========================================================================
  // 8. HANDLERS/LONG-RUNNING.TS - Long Running Handlers
  // ==========================================================================
  {
    path: 'src/handlers/long-running.ts',
    content: `/**
 * Long-Running Job Handlers for SSE Testing
 *
 * These handlers take 10-30 seconds to complete,
 * giving you time to observe SSE progress updates.
 */

import { z } from 'zod';

import { defineJob } from '@blaizejs/plugin-queue';

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// Long-Running Handlers
// ============================================================================

/**
 * Generate long report - 20 seconds with detailed progress
 */
export const generateLongReportJob = defineJob({
  input: z.object({
    reportType: z.string(),
    includeCharts: z.boolean(),
  }),
  output: z.object({
    reportId: z.string(),
    pages: z.number(),
    duration: z.number(),
  }),
  handler: async (ctx) => {
    const startTime = Date.now();
    const { reportType, includeCharts } = ctx.data;

    ctx.logger.info('Starting long report generation', { reportType });

    // Phase 1: Data collection (5 seconds)
    await ctx.progress(5, 'Collecting data from database');
    await sleep(2000);

    await ctx.progress(10, 'Processing 1000 records');
    await sleep(1000);

    await ctx.progress(15, 'Processing 2000 records');
    await sleep(1000);

    await ctx.progress(20, 'Processing complete - 3500 records');
    await sleep(1000);

    // Phase 2: Analysis (5 seconds)
    await ctx.progress(30, 'Running statistical analysis');
    await sleep(2000);

    await ctx.progress(40, 'Calculating trends');
    await sleep(1500);

    await ctx.progress(50, 'Generating insights');
    await sleep(1500);

    // Phase 3: Chart generation (5 seconds)
    if (includeCharts) {
      await ctx.progress(55, 'Creating line charts');
      await sleep(1500);

      await ctx.progress(60, 'Creating bar charts');
      await sleep(1500);

      await ctx.progress(65, 'Creating pie charts');
      await sleep(2000);
    }

    // Phase 4: PDF rendering (5 seconds)
    await ctx.progress(70, 'Rendering page 1 of 10');
    await sleep(500);

    await ctx.progress(75, 'Rendering page 3 of 10');
    await sleep(500);

    await ctx.progress(80, 'Rendering page 5 of 10');
    await sleep(1000);

    await ctx.progress(85, 'Rendering page 7 of 10');
    await sleep(1000);

    await ctx.progress(90, 'Rendering page 9 of 10');
    await sleep(1000);

    await ctx.progress(95, 'Finalizing PDF');
    await sleep(1000);

    await ctx.progress(100, 'Report complete');

    const duration = Date.now() - startTime;
    const reportId = \`long-report-\${Date.now()}\`;

    ctx.logger.info('Long report completed', { reportId, duration });

    return {
      reportId,
      pages: 10,
      duration,
    };
  },
});

/**
 * Process video - 30 seconds with very detailed progress
 */
export const processVideoJob = defineJob({
  input: z.object({
    videoId: z.string(),
    resolution: z.enum(['720p', '1080p', '4k']),
    duration: z.number(),
  }),
  output: z.object({
    videoId: z.string(),
    outputUrl: z.string(),
    processingTime: z.number(),
  }),
  handler: async (ctx) => {
    const startTime = Date.now();
    const { videoId, resolution, duration } = ctx.data;

    ctx.logger.info('Starting video processing', { videoId, resolution, duration });

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

    await ctx.progress(80, \`Transcoding complete\`);
    await sleep(1500);

    // Phase 3: Thumbnail generation (5 seconds)
    await ctx.progress(82, 'Generating thumbnails at 0:10');
    await sleep(1000);

    await ctx.progress(85, 'Generating thumbnails at 0:30');
    await sleep(1000);

    await ctx.progress(88, 'Generating thumbnails at 1:00');
    await sleep(1000);

    await ctx.progress(91, 'Creating preview sprite');
    await sleep(2000);

    // Phase 4: Upload to CDN (7 seconds)
    await ctx.progress(93, 'Uploading to CDN - 0%');
    await sleep(2000);

    await ctx.progress(96, 'Uploading to CDN - 50%');
    await sleep(2000);

    await ctx.progress(98, 'Uploading to CDN - 90%');
    await sleep(2000);

    await ctx.progress(100, 'Video processing complete');
    await sleep(1000);

    const processingTime = Date.now() - startTime;
    const outputUrl = \`https://cdn.example.com/videos/\${videoId}-\${resolution}.mp4\`;

    ctx.logger.info('Video processing completed', { videoId, outputUrl, processingTime });

    return {
      videoId,
      outputUrl,
      processingTime,
    };
  },
});

/**
 * Data migration - 25 seconds with progress per batch
 */
export const dataMigrationJob = defineJob({
  input: z.object({
    fromDatabase: z.string(),
    toDatabase: z.string(),
    recordCount: z.number(),
  }),
  output: z.object({
    migrated: z.number(),
    failed: z.number(),
    duration: z.number(),
  }),
  handler: async (ctx) => {
    const startTime = Date.now();
    const { fromDatabase, toDatabase, recordCount } = ctx.data;

    ctx.logger.info('Starting data migration', { fromDatabase, toDatabase, recordCount });

    let migrated = 0;
    const batchSize = 1000;
    const totalBatches = Math.ceil(recordCount / batchSize);

    await ctx.progress(0, \`Preparing to migrate \${recordCount} records in \${totalBatches} batches\`);
    await sleep(2000);

    // Migrate in batches
    for (let batch = 1; batch <= totalBatches; batch++) {
      const recordsInBatch = Math.min(batchSize, recordCount - migrated);
      const percent = Math.floor((batch / totalBatches) * 95); // Save 5% for finalization

      await ctx.progress(
        percent,
        \`Batch \${batch}/\${totalBatches}: Migrating \${recordsInBatch} records\`
      );

      // Simulate migration time
      await sleep(2000 + Math.random() * 1000);

      migrated += recordsInBatch;

      // Check for cancellation
      if (ctx.signal.aborted) {
        throw new Error('Migration cancelled');
      }
    }

    await ctx.progress(95, 'Verifying migrated data');
    await sleep(2000);

    await ctx.progress(98, 'Updating indexes');
    await sleep(1500);

    await ctx.progress(100, 'Migration complete');

    const duration = Date.now() - startTime;

    ctx.logger.info('Migration completed', { migrated, duration });

    return {
      migrated,
      failed: 0,
      duration,
    };
  },
});
`,
  },

  // ==========================================================================
  // 9. HANDLERS/INDEX.TS - Handler Exports
  // ==========================================================================
  {
    path: 'src/handlers/index.ts',
    content: `/**
 * Job Handlers for Queue Plugin Demo
 *
 * These handlers demonstrate different job types with varying durations
 * to allow testing SSE monitoring, dashboard, and status endpoints.
 */
import { z } from 'zod';

import { defineJob } from '@blaizejs/plugin-queue';

import { sleep } from './utilities';

export { sendEmailJob, verifyEmailJob } from './email';
export { sendNotificationJob } from './notifications';
export { processImageJob, dataSyncJob } from './processing';
export { generateReportJob } from './reports';
export {
  dataMigrationJob,
  generateLongReportJob,
  processVideoJob,
} from './long-running';

// ============================================================================
// Failing Job Handler (for testing error handling)
// ============================================================================

/**
 * Unreliable task handler - May fail randomly (for testing retries)
 */
export const unreliableTaskJob = defineJob({
  input: z.object({
    taskId: z.string(),
    failureRate: z.number(),
  }),
  output: z.object({
    taskId: z.string(),
    attempt: z.number(),
  }),
  handler: async (ctx) => {
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
  },
});
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
