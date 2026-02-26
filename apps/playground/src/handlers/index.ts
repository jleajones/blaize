/**
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
      throw new Error(`Random failure for task ${taskId}`);
    }

    await ctx.progress(75, 'Phase 3');
    await sleep(300);

    await ctx.progress(100, 'Complete');

    return { taskId, attempt: 1 };
  },
});
