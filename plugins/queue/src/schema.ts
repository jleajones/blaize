/**
 * Zod Schemas for Queue Plugin
 *
 * This module provides Zod schemas for runtime validation of:
 * - Job configuration (priority, retries, timeout)
 * - Queue configuration (name, concurrency, job types)
 * - Plugin configuration (queues, storage adapter, defaults)
 * - SSE events for job monitoring
 * - EventBus events for cross-server coordination
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
// Queue Configuration Schema
// ============================================================================

/**
 * Queue configuration schema
 *
 * Configures a single named queue with its concurrency and job definitions.
 *
 * @example
 * ```typescript
 * const emailQueue = queueConfigSchema.parse({
 *   name: 'emails',
 *   concurrency: 10,
 *   jobs: {
 *     'welcome': defineJob({ ... }),
 *     'notification': defineJob({ ... }),
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
   * Job definitions keyed by job type name
   *
   * Each value is a `JobDefinition` created by `defineJob()`.
   * Validated as `z.record(z.any())` since JobDefinition objects
   * contain functions and Zod schemas that can't be deeply validated.
   * @default {}
   */
  jobs: z.record(z.any()).optional().default({}),
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
// SSE Event Schemas (Existing - for job monitoring)
// ============================================================================

/**
 * Job progress event schema
 *
 * Sent when a job reports progress during execution.
 * The handler calls `ctx.progress(percent, message)` to emit this event.
 *
 * @example Event payload
 * ```json
 * {
 *   "jobId": "550e8400-e29b-41d4-a716-446655440000",
 *   "percent": 50,
 *   "message": "Processing batch 5 of 10",
 *   "timestamp": 1699123456789
 * }
 * ```
 */
export const jobProgressEventSchema = z.object({
  /** Unique job identifier */
  jobId: z.string().uuid('jobId must be a valid UUID'),

  /** Progress percentage (0-100) */
  percent: z
    .number({
      required_error: 'percent is required',
      invalid_type_error: 'percent must be a number',
    })
    .min(0, 'percent must be at least 0')
    .max(100, 'percent must be at most 100'),

  /** Optional progress message */
  message: z.string().optional(),

  /** Unix timestamp in milliseconds when progress was reported */
  timestamp: z.number({
    required_error: 'timestamp is required',
    invalid_type_error: 'timestamp must be a number',
  }),
});

/**
 * Job completed event schema
 *
 * Sent when a job completes successfully.
 * Contains the result returned by the job handler.
 *
 * @example Event payload
 * ```json
 * {
 *   "jobId": "550e8400-e29b-41d4-a716-446655440000",
 *   "result": { "emailsSent": 150, "success": true },
 *   "completedAt": 1699123456789
 * }
 * ```
 */
export const jobCompletedEventSchema = z.object({
  /** Unique job identifier */
  jobId: z.string().uuid('jobId must be a valid UUID'),

  /** Result returned by the job handler (can be any JSON value) */
  result: z.unknown(),

  /** Unix timestamp in milliseconds when job completed */
  completedAt: z.number({
    required_error: 'completedAt is required',
    invalid_type_error: 'completedAt must be a number',
  }),
});

/**
 * Job failed event schema
 *
 * Sent when a job fails after exhausting all retry attempts.
 * Contains error information for debugging.
 *
 * @example Event payload
 * ```json
 * {
 *   "jobId": "550e8400-e29b-41d4-a716-446655440000",
 *   "error": {
 *     "message": "Connection timeout",
 *     "code": "ETIMEDOUT"
 *   },
 *   "failedAt": 1699123456789
 * }
 * ```
 */
export const jobFailedEventSchema = z.object({
  /** Unique job identifier */
  jobId: z.string().uuid('jobId must be a valid UUID'),

  /** Error information */
  error: z.object({
    /** Error message */
    message: z.string({
      required_error: 'error.message is required',
      invalid_type_error: 'error.message must be a string',
    }),

    /** Optional error code (e.g., 'ETIMEDOUT', 'JOB_TIMEOUT') */
    code: z.string().optional(),
  }),

  /** Unix timestamp in milliseconds when job failed */
  failedAt: z.number({
    required_error: 'failedAt is required',
    invalid_type_error: 'failedAt must be a number',
  }),
});

/**
 * Job cancelled event schema
 *
 * Sent when a job is cancelled, either manually or due to shutdown.
 * The reason field indicates why the job was cancelled.
 *
 * @example Event payload
 * ```json
 * {
 *   "jobId": "550e8400-e29b-41d4-a716-446655440000",
 *   "reason": "User requested",
 *   "cancelledAt": 1699123456789
 * }
 * ```
 */
export const jobCancelledEventSchema = z.object({
  /** Unique job identifier */
  jobId: z.string().uuid('jobId must be a valid UUID'),

  /** Reason for cancellation */
  reason: z.string().optional(),

  /** Unix timestamp in milliseconds when job was cancelled */
  cancelledAt: z.number({
    required_error: 'cancelledAt is required',
    invalid_type_error: 'cancelledAt must be a number',
  }),
});

// ============================================================================
// SSE Event Types (Inferred from Schemas)
// ============================================================================

/**
 * Job progress event payload type
 *
 * @example
 * ```typescript
 * const progressEvent: JobProgressEvent = {
 *   jobId: '550e8400-e29b-41d4-a716-446655440000',
 *   percent: 50,
 *   message: 'Halfway done',
 *   timestamp: Date.now(),
 * };
 * ```
 */
export type JobProgressEvent = z.infer<typeof jobProgressEventSchema>;

/**
 * Job completed event payload type
 *
 * @example
 * ```typescript
 * const completedEvent: JobCompletedEvent = {
 *   jobId: '550e8400-e29b-41d4-a716-446655440000',
 *   result: { success: true },
 *   completedAt: Date.now(),
 * };
 * ```
 */
export type JobCompletedEvent = z.infer<typeof jobCompletedEventSchema>;

/**
 * Job failed event payload type
 *
 * @example
 * ```typescript
 * const failedEvent: JobFailedEvent = {
 *   jobId: '550e8400-e29b-41d4-a716-446655440000',
 *   error: { message: 'Connection failed', code: 'ECONNREFUSED' },
 *   failedAt: Date.now(),
 * };
 * ```
 */
export type JobFailedEvent = z.infer<typeof jobFailedEventSchema>;

/**
 * Job cancelled event payload type
 *
 * @example
 * ```typescript
 * const cancelledEvent: JobCancelledEvent = {
 *   jobId: '550e8400-e29b-41d4-a716-446655440000',
 *   reason: 'User requested',
 *   cancelledAt: Date.now(),
 * };
 * ```
 */
export type JobCancelledEvent = z.infer<typeof jobCancelledEventSchema>;

/**
 * Union type of all job event payloads
 */
export type JobEvent = JobProgressEvent | JobCompletedEvent | JobFailedEvent | JobCancelledEvent;

/**
 * Job event names
 */
export type JobEventName = keyof typeof jobSseEventSchemas;

// ============================================================================
// Route Schemas
// ============================================================================

/**
 * Job status enum schema
 *
 * Validates job status values used in API responses.
 *
 * @example
 * ```typescript
 * jobStatusEnumSchema.parse('queued');    // ✓ Valid
 * jobStatusEnumSchema.parse('running');   // ✓ Valid
 * jobStatusEnumSchema.parse('pending');   // ✗ Error: invalid enum value
 * ```
 */
export const jobStatusEnumSchema = z.enum([
  'queued',
  'running',
  'completed',
  'failed',
  'cancelled',
]);

/**
 * Job error schema
 *
 * Validates error information attached to failed jobs.
 *
 * @example
 * ```typescript
 * jobErrorSchema.parse({
 *   message: 'Connection timeout',
 *   code: 'ETIMEDOUT',
 * });
 * ```
 */
export const jobErrorSchema = z.object({
  /** Error message */
  message: z.string({
    required_error: 'error.message is required',
    invalid_type_error: 'error.message must be a string',
  }),

  /** Optional error code */
  code: z.string().optional(),

  /** Optional stack trace (only included in development) */
  stack: z.string().optional(),
});

/**
 * Job schema for list responses
 *
 * Validates job objects returned in queue status and list endpoints.
 * This is a simplified representation suitable for listing jobs.
 *
 * @example
 * ```typescript
 * const job = jobSchema.parse({
 *   id: '550e8400-e29b-41d4-a716-446655440000',
 *   type: 'send-email',
 *   queueName: 'emails',
 *   status: 'completed',
 *   priority: 5,
 *   data: { to: 'user@example.com' },
 *   progress: 100,
 *   retries: 0,
 *   maxRetries: 3,
 *   queuedAt: 1699123456789,
 *   completedAt: 1699123457000,
 * });
 * ```
 */
export const jobSchema = z.object({
  /** Unique job identifier (UUID v4) */
  id: z.string().uuid('id must be a valid UUID'),

  /** Job type identifier */
  type: z.string({
    required_error: 'type is required',
    invalid_type_error: 'type must be a string',
  }),

  /** Queue name this job belongs to */
  queueName: z.string({
    required_error: 'queueName is required',
    invalid_type_error: 'queueName must be a string',
  }),

  /** Current job status */
  status: jobStatusEnumSchema,

  /** Job priority (1-10) */
  priority: z
    .number({
      required_error: 'priority is required',
      invalid_type_error: 'priority must be a number',
    })
    .int()
    .min(1)
    .max(10),

  /** Job input data */
  data: z.unknown(),

  /** Job result (on completion) */
  result: z.unknown().optional(),

  /** Error details (on failure) */
  error: jobErrorSchema.optional(),

  /** Current progress percentage (0-100) */
  progress: z.number().min(0).max(100).optional(),

  /** Optional progress message */
  progressMessage: z.string().optional(),

  /** Number of retry attempts made */
  retries: z.number({
    required_error: 'retries is required',
    invalid_type_error: 'retries must be a number',
  }),

  /** Maximum retry attempts allowed */
  maxRetries: z.number({
    required_error: 'maxRetries is required',
    invalid_type_error: 'maxRetries must be a number',
  }),

  /** Timestamp when job was queued (ms since epoch) */
  queuedAt: z.number({
    required_error: 'queuedAt is required',
    invalid_type_error: 'queuedAt must be a number',
  }),

  /** Timestamp when job started (ms since epoch) */
  startedAt: z.number().optional(),

  /** Timestamp when job completed/failed/cancelled (ms since epoch) */
  completedAt: z.number().optional(),
});

/**
 * Queue stats schema
 *
 * Validates queue statistics returned by status endpoints.
 *
 * @example
 * ```typescript
 * const stats = queueStatsSchema.parse({
 *   total: 100,
 *   queued: 10,
 *   running: 5,
 *   completed: 80,
 *   failed: 3,
 *   cancelled: 2,
 * });
 * ```
 */
export const queueStatsSchema = z.object({
  /** Total number of jobs in the queue */
  total: z.number({
    required_error: 'total is required',
    invalid_type_error: 'total must be a number',
  }),

  /** Jobs waiting to be processed */
  queued: z.number({
    required_error: 'queued is required',
    invalid_type_error: 'queued must be a number',
  }),

  /** Jobs currently being processed */
  running: z.number({
    required_error: 'running is required',
    invalid_type_error: 'running must be a number',
  }),

  /** Successfully completed jobs */
  completed: z.number({
    required_error: 'completed is required',
    invalid_type_error: 'completed must be a number',
  }),

  /** Failed jobs (exhausted retries) */
  failed: z.number({
    required_error: 'failed is required',
    invalid_type_error: 'failed must be a number',
  }),

  /** Cancelled jobs */
  cancelled: z.number({
    required_error: 'cancelled is required',
    invalid_type_error: 'cancelled must be a number',
  }),
});

/**
 * Queue with stats and jobs schema
 *
 * Validates a queue entry in status responses.
 */
export const queueWithJobsSchema = z.object({
  /** Queue name */
  name: z.string({
    required_error: 'name is required',
    invalid_type_error: 'name must be a string',
  }),

  /** Queue statistics */
  stats: queueStatsSchema,

  /** List of jobs */
  jobs: z.array(jobSchema),
});

/**
 * Queue status response schema
 *
 * Validates the full response from the queue status endpoint.
 *
 * @example
 * ```typescript
 * const response = queueStatusResponseSchema.parse({
 *   queues: [{
 *     name: 'emails',
 *     stats: { total: 100, queued: 10, running: 5, completed: 80, failed: 3, cancelled: 2 },
 *     jobs: [{ id: '...', type: '...', status: 'queued', ... }],
 *   }],
 *   timestamp: 1699123456789,
 * });
 * ```
 */
export const queueStatusResponseSchema = z.object({
  /** Array of queues with stats and jobs */
  queues: z.array(queueWithJobsSchema),

  /** Timestamp when data was gathered (ms since epoch) */
  timestamp: z.number({
    required_error: 'timestamp is required',
    invalid_type_error: 'timestamp must be a number',
  }),
});

/**
 * Job details response schema
 *
 * Validates the full job details returned by job detail endpoints.
 * This is more comprehensive than jobSchema and includes all fields.
 *
 * @example
 * ```typescript
 * const response = jobDetailsResponseSchema.parse({
 *   job: {
 *     id: '550e8400-e29b-41d4-a716-446655440000',
 *     type: 'send-email',
 *     queueName: 'emails',
 *     status: 'completed',
 *     priority: 5,
 *     data: { to: 'user@example.com', subject: 'Hello' },
 *     result: { sent: true, messageId: 'msg-123' },
 *     progress: 100,
 *     retries: 0,
 *     maxRetries: 3,
 *     queuedAt: 1699123456789,
 *     startedAt: 1699123456800,
 *     completedAt: 1699123457000,
 *   },
 *   timestamp: 1699123457100,
 * });
 * ```
 */
export const jobDetailsResponseSchema = z.object({
  /** Full job details */
  job: jobSchema,

  /** Timestamp when data was gathered (ms since epoch) */
  timestamp: z.number({
    required_error: 'timestamp is required',
    invalid_type_error: 'timestamp must be a number',
  }),
});

/**
 * Create job response schema
 *
 * Validates the response from the job creation endpoint.
 *
 * @example
 * ```typescript
 * const response = createJobResponseSchema.parse({
 *   jobId: '550e8400-e29b-41d4-a716-446655440000',
 *   queueName: 'emails',
 *   jobType: 'send-welcome',
 *   status: 'queued',
 *   priority: 5,
 *   queuedAt: Date.now(),
 * });
 * ```
 */
export const createJobResponseSchema = z.object({
  /** Unique identifier for the created job */
  jobId: z.string().uuid('jobId must be a valid UUID'),

  /** Queue name where job was added */
  queueName: z.string({
    required_error: 'queueName is required',
    invalid_type_error: 'queueName must be a string',
  }),

  /** Job type identifier */
  jobType: z.string({
    required_error: 'jobType is required',
    invalid_type_error: 'jobType must be a string',
  }),

  /** Initial job status (always 'queued' for new jobs) */
  status: z.literal('queued'),

  /** Job priority */
  priority: z.number().int().min(1).max(10),

  /** Timestamp when job was queued (ms since epoch) */
  queuedAt: z.number({
    required_error: 'queuedAt is required',
    invalid_type_error: 'queuedAt must be a number',
  }),
});

/**
 * Cancel job response schema
 *
 * Validates the response from the job cancellation endpoint.
 *
 * @example
 * ```typescript
 * const response: CancelJobResponse = {
 *   jobId: '550e8400-e29b-41d4-a716-446655440000',
 *   cancelled: true,
 *   cancelledAt: Date.now(),
 * };
 * ```
 */
export const cancelJobResponseSchema = z.object({
  /** Job ID that was cancelled */
  jobId: z.string().uuid('jobId must be a valid UUID'),

  /** Whether the job was successfully cancelled */
  cancelled: z.boolean(),

  /** Timestamp when job was cancelled (ms since epoch) */
  cancelledAt: z.number({
    required_error: 'cancelledAt is required',
    invalid_type_error: 'cancelledAt must be a number',
  }),
});

/**
 * Inferred types for response schemas
 */
export type JobStatusEnum = z.infer<typeof jobStatusEnumSchema>;
export type JobErrorResponse = z.infer<typeof jobErrorSchema>;
export type JobResponse = z.infer<typeof jobSchema>;
export type QueueStatsResponse = z.infer<typeof queueStatsSchema>;
export type QueueWithJobsResponse = z.infer<typeof queueWithJobsSchema>;
export type QueueStatusResponse = z.infer<typeof queueStatusResponseSchema>;
export type JobDetailsResponse = z.infer<typeof jobDetailsResponseSchema>;
export type CreateJobResponse = z.infer<typeof createJobResponseSchema>;
export type CancelJobResponse = z.infer<typeof cancelJobResponseSchema>;

// ============================================================================
// Query Schemas
// ============================================================================

/**
 * Query schema for job stream SSE endpoint
 *
 * Validates the query parameters for the job monitoring stream.
 *
 * @example Valid query strings
 * ```
 * ?jobId=550e8400-e29b-41d4-a716-446655440000
 * ?jobId=550e8400-e29b-41d4-a716-446655440000&queueName=emails
 * ```
 */
export const jobStreamQuerySchema = z.object({
  /**
   * Job ID to monitor (required)
   * Must be a valid UUID
   */
  jobId: z
    .string({
      required_error: 'jobId is required',
      invalid_type_error: 'jobId must be a string',
    })
    .uuid('jobId must be a valid UUID'),

  /**
   * Queue name (optional)
   * If not provided, searches all queues for the job
   */
  queueName: z.string().optional(),
});

/**
 * Inferred type for job stream query parameters
 */
export type JobStreamQuery = z.infer<typeof jobStreamQuerySchema>;

/**
 * Query schema for queue status endpoint
 *
 * Validates query parameters for filtering queue/job status.
 *
 * @example Valid query strings
 * ```
 * ?queueName=emails
 * ?status=failed&limit=50
 * ?queueName=reports&status=running&limit=10
 * ```
 */
export const queueStatusQuerySchema = z.object({
  /**
   * Filter to specific queue (optional)
   * If not provided, returns status for all queues
   */
  queueName: z.string().optional(),

  /**
   * Filter jobs by status (optional)
   */
  status: z.enum(['queued', 'running', 'completed', 'failed', 'cancelled']).optional(),

  /**
   * Maximum number of jobs to return per queue
   * @default 20
   */
  limit: z.string().regex(/^\d+$/).optional().default('20'),
});

/**
 * Inferred type for queue status query parameters
 */
export type QueueStatusQuery = z.infer<typeof queueStatusQuerySchema>;

/**
 * Query schema for queue dashboard endpoint
 *
 * Validates query parameters for dashboard rendering.
 *
 * @example Valid query strings
 * ```
 * ?queueName=emails
 * ?refresh=30
 * ?queueName=reports&refresh=60
 * ```
 */
export const queueDashboardQuerySchema = z.object({
  /**
   * Filter to specific queue (optional)
   * If not provided, shows all queues
   */
  queueName: z.string().optional(),

  /**
   * Auto-refresh interval in seconds (optional)
   * Adds meta refresh tag to HTML
   * @minimum 5
   * @maximum 300
   */
  refresh: z.string().regex(/^\d+$/).optional(),
});

/**
 * Inferred type for queue dashboard query parameters
 */
export type QueueDashboardQuery = z.infer<typeof queueDashboardQuerySchema>;

// ============================================================================
// HTTP Body Schemas
// ============================================================================

/**
 * Body schema for job creation endpoint
 *
 * Validates POST body for creating a new job.
 *
 * @example Valid body
 * ```json
 * {
 *   "queueName": "emails",
 *   "jobType": "send-welcome",
 *   "data": { "userId": "123", "template": "welcome" },
 *   "options": { "priority": 8, "maxRetries": 5 }
 * }
 * ```
 */
export const createJobBodySchema = z.object({
  /**
   * Queue to add the job to (required)
   */
  queueName: z
    .string({
      required_error: 'queueName is required',
      invalid_type_error: 'queueName must be a string',
    })
    .min(1, 'queueName cannot be empty'),

  /**
   * Job type identifier (required)
   * Must match a registered job handler
   */
  jobType: z
    .string({
      required_error: 'jobType is required',
      invalid_type_error: 'jobType must be a string',
    })
    .min(1, 'jobType cannot be empty'),

  /**
   * Job data payload (optional)
   * Passed to the job handler
   */
  data: z.unknown().optional(),

  /**
   * Job options (optional)
   * Priority, retries, timeout, metadata
   */
  options: z
    .object({
      priority: z.number().int().min(1).max(10).optional(),
      maxRetries: z.number().int().min(0).max(100).optional(),
      timeout: z.number().int().min(0).optional(),
      metadata: z.record(z.unknown()).optional(),
    })
    .optional(),
});

/**
 * Inferred type for create job body
 */
export type CreateJobBody = z.infer<typeof createJobBodySchema>;

/**
 * Body schema for job cancellation endpoint
 *
 * Validates POST body for cancelling a job.
 *
 * @example Valid body
 * ```json
 * {
 *   "queueName": "emails",
 *   "jobId": "550e8400-e29b-41d4-a716-446655440000",
 *   "reason": "User requested"
 * }
 * ```
 */
export const cancelJobBodySchema = z.object({
  /**
   * Queue name where job exists (required)
   */
  queueName: z
    .string({
      required_error: 'queueName is required',
      invalid_type_error: 'queueName must be a string',
    })
    .min(1, 'queueName cannot be empty'),

  /**
   * Job ID to cancel (required)
   */
  jobId: z
    .string({
      required_error: 'jobId is required',
      invalid_type_error: 'jobId must be a string',
    })
    .uuid('jobId must be a valid UUID'),

  /**
   * Reason for cancellation (optional)
   */
  reason: z.string().optional(),
});

/**
 * Inferred type for cancel job body
 */
export type CancelJobBody = z.infer<typeof cancelJobBodySchema>;

// ============================================================================
// EventBus Integration - SSE Event Schemas (Server → Browser Clients)
// ============================================================================

/**
 * Job enqueued event (job added to queue)
 *
 * Sent to browser clients via SSE when jobs are enqueued.
 */
export const jobSseEnqueuedEventSchema = z.object({
  type: z.literal('enqueued'),
  jobId: z.string(),
  queueName: z.string(),
  jobType: z.string(),
  priority: z.number().int().min(1).max(10),
  timestamp: z.number(),
  serverId: z.string().optional(),
});

/**
 * Job started event (worker began processing)
 *
 * Sent to browser clients via SSE when jobs start processing.
 */
export const jobSseStartedEventSchema = z.object({
  type: z.literal('started'),
  jobId: z.string(),
  queueName: z.string(),
  jobType: z.string(),
  timestamp: z.number(),
  serverId: z.string().optional(),
});

/**
 * Job progress event (progress update from handler)
 *
 * Sent to browser clients via SSE when job reports progress.
 */
export const jobSseProgressEventSchema = z.object({
  type: z.literal('progress'),
  jobId: z.string(),
  queueName: z.string(),
  progress: z.number().min(0).max(1), // 0-1 (percentage as decimal)
  message: z.string().optional(),
  timestamp: z.number(),
  serverId: z.string().optional(),
});

/**
 * Job completed event (job finished successfully)
 *
 * Sent to browser clients via SSE when jobs complete.
 */
export const jobSseCompletedEventSchema = z.object({
  type: z.literal('completed'),
  jobId: z.string(),
  queueName: z.string(),
  jobType: z.string(),
  result: z.any().optional(),
  timestamp: z.number(),
  serverId: z.string().optional(),
});

/**
 * Job failed event (job exhausted retries)
 *
 * Sent to browser clients via SSE when jobs fail permanently.
 */
export const jobSseFailedEventSchema = z.object({
  type: z.literal('failed'),
  jobId: z.string(),
  queueName: z.string(),
  jobType: z.string(),
  error: z.object({
    message: z.string(),
    code: z.string().optional(),
  }),
  timestamp: z.number(),
  serverId: z.string().optional(),
});

/**
 * Job cancelled event (job was manually cancelled)
 *
 * Sent to browser clients via SSE when jobs are cancelled.
 */
export const jobSseCancelledEventSchema = z.object({
  type: z.literal('cancelled'),
  jobId: z.string(),
  queueName: z.string(),
  reason: z.string().optional(),
  timestamp: z.number(),
  serverId: z.string().optional(),
});

/**
 * SSE event schemas for queue monitoring routes
 *
 * Used for Server-Sent Events to browser clients.
 * Provides real-time job status notifications.
 *
 * @example
 * ```typescript
 * // SSE route definition
 * export const getJobEvents = appRouter.sse({
 *   schema: {
 *     query: jobEventsQuerySchema,
 *     events: jobSseEventSchemas,  // ← SSE events for browsers
 *   },
 *   handler: jobEventsHandler,
 * });
 * ```
 *
 * @example Browser client
 * ```javascript
 * const eventSource = new EventSource('/queue/events?jobId=job-123');
 *
 * eventSource.addEventListener('job.progress', (e) => {
 *   const data = JSON.parse(e.data);
 *   console.log(`Progress: ${data.progress * 100}%`, data.message);
 * });
 *
 * eventSource.addEventListener('job.completed', (e) => {
 *   const data = JSON.parse(e.data);
 *   console.log('Job completed!', data.result);
 * });
 * ```
 */
export const jobSseEventSchemas = {
  'job.enqueued': jobSseEnqueuedEventSchema,
  'job.started': jobSseStartedEventSchema,
  'job.progress': jobSseProgressEventSchema,
  'job.completed': jobSseCompletedEventSchema,
  'job.failed': jobSseFailedEventSchema,
  'job.cancelled': jobSseCancelledEventSchema,
} as const;

// ============================================================================
// EventBus Integration - EventBus Event Schemas (Server → Server Coordination)
// ============================================================================

// Add individual event schemas
export const jobEnqueuedEventSchema = z.object({
  jobId: z.string(),
  queueName: z.string(),
  jobType: z.string(),
  priority: z.number().int().min(1).max(10),
});

export const jobStartedEventSchema = z.object({
  jobId: z.string(),
  queueName: z.string(),
  jobType: z.string(),
  attempt: z.number().optional(),
});

export const jobProgressEventBusSchema = z.object({
  jobId: z.string(),
  progress: z.number().min(0).max(1),
  message: z.string().optional(),
});

export const jobCompletedEventBusSchema = z.object({
  jobId: z.string(),
  queueName: z.string(),
  jobType: z.string(),
  durationMs: z.number().optional(),
  result: z.unknown().optional(),
});

export const jobFailedEventBusSchema = z.object({
  jobId: z.string(),
  queueName: z.string(),
  jobType: z.string(),
  error: z.string(),
  willRetry: z.boolean(),
});

export const jobCancelledEventBusSchema = z.object({
  jobId: z.string(),
  queueName: z.string(),
  reason: z.string().optional(),
});

// Replace the old export with:
export const queueEventBusSchemas = {
  'queue:job:enqueued': jobEnqueuedEventSchema,
  'queue:job:started': jobStartedEventSchema,
  'queue:job:progress': jobProgressEventBusSchema,
  'queue:job:completed': jobCompletedEventBusSchema,
  'queue:job:failed': jobFailedEventBusSchema,
  'queue:job:cancelled': jobCancelledEventBusSchema,
} as const;

// Add type exports
export type JobEnqueuedEvent = z.infer<typeof jobEnqueuedEventSchema>;
export type JobStartedEvent = z.infer<typeof jobStartedEventSchema>;
export type JobProgressEventBus = z.infer<typeof jobProgressEventBusSchema>;
export type JobCompletedEventBus = z.infer<typeof jobCompletedEventBusSchema>;
export type JobFailedEventBus = z.infer<typeof jobFailedEventBusSchema>;
export type JobCancelledEventBus = z.infer<typeof jobCancelledEventBusSchema>;
// ============================================================================
// EventBus Integration - Query Schemas
// ============================================================================

/**
 * Job events SSE query parameters
 *
 * @example
 * ```typescript
 * // Watch specific job
 * GET /queue/events?jobId=job-123
 *
 * // Watch all jobs in a queue
 * GET /queue/events?queueName=emails
 *
 * // Watch all jobs
 * GET /queue/events
 * ```
 */
export const jobEventsQuerySchema = z.object({
  /**
   * Filter events by job ID
   */
  jobId: z.string().optional(),

  /**
   * Filter events by queue name
   */
  queueName: z.string().optional(),

  /**
   * Filter events by job type
   */
  jobType: z.string().optional(),
});

/**
 * Job events query parameters (inferred from schema)
 */
export type JobEventsQuery = z.infer<typeof jobEventsQuerySchema>;

/**
 * Job SSE enqueued event (inferred from schema)
 */
export type JobSseEnqueuedEvent = z.infer<typeof jobSseEnqueuedEventSchema>;

/**
 * Job SSE started event (inferred from schema)
 */
export type JobSseStartedEvent = z.infer<typeof jobSseStartedEventSchema>;

/**
 * Job SSE progress event (inferred from schema)
 */
export type JobSseProgressEvent = z.infer<typeof jobSseProgressEventSchema>;

/**
 * Job SSE completed event (inferred from schema)
 */
export type JobSseCompletedEvent = z.infer<typeof jobSseCompletedEventSchema>;

/**
 * Job SSE failed event (inferred from schema)
 */
export type JobSseFailedEvent = z.infer<typeof jobSseFailedEventSchema>;

/**
 * Job SSE cancelled event (inferred from schema)
 */
export type JobSseCancelledEvent = z.infer<typeof jobSseCancelledEventSchema>;
