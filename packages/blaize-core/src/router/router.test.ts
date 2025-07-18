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

vi.mock('./handlers/error', () => ({
  handleRouteError: vi.fn(),
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

import { findRoutes } from './discovery';
import { clearFileCache } from './discovery/cache';
import { loadInitialRoutesParallel } from './discovery/parallel';
import { withPerformanceTracking } from './discovery/profiler';
import { watchRoutes } from './discovery/watchers';
import { executeHandler } from './handlers';
import { handleRouteError } from './handlers/error';
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
        method: 'GET',
        path: '/users',
        params: {},
      },
      response: {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
        header: vi.fn().mockReturnThis(),
      },
    } as unknown as Context;

    // Ensure executeHandler is properly mocked
    (executeHandler as any).mockImplementation(() => Promise.resolve());
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
    // Arrange
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    // Act
    const router = createRouter({
      routesDir: './routes',
      watchMode: true,
    });

    // Force initialization by handling a request
    await router.handleRequest(mockContext);

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
    await router.handleRequest(mockContext);

    // Assert
    expect(mockMatcher.match).toHaveBeenCalledWith('/users', 'GET');
    expect(mockContext.request.params).toEqual({ id: '123' });
    expect(executeHandler).toHaveBeenCalledWith(mockContext, matchResult.route, matchResult.params);
  });

  test('handles 404 when no route matches', async () => {
    // Arrange
    const router = createRouter({ routesDir: './routes' });
    mockMatcher.match.mockReturnValue(null);

    // Act
    await router.handleRequest(mockContext);

    // Assert
    expect(mockContext.response.status).toHaveBeenCalledWith(404);
    expect(mockContext.response.json).toHaveBeenCalledWith({ error: 'Not Found' });
    expect(executeHandler).not.toHaveBeenCalled();
  });

  test('handles 405 Method Not Allowed', async () => {
    // Arrange
    const router = createRouter({ routesDir: './routes' });
    mockMatcher.match.mockReturnValue({
      methodNotAllowed: true,
      allowedMethods: ['GET', 'POST'],
    });

    // Act
    await router.handleRequest(mockContext);

    // Assert
    expect(mockContext.response.status).toHaveBeenCalledWith(405);
    expect(mockContext.response.json).toHaveBeenCalledWith({
      error: '❌ Method Not Allowed',
      allowed: ['GET', 'POST'],
    });
    expect(mockContext.response.header).toHaveBeenCalledWith('Allow', 'GET, POST');
    expect(executeHandler).not.toHaveBeenCalled();
  });

  test('handles errors during route execution', async () => {
    // Arrange
    const router = createRouter({ routesDir: './routes' });
    const mockError = new Error('Test error');
    const matchResult = {
      route: { handler: vi.fn() } as unknown as RouteMethodOptions,
      params: { id: '123' },
      methodNotAllowed: false,
      allowedMethods: null,
    };
    mockMatcher.match.mockReturnValue(matchResult);
    (executeHandler as any).mockImplementation(() => Promise.reject(mockError));

    // Act
    await router.handleRequest(mockContext);

    // Assert
    expect(executeHandler).toHaveBeenCalled();
    expect(handleRouteError).toHaveBeenCalledWith(
      mockContext,
      mockError,
      expect.objectContaining({
        detailed: expect.any(Boolean),
        log: true,
      })
    );
  });

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

    test('addRouteDirectory warns when directory already registered', async () => {
      // Arrange
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const pluginRoutes: Route[] = [
        {
          path: '/auth/login',
          POST: {
            handler: vi.fn(),
            middleware: [],
          },
        },
      ];

      // Reset the call count after router initialization
      (loadInitialRoutesParallel as ReturnType<typeof vi.fn>).mockClear();

      // Mock the first call to loadInitialRoutesParallel
      (loadInitialRoutesParallel as ReturnType<typeof vi.fn>).mockResolvedValueOnce(pluginRoutes);

      // Act
      await router.addRouteDirectory('./plugins/auth/routes');
      await router.addRouteDirectory('./plugins/auth/routes'); // Second time

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        'Route directory ./plugins/auth/routes already registered'
      );

      // Verify loadInitialRoutesParallel was only called once (for the first registration)
      expect(loadInitialRoutesParallel).toHaveBeenCalledTimes(1);

      consoleSpy.mockRestore();
    });

    test('detects route conflicts using registry system', async () => {
      // Arrange - First set up some main routes
      const mainRoutes: Route[] = [
        {
          path: '/users',
          GET: {
            handler: vi.fn(),
            middleware: [],
          },
        },
      ];

      // Reset and set up router with main routes
      (loadInitialRoutesParallel as ReturnType<typeof vi.fn>).mockReset();
      (loadInitialRoutesParallel as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mainRoutes);

      // Create a new router with main routes
      const conflictRouter = createRouter({ routesDir: './routes', watchMode: true });
      await vi.runAllTimersAsync();

      // Now try to add conflicting plugin routes
      const conflictingPluginRoutes: Route[] = [
        {
          path: '/users', // This conflicts with main routes
          GET: {
            handler: vi.fn(),
            middleware: [],
          },
        },
      ];

      (loadInitialRoutesParallel as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        conflictingPluginRoutes
      );

      // The router should catch and re-throw registry errors
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Mock updateRoutesFromFile to throw conflict error for the plugin route
      (updateRoutesFromFile as ReturnType<typeof vi.fn>).mockImplementation(
        (registry, source, routes) => {
          if (source.includes('plugins') && routes.some((r: Route) => r.path === '/users')) {
            throw new Error('Route conflict for path "/users"');
          }
          return { added: routes, changed: [], removed: [] };
        }
      );

      // Act & Assert
      await expect(conflictRouter.addRouteDirectory('./plugins/users/routes')).rejects.toThrow();

      // The new implementation logs "Route conflicts from {source}:" (no specific route path)
      expect(consoleSpy).toHaveBeenCalledWith(
        '⚠️ Route conflicts from ./plugins/users/routes:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    test('getRouteConflicts returns current conflicts from registry', async () => {
      // Arrange - Initially no conflicts
      const conflicts = router.getRouteConflicts();
      expect(conflicts).toHaveLength(0);

      // Test that the method exists and returns the right structure
      expect(Array.isArray(conflicts)).toBe(true);
    });

    test('setupWatcherForNewDirectory sets up file watching for plugin directory', async () => {
      // Arrange
      const pluginRoutes: Route[] = [
        {
          path: '/auth/login',
          POST: { handler: vi.fn(), middleware: [] },
        },
      ];

      (loadInitialRoutesParallel as ReturnType<typeof vi.fn>).mockResolvedValueOnce(pluginRoutes);

      // Clear previous watchRoutes calls
      (watchRoutes as ReturnType<typeof vi.fn>).mockClear();

      // Act
      await router.addRouteDirectory('./plugins/auth/routes');

      // Assert - Should have been called for the plugin directory
      expect(watchRoutes).toHaveBeenCalledWith(
        './plugins/auth/routes',
        expect.objectContaining({
          debounceMs: 16,
          ignore: ['node_modules', '.git'],
          onRouteAdded: expect.any(Function),
          onRouteChanged: expect.any(Function),
          onRouteRemoved: expect.any(Function),
          onError: expect.any(Function),
        })
      );
    });

    test('router has close method for cleanup', async () => {
      // Arrange
      const router = createRouter({ routesDir: './routes', watchMode: true });

      // Force initialization to set up watchers
      await router.handleRequest(mockContext);

      // Act & Assert
      expect(router.close).toBeInstanceOf(Function);

      // Test cleanup
      await router.close!();
      expect(mockWatcher.close).toHaveBeenCalled();
    });
  });

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
      onRouteChanged([changedRoute]);

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

    test('registry handles route updates correctly', async () => {
      // Arrange
      // Set up router with empty initial routes to avoid interference
      (loadInitialRoutesParallel as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      // Ensure no routes are processed during initialization
      (updateRoutesFromFile as ReturnType<typeof vi.fn>).mockReturnValue({
        added: [],
        changed: [],
        removed: [],
      });

      createRouter({ routesDir: './routes', watchMode: true });
      await vi.runAllTimersAsync();

      // Clear any initialization calls
      (updateRoutesFromFile as ReturnType<typeof vi.fn>).mockClear();
      (updateRouteInMatcher as ReturnType<typeof vi.fn>).mockClear();

      // Get the onRouteChanged callback from the watcher setup
      const watchCallArgs = (watchRoutes as ReturnType<typeof vi.fn>).mock.calls[0];
      if (!watchCallArgs) {
        throw new Error('watchRoutes should have been called');
      }
      const onRouteChanged = watchCallArgs[1].onRouteChanged;

      const updatedRoute: Route = {
        path: '/users',
        GET: { handler: vi.fn() },
        POST: { handler: vi.fn() }, // Added method
      };

      // Mock registry to show the route was actually changed
      (updateRoutesFromFile as ReturnType<typeof vi.fn>).mockReturnValue({
        added: [],
        changed: [updatedRoute],
        removed: [],
      });

      // Act
      // Call onRouteChanged with filepath and routes (matching the watchers.ts callback signature)
      onRouteChanged('./routes/users.ts', [updatedRoute]);

      // Assert
      expect(updateRoutesFromFile).toHaveBeenCalledWith(mockRegistry, './routes/users.ts', [
        updatedRoute,
      ]);
      expect(updateRouteInMatcher).toHaveBeenCalledWith(updatedRoute, mockMatcher);
    });

    test('registry handles partial route changes efficiently within a single file', async () => {
      // Arrange
      (loadInitialRoutesParallel as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (updateRoutesFromFile as ReturnType<typeof vi.fn>).mockReturnValue({
        added: [],
        changed: [],
        removed: [],
      });

      createRouter({ routesDir: './routes', watchMode: true });
      await vi.runAllTimersAsync();

      // Clear any initialization calls
      (updateRoutesFromFile as ReturnType<typeof vi.fn>).mockClear();
      (updateRouteInMatcher as ReturnType<typeof vi.fn>).mockClear();

      const onRouteChanged = (watchRoutes as ReturnType<typeof vi.fn>).mock.calls[0]![1]
        .onRouteChanged;

      // Simulate a file that contains multiple routes
      const allRoutesInFile = [
        { path: '/route1', GET: { handler: vi.fn() } },
        { path: '/route2', GET: { handler: vi.fn() } },
        { path: '/route3', GET: { handler: vi.fn() } },
      ];

      // Mock registry to show only some routes actually changed
      // This simulates the registry's intelligent diffing
      (updateRoutesFromFile as ReturnType<typeof vi.fn>).mockReturnValue({
        added: [],
        changed: [allRoutesInFile[0], allRoutesInFile[2]], // Only route1 and route3 actually changed
        removed: [],
      });

      // Act
      // Simulate the file watcher detecting that multi-routes.ts changed
      // It passes ALL routes from that file to onRouteChanged
      onRouteChanged('./routes/multi-routes.ts', allRoutesInFile);

      // Assert
      // Registry should be called with all routes from the file
      expect(updateRoutesFromFile).toHaveBeenCalledWith(
        mockRegistry,
        './routes/multi-routes.ts',
        allRoutesInFile
      );

      // But only the routes that registry determined actually changed should be updated in matcher
      expect(updateRouteInMatcher).toHaveBeenCalledTimes(2);
      expect(updateRouteInMatcher).toHaveBeenCalledWith(allRoutesInFile[0], mockMatcher);
      expect(updateRouteInMatcher).toHaveBeenCalledWith(allRoutesInFile[2], mockMatcher);
      expect(updateRouteInMatcher).not.toHaveBeenCalledWith(allRoutesInFile[1], mockMatcher);
    });

    test('getRouteConflicts uses registry conflict detection', async () => {
      // Arrange
      const router = createRouter({ routesDir: './routes' });

      // Mock a registry with some conflicting routes
      mockRegistry.routesByPath.set('/users', { path: '/users', GET: { handler: vi.fn() } });
      mockRegistry.pathToFile.set('/users', './routes/users.ts');
      mockRegistry.routesByFile.set('./routes/users.ts', new Set(['/users']));
      mockRegistry.routesByFile.set('./plugins/auth.ts', new Set(['/users']));

      // Act
      const conflicts = router.getRouteConflicts();

      // Assert
      expect(Array.isArray(conflicts)).toBe(true);
      // The implementation should detect conflicts based on multiple sources for same path
    });
  });
});
