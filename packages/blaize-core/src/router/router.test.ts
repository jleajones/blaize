// Mock dependencies
vi.mock('./discovery', () => ({
  findRoutes: vi.fn(),
}));

vi.mock('./discovery/watchers', () => ({
  watchRoutes: vi.fn(),
}));

vi.mock('./handlers/executor', () => ({
  executeHandler: vi.fn().mockImplementation(() => Promise.resolve()),
}));

vi.mock('./handlers/error', () => ({
  handleRouteError: vi.fn(),
}));

vi.mock('./matching', () => ({
  createMatcher: vi.fn(() => ({
    add: vi.fn(),
    match: vi.fn(),
  })),
}));

import { findRoutes } from './discovery';
import { watchRoutes } from './discovery/watchers';
import { handleRouteError } from './handlers/error';
import { executeHandler } from './handlers/executor';
import { createMatcher } from './matching';
import { createRouter } from './router';

import type { Context, Route, RouterOptions, RouteMethodOptions } from '../index';

describe('Router', () => {
  // Setup common mocks and fixtures
  let mockMatcher: {
    add: ReturnType<typeof vi.fn>;
    match: ReturnType<typeof vi.fn>;
  };

  let mockRoutes: Route[];
  let mockContext: Context;
  let mockWatcher: any;

  beforeEach(() => {
    // Setup fake timers
    vi.useFakeTimers();
    // Reset all mocks
    vi.resetAllMocks();

    // Ensure executeHandler is properly spied
    (executeHandler as any).mockReset().mockImplementation(() => Promise.resolve());

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

    // Setup mock matcher
    mockMatcher = {
      add: vi.fn(),
      match: vi.fn(),
    };
    (createMatcher as ReturnType<typeof vi.fn>).mockReturnValue(mockMatcher);

    // Setup mock findRoutes - default for main router tests
    (findRoutes as ReturnType<typeof vi.fn>).mockResolvedValue(mockRoutes);

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

    // Verify findRoutes was called with correct options
    expect(findRoutes).toHaveBeenCalledWith('./custom-routes', {
      basePath: '/',
    });
  });

  test('initializes routes from file system on creation', async () => {
    // Arrange & Act
    createRouter({ routesDir: './routes' });

    // Wait for initialization promise to resolve
    await vi.runAllTimersAsync();

    // Assert
    expect(findRoutes).toHaveBeenCalledWith('./routes', {
      basePath: '/',
    });

    // Verify routes were added to matcher
    expect(mockMatcher.add).toHaveBeenCalledTimes(3); // 3 method handlers in mockRoutes
  });

  test('sets up file watcher in development mode', async () => {
    // Arrange
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    // Mock implementation of findRoutes to immediately resolve
    (findRoutes as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      return mockRoutes;
    });

    // Reset watchRoutes mock to ensure clean state
    (watchRoutes as ReturnType<typeof vi.fn>).mockClear();

    // Act
    const router = createRouter({
      routesDir: './routes',
      watchMode: true, // Explicitly enable watch mode
    });

    // Use the handleRequest method to force initialization
    // This is the most reliable way to ensure initialization happens
    await router.handleRequest(mockContext);

    // Assert
    expect(watchRoutes).toHaveBeenCalled();
    expect(watchRoutes).toHaveBeenCalledWith(
      './routes',
      expect.objectContaining({
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
      error: 'Method Not Allowed',
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

  test('getRoutes returns copy of routes array', async () => {
    // Arrange
    const router = createRouter({ routesDir: './routes' });

    // Wait for initialization promise to resolve
    await vi.runAllTimersAsync();

    // Act
    const routes = router.getRoutes();

    // Assert
    expect(routes).toEqual(mockRoutes);
    expect(routes).not.toBe(mockRoutes); // Should be a copy, not the same array reference
  });

  test('addRoute adds route to router', async () => {
    // Arrange
    const router = createRouter({ routesDir: './routes' });
    const newRoute: Route = {
      path: '/products',
      GET: {
        handler: vi.fn(),
      },
    };

    // Act
    router.addRoute(newRoute);

    // Assert
    expect(mockMatcher.add).toHaveBeenCalledWith('/products', 'GET', newRoute.GET);
  });

  test('file watcher handles route additions', async () => {
    // Arrange
    createRouter({ routesDir: './routes', watchMode: true });

    // Wait for initialization promise to resolve
    await vi.runAllTimersAsync();

    // Get the onRouteAdded callback
    const onRouteAdded = (watchRoutes as ReturnType<typeof vi.fn>).mock.calls[0]![1].onRouteAdded;

    // Create a new route to be added
    const newRoute: Route = {
      path: '/products',
      GET: {
        handler: vi.fn(),
      },
    };

    // Reset matcher.add mock to clear any previous calls
    mockMatcher.add.mockClear();

    // Act
    onRouteAdded([newRoute]);

    // Assert
    expect(mockMatcher.add).toHaveBeenCalledWith('/products', 'GET', newRoute.GET);
  });

  test('file watcher handles route changes', async () => {
    // Arrange
    createRouter({ routesDir: './routes', watchMode: true });

    // Wait for initialization to complete
    await vi.runAllTimersAsync();

    // Get the onRouteChanged callback
    const onRouteChanged = (watchRoutes as ReturnType<typeof vi.fn>).mock.calls[0]![1]
      .onRouteChanged;

    // Create a changed route
    const changedRoute: Route = {
      path: '/users',
      GET: {
        handler: vi.fn(),
      },
      // POST method removed
    };

    // Reset matcher.add mock to clear any previous calls
    mockMatcher.add.mockClear();

    // Act
    onRouteChanged([changedRoute]);

    // Assert
    expect(mockMatcher.add).toHaveBeenCalledWith('/users', 'GET', changedRoute.GET);
  });

  test('file watcher handles route removals', async () => {
    // Arrange
    const router = createRouter({ routesDir: './routes', watchMode: true });
    await vi.runAllTimersAsync();

    const onRouteAdded = (watchRoutes as ReturnType<typeof vi.fn>).mock.calls[0]![1].onRouteAdded;
    const onRouteRemoved = (watchRoutes as ReturnType<typeof vi.fn>).mock.calls[0]![1]
      .onRouteRemoved;

    const testRoute: Route = {
      path: '/another-route',
      GET: { handler: vi.fn() },
    };

    // First, add a route
    onRouteAdded([testRoute]);

    // Verify it was added
    let routes = router.getRoutes();
    let hasRoute = routes.some(route => route.path === '/another-route');
    expect(hasRoute).toBe(true); // ✅ Route should exist after adding

    // Act - Remove the route
    onRouteRemoved('/path/to/users.ts', [testRoute]);

    // Assert - ensure the route was removed
    routes = router.getRoutes();
    hasRoute = routes.some(route => route.path === '/another-route');
    expect(hasRoute).toBe(false); // ✅ Route should NOT exist after removal
  });

  describe('Plugin Route Support', () => {
    let router: ReturnType<typeof createRouter>;

    beforeEach(async () => {
      // Reset findRoutes mock specifically for plugin tests
      (findRoutes as ReturnType<typeof vi.fn>).mockReset();
      // Reset watchRoutes mock for clean state
      (watchRoutes as ReturnType<typeof vi.fn>).mockReset();
      (watchRoutes as ReturnType<typeof vi.fn>).mockReturnValue(mockWatcher);

      // Set up minimal mock for router initialization (empty routes to avoid conflicts)
      (findRoutes as ReturnType<typeof vi.fn>).mockResolvedValue([]);

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

      (findRoutes as ReturnType<typeof vi.fn>).mockResolvedValueOnce(pluginRoutes);

      // Act
      await router.addRouteDirectory('./plugins/auth/routes');

      // Assert
      expect(findRoutes).toHaveBeenCalledWith('./plugins/auth/routes', {
        basePath: '/',
      });

      expect(mockMatcher.add).toHaveBeenCalledWith('/auth/login', 'POST', pluginRoutes[0]!.POST);
      expect(mockMatcher.add).toHaveBeenCalledWith('/auth/logout', 'POST', pluginRoutes[1]!.POST);
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

      (findRoutes as ReturnType<typeof vi.fn>).mockResolvedValueOnce(pluginRoutes);

      // Act
      await router.addRouteDirectory('./plugins/auth/routes', { prefix: '/api/v1' });

      // Assert
      expect(mockMatcher.add).toHaveBeenCalledWith('/api/v1/login', 'POST', pluginRoutes[0]!.POST);
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
      (findRoutes as ReturnType<typeof vi.fn>).mockClear();

      // Mock the first call to findRoutes (second call should be skipped)
      (findRoutes as ReturnType<typeof vi.fn>).mockResolvedValueOnce(pluginRoutes);

      // Act
      await router.addRouteDirectory('./plugins/auth/routes');
      await router.addRouteDirectory('./plugins/auth/routes'); // Second time

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        'Route directory ./plugins/auth/routes already registered'
      );

      // Verify findRoutes was only called once (for the first registration)
      expect(findRoutes).toHaveBeenCalledTimes(1);

      consoleSpy.mockRestore();
    });

    test('detects route conflicts between main routes and plugin routes', async () => {
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
      (findRoutes as ReturnType<typeof vi.fn>).mockReset();
      (findRoutes as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mainRoutes);

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

      (findRoutes as ReturnType<typeof vi.fn>).mockResolvedValueOnce(conflictingPluginRoutes);

      // Act & Assert
      await expect(conflictRouter.addRouteDirectory('./plugins/users/routes')).rejects.toThrow(
        'Route conflict for path "/users"'
      );
    });

    test('getRouteConflicts returns current conflicts', async () => {
      // Arrange - Initially no conflicts
      const conflicts = router.getRouteConflicts();
      expect(conflicts).toHaveLength(0);

      // Test that the method exists and returns the right structure
      expect(Array.isArray(conflicts)).toBe(true);
    });

    test('setupWatcherForDirectory sets up file watching for plugin directory', async () => {
      // Arrange
      const pluginRoutes: Route[] = [
        {
          path: '/auth/login',
          POST: { handler: vi.fn(), middleware: [] },
        },
      ];

      (findRoutes as ReturnType<typeof vi.fn>).mockResolvedValueOnce(pluginRoutes);

      // Clear previous watchRoutes calls
      (watchRoutes as ReturnType<typeof vi.fn>).mockClear();

      // Act
      await router.addRouteDirectory('./plugins/auth/routes');

      // Assert - Should have been called for the plugin directory
      expect(watchRoutes).toHaveBeenCalledWith(
        './plugins/auth/routes',
        expect.objectContaining({
          ignore: ['node_modules', '.git'],
          onRouteAdded: expect.any(Function),
          onRouteChanged: expect.any(Function),
          onRouteRemoved: expect.any(Function),
          onError: expect.any(Function),
        })
      );
    });
  });
});
