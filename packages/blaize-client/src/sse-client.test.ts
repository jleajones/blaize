import { createSSEClient } from './sse-client';

import type { EventSourceFactory } from './sse-client';
/**
 * Helper to wait for next tick in the event loop
 * Using setTimeout for browser compatibility (setImmediate doesn't exist in browsers)
 */
function nextTick(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

/**
 * Create a mock EventSource factory for testing
 */
function createMockEventSourceFactory() {
  // Use Sets to handle multiple handlers per event
  const handlers: { [key: string]: Set<EventListener> } = {};
  let currentReadyState = 0;

  // Create the mock methods with vi.fn() so they're spies
  const closeFn = vi.fn(() => {
    currentReadyState = 2; // CLOSED
  });

  const addEventListenerFn = vi.fn((event: string, handler: EventListener) => {
    if (!handlers[event]) {
      handlers[event] = new Set();
    }
    handlers[event].add(handler);
  });

  const removeEventListenerFn = vi.fn((event: string, handler: EventListener) => {
    handlers[event]?.delete(handler);
  });

  // Create mockEventSource that will be returned by factory.create
  let mockEventSource: EventSource | null = null;

  const factory: EventSourceFactory = {
    create: vi.fn((url: string, options?: EventSourceInit) => {
      // Reset state for new connection
      currentReadyState = 0; // CONNECTING

      mockEventSource = {
        addEventListener: addEventListenerFn,
        removeEventListener: removeEventListenerFn,
        close: closeFn,
        onopen: null as any,
        onerror: null as any,
        onmessage: null as any,
        get readyState() {
          return currentReadyState;
        },
        url,
        withCredentials: options?.withCredentials || false,
        CONNECTING: 0,
        OPEN: 1,
        CLOSED: 2,
      } as unknown as EventSource;

      return mockEventSource;
    }),
  };

  return {
    factory,
    getMockEventSource: () => mockEventSource,
    handlers,
    closeFn, // Export the spy directly for assertions
    addEventListenerFn,
    removeEventListenerFn,
    triggerOpen: () => {
      currentReadyState = 1; // OPEN
      const openHandlers = handlers['open'];
      if (openHandlers) {
        const event = new Event('open');
        openHandlers.forEach(handler => {
          handler(event);
        });
      }
    },
    triggerError: () => {
      const errorHandlers = handlers['error'];
      if (errorHandlers) {
        const event = new Event('error');
        errorHandlers.forEach(handler => {
          handler(event);
        });
      }
    },
    triggerMessage: (data: any, lastEventId?: string) => {
      if (mockEventSource && mockEventSource.onmessage) {
        const event = new MessageEvent('message', {
          data: typeof data === 'string' ? data : JSON.stringify(data),
          lastEventId,
        });
        mockEventSource.onmessage(event);
      }
    },
    triggerCustomEvent: (eventName: string, data: any) => {
      const customHandlers = handlers[eventName];
      if (customHandlers) {
        const event = new MessageEvent(eventName, {
          data: typeof data === 'string' ? data : JSON.stringify(data),
        });
        customHandlers.forEach(handler => {
          handler(event);
        });
      }
    },
    getReadyState: () => currentReadyState,
    clearHandlers: () => {
      Object.keys(handlers).forEach(key => {
        delete handlers[key];
      });
    },
  };
}

describe('SSE Client Tests', () => {
  let mockFactory: ReturnType<typeof createMockEventSourceFactory>;
  let clients: Array<{ close: () => void }> = [];

  beforeEach(() => {
    mockFactory = createMockEventSourceFactory();
    clients = [];
    vi.clearAllTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up all clients
    clients.forEach(client => {
      try {
        client.close();
      } catch {
        // Ignore cleanup errors
      }
    });
    clients = [];
    mockFactory.clearHandlers();
    vi.clearAllTimers();
    vi.clearAllMocks();
  });

  describe('Connection Management', () => {
    it('should successfully connect with immediate open', async () => {
      const { factory, triggerOpen } = mockFactory;

      // Create client promise
      const clientPromise = createSSEClient('http://localhost/events', {}, factory);

      // Wait for event loop to process the addEventListener calls
      await nextTick();

      // Trigger open event
      triggerOpen();

      const client = await clientPromise;
      clients.push(client);

      expect(client).toBeDefined();
      expect(client.state).toBe('connected');
      expect(factory.create).toHaveBeenCalledWith(
        expect.stringContaining('/events'),
        expect.objectContaining({ withCredentials: false })
      );
    });

    it('should successfully connect with delayed open', async () => {
      const { factory, triggerOpen } = mockFactory;

      const clientPromise = createSSEClient('http://localhost/events', {}, factory);

      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 50));

      // Trigger open event
      triggerOpen();

      const client = await clientPromise;
      clients.push(client);

      expect(client.state).toBe('connected');
    });

    it('should handle connection errors properly', async () => {
      const { factory, triggerError } = mockFactory;

      const clientPromise = createSSEClient('http://localhost/events', {}, factory);

      // Wait for event listeners to be set up
      await nextTick();

      // Trigger error instead of open
      triggerError();

      await expect(clientPromise).rejects.toThrow('SSE connection error');
    });

    it('should handle connection timeout', async () => {
      const { factory } = mockFactory;

      // Don't trigger any events - let it timeout
      await expect(
        createSSEClient('http://localhost/events', { connectionTimeout: 100 }, factory)
      ).rejects.toThrow('SSE connection timeout');
    });

    it('should skip waiting with waitForConnection: false', async () => {
      const { factory, triggerOpen } = mockFactory;

      const client = await createSSEClient(
        'http://localhost/events',
        { waitForConnection: false },
        factory
      );
      clients.push(client);

      // Client returned immediately, should be connecting
      expect(client.state).toBe('connecting');

      // Wait for event listeners to be set up
      await nextTick();

      // Now trigger open to actually connect
      triggerOpen();

      // Wait for state to update
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(client.state).toBe('connected');
    });

    it('should properly clean up on close', async () => {
      const { factory, triggerOpen, closeFn } = mockFactory;

      const clientPromise = createSSEClient('http://localhost/events', {}, factory);

      await nextTick();
      triggerOpen();

      const client = await clientPromise;

      client.close();

      expect(client.state).toBe('closed');
      expect(closeFn).toHaveBeenCalled(); // Use the spy directly
    });
  });

  describe('Message Handling', () => {
    it('should handle message events', async () => {
      const { factory, triggerOpen, triggerMessage } = mockFactory;

      const clientPromise = createSSEClient('http://localhost/events', {}, factory);

      await nextTick();
      triggerOpen();

      const client = await clientPromise;
      clients.push(client);

      const messageHandler = vi.fn();
      client.on('message', messageHandler);

      // Trigger a message
      triggerMessage({ test: 'data' }, '123');

      expect(messageHandler).toHaveBeenCalledWith({ test: 'data' });
      expect(client.lastEventId).toBe('123');
    });

    it('should handle custom event types', async () => {
      const { factory, triggerOpen, triggerCustomEvent } = mockFactory;

      const clientPromise = createSSEClient<{ update: { id: string } }>(
        'http://localhost/events',
        {},
        factory
      );

      await nextTick();
      triggerOpen();

      const client = await clientPromise;
      clients.push(client);

      const updateHandler = vi.fn();
      client.on('update', updateHandler);

      // Wait for handler to be registered
      await nextTick();

      // Trigger custom event
      triggerCustomEvent('update', { id: 'abc123' });

      expect(updateHandler).toHaveBeenCalledWith({ id: 'abc123' });
    });

    it('should handle once event listeners', async () => {
      const { factory, triggerOpen, triggerMessage } = mockFactory;

      const clientPromise = createSSEClient('http://localhost/events', {}, factory);

      await nextTick();
      triggerOpen();

      const client = await clientPromise;
      clients.push(client);

      const messageHandler = vi.fn();
      client.once('message', messageHandler);

      // Trigger multiple messages
      triggerMessage({ test: 'data1' });
      triggerMessage({ test: 'data2' });

      // Handler should only be called once
      expect(messageHandler).toHaveBeenCalledTimes(1);
      expect(messageHandler).toHaveBeenCalledWith({ test: 'data1' });
    });

    it('should remove event listeners', async () => {
      const { factory, triggerOpen, triggerMessage } = mockFactory;

      const clientPromise = createSSEClient('http://localhost/events', {}, factory);

      await nextTick();
      triggerOpen();

      const client = await clientPromise;
      clients.push(client);

      const messageHandler = vi.fn();
      client.on('message', messageHandler);

      // Trigger first message
      triggerMessage({ test: 'data1' });
      expect(messageHandler).toHaveBeenCalledTimes(1);

      // Remove handler
      client.off('message', messageHandler);

      // Trigger second message
      triggerMessage({ test: 'data2' });

      // Handler should not be called again
      expect(messageHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('Heartbeat Monitoring', () => {
    it('should handle heartbeat timeout', async () => {
      vi.useFakeTimers();

      try {
        const { factory, triggerOpen } = mockFactory;

        const clientPromise = createSSEClient(
          'http://localhost/events',
          { heartbeatTimeout: 5000 },
          factory
        );

        // Use Promise.resolve for fake timers compatibility
        await Promise.resolve();
        triggerOpen();

        const client = await clientPromise;
        clients.push(client);

        const errorHandler = vi.fn();
        client.on('error', errorHandler);

        // Advance time beyond heartbeat timeout
        await vi.advanceTimersByTimeAsync(5001);

        expect(errorHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining('heartbeat timeout'),
          })
        );
      } finally {
        vi.useRealTimers();
      }
    });

    it('should reset heartbeat on message received', async () => {
      vi.useFakeTimers();

      try {
        const { factory, triggerOpen, triggerMessage } = mockFactory;

        const clientPromise = createSSEClient(
          'http://localhost/events',
          { heartbeatTimeout: 5000 },
          factory
        );

        await Promise.resolve();
        triggerOpen();

        const client = await clientPromise;
        clients.push(client);

        const errorHandler = vi.fn();
        client.on('error', errorHandler);

        // Advance time, but not past timeout
        await vi.advanceTimersByTimeAsync(3000);

        // Receive a message, which should reset heartbeat
        triggerMessage({ ping: 'pong' });

        // Advance time again (3000ms more)
        await vi.advanceTimersByTimeAsync(3000);

        // Total time is 6000ms, but heartbeat was reset at 3000ms
        // So effective time since last event is only 3000ms
        expect(errorHandler).not.toHaveBeenCalled();

        // Now advance past heartbeat timeout from last message
        await vi.advanceTimersByTimeAsync(2001);

        // Now it should timeout
        expect(errorHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining('heartbeat timeout'),
          })
        );
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('Error Conditions', () => {
    it('should throw error when EventSource is not available', async () => {
      const orig = window.EventSource;
      delete (window as any).EventSource;

      await expect(createSSEClient('http://localhost/events', {}, undefined)).rejects.toThrow(
        /SSE is not supported|Browser does not support/
      );

      (window as any).EventSource = orig;
    });

    it('should throw error for invalid URL', async () => {
      await expect(createSSEClient('', {}, mockFactory.factory)).rejects.toThrow(
        'SSE URL is required'
      );
    });

    it('should handle multiple handlers for same event', async () => {
      const { factory, triggerOpen, triggerMessage } = mockFactory;

      const clientPromise = createSSEClient('http://localhost/events', {}, factory);

      await nextTick();
      triggerOpen();

      const client = await clientPromise;
      clients.push(client);

      const handler1 = vi.fn();
      const handler2 = vi.fn();

      client.on('message', handler1);
      client.on('message', handler2);

      triggerMessage({ test: 'data' });

      expect(handler1).toHaveBeenCalledWith({ test: 'data' });
      expect(handler2).toHaveBeenCalledWith({ test: 'data' });
    });
  });

  describe('Options Handling', () => {
    it('should respect withCredentials option', async () => {
      const { factory, triggerOpen } = mockFactory;

      const clientPromise = createSSEClient(
        'http://localhost/events',
        { withCredentials: true },
        factory
      );

      await nextTick();
      triggerOpen();

      const client = await clientPromise;
      clients.push(client);

      expect(factory.create).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ withCredentials: true })
      );
    });

    it('should not auto-parse JSON when parseJSON is false', async () => {
      const { factory, triggerOpen, triggerMessage } = mockFactory;

      const clientPromise = createSSEClient(
        'http://localhost/events',
        { parseJSON: false },
        factory
      );

      await nextTick();
      triggerOpen();

      const client = await clientPromise;
      clients.push(client);

      const messageHandler = vi.fn();
      client.on('message', messageHandler);

      // Send JSON string that should NOT be parsed
      triggerMessage('{"test":"data"}');

      expect(messageHandler).toHaveBeenCalledWith('{"test":"data"}');
    });

    it('should handle non-JSON data gracefully', async () => {
      const { factory, triggerOpen, triggerMessage } = mockFactory;

      const clientPromise = createSSEClient('http://localhost/events', {}, factory);

      await nextTick();
      triggerOpen();

      const client = await clientPromise;
      clients.push(client);

      const messageHandler = vi.fn();
      client.on('message', messageHandler);

      // Send non-JSON string
      triggerMessage('plain text message');

      // Should receive the plain text as-is
      expect(messageHandler).toHaveBeenCalledWith('plain text message');
    });
  });
});

/**
 * Helper to setup SSE mock for external use
 */
export function setupSSEMock() {
  return createMockEventSourceFactory();
}
