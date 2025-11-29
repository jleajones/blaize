/**
 * @blaizejs/queue - Background Job Processing Plugin
 *
 * Type-safe queue system with priority scheduling, retry logic,
 * and real-time SSE monitoring for BlaizeJS applications.
 *
 * @module @blaizejs/queue
 * @version 0.4.0
 */

import config from '../package.json';

// ============================================================================
// Plugin Factory
// ============================================================================
export { createQueuePlugin } from './plugin';

// ============================================================================
// Core Types
// ============================================================================
export type {
  // Job types
  Job,
  JobStatus,
  JobPriority,
  JobError,
  JobOptions,
  JobContext,
  JobHandler,
  JobFilters,
  JobSubscription,
  // Job type schema (for advanced usage with Zod validation)
  JobTypeDefinition,
  JobTypesSchema,
  // Queue types
  QueueStats,
  QueueConfig,
  QueuePluginConfig,
  QueueServiceConfig,
  StopOptions,
  QueueInstanceEvents,
  // Storage adapter type
  QueueStorageAdapter,
  // Error detail types
  QueueErrorDetails,
  JobNotFoundDetails,
  JobTimeoutDetails,
  JobCancelledDetails,
  HandlerNotFoundDetails,
  QueueNotFoundDetails,
  QueueConfigErrorDetails,
  StorageErrorDetails,
  HandlerAlreadyRegisteredDetails,
  JobValidationErrorDetails,
  // Priority Queue types
  PriorityQueue,
  PriorityQueueItem,
  // Dashboard types
  DashboardData,
  DashboardOptions,
} from './types';

// ============================================================================
// Error Classes
// ============================================================================
export {
  QueueError,
  JobNotFoundError,
  JobTimeoutError,
  JobCancelledError,
  HandlerNotFoundError,
  QueueNotFoundError,
  QueueConfigError,
  StorageError,
  HandlerAlreadyRegisteredError,
  JobValidationError,
} from './errors';

// ============================================================================
// Route Handlers (exported separately from schemas)
// ============================================================================
export {
  // SSE Handler
  jobStreamHandler,
  // HTTP Handlers
  queueStatusHandler,
  queuePrometheusHandler,
  queueDashboardHandler,
  createJobHandler,
  cancelJobHandler,
  // Query schemas for route validation
  jobStreamQuerySchema,
  queueStatusQuerySchema,
  queueDashboardQuerySchema,
  createJobBodySchema,
  cancelJobBodySchema,
} from './routes';

// ============================================================================
// Dashboard Rendering Utilities
// ============================================================================
export {
  gatherDashboardData,
  renderDashboard,
  formatBytes,
  formatUptime,
  formatTimestamp,
} from './dashboard';

// ============================================================================
// Schemas (for validation)
// ============================================================================
export {
  // Configuration schemas
  jobPrioritySchema,
  jobOptionsSchema,
  jobTypeDefinitionSchema,
  queueConfigSchema,
  queueConfigWithoutNameSchema,
  pluginConfigSchema,
  // SSE Event Schemas
  jobProgressEventSchema,
  jobCompletedEventSchema,
  jobFailedEventSchema,
  jobCancelledEventSchema,
  jobEventsSchema,
  // Response Schemas
  jobStatusEnumSchema,
  jobErrorSchema,
  jobSchema,
  queueStatsSchema,
  queueWithJobsSchema,
  queueStatusResponseSchema,
  jobDetailsResponseSchema,
  createJobResponseSchema,
  cancelJobResponseSchema,
} from './schema';

export type {
  // Configuration types (inferred from schemas)
  JobPriorityConfig,
  JobOptionsConfig,
  JobOptionsInput,
  JobTypeDefinitionConfig,
  QueueConfigSchema,
  QueueConfigInput,
  PluginConfigSchema,
  PluginConfigInput,
  // SSE Event Types (inferred from schemas)
  JobProgressEvent,
  JobCompletedEvent,
  JobFailedEvent,
  JobCancelledEvent,
  JobEvent,
  JobEventName,
  // Response Types (inferred from schemas)
  JobStatusEnum,
  JobErrorResponse,
  JobResponse,
  QueueStatsResponse,
  QueueWithJobsResponse,
  QueueStatusResponse,
  JobDetailsResponse,
  CreateJobResponse,
  CancelJobResponse,
} from './schema';

// ============================================================================
// Storage Adapters
// ============================================================================
export { createInMemoryStorage, InMemoryStorage } from './storage';

// ============================================================================
// Queue Instance
// ============================================================================
export { QueueInstance } from './queue-instance';

// ============================================================================
// Queue Service (Multi-queue Manager)
// ============================================================================
export { QueueService } from './queue-service';

// ============================================================================
// Utilities
// ============================================================================
// Priority Queue (used internally, exported for custom adapters)
export { createPriorityQueue } from './priority-queue';

/**
 * Package version
 */
export const VERSION = config.version;

/**
 * Package name
 */
export const PACKAGE_NAME = config.name;
