import { AsyncLocalStorage } from 'node:async_hooks';
import EventEmitter from 'node:events';

import { setRuntimeConfig } from '../config';
import {
  Context,
  Middleware,
  Plugin,
  Server,
  ServerOptions,
  ServerOptionsInput,
  StopOptions,
} from '../index';
import { startServer } from './start';
import { registerSignalHandlers, stopServer } from './stop';
import { validateServerOptions } from './validation';
import { createPluginLifecycleManager } from '../plugins/lifecycle';
import { validatePlugin } from '../plugins/validation';
import { createRouter } from '../router/router';

export const DEFAULT_OPTIONS: ServerOptions = {
  port: 3000,
  host: 'localhost',
  routesDir: './routes',
  http2: {
    enabled: true,
  },
  middleware: [],
  plugins: [],
};

/**
 * Creates the configuration options by merging defaults with user-provided options
 */
function createServerOptions(options: ServerOptionsInput = {}): ServerOptions {
  const baseOptions: ServerOptions = { ...DEFAULT_OPTIONS };
  setRuntimeConfig({ routesDir: options.routesDir || baseOptions.routesDir });

  return {
    port: options.port ?? baseOptions.port,
    host: options.host ?? baseOptions.host,
    routesDir: options.routesDir ?? baseOptions.routesDir,
    http2: {
      enabled: options.http2?.enabled ?? baseOptions.http2?.enabled,
      keyFile: options.http2?.keyFile ?? baseOptions.http2?.keyFile,
      certFile: options.http2?.certFile ?? baseOptions.http2?.certFile,
    },
    middleware: [...(baseOptions.middleware || []), ...(options.middleware || [])],
    plugins: [...(baseOptions.plugins || []), ...(options.plugins || [])],
  };
}

/**
 * Creates the server listen method
 */
function createListenMethod(
  serverInstance: Server,
  validatedOptions: ServerOptions,
  initialMiddleware: Middleware[],
  initialPlugins: Plugin[]
): Server['listen'] {
  return async () => {
    // Initialize middleware and plugins
    await initializeComponents(serverInstance, initialMiddleware, initialPlugins);

    // Use the functional manager
    await serverInstance.pluginManager.initializePlugins(serverInstance);

    // Start the server
    await startServer(serverInstance, validatedOptions);

    await serverInstance.pluginManager.onServerStart(serverInstance, serverInstance.server);

    // Setup signal handlers and emit events
    setupServerLifecycle(serverInstance);

    return serverInstance;
  };
}

/**
 * Initializes middleware and plugins
 */
async function initializeComponents(
  serverInstance: Server,
  initialMiddleware: Middleware[],
  initialPlugins: Plugin[]
): Promise<void> {
  // Initialize middleware from options
  for (const mw of initialMiddleware) {
    serverInstance.use(mw);
  }

  // Register plugins from options
  for (const p of initialPlugins) {
    await serverInstance.register(p);
  }
}

/**
 * Sets up server lifecycle (signal handlers, events)
 */
function setupServerLifecycle(serverInstance: Server): void {
  // Register signal handlers for graceful shutdown
  const signalHandlers = registerSignalHandlers(() => serverInstance.close());

  // Store handlers to unregister when server closes
  serverInstance._signalHandlers = signalHandlers;

  // Emit started event
  serverInstance.events.emit('started');
}

/**
 * Creates the server close method
 */
function createCloseMethod(serverInstance: Server): Server['close'] {
  return async (stopOptions?: StopOptions) => {
    if (!serverInstance.server) {
      return;
    }

    // Prepare options
    const options: StopOptions = { ...stopOptions };

    // Unregister signal handlers if they exist
    if (serverInstance._signalHandlers) {
      serverInstance._signalHandlers.unregister();
      delete serverInstance._signalHandlers;
    }

    // Call stopServer with the server instance
    await stopServer(serverInstance, options);
  };
}

/**
 * Creates the server use method for adding middleware
 */
function createUseMethod(serverInstance: Server): Server['use'] {
  return middleware => {
    const middlewareArray = Array.isArray(middleware) ? middleware : [middleware];
    serverInstance.middleware.push(...middlewareArray);
    return serverInstance;
  };
}

/**
 * Creates the server register method for plugins
 */
function createRegisterMethod(serverInstance: Server): Server['register'] {
  return async plugin => {
    validatePlugin(plugin);
    serverInstance.plugins.push(plugin);
    await plugin.register(serverInstance);
    return serverInstance;
  };
}

/**
 * Creates a BlaizeJS server instance
 */
export function create(options: ServerOptionsInput = {}): Server {
  // Create and validate options
  const mergedOptions = createServerOptions(options);

  let validatedOptions: ServerOptions;
  try {
    validatedOptions = validateServerOptions(mergedOptions);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to create server: ${error.message}`);
    }
    throw new Error(`Failed to create server: ${String(error)}`);
  }

  // Extract options and prepare initial components
  const { port, host, middleware, plugins } = validatedOptions;
  // TODO: create registries to manage middleware and plugins
  const initialMiddleware = Array.isArray(middleware) ? [...middleware] : [];
  const initialPlugins = Array.isArray(plugins) ? [...plugins] : [];

  // Initialize core server components
  const contextStorage = new AsyncLocalStorage<Context>();
  const router = createRouter({
    routesDir: validatedOptions.routesDir,
    watchMode: process.env.NODE_ENV === 'development',
  });
  // Create plugin lifecycle manager
  const pluginManager = createPluginLifecycleManager({
    debug: process.env.NODE_ENV === 'development',
    continueOnError: true,
  });
  const events = new EventEmitter();

  // Create server instance with minimal properties
  const serverInstance: Server = {
    server: null as any,
    port,
    host,
    context: contextStorage,
    events,
    plugins: [],
    middleware: [],
    _signalHandlers: { unregister: () => {} },
    use: () => serverInstance,
    register: async () => serverInstance,
    listen: async () => serverInstance,
    close: async () => {},
    router,
    pluginManager,
  };

  // Add methods to the server instance
  serverInstance.listen = createListenMethod(
    serverInstance,
    validatedOptions,
    initialMiddleware,
    initialPlugins
  );
  serverInstance.close = createCloseMethod(serverInstance);
  serverInstance.use = createUseMethod(serverInstance);
  serverInstance.register = createRegisterMethod(serverInstance);

  return serverInstance;
}
