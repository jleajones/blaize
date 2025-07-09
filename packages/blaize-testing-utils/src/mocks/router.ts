import { Route, RouteMethodOptions, Router } from '../../../blaize-types/src/index';

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
