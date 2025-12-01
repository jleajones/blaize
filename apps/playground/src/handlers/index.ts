/**
 * Job Handlers for Queue Plugin Demo
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
    throw new Error(`Random failure for task ${taskId}`);
  }

  await ctx.progress(75, 'Phase 3');
  await sleep(300);

  await ctx.progress(100, 'Complete');

  return { taskId, attempt: 1 };
};
