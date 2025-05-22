import { Route } from '@blaizejs/types';

import { findRouteFiles } from './finder';
import { loadRouteModule } from './loader';

export interface FindRoutesOptions {
  /** Base path for routes */
  basePath?: string;
  /** Ignore patterns for directory scanning */
  ignore?: string[];
}

/**
 * Find all routes in the specified directory
 */
export async function findRoutes(
  routesDir: string,
  options: FindRoutesOptions = {}
): Promise<Route[]> {
  // Find all route files
  const routeFiles = await findRouteFiles(routesDir, {
    ignore: options.ignore,
  });

  // Load all route modules
  const routes: Route[] = [];
  for (const filePath of routeFiles) {
    const route = await loadRouteModule(filePath, routesDir);
    if (route) {
      routes.push(route);
    }
  }

  return routes;
}
