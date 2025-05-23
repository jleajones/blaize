import { AppRoutesToClientAPI, ExtractRouteType, Route } from '@blaizejs/types';

/**
 * Helper function that accepts route objects and extracts their types
 * Usage: defineAppRoutes({ '/users': usersRoute, '/posts': postsRoute })
 */
export function defineAppRoutes<T extends Record<string, Route>>(
  routes: T
): AppRoutesToClientAPI<{
  [K in keyof T]: T[K] extends Route ? ExtractRouteType<T[K]> : never;
}> {
  return routes as any; // Type-only function for now
}
