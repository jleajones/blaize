/**
 * Queue Instance Implementation
 *
 * QueueInstance is the core class that manages jobs for a single named queue.
 * It handles job submission, handler registration, event emission, and
 * lifecycle management.
 *
 * @module @blaizejs/queue/queue-instance
 * @since 0.4.0
 */

import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';

import {
  HandlerNotFoundError,
  HandlerAlreadyRegisteredError,
  JobValidationError,
  JobNotFoundError,
} from './errors';

import type {
  QueueStorageAdapter,
  QueueInstanceConfig,
  JobTypesSchema,
  Job,
  JobHandler,
  JobOptions,
  JobFilters,
  QueueStats,
  JobSubscription,
  JobPriority,
} from './types';
import type { BlaizeLogger } from 'blaizejs';
import type { z } from 'zod';

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

// ============================================================================
// QueueInstance Class
// ============================================================================

/**
 * Manages jobs for a single named queue
 *
 * QueueInstance provides:
 * - Type-safe job submission with Zod validation
 * - Handler registration for job types
 * - Event emission for SSE streaming
 * - Job cancellation with AbortController
 * - Statistics via storage adapter
 *
 * @template TJobTypes - Job types schema defining available job types
 *
 * @example Basic usage
 * ```typescript
 * import { z } from 'zod';
 * import { QueueInstance, createInMemoryStorage } from '@blaizejs/queue';
 *
 * const jobTypes = {
 *   'email:send': {
 *     schema: z.object({ to: z.string().email(), subject: z.string() }),
 *     priority: 5,
 *   },
 *   'report:generate': {
 *     schema: z.object({ reportId: z.string() }),
 *     priority: 3,
 *     timeout: 120000,
 *   },
 * };
 *
 * const queue = new QueueInstance({
 *   name: 'emails',
 *   concurrency: 5,
 *   jobTypes,
 *   storage: createInMemoryStorage(),
 *   logger: parentLogger.child({ queue: 'emails' }),
 * });
 *
 * // Register handlers
 * queue.registerHandler('email:send', async (ctx) => {
 *   await sendEmail(ctx.data.to, ctx.data.subject);
 *   ctx.progress(100, 'Sent!');
 *   return { success: true };
 * });
 *
 * // Add jobs
 * const jobId = await queue.add('email:send', {
 *   to: 'user@example.com',
 *   subject: 'Welcome!'
 * });
 *
 * // Start processing
 * await queue.start();
 * ```
 *
 * @example Subscribing to job events (for SSE)
 * ```typescript
 * const unsubscribe = queue.subscribe(jobId, {
 *   onProgress: (percent, message) => {
 *     stream.send('progress', { percent, message });
 *   },
 *   onCompleted: (result) => {
 *     stream.send('completed', { result });
 *     stream.close();
 *   },
 *   onFailed: (error) => {
 *     stream.send('failed', { error });
 *     stream.close();
 *   },
 * });
 *
 * // Clean up on stream close
 * stream.onClose(() => unsubscribe());
 * ```
 */
export class QueueInstance<TJobTypes extends JobTypesSchema = JobTypesSchema> extends EventEmitter {
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

  /** Job type definitions with schemas */
  private readonly jobTypes: TJobTypes;

  /** Default options for all jobs */
  private readonly defaultJobOptions: Partial<JobOptions>;

  /** Logger instance (from plugin) */
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
  private isProcessing: boolean;

  /** Whether the queue is shutting down */
  private isShuttingDown: boolean;

  // ==========================================================================
  // Constructor
  // ==========================================================================

  /**
   * Create a new QueueInstance
   *
   * @param config - Queue configuration
   *
   * @example
   * ```typescript
   * const queue = new QueueInstance({
   *   name: 'emails',
   *   concurrency: 5,
   *   jobTypes: {
   *     'welcome': {
   *       schema: z.object({ to: z.string().email() }),
   *       priority: 5,
   *     },
   *   },
   *   storage: createInMemoryStorage(),
   *   logger: parentLogger.child({ queue: 'emails' }),
   * });
   * ```
   */
  constructor(config: QueueInstanceConfig<TJobTypes>) {
    super();

    // Support many SSE subscriptions
    this.setMaxListeners(MAX_EVENT_LISTENERS);

    // Configuration
    this.name = config.name;
    this.concurrency = config.concurrency ?? DEFAULT_CONCURRENCY;
    this.jobTypes = config.jobTypes;
    this.defaultJobOptions = config.defaultJobOptions ?? {};
    this.logger = config.logger;
    this.storage = config.storage;

    // Runtime state
    this.handlers = new Map();
    this.runningJobs = new Set();
    this.abortControllers = new Map();
    this.isProcessing = false;
    this.isShuttingDown = false;

    this.logger.debug('QueueInstance created', {
      queue: this.name,
      concurrency: this.concurrency,
      jobTypes: Object.keys(this.jobTypes),
    });
  }

  // ==========================================================================
  // Job Submission
  // ==========================================================================

  /**
   * Add a job to the queue
   *
   * Validates job data against the Zod schema for the job type,
   * creates a job record, enqueues it in storage, and emits
   * a 'job.queued' event.
   *
   * @param jobType - Type of job (must be defined in jobTypes)
   * @param data - Job data (validated against schema)
   * @param options - Optional job-specific options
   * @returns Job ID (UUID)
   *
   * @throws {JobValidationError} If data doesn't match schema
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
   *   timeout: 300000, // 5 minutes
   *   metadata: { requestedBy: 'admin' }
   * });
   * ```
   */
  async add<K extends keyof TJobTypes & string>(
    jobType: K,
    data: z.infer<TJobTypes[K]['schema']>,
    options?: JobOptions
  ): Promise<string> {
    // Validate job type exists
    const jobTypeConfig = this.jobTypes[jobType];
    if (!jobTypeConfig) {
      throw new HandlerNotFoundError(jobType, this.name, Object.keys(this.jobTypes));
    }

    // Validate data against schema
    const parseResult = jobTypeConfig.schema.safeParse(data);
    if (!parseResult.success) {
      const validationErrors = parseResult.error.issues.map(
        (issue: { path: (string | number)[]; message: string }) => ({
          path: issue.path,
          message: issue.message,
        })
      );
      throw new JobValidationError(jobType, this.name, validationErrors, data);
    }

    // Generate job ID
    const jobId = randomUUID();

    // Merge options: defaults < job type config < explicit options
    const priority =
      options?.priority ??
      jobTypeConfig.priority ??
      this.defaultJobOptions.priority ??
      DEFAULT_PRIORITY;

    const timeout =
      options?.timeout ??
      jobTypeConfig.timeout ??
      this.defaultJobOptions.timeout ??
      DEFAULT_TIMEOUT;

    const maxRetries =
      options?.maxRetries ??
      jobTypeConfig.maxRetries ??
      this.defaultJobOptions.maxRetries ??
      DEFAULT_MAX_RETRIES;

    const metadata = {
      ...this.defaultJobOptions.metadata,
      ...options?.metadata,
    };

    // Create job record
    const job: Job = {
      id: jobId,
      type: jobType,
      queueName: this.name,
      data: parseResult.data,
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
    this.emit('job.queued', job);

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
   * @param jobType - Type of job to handle
   * @param handler - Async function to process the job
   *
   * @throws {HandlerAlreadyRegisteredError} If handler already registered
   *
   * @example
   * ```typescript
   * queue.registerHandler('email:send', async (ctx) => {
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
  registerHandler<K extends keyof TJobTypes & string>(
    jobType: K,
    handler: JobHandler<z.infer<TJobTypes[K]['schema']>, unknown>
  ): void {
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

  /**
   * Get the handler for a job type
   *
   * @param jobType - Type of job
   * @returns The handler if registered, undefined otherwise
   *
   * @internal Used by processing loop
   */
  getHandler(jobType: string): JobHandler<unknown, unknown> | undefined {
    return this.handlers.get(jobType);
  }

  // ==========================================================================
  // Job Retrieval
  // ==========================================================================

  /**
   * Get a specific job by ID
   *
   * @param jobId - Unique job identifier
   * @returns The job if found, or null
   *
   * @example
   * ```typescript
   * const job = await queue.getJob(jobId);
   * if (job) {
   *   console.log(`Job status: ${job.status}`);
   * }
   * ```
   */
  async getJob(jobId: string): Promise<Job | null> {
    return this.storage.getJob(jobId, this.name);
  }

  /**
   * List jobs matching filters
   *
   * @param filters - Optional filter criteria
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
   *   sortBy: 'queuedAt',
   *   sortOrder: 'desc'
   * });
   * ```
   */
  async listJobs(filters?: JobFilters): Promise<Job[]> {
    return this.storage.listJobs(this.name, filters);
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
  // Event Subscription
  // ==========================================================================

  /**
   * Subscribe to events for a specific job
   *
   * Used for SSE streaming to track job progress in real-time.
   * Returns an unsubscribe function to clean up listeners.
   *
   * @param jobId - Job ID to subscribe to
   * @param callbacks - Event callbacks
   * @returns Unsubscribe function
   *
   * @example
   * ```typescript
   * const unsubscribe = queue.subscribe(jobId, {
   *   onProgress: (percent, message) => {
   *     console.log(`Progress: ${percent}% - ${message}`);
   *   },
   *   onCompleted: (result) => {
   *     console.log('Job completed:', result);
   *   },
   *   onFailed: (error) => {
   *     console.error('Job failed:', error);
   *   },
   *   onCancelled: (reason) => {
   *     console.log('Job cancelled:', reason);
   *   },
   * });
   *
   * // Later: clean up
   * unsubscribe();
   * ```
   */
  subscribe(jobId: string, callbacks: JobSubscription): () => void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const listeners: Array<{ event: string; listener: (...args: any[]) => void }> = [];

    // Progress listener
    if (callbacks.onProgress) {
      const progressListener = (job: Job, percent: number, message?: string) => {
        if (job.id === jobId) {
          callbacks.onProgress!(percent, message);
        }
      };
      this.on('job.progress', progressListener);
      listeners.push({ event: 'job.progress', listener: progressListener });
    }

    // Completed listener
    if (callbacks.onCompleted) {
      const completedListener = (job: Job) => {
        if (job.id === jobId) {
          callbacks.onCompleted!(job.result);
        }
      };
      this.on('job.completed', completedListener);
      listeners.push({ event: 'job.completed', listener: completedListener });
    }

    // Failed listener
    if (callbacks.onFailed) {
      const failedListener = (job: Job) => {
        if (job.id === jobId) {
          callbacks.onFailed!(job.error!);
        }
      };
      this.on('job.failed', failedListener);
      listeners.push({ event: 'job.failed', listener: failedListener });
    }

    // Cancelled listener
    if (callbacks.onCancelled) {
      const cancelledListener = (job: Job, reason?: string) => {
        if (job.id === jobId) {
          callbacks.onCancelled!(reason);
        }
      };
      this.on('job.cancelled', cancelledListener);
      listeners.push({ event: 'job.cancelled', listener: cancelledListener });
    }

    // Return unsubscribe function
    return () => {
      for (const { event, listener } of listeners) {
        this.off(event, listener);
      }
    };
  }

  // ==========================================================================
  // Job Cancellation
  // ==========================================================================

  /**
   * Cancel a job
   *
   * If the job is running, triggers its AbortController to signal cancellation.
   * Updates job status to 'cancelled' and emits 'job.cancelled' event.
   *
   * @param jobId - Job ID to cancel
   * @param reason - Optional cancellation reason
   *
   * @throws {JobNotFoundError} If job doesn't exist
   *
   * @example
   * ```typescript
   * await queue.cancel(jobId, 'User requested cancellation');
   * ```
   */
  async cancel(jobId: string, reason?: string): Promise<void> {
    const job = await this.storage.getJob(jobId, this.name);
    if (!job) {
      throw new JobNotFoundError(jobId, this.name);
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
      this.emit('job.cancelled', updatedJob, reason);
    }

    this.logger.info('Job cancelled', {
      jobId,
      queue: this.name,
      reason,
      wasRunning: !!controller,
    });
  }

  // ==========================================================================
  // Lifecycle Methods (Stubs - Full implementation in T6)
  // ==========================================================================

  /**
   * Start processing jobs
   *
   * Begins the job processing loop. Jobs are dequeued from storage
   * and executed by registered handlers up to the concurrency limit.
   *
   * @example
   * ```typescript
   * await queue.start();
   * console.log('Queue is now processing jobs');
   * ```
   */
  async start(): Promise<void> {
    if (this.isProcessing) {
      this.logger.debug('Queue already processing', { queue: this.name });
      return;
    }

    this.isProcessing = true;
    this.isShuttingDown = false;

    this.logger.info('Queue started', { queue: this.name });

    // TODO: T6 - implement processJobs() loop
  }

  /**
   * Stop processing jobs
   *
   * Gracefully stops the processing loop. Waits for running jobs
   * to complete (up to a timeout) before returning.
   *
   * @example
   * ```typescript
   * await queue.stop();
   * console.log('Queue stopped');
   * ```
   */
  async stop(): Promise<void> {
    if (this.isShuttingDown) {
      this.logger.debug('Queue already shutting down', { queue: this.name });
      return;
    }

    this.isShuttingDown = true;

    this.logger.info('Queue stopping', {
      queue: this.name,
      runningJobs: this.runningJobs.size,
    });

    // TODO: T6 - wait for running jobs, cleanup
  }

  // ==========================================================================
  // Internal Helpers
  // ==========================================================================

  /**
   * Check if queue is currently processing
   *
   * @returns true if processing is active
   */
  get processing(): boolean {
    return this.isProcessing;
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

  /**
   * Get the AbortController for a running job
   *
   * @param jobId - Job ID
   * @returns AbortController if job is running, undefined otherwise
   *
   * @internal Used by processing loop
   */
  getAbortController(jobId: string): AbortController | undefined {
    return this.abortControllers.get(jobId);
  }

  /**
   * Register an AbortController for a job
   *
   * @param jobId - Job ID
   * @param controller - AbortController
   *
   * @internal Used by processing loop
   */
  setAbortController(jobId: string, controller: AbortController): void {
    this.abortControllers.set(jobId, controller);
    this.runningJobs.add(jobId);
  }

  /**
   * Remove an AbortController for a job
   *
   * @param jobId - Job ID
   *
   * @internal Used by processing loop
   */
  removeAbortController(jobId: string): void {
    this.abortControllers.delete(jobId);
    this.runningJobs.delete(jobId);
  }
}
