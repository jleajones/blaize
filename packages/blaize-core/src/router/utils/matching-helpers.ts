import type { Route, HttpMethod, RouteMethodOptions, Matcher } from '../../index';

export function addRouteToMatcher(route: Route, matcher: Matcher): void {
  Object.entries(route).forEach(([method, methodOptions]) => {
    if (method === 'path' || !methodOptions) return;
    matcher.add(route.path, method as HttpMethod, methodOptions as RouteMethodOptions);
  });
}

export function removeRouteFromMatcher(path: string, matcher: Matcher): void {
  // Use matcher's remove method if available, otherwise fallback to clear/rebuild
  if ('remove' in matcher && typeof matcher.remove === 'function') {
    matcher.remove(path);
  } else {
    // This requires rebuilding the matcher - could be optimized
    console.warn('Matcher does not support selective removal, consider adding remove() method');
  }
}

export function updateRouteInMatcher(route: Route, matcher: Matcher): void {
  removeRouteFromMatcher(route.path, matcher);
  addRouteToMatcher(route, matcher);
}

export function rebuildMatcherWithRoutes(routes: Route[], matcher: Matcher): void {
  if ('clear' in matcher && typeof matcher.clear === 'function') {
    matcher.clear();
  }

  routes.forEach(route => addRouteToMatcher(route, matcher));
}
