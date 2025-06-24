import { compilePathPattern, extractParams } from './params';

import type {
  HttpMethod,
  RouteMethodOptions,
  RouteMatch,
  Matcher,
  RouteEntry,
  Route,
} from '../../index';

/**
 * Create a route matcher
 */
export function createMatcher(): Matcher {
  // Private state
  const routes: RouteEntry[] = [];

  return {
    /**
     * Add a route to the matcher
     */
    add(path: string, method: HttpMethod, routeOptions: RouteMethodOptions) {
      const { pattern, paramNames } = compilePathPattern(path);

      const newRoute: RouteEntry = {
        path,
        method,
        pattern,
        paramNames,
        routeOptions,
      };

      // Find the insertion point using findIndex
      const insertIndex = routes.findIndex(route => paramNames.length < route.paramNames.length);

      // If no insertion point found, append to end
      if (insertIndex === -1) {
        routes.push(newRoute);
      } else {
        routes.splice(insertIndex, 0, newRoute);
      }
    },

    /**
     * Remove a route from the matcher by path
     */
    remove(path: string) {
      // Remove all routes that match the given path
      for (let i = routes.length - 1; i >= 0; i--) {
        if ((routes[i] as Route).path === path) {
          routes.splice(i, 1);
        }
      }
    },

    /**
     * Clear all routes from the matcher
     */
    clear() {
      routes.length = 0;
    },

    /**
     * Match a URL path to a route
     */
    match(path: string, method: HttpMethod): RouteMatch | null {
      // First, try to find an exact match for the method
      const pathname = path.split('?')[0];
      if (!pathname) return null;

      for (const route of routes) {
        // Skip routes that don't match the method
        if (route.method !== method) continue;

        // Try to match the path
        const match = route.pattern.exec(pathname);
        if (match) {
          // Extract parameters from the match
          const params = extractParams(path, route.pattern, route.paramNames);

          return {
            route: route.routeOptions,
            params,
          };
        }
      }

      // If no exact method match, check if path exists but method is different
      // This allows returning 405 Method Not Allowed instead of 404 Not Found
      const matchingPath = routes.find(
        route => route.method !== method && route.pattern.test(path)
      );

      if (matchingPath) {
        // Return null but with allowedMethods to indicate method not allowed
        return {
          route: null,
          params: {},
          methodNotAllowed: true,
          allowedMethods: routes
            .filter(route => route.pattern.test(path))
            .map(route => route.method),
        } as unknown as RouteMatch; // Type assertion for the extended return type
      }

      return null; // No match found
    },

    /**
     * Get all registered routes
     */
    getRoutes(): { path: string; method: HttpMethod }[] {
      return routes.map(route => ({
        path: route.path,
        method: route.method,
      }));
    },

    /**
     * Find routes matching a specific path
     */
    findRoutes(
      path: string
    ): { path: string; method: HttpMethod; params: Record<string, string> }[] {
      return routes
        .filter(route => route.pattern.test(path))
        .map(route => ({
          path: route.path,
          method: route.method,
          params: extractParams(path, route.pattern, route.paramNames),
        }));
    },
  };
}
