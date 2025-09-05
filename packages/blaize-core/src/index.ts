/**
 * BlaizeJS Core
 *
 * A blazing-fast, type-safe Node.js framework with file-based routing,
 * powerful middleware, and end-to-end type safety.
 *
 * @package blaizejs
 */
// Middleware System
import { compose } from './middleware/compose';
import { create as createMiddleware } from './middleware/create';
// Plugin System
import { create as createPlugin } from './plugins/create';
// Router System
import {
  createDeleteRoute,
  createGetRoute,
  createHeadRoute,
  createOptionsRoute,
  createPatchRoute,
  createPostRoute,
  createPutRoute,
} from './router/create';
// Server
import { create as createServer } from './server/create';
// Tracing
import { getCorrelationId } from './tracing/correlation';

// TODO: ideally this could be import as an npm package, but for now we use a relative path
// Explicit imports to avoid using values without importing
export * from '../../blaize-types/src/index';

// Re-export everything

export {
  // Server module exports
  createServer,

  // Router module exports
  createDeleteRoute,
  createGetRoute,
  createHeadRoute,
  createOptionsRoute,
  createPatchRoute,
  createPostRoute,
  createPutRoute,

  // Middleware module exports
  createMiddleware,
  compose,

  // Plugins module exports
  createPlugin,

  // Tracing module exports
  getCorrelationId,
};

// Version information
export const VERSION = '0.1.0';

// Namespaced exports with different names to avoid conflicts
export const ServerAPI = { createServer };
export const RouterAPI = {
  createDeleteRoute,
  createGetRoute,
  createHeadRoute,
  createOptionsRoute,
  createPatchRoute,
  createPostRoute,
  createPutRoute,
};
export const MiddlewareAPI = { createMiddleware, compose };
export const PluginsAPI = { createPlugin };

// Server-side error classes
export { ValidationError } from './errors/validation-error';
export { NotFoundError } from './errors/not-found-error';
export { UnauthorizedError } from './errors/unauthorized-error';
export { ForbiddenError } from './errors/forbidden-error';
export { ConflictError } from './errors/conflict-error';
export { RateLimitError } from './errors/rate-limit-error';
export { InternalServerError } from './errors/internal-server-error';
export { PayloadTooLargeError } from './errors/payload-too-large-error';
export { RequestTimeoutError } from './errors/request-timeout-error';
export { UnsupportedMediaTypeError } from './errors/unsupported-media-type-error';
export { UnprocessableEntityError } from './errors/unprocessable-entity-error';

// Default export
const Blaize = {
  // Core functions
  createServer,
  createMiddleware,
  createPlugin,
  getCorrelationId,

  // Namespaces (using the non-conflicting names)
  Server: ServerAPI,
  Router: RouterAPI,
  Middleware: MiddlewareAPI,
  Plugins: PluginsAPI,

  // Constants
  VERSION,
};

export { Blaize };
