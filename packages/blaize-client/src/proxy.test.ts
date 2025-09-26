/**
 * Proxy SSE Enhancement Tests
 * Location: packages/blaize-client/src/proxy.browser.test.ts
 */

import { buildProxyClient } from './proxy';
import { createSSEConnection } from './sse-connection';

import type { ClientConfig } from '@blaize-types/client';

// Mock SSE connection module
vi.mock('./sse-connection', () => ({
  createSSEConnection: vi.fn(),
}));

// Mock the request module
vi.mock('./request', () => ({
  makeRequest: vi.fn(),
}));

const mockCreateSSEConnection = vi.mocked(createSSEConnection);

describe('Proxy SSE Support', () => {
  const baseConfig: ClientConfig = {
    baseUrl: 'https://api.example.com',
    timeout: 5000,
    defaultHeaders: {
      Authorization: 'Bearer token',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock EventSource on window for jsdom environment
    // This tells the proxy that we're in a browser environment with SSE support
    if (typeof window !== 'undefined') {
      (window as any).EventSource = class MockEventSource {
        constructor(
          public url: string,
          public options?: any
        ) {}
        close() {}
        addEventListener() {}
        removeEventListener() {}
      };
    }
  });

  afterEach(() => {
    // Clean up the mock
    if (typeof window !== 'undefined') {
      delete (window as any).EventSource;
    }
  });

  describe('SSE namespace detection', () => {
    test('should create $sse namespace when SSE routes exist', () => {
      const rawRoutes = {
        notifications: {
          path: '/notifications',
          SSE: {
            handler: vi.fn(),
            events: {
              message: { content: 'string' },
              alert: { level: 'string', text: 'string' },
            },
          },
        },
        regularRoute: {
          path: '/regular',
          GET: {
            handler: vi.fn(),
          },
        },
      };

      const httpRegistry = {
        $get: {
          regularRoute: rawRoutes.regularRoute,
        },
      };

      const client = buildProxyClient(baseConfig, httpRegistry, rawRoutes) as any;

      // Should have both $get and $sse namespaces
      expect(client.$get).toBeDefined();
      expect(client.$sse).toBeDefined();
      expect(client.$sse.notifications).toBeDefined();
      expect(typeof client.$sse.notifications).toBe('function');
    });

    test('should not create $sse namespace when no SSE routes exist', () => {
      const rawRoutes = {
        regularRoute: {
          path: '/regular',
          GET: {
            handler: vi.fn(),
          },
        },
      };

      const httpRegistry = {
        $get: {
          regularRoute: rawRoutes.regularRoute,
        },
      };

      const client = buildProxyClient(baseConfig, httpRegistry, rawRoutes) as any;

      expect(client.$get).toBeDefined();
      expect(client.$sse.anyRoute).toBeUndefined();
    });
  });

  describe('SSE connection creation', () => {
    test('should create SSE connection with correct URL and options', async () => {
      const mockSSEClient = {
        on: vi.fn(),
        off: vi.fn(),
        once: vi.fn(),
        close: vi.fn(),
        state: 'connected' as const,
        metrics: {
          eventsReceived: 0,
          bytesReceived: 0,
          connectionDuration: 0,
          reconnectAttempts: 0,
        },
      };

      mockCreateSSEConnection.mockResolvedValue(mockSSEClient);

      const rawRoutes = {
        notifications: {
          path: '/notifications',
          SSE: {
            handler: vi.fn(),
          },
        },
      };

      const client = buildProxyClient(baseConfig, {}, rawRoutes) as any;

      const sseClient = await client.$sse.notifications();

      expect(mockCreateSSEConnection).toHaveBeenCalledWith(
        'https://api.example.com/notifications',
        expect.objectContaining({
          headers: {
            Authorization: 'Bearer token',
          },
        })
      );

      expect(sseClient).toBe(mockSSEClient);
    });

    test('should handle path parameters in SSE routes', async () => {
      const mockSSEClient = {
        on: vi.fn(),
        off: vi.fn(),
        once: vi.fn(),
        close: vi.fn(),
        state: 'connected' as const,
        metrics: {
          eventsReceived: 0,
          bytesReceived: 0,
          connectionDuration: 0,
          reconnectAttempts: 0,
        },
      };

      mockCreateSSEConnection.mockResolvedValue(mockSSEClient);

      const rawRoutes = {
        userEvents: {
          path: '/users/:userId/events',
          SSE: {
            handler: vi.fn(),
          },
        },
      };

      const client = buildProxyClient(baseConfig, {}, rawRoutes) as any;

      await client.$sse.userEvents({
        params: { userId: '123' },
      });

      expect(mockCreateSSEConnection).toHaveBeenCalledWith(
        'https://api.example.com/users/123/events',
        expect.any(Object)
      );
    });

    test('should handle query parameters in SSE routes', async () => {
      const mockSSEClient = {
        on: vi.fn(),
        off: vi.fn(),
        once: vi.fn(),
        close: vi.fn(),
        state: 'connected' as const,
        metrics: {
          eventsReceived: 0,
          bytesReceived: 0,
          connectionDuration: 0,
          reconnectAttempts: 0,
        },
      };

      mockCreateSSEConnection.mockResolvedValue(mockSSEClient);

      const rawRoutes = {
        liveStream: {
          path: '/stream',
          SSE: {
            handler: vi.fn(),
          },
        },
      };

      const client = buildProxyClient(baseConfig, {}, rawRoutes) as any;

      await client.$sse.liveStream({
        query: {
          room: 'general',
          limit: 100,
          filter: undefined, // Should be ignored
        },
      });

      expect(mockCreateSSEConnection).toHaveBeenCalledWith(
        'https://api.example.com/stream?room=general&limit=100',
        expect.any(Object)
      );
    });

    test('should merge custom options with default headers', async () => {
      const mockSSEClient = {
        on: vi.fn(),
        off: vi.fn(),
        once: vi.fn(),
        close: vi.fn(),
        state: 'connected' as const,
        metrics: {
          eventsReceived: 0,
          bytesReceived: 0,
          connectionDuration: 0,
          reconnectAttempts: 0,
        },
      };

      mockCreateSSEConnection.mockResolvedValue(mockSSEClient);

      const rawRoutes = {
        events: {
          path: '/events',
          SSE: {
            handler: vi.fn(),
          },
        },
      };

      const client = buildProxyClient(baseConfig, {}, rawRoutes) as any;

      await client.$sse.events({
        options: {
          headers: {
            'X-Custom-Header': 'custom-value',
          },
          withCredentials: true,
          reconnect: {
            enabled: true,
            maxAttempts: 10,
          },
        },
      });

      expect(mockCreateSSEConnection).toHaveBeenCalledWith(
        'https://api.example.com/events',
        expect.objectContaining({
          headers: {
            Authorization: 'Bearer token',
            'X-Custom-Header': 'custom-value',
          },
          withCredentials: true,
          reconnect: {
            enabled: true,
            maxAttempts: 10,
          },
        })
      );
    });

    test('should handle routes with bracket notation parameters', async () => {
      const mockSSEClient = {
        on: vi.fn(),
        off: vi.fn(),
        once: vi.fn(),
        close: vi.fn(),
        state: 'connected' as const,
        metrics: {
          eventsReceived: 0,
          bytesReceived: 0,
          connectionDuration: 0,
          reconnectAttempts: 0,
        },
      };

      mockCreateSSEConnection.mockResolvedValue(mockSSEClient);

      const rawRoutes = {
        channelEvents: {
          path: '/channels/[channelId]/events',
          SSE: {
            handler: vi.fn(),
          },
        },
      };

      const client = buildProxyClient(baseConfig, {}, rawRoutes) as any;

      await client.$sse.channelEvents({
        params: { channelId: 'abc-123' },
      });

      expect(mockCreateSSEConnection).toHaveBeenCalledWith(
        'https://api.example.com/channels/abc-123/events',
        expect.any(Object)
      );
    });
  });

  describe('Type safety', () => {
    test('should return undefined for non-existent SSE routes', () => {
      const rawRoutes = {
        notifications: {
          path: '/notifications',
          SSE: {
            handler: vi.fn(),
          },
        },
      };

      const client = buildProxyClient(baseConfig, {}, rawRoutes) as any;

      expect(client.$sse.notifications).toBeDefined();
      expect(client.$sse.nonExistent).toBeUndefined();
    });

    test('should maintain separation between HTTP and SSE routes', () => {
      const rawRoutes = {
        users: {
          path: '/users',
          GET: {
            handler: vi.fn(),
          },
          SSE: {
            handler: vi.fn(),
          },
        },
      };

      const httpRegistry = {
        $get: {
          users: rawRoutes.users,
        },
      };

      const client = buildProxyClient(baseConfig, httpRegistry, rawRoutes) as any;

      // Both should be available
      expect(client.$get.users).toBeDefined();
      expect(client.$sse.users).toBeDefined();

      // They should be different functions
      expect(client.$get.users).not.toBe(client.$sse.users);
    });
  });

  describe('Error handling', () => {
    test('should handle SSE connection errors', async () => {
      const connectionError = new Error('Failed to establish SSE connection');
      mockCreateSSEConnection.mockRejectedValue(connectionError);

      const rawRoutes = {
        brokenStream: {
          path: '/broken',
          SSE: {
            handler: vi.fn(),
          },
        },
      };

      const client = buildProxyClient(baseConfig, {}, rawRoutes) as any;

      await expect(client.$sse.brokenStream()).rejects.toThrow(
        'Failed to establish SSE connection'
      );
    });

    test('should handle invalid route paths gracefully', async () => {
      const mockSSEClient = {
        on: vi.fn(),
        off: vi.fn(),
        once: vi.fn(),
        close: vi.fn(),
        state: 'connected' as const,
        metrics: {
          eventsReceived: 0,
          bytesReceived: 0,
          connectionDuration: 0,
          reconnectAttempts: 0,
        },
      };

      mockCreateSSEConnection.mockResolvedValue(mockSSEClient);

      const rawRoutes = {
        noPath: {
          // Missing path, should fallback to /noPath
          SSE: {
            handler: vi.fn(),
          },
        },
      };

      const client = buildProxyClient(baseConfig, {}, rawRoutes) as any;

      await client.$sse.noPath();

      expect(mockCreateSSEConnection).toHaveBeenCalledWith(
        'https://api.example.com/noPath',
        expect.any(Object)
      );
    });

    test('should throw error when EventSource is not available', async () => {
      // Remove EventSource to test error handling
      delete (window as any).EventSource;

      const rawRoutes = {
        events: {
          path: '/events',
          SSE: {
            handler: vi.fn(),
          },
        },
      };

      const client = buildProxyClient(baseConfig, {}, rawRoutes) as any;

      await expect(client.$sse.events()).rejects.toThrow(/SSE requires the EventSource API/);

      // Restore mock for other tests
      (window as any).EventSource = class MockEventSource {};
    });
  });
});
