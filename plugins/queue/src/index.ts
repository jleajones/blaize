import config from '../package.json';
/**
 * @blaizejs/queue - Background Job Processing Plugin
 *
 * Type-safe queue system with priority scheduling, retry logic,
 * and real-time SSE monitoring for BlaizeJS applications.
 *
 * @module @blaizejs/queue
 */

// ============================================================================
// Plugin Factory
// ============================================================================
// TODO: Implement in plugin.ts
// export { createQueuePlugin } from './plugin';

// ============================================================================
// Core Types
// ============================================================================
export type {
  Job,
  JobStatus,
  JobHandler,
  JobContext,
  JobOptions,
  QueueConfig,
  QueuePluginConfig,
  // QueueService,
  QueueInstanceConfig,
  QueueStorageAdapter,
} from './types';

// ============================================================================
// Error Classes
// ============================================================================
export {
  QueueConfigError,
  JobNotFoundError,
  JobTimeoutError,
  JobCancelledError,
  HandlerNotFoundError,
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
// TODO: Implement in schemas.ts
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
export { createInMemoryStorage } from './storage';

// ============================================================================
// Utilities
// ============================================================================
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
