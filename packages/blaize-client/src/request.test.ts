import { NetworkError } from './errors/network-error';
import { ParseError } from './errors/parse-error';
import { TimeoutError } from './errors/timeout-error';
import { makeRequest } from './request';
import { BlaizeError, ErrorType, type ClientConfig } from '../../blaize-types/src/index';

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
    test('should extract path from route registry and build URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ user: { id: '123' } }),
        headers: {
          get: () => null,
        },
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
          headers: expect.objectContaining({
            'x-correlation-id': expect.stringMatching(/^client_[a-z0-9]+_[a-z0-9]+$/),
          }),
        })
      );
    });

    test('should handle routes without parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ users: [] }),
        headers: {
          get: () => null,
        },
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

    test('should throw BlaizeError when route not found in registry', async () => {
      const mockRouteRegistry = createMockRegistry('otherRoute', '/other');

      await expect(
        makeRequest(baseConfig, 'GET', 'nonExistentRoute', undefined, mockRouteRegistry)
      ).rejects.toThrow("Route 'nonExistentRoute' not found for method 'GET'");

      // Verify it's transformed to a BlaizeError
      try {
        await makeRequest(baseConfig, 'GET', 'nonExistentRoute', undefined, mockRouteRegistry);
      } catch (error) {
        expect((error as BlaizeError).correlationId).toMatch(/^client_[a-z0-9]+_[a-z0-9]+$/);
      }
    });
  });

  describe('request options preparation', () => {
    test('should set correct headers for GET request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
        headers: {
          get: () => null,
        },
      });

      const mockRouteRegistry = createMockRegistry('test', '/test');

      await makeRequest(baseConfig, 'GET', 'test', undefined, mockRouteRegistry);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'x-correlation-id': expect.stringMatching(/^client_[a-z0-9]+_[a-z0-9]+$/),
          }),
          body: undefined,
        })
      );
    });

    test('should include custom headers from config', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
        headers: {
          get: () => null,
        },
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
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer token123',
            'X-Custom-Header': 'custom-value',
            'x-correlation-id': expect.stringMatching(/^client_[a-z0-9]+_[a-z0-9]+$/),
          }),
        })
      );
    });

    test('should include body for POST request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
        headers: {
          get: () => null,
        },
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

    test('should not include body for GET request even if provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
        headers: {
          get: () => null,
        },
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

    test('should handle other HTTP methods correctly', async () => {
      const testMethods = [
        { method: 'PUT', shouldHaveBody: true },
        { method: 'PATCH', shouldHaveBody: true },
        { method: 'DELETE', shouldHaveBody: false },
        { method: 'HEAD', shouldHaveBody: false },
        { method: 'OPTIONS', shouldHaveBody: false },
      ];

      for (const { method, shouldHaveBody } of testMethods) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({}),
          headers: {
            get: () => null,
          },
        });

        const mockRouteRegistry = createMockRegistry('testRoute', '/test', method);
        const testBody = { test: 'data' };

        await makeRequest(baseConfig, method, 'testRoute', { body: testBody }, mockRouteRegistry);

        expect(mockFetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            method,
            body: shouldHaveBody ? JSON.stringify(testBody) : undefined,
          })
        );
      }
    });
  });

  describe('response handling', () => {
    test('should return parsed JSON for successful response', async () => {
      const responseData = { user: { id: '123', name: 'John' } };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(responseData),
        headers: {
          get: () => null,
        },
      });

      const mockRouteRegistry = createMockRegistry('getUser', '/users/:id');

      const result = await makeRequest(baseConfig, 'GET', 'getUser', undefined, mockRouteRegistry);

      expect(result).toEqual(responseData);
    });

    test('should throw BlaizeError for 4xx responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        url: 'https://api.example.com/users/999',
        headers: {
          get: (key: string) => (key === 'x-correlation-id' ? 'server_123' : null),
        },
        json: () => Promise.resolve({ error: 'User not found' }),
      });

      const mockRouteRegistry = createMockRegistry('getUser', '/users/:id');

      try {
        await makeRequest(
          baseConfig,
          'GET',
          'getUser',
          { params: { id: '999' } },
          mockRouteRegistry
        );
        throw new Error('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(BlaizeError);
        expect((error as BlaizeError).status).toBe(404);
        expect((error as BlaizeError).correlationId).toBe('server_123');
      }
    });

    test('should throw BlaizeError for 5xx responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        url: 'https://api.example.com/users/123',
        headers: {
          get: (key: string) => (key === 'x-correlation-id' ? 'server_456' : null),
        },
        json: () => Promise.resolve({ error: 'Database connection failed' }),
      });

      const mockRouteRegistry = createMockRegistry('getUser', '/users/:id');

      try {
        await makeRequest(
          baseConfig,
          'GET',
          'getUser',
          { params: { id: '123' } },
          mockRouteRegistry
        );
        throw new Error('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(BlaizeError);
        expect((error as BlaizeError).status).toBe(500);
        expect((error as BlaizeError).correlationId).toBe('server_456');
      }
    });

    test('should parse server BlaizeError responses correctly', async () => {
      const serverErrorResponse = {
        type: ErrorType.VALIDATION_ERROR,
        title: 'Validation failed',
        status: 400,
        correlationId: 'server_789',
        timestamp: new Date().toISOString(),
        details: {
          fields: [{ field: 'email', messages: ['Invalid email format'] }],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        url: 'https://api.example.com/users',
        headers: {
          get: (key: string) => (key === 'x-correlation-id' ? 'server_789' : null),
        },
        json: () => Promise.resolve(serverErrorResponse),
      });

      const mockRouteRegistry = createMockRegistry('createUser', '/users', 'POST');

      try {
        await makeRequest(
          baseConfig,
          'POST',
          'createUser',
          { body: { email: 'invalid-email' } },
          mockRouteRegistry
        );
        throw new Error('Should have thrown');
      } catch (error) {
        const bE = error as BlaizeError;
        expect(bE.type).toBe(ErrorType.VALIDATION_ERROR);
        expect(bE.message).toBe('Validation failed');
        expect(bE.status).toBe(400);
        expect(bE.correlationId).toBe('server_789');
        expect(bE.details).toEqual(serverErrorResponse.details);
      }
    });

    test('should throw NetworkError for fetch failures', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      const mockRouteRegistry = createMockRegistry('getUser', '/users/:id');

      try {
        await makeRequest(
          baseConfig,
          'GET',
          'getUser',
          { params: { id: '123' } },
          mockRouteRegistry
        );
        throw new Error('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(NetworkError);
        expect((error as NetworkError).details!.originalError.message).toBe('Failed to fetch');
        expect((error as NetworkError).correlationId).toMatch(/^client_[a-z0-9]+_[a-z0-9]+$/);
      }
    });

    test('should throw NetworkError with proper context for network failures', async () => {
      mockFetch.mockRejectedValueOnce(
        new TypeError('NetworkError when attempting to fetch resource')
      );

      const mockRouteRegistry = createMockRegistry('getUser', '/users/:id');

      try {
        await makeRequest(
          baseConfig,
          'GET',
          'getUser',
          { params: { id: '123' } },
          mockRouteRegistry
        );
        throw new Error('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(NetworkError);
        expect((error as NetworkError).details!.url).toContain('https://api.example.com');
        expect((error as NetworkError).details!.method).toBe('GET');
        expect((error as NetworkError).details!.correlationId).toMatch(
          /^client_[a-z0-9]+_[a-z0-9]+$/
        );
      }
    });

    test('should throw TimeoutError for AbortError', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValueOnce(abortError);

      const mockRouteRegistry = createMockRegistry('getUser', '/users/:id');

      try {
        await makeRequest(
          baseConfig,
          'GET',
          'getUser',
          { params: { id: '123' } },
          mockRouteRegistry
        );
        throw new Error('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(TimeoutError);
        expect((error as TimeoutError).details!.timeoutType).toBe('request');
        expect((error as TimeoutError).correlationId).toMatch(/^client_[a-z0-9]+_[a-z0-9]+$/);
      }
    });

    test('should throw ParseError for JSON parsing failures', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        url: 'https://api.example.com/users/123',
        headers: {
          get: (key: string) => (key === 'content-type' ? 'application/json' : null),
        },
        json: () => Promise.reject(new SyntaxError('Unexpected token < in JSON at position 0')),
      });

      const mockRouteRegistry = createMockRegistry('getUser', '/users/:id');

      try {
        await makeRequest(
          baseConfig,
          'GET',
          'getUser',
          { params: { id: '123' } },
          mockRouteRegistry
        );
        throw new Error('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ParseError);
        expect((error as ParseError).details!.expectedFormat).toBe('json');
        expect((error as ParseError).details!.statusCode).toBe(200);
        expect((error as ParseError).correlationId).toMatch(/^client_[a-z0-9]+_[a-z0-9]+$/);
      }
    });
  });

  describe('edge cases', () => {
    test('should handle undefined args', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
        headers: {
          get: () => null,
        },
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

    test('should handle empty route registry', async () => {
      try {
        await makeRequest(baseConfig, 'GET', 'anyRoute', undefined, {});
        throw new Error('Should have thrown');
      } catch (error) {
        expect((error as BlaizeError).message).toContain(
          "Route 'anyRoute' not found for method 'GET'"
        );
        expect((error as BlaizeError).correlationId).toMatch(/^client_[a-z0-9]+_[a-z0-9]+$/);
      }
    });

    test('should handle null route registry', async () => {
      try {
        await makeRequest(baseConfig, 'GET', 'anyRoute', undefined, null);
        throw new Error('Should have thrown');
      } catch (error) {
        expect((error as BlaizeError).message).toContain(
          "Route 'anyRoute' not found for method 'GET'"
        );
        expect((error as BlaizeError).correlationId).toMatch(/^client_[a-z0-9]+_[a-z0-9]+$/);
      }
    });

    test('should handle null route registry', async () => {
      try {
        await makeRequest(baseConfig, 'GET', 'anyRoute', undefined, null);
        throw new Error('Should have thrown');
      } catch (error) {
        expect((error as BlaizeError).message).toContain(
          "Route 'anyRoute' not found for method 'GET'"
        );
        expect((error as BlaizeError).correlationId).toMatch(/^client_[a-z0-9]+_[a-z0-9]+$/);
      }
    });

    test('should preserve correlation IDs from server responses', async () => {
      const serverCorrelationId = 'server_abc123_def456';

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        url: 'https://api.example.com/users/999',
        headers: {
          get: (key: string) => (key === 'x-correlation-id' ? serverCorrelationId : null),
        },
        json: () => Promise.resolve({ error: 'Not found' }),
      });

      const mockRouteRegistry = createMockRegistry('getUser', '/users/:id');

      try {
        await makeRequest(
          baseConfig,
          'GET',
          'getUser',
          { params: { id: '999' } },
          mockRouteRegistry
        );
        throw new Error('Should have thrown');
      } catch (error) {
        expect((error as BlaizeError).correlationId).toBe(serverCorrelationId);
      }
    });

    test('should generate unique correlation IDs for each request', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
        headers: {
          get: () => null,
        },
      });

      const mockRouteRegistry = createMockRegistry('test', '/test');

      // Make multiple requests
      await makeRequest(baseConfig, 'GET', 'test', undefined, mockRouteRegistry);
      await makeRequest(baseConfig, 'GET', 'test', undefined, mockRouteRegistry);

      const calls = mockFetch.mock.calls;
      const correlationId1 = calls[0]![1].headers['x-correlation-id'];
      const correlationId2 = calls[1]![1].headers['x-correlation-id'];

      expect(correlationId1).toMatch(/^client_[a-z0-9]+_[a-z0-9]+$/);
      expect(correlationId2).toMatch(/^client_[a-z0-9]+_[a-z0-9]+$/);
      expect(correlationId1).not.toBe(correlationId2);
    });
  });

  describe('error type consistency', () => {
    test('all errors should be BlaizeError instances or subclasses', async () => {
      const errorScenarios = [
        // Network error
        () => mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch')),
        // Timeout error
        () => {
          const abortError = new Error('AbortError');
          abortError.name = 'AbortError';
          mockFetch.mockRejectedValueOnce(abortError);
        },
        // HTTP error
        () =>
          mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
            url: 'https://api.example.com/test',
            headers: {
              get: () => null,
            },
            json: () => Promise.resolve({ error: 'Server error' }),
          }),
        // Parse error
        () =>
          mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            url: 'https://api.example.com/test',
            headers: {
              get: () => null,
            },
            json: () => Promise.reject(new SyntaxError('Unexpected token')),
          }),
      ];

      const mockRouteRegistry = createMockRegistry('test', '/test');

      for (const setupError of errorScenarios) {
        setupError();

        try {
          await makeRequest(baseConfig, 'GET', 'test', undefined, mockRouteRegistry);
          throw new Error('Should have thrown');
        } catch (error) {
          // All errors should be BlaizeError instances or subclasses
          expect(
            error instanceof BlaizeError ||
              error instanceof NetworkError ||
              error instanceof TimeoutError ||
              error instanceof ParseError
          ).toBe(true);

          // All should have correlation IDs
          expect((error as BlaizeError).correlationId).toBeDefined();
          expect(typeof (error as BlaizeError).correlationId).toBe('string');
        }
      }
    });
  });
});
