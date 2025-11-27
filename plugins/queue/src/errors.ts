/**
 * Error Classes for Queue Plugin
 *
 * Custom error classes for queue-specific error conditions.
 * All errors extend BlaizeError for consistent error handling
 * across the BlaizeJS ecosystem.
 *
 * @module @blaizejs/queue/errors
 * @since 0.4.0
 */

import { BlaizeError, ErrorType, getCorrelationId } from 'blaizejs';

import type {
  HandlerNotFoundDetails,
  JobCancelledDetails,
  JobNotFoundDetails,
  JobTimeoutDetails,
  QueueConfigErrorDetails,
  QueueErrorDetails,
  QueueNotFoundDetails,
  StorageErrorDetails,
} from './types';

// ============================================================================
// Base Queue Error
// ============================================================================

/**
 * Base error class for all queue-related errors
 *
 * Extends BlaizeError to integrate with the BlaizeJS error system.
 * All queue-specific errors should extend this class.
 *
 * @example Basic usage
 * ```typescript
 * throw new QueueError('Queue operation failed', 500, {
 *   operation: 'process',
 *   queueName: 'emails'
 * });
 * ```
 *
 * @example Catching queue errors
 * ```typescript
 * try {
 *   await queue.add('email:send', data);
 * } catch (error) {
 *   if (error instanceof QueueError) {
 *     console.error(`Queue error: ${error.title}`, error.details);
 *   }
 * }
 * ```
 */
export class QueueError extends BlaizeError<QueueErrorDetails> {
  /**
   * Creates a new QueueError
   *
   * @param message - Human-readable error message
   * @param status - HTTP status code (default: 500)
   * @param details - Additional error context
   * @param correlationId - Optional correlation ID (auto-generated if not provided)
   */
  constructor(
    message: string,
    status: number = 500,
    details?: QueueErrorDetails,
    correlationId?: string
  ) {
    super(
      ErrorType.INTERNAL_SERVER_ERROR,
      message,
      status,
      correlationId ?? getCorrelationId(),
      details
    );
    this.name = 'QueueError';
  }
}

// ============================================================================
// Job Not Found Error
// ============================================================================

/**
 * Error thrown when a job cannot be found
 *
 * Used when attempting to get, cancel, or operate on a job that
 * doesn't exist in the queue storage.
 *
 * @example Basic usage
 * ```typescript
 * throw new JobNotFoundError('job_abc123');
 * ```
 *
 * @example With queue name
 * ```typescript
 * throw new JobNotFoundError('job_abc123', 'emails');
 * ```
 *
 * @example In route handler
 * ```typescript
 * const job = await queueService.getJob(jobId);
 * if (!job) {
 *   throw new JobNotFoundError(jobId, queueName);
 * }
 * ```
 */
export class JobNotFoundError extends BlaizeError<JobNotFoundDetails> {
  /**
   * Creates a new JobNotFoundError
   *
   * @param jobId - The job ID that was not found
   * @param queueName - Optional queue name where job was searched
   * @param correlationId - Optional correlation ID
   */
  constructor(jobId: string, queueName?: string, correlationId?: string) {
    const message = queueName
      ? `Job '${jobId}' not found in queue '${queueName}'`
      : `Job '${jobId}' not found`;

    super(ErrorType.NOT_FOUND, message, 404, correlationId ?? getCorrelationId(), {
      jobId,
      queueName,
    });
    this.name = 'JobNotFoundError';
  }
}

// ============================================================================
// Job Timeout Error
// ============================================================================

/**
 * Error thrown when a job execution exceeds its timeout
 *
 * This error is thrown when:
 * - Job execution time exceeds the configured timeout
 * - The AbortSignal is triggered due to timeout
 *
 * @example Handler receiving timeout
 * ```typescript
 * const handler: JobHandler = async (ctx) => {
 *   try {
 *     await longRunningOperation(ctx.signal);
 *   } catch (error) {
 *     if (ctx.signal.aborted) {
 *       // Job was cancelled or timed out
 *     }
 *     throw error;
 *   }
 * };
 * ```
 *
 * @example Catching timeout in application
 * ```typescript
 * try {
 *   await processJob(job);
 * } catch (error) {
 *   if (error instanceof JobTimeoutError) {
 *     console.error(`Job ${error.details.jobId} timed out after ${error.details.timeoutMs}ms`);
 *   }
 * }
 * ```
 */
export class JobTimeoutError extends BlaizeError<JobTimeoutDetails> {
  /**
   * Creates a new JobTimeoutError
   *
   * @param jobId - The job ID that timed out
   * @param queueName - Queue name where job was running
   * @param jobType - Type of the job
   * @param timeoutMs - Configured timeout in milliseconds
   * @param elapsedMs - Optional actual elapsed time
   * @param correlationId - Optional correlation ID
   */
  constructor(
    jobId: string,
    queueName: string,
    jobType: string,
    timeoutMs: number,
    elapsedMs?: number,
    correlationId?: string
  ) {
    const message = `Job '${jobId}' (${jobType}) timed out after ${timeoutMs}ms`;

    super(
      ErrorType.TIMEOUT_ERROR,
      message,
      408, // Request Timeout
      correlationId ?? getCorrelationId(),
      { jobId, queueName, jobType, timeoutMs, elapsedMs }
    );
    this.name = 'JobTimeoutError';
  }
}

// ============================================================================
// Job Cancelled Error
// ============================================================================

/**
 * Error thrown when a job is cancelled during execution
 *
 * This error indicates the job was intentionally cancelled,
 * either by user request or system action (e.g., shutdown).
 *
 * @example Cancelling a job
 * ```typescript
 * const cancelled = await queueService.cancelJob(jobId, 'User requested cancellation');
 * // The running handler will receive this error
 * ```
 *
 * @example Handling cancellation in handler
 * ```typescript
 * const handler: JobHandler = async (ctx) => {
 *   ctx.signal.addEventListener('abort', () => {
 *     // Cleanup on cancellation
 *   });
 *
 *   for (const item of items) {
 *     if (ctx.signal.aborted) {
 *       throw new JobCancelledError(ctx.jobId, queueName, jobType, 'Aborted by user');
 *     }
 *     await processItem(item);
 *   }
 * };
 * ```
 */
export class JobCancelledError extends BlaizeError<JobCancelledDetails> {
  /**
   * Creates a new JobCancelledError
   *
   * @param jobId - The job ID that was cancelled
   * @param queueName - Queue name where job was running
   * @param jobType - Type of the job
   * @param reason - Optional reason for cancellation
   * @param wasRunning - Whether job was actively running when cancelled
   * @param correlationId - Optional correlation ID
   */
  constructor(
    jobId: string,
    queueName: string,
    jobType: string,
    reason?: string,
    wasRunning: boolean = false,
    correlationId?: string
  ) {
    const message = reason
      ? `Job '${jobId}' (${jobType}) was cancelled: ${reason}`
      : `Job '${jobId}' (${jobType}) was cancelled`;

    super(
      ErrorType.HTTP_ERROR, // Using HTTP_ERROR as there's no specific cancelled type
      message,
      499, // Client Closed Request (nginx convention)
      correlationId ?? getCorrelationId(),
      { jobId, queueName, jobType, reason, wasRunning }
    );
    this.name = 'JobCancelledError';
  }
}

// ============================================================================
// Handler Not Found Error
// ============================================================================

/**
 * Error thrown when no handler is registered for a job type
 *
 * This is an internal error indicating a configuration problem -
 * a job was added for a type that has no registered handler.
 *
 * @example This error occurs when
 * ```typescript
 * // Job added without handler
 * await queue.add('email:send', data);
 *
 * // But no handler was registered
 * // queue.registerHandler('email:send', handler); // Missing!
 *
 * // When the queue tries to process, this error is thrown
 * ```
 *
 * @example Preventing this error
 * ```typescript
 * // Always register handlers before adding jobs
 * queue.registerHandler('email:send', emailHandler);
 * queue.registerHandler('report:generate', reportHandler);
 *
 * // Now jobs can be added safely
 * await queue.add('email:send', emailData);
 * ```
 */
export class HandlerNotFoundError extends BlaizeError<HandlerNotFoundDetails> {
  /**
   * Creates a new HandlerNotFoundError
   *
   * @param jobType - The job type that has no handler
   * @param queueName - Queue name where handler was expected
   * @param registeredHandlers - Optional list of registered handler names
   * @param correlationId - Optional correlation ID
   */
  constructor(
    jobType: string,
    queueName: string,
    registeredHandlers?: string[],
    correlationId?: string
  ) {
    const message = `No handler registered for job type '${jobType}' in queue '${queueName}'`;

    super(ErrorType.INTERNAL_SERVER_ERROR, message, 500, correlationId ?? getCorrelationId(), {
      jobType,
      queueName,
      registeredHandlers,
    });
    this.name = 'HandlerNotFoundError';
  }
}

// ============================================================================
// Queue Not Found Error
// ============================================================================

/**
 * Error thrown when a queue doesn't exist
 *
 * This error is thrown when attempting to access a queue that
 * was not configured in the plugin options.
 *
 * @example This error occurs when
 * ```typescript
 * // Plugin configured with only 'default' queue
 * createQueuePlugin({
 *   queues: {
 *     default: { concurrency: 5 }
 *   }
 * });
 *
 * // Trying to access non-existent queue
 * await queueService.add('emails', 'email:send', data);
 * // Throws: QueueNotFoundError: Queue 'emails' not found
 * ```
 *
 * @example Preventing this error
 * ```typescript
 * // Configure all needed queues
 * createQueuePlugin({
 *   queues: {
 *     default: { concurrency: 5 },
 *     emails: { concurrency: 10 },
 *     reports: { concurrency: 2 }
 *   }
 * });
 * ```
 */
export class QueueNotFoundError extends BlaizeError<QueueNotFoundDetails> {
  /**
   * Creates a new QueueNotFoundError
   *
   * @param queueName - The queue name that was not found
   * @param availableQueues - Optional list of available queue names
   * @param correlationId - Optional correlation ID
   */
  constructor(queueName: string, availableQueues?: string[], correlationId?: string) {
    const message = availableQueues?.length
      ? `Queue '${queueName}' not found. Available queues: ${availableQueues.join(', ')}`
      : `Queue '${queueName}' not found`;

    super(ErrorType.NOT_FOUND, message, 404, correlationId ?? getCorrelationId(), {
      queueName,
      availableQueues,
    });
    this.name = 'QueueNotFoundError';
  }
}

// ============================================================================
// Queue Config Error
// ============================================================================

/**
 * Error thrown when queue configuration is invalid
 *
 * This error is thrown during plugin initialization when the
 * provided configuration doesn't pass validation.
 *
 * @example Invalid configuration
 * ```typescript
 * // This will throw QueueConfigError
 * createQueuePlugin({
 *   queues: {
 *     default: {
 *       concurrency: -1 // Invalid: must be >= 1
 *     }
 *   }
 * });
 * ```
 *
 * @example Catching config errors
 * ```typescript
 * try {
 *   const plugin = createQueuePlugin(config);
 * } catch (error) {
 *   if (error instanceof QueueConfigError) {
 *     console.error(`Config error in '${error.details.field}':`, error.details.expected);
 *   }
 * }
 * ```
 */
export class QueueConfigError extends BlaizeError<QueueConfigErrorDetails> {
  /**
   * Creates a new QueueConfigError
   *
   * @param message - Human-readable error message
   * @param field - The configuration field that is invalid
   * @param value - The invalid value provided
   * @param expected - Description of what was expected
   * @param correlationId - Optional correlation ID
   */
  constructor(
    message: string,
    field: string,
    value: unknown,
    expected: string,
    correlationId?: string
  ) {
    super(
      ErrorType.VALIDATION_ERROR,
      message,
      400, // Bad Request
      correlationId ?? getCorrelationId(),
      { field, value, expected }
    );
    this.name = 'QueueConfigError';
  }
}

// ============================================================================
// Storage Error
// ============================================================================

/**
 * Error thrown when a storage adapter operation fails
 *
 * This error wraps underlying storage failures (Redis connection lost,
 * database error, etc.) to provide consistent error handling.
 *
 * @example Storage adapter throwing error
 * ```typescript
 * class RedisStorage implements QueueStorageAdapter {
 *   async enqueue(queueName: string, job: Job): Promise<void> {
 *     try {
 *       await this.redis.lpush(`queue:${queueName}`, JSON.stringify(job));
 *     } catch (error) {
 *       throw new StorageError(
 *         'Failed to enqueue job',
 *         'enqueue',
 *         queueName,
 *         job.id,
 *         error.message
 *       );
 *     }
 *   }
 * }
 * ```
 *
 * @example Handling storage errors
 * ```typescript
 * try {
 *   await queue.add('email:send', data);
 * } catch (error) {
 *   if (error instanceof StorageError) {
 *     console.error(`Storage ${error.details.operation} failed:`, error.details.originalError);
 *     // Maybe retry or use fallback
 *   }
 * }
 * ```
 */
export class StorageError extends BlaizeError<StorageErrorDetails> {
  /**
   * Creates a new StorageError
   *
   * @param message - Human-readable error message
   * @param operation - The storage operation that failed
   * @param queueName - Optional queue name involved
   * @param jobId - Optional job ID involved
   * @param originalError - Optional original error message
   * @param correlationId - Optional correlation ID
   */
  constructor(
    message: string,
    operation: StorageErrorDetails['operation'],
    queueName?: string,
    jobId?: string,
    originalError?: string,
    correlationId?: string
  ) {
    super(ErrorType.INTERNAL_SERVER_ERROR, message, 500, correlationId ?? getCorrelationId(), {
      operation,
      queueName,
      jobId,
      originalError,
    });
    this.name = 'StorageError';
  }
}

// ============================================================================
// Handler Already Registered Error
// ============================================================================

/**
 * Details for handler already registered errors
 */
export interface HandlerAlreadyRegisteredDetails {
  /** The job type that already has a handler */
  jobType: string;
  /** Queue name where handler is registered */
  queueName: string;
}

/**
 * Error thrown when attempting to register a duplicate handler
 *
 * Each job type can only have one handler registered per queue.
 * Attempting to register a second handler throws this error.
 *
 * @example This error occurs when
 * ```typescript
 * queue.registerHandler('email:send', handler1);
 * queue.registerHandler('email:send', handler2); // Throws!
 * ```
 *
 * @example Preventing this error
 * ```typescript
 * // Check if handler exists before registering
 * if (!queue.hasHandler('email:send')) {
 *   queue.registerHandler('email:send', handler);
 * }
 * ```
 */
export class HandlerAlreadyRegisteredError extends BlaizeError<HandlerAlreadyRegisteredDetails> {
  /**
   * Creates a new HandlerAlreadyRegisteredError
   *
   * @param jobType - The job type that already has a handler
   * @param queueName - Queue name where handler is registered
   * @param correlationId - Optional correlation ID
   */
  constructor(jobType: string, queueName: string, correlationId?: string) {
    const message = `Handler already registered for job type '${jobType}' in queue '${queueName}'`;

    super(
      ErrorType.CONFLICT,
      message,
      409, // Conflict
      correlationId ?? getCorrelationId(),
      { jobType, queueName }
    );
    this.name = 'HandlerAlreadyRegisteredError';
  }
}

// ============================================================================
// Job Validation Error
// ============================================================================

/**
 * Details for job validation errors
 */
export interface JobValidationErrorDetails {
  /** The job type being validated */
  jobType: string;
  /** Queue name */
  queueName: string;
  /** Validation errors from Zod */
  validationErrors: Array<{
    path: (string | number)[];
    message: string;
  }>;
  /** The invalid data that was provided */
  invalidData?: unknown;
}

/**
 * Error thrown when job data fails schema validation
 *
 * Each job type has a Zod schema that validates input data.
 * If data doesn't match the schema, this error is thrown.
 *
 * @example This error occurs when
 * ```typescript
 * // Schema expects { to: string (email) }
 * await queue.add('email:send', { to: 'not-an-email' });
 * // Throws: JobValidationError
 * ```
 *
 * @example Handling validation errors
 * ```typescript
 * try {
 *   await queue.add('email:send', data);
 * } catch (error) {
 *   if (error instanceof JobValidationError) {
 *     console.error('Validation failed:', error.details.validationErrors);
 *   }
 * }
 * ```
 */
export class JobValidationError extends BlaizeError<JobValidationErrorDetails> {
  /**
   * Creates a new JobValidationError
   *
   * @param jobType - The job type being validated
   * @param queueName - Queue name
   * @param validationErrors - Array of validation error details
   * @param invalidData - Optional invalid data that was provided
   * @param correlationId - Optional correlation ID
   */
  constructor(
    jobType: string,
    queueName: string,
    validationErrors: JobValidationErrorDetails['validationErrors'],
    invalidData?: unknown,
    correlationId?: string
  ) {
    const errorMessages = validationErrors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    const message = `Invalid data for job type '${jobType}': ${errorMessages}`;

    super(
      ErrorType.VALIDATION_ERROR,
      message,
      400, // Bad Request
      correlationId ?? getCorrelationId(),
      { jobType, queueName, validationErrors, invalidData }
    );
    this.name = 'JobValidationError';
  }
}
