import { z } from 'zod';

import { createClient } from './client';
import { makeRequest } from './request';

// Mock the request module
vi.mock('./request', () => ({
  makeRequest: vi.fn(),
}));

vi.mock('./sse-connection', () => ({
  createSSEConnection: vi.fn(),
}));

const mockMakeRequest = vi.mocked(makeRequest);

// ============================================
// MOCK ROUTES - Simplified structure
// ============================================

// Define routes directly with the expected structure
const mockRoutes = {
  getUser: {
    path: '/users/:userId',
    GET: {
      handler: vi.fn().mockResolvedValue({ user: { id: '123', name: 'John' } }),
      schema: {
        params: z.object({ userId: z.string() }),
        response: z.object({
          user: z.object({
            id: z.string(),
            name: z.string(),
          }),
        }),
      },
    },
  },
  createUser: {
    path: '/users',
    POST: {
      handler: vi.fn().mockResolvedValue({ user: { id: '456', name: 'Jane' } }),
      schema: {
        body: z.object({
          name: z.string(),
          email: z.string().email(),
        }),
        response: z.object({
          user: z.object({
            id: z.string(),
            name: z.string(),
          }),
        }),
      },
    },
  },
  healthCheck: {
    path: '/health',
    GET: {
      handler: vi.fn().mockResolvedValue({ status: 'ok' }),
      schema: {
        response: z.object({
          status: z.string(),
        }),
      },
    },
  },
  updateUser: {
    path: '/users/:userId',
    PUT: {
      handler: vi.fn().mockResolvedValue({ success: true }),
      schema: {
        params: z.object({ userId: z.string() }),
        query: z.object({ notify: z.boolean().optional() }),
        body: z.object({ name: z.string(), email: z.string() }),
        response: z.object({ success: z.boolean() }),
      },
    },
  },
  listUsers: {
    path: '/users',
    GET: {
      handler: vi.fn().mockResolvedValue({ users: [] }),
      schema: {
        query: z.object({
          page: z.number().optional(),
          limit: z.number().optional(),
          sort: z.enum(['asc', 'desc']).optional(),
        }),
        response: z.object({
          users: z.array(
            z.object({
              id: z.string(),
              name: z.string(),
            })
          ),
        }),
      },
    },
  },
} as const;

describe('createClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('configuration processing', () => {
    it('should accept string baseUrl', () => {
      const routes = { testRoute: mockRoutes.getUser };
      const client = createClient('https://api.example.com', routes);
      expect(client).toBeDefined();
      expect(client.$get).toBeDefined();
    });

    it('should accept configuration object', () => {
      const config = {
        baseUrl: 'https://api.example.com',
        timeout: 10000,
        defaultHeaders: { Authorization: 'Bearer token' },
      };

      const routes = { testRoute: mockRoutes.getUser };
      const client = createClient(config, routes);
      expect(client).toBeDefined();
    });

    it('should normalize baseUrl by removing trailing slash', () => {
      const routes = { testRoute: mockRoutes.getUser };

      // Test with trailing slash
      const client1 = createClient('https://api.example.com/', routes);
      expect(client1).toBeDefined();

      // Both should result in same normalized config
      mockMakeRequest.mockResolvedValue({ user: { id: '123', name: 'John' } });
      client1.$get.testRoute({
        params: { userId: '123' },
        query: {} as any,
        body: {} as any,
        files: {} as any,
      });

      expect(mockMakeRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          baseUrl: 'https://api.example.com', // No trailing slash
        }),
        expect.any(String),
        expect.any(String),
        expect.any(Object),
        expect.any(Object)
      );
    });
  });

  describe('proxy client creation with type inference', () => {
    it('should infer types from route registry', () => {
      const routes = {
        getUser: mockRoutes.getUser,
        createUser: mockRoutes.createUser,
        healthCheck: mockRoutes.healthCheck,
      };

      const client = createClient('https://api.example.com', routes);

      // Test that route methods exist and are callable
      expect(typeof client.$get.getUser).toBe('function');
      expect(typeof client.$post.createUser).toBe('function');
      expect(typeof client.$get.healthCheck).toBe('function');
    });

    it('should organize routes by HTTP method', () => {
      const routes = {
        getUser: mockRoutes.getUser,
        listUsers: mockRoutes.listUsers,
        createUser: mockRoutes.createUser,
        updateUser: mockRoutes.updateUser,
        healthCheck: mockRoutes.healthCheck,
      };

      const client = createClient('https://api.example.com', routes);

      // GET routes should be under $get
      expect(client.$get.getUser).toBeDefined();
      expect(client.$get.listUsers).toBeDefined();
      expect(client.$get.healthCheck).toBeDefined();

      // POST routes should be under $post
      expect(client.$post.createUser).toBeDefined();

      // PUT routes should be under $put
      expect(client.$put.updateUser).toBeDefined();
    });
  });

  describe('request handling with different schema combinations', () => {
    it('should handle route with no schemas (no arguments required)', async () => {
      mockMakeRequest.mockResolvedValue({ status: 'ok' });

      const routes = {
        healthCheck: mockRoutes.healthCheck,
      };

      const client = createClient('https://api.example.com', routes);

      // Should work without any arguments since only response schema is defined
      await client.$get.healthCheck({
        params: {} as any,
        query: {} as any,
        body: {} as any,
        files: {} as any,
      });

      expect(mockMakeRequest).toHaveBeenCalledWith(
        {
          baseUrl: 'https://api.example.com',
          timeout: 5000,
          sse: {
            // Add SSE config to the expectation
            reconnect: {
              enabled: true,
              maxAttempts: 5,
              initialDelay: 1000,
            },
            heartbeatTimeout: 30000,
            parseJSON: true,
          },
        },
        'GET',
        'healthCheck',
        {
          params: {} as any,
          query: {} as any,
          body: {} as any,
          files: {} as any,
        }, // Empty object when no args provided
        expect.objectContaining({
          $get: { healthCheck: mockRoutes.healthCheck },
        })
      );
    });

    it('should handle route with only params', async () => {
      mockMakeRequest.mockResolvedValue({ user: { id: '123', name: 'John' } });

      const routes = {
        getUser: mockRoutes.getUser,
      };

      const client = createClient('https://api.example.com', routes);

      await client.$get.getUser({
        params: { userId: '123' },
        query: {} as any,
        body: {} as any,
        files: {} as any,
      });

      expect(mockMakeRequest).toHaveBeenCalledWith(
        {
          baseUrl: 'https://api.example.com',
          timeout: 5000,
          sse: {
            // Add SSE config to the expectation
            reconnect: {
              enabled: true,
              maxAttempts: 5,
              initialDelay: 1000,
            },
            heartbeatTimeout: 30000,
            parseJSON: true,
          },
        },
        'GET',
        'getUser',
        { params: { userId: '123' }, query: {} as any, body: {} as any, files: {} as any },
        expect.objectContaining({
          $get: { getUser: mockRoutes.getUser },
        })
      );
    });

    it('should handle route with only body', async () => {
      mockMakeRequest.mockResolvedValue({ user: { id: '456', name: 'Jane' } });

      const routes = {
        createUser: mockRoutes.createUser,
      };

      const client = createClient('https://api.example.com', routes);

      await client.$post.createUser({
        body: { name: 'John', email: 'john@example.com' },
        params: {} as any,
        query: {} as any,
        files: {} as any,
      });

      expect(mockMakeRequest).toHaveBeenCalledWith(
        {
          baseUrl: 'https://api.example.com',
          timeout: 5000,
          sse: {
            // Add SSE config to the expectation
            reconnect: {
              enabled: true,
              maxAttempts: 5,
              initialDelay: 1000,
            },
            heartbeatTimeout: 30000,
            parseJSON: true,
          },
        },
        'POST',
        'createUser',
        {
          body: { name: 'John', email: 'john@example.com' },
          params: {} as any,
          query: {} as any,
          files: {} as any,
        },
        expect.objectContaining({
          $post: { createUser: mockRoutes.createUser },
        })
      );
    });

    it('should handle route with only query', async () => {
      mockMakeRequest.mockResolvedValue({ users: [] });

      const routes = {
        listUsers: mockRoutes.listUsers,
      };

      const client = createClient('https://api.example.com', routes);

      await client.$get.listUsers({
        query: { page: 1, limit: 10, sort: 'asc' },
        params: {} as any,
        body: {} as any,
        files: {} as any,
      });

      expect(mockMakeRequest).toHaveBeenCalledWith(
        {
          baseUrl: 'https://api.example.com',
          timeout: 5000,
          sse: {
            // Add SSE config to the expectation
            reconnect: {
              enabled: true,
              maxAttempts: 5,
              initialDelay: 1000,
            },
            heartbeatTimeout: 30000,
            parseJSON: true,
          },
        },
        'GET',
        'listUsers',
        {
          query: { page: 1, limit: 10, sort: 'asc' },
          params: {} as any,
          body: {} as any,
          files: {} as any,
        },
        expect.objectContaining({
          $get: { listUsers: mockRoutes.listUsers },
        })
      );
    });

    it('should handle route with all schemas (params, query, body)', async () => {
      mockMakeRequest.mockResolvedValue({ success: true });

      const routes = {
        updateUser: mockRoutes.updateUser,
      };

      const client = createClient('https://api.example.com', routes);

      await client.$put.updateUser({
        params: { userId: '123' },
        query: { notify: true },
        body: { name: 'John Updated', email: 'john.updated@example.com' },
        files: {} as any,
      });

      expect(mockMakeRequest).toHaveBeenCalledWith(
        {
          baseUrl: 'https://api.example.com',
          timeout: 5000,
          sse: {
            // Add SSE config to the expectation
            reconnect: {
              enabled: true,
              maxAttempts: 5,
              initialDelay: 1000,
            },
            heartbeatTimeout: 30000,
            parseJSON: true,
          },
        },
        'PUT',
        'updateUser',
        {
          params: { userId: '123' },
          query: { notify: true },
          body: { name: 'John Updated', email: 'john.updated@example.com' },
          files: {},
        },
        expect.objectContaining({
          $put: { updateUser: mockRoutes.updateUser },
        })
      );
    });
  });

  describe('error handling', () => {
    it('should throw error for invalid route registry', () => {
      expect(() => {
        // @ts-expect-error - Testing runtime validation
        createClient('https://api.example.com', null);
      }).toThrow('Route registry is required and must be an object');

      expect(() => {
        // @ts-expect-error - Testing runtime validation
        createClient('https://api.example.com', undefined);
      }).toThrow('Route registry is required and must be an object');
    });

    it('should handle routes with invalid structure gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const routes = {
        validRoute: mockRoutes.healthCheck,
        invalidRoute: null,
        anotherInvalid: 'not-a-route',
        alsoInvalid: { notAnHttpMethod: {} },
      } as any;

      const client = createClient('https://api.example.com', routes);

      // Valid route should work
      // @ts-expect-error - Testing runtime validation
      expect(client.$get.validRoute).toBeDefined();

      // Invalid routes should be skipped
      // @ts-expect-error - Testing runtime validation
      expect(client.$get.invalidRoute).toBeUndefined();

      // Should have warned about invalid routes
      expect(consoleSpy).toHaveBeenCalledWith('Skipping invalid route: invalidRoute');
      expect(consoleSpy).toHaveBeenCalledWith('Skipping invalid route: anotherInvalid');

      consoleSpy.mockRestore();
    });
  });

  describe('type safety', () => {
    it('should maintain type safety for responses', async () => {
      const typedResponse = { user: { id: '123', name: 'John' } };
      mockMakeRequest.mockResolvedValue(typedResponse);

      const routes = {
        getUser: mockRoutes.getUser,
      };

      const client = createClient('https://api.example.com', routes);
      const result = await client.$get.getUser({
        params: { userId: '123' },
        query: {} as any,
        body: {} as any,
        files: {} as any,
      });

      // TypeScript should know the shape of result
      expect(result).toEqual(typedResponse);
      expect(result.user.id).toBe('123');
      expect(result.user.name).toBe('John');
    });
  });
});
