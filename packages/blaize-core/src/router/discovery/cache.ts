// packages/blaize-core/src/router/discovery/cache.ts
import * as crypto from 'node:crypto';
import * as fs from 'node:fs/promises';

import { loadRouteModule } from './loader';

import type { FileCache, Route } from '@blaize-types/router';

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
