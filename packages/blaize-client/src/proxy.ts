/**
 * Enhanced Proxy with SSE Support
 * Location: packages/blaize-client/src/proxy.ts
 *
 * This module extends the existing proxy system to handle SSE routes
 * through the $sse namespace while maintaining backward compatibility
 */

import { makeRequest } from './request';
import { createSSEConnection } from './sse-connection';

import type { ClientConfig, InternalRequestArgs } from '@blaize-types/client';
import type { SSEClient, SSEClientOptions } from '@blaize-types/sse-client';

/**
 * Build the enhanced proxy-based client with SSE support
 * @internal
 */
export function buildProxyClient(
  config: ClientConfig,
  registry: Record<string, Record<string, any>>,
  rawRoutes: Record<string, any>
): unknown {
  // Extract SSE routes from raw routes
  const sseRoutes = extractSSERoutes(rawRoutes);

  return new Proxy(
    {},
    {
      get(_, namespace: string) {
        if (typeof namespace !== 'string') {
          return undefined;
        }

        // Handle SSE namespace
        if (namespace === '$sse') {
          return createSSEProxy(config, sseRoutes);
        }

        // Handle standard HTTP method namespaces
        if (!namespace.startsWith('$')) {
          return undefined;
        }

        const httpMethod = namespace.slice(1).toUpperCase();
        const methodRoutes = registry[namespace] || {};

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

/**
 * Extract SSE-enabled routes from the raw route registry
 * @internal
 */
function extractSSERoutes(routes: Record<string, any>): Record<string, any> {
  const sseRoutes: Record<string, any> = {};

  for (const [routeName, route] of Object.entries(routes)) {
    if (route && typeof route === 'object' && 'SSE' in route) {
      sseRoutes[routeName] = route;
    }
  }

  return sseRoutes;
}

/**
 * Create proxy for SSE routes
 * @internal
 */
function createSSEProxy(config: ClientConfig, sseRoutes: Record<string, any>): unknown {
  return new Proxy(
    {},
    {
      get(_, routeName: string) {
        const route = sseRoutes[routeName];

        if (!route || !route.SSE) {
          return undefined;
        }

        // Return async function that establishes SSE connection
        return async (args?: {
          params?: Record<string, any>;
          query?: Record<string, any>;
          options?: SSEClientOptions;
        }): Promise<SSEClient> => {
          // Check environment before attempting connection
          if (typeof window === 'undefined' || typeof window.EventSource === 'undefined') {
            const isNode = typeof process !== 'undefined' && process.versions?.node;
            throw new Error(
              `Cannot access SSE route '${routeName}' in ${isNode ? 'Node.js' : 'non-browser'} environment. SSE requires the EventSource API which is only available in browsers. ${
                isNode
                  ? 'For server-to-server communication, consider using WebSockets or HTTP/2 streaming.'
                  : ''
              }`
            );
          }
          const { params, query, options = {} } = args || {};

          // Build SSE URL from route path
          const path = route.path || `/${routeName}`;
          const url = buildSSEUrl(config.baseUrl, path, params, query);

          // Create and return SSE client
          return createSSEConnection(url, {
            ...config.sse, // Global SSE defaults from client config
            ...options, // Per-connection overrides
            headers: {
              ...config.defaultHeaders,
              ...config.sse?.headers, // Global SSE headers
              ...options.headers,
            },
          });
        };
      },
    }
  );
}

/**
 * Build URL for SSE connection
 * @internal
 */
function buildSSEUrl(
  baseUrl: string,
  path: string,
  params?: Record<string, any>,
  query?: Record<string, any>
): string {
  // Replace path parameters
  let url = path;
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url = url.replace(`:${key}`, encodeURIComponent(String(value)));
      url = url.replace(`[${key}]`, encodeURIComponent(String(value)));
    }
  }

  // Build full URL
  const fullUrl = new URL(url, baseUrl);

  // Add query parameters
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) {
        fullUrl.searchParams.append(key, String(value));
      }
    }
  }

  return fullUrl.toString();
}
