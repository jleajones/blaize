/* eslint-disable @typescript-eslint/no-empty-object-type */
/**
 * BlaizeJS Plugin Module
 *
 * Provides the plugin system for extending framework functionality.
 */

import type { Server } from './server';

/**
 * Plugin options
 */
export interface PluginOptions<_T = any> {
  /** Plugin configuration */
  [key: string]: any;
}

/**
 * Plugin lifecycle hooks with full type safety
 *
 * Plugins execute in this order:
 * 1. register() - Add middleware, routes
 * 2. initialize() - Create resources
 * 3. onServerStart() - Start background work
 * 4. onServerStop() - Stop background work
 * 5. terminate() - Cleanup resources
 */
export interface PluginHooks<TState = {}, TServices = {}> {
  /**
   * Called when plugin is registered to server
   *
   * Use this hook to:
   * - Add middleware via server.use()
   * - Add routes via server.router.addRoute()
   * - Subscribe to server events
   *
   * @param server - BlaizeJS server instance
   * @example
   * ```typescript
   * register: async (server) => {
   *   server.use(createMiddleware({
   *     handler: async (ctx, next) => {
   *       ctx.services.db = db;
   *       await next();
   *     },
   *   }));
   * }
   * ```
   */
  register?: (server: Server<TState, TServices>) => void | Promise<void>;

  /**
   * Called during server initialization
   *
   * Use this hook to:
   * - Create database connections
   * - Initialize services
   * - Allocate resources
   *
   * @example
   * ```typescript
   * initialize: async () => {
   *   db = await Database.connect(config);
   * }
   * ```
   */
  initialize?: () => void | Promise<void>;

  /**
   * Called when server starts listening
   *
   * Use this hook to:
   * - Start background workers
   * - Start cron jobs
   * - Begin health checks
   *
   * @example
   * ```typescript
   * onServerStart: async () => {
   *   worker = new BackgroundWorker();
   *   await worker.start();
   * }
   * ```
   */
  onServerStart?: () => void | Promise<void>;

  /**
   * Called when server stops listening
   *
   * Use this hook to:
   * - Stop background workers
   * - Flush buffers
   * - Complete in-flight work
   *
   * @example
   * ```typescript
   * onServerStop: async () => {
   *   await worker.stop({ graceful: true });
   * }
   * ```
   */
  onServerStop?: () => void | Promise<void>;

  /**
   * Called during server termination
   *
   * Use this hook to:
   * - Close database connections
   * - Release file handles
   * - Free memory
   *
   * @example
   * ```typescript
   * terminate: async () => {
   *   await db?.close();
   * }
   * ```
   */
  terminate?: () => void | Promise<void>;
}

/**
 * Plugin interface
 */
export interface Plugin<TState = {}, TServices = {}> extends PluginHooks<TState, TServices> {
  /** Plugin name */
  name: string;

  /** Plugin version */
  version: string;

  /**
   * Type carriers for compile-time type information
   * These are never used at runtime but allow TypeScript to track types
   */
  _state?: TState;
  _services?: TServices;
}

/**
 * Plugin factory function
 */
export type PluginFactory<TConfig = any, TState = {}, TServices = {}> = (
  options?: TConfig
) => Plugin<TState, TServices>;

export interface PluginLifecycleManager {
  initializePlugins(server: Server<any, any>): Promise<void>;
  terminatePlugins(server: Server<any, any>): Promise<void>;
  onServerStart(server: Server<any, any>, httpServer: any): Promise<void>;
  onServerStop(server: Server<any, any>, httpServer: any): Promise<void>;
}

export interface PluginLifecycleOptions {
  /** Continue initialization even if a plugin fails */
  continueOnError?: boolean;
  /** Log plugin lifecycle events */
  debug?: boolean;
  /** Custom error handler for plugin failures */
  onError?: (plugin: Plugin, phase: string, error: Error) => void;
}
