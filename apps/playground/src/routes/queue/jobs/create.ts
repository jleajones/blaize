/**
 * Create Job Route
 *
 * POST /queue/jobs/create
 *
 * Creates a new job in the specified queue.
 *
 * Request body:
 * - queueName: Queue to add job to
 * - jobType: Type of job (must have registered handler)
 * - data: Job-specific data
 * - options: Optional job options (priority, timeout, maxRetries, metadata)
 *
 * Response:
 * - jobId: Created job ID
 * - queueName: Queue the job was added to
 * - status: Initial status ('queued')
 */
import { createJobHandler, createJobBodySchema } from '@blaizejs/plugin-queue';

import { appRouter } from '../../../app-router';

export const POST = appRouter.post({
  schema: { body: createJobBodySchema },
  handler: createJobHandler,
});
