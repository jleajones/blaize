/**
 * @module sse
 * @description Server-Sent Events (SSE) type definitions for BlaizeJS framework
 */

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
 * SSE client configuration for receiving events
 */
export interface SSEClientOptions {
  /** Reconnection timeout in milliseconds */
  reconnectTimeout?: number;

  /** Maximum number of reconnection attempts */
  maxReconnectAttempts?: number;

  /** Custom headers for the SSE request */
  headers?: Record<string, string>;

  /** Enable automatic reconnection */
  autoReconnect?: boolean;
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
 * SSE error codes for standardized error handling
 */
export enum SSEErrorCode {
  /** Connection failed to establish */
  CONNECTION_FAILED = 'SSE_CONNECTION_FAILED',

  /** Buffer overflow occurred */
  BUFFER_OVERFLOW = 'SSE_BUFFER_OVERFLOW',

  /** Stream is already closed */
  STREAM_CLOSED = 'SSE_STREAM_CLOSED',

  /** Invalid event data format */
  INVALID_DATA = 'SSE_INVALID_DATA',

  /** Client timeout */
  CLIENT_TIMEOUT = 'SSE_CLIENT_TIMEOUT',

  /** Server error */
  SERVER_ERROR = 'SSE_SERVER_ERROR',
}

/**
 * SSE-specific error class
 */
export class SSEError extends Error {
  constructor(
    public readonly code: SSEErrorCode,
    message: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'SSEError';
  }
}
