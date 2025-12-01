/**
 * Queue Demo Route (Updated)
 *
 * GET /queue/demo - Create sample jobs
 * POST /queue/demo - Create custom batch
 *
 * Improvements:
 * - Added long-running handlers for better SSE testing
 * - Made unreliable tasks optional (query param)
 * - Lower failure rate by default (20% instead of 50%)
 * - Better descriptions
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
        to: `user${i + 1}@example.com`,
        subject: `Welcome Email #${i + 1}`,
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
      { email: `test${i + 1}@example.com` },
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
        reportType: 'monthly',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      },
      { priority: 7, metadata: { requestedBy: `user${i + 1}` } }
    );
    jobs.push({
      jobId: reportId,
      queue: 'reports',
      type: 'generate',
      description: 'Generate monthly report (5-8 seconds) 📊',
    });

    // ========================================================================
    // Image processing job (medium, 2-5 seconds)
    // ========================================================================
    const imageId = await queue.add(
      'processing',
      'image',
      {
        imageUrl: `https://example.com/images/photo${i + 1}.jpg`,
        operations: ['resize', 'compress', 'watermark'],
      },
      { priority: 5 }
    );
    jobs.push({
      jobId: imageId,
      queue: 'processing',
      type: 'image',
      description: 'Process image (2-5 seconds) 🖼️',
    });

    // ========================================================================
    // Data sync job (slow, 8-12 seconds)
    // ========================================================================
    if (i === 0) {
      // Only create one sync job per batch (it's expensive)
      const syncId = await queue.add(
        'processing',
        'data-sync',
        {
          source: 'legacy-db',
          destination: 'new-db',
          recordCount: 1000,
        },
        { priority: 4, metadata: { critical: false } }
      );
      jobs.push({
        jobId: syncId,
        queue: 'processing',
        type: 'data-sync',
        description: 'Sync 1000 records (8-12 seconds) 🔄',
      });
    }

    // ========================================================================
    // Notification jobs (fast, 0.5-1 second)
    // ========================================================================
    const notifId = await queue.add(
      'notifications',
      'send',
      {
        userId: `user-${i + 1}`,
        type: 'push',
        message: 'Your job is ready!',
      },
      { priority: 8 }
    );
    jobs.push({
      jobId: notifId,
      queue: 'notifications',
      type: 'send',
      description: 'Send push notification (0.5-1 second) 🔔',
    });

    // ========================================================================
    // Long-running jobs (20-30 seconds) - GREAT FOR SSE TESTING!
    // ========================================================================
    if (includeLongRunning && i === 0) {
      // Only create one per batch (they're long)

      const longReportId = await queue.add(
        'longRunning',
        'long-report',
        {
          reportType: 'annual',
          includeCharts: true,
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
          videoId: `video-${Date.now()}`,
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
          taskId: `task-${Date.now()}`,
          failureRate: 0.2, // ← Lowered to 20% (was 50%)
        },
        { priority: 3, maxRetries: 2 } // ← Reduced retries to 2 (was 3)
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
export const GET = appRouter.get({
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
  handler: async (ctx, _params, logger) => {
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
        sseExample: longJob ? `/queue/stream?jobId=${longJob.jobId}` : undefined,
      },
      tips: [
        '💡 Visit /queue/dashboard to see all jobs',
        '📊 The long-running jobs (20-30s) are perfect for testing SSE',
        longJob ? `🔥 Try: curl -N http://localhost:7485/queue/stream?jobId=${longJob.jobId}` : '',
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
export const POST = appRouter.post({
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
  handler: async (ctx, _params, logger) => {
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
      message: `✨ Created ${jobs.length} demo jobs across ${count} batch(es)`,
      jobCount: jobs.length,
      jobs,
      summary,
    };
  },
});
