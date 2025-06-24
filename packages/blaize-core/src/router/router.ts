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
import {
  addRouteToMatcher,
  removeRouteFromMatcher,
  updateRouteInMatcher,
} from './utils/matching-helpers';

import type { Context, HttpMethod, Route, RouterOptions, Router } from '../index';

const DEFAULT_ROUTER_OPTIONS = {
  routesDir: './routes',
  basePath: '/',
  watchMode: process.env.NODE_ENV === 'development',
};

/**
 * Create an optimized router instance with fast hot reload
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

  // Use optimized registry instead of simple array
  const registry = createRouteRegistry();
  const matcher = createMatcher();

  // Initialize routes
  let initialized = false;
  let initializationPromise: Promise<void> | null = null;
  let _watchers: Map<string, ReturnType<typeof watchRoutes>> | null = null;

  const routeDirectories = new Set<string>([routerOptions.routesDir]);

  /**
   * Apply registry changes to matcher efficiently
   */
  function applyMatcherChanges(changes: { added: Route[]; removed: string[]; changed: Route[] }) {
    console.log('\n🔧 APPLYING MATCHER CHANGES:');
    console.log(`  Adding ${changes.added.length} routes`);
    console.log(`  Removing ${changes.removed.length} routes`);
    console.log(`  Updating ${changes.changed.length} routes`);

    // Remove routes first
    changes.removed.forEach(routePath => {
      console.log(`    ➖ Removing: ${routePath}`);
      removeRouteFromMatcher(routePath, matcher);
    });

    // Add new routes
    changes.added.forEach(route => {
      const methods = Object.keys(route).filter(key => key !== 'path');
      console.log(`    ➕ Adding: ${route.path} [${methods.join(', ')}]`);
      addRouteToMatcher(route, matcher);
    });

    // Update changed routes
    changes.changed.forEach(route => {
      const methods = Object.keys(route).filter(key => key !== 'path');
      console.log(`    🔄 Updating: ${route.path} [${methods.join(', ')}]`);
      updateRouteInMatcher(route, matcher);
    });

    console.log('✅ Matcher changes applied\n');
  }

  /**
   * Add multiple routes with batch processing
   */
  function addRoutesWithSource(routes: Route[], source: string) {
    try {
      // Use registry for batch conflict detection and management
      const changes = updateRoutesFromFile(registry, source, routes);

      // Apply all changes to matcher in one operation
      applyMatcherChanges(changes);

      return changes;
    } catch (error) {
      console.error(`⚠️ Route conflicts from ${source}:`, error);
      throw error;
    }
  }

  /**
   * Optimized route loading with parallel processing
   */
  async function loadRoutesFromDirectory(directory: string, source: string, prefix?: string) {
    try {
      // Use parallel loading for better performance
      const discoveredRoutes = await loadInitialRoutesParallel(directory);

      // Apply prefix if provided
      const finalRoutes = discoveredRoutes.map(route =>
        prefix ? { ...route, path: `${prefix}${route.path}` } : route
      );

      // Batch add all routes from this directory
      const changes = addRoutesWithSource(finalRoutes, source);

      console.log(
        `Loaded ${discoveredRoutes.length} routes from ${source}${prefix ? ` with prefix ${prefix}` : ''} ` +
          `(${changes.added.length} added, ${changes.changed.length} changed, ${changes.removed.length} removed)`
      );
    } catch (error) {
      console.error(`⚠️ Failed to load routes from ${source}:`, error);
      throw error;
    }
  }

  /**
   * Initialize the router with parallel route loading
   */
  async function initialize() {
    if (initialized || initializationPromise) {
      return initializationPromise;
    }

    initializationPromise = (async () => {
      try {
        // Load routes from all directories in parallel
        await Promise.all(
          Array.from(routeDirectories).map(directory =>
            loadRoutesFromDirectory(directory, directory)
          )
        );

        // Set up optimized watching
        if (routerOptions.watchMode) {
          setupOptimizedWatching();
        }

        initialized = true;
      } catch (error) {
        console.error('⚠️ Failed to initialize router:', error);
        throw error;
      }
    })();

    return initializationPromise;
  }

  /**
   * Setup optimized file watching with fast updates
   */
  function setupOptimizedWatching() {
    if (!_watchers) {
      _watchers = new Map();
    }

    for (const directory of routeDirectories) {
      if (!_watchers.has(directory)) {
        const watcher = watchRoutes(directory, {
          debounceMs: 16, // ~60fps debouncing
          ignore: ['node_modules', '.git'],

          onRouteAdded: (filepath: string, addedRoutes: Route[]) => {
            // Batch process all added routes
            try {
              const changes = updateRoutesFromFile(registry, filepath, addedRoutes);
              applyMatcherChanges(changes);
            } catch (error) {
              console.error(`Error adding routes from ${directory}:`, error);
            }
          },

          onRouteChanged: withPerformanceTracking(
            async (filepath: string, changedRoutes: Route[]) => {
              // console.log(`${changedRoutes.length} route(s) changed in ${directory}`);

              try {
                console.log(`Processing changes for ${filepath}`);
                // Process all changed routes in one batch operation
                const changes = updateRoutesFromFile(registry, filepath, changedRoutes);

                console.log(
                  `Changes detected: ${changes.added.length} added, ` +
                    `${changes.changed.length} changed, ${changes.removed.length} removed`
                );

                // Apply matcher updates efficiently
                applyMatcherChanges(changes);

                console.log(
                  `Route changes applied: ${changes.added.length} added, ` +
                    `${changes.changed.length} changed, ${changes.removed.length} removed`
                );
              } catch (error) {
                console.error(`⚠️ Error updating routes from ${directory}:`, error);
              }
            },
            directory
          ),

          onRouteRemoved: (filePath: string, removedRoutes: Route[]) => {
            console.log(`File removed: ${filePath} with ${removedRoutes.length} routes`);

            try {
              // Remove all routes from this file
              removedRoutes.forEach(route => {
                removeRouteFromMatcher(route.path, matcher);
              });

              // Clear cache for removed file
              clearFileCache(filePath);
            } catch (error) {
              console.error(`⚠️ Error removing routes from ${filePath}:`, error);
            }
          },

          onError: (error: Error) => {
            console.error(`⚠️ Route watcher error for ${directory}:`, error);
          },
        });

        _watchers.set(directory, watcher);
      }
    }
  }

  /**
   * Setup watcher for newly added directory
   */
  function setupWatcherForNewDirectory(directory: string, prefix?: string) {
    if (!_watchers) {
      _watchers = new Map();
    }

    const watcher = watchRoutes(directory, {
      debounceMs: 16,
      ignore: ['node_modules', '.git'],

      onRouteAdded: (filePath: string, addedRoutes: Route[]) => {
        try {
          // Apply prefix to all routes
          const finalRoutes = addedRoutes.map(route =>
            prefix ? { ...route, path: `${prefix}${route.path}` } : route
          );

          // Batch process all added routes
          const changes = updateRoutesFromFile(registry, filePath, finalRoutes);
          applyMatcherChanges(changes);
        } catch (error) {
          console.error(`⚠️ Error adding routes from ${directory}:`, error);
        }
      },

      onRouteChanged: withPerformanceTracking(async (filePath: string, changedRoutes: Route[]) => {
        try {
          // Apply prefix to all routes
          const finalRoutes = changedRoutes.map(route =>
            prefix ? { ...route, path: `${prefix}${route.path}` } : route
          );

          // Process all changed routes in one batch operation
          const changes = updateRoutesFromFile(registry, filePath, finalRoutes);
          applyMatcherChanges(changes);
        } catch (error) {
          console.error(`⚠️ Error updating routes from ${directory}:`, error);
        }
      }, directory),

      onRouteRemoved: (filePath: string, removedRoutes: Route[]) => {
        try {
          removedRoutes.forEach(route => {
            const finalPath = prefix ? `${prefix}${route.path}` : route.path;
            removeRouteFromMatcher(finalPath, matcher);
          });
          clearFileCache(filePath);
        } catch (error) {
          console.error(`Error removing routes from ${filePath}:`, error);
        }
      },

      onError: (error: Error) => {
        console.error(`⚠️ Route watcher error for ${directory}:`, error);
      },
    });

    _watchers.set(directory, watcher);
    return watcher;
  }

  // Initialize router on creation
  initialize().catch(error => {
    console.error('⚠️ Failed to initialize router on creation:', error);
  });

  // Public API
  return {
    /**
     * Handle an incoming request
     */
    async handleRequest(ctx: Context) {
      // Ensure router is initialized
      if (!initialized) {
        console.log('🔄 Router not initialized, initializing...');
        await initialize();
      }

      const { method, path } = ctx.request;
      console.log(`\n📥 Handling request: ${method} ${path}`);

      // Find matching route
      const match = matcher.match(path, method as HttpMethod);

      if (!match) {
        console.log(`❌ No match found for: ${method} ${path}`);
        // Handle 404 Not Found
        ctx.response.status(404).json({ error: 'Not Found' });
        return;
      }

      console.log(`✅ Route matched: ${method} ${path}`);
      console.log(`   Params: ${JSON.stringify(match.params)}`);

      // Check for method not allowed
      if (match.methodNotAllowed) {
        // Handle 405 Method Not Allowed
        ctx.response.status(405).json({
          error: '❌ Method Not Allowed',
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
     * Get all registered routes (using optimized registry)
     */
    getRoutes() {
      return getAllRoutesFromRegistry(registry);
    },

    /**
     * Add a route programmatically
     */
    addRoute(route: Route) {
      const changes = updateRoutesFromFile(registry, 'programmatic', [route]);
      applyMatcherChanges(changes);
    },

    /**
     * Add multiple routes programmatically with batch processing
     */
    addRoutes(routes: Route[]) {
      const changes = updateRoutesFromFile(registry, 'programmatic', routes);
      applyMatcherChanges(changes);
      return changes;
    },

    /**
     * Add a route directory (for plugins) with optimized loading
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
          setupWatcherForNewDirectory(directory, options.prefix);
        }
      }
    },

    /**
     * Get route conflicts (using registry)
     */
    getRouteConflicts() {
      // Registry handles conflict detection internally
      // This could be enhanced to expose more detailed conflict info
      const conflicts: Array<{ path: string; sources: string[] }> = [];
      // Implementation would depend on registry's conflict tracking
      return conflicts;
    },

    /**
     * Close watchers and cleanup (useful for testing)
     */
    async close() {
      if (_watchers) {
        for (const watcher of _watchers.values()) {
          await watcher.close();
        }
        _watchers.clear();
      }
    },
  };
}
