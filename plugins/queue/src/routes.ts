/**
 * Route Handlers for Queue Plugin
 *
 * This module provides ready-to-use route handlers and schemas
 * for queue monitoring and management. Users import handlers and
 * schemas separately to assemble routes using BlaizeJS route creators.
 *
 * ## SSE Handler (4-param signature)
 * - `jobStreamHandler(stream, ctx, params, logger)` - Real-time job monitoring
 *
 * ## HTTP Handlers (3-param signature)
 * - `queueStatusHandler(ctx, params, logger)` - Queue status JSON
 * - `queuePrometheusHandler(ctx, params, logger)` - Prometheus metrics
 * - `queueDashboardHandler(ctx, params, logger)` - HTML dashboard
 * - `createJobHandler(ctx, params, logger)` - Create new job
 * - `cancelJobHandler(ctx, params, logger)` - Cancel job
 *
 * ## Query Schemas
 * - `jobStreamQuerySchema` - SSE stream query params
 * - `queueStatusQuerySchema` - Status endpoint query params
 * - `queueDashboardQuerySchema` - Dashboard query params
 *
 * ## Body Schemas
 * - `createJobBodySchema` - Create job POST body
 * - `cancelJobBodySchema` - Cancel job POST body
 *
 * @example SSE Route Assembly
 * ```typescript
 * // routes/queue/jobs/stream.ts
 * import { createSSERoute } from 'blaizejs';
 * import {
 *   jobStreamHandler,
 *   jobStreamQuerySchema,
 *   jobEventsSchema,
 * } from '@blaizejs/queue';
 *
 * export default createSSERoute()({
 *   schema: {
 *     query: jobStreamQuerySchema,
 *     events: jobEventsSchema,
 *   },
 *   handler: jobStreamHandler,
 * });
 * ```
 *
 * @example HTTP Route Assembly
 * ```typescript
 * // routes/queue/status.ts
 * import { createGetRoute } from 'blaizejs';
 * import { queueStatusHandler, queueStatusQuerySchema } from '@blaizejs/queue';
 *
 * export default createGetRoute()({
 *   schema: { query: queueStatusQuerySchema },
 *   handler: queueStatusHandler,
 * });
 * ```
 *
 * @module @blaizejs/queue/routes
 * @since 0.4.0
 */

import { ServiceNotAvailableError, NotFoundError, getCorrelationId } from 'blaizejs';

import { gatherDashboardData, renderDashboard } from './dashboard';

import type { QueueService } from './queue-service';
import type {
  CancelJobBody,
  CreateJobBody,
  JobStreamQuery,
  QueueDashboardQuery,
  QueueStatusQuery,
} from './schema';
import type { Job, JobStatus, QueueStats, JobOptions } from './types';
import type { SSEStream, Context, BlaizeLogger } from 'blaizejs';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get QueueService from context or throw ServiceNotAvailableError
 *
 * @param ctx - BlaizeJS context object
 * @returns QueueService instance
 * @throws ServiceNotAvailableError if queue service is not available
 *
 * @internal
 */
function getQueueServiceOrThrow(ctx: Context): QueueService {
  // Type assertion: queue plugin middleware injects QueueService into services
  const services = ctx.services as { queue?: QueueService };
  const queue = services.queue;

  if (!queue) {
    throw new ServiceNotAvailableError(
      'Queue service unavailable',
      {
        service: 'queue',
        reason: 'dependency_down',
        suggestion: 'Ensure queue plugin is registered and initialized',
      },
      getCorrelationId()
    );
  }

  return queue;
}

// ============================================================================
// SSE Handlers (4-param signature)
// ============================================================================

/**
 * SSE job monitoring handler
 *
 * Streams real-time job events (progress, completed, failed, cancelled)
 * to connected clients. Uses the 4-parameter SSE signature required
 * by BlaizeJS: `(stream, ctx, params, logger)`.
 *
 * ## Events Sent
 *
 * | Event | When | Payload |
 * |-------|------|---------|
 * | `job.progress` | Handler calls `ctx.progress()` | `{ jobId, percent, message?, timestamp }` |
 * | `job.completed` | Job finishes successfully | `{ jobId, result, completedAt }` |
 * | `job.failed` | Job fails after retries | `{ jobId, error: { message, code? }, failedAt }` |
 * | `job.cancelled` | Job is cancelled | `{ jobId, reason?, cancelledAt }` |
 *
 * ## Error Handling
 *
 * - Throws `ServiceNotAvailableError` if queue service is not registered
 * - Throws `NotFoundError` if job ID does not exist
 *
 * @example Route assembly
 * ```typescript
 * // routes/queue/jobs/stream.ts
 * import { createSSERoute } from 'blaizejs';
 * import {
 *   jobStreamHandler,
 *   jobStreamQuerySchema,
 *   jobEventsSchema,
 * } from '@blaizejs/queue';
 *
 * export default createSSERoute()({
 *   schema: {
 *     query: jobStreamQuerySchema,
 *     events: jobEventsSchema,
 *   },
 *   handler: jobStreamHandler,
 * });
 * ```
 *
 * @example Client usage
 * ```typescript
 * const eventSource = new EventSource(
 *   '/queue/jobs/stream?jobId=550e8400-e29b-41d4-a716-446655440000'
 * );
 *
 * eventSource.addEventListener('job.progress', (e) => {
 *   const data = JSON.parse(e.data);
 *   console.log(`Progress: ${data.percent}%`);
 * });
 *
 * eventSource.addEventListener('job.completed', (e) => {
 *   const data = JSON.parse(e.data);
 *   console.log('Job completed:', data.result);
 *   eventSource.close();
 * });
 * ```
 *
 * @param stream - SSE stream for sending events
 * @param ctx - BlaizeJS request context
 * @param params - Route parameters (unused, job ID comes from query)
 * @param logger - BlaizeJS logger instance
 */
export const jobStreamHandler = async (
  stream: SSEStream,
  ctx: Context,
  params: Record<string, string>,
  logger: BlaizeLogger
): Promise<void> => {
  // Get queue service from context
  const queue = getQueueServiceOrThrow(ctx);

  // Extract query parameters
  const { jobId, queueName } = ctx.request.query as JobStreamQuery;

  logger.debug('SSE stream opened for job', { jobId, queueName });

  // Verify job exists
  const job = await queue.getJob(jobId, queueName);

  if (!job) {
    throw new NotFoundError(
      `Job ${jobId} not found`,
      {
        resourceType: 'job',
        resourceId: jobId,
        queueName,
      },
      getCorrelationId()
    );
  }

  // Track if stream is still active
  let isStreamActive = true;

  // Subscribe to job events
  const unsubscribe = queue.subscribe(jobId, {
    onProgress: (percent, message) => {
      if (!isStreamActive) return;

      stream.send('job.progress', {
        jobId,
        percent,
        message,
        timestamp: Date.now(),
      });
    },

    onCompleted: result => {
      if (!isStreamActive) return;

      stream.send('job.completed', {
        jobId,
        result,
        completedAt: Date.now(),
      });

      // Auto-close stream after completion
      logger.debug('Job completed, closing SSE stream', { jobId });
      stream.close();
    },

    onFailed: error => {
      if (!isStreamActive) return;

      stream.send('job.failed', {
        jobId,
        error: {
          message: error.message,
          code: error.code,
        },
        failedAt: Date.now(),
      });

      // Auto-close stream after failure
      logger.debug('Job failed, closing SSE stream', { jobId });
      stream.close();
    },

    onCancelled: reason => {
      if (!isStreamActive) return;

      stream.send('job.cancelled', {
        jobId,
        reason,
        cancelledAt: Date.now(),
      });

      // Auto-close stream after cancellation
      logger.debug('Job cancelled, closing SSE stream', { jobId });
      stream.close();
    },
  });

  // Cleanup on client disconnect
  stream.onClose(() => {
    isStreamActive = false;
    logger.debug('SSE stream closed for job', { jobId });
    unsubscribe();
  });

  // Send initial state if job is already in terminal state
  if (job.status === 'completed') {
    stream.send('job.completed', {
      jobId,
      result: job.result,
      completedAt: job.completedAt ?? Date.now(),
    });
    stream.close();
  } else if (job.status === 'failed') {
    stream.send('job.failed', {
      jobId,
      error: {
        message: job.error?.message ?? 'Unknown error',
        code: job.error?.code,
      },
      failedAt: job.completedAt ?? Date.now(),
    });
    stream.close();
  } else if (job.status === 'cancelled') {
    stream.send('job.cancelled', {
      jobId,
      reason: undefined, // Job interface doesn't store cancellation reason
      cancelledAt: job.completedAt ?? Date.now(),
    });
    stream.close();
  }

  // For running/queued jobs, the subscription handles events
  // The function returns but the stream stays open until:
  // 1. Client disconnects (onClose callback)
  // 2. Job reaches terminal state (onCompleted/onFailed/onCancelled)
};

// ============================================================================
// HTTP Handlers (3-param signature)
// ============================================================================

/**
 * Formatted job for API responses
 *
 * Serializable representation of a job with all relevant fields.
 * Used by queueStatusHandler and other JSON endpoints.
 */
interface FormattedJob {
  id: string;
  type: string;
  queueName: string;
  status: JobStatus;
  priority: number;
  data: unknown;
  result?: unknown;
  error?: {
    message: string;
    code?: string;
  };
  progress?: number;
  retries: number;
  maxRetries: number;
  queuedAt: number;
  startedAt?: number;
  completedAt?: number;
}

/**
 * Format a Job for JSON response
 *
 * @param job - Job to format
 * @returns Formatted job object
 * @internal
 */
function formatJob(job: Job): FormattedJob {
  return {
    id: job.id,
    type: job.type,
    queueName: job.queueName,
    status: job.status,
    priority: job.priority,
    data: job.data,
    result: job.result,
    error: job.error
      ? {
          message: job.error.message,
          code: job.error.code,
        }
      : undefined,
    progress: job.progress,
    retries: job.retries,
    maxRetries: job.maxRetries,
    queuedAt: job.queuedAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
  };
}

/**
 * Queue status response shape
 */
interface QueueStatusResponse {
  queues: Array<{
    name: string;
    stats: QueueStats;
    jobs: FormattedJob[];
  }>;
  timestamp: number;
}

/**
 * JSON queue status handler
 *
 * Returns status for all queues or a specific queue, including
 * statistics and job listings filtered by status.
 *
 * ## Response Shape
 * ```json
 * {
 *   "queues": [{
 *     "name": "emails",
 *     "stats": { "total": 100, "queued": 10, "running": 2, ... },
 *     "jobs": [{ "id": "...", "type": "...", "status": "..." }]
 *   }],
 *   "timestamp": 1234567890
 * }
 * ```
 *
 * @example Route assembly
 * ```typescript
 * // routes/queue/status.ts
 * import { createGetRoute } from 'blaizejs';
 * import { queueStatusHandler, queueStatusQuerySchema } from '@blaizejs/queue';
 *
 * export default createGetRoute()({
 *   schema: { query: queueStatusQuerySchema },
 *   handler: queueStatusHandler,
 * });
 * ```
 *
 * @param ctx - BlaizeJS request context
 * @param params - Route parameters (unused)
 * @param logger - BlaizeJS logger instance
 * @returns Queue status response
 */
export const queueStatusHandler = async (
  ctx: Context,
  params: Record<string, string>,
  logger: BlaizeLogger
): Promise<QueueStatusResponse> => {
  const queue = getQueueServiceOrThrow(ctx);
  const { queueName, status, limit } = ctx.request.query as unknown as QueueStatusQuery;

  const limitNum = parseInt(limit || '20', 10);
  logger.debug('Fetching queue status', { queueName, status, limitNum });

  const queueNames = queueName ? [queueName] : queue.listQueues();

  const queues = await Promise.all(
    queueNames.map(async name => {
      const stats = await queue.getQueueStats(name);
      const jobs = await queue.listJobs(name, {
        status: status as JobStatus | undefined,
        limit: limitNum,
      });
      return {
        name,
        stats,
        jobs: jobs.map(formatJob),
      };
    })
  );

  return {
    queues,
    timestamp: Date.now(),
  };
};

/**
 * Prometheus metrics handler
 *
 * Returns queue metrics in Prometheus/OpenMetrics text format.
 * Suitable for scraping by Prometheus, Grafana Agent, or compatible tools.
 *
 * ## Metrics Exported
 * - `blaize_queue_jobs_total{queue,status}` - Job count by status
 *
 * @example Route assembly
 * ```typescript
 * // routes/queue/metrics.ts
 * import { createGetRoute } from 'blaizejs';
 * import { queuePrometheusHandler } from '@blaizejs/queue';
 *
 * export default createGetRoute()({
 *   handler: queuePrometheusHandler,
 * });
 * ```
 *
 * @param ctx - BlaizeJS request context
 * @param params - Route parameters (unused)
 * @param logger - BlaizeJS logger instance
 */
export const queuePrometheusHandler = async (
  ctx: Context,
  params: Record<string, string>,
  logger: BlaizeLogger
): Promise<void> => {
  const queue = getQueueServiceOrThrow(ctx);

  logger.debug('Generating Prometheus metrics');

  const queueNames = queue.listQueues();
  const metrics: string[] = [
    '# HELP blaize_queue_jobs_total Total number of jobs by status',
    '# TYPE blaize_queue_jobs_total gauge',
  ];

  for (const name of queueNames) {
    const stats = await queue.getQueueStats(name);
    metrics.push(`blaize_queue_jobs_total{queue="${name}",status="queued"} ${stats.queued}`);
    metrics.push(`blaize_queue_jobs_total{queue="${name}",status="running"} ${stats.running}`);
    metrics.push(`blaize_queue_jobs_total{queue="${name}",status="completed"} ${stats.completed}`);
    metrics.push(`blaize_queue_jobs_total{queue="${name}",status="failed"} ${stats.failed}`);
    metrics.push(`blaize_queue_jobs_total{queue="${name}",status="cancelled"} ${stats.cancelled}`);
  }

  ctx.response.type('text/plain; version=0.0.4; charset=utf-8').text(metrics.join('\n'));
};

/**
 * HTML dashboard handler
 *
 * Renders a visual dashboard showing queue status and recent jobs.
 * Supports optional auto-refresh via query parameter.
 *
 * @example Route assembly
 * ```typescript
 * // routes/queue/dashboard.ts
 * import { createGetRoute } from 'blaizejs';
 * import { queueDashboardHandler, queueDashboardQuerySchema } from '@blaizejs/queue';
 *
 * export default createGetRoute()({
 *   schema: { query: queueDashboardQuerySchema },
 *   handler: queueDashboardHandler,
 * });
 * ```
 *
 * @param ctx - BlaizeJS request context
 * @param params - Route parameters (unused)
 * @param logger - BlaizeJS logger instance
 */
export const queueDashboardHandler = async (
  ctx: Context,
  params: Record<string, string>,
  logger: BlaizeLogger
): Promise<void> => {
  const queue = getQueueServiceOrThrow(ctx);
  const { queueName, refresh } = ctx.request.query as unknown as QueueDashboardQuery;
  const refreshInterval = refresh ? parseInt(refresh, 10) : undefined;

  logger.debug('Rendering queue dashboard', { queueName, refreshInterval });

  const queueNames = queueName ? [queueName] : queue.listQueues();
  const data = await gatherDashboardData(queue, queueNames);

  const html = renderDashboard(data, {
    refreshInterval,
  });

  ctx.response.type('text/html; charset=utf-8').html(html);
};

/**
 * Create job response shape
 */
interface CreateJobResponse {
  jobId: string;
  queueName: string;
  jobType: string;
  createdAt: number;
}

/**
 * Create job handler
 *
 * Adds a new job to the specified queue. The job will be processed
 * by a registered handler matching the job type.
 *
 * ## Request Body
 * ```json
 * {
 *   "queueName": "emails",
 *   "jobType": "send-welcome",
 *   "data": { "userId": "123" },
 *   "options": { "priority": 8 }
 * }
 * ```
 *
 * ## Response
 * ```json
 * {
 *   "jobId": "550e8400-e29b-41d4-a716-446655440000",
 *   "queueName": "emails",
 *   "jobType": "send-welcome",
 *   "createdAt": 1234567890
 * }
 * ```
 *
 * @example Route assembly
 * ```typescript
 * // routes/queue/jobs/create.ts
 * import { createPostRoute } from 'blaizejs';
 * import { createJobHandler, createJobBodySchema } from '@blaizejs/queue';
 *
 * export default createPostRoute()({
 *   schema: { body: createJobBodySchema },
 *   handler: createJobHandler,
 * });
 * ```
 *
 * @param ctx - BlaizeJS request context
 * @param params - Route parameters (unused)
 * @param logger - BlaizeJS logger instance
 * @returns Created job response
 */
export const createJobHandler = async (
  ctx: Context,
  params: Record<string, string>,
  logger: BlaizeLogger
): Promise<CreateJobResponse> => {
  const queue = getQueueServiceOrThrow(ctx);
  const body = ctx.request.body as CreateJobBody;

  logger.info('Creating job', {
    queueName: body.queueName,
    jobType: body.jobType,
  });

  // Cast options - schema validates priority is 1-10 but TypeScript needs explicit cast
  const jobId = await queue.add(
    body.queueName,
    body.jobType,
    body.data,
    body.options as JobOptions | undefined
  );

  logger.info('Job created', { jobId, queueName: body.queueName });

  return {
    jobId,
    queueName: body.queueName,
    jobType: body.jobType,
    createdAt: Date.now(),
  };
};

/**
 * Cancel job response shape
 */
interface CancelJobResponse {
  jobId: string;
  cancelled: boolean;
  reason?: string;
  cancelledAt: number;
}

/**
 * Cancel job handler
 *
 * Cancels a job if it is still queued or running. Jobs that have
 * already completed or failed cannot be cancelled.
 *
 * ## Request Body
 * ```json
 * {
 *   "jobId": "550e8400-e29b-41d4-a716-446655440000",
 *   "queueName": "emails",
 *   "reason": "User requested cancellation"
 * }
 * ```
 *
 * ## Response
 * ```json
 * {
 *   "jobId": "550e8400-e29b-41d4-a716-446655440000",
 *   "cancelled": true,
 *   "reason": "User requested cancellation",
 *   "cancelledAt": 1234567890
 * }
 * ```
 *
 * @example Route assembly
 * ```typescript
 * // routes/queue/jobs/cancel.ts
 * import { createPostRoute } from 'blaizejs';
 * import { cancelJobHandler, cancelJobBodySchema } from '@blaizejs/queue';
 *
 * export default createPostRoute()({
 *   schema: { body: cancelJobBodySchema },
 *   handler: cancelJobHandler,
 * });
 * ```
 *
 * @param ctx - BlaizeJS request context
 * @param params - Route parameters (unused)
 * @param logger - BlaizeJS logger instance
 * @returns Cancel job response
 * @throws NotFoundError if job not found or already completed
 */
export const cancelJobHandler = async (
  ctx: Context,
  params: Record<string, string>,
  logger: BlaizeLogger
): Promise<CancelJobResponse> => {
  const queue = getQueueServiceOrThrow(ctx);
  const body = ctx.request.body as CancelJobBody;

  logger.info('Cancelling job', { jobId: body.jobId, reason: body.reason });

  const cancelled = await queue.cancelJob(body.jobId, body.queueName);

  if (!cancelled) {
    throw new NotFoundError(
      `Job ${body.jobId} not found or already completed`,
      {
        resourceType: 'job',
        resourceId: body.jobId,
      },
      getCorrelationId()
    );
  }

  logger.info('Job cancelled', { jobId: body.jobId });

  return {
    jobId: body.jobId,
    cancelled: true,
    reason: body.reason,
    cancelledAt: Date.now(),
  };
};
