/**
 * BlaizeJS Core
 *
 * A blazing-fast, type-safe Node.js framework with file-based routing,
 * powerful middleware, and end-to-end type safety.
 *
 * @package blaizejs
 */

import { compose } from './middleware/compose';
import { create as createMiddleware } from './middleware/create';
import { create as createPlugin } from './plugins/create';
import {
  createDeleteRoute,
  createGetRoute,
  createHeadRoute,
  createOptionsRoute,
  createPatchRoute,
  createPostRoute,
  createPutRoute,
} from './router/create';
import { create as createServer } from './server/create';

// TODO: ideally this could be import as an npm package, but for now we use a relative path
// Explicit imports to avoid using values without importing
export * from '../../blaize-types/src/index';

// Re-export everything
// Server module exports
export { createServer };

// Router module exports
export {
  createDeleteRoute,
  createGetRoute,
  createHeadRoute,
  createOptionsRoute,
  createPatchRoute,
  createPostRoute,
  createPutRoute,
};

// Middleware module exports
export { createMiddleware, compose };

// Plugins module exports
export { createPlugin };

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

// Default export
const Blaize = {
  // Core functions
  createServer,
  createMiddleware,
  createPlugin,

  // Namespaces (using the non-conflicting names)
  Server: ServerAPI,
  Router: RouterAPI,
  Middleware: MiddlewareAPI,
  Plugins: PluginsAPI,

  // Constants
  VERSION,
};

export default Blaize;
export { Blaize };
