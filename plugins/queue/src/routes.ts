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
import { z } from 'zod';

import type { QueueService } from './queue-service';
import type { Job, JobOptions, JobStatus, QueueStats } from './types';
import type { SSEStream, Context, BlaizeLogger } from 'blaizejs';

// ============================================================================
// Query Schemas
// ============================================================================

/**
 * Query schema for job stream SSE endpoint
 *
 * Validates the query parameters for the job monitoring stream.
 *
 * @example Valid query strings
 * ```
 * ?jobId=550e8400-e29b-41d4-a716-446655440000
 * ?jobId=550e8400-e29b-41d4-a716-446655440000&queueName=emails
 * ```
 */
export const jobStreamQuerySchema = z.object({
  /**
   * Job ID to monitor (required)
   * Must be a valid UUID
   */
  jobId: z
    .string({
      required_error: 'jobId is required',
      invalid_type_error: 'jobId must be a string',
    })
    .uuid('jobId must be a valid UUID'),

  /**
   * Queue name (optional)
   * If not provided, searches all queues for the job
   */
  queueName: z.string().optional(),
});

/**
 * Inferred type for job stream query parameters
 */
export type JobStreamQuery = z.infer<typeof jobStreamQuerySchema>;

// ============================================================================
// HTTP Query Schemas
// ============================================================================

/**
 * Query schema for queue status endpoint
 *
 * Validates query parameters for filtering queue/job status.
 *
 * @example Valid query strings
 * ```
 * ?queueName=emails
 * ?status=failed&limit=50
 * ?queueName=reports&status=running&limit=10
 * ```
 */
export const queueStatusQuerySchema = z.object({
  /**
   * Filter to specific queue (optional)
   * If not provided, returns status for all queues
   */
  queueName: z.string().optional(),

  /**
   * Filter jobs by status (optional)
   */
  status: z.enum(['queued', 'running', 'completed', 'failed', 'cancelled']).optional(),

  /**
   * Maximum number of jobs to return per queue
   * @default 20
   */
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

/**
 * Inferred type for queue status query parameters
 */
export type QueueStatusQuery = z.infer<typeof queueStatusQuerySchema>;

/**
 * Query schema for queue dashboard endpoint
 *
 * Validates query parameters for dashboard rendering.
 *
 * @example Valid query strings
 * ```
 * ?queueName=emails
 * ?refresh=30
 * ?queueName=reports&refresh=60
 * ```
 */
export const queueDashboardQuerySchema = z.object({
  /**
   * Filter to specific queue (optional)
   * If not provided, shows all queues
   */
  queueName: z.string().optional(),

  /**
   * Auto-refresh interval in seconds (optional)
   * Adds meta refresh tag to HTML
   * @minimum 5
   * @maximum 300
   */
  refresh: z.coerce.number().int().min(5).max(300).optional(),
});

/**
 * Inferred type for queue dashboard query parameters
 */
export type QueueDashboardQuery = z.infer<typeof queueDashboardQuerySchema>;

// ============================================================================
// HTTP Body Schemas
// ============================================================================

/**
 * Body schema for job creation endpoint
 *
 * Validates POST body for creating a new job.
 *
 * @example Valid body
 * ```json
 * {
 *   "queueName": "emails",
 *   "jobType": "send-welcome",
 *   "data": { "userId": "123", "template": "welcome" },
 *   "options": { "priority": 8, "maxRetries": 5 }
 * }
 * ```
 */
export const createJobBodySchema = z.object({
  /**
   * Queue to add the job to (required)
   */
  queueName: z
    .string({
      required_error: 'queueName is required',
      invalid_type_error: 'queueName must be a string',
    })
    .min(1, 'queueName cannot be empty'),

  /**
   * Job type identifier (required)
   * Must match a registered job handler
   */
  jobType: z
    .string({
      required_error: 'jobType is required',
      invalid_type_error: 'jobType must be a string',
    })
    .min(1, 'jobType cannot be empty'),

  /**
   * Job data payload (optional)
   * Passed to the job handler
   */
  data: z.unknown().optional(),

  /**
   * Job options (optional)
   * Priority, retries, timeout, metadata
   */
  options: z
    .object({
      priority: z.number().int().min(1).max(10).optional(),
      maxRetries: z.number().int().min(0).max(100).optional(),
      timeout: z.number().int().min(0).optional(),
      metadata: z.record(z.unknown()).optional(),
    })
    .optional(),
});

/**
 * Inferred type for create job body
 */
export type CreateJobBody = z.infer<typeof createJobBodySchema>;

/**
 * Body schema for job cancellation endpoint
 *
 * Validates POST body for cancelling a job.
 *
 * @example Valid body
 * ```json
 * {
 *   "jobId": "550e8400-e29b-41d4-a716-446655440000",
 *   "queueName": "emails",
 *   "reason": "User requested cancellation"
 * }
 * ```
 */
export const cancelJobBodySchema = z.object({
  /**
   * Job ID to cancel (required)
   * Must be a valid UUID
   */
  jobId: z
    .string({
      required_error: 'jobId is required',
      invalid_type_error: 'jobId must be a string',
    })
    .uuid('jobId must be a valid UUID'),

  /**
   * Queue name (optional)
   * If not provided, searches all queues
   */
  queueName: z.string().optional(),

  /**
   * Cancellation reason (optional)
   * Included in job cancelled event
   */
  reason: z.string().optional(),
});

/**
 * Inferred type for cancel job body
 */
export type CancelJobBody = z.infer<typeof cancelJobBodySchema>;

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
  attemptsMade: number;
  maxRetries: number;
  createdAt: number;
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
    attemptsMade: job.retries,
    maxRetries: job.maxRetries,
    createdAt: job.queuedAt,
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

  logger.debug('Fetching queue status', { queueName, status, limit });

  const queueNames = queueName ? [queueName] : queue.listQueues();

  const queues = await Promise.all(
    queueNames.map(async name => {
      const stats = await queue.getQueueStats(name);
      const jobs = await queue.listJobs(name, {
        status: status as JobStatus | undefined,
        limit: Number(limit),
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
 * Dashboard data gathered from queue service
 */
export interface DashboardData {
  queues: Array<{
    name: string;
    stats: QueueStats;
    jobs: Job[];
  }>;
  timestamp: number;
}

/**
 * Dashboard rendering options
 */
export interface DashboardOptions {
  /** Auto-refresh interval in seconds */
  refreshInterval?: number;
}

/**
 * Gather dashboard data from queue service
 *
 * @param queueService - Queue service instance
 * @param queueNames - Queue names to include
 * @returns Dashboard data
 * @internal
 */
async function gatherDashboardData(
  queueService: QueueService,
  queueNames: string[]
): Promise<DashboardData> {
  const queues = await Promise.all(
    queueNames.map(async name => {
      const stats = await queueService.getQueueStats(name);
      const jobs = await queueService.listJobs(name, { limit: 50 });
      return { name, stats, jobs };
    })
  );

  return {
    queues,
    timestamp: Date.now(),
  };
}

/**
 * Escape HTML special characters
 *
 * @param str - String to escape
 * @returns Escaped string
 * @internal
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Format timestamp for display
 *
 * @param ts - Timestamp in milliseconds
 * @returns Formatted date string
 * @internal
 */
function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString();
}

/**
 * Get status badge class
 *
 * @param status - Job status
 * @returns CSS class name
 * @internal
 */
function getStatusBadgeClass(status: JobStatus): string {
  switch (status) {
    case 'completed':
      return 'badge-success';
    case 'failed':
      return 'badge-error';
    case 'running':
      return 'badge-info';
    case 'cancelled':
      return 'badge-warning';
    case 'queued':
    default:
      return 'badge-default';
  }
}

/**
 * Render HTML dashboard
 *
 * Generates a standalone HTML dashboard with inline CSS.
 * Matches BlaizeJS metrics plugin styling.
 *
 * @param data - Dashboard data
 * @param options - Rendering options
 * @returns HTML string
 * @internal
 */
function renderDashboard(data: DashboardData, options: DashboardOptions = {}): string {
  const timestamp = formatTimestamp(data.timestamp);
  const refreshMeta = options.refreshInterval
    ? `<meta http-equiv="refresh" content="${options.refreshInterval}">`
    : '';

  const queueCards = data.queues
    .map(
      q => `
      <div class="card">
        <h3 class="card-title">${escapeHtml(q.name)}</h3>
        <div class="stats-grid">
          <div class="stat">
            <div class="stat-value">${q.stats.total}</div>
            <div class="stat-label">Total</div>
          </div>
          <div class="stat">
            <div class="stat-value">${q.stats.queued}</div>
            <div class="stat-label">Queued</div>
          </div>
          <div class="stat">
            <div class="stat-value">${q.stats.running}</div>
            <div class="stat-label">Running</div>
          </div>
          <div class="stat">
            <div class="stat-value">${q.stats.completed}</div>
            <div class="stat-label">Completed</div>
          </div>
          <div class="stat">
            <div class="stat-value">${q.stats.failed}</div>
            <div class="stat-label">Failed</div>
          </div>
          <div class="stat">
            <div class="stat-value">${q.stats.cancelled}</div>
            <div class="stat-label">Cancelled</div>
          </div>
        </div>
      </div>
    `
    )
    .join('');

  const jobRows = data.queues
    .flatMap(q =>
      q.jobs.slice(0, 20).map(
        job => `
        <tr>
          <td><code>${escapeHtml(job.id.slice(0, 8))}...</code></td>
          <td>${escapeHtml(job.queueName)}</td>
          <td>${escapeHtml(job.type)}</td>
          <td><span class="badge ${getStatusBadgeClass(job.status)}">${job.status}</span></td>
          <td>${job.priority}</td>
          <td>${job.progress ?? '-'}${job.progress !== undefined ? '%' : ''}</td>
          <td>${formatTimestamp(job.queuedAt)}</td>
        </tr>
      `
      )
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="BlaizeJS Queue Dashboard">
  ${refreshMeta}
  <title>BlaizeJS Queue Dashboard</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: #e4e4e7;
      min-height: 100vh;
      line-height: 1.6;
    }
    .container { max-width: 1200px; margin: 0 auto; padding: 0 20px; }
    .header {
      background: linear-gradient(135deg, #7b2ff7 0%, #f107a3 100%);
      padding: 24px 0;
      margin-bottom: 32px;
    }
    .header .title { font-size: 1.75rem; font-weight: 700; color: white; }
    .header .subtitle { color: rgba(255,255,255,0.8); font-size: 0.875rem; margin-top: 4px; }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 32px; }
    .card {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      padding: 20px;
    }
    .card-title { font-size: 1.125rem; font-weight: 600; margin-bottom: 16px; color: #a78bfa; }
    .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .stat { text-align: center; }
    .stat-value { font-size: 1.5rem; font-weight: 700; color: #f0f0f0; }
    .stat-label { font-size: 0.75rem; color: #a1a1aa; text-transform: uppercase; }
    .section { margin-bottom: 32px; }
    .section-title { font-size: 1.25rem; font-weight: 600; margin-bottom: 16px; color: #e4e4e7; }
    .table-container { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; background: rgba(255,255,255,0.02); border-radius: 8px; overflow: hidden; }
    th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.05); }
    th { background: rgba(255,255,255,0.05); font-weight: 600; font-size: 0.75rem; text-transform: uppercase; color: #a1a1aa; }
    td { font-size: 0.875rem; }
    tr:hover { background: rgba(255,255,255,0.02); }
    code { font-family: 'SF Mono', Monaco, 'Courier New', monospace; font-size: 0.8rem; background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 4px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 500; text-transform: uppercase; }
    .badge-success { background: rgba(34, 197, 94, 0.2); color: #22c55e; }
    .badge-error { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
    .badge-warning { background: rgba(234, 179, 8, 0.2); color: #eab308; }
    .badge-info { background: rgba(59, 130, 246, 0.2); color: #3b82f6; }
    .badge-default { background: rgba(161, 161, 170, 0.2); color: #a1a1aa; }
    .footer {
      text-align: center;
      padding: 24px 0;
      color: #71717a;
      font-size: 0.875rem;
      border-top: 1px solid rgba(255,255,255,0.05);
      margin-top: 32px;
    }
    .footer a { color: #a78bfa; text-decoration: none; }
    .footer a:hover { text-decoration: underline; }
    .empty { text-align: center; padding: 40px; color: #71717a; }
    @media (max-width: 768px) {
      .stats-grid { grid-template-columns: repeat(2, 1fr); }
      .header .title { font-size: 1.5rem; }
    }
  </style>
</head>
<body>
  <header class="header">
    <div class="container">
      <h1 class="title">🔥 BlaizeJS Queue</h1>
      <p class="subtitle">Last updated: ${timestamp}</p>
    </div>
  </header>

  <main class="container">
    <section class="cards">
      ${queueCards || '<div class="empty">No queues configured</div>'}
    </section>

    <section class="section">
      <h2 class="section-title">Recent Jobs</h2>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Queue</th>
              <th>Type</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Progress</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            ${jobRows || '<tr><td colspan="7" class="empty">No jobs found</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>
  </main>

  <footer class="footer">
    <div class="container">
      <p>Powered by <strong>BlaizeJS</strong> • <a href="/queue/metrics">Prometheus Metrics</a></p>
    </div>
  </footer>
</body>
</html>`;
}

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

  logger.debug('Rendering queue dashboard', { queueName, refresh });

  const queueNames = queueName ? [queueName] : queue.listQueues();
  const data = await gatherDashboardData(queue, queueNames);

  const html = renderDashboard(data, {
    refreshInterval: refresh ? Number(refresh) : undefined,
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

// ============================================================================
// Type Exports for Handler Signatures
// ============================================================================

/**
 * SSE handler function type (4-param signature)
 *
 * Used for type-safe handler definitions.
 */
export type SSEHandler = (
  stream: SSEStream,
  ctx: Context,
  params: Record<string, string>,
  logger: BlaizeLogger
) => Promise<void>;

/**
 * HTTP handler function type (3-param signature)
 *
 * Used for type-safe handler definitions.
 * Will be used by T17 handlers.
 */
export type HTTPHandler<TResult = unknown> = (
  ctx: Context,
  params: Record<string, string>,
  logger: BlaizeLogger
) => Promise<TResult>;
