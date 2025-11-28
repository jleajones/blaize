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
// TODO: Implement in plugin.ts
// export { createQueuePlugin } from './plugin';

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
  // Storage adapter
  QueueStorageAdapter,
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
  PriorityQueue,
  PriorityQueueItem,
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
// TODO: Implement in routes.ts
// export {
//   jobStreamHandler,
//   queueStatusHandler,
//   queuePrometheusHandler,
//   queueDashboardHandler,
//   createJobHandler,
//   cancelJobHandler,
// } from './routes';

// ============================================================================
// Schemas (for validation)
// ============================================================================
// Configuration schemas
export {
  jobPrioritySchema,
  jobOptionsSchema,
  jobTypeDefinitionSchema,
  queueConfigSchema,
  queueConfigWithoutNameSchema,
  pluginConfigSchema,
} from './schema';

// Configuration types (inferred from schemas)
export type {
  JobPriorityConfig,
  JobOptionsConfig,
  JobOptionsInput,
  JobTypeDefinitionConfig,
  QueueConfigSchema,
  QueueConfigInput,
  PluginConfigSchema,
  PluginConfigInput,
} from './schema';

// TODO: Route schemas (T12, T19)
// export {
//   jobStreamQuerySchema,
//   jobEventsSchema,
//   queueStatusQuerySchema,
//   queueStatusResponseSchema,
//   queueDashboardQuerySchema,
//   createJobBodySchema,
//   cancelJobBodySchema,
// } from './schemas';

// ============================================================================
// Storage Adapters
// ============================================================================
// QueueStorageAdapter type is exported above in Core Types
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

// TODO: Implement dashboard renderer
// export { renderDashboard } from './dashboard';

/**
 * Package version
 */
export const VERSION = config.version;

/**
 * Package name
 */
export const PACKAGE_NAME = config.name;
