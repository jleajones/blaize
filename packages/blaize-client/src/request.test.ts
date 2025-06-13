import { makeRequest } from './request';

import type { ClientConfig } from '../../blaize-types/src/index';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('makeRequest', () => {
  const baseConfig: ClientConfig = {
    baseUrl: 'https://api.example.com',
    timeout: 5000,
  };

  // Create a basic mock route registry for tests that need it
  const createMockRegistry = (routeName: string, path: string, method: string = 'GET') => ({
    [`$${method.toLowerCase()}`]: {
      [routeName]: {
        [method]: { handler: async () => ({}) },
        path,
      },
    },
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('URL construction and path extraction', () => {
    it('should extract path from route registry and build URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ user: { id: '123' } }),
      });

      const mockRouteRegistry = createMockRegistry('getUser', '/users/:userId');

      await makeRequest(
        baseConfig,
        'GET',
        'getUser',
        { params: { userId: '123' } },
        mockRouteRegistry
      );

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/users/123',
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    it('should handle routes without parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ users: [] }),
      });

      const mockRouteRegistry = createMockRegistry('getAllUsers', '/users');

      await makeRequest(baseConfig, 'GET', 'getAllUsers', undefined, mockRouteRegistry);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/users',
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    it('should throw error when route not found in registry', async () => {
      const mockRouteRegistry = createMockRegistry('otherRoute', '/other');

      await expect(
        makeRequest(baseConfig, 'GET', 'nonExistentRoute', undefined, mockRouteRegistry)
      ).rejects.toThrow("Route 'nonExistentRoute' not found for method 'GET'");
    });
  });

  describe('request options preparation', () => {
    it('should set correct headers for GET request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const mockRouteRegistry = createMockRegistry('test', '/test');

      await makeRequest(baseConfig, 'GET', 'test', undefined, mockRouteRegistry);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          body: undefined,
        })
      );
    });

    it('should include custom headers from config', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const configWithHeaders = {
        ...baseConfig,
        defaultHeaders: {
          Authorization: 'Bearer token123',
          'X-Custom-Header': 'custom-value',
        },
      };

      const mockRouteRegistry = createMockRegistry('test', '/test');

      await makeRequest(configWithHeaders, 'GET', 'test', undefined, mockRouteRegistry);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer token123',
            'X-Custom-Header': 'custom-value',
          },
        })
      );
    });

    it('should include body for POST request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const mockRouteRegistry = createMockRegistry('createUser', '/users', 'POST');

      await makeRequest(
        baseConfig,
        'POST',
        'createUser',
        {
          body: { name: 'John', email: 'john@example.com' },
        },
        mockRouteRegistry
      );

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'John', email: 'john@example.com' }),
        })
      );
    });

    it('should not include body for GET request even if provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const mockRouteRegistry = createMockRegistry('getUser', '/users/:id');

      await makeRequest(
        baseConfig,
        'GET',
        'getUser',
        { body: { shouldBeIgnored: true } },
        mockRouteRegistry
      );

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'GET',
          body: undefined,
        })
      );
    });
  });

  describe('response handling', () => {
    it('should return parsed JSON for successful response', async () => {
      const responseData = { user: { id: '123', name: 'John' } };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(responseData),
      });

      const mockRouteRegistry = createMockRegistry('getUser', '/users/:id');

      const result = await makeRequest(baseConfig, 'GET', 'getUser', undefined, mockRouteRegistry);

      expect(result).toEqual(responseData);
    });

    it('should throw ClientError for 4xx responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const mockRouteRegistry = createMockRegistry('getUser', '/users/:id');

      await expect(
        makeRequest(baseConfig, 'GET', 'getUser', undefined, mockRouteRegistry)
      ).rejects.toThrow('HTTP 404: Not Found');
    });

    it('should throw ClientError for 5xx responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const mockRouteRegistry = createMockRegistry('getUser', '/users/:id');

      await expect(
        makeRequest(baseConfig, 'GET', 'getUser', undefined, mockRouteRegistry)
      ).rejects.toThrow('HTTP 500: Internal Server Error');
    });

    it('should throw NetworkError for fetch failures', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network connection failed'));

      const mockRouteRegistry = createMockRegistry('getUser', '/users/:id');

      await expect(
        makeRequest(baseConfig, 'GET', 'getUser', undefined, mockRouteRegistry)
      ).rejects.toThrow('Network request failed');
    });
  });

  describe('edge cases', () => {
    it('should handle undefined args', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const mockRouteRegistry = createMockRegistry('test', '/test');

      await makeRequest(baseConfig, 'GET', 'test', undefined, mockRouteRegistry);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          method: 'GET',
        })
      );
    });
  });
});
