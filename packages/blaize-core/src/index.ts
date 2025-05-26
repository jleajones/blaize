/**
 * BlaizeJS Core
 *
 * A blazing-fast, type-safe Node.js framework with file-based routing,
 * powerful middleware, and end-to-end type safety.
 *
 * @package blaizejs
 */

// Explicit imports to avoid using values without importing
import { create as createMiddleware, compose } from './middleware';
import { create as createPlugin } from './plugins';
import {
  createDeleteRoute,
  createGetRoute,
  createHeadRoute,
  createOptionsRoute,
  createPatchRoute,
  createPostRoute,
  createPutRoute,
  defineAppRoutes,
} from './router/';
import { create as createServer } from './server';

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
  defineAppRoutes,
};
export const MiddlewareAPI = { createMiddleware, compose };
export const PluginsAPI = { createPlugin };

// Default export
const Blaize = {
  // Core functions
  createServer,
  createMiddleware,
  createPlugin,
  defineAppRoutes,

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
