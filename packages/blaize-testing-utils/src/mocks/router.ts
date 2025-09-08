import { z } from 'zod';

import type {
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
  State,
  Services,
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
 * Now returns a function that accepts state/services generics
 */
export const mockGetRoute: CreateGetRoute = <
  _TState extends State = State,
  _TServices extends Services = Services,
>() => {
  return (config: any) => {
    const handler = config.handler || vi.fn().mockResolvedValue({ message: 'mock response' });

    return {
      GET: { ...config, handler } as any,
      path: '/mock/path',
    };
  };
};

/**
 * Mock implementation of createPostRoute for testing
 * Now returns a function that accepts state/services generics
 */
export const mockPostRoute: CreatePostRoute = <
  _TState extends State = State,
  _TServices extends Services = Services,
>() => {
  return (config: any) => {
    const handler = config.handler || vi.fn().mockResolvedValue({ message: 'mock response' });

    return {
      POST: { ...config, handler } as any,
      path: '/mock/path',
    };
  };
};

/**
 * Mock implementation of createPutRoute for testing
 * Now returns a function that accepts state/services generics
 */
export const mockPutRoute: CreatePutRoute = <
  _TState extends State = State,
  _TServices extends Services = Services,
>() => {
  return (config: any) => {
    const handler = config.handler || vi.fn().mockResolvedValue({ message: 'mock response' });

    return {
      PUT: { ...config, handler } as any,
      path: '/mock/path',
    };
  };
};

/**
 * Mock implementation of createDeleteRoute for testing
 * Now returns a function that accepts state/services generics
 */
export const mockDeleteRoute: CreateDeleteRoute = <
  _TState extends State = State,
  _TServices extends Services = Services,
>() => {
  return (config: any) => {
    const handler = config.handler || vi.fn().mockResolvedValue({ message: 'mock response' });

    return {
      DELETE: { ...config, handler } as any,
      path: '/mock/path',
    };
  };
};

/**
 * Mock implementation of createPatchRoute for testing
 * Now returns a function that accepts state/services generics
 */
export const mockPatchRoute: CreatePatchRoute = <
  _TState extends State = State,
  _TServices extends Services = Services,
>() => {
  return (config: any) => {
    const handler = config.handler || vi.fn().mockResolvedValue({ message: 'mock response' });

    return {
      PATCH: { ...config, handler } as any,
      path: '/mock/path',
    };
  };
};

/**
 * Mock implementation of createHeadRoute for testing
 * Now returns a function that accepts state/services generics
 */
export const mockHeadRoute: CreateHeadRoute = <
  _TState extends State = State,
  _TServices extends Services = Services,
>() => {
  return (config: any) => {
    const handler = config.handler || vi.fn().mockResolvedValue({ message: 'mock response' });

    return {
      HEAD: { ...config, handler } as any,
      path: '/mock/path',
    };
  };
};

/**
 * Mock implementation of createOptionsRoute for testing
 * Now returns a function that accepts state/services generics
 */
export const mockOptionsRoute: CreateOptionsRoute = <
  _TState extends State = State,
  _TServices extends Services = Services,
>() => {
  return (config: any) => {
    const handler = config.handler || vi.fn().mockResolvedValue({ message: 'mock response' });

    return {
      OPTIONS: { ...config, handler } as any,
      path: '/mock/path',
    };
  };
};

/**
 * Helper to override the path for a mock route
 */
export function withPath<T extends { path: string }>(route: T, path: string): T {
  return { ...route, path };
}

/**
 * Mock route factory for testing - matches the real createRouteFactory
 * Usage: const routes = createMockRouteFactory<TestState, TestServices>();
 */
export function createMockRouteFactory<
  TState extends State = State,
  TServices extends Services = Services,
>() {
  return {
    get: mockGetRoute<TState, TServices>(),
    post: mockPostRoute<TState, TServices>(),
    put: mockPutRoute<TState, TServices>(),
    delete: mockDeleteRoute<TState, TServices>(),
    patch: mockPatchRoute<TState, TServices>(),
    head: mockHeadRoute<TState, TServices>(),
    options: mockOptionsRoute<TState, TServices>(),
  } as const;
}

/**
 * Create a set of commonly used mock routes for testing
 * Now uses the updated mock route creators with state/services support
 */
export function createMockRoutesSet() {
  // Create route creators with default state/services
  const routes = createMockRouteFactory();

  return {
    // Route with no schemas - should not require arguments
    healthCheck: withPath(
      routes.get({
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
      routes.get({
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
      routes.post({
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
      routes.get({
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
      routes.put({
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

/**
 * Test helper: Create mock routes with custom state/services types
 * Useful for testing type-safe route handlers
 */
export function createTypedMockRoutesSet<
  TState extends State = State,
  TServices extends Services = Services,
>() {
  const routes = createMockRouteFactory<TState, TServices>();

  return {
    typedRoute: routes.get({
      schema: {
        response: z.object({
          success: z.boolean(),
        }),
      },
      handler: async () => {
        // ctx.state and ctx.services will be typed as TState and TServices
        return { success: true };
      },
    }),
  };
}

/**
 * Test helper: Create a route that uses state and services
 * For testing middleware/plugin integration
 */
export function createStateAwareRoute<
  TState extends State = State,
  TServices extends Services = Services,
>(stateKey: keyof TState, serviceKey: keyof TServices) {
  const routes = createMockRouteFactory<TState, TServices>();

  return routes.get({
    schema: {
      response: z.object({
        stateValue: z.unknown(),
        serviceExists: z.boolean(),
      }),
    },
    handler: async ctx => {
      return {
        stateValue: ctx.state[stateKey],
        serviceExists: serviceKey in ctx.services,
      };
    },
  });
}
