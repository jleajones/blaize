/* eslint-disable @typescript-eslint/no-empty-object-type */
/**
 * BlaizeJS Server Module - Enhanced with Correlation Configuration
 *
 * Provides the core HTTP/2 server implementation with HTTP/1.1 fallback
 * and correlation ID tracking configuration.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import http from 'node:http';
import http2 from 'node:http2';

import type {
  ExtractMiddlewareServices,
  ExtractMiddlewareState,
  ExtractPluginServices,
  ExtractPluginState,
  UnionToIntersection,
} from './composition';
import type { Context } from './context';
import type { Middleware } from './middleware';
import type { Plugin, PluginLifecycleManager } from './plugins';
import type { Router } from './router';
import type { EventEmitter } from 'node:events';

export interface Http2Options {
  enabled?: boolean | undefined;
  keyFile?: string | undefined;
  certFile?: string | undefined;
}

export interface StartOptions {
  port?: number;
  host?: string;
}

export interface StopOptions {
  timeout?: number;
  plugins?: Plugin[];
  onStopping?: () => Promise<void> | void;
  onStopped?: () => Promise<void> | void;
}

/**
 * Correlation ID configuration options
 */
export interface CorrelationOptions {
  /**
   * The HTTP header name to use for correlation IDs
   * @default 'x-correlation-id'
   */
  headerName?: string;

  /**
   * Custom correlation ID generator function
   * @default () => `req_${timestamp}_${random}`
   */
  generator?: () => string;
}

/**
 * Server options for configuring the BlaizeJS server
 */
export interface ServerOptionsInput {
  /** Port to listen on (default: 3000) */
  port?: number;

  /** Host to bind to (default: localhost) */
  host?: string;

  /** Directory containing route files (default: ./routes) */
  routesDir?: string;

  /** HTTP/2 options */
  http2?: {
    /** Enable HTTP/2 (default: true) */
    enabled?: boolean | undefined;

    /** Path to key file for HTTPS/HTTP2 */
    keyFile?: string | undefined;

    /** Path to certificate file for HTTPS/HTTP2 */
    certFile?: string | undefined;
  };

  /** Global middleware to apply to all routes */
  middleware?: Middleware[];

  /** Plugins to register */
  plugins?: Plugin[];

  /**
   * Correlation ID configuration
   * @since 0.4.0
   */
  correlation?: CorrelationOptions;
}

/**
 * Configuration for a BlaizeJS server
 */
export interface ServerOptions {
  /** Port to listen on (default: 3000) */
  port: number;

  /** Host to bind to (default: localhost) */
  host: string;

  /** Directory containing route files (default: ./routes) */
  routesDir: string;

  /** HTTP/2 options */
  http2?: {
    /** Enable HTTP/2 (default: true) */
    enabled?: boolean | undefined;

    /** Path to key file for HTTPS/HTTP2 */
    keyFile?: string | undefined;

    /** Path to certificate file for HTTPS/HTTP2 */
    certFile?: string | undefined;
  };

  /** Global middleware to apply to all routes */
  middleware?: Middleware[];

  /** Plugins to register */
  plugins?: Plugin[];

  /**
   * Correlation ID configuration
   * @since 0.4.0
   */
  correlation?: CorrelationOptions;
}

/**
 * BlaizeJS Server instance with generic type accumulation
 *
 * @template TState - The accumulated state type from middleware
 * @template TServices - The accumulated services type from middleware and plugins
 *
 */
export interface Server<
  TState extends Record<string, unknown> = {},
  TServices extends Record<string, unknown> = {},
> {
  /** The underlying HTTP or HTTP/2 server */
  server: http.Server | http2.Http2Server | undefined;

  /** The port the server is configured to listen on */
  port: number;

  /** The host the server is bound to */
  host: string;
  events: EventEmitter;

  /** Direct access to registered plugins */
  plugins: Plugin[];

  /** Direct access to registered plugins */
  middleware: Middleware[];

  /** Internal property for signal hanlders */
  _signalHandlers?: { unregister: () => void };

  /** Start the server and listen for connections */
  listen: (port?: number, host?: string) => Promise<Server<TState, TServices>>;

  /** Stop the server */
  close: (stopOptions?: StopOptions) => Promise<void>;

  /**
   * Add global middleware to the server
   *
   * @param middleware - Single middleware or array of middleware to add
   * @returns New Server instance with accumulated types from the middleware
   *
   * @example
   * ```typescript
   * // Single middleware
   * const serverWithAuth = server.use(authMiddleware);
   * // serverWithAuth has type Server<{user: User}, {auth: AuthService}>
   *
   * // Array of middleware
   * const serverWithMiddleware = server.use([authMiddleware, loggerMiddleware]);
   * // serverWithMiddleware has type Server<{user, requestId}, {auth, logger}>
   * ```
   */
  use<MS extends Record<string, unknown>, MSvc extends Record<string, unknown>>(
    middleware: Middleware<MS, MSvc>
  ): Server<TState & MS, TServices & MSvc>;

  use<MW extends readonly Middleware<any, any>[]>(
    middleware: MW
  ): Server<
    TState & UnionToIntersection<ExtractMiddlewareState<MW[number]>>,
    TServices & UnionToIntersection<ExtractMiddlewareServices<MW[number]>>
  >;

  /**
   * Register a plugin with the server
   *
   * @param plugin - Single plugin or array of plugins to register
   * @returns Promise resolving to new Server instance with accumulated types
   *
   * @example
   * ```typescript
   * // Single plugin
   * const serverWithDb = await server.register(databasePlugin);
   * // serverWithDb has type Server<{}, {db: DatabaseService}>
   *
   * // Array of plugins
   * const serverWithPlugins = await server.register([dbPlugin, cachePlugin]);
   * // serverWithPlugins has type Server<{}, {db, cache}>
   * ```
   */
  register<PS extends Record<string, unknown>, PSvc extends Record<string, unknown>>(
    plugin: Plugin<PS, PSvc>
  ): Promise<Server<TState & PS, TServices & PSvc>>;

  register<P extends readonly Plugin<any, any>[]>(
    plugin: P
  ): Promise<
    Server<
      TState & UnionToIntersection<ExtractPluginState<P[number]>>,
      TServices & UnionToIntersection<ExtractPluginServices<P[number]>>
    >
  >;

  /** Access to the routing system */
  router: Router;

  /** Context storage system */
  context: AsyncLocalStorage<Context>;

  pluginManager: PluginLifecycleManager;
}

export type RequestHandler = (
  req: http.IncomingMessage | http2.Http2ServerRequest,
  res: http.ServerResponse | http2.Http2ServerResponse
) => Promise<void>;
