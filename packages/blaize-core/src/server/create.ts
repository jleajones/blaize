/* eslint-disable @typescript-eslint/no-empty-object-type */
import { AsyncLocalStorage } from 'node:async_hooks';
import EventEmitter from 'node:events';

import { setRuntimeConfig } from '../config';
import { startServer } from './start';
import { registerSignalHandlers, stopServer } from './stop';
import { validateServerOptions } from './validation';
import { createPluginLifecycleManager } from '../plugins/lifecycle';
import { validatePlugin } from '../plugins/validation';
import { createRouter } from '../router/router';
import { _setCorrelationConfig } from '../tracing/correlation';

import type {
  ComposeMiddlewareStates,
  ComposeMiddlewareServices,
  ComposePluginStates,
  ComposePluginServices,
} from '@blaize-types/composition';
import type { Context } from '@blaize-types/context';
import type { Middleware } from '@blaize-types/middleware';
import type { Plugin } from '@blaize-types/plugins';
import type { Server, ServerOptions, ServerOptionsInput, StopOptions } from '@blaize-types/server';

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
    correlation: options.correlation,
  };
}

/**
 * Configures the correlation ID system based on server options
 *
 * @param options - The validated server options
 */
function configureCorrelation(options: ServerOptions): void {
  if (options.correlation) {
    // Apply correlation configuration if provided
    _setCorrelationConfig(options.correlation.headerName, options.correlation.generator);
  }
  // If no correlation options provided, the system uses defaults
}

/**
 * Creates the server listen method
 */
function createListenMethod(
  serverInstance: Server,
  validatedOptions: ServerOptions
): Server['listen'] {
  return async () => {
    // Configure correlation before starting the server
    configureCorrelation(validatedOptions);
    // Initialize middleware and plugins
    await initializePlugins(serverInstance);

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
 * Initializes plugins
 */
async function initializePlugins(serverInstance: Server): Promise<void> {
  // Register plugins from options
  for (const p of serverInstance.plugins) {
    await p.register(serverInstance);
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
 * This version properly handles type accumulation for both single and array middleware
 */
function createUseMethod<
  TState extends Record<string, unknown> = {},
  TServices extends Record<string, unknown> = {},
>(serverInstance: Server<TState, TServices>): Server<TState, TServices>['use'] {
  return ((middleware: Middleware | Middleware[]) => {
    const middlewareArray = Array.isArray(middleware) ? middleware : [middleware];
    serverInstance.middleware.push(...middlewareArray);
    // Return the server instance with accumulated types
    // TypeScript will infer the correct return type based on the overload
    return serverInstance;
  }) as Server<TState, TServices>['use'];
}

/**
 * Creates the server register method for plugins
 * This version properly handles type accumulation for both single and array plugins
 */
function createRegisterMethod<
  TState extends Record<string, unknown> = {},
  TServices extends Record<string, unknown> = {},
>(serverInstance: Server<TState, TServices>): Server<TState, TServices>['register'] {
  return (async (plugin: Plugin | Plugin[]) => {
    if (Array.isArray(plugin)) {
      // Handle array of plugins
      for (const p of plugin) {
        validatePlugin(p);
        serverInstance.plugins.push(p);
        await p.register(serverInstance);
      }
    } else {
      // Handle single plugin
      validatePlugin(plugin);
      serverInstance.plugins.push(plugin);
      await plugin.register(serverInstance);
    }
    // Return the server instance with accumulated types
    return serverInstance;
  }) as Server<TState, TServices>['register'];
}

/**
 * Creates a BlaizeJS server instance
 */
export function create<
  const TMw extends readonly Middleware<any, any>[] = [],
  const TP extends readonly Plugin<any, any>[] = [],
>(
  options: ServerOptionsInput & {
    middleware?: TMw;
    plugins?: TP;
  } = {}
): Server<
  ComposeMiddlewareStates<TMw> & ComposePluginStates<TP>,
  ComposeMiddlewareServices<TMw> & ComposePluginServices<TP>
> {
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

  // Type alias for the accumulated types
  type AccumulatedState = ComposeMiddlewareStates<TMw> & ComposePluginStates<TP>;
  type AccumulatedServices = ComposeMiddlewareServices<TMw> & ComposePluginServices<TP>;

  // Create server instance with minimal properties
  const serverInstance: Server<AccumulatedState, AccumulatedServices> = {
    server: null as any,
    port,
    host,
    context: contextStorage,
    events,
    plugins: [...initialPlugins],
    middleware: [...initialMiddleware],
    _signalHandlers: { unregister: () => {} },
    use: () => serverInstance,
    register: async () => serverInstance,
    listen: async () => serverInstance,
    close: async () => {},
    router,
    pluginManager,
  };

  // Add methods to the server instance
  serverInstance.listen = createListenMethod(serverInstance, validatedOptions);
  serverInstance.close = createCloseMethod(serverInstance);
  serverInstance.use = createUseMethod(serverInstance);
  serverInstance.register = createRegisterMethod(serverInstance);

  return serverInstance;
}
