/**
 * SSE Client Types for BlaizeJS
 * Location: packages/blaize-client/src/sse/types.ts
 */

import { BlaizeError } from './errors';

import type { SSEConnectionState } from './sse';

/**
 * Event handlers map
 */
export interface EventHandlers {
  [event: string]: Set<(data: any) => void>;
}

/**
 * SSE connection configuration options
 */
export interface SSEClientOptions {
  // Connection
  headers?: Record<string, string>; // Custom headers (if not using EventSource)
  withCredentials?: boolean; // Include cookies for CORS

  // Reconnection
  reconnect?: {
    enabled: boolean;
    maxAttempts?: number; // Default: 5
    strategy?: ReconnectStrategy; // Default: exponentialBackoff
    initialDelay?: number; // Delay before first reconnect (ms)
  };

  // Client-side buffering
  bufferMissedEvents?: boolean; // Store events during disconnect
  maxMissedEvents?: number; // Default: 100

  // Connection health
  heartbeatTimeout?: number; // Dead connection detection (ms)
  // Recommend: 2x server heartbeat interval

  // Data handling
  parseJSON?: boolean; // Auto-parse JSON data (default: true)

  /**
   * Whether to wait for connection before resolving the promise.
   * If false, returns the client immediately without waiting.
   * Default: true
   */
  waitForConnection?: boolean;

  /**
   * Optional timeout for initial connection in milliseconds.
   * If not set, no timeout is applied (relies on EventSource native timeout).
   * Only applies if waitForConnection is true.
   */
  connectionTimeout?: number;
}

/**
 * Metrics for SSE connection monitoring
 */
export interface SSEClientMetrics {
  eventsReceived: number;
  bytesReceived: number;
  connectionDuration: number;
  reconnectAttempts: number;
  lastEventId?: string;
}

/**
 * Reconnection delay calculation strategy
 */
export type ReconnectStrategy = (attempt: number) => number; // Returns delay in ms

/**
 * SSE Client interface with type-safe event handling
 */
export interface SSEClient<TEvents extends Record<string, unknown> = Record<string, unknown>> {
  // Event handling for typed events
  on<K extends keyof TEvents>(event: K & string, handler: (data: TEvents[K]) => void): void;

  // Special event handler overloads
  on(event: 'error', handler: (error: BlaizeError) => void): void;
  on(event: 'open', handler: () => void): void;
  on(event: 'close', handler: (event: CloseEvent) => void): void;

  // Event listener removal
  off<K extends keyof TEvents>(event: K & string, handler?: (data: TEvents[K]) => void): void;
  off(event: 'error', handler?: (error: BlaizeError) => void): void;
  off(event: 'open', handler?: () => void): void;
  off(event: 'close', handler?: (event: CloseEvent) => void): void;

  // One-time event listeners
  once<K extends keyof TEvents>(event: K & string, handler: (data: TEvents[K]) => void): void;
  once(event: 'error', handler: (error: BlaizeError) => void): void;
  once(event: 'open', handler: () => void): void;
  once(event: 'close', handler: (event: CloseEvent) => void): void;

  // Connection management
  close(): void;

  // State
  readonly state: SSEConnectionState;
  readonly metrics: SSEClientMetrics;
  readonly lastEventId?: string;
}

/**
 * Close event for SSE connections
 */
export interface CloseEvent {
  reconnect: boolean;
  reason?: string;
}

/**
 * Internal SSE connection factory
 * Returns a Promise that resolves to an SSEClient instance
 */
export type SSEConnectionFactory<
  TEvents extends Record<string, unknown> = Record<string, unknown>,
> = (options?: SSEClientOptions) => Promise<SSEClient<TEvents>>;
