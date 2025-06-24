import * as crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import * as path from 'node:path';

import { loadRouteModule } from './loader';

import type { FileCache, Route } from '../../index';

const fileRouteCache = new Map<string, FileCache>();

export async function processChangedFile(
  filePath: string,
  routesDir: string,
  updateCache: boolean = true
): Promise<Route[]> {
  const stat = await fs.stat(filePath);
  const lastModified = stat.mtime.getTime();
  const cachedEntry = fileRouteCache.get(filePath);

  // Skip if file hasn't changed by timestamp (only when updating cache)
  if (updateCache && cachedEntry && cachedEntry.timestamp === lastModified) {
    return cachedEntry.routes;
  }

  // Clear module cache for this specific file
  invalidateModuleCache(filePath);

  // Load only this file
  const routes = await loadRouteModule(filePath, routesDir);

  // Only update cache if requested
  if (updateCache) {
    // Calculate content hash for change detection
    const hash = hashRoutes(routes);

    // Update cache
    fileRouteCache.set(filePath, {
      routes,
      timestamp: lastModified,
      hash,
    });
  }

  return routes;
}

export function hasRouteContentChanged(filePath: string, newRoutes: Route[]): boolean {
  const cachedEntry = fileRouteCache.get(filePath);
  if (!cachedEntry) {
    return true;
  }

  const newHash = hashRoutes(newRoutes);

  return cachedEntry.hash !== newHash;
}

export function clearFileCache(filePath?: string): void {
  if (filePath) {
    fileRouteCache.delete(filePath);
  } else {
    fileRouteCache.clear();
  }
}

function hashRoutes(routes: Route[]): string {
  const routeData = routes.map(route => ({
    path: route.path,
    methods: Object.keys(route)
      .filter(key => key !== 'path')
      .sort()
      .map(method => {
        const methodDef = route[method as keyof Route] as any;
        const handlerString = methodDef?.handler ? methodDef.handler.toString() : null;
        return {
          method,
          // Include handler function string for change detection
          handler: handlerString,
          // Include middleware if present
          middleware: methodDef?.middleware ? methodDef.middleware.length : 0,
          // Include schema structure (but not full serialization which can be unstable)
          hasSchema: !!methodDef?.schema,
          schemaKeys: methodDef?.schema ? Object.keys(methodDef.schema).sort() : [],
        };
      }),
  }));

  const dataString = JSON.stringify(routeData);
  const hash = crypto.createHash('md5').update(dataString).digest('hex');

  return hash;
}

function invalidateModuleCache(filePath: string): void {
  try {
    // Try to resolve the absolute path
    const absolutePath = path.resolve(filePath);

    // Check if we're in a CommonJS environment (require is available)
    if (typeof require !== 'undefined') {
      // Delete from require cache if it exists
      delete require.cache[absolutePath];

      // Also try to resolve using require.resolve if the file exists
      try {
        const resolvedPath = require.resolve(absolutePath);
        delete require.cache[resolvedPath];
      } catch (resolveError) {
        // Type guard to ensure resolveError is an Error object
        const errorMessage =
          resolveError instanceof Error ? resolveError.message : String(resolveError);
        console.log(`⚠️ Could not resolve path: ${errorMessage}`);
      }
    } else {
      // In pure ESM environment, try to use createRequire for cache invalidation
      try {
        const require = createRequire(import.meta.url);
        delete require.cache[absolutePath];

        try {
          const resolvedPath = require.resolve(absolutePath);
          delete require.cache[resolvedPath];
        } catch {
          console.log(`⚠️ Could not resolve ESM path`);
        }
      } catch {
        console.log(`⚠️ createRequire not available in pure ESM`);
      }
    }
  } catch (error) {
    console.log(`⚠️ Error during module cache invalidation for ${filePath}:`, error);
  }
}
