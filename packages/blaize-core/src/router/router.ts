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
  let _watcher: ReturnType<typeof watchRoutes> | null = null;

  /**
   * Initialize the router by loading routes from the filesystem
   */
  async function initialize() {
    if (initialized || initializationPromise) {
      return initializationPromise;
    }

    initializationPromise = (async () => {
      try {
        // Discover routes from file system
        const discoveredRoutes = await findRoutes(routerOptions.routesDir, {
          basePath: routerOptions.basePath,
        });

        // Add routes to the matcher
        for (const route of discoveredRoutes) {
          addRouteInternal(route);
        }

        // Set up file watching in development if enabled
        if (routerOptions.watchMode) {
          setupWatcher();
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
   * Set up file watcher for development
   */
  function setupWatcher() {
    _watcher = watchRoutes(routerOptions.routesDir, {
      ignore: ['node_modules', '.git'],
      onRouteAdded: addedRoutes => {
        console.log(
          `${addedRoutes.length} route(s) added:`,
          addedRoutes.map(r => r.path)
        );
        addedRoutes.forEach(route => addRouteInternal(route));
      },
      onRouteChanged: changedRoutes => {
        console.log(
          `${changedRoutes.length} route(s) changed:`,
          changedRoutes.map(r => r.path)
        );

        changedRoutes.forEach(route => {
          // Remove existing route with the same path
          const index = routes.findIndex(r => r.path === route.path);
          if (index >= 0) {
            routes.splice(index, 1);
          }

          // Add the updated route
          addRouteInternal(route);
        });
      },
      onRouteRemoved: (filePath, removedRoutes) => {
        console.log('-----------------------Routes before removal:', routes);

        console.log(
          `File removed: ${filePath} with ${removedRoutes.length} route(s):`,
          removedRoutes.map(r => r.path)
        );

        removedRoutes.forEach(route => {
          // Remove route from routes array
          const index = routes.findIndex(r => r.path === route.path);
          if (index >= 0) {
            routes.splice(index, 1);
          }
        });

        console.log('-----------------------Routes after removal:', routes);

        // Note: We can't easily remove routes from the matcher
        // In production this isn't an issue since file watching is disabled
      },
      onError: error => {
        console.error('Route watcher error:', error);
      },
    });
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
  };
}
