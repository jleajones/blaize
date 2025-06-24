import { parseRoutePath } from './parser';

import type { Route, RouteDefinition } from '../../index';

export async function dynamicImport(filePath: string) {
  // Add a cache-busting query parameter for ESM
  const cacheBuster = `?t=${Date.now()}`;
  const importPath = filePath + cacheBuster;

  try {
    const module = await import(importPath);
    console.log(`✅ Successfully imported module`);
    return module;
  } catch (error) {
    // Type guard to ensure resolveError is an Error object
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(`⚠️ Error importing with cache buster, trying original path:`, errorMessage);
    // Fallback to original path
    return import(filePath);
  }
}

/**
 * Load route modules from a file - supports both default export and named exports
 */
export async function loadRouteModule(filePath: string, basePath: string): Promise<Route[]> {
  try {
    // Parse the route path from the file path
    const parsedRoute = parseRoutePath(filePath, basePath);
    // Dynamically import the module
    const module = await dynamicImport(filePath);
    console.log('📦 Module exports:', Object.keys(module));

    const routes: Route[] = [];

    // Method 1: Check for default export (existing pattern)
    if (module.default && typeof module.default === 'object') {
      const route: Route = {
        ...(module.default as RouteDefinition),
        path: parsedRoute.routePath,
      };

      routes.push(route);
    }

    // Method 2: Check for named exports that look like routes
    Object.entries(module).forEach(([exportName, exportValue]) => {
      // Skip default export (already handled) and non-objects
      if (exportName === 'default' || !exportValue || typeof exportValue !== 'object') {
        return;
      }

      // Check if this export looks like a route (has path property and HTTP methods)
      const potentialRoute = exportValue as any;

      if (isValidRoute(potentialRoute)) {
        // For named exports, we might want to use the export name or the route's path
        const route: Route = {
          ...potentialRoute,
          // Use the route's own path if it has one, otherwise derive from file
          path: parsedRoute.routePath,
        };

        routes.push(route);
      }
    });

    if (routes.length === 0) {
      console.warn(`Route file ${filePath} does not export any valid route definitions`);
      return [];
    }

    console.log(`✅ Successfully Loaded ${routes.length} route(s)`);
    return routes;
  } catch (error) {
    console.error(`Failed to load route module ${filePath}:`, error);
    return [];
  }
}

/**
 * Check if an object looks like a valid route
 */
function isValidRoute(obj: any): boolean {
  if (!obj || typeof obj !== 'object') {
    return false;
  }

  // Check if it has at least one HTTP method
  const httpMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
  const hasHttpMethod = httpMethods.some(
    method => obj[method] && typeof obj[method] === 'object' && obj[method].handler
  );

  return hasHttpMethod;
}
