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
  register: (app: Server) => void | Promise<void>;

  /** Called when the server is initialized */
  initialize?: (app?: Server) => void | Promise<void>;

  /** Called when the server is terminated */
  terminate?: (app?: Server) => void | Promise<void>;

  /** Called when the server starts */
  onServerStart?: (server: any) => void | Promise<void>;

  /** Called when the server stops */
  onServerStop?: (server: any) => void | Promise<void>;
}

/**
 * Plugin interface
 */
export interface Plugin extends PluginHooks {
  /** Plugin name */
  name: string;

  /** Plugin version */
  version: string;
}

/**
 * Plugin factory function
 */
export type PluginFactory<T = any> = (options?: T) => Plugin;
