/**
 * Cancel Job Route
 *
 * POST /queue/jobs/cancel
 *
 * Cancels a running or queued job.
 *
 * Request body:
 * - jobId: Job to cancel
 * - queueName: Optional - Queue name for faster lookup
 * - reason: Optional - Cancellation reason
 *
 * Response:
 * - jobId: Cancelled job ID
 * - cancelled: Whether cancellation was successful
 * - status: Final job status
 */
import { cancelJobHandler, cancelJobBodySchema } from '@blaizejs/plugin-queue';

import { appRouter } from '../../../app-router';

export const POST = appRouter.post({
  schema: { body: cancelJobBodySchema },
  handler: cancelJobHandler,
});
