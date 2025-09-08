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
 * Plugin lifecycle hooks
 */
export interface PluginHooks {
  /** Called when the plugin is registered */
  register: (app: Server<any, any>) => void | Promise<void>;

  /** Called when the server is initialized */
  initialize?: (app?: Server<any, any>) => void | Promise<void>;

  /** Called when the server is terminated */
  terminate?: (app?: Server<any, any>) => void | Promise<void>;

  /** Called when the server starts */
  onServerStart?: (server: any) => void | Promise<void>;

  /** Called when the server stops */
  onServerStop?: (server: any) => void | Promise<void>;
}

/**
 * Plugin interface
 */
export interface Plugin<TState = {}, TServices = {}> extends PluginHooks {
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
export type PluginFactory<
  T = any,
  TState extends Record<string, unknown> = {},
  TServices extends Record<string, unknown> = {},
> = (options?: T) => Plugin<TState, TServices>;

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
