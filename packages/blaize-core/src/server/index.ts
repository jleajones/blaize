/**
 * BlaizeJS Server Module
 *
 * Provides the core HTTP/2 server implementation with HTTP/1.1 fallback.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import http from 'node:http';
import http2 from 'node:http2';

import { Context } from '../context';

import type { Middleware } from '../middleware';
import type { Plugin } from '../plugins';

/**
 * Server options for configuring the BlaizeJS server
 */
export interface ServerOptions {
  /** Port to listen on (default: 3000) */
  port?: number;

  /** Host to bind to (default: localhost) */
  host?: string;

  /** Directory containing route files (default: ./routes) */
  routesDir?: string;

  /** HTTP/2 options */
  http2?: {
    /** Enable HTTP/2 (default: true) */
    enabled?: boolean;

    /** Path to key file for HTTPS/HTTP2 */
    keyFile?: string;

    /** Path to certificate file for HTTPS/HTTP2 */
    certFile?: string;
  };

  /** Global middleware to apply to all routes */
  middleware?: Middleware[];

  /** Plugins to register */
  plugins?: Plugin[];
}

/**
 * BlaizeJS Server instance
 */
export interface Server {
  /** The underlying HTTP or HTTP/2 server */
  server: http.Server | http2.Http2Server;

  /** The port the server is configured to listen on */
  port: number;

  /** The host the server is bound to */
  host: string;

  /** Start the server and listen for connections */
  listen: (port?: number, host?: string) => Promise<void>;

  /** Stop the server */
  close: () => Promise<void>;

  /** Add global middleware */
  use: (middleware: Middleware | Middleware[]) => Server;

  /** Register a plugin */
  register: (plugin: Plugin) => Promise<Server>;

  /** Access to the routing system */
  routes: Record<string, any>;

  /** Context storage system */
  context: AsyncLocalStorage<Context>;
}

// This will be implemented in the future
export function createServer(_options: ServerOptions = {}): Server {
  // Implementation placeholder
  throw new Error('Server implementation not yet available');
}
