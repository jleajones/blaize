import type { CreateClient, BuildRoutesRegistry, RequestArgs, ClientConfig } from '@blaizejs/types';

import { makeRequest } from './request';

export function createClient<TRoutes extends Record<string, any> = Record<string, any>>(
  baseUrlOrConfig: string | ClientConfig,
  routeRegistry: TRoutes
): CreateClient<BuildRoutesRegistry<TRoutes>> {
  // TODO: Process configuration
  const config = processConfig(baseUrlOrConfig);

  // TODO: Create proxy-based client
  return createProxyClient<BuildRoutesRegistry<TRoutes>>(config, routeRegistry);
}

function processConfig(baseUrlOrConfig: string | ClientConfig): ClientConfig {
  // TODO: Normalize configuration
  return typeof baseUrlOrConfig === 'string'
    ? { baseUrl: baseUrlOrConfig, timeout: 5000 }
    : { timeout: 5000, ...baseUrlOrConfig };
}

// Update the proxy client function signature too
function createProxyClient<TRoutes extends Record<string, Record<string, any>>>(
  config: ClientConfig,
  routeRegistry: any // We'll transform this at runtime
): CreateClient<TRoutes> {
  // We need to transform the flat routes into the $get/$post structure
  const transformedRegistry = transformRouteRegistry(routeRegistry);

  return new Proxy({} as CreateClient<TRoutes>, {
    get(target, httpMethod: string) {
      if (httpMethod.startsWith('$')) {
        return new Proxy(
          {},
          {
            get(_, routeName: string) {
              return async (args?: RequestArgs) => {
                const method = httpMethod.slice(1).toUpperCase();
                return makeRequest(config, method, routeName, args, transformedRegistry);
              };
            },
          }
        );
      }
      return target[httpMethod as keyof CreateClient<TRoutes>];
    },
  });
}

// Helper function to transform flat routes into $method structure
function transformRouteRegistry(routes?: Record<string, any>) {
  if (!routes) return undefined;

  const transformed: Record<string, Record<string, any>> = {};

  for (const [routeName, route] of Object.entries(routes)) {
    // Extract the HTTP method from the route
    const method = Object.keys(route).find(
      key =>
        key !== 'path' && ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'].includes(key)
    );

    if (method) {
      const methodKey = `$${method.toLowerCase()}`;
      if (!transformed[methodKey]) {
        transformed[methodKey] = {};
      }
      transformed[methodKey][routeName] = route;
    }
  }

  return transformed;
}
