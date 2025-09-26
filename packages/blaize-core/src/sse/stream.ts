/**
 * @module sse/stream
 * @description SSE Stream implementation with backpressure management
 *
 * Provides a functional SSE stream implementation with:
 * - Automatic connection registry integration
 * - Configurable buffer management strategies
 * - Memory-efficient event handling
 * - Automatic cleanup on disconnect
 */

import { EventEmitter } from 'node:events';

import { BackpressureConfigSchema, type BackpressureConfig } from './back-pressure';
import { getConnectionRegistry } from './connection-registry';
import { SSEBufferOverflowError } from '../errors/sse-buffer-overflow-error';
import { SSEStreamClosedError } from '../errors/sse-stream-closed-error';
import { getCorrelationId } from '../tracing/correlation';

import type { Context } from '@blaize-types/context';
import type {
  SSEStreamExtended,
  SSEConnectionState,
  SSEOptions,
  SSEBufferStrategy,
  BufferedEvent,
  StreamMetrics,
} from '@blaize-types/sse';

/**
 * Default SSE options with production-ready defaults
 */
const DEFAULT_OPTIONS: Required<SSEOptions> = {
  heartbeatInterval: 30000, // 30 seconds - prevents proxy/firewall timeouts
  maxEventSize: 1024 * 1024, // 1MB - generous but prevents memory attacks
  autoClose: true, // Clean up resources on disconnect
  maxBufferSize: 1000, // 1000 events - reasonable for most use cases
  bufferStrategy: 'drop-oldest' as SSEBufferStrategy, // Prefer fresh data
};

/**
 * Format SSE event for wire protocol
 * @internal
 */
function formatSSEEvent(event: string, data: unknown, id?: string, retry?: number): string {
  const lines: string[] = [];

  if (id) {
    lines.push(`id: ${id}`);
  }

  if (retry !== undefined) {
    lines.push(`retry: ${retry}`);
  }

  lines.push(`event: ${event}`);

  // Handle multi-line data - handle null/undefined gracefully
  const dataStr =
    data === null
      ? 'null'
      : data === undefined
        ? 'undefined'
        : typeof data === 'string'
          ? data
          : JSON.stringify(data);
  const dataLines = dataStr.split('\n');
  for (const line of dataLines) {
    lines.push(`data: ${line}`);
  }

  lines.push(''); // Empty line to terminate event
  return lines.join('\n') + '\n';
}

/**
 * Create event ID
 * @internal
 */
function createEventId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 9);
  return `${timestamp}-${random}`;
}

/**
 * Estimate event size in bytes
 * @internal
 */
function estimateEventSize(event: string, data: unknown): number {
  const dataStr =
    data === null
      ? 'null'
      : data === undefined
        ? 'undefined'
        : typeof data === 'string'
          ? data
          : JSON.stringify(data);
  // Rough estimate: event name + data + SSE formatting overhead
  return event.length + dataStr.length + 50; // 50 bytes for SSE protocol overhead
}

/**
 * Apply buffer strategy when buffer is full
 * @internal
 */
function applyBufferStrategy(
  buffer: BufferedEvent[],
  strategy: SSEBufferStrategy,
  newEvent: BufferedEvent,
  maxSize: number
): { buffer: BufferedEvent[]; dropped: number } {
  let dropped = 0;

  switch (strategy) {
    case 'drop-oldest': {
      // Remove oldest events to make room
      while (buffer.length >= maxSize && buffer.length > 0) {
        buffer.shift();
        dropped++;
      }
      buffer.push(newEvent);
      break;
    }

    case 'drop-newest': {
      // Reject the new event if buffer is full
      if (buffer.length >= maxSize) {
        dropped = 1;
        // Don't add the new event
      } else {
        buffer.push(newEvent);
      }
      break;
    }

    case 'close': {
      // This strategy will be handled by the caller
      // by throwing an error
      break;
    }

    default:
      // Default to drop-oldest
      while (buffer.length >= maxSize && buffer.length > 0) {
        buffer.shift();
        dropped++;
      }
      buffer.push(newEvent);
  }

  return { buffer, dropped };
}

/**
 * SSE Stream implementation using functional patterns
 */
class SSEStreamImpl implements SSEStreamExtended {
  readonly id: string;
  private _state: SSEConnectionState = 'connecting';
  private _buffer: BufferedEvent[] = [];
  private _closeCallbacks: Array<() => void | Promise<void>> = [];
  private _errorCallbacks: Array<(error: Error) => void> = [];
  private _emitter = new EventEmitter();
  private _metrics: StreamMetrics;
  private _options: Required<SSEOptions>;
  private _response: Context['response'];
  private _request: Context['request'];
  private _writable: boolean = true;
  private _cleanupExecuted = false;
  private _eventCounter = 0;
  private _lastEventId: string | null = null;
  private _heartbeatTimer?: NodeJS.Timeout;
  private _backpressureConfig?: BackpressureConfig;
  private _disconnectHandlers: {
    req: { close: () => void; error: () => void };
    res: { close: () => void; error: () => void };
  } | null = null;

  constructor(ctx: Context, options: SSEOptions = {}) {
    this.id = `sse-${createEventId()}`;
    this._options = { ...DEFAULT_OPTIONS, ...options };
    this._response = ctx.response;
    this._request = ctx.request;

    // Parse and validate backpressure config if provided
    if ((options as any).backpressure) {
      const result = BackpressureConfigSchema.safeParse((options as any).backpressure);
      if (result.success) {
        this._backpressureConfig = result.data;
        // Override simple options with backpressure config values
        this._options.maxBufferSize = result.data.limits.maxMessages;
        this._options.bufferStrategy = result.data.strategy;
      }
    }

    // Handle Last-Event-ID header for reconnection
    const lastEventId = ctx.request.header('last-event-id');
    if (lastEventId) {
      this._eventCounter = parseInt(lastEventId) || 0;
      this._lastEventId = lastEventId;
    }

    // Initialize metrics
    this._metrics = {
      eventsSent: 0,
      eventsDropped: 0,
      bytesWritten: 0,
      bufferHighWatermark: 0,
      lastEventTime: Date.now(),
    };

    // CRITICAL: Do all operations that might throw BEFORE setting headers

    // 1. Try to register with connection registry FIRST
    // This can throw if connection limits are exceeded
    try {
      const registry = getConnectionRegistry();
      const metadata = {
        clientIp:
          this._request.header('x-forwarded-for') ||
          this._request.header('x-real-ip') ||
          (this._request.raw as any).socket?.remoteAddress,
        userAgent: this._request.header('user-agent'),
      };

      registry.add(this.id, this, metadata);
    } catch (error) {
      // If registration fails (e.g., connection limit), fail immediately
      // BEFORE setting any headers
      this._state = 'closed';
      this._writable = false;
      console.error('[SSE] Failed to register connection:', error);
      throw error;
    }

    // 2. Set up disconnect handling (shouldn't throw, but do it before headers)
    this._setupDisconnectHandling();

    // 3. NOW we can safely set SSE headers
    // If anything above threw, we haven't sent headers yet
    this._response
      .status(200)
      .header('Content-Type', 'text/event-stream')
      .header('Cache-Control', 'no-cache')
      .header('X-Accel-Buffering', 'no'); // Disable Nginx buffering

    // Only set Connection header for HTTP/1.x
    if (!this._request.raw.httpVersionMajor || this._request.raw.httpVersionMajor < 2) {
      this._response.header('Connection', 'keep-alive');
    }

    // 4. Set up heartbeat if configured (after headers are sent)
    if (this._options.heartbeatInterval && this._options.heartbeatInterval > 0) {
      this._setupHeartbeat(this._options.heartbeatInterval);
    }

    // 5. Transition to connected state
    this._state = 'connected';

    // 6. Send initial comment to establish connection
    this._writeRaw(`: SSE connection established\n\n`);
  }

  /**
   * Register connection with the internal registry
   * @internal
   */
  private _registerConnection(): void {
    try {
      const registry = getConnectionRegistry();
      const metadata = {
        clientIp:
          this._request.header('x-forwarded-for') ||
          this._request.header('x-real-ip') ||
          (this._request.raw as any).socket?.remoteAddress,
        userAgent: this._request.header('user-agent'),
      };

      registry.add(this.id, this, metadata);
    } catch (error) {
      // If registration fails (e.g., connection limit), close immediately
      this._state = 'closed';
      this._writable = false;
      throw error;
    }
  }

  /**
   * Set up heartbeat timer
   * @internal
   */
  private _setupHeartbeat(interval: number): void {
    this._heartbeatTimer = global.setInterval(() => {
      if (this.isWritable) {
        const idleTime = Date.now() - this._metrics.lastEventTime;
        // Only send heartbeat if no recent activity
        if (idleTime > interval * 0.9) {
          this.ping(`heartbeat ${new Date().toISOString()}`);
        }
      }
    }, interval);

    // Ensure timer doesn't prevent process exit
    if (this._heartbeatTimer.unref) {
      this._heartbeatTimer.unref();
    }
  }

  /**
   * Set up automatic disconnect detection
   * @internal
   */
  private _setupDisconnectHandling(): void {
    const req = this._request.raw;
    const res = this._response.raw;

    // Handle client disconnect
    const handleDisconnect = () => {
      if (this._options.autoClose && this._state !== 'closed') {
        this.close();
      }
    };

    // Store handlers for cleanup
    this._disconnectHandlers = {
      req: { close: handleDisconnect, error: handleDisconnect },
      res: { close: handleDisconnect, error: handleDisconnect },
    };

    // Listen for various disconnect signals
    req.on('close', this._disconnectHandlers.req.close);
    req.on('error', this._disconnectHandlers.req.error);
    res.on('close', this._disconnectHandlers.res.close);
    res.on('error', this._disconnectHandlers.res.error);
  }

  /**
   * Write raw data to the response stream
   * @internal
   */
  private _writeRaw(data: string): boolean {
    if (!this._writable || this._state === 'closed') {
      return false;
    }

    try {
      const res = this._response.raw;
      // Handle the write method with proper typing for both HTTP/1.1 and HTTP/2
      let written: boolean;

      if ('write' in res && typeof res.write === 'function') {
        // Call write with just the data parameter to avoid signature conflicts
        written = (res as any).write(data);
      } else {
        throw new Error('Response stream does not support write operation');
      }

      if (written) {
        this._metrics.bytesWritten += Buffer.byteLength(data);
      }

      return written;
    } catch (error) {
      this._writable = false;
      this._handleError(error as Error);
      return false;
    }
  }

  /**
   * Process and send buffered events
   * @internal
   */
  private async _flushBuffer(): Promise<void> {
    while (this._buffer.length > 0 && this._writable) {
      const event = this._buffer.shift();
      if (!event) break;

      const formatted = formatSSEEvent(event.event, event.data, event.id);

      if (!this._writeRaw(formatted)) {
        // If write failed, put event back and wait for drain
        this._buffer.unshift(event);
        await this._waitForDrain();
      } else {
        this._metrics.eventsSent++;
        this._metrics.lastEventTime = Date.now();
      }
    }
  }

  /**
   * Wait for the response stream to drain
   * @internal
   */
  private _waitForDrain(): Promise<void> {
    return new Promise(resolve => {
      const res = this._response.raw;
      res.once('drain', resolve);
    });
  }

  /**
   * Handle internal errors
   * @internal
   */
  private _handleError(error: Error): void {
    this._errorCallbacks.forEach(cb => {
      try {
        cb(error);
      } catch (err) {
        console.error('Error in error callback:', err);
      }
    });

    // Send error event if still writable
    if (this._writable) {
      this.sendError(error);
    }
  }

  /**
   * Execute cleanup operations
   * @internal
   */
  private _executeCleanup(): void {
    if (this._cleanupExecuted) return;
    this._cleanupExecuted = true;

    // Clear heartbeat timer
    if (this._heartbeatTimer) {
      global.clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = undefined;
    }

    // Remove event listeners
    if (this._disconnectHandlers) {
      const req = this._request.raw;
      const res = this._response.raw;

      req.removeListener('close', this._disconnectHandlers.req.close);
      req.removeListener('error', this._disconnectHandlers.req.error);
      res.removeListener('close', this._disconnectHandlers.res.close);
      res.removeListener('error', this._disconnectHandlers.res.error);

      this._disconnectHandlers = null;
    }

    // Deregister from connection registry
    try {
      const registry = getConnectionRegistry();
      registry.remove(this.id);
    } catch (error) {
      // Ignore registry errors during cleanup
      console.error('Registry cleanup error:', error);
    }

    // Execute close callbacks synchronously
    // Make a copy to avoid modification during iteration
    const callbacks = [...this._closeCallbacks];
    for (const cb of callbacks) {
      try {
        const result = cb();
        // If it's a promise, catch any errors but don't await
        if (result && typeof result.then === 'function') {
          result.catch((error: Error) => {
            console.error('Error in async close callback:', error);
          });
        }
      } catch (error) {
        console.error('Error in close callback:', error);
      }
    }

    // Clear callbacks and buffer
    this._closeCallbacks = [];
    this._errorCallbacks = [];
    this._buffer = [];
    this._emitter.removeAllListeners();
  }

  // Public API Implementation

  get state(): SSEConnectionState {
    return this._state;
  }

  get bufferSize(): number {
    return this._buffer.length;
  }

  get isWritable(): boolean {
    return this._writable && this._state === 'connected';
  }

  send<T>(event: string, data: T): void {
    if (!this.isWritable) {
      throw new SSEStreamClosedError('Cannot send event to closed stream', {
        clientId: this.id,
        closedAt: new Date().toISOString(),
        closeReason: 'server-close',
        canReconnect: false,
      });
    }

    // Use sequential event IDs for proper reconnection support
    const eventId = String(++this._eventCounter);
    this._lastEventId = eventId;
    const correlationId = getCorrelationId();
    const size = estimateEventSize(event, data);

    // Validate event size to prevent memory attacks
    const maxEventSize = this._options.maxEventSize;
    if (size > maxEventSize) {
      throw new SSEBufferOverflowError('Event size exceeds maximum allowed', {
        currentSize: size,
        maxSize: maxEventSize,
        strategy: 'close',
        clientId: this.id,
        eventsDropped: 0,
        triggeringEvent: event,
      });
    }

    // Create buffered event
    const bufferedEvent: BufferedEvent = {
      id: eventId,
      event,
      data,
      size,
      timestamp: Date.now(),
      correlationId,
    };

    // Check buffer limit (use backpressure config if available)
    const maxBuffer = this._backpressureConfig
      ? this._backpressureConfig.watermarks.high
      : this._options.maxBufferSize;

    if (this._buffer.length >= maxBuffer) {
      if (this._options.bufferStrategy === 'close') {
        const currentSize = this._buffer.length;

        // Close the stream on buffer overflow
        this.close();
        throw new SSEBufferOverflowError('Buffer overflow - stream closed', {
          currentSize,
          maxSize: maxBuffer,
          strategy: 'close',
          clientId: this.id,
        });
      }

      // Apply buffer strategy
      const result = applyBufferStrategy(
        this._buffer,
        this._options.bufferStrategy,
        bufferedEvent,
        maxBuffer
      );

      this._buffer = result.buffer;
      this._metrics.eventsDropped += result.dropped;

      if (result.dropped > 0) {
        console.warn(
          `SSE stream ${this.id}: Dropped ${result.dropped} events due to buffer overflow`
        );
      }
    } else {
      this._buffer.push(bufferedEvent);
    }

    // Update high watermark
    this._metrics.bufferHighWatermark = Math.max(
      this._metrics.bufferHighWatermark,
      this._buffer.length
    );

    // Emit event for async iterator
    this._emitter.emit('event');

    // Try to flush immediately
    this._flushBuffer().catch(error => {
      this._handleError(error as Error);
    });
  }

  sendError(error: Error): void {
    if (!this.isWritable) return;

    const errorData = {
      message: error.message,
      name: error.name,
      correlationId: getCorrelationId(),
      timestamp: new Date().toISOString(),
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    };

    try {
      this.send('error', errorData);
    } catch (sendError) {
      // If we can't send the error event, just log it
      console.error('Failed to send error event:', sendError);
    }
  }

  close(): void {
    if (this._state === 'closed') return;

    this._state = 'closed';
    this._writable = false;

    // Emit close event for async iterator
    this._emitter.emit('close');

    // Send close event if possible
    try {
      const closeEvent = formatSSEEvent('close', {
        reason: 'stream-closed',
        reconnect: false,
      });
      const res = this._response.raw;
      // Use type assertion to handle union type
      if ('write' in res && typeof res.write === 'function') {
        (res as any).write(closeEvent);
      }
    } catch {
      // Ignore errors when sending close event
    }

    // End the response
    try {
      const res = this._response.raw;
      if (!res.writableEnded && typeof res.end === 'function') {
        res.end();
      }
    } catch (error) {
      console.error('Error ending response:', error);
    }

    // Execute cleanup synchronously
    this._executeCleanup();
  }

  onClose(cb: () => void | Promise<void>): void {
    if (this._state === 'closed') {
      // If already closed, execute immediately
      try {
        const result = cb();
        if (result && typeof result.then === 'function') {
          result.catch((error: Error) => {
            console.error('Error in close callback:', error);
          });
        }
      } catch (error) {
        console.error('Error in close callback:', error);
      }
    } else {
      this._closeCallbacks.push(cb);
    }
  }

  ping(comment?: string): void {
    if (!this.isWritable) return;

    const message = comment ? `: ${comment}\n\n` : `: ping\n\n`;
    this._writeRaw(message);
  }

  setRetry(milliseconds: number): void {
    if (!this.isWritable) return;

    if (milliseconds < 0 || !Number.isFinite(milliseconds)) {
      throw new Error('Retry interval must be a positive number');
    }

    this._writeRaw(`retry: ${Math.floor(milliseconds)}\n\n`);
  }

  flush(): void {
    if (!this.isWritable) return;

    // Force flush all buffered events
    this._flushBuffer().catch(error => {
      this._handleError(error as Error);
    });
  }

  /**
   * Get stream metrics for monitoring
   */
  getMetrics(): StreamMetrics {
    return { ...this._metrics };
  }

  /**
   * Create async iterator for generator-based streaming
   * Enables using the stream with for-await-of loops
   */
  async *[Symbol.asyncIterator](): AsyncGenerator<BufferedEvent, void, unknown> {
    while (this.isWritable) {
      // Yield buffered events
      while (this._buffer.length > 0) {
        const event = this._buffer.shift();
        if (event) {
          yield event;
        }
      }

      // Wait for next event or close
      await new Promise<void>(resolve => {
        const checkBuffer = () => {
          if (this._buffer.length > 0 || !this.isWritable) {
            this._emitter.off('event', checkBuffer);
            this._emitter.off('close', checkBuffer);
            resolve();
          }
        };

        this._emitter.on('event', checkBuffer);
        this._emitter.on('close', checkBuffer);
      });
    }
  }
}

/**
 * Create an SSE stream with backpressure management
 *
 * This factory function creates a fully-featured SSE stream that:
 * - Automatically registers with the connection registry
 * - Manages buffer overflow with configurable strategies
 * - Handles client disconnections gracefully
 * - Provides async iteration support
 * - Supports reconnection with event ID sequencing
 * - Optional heartbeat for connection health monitoring
 * - Prevents memory attacks via event size validation
 *
 * @param ctx - The request context
 * @param options - Stream configuration options
 * @returns A new SSE stream instance
 *
 * @example Basic usage:
 * ```typescript
 * const stream = createSSEStream(ctx);
 * stream.send('message', { text: 'Hello SSE!' });
 * stream.close();
 * ```
 *
 * @example With custom configuration:
 * ```typescript
 * const stream = createSSEStream(ctx, {
 *   heartbeatInterval: 30000,     // 30s heartbeat
 *   maxEventSize: 512 * 1024,      // 512KB max event size
 *   maxBufferSize: 100,
 *   bufferStrategy: 'drop-oldest',
 *   autoClose: true
 * });
 *
 * // Send events with automatic size validation
 * try {
 *   stream.send('data', largePayload); // Throws if > maxEventSize
 * } catch (error) {
 *   console.error('Event too large:', error);
 * }
 * ```
 *
 * @example Using async iteration:
 * ```typescript
 * const stream = createSSEStream(ctx);
 *
 * // Process events using async generator
 * for await (const event of stream) {
 *   console.log('Processing event:', event);
 * }
 * ```
 *
 * @example Handling reconnection:
 * ```typescript
 * // Client sends Last-Event-ID header on reconnection
 * // Stream automatically resumes from that ID
 * const stream = createSSEStream(ctx);
 * // If Last-Event-ID: "42" was sent, next event will be "43"
 * stream.send('message', { text: 'Continuing from where we left off' });
 * ```
 */
export function createSSEStream(ctx: Context, options?: SSEOptions): SSEStreamExtended {
  return new SSEStreamImpl(ctx, options);
}
