/**
 * BlaizeJS Core
 *
 * A blazing-fast, type-safe Node.js framework with file-based routing,
 * powerful middleware, and end-to-end type safety.
 *
 * @package blaizejs
 */

// Explicit imports to avoid using values without importing
import { Context } from './context';
import { createMiddleware, compose } from './middleware';
import { createPlugin } from './plugins';
import { createRoute } from './router';
import { createServer } from './server';

// Re-export everything
// Server module exports
export { createServer };
export type { Server, ServerOptions } from './server';

// Router module exports
export { createRoute };
export type { Route, RouteHandler, RouteOptions } from './router';

// Middleware module exports
export { createMiddleware, compose };
export type { Middleware, NextFunction } from './middleware';

// Context module exports
export { Context };
export type { Request, Response } from './context';

// Plugins module exports
export { createPlugin };
export type { Plugin, PluginOptions } from './plugins';

// Version information
export const VERSION = '0.1.0';

// Namespaced exports with different names to avoid conflicts
export const ServerAPI = { createServer };
export const RouterAPI = { createRoute };
export const MiddlewareAPI = { createMiddleware, compose };
export const PluginsAPI = { createPlugin };

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

  // Classes
  Context,

  // Constants
  VERSION,
};

export default Blaize;
export { Blaize };
