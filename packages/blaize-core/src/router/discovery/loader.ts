import { Route, RouteDefinition } from '@blaizejs/types';

import { parseRoutePath } from './parser';

export async function dynamicImport(filePath: string) {
  return import(filePath);
}

/**
 * Load a route module from a file
 */
export async function loadRouteModule(filePath: string, basePath: string): Promise<Route | null> {
  try {
    // Parse the route path from the file path
    const parsedRoute = parseRoutePath(filePath, basePath);
    console.log('parsedRoute:', parsedRoute);

    // Dynamically import the module
    const module = await dynamicImport(filePath);

    // Get the route definition from the module
    const definition = module.default;
    console.log('Route definition:', definition);

    if (!definition || typeof definition !== 'object') {
      console.warn(`Route file ${filePath} does not export a default route definition`);
      return null;
    }

    // Create the route object
    const route: Route = {
      ...(definition as RouteDefinition),
      path: parsedRoute.routePath,
    };

    return route;
  } catch {
    console.error(`Failed to load route module ${filePath}`);
    return null;
  }
}
