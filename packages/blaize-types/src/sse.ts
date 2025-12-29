import { z } from 'zod';

/**
 * @module sse
 * @description Server-Sent Events (SSE) type definitions for BlaizeJS framework
 */

import type { QueryParams, Services, State } from './context';
import type { EventSchemas } from './events';
import type { SSEHandlerContext } from './handler-context';
import type { BlaizeLogger } from './logger';
import type { Middleware } from './middleware';
import type { Infer } from './router';

/**
 * Represents a single Server-Sent Event
 * @template T - The type of data payload
 *
 * @example
 * ```typescript
 * const event: SSEEvent<{ message: string }> = {
 *   id: '123',
 *   event: 'message',
 *   data: { message: 'Hello, world!' },
 *   retry: 5000
 * };
 * ```
 */
export interface SSEEvent<T = unknown> {
  /** Unique identifier for the event */
  id: string;

  /** Event type/name for client-side event listeners */
  event: string;

  /** The actual data payload of the event */
  data: T;

  /** Optional retry interval in milliseconds for reconnection */
  retry?: number;
}

/**
 * Backpressure handling strategies for SSE streams
 *
 * - `drop-oldest`: Remove oldest events from buffer when full
 * - `drop-newest`: Reject new events when buffer is full
 * - `close`: Close the stream when buffer limit is reached
 */
export type SSEBufferStrategy = 'drop-oldest' | 'drop-newest' | 'close';

/**
 * Configuration options for SSE streams
 *
 * @example
 * ```typescript
 * const options: SSEOptions = {
 *   autoClose: true,
 *   maxBufferSize: 100,
 *   bufferStrategy: 'drop-oldest'
 * };
 * ```
 */
export interface SSEOptions {
  /** ms between heartbeat pings (0 to disable) */
  heartbeatInterval?: number;

  /** Maximum size in bytes for a single event */
  maxEventSize?: number;

  /** Automatically close stream when client disconnects */
  autoClose?: boolean;

  /** Maximum number of events to buffer before applying strategy */
  maxBufferSize?: number;

  /** Strategy to handle buffer overflow conditions */
  bufferStrategy?: SSEBufferStrategy;
}

/**
 * Connection states for SSE streams
 */
export type SSEConnectionState =
  | 'connecting' // Initial connection being established
  | 'connected' // Active connection, ready to send events
  | 'disconnected' // Connection lost, may attempt reconnection
  | 'closed'; // Connection permanently closed

/**
 * SSE stream interface for managing server-sent events
 *
 * @example
 * ```typescript
 * const stream: SSEStream = createSSEStream(response);
 *
 * // Send typed event
 * stream.send('notification', { type: 'info', message: 'Update available' });
 *
 * // Send error event
 * stream.sendError(new Error('Processing failed'));
 *
 * // Clean up on close
 * stream.onClose(() => {
 *   console.log('Client disconnected');
 * });
 *
 * // Close stream
 * stream.close();
 * ```
 */
export interface SSEStream {
  /**
   * Send an event with typed data to the client
   * @template T - Type of the data payload
   * @param event - Event name/type
   * @param data - Event data payload
   */
  send<T>(event: string, data: T): void;

  /**
   * Send an error event to the client
   * @param error - Error object to send
   */
  sendError(error: Error): void;

  /**
   * Close the SSE stream connection
   */
  close(): void;

  /**
   * Register a callback for stream closure
   * @param cb - Callback function to execute on close
   */
  onClose(cb: () => void): void;
}

/**
 * Extended SSE stream with additional control methods
 */
export interface SSEStreamExtended extends SSEStream {
  readonly id: string;

  [Symbol.asyncIterator](): AsyncGenerator<BufferedEvent, void, unknown>;

  /** Current connection state */
  readonly state: SSEConnectionState;

  /** Number of events in the buffer */
  readonly bufferSize: number;

  /** Check if stream is writable */
  readonly isWritable: boolean;

  /**
   * Ping the client to keep connection alive
   * @param comment - Optional comment to include in ping
   */
  ping(comment?: string): void;

  /**
   * Set retry interval for client reconnection
   * @param milliseconds - Retry interval in milliseconds
   */
  setRetry(milliseconds: number): void;

  /**
   * Flush any buffered events immediately
   */
  flush(): void;

  getMetrics(): StreamMetrics;
}

/**
 * SSE event serialization format
 */
export interface SSESerializedEvent {
  /** Event ID field */
  id?: string;

  /** Event type field */
  event?: string;

  /** Data field (can be multi-line) */
  data: string;

  /** Retry field */
  retry?: number;

  /** Comment field for keep-alive */
  comment?: string;
}

/**
 * SSE event handler function type
 * @template T - Type of the event data
 */
export type SSEEventHandler<T = unknown> = (event: SSEEvent<T>) => void | Promise<void>;

/**
 * SSE event listener registration
 */
export interface SSEEventListener {
  /** Event type to listen for (use '*' for all events) */
  event: string;

  /** Handler function for the event */
  handler: SSEEventHandler;

  /** Optional listener identifier for removal */
  id?: string;
}

/**
 * SSE metrics for monitoring stream performance
 */
export interface SSEMetrics {
  /** Total number of events sent */
  eventsSent: number;

  /** Total number of events dropped */
  eventsDropped: number;

  /** Current number of connected clients */
  activeConnections: number;

  /** Total bytes sent */
  bytesSent: number;

  /** Average event send latency in milliseconds */
  averageLatency: number;

  /** Connection duration in milliseconds */
  connectionDuration: number;
}

/**
 * SSE stream manager for handling multiple clients
 */
export interface SSEStreamManager {
  /**
   * Create a new SSE stream for a client
   * @param clientId - Unique identifier for the client
   * @param options - Stream configuration options
   */
  createStream(clientId: string, options?: SSEOptions): SSEStream;

  /**
   * Get an existing stream by client ID
   * @param clientId - Client identifier
   */
  getStream(clientId: string): SSEStream | undefined;

  /**
   * Broadcast an event to all connected clients
   * @template T - Type of the event data
   * @param event - Event name
   * @param data - Event data
   */
  broadcast<T>(event: string, data: T): void;

  /**
   * Broadcast to specific clients
   * @template T - Type of the event data
   * @param clientIds - Array of client IDs
   * @param event - Event name
   * @param data - Event data
   */
  multicast<T>(clientIds: string[], event: string, data: T): void;

  /**
   * Close a specific client stream
   * @param clientId - Client identifier
   */
  closeStream(clientId: string): void;

  /**
   * Close all active streams
   */
  closeAll(): void;

  /**
   * Get metrics for all streams
   */
  getMetrics(): SSEMetrics;
}

/**
 * Result type for operations that can fail
 */
export type RegistryResult<T> = { success: true; value: T } | { success: false; error: string };

/**
 * Connection metadata stored in the registry
 */
export interface ConnectionEntry {
  stream: SSEStream;
  connectedAt: number;
  lastActivity: number;
  clientIp?: string;
  userAgent?: string;
}

/**
 * Configuration for the connection registry
 * @internal
 */
export interface RegistryConfig {
  /** Maximum total connections allowed */
  maxConnections?: number;
  /** Maximum connections per client IP */
  maxConnectionsPerClient?: number;

  /** Inactive connection timeout in milliseconds */
  inactiveTimeout?: number;
  /** Cleanup interval in milliseconds */
  cleanupInterval?: number;
}

/**
 * Internal connection registry interface
 */
export interface ConnectionRegistry {
  /** Add a new connection to the registry */
  add: (
    id: string,
    stream: SSEStream,
    metadata?: { clientIp?: string; userAgent?: string }
  ) => void;

  /** Remove a connection from the registry */
  remove: (id: string) => void;

  /** Get current connection count */
  count: () => number;

  /** Clean up inactive or closed connections */
  cleanup: () => void;

  /** Get connection by ID (for internal use) */
  get: (id: string) => SSEStream | undefined;

  /** Check if a connection exists */
  has: (id: string) => boolean;

  /** Get all connection IDs */
  getIds: () => string[];

  /** Shutdown the registry and close all connections */
  shutdown: () => void;
}

/**
 * Extended stream interface for typed events
 */
export interface TypedSSEStream<TEvents extends Record<string, z.ZodType>>
  extends SSEStreamExtended {
  send<K extends keyof TEvents>(event: K & string, data: z.infer<TEvents[K]>): void;
}

/**
 * Schema for SSE route validation with generic type parameters
 */
export interface SSERouteSchema<
  P extends z.ZodType = z.ZodType<any>,
  Q extends z.ZodType = z.ZodType<any>,
  E = any, // Allow any type for events, will be constrained where needed
> {
  /** Parameter schema for validation */
  params?: P;

  /** Query schema for validation */
  query?: Q;

  /** Events schema for validation (SSE-specific, replaces response) */
  events?: E;
}

/**
 * SSE route handler function with context object
 *
 * @template TStream - SSE stream type (TypedSSEStream or SSEStreamExtended)
 * @template TState - Application state type (accumulated from middleware)
 * @template TServices - Application services type (accumulated from middleware)
 * @template TQuery - Query parameters type (from schema validation)
 * @template TParams - URL parameters type (from schema validation)
 * @template TEvents - Event schemas for typed event bus
 *
 * @example
 * ```typescript
 * const handler: SSERouteHandler = async ({ stream, ctx, params, logger, eventBus }) => {
 *   logger.info('SSE connection established', { userId: params.userId });
 *
 *   eventBus.subscribe('user:*', (event) => {
 *     stream.send('user-event', event.data);
 *   });
 * };
 * ```
 */
export type SSERouteHandler<
  TStream extends SSEStreamExtended = SSEStreamExtended,
  TState extends State = State,
  TServices extends Services = Services,
  TQuery = QueryParams,
  TParams = Record<string, string>,
  TEvents extends EventSchemas = EventSchemas,
> = (
  hc: SSEHandlerContext<TStream, TState, TServices, TQuery, TParams, TEvents>
) => Promise<void> | void;

/**
 * SSE route creator with state and services support
 * Returns a higher-order function to handle generics properly
 *
 * The return type matches what the implementation actually returns:
 * - A route object with a GET property
 * - The GET property contains the wrapped handler and schemas
 * - The wrapped handler has the standard (ctx, params) signature expected by the router
 */
export type CreateSSERoute = <
  TState extends State = State,
  TServices extends Services = Services,
  TEvents extends EventSchemas = EventSchemas,
>() => <P = never, Q = never, E = never>(config: {
  schema?: {
    params?: P extends never ? never : P;
    query?: Q extends never ? never : Q;
    events?: E extends never ? never : E; // SSE-specific event schemas
  };
  handler: SSERouteHandler<
    E extends Record<string, z.ZodType> ? TypedSSEStream<E> : SSEStreamExtended,
    P extends z.ZodType ? Infer<P> : Record<string, string>,
    Q extends z.ZodType ? Infer<Q> : QueryParams,
    TState,
    TServices,
    TEvents
  >;
  middleware?: Middleware[];
  options?: Record<string, unknown>;
}) => {
  GET: {
    handler: (ctx: any, params: any, logger: BlaizeLogger) => Promise<void>; // Wrapped handler with standard signature
    schema?: {
      params?: P extends never ? undefined : P;
      query?: Q extends never ? undefined : Q;
    };
    middleware?: Middleware[];
    options?: Record<string, unknown>;
  };
  SSE: {
    schema: {
      params?: P extends never ? undefined : P;
      query?: Q extends never ? undefined : Q;
      events?: E extends never ? undefined : E;
    };
  };
  path: string;
};

/**
 * Buffered event with metadata
 */
export interface BufferedEvent {
  id: string;
  event: string;
  data: unknown;
  size: number;
  timestamp: number;
  correlationId: string;
}

/**
 * Stream metrics for monitoring
 */
export interface StreamMetrics {
  eventsSent: number;
  eventsDropped: number;
  bytesWritten: number;
  bufferHighWatermark: number;
  lastEventTime: number;
}
