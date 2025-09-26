/**
 * SSE Client Implementation - Browser Compatible
 * Location: packages/blaize-client/src/sse/sse-client.ts
 *
 * Changes for browser compatibility:
 * - Fixed NodeJS.Timeout to use portable type
 * - Ensure all APIs work in both Node and browser
 */

import { generateClientCorrelationId } from './error-transformer';
import { SSEConnectionError, SSEStreamError, SSEHeartbeatError } from './errors/sse-errors';

import type {
  SSEClient,
  SSEClientOptions,
  SSEConnectionState,
  SSEClientMetrics,
  CloseEvent,
  SSEConnectionErrorContext,
  SSEStreamErrorContext,
  SSEHeartbeatErrorContext,
  EventHandlers,
  ReconnectStrategy,
} from '@blaize-types/index';

/**
 * Factory for creating EventSource instances - allows for testing
 */
export interface EventSourceFactory {
  create(url: string, options?: EventSourceInit): EventSource;
}

/**
 * Default EventSource factory using the native browser API
 */
export const defaultEventSourceFactory: EventSourceFactory = {
  create(url: string, options?: EventSourceInit): EventSource {
    return new EventSource(url, options);
  },
};

/**
 * Internal SSE client implementation
 */
class SSEClientImpl<TEvents extends Record<string, unknown> = Record<string, unknown>>
  implements SSEClient<TEvents>
{
  private eventSource: EventSource | null = null;
  private handlers: EventHandlers = {};
  private _state: SSEConnectionState = 'connecting';
  private _lastEventId?: string;
  // FIXED: Use portable type instead of NodeJS.Timeout
  private heartbeatTimer?: ReturnType<typeof setTimeout>;
  private connectionStartTime: number = Date.now();
  private correlationId: string;
  private reconnectAttempts: number = 0;
  private lastEventTime: number = Date.now();
  private eventSourceFactory: EventSourceFactory;
  private connectionHandled: boolean = false;
  private customEventHandlers: Map<string, EventListener> = new Map();

  public readonly metrics: SSEClientMetrics = {
    eventsReceived: 0,
    bytesReceived: 0,
    connectionDuration: 0,
    reconnectAttempts: 0,
  };

  constructor(
    private readonly url: string,
    private readonly options: SSEClientOptions = {},
    factory?: EventSourceFactory
  ) {
    // Generate correlation ID for this SSE connection
    this.correlationId = generateClientCorrelationId();
    this.eventSourceFactory = factory || defaultEventSourceFactory;
  }

  /**
   * Initialize the EventSource connection
   * Returns a promise that resolves when connected or rejects on error
   */
  public async connect(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      try {
        const connectionUrl = this.buildConnectionUrl();

        this.eventSource = this.eventSourceFactory.create(connectionUrl, {
          withCredentials: this.options.withCredentials || false,
        });

        // Reset connection handled flag
        this.connectionHandled = false;

        // Set up one-time handlers for connection result
        const handleOpen = () => {
          if (this.connectionHandled) return;
          this.connectionHandled = true;

          this._state = 'connected';
          this.connectionStartTime = Date.now();
          this.reconnectAttempts = 0;

          // Clean up temporary handlers FIRST
          this.eventSource!.removeEventListener('open', handleOpen);
          this.eventSource!.removeEventListener('error', handleInitialError);

          // THEN set up permanent handlers
          this.setupPermanentEventHandlers();

          // Reset/start heartbeat
          this.resetHeartbeatTimer();

          // Emit open event to any registered handlers
          this.emit('open', undefined);
          resolve();
        };

        const handleInitialError = () => {
          if (this.connectionHandled) return;
          this.connectionHandled = true;

          const context: SSEConnectionErrorContext = {
            url: this.url,
            correlationId: this.correlationId,
            state: 'connecting',
            reconnectAttempts: 0,
            originalError: new Error('Failed to establish initial connection'),
          };

          // Clean up
          this.eventSource!.removeEventListener('open', handleOpen);
          this.eventSource!.removeEventListener('error', handleInitialError);
          this._state = 'disconnected';

          const error = new SSEConnectionError('SSE connection error', context);
          this.emitError(error);
          reject(error);
        };

        // Add temporary event listeners for connection
        this.eventSource.addEventListener('open', handleOpen);
        this.eventSource.addEventListener('error', handleInitialError);

        // Start heartbeat monitoring (if configured)
        if (this.options.heartbeatTimeout) {
          this.startHeartbeatTimer();
        }
      } catch (error) {
        this._state = 'disconnected';
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const context: SSEConnectionErrorContext = {
          url: this.url,
          correlationId: this.correlationId,
          state: 'connecting',
          reconnectAttempts: this.reconnectAttempts,
          originalError: error as Error,
        };
        // Use a consistent error message for URL errors
        const sseError = new SSEConnectionError(
          errorMessage.includes('Invalid URL') ? 'Invalid SSE URL' : 'Failed to create EventSource',
          context
        );
        this.emitError(sseError);
        reject(sseError);
      }
    });
  }

  /**
   * Build connection URL with potential Last-Event-ID and correlation ID
   */
  private buildConnectionUrl(): string {
    // Handle both absolute and relative URLs
    let url: URL;
    try {
      // Try as absolute URL first
      url = new URL(this.url);
    } catch {
      // If that fails, treat as relative URL with a base
      // In browser, use window.location.origin; in tests, use a dummy base
      const base =
        typeof window !== 'undefined' && window.location
          ? window.location.origin
          : 'http://localhost';
      url = new URL(this.url, base);
    }

    if (this._lastEventId) {
      url.searchParams.set('lastEventId', this._lastEventId);
    }

    url.searchParams.set('x-correlation-id', this.correlationId);

    return url.toString();
  }

  /**
   * Setup permanent EventSource event handlers (after initial connection)
   */
  private setupPermanentEventHandlers(): void {
    if (!this.eventSource) return;

    // Permanent error handler (for post-connection errors)
    this.eventSource.onerror = _event => {
      if (this._state === 'connected') {
        if (this.eventSource?.readyState === EventSource.CLOSED) {
          this._state = 'closed';
          this.handleConnectionClosed('Connection closed by server');
        } else {
          this._state = 'disconnected';
          this.reconnectAttempts++;
          this.metrics.reconnectAttempts = this.reconnectAttempts;

          const context: SSEConnectionErrorContext = {
            url: this.url,
            correlationId: this.correlationId,
            state: 'disconnected',
            reconnectAttempts: this.reconnectAttempts,
            originalError: new Error('SSE connection lost'),
          };

          this.emitError(new SSEConnectionError('SSE connection error - reconnecting', context));

          // TRIGGER RECONNECTION HERE
          this.attemptReconnect();
        }
      }
    };

    // Generic message handler
    this.eventSource.onmessage = event => {
      this.handleMessage(event);
    };

    // Listen for named events
    this.setupNamedEventListeners();
  }

  /**
   * Setup listeners for specific named events
   */
  private setupNamedEventListeners(): void {
    if (!this.eventSource) return;

    const errorHandler = (event: Event) => {
      if ('data' in event) {
        this.handleServerError(event as MessageEvent);
      }
    };

    const closeHandler = (event: Event) => {
      if ('data' in event) {
        this.handleCloseEvent(event as MessageEvent);
      }
    };

    // Note: 'error' listener here is for server-sent error events, not connection errors
    this.eventSource.addEventListener('error', errorHandler);
    this.eventSource.addEventListener('close', closeHandler);
  }

  /**
   * Handle incoming message
   */
  private handleMessage(event: MessageEvent): void {
    this.metrics.eventsReceived++;
    this.metrics.bytesReceived += new Blob([event.data]).size;

    if (event.lastEventId) {
      this._lastEventId = event.lastEventId;
      this.metrics.lastEventId = event.lastEventId;
    }

    this.lastEventTime = Date.now();
    this.resetHeartbeatTimer();

    const data = this.parseEventData(event.data);

    if (event.type === 'message') {
      this.emit('message', data);
    }
  }

  /**
   * Handle server error events
   */
  private handleServerError(event: MessageEvent): void {
    const errorData = this.parseEventData(event.data);

    const errorCorrelationId = errorData.correlationId || this.correlationId;

    const context: SSEStreamErrorContext = {
      url: this.url,
      correlationId: errorCorrelationId,
      message: errorData.message || 'Server error',
      code: errorData.code,
      name: errorData.name,
      rawData: errorData,
    };

    this.emitError(
      new SSEStreamError(errorData.message || 'Server error', context, errorCorrelationId)
    );
  }

  /**
   * Handle close event (terminal)
   */
  private handleCloseEvent(event: MessageEvent): void {
    const data = this.parseEventData(event.data);

    if (data && typeof data === 'object' && 'reconnect' in data) {
      const closeEvent: CloseEvent = {
        reconnect: Boolean(data.reconnect),
        reason: data.reason as string | undefined,
      };

      if (!closeEvent.reconnect) {
        this.close();
      }

      this.emit('close', closeEvent);
    }
  }

  /**
   * Parse event data (auto-parse JSON by default)
   */
  private parseEventData(data: string): any {
    if (this.options.parseJSON === false) {
      return data;
    }

    try {
      return JSON.parse(data);
    } catch {
      return data;
    }
  }

  /**
   * Start or reset heartbeat timer
   */
  private startHeartbeatTimer(): void {
    if (!this.options.heartbeatTimeout) return;
    this.resetHeartbeatTimer();
  }

  /**
   * Reset heartbeat timer
   */
  private resetHeartbeatTimer(): void {
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
    }

    if (this.options.heartbeatTimeout && this._state === 'connected') {
      this.heartbeatTimer = setTimeout(() => {
        this.handleHeartbeatTimeout();
      }, this.options.heartbeatTimeout);
    }
  }

  /**
   * Handle heartbeat timeout
   */
  private handleHeartbeatTimeout(): void {
    this._state = 'disconnected';

    const timeSinceLastEvent = Date.now() - this.lastEventTime;
    const context: SSEHeartbeatErrorContext = {
      url: this.url,
      correlationId: this.correlationId,
      heartbeatTimeout: this.options.heartbeatTimeout!,
      timeSinceLastEvent,
      lastEventId: this._lastEventId,
    };

    this.emitError(
      new SSEHeartbeatError('SSE heartbeat timeout - connection may be dead', context)
    );

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  /**
   * Handle connection closed
   */
  private handleConnectionClosed(reason: string): void {
    this.clearHeartbeatTimer();
    this.emit('close', { reconnect: false, reason });
  }

  /**
   * Clear heartbeat timer
   */
  private clearHeartbeatTimer(): void {
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  /**
   * Emit an event to handlers
   */
  private emit(event: string, data: any): void {
    const eventHandlers = this.handlers[event];
    if (eventHandlers) {
      eventHandlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in SSE event handler for '${event}':`, error);
        }
      });
    }
  }

  /**
   * Emit an error event
   */
  private emitError(error: SSEConnectionError | SSEStreamError | SSEHeartbeatError): void {
    this.emit('error', error);
  }

  /**
   * Attempt to reconnect using configured strategy
   */
  private async attemptReconnect(): Promise<void> {
    if (!this.options.reconnect?.enabled) return;

    const maxAttempts = this.options.reconnect?.maxAttempts ?? 5;
    if (this.reconnectAttempts >= maxAttempts) {
      this.close();
      const context: SSEConnectionErrorContext = {
        url: this.url,
        correlationId: this.correlationId,
        state: 'disconnected',
        reconnectAttempts: this.reconnectAttempts,
        originalError: new Error('Max reconnection attempts exceeded'),
      };
      this.emitError(new SSEConnectionError('Max reconnection attempts exceeded', context));
      return;
    }

    // Calculate delay using strategy
    const delay = this.calculateReconnectDelay();

    console.log(
      `[SSE] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1}/${maxAttempts})`
    );

    setTimeout(async () => {
      if (this._state === 'closed') return; // Don't reconnect if explicitly closed

      try {
        this._state = 'connecting';
        await this.connect();
        console.log('[SSE] Reconnection successful');
      } catch (error) {
        console.error('[SSE] Reconnection failed:', error);
        // connect() will handle further attempts
        this.attemptReconnect();
      }
    }, delay);
  }

  /**
   * Calculate reconnect delay based on strategy
   */
  private calculateReconnectDelay(): number {
    const strategy = this.options.reconnect?.strategy || this.defaultReconnectStrategy;
    return strategy(this.reconnectAttempts);
  }

  /**
   * Default exponential backoff strategy
   */
  private defaultReconnectStrategy: ReconnectStrategy = (attempt: number) => {
    const initialDelay = this.options.reconnect?.initialDelay || 1000;
    const maxDelay = 30000; // 30 seconds max
    const delay = Math.min(initialDelay * Math.pow(2, attempt), maxDelay);
    // Add jitter to avoid thundering herd
    return delay + Math.random() * 1000;
  };

  // Public API methods continue unchanged...
  // [Rest of the implementation remains the same]

  on<K extends keyof TEvents>(event: K & string, handler: (data: TEvents[K]) => void): void;
  on(
    event: 'error',
    handler: (error: SSEConnectionError | SSEStreamError | SSEHeartbeatError) => void
  ): void;
  on(event: 'open', handler: () => void): void;
  on(event: 'close', handler: (event: CloseEvent) => void): void;
  on(event: string, handler: (data: any) => void): void {
    if (!this.handlers[event]) {
      this.handlers[event] = new Set();

      // Add EventSource listener for custom events (not built-in events)
      if (
        this.eventSource &&
        event !== 'error' &&
        event !== 'open' &&
        event !== 'close' &&
        event !== 'message'
      ) {
        const eventHandler = (e: Event) => {
          if ('data' in e) {
            const messageEvent = e as MessageEvent;
            this.metrics.eventsReceived++;
            this.metrics.bytesReceived += new Blob([messageEvent.data]).size;

            if (messageEvent.lastEventId) {
              this._lastEventId = messageEvent.lastEventId;
              this.metrics.lastEventId = messageEvent.lastEventId;
            }

            this.resetHeartbeatTimer();

            const data = this.parseEventData(messageEvent.data);
            this.emit(event, data);
          }
        };

        // Store the handler so we can remove it later
        this.customEventHandlers.set(event, eventHandler);
        this.eventSource.addEventListener(event, eventHandler);
      }
    }

    this.handlers[event].add(handler);
  }

  off<K extends keyof TEvents>(event: K & string, handler?: (data: TEvents[K]) => void): void;
  off(
    event: 'error',
    handler?: (error: SSEConnectionError | SSEStreamError | SSEHeartbeatError) => void
  ): void;
  off(event: 'open', handler?: () => void): void;
  off(event: 'close', handler?: (event: CloseEvent) => void): void;
  off(event: string, handler?: (data: any) => void): void {
    if (!this.handlers[event]) return;

    if (handler) {
      this.handlers[event].delete(handler);
    } else {
      this.handlers[event].clear();
    }

    if (this.handlers[event].size === 0) {
      delete this.handlers[event];

      // Remove EventSource listener if this was a custom event
      if (this.eventSource && this.customEventHandlers.has(event)) {
        const eventHandler = this.customEventHandlers.get(event)!;
        this.eventSource.removeEventListener(event, eventHandler);
        this.customEventHandlers.delete(event);
      }
    }
  }

  once<K extends keyof TEvents>(event: K & string, handler: (data: TEvents[K]) => void): void;
  once(
    event: 'error',
    handler: (error: SSEConnectionError | SSEStreamError | SSEHeartbeatError) => void
  ): void;
  once(event: 'open', handler: () => void): void;
  once(event: 'close', handler: (event: CloseEvent) => void): void;
  once(event: string, handler: (data: any) => void): void {
    const onceWrapper = (data: any) => {
      handler(data);
      this.off(event, onceWrapper);
    };

    this.on(event as any, onceWrapper);
  }

  close(): void {
    this._state = 'closed';
    this.clearHeartbeatTimer();

    this.metrics.connectionDuration = Date.now() - this.connectionStartTime;

    if (this.eventSource) {
      // Remove all custom event handlers
      this.customEventHandlers.forEach((handler, event) => {
        this.eventSource!.removeEventListener(event, handler);
      });
      this.customEventHandlers.clear();

      this.eventSource.close();
      this.eventSource = null;
    }

    this.handlers = {};
  }

  get state(): SSEConnectionState {
    return this._state;
  }

  get lastEventId(): string | undefined {
    return this._lastEventId;
  }
}

/**
 * Create an SSE client instance
 * Works in both browser and Node.js with appropriate polyfills
 */
export async function createSSEClient<
  TEvents extends Record<string, unknown> = Record<string, unknown>,
>(
  url: string,
  options: SSEClientOptions = {},
  factory?: EventSourceFactory
): Promise<SSEClient<TEvents>> {
  // Check environment - this works in both browser and Node
  if (!factory && (typeof window === 'undefined' || typeof window.EventSource === 'undefined')) {
    // Detect if we're in Node.js
    const isNode =
      typeof process !== 'undefined' &&
      typeof process.versions !== 'undefined' &&
      typeof process.versions.node !== 'undefined';

    const correlationId = generateClientCorrelationId();
    const context: SSEConnectionErrorContext = {
      url,
      correlationId,
      state: 'connecting',
      reconnectAttempts: 0,
      originalError: new Error(
        isNode
          ? 'SSE is not supported in Node.js environments. SSE requires the browser EventSource API. For server-to-server communication, consider using WebSockets or HTTP/2 streaming.'
          : 'Browser does not support Server-Sent Events'
      ),
    };
    throw new SSEConnectionError(
      isNode
        ? 'SSE is not supported in Node.js environments'
        : 'Browser does not support Server-Sent Events',
      context
    );
  }

  // Validate URL
  if (!url) {
    const correlationId = generateClientCorrelationId();
    const context: SSEConnectionErrorContext = {
      url: '',
      correlationId,
      state: 'connecting',
      reconnectAttempts: 0,
      originalError: new Error('SSE URL is required'),
    };
    throw new SSEConnectionError('SSE URL is required', context);
  }

  // Create client instance
  const client = new SSEClientImpl<TEvents>(url, options, factory);

  // If user wants synchronous creation, return immediately without connecting
  if (options.waitForConnection === false) {
    // Start connection asynchronously
    client.connect().catch(() => {
      // Connection errors will be emitted via error event
    });
    return client;
  }

  // Wait for connection with optional timeout
  if (options.connectionTimeout) {
    return Promise.race([
      client.connect().then(() => client),
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          client.close();
          const context: SSEConnectionErrorContext = {
            url,
            correlationId: generateClientCorrelationId(),
            state: 'connecting',
            reconnectAttempts: 0,
            originalError: new Error(`Connection timeout after ${options.connectionTimeout}ms`),
          };
          reject(new SSEConnectionError('SSE connection timeout', context));
        }, options.connectionTimeout);
      }),
    ]);
  }

  // Wait for connection without timeout
  await client.connect();
  return client;
}
