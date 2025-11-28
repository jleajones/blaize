/**
 * Zod Schemas for Queue Plugin
 *
 * This module provides Zod schemas for runtime validation of:
 * - Job configuration (priority, retries, timeout)
 * - Queue configuration (name, concurrency, job types)
 * - Plugin configuration (queues, storage adapter, defaults)
 *
 * All schemas provide sensible defaults and descriptive error messages.
 * TypeScript types are inferred from schemas for type safety.
 *
 * @module @blaizejs/queue/schemas
 * @since 0.4.0
 */

import { z } from 'zod';

import type { QueueStorageAdapter } from './types';

// ============================================================================
// Job Priority Schema
// ============================================================================

/**
 * Job priority schema
 *
 * Validates priority as an integer between 1 and 10:
 * - 1-3: Low priority (background tasks)
 * - 4-6: Normal priority (default: 5)
 * - 7-9: High priority (time-sensitive)
 * - 10: Critical priority (process immediately)
 *
 * @example
 * ```typescript
 * jobPrioritySchema.parse(5);  // ✓ Valid
 * jobPrioritySchema.parse(0);  // ✗ Error: must be >= 1
 * jobPrioritySchema.parse(11); // ✗ Error: must be <= 10
 * jobPrioritySchema.parse(5.5); // ✗ Error: must be an integer
 * ```
 */
export const jobPrioritySchema = z
  .number({
    required_error: 'Priority is required',
    invalid_type_error: 'Priority must be a number',
  })
  .int('Priority must be an integer')
  .min(1, 'Priority must be at least 1')
  .max(10, 'Priority must be at most 10');

// ============================================================================
// Job Options Schema
// ============================================================================

/**
 * Job options schema with sensible defaults
 *
 * All fields are optional with defaults:
 * - priority: 5 (normal)
 * - maxRetries: 3
 * - timeout: 30000ms (30 seconds)
 * - metadata: {} (empty object)
 *
 * @example
 * ```typescript
 * // All defaults
 * jobOptionsSchema.parse({});
 * // Result: { priority: 5, maxRetries: 3, timeout: 30000, metadata: {} }
 *
 * // Custom values
 * jobOptionsSchema.parse({
 *   priority: 10,
 *   maxRetries: 5,
 *   timeout: 60000,
 *   metadata: { userId: '123' }
 * });
 * ```
 */
export const jobOptionsSchema = z.object({
  /**
   * Job priority (1-10, higher = processed first)
   * @default 5
   */
  priority: jobPrioritySchema.optional().default(5),

  /**
   * Maximum retry attempts on failure
   * @default 3
   */
  maxRetries: z
    .number({
      invalid_type_error: 'maxRetries must be a number',
    })
    .int('maxRetries must be an integer')
    .min(0, 'maxRetries must be at least 0')
    .max(10, 'maxRetries must be at most 10')
    .optional()
    .default(3),

  /**
   * Job execution timeout in milliseconds
   * Minimum: 1000ms (1 second)
   * Maximum: 3600000ms (1 hour)
   * @default 30000 (30 seconds)
   */
  timeout: z
    .number({
      invalid_type_error: 'timeout must be a number',
    })
    .int('timeout must be an integer')
    .min(1000, 'timeout must be at least 1000ms (1 second)')
    .max(3600000, 'timeout must be at most 3600000ms (1 hour)')
    .optional()
    .default(30000),

  /**
   * Custom metadata attached to the job
   * @default {}
   */
  metadata: z.record(z.unknown()).optional().default({}),
});

// ============================================================================
// Job Type Definition Schema
// ============================================================================

/**
 * Schema for a single job type definition
 *
 * Defines how a specific job type should be configured within a queue.
 * The handler is registered separately via `queue.registerHandler()`.
 *
 * @example
 * ```typescript
 * const emailJobType = jobTypeDefinitionSchema.parse({
 *   defaultOptions: {
 *     priority: 7,
 *     timeout: 60000,
 *   },
 * });
 * ```
 */
export const jobTypeDefinitionSchema = z.object({
  /**
   * Default options for this job type
   * These are merged with job-specific options at runtime
   */
  defaultOptions: jobOptionsSchema.optional(),
});

// ============================================================================
// Queue Configuration Schema
// ============================================================================

/**
 * Queue configuration schema
 *
 * Configures a single named queue with its concurrency and job types.
 *
 * @example
 * ```typescript
 * const emailQueue = queueConfigSchema.parse({
 *   name: 'emails',
 *   concurrency: 10,
 *   jobTypes: {
 *     'welcome': { defaultOptions: { priority: 5 } },
 *     'notification': { defaultOptions: { priority: 8 } },
 *   },
 * });
 * ```
 */
export const queueConfigSchema = z.object({
  /**
   * Queue name (unique identifier)
   * Must be at least 1 character
   */
  name: z
    .string({
      required_error: 'Queue name is required',
      invalid_type_error: 'Queue name must be a string',
    })
    .min(1, 'Queue name must be at least 1 character'),

  /**
   * Maximum concurrent job executions
   * @default 5
   */
  concurrency: z
    .number({
      invalid_type_error: 'concurrency must be a number',
    })
    .int('concurrency must be an integer')
    .min(1, 'concurrency must be at least 1')
    .max(100, 'concurrency must be at most 100')
    .optional()
    .default(5),

  /**
   * Job type definitions
   * Keys are job type names, values are their configurations
   * @default {}
   */
  jobTypes: z.record(jobTypeDefinitionSchema).optional().default({}),
});

// ============================================================================
// Plugin Configuration Schema
// ============================================================================

/**
 * Custom validator for QueueStorageAdapter
 *
 * Validates that the provided object has the required methods
 * for a storage adapter.
 */
const storageAdapterSchema = z.custom<QueueStorageAdapter>(
  val => {
    if (val === undefined || val === null) {
      return true; // Optional - will use default InMemoryStorage
    }

    // Check required methods exist
    const required = [
      'enqueue',
      'dequeue',
      'peek',
      'getJob',
      'listJobs',
      'updateJob',
      'removeJob',
      'getQueueStats',
    ];

    const obj = val as Record<string, unknown>;
    for (const method of required) {
      if (typeof obj[method] !== 'function') {
        return false;
      }
    }

    return true;
  },
  {
    message:
      'Invalid storage adapter: must implement QueueStorageAdapter interface (enqueue, dequeue, peek, getJob, listJobs, updateJob, removeJob, getQueueStats)',
  }
);

/**
 * Queue configuration without name (used in plugin config)
 *
 * Same as queueConfigSchema but without the name field,
 * since the queue name is provided as the key in the queues record.
 */
export const queueConfigWithoutNameSchema = queueConfigSchema.omit({ name: true });

/**
 * Plugin configuration schema
 *
 * Configures the entire queue plugin with multiple queues,
 * optional storage adapter, and global defaults.
 *
 * @example
 * ```typescript
 * const config = pluginConfigSchema.parse({
 *   queues: {
 *     emails: { concurrency: 10 },
 *     reports: { concurrency: 2 },
 *   },
 *   storage: createRedisStorage({ url: 'redis://localhost:6379' }),
 *   defaultConcurrency: 5,
 *   defaultTimeout: 30000,
 *   defaultMaxRetries: 3,
 * });
 * ```
 *
 * @example Minimal config
 * ```typescript
 * const config = pluginConfigSchema.parse({
 *   queues: {
 *     default: {},
 *   },
 * });
 * // Uses InMemoryStorage and all defaults
 * ```
 */
export const pluginConfigSchema = z.object({
  /**
   * Queue configurations keyed by name
   *
   * Each key becomes the queue name, value is the queue config
   * (without the name field, since it's derived from the key).
   */
  queues: z.record(queueConfigWithoutNameSchema),

  /**
   * Optional storage adapter
   *
   * If not provided, defaults to InMemoryStorage.
   * Must implement the QueueStorageAdapter interface.
   *
   * @example
   * ```typescript
   * // Use Redis storage
   * storage: createRedisStorage({ url: 'redis://localhost:6379' })
   *
   * // Use PostgreSQL storage
   * storage: createPostgresStorage({ connectionString: '...' })
   * ```
   */
  storage: storageAdapterSchema.optional(),

  /**
   * Default concurrency for all queues
   * Individual queue configs can override this.
   * @default 5
   */
  defaultConcurrency: z
    .number({
      invalid_type_error: 'defaultConcurrency must be a number',
    })
    .int('defaultConcurrency must be an integer')
    .min(1, 'defaultConcurrency must be at least 1')
    .max(100, 'defaultConcurrency must be at most 100')
    .optional()
    .default(5),

  /**
   * Default timeout for all jobs in milliseconds
   * Individual job options can override this.
   * @default 30000 (30 seconds)
   */
  defaultTimeout: z
    .number({
      invalid_type_error: 'defaultTimeout must be a number',
    })
    .int('defaultTimeout must be an integer')
    .min(1000, 'defaultTimeout must be at least 1000ms')
    .optional()
    .default(30000),

  /**
   * Default max retries for all jobs
   * Individual job options can override this.
   * @default 3
   */
  defaultMaxRetries: z
    .number({
      invalid_type_error: 'defaultMaxRetries must be a number',
    })
    .int('defaultMaxRetries must be an integer')
    .min(0, 'defaultMaxRetries must be at least 0')
    .max(10, 'defaultMaxRetries must be at most 10')
    .optional()
    .default(3),
});

// ============================================================================
// Inferred Types
// ============================================================================

/**
 * Job priority type (1-10)
 * Inferred from jobPrioritySchema
 */
export type JobPriorityConfig = z.infer<typeof jobPrioritySchema>;

/**
 * Job options type with all fields required (after defaults applied)
 * Inferred from jobOptionsSchema
 */
export type JobOptionsConfig = z.infer<typeof jobOptionsSchema>;

/**
 * Job options input type (before defaults applied)
 * All fields are optional
 */
export type JobOptionsInput = z.input<typeof jobOptionsSchema>;

/**
 * Job type definition
 * Inferred from jobTypeDefinitionSchema
 */
export type JobTypeDefinitionConfig = z.infer<typeof jobTypeDefinitionSchema>;

/**
 * Queue configuration type with all fields required (after defaults applied)
 * Inferred from queueConfigSchema
 */
export type QueueConfigSchema = z.infer<typeof queueConfigSchema>;

/**
 * Queue configuration input type (before defaults applied)
 * Name is required, other fields are optional
 */
export type QueueConfigInput = z.input<typeof queueConfigSchema>;

/**
 * Plugin configuration type with all fields required (after defaults applied)
 * Inferred from pluginConfigSchema
 */
export type PluginConfigSchema = z.infer<typeof pluginConfigSchema>;

/**
 * Plugin configuration input type (before defaults applied)
 * Only queues is required, other fields are optional
 */
export type PluginConfigInput = z.input<typeof pluginConfigSchema>;

// ============================================================================
// Route Schemas (Placeholders for future tasks)
// ============================================================================

// TODO: Implement route schemas in T12, T19
// - jobStreamQuerySchema (T12)
// - jobEventsSchema (T12)
// - queueStatusQuerySchema (T19)
// - queueStatusResponseSchema (T19)
// - queueDashboardQuerySchema (T19)
// - createJobBodySchema (T19)
// - cancelJobBodySchema (T19)
