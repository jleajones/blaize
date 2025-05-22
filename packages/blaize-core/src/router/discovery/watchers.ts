import * as path from 'node:path';

import { watch } from 'chokidar';

import { Route } from '@blaizejs/types';

import { findRouteFiles } from './finder';
import { loadRouteModule } from './loader';

export interface WatchOptions {
  /** Directories to ignore */
  ignore?: string[];
  /** Callback for new routes */
  onRouteAdded?: (route: Route) => void;
  /** Callback for changed routes */
  onRouteChanged?: (route: Route) => void;
  /** Callback for removed routes */
  onRouteRemoved?: (path: string) => void;
  /** Callback for errors */
  onError?: (error: Error) => void;
}

/**
 * Watch for route file changes
 */
export function watchRoutes(routesDir: string, options: WatchOptions = {}) {
  // Track loaded routes by file path
  const routesByPath = new Map<string, Route>();

  // Initial loading of routes
  async function loadInitialRoutes() {
    try {
      const files = await findRouteFiles(routesDir, {
        ignore: options.ignore,
      });

      for (const filePath of files) {
        await loadAndNotify(filePath);
      }
    } catch (error) {
      handleError(error);
    }
  }

  // Load a route module and notify listeners
  async function loadAndNotify(filePath: string) {
    try {
      const route = await loadRouteModule(filePath, routesDir);

      if (!route) {
        return;
      }

      const existingRoute = routesByPath.get(filePath);

      if (existingRoute) {
        // Route changed
        routesByPath.set(filePath, route);

        if (options.onRouteChanged) {
          options.onRouteChanged(route);
        }
      } else {
        // New route
        routesByPath.set(filePath, route);

        if (options.onRouteAdded) {
          options.onRouteAdded(route);
        }
      }
    } catch (error) {
      handleError(error);
    }
  }

  // Handle route file removal
  function handleRemoved(filePath: string) {
    const normalizedPath = path.normalize(filePath);
    const route = routesByPath.get(normalizedPath);

    if (route && options.onRouteRemoved) {
      options.onRouteRemoved(route.path);
    }

    routesByPath.delete(normalizedPath);
  }

  // Handle errors
  function handleError(error: unknown) {
    if (options.onError && error instanceof Error) {
      options.onError(error);
    } else {
      console.error('Route watcher error:', error);
    }
  }

  // Start file watcher
  const watcher = watch(routesDir, {
    ignored: [
      /(^|[/\\])\../, // Ignore dot files
      /node_modules/,
      ...(options.ignore || []),
    ],
    persistent: true,
    ignoreInitial: false,
    awaitWriteFinish: {
      stabilityThreshold: 300,
      pollInterval: 100,
    },
  });

  // Set up event handlers
  watcher
    .on('add', loadAndNotify)
    .on('change', loadAndNotify)
    .on('unlink', handleRemoved)
    .on('error', handleError);

  // Load initial routes
  loadInitialRoutes().catch(handleError);

  // Return control methods
  return {
    /**
     * Close the watcher
     */
    close: () => watcher.close(),

    /**
     * Get all currently loaded routes
     */
    getRoutes: () => Array.from(routesByPath.values()),
  };
}
