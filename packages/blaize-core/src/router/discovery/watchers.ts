import * as path from 'node:path';

import { watch } from 'chokidar';

import { hasRouteContentChanged, processChangedFile } from './cache';
import { findRouteFiles } from './finder';

import type { Route, WatchOptions } from '../../index';

/**
 * Watch for route file changes
 */
export function watchRoutes(routesDir: string, options: WatchOptions = {}) {
  // Debounce rapid file changes
  const debounceMs = options.debounceMs || 16;
  const debouncedCallbacks = new Map<string, NodeJS.Timeout>();

  function createDebouncedCallback<T extends (...args: any[]) => void>(
    fn: T,
    filePath: string
  ): (...args: Parameters<T>) => void {
    return (...args: Parameters<T>) => {
      // Clear existing timeout for this file
      const existingTimeout = debouncedCallbacks.get(filePath);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      // Set new timeout
      const timeoutId = setTimeout(() => {
        fn(...args);
        debouncedCallbacks.delete(filePath);
      }, debounceMs);

      debouncedCallbacks.set(filePath, timeoutId);
    };
  }
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

  // Optimized load and notify function
  async function loadAndNotify(filePath: string) {
    try {
      const existingRoutes = routesByPath.get(filePath);

      // Step 1: Load new routes WITHOUT updating cache
      const newRoutes = await processChangedFile(filePath, routesDir, false);

      if (!newRoutes || newRoutes.length === 0) {
        return;
      }

      // Step 2: Check if content has actually changed (cache still has old data)
      if (existingRoutes && !hasRouteContentChanged(filePath, newRoutes)) {
        return;
      }

      // Step 3: Content changed! Now update the cache
      await processChangedFile(filePath, routesDir, true);

      const normalizedPath = path.normalize(filePath);

      if (existingRoutes) {
        routesByPath.set(filePath, newRoutes);
        if (options.onRouteChanged) {
          options.onRouteChanged(normalizedPath, newRoutes);
        }
      } else {
        routesByPath.set(filePath, newRoutes);
        if (options.onRouteAdded) {
          options.onRouteAdded(normalizedPath, newRoutes);
        }
      }
    } catch (error) {
      console.log(`⚠️ Error processing file ${filePath}:`, error);
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
      console.error('⚠️ Route watcher error:', error);
    }
  }

  // Start file watcher
  // Create optimized watcher
  const watcher = watch(routesDir, {
    // Much faster response times
    awaitWriteFinish: {
      stabilityThreshold: 50, // Reduced from 300ms
      pollInterval: 10, // Reduced from 100ms
    },

    // Performance optimizations
    usePolling: false,
    atomic: true,
    followSymlinks: false,
    depth: 10,

    // More aggressive ignoring
    ignored: [
      /(^|[/\\])\../,
      /node_modules/,
      /\.git/,
      /\.DS_Store/,
      /Thumbs\.db/,
      /\.(test|spec)\.(ts|js)$/,
      /\.d\.ts$/,
      /\.map$/,
      /~$/,
      ...(options.ignore || []),
    ],
  });

  // Set up event handlers
  watcher
    .on('add', filePath => {
      const debouncedLoad = createDebouncedCallback(loadAndNotify, filePath);
      debouncedLoad(filePath);
    })
    .on('change', filePath => {
      const debouncedLoad = createDebouncedCallback(loadAndNotify, filePath);

      // Call debounced load for changed file
      debouncedLoad(filePath);
    })
    .on('unlink', filePath => {
      const debouncedRemove = createDebouncedCallback(handleRemoved, filePath);
      debouncedRemove(filePath);
    })
    .on('error', handleError);

  // Load initial routes
  loadInitialRoutes().catch(handleError);

  // Return control methods
  return {
    close: () => {
      // Clear any pending debounced callbacks
      debouncedCallbacks.forEach(timeout => clearTimeout(timeout));
      debouncedCallbacks.clear();

      return watcher.close();
    },
    getRoutes: () => {
      const allRoutes: Route[] = [];
      for (const routes of routesByPath.values()) {
        allRoutes.push(...routes);
      }
      return allRoutes;
    },
    getRoutesByFile: () => new Map(routesByPath),
  };
}
