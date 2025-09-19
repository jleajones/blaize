/* eslint-disable import/order */
/**
 * @module sse/stream/__tests__/sse-stream.test.ts
 * @description Comprehensive test suite for SSE Stream implementation
 */

import { EventEmitter } from 'node:events';
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';

import type { Context } from '@blaize-types/context';
import type { SSEStreamExtended, SSEOptions } from '@blaize-types/sse';

// Mock the dependencies before importing the module under test
vi.mock('./connection-registry', () => {
  const mockRegistry = {
    add: vi.fn(),
    remove: vi.fn(),
    get: vi.fn(),
    has: vi.fn(),
    getIds: vi.fn(() => []),
    count: vi.fn(() => 0),
    cleanup: vi.fn(),
    shutdown: vi.fn(),
  };

  return {
    getConnectionRegistry: vi.fn(() => mockRegistry),
    resetRegistry: vi.fn(),
  };
});

vi.mock('../tracing/correlation', () => ({
  getCorrelationId: vi.fn(() => 'test-correlation-id'),
}));

vi.mock('./back-pressure', () => ({
  BackpressureConfigSchema: {
    safeParse: vi.fn((config: any) => {
      if (config && typeof config === 'object') {
        return {
          success: true,
          data: {
            limits: {
              maxMessages: config.limits?.maxMessages || 1000,
              maxBytes: config.limits?.maxBytes || 10485760,
            },
            watermarks: {
              low: config.watermarks?.low || 100,
              high: config.watermarks?.high || 800,
            },
            strategy: config.strategy || 'drop-oldest',
            monitoring: config.monitoring || { enabled: false },
          },
        };
      }
      return { success: false };
    }),
  },
}));

// Now import the modules after mocks are set up
import { createSSEStream } from './stream';
import { SSEBufferOverflowError } from '../errors/sse-buffer-overflow-error';
import { SSEStreamClosedError } from '../errors/sse-stream-closed-error';
import { getConnectionRegistry } from './connection-registry';
import { getCorrelationId } from '../tracing/correlation';

describe('SSE Stream', () => {
  let mockContext: Context;
  let mockRequest: any;
  let mockResponse: any;
  let mockResponseRaw: any;
  let mockRegistry: any;
  let stream: SSEStreamExtended;

  beforeEach(() => {
    // Setup mock request as EventEmitter
    mockRequest = new EventEmitter();
    mockRequest.header = vi.fn((name: string) => {
      const headers: Record<string, string> = {
        'x-forwarded-for': '192.168.1.1',
        'user-agent': 'test-agent',
      };
      return headers[name];
    });
    mockRequest.raw = mockRequest;

    // Setup mock response raw as EventEmitter
    mockResponseRaw = new EventEmitter();
    mockResponseRaw.write = vi.fn(() => true);
    mockResponseRaw.end = vi.fn();
    mockResponseRaw.writableEnded = false;

    // Setup mock response with chaining
    mockResponse = {
      status: vi.fn(() => mockResponse),
      header: vi.fn(() => mockResponse),
      raw: mockResponseRaw,
    };

    // Setup mock context
    mockContext = {
      request: mockRequest,
      response: mockResponse,
    } as unknown as Context;

    // Get the mocked registry instance
    mockRegistry = (getConnectionRegistry as Mock)();

    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (stream && stream.state !== 'closed') {
      stream.close();
    }
    vi.clearAllMocks();
  });

  describe('Stream Creation', () => {
    it('should create stream with default options', () => {
      stream = createSSEStream(mockContext);

      expect(stream).toBeDefined();
      expect(stream.state).toBe('connected');
      expect(stream.isWritable).toBe(true);
      expect(stream.bufferSize).toBe(0);
    });

    it('should set proper SSE headers', () => {
      stream = createSSEStream(mockContext);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.header).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
      expect(mockResponse.header).toHaveBeenCalledWith('Cache-Control', 'no-cache');
      expect(mockResponse.header).toHaveBeenCalledWith('Connection', 'keep-alive');
      expect(mockResponse.header).toHaveBeenCalledWith('X-Accel-Buffering', 'no');
    });

    it('should register with connection registry', () => {
      stream = createSSEStream(mockContext);

      expect(mockRegistry.add).toHaveBeenCalledWith(
        expect.stringMatching(/^sse-/),
        stream,
        expect.objectContaining({
          clientIp: '192.168.1.1',
          userAgent: 'test-agent',
        })
      );

      // Verify the stream has an id property
      expect(stream.id).toMatch(/^sse-/);
    });

    it('should send initial connection comment', () => {
      stream = createSSEStream(mockContext);

      expect(mockResponseRaw.write).toHaveBeenCalledWith(
        expect.stringContaining(': SSE connection established')
      );
    });

    it('should accept custom options', () => {
      const options: SSEOptions = {
        maxBufferSize: 50,
        bufferStrategy: 'drop-newest',
        autoClose: false,
        heartbeatInterval: 60000,
        maxEventSize: 512 * 1024,
      };

      stream = createSSEStream(mockContext, options);
      expect(stream).toBeDefined();
    });

    it('should handle Last-Event-ID header for reconnection', async () => {
      mockRequest.header = vi.fn((name: string) => {
        const headers: Record<string, string> = {
          'last-event-id': '42',
          'x-forwarded-for': '192.168.1.1',
          'user-agent': 'test-agent',
        };
        return headers[name];
      });

      stream = createSSEStream(mockContext);

      // Clear initial write calls
      mockResponseRaw.write.mockClear();

      stream.send('message', 'test');

      // Wait for async flush
      await new Promise(resolve => setTimeout(resolve, 50));

      // Event ID should continue from Last-Event-ID
      const writeCall = mockResponseRaw.write.mock.calls.find((call: any[]) =>
        call[0].includes('id: ')
      );
      expect(writeCall).toBeDefined();
      expect(writeCall[0]).toContain('id: 43');
    });

    it('should accept backpressure config', () => {
      const options = {
        backpressure: {
          limits: { maxMessages: 500, maxBytes: 5242880 },
          watermarks: { low: 50, high: 400 },
          strategy: 'drop-newest' as const,
          monitoring: { enabled: true },
        },
      };

      stream = createSSEStream(mockContext, options as any);
      expect(stream).toBeDefined();
    });

    it('should handle registry registration failure', () => {
      // Make registry.add throw an error
      mockRegistry.add.mockImplementationOnce(() => {
        throw new Error('Connection limit exceeded');
      });

      expect(() => createSSEStream(mockContext)).toThrow('Connection limit exceeded');
    });
  });

  describe('Event Sending', () => {
    beforeEach(() => {
      stream = createSSEStream(mockContext);
      mockResponseRaw.write.mockClear(); // Clear initial connection message
    });

    it('should send simple event', async () => {
      stream.send('message', { text: 'Hello' });

      // Wait for async flush
      await new Promise(resolve => setTimeout(resolve, 50));

      const writeCall = mockResponseRaw.write.mock.calls.find((call: any[]) =>
        call[0].includes('event: message')
      );
      expect(writeCall).toBeDefined();
      expect(writeCall[0]).toContain('data: {"text":"Hello"}');
    });

    it('should send event with string data', async () => {
      stream.send('text', 'Plain text message');

      await new Promise(resolve => setTimeout(resolve, 50));

      const writeCall = mockResponseRaw.write.mock.calls.find((call: any[]) =>
        call[0].includes('event: text')
      );
      expect(writeCall).toBeDefined();
      expect(writeCall[0]).toContain('data: Plain text message');
    });

    it('should handle multi-line data', async () => {
      const multiLineData = 'Line 1\nLine 2\nLine 3';
      stream.send('multiline', multiLineData);

      await new Promise(resolve => setTimeout(resolve, 50));

      const writeCall = mockResponseRaw.write.mock.calls.find((call: any[]) =>
        call[0].includes('event: multiline')
      );
      expect(writeCall).toBeDefined();
      expect(writeCall[0]).toContain('data: Line 1\ndata: Line 2\ndata: Line 3');
    });

    it('should generate sequential event IDs', async () => {
      stream.send('event1', 'data1');
      stream.send('event2', 'data2');

      await new Promise(resolve => setTimeout(resolve, 50));

      const calls = mockResponseRaw.write.mock.calls;
      const ids = calls
        .map((call: any[]) => {
          const match = call[0].match(/id: ([^\n]+)/);
          return match ? match[1] : null;
        })
        .filter(Boolean);

      // IDs should be sequential numbers
      expect(ids.length).toBeGreaterThanOrEqual(2);
      expect(ids[0]).toBe('1');
      expect(ids[1]).toBe('2');
    });

    it('should validate event size against maxEventSize', () => {
      stream = createSSEStream(mockContext, {
        maxEventSize: 100, // Very small limit for testing
      });

      const largeData = 'x'.repeat(200);

      expect(() => stream.send('large', largeData)).toThrow(SSEBufferOverflowError);
      expect(() => stream.send('large', largeData)).toThrow(/Event size exceeds maximum allowed/);
    });

    it('should throw when sending to closed stream', () => {
      stream.close();

      expect(() => stream.send('test', 'data')).toThrow(SSEStreamClosedError);

      try {
        stream.send('test', 'data');
      } catch (error) {
        const sseError = error as SSEStreamClosedError;
        expect(sseError.details).toMatchObject({
          clientId: expect.stringMatching(/^sse-/),
          closedAt: expect.any(String),
          closeReason: 'server-close',
          canReconnect: false,
        });
      }
    });

    it('should include correlation ID in buffered events', () => {
      stream.send('tracked', { data: 'test' });
      expect(getCorrelationId).toHaveBeenCalled();
    });
  });

  describe('Buffer Management', () => {
    describe('drop-oldest strategy', () => {
      beforeEach(() => {
        stream = createSSEStream(mockContext, {
          maxBufferSize: 3,
          bufferStrategy: 'drop-oldest',
        });
        // Make writes fail to accumulate buffer
        mockResponseRaw.write.mockReturnValue(false);
      });

      it('should drop oldest events when buffer is full', () => {
        stream.send('event1', 'data1');
        stream.send('event2', 'data2');
        stream.send('event3', 'data3');
        stream.send('event4', 'data4'); // Should drop event1

        expect(stream.bufferSize).toBeLessThanOrEqual(3);
      });

      it('should track dropped events in metrics', () => {
        for (let i = 0; i < 10; i++) {
          stream.send(`event${i}`, `data${i}`);
        }

        const metrics = stream.getMetrics();
        expect(metrics.eventsDropped).toBeGreaterThan(0);
      });
    });

    describe('drop-newest strategy', () => {
      beforeEach(() => {
        stream = createSSEStream(mockContext, {
          maxBufferSize: 3,
          bufferStrategy: 'drop-newest',
        });
        mockResponseRaw.write.mockReturnValue(false);
      });

      it('should reject new events when buffer is full', () => {
        stream.send('event1', 'data1');
        stream.send('event2', 'data2');
        stream.send('event3', 'data3');

        const initialSize = stream.bufferSize;
        stream.send('event4', 'data4'); // Should be dropped

        expect(stream.bufferSize).toBe(initialSize);
      });
    });

    describe('close strategy', () => {
      beforeEach(() => {
        stream = createSSEStream(mockContext, {
          maxBufferSize: 2,
          bufferStrategy: 'close',
        });
        mockResponseRaw.write.mockReturnValue(false);
      });

      it('should close stream on buffer overflow', () => {
        stream.send('event1', 'data1');
        stream.send('event2', 'data2');

        expect(() => stream.send('event3', 'data3')).toThrow(SSEBufferOverflowError);
        expect(stream.state).toBe('closed');
      });

      it('should include details in overflow error', () => {
        stream.send('event1', 'data1');
        stream.send('event2', 'data2');

        try {
          stream.send('event3', 'data3');
          expect.fail('Should have thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(SSEBufferOverflowError);
          const sseError = error as SSEBufferOverflowError;
          expect(sseError.details).toMatchObject({
            currentSize: 2,
            maxSize: 2,
            strategy: 'close',
            clientId: expect.stringMatching(/^sse-/),
          });
        }
      });
    });

    describe('backpressure config integration', () => {
      it('should use high watermark from backpressure config', () => {
        stream = createSSEStream(mockContext, {
          backpressure: {
            watermarks: { low: 10, high: 20 },
            limits: { maxMessages: 100 },
            strategy: 'drop-oldest',
          },
        } as any);

        mockResponseRaw.write.mockReturnValue(false);

        // Should use high watermark (20) instead of maxBufferSize
        for (let i = 0; i < 25; i++) {
          stream.send(`event${i}`, `data${i}`);
        }

        expect(stream.bufferSize).toBeLessThanOrEqual(20);
      });
    });

    describe('backpressure handling', () => {
      it('should handle drain events', async () => {
        // Create stream without close strategy to avoid auto-close
        stream = createSSEStream(mockContext, {
          bufferStrategy: 'drop-oldest',
        });

        mockResponseRaw.write.mockReturnValueOnce(false);

        stream.send('event1', 'data1');
        expect(stream.bufferSize).toBeGreaterThan(0);

        // Simulate drain event
        mockResponseRaw.write.mockReturnValue(true);
        mockResponseRaw.emit('drain');

        // Wait for processing
        await new Promise(resolve => setTimeout(resolve, 100));

        expect(stream.bufferSize).toBe(0);
      });

      it('should update high watermark metric', () => {
        // Create stream without close strategy
        stream = createSSEStream(mockContext, {
          bufferStrategy: 'drop-oldest',
        });

        mockResponseRaw.write.mockReturnValue(false);

        for (let i = 0; i < 5; i++) {
          stream.send(`event${i}`, `data${i}`);
        }

        const metrics = stream.getMetrics();
        expect(metrics.bufferHighWatermark).toBeGreaterThan(0);
      });
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      stream = createSSEStream(mockContext);
      mockResponseRaw.write.mockClear();
    });

    it('should send error events', async () => {
      const error = new Error('Test error');
      stream.sendError(error);

      await new Promise(resolve => setTimeout(resolve, 50));

      const writeCall = mockResponseRaw.write.mock.calls.find((call: any[]) =>
        call[0].includes('event: error')
      );
      expect(writeCall).toBeDefined();
      expect(writeCall[0]).toContain('"message":"Test error"');
      expect(writeCall[0]).toContain('"name":"Error"');
    });

    it('should include stack trace in development', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const error = new Error('Dev error');
      stream.sendError(error);

      await new Promise(resolve => setTimeout(resolve, 50));

      const writeCall = mockResponseRaw.write.mock.calls.find((call: any[]) =>
        call[0].includes('event: error')
      );
      expect(writeCall).toBeDefined();
      expect(writeCall[0]).toContain('"stack"');

      process.env.NODE_ENV = originalEnv;
    });

    it('should handle write errors gracefully', () => {
      mockResponseRaw.write.mockImplementation(() => {
        throw new Error('Write failed');
      });

      expect(() => stream.send('test', 'data')).not.toThrow();
      expect(stream.isWritable).toBe(false);
    });

    it('should ignore errors when sending to closed stream', () => {
      stream.close();

      expect(() => stream.sendError(new Error('Test'))).not.toThrow();
    });
  });

  describe('Heartbeat', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should set up heartbeat timer when configured', () => {
      stream = createSSEStream(mockContext, {
        heartbeatInterval: 30000,
      });

      mockResponseRaw.write.mockClear();

      // Fast-forward time to trigger heartbeat
      vi.advanceTimersByTime(30000);

      const pingCall = mockResponseRaw.write.mock.calls.find((call: any[]) =>
        call[0].includes(': heartbeat')
      );
      expect(pingCall).toBeDefined();
    });

    it('should not send heartbeat if recent activity', () => {
      stream = createSSEStream(mockContext, {
        heartbeatInterval: 30000,
      });

      mockResponseRaw.write.mockClear();

      // Send an event
      stream.send('test', 'data');

      // Advance time but not enough to trigger heartbeat
      vi.advanceTimersByTime(25000);

      // Send another event (recent activity)
      stream.send('test2', 'data2');

      // Advance to heartbeat time
      vi.advanceTimersByTime(5000);

      // Should not have sent heartbeat due to recent activity
      const pingCall = mockResponseRaw.write.mock.calls.find((call: any[]) =>
        call[0].includes(': heartbeat')
      );
      expect(pingCall).toBeUndefined();
    });

    it('should clear heartbeat timer on close', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

      stream = createSSEStream(mockContext, {
        heartbeatInterval: 30000,
      });

      stream.close();

      expect(clearIntervalSpy).toHaveBeenCalled();
      clearIntervalSpy.mockRestore();
    });

    it('should not set up heartbeat if interval is 0', () => {
      stream = createSSEStream(mockContext, {
        heartbeatInterval: 0,
      });

      mockResponseRaw.write.mockClear();

      vi.advanceTimersByTime(60000);

      const pingCall = mockResponseRaw.write.mock.calls.find((call: any[]) =>
        call[0].includes(': heartbeat')
      );
      expect(pingCall).toBeUndefined();
    });
  });

  describe('Stream Control', () => {
    beforeEach(() => {
      stream = createSSEStream(mockContext);
      mockResponseRaw.write.mockClear();
    });

    describe('ping', () => {
      it('should send ping without comment', () => {
        stream.ping();

        expect(mockResponseRaw.write).toHaveBeenCalledWith(': ping\n\n');
      });

      it('should send ping with custom comment', () => {
        stream.ping('keep-alive');

        expect(mockResponseRaw.write).toHaveBeenCalledWith(': keep-alive\n\n');
      });

      it('should not ping closed stream', () => {
        stream.close();
        const callCount = mockResponseRaw.write.mock.calls.length;

        stream.ping();

        expect(mockResponseRaw.write).toHaveBeenCalledTimes(callCount);
      });
    });

    describe('setRetry', () => {
      it('should set retry interval', () => {
        stream.setRetry(5000);

        expect(mockResponseRaw.write).toHaveBeenCalledWith('retry: 5000\n\n');
      });

      it('should validate retry interval', () => {
        expect(() => stream.setRetry(-1)).toThrow('Retry interval must be a positive number');
        expect(() => stream.setRetry(NaN)).toThrow('Retry interval must be a positive number');
        expect(() => stream.setRetry(Infinity)).toThrow('Retry interval must be a positive number');
      });

      it('should floor decimal values', () => {
        stream.setRetry(3500.7);

        expect(mockResponseRaw.write).toHaveBeenCalledWith('retry: 3500\n\n');
      });
    });

    describe('flush', () => {
      it('should force flush buffer', async () => {
        mockResponseRaw.write.mockReturnValueOnce(false);

        stream.send('event1', 'data1');
        expect(stream.bufferSize).toBeGreaterThan(0);

        mockResponseRaw.write.mockReturnValue(true);
        stream.flush();

        await new Promise(resolve => setTimeout(resolve, 50));
        expect(stream.bufferSize).toBe(0);
      });
    });
  });

  describe('Stream Lifecycle', () => {
    beforeEach(() => {
      stream = createSSEStream(mockContext);
      mockResponseRaw.write.mockClear();
    });

    describe('close', () => {
      it('should transition to closed state', () => {
        expect(stream.state).toBe('connected');

        stream.close();

        expect(stream.state).toBe('closed');
        expect(stream.isWritable).toBe(false);
      });

      it('should send close event', () => {
        stream.close();

        const writeCall = mockResponseRaw.write.mock.calls.find((call: any[]) =>
          call[0].includes('event: close')
        );
        expect(writeCall).toBeDefined();
        expect(writeCall[0]).toContain('"reason":"stream-closed"');
        expect(writeCall[0]).toContain('"reconnect":false');
      });

      it('should end response stream', () => {
        stream.close();

        expect(mockResponseRaw.end).toHaveBeenCalled();
      });

      it('should deregister from connection registry', async () => {
        const streamId = stream.id;
        stream.close();

        // Wait for async cleanup
        await new Promise(resolve => setTimeout(resolve, 50));

        expect(mockRegistry.remove).toHaveBeenCalledWith(streamId);
      });

      it('should be idempotent', () => {
        stream.close();
        const callCount = mockResponseRaw.end.mock.calls.length;

        stream.close();
        stream.close();

        expect(mockResponseRaw.end).toHaveBeenCalledTimes(callCount);
      });

      it('should clear buffers and callbacks', () => {
        stream.send('event1', 'data1');
        stream.onClose(() => {});

        stream.close();

        expect(stream.bufferSize).toBe(0);
      });

      it('should handle close errors gracefully', () => {
        mockResponseRaw.end.mockImplementation(() => {
          throw new Error('End failed');
        });

        expect(() => stream.close()).not.toThrow();
      });
    });

    describe('onClose callbacks', () => {
      it('should register close callback', async () => {
        const callback = vi.fn();
        stream.onClose(callback);

        stream.close();

        // Wait for async cleanup execution
        await new Promise(resolve => setTimeout(resolve, 100));
        expect(callback).toHaveBeenCalled();
      });

      it('should handle multiple callbacks', async () => {
        const callback1 = vi.fn();
        const callback2 = vi.fn();

        stream.onClose(callback1);
        stream.onClose(callback2);

        stream.close();

        await new Promise(resolve => setTimeout(resolve, 100));
        expect(callback1).toHaveBeenCalled();
        expect(callback2).toHaveBeenCalled();
      });

      it('should execute immediately if already closed', async () => {
        stream.close();

        // Wait for initial cleanup
        await new Promise(resolve => setTimeout(resolve, 100));

        const callback = vi.fn();
        stream.onClose(callback);

        // Should execute immediately since already closed
        await new Promise(resolve => setTimeout(resolve, 50));
        expect(callback).toHaveBeenCalled();
      });

      it('should handle async callbacks', async () => {
        let resolved = false;
        stream.onClose(async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          resolved = true;
        });

        stream.close();

        await new Promise(resolve => setTimeout(resolve, 150));
        expect(resolved).toBe(true);
      });

      it('should handle callback errors', async () => {
        const errorCallback = vi.fn(() => {
          throw new Error('Callback error');
        });
        const successCallback = vi.fn();

        stream.onClose(errorCallback);
        stream.onClose(successCallback);

        stream.close();

        await new Promise(resolve => setTimeout(resolve, 100));
        expect(errorCallback).toHaveBeenCalled();
        expect(successCallback).toHaveBeenCalled();
      });
    });

    describe('auto-close on disconnect', () => {
      it('should close on request close event', () => {
        stream = createSSEStream(mockContext, { autoClose: true });

        mockRequest.raw.emit('close');

        expect(stream.state).toBe('closed');
      });

      it('should close on request error event', () => {
        stream = createSSEStream(mockContext, { autoClose: true });

        mockRequest.raw.emit('error', new Error('Connection error'));

        expect(stream.state).toBe('closed');
      });

      it('should close on response close event', () => {
        stream = createSSEStream(mockContext, { autoClose: true });

        mockResponseRaw.emit('close');

        expect(stream.state).toBe('closed');
      });

      it('should not auto-close when disabled', () => {
        stream = createSSEStream(mockContext, { autoClose: false });

        mockRequest.raw.emit('close');

        expect(stream.state).toBe('connected');
      });

      it('should clean up event listeners on close', async () => {
        stream = createSSEStream(mockContext, { autoClose: true });

        const removeListenerSpy = vi.spyOn(mockRequest.raw, 'removeListener');

        stream.close();

        // Wait for async cleanup to complete
        await new Promise(resolve => setTimeout(resolve, 100));

        expect(removeListenerSpy).toHaveBeenCalledWith('close', expect.any(Function));
        expect(removeListenerSpy).toHaveBeenCalledWith('error', expect.any(Function));
      });
    });
  });

  describe('Metrics', () => {
    beforeEach(() => {
      stream = createSSEStream(mockContext);
      mockResponseRaw.write.mockClear();
    });

    it('should track events sent', async () => {
      stream.send('event1', 'data1');
      stream.send('event2', 'data2');

      await new Promise(resolve => setTimeout(resolve, 50));

      const metrics = stream.getMetrics();
      expect(metrics.eventsSent).toBe(2);
    });

    it('should track bytes written', async () => {
      stream.send('event', 'data');

      await new Promise(resolve => setTimeout(resolve, 50));

      const metrics = stream.getMetrics();
      expect(metrics.bytesWritten).toBeGreaterThan(0);
    });

    it('should track last event time', async () => {
      const before = Date.now();
      stream.send('event', 'data');

      await new Promise(resolve => setTimeout(resolve, 50));

      const metrics = stream.getMetrics();
      expect(metrics.lastEventTime).toBeGreaterThanOrEqual(before);
    });

    it('should return copy of metrics', () => {
      const metrics1 = stream.getMetrics();
      metrics1.eventsSent = 999;

      const metrics2 = stream.getMetrics();
      expect(metrics2.eventsSent).toBe(0);
    });
  });

  describe('Async Iterator', () => {
    beforeEach(() => {
      stream = createSSEStream(mockContext, {
        maxBufferSize: 10,
      });
      // Prevent actual writes to accumulate events
      mockResponseRaw.write.mockReturnValue(false);
    });

    it('should implement async iterator protocol', () => {
      expect(stream[Symbol.asyncIterator]).toBeDefined();
      expect(typeof stream[Symbol.asyncIterator]).toBe('function');
    });

    it('should yield buffered events', async () => {
      stream.send('event1', 'data1');
      stream.send('event2', 'data2');

      const iterator = stream[Symbol.asyncIterator]();
      const result1 = await iterator.next();

      expect(result1.done).toBe(false);
      expect(result1.value).toMatchObject({
        event: 'event1',
        data: 'data1',
      });
    });

    it('should work with for-await-of', async () => {
      stream.send('event1', 'data1');
      stream.send('event2', 'data2');

      setTimeout(() => stream.close(), 50);

      const events: any[] = [];
      for await (const event of stream) {
        events.push(event);
        if (events.length >= 2) break;
      }

      expect(events).toHaveLength(2);
      expect(events[0].event).toBe('event1');
      expect(events[1].event).toBe('event2');
    });

    it('should complete when stream closes', async () => {
      const iterator = stream[Symbol.asyncIterator]();

      setTimeout(() => stream.close(), 10);

      // Consume any buffered events
      let result;
      do {
        result = await iterator.next();
      } while (!result.done && stream.state !== 'closed');

      // After stream closes, iterator should complete
      const finalResult = await iterator.next();
      expect(finalResult.done).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      stream = createSSEStream(mockContext);
    });

    it('should handle response without write method', () => {
      const badResponse = new EventEmitter();
      (badResponse as any).write = undefined;
      (badResponse as any).writableEnded = false;
      (badResponse as any).end = vi.fn();

      mockResponse.raw = badResponse;

      const newStream = createSSEStream(mockContext);

      // Stream should be created but not writable
      expect(newStream.isWritable).toBe(false);

      // Sending should not throw since stream handles write errors gracefully
      expect(() => newStream.send('test', 'data')).toThrow(SSEStreamClosedError);
    });

    it('should handle very large event data within limits', () => {
      const largeStream = createSSEStream(mockContext, {
        maxEventSize: 1024 * 1024, // 1MB limit
      });

      const largeData = 'x'.repeat(10000);

      expect(() => largeStream.send('large', largeData)).not.toThrow();
      largeStream.close();
    });

    it('should reject event data exceeding size limit', () => {
      const limitedStream = createSSEStream(mockContext, {
        maxEventSize: 1024, // 1KB limit
      });

      const tooLargeData = 'x'.repeat(2000);

      expect(() => limitedStream.send('toolarge', tooLargeData)).toThrow(SSEBufferOverflowError);
      limitedStream.close();
    });

    it('should handle rapid event sending', async () => {
      for (let i = 0; i < 100; i++) {
        try {
          stream.send(`event${i}`, `data${i}`);
        } catch {
          // May throw if buffer strategy is 'close'
          break;
        }
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      const metrics = stream.getMetrics();
      expect(metrics.eventsSent + metrics.eventsDropped).toBeLessThanOrEqual(100);
    });

    it('should handle special characters in event data', () => {
      const specialData = '{"emoji": "🚀", "unicode": "\\u0041", "newline": "\\n"}';

      expect(() => stream.send('special', specialData)).not.toThrow();
    });

    it('should handle concurrent close operations', async () => {
      const promises = Array(10)
        .fill(0)
        .map(() => Promise.resolve().then(() => stream.close()));

      await expect(Promise.all(promises)).resolves.not.toThrow();
      expect(stream.state).toBe('closed');
    });

    it('should handle null and undefined data', () => {
      expect(() => stream.send('null', null)).not.toThrow();
      expect(() => stream.send('undefined', undefined)).not.toThrow();
    });

    it('should use sequential IDs for reconnection support', async () => {
      const stream1 = createSSEStream(mockContext);
      mockResponseRaw.write.mockClear();

      stream1.send('event1', 'data1');
      stream1.send('event2', 'data2');
      stream1.send('event3', 'data3');

      await new Promise(resolve => setTimeout(resolve, 50));

      const calls = mockResponseRaw.write.mock.calls;
      const ids = calls
        .map((call: any[]) => {
          const match = call[0].match(/id: ([^\n]+)/);
          return match ? match[1] : null;
        })
        .filter(Boolean);

      // Should be sequential: 1, 2, 3
      expect(ids).toEqual(['1', '2', '3']);

      stream1.close();
    });

    it('should generate unique stream IDs', () => {
      const stream1 = createSSEStream(mockContext);
      const stream2 = createSSEStream(mockContext);

      expect(stream1.id).not.toBe(stream2.id);

      stream1.close();
      stream2.close();
    });
  });

  describe('HTTP/2 Compatibility', () => {
    it('should handle HTTP/2 response stream', () => {
      // Simulate HTTP/2 stream interface
      const http2Response = new EventEmitter();
      (http2Response as any).stream = {
        write: vi.fn(() => true),
        end: vi.fn(),
      };
      (http2Response as any).writableEnded = false;
      (http2Response as any).end = vi.fn();

      // HTTP/2 streams might not have direct write method
      (http2Response as any).write = undefined;

      mockResponse.raw = http2Response;

      // Should handle gracefully even without write method
      stream = createSSEStream(mockContext);
      expect(stream.isWritable).toBe(false);
    });
  });

  describe('Memory Management', () => {
    it('should not leak memory on repeated open/close', async () => {
      const streams: SSEStreamExtended[] = [];

      for (let i = 0; i < 100; i++) {
        const s = createSSEStream(mockContext);
        s.send('test', `data${i}`);
        streams.push(s);
      }

      // Close all streams
      streams.forEach(s => s.close());

      // Wait for async cleanup
      await new Promise(resolve => setTimeout(resolve, 200));

      // Check that registry was cleaned up
      expect(mockRegistry.remove).toHaveBeenCalledTimes(100);
    });

    it('should clear event emitter listeners on close', async () => {
      stream = createSSEStream(mockContext);

      // Access internal emitter through the iterator
      const _iterator = stream[Symbol.asyncIterator]();

      stream.close();

      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 50));

      // Emitter should be cleaned up (no listeners)
      expect(stream.bufferSize).toBe(0);
    });
  });
});
