import { RouteMethodOptions } from '@blaizejs/types';

import { createClient } from './client';
import { makeRequest } from '../src/request';

// Mock the request module
vi.mock('../src/request', () => ({
  makeRequest: vi.fn(),
}));

const mockMakeRequest = vi.mocked(makeRequest);

// Create properly typed mock route methods
const mockGetUserRoute = {
  GET: {
    handler: async () => ({ user: { id: '123', name: 'John' } }),
    schema: {
      params: {} as any, // Mock Zod schema
      response: {} as any, // Mock Zod schema
    },
  } satisfies RouteMethodOptions,
  path: '/users/:userId',
} as const;

const mockCreateUserRoute = {
  POST: {
    handler: async () => ({ user: { id: '456', name: 'Jane' } }),
    schema: {
      body: {} as any, // Mock Zod schema
      response: {} as any, // Mock Zod schema
    },
  } satisfies RouteMethodOptions,
  path: '/users',
} as const;

// Create properly typed mock route
const mockGetAllUsersRoute = {
  GET: {
    handler: async () => ({ users: [] }),
    schema: {
      response: {} as any, // Mock Zod schema
    },
  } satisfies RouteMethodOptions,
  path: '/users',
} as const;

describe('createClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('configuration processing', () => {
    it('should accept string baseUrl', () => {
      const client = createClient('https://api.example.com');
      expect(client).toBeDefined();
      expect(client.$get).toBeDefined();
    });

    it('should accept configuration object', () => {
      const config = {
        baseUrl: 'https://api.example.com',
        timeout: 10000,
        defaultHeaders: { Authorization: 'Bearer token' },
      };

      const client = createClient(config);
      expect(client).toBeDefined();
    });
  });

  describe('proxy client creation', () => {
    it('should create client with HTTP method properties', () => {
      const client = createClient('https://api.example.com');

      expect(client.$get).toBeDefined();
      expect(client.$post).toBeDefined();
      expect(client.$put).toBeDefined();
      expect(client.$delete).toBeDefined();
      expect(client.$patch).toBeDefined();
    });

    it('should create callable route methods from registry', () => {
      // Use BuildRoutesRegistry type to get the right structure
      type MockAppRoutes = {
        $get: { getUser: typeof mockGetUserRoute };
        $post: { createUser: typeof mockCreateUserRoute };
      };

      const client = createClient<MockAppRoutes>('https://api.example.com', {
        $get: { getUser: mockGetUserRoute },
        $post: { createUser: mockCreateUserRoute },
      });

      // Test that route methods exist and are callable
      expect(typeof client.$get.getUser).toBe('function');
      expect(typeof client.$post.createUser).toBe('function');
    });

    it('should call makeRequest with correct parameters for GET', async () => {
      mockMakeRequest.mockResolvedValue({ user: { id: '123', name: 'John' } });

      type MockAppRoutes = {
        $get: { getUser: typeof mockGetUserRoute };
      };

      const mockRouteRegistry = {
        $get: { getUser: mockGetUserRoute },
      };

      const client = createClient<MockAppRoutes>('https://api.example.com', mockRouteRegistry);

      await client.$get.getUser({
        params: { userId: '123' },
        query: { include: 'profile' },
      });

      expect(mockMakeRequest).toHaveBeenCalledWith(
        { baseUrl: 'https://api.example.com', timeout: 5000 }, // config
        'GET', // method
        'getUser', // routeName
        { params: { userId: '123' }, query: { include: 'profile' } }, // args
        mockRouteRegistry // routeRegistry
      );
    });

    it('should call makeRequest with correct parameters for POST', async () => {
      mockMakeRequest.mockResolvedValue({ success: true, data: {} });

      // Use BuildRoutesRegistry type to get the right structure
      type MockAppRoutes = {
        $post: { createUser: typeof mockCreateUserRoute };
      };

      const mockRouteRegistry = {
        $post: { createUser: mockCreateUserRoute },
      };

      const client = createClient<MockAppRoutes>('https://api.example.com', {
        $post: { createUser: mockCreateUserRoute },
      });

      await client.$post.createUser({
        body: { name: 'John', email: 'john@example.com' },
      });

      expect(mockMakeRequest).toHaveBeenCalledWith(
        { baseUrl: 'https://api.example.com', timeout: 5000 },
        'POST',
        'createUser',
        { body: { name: 'John', email: 'john@example.com' } },
        mockRouteRegistry
      );
    });

    it('should handle calls without arguments', async () => {
      mockMakeRequest.mockResolvedValue({ success: true, data: {} });

      // Use BuildRoutesRegistry type to get the right structure
      type MockAppRoutes = {
        $get: { getAllUsers: typeof mockGetAllUsersRoute };
      };

      const mockRouteRegistry = {
        $get: { getAllUsers: mockGetAllUsersRoute },
      };

      const client = createClient<MockAppRoutes>('https://api.example.com', {
        $get: { getAllUsers: mockGetAllUsersRoute },
      });

      await client.$get.getAllUsers();

      expect(mockMakeRequest).toHaveBeenCalledWith(
        { baseUrl: 'https://api.example.com', timeout: 5000 },
        'GET',
        'getAllUsers',
        undefined,
        mockRouteRegistry
      );
    });
  });

  describe('error handling', () => {
    it('should propagate errors from makeRequest', async () => {
      const error = new Error('Network error');
      mockMakeRequest.mockRejectedValue(error);

      type MockAppRoutes = {
        $get: { getUser: typeof mockGetUserRoute };
      };

      const mockRouteRegistry = {
        $get: { getUser: mockGetUserRoute },
      };

      const client = createClient<MockAppRoutes>('https://api.example.com', mockRouteRegistry);

      await expect(client.$get.getUser({ params: { userId: '123' } })).rejects.toThrow(
        'Network error'
      );
    });
  });
});
