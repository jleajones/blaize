// Mock dependencies for the new registry-based architecture
vi.mock('./discovery', () => ({
  findRoutes: vi.fn(),
}));

vi.mock('./discovery/watchers', () => ({
  watchRoutes: vi.fn(),
}));

vi.mock('./discovery/parallel', () => ({
  loadInitialRoutesParallel: vi.fn(),
}));

vi.mock('./discovery/cache', () => ({
  clearFileCache: vi.fn(),
}));

vi.mock('./discovery/profiler', () => ({
  withPerformanceTracking: vi.fn(fn => fn), // Pass through function, don't add timing
}));

vi.mock('./handlers', () => ({
  executeHandler: vi.fn().mockImplementation(() => Promise.resolve()),
}));

vi.mock('./matching', () => ({
  createMatcher: vi.fn(() => ({
    add: vi.fn(),
    match: vi.fn(),
    remove: vi.fn(),
    clear: vi.fn(),
  })),
}));

vi.mock('./registry/fast-registry', () => ({
  createRouteRegistry: vi.fn(),
  updateRoutesFromFile: vi.fn(),
  getAllRoutesFromRegistry: vi.fn(),
}));

vi.mock('./utils/matching-helpers', () => ({
  addRouteToMatcher: vi.fn(),
  removeRouteFromMatcher: vi.fn(),
  updateRouteInMatcher: vi.fn(),
}));

import { createMockEventBus, createMockLogger } from '@blaizejs/testing-utils';

import { findRoutes } from './discovery';
import { clearFileCache } from './discovery/cache';
import { loadInitialRoutesParallel } from './discovery/parallel';
import { withPerformanceTracking } from './discovery/profiler';
import { watchRoutes } from './discovery/watchers';
import { executeHandler } from './handlers';
import { createMatcher } from './matching';
import {
  createRouteRegistry,
  updateRoutesFromFile,
  getAllRoutesFromRegistry,
} from './registry/fast-registry';
import { createRouter } from './router';
import {
  addRouteToMatcher,
  removeRouteFromMatcher,
  updateRouteInMatcher,
} from './utils/matching-helpers';
import { ErrorType } from '../../../blaize-types/src';
import { NotFoundError } from '../errors/not-found-error';

import type { TypedEventBus, EventSchemas } from '@blaize-types';
import type { Context } from '@blaize-types/context';
import type { RouteMethodOptions, Route, RouterOptions } from '@blaize-types/router';

describe('Router', () => {
  // Setup common mocks and fixtures
  let mockMatcher: {
    add: ReturnType<typeof vi.fn>;
    match: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
  };

  let mockRegistry: ReturnType<typeof createRouteRegistry>;
  let mockRoutes: Route[];
  let mockContext: Context;
  let mockWatcher: any;
  let mockEventBus: TypedEventBus<EventSchemas>;

  beforeEach(() => {
    // Setup fake timers
    vi.useFakeTimers();
    // Reset all mocks
    vi.resetAllMocks();

    // Setup mock routes
    mockRoutes = [
      {
        path: '/users',
        GET: {
          handler: vi.fn(),
          middleware: [],
        },
        POST: {
          handler: vi.fn(),
          middleware: [],
        },
      },
      {
        path: '/users/:id',
        GET: {
          handler: vi.fn(),
          middleware: [],
        },
      },
    ];

    // Setup mock registry with proper structure
    mockRegistry = {
      routesByPath: new Map(),
      routesByFile: new Map(),
      pathToFile: new Map(),
    };
    (createRouteRegistry as ReturnType<typeof vi.fn>).mockReturnValue(mockRegistry);
    (updateRoutesFromFile as ReturnType<typeof vi.fn>).mockReturnValue({
      added: [mockRoutes[0]], // Default to adding the first route
      changed: [],
      removed: [],
    });
    (getAllRoutesFromRegistry as ReturnType<typeof vi.fn>).mockReturnValue(mockRoutes);

    // Setup mock matcher
    mockMatcher = {
      add: vi.fn(),
      match: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn(),
    };
    // Default matcher to return a successful match to avoid unintended 404s
    mockMatcher.match.mockReturnValue({
      route: { handler: vi.fn() } as unknown as RouteMethodOptions,
      params: {},
      methodNotAllowed: false,
    });
    (createMatcher as ReturnType<typeof vi.fn>).mockReturnValue(mockMatcher);

    // Setup discovery mocks
    (findRoutes as ReturnType<typeof vi.fn>).mockResolvedValue(mockRoutes);
    (loadInitialRoutesParallel as ReturnType<typeof vi.fn>).mockResolvedValue(mockRoutes);

    // Setup matching helpers mocks
    (addRouteToMatcher as ReturnType<typeof vi.fn>).mockImplementation(() => {});
    (removeRouteFromMatcher as ReturnType<typeof vi.fn>).mockImplementation(() => {});
    (updateRouteInMatcher as ReturnType<typeof vi.fn>).mockImplementation(() => {});

    // Setup mock watcher
    mockWatcher = {
      close: vi.fn(),
    };
    (watchRoutes as ReturnType<typeof vi.fn>).mockReturnValue(mockWatcher);

    // Setup mock context
    mockContext = {
      request: {
        method: 'PUT',
        path: '/users',
        params: {},
        header: vi.fn().mockReturnValue(undefined),
      },
      response: {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
        header: vi.fn().mockReturnThis(),
        sent: false,
      },
    } as unknown as Context;

    // Ensure executeHandler is properly mocked
    (executeHandler as any).mockImplementation(() => Promise.resolve());

    mockEventBus = createMockEventBus();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  test('creates router with default options', async () => {
    // Arrange
    const options: RouterOptions = {
      routesDir: './custom-routes',
    };

    // Act
    const router = createRouter(options);

    // Assert
    expect(router).toBeDefined();
    expect(router.handleRequest).toBeInstanceOf(Function);
    expect(router.getRoutes).toBeInstanceOf(Function);
    expect(router.addRoute).toBeInstanceOf(Function);

    // Verify registry was created
    expect(createRouteRegistry).toHaveBeenCalled();
  });

  test('initializes routes using parallel loading on creation', async () => {
    // Arrange & Act
    createRouter({ routesDir: './routes' });

    // Wait for initialization promise to resolve
    await vi.runAllTimersAsync();

    // Assert - should use parallel loading instead of findRoutes
    expect(loadInitialRoutesParallel).toHaveBeenCalledWith('./routes');
    expect(addRouteToMatcher).toHaveBeenCalled();
  });

  test('sets up file watcher in development mode', async () => {
    const mockLogger = createMockLogger();
    // Arrange
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    // Act
    const router = createRouter({
      routesDir: './routes',
      watchMode: true,
    });

    // Force initialization by handling a request
    await router.handleRequest(mockContext, mockLogger, mockEventBus);

    // Assert
    expect(watchRoutes).toHaveBeenCalled();
    expect(watchRoutes).toHaveBeenCalledWith(
      './routes',
      expect.objectContaining({
        debounceMs: 16, // New debounce setting
        ignore: ['node_modules', '.git'],
        onRouteAdded: expect.any(Function),
        onRouteChanged: expect.any(Function),
        onRouteRemoved: expect.any(Function),
        onError: expect.any(Function),
      })
    );

    // Cleanup
    process.env.NODE_ENV = originalNodeEnv;
  });

  test('does not set up file watcher in production mode', async () => {
    // Arrange
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    // Act
    createRouter({ routesDir: './routes', watchMode: false });

    // Wait for initialization promise to resolve
    await vi.runAllTimersAsync();

    // Assert
    expect(watchRoutes).not.toHaveBeenCalled();

    // Cleanup
    process.env.NODE_ENV = originalNodeEnv;
  });

  test('handles request with matching route', async () => {
    const mockLogger = createMockLogger();
    // Arrange
    const router = createRouter({ routesDir: './routes' });
    const matchResult = {
      route: { handler: vi.fn() } as unknown as RouteMethodOptions,
      params: { id: '123' },
      methodNotAllowed: false,
      allowedMethods: null,
    };
    mockMatcher.match.mockReturnValue(matchResult);

    // Act
    await router.handleRequest(mockContext, mockLogger, mockEventBus);

    // Assert
    expect(mockMatcher.match).toHaveBeenCalledWith('/users', 'PUT');
    expect(mockContext.request.params).toEqual({ id: '123' });
    expect(executeHandler).toHaveBeenCalledWith(
      mockContext,
      matchResult.route,
      matchResult.params,
      mockLogger,
      mockEventBus
    );
  });

  // ==========================================
  // NEW ERROR SYSTEM TESTS
  // ==========================================

  test('throws NotFoundError when no route matches (error boundary will catch)', async () => {
    const mockLogger = createMockLogger();
    // Arrange
    const router = createRouter({ routesDir: './routes' });
    mockMatcher.match.mockReturnValue(null);

    // Act & Assert - Router should throw error, not handle it manually
    await expect(router.handleRequest(mockContext, mockLogger, mockEventBus)).rejects.toThrow(
      NotFoundError
    );

    // Verify the thrown error has correct properties
    try {
      await router.handleRequest(mockContext, mockLogger, mockEventBus);
    } catch (error) {
      expect(error).toBeInstanceOf(NotFoundError);
      expect((error as NotFoundError).type).toBe(ErrorType.NOT_FOUND);
      expect((error as NotFoundError).title).toBe('Not found');
      expect((error as NotFoundError).status).toBe(404);
      // Note: correlationId will be 'unknown' since router doesn't have access to it
      expect((error as NotFoundError).correlationId).toBe('unknown');
    }

    // Verify no manual response was sent
    expect(executeHandler).not.toHaveBeenCalled();
  });

  test('handles 405 Method Not Allowed with manual response (TODO: should throw error)', async () => {
    const mockLogger = createMockLogger();
    // Arrange
    const router = createRouter({ routesDir: './routes' });
    mockMatcher.match.mockReturnValue({
      methodNotAllowed: true,
      allowedMethods: ['GET', 'POST'],
    });

    // Act
    await router.handleRequest(mockContext, mockLogger, mockEventBus);

    // Assert - Current implementation uses manual response (should be changed)
    expect(mockContext.response.status).toHaveBeenCalledWith(405);
    expect(mockContext.response.json).toHaveBeenCalledWith({
      error: '❌ Method Not Allowed',
      allowed: ['GET', 'POST'],
    });
    expect(mockContext.response.header).toHaveBeenCalledWith('Allow', 'GET, POST');
    expect(executeHandler).not.toHaveBeenCalled();
  });

  test('lets handler errors bubble up to error boundary (no try/catch)', async () => {
    const mockLogger = createMockLogger();
    // Arrange
    const router = createRouter({ routesDir: './routes' });
    const mockError = new Error('Handler failed');
    const matchResult = {
      route: { handler: vi.fn() } as unknown as RouteMethodOptions,
      params: { id: '123' },
      methodNotAllowed: false,
      allowedMethods: null,
    };
    mockMatcher.match.mockReturnValue(matchResult);
    (executeHandler as any).mockImplementation(() => Promise.reject(mockError));

    // Act & Assert - Router should let error bubble up, not catch it
    await expect(router.handleRequest(mockContext, mockLogger, mockEventBus)).rejects.toThrow(
      'Handler failed'
    );

    // Verify executeHandler was called
    expect(executeHandler).toHaveBeenCalledWith(
      mockContext,
      matchResult.route,
      matchResult.params,
      mockLogger,
      mockEventBus
    );
  });

  test('sets request params when route matches', async () => {
    const mockLogger = createMockLogger();
    // Arrange
    const router = createRouter({ routesDir: './routes' });
    const matchResult = {
      route: { handler: vi.fn() } as unknown as RouteMethodOptions,
      params: { userId: '123', orgId: '456' },
      methodNotAllowed: false,
      allowedMethods: null,
    };
    mockMatcher.match.mockReturnValue(matchResult);

    // Act
    await router.handleRequest(mockContext, mockLogger, mockEventBus);

    // Assert
    expect(mockContext.request.params).toEqual({ userId: '123', orgId: '456' });
    expect(executeHandler).toHaveBeenCalledWith(
      mockContext,
      matchResult.route,
      matchResult.params,
      mockLogger,
      mockEventBus
    );
  });

  test('initializes router during creation (not on first request)', async () => {
    const mockLogger = createMockLogger();
    // Arrange - Clear any previous calls
    vi.clearAllMocks();

    // Mock the initialization process
    (loadInitialRoutesParallel as ReturnType<typeof vi.fn>).mockResolvedValue(mockRoutes);

    // Act - Router initializes during creation
    const router = createRouter({ routesDir: './routes' });

    // Wait for async initialization to complete
    await vi.runAllTimersAsync();

    // Assert - Router should have initialized during creation
    expect(loadInitialRoutesParallel).toHaveBeenCalledWith('./routes');

    // Additional test: handling request should work without additional initialization
    await router.handleRequest(mockContext, mockLogger, mockEventBus);

    // Should not have called loadInitialRoutesParallel again
    expect(loadInitialRoutesParallel).toHaveBeenCalledTimes(1);
  });

  // ==========================================
  // REGISTRY AND ROUTE MANAGEMENT TESTS
  // ==========================================

  test('getRoutes returns routes from registry', async () => {
    // Arrange
    const router = createRouter({ routesDir: './routes' });

    // Wait for initialization promise to resolve
    await vi.runAllTimersAsync();

    // Act
    const routes = router.getRoutes();

    // Assert
    expect(getAllRoutesFromRegistry).toHaveBeenCalledWith(mockRegistry);
    expect(routes).toEqual(mockRoutes);
  });

  test('addRoute uses registry system', async () => {
    // Arrange
    const router = createRouter({ routesDir: './routes' });
    const newRoute: Route = {
      path: '/products',
      GET: {
        handler: vi.fn(),
      },
    };

    // Mock registry to return the new route as added
    (updateRoutesFromFile as ReturnType<typeof vi.fn>).mockReturnValue({
      added: [newRoute],
      changed: [],
      removed: [],
    });

    // Act
    router.addRoute(newRoute);

    // Assert
    expect(updateRoutesFromFile).toHaveBeenCalledWith(mockRegistry, 'programmatic', [newRoute]);
    expect(addRouteToMatcher).toHaveBeenCalledWith(newRoute, mockMatcher);
  });

  test('file watcher handles route additions with registry', async () => {
    // Arrange
    // Set up router with empty initial routes to avoid interference
    (loadInitialRoutesParallel as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    // Also ensure the default mockRoutes doesn't interfere
    (updateRoutesFromFile as ReturnType<typeof vi.fn>).mockReturnValue({
      added: [],
      changed: [],
      removed: [],
    });

    createRouter({ routesDir: './routes', watchMode: true });

    // Wait for initialization to complete with empty routes
    await vi.runAllTimersAsync();

    // Clear any initialization calls completely
    (updateRoutesFromFile as ReturnType<typeof vi.fn>).mockClear();
    (addRouteToMatcher as ReturnType<typeof vi.fn>).mockClear();

    // Get the onRouteAdded callback from the watcher setup
    const watchCallArgs = (watchRoutes as ReturnType<typeof vi.fn>).mock.calls[0];
    if (!watchCallArgs) {
      throw new Error('watchRoutes should have been called');
    }
    const onRouteAdded = watchCallArgs[1].onRouteAdded;

    // Create a new route to be added
    const newRoute: Route = {
      path: '/products',
      GET: {
        handler: vi.fn(),
      },
    };

    // Now mock registry to show our specific route was added
    (updateRoutesFromFile as ReturnType<typeof vi.fn>).mockReturnValue({
      added: [newRoute],
      changed: [],
      removed: [],
    });

    // Act
    // Simulate the file watcher calling onRouteAdded with the filepath and routes
    onRouteAdded('./routes/products.ts', [newRoute]); // <-- This is the correct call with filepath

    // Assert
    // The router's onRouteAdded callback should call updateRoutesFromFile with the filepath as source
    expect(updateRoutesFromFile).toHaveBeenCalledWith(mockRegistry, './routes/products.ts', [
      newRoute,
    ]);
    expect(addRouteToMatcher).toHaveBeenCalledWith(newRoute, mockMatcher);
  });

  test('file watcher handles route removals with cache clearing', async () => {
    // Arrange
    const _router = createRouter({ routesDir: './routes', watchMode: true });
    await vi.runAllTimersAsync();

    const onRouteRemoved = (watchRoutes as ReturnType<typeof vi.fn>).mock.calls[0]![1]
      .onRouteRemoved;

    const testRoute: Route = {
      path: '/another-route',
      GET: { handler: vi.fn() },
    };

    // Act - Remove the route
    onRouteRemoved('/path/to/users.ts', [testRoute]);

    // Assert - ensure cache was cleared for the removed file
    expect(clearFileCache).toHaveBeenCalledWith('/path/to/users.ts');
    expect(removeRouteFromMatcher).toHaveBeenCalledWith('/another-route', mockMatcher);
  });

  // ==========================================
  // PLUGIN ROUTE SUPPORT TESTS
  // ==========================================

  describe('Plugin Route Support', () => {
    let router: ReturnType<typeof createRouter>;

    beforeEach(async () => {
      // Reset mocks specifically for plugin tests
      (loadInitialRoutesParallel as ReturnType<typeof vi.fn>).mockReset();
      (watchRoutes as ReturnType<typeof vi.fn>).mockReset();
      (watchRoutes as ReturnType<typeof vi.fn>).mockReturnValue(mockWatcher);

      // Set up minimal mock for router initialization (empty routes to avoid conflicts)
      (loadInitialRoutesParallel as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      router = createRouter({ routesDir: './routes', watchMode: true });
      // Wait for initial initialization
      await vi.runAllTimersAsync();
    });

    test('addRouteDirectory adds routes from plugin directory', async () => {
      // Arrange - Set specific mock for this test
      const pluginRoutes: Route[] = [
        {
          path: '/auth/login',
          POST: {
            handler: vi.fn(),
            middleware: [],
          },
        },
        {
          path: '/auth/logout',
          POST: {
            handler: vi.fn(),
            middleware: [],
          },
        },
      ];

      (loadInitialRoutesParallel as ReturnType<typeof vi.fn>).mockResolvedValueOnce(pluginRoutes);

      // Mock registry to show routes were added
      (updateRoutesFromFile as ReturnType<typeof vi.fn>).mockReturnValue({
        added: pluginRoutes,
        changed: [],
        removed: [],
      });

      // Act
      await router.addRouteDirectory('./plugins/auth/routes');

      // Assert
      expect(loadInitialRoutesParallel).toHaveBeenCalledWith('./plugins/auth/routes');
      expect(addRouteToMatcher).toHaveBeenCalledWith(pluginRoutes[0], mockMatcher);
      expect(addRouteToMatcher).toHaveBeenCalledWith(pluginRoutes[1], mockMatcher);
    });

    test('addRouteDirectory with prefix prepends prefix to routes', async () => {
      // Arrange - Set specific mock for this test
      const pluginRoutes: Route[] = [
        {
          path: '/login',
          POST: {
            handler: vi.fn(),
            middleware: [],
          },
        },
      ];

      (loadInitialRoutesParallel as ReturnType<typeof vi.fn>).mockResolvedValueOnce(pluginRoutes);

      const routeWithPrefix = { ...pluginRoutes[0], path: '/api/v1/login' };

      // Mock registry to show prefixed route was added
      (updateRoutesFromFile as ReturnType<typeof vi.fn>).mockReturnValue({
        added: [routeWithPrefix],
        changed: [],
        removed: [],
      });

      // Act
      await router.addRouteDirectory('./plugins/auth/routes', { prefix: '/api/v1' });

      // Assert
      expect(addRouteToMatcher).toHaveBeenCalledWith(routeWithPrefix, mockMatcher);
    });

    test('router has close method for cleanup', async () => {
      const mockLogger = createMockLogger();
      // Arrange
      const router = createRouter({ routesDir: './routes', watchMode: true });

      // Force initialization to set up watchers
      await router.handleRequest(mockContext, mockLogger, mockEventBus);

      // Act & Assert
      expect(router.close).toBeInstanceOf(Function);

      // Test cleanup
      await router.close!();
      expect(mockWatcher.close).toHaveBeenCalled();
    });
  });

  // ==========================================
  // REGISTRY INTEGRATION TESTS
  // ==========================================

  describe('Registry Integration', () => {
    test('uses performance tracking for route changes', async () => {
      // Arrange
      createRouter({ routesDir: './routes', watchMode: true });
      await vi.runAllTimersAsync();

      const onRouteChanged = (watchRoutes as ReturnType<typeof vi.fn>).mock.calls[0]![1]
        .onRouteChanged;

      const changedRoute: Route = {
        path: '/users',
        GET: { handler: vi.fn() },
      };

      // Act
      onRouteChanged('./routes/users.ts', [changedRoute]);

      // Assert
      expect(withPerformanceTracking).toHaveBeenCalledWith(expect.any(Function), './routes');
    });

    test('registry system properly tracks route sources', async () => {
      // Arrange
      const router = createRouter({ routesDir: './routes' });
      const route1: Route = { path: '/test1', GET: { handler: vi.fn() } };
      const route2: Route = { path: '/test2', GET: { handler: vi.fn() } };

      // Act
      router.addRoute(route1);
      router.addRoute(route2);

      // Assert
      expect(updateRoutesFromFile).toHaveBeenCalledWith(mockRegistry, 'programmatic', [route1]);
      expect(updateRoutesFromFile).toHaveBeenCalledWith(mockRegistry, 'programmatic', [route2]);
    });
  });
});
