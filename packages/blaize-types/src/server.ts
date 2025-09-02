/**
 * BlaizeJS Server Module - Enhanced with Correlation Configuration
 *
 * Provides the core HTTP/2 server implementation with HTTP/1.1 fallback
 * and correlation ID tracking configuration.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import http from 'node:http';
import http2 from 'node:http2';

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
 * BlaizeJS Server instance
 */
export interface Server {
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
  listen: (port?: number, host?: string) => Promise<Server>;

  /** Stop the server */
  close: (stopOptions?: StopOptions) => Promise<void>;

  /** Add global middleware */
  use: (middleware: Middleware | Middleware[]) => Server;

  /** Register a plugin */
  register: (plugin: Plugin) => Promise<Server>;

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
