/**
 * Queue Prometheus Metrics Route
 *
 * GET /queue/prometheus
 *
 * Returns Prometheus/OpenMetrics format metrics for queue monitoring.
 * Includes:
 * - queue_jobs_total (by queue, status)
 * - queue_jobs_processing
 * - queue_job_duration_seconds
 */
import { queuePrometheusHandler } from '@blaizejs/plugin-queue';

import { appRouter } from '../../app-router';

export const GET = appRouter.get({
  handler: queuePrometheusHandler,
});
