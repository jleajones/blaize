/**
 * Health & Metrics Routes for Advanced Template (T2.2)
 *
 * Contains:
 * - routes/health/index.ts - Health check endpoint
 * - routes/metrics/index.ts - Metrics JSON endpoint
 * - routes/metrics/dashboard.ts - Metrics HTML dashboard
 * - routes/index.ts - Root welcome endpoint
 */

import type { TemplateFile } from '@/types';

export const healthMetricsRoutes: TemplateFile[] = [
  // ==========================================================================
  // ROOT ROUTE - Welcome message with endpoint list
  // ==========================================================================
  {
    path: 'src/routes/index.ts',
    content: `import { z } from 'zod';

import { appRouter } from '../app-router';

export const getRoot = appRouter.get({
  schema: {
    response: z.object({
      message: z.string(),
      timestamp: z.string(),
      version: z.string(),
      endpoints: z.object({
        health: z.string(),
        metrics: z.object({
          json: z.string(),
          dashboard: z.string(),
        }),
        queue: z.object({
          demo: z.string(),
          stream: z.string(),
          status: z.string(),
          dashboard: z.string(),
        }),
        cache: z.object({
          demo: z.string(),
          stream: z.string(),
        }),
        user: z.object({
          list: z.string(),
          signup: z.string(),
        }),
      }),
    }),
  },
  handler: async ({ logger }) => {
    logger.info('Root endpoint accessed');

    return {
      message: 'Welcome to {{projectName}} - BlaizeJS Advanced Template',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      endpoints: {
        health: 'GET /health',
        metrics: {
          json: 'GET /metrics/json',
          dashboard: 'GET /metrics/dashboard',
        },
        queue: {
          demo: 'GET /queue/demo',
          stream: 'GET /queue/stream?jobId=<id>',
          status: 'GET /queue/status',
          dashboard: 'GET /queue/dashboard',
        },
        cache: {
          demo: 'GET /cache/demo',
          stream: 'GET /cache/stream',
        },
        user: {
          list: 'GET /user',
          signup: 'POST /user/signup',
        },
      },
    };
  },
});
`,
  },

  // ==========================================================================
  // HEALTH ROUTE - System health check
  // ==========================================================================
  {
    path: 'src/routes/health/index.ts',
    content: `import { z } from 'zod';

import { appRouter } from '../../app-router';

/**
 * Health Check Route
 * 
 * GET /health
 * 
 * Returns server health status including:
 * - Overall status
 * - Uptime
 * - Redis connection status
 * - Service checks
 */

const startTime = Date.now();

export const getHealth = appRouter.get({
  schema: {
    response: z.object({
      status: z.enum(['healthy', 'degraded', 'unhealthy']),
      timestamp: z.number(),
      uptime: z.number(),
      checks: z.object({
        redis: z.object({
          status: z.enum(['up', 'down']),
          latency: z.number().optional(),
        }),
        eventBus: z.object({
          status: z.enum(['connected', 'disconnected']),
        }),
        cache: z.object({
          status: z.enum(['connected', 'disconnected']),
        }),
        queue: z.object({
          status: z.enum(['connected', 'disconnected']),
        }),
      }),
    }),
  },
  handler: async ({ ctx, logger }) => {
    logger.debug('Health check requested');

    // Get services from context
    const { cache, queue } = ctx.services;

    try {
      // Check Redis connection via cache adapter
      const cacheHealth = await cache.healthCheck();
      
      // Basic health checks
      const checks = {
        redis: {
          status: cacheHealth.healthy ? ('up' as const) : ('down' as const),
          latency: cacheHealth.details?.latency as number | undefined,
        },
        eventBus: {
          status: 'connected' as const, // EventBus is always connected if server is running
        },
        cache: {
          status: cacheHealth.healthy ? ('connected' as const) : ('disconnected' as const),
        },
        queue: {
          status: 'connected' as const, // Queue plugin is connected if Redis is up
        },
      };

      // Determine overall status
      const allHealthy = cacheHealth.healthy;
      const status = allHealthy ? ('healthy' as const) : ('degraded' as const);

      return {
        status,
        timestamp: Date.now(),
        uptime: Date.now() - startTime,
        checks,
      };
    } catch (error) {
      logger.error('Health check failed', { error });

      // Return unhealthy status
      return {
        status: 'unhealthy' as const,
        timestamp: Date.now(),
        uptime: Date.now() - startTime,
        checks: {
          redis: {
            status: 'down' as const,
          },
          eventBus: {
            status: 'disconnected' as const,
          },
          cache: {
            status: 'disconnected' as const,
          },
          queue: {
            status: 'disconnected' as const,
          },
        },
      };
    }
  },
});
`,
  },

  // ==========================================================================
  // METRICS JSON ROUTE - Prometheus metrics in JSON
  // ==========================================================================
  {
    path: 'src/routes/metrics/index.ts',
    content: `import { metricsJsonRoute } from '@blaizejs/plugin-metrics';

import { appRouter } from '../../app-router';

/**
 * Metrics JSON Route
 * 
 * GET /metrics/json
 * 
 * Returns Prometheus metrics in JSON format.
 * Uses the built-in handler from @blaizejs/plugin-metrics.
 * 
 * Response includes:
 * - HTTP request metrics (count, duration)
 * - System metrics (memory, CPU)
 * - Custom business metrics
 */
export const getMetricsJson = appRouter.get({
  handler: metricsJsonRoute,
});
`,
  },

  // ==========================================================================
  // METRICS DASHBOARD ROUTE - HTML dashboard
  // ==========================================================================
  {
    path: 'src/routes/metrics/dashboard.ts',
    content: `import { metricsDashboardRoute } from '@blaizejs/plugin-metrics';

import { appRouter } from '../../app-router';

/**
 * Metrics Dashboard Route
 * 
 * GET /metrics/dashboard
 * 
 * Returns an HTML dashboard with charts and visualizations.
 * Uses the built-in handler from @blaizejs/plugin-metrics.
 * 
 * Features:
 * - Real-time metrics visualization
 * - Request rate charts
 * - Response time histograms
 * - Error rate tracking
 * - Auto-refresh capability
 */
export const getMetricsDashboard = appRouter.get({
  handler: metricsDashboardRoute,
});
`,
  },
];

/**
 * Queue Routes for Advanced Template (T2.3)
 * 
 * Contains:
 * - routes/queue/demo.ts - Create demo jobs (GET & POST)
 * - routes/queue/stream.ts - SSE job progress monitoring
 * - routes/queue/status.ts - Queue statistics JSON
 * - routes/queue/dashboard.ts - HTML dashboard
 * - routes/queue/prometheus.ts - Prometheus metrics
 */


export const queueRoutes: TemplateFile[] = [
  // ==========================================================================
  // QUEUE DEMO ROUTE - Create sample jobs
  // ==========================================================================
  {
    path: 'src/routes/queue/demo.ts',
    content: `/**
 * Queue Demo Route
 *
 * GET /queue/demo - Create single batch of sample jobs
 * POST /queue/demo - Create multiple batches with custom options
 *
 * Demonstrates all queue types with varying durations:
 * - Fast jobs (0.5-3s): email, notifications
 * - Medium jobs (5-10s): reports, image processing
 * - Long jobs (20-40s): video processing, data migration
 * - Unreliable jobs: for testing retry logic
 */
import { z } from 'zod';

import type { JobPriority, QueueService } from '@blaizejs/plugin-queue';

import { appRouter } from '../../app-router';

/**
 * Create sample jobs for demonstration
 */
async function createDemoJobs(
  queue: QueueService,
  options: {
    count?: number;
    includeUnreliable?: boolean;
    includeLongRunning?: boolean;
  } = {}
) {
  const { count = 1, includeUnreliable = false, includeLongRunning = true } = options;

  const jobs: Array<{ jobId: string; queue: string; type: string; description: string }> = [];

  for (let i = 0; i < count; i++) {
    // ========================================================================
    // Email jobs (fast, 0.5-3 seconds)
    // ========================================================================
    const sendEmailId = await queue.add(
      'emails',
      'send',
      {
        to: \`user\${i + 1}@example.com\`,
        subject: \`Welcome Email #\${i + 1}\`,
        body: 'Thanks for signing up!',
      },
      { priority: (5 + Math.floor(Math.random() * 4)) as JobPriority }
    );
    jobs.push({
      jobId: sendEmailId,
      queue: 'emails',
      type: 'send',
      description: 'Send welcome email (2-3 seconds) ✉️',
    });

    const verifyEmailId = await queue.add(
      'emails',
      'verify',
      { email: \`test\${i + 1}@example.com\` },
      { priority: 3 }
    );
    jobs.push({
      jobId: verifyEmailId,
      queue: 'emails',
      type: 'verify',
      description: 'Verify email address (0.5-1 second) ✓',
    });

    // ========================================================================
    // Report job (medium, 5-8 seconds)
    // ========================================================================
    const reportId = await queue.add(
      'reports',
      'generate',
      {
        reportId: \`report-\${Date.now()}\`,
        reportType: 'monthly',
        dateRange: {
          start: '2024-01-01',
          end: '2024-01-31',
        },
      },
      { priority: 7, metadata: { requestedBy: \`user\${i + 1}\` } }
    );
    jobs.push({
      jobId: reportId,
      queue: 'reports',
      type: 'generate',
      description: 'Generate monthly report (10 seconds) 📊',
    });

    // ========================================================================
    // Image processing job (medium, 5 seconds)
    // ========================================================================
    const imageId = await queue.add(
      'processing',
      'image',
      {
        imageId: \`img-\${Date.now()}\`,
        operations: ['resize', 'compress', 'watermark'],
      },
      { priority: 5 }
    );
    jobs.push({
      jobId: imageId,
      queue: 'processing',
      type: 'image',
      description: 'Process image (5 seconds) 🖼️',
    });

    // ========================================================================
    // Data sync job (slow, 8 seconds)
    // ========================================================================
    if (i === 0) {
      const syncId = await queue.add(
        'processing',
        'data-sync',
        {
          syncId: \`sync-\${Date.now()}\`,
          recordCount: 1000,
        },
        { priority: 4, metadata: { critical: false } }
      );
      jobs.push({
        jobId: syncId,
        queue: 'processing',
        type: 'data-sync',
        description: 'Sync 1000 records (8 seconds) 🔄',
      });
    }

    // ========================================================================
    // Notification jobs (fast, 1 second)
    // ========================================================================
    const notifId = await queue.add(
      'notifications',
      'send',
      {
        userId: \`user-\${i + 1}\`,
        type: 'push',
        message: 'Your job is ready!',
      },
      { priority: 8 }
    );
    jobs.push({
      jobId: notifId,
      queue: 'notifications',
      type: 'send',
      description: 'Send push notification (1 second) 🔔',
    });

    // ========================================================================
    // Long-running jobs (20-40 seconds) - GREAT FOR SSE TESTING!
    // ========================================================================
    if (includeLongRunning && i === 0) {
      const longReportId = await queue.add(
        'longRunning',
        'long-report',
        {
          reportId: \`long-report-\${Date.now()}\`,
          complexity: 'medium',
        },
        { priority: 6 }
      );
      jobs.push({
        jobId: longReportId,
        queue: 'longRunning',
        type: 'long-report',
        description: '📈 Generate detailed report (20 seconds) - PERFECT FOR SSE!',
      });

      const videoId = await queue.add(
        'longRunning',
        'video',
        {
          videoId: \`video-\${Date.now()}\`,
          resolution: '1080p',
          duration: 120,
        },
        { priority: 5 }
      );
      jobs.push({
        jobId: videoId,
        queue: 'longRunning',
        type: 'video',
        description: '🎥 Process video in 1080p (30 seconds) - BEST FOR SSE!',
      });
    }

    // ========================================================================
    // Unreliable job (optional, for testing retries)
    // ========================================================================
    if (includeUnreliable && i === 0) {
      const unreliableId = await queue.add(
        'testing',
        'unreliable',
        {
          taskId: \`task-\${Date.now()}\`,
          failureRate: 0.2, // 20% failure rate
        },
        { priority: 3, maxRetries: 2 }
      );
      jobs.push({
        jobId: unreliableId,
        queue: 'testing',
        type: 'unreliable',
        description: '⚠️ Unreliable task (20% failure rate, tests retries)',
      });
    }
  }

  return jobs;
}

/**
 * GET /queue/demo - Create single batch of sample jobs
 */
export const getQueueDemo = appRouter.get({
  schema: {
    query: z.object({
      includeUnreliable: z
        .string()
        .optional()
        .transform(val => val === 'true'),
      includeLongRunning: z
        .string()
        .optional()
        .transform(val => val !== 'false'), // Default true
    }),
    response: z.object({
      message: z.string(),
      jobCount: z.number(),
      jobs: z.array(
        z.object({
          jobId: z.string(),
          queue: z.string(),
          type: z.string(),
          description: z.string(),
        })
      ),
      links: z.object({
        dashboard: z.string(),
        status: z.string(),
        sseExample: z.string().optional(),
      }),
      tips: z.array(z.string()),
    }),
  },
  handler: async ({ ctx, logger }) => {
    const queue = ctx.services.queue as QueueService;
    const { includeUnreliable, includeLongRunning } = ctx.request.query as any;

    logger.info('Creating demo jobs', { includeUnreliable, includeLongRunning });

    const jobs = await createDemoJobs(queue, {
      count: 1,
      includeUnreliable,
      includeLongRunning,
    });

    logger.info('Demo jobs created', { count: jobs.length });

    // Get a long-running job for the SSE link
    const longJob = jobs.find(j => j.queue === 'longRunning');

    return {
      message: '🚀 Demo jobs created! Watch them process in real-time.',
      jobCount: jobs.length,
      jobs,
      links: {
        dashboard: '/queue/dashboard?refresh=5',
        status: '/queue/status',
        sseExample: longJob ? \`/queue/stream?jobId=\${longJob.jobId}\` : undefined,
      },
      tips: [
        '💡 Visit /queue/dashboard to see all jobs',
        '📊 The long-running jobs (20-30s) are perfect for testing SSE',
        longJob
          ? \`🔥 Try: curl -N http://localhost:7485/queue/stream?jobId=\${longJob.jobId}\`
          : '',
        '⚡ Fast jobs (<3s) complete quickly - use long jobs for demos',
        includeUnreliable
          ? '⚠️ Unreliable jobs may retry 2-3 times before completing'
          : '➕ Add ?includeUnreliable=true to test retry logic',
      ].filter(Boolean),
    };
  },
});

/**
 * POST /queue/demo - Create multiple batches of sample jobs
 */
export const postQueueDemo = appRouter.post({
  schema: {
    body: z.object({
      count: z.number().int().min(1).max(10).default(1),
      includeUnreliable: z.boolean().default(false),
      includeLongRunning: z.boolean().default(true),
    }),
    response: z.object({
      message: z.string(),
      jobCount: z.number(),
      jobs: z.array(
        z.object({
          jobId: z.string(),
          queue: z.string(),
          type: z.string(),
          description: z.string(),
        })
      ),
      summary: z.object({
        emails: z.number(),
        reports: z.number(),
        processing: z.number(),
        notifications: z.number(),
        longRunning: z.number(),
        testing: z.number(),
      }),
    }),
  },
  handler: async ({ ctx, logger }) => {
    const queue = ctx.services.queue as QueueService;
    const { count, includeUnreliable, includeLongRunning } = ctx.request.body;

    logger.info('Creating demo jobs', { batches: count, includeUnreliable, includeLongRunning });

    const jobs = await createDemoJobs(queue, { count, includeUnreliable, includeLongRunning });

    logger.info('Demo jobs created', { count: jobs.length });

    // Count jobs by queue
    const summary = {
      emails: jobs.filter(j => j.queue === 'emails').length,
      reports: jobs.filter(j => j.queue === 'reports').length,
      processing: jobs.filter(j => j.queue === 'processing').length,
      notifications: jobs.filter(j => j.queue === 'notifications').length,
      longRunning: jobs.filter(j => j.queue === 'longRunning').length,
      testing: jobs.filter(j => j.queue === 'testing').length,
    };

    return {
      message: \`✨ Created \${jobs.length} demo jobs across \${count} batch(es)\`,
      jobCount: jobs.length,
      jobs,
      summary,
    };
  },
});
`,
  },

  // ==========================================================================
  // QUEUE STREAM ROUTE - SSE job progress monitoring
  // ==========================================================================
  {
    path: 'src/routes/queue/stream.ts',
    content: `/**
 * Queue Job Stream Route (SSE)
 *
 * GET /queue/stream?jobId=<id>
 *
 * Server-Sent Events stream for real-time job monitoring.
 * 
 * Query params:
 * - jobId: Required - Job ID to monitor
 * - queueName: Optional - Queue name for faster lookup
 *
 * Events:
 * - job.progress: { jobId, percent, message, timestamp }
 * - job.completed: { jobId, result, completedAt }
 * - job.failed: { jobId, error, failedAt }
 * - job.cancelled: { jobId, reason, cancelledAt }
 *
 * Usage:
 * \`\`\`bash
 * # Monitor a long-running job
 * curl -N http://localhost:7485/queue/stream?jobId=<job-id>
 * \`\`\`
 *
 * Browser usage:
 * \`\`\`javascript
 * const eventSource = new EventSource('/queue/stream?jobId=job_123');
 * 
 * eventSource.addEventListener('job.progress', (e) => {
 *   const data = JSON.parse(e.data);
 *   console.log(\`Progress: \${data.percent}% - \${data.message}\`);
 * });
 * 
 * eventSource.addEventListener('job.completed', (e) => {
 *   const data = JSON.parse(e.data);
 *   console.log('Job completed!', data.result);
 *   eventSource.close();
 * });
 * \`\`\`
 */
import { jobStreamHandler, jobStreamQuerySchema, jobSseEventSchemas } from '@blaizejs/plugin-queue';

import { appRouter } from '../../app-router';

export const getQueueStream = appRouter.sse({
  schema: {
    query: jobStreamQuerySchema,
    events: jobSseEventSchemas,
  },
  handler: jobStreamHandler,
});
`,
  },

  // ==========================================================================
  // QUEUE STATUS ROUTE - Queue statistics JSON
  // ==========================================================================
  {
    path: 'src/routes/queue/status.ts',
    content: `/**
 * Queue Status Route
 *
 * GET /queue/status
 *
 * Returns JSON with queue statistics and recent jobs.
 * 
 * Query params:
 * - queueName: Filter by queue name
 * - status: Filter by job status (queued, running, completed, failed, cancelled)
 * - limit: Number of jobs to return (default: 20, max: 100)
 *
 * Response includes:
 * - Queue statistics (queued, running, completed, failed counts)
 * - Recent jobs with details
 * - Timestamp
 *
 * Usage:
 * \`\`\`bash
 * # Get status of all queues
 * curl http://localhost:7485/queue/status
 * 
 * # Get status of specific queue
 * curl http://localhost:7485/queue/status?queueName=emails
 * 
 * # Get only failed jobs
 * curl http://localhost:7485/queue/status?status=failed
 * \`\`\`
 */
import {
  queueStatusHandler,
  queueStatusQuerySchema,
  queueStatusResponseSchema,
} from '@blaizejs/plugin-queue';

import { appRouter } from '../../app-router';

export const getQueueStatus = appRouter.get({
  schema: {
    query: queueStatusQuerySchema,
    response: queueStatusResponseSchema,
  },
  handler: queueStatusHandler,
});
`,
  },

  // ==========================================================================
  // QUEUE DASHBOARD ROUTE - HTML dashboard
  // ==========================================================================
  {
    path: 'src/routes/queue/dashboard.ts',
    content: `/**
 * Queue Dashboard Route
 *
 * GET /queue/dashboard
 *
 * Returns HTML dashboard with queue visualization.
 * 
 * Query params:
 * - queueName: Filter by queue name
 * - refresh: Auto-refresh interval in seconds (e.g., ?refresh=5)
 *
 * Features:
 * - Visual queue status
 * - Recent jobs list
 * - Real-time statistics
 * - Auto-refresh capability
 * - Filter by queue
 *
 * Usage:
 * \`\`\`bash
 * # Open in browser
 * open http://localhost:7485/queue/dashboard
 * 
 * # With auto-refresh every 5 seconds
 * open http://localhost:7485/queue/dashboard?refresh=5
 * 
 * # Filter to specific queue
 * open http://localhost:7485/queue/dashboard?queueName=emails
 * \`\`\`
 */
import { queueDashboardHandler, queueDashboardQuerySchema } from '@blaizejs/plugin-queue';

import { appRouter } from '../../app-router';

export const getQueueDashboard = appRouter.get({
  schema: {
    query: queueDashboardQuerySchema,
  },
  handler: queueDashboardHandler,
});
`,
  },

  // ==========================================================================
  // QUEUE PROMETHEUS ROUTE - Prometheus metrics
  // ==========================================================================
  {
    path: 'src/routes/queue/prometheus.ts',
    content: `/**
 * Queue Prometheus Metrics Route
 *
 * GET /queue/prometheus
 *
 * Returns Prometheus/OpenMetrics format metrics for queue monitoring.
 * 
 * Metrics exported:
 * - blaize_queue_jobs_total{queue,status} - Job count by status
 *
 * Usage with Prometheus:
 * \`\`\`yaml
 * # prometheus.yml
 * scrape_configs:
 *   - job_name: 'blaize-queue'
 *     static_configs:
 *       - targets: ['localhost:7485']
 *     metrics_path: '/queue/prometheus'
 *     scrape_interval: 15s
 * \`\`\`
 *
 * Usage:
 * \`\`\`bash
 * curl http://localhost:7485/queue/prometheus
 * \`\`\`
 */
import { queuePrometheusHandler } from '@blaizejs/plugin-queue';

import { appRouter } from '../../app-router';

export const getQueuePrometheus = appRouter.get({
  handler: queuePrometheusHandler,
});
`,
  },
];
