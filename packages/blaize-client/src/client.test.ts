import type { RouteMethodOptions } from '@blaizejs/types';

import { createClient } from './client';
import { makeRequest } from './request';

// Mock the request module
vi.mock('../src/request', () => ({
  makeRequest: vi.fn(),
}));

const mockMakeRequest = vi.mocked(makeRequest);

// Create properly typed mock route methods (same as before)
const mockGetUserRoute = {
  GET: {
    handler: async () => ({ user: { id: '123', name: 'John' } }),
    schema: {
      params: {} as any,
      response: {} as any,
    },
  } satisfies RouteMethodOptions,
  path: '/users/:userId',
} as const;

const mockCreateUserRoute = {
  POST: {
    handler: async () => ({ user: { id: '456', name: 'Jane' } }),
    schema: {
      body: {} as any,
      response: {} as any,
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
      const routes = { testRoute: mockGetUserRoute } as const;
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

      const routes = { testRoute: mockGetUserRoute } as const;
      const client = createClient(config, routes);
      expect(client).toBeDefined();
    });
  });

  describe('proxy client creation with type inference', () => {
    it('should infer types from route registry', () => {
      // Flat routes structure (what user provides)
      const routes = {
        getUser: mockGetUserRoute,
        createUser: mockCreateUserRoute,
      } as const;

      // TypeScript should infer the types automatically!
      const client = createClient('https://api.example.com', routes);

      // Test that route methods exist and are callable
      expect(typeof client.$get.getUser).toBe('function');
      expect(typeof client.$post.createUser).toBe('function');
    });

    it('should call makeRequest with correct parameters for GET', async () => {
      mockMakeRequest.mockResolvedValue({ user: { id: '123', name: 'John' } });

      const routes = {
        getUser: mockGetUserRoute,
      } as const;

      const client = createClient('https://api.example.com', routes);

      await client.$get.getUser({
        params: { userId: '123' },
        query: { include: 'profile' },
      });

      expect(mockMakeRequest).toHaveBeenCalledWith(
        { baseUrl: 'https://api.example.com', timeout: 5000 },
        'GET',
        'getUser',
        { params: { userId: '123' }, query: { include: 'profile' } },
        expect.objectContaining({
          $get: { getUser: mockGetUserRoute },
        })
      );
    });

    it('should call makeRequest with correct parameters for POST', async () => {
      mockMakeRequest.mockResolvedValue({ user: { id: '456', name: 'Jane' } });

      const routes = {
        createUser: mockCreateUserRoute,
      } as const;

      const client = createClient('https://api.example.com', routes);

      await client.$post.createUser({
        body: { name: 'John', email: 'john@example.com' },
      });

      expect(mockMakeRequest).toHaveBeenCalledWith(
        { baseUrl: 'https://api.example.com', timeout: 5000 },
        'POST',
        'createUser',
        { body: { name: 'John', email: 'john@example.com' } },
        expect.objectContaining({
          $post: { createUser: mockCreateUserRoute },
        })
      );
    });
  });
});
