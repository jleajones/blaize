/**
 * In-Memory Storage Adapter
 *
 * Default storage implementation for the queue plugin using
 * in-memory data structures. Perfect for development and
 * single-instance production deployments.
 *
 * @module @blaizejs/queue/storage/in-memory
 * @since 0.4.0
 */
import { createPriorityQueue } from '../priority-queue';

import type {
  QueueStorageAdapter,
  Job,
  JobFilters,
  JobStatus,
  QueueStats,
  PriorityQueue,
} from '../types';

// ============================================================================
// Types
// ============================================================================

/**
 * Default queue statistics
 */
const DEFAULT_STATS: QueueStats = {
  total: 0,
  queued: 0,
  running: 0,
  completed: 0,
  failed: 0,
  cancelled: 0,
};

/**
 * Default filter options
 */
const DEFAULT_FILTERS: Required<Pick<JobFilters, 'limit' | 'offset' | 'sortOrder'>> = {
  limit: 50,
  offset: 0,
  sortOrder: 'desc',
};

// ============================================================================
// InMemoryStorage Class
// ============================================================================

/**
 * In-memory storage adapter for queue persistence
 *
 * This is the default storage adapter included with the queue plugin.
 * It stores all jobs in memory using efficient data structures:
 * - Priority queue for job ordering (O(log n) enqueue/dequeue)
 * - Map for O(1) job lookup by ID
 * - Incremental statistics tracking
 *
 * **Features:**
 * - Zero external dependencies
 * - Priority-based job ordering
 * - Fast job lookup by ID
 * - Efficient filtering and pagination
 *
 * **Limitations:**
 * - Data is lost on process restart
 * - Single instance only (no horizontal scaling)
 * - Memory bound (limited by available RAM)
 *
 * For production deployments requiring persistence or horizontal scaling,
 * consider using Redis or PostgreSQL adapters (separate packages).
 *
 * @example Basic usage
 * ```typescript
 * import { createInMemoryStorage } from '@blaizejs/queue';
 *
 * const storage = createInMemoryStorage();
 *
 * // Enqueue a job
 * await storage.enqueue('default', {
 *   id: 'job_123',
 *   type: 'email:send',
 *   queueName: 'default',
 *   data: { to: 'user@example.com' },
 *   status: 'queued',
 *   priority: 5,
 *   // ... other fields
 * });
 *
 * // Dequeue highest priority job
 * const job = await storage.dequeue('default');
 * ```
 *
 * @example With queue plugin
 * ```typescript
 * import { createQueuePlugin, createInMemoryStorage } from '@blaizejs/queue';
 *
 * // Explicit (same as default)
 * createQueuePlugin({
 *   queues: { default: { concurrency: 5 } },
 *   storage: createInMemoryStorage()
 * });
 * ```
 */
export class InMemoryStorage implements QueueStorageAdapter {
  /**
   * Priority queues for each queue name
   * Used for ordering jobs by priority
   */
  private queues: Map<string, PriorityQueue<Job>>;

  /**
   * Global job storage for O(1) lookup by ID
   */
  private jobs: Map<string, Job>;

  /**
   * Mapping of job ID to queue name
   * Used to find which queue a job belongs to
   */
  private jobToQueue: Map<string, string>;

  /**
   * Incremental statistics per queue
   */
  private stats: Map<string, QueueStats>;

  /**
   * Create a new InMemoryStorage instance
   *
   * @example
   * ```typescript
   * const storage = new InMemoryStorage();
   * ```
   */
  constructor() {
    this.queues = new Map();
    this.jobs = new Map();
    this.jobToQueue = new Map();
    this.stats = new Map();
  }

  // ==========================================================================
  // Queue Operations
  // ==========================================================================

  /**
   * Add a job to the queue
   *
   * Jobs are stored in both the priority queue (for ordering) and
   * the jobs map (for O(1) lookup). Statistics are updated incrementally.
   *
   * @param queueName - Name of the queue
   * @param job - Job to enqueue
   *
   * @example
   * ```typescript
   * await storage.enqueue('emails', {
   *   id: 'job_123',
   *   type: 'email:send',
   *   queueName: 'emails',
   *   data: { to: 'user@example.com' },
   *   status: 'queued',
   *   priority: 5,
   *   progress: 0,
   *   queuedAt: Date.now(),
   *   retries: 0,
   *   maxRetries: 3,
   *   timeout: 30000,
   *   metadata: {}
   * });
   * ```
   */
  async enqueue(queueName: string, job: Job): Promise<void> {
    // Ensure queue exists
    if (!this.queues.has(queueName)) {
      this.queues.set(queueName, createPriorityQueue<Job>());
      this.stats.set(queueName, { ...DEFAULT_STATS });
    }

    const queue = this.queues.get(queueName)!;
    const stats = this.stats.get(queueName)!;

    // Add to priority queue
    queue.enqueue(job, job.priority);

    // Store in jobs map for O(1) lookup
    this.jobs.set(job.id, job);
    this.jobToQueue.set(job.id, queueName);

    // Update statistics
    stats.total++;
    this.incrementStatusCount(stats, job.status);
  }

  /**
   * Remove and return the highest priority job from the queue
   *
   * Returns the job with highest priority. For jobs with the same
   * priority, returns the one that was enqueued first (FIFO).
   *
   * @param queueName - Name of the queue
   * @returns The highest priority job, or null if queue is empty
   *
   * @example
   * ```typescript
   * const job = await storage.dequeue('emails');
   * if (job) {
   *   console.log(`Processing job ${job.id}`);
   * }
   * ```
   */
  async dequeue(queueName: string): Promise<Job | null> {
    const queue = this.queues.get(queueName);
    if (!queue || queue.isEmpty()) {
      return null;
    }

    const job = queue.dequeue();
    if (!job) {
      return null;
    }

    // Note: We don't remove from jobs map here - the job is still tracked
    // It will be removed when the job completes/fails/is cancelled

    return job;
  }

  /**
   * View the highest priority job without removing it
   *
   * @param queueName - Name of the queue
   * @returns The highest priority job, or null if queue is empty
   *
   * @example
   * ```typescript
   * const nextJob = await storage.peek('emails');
   * if (nextJob) {
   *   console.log(`Next job will be ${nextJob.id}`);
   * }
   * ```
   */
  async peek(queueName: string): Promise<Job | null> {
    const queue = this.queues.get(queueName);
    if (!queue || queue.isEmpty()) {
      return null;
    }

    return queue.peek() ?? null;
  }

  // ==========================================================================
  // Job Retrieval
  // ==========================================================================

  /**
   * Get a specific job by ID
   *
   * Uses O(1) map lookup. Optionally filters by queue name.
   *
   * @param jobId - Unique job identifier
   * @param queueName - Optional queue name to narrow search
   * @returns The job if found, or null
   *
   * @example
   * ```typescript
   * // Find job in any queue
   * const job = await storage.getJob('job_123');
   *
   * // Find job in specific queue
   * const job = await storage.getJob('job_123', 'emails');
   * ```
   */
  async getJob(jobId: string, queueName?: string): Promise<Job | null> {
    const job = this.jobs.get(jobId);
    if (!job) {
      return null;
    }

    // If queueName specified, verify job is in that queue
    if (queueName !== undefined) {
      const jobQueue = this.jobToQueue.get(jobId);
      if (jobQueue !== queueName) {
        return null;
      }
    }

    return job;
  }

  /**
   * List jobs matching the given filters
   *
   * Supports filtering by status, job type, and pagination.
   *
   * @param queueName - Name of the queue
   * @param filters - Optional filter criteria
   * @returns Array of matching jobs
   *
   * @example
   * ```typescript
   * // Get all failed jobs
   * const failed = await storage.listJobs('emails', { status: 'failed' });
   *
   * // Get recent completed jobs with pagination
   * const completed = await storage.listJobs('emails', {
   *   status: 'completed',
   *   limit: 10,
   *   offset: 0,
   *   sortBy: 'queuedAt',
   *   sortOrder: 'desc'
   * });
   *
   * // Filter by job type
   * const emailJobs = await storage.listJobs('emails', {
   *   jobType: 'email:send',
   *   limit: 20
   * });
   * ```
   */
  async listJobs(queueName: string, filters?: JobFilters): Promise<Job[]> {
    const {
      status,
      jobType,
      limit = DEFAULT_FILTERS.limit,
      offset = DEFAULT_FILTERS.offset,
      sortBy = 'queuedAt',
      sortOrder = DEFAULT_FILTERS.sortOrder,
    } = filters ?? {};

    // Collect all jobs for this queue
    const queueJobs: Job[] = [];
    for (const [jobId, queue] of this.jobToQueue.entries()) {
      if (queue === queueName) {
        const job = this.jobs.get(jobId);
        if (job) {
          queueJobs.push(job);
        }
      }
    }

    // Apply filters
    let result = queueJobs;

    // Filter by status
    if (status !== undefined) {
      const statusArray = Array.isArray(status) ? status : [status];
      result = result.filter(job => statusArray.includes(job.status));
    }

    // Filter by job type
    if (jobType !== undefined) {
      result = result.filter(job => job.type === jobType);
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'priority':
          comparison = a.priority - b.priority;
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'queuedAt':
        default:
          comparison = a.queuedAt - b.queuedAt;
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    // Apply pagination
    return result.slice(offset, offset + limit);
  }

  // ==========================================================================
  // Job Updates
  // ==========================================================================

  /**
   * Update a job's properties
   *
   * Used for status changes, progress updates, storing results, etc.
   * Statistics are updated automatically when status changes.
   *
   * @param jobId - Unique job identifier
   * @param updates - Partial job updates to apply
   *
   * @example
   * ```typescript
   * // Update job status to running
   * await storage.updateJob('job_123', {
   *   status: 'running',
   *   startedAt: Date.now()
   * });
   *
   * // Update progress
   * await storage.updateJob('job_123', {
   *   progress: 50,
   *   progressMessage: 'Processing batch 2/4'
   * });
   *
   * // Complete job with result
   * await storage.updateJob('job_123', {
   *   status: 'completed',
   *   completedAt: Date.now(),
   *   progress: 100,
   *   result: { messageId: 'msg_456' }
   * });
   * ```
   */
  async updateJob(jobId: string, updates: Partial<Job>): Promise<void> {
    const existingJob = this.jobs.get(jobId);
    if (!existingJob) {
      return; // Job not found - silently ignore
    }

    const queueName = this.jobToQueue.get(jobId);
    const stats = queueName ? this.stats.get(queueName) : undefined;

    // Track status change for stats update
    const oldStatus = existingJob.status;
    const newStatus = updates.status;

    // Create updated job (maintaining readonly constraint by creating new object)
    const updatedJob: Job = {
      ...existingJob,
      ...updates,
    } as Job;

    // Update job in storage
    this.jobs.set(jobId, updatedJob);

    // Update statistics if status changed
    if (stats && newStatus !== undefined && newStatus !== oldStatus) {
      this.decrementStatusCount(stats, oldStatus);
      this.incrementStatusCount(stats, newStatus);
    }
  }

  /**
   * Remove a job from storage
   *
   * Removes the job from all data structures and updates statistics.
   *
   * @param jobId - Unique job identifier
   * @returns true if job was removed, false if not found
   *
   * @example
   * ```typescript
   * const removed = await storage.removeJob('job_123');
   * if (removed) {
   *   console.log('Job removed successfully');
   * }
   * ```
   */
  async removeJob(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job) {
      return false;
    }

    const queueName = this.jobToQueue.get(jobId);

    // Remove from jobs map
    this.jobs.delete(jobId);
    this.jobToQueue.delete(jobId);

    // Update statistics
    if (queueName) {
      const stats = this.stats.get(queueName);
      if (stats) {
        stats.total--;
        this.decrementStatusCount(stats, job.status);
      }
    }

    // Note: We don't remove from the priority queue here because
    // jobs are removed from the queue via dequeue(), not removeJob().
    // Jobs in terminal states (completed/failed/cancelled) aren't in
    // the priority queue anyway.

    return true;
  }

  // ==========================================================================
  // Statistics
  // ==========================================================================

  /**
   * Get statistics for a queue
   *
   * Returns incrementally tracked statistics (not computed on each call).
   *
   * @param queueName - Name of the queue
   * @returns Queue statistics
   *
   * @example
   * ```typescript
   * const stats = await storage.getQueueStats('emails');
   * console.log(`Total: ${stats.total}, Running: ${stats.running}`);
   * ```
   */
  async getQueueStats(queueName: string): Promise<QueueStats> {
    const stats = this.stats.get(queueName);
    if (!stats) {
      return { ...DEFAULT_STATS };
    }

    return { ...stats };
  }

  // ==========================================================================
  // Lifecycle Methods
  // ==========================================================================

  /**
   * Initialize storage connection (no-op for in-memory)
   *
   * This method exists for interface compatibility with adapters
   * that require connection setup (e.g., Redis, PostgreSQL).
   *
   * @example
   * ```typescript
   * await storage.connect();
   * // Always succeeds immediately
   * ```
   */
  async connect(): Promise<void> {
    // No-op for in-memory storage
  }

  /**
   * Close storage connection (no-op for in-memory)
   *
   * This method exists for interface compatibility with adapters
   * that require connection cleanup.
   *
   * @example
   * ```typescript
   * await storage.disconnect();
   * // Always succeeds immediately
   * ```
   */
  async disconnect(): Promise<void> {
    // No-op for in-memory storage
  }

  /**
   * Check if storage is healthy (always true for in-memory)
   *
   * This method exists for interface compatibility with adapters
   * that require health checks.
   *
   * @returns Always returns true
   *
   * @example
   * ```typescript
   * const healthy = await storage.healthCheck();
   * // healthy === true
   * ```
   */
  async healthCheck(): Promise<boolean> {
    return true;
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  /**
   * Increment the count for a status in queue stats
   */
  private incrementStatusCount(stats: QueueStats, status: JobStatus): void {
    switch (status) {
      case 'queued':
        stats.queued++;
        break;
      case 'running':
        stats.running++;
        break;
      case 'completed':
        stats.completed++;
        break;
      case 'failed':
        stats.failed++;
        break;
      case 'cancelled':
        stats.cancelled++;
        break;
    }
  }

  /**
   * Decrement the count for a status in queue stats
   */
  private decrementStatusCount(stats: QueueStats, status: JobStatus): void {
    switch (status) {
      case 'queued':
        stats.queued = Math.max(0, stats.queued - 1);
        break;
      case 'running':
        stats.running = Math.max(0, stats.running - 1);
        break;
      case 'completed':
        stats.completed = Math.max(0, stats.completed - 1);
        break;
      case 'failed':
        stats.failed = Math.max(0, stats.failed - 1);
        break;
      case 'cancelled':
        stats.cancelled = Math.max(0, stats.cancelled - 1);
        break;
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new in-memory storage adapter
 *
 * Factory function for creating InMemoryStorage instances.
 * This is the recommended way to create storage adapters.
 *
 * @returns A new QueueStorageAdapter instance
 *
 * @example Default usage (in-memory is the default)
 * ```typescript
 * import { createQueuePlugin } from '@blaizejs/queue';
 *
 * // In-memory storage is used by default
 * createQueuePlugin({
 *   queues: { default: { concurrency: 5 } }
 * });
 * ```
 *
 * @example Explicit usage
 * ```typescript
 * import { createQueuePlugin, createInMemoryStorage } from '@blaizejs/queue';
 *
 * createQueuePlugin({
 *   queues: { default: { concurrency: 5 } },
 *   storage: createInMemoryStorage()
 * });
 * ```
 *
 * @example Standalone usage
 * ```typescript
 * import { createInMemoryStorage } from '@blaizejs/queue';
 *
 * const storage = createInMemoryStorage();
 *
 * await storage.enqueue('myQueue', job);
 * const nextJob = await storage.dequeue('myQueue');
 * ```
 */
export function createInMemoryStorage(): QueueStorageAdapter {
  return new InMemoryStorage();
}
