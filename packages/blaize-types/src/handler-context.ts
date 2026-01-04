/**
 * Handler Context Types
 *
 * Structured context objects for route handlers, middleware, and plugins.
 * These types replace positional parameters with named context objects,
 * improving type inference and developer experience.
 *
 * @module @blaizejs/types/handler-context
 * @since 0.4.0
 */

import type { Context, State, Services, QueryParams } from './context';
import type { EventSchemas, TypedEventBus } from './events';
import type { BlaizeLogger } from './logger';
import type { NextFunction } from './middleware';
import type { SSEStreamExtended } from './sse';

// ============================================================================
// Route Handler Context
// ============================================================================

/**
 * Context object for route handlers
 *
 * Provides structured access to request context, parameters, logging,
 * and event bus for standard HTTP route handlers.
 *
 * @template TState - Application state type (accumulated from middleware)
 * @template TServices - Application services type (accumulated from middleware)
 * @template TBody - Request body type (from schema validation)
 * @template TQuery - Query parameters type (from schema validation)
 * @template TParams - URL parameters type (from schema validation)
 * @template TEvents - Event schemas for typed event bus
 *
 * @example Basic usage with destructuring
 * ```typescript
 * export const GET = appRoute.get({
 *   handler: async ({ ctx, params, logger, eventBus }) => {
 *     logger.info('Processing request', { userId: params.userId });
 *
 *     await eventBus.publish('user:viewed', {
 *       userId: params.userId,
 *       timestamp: Date.now(),
 *     });
 *
 *     return { message: 'Success' };
 *   },
 * });
 * ```
 *
 * @example With typed state and services
 * ```typescript
 * interface AppState extends State {
 *   user: { id: string; role: string };
 * }
 *
 * interface AppServices extends Services {
 *   db: Database;
 *   cache: Cache;
 * }
 *
 * export const GET = appRoute.get<
 *   z.ZodObject<{ userId: z.ZodString }>,
 *   never,
 *   never,
 *   z.ZodObject<{ message: z.ZodString }>
 * >({
 *   schema: {
 *     params: z.object({ userId: z.string() }),
 *     response: z.object({ message: z.string() }),
 *   },
 *   handler: async ({ ctx, params, logger, eventBus }: HandlerContext<AppState, AppServices>) => {
 *     // ctx.state.user is typed
 *     // ctx.services.db is typed
 *     // params.userId is string
 *
 *     const user = await ctx.services.db.users.findById(params.userId);
 *
 *     logger.info('User retrieved', {
 *       userId: params.userId,
 *       requestedBy: ctx.state.user.id
 *     });
 *
 *     return { message: `Hello, ${user.name}` };
 *   },
 * });
 * ```
 *
 * @example Partial destructuring
 * ```typescript
 * export const POST = appRoute.post({
 *   handler: async ({ ctx, logger }) => {
 *     // Only destructure what you need
 *     logger.info('Creating resource', {
 *       body: ctx.body,
 *       correlationId: ctx.correlationId
 *     });
 *
 *     return { id: 'new-resource-id' };
 *   },
 * });
 * ```
 *
 * @example Accessing request/response directly
 * ```typescript
 * export const GET = appRoute.get({
 *   handler: async ({ ctx, logger }) => {
 *     const userAgent = ctx.request.headers.get('user-agent');
 *     const acceptLanguage = ctx.request.headers.get('accept-language');
 *
 *     logger.debug('Request headers', { userAgent, acceptLanguage });
 *
 *     // Set custom response headers
 *     ctx.response.headers.set('X-Custom-Header', 'value');
 *
 *     return { message: 'Headers processed' };
 *   },
 * });
 * ```
 */
export interface HandlerContext<
  TState extends State = State,
  TServices extends Services = Services,
  TBody = unknown,
  TQuery = QueryParams,
  TParams = Record<string, string>,
  TEvents extends EventSchemas = EventSchemas,
> {
  /**
   * The Blaize context object
   *
   * Contains request, response, state, services, and correlation ID.
   * State and services are accumulated from middleware execution.
   */
  ctx: Context<TState, TServices, TBody, TQuery>;

  /**
   * URL parameters extracted from the route path
   *
   * Type is inferred from route schema if provided,
   * otherwise defaults to Record<string, string>.
   *
   * @example
   * ```typescript
   * // Route: /users/:userId/posts/:postId
   * // params = { userId: '123', postId: '456' }
   * ```
   */
  params: TParams;

  /**
   * Logger instance with automatic request context
   *
   * Pre-configured with correlation ID and request metadata.
   * Create child loggers for component-specific logging.
   */
  logger: BlaizeLogger;

  /**
   * Typed event bus for publishing and subscribing to events
   *
   * Type-safe event publishing based on event schemas.
   * Supports both local and distributed event handling.
   */
  eventBus: TypedEventBus<TEvents>;
}

// ============================================================================
// SSE Handler Context
// ============================================================================

/**
 * Context object for Server-Sent Events (SSE) handlers
 *
 * Provides structured access to SSE stream, request context, parameters,
 * logging, and event bus for SSE route handlers.
 *
 * Note: SSE handlers never have a request body, so ctx.body is typed as never.
 *
 * @template TStream - SSE stream type (TypedSSEStream or SSEStreamExtended)
 * @template TState - Application state type (accumulated from middleware)
 * @template TServices - Application services type (accumulated from middleware)
 * @template TQuery - Query parameters type (from schema validation)
 * @template TParams - URL parameters type (from schema validation)
 * @template TEvents - Event schemas for typed event bus
 *
 * @example Basic SSE handler with destructuring
 * ```typescript
 * export const GET = createSSERoute()({
 *   handler: async ({ stream, ctx, params, logger, eventBus }) => {
 *     logger.info('SSE connection established', {
 *       streamId: stream.id,
 *       userId: params.userId
 *     });
 *
 *     // Send initial event
 *     stream.send('connected', {
 *       userId: params.userId,
 *       timestamp: Date.now()
 *     });
 *
 *     // Subscribe to events and forward to stream
 *     await eventBus.subscribe('user:*', (event) => {
 *       stream.send('user-event', event.data);
 *     });
 *
 *     // Handle cleanup on close
 *     stream.onClose(() => {
 *       logger.info('SSE connection closed', { streamId: stream.id });
 *     });
 *   },
 * });
 * ```
 *
 * @example With typed event schemas
 * ```typescript
 * const eventSchemas = {
 *   'notification': z.object({
 *     message: z.string(),
 *     severity: z.enum(['info', 'warning', 'error']),
 *   }),
 *   'status': z.object({
 *     online: z.boolean(),
 *     lastSeen: z.number(),
 *   }),
 * };
 *
 * export const GET = createSSERoute()({
 *   schema: {
 *     events: eventSchemas,
 *   },
 *   handler: async ({ stream, logger, eventBus }: SSEHandlerContext) => {
 *     // stream.send is now type-safe based on event schemas
 *     stream.send('notification', {
 *       message: 'Welcome!',
 *       severity: 'info',
 *     });
 *
 *     stream.send('status', {
 *       online: true,
 *       lastSeen: Date.now(),
 *     });
 *   },
 * });
 * ```
 *
 * @example Heartbeat with stream control
 * ```typescript
 * export const GET = createSSERoute()({
 *   handler: async ({ stream, logger }) => {
 *     // Set retry interval for client reconnection
 *     stream.setRetry(3000);
 *
 *     // Send periodic heartbeats
 *     const heartbeat = setInterval(() => {
 *       if (stream.isWritable) {
 *         stream.ping('heartbeat');
 *       }
 *     }, 30000);
 *
 *     stream.onClose(() => {
 *       clearInterval(heartbeat);
 *       logger.info('Heartbeat stopped');
 *     });
 *   },
 * });
 * ```
 *
 * @example Query parameter validation
 * ```typescript
 * export const GET = createSSERoute()({
 *   schema: {
 *     query: z.object({
 *       channel: z.string(),
 *       filter: z.string().optional(),
 *     }),
 *   },
 *   handler: async ({ stream, ctx, logger }) => {
 *     // ctx.query is typed from schema
 *     const { channel, filter } = ctx.query;
 *
 *     logger.info('SSE channel subscription', { channel, filter });
 *
 *     // ctx.body is never (SSE has no request body)
 *     // @ts-expect-error - ctx.body is never for SSE
 *     const body = ctx.body;
 *   },
 * });
 * ```
 */
export interface SSEHandlerContext<
  TStream extends SSEStreamExtended = SSEStreamExtended,
  TState extends State = State,
  TServices extends Services = Services,
  TQuery = QueryParams,
  TParams = Record<string, string>,
  TEvents extends EventSchemas = EventSchemas,
> {
  /**
   * SSE stream for sending events to the client
   *
   * Provides methods to send events, handle errors, manage connection,
   * and control client reconnection behavior.
   */
  stream: TStream;

  /**
   * The Blaize context object (without body)
   *
   * Note: SSE handlers never have a request body.
   * ctx.body is typed as never to prevent accidental usage.
   */
  ctx: Context<TState, TServices, never, TQuery>;

  /**
   * URL parameters extracted from the route path
   *
   * Type is inferred from route schema if provided,
   * otherwise defaults to Record<string, string>.
   */
  params: TParams;

  /**
   * Logger instance with automatic request context
   *
   * Pre-configured with correlation ID and stream ID.
   * Useful for tracking SSE connection lifecycle.
   */
  logger: BlaizeLogger;

  /**
   * Typed event bus for publishing and subscribing to events
   *
   * Commonly used to subscribe to application events and
   * forward them to the SSE stream.
   */
  eventBus: TypedEventBus<TEvents>;
}

// ============================================================================
// Middleware Context
// ============================================================================

/**
 * Context object for middleware functions
 *
 * Provides structured access to request context, next function,
 * logging, and event bus for middleware execution.
 *
 * @template TState - Application state type (accumulated from previous middleware)
 * @template TServices - Application services type (accumulated from previous middleware)
 * @template TEvents - Event schemas for typed event bus
 *
 * @example Basic authentication middleware
 * ```typescript
 * export const authMiddleware: MiddlewareFunction = async ({
 *   ctx,
 *   next,
 *   logger,
 *   eventBus
 * }: MiddlewareContext) => {
 *   const token = ctx.request.headers.get('authorization');
 *
 *   if (!token) {
 *     logger.warn('Missing authentication token');
 *     throw new UnauthorizedError('Authentication required');
 *   }
 *
 *   const user = await verifyToken(token);
 *
 *   // Add user to context state
 *   ctx.state.user = user;
 *
 *   logger.info('User authenticated', { userId: user.id });
 *
 *   await eventBus.publish('user:authenticated', {
 *     userId: user.id,
 *     timestamp: Date.now(),
 *   });
 *
 *   await next();
 * };
 * ```
 *
 * @example Database connection middleware
 * ```typescript
 * export const dbMiddleware: MiddlewareFunction = async ({
 *   ctx,
 *   next,
 *   logger
 * }: MiddlewareContext) => {
 *   const db = await createDatabaseConnection();
 *
 *   // Add database to context services
 *   ctx.services.db = db;
 *
 *   logger.debug('Database connection established');
 *
 *   try {
 *     await next();
 *   } finally {
 *     await db.close();
 *     logger.debug('Database connection closed');
 *   }
 * };
 * ```
 *
 * @example Request timing middleware
 * ```typescript
 * export const timingMiddleware: MiddlewareFunction = async ({
 *   ctx,
 *   next,
 *   logger
 * }: MiddlewareContext) => {
 *   const startTime = Date.now();
 *
 *   try {
 *     await next();
 *   } finally {
 *     const duration = Date.now() - startTime;
 *
 *     logger.info('Request completed', {
 *       method: ctx.request.method,
 *       path: ctx.request.url.pathname,
 *       duration,
 *       status: ctx.response.status,
 *     });
 *   }
 * };
 * ```
 *
 * @example Conditional middleware execution
 * ```typescript
 * export const cacheMiddleware: MiddlewareFunction = async ({
 *   ctx,
 *   next,
 *   logger
 * }: MiddlewareContext) => {
 *   // Skip caching for non-GET requests
 *   if (ctx.request.method !== 'GET') {
 *     return next();
 *   }
 *
 *   const cacheKey = ctx.request.url.pathname;
 *   const cached = await cache.get(cacheKey);
 *
 *   if (cached) {
 *     logger.debug('Cache hit', { cacheKey });
 *     ctx.response = cached;
 *     return; // Don't call next()
 *   }
 *
 *   logger.debug('Cache miss', { cacheKey });
 *   await next();
 *
 *   // Cache successful responses
 *   if (ctx.response.status === 200) {
 *     await cache.set(cacheKey, ctx.response);
 *   }
 * };
 * ```
 */
export interface MiddlewareContext<TEvents extends EventSchemas = EventSchemas> {
  /**
   * The Blaize context object
   *
   * Middleware can read and modify ctx.state and ctx.services
   * to pass data to subsequent middleware and route handlers.
   */
  ctx: Context;

  /**
   * Function to invoke the next middleware in the chain
   *
   * Must be called to continue execution to the route handler.
   * Omitting next() will short-circuit the middleware chain.
   */
  next: NextFunction;

  /**
   * Logger instance with automatic request context
   *
   * Pre-configured with correlation ID and request metadata.
   */
  logger: BlaizeLogger;

  /**
   * Typed event bus for publishing and subscribing to events
   *
   * Useful for emitting middleware lifecycle events or
   * application-level events during request processing.
   */
  eventBus: TypedEventBus<TEvents>;
}

// ============================================================================
// Plugin Setup Context
// ============================================================================

/**
 * Context object for plugin setup functions
 *
 * Provides structured access to plugin configuration, logging,
 * and event bus during plugin initialization.
 *
 * @template TConfig - Plugin configuration type
 * @template TEvents - Event schemas for typed event bus
 *
 * @example Basic plugin with setup context
 * ```typescript
 * export const createCachePlugin = (userConfig?: Partial<CacheConfig>) => {
 *   return createPlugin<CacheConfig>({
 *     name: 'cache',
 *     version: '1.0.0',
 *
 *     setup: async ({ config, logger, eventBus }: PluginSetupContext<CacheConfig>) => {
 *       logger.info('Cache plugin initializing', {
 *         provider: config.provider,
 *         ttl: config.defaultTtl
 *       });
 *
 *       const cache = await createCacheClient(config);
 *
 *       await eventBus.publish('plugin:cache:initialized', {
 *         provider: config.provider,
 *         timestamp: Date.now(),
 *       });
 *
 *       return {
 *         initialize: async () => {
 *           await cache.connect();
 *           logger.info('Cache connected');
 *         },
 *
 *         terminate: async () => {
 *           await cache.disconnect();
 *           logger.info('Cache disconnected');
 *         },
 *       };
 *     },
 *
 *     config: {
 *       ...DEFAULT_CONFIG,
 *       ...userConfig,
 *     },
 *   });
 * };
 * ```
 *
 * @example Plugin with event subscriptions
 * ```typescript
 * export const createNotificationPlugin = () => {
 *   return createPlugin({
 *     name: 'notifications',
 *     version: '1.0.0',
 *
 *     setup: async ({ config, logger, eventBus }: PluginSetupContext<NotificationConfig>) => {
 *       logger.info('Notification plugin setting up');
 *
 *       // Subscribe to application events during setup
 *       await eventBus.subscribe('user:*', async (event) => {
 *         logger.debug('User event received', { type: event.type });
 *         await sendNotification(event.data);
 *       });
 *
 *       return {
 *         initialize: async () => {
 *           logger.info('Notification plugin ready');
 *         },
 *       };
 *     },
 *   });
 * };
 * ```
 *
 * @example Plugin with configuration validation
 * ```typescript
 * export const createMetricsPlugin = (userConfig: Partial<MetricsConfig>) => {
 *   return createPlugin<MetricsConfig>({
 *     name: 'metrics',
 *     version: '1.0.0',
 *
 *     setup: async ({ config, logger, eventBus }: PluginSetupContext<MetricsConfig>) => {
 *       // Validate configuration
 *       if (!config.endpoint) {
 *         logger.error('Metrics endpoint not configured');
 *         throw new Error('Metrics endpoint is required');
 *       }
 *
 *       logger.info('Metrics plugin configured', {
 *         endpoint: config.endpoint,
 *         interval: config.flushInterval,
 *       });
 *
 *       const metrics = createMetricsCollector(config);
 *
 *       // Publish metrics periodically
 *       const interval = setInterval(async () => {
 *         const data = await metrics.collect();
 *         await eventBus.publish('metrics:collected', data);
 *       }, config.flushInterval);
 *
 *       return {
 *         terminate: async () => {
 *           clearInterval(interval);
 *           await metrics.flush();
 *           logger.info('Metrics plugin terminated');
 *         },
 *       };
 *     },
 *
 *     config: {
 *       ...DEFAULT_METRICS_CONFIG,
 *       ...userConfig,
 *     },
 *   });
 * };
 * ```
 *
 * @example Plugin providing middleware
 * ```typescript
 * export const createAuthPlugin = (config: AuthConfig) => {
 *   return createPlugin({
 *     name: 'auth',
 *     version: '1.0.0',
 *
 *     setup: async ({ config, logger, eventBus }: PluginSetupContext<AuthConfig>) => {
 *       logger.info('Auth plugin setting up');
 *
 *       const authProvider = createAuthProvider(config);
 *
 *       return {
 *         initialize: async () => {
 *           await authProvider.initialize();
 *           logger.info('Auth provider initialized');
 *         },
 *
 *         // Provide middleware to the server
 *         middleware: [
 *           {
 *             name: 'auth',
 *             handler: async ({ ctx, next, logger }: MiddlewareContext) => {
 *               const user = await authProvider.authenticate(ctx.request);
 *               ctx.state.user = user;
 *
 *               await eventBus.publish('user:authenticated', {
 *                 userId: user.id,
 *               });
 *
 *               await next();
 *             },
 *           },
 *         ],
 *       };
 *     },
 *
 *     config,
 *   });
 * };
 * ```
 */
export interface PluginSetupContext<TConfig = unknown> {
  /**
   * Plugin configuration object
   *
   * Merged from plugin defaults and user-provided configuration.
   * Type is defined by the plugin's TConfig generic parameter.
   */
  config: TConfig;

  /**
   * Logger instance for the plugin
   *
   * Pre-configured with plugin name for easy identification
   * of log messages from this plugin.
   */
  logger: BlaizeLogger;

  /**
   * Typed event bus for publishing and subscribing to events
   *
   * Plugins can use the event bus to:
   * - Publish plugin lifecycle events
   * - Subscribe to application events
   * - Enable inter-plugin communication
   */
  eventBus: TypedEventBus<EventSchemas>;
}
