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

import { JobValidationError } from './errors';

import type {
  QueueStorageAdapter,
  QueueConfig,
  Job,
  JobContext,
  JobHandler,
  HandlerRegistration,
  JobOptions,
  JobStatus,
  JobError,
  QueueStats,
  JobPriority,
  StopOptions,
} from './types';
import type { BlaizeLogger, EventBus } from 'blaizejs';

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

/** Default base delay for exponential backoff (ms) */
const DEFAULT_BASE_DELAY_MS = 1000;

/** Default maximum delay for exponential backoff (ms) */
const DEFAULT_MAX_DELAY_MS = 30000;

/** Default multiplier for exponential backoff */
const DEFAULT_BACKOFF_MULTIPLIER = 2;

// ============================================================================
// QueueInstance Class
// ============================================================================

/**
 * Manages jobs for a single named queue
 *
 * QueueInstance provides:
 * - Type-safe job submission
 * - Handler lookup from injected registry
 * - Runtime input/output validation via Zod schemas
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
 * const registry = new Map([
 *   ['emails:email:send', { handler: sendEmailHandler, inputSchema, outputSchema }],
 * ]);
 *
 * const queue = new QueueInstance(
 *   { name: 'emails', concurrency: 5, defaultTimeout: 30000, defaultMaxRetries: 3 },
 *   storage,
 *   logger,
 *   eventBus,
 *   registry
 * );
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

  /** Base delay for exponential backoff (ms) */
  private readonly retryBaseDelayMs: number;

  /** Maximum delay for exponential backoff (ms) */
  private readonly retryMaxDelayMs: number;

  /** Multiplier for exponential backoff */
  private readonly retryMultiplier: number;

  /** Logger instance (child logger with queue context) */
  private readonly logger: BlaizeLogger;

  /** Storage adapter for job persistence */
  private readonly storage: QueueStorageAdapter;

  private readonly eventBus: EventBus;

  private readonly serverId?: string;

  // ==========================================================================
  // Private Runtime State
  // ==========================================================================

  /** Handler registry mapping `queueName:jobType` keys to handler registrations */
  private readonly handlerRegistry: Map<string, HandlerRegistration>;

  /** Currently running job IDs */
  private readonly runningJobs: Set<string>;

  /** AbortControllers for running jobs (for cancellation) */
  private readonly abortControllers: Map<string, AbortController>;

  /** Pending retry timers (for cleanup on stop) */
  private readonly pendingRetryTimers: Map<string, ReturnType<typeof setTimeout>>;

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
   * @param eventBus - EventBus for cross-server job coordination
   * @param handlerRegistry - Handler registry mapping `queueName:jobType` keys to registrations
   * @param serverId - Optional server ID for multi-server setups
   */
  constructor(
    config: QueueConfig,
    storage: QueueStorageAdapter,
    logger: BlaizeLogger,
    eventBus: EventBus,
    handlerRegistry: Map<string, HandlerRegistration>,
    serverId?: string
  ) {
    super();

    // Support many SSE subscriptions
    this.setMaxListeners(MAX_EVENT_LISTENERS);

    // Configuration
    this.name = config.name;
    this.concurrency = config.concurrency ?? DEFAULT_CONCURRENCY;
    this.defaultTimeout = config.defaultTimeout ?? DEFAULT_TIMEOUT;
    this.defaultMaxRetries = config.defaultMaxRetries ?? DEFAULT_MAX_RETRIES;

    // Retry configuration (using defaults, can be extended in QueueConfig if needed)
    this.retryBaseDelayMs = DEFAULT_BASE_DELAY_MS;
    this.retryMaxDelayMs = DEFAULT_MAX_DELAY_MS;
    this.retryMultiplier = DEFAULT_BACKOFF_MULTIPLIER;

    // Injected dependencies
    this.storage = storage;
    this.eventBus = eventBus;
    this.serverId = serverId;

    // Create child logger with queue context
    this.logger = logger.child({ queue: this.name });

    // Runtime state
    this.handlerRegistry = handlerRegistry;
    this.runningJobs = new Set();
    this.abortControllers = new Map();
    this.pendingRetryTimers = new Map();
    this.isRunning = false;
    this.isShuttingDown = false;

    this.logger.debug('QueueInstance created', {
      queue: this.name,
      concurrency: this.concurrency,
      defaultTimeout: this.defaultTimeout,
      defaultMaxRetries: this.defaultMaxRetries,
    });
  }

  /**
   * Publish job state change to EventBus
   *
   * Publishes specific event types based on state:
   * - queue:job:enqueued
   * - queue:job:started
   * - queue:job:progress
   * - queue:job:completed
   * - queue:job:failed
   * - queue:job:cancelled
   *
   * @private
   */
  private async publishStateChange(data: {
    jobId: string;
    jobType: string;
    state: 'enqueued' | 'started' | 'progress' | 'completed' | 'failed' | 'cancelled';
    progress?: number;
    message?: string;
    result?: unknown;
    error?: { message: string; code?: string };
    reason?: string;
    priority?: number;
  }): Promise<void> {
    if (!this.eventBus) return;

    try {
      const baseEvent = {
        jobId: data.jobId,
        jobType: data.jobType,
        queueName: this.name,
        timestamp: Date.now(),
        serverId: this.serverId || 'unknown',
      };

      // Publish specific event type based on state
      switch (data.state) {
        case 'enqueued':
          await this.eventBus.publish('queue:job:enqueued', {
            ...baseEvent,
            priority: data.priority ?? 5,
          });
          break;

        case 'started':
          await this.eventBus.publish('queue:job:started', baseEvent);
          break;

        case 'progress':
          await this.eventBus.publish('queue:job:progress', {
            jobId: data.jobId,
            progress: data.progress ?? 0,
            message: data.message,
          });
          break;

        case 'completed':
          await this.eventBus.publish('queue:job:completed', {
            ...baseEvent,
            result: data.result,
            durationMs: undefined, // Can calculate if needed
          });
          break;

        case 'failed':
          await this.eventBus.publish('queue:job:failed', {
            ...baseEvent,
            error: data.error?.message ?? 'Unknown error',
            willRetry: false, // Should be passed from caller
          });
          break;

        case 'cancelled':
          await this.eventBus.publish('queue:job:cancelled', {
            jobId: data.jobId,
            queueName: this.name,
            reason: data.reason,
          });
          break;
      }
    } catch (error) {
      this.logger.error('Failed to publish job state change', {
        error: {
          message: (error as Error).message,
          stack: (error as Error).stack,
        },
        jobId: data.jobId,
        state: data.state,
      });
    }
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
    await this.publishStateChange({
      jobId: job.id,
      jobType: job.type,
      state: 'enqueued',
      priority: job.priority,
    });

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
  /**
   * Stop the queue processing
   *
   * Graceful shutdown (default):
   * - Stops accepting new jobs immediately
   * - Waits for running jobs to complete (up to timeout)
   * - If timeout reached, logs warning but doesn't cancel jobs
   *
   * Forceful shutdown:
   * - Stops accepting new jobs immediately
   * - Cancels all running jobs immediately
   * - Returns once all jobs are cancelled
   *
   * @param options - Stop options
   * @param options.graceful - Whether to wait for running jobs (default: true)
   * @param options.timeout - Maximum wait time in ms (default: 30000)
   *
   * @example Graceful shutdown (wait for jobs)
   * ```typescript
   * await queue.stop(); // Waits up to 30s for jobs to finish
   * await queue.stop({ graceful: true, timeout: 60000 }); // Wait up to 60s
   * ```
   *
   * @example Forceful shutdown (cancel jobs)
   * ```typescript
   * await queue.stop({ graceful: false }); // Cancel all running jobs
   * ```
   */
  async stop(options?: StopOptions): Promise<void> {
    if (this.isShuttingDown) {
      this.logger.debug('Queue already shutting down', { queue: this.name });
      return;
    }

    const startTime = Date.now();
    const graceful = options?.graceful ?? true;
    const timeout = options?.timeout ?? DEFAULT_SHUTDOWN_TIMEOUT;

    // Set flags immediately to prevent new jobs from starting
    this.isShuttingDown = true;
    this.isRunning = false;

    // Get queued jobs count for logging
    const stats = await this.storage.getQueueStats(this.name);
    const queuedJobs = stats.queued;

    this.logger.info('Queue stopping', {
      queue: this.name,
      graceful,
      timeout,
      runningJobs: this.runningJobs.size,
      queuedJobs,
      pendingRetries: this.pendingRetryTimers.size,
    });

    // Clear all pending retry timers
    for (const [jobId, timerId] of this.pendingRetryTimers) {
      clearTimeout(timerId);
      this.logger.debug('Cleared pending retry timer', { jobId, queue: this.name });
    }
    this.pendingRetryTimers.clear();

    if (graceful) {
      // Graceful: Wait for running jobs to complete (with timeout)
      if (this.runningJobs.size > 0) {
        this.logger.debug('Waiting for running jobs to complete', {
          queue: this.name,
          runningJobs: this.runningJobs.size,
          timeout,
        });

        const waitStartTime = Date.now();
        while (this.runningJobs.size > 0) {
          if (Date.now() - waitStartTime > timeout) {
            this.logger.warn('Graceful shutdown timeout reached', {
              queue: this.name,
              remainingJobs: this.runningJobs.size,
              timeout,
            });
            break;
          }
          await this.delay(100);
        }
      }
    } else {
      // Forceful: Cancel all running jobs immediately
      if (this.runningJobs.size > 0) {
        this.logger.info('Force cancelling running jobs', {
          queue: this.name,
          jobCount: this.runningJobs.size,
        });

        const cancelPromises: Promise<boolean>[] = [];
        for (const jobId of this.runningJobs) {
          cancelPromises.push(
            this.cancelJob(jobId, 'Queue shutdown (forced)').catch(err => {
              this.logger.warn('Failed to cancel job during forced shutdown', {
                jobId,
                error: err instanceof Error ? err.message : String(err),
              });
              return false;
            })
          );
        }

        // Wait for all cancellations to complete
        await Promise.all(cancelPromises);

        // Give a brief moment for abort signals to propagate
        await this.delay(50);
      }
    }

    const duration = Date.now() - startTime;
    this.logger.info('Queue stopped', {
      queue: this.name,
      duration,
      graceful,
      remainingJobs: this.runningJobs.size,
    });
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
      await this.publishStateChange({
        jobId: updatedJob.id,
        jobType: updatedJob.type,
        state: 'cancelled',
        reason,
      });
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

    // Look up handler from registry using queueName:jobType key
    const registryKey = `${this.name}:${job.type}`;
    const registration = this.handlerRegistry.get(registryKey);
    if (!registration) {
      await this.handleNoHandler(job);
      return;
    }

    // Create job-scoped child logger with context
    const jobLogger = this.createJobLogger(job);

    // Validate input data against schema (validation errors fail immediately, no retry)
    let validatedInput: unknown;
    try {
      validatedInput = registration.inputSchema.parse(job.data);
    } catch (err) {
      const validationError = this.createValidationError(job.type, err);
      await this.handleValidationFailure(job, validationError, jobLogger);
      return;
    }

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
        await this.publishStateChange({
          jobId: job.id,
          jobType: job.type,
          state: 'started',
        });
      }

      jobLogger.info('Job started', {
        timeout: job.timeout,
        maxRetries: job.maxRetries,
        attempt: job.retries + 1,
      });

      // Create JobContext for handler execution with validated data
      const ctx = this.createJobContext(job, validatedInput, jobLogger, controller.signal, this.eventBus);

      // Execute the handler with timeout
      const result = await this.executeWithTimeout(registration.handler, ctx, job.timeout, controller);

      // Validate output data against schema (validation errors fail immediately, no retry)
      let validatedOutput: unknown;
      try {
        validatedOutput = registration.outputSchema.parse(result);
      } catch (err) {
        const validationError = this.createValidationError(job.type, err, 'execution-output');
        await this.handleValidationFailure(job, validationError, jobLogger);
        return;
      }

      // Handle successful completion
      await this.handleJobCompletion(job, validatedOutput, jobLogger);
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
   * @param validatedData - Data validated against the input schema
   * @param logger - Job-scoped logger
   * @param signal - AbortSignal for cancellation
   * @param eventBus - EventBus for cross-server coordination
   * @returns JobContext object
   *
   * @internal
   */
  private createJobContext(
    job: Job,
    validatedData: unknown,
    logger: BlaizeLogger,
    signal: AbortSignal,
    eventBus: EventBus
  ): JobContext<unknown> {
    const jobId = job.id;

    return {
      jobId: job.id,
      data: validatedData,
      logger,
      signal,
      eventBus,
      progress: async (percent: number, message?: string): Promise<void> => {
        // Update storage
        await this.storage.updateJob(jobId, {
          progress: percent,
          progressMessage: message,
        });

        // Emit event
        this.emit('job:progress', jobId, percent, message);
        await this.publishStateChange({
          jobId: job.id,
          jobType: job.type,
          state: 'progress',
          progress: percent / 100,
          message,
        });

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
    // Extract available job types for this queue from registry keys
    const availableJobTypes = Array.from(this.handlerRegistry.keys())
      .filter(key => key.startsWith(`${this.name}:`))
      .map(key => key.slice(this.name.length + 1));

    this.logger.error('No handler registered for job type', {
      jobId: job.id,
      jobType: job.type,
      queue: this.name,
      availableJobTypes,
    });

    const errorObj: JobError = {
      message: `No handler registered for job type '${job.type}'. Available job types: [${availableJobTypes.join(', ')}]`,
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
      await this.publishStateChange({
        jobId: job.id,
        jobType: job.type,
        state: 'failed',
        error: {
          message: errorObj.message,
          code: errorObj.code,
        },
      });
    }

    this.runningJobs.delete(job.id);
  }

  /**
   * Create a JobValidationError from a Zod parse error
   *
   * @param jobType - The job type being validated
   * @param err - The error from Zod schema.parse()
   * @returns JobValidationError instance
   *
   * @internal
   */
  private createValidationError(
    jobType: string,
    err: unknown,
    stage: 'execution-input' | 'execution-output' = 'execution-input'
  ): JobValidationError {
    const zodError = err as { issues?: Array<{ path: (string | number)[]; message: string }> };
    const validationErrors = (zodError.issues ?? []).map(issue => ({
      path: issue.path,
      message: issue.message,
    }));

    return new JobValidationError(
      jobType,
      this.name,
      stage,
      validationErrors,
      undefined
    );
  }

  /**
   * Handle validation failure — fails the job immediately without retry
   *
   * @param job - Job that failed validation
   * @param validationError - The validation error
   * @param logger - Job-scoped logger
   *
   * @internal
   */
  private async handleValidationFailure(
    job: Job,
    validationError: JobValidationError,
    logger: BlaizeLogger
  ): Promise<void> {
    logger.error('Job validation failed', {
      jobId: job.id,
      jobType: job.type,
      queue: this.name,
      error: validationError.message,
    });

    const errorObj: JobError = {
      message: validationError.message,
      code: 'VALIDATION_ERROR',
    };

    // Fail immediately — set maxRetries to current retries to prevent retry
    await this.storage.updateJob(job.id, {
      status: 'failed',
      completedAt: Date.now(),
      error: errorObj,
    });

    const failedJob = await this.storage.getJob(job.id, this.name);
    if (failedJob) {
      this.emit('job:failed', failedJob, errorObj);
      await this.publishStateChange({
        jobId: job.id,
        jobType: job.type,
        state: 'failed',
        error: {
          message: errorObj.message,
          code: errorObj.code,
        },
      });
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
    const currentJob = await this.storage.getJob(job.id, this.name);
    if (currentJob?.status === 'cancelled') {
      logger.debug('Job was cancelled, ignoring late completion');
      return;
    }

    await this.storage.updateJob(job.id, {
      status: 'completed',
      completedAt: Date.now(),
      progress: 100,
      result,
      error: undefined,
    });

    const completedJob = await this.storage.getJob(job.id, this.name);
    if (completedJob) {
      this.emit('job:completed', completedJob, result);
      await this.publishStateChange({
        jobId: job.id,
        jobType: job.type,
        state: 'completed',
        result,
      });
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
   * If retries remain, schedules job for retry with exponential backoff.
   * Otherwise, marks job as failed and emits event.
   * Does not retry cancelled jobs.
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
      // If cancelled but status wasn't updated yet, don't retry
      errorCode = 'JOB_CANCELLED';
      logger.debug('Job was cancelled during execution, skipping retry', {
        jobId: job.id,
      });
      // Update to cancelled status rather than failed
      await this.storage.updateJob(job.id, {
        status: 'cancelled',
        completedAt: Date.now(),
      });
      const cancelledJob = await this.storage.getJob(job.id, this.name);
      if (cancelledJob) {
        this.emit('job:cancelled', cancelledJob, errorMessage);
      }
      return;
    }

    const errorObj: JobError = {
      message: errorMessage,
      code: errorCode,
      stack: err instanceof Error ? err.stack : undefined,
    };

    // Check if we should retry
    const currentRetries = currentJob?.retries ?? job.retries;
    const maxRetries = job.maxRetries;
    const nextAttempt = currentRetries + 1;

    if (currentRetries < maxRetries) {
      // Schedule retry
      await this.scheduleRetry(job, nextAttempt, errorObj, logger);
      return;
    }

    // Exhausted retries - mark as failed
    logger.error('Job failed (exhausted retries)', {
      error: errorMessage,
      code: errorCode,
      attempt: nextAttempt,
      maxRetries,
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
      await this.publishStateChange({
        jobId: job.id,
        jobType: job.type,
        state: 'failed',
        error: {
          message: errorObj.message,
          code: errorObj.code,
        },
      });
    }
  }

  /**
   * Calculate exponential backoff delay
   *
   * Uses the formula: min(baseDelay * multiplier^attempt, maxDelay)
   * with jitter to prevent thundering herd.
   *
   * @param attempt - Current attempt number (1-based)
   * @returns Delay in milliseconds
   *
   * @internal
   */
  private calculateBackoff(attempt: number): number {
    // Exponential backoff: baseDelay * multiplier^(attempt-1)
    const exponentialDelay = this.retryBaseDelayMs * Math.pow(this.retryMultiplier, attempt - 1);

    // Cap at max delay
    const cappedDelay = Math.min(exponentialDelay, this.retryMaxDelayMs);

    // Add jitter (±10%) to prevent thundering herd
    const jitter = cappedDelay * 0.1 * (Math.random() * 2 - 1);

    return Math.floor(cappedDelay + jitter);
  }

  /**
   * Schedule a job for retry after backoff delay
   *
   * Updates job retry count, calculates backoff, and schedules
   * re-enqueue after the delay.
   *
   * @param job - Job to retry
   * @param attempt - Next attempt number
   * @param error - Error from previous attempt
   * @param logger - Job-scoped logger
   *
   * @internal
   */
  private async scheduleRetry(
    job: Job,
    attempt: number,
    error: JobError,
    logger: BlaizeLogger
  ): Promise<void> {
    const backoffMs = this.calculateBackoff(attempt);

    logger.warn('Job failed, scheduling retry', {
      jobId: job.id,
      attempt,
      maxRetries: job.maxRetries,
      backoffMs,
      error: error.message,
    });

    // Update job with incremented retry count and last error
    await this.storage.updateJob(job.id, {
      status: 'queued', // Back to queued for retry
      retries: attempt,
      error, // Store last error for reference
      // Clear startedAt for fresh attempt timing
      startedAt: undefined,
    });

    // Get updated job for event
    const updatedJob = await this.storage.getJob(job.id, this.name);
    if (updatedJob) {
      this.emit('job:retry', updatedJob, attempt);
    }

    // Schedule re-enqueue after backoff
    const timerId = setTimeout(async () => {
      // Clean up timer reference
      this.pendingRetryTimers.delete(job.id);

      // Don't re-enqueue if shutting down
      if (this.isShuttingDown) {
        logger.debug('Queue shutting down, skipping retry re-enqueue', {
          jobId: job.id,
        });
        return;
      }

      // Re-enqueue the job (storage.enqueue adds it back to the priority queue)
      const jobToRetry = await this.storage.getJob(job.id, this.name);
      if (jobToRetry && jobToRetry.status === 'queued') {
        await this.storage.enqueue(this.name, jobToRetry);
        logger.debug('Job re-enqueued for retry', {
          jobId: job.id,
          attempt,
        });
      }
    }, backoffMs);

    // Track timer for cleanup on stop
    this.pendingRetryTimers.set(job.id, timerId);
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
