/**
 * QueueService - Multi-queue manager
 *
 * Manages multiple QueueInstance instances with a unified API.
 * All queues share the same storage adapter and logger.
 *
 * @packageDocumentation
 */

import { HandlerNotFoundError, JobValidationError, QueueNotFoundError } from './errors';
import { QueueInstance } from './queue-instance';

import type {
  QueueServiceConfig,
  QueueStorageAdapter,
  QueueManifest,
  HandlerRegistration,
  Job,
  JobOptions,
  JobStatus,
  JobError,
  JobSubscription,
  QueueStats,
  StopOptions,
} from './types';
import type { BlaizeLogger, EventBus } from 'blaizejs';

// ============================================================================
// QueueService Class
// ============================================================================

/**
 * Manages multiple queue instances with a unified API
 *
 * QueueService provides:
 * - Type-safe job submission with input validation via handler registry
 * - Multi-queue management with shared storage
 * - Cross-queue job lookup
 * - Unified event subscription
 * - Coordinated lifecycle management (startAll/stopAll)
 *
 * @template M - Queue manifest mapping queue names to job types with input/output shapes
 *
 * @example Basic usage
 * ```typescript
 * import { QueueService, createInMemoryStorage, defineJob } from '@blaizejs/queue';
 * import { z } from 'zod';
 *
 * const sendEmailJob = defineJob({
 *   input: z.object({ to: z.string().email(), subject: z.string() }),
 *   output: z.object({ sent: z.boolean() }),
 *   handler: async (ctx) => {
 *     await sendEmail(ctx.data);
 *     return { sent: true };
 *   },
 * });
 *
 * const queueService = new QueueService({
 *   queues: {
 *     emails: { concurrency: 5, jobs: { 'email:send': sendEmailJob } },
 *   },
 *   storage,
 *   logger,
 * });
 *
 * // Add jobs (input is validated against the schema)
 * const jobId = await queueService.add('emails', 'email:send', { to: 'user@example.com', subject: 'Hello' });
 *
 * // Stop all queues gracefully
 * await queueService.stopAll();
 * ```
 *
 * @example Event subscription
 * ```typescript
 * const unsubscribe = queueService.subscribe(jobId, {
 *   onProgress: (percent, message) => {
 *     console.log(`Progress: ${percent}% - ${message}`);
 *   },
 *   onCompleted: (result) => {
 *     console.log('Job completed:', result);
 *   },
 *   onFailed: (error) => {
 *     console.error('Job failed:', error.message);
 *   },
 * });
 *
 * // Later, unsubscribe
 * unsubscribe();
 * ```
 */
export class QueueService<M extends QueueManifest = QueueManifest> {
  // ==========================================================================
  // Private State
  // ==========================================================================

  /** Queue instances keyed by name */
  private readonly queues: Map<string, QueueInstance>;

  /** Shared storage adapter */
  private readonly storage: QueueStorageAdapter;

  /** Logger instance */
  private readonly logger: BlaizeLogger;

  /** Map of jobId to queueName for fast lookup */
  private readonly jobQueueMap: Map<string, string>;

  /** EventBus for cross-server coordination */
  private readonly eventBus: EventBus;

  /** Server ID for multi-server setups (optional) */
  private readonly serverId?: string;

  /** Handler registry mapping `queueName:jobType` keys to handler registrations */
  private readonly handlerRegistry: Map<string, HandlerRegistration>;

  // ==========================================================================
  // Constructor
  // ==========================================================================

  /**
   * Create a new QueueService
   *
   * @param config - Service configuration
   * @param config.queues - Queue configurations keyed by name
   * @param config.storage - Shared storage adapter for all queues
   * @param config.logger - Logger instance (child loggers created per queue)
   *
   * @example
   * ```typescript
   * const queueService = new QueueService({
   *   queues: {
   *     emails: { concurrency: 5, defaultTimeout: 30000 },
   *     reports: { concurrency: 2, defaultTimeout: 120000 },
   *     notifications: { concurrency: 10 },
   *   },
   *   storage: createInMemoryStorage(),
   *   logger: parentLogger,
   * });
   * ```
   */
  constructor(config: QueueServiceConfig) {
    this.storage = config.storage;
    this.eventBus = config.eventBus;
    this.serverId = config.serverId;
    this.handlerRegistry = config.handlerRegistry ?? new Map();

    this.logger = config.logger.child({ service: 'QueueService' });
    this.queues = new Map();
    this.jobQueueMap = new Map();
    // Create queue instances
    for (const [name, queueConfig] of Object.entries(config.queues)) {
      const queue = new QueueInstance(
        {
          name,
          ...queueConfig,
        },
        this.storage,
        config.logger,
        this.eventBus,
        this.handlerRegistry,
        this.serverId
      );

      this.queues.set(name, queue);
    }

    this.logger.info('QueueService created', {
      queues: Array.from(this.queues.keys()),
      queueCount: this.queues.size,
      handlerCount: this.handlerRegistry.size,
      multiServer: !!this.eventBus,
      serverId: this.serverId,
    });
  }

  // ==========================================================================
  // Queue Management
  // ==========================================================================

  /**
   * Get a queue instance by name
   *
   * @param name - Queue name
   * @returns The queue instance, or undefined if not found
   *
   * @example
   * ```typescript
   * const emailQueue = queueService.getQueue('emails');
   * if (emailQueue) {
   *   console.log(`Email queue running: ${emailQueue.running}`);
   * }
   * ```
   */
  getQueue(name: string): QueueInstance | undefined {
    return this.queues.get(name);
  }

  /**
   * Get a queue instance by name, throwing if not found
   *
   * @param name - Queue name
   * @returns The queue instance
   * @throws QueueNotFoundError if queue doesn't exist
   *
   * @internal
   */
  private getQueueOrThrow(name: string): QueueInstance {
    const queue = this.queues.get(name);
    if (!queue) {
      throw new QueueNotFoundError(name, this.listQueues());
    }
    return queue;
  }

  /**
   * List all queue names
   *
   * @returns Array of queue names
   *
   * @example
   * ```typescript
   * const queues = queueService.listQueues();
   * console.log('Available queues:', queues);
   * // ['emails', 'reports', 'notifications']
   * ```
   */
  listQueues(): string[] {
    return Array.from(this.queues.keys());
  }

  // ==========================================================================
  // Job Operations
  // ==========================================================================

  /**
   * Add a job to a specific queue
   *
   * Validates input data against the job's input schema before enqueuing.
   * If no handler registration is found, throws HandlerNotFoundError with
   * available job types listed.
   *
   * @template Q - Queue name (constrained to keys of manifest M)
   * @template J - Job type (constrained to keys of M[Q])
   * @param queueName - Name of the queue
   * @param jobType - Type of job (must have a registered handler)
   * @param data - Job data payload (validated against input schema)
   * @param options - Optional job-specific options
   * @returns Promise resolving to the job ID
   * @throws QueueNotFoundError if queue doesn't exist
   * @throws HandlerNotFoundError if job type has no registered handler
   * @throws JobValidationError if input data fails schema validation
   *
   * @example
   * ```typescript
   * const jobId = await queueService.add('emails', 'email:send', {
   *   to: 'user@example.com',
   *   subject: 'Hello',
   * });
   * ```
   */
  async add<Q extends string & keyof M, J extends string & keyof M[Q]>(
    queueName: Q,
    jobType: J,
    data: M[Q][J] extends { input: infer I } ? I : unknown,
    options?: JobOptions
  ): Promise<string> {
    const queue = this.getQueueOrThrow(queueName);

    // Look up handler registration for input validation
    const registryKey = `${queueName}:${jobType}`;
    const registration = this.handlerRegistry.get(registryKey);

    if (!registration) {
      // Collect available job types for this queue
      const availableJobTypes: string[] = [];
      for (const key of this.handlerRegistry.keys()) {
        if (key.startsWith(`${queueName}:`)) {
          availableJobTypes.push(key.slice(queueName.length + 1));
        }
      }
      throw new HandlerNotFoundError(jobType, queueName, availableJobTypes);
    }

    // Validate input data against the schema
    const parseResult = registration.inputSchema.safeParse(data);
    if (!parseResult.success) {
      const validationErrors = parseResult.error.errors.map(e => ({
        path: e.path,
        message: e.message,
      }));
      throw new JobValidationError(jobType, queueName, 'enqueue', validationErrors, data);
    }

    const jobId = await queue.add(jobType, parseResult.data, options);

    // Track job-to-queue mapping for cross-queue lookup
    this.jobQueueMap.set(jobId, queueName);

    this.logger.debug('Job added via service', {
      jobId,
      queueName,
      jobType,
    });

    return jobId;
  }

  /**
   * Get a job by ID (typed overload)
   *
   * When queueName and jobType are provided, returns a typed Job
   * with narrowed input/output types from the manifest.
   *
   * @template Q - Queue name
   * @template J - Job type
   * @param jobId - Unique job identifier
   * @param queueName - Queue name to search
   * @param jobType - Job type for type narrowing
   * @returns The typed job if found, or undefined
   */
  async getJob<Q extends string & keyof M, J extends string & keyof M[Q]>(
    jobId: string,
    queueName: Q,
    jobType: J
  ): Promise<
    | Job<
        M[Q][J] extends { input: infer I } ? I : unknown,
        M[Q][J] extends { output: infer O } ? O : unknown
      >
    | undefined
  >;

  /**
   * Get a job by ID (untyped overload)
   *
   * If queueName is provided, searches only that queue.
   * Otherwise, searches all queues.
   *
   * @param jobId - Unique job identifier
   * @param queueName - Optional queue name to search
   * @returns The job if found, or undefined
   *
   * @example
   * ```typescript
   * // Search specific queue
   * const job = await queueService.getJob(jobId, 'emails');
   *
   * // Search all queues
   * const job = await queueService.getJob(jobId);
   * ```
   */
  async getJob(jobId: string, queueName?: string): Promise<Job | undefined>;

  async getJob(jobId: string, queueName?: string, _jobType?: string): Promise<Job | undefined> {
    // If queueName provided, search only that queue
    if (queueName) {
      const queue = this.queues.get(queueName);
      if (!queue) {
        return undefined;
      }
      return queue.getJob(jobId);
    }

    // Check cached mapping first
    const cachedQueueName = this.jobQueueMap.get(jobId);
    if (cachedQueueName) {
      const queue = this.queues.get(cachedQueueName);
      if (queue) {
        const job = await queue.getJob(jobId);
        if (job) {
          return job;
        }
      }
      // Cache miss - job may have been removed
      this.jobQueueMap.delete(jobId);
    }

    // Search all queues
    for (const queue of this.queues.values()) {
      const job = await queue.getJob(jobId);
      if (job) {
        // Update cache
        this.jobQueueMap.set(jobId, queue.name);
        return job;
      }
    }

    return undefined;
  }

  /**
   * Cancel a job by ID
   *
   * If queueName is provided, searches only that queue.
   * Otherwise, searches all queues.
   *
   * @param jobId - Unique job identifier
   * @param queueName - Optional queue name to search
   * @param reason - Optional cancellation reason
   * @returns true if job was cancelled, false if not found
   *
   * @example
   * ```typescript
   * // Cancel in specific queue
   * const cancelled = await queueService.cancelJob(jobId, 'emails', 'User requested');
   *
   * // Cancel across all queues
   * const cancelled = await queueService.cancelJob(jobId);
   * ```
   */
  async cancelJob(jobId: string, queueName?: string, reason?: string): Promise<boolean> {
    // If queueName provided, cancel in that queue only
    if (queueName) {
      const queue = this.queues.get(queueName);
      if (!queue) {
        return false;
      }
      const cancelled = await queue.cancelJob(jobId, reason);
      if (cancelled) {
        this.logger.info('Job cancelled', { jobId, queueName, reason });
      }
      return cancelled;
    }

    // Check cached mapping first
    const cachedQueueName = this.jobQueueMap.get(jobId);
    if (cachedQueueName) {
      const queue = this.queues.get(cachedQueueName);
      if (queue) {
        const cancelled = await queue.cancelJob(jobId, reason);
        if (cancelled) {
          this.logger.info('Job cancelled', {
            jobId,
            queueName: cachedQueueName,
            reason,
          });
          return true;
        }
      }
    }

    // Search all queues
    for (const [name, queue] of this.queues) {
      const cancelled = await queue.cancelJob(jobId, reason);
      if (cancelled) {
        this.jobQueueMap.set(jobId, name);
        this.logger.info('Job cancelled', { jobId, queueName: name, reason });
        return true;
      }
    }

    return false;
  }

  // ==========================================================================
  // Lifecycle
  // ==========================================================================

  /**
   * Start all queues
   *
   * Starts processing on all managed queues concurrently.
   *
   * @example
   * ```typescript
   * await queueService.startAll();
   * console.log('All queues started');
   * ```
   */
  async startAll(): Promise<void> {
    this.logger.info('Starting all queues', {
      queues: this.listQueues(),
    });

    const startPromises = Array.from(this.queues.values()).map(queue => queue.start());

    await Promise.all(startPromises);

    this.logger.info('All queues started', {
      queues: this.listQueues(),
    });
  }

  /**
   * Stop all queues
   *
   * Stops processing on all managed queues concurrently.
   *
   * @param options - Stop options
   * @param options.graceful - Whether to wait for running jobs (default: true)
   * @param options.timeout - Maximum wait time per queue in ms (default: 30000)
   *
   * @example Graceful shutdown
   * ```typescript
   * await queueService.stopAll();
   * // Or with custom timeout
   * await queueService.stopAll({ graceful: true, timeout: 60000 });
   * ```
   *
   * @example Forceful shutdown
   * ```typescript
   * await queueService.stopAll({ graceful: false });
   * ```
   */
  async stopAll(options?: StopOptions): Promise<void> {
    const startTime = Date.now();
    const graceful = options?.graceful ?? true;

    this.logger.info('Stopping all queues', {
      queues: this.listQueues(),
      graceful,
      timeout: options?.timeout,
    });

    const stopPromises = Array.from(this.queues.values()).map(queue => queue.stop(options));

    await Promise.all(stopPromises);

    const duration = Date.now() - startTime;
    this.logger.info('All queues stopped', {
      queues: this.listQueues(),
      duration,
      graceful,
    });
  }

  // ==========================================================================
  // Stats & Listing
  // ==========================================================================

  /**
   * Get statistics for a specific queue
   *
   * @param queueName - Name of the queue
   * @returns Queue statistics
   * @throws QueueNotFoundError if queue doesn't exist
   *
   * @example
   * ```typescript
   * const stats = await queueService.getQueueStats('emails');
   * console.log(`Total: ${stats.total}, Running: ${stats.running}`);
   * ```
   */
  async getQueueStats(queueName: string): Promise<QueueStats> {
    const queue = this.getQueueOrThrow(queueName);
    return queue.getStats();
  }

  /**
   * Get aggregated statistics for all queues
   *
   * @returns Combined statistics across all queues
   *
   * @example
   * ```typescript
   * const stats = await queueService.getAllStats();
   * console.log(`Total jobs across all queues: ${stats.total}`);
   * ```
   */
  async getAllStats(): Promise<QueueStats> {
    const statsPromises = Array.from(this.queues.values()).map(queue => queue.getStats());

    const allStats = await Promise.all(statsPromises);

    return allStats.reduce(
      (acc, stats) => ({
        total: acc.total + stats.total,
        queued: acc.queued + stats.queued,
        running: acc.running + stats.running,
        completed: acc.completed + stats.completed,
        failed: acc.failed + stats.failed,
        cancelled: acc.cancelled + stats.cancelled,
      }),
      {
        total: 0,
        queued: 0,
        running: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
      }
    );
  }

  /**
   * List jobs in a specific queue
   *
   * @param queueName - Name of the queue
   * @param options - Filter options
   * @param options.status - Filter by job status
   * @param options.limit - Maximum number of jobs to return
   * @returns Array of matching jobs
   * @throws QueueNotFoundError if queue doesn't exist
   *
   * @example
   * ```typescript
   * const failedJobs = await queueService.listJobs('emails', {
   *   status: 'failed',
   *   limit: 10,
   * });
   * ```
   */
  async listJobs(
    queueName: string,
    options?: { status?: JobStatus; limit?: number }
  ): Promise<Job[]> {
    const queue = this.getQueueOrThrow(queueName);
    return queue.listJobs(options);
  }

  // ==========================================================================
  // Event Subscription
  // ==========================================================================

  /**
   * Subscribe to job events
   *
   * Subscribes to progress, completion, failure, and cancellation events
   * for a specific job. Returns an unsubscribe function.
   *
   * @param jobId - Unique job identifier
   * @param callbacks - Event callbacks
   * @returns Unsubscribe function
   *
   * @example
   * ```typescript
   * const unsubscribe = queueService.subscribe(jobId, {
   *   onProgress: (percent, message) => {
   *     console.log(`Progress: ${percent}% - ${message}`);
   *   },
   *   onCompleted: (result) => {
   *     console.log('Completed:', result);
   *     unsubscribe();
   *   },
   *   onFailed: (error) => {
   *     console.error('Failed:', error.message);
   *     unsubscribe();
   *   },
   *   onCancelled: (reason) => {
   *     console.log('Cancelled:', reason);
   *     unsubscribe();
   *   },
   * });
   * ```
   */
  subscribe(jobId: string, callbacks: JobSubscription): () => void {
    const unsubscribers: (() => void)[] = [];

    // Find which queue has this job
    const queueName = this.jobQueueMap.get(jobId);
    let targetQueues: QueueInstance[];

    if (queueName) {
      const queue = this.queues.get(queueName);
      targetQueues = queue ? [queue] : Array.from(this.queues.values());
    } else {
      // Subscribe to all queues (job may not have been added yet)
      targetQueues = Array.from(this.queues.values());
    }

    for (const queue of targetQueues) {
      // Progress handler
      if (callbacks.onProgress) {
        const progressHandler = (emittedJobId: string, percent: number, message?: string) => {
          if (emittedJobId === jobId) {
            callbacks.onProgress!(percent, message);
          }
        };
        queue.on('job:progress', progressHandler);
        unsubscribers.push(() => queue.off('job:progress', progressHandler));
      }

      // Completed handler
      if (callbacks.onCompleted) {
        const completedHandler = (job: Job, result: unknown) => {
          if (job.id === jobId) {
            callbacks.onCompleted!(result);
          }
        };
        queue.on('job:completed', completedHandler);
        unsubscribers.push(() => queue.off('job:completed', completedHandler));
      }

      // Failed handler
      if (callbacks.onFailed) {
        const failedHandler = (job: Job, error: JobError) => {
          if (job.id === jobId) {
            callbacks.onFailed!(error);
          }
        };
        queue.on('job:failed', failedHandler);
        unsubscribers.push(() => queue.off('job:failed', failedHandler));
      }

      // Cancelled handler
      if (callbacks.onCancelled) {
        const cancelledHandler = (job: Job, reason?: string) => {
          if (job.id === jobId) {
            callbacks.onCancelled!(reason);
          }
        };
        queue.on('job:cancelled', cancelledHandler);
        unsubscribers.push(() => queue.off('job:cancelled', cancelledHandler));
      }
    }

    this.logger.debug('Job subscription created', {
      jobId,
      queueName: queueName ?? 'all',
      callbacks: Object.keys(callbacks).filter(k => callbacks[k as keyof JobSubscription]),
    });

    // Return unsubscribe function
    return () => {
      for (const unsubscribe of unsubscribers) {
        unsubscribe();
      }
      this.logger.debug('Job subscription removed', { jobId });
    };
  }
}
