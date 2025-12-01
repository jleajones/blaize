/**
 * Queue Status Route
 *
 * GET /queue/status
 *
 * Returns JSON with queue statistics and recent jobs.
 * Query params:
 * - queueName: Filter by queue name
 * - status: Filter by job status
 * - limit: Number of jobs to return (default: 20)
 */
import {
  queueStatusHandler,
  queueStatusQuerySchema,
  queueStatusResponseSchema,
} from '@blaizejs/plugin-queue';

import { appRouter } from '../../app-router';

export const GET = appRouter.get({
  schema: { query: queueStatusQuerySchema, response: queueStatusResponseSchema },
  handler: queueStatusHandler,
});
