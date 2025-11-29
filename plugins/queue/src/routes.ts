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
 * ## HTTP Handlers (3-param signature) - Coming in T17
 * - `queueStatusHandler(ctx, params, logger)` - Queue status JSON
 * - `createJobHandler(ctx, params, logger)` - Create new job
 * - `cancelJobHandler(ctx, params, logger)` - Cancel job
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
 * @module @blaizejs/queue/routes
 * @since 0.4.0
 */
import { ServiceNotAvailableError, NotFoundError, getCorrelationId } from 'blaizejs';
import { z } from 'zod';

import type { QueueService } from './queue-service';
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
  const queue = ctx.services.queue as QueueService | undefined;

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
