/**
 * Enhanced BlaizeJS Client with SSE Support
 * Location: packages/blaize-client/src/client.ts
 */

import { buildProxyClient } from './proxy';

import type {
  BuildRoutesRegistry,
  ClientConfig,
  CreateClient,
  CreateEnhancedClient,
} from '@blaize-types/client';

/**
 * Create a type-safe client for BlaizeJS APIs with SSE support
 *
 * @param baseUrlOrConfig - Base URL string or configuration object
 * @param routeRegistry - Route definitions from your server (the raw routes object)
 * @returns Type-safe client with methods organized by HTTP verb and SSE namespace
 *
 * @example
 * ```typescript
 * import { createClient } from '@blaizejs/client';
 * import { routes } from './routes'; // Your raw route exports
 *
 * const client = createClient('https://api.example.com', routes);
 *
 * // Standard HTTP calls
 * await client.$get.getUser({ params: { id: '123' } });
 * await client.$post.createUser({ body: { name: 'John' } });
 *
 * // SSE connections
 * const events = await client.$sse.notifications();
 * events.on('message', (data) => console.log(data));
 * events.close();
 * ```
 *
 * @remarks
 * The function automatically transforms your route definitions into a client
 * with methods organized by HTTP verb and SSE namespace. TypeScript's inference
 * handles all the type transformations - you don't need to provide explicit type parameters.
 */
export function createClient<TRoutes extends Record<string, any>>(
  baseUrlOrConfig: string | ClientConfig,
  routeRegistry: TRoutes
): CreateEnhancedClient<TRoutes, CreateClient<BuildRoutesRegistry<TRoutes>>> {
  const config = normalizeConfig(baseUrlOrConfig);

  // Set default SSE options if not provided
  if (!config.sse) {
    config.sse = {
      reconnect: {
        enabled: true,
        maxAttempts: 5,
        initialDelay: 1000,
      },
      heartbeatTimeout: 30000,
      parseJSON: true,
    };
  }
  const httpRegistry = organizeRoutesByMethod(routeRegistry);

  // Pass both organized HTTP routes and raw routes for SSE extraction
  return buildProxyClient(config, httpRegistry, routeRegistry) as CreateEnhancedClient<
    TRoutes,
    CreateClient<BuildRoutesRegistry<TRoutes>>
  >;
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
