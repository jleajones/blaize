/**
 * BlaizeJS Core
 *
 * A blazing-fast, type-safe Node.js framework with file-based routing,
 * powerful middleware, and end-to-end type safety.
 *
 * @package blaizejs
 */
import config from '../package.json';
// Logging
import {
  logger,
  createLogger,
  NullTransport,
  JSONTransport,
  ConsoleTransport,
  configureGlobalLogger,
  Logger,
} from './logger';
// Middleware System
import { compose } from './middleware/compose';
import { cors } from './middleware/cors';
import {
  create as createMiddleware,
  serviceMiddleware as createServiceMiddleware,
  stateMiddleware as createStateMiddleware,
} from './middleware/create';
import { requestLoggerMiddleware } from './middleware/logger/request-logger';
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
  createRouteFactory,
} from './router/create';
import { createMatcher } from './router/matching/matcher';
import {
  extractParams,
  compilePathPattern,
  paramsToQuery,
  buildUrl,
} from './router/matching/params';
// Server
import { create as createServer } from './server/create';
import { getCorrelationId } from './tracing/correlation';
import { inferContext, type InferContext } from './types/server';
// Tracing

// TODO: ideally this could be import as an npm package, but for now we use a relative path
// Explicit imports to avoid using values without importing
export * from '../../blaize-types/src/index';

// Re-export everything

export {
  // Server module exports
  createServer,
  inferContext,
  type InferContext,

  // Router module exports
  createDeleteRoute,
  createGetRoute,
  createHeadRoute,
  createOptionsRoute,
  createPatchRoute,
  createPostRoute,
  createPutRoute,
  createRouteFactory,
  createMatcher,
  extractParams,
  compilePathPattern,
  paramsToQuery,
  buildUrl,

  // Middleware module exports
  createMiddleware,
  createServiceMiddleware,
  createStateMiddleware,
  compose,
  cors,
  requestLoggerMiddleware,

  // Plugins module exports
  createPlugin,

  // Tracing module exports
  getCorrelationId,

  // Logger exports
  logger,
  createLogger,
  configureGlobalLogger,
  Logger,
  ConsoleTransport,
  JSONTransport,
  NullTransport,
};

// Version information
export const VERSION = config.version;

// Namespaced exports with different names to avoid conflicts
export const ServerAPI = { createServer, inferContext };
export const RouterAPI = {
  createDeleteRoute,
  createGetRoute,
  createHeadRoute,
  createOptionsRoute,
  createPatchRoute,
  createPostRoute,
  createPutRoute,
  createRouteFactory,
  createMatcher,
  extractParams,
  compilePathPattern,
  paramsToQuery,
  buildUrl,
};
export const MiddlewareAPI = {
  createMiddleware,
  createServiceMiddleware,
  createStateMiddleware,
  compose,
  cors,
  requestLoggerMiddleware,
};
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
export { UnprocessableEntityError } from './errors/unprocessable-entity-error';
export { UnsupportedMediaTypeError } from './errors/unsupported-media-type-error';
export { ServiceNotAvailableError } from './errors/service-not-available-error';

// Default export
const Blaize = {
  // Core functions
  createServer,
  createMiddleware,
  createServiceMiddleware,
  createStateMiddleware,
  createPlugin,
  getCorrelationId,
  configureGlobalLogger,
  createLogger,
  logger,

  // Namespaces (using the non-conflicting names)
  Server: ServerAPI,
  Router: RouterAPI,
  Middleware: MiddlewareAPI,
  Plugins: PluginsAPI,

  // Constants
  VERSION,
};

export { Blaize };
