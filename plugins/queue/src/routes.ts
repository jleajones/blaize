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
 *   jobSseEventSchemas,
 * } from '@blaizejs/queue';
 *
 * export default createSSERoute()({
 *   schema: {
 *     query: jobStreamQuerySchema,
 *     events: jobSseEventSchemas,
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
  CreateJobResponse,
  jobSseEventSchemas,
  JobStreamQuery,
  QueueDashboardQuery,
  QueueStatusQuery,
  QueueStatusResponse,
} from './schema';
import type { Job, JobStatus, JobOptions, FormattedJob } from './types';
import type { TypedSSEStream, Context, BlaizeLogger, EventBus } from 'blaizejs';

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

// Create a type alias for your specific stream type
export type JobSSEStream = TypedSSEStream<typeof jobSseEventSchemas>;

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

export const jobStreamHandler = async ({
  stream,
  ctx,
  logger,
  eventBus,
}: {
  stream: JobSSEStream;
  ctx: Context;
  logger: BlaizeLogger;
  eventBus: EventBus;
}): Promise<void> => {
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

  // Track unsubscribe functions for cleanup
  const unsubscribers: (() => void)[] = [];

  // Subscribe to enqueued events
  unsubscribers.push(
    eventBus.subscribe('queue:job:enqueued', event => {
      const data = event.data as any;

      // Filter by jobId
      if (data.jobId !== jobId) return;

      // Filter by queueName if specified
      if (queueName && data.queueName !== queueName) return;

      try {
        stream.send('job.enqueued', {
          type: 'enqueued',
          jobId: data.jobId,
          queueName: data.queueName,
          jobType: data.jobType,
          priority: data.priority,
          timestamp: data.timestamp,
          serverId: data.serverId,
        });
      } catch (error) {
        logger.error('Failed to send enqueued event', {
          error,
          jobId: data.jobId,
        });
      }
    })
  );

  // Subscribe to started events
  unsubscribers.push(
    eventBus.subscribe('queue:job:started', event => {
      const data = event.data as any;

      if (data.jobId !== jobId) return;
      if (queueName && data.queueName !== queueName) return;

      try {
        stream.send('job.started', {
          type: 'started',
          jobId: data.jobId,
          queueName: data.queueName,
          jobType: data.jobType,
          timestamp: data.timestamp,
          serverId: data.serverId,
        });
      } catch (error) {
        logger.error('Failed to send started event', {
          error,
          jobId: data.jobId,
        });
      }
    })
  );

  // Subscribe to progress events
  unsubscribers.push(
    eventBus.subscribe('queue:job:progress', event => {
      const data = event.data as any;

      if (data.jobId !== jobId) return;

      try {
        stream.send('job.progress', {
          type: 'progress',
          jobId: data.jobId,
          queueName: queueName || '', // Progress events don't include queueName
          progress: data.progress || 0, // Already 0-1 from EventBus
          message: data.message,
          timestamp: data.timestamp,
          serverId: '', // Progress events don't include serverId
        });
      } catch (error) {
        logger.error('Failed to send progress event', {
          error,
          jobId: data.jobId,
        });
      }
    })
  );

  // Subscribe to completed events
  unsubscribers.push(
    eventBus.subscribe('queue:job:completed', event => {
      const data = event.data as any;

      if (data.jobId !== jobId) return;
      if (queueName && data.queueName !== queueName) return;

      try {
        stream.send('job.completed', {
          type: 'completed',
          jobId: data.jobId,
          queueName: data.queueName,
          jobType: data.jobType,
          result: data.result,
          timestamp: data.timestamp, // ✅ Use completedAt
          serverId: data.serverId,
        });
        logger.debug('Job completed, closing SSE stream', { jobId: data.jobId }); // ✅ Correct log message
        stream.close();
      } catch (error) {
        logger.error('Failed to send completed event', {
          error,
          jobId: data.jobId,
        });
      }
    })
  );

  // Subscribe to failed events
  unsubscribers.push(
    eventBus.subscribe('queue:job:failed', async event => {
      const data = event.data as any;

      if (data.jobId !== jobId) return;
      if (queueName && data.queueName !== queueName) return;

      try {
        const failedJob = await queue.getJob(data.jobId, data.queueName);

        stream.send('job.failed', {
          type: 'failed',
          jobId: data.jobId,
          queueName: data.queueName,
          jobType: data.jobType,
          error: {
            message:
              typeof data.error === 'string' ? data.error : data.error?.message || 'Unknown error',
            code: failedJob?.error?.code, // ✅ Extract error code
          },
          timestamp: data.timestamp, // ✅ Use failedAt
          serverId: data.serverId,
        });
        stream.close();
      } catch (error) {
        logger.error('Failed to send failed event', {
          error,
          jobId: data.jobId,
        });
      }
    })
  );

  // Subscribe to cancelled events
  unsubscribers.push(
    eventBus.subscribe('queue:job:cancelled', event => {
      const data = event.data as any;

      if (data.jobId !== jobId) return;
      if (queueName && data.queueName !== queueName) return;

      try {
        stream.send('job.cancelled', {
          type: 'cancelled',
          jobId: data.jobId,
          queueName: data.queueName,
          reason: data.reason,
          timestamp: data.timestamp, // ✅ Use cancelledAt
          serverId: data.serverId,
        });
        stream.close();
      } catch (error) {
        logger.error('Failed to send cancelled event', {
          error,
          jobId: data.jobId,
        });
      }
    })
  );

  // Cleanup on stream close
  stream.onClose(() => {
    logger.debug('SSE stream closed for job', { jobId, queueName });
    unsubscribers.forEach(unsubscribe => unsubscribe());
  });

  // ✅ Handle initial state - send event immediately for already-terminal jobs
  if (job.status === 'completed') {
    try {
      stream.send('job.completed', {
        type: 'completed',
        jobId: job.id,
        queueName: job.queueName,
        jobType: job.type,
        result: job.result,
        timestamp: job.completedAt || Date.now(),
        serverId: '', // Not available from storage
      });
      logger.debug('Job completed, closing SSE stream', { jobId: job.id });
      stream.close();
    } catch (error) {
      logger.error('Failed to send completed event for already-completed job', {
        error,
        jobId,
      });
    }
  } else if (job.status === 'failed') {
    try {
      stream.send('job.failed', {
        type: 'failed',
        jobId: job.id,
        queueName: job.queueName,
        jobType: job.type,
        error: {
          message: job.error?.message || 'Unknown error',
          code: job.error?.code, // ✅ Get code from stored job error
        },
        timestamp: job.completedAt || Date.now(),
        serverId: '', // Not available from storage
      });
      stream.close();
    } catch (error) {
      logger.error('Failed to send failed event for already-failed job', {
        error,
        jobId,
      });
    }
  } else if (job.status === 'cancelled') {
    try {
      stream.send('job.cancelled', {
        type: 'cancelled',
        jobId: job.id,
        queueName: job.queueName,
        reason: 'Job was cancelled', // ✅ Provide a reason
        timestamp: job.completedAt || Date.now(),
        serverId: '', // Not available from storage
      });
      stream.close();
    } catch (error) {
      logger.error('Failed to send cancelled event for already-cancelled job', {
        error,
        jobId,
      });
    }
  }
};

// ============================================================================
// HTTP Handlers (3-param signature)
// ===========================================================================

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
export const queueStatusHandler = async ({
  ctx,
  logger,
}: {
  ctx: Context;
  logger: BlaizeLogger;
}): Promise<QueueStatusResponse> => {
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
export const queuePrometheusHandler = async ({
  ctx,
  logger,
}: {
  ctx: Context;
  logger: BlaizeLogger;
}): Promise<void> => {
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
export const queueDashboardHandler = async ({
  ctx,
  logger,
}: {
  ctx: Context;
  logger: BlaizeLogger;
}): Promise<void> => {
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
export const createJobHandler = async ({
  ctx,
  logger,
}: {
  ctx: Context;
  logger: BlaizeLogger;
}): Promise<CreateJobResponse> => {
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
    queuedAt: Date.now(),
    status: 'queued',
    priority: body.options?.priority || 5,
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
export const cancelJobHandler = async ({
  ctx,
  logger,
}: {
  ctx: Context;
  logger: BlaizeLogger;
}): Promise<CancelJobResponse> => {
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
