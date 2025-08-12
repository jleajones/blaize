import { z } from 'zod';

import {
  CreateDeleteRoute,
  CreateGetRoute,
  CreateHeadRoute,
  CreateOptionsRoute,
  CreatePatchRoute,
  CreatePostRoute,
  CreatePutRoute,
  Route,
  RouteMethodOptions,
  Router,
} from '../../../blaize-types/src/index';

/**
 * Create a mock router for testing
 */
export function createMockRouter(): Router {
  return {
    handleRequest: vi.fn().mockResolvedValue(undefined),
    getRoutes: vi.fn().mockReturnValue([]),
    addRoute: vi.fn(),
    addRoutes: vi.fn().mockReturnValue({ added: [], removed: [], changed: [] }),
    addRouteDirectory: vi.fn().mockResolvedValue(undefined),
    getRouteConflicts: vi.fn().mockReturnValue([]),
    close: vi.fn().mockResolvedValue(undefined),
  };
}

/**
 * Create a mock route handler for testing
 * This eliminates the repeated createMockHandler pattern in router tests
 */
export function createMockRouteHandler(name: string): RouteMethodOptions {
  return {
    handler: vi.fn().mockResolvedValue({ message: `${name} handler` }),
    middleware: [],
    schema: {},
  };
}

/**
 * Create a complete Route object for testing
 * This eliminates repetitive route object creation
 */
export function createMockRoute(
  path: string,
  methods: Partial<
    Record<'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS', RouteMethodOptions>
  >
): Route {
  return {
    path,
    ...methods,
  } as Route;
}

/**
 * Create multiple routes for testing route addition/removal scenarios
 */
export function createMockRoutes(count: number, basePath = '/test'): Route[] {
  return Array.from({ length: count }, (_, index) =>
    createMockRoute(`${basePath}-${index + 1}`, {
      GET: createMockRouteHandler(`handler-${index + 1}`),
    })
  );
}

/**
 * Mock implementation of createGetRoute for testing
 * Matches the actual implementation's type signature
 */
export const mockGetRoute: CreateGetRoute = config => {
  const handler = config.handler || vi.fn().mockResolvedValue({ message: 'mock response' });

  return {
    GET: { ...config, handler } as any,
    path: '/mock/path',
  };
};

/**
 * Mock implementation of createPostRoute for testing
 * Matches the actual implementation's type signature
 */
export const mockPostRoute: CreatePostRoute = config => {
  const handler = config.handler || vi.fn().mockResolvedValue({ message: 'mock response' });

  return {
    POST: { ...config, handler } as any,
    path: '/mock/path',
  };
};

/**
 * Mock implementation of createPutRoute for testing
 * Matches the actual implementation's type signature
 */
export const mockPutRoute: CreatePutRoute = config => {
  const handler = config.handler || vi.fn().mockResolvedValue({ message: 'mock response' });

  return {
    PUT: { ...config, handler } as any,
    path: '/mock/path',
  };
};

/**
 * Mock implementation of createDeleteRoute for testing
 * Matches the actual implementation's type signature
 */
export const mockDeleteRoute: CreateDeleteRoute = config => {
  const handler = config.handler || vi.fn().mockResolvedValue({ message: 'mock response' });

  return {
    DELETE: { ...config, handler } as any,
    path: '/mock/path',
  };
};

/**
 * Mock implementation of createPatchRoute for testing
 * Matches the actual implementation's type signature
 */
export const mockPatchRoute: CreatePatchRoute = config => {
  const handler = config.handler || vi.fn().mockResolvedValue({ message: 'mock response' });

  return {
    PATCH: { ...config, handler } as any,
    path: '/mock/path',
  };
};

/**
 * Mock implementation of createHeadRoute for testing
 * Matches the actual implementation's type signature
 */
export const mockHeadRoute: CreateHeadRoute = config => {
  const handler = config.handler || vi.fn().mockResolvedValue({ message: 'mock response' });

  return {
    HEAD: { ...config, handler } as any,
    path: '/mock/path',
  };
};

/**
 * Mock implementation of createOptionsRoute for testing
 * Matches the actual implementation's type signature
 */
export const mockOptionsRoute: CreateOptionsRoute = config => {
  const handler = config.handler || vi.fn().mockResolvedValue({ message: 'mock response' });

  return {
    OPTIONS: { ...config, handler } as any,
    path: '/mock/path',
  };
};

/**
 * Helper to override the path for a mock route
 */
export function withPath<T extends { path: string }>(route: T, path: string): T {
  return { ...route, path };
}

/**
 * Create a set of commonly used mock routes for testing
 */
export function createMockRoutesSet() {
  return {
    // Route with no schemas - should not require arguments
    healthCheck: withPath(
      mockGetRoute({
        schema: {
          response: z.object({
            status: z.string(),
            timestamp: z.number(),
          }),
        },
        handler: async () => ({ status: 'ok', timestamp: Date.now() }),
      }),
      '/health'
    ),

    // Route with params only
    getUser: withPath(
      mockGetRoute({
        schema: {
          params: z.object({ userId: z.string() }),
          response: z.object({
            user: z.object({
              id: z.string(),
              name: z.string(),
              email: z.string().email(),
            }),
          }),
        },
        handler: async () => ({
          user: { id: '123', name: 'John Doe', email: 'john@example.com' },
        }),
      }),
      '/users/:userId'
    ),

    // Route with body only
    createUser: withPath(
      mockPostRoute({
        schema: {
          body: z.object({
            name: z.string(),
            email: z.string().email(),
          }),
          response: z.object({
            user: z.object({
              id: z.string(),
              name: z.string(),
              email: z.string().email(),
            }),
          }),
        },
        handler: async () => ({
          user: { id: '456', name: 'Jane Doe', email: 'jane@example.com' },
        }),
      }),
      '/users'
    ),

    // Route with query only
    listUsers: withPath(
      mockGetRoute({
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
            total: z.number(),
          }),
        },
        handler: async () => ({
          users: [],
          total: 0,
        }),
      }),
      '/users'
    ),

    // Route with all schemas
    updateUser: withPath(
      mockPutRoute({
        schema: {
          params: z.object({ userId: z.string() }),
          query: z.object({ notify: z.boolean().optional() }),
          body: z.object({
            name: z.string().optional(),
            email: z.string().email().optional(),
          }),
          response: z.object({
            user: z.object({
              id: z.string(),
              name: z.string(),
              email: z.string().email(),
            }),
          }),
        },
        handler: async () => ({
          user: { id: '123', name: 'John Updated', email: 'john.updated@example.com' },
        }),
      }),
      '/users/:userId'
    ),
  } as const;
}
