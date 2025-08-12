import { makeRequest } from './request';

import type {
  CreateClient,
  BuildRoutesRegistry,
  ClientConfig,
  InternalRequestArgs,
} from '../../blaize-types/src/index';

/**
 * Create a type-safe client for BlaizeJS APIs
 *
 * @param baseUrlOrConfig - Base URL string or configuration object
 * @param routeRegistry - Route definitions from your server (the raw routes object)
 * @returns Type-safe client with methods organized by HTTP verb
 *
 * @example
 * ```typescript
 * import { createClient } from '@blaizejs/client';
 * import { routes } from './routes'; // Your raw route exports
 *
 * // ✅ CORRECT - Let TypeScript infer the types
 * const client = createClient('https://api.example.com', routes);
 *
 * // ✅ CORRECT - With configuration
 * const client = createClient({
 *   baseUrl: 'https://api.example.com',
 *   timeout: 10000,
 *   defaultHeaders: { 'X-API-Key': 'secret' }
 * }, routes);
 *
 * // ❌ INCORRECT - Don't pass AppType or BuildRoutesRegistry types
 * // const client = createClient<AppType>('https://api.example.com', routes);
 *
 * // Usage - TypeScript knows which arguments are needed:
 * await client.$get.getUser({ params: { id: '123' } });
 * await client.$post.createUser({ body: { name: 'John' } });
 * await client.$get.healthCheck(); // No args needed if no schemas defined
 * ```
 *
 * @remarks
 * The function automatically transforms your route definitions into a client
 * with methods organized by HTTP verb. TypeScript's inference handles all
 * the type transformations - you don't need to provide explicit type parameters.
 */
export function createClient<TRoutes extends Record<string, any>>(
  baseUrlOrConfig: string | ClientConfig,
  routeRegistry: TRoutes
): CreateClient<BuildRoutesRegistry<TRoutes>> {
  const config = normalizeConfig(baseUrlOrConfig);
  const registry = organizeRoutesByMethod(routeRegistry);

  return buildProxyClient(config, registry) as CreateClient<BuildRoutesRegistry<TRoutes>>;
}

/**
 * Normalize configuration
 * @internal
 */
function normalizeConfig(baseUrlOrConfig: string | ClientConfig): ClientConfig {
  if (typeof baseUrlOrConfig === 'string') {
    return {
      baseUrl: baseUrlOrConfig.endsWith('/') ? baseUrlOrConfig.slice(0, -1) : baseUrlOrConfig,
      timeout: 5000,
    };
  }

  return {
    timeout: 5000,
    ...baseUrlOrConfig,
    baseUrl: baseUrlOrConfig.baseUrl.endsWith('/')
      ? baseUrlOrConfig.baseUrl.slice(0, -1)
      : baseUrlOrConfig.baseUrl,
  };
}

/**
 * Organize routes by HTTP method
 * @internal
 */
function organizeRoutesByMethod(routes: Record<string, any>): Record<string, Record<string, any>> {
  if (!routes || typeof routes !== 'object') {
    throw new Error('Route registry is required and must be an object');
  }

  const organized: Record<string, Record<string, any>> = {};

  for (const [routeName, route] of Object.entries(routes)) {
    if (!route || typeof route !== 'object') {
      console.warn(`Skipping invalid route: ${routeName}`);
      continue;
    }

    // Find the HTTP method in the route
    const httpMethod = Object.keys(route).find(key =>
      ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'].includes(key)
    );

    if (httpMethod) {
      const methodKey = `$${httpMethod.toLowerCase()}`;

      if (!organized[methodKey]) {
        organized[methodKey] = {};
      }

      // Store the entire route object
      organized[methodKey][routeName] = route;
    }
  }

  return organized;
}

/**
 * Build the proxy-based client
 * @internal
 */
function buildProxyClient(
  config: ClientConfig,
  registry: Record<string, Record<string, any>>
): unknown {
  return new Proxy(
    {},
    {
      get(_, httpMethodKey: string) {
        if (typeof httpMethodKey !== 'string' || !httpMethodKey.startsWith('$')) {
          return undefined;
        }

        const httpMethod = httpMethodKey.slice(1).toUpperCase();
        const methodRoutes = registry[httpMethodKey] || {};

        return new Proxy(
          {},
          {
            get(_, routeName: string) {
              const route = methodRoutes[routeName];

              if (!route) {
                return undefined;
              }

              // Return a function that can be called with or without args
              // The type system enforces whether args are required
              return (...args: any[]) => {
                // Get the first argument if provided, otherwise use empty object
                const requestArgs: InternalRequestArgs = args[0] || {};

                return makeRequest(config, httpMethod, routeName, requestArgs, {
                  [`$${httpMethod.toLowerCase()}`]: { [routeName]: route },
                });
              };
            },
          }
        );
      },
    }
  );
}
