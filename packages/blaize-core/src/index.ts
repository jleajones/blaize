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
import { create as createRoute } from './router/';
import { create as createServer } from './server';

// Import registry to ensure global declarations are processed
import './router/registry';

// Import the type exports from registry
import type { AppType } from './router/registry';

// Re-export everything
// Server module exports
export { createServer };

// Router module exports
export { createRoute };

// Middleware module exports
export { createMiddleware, compose };

// Plugins module exports
export { createPlugin };

// Version information
export const VERSION = '0.1.0';

// Namespaced exports with different names to avoid conflicts
export const ServerAPI = { createServer };
export const RouterAPI = { createRoute };
export const MiddlewareAPI = { createMiddleware, compose };
export const PluginsAPI = { createPlugin };

// Export route types for users
export type { AppType };

// Default export
const Blaize = {
  // Core functions
  createServer,
  createRoute,
  createMiddleware,
  createPlugin,
  compose,

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
