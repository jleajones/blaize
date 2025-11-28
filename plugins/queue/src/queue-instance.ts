/**
 * Queue Instance Implementation
 *
 * QueueInstance is the core class that manages jobs for a single named queue.
 * It extends EventEmitter for job lifecycle events, delegates storage operations
 * to the injected QueueStorageAdapter, tracks running jobs, and coordinates
 * with handlers.
 *
 * @module @blaizejs/queue/queue-instance
 * @since 0.4.0
 */

import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';

import { HandlerAlreadyRegisteredError } from './errors';

import type {
  QueueStorageAdapter,
  QueueConfig,
  Job,
  JobContext,
  JobHandler,
  JobOptions,
  JobStatus,
  JobError,
  QueueStats,
  JobPriority,
} from './types';
import type { BlaizeLogger } from 'blaizejs';

// ============================================================================
// Constants
// ============================================================================

/** Default concurrency for job processing */
const DEFAULT_CONCURRENCY = 10;

/** Default job timeout in milliseconds */
const DEFAULT_TIMEOUT = 30000;

/** Default maximum retry attempts */
const DEFAULT_MAX_RETRIES = 3;

/** Default job priority */
const DEFAULT_PRIORITY: JobPriority = 5;

/** Maximum event listeners for SSE subscriptions */
const MAX_EVENT_LISTENERS = 1000;

/** Poll interval when queue is empty or at concurrency limit (ms) */
const POLL_INTERVAL_MS = 100;

/** Default graceful shutdown timeout */
const DEFAULT_SHUTDOWN_TIMEOUT = 30000;

// ============================================================================
// Types
// ============================================================================

/**
 * Options for stopping the queue
 */
export interface StopOptions {
  /** Whether to wait for running jobs to complete */
  graceful?: boolean;

  /** Maximum time to wait for graceful shutdown (ms) */
  timeout?: number;
}

/**
 * Event signatures for QueueInstance
 */
export interface QueueInstanceEvents {
  'job:queued': (job: Job) => void;
  'job:started': (job: Job) => void;
  'job:progress': (jobId: string, percent: number, message?: string) => void;
  'job:completed': (job: Job, result: unknown) => void;
  'job:failed': (job: Job, error: JobError) => void;
  'job:cancelled': (job: Job, reason?: string) => void;
  'job:retry': (job: Job, attempt: number) => void;
}

// ============================================================================
// QueueInstance Class
// ============================================================================

/**
 * Manages jobs for a single named queue
 *
 * QueueInstance provides:
 * - Type-safe job submission
 * - Handler registration for job types
 * - Event emission for SSE streaming
 * - Job cancellation with AbortController
 * - Statistics via storage adapter
 * - Concurrency-limited processing loop
 *
 * @example Basic usage
 * ```typescript
 * import { QueueInstance, createInMemoryStorage } from '@blaizejs/queue';
 *
 * const storage = createInMemoryStorage();
 * const logger = parentLogger.child({ component: 'queue' });
 *
 * const queue = new QueueInstance(
 *   { name: 'emails', concurrency: 5, defaultTimeout: 30000, defaultMaxRetries: 3 },
 *   storage,
 *   logger
 * );
 *
 * // Register handler
 * queue.registerHandler('email:send', async (ctx) => {
 *   await sendEmail(ctx.data);
 *   return { sent: true };
 * });
 *
 * // Add job
 * const jobId = await queue.add('email:send', { to: 'user@example.com' });
 *
 * // Start processing
 * await queue.start();
 * ```
 *
 * @example Event handling for SSE
 * ```typescript
 * queue.on('job:progress', (jobId, percent, message) => {
 *   stream.send({ event: 'progress', data: { jobId, percent, message } });
 * });
 *
 * queue.on('job:completed', (job, result) => {
 *   stream.send({ event: 'completed', data: { jobId: job.id, result } });
 * });
 * ```
 */
export class QueueInstance extends EventEmitter {
  // ==========================================================================
  // Public Properties
  // ==========================================================================

  /** Queue name (unique identifier) */
  public readonly name: string;

  // ==========================================================================
  // Private Configuration
  // ==========================================================================

  /** Maximum concurrent job executions */
  private readonly concurrency: number;

  /** Default job timeout in milliseconds */
  private readonly defaultTimeout: number;

  /** Default maximum retry attempts */
  private readonly defaultMaxRetries: number;

  /** Logger instance (child logger with queue context) */
  private readonly logger: BlaizeLogger;

  /** Storage adapter for job persistence */
  private readonly storage: QueueStorageAdapter;

  // ==========================================================================
  // Private Runtime State
  // ==========================================================================

  /** Registered job handlers by type */
  private readonly handlers: Map<string, JobHandler<unknown, unknown>>;

  /** Currently running job IDs */
  private readonly runningJobs: Set<string>;

  /** AbortControllers for running jobs (for cancellation) */
  private readonly abortControllers: Map<string, AbortController>;

  /** Whether the queue is actively processing */
  private isRunning: boolean;

  /** Whether the queue is shutting down */
  private isShuttingDown: boolean;

  // ==========================================================================
  // Constructor
  // ==========================================================================

  /**
   * Create a new QueueInstance
   *
   * @param config - Queue configuration (name, concurrency, defaults)
   * @param storage - Storage adapter for job persistence (injected)
   * @param logger - Logger instance (child logger will be created)
   *
   * @example
   * ```typescript
   * const queue = new QueueInstance(
   *   {
   *     name: 'emails',
   *     concurrency: 5,
   *     defaultTimeout: 30000,
   *     defaultMaxRetries: 3,
   *   },
   *   storage,
   *   logger
   * );
   * ```
   */
  constructor(config: QueueConfig, storage: QueueStorageAdapter, logger: BlaizeLogger) {
    super();

    // Support many SSE subscriptions
    this.setMaxListeners(MAX_EVENT_LISTENERS);

    // Configuration
    this.name = config.name;
    this.concurrency = config.concurrency ?? DEFAULT_CONCURRENCY;
    this.defaultTimeout = config.defaultTimeout ?? DEFAULT_TIMEOUT;
    this.defaultMaxRetries = config.defaultMaxRetries ?? DEFAULT_MAX_RETRIES;

    // Injected dependencies
    this.storage = storage;

    // Create child logger with queue context
    this.logger = logger.child({ queue: this.name });

    // Runtime state
    this.handlers = new Map();
    this.runningJobs = new Set();
    this.abortControllers = new Map();
    this.isRunning = false;
    this.isShuttingDown = false;

    this.logger.debug('QueueInstance created', {
      queue: this.name,
      concurrency: this.concurrency,
      defaultTimeout: this.defaultTimeout,
      defaultMaxRetries: this.defaultMaxRetries,
    });
  }

  // ==========================================================================
  // Job Submission
  // ==========================================================================

  /**
   * Add a job to the queue
   *
   * Creates a job record, enqueues it in storage, and emits
   * a 'job:queued' event.
   *
   * @typeParam TData - Type of job data
   * @param jobType - Type of job (must have a registered handler)
   * @param data - Job data payload
   * @param options - Optional job-specific options
   * @returns Job ID (UUID)
   *
   * @example Basic usage
   * ```typescript
   * const jobId = await queue.add('email:send', {
   *   to: 'user@example.com',
   *   subject: 'Welcome!'
   * });
   * console.log(`Job created: ${jobId}`);
   * ```
   *
   * @example With options
   * ```typescript
   * const jobId = await queue.add('report:generate', {
   *   reportId: 'rpt_123'
   * }, {
   *   priority: 10,
   *   timeout: 300000,
   *   metadata: { requestedBy: 'admin' }
   * });
   * ```
   */
  async add<TData>(jobType: string, data: TData, options?: JobOptions): Promise<string> {
    // Generate job ID
    const jobId = randomUUID();

    // Merge options with defaults
    const priority = options?.priority ?? DEFAULT_PRIORITY;
    const timeout = options?.timeout ?? this.defaultTimeout;
    const maxRetries = options?.maxRetries ?? this.defaultMaxRetries;
    const metadata = options?.metadata ?? {};

    // Create job record
    const job: Job = {
      id: jobId,
      type: jobType,
      queueName: this.name,
      data,
      status: 'queued',
      priority,
      progress: 0,
      queuedAt: Date.now(),
      retries: 0,
      maxRetries,
      timeout,
      metadata,
    };

    // Enqueue in storage
    await this.storage.enqueue(this.name, job);

    // Emit event
    this.emit('job:queued', job);

    this.logger.debug('Job added to queue', {
      jobId,
      jobType,
      priority,
      queue: this.name,
    });

    return jobId;
  }

  // ==========================================================================
  // Handler Registration
  // ==========================================================================

  /**
   * Register a handler for a job type
   *
   * Each job type can only have one handler. Attempting to register
   * a second handler for the same type throws an error.
   *
   * @typeParam TData - Type of job data the handler receives
   * @typeParam TResult - Type of result the handler returns
   * @param jobType - Type of job to handle
   * @param handler - Async function to process the job
   *
   * @throws {HandlerAlreadyRegisteredError} If handler already registered
   *
   * @example
   * ```typescript
   * queue.registerHandler<EmailData, EmailResult>('email:send', async (ctx) => {
   *   ctx.logger.info('Sending email', { to: ctx.data.to });
   *
   *   // Check for cancellation
   *   if (ctx.signal.aborted) {
   *     throw new Error('Job cancelled');
   *   }
   *
   *   await ctx.progress(50, 'Connecting to SMTP');
   *   const result = await sendEmail(ctx.data);
   *   await ctx.progress(100, 'Email sent');
   *
   *   return result;
   * });
   * ```
   */
  registerHandler<TData, TResult>(jobType: string, handler: JobHandler<TData, TResult>): void {
    // Check for duplicate registration
    if (this.handlers.has(jobType)) {
      throw new HandlerAlreadyRegisteredError(jobType, this.name);
    }

    // Store handler
    this.handlers.set(jobType, handler as JobHandler<unknown, unknown>);

    this.logger.debug('Handler registered', {
      jobType,
      queue: this.name,
    });
  }

  /**
   * Check if a handler is registered for a job type
   *
   * @param jobType - Type of job to check
   * @returns true if handler is registered
   *
   * @example
   * ```typescript
   * if (!queue.hasHandler('email:send')) {
   *   queue.registerHandler('email:send', emailHandler);
   * }
   * ```
   */
  hasHandler(jobType: string): boolean {
    return this.handlers.has(jobType);
  }

  // ==========================================================================
  // Lifecycle Methods
  // ==========================================================================

  /**
   * Start processing jobs
   *
   * Begins the job processing loop. Jobs are dequeued from storage
   * and executed by registered handlers up to the concurrency limit.
   *
   * The processing loop runs asynchronously (fire and forget) and
   * continues until `stop()` is called.
   *
   * @example
   * ```typescript
   * await queue.start();
   * console.log('Queue is now processing jobs');
   * ```
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.debug('Queue already running', { queue: this.name });
      return;
    }

    this.isRunning = true;
    this.isShuttingDown = false;

    this.logger.info('Queue started', { queue: this.name });

    // Fire and forget - processing loop runs in background
    this.processJobs().catch(error => {
      this.logger.error('Processing loop error', {
        queue: this.name,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  /**
   * Stop processing jobs
   *
   * Gracefully stops the processing loop. If graceful=true (default),
   * waits for running jobs to complete up to the timeout.
   *
   * @param options - Stop options
   * @param options.graceful - Whether to wait for running jobs (default: true)
   * @param options.timeout - Maximum wait time in ms (default: 30000)
   *
   * @example
   * ```typescript
   * // Graceful shutdown (default)
   * await queue.stop();
   *
   * // Force stop immediately
   * await queue.stop({ graceful: false });
   *
   * // Custom timeout
   * await queue.stop({ graceful: true, timeout: 60000 });
   * ```
   */
  async stop(options?: StopOptions): Promise<void> {
    if (this.isShuttingDown) {
      this.logger.debug('Queue already shutting down', { queue: this.name });
      return;
    }

    const graceful = options?.graceful ?? true;
    const timeout = options?.timeout ?? DEFAULT_SHUTDOWN_TIMEOUT;

    this.isShuttingDown = true;

    this.logger.info('Queue stopping', {
      queue: this.name,
      graceful,
      runningJobs: this.runningJobs.size,
    });

    if (graceful && this.runningJobs.size > 0) {
      // Wait for running jobs to complete (with timeout)
      const startTime = Date.now();
      while (this.runningJobs.size > 0) {
        if (Date.now() - startTime > timeout) {
          this.logger.warn('Stop timeout reached, force stopping', {
            queue: this.name,
            remainingJobs: this.runningJobs.size,
          });
          break;
        }
        await this.delay(100);
      }
    }

    this.isRunning = false;
    this.logger.info('Queue stopped', { queue: this.name });
  }

  // ==========================================================================
  // Job Retrieval
  // ==========================================================================

  /**
   * Get a specific job by ID
   *
   * @param jobId - Unique job identifier
   * @returns The job if found, or undefined
   *
   * @example
   * ```typescript
   * const job = await queue.getJob(jobId);
   * if (job) {
   *   console.log(`Job status: ${job.status}`);
   * }
   * ```
   */
  async getJob(jobId: string): Promise<Job | undefined> {
    const job = await this.storage.getJob(jobId, this.name);
    return job ?? undefined;
  }

  /**
   * List jobs matching filters
   *
   * @param options - Filter options
   * @param options.status - Filter by job status
   * @param options.limit - Maximum number of jobs to return
   * @returns Array of matching jobs
   *
   * @example
   * ```typescript
   * // Get all failed jobs
   * const failed = await queue.listJobs({ status: 'failed' });
   *
   * // Get recent completed jobs
   * const completed = await queue.listJobs({
   *   status: 'completed',
   *   limit: 10,
   * });
   * ```
   */
  async listJobs(options?: { status?: JobStatus; limit?: number }): Promise<Job[]> {
    return this.storage.listJobs(this.name, {
      status: options?.status,
      limit: options?.limit,
    });
  }

  // ==========================================================================
  // Job Cancellation
  // ==========================================================================

  /**
   * Cancel a job
   *
   * If the job is running, triggers its AbortController to signal cancellation.
   * Updates job status to 'cancelled' and emits 'job:cancelled' event.
   *
   * @param jobId - Job ID to cancel
   * @param reason - Optional cancellation reason
   * @returns true if job was cancelled, false if not found
   *
   * @example
   * ```typescript
   * const cancelled = await queue.cancelJob(jobId, 'User requested');
   * if (cancelled) {
   *   console.log('Job cancelled successfully');
   * }
   * ```
   */
  async cancelJob(jobId: string, reason?: string): Promise<boolean> {
    const job = await this.storage.getJob(jobId, this.name);
    if (!job) {
      return false;
    }

    // If job is running, abort it
    const controller = this.abortControllers.get(jobId);
    if (controller) {
      controller.abort(reason ?? 'Job cancelled');
    }

    // Update status
    await this.storage.updateJob(jobId, {
      status: 'cancelled',
      completedAt: Date.now(),
    });

    // Get updated job for event
    const updatedJob = await this.storage.getJob(jobId, this.name);
    if (updatedJob) {
      this.emit('job:cancelled', updatedJob, reason);
    }

    this.logger.info('Job cancelled', {
      jobId,
      queue: this.name,
      reason,
      wasRunning: !!controller,
    });

    return true;
  }

  // ==========================================================================
  // Statistics
  // ==========================================================================

  /**
   * Get queue statistics
   *
   * @returns Queue statistics (total, queued, running, completed, failed, cancelled)
   *
   * @example
   * ```typescript
   * const stats = await queue.getStats();
   * console.log(`Total: ${stats.total}, Running: ${stats.running}`);
   * ```
   */
  async getStats(): Promise<QueueStats> {
    return this.storage.getQueueStats(this.name);
  }

  // ==========================================================================
  // Processing Loop
  // ==========================================================================

  /**
   * Main processing loop (processQueue)
   *
   * Continuously dequeues jobs from storage and executes them
   * while respecting the concurrency limit. Runs until `isShuttingDown`
   * is set to true.
   *
   * @internal
   */
  private async processJobs(): Promise<void> {
    this.logger.debug('Processing loop started', { queue: this.name });

    while (!this.isShuttingDown) {
      // At concurrency limit? Wait and retry
      if (this.runningJobs.size >= this.concurrency) {
        this.logger.debug('At concurrency limit, waiting', {
          queue: this.name,
          running: this.runningJobs.size,
          concurrency: this.concurrency,
        });
        await this.delay(POLL_INTERVAL_MS);
        continue;
      }

      // Dequeue next job from storage
      const job = await this.storage.dequeue(this.name);
      if (!job) {
        // Queue empty, wait before polling again
        await this.delay(POLL_INTERVAL_MS);
        continue;
      }

      this.logger.debug('Job dequeued for processing', {
        jobId: job.id,
        jobType: job.type,
        queue: this.name,
      });

      // Track as running BEFORE async execution starts (critical for concurrency control)
      this.runningJobs.add(job.id);

      // Execute job (non-blocking - fire and forget)
      this.executeJob(job.id).catch(err => {
        this.logger.error('Job execution error', {
          jobId: job.id,
          queue: this.name,
          error: err instanceof Error ? err.message : String(err),
        });
        // Ensure cleanup if executeJob fails early
        this.runningJobs.delete(job.id);
      });
    }

    this.logger.debug('Processing loop stopped', { queue: this.name });
  }

  // ==========================================================================
  // Job Execution
  // ==========================================================================

  /**
   * Execute a single job
   *
   * Creates the job context with scoped logger, runs the handler with
   * timeout enforcement, and updates job status on completion or failure.
   *
   * @param jobId - ID of the job to execute
   *
   * @internal
   */
  private async executeJob(jobId: string): Promise<void> {
    // Get job from storage
    const job = await this.storage.getJob(jobId, this.name);
    if (!job) {
      this.logger.warn('Job not found for execution', {
        jobId,
        queue: this.name,
      });
      this.runningJobs.delete(jobId);
      return;
    }

    // Get handler for job type
    const handler = this.handlers.get(job.type);
    if (!handler) {
      await this.handleNoHandler(job);
      return;
    }

    // Create job-scoped child logger with context
    const jobLogger = this.createJobLogger(job);

    // Create AbortController for this job
    const controller = new AbortController();
    this.abortControllers.set(jobId, controller);

    try {
      // Update job status to running
      await this.storage.updateJob(jobId, {
        status: 'running',
        startedAt: Date.now(),
      });

      const runningJob = await this.storage.getJob(jobId, this.name);
      if (runningJob) {
        this.emit('job:started', runningJob);
      }

      jobLogger.info('Job started', {
        timeout: job.timeout,
        maxRetries: job.maxRetries,
        attempt: job.retries + 1,
      });

      // Create JobContext for handler execution
      const ctx = this.createJobContext(job, jobLogger, controller.signal);

      // Execute the handler with timeout
      const result = await this.executeWithTimeout(handler, ctx, job.timeout, controller);

      // Handle successful completion
      await this.handleJobCompletion(job, result, jobLogger);
    } catch (err) {
      // Handle job failure
      await this.handleJobFailure(job, err, jobLogger);
    } finally {
      // Clean up
      this.abortControllers.delete(jobId);
      this.runningJobs.delete(jobId);
    }
  }

  /**
   * Create a job-scoped child logger
   *
   * Includes jobId, jobType, queueName, and attempt number.
   *
   * @param job - Job to create logger for
   * @returns Child logger with job context
   *
   * @internal
   */
  private createJobLogger(job: Job): BlaizeLogger {
    return this.logger.child({
      jobId: job.id,
      jobType: job.type,
      queueName: this.name,
      attempt: job.retries + 1,
    });
  }

  /**
   * Create the JobContext passed to handlers
   *
   * @param job - Job being executed
   * @param logger - Job-scoped logger
   * @param signal - AbortSignal for cancellation
   * @returns JobContext object
   *
   * @internal
   */
  private createJobContext(
    job: Job,
    logger: BlaizeLogger,
    signal: AbortSignal
  ): JobContext<unknown> {
    const jobId = job.id;

    return {
      jobId: job.id,
      data: job.data,
      logger,
      signal,
      progress: async (percent: number, message?: string): Promise<void> => {
        // Update storage
        await this.storage.updateJob(jobId, {
          progress: percent,
          progressMessage: message,
        });

        // Emit event
        this.emit('job:progress', jobId, percent, message);

        // Log progress
        logger.debug('Job progress updated', { percent, message });
      },
    };
  }

  /**
   * Execute handler with timeout enforcement
   *
   * Races the handler against a timeout. If the timeout fires first,
   * the abort signal is triggered and the handler should stop.
   *
   * @param handler - Job handler to execute
   * @param ctx - Job context
   * @param timeout - Timeout in milliseconds
   * @param controller - AbortController for manual cancellation
   * @returns Handler result
   * @throws TimeoutError if job exceeds timeout
   * @throws Error if job is cancelled or handler fails
   *
   * @internal
   */
  private async executeWithTimeout(
    handler: JobHandler<unknown, unknown>,
    ctx: JobContext<unknown>,
    timeout: number,
    controller: AbortController
  ): Promise<unknown> {
    // Create a combined controller for both timeout and manual cancellation
    const combinedController = new AbortController();

    // Set up timeout
    const timeoutId = setTimeout(() => {
      combinedController.abort(new Error('Job timed out'));
    }, timeout);

    // Listen for manual cancellation
    const onCancel = () => {
      combinedController.abort(new Error('Job cancelled'));
    };
    controller.signal.addEventListener('abort', onCancel);

    // Update context with combined signal
    const ctxWithCombinedSignal: JobContext<unknown> = {
      ...ctx,
      signal: combinedController.signal,
    };

    // Create timeout promise that rejects
    const timeoutPromise = new Promise<never>((_, reject) => {
      combinedController.signal.addEventListener('abort', () => {
        reject(combinedController.signal.reason ?? new Error('Job aborted'));
      });
    });

    try {
      // Race handler against abort signal
      const result = await Promise.race([handler(ctxWithCombinedSignal), timeoutPromise]);
      return result;
    } finally {
      // Clean up
      clearTimeout(timeoutId);
      controller.signal.removeEventListener('abort', onCancel);
    }
  }

  /**
   * Handle case when no handler is registered for job type
   *
   * @param job - Job that has no handler
   *
   * @internal
   */
  private async handleNoHandler(job: Job): Promise<void> {
    this.logger.error('No handler registered for job type', {
      jobId: job.id,
      jobType: job.type,
      queue: this.name,
      registeredHandlers: Array.from(this.handlers.keys()),
    });

    const errorObj: JobError = {
      message: `No handler registered for job type '${job.type}'`,
      code: 'HANDLER_NOT_FOUND',
    };

    await this.storage.updateJob(job.id, {
      status: 'failed',
      completedAt: Date.now(),
      error: errorObj,
    });

    const failedJob = await this.storage.getJob(job.id, this.name);
    if (failedJob) {
      this.emit('job:failed', failedJob, errorObj);
    }

    this.runningJobs.delete(job.id);
  }

  /**
   * Handle successful job completion
   *
   * Updates job state to completed, stores result, and emits event.
   *
   * @param job - Completed job
   * @param result - Handler result
   * @param logger - Job-scoped logger
   *
   * @internal
   */
  private async handleJobCompletion(
    job: Job,
    result: unknown,
    logger: BlaizeLogger
  ): Promise<void> {
    await this.storage.updateJob(job.id, {
      status: 'completed',
      completedAt: Date.now(),
      progress: 100,
      result,
    });

    const completedJob = await this.storage.getJob(job.id, this.name);
    if (completedJob) {
      this.emit('job:completed', completedJob, result);
    }

    logger.info('Job completed', {
      duration: completedJob?.completedAt
        ? completedJob.completedAt - (completedJob.startedAt ?? completedJob.queuedAt)
        : undefined,
    });
  }

  /**
   * Handle job failure
   *
   * Determines error code, updates job state, and emits event.
   * Distinguishes between timeouts, cancellations, and execution errors.
   * Does not overwrite status if job was already cancelled.
   *
   * @param job - Failed job
   * @param err - Error that caused failure
   * @param logger - Job-scoped logger
   *
   * @internal
   */
  private async handleJobFailure(job: Job, err: unknown, logger: BlaizeLogger): Promise<void> {
    // Check current job status - don't overwrite if already cancelled
    const currentJob = await this.storage.getJob(job.id, this.name);
    if (currentJob?.status === 'cancelled') {
      logger.debug('Job was cancelled, skipping failure handling', {
        jobId: job.id,
      });
      return;
    }

    // Determine error code based on error type
    const errorMessage = err instanceof Error ? err.message : String(err);
    let errorCode = 'EXECUTION_ERROR';

    if (errorMessage.includes('timed out') || errorMessage.includes('timeout')) {
      errorCode = 'JOB_TIMEOUT';
    } else if (errorMessage.includes('cancelled') || errorMessage.includes('aborted')) {
      // If cancelled but status wasn't updated yet, treat as cancelled
      errorCode = 'JOB_CANCELLED';
    }

    const errorObj: JobError = {
      message: errorMessage,
      code: errorCode,
      stack: err instanceof Error ? err.stack : undefined,
    };

    logger.error('Job failed', {
      error: errorMessage,
      code: errorCode,
      duration: Date.now() - (job.startedAt ?? job.queuedAt),
    });

    await this.storage.updateJob(job.id, {
      status: 'failed',
      completedAt: Date.now(),
      error: errorObj,
    });

    const failedJob = await this.storage.getJob(job.id, this.name);
    if (failedJob) {
      this.emit('job:failed', failedJob, errorObj);
    }
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Delay execution for a specified time
   *
   * @param ms - Milliseconds to delay
   * @returns Promise that resolves after the delay
   *
   * @internal
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ==========================================================================
  // Internal Helpers (Exposed for Testing)
  // ==========================================================================

  /**
   * Check if queue is currently running
   *
   * @returns true if processing is active
   */
  get running(): boolean {
    return this.isRunning;
  }

  /**
   * Check if queue is shutting down
   *
   * @returns true if shutdown is in progress
   */
  get shuttingDown(): boolean {
    return this.isShuttingDown;
  }

  /**
   * Get count of running jobs
   *
   * @returns Number of currently executing jobs
   */
  get runningJobCount(): number {
    return this.runningJobs.size;
  }
}
