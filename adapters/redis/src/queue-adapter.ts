/**
 * Redis Queue Adapter Implementation
 *
 * Provides queue operations using Redis with:
 * - Sorted sets for priority-based job ordering
 * - Hashes for job storage
 * - Lua scripts for atomic operations
 *
 * Queue Structure:
 * - Sorted sets: `queue:{name}:{status}` - stores job IDs with priority scores
 * - Hashes: `job:{jobId}` - stores complete job data
 * - Score: -priority + (timestamp / 1e13) for proper ordering
 *
 * @module @blaizejs/adapter-redis/queue-adapter
 * @since 0.1.0
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createLogger } from 'blaizejs';

import { RedisOperationError } from './errors';

import type {
  JobFilters,
  QueueJob,
  QueueStats,
  RedisClient,
  RedisQueueAdapterOptions,
} from './types';
import type { BlaizeLogger } from 'blaizejs';

/**
 * Default options for RedisQueueAdapter
 */
const DEFAULT_OPTIONS = {
  keyPrefix: 'queue:',
};

/**
 * Load Lua script from file
 */
function loadLuaScript(filename: string): string {
  const scriptPath = join(__dirname, 'lua', filename);
  return readFileSync(scriptPath, 'utf-8');
}

/**
 * RedisQueueAdapter - Queue storage using Redis
 *
 * Implements queue operations with Redis backend, providing:
 * - Priority-based job ordering
 * - Atomic dequeue with Lua scripts
 * - Job persistence across restarts
 * - Efficient filtering and statistics
 */
export class RedisQueueAdapter {
  private readonly client: RedisClient;
  private readonly keyPrefix: string;
  private readonly logger: BlaizeLogger;

  private isConnected = false;

  // Lua scripts content (stored for defineCommand)
  private dequeueScript?: string;
  private completeScript?: string;
  private failScript?: string;

  private dequeueSha?: string;
  private completeSha?: string;
  private failSha?: string;

  constructor(client: RedisClient, options?: RedisQueueAdapterOptions) {
    this.client = client;
    this.keyPrefix = options?.keyPrefix ?? DEFAULT_OPTIONS.keyPrefix;

    // Setup logger
    if (options?.logger) {
      this.logger = options.logger.child({ component: 'RedisQueueAdapter' });
    } else {
      this.logger = createLogger().child({ component: 'RedisQueueAdapter' });
    }

    this.logger.info('RedisQueueAdapter created', {
      keyPrefix: this.keyPrefix,
    });
  }

  /**
   * Connect to Redis and load Lua scripts
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      this.logger.debug('Already connected, skipping connect()');
      return;
    }

    this.logger.info('Connecting RedisQueueAdapter');

    // Ensure client is connected
    if (!this.client.isConnected()) {
      await this.client.connect();
    }

    // Load Lua scripts from files and define as custom commands
    try {
      this.dequeueScript = loadLuaScript('dequeue.lua');
      this.completeScript = loadLuaScript('complete.lua');
      this.failScript = loadLuaScript('fail.lua');

      this.logger.debug('Lua scripts loaded from files');

      // Define custom commands on the Redis connection
      // ioredis will automatically handle SCRIPT LOAD + EVALSHA caching
      const connection = this.client.getConnection();

      this.dequeueSha = (await connection.script('LOAD', this.dequeueScript)) as string;
      this.completeSha = (await connection.script('LOAD', this.completeScript)) as string;
      this.failSha = (await connection.script('LOAD', this.failScript)) as string;

      this.logger.debug('Lua scripts registered in Redis', {
        dequeueSha: this.dequeueSha,
        completeSha: this.completeSha,
        failSha: this.failSha,
      });
    } catch (error) {
      this.logger.error('Failed to load Lua scripts', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(
        `Failed to load Lua scripts: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    this.isConnected = true;
    this.logger.info('RedisQueueAdapter connected');
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (!this.isConnected) {
      this.logger.debug('Not connected, skipping disconnect()');
      return;
    }

    this.logger.info('Disconnecting RedisQueueAdapter');

    this.isConnected = false;

    this.logger.info('RedisQueueAdapter disconnected');
  }

  /**
   * Add a job to the queue
   *
   * @param queueName - Name of the queue
   * @param job - Job to enqueue
   */
  async enqueue(queueName: string, job: QueueJob): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Adapter not connected. Call connect() first.');
    }

    const connection = this.client.getConnection();
    const jobKey = this.buildJobKey(job.id);
    const queueKey = this.buildQueueKey(queueName, job.status);

    try {
      // Calculate score: -priority + (timestamp / 1e13)
      // This ensures: higher priority = lower score = processed first
      // Same priority: earlier timestamp = FIFO
      const score = job.priority + job.queuedAt / 1e13;

      // Use pipeline for atomicity
      const pipeline = connection.pipeline();

      // Store job data in hash
      pipeline.hset(jobKey, this.jobToHash(job));

      // Add job ID to sorted set with priority score
      pipeline.zadd(queueKey, score, job.id);

      await pipeline.exec();

      this.logger.debug('Job enqueued', {
        jobId: job.id,
        queueName,
        priority: job.priority,
        score,
      });
    } catch (error) {
      this.logger.error('ENQUEUE failed', {
        jobId: job.id,
        queueName,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new RedisOperationError('ENQUEUE failed', {
        operation: 'ZADD',
        key: queueKey,
        originalError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Remove and return the highest priority job from the queue
   *
   * Uses Lua script for atomic operation to prevent race conditions.
   *
   * @param queueName - Name of the queue
   * @returns The highest priority job, or null if empty
   */
  async dequeue(queueName: string): Promise<QueueJob | null> {
    if (!this.isConnected) {
      throw new Error('Adapter not connected. Call connect() first.');
    }

    if (!this.dequeueScript) {
      throw new Error('Dequeue script not loaded');
    }

    const connection = this.client.getConnection();
    const queuedKey = this.buildQueueKey(queueName, 'queued');
    const runningKey = this.buildQueueKey(queueName, 'running');
    const jobKeyPrefix = 'job:';

    try {
      // Execute Lua script using custom command (ioredis handles EVALSHA automatically)
      const jobId = (await connection.evalsha(
        this.dequeueSha!,
        3,
        queuedKey,
        runningKey,
        jobKeyPrefix,
        Date.now().toString()
      )) as string | null;

      if (!jobId) {
        this.logger.debug('Dequeue: queue empty', { queueName });
        return null;
      }

      // Fetch the complete job data
      const job = await this.getJob(jobId);

      if (!job) {
        this.logger.warn('Dequeued job not found in storage', { jobId, queueName });
        return null;
      }

      this.logger.debug('Job dequeued', {
        jobId,
        queueName,
        priority: job.priority,
      });

      return job;
    } catch (error) {
      this.logger.error('DEQUEUE failed', {
        queueName,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new RedisOperationError('DEQUEUE failed', {
        operation: 'EVALSHA',
        key: queuedKey,
        originalError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * View the highest priority job without removing it
   *
   * @param queueName - Name of the queue
   * @returns The highest priority job, or null if empty
   */
  async peek(queueName: string): Promise<QueueJob | null> {
    if (!this.isConnected) {
      throw new Error('Adapter not connected. Call connect() first.');
    }

    const connection = this.client.getConnection();
    const queueKey = this.buildQueueKey(queueName, 'queued');

    try {
      // Get the highest priority job ID (lowest score)
      const jobIds = await connection.zrange(queueKey, 0, 0);

      if (jobIds.length === 0) {
        return null;
      }

      const jobId = jobIds[0]!;

      // Fetch the complete job data
      return await this.getJob(jobId);
    } catch (error) {
      this.logger.error('PEEK failed', {
        queueName,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new RedisOperationError('PEEK failed', {
        operation: 'ZRANGE',
        key: queueKey,
        originalError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get a specific job by ID
   *
   * @param jobId - Unique job identifier
   * @param queueName - Optional queue name (not used in Redis, jobs are global)
   * @returns The job if found, or null
   */
  async getJob(jobId: string): Promise<QueueJob | null> {
    if (!this.isConnected) {
      throw new Error('Adapter not connected. Call connect() first.');
    }

    const connection = this.client.getConnection();
    const jobKey = this.buildJobKey(jobId);

    try {
      const jobData = await connection.hgetall(jobKey);

      if (Object.keys(jobData).length === 0) {
        return null;
      }

      return this.hashToJob(jobData);
    } catch (error) {
      this.logger.error('GET_JOB failed', {
        jobId,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new RedisOperationError('GET_JOB failed', {
        operation: 'GET',
        key: jobKey,
        originalError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * List jobs matching the given filters
   *
   * @param queueName - Name of the queue
   * @param filters - Optional filter criteria
   * @returns Array of matching jobs
   */
  async listJobs(queueName: string, filters?: JobFilters): Promise<QueueJob[]> {
    if (!this.isConnected) {
      throw new Error('Adapter not connected. Call connect() first.');
    }

    const connection = this.client.getConnection();
    const limit = filters?.limit ?? 50;
    const offset = filters?.offset ?? 0;

    try {
      // Determine which sorted sets to query based on status filter
      const statuses: QueueJob['status'][] = filters?.status
        ? Array.isArray(filters.status)
          ? filters.status
          : [filters.status]
        : ['queued', 'running', 'completed', 'failed', 'cancelled'];

      const jobs: QueueJob[] = [];

      // Query each status sorted set
      for (const status of statuses) {
        const queueKey = this.buildQueueKey(queueName, status);

        // Get job IDs from sorted set
        const jobIds = await connection.zrange(queueKey, 0, -1);

        // Fetch job data for each ID
        for (const jobId of jobIds) {
          const job = await this.getJob(jobId);

          if (job && (!filters?.jobType || job.type === filters.jobType)) {
            jobs.push(job);
          }
        }
      }

      // Sort if needed
      if (filters?.sortBy) {
        jobs.sort((a, b) => {
          const field = filters.sortBy!;
          const order = filters.sortOrder === 'asc' ? 1 : -1;

          if (field === 'queuedAt' || field === 'priority') {
            return ((a[field] as number) - (b[field] as number)) * order;
          }

          return 0;
        });
      }

      // Apply pagination
      return jobs.slice(offset, offset + limit);
    } catch (error) {
      this.logger.error('LIST_JOBS failed', {
        queueName,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new RedisOperationError('LIST_JOBS failed', {
        operation: 'ZRANGE',
        key: `${this.keyPrefix}${queueName}:*`,
        originalError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Update a job's properties
   *
   * @param jobId - Unique job identifier
   * @param updates - Partial job updates to apply
   */
  async updateJob(jobId: string, updates: Partial<QueueJob>): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Adapter not connected. Call connect() first.');
    }

    // Get current job BEFORE try-catch
    const currentJob = await this.getJob(jobId);

    if (!currentJob) {
      throw new Error(`Job ${jobId} not found`); // Throws directly, not wrapped
    }

    const connection = this.client.getConnection();
    const jobKey = this.buildJobKey(jobId);

    try {
      const oldStatus = currentJob.status;
      const newStatus = updates.status ?? oldStatus;

      // Use pipeline for atomic updates
      const pipeline = connection.pipeline();

      // Update job hash
      const hashUpdates = this.jobToHash({ ...currentJob, ...updates } as QueueJob);
      pipeline.hset(jobKey, hashUpdates);

      // If status changed, move between sorted sets
      // Check if status OR priority changed
      const priorityChanged =
        updates.priority !== undefined && updates.priority !== currentJob.priority;
      const statusChanged = newStatus !== oldStatus;

      if (statusChanged || priorityChanged) {
        const oldQueueKey = this.buildQueueKey(currentJob.queueName, oldStatus);
        const newQueueKey = this.buildQueueKey(currentJob.queueName, newStatus);

        pipeline.zrem(oldQueueKey, jobId);

        const priority = updates.priority ?? currentJob.priority;
        const timestamp = updates.queuedAt ?? currentJob.queuedAt;
        const score = priority + timestamp / 1e13;
        pipeline.zadd(newQueueKey, score, jobId);
      }

      await pipeline.exec();

      this.logger.debug('Job updated', {
        jobId,
        updates: Object.keys(updates),
      });
    } catch (error) {
      this.logger.error('UPDATE_JOB failed', {
        jobId,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new RedisOperationError('UPDATE_JOB failed', {
        operation: 'HSET',
        key: jobKey,
        originalError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Remove a job from storage
   *
   * @param jobId - Unique job identifier
   * @returns true if job was removed, false if not found
   */
  async removeJob(jobId: string): Promise<boolean> {
    if (!this.isConnected) {
      throw new Error('Adapter not connected. Call connect() first.');
    }

    const connection = this.client.getConnection();
    const jobKey = this.buildJobKey(jobId);

    try {
      // Get job to know which queue/status to remove from
      const job = await this.getJob(jobId);

      if (!job) {
        return false;
      }

      const queueKey = this.buildQueueKey(job.queueName, job.status);

      // Use pipeline for atomic deletion
      const pipeline = connection.pipeline();
      pipeline.del(jobKey);
      pipeline.zrem(queueKey, jobId);

      await pipeline.exec();

      this.logger.debug('Job removed', { jobId });

      return true;
    } catch (error) {
      this.logger.error('REMOVE_JOB failed', {
        jobId,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new RedisOperationError('REMOVE_JOB failed', {
        operation: 'DEL',
        key: jobKey,
        originalError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Mark a job as completed
   *
   * Uses Lua script for atomic completion operation.
   *
   * @param jobId - Unique job identifier
   * @param result - Optional result data
   * @returns true if job was completed, false if not found in running set
   */
  async completeJob(jobId: string, result?: unknown): Promise<boolean> {
    if (!this.isConnected) {
      throw new Error('Adapter not connected. Call connect() first.');
    }

    if (!this.completeScript) {
      throw new Error('Complete script not loaded');
    }

    // Get job to know queue name
    const job = await this.getJob(jobId);

    if (!job) {
      this.logger.warn('Job not found for completion', { jobId });
      return false;
    }

    const connection = this.client.getConnection();
    const runningKey = this.buildQueueKey(job.queueName, 'running');
    const completedKey = this.buildQueueKey(job.queueName, 'completed');
    const jobKeyPrefix = 'job:';

    try {
      // Execute Lua script using custom command
      const resultJson = result ? JSON.stringify(result) : '';

      const success = await connection.evalsha(
        this.completeSha!,
        3,
        runningKey,
        completedKey,
        jobKeyPrefix,
        jobId,
        Date.now().toString(),
        resultJson
      );

      if (success === 1) {
        this.logger.debug('Job completed', {
          jobId,
          queueName: job.queueName,
        });
        return true;
      } else {
        this.logger.warn('Job not in running set for completion', {
          jobId,
          queueName: job.queueName,
        });
        return false;
      }
    } catch (error) {
      this.logger.error('COMPLETE_JOB failed', {
        jobId,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new RedisOperationError('COMPLETE_JOB failed', {
        operation: 'EVALSHA',
        key: runningKey,
        originalError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Mark a job as failed and handle retry logic
   *
   * Uses Lua script for atomic failure operation with retry handling.
   * - If retries < maxRetries: re-enqueue for retry
   * - If retries exhausted: move to failed set
   *
   * @param jobId - Unique job identifier
   * @param error - Error message
   * @returns 'retry' if requeued, 'failed' if moved to failed set, null if not found
   */
  async failJob(jobId: string, errorMessage: string): Promise<'retry' | 'failed' | null> {
    if (!this.isConnected) {
      throw new Error('Adapter not connected. Call connect() first.');
    }

    if (!this.failScript) {
      throw new Error('Fail script not loaded');
    }

    // Get job to know queue name
    const job = await this.getJob(jobId);

    if (!job) {
      this.logger.warn('Job not found for failure', { jobId });
      return null;
    }

    const connection = this.client.getConnection();
    const runningKey = this.buildQueueKey(job.queueName, 'running');
    const queuedKey = this.buildQueueKey(job.queueName, 'queued');
    const failedKey = this.buildQueueKey(job.queueName, 'failed');
    const jobKeyPrefix = 'job:';

    try {
      // Execute Lua script using custom command
      const result = (await connection.evalsha(
        this.failSha!,
        4,
        runningKey,
        queuedKey,
        failedKey,
        jobKeyPrefix,
        jobId,
        Date.now().toString(),
        errorMessage
      )) as 'retry' | 'failed' | null;

      if (result === 'retry') {
        this.logger.debug('Job failed, requeued for retry', {
          jobId,
          queueName: job.queueName,
          retries: job.retries + 1,
        });
      } else if (result === 'failed') {
        this.logger.debug('Job failed permanently', {
          jobId,
          queueName: job.queueName,
          retries: job.retries + 1,
        });
      } else {
        this.logger.warn('Job not in running set for failure', {
          jobId,
          queueName: job.queueName,
        });
      }

      return result;
    } catch (error) {
      this.logger.error('FAIL_JOB failed', {
        jobId,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new RedisOperationError('FAIL_JOB failed', {
        operation: 'EVALSHA',
        key: runningKey,
        originalError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get statistics for a queue
   *
   * @param queueName - Name of the queue
   * @returns Queue statistics
   */
  async getQueueStats(queueName: string): Promise<QueueStats> {
    if (!this.isConnected) {
      return {
        total: 0,
        queued: 0,
        running: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
      };
    }

    const connection = this.client.getConnection();

    try {
      const pipeline = connection.pipeline();

      // Count jobs in each status
      pipeline.zcard(this.buildQueueKey(queueName, 'queued'));
      pipeline.zcard(this.buildQueueKey(queueName, 'running'));
      pipeline.zcard(this.buildQueueKey(queueName, 'completed'));
      pipeline.zcard(this.buildQueueKey(queueName, 'failed'));
      pipeline.zcard(this.buildQueueKey(queueName, 'cancelled'));

      const results = await pipeline.exec();

      if (!results) {
        throw new Error('Pipeline execution failed');
      }

      const queued = (results[0]?.[1] as number) ?? 0;
      const running = (results[1]?.[1] as number) ?? 0;
      const completed = (results[2]?.[1] as number) ?? 0;
      const failed = (results[3]?.[1] as number) ?? 0;
      const cancelled = (results[4]?.[1] as number) ?? 0;

      return {
        total: queued + running + completed + failed + cancelled,
        queued,
        running,
        completed,
        failed,
        cancelled,
      };
    } catch (error) {
      this.logger.error('GET_QUEUE_STATS failed', {
        queueName,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        total: 0,
        queued: 0,
        running: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
      };
    }
  }

  /**
   * Perform health check
   *
   * @returns true if storage is healthy, false otherwise
   */
  async healthCheck(): Promise<boolean> {
    if (!this.isConnected) {
      return false;
    }

    try {
      const clientHealth = await this.client.healthCheck();
      return clientHealth.healthy;
    } catch (error) {
      this.logger.error('Health check failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Build Redis key for a job hash
   *
   * @private
   */
  private buildJobKey(jobId: string): string {
    return `job:${jobId}`;
  }

  /**
   * Build Redis key for a queue sorted set
   *
   * @private
   */
  private buildQueueKey(queueName: string, status: QueueJob['status']): string {
    return `${this.keyPrefix}${queueName}:${status}`;
  }

  /**
   * Convert Job to Redis hash format
   *
   * @private
   */
  private jobToHash(job: QueueJob): Record<string, string> {
    return {
      id: job.id,
      type: job.type,
      queueName: job.queueName,
      data: JSON.stringify(job.data),
      status: job.status,
      priority: job.priority.toString(),
      progress: job.progress.toString(),
      queuedAt: job.queuedAt.toString(),
      startedAt: job.startedAt?.toString() || '',
      completedAt: job.completedAt?.toString() || '',
      failedAt: job.failedAt?.toString() || '',
      retries: job.retries.toString(),
      maxRetries: job.maxRetries.toString(),
      timeout: job.timeout.toString(),
      result: job.result ? JSON.stringify(job.result) : '',
      error: job.error || '',
      metadata: job.metadata ? JSON.stringify(job.metadata) : '{}',
    };
  }

  /**
   * Convert Redis hash to Job object
   *
   * @private
   */
  private hashToJob(hash: Record<string, string>): QueueJob {
    return {
      id: hash.id ?? '',
      type: hash.type ?? '',
      queueName: hash.queueName ?? '',
      data: hash.data ? JSON.parse(hash.data) : undefined,
      status: hash.status as QueueJob['status'],
      priority: hash.priority ? parseInt(hash.priority, 10) : 0,
      progress: hash.progress ? parseInt(hash.progress, 10) : 0,
      queuedAt: hash.queuedAt ? parseInt(hash.queuedAt, 10) : 0,
      startedAt: hash.startedAt ? parseInt(hash.startedAt, 10) : undefined,
      completedAt: hash.completedAt ? parseInt(hash.completedAt, 10) : undefined,
      failedAt: hash.failedAt ? parseInt(hash.failedAt, 10) : undefined,
      retries: hash.retries ? parseInt(hash.retries, 10) : 0,
      maxRetries: hash.maxRetries ? parseInt(hash.maxRetries, 10) : 0,
      timeout: hash.timeout ? parseInt(hash.timeout, 10) : 0,
      result: hash.result ? JSON.parse(hash.result) : undefined,
      error: hash.error || undefined,
      metadata: hash.metadata ? JSON.parse(hash.metadata) : {},
    };
  }
}
