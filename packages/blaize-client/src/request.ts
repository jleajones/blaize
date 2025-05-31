
import { ClientConfig, RequestArgs, RequestOptions } from '@blaizejs/types';

import { ClientError, NetworkError, handleResponseError } from './errors';
import { buildUrl } from './url';

export async function makeRequest(
  config: ClientConfig,
  method: string,
  routeName: string,
  args?: RequestArgs,
  routeRegistry?: any
): Promise<any> {
  // TODO: Extract path from route registry
  const path = extractRoutePath(routeRegistry, method, routeName);
  
  // TODO: Build complete URL
  const url = buildUrl(config.baseUrl, path, args);
  
  // TODO: Prepare request options
  const requestOptions = prepareRequestOptions(config, method, args);
  
  // TODO: Make HTTP request
  return executeRequest(url, requestOptions);
}

function extractRoutePath(
  routeRegistry: any, 
  method: string, 
  routeName: string
): string {
  // TODO: Get path from registry
  // routeRegistry.$get[routeName].path
  const methodKey = `$${method.toLowerCase()}`;
  const route = routeRegistry?.[methodKey]?.[routeName];
  return route?.path || `/${routeName}`;
}

function prepareRequestOptions(
  config: ClientConfig, 
  method: string, 
  args?: RequestArgs
): RequestOptions {
  // TODO: Build fetch options
  return {
    method: method.toUpperCase(),
    url: '', // Will be set by caller
    headers: {
      'Content-Type': 'application/json',
      ...config.defaultHeaders
    },
    body: args?.body ? JSON.stringify(args.body) : undefined,
    timeout: config.timeout || 5000
  };
}

async function executeRequest(url: string, options: RequestOptions): Promise<any> {
  // TODO: Make actual fetch request
  // TODO: Handle timeouts
  // TODO: Parse response
  // TODO: Handle errors
  
  try {
    const response = await fetch(url, {
      method: options.method,
      headers: options.headers,
      body: options.body
    });
    
    if (!response.ok) {
      handleResponseError(response);
    }
    
    return await response.json();
  } catch (error) {
    if (error instanceof ClientError) {
      throw error;
    }
    throw new NetworkError('Network request failed', error as Error);
  }
}