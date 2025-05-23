import * as path from 'node:path';

import { watch } from 'chokidar';

import { Route } from '@blaizejs/types';

import { findRouteFiles } from './finder';
import { loadRouteModule } from './loader';

export interface WatchOptions {
  /** Directories to ignore */
  ignore?: string[];
  /** Callback for new routes */
  onRouteAdded?: (routes: Route[]) => void;
  /** Callback for changed routes */
  onRouteChanged?: (routes: Route[]) => void;
  /** Callback for removed routes */
  onRouteRemoved?: (filePath: string, routes: Route[]) => void;
  /** Callback for errors */
  onError?: (error: Error) => void;
}

/**
 * Watch for route file changes
 */
export function watchRoutes(routesDir: string, options: WatchOptions = {}) {
  // Track loaded routes by file path - now stores arrays of routes
  const routesByPath = new Map<string, Route[]>();

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
      const routes = await loadRouteModule(filePath, routesDir);

      if (!routes || routes.length === 0) {
        return;
      }

      const existingRoutes = routesByPath.get(filePath);

      if (existingRoutes) {
        // Routes changed
        routesByPath.set(filePath, routes);

        if (options.onRouteChanged) {
          options.onRouteChanged(routes);
        }
      } else {
        // New routes
        routesByPath.set(filePath, routes);

        if (options.onRouteAdded) {
          options.onRouteAdded(routes);
        }
      }
    } catch (error) {
      handleError(error);
    }
  }

  // Handle route file removal
  function handleRemoved(filePath: string) {
    const normalizedPath = path.normalize(filePath);
    const routes = routesByPath.get(normalizedPath);

    if (routes && routes.length > 0 && options.onRouteRemoved) {
      options.onRouteRemoved(normalizedPath, routes);
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
     * Get all currently loaded routes (flattened)
     */
    getRoutes: () => {
      const allRoutes: Route[] = [];
      for (const routes of routesByPath.values()) {
        allRoutes.push(...routes);
      }
      return allRoutes;
    },

    /**
     * Get routes organized by file path
     */
    getRoutesByFile: () => new Map(routesByPath),
  };
}
