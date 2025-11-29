/**
 * Queue Demo Route
 *
 * GET /queue/demo
 * POST /queue/demo
 *
 * Creates sample jobs across all queues for testing.
 * GET creates a single batch, POST allows specifying count.
 *
 * This is useful for:
 * - Testing the dashboard
 * - Testing SSE monitoring
 * - Demonstrating different job types and durations
 */
import { z } from 'zod';

import type { JobPriority, QueueService } from '@blaizejs/plugin-queue';

import { appRouter } from '../../app-router';

/**
 * Create sample jobs for demonstration
 */
async function createDemoJobs(queue: QueueService, count: number = 1) {
  const jobs: Array<{ jobId: string; queue: string; type: string; description: string }> = [];

  for (let i = 0; i < count; i++) {
    // Email jobs (fast)
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
      description: 'Send welcome email (2-3 seconds)',
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
      description: 'Verify email address (0.5-1 second)',
    });

    // Report job (slow)
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
      description: 'Generate monthly report (5-8 seconds)',
    });

    // Image processing job (medium)
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
      description: 'Process image (2-5 seconds)',
    });

    // Data sync job (very slow)
    if (i === 0) {
      // Only create one sync job (it's expensive)
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
        description: 'Sync 1000 records (8-12 seconds)',
      });
    }

    // Notification jobs (fast)
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
      description: 'Send push notification (0.5-1 second)',
    });

    // Unreliable job for testing retries
    if (i === 0) {
      const unreliableId = await queue.add(
        'testing',
        'unreliable',
        {
          taskId: `task-${Date.now()}`,
          failureRate: 0.5, // 50% failure rate
        },
        { priority: 3, maxRetries: 3 }
      );
      jobs.push({
        jobId: unreliableId,
        queue: 'testing',
        type: 'unreliable',
        description: 'Unreliable task (50% failure rate, for testing retries)',
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
        stream: z.string(),
      }),
    }),
  },
  handler: async (ctx, _params, logger) => {
    const queue = ctx.services.queue as QueueService;

    logger.info('Creating demo jobs');

    const jobs = await createDemoJobs(queue, 1);

    logger.info('Demo jobs created', { count: jobs.length });

    // Get the first report job for the stream link (it's the longest running)
    const reportJob = jobs.find(j => j.queue === 'reports');

    return {
      message: 'Demo jobs created! Watch them process in real-time.',
      jobCount: jobs.length,
      jobs,
      links: {
        dashboard: '/queue/dashboard?refresh=5',
        status: '/queue/status',
        stream: reportJob ? `/queue/stream?jobId=${reportJob.jobId}` : '/queue/stream',
      },
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
    }),
  },
  handler: async (ctx, _params, logger) => {
    const queue = ctx.services.queue as QueueService;
    const { count } = ctx.request.body;

    logger.info('Creating demo jobs', { batches: count });

    const jobs = await createDemoJobs(queue, count);

    logger.info('Demo jobs created', { count: jobs.length });

    return {
      message: `Created ${jobs.length} demo jobs across ${count} batch(es)`,
      jobCount: jobs.length,
      jobs,
    };
  },
});
