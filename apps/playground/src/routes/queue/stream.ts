/**
 * Queue Job Stream Route (SSE)
 *
 * GET /queue/stream?jobId=<id>
 *
 * Server-Sent Events stream for real-time job monitoring.
 * Query params:
 * - jobId: Required - Job ID to monitor
 * - queueName: Optional - Queue name for faster lookup
 *
 * Events:
 * - job.progress: { jobId, percent, message, timestamp }
 * - job.completed: { jobId, result, completedAt }
 * - job.failed: { jobId, error, failedAt }
 * - job.cancelled: { jobId, reason, cancelledAt }
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
