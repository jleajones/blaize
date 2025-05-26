// define-app-routes.ts - Fixed version
import { AppRoutesToClientAPI, ExtractRouteTypes } from '@blaizejs/types';

/**
 * Define app routes for type extraction
 * This is primarily a type-level function for client generation
 */
// define-app-routes.ts - Updated to return client API types

/**
 * Define app routes for type extraction and client generation
 */
export function defineAppRoutes<T extends Record<string, any>>(
  routes: T
): AppRoutesToClientAPI<{
  [K in keyof T]: ExtractRouteTypes<T[K]>;
}> {
  return routes as any;
}
