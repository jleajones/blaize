/**
 * BlaizeJS Plugin Module
 *
 * Provides the plugin system for extending framework functionality.
 */

import type { Server } from './server';

/**
 * Setup function signature for type-safe plugins
 * @template T - Options type
 * @template TServerMods - Server modifications this plugin makes
 * @template TContextMods - Context modifications this plugin makes
 */
export type PluginSetup<T = any, TServerMods = unknown> = (
  app: Server & TServerMods,
  options: T
) => void | Partial<PluginHooks> | Promise<void> | Promise<Partial<PluginHooks>>;

/**
 * Plugin options
 */
export interface PluginOptions<_T = any> {
  /** Plugin configuration */
  [key: string]: any;
}

/**
 * Type manifest for plugin type information
 * Carries type information about what the plugin modifies
 */
export interface PluginTypeManifest<TServerMods = unknown, TContextMods = unknown> {
  /** Server modifications this plugin makes */
  serverMods?: TServerMods;
  /** Context modifications this plugin makes */
  contextMods?: TContextMods;
}

/**
 * Plugin lifecycle hooks
 */
export interface PluginHooks<TServerMods = unknown> {
  /** Called when the plugin is registered */
  register: (server: Server & TServerMods) => void | Promise<void>;

  /** Called when the server is initialized */
  initialize?: (server?: Server & TServerMods) => void | Promise<void>;

  /** Called when the server is terminated */
  terminate?: (server?: Server & TServerMods) => void | Promise<void>;

  /** Called when the server starts */
  onServerStart?: (server: Server & TServerMods) => void | Promise<void>;

  /** Called when the server stops */
  onServerStop?: (server: Server & TServerMods) => void | Promise<void>;
}

/**
 * Plugin interface with type parameters for enhanced type safety
 * @template TServerMods - Server modifications this plugin makes
 * @template TContextMods - Context modifications this plugin makes
 */
export interface Plugin<TServerMods = unknown, TContextMods = unknown>
  extends PluginHooks<TServerMods> {
  /** Plugin name */
  name: string;

  /** Plugin version */
  version: string;

  /** Optional type manifest for carrying type information */
  _types?: PluginTypeManifest<TServerMods, TContextMods>;
}

/**
 * Plugin factory function with type parameters
 */
export type PluginFactory<T = any, TServerMods = unknown, TContextMods = unknown> = (
  options?: T
) => Plugin<TServerMods, TContextMods>;

/**
 * Helper type to extract server modifications from plugin
 */
export type ExtractServerMods<T> = T extends Plugin<infer S, any> ? S : unknown;

/**
 * Helper type to extract context modifications from plugin
 */
export type ExtractContextMods<T> = T extends Plugin<any, infer C> ? C : unknown;

/**
 * Compose server modifications from a server's plugin array (for type inference)
 * @template T - Array of plugins to compose server modifications from
 * @template Depth - Internal depth tracking (max 10 levels)
 */
export type ComposeServerMods<
  T extends readonly Plugin<any, any>[],
  Depth extends readonly unknown[] = [],
> = Depth['length'] extends 10
  ? unknown // Fallback to unknown after 10 levels
  : T extends readonly [Plugin<infer S1, any>, ...infer Rest]
    ? Rest extends readonly Plugin<any, any>[]
      ? S1 & ComposeServerMods<Rest, [...Depth, unknown]>
      : S1
    : unknown;

/**
 * Compose context modifications from a server's plugin array (for type inference)
 * @template T - Array of plugins to compose context modifications from
 * @template Depth - Internal depth tracking (max 10 levels)
 */
export type ComposeContextMods<
  T extends readonly Plugin<any, any>[],
  Depth extends readonly unknown[] = [],
> = Depth['length'] extends 10
  ? unknown // Fallback to unknown after 10 levels
  : T extends readonly [Plugin<any, infer C1>, ...infer Rest]
    ? Rest extends readonly Plugin<any, any>[]
      ? C1 & ComposeContextMods<Rest, [...Depth, unknown]>
      : C1
    : unknown;

export interface PluginLifecycleManager {
  initializePlugins(server: Server): Promise<void>;
  terminatePlugins(server: Server): Promise<void>;
  onServerStart(server: Server, httpServer: any): Promise<void>;
  onServerStop(server: Server, httpServer: any): Promise<void>;
}

export interface PluginLifecycleOptions {
  /** Continue initialization even if a plugin fails */
  continueOnError?: boolean;
  /** Log plugin lifecycle events */
  debug?: boolean;
  /** Custom error handler for plugin failures */
  onError?: (plugin: Plugin, phase: string, error: Error) => void;
}
