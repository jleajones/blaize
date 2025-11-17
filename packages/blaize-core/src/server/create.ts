/* eslint-disable @typescript-eslint/no-empty-object-type */
import { AsyncLocalStorage } from 'node:async_hooks';
import EventEmitter from 'node:events';

import { setRuntimeConfig } from '../config';
import { startServer } from './start';
import { registerSignalHandlers, stopServer } from './stop';
import { validateServerOptions } from './validation';
import { configureGlobalLogger, createLogger } from '../logger';
import { createLoggerMiddleware } from '../middleware/logger/create';
import { requestLoggerMiddleware } from '../middleware/logger/request-logger';
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
import type { BlaizeLogger } from '@blaize-types/logger';
import type { Middleware } from '@blaize-types/middleware';
import type { Plugin } from '@blaize-types/plugins';
import type {
  Server,
  ServerOptions,
  ServerOptionsInput,
  StopOptions,
  UnknownServer,
} from '@blaize-types/server';

export const DEFAULT_OPTIONS: ServerOptions = {
  port: 3000,
  host: 'localhost',
  routesDir: './routes',
  http2: {
    enabled: true,
  },
  middleware: [],
  plugins: [],
  bodyLimits: {
    // 🆕 NEW
    json: 512 * 1024,
    form: 1024 * 1024,
    text: 5 * 1024 * 1024,
    raw: 10 * 1024 * 1024,
    multipart: {
      maxFileSize: 50 * 1024 * 1024,
      maxTotalSize: 100 * 1024 * 1024,
      maxFiles: 10,
      maxFieldSize: 1024 * 1024,
    },
  },
  logging: {
    requestLogging: true,
  },
};

/**
 * Creates the configuration options by merging defaults with user-provided options
 */
function createServerOptions(options: ServerOptionsInput = {}): ServerOptions {
  const mergedOptions: ServerOptions = {
    port: options.port ?? DEFAULT_OPTIONS.port,
    host: options.host ?? DEFAULT_OPTIONS.host,
    routesDir: options.routesDir ?? DEFAULT_OPTIONS.routesDir,
    http2: {
      enabled: options.http2?.enabled ?? DEFAULT_OPTIONS.http2!.enabled,
      keyFile: options.http2?.keyFile,
      certFile: options.http2?.certFile,
    },
    middleware: options.middleware ?? DEFAULT_OPTIONS.middleware,
    plugins: options.plugins ?? DEFAULT_OPTIONS.plugins,
    correlation: options.correlation,
    cors: options.cors,
    bodyLimits: options.bodyLimits
      ? {
          json: options.bodyLimits.json ?? DEFAULT_OPTIONS.bodyLimits.json,
          form: options.bodyLimits.form ?? DEFAULT_OPTIONS.bodyLimits.form,
          text: options.bodyLimits.text ?? DEFAULT_OPTIONS.bodyLimits.text,
          raw: options.bodyLimits.raw ?? DEFAULT_OPTIONS.bodyLimits.raw,
          multipart: {
            maxFileSize:
              options.bodyLimits.multipart?.maxFileSize ??
              DEFAULT_OPTIONS.bodyLimits.multipart.maxFileSize,
            maxTotalSize:
              options.bodyLimits.multipart?.maxTotalSize ??
              DEFAULT_OPTIONS.bodyLimits.multipart.maxTotalSize,
            maxFiles:
              options.bodyLimits.multipart?.maxFiles ??
              DEFAULT_OPTIONS.bodyLimits.multipart.maxFiles,
            maxFieldSize:
              options.bodyLimits.multipart?.maxFieldSize ??
              DEFAULT_OPTIONS.bodyLimits.multipart.maxFieldSize,
          },
        }
      : DEFAULT_OPTIONS.bodyLimits,
    logging: options.logging || DEFAULT_OPTIONS.logging,
  };
  try {
    const validated = validateServerOptions(mergedOptions);

    // Set runtime config after successful validation
    setRuntimeConfig({ routesDir: validated.routesDir });
    return validated;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to create server: ${error.message}`);
    }
    throw new Error(`Failed to create server: ${String(error)}`);
  }
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
  serverInstance: UnknownServer,
  validatedOptions: ServerOptions
): UnknownServer['listen'] {
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
async function initializePlugins(serverInstance: UnknownServer): Promise<void> {
  // Register plugins from options
  for (const p of serverInstance.plugins) {
    await p.register(serverInstance);
  }
}

/**
 * Sets up server lifecycle (signal handlers, events)
 */
function setupServerLifecycle(serverInstance: UnknownServer): void {
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
function createCloseMethod(serverInstance: UnknownServer): UnknownServer['close'] {
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
function createUseMethod<TState, TServices>(
  serverInstance: Server<TState, TServices>
): Server<TState, TServices>['use'] {
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
function createRegisterMethod<TState, TServices>(
  serverInstance: Server<TState, TServices>
): Server<TState, TServices>['register'] {
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
 * Initializes the logger system based on server options
 *
 * Creates root logger and request logger middleware if logging is configured.
 *
 * @param validatedOptions - The validated server options
 * @returns Object containing logger and middleware, or undefined if logging not configured
 */
function initializeLogger(validatedOptions: ServerOptions): {
  logger: BlaizeLogger;
  middleware: Middleware[];
} {
  const logConfig = validatedOptions.logging || {};

  // Extract request-specific config with server defaults
  // Server only defaults request-specific behavior
  const {
    requestLogging = true, // ✅ Server default (controls middleware behavior)
    requestLoggerOptions, // ✅ Can be undefined (middleware handles safe defaults)
    ...coreLoggerConfig // ✅ Pass to logger AS-IS (logger handles defaults)
  } = logConfig;

  // STEP 1: Configure global logger
  configureGlobalLogger(coreLoggerConfig);

  // STEP 2: Create server logger middleware
  const serverLogger = createLogger(coreLoggerConfig || {});

  // STEP 2: Create main logger middleware
  const loggerMiddleware = createLoggerMiddleware(serverLogger);

  // STEP 3: Create request logger middleware
  const httpRequestLoggerMiddleware = requestLoggerMiddleware(requestLoggerOptions, requestLogging);

  return {
    logger: serverLogger,
    middleware: [loggerMiddleware, httpRequestLoggerMiddleware],
  };
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
  ComposeMiddlewareServices<
    readonly [
      ReturnType<typeof createLoggerMiddleware>, // ← Prepended!
      ...TMw, // ← User middleware
    ]
  > &
    ComposePluginServices<TP>
> {
  // Create and validate options
  const validatedOptions = createServerOptions(options);

  // Extract options and prepare initial components
  const { port, host, middleware, plugins, cors, bodyLimits } = validatedOptions;
  const loggerSystem = initializeLogger(validatedOptions);

  // TODO: create registries to manage middleware and plugins
  const initialMiddleware = Array.isArray(middleware)
    ? [...loggerSystem.middleware, ...middleware]
    : [];
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
  type AccumulatedServices = ComposeMiddlewareServices<
    readonly [
      ReturnType<typeof createLoggerMiddleware>, // { log: BlaizeLogger }
      ...TMw, // User middleware services
    ]
  > &
    ComposePluginServices<TP>;

  // Create server instance with minimal properties
  const serverInstance: Server<AccumulatedState, AccumulatedServices> = {
    server: null as any,
    port,
    host,
    context: contextStorage,
    events,
    plugins: [...initialPlugins],
    middleware: [...initialMiddleware],
    corsOptions: cors,
    bodyLimits,
    _signalHandlers: { unregister: () => {} },
    _logger: loggerSystem.logger,
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
