/**
 * @module sse/sse-stream
 * @description Basic SSE Stream implementation for testing
 *
 * This is a basic implementation that provides the minimal functionality
 * needed for the route creator to work and tests to pass.
 */

import type { Context } from '@blaize-types/context';
import type { SSEStreamExtended, SSEConnectionState, SSEOptions } from '@blaize-types/sse';

/**
 * Basic implementation of SSE Stream
 */
class SSEStreamImpl implements SSEStreamExtended {
  readonly id: string;
  private _state: SSEConnectionState = 'connecting';
  private _bufferSize = 0;
  private _closeCallbacks: Array<() => void> = [];
  private response: any;
  private options: SSEOptions;

  constructor(ctx: Context, options: SSEOptions = {}) {
    this.response = ctx.response.raw;
    this.options = options;
    this.id = `sse-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Set SSE headers
    if (this.response && typeof this.response.writeHead === 'function') {
      this.response.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable Nginx buffering
      });
    }

    this._state = 'connected';
  }

  get state(): SSEConnectionState {
    return this._state;
  }

  get bufferSize(): number {
    return this._bufferSize;
  }

  get isWritable(): boolean {
    return this._state === 'connected' && this.response && !this.response.writableEnded;
  }

  send<T>(event: string, data: T): void {
    if (!this.isWritable) {
      throw new Error('Stream is not writable');
    }

    // Format SSE event
    let message = '';
    if (this.id) {
      message += `id: ${this.id}\n`;
    }
    message += `event: ${event}\n`;
    message += `data: ${JSON.stringify(data)}\n\n`;

    if (this.response && typeof this.response.write === 'function') {
      this.response.write(message);
    }
  }

  sendError(error: Error): void {
    this.send('error', {
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }

  close(): void {
    if (this._state === 'closed') return;

    this._state = 'closed';

    // Execute close callbacks
    this._closeCallbacks.forEach(cb => {
      try {
        cb();
      } catch (err) {
        console.error('Error in close callback:', err);
      }
    });

    // Clear callbacks
    this._closeCallbacks = [];

    // End the response
    if (this.response && typeof this.response.end === 'function' && !this.response.writableEnded) {
      this.response.end();
    }
  }

  onClose(cb: () => void): void {
    if (this._state === 'closed') {
      // If already closed, execute immediately
      cb();
    } else {
      this._closeCallbacks.push(cb);
    }
  }

  ping(comment?: string): void {
    if (!this.isWritable) return;

    const message = comment ? `: ${comment}\n\n` : ':\n\n';
    if (this.response && typeof this.response.write === 'function') {
      this.response.write(message);
    }
  }

  setRetry(milliseconds: number): void {
    if (!this.isWritable) return;

    if (this.response && typeof this.response.write === 'function') {
      this.response.write(`retry: ${milliseconds}\n\n`);
    }
  }

  flush(): void {
    // Basic implementation - just reset buffer count
    this._bufferSize = 0;
  }
}

/**
 * Create an SSE stream
 */
export function createSSEStream(ctx: Context, options?: SSEOptions): SSEStreamExtended {
  return new SSEStreamImpl(ctx, options);
}
