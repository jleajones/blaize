import type { CreateClient, ClientConfig, RequestArgs } from '@blaizejs/types';

import { makeRequest } from './request';

export function createClient<TRoutes extends Record<string, Record<string, any>>>(
  baseUrlOrConfig: string | ClientConfig,
  routeRegistry?: TRoutes
): CreateClient<TRoutes> {
  // TODO: Process configuration
  const config = processConfig(baseUrlOrConfig);
  
  // TODO: Create proxy-based client
  return createProxyClient<TRoutes>(config, routeRegistry); // Add <TRoutes> here
}

function processConfig(baseUrlOrConfig: string | ClientConfig): ClientConfig {
  // TODO: Normalize configuration
  return typeof baseUrlOrConfig === 'string' 
    ? { baseUrl: baseUrlOrConfig, timeout: 5000 }
    : { timeout: 5000, ...baseUrlOrConfig };
}

// Add the constraint to this function too
function createProxyClient<TRoutes extends Record<string, Record<string, any>>>(
  config: ClientConfig, 
  routeRegistry?: TRoutes
): CreateClient<TRoutes> {
  // TODO: Implement proxy for dynamic method access
  return new Proxy({} as CreateClient<TRoutes>, {
    get(target, httpMethod: string) {
      if (httpMethod.startsWith('$')) {
        return new Proxy({}, {
          get(_, routeName: string) {
            return async (args?: RequestArgs) => {
              const method = httpMethod.slice(1).toUpperCase();
              return makeRequest(config, method, routeName, args, routeRegistry);
            };
          }
        });
      }
      return target[httpMethod as keyof CreateClient<TRoutes>];
    }
  });
}
