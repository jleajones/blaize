import {
  Context,
  HttpMethod,
  Route,
  RouteMethodOptions,
  RouterOptions,
  Router,
} from '@blaizejs/types';

import { findRoutes } from './discovery';
import { watchRoutes } from './discovery/watchers';
import { executeHandler } from './handlers';
import { handleRouteError } from './handlers/error';
import { createMatcher } from './matching';

const DEFAULT_ROUTER_OPTIONS = {
  routesDir: './routes',
  basePath: '/',
  watchMode: process.env.NODE_ENV === 'development',
};

/**
 * Create a router instance
 */
export function createRouter(options: RouterOptions): Router {
  // Merge with default options
  const routerOptions = {
    ...DEFAULT_ROUTER_OPTIONS,
    ...options,
  };

  if (options.basePath && !options.basePath.startsWith('/')) {
    console.warn('Base path does nothing');
  }
  // Internal state
  const routes: Route[] = [];
  const matcher = createMatcher();

  // Initialize routes
  let initialized = false;
  let initializationPromise: Promise<void> | null = null;
  let _watchers: Map<string, ReturnType<typeof watchRoutes>> | null = null; // For plugin directories

  // Track route sources for conflict detection
  const routeSources = new Map<string, string[]>(); // path -> [source1, source2, ...]
  const routeDirectories = new Set<string>([routerOptions.routesDir]);

  /**
   * Add a route with source tracking
   */
  function addRouteWithSource(route: Route, source: string) {
    const existingSources = routeSources.get(route.path) || [];

    if (existingSources.length > 0) {
      // Route conflict detected
      const conflictError = new Error(
        `Route conflict for path "${route.path}": ` +
          `already defined in ${existingSources.join(', ')}, ` +
          `now being added from ${source}`
      );
      console.error(conflictError.message);
      throw conflictError;
    }

    // Track the source
    routeSources.set(route.path, [...existingSources, source]);

    // Add to router
    addRouteInternal(route);
  }

  /**
   * Load routes from a directory
   */
  async function loadRoutesFromDirectory(directory: string, source: string, prefix?: string) {
    try {
      const discoveredRoutes = await findRoutes(directory, {
        basePath: routerOptions.basePath,
      });

      for (const route of discoveredRoutes) {
        // Apply prefix if provided
        const finalRoute = prefix
          ? {
              ...route,
              path: `${prefix}${route.path}`,
            }
          : route;

        addRouteWithSource(finalRoute, source);
      }

      console.log(
        `Loaded ${discoveredRoutes.length} routes from ${source}${prefix ? ` with prefix ${prefix}` : ''}`
      );
    } catch (error) {
      console.error(`Failed to load routes from ${source}:`, error);
      throw error;
    }
  }

  /**
   * Initialize the router by loading routes from the filesystem
   */
  async function initialize() {
    if (initialized || initializationPromise) {
      return initializationPromise;
    }

    initializationPromise = (async () => {
      try {
        // Load routes from all registered directories
        for (const directory of routeDirectories) {
          await loadRoutesFromDirectory(directory, directory);
        }

        // Set up file watching in development if enabled
        if (routerOptions.watchMode) {
          setupWatcherForAllDirectories();
        }

        initialized = true;
      } catch (error) {
        console.error('Failed to initialize router:', error);
        throw error;
      }
    })();

    return initializationPromise;
  }

  /**
   * Add a route to the router
   */
  function addRouteInternal(route: Route) {
    routes.push(route);

    // Add each method to the matcher
    Object.entries(route).forEach(([method, methodOptions]) => {
      if (method === 'path' || !methodOptions) return;

      matcher.add(route.path, method as HttpMethod, methodOptions as RouteMethodOptions);
    });
  }

  /**
   * Create watcher callbacks for a specific directory
   */
  function createWatcherCallbacks(directory: string, source: string, prefix?: string) {
    return {
      onRouteAdded: (addedRoutes: Route[]) => {
        console.log(
          `${addedRoutes.length} route(s) added from ${directory}:`,
          addedRoutes.map(r => r.path)
        );
        addedRoutes.forEach(route => {
          const finalRoute = prefix ? { ...route, path: `${prefix}${route.path}` } : route;
          addRouteWithSource(finalRoute, source);
        });
      },

      onRouteChanged: (changedRoutes: Route[]) => {
        console.log(
          `${changedRoutes.length} route(s) changed in ${directory}:`,
          changedRoutes.map(r => r.path)
        );

        changedRoutes.forEach(route => {
          const finalPath = prefix ? `${prefix}${route.path}` : route.path;

          // Remove existing route with the same final path
          const index = routes.findIndex(r => r.path === finalPath);
          if (index >= 0) {
            routes.splice(index, 1);

            // Update source tracking
            const sources = routeSources.get(finalPath) || [];
            const filteredSources = sources.filter(s => s !== source);
            if (filteredSources.length > 0) {
              routeSources.set(finalPath, filteredSources);
            } else {
              routeSources.delete(finalPath);
            }
          }

          // Add the updated route
          const finalRoute = prefix ? { ...route, path: finalPath } : route;
          addRouteWithSource(finalRoute, source);
        });
      },

      onRouteRemoved: (filePath: string, removedRoutes: Route[]) => {
        console.log(
          `File removed from ${directory}: ${filePath} with ${removedRoutes.length} route(s):`,
          removedRoutes.map(r => r.path)
        );

        removedRoutes.forEach(route => {
          const finalPath = prefix ? `${prefix}${route.path}` : route.path;

          // Remove route from routes array
          const index = routes.findIndex(r => r.path === finalPath);
          if (index >= 0) {
            routes.splice(index, 1);
          }

          // Update source tracking
          const sources = routeSources.get(finalPath) || [];
          const filteredSources = sources.filter(s => s !== source);
          if (filteredSources.length > 0) {
            routeSources.set(finalPath, filteredSources);
          } else {
            routeSources.delete(finalPath);
          }
        });
      },

      onError: (error: Error) => {
        console.error(`Route watcher error for ${directory}:`, error);
      },
    };
  }

  /**
   * Set up file watcher for a specific directory
   */
  function setupWatcherForDirectory(directory: string, source: string, prefix?: string) {
    const callbacks = createWatcherCallbacks(directory, source, prefix);

    const watcher = watchRoutes(directory, {
      ignore: ['node_modules', '.git'],
      ...callbacks,
    });

    // Store watcher reference for cleanup
    if (!_watchers) {
      _watchers = new Map();
    }
    _watchers.set(directory, watcher);

    return watcher;
  }

  /**
   * Set up file watcher for all directories
   */
  function setupWatcherForAllDirectories() {
    for (const directory of routeDirectories) {
      setupWatcherForDirectory(directory, directory);
    }
  }

  initialize().catch(error => {
    console.error('Failed to initialize router on creation:', error);
  });
  // Public API
  return {
    /**
     * Handle an incoming request
     */
    async handleRequest(ctx: Context) {
      // Ensure router is initialized
      if (!initialized) {
        await initialize();
      }

      const { method, path } = ctx.request;

      // Find matching route
      const match = matcher.match(path, method as HttpMethod);

      if (!match) {
        // Handle 404 Not Found
        ctx.response.status(404).json({ error: 'Not Found' });
        return;
      }

      // Check for method not allowed
      if (match.methodNotAllowed) {
        // Handle 405 Method Not Allowed
        ctx.response.status(405).json({
          error: 'Method Not Allowed',
          allowed: match.allowedMethods,
        });

        // Set Allow header with allowed methods
        if (match.allowedMethods && match.allowedMethods.length > 0) {
          ctx.response.header('Allow', match.allowedMethods.join(', '));
        }

        return;
      }

      // Extract route parameters
      ctx.request.params = match.params;

      // Execute the route handler with middleware
      try {
        await executeHandler(ctx, match.route!, match.params);
      } catch (error) {
        // Handle errors
        handleRouteError(ctx, error, {
          detailed: process.env.NODE_ENV !== 'production',
          log: true,
        });
      }
    },

    /**
     * Get all registered routes
     */
    getRoutes() {
      return [...routes];
    },

    /**
     * Add a route programmatically
     */
    addRoute(route: Route) {
      addRouteInternal(route);
    },

    /**
     * Add a route directory (for plugins)
     */
    async addRouteDirectory(directory: string, options: { prefix?: string } = {}) {
      if (routeDirectories.has(directory)) {
        console.warn(`Route directory ${directory} already registered`);
        return;
      }

      routeDirectories.add(directory);

      // If already initialized, load routes immediately
      if (initialized) {
        await loadRoutesFromDirectory(directory, directory, options.prefix);

        // Set up watching for this directory if in watch mode
        if (routerOptions.watchMode) {
          setupWatcherForDirectory(directory, directory, options.prefix);
        }
      }
    },
    /**
     * Get route conflicts
     */
    getRouteConflicts() {
      const conflicts: Array<{ path: string; sources: string[] }> = [];

      for (const [path, sources] of routeSources.entries()) {
        if (sources.length > 1) {
          conflicts.push({ path, sources });
        }
      }

      return conflicts;
    },
  };
}
