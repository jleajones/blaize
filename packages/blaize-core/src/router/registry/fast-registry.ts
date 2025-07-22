import type { Route, RouteRegistry } from '@blaize-types/router';

export function createRouteRegistry(): RouteRegistry {
  return {
    routesByPath: new Map(),
    routesByFile: new Map(),
    pathToFile: new Map(),
  };
}

export function updateRoutesFromFile(
  registry: RouteRegistry,
  filePath: string,
  newRoutes: Route[]
): { added: Route[]; removed: string[]; changed: Route[] } {
  console.log(`Updating routes from file: ${filePath}`);
  const oldPaths = registry.routesByFile.get(filePath) || new Set();
  const newPaths = new Set(newRoutes.map(r => r.path));

  // Fast diff calculation
  const added = newRoutes.filter(r => !oldPaths.has(r.path));
  const removed = Array.from(oldPaths).filter(p => !newPaths.has(p));
  const potentiallyChanged = newRoutes.filter(r => oldPaths.has(r.path));

  // Check for actual content changes
  const changed = potentiallyChanged.filter(route => {
    const existingRoute = registry.routesByPath.get(route.path);
    return !existingRoute || !routesEqual(existingRoute, route);
  });

  // Apply updates
  applyRouteUpdates(registry, filePath, { added, removed, changed });

  return { added, removed, changed };
}

export function getRouteFromRegistry(registry: RouteRegistry, path: string): Route | undefined {
  return registry.routesByPath.get(path);
}

export function getAllRoutesFromRegistry(registry: RouteRegistry): Route[] {
  return Array.from(registry.routesByPath.values());
}

export function getFileRoutes(registry: RouteRegistry, filePath: string): Route[] {
  const paths = registry.routesByFile.get(filePath) || new Set();
  return Array.from(paths)
    .map(path => registry.routesByPath.get(path)!)
    .filter(Boolean);
}

function applyRouteUpdates(
  registry: RouteRegistry,
  filePath: string,
  updates: { added: Route[]; removed: string[]; changed: Route[] }
): void {
  const { added, removed, changed } = updates;

  // Remove old routes
  removed.forEach(path => {
    registry.routesByPath.delete(path);
    registry.pathToFile.delete(path);
  });

  // Add/update routes
  [...added, ...changed].forEach(route => {
    registry.routesByPath.set(route.path, route);
    registry.pathToFile.set(route.path, filePath);
  });

  // Update file -> paths mapping
  const allPathsForFile = new Set([
    ...added.map(r => r.path),
    ...changed.map(r => r.path),
    ...Array.from(registry.routesByFile.get(filePath) || []).filter(p => !removed.includes(p)),
  ]);

  if (allPathsForFile.size > 0) {
    registry.routesByFile.set(filePath, allPathsForFile);
  } else {
    registry.routesByFile.delete(filePath);
  }
}

function routesEqual(route1: Route, route2: Route): boolean {
  if (route1.path !== route2.path) return false;

  const methods1 = Object.keys(route1)
    .filter(k => k !== 'path')
    .sort();
  const methods2 = Object.keys(route2)
    .filter(k => k !== 'path')
    .sort();

  if (methods1.length !== methods2.length) return false;

  return methods1.every(method => {
    const handler1 = route1[method as keyof Route];
    const handler2 = route2[method as keyof Route];

    // Compare handler signatures/structure rather than function references
    return typeof handler1 === typeof handler2;
  });
}
