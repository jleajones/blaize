/**
 * QueueService - Multi-queue manager
 *
 * Manages multiple QueueInstance instances with a unified API.
 * All queues share the same storage adapter and logger.
 *
 * @packageDocumentation
 */

import { QueueNotFoundError } from './errors';
import { QueueInstance } from './queue-instance';

import type {
  QueueServiceConfig,
  QueueStorageAdapter,
  Job,
  JobHandler,
  JobOptions,
  JobStatus,
  JobError,
  JobSubscription,
  QueueStats,
  StopOptions,
} from './types';
import type { BlaizeLogger } from 'blaizejs';

// ============================================================================
// QueueService Class
// ============================================================================

/**
 * Manages multiple queue instances with a unified API
 *
 * QueueService provides:
 * - Multi-queue management with shared storage
 * - Cross-queue job lookup
 * - Unified event subscription
 * - Coordinated lifecycle management (startAll/stopAll)
 *
 * @example Basic usage
 * ```typescript
 * import { QueueService, createInMemoryStorage } from '@blaizejs/queue';
 *
 * const storage = createInMemoryStorage();
 *
 * const queueService = new QueueService({
 *   queues: {
 *     emails: { concurrency: 5 },
 *     reports: { concurrency: 2, defaultTimeout: 60000 },
 *   },
 *   storage,
 *   logger,
 * });
 *
 * // Register handlers
 * queueService.registerHandler('emails', 'email:send', async (ctx) => {
 *   await sendEmail(ctx.data);
 *   return { sent: true };
 * });
 *
 * // Start all queues
 * await queueService.startAll();
 *
 * // Add jobs
 * const jobId = await queueService.add('emails', 'email:send', { to: 'user@example.com' });
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
export class QueueService {
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
    this.logger = config.logger.child({ service: 'QueueService' });
    this.queues = new Map();
    this.jobQueueMap = new Map();

    // Create queue instances
    for (const [name, queueConfig] of Object.entries(config.queues)) {
      const queue = new QueueInstance(
        {
          name,
          concurrency: queueConfig.concurrency,
          defaultTimeout: queueConfig.defaultTimeout,
          defaultMaxRetries: queueConfig.defaultMaxRetries,
        },
        this.storage,
        config.logger // QueueInstance creates its own child logger
      );

      this.queues.set(name, queue);
    }

    this.logger.info('QueueService created', {
      queues: Array.from(this.queues.keys()),
      queueCount: this.queues.size,
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
   * @typeParam TData - Type of job data
   * @param queueName - Name of the queue
   * @param jobType - Type of job (must have a registered handler)
   * @param data - Job data payload
   * @param options - Optional job-specific options
   * @returns Promise resolving to the job ID
   * @throws QueueNotFoundError if queue doesn't exist
   *
   * @example
   * ```typescript
   * const jobId = await queueService.add('emails', 'email:send', {
   *   to: 'user@example.com',
   *   subject: 'Hello',
   *   body: 'World',
   * });
   * console.log(`Job created: ${jobId}`);
   * ```
   *
   * @example With options
   * ```typescript
   * const jobId = await queueService.add('reports', 'report:generate', {
   *   reportId: 'monthly-sales',
   * }, {
   *   priority: 10,
   *   timeout: 120000,
   * });
   * ```
   */
  async add<TData>(
    queueName: string,
    jobType: string,
    data: TData,
    options?: JobOptions
  ): Promise<string> {
    const queue = this.getQueueOrThrow(queueName);
    const jobId = await queue.add(jobType, data, options);

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
   * Get a job by ID
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
  async getJob(jobId: string, queueName?: string): Promise<Job | undefined> {
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
  // Handler Registration
  // ==========================================================================

  /**
   * Register a handler for a job type in a specific queue
   *
   * @typeParam TData - Type of job data
   * @typeParam TResult - Type of handler result
   * @param queueName - Name of the queue
   * @param jobType - Type of job
   * @param handler - Handler function
   * @throws QueueNotFoundError if queue doesn't exist
   * @throws HandlerAlreadyRegisteredError if handler already exists
   *
   * @example
   * ```typescript
   * queueService.registerHandler('emails', 'email:send', async (ctx) => {
   *   const { to, subject, body } = ctx.data;
   *
   *   ctx.logger.info('Sending email', { to, subject });
   *   ctx.progress(10, 'Preparing email');
   *
   *   await sendEmail(to, subject, body);
   *
   *   ctx.progress(100, 'Email sent');
   *   return { sent: true, timestamp: Date.now() };
   * });
   * ```
   */
  registerHandler<TData, TResult>(
    queueName: string,
    jobType: string,
    handler: JobHandler<TData, TResult>
  ): void {
    const queue = this.getQueueOrThrow(queueName);
    queue.registerHandler(jobType, handler);

    this.logger.debug('Handler registered via service', {
      queueName,
      jobType,
    });
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
