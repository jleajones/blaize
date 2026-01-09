/**
 * Core Type Definitions for Queue Plugin
 *
 * This module defines all foundational types for the queue system including:
 * - Job lifecycle types (Job, JobStatus, JobError)
 * - Handler types (JobHandler, JobContext)
 * - Configuration types (JobOptions, QueueConfig, QueuePluginConfig)
 * - Storage adapter interface (QueueStorageAdapter)
 *
 * @module @blaizejs/queue/types
 * @since 0.4.0
 */

import { QueueService } from './queue-service';

import type { BlaizeLogger, EventBus, Services } from 'blaizejs';
import type { z } from 'zod';

// ============================================================================
// Job Status Types
// ============================================================================

/**
 * Possible states of a job throughout its lifecycle
 *
 * @example
 * ```typescript
 * const status: JobStatus = 'running';
 *
 * // Status transitions:
 * // queued → running → completed
 * // queued → running → failed
 * // queued → cancelled
 * // running → cancelled
 * ```
 */
export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * Job priority levels (1-10)
 *
 * Higher numbers = higher priority (processed first)
 * - 1-3: Low priority (background tasks)
 * - 4-6: Normal priority (default)
 * - 7-9: High priority (time-sensitive)
 * - 10: Critical priority (process immediately)
 *
 * @example
 * ```typescript
 * const priority: JobPriority = 7; // High priority
 * ```
 */
export type JobPriority = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

// ============================================================================
// Job Error Types
// ============================================================================

/**
 * Structured error information attached to failed jobs
 *
 * @example
 * ```typescript
 * const error: JobError = {
 *   message: 'Connection timeout',
 *   code: 'ETIMEDOUT',
 *   stack: 'Error: Connection timeout\n    at ...'
 * };
 * ```
 */
export interface JobError {
  /** Human-readable error message */
  message: string;

  /** Optional error code for programmatic handling */
  code?: string;

  /** Optional stack trace for debugging */
  stack?: string;
}

// ============================================================================
// Job Options Types
// ============================================================================

/**
 * Options for configuring individual job behavior
 *
 * All options are optional with sensible defaults:
 * - priority: 5 (normal)
 * - maxRetries: 3
 * - timeout: 30000ms (30 seconds)
 * - metadata: {}
 *
 * @example
 * ```typescript
 * const options: JobOptions = {
 *   priority: 8,
 *   maxRetries: 5,
 *   timeout: 60000,
 *   metadata: { userId: '123', source: 'api' }
 * };
 *
 * await queue.add('email:send', emailData, options);
 * ```
 */
export interface JobOptions {
  /**
   * Job priority (1-10, higher = processed first)
   * @default 5
   */
  priority?: JobPriority;

  /**
   * Maximum retry attempts on failure
   * @default 3
   */
  maxRetries?: number;

  /**
   * Job execution timeout in milliseconds
   * @default 30000 (30 seconds)
   */
  timeout?: number;

  /**
   * Custom metadata attached to the job
   * Useful for tracking, filtering, and debugging
   * @default {}
   */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Job Interface
// ============================================================================

/**
 * Complete job record with all state and metadata
 *
 * Jobs are immutable records - updates create new versions.
 * The generic parameters allow type-safe data and result handling.
 *
 * @template TData - Type of the job's input data
 * @template TResult - Type of the job's result on completion
 *
 * @example
 * ```typescript
 * interface EmailData {
 *   to: string;
 *   subject: string;
 *   body: string;
 * }
 *
 * interface EmailResult {
 *   messageId: string;
 *   sentAt: number;
 * }
 *
 * const job: Job<EmailData, EmailResult> = {
 *   id: 'job_123',
 *   type: 'email:send',
 *   data: { to: 'user@example.com', subject: 'Hello', body: '...' },
 *   status: 'completed',
 *   priority: 5,
 *   progress: 100,
 *   queuedAt: 1699000000000,
 *   startedAt: 1699000001000,
 *   completedAt: 1699000002000,
 *   result: { messageId: 'msg_456', sentAt: 1699000002000 },
 *   retries: 0,
 *   maxRetries: 3,
 *   timeout: 30000,
 *   metadata: { userId: '123' }
 * };
 * ```
 */
export interface Job<TData = unknown, TResult = unknown> {
  /** Unique job identifier (UUID v4) */
  readonly id: string;

  /** Job type identifier (used to match handlers) */
  readonly type: string;

  /** Queue name this job belongs to */
  readonly queueName: string;

  /** Job input data passed to the handler */
  readonly data: TData;

  /** Current job status */
  readonly status: JobStatus;

  /** Job priority (1-10, higher = processed first) */
  readonly priority: JobPriority;

  /** Current progress percentage (0-100) */
  readonly progress: number;

  /** Optional progress message */
  readonly progressMessage?: string;

  /** Timestamp when job was added to queue (ms since epoch) */
  readonly queuedAt: number;

  /** Timestamp when job started executing (ms since epoch) */
  readonly startedAt?: number;

  /** Timestamp when job completed/failed/cancelled (ms since epoch) */
  readonly completedAt?: number;

  /** Job result on successful completion */
  readonly result?: TResult;

  /** Error details on failure */
  readonly error?: JobError;

  /** Number of retry attempts made */
  readonly retries: number;

  /** Maximum retry attempts allowed */
  readonly maxRetries: number;

  /** Execution timeout in milliseconds */
  readonly timeout: number;

  /** Custom metadata attached to the job */
  readonly metadata: Record<string, unknown>;
}

// ============================================================================
// Job Context Types
// ============================================================================

/**
 * Context object passed to job handlers during execution
 *
 * Provides:
 * - Access to job data
 * - Scoped logger with job context
 * - AbortSignal for cancellation/timeout
 * - Progress reporting function
 *
 * @template TData - Type of the job's input data
 *
 * @example
 * ```typescript
 * const handler: JobHandler<EmailData, EmailResult> = async (ctx) => {
 *   ctx.logger.info('Starting email send', { to: ctx.data.to });
 *
 *   // Check for cancellation
 *   if (ctx.signal.aborted) {
 *     throw new Error('Job cancelled');
 *   }
 *
 *   // Report progress
 *   await ctx.progress(50, 'Connecting to SMTP server');
 *
 *   const result = await sendEmail(ctx.data);
 *
 *   await ctx.progress(100, 'Email sent successfully');
 *
 *   return result;
 * };
 * ```
 */
export interface JobContext<TData = unknown> {
  /** Unique job identifier */
  readonly jobId: string;

  /** Job input data */
  readonly data: TData;

  /**
   * Scoped logger with job context
   *
   * Automatically includes: { jobId, jobType, queueName, attempt }
   * Use this for all logging within the handler.
   */
  readonly logger: BlaizeLogger;

  /**
   * Abort signal for cancellation and timeout
   *
   * Check `signal.aborted` periodically in long-running handlers.
   * Listen to `signal.addEventListener('abort', ...)` for immediate notification.
   */
  readonly signal: AbortSignal;

  /**
   * Report job progress
   *
   * @param percent - Progress percentage (0-100)
   * @param message - Optional progress message
   *
   * @example
   * ```typescript
   * await ctx.progress(25, 'Processing batch 1/4');
   * await ctx.progress(50, 'Processing batch 2/4');
   * await ctx.progress(75, 'Processing batch 3/4');
   * await ctx.progress(100, 'Complete');
   * ```
   */
  progress(percent: number, message?: string): Promise<void>;

  /**
   * EventBus instance for publishing custom events
   *
   * Use to publish domain events during job execution
   */
  eventBus: EventBus;
}

// ============================================================================
// Job Handler Types
// ============================================================================

/**
 * Function that processes a job
 *
 * Handlers receive a JobContext and return a result (or throw an error).
 * The handler should respect the abort signal for cancellation support.
 *
 * @template TData - Type of the job's input data
 * @template TResult - Type of the job's result
 *
 * @example
 * ```typescript
 * interface ImageResizeData {
 *   imageUrl: string;
 *   width: number;
 *   height: number;
 * }
 *
 * interface ImageResizeResult {
 *   resizedUrl: string;
 *   originalSize: number;
 *   newSize: number;
 * }
 *
 * const resizeHandler: JobHandler<ImageResizeData, ImageResizeResult> = async (ctx) => {
 *   const { imageUrl, width, height } = ctx.data;
 *
 *   ctx.logger.info('Resizing image', { imageUrl, width, height });
 *
 *   await ctx.progress(10, 'Downloading image');
 *   const image = await downloadImage(imageUrl);
 *
 *   await ctx.progress(50, 'Resizing');
 *   const resized = await resize(image, width, height);
 *
 *   await ctx.progress(90, 'Uploading');
 *   const resizedUrl = await uploadImage(resized);
 *
 *   return {
 *     resizedUrl,
 *     originalSize: image.size,
 *     newSize: resized.size
 *   };
 * };
 * ```
 */
export type JobHandler<TData = unknown, TResult = unknown> = (
  context: JobContext<TData>
) => Promise<TResult>;

// ============================================================================
// Queue Statistics Types
// ============================================================================

/**
 * Statistics for a queue
 *
 * @example
 * ```typescript
 * const stats: QueueStats = await queue.getStats();
 * console.log(`Total: ${stats.total}, Running: ${stats.running}`);
 * ```
 */
export interface QueueStats {
  /** Total number of jobs in the queue */
  total: number;

  /** Jobs waiting to be processed */
  queued: number;

  /** Jobs currently being processed */
  running: number;

  /** Successfully completed jobs */
  completed: number;

  /** Failed jobs (exhausted retries) */
  failed: number;

  /** Cancelled jobs */
  cancelled: number;
}

// ============================================================================
// Job Filter Types
// ============================================================================

/**
 * Filter options for listing jobs
 *
 * @example
 * ```typescript
 * // Get failed jobs, most recent first
 * const filters: JobFilters = {
 *   status: 'failed',
 *   limit: 10,
 *   sortBy: 'queuedAt',
 *   sortOrder: 'desc'
 * };
 *
 * const failedJobs = await storage.listJobs('default', filters);
 * ```
 */
export interface JobFilters {
  /** Filter by status (single or multiple) */
  status?: JobStatus | JobStatus[];

  /** Filter by job type */
  jobType?: string;

  /** Maximum number of jobs to return */
  limit?: number;

  /** Number of jobs to skip (for pagination) */
  offset?: number;

  /** Field to sort by */
  sortBy?: 'queuedAt' | 'priority' | 'status';

  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
}

// ============================================================================
// Storage Adapter Interface
// ============================================================================

/**
 * Storage adapter interface for queue persistence
 *
 * Enables swappable storage backends:
 * - Default: InMemoryStorage (included, zero dependencies)
 * - Future: RedisStorage, PostgresStorage (separate packages)
 *
 * All methods are async for consistency across adapter implementations.
 * Optional lifecycle methods (`connect`, `disconnect`, `healthCheck`) support
 * adapters that require connection management.
 *
 * @example Default in-memory storage
 * ```typescript
 * import { createQueuePlugin, createInMemoryStorage } from '@blaizejs/queue';
 *
 * // In-memory is the default (no need to specify)
 * createQueuePlugin({
 *   queues: { default: { concurrency: 5 } }
 * });
 *
 * // Or explicitly:
 * createQueuePlugin({
 *   queues: { default: { concurrency: 5 } },
 *   storage: createInMemoryStorage()
 * });
 * ```
 *
 * @example Future Redis adapter (separate package)
 * ```typescript
 * import { createQueuePlugin } from '@blaizejs/queue';
 * import { createRedisStorage } from '@blaizejs/queue-redis';
 *
 * createQueuePlugin({
 *   queues: { default: { concurrency: 5 } },
 *   storage: createRedisStorage({
 *     url: 'redis://localhost:6379',
 *     prefix: 'myapp:queue:'
 *   })
 * });
 * ```
 *
 * @example Custom adapter implementation
 * ```typescript
 * class MyCustomStorage implements QueueStorageAdapter {
 *   async enqueue(queueName: string, job: Job): Promise<void> {
 *     // Store job in your backend
 *   }
 *
 *   async dequeue(queueName: string): Promise<Job | null> {
 *     // Return highest priority job or null
 *   }
 *
 *   // ... implement all required methods
 * }
 * ```
 */
export interface QueueStorageAdapter {
  // ──────────────────────────────────────────────────────────────────────────
  // Queue Operations
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Add a job to the queue
   *
   * @param queueName - Name of the queue
   * @param job - Job to enqueue
   */
  enqueue(queueName: string, job: Job): Promise<void>;

  /**
   * Remove and return the highest priority job from the queue
   *
   * Returns the job with highest priority (and earliest queuedAt for ties).
   * Returns null if queue is empty.
   *
   * @param queueName - Name of the queue
   * @returns The highest priority job, or null if empty
   */
  dequeue(queueName: string): Promise<Job | null>;

  /**
   * View the highest priority job without removing it
   *
   * @param queueName - Name of the queue
   * @returns The highest priority job, or null if empty
   */
  peek(queueName: string): Promise<Job | null>;

  // ──────────────────────────────────────────────────────────────────────────
  // Job Retrieval
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Get a specific job by ID
   *
   * @param jobId - Unique job identifier
   * @param queueName - Optional queue name to narrow search
   * @returns The job if found, or null
   */
  getJob(jobId: string, queueName?: string): Promise<Job | null>;

  /**
   * List jobs matching the given filters
   *
   * @param queueName - Name of the queue
   * @param filters - Optional filter criteria
   * @returns Array of matching jobs
   */
  listJobs(queueName: string, filters?: JobFilters): Promise<Job[]>;

  // ──────────────────────────────────────────────────────────────────────────
  // Job Updates
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Update a job's properties
   *
   * Used for status changes, progress updates, storing results, etc.
   *
   * @param jobId - Unique job identifier
   * @param updates - Partial job updates to apply
   */
  updateJob(jobId: string, updates: Partial<Job>): Promise<void>;

  /**
   * Remove a job from storage
   *
   * @param jobId - Unique job identifier
   * @returns true if job was removed, false if not found
   */
  removeJob(jobId: string): Promise<boolean>;

  // ──────────────────────────────────────────────────────────────────────────
  // Statistics
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Get statistics for a queue
   *
   * @param queueName - Name of the queue
   * @returns Queue statistics
   */
  getQueueStats(queueName: string): Promise<QueueStats>;

  // ──────────────────────────────────────────────────────────────────────────
  // Lifecycle (Optional)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Initialize the storage connection
   *
   * Called during plugin initialization. Implement for adapters that
   * require connection setup (e.g., Redis, PostgreSQL).
   *
   * For InMemoryStorage, this is a no-op.
   */
  connect?(): Promise<void>;

  /**
   * Close the storage connection
   *
   * Called during plugin shutdown. Implement for adapters that
   * require connection cleanup.
   *
   * For InMemoryStorage, this is a no-op.
   */
  disconnect?(): Promise<void>;

  /**
   * Check if storage is healthy
   *
   * Used for health checks and monitoring.
   *
   * @returns true if storage is healthy, false otherwise
   */
  healthCheck?(): Promise<boolean>;
}

// ============================================================================
// Queue Configuration Types
// ============================================================================

/**
 * Configuration for a single queue
 *
 * @example
 * ```typescript
 * const emailQueueConfig: QueueConfig = {
 *   name: 'emails',
 *   concurrency: 10,
 *   defaultTimeout: 60000,
 *   defaultMaxRetries: 5
 * };
 * ```
 */
export interface QueueConfig {
  /** Queue name (unique identifier) */
  name: string;

  /**
   * Maximum concurrent job executions
   * @default 5
   */
  concurrency?: number;

  /**
   * Default timeout for jobs in this queue (ms)
   * @default 30000
   */
  defaultTimeout?: number;

  /**
   * Default max retries for jobs in this queue
   * @default 3
   */
  defaultMaxRetries?: number;
}

/**
 * Plugin-level configuration
 *
 * @example
 * ```typescript
 * const config: QueuePluginConfig = {
 *   queues: {
 *     default: { concurrency: 5 },
 *     emails: { concurrency: 10, defaultTimeout: 60000 },
 *     reports: { concurrency: 2, defaultMaxRetries: 5 }
 *   },
 *   defaultConcurrency: 5,
 *   defaultTimeout: 30000,
 *   defaultMaxRetries: 3
 * };
 * ```
 */
export interface QueuePluginConfig {
  /**
   * Queue configurations keyed by name
   *
   * Each key becomes the queue name, value is the config.
   */
  queues: Record<string, Omit<QueueConfig, 'name'>>;

  /**
   * Optional storage adapter (defaults to InMemoryStorage)
   *
   * @example
   * ```typescript
   * // Use Redis storage
   * storage: createRedisStorage({ url: 'redis://localhost:6379' })
   * ```
   */
  storage?: QueueStorageAdapter;

  /**
   * Default concurrency for all queues
   * @default 5
   */
  defaultConcurrency?: number;

  /**
   * Default timeout for all jobs (ms)
   * @default 30000
   */
  defaultTimeout?: number;

  /**
   * Default max retries for all jobs
   * @default 3
   */
  defaultMaxRetries?: number;

  /**
   * Job handlers keyed by queue name and job type
   *
   * Register handlers declaratively in config. Handlers are registered
   * during plugin initialization, before queues start processing.
   *
   * @example
   * ```typescript
   * import { sendEmailHandler, verifyEmailHandler } from './handlers/email';
   * import { generateReportHandler } from './handlers/reports';
   *
   * createQueuePlugin({
   *   queues: {
   *     emails: { concurrency: 5 },
   *     reports: { concurrency: 2 },
   *   },
   *   handlers: {
   *     emails: {
   *       'send': sendEmailHandler,
   *       'verify': verifyEmailHandler,
   *     },
   *     reports: {
   *       'generate': generateReportHandler,
   *     },
   *   },
   * });
   * ```
   */
  handlers?: Record<string, Record<string, JobHandler<any, any>>>;

  /**
   * Server ID for multi-server coordination
   *
   * When provided, enables EventBus integration for cross-server job visibility.
   * Should be unique per server instance (e.g., pod name, hostname).
   *
   * @example
   * ```typescript
   * createQueuePlugin({
   *   serverId: `server-${process.env.POD_NAME || 'local'}`,
   *   queues: { emails: { concurrency: 5 } },
   * })
   * ```
   */
  serverId?: string;
}

// ============================================================================
// Queue Instance Types (for T6)
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
// Queue Service Types (for T10)
// ============================================================================

/**
 * Subscription callbacks for job events
 *
 * @example
 * ```typescript
 * const unsubscribe = queueService.subscribe(jobId, {
 *   onProgress: (percent, message) => {
 *     console.log(`Progress: ${percent}% - ${message}`);
 *   },
 *   onCompleted: (result) => {
 *     console.log('Job completed:', result);
 *   },
 *   onFailed: (error) => {
 *     console.error('Job failed:', error);
 *   }
 * });
 *
 * // Later: unsubscribe()
 * ```
 */
export interface JobSubscription {
  /** Called when job progress updates */
  onProgress?: (percent: number, message?: string) => void;

  /** Called when job completes successfully */
  onCompleted?: (result: unknown) => void;

  /** Called when job fails (exhausted retries) */
  onFailed?: (error: JobError) => void;

  /** Called when job is cancelled */
  onCancelled?: (reason?: string) => void;
}

/**
 * Configuration for QueueService
 */
export interface QueueServiceConfig {
  /** Queue configurations keyed by name */
  queues: Record<string, Omit<QueueConfig, 'name'>>;

  /** Shared storage adapter for all queues */
  storage: QueueStorageAdapter;

  /** Logger instance from plugin */
  logger: BlaizeLogger;

  /**
   * EventBus for cross-server job coordination
   * Events published: `queue:job:state-change`
   */
  eventBus: EventBus;

  /**
   * Server ID for multi-server setups
   * Required when using eventBus to track which server processed jobs.
   */
  serverId?: string;
}

// ============================================================================
// Error Detail Interfaces
// ============================================================================

/**
 * Details for QueueError base class
 */
export interface QueueErrorDetails {
  /** Additional context about the error */
  [key: string]: unknown;
}

/**
 * Details for job not found errors
 */
export interface JobNotFoundDetails {
  /** The job ID that was not found */
  jobId: string;
  /** Queue name where job was searched (if specified) */
  queueName?: string;
}

/**
 * Details for job timeout errors
 */
export interface JobTimeoutDetails {
  /** The job ID that timed out */
  jobId: string;
  /** Queue name where job was running */
  queueName: string;
  /** Job type */
  jobType: string;
  /** Configured timeout in milliseconds */
  timeoutMs: number;
  /** How long the job actually ran before timeout */
  elapsedMs?: number;
}

/**
 * Details for job cancelled errors
 */
export interface JobCancelledDetails {
  /** The job ID that was cancelled */
  jobId: string;
  /** Queue name where job was running */
  queueName: string;
  /** Job type */
  jobType: string;
  /** Reason for cancellation */
  reason?: string;
  /** Whether job was running when cancelled */
  wasRunning: boolean;
}

/**
 * Details for handler not found errors
 */
export interface HandlerNotFoundDetails {
  /** The job type that has no handler */
  jobType: string;
  /** Queue name where handler was expected */
  queueName: string;
  /** List of registered handlers (for debugging) */
  registeredHandlers?: string[];
}

/**
 * Details for queue not found errors
 */
export interface QueueNotFoundDetails {
  /** The queue name that was not found */
  queueName: string;
  /** List of available queues (for debugging) */
  availableQueues?: string[];
}

/**
 * Details for queue configuration errors
 */
export interface QueueConfigErrorDetails {
  /** The configuration field that is invalid */
  field: string;
  /** The invalid value provided */
  value: unknown;
  /** What was expected */
  expected: string;
  /** Additional context */
  [key: string]: unknown;
}

/**
 * Details for storage adapter errors
 */
export interface StorageErrorDetails {
  /** The storage operation that failed */
  operation:
    | 'enqueue'
    | 'dequeue'
    | 'getJob'
    | 'updateJob'
    | 'removeJob'
    | 'listJobs'
    | 'getStats'
    | 'connect'
    | 'disconnect'
    | 'healthCheck';
  /** Queue name involved (if applicable) */
  queueName?: string;
  /** Job ID involved (if applicable) */
  jobId?: string;
  /** Original error message */
  originalError?: string;
  /** Additional context */
  [key: string]: unknown;
}

// ============================================================================
// Types
// ============================================================================

/**
 * Internal item stored in the priority queue
 *
 * Wraps user data with priority and timestamp for ordering.
 *
 * @template T - Type of the data being queued
 */
export interface PriorityQueueItem<T> {
  /** Priority level (higher = processed first) */
  priority: number;

  /** The actual data being queued */
  data: T;

  /** Timestamp when item was enqueued (for FIFO within same priority) */
  enqueuedAt: number;
}

/**
 * Type-safe priority queue interface
 *
 * Provides a clean API for priority-based scheduling with:
 * - Higher priority items dequeued first
 * - FIFO ordering within same priority level
 * - O(log n) enqueue/dequeue operations
 *
 * @template T - Type of the data being queued
 *
 * @example Basic usage
 * ```typescript
 * const queue = createPriorityQueue<string>();
 *
 * queue.enqueue('low-priority-task', 1);
 * queue.enqueue('high-priority-task', 10);
 * queue.enqueue('medium-priority-task', 5);
 *
 * console.log(queue.dequeue()); // 'high-priority-task'
 * console.log(queue.dequeue()); // 'medium-priority-task'
 * console.log(queue.dequeue()); // 'low-priority-task'
 * ```
 *
 * @example With job objects
 * ```typescript
 * interface Job {
 *   id: string;
 *   type: string;
 *   data: unknown;
 * }
 *
 * const jobQueue = createPriorityQueue<Job>();
 *
 * jobQueue.enqueue({ id: '1', type: 'email', data: {} }, 5);
 * jobQueue.enqueue({ id: '2', type: 'urgent', data: {} }, 10);
 *
 * const nextJob = jobQueue.dequeue();
 * // nextJob = { id: '2', type: 'urgent', data: {} }
 * ```
 */
export interface PriorityQueue<T> {
  /**
   * Add an item to the queue with a given priority
   *
   * Higher priority values are dequeued first.
   * Items with same priority follow FIFO order.
   *
   * @param item - The item to enqueue
   * @param priority - Priority level (higher = processed first)
   *
   * @example
   * ```typescript
   * queue.enqueue('task-a', 5);  // Normal priority
   * queue.enqueue('task-b', 10); // High priority (dequeued first)
   * queue.enqueue('task-c', 1);  // Low priority (dequeued last)
   * ```
   */
  enqueue(item: T, priority: number): void;

  /**
   * Remove and return the highest priority item
   *
   * Returns undefined if queue is empty.
   *
   * @returns The highest priority item, or undefined if empty
   *
   * @example
   * ```typescript
   * const item = queue.dequeue();
   * if (item !== undefined) {
   *   processItem(item);
   * }
   * ```
   */
  dequeue(): T | undefined;

  /**
   * View the highest priority item without removing it
   *
   * Returns undefined if queue is empty.
   *
   * @returns The highest priority item, or undefined if empty
   *
   * @example
   * ```typescript
   * const next = queue.peek();
   * if (next !== undefined) {
   *   console.log('Next item:', next);
   * }
   * ```
   */
  peek(): T | undefined;

  /**
   * Get the number of items in the queue
   *
   * @returns Current queue size
   *
   * @example
   * ```typescript
   * console.log(`Queue has ${queue.size()} items`);
   * ```
   */
  size(): number;

  /**
   * Check if the queue is empty
   *
   * @returns true if queue has no items
   *
   * @example
   * ```typescript
   * while (!queue.isEmpty()) {
   *   const item = queue.dequeue();
   *   processItem(item);
   * }
   * ```
   */
  isEmpty(): boolean;

  /**
   * Remove all items from the queue
   *
   * @example
   * ```typescript
   * queue.clear();
   * console.log(queue.size()); // 0
   * ```
   */
  clear(): void;

  /**
   * Get all items in priority order (highest first)
   *
   * Does not modify the queue.
   *
   * @returns Array of items in priority order
   *
   * @example
   * ```typescript
   * const items = queue.toArray();
   * console.log('Queue contents:', items);
   * ```
   */
  toArray(): T[];
}

/**
 * Schema definition for a single job type
 *
 * Defines the Zod schema for validation and default options.
 *
 * @example
 * ```typescript
 * const emailJobType: JobTypeDefinition<typeof emailSchema> = {
 *   schema: z.object({ to: z.string().email(), subject: z.string() }),
 *   priority: 5,
 *   timeout: 60000,
 *   maxRetries: 3
 * };
 * ```
 */
export interface JobTypeDefinition<TSchema extends z.ZodType = z.ZodType> {
  /** Zod schema for validating job data */
  schema: TSchema;
  /** Default priority for this job type */
  priority?: JobPriority;
  /** Default timeout for this job type (ms) */
  timeout?: number;
  /** Default max retries for this job type */
  maxRetries?: number;
}

/**
 * Schema mapping job type names to their definitions
 *
 * @example
 * ```typescript
 * const jobTypes = {
 *   'email:send': {
 *     schema: z.object({ to: z.string().email() }),
 *     priority: 5,
 *   },
 *   'report:generate': {
 *     schema: z.object({ reportId: z.string() }),
 *     priority: 3,
 *     timeout: 120000,
 *   },
 * } satisfies JobTypesSchema;
 */
export type JobTypesSchema = Record<string, JobTypeDefinition>;

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
 * Details for handler already registered errors
 */
export interface HandlerAlreadyRegisteredDetails {
  /** The job type that already has a handler */
  jobType: string;
  /** Queue name where handler is registered */
  queueName: string;
}

// ============================================================================
// Plugin Services Interface
// ============================================================================

/**
 * Services exposed by the queue plugin via middleware
 *
 * These are accessible via `ctx.services.queue` in route handlers.
 */
export interface QueuePluginServices extends Services {
  /** Queue service instance for job operations */
  queue: QueueService;
}

// ============================================================================
// Dashboard Types
// ============================================================================
/**
 * Dashboard data structure
 *
 * Contains all queue information needed to render the dashboard.
 */
export interface DashboardData {
  /** Queue data with stats and jobs */
  queues: Array<{
    name: string;
    stats: QueueStats;
    jobs: Job[];
  }>;
  /** Timestamp when data was gathered */
  timestamp: number;
}

/**
 * Dashboard rendering options
 */
export interface DashboardOptions {
  /** Auto-refresh interval in seconds (adds meta refresh tag) */
  refreshInterval?: number;
}

/**
 * Formatted job for API responses
 *
 * Serializable representation of a job with all relevant fields.
 * Used by queueStatusHandler and other JSON endpoints.
 */
export interface FormattedJob {
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
 * Queue status response shape
 */
export interface QueueStatusResponse {
  queues: Array<{
    name: string;
    stats: QueueStats;
    jobs: FormattedJob[];
  }>;
  timestamp: number;
}
