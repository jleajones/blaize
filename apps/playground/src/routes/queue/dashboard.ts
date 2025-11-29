/**
 * Queue Dashboard Route
 *
 * GET /queue/dashboard
 *
 * Returns HTML dashboard with queue visualization.
 * Query params:
 * - queueName: Filter by queue name
 * - refresh: Auto-refresh interval in seconds (e.g., ?refresh=30)
 */
import { queueDashboardHandler, queueDashboardQuerySchema } from '@blaizejs/plugin-queue';

import { appRouter } from '../../app-router';

export const GET = appRouter.get({
  schema: { query: queueDashboardQuerySchema },
  handler: queueDashboardHandler,
});
