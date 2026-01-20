import {
  transformClientError,
  parseAndThrowErrorResponse,
  generateClientCorrelationId,
} from './error-transformer';
import { buildRequestOptions } from './request-options-builder';
import { buildUrl } from './url';
import {
  BlaizeError,
  type ClientConfig,
  type InternalRequestArgs,
  type RequestOptions,
} from '../../blaize-types/src/index';

export async function makeRequest(
  config: ClientConfig,
  method: string,
  routeName: string,
  args?: InternalRequestArgs,
  routeRegistry?: any
): Promise<any> {
  const correlationId = generateClientCorrelationId();
  try {
    // Extract path from route registry
    const path = extractRoutePath(routeRegistry, method, routeName);

    // Build complete URL
    const url = buildUrl(config.baseUrl, path, args);

    // Prepare request options
    const requestOptions = buildRequestOptions(config, method, args, correlationId);

    // Make HTTP request with error transformation
    return await executeRequest(url, requestOptions, correlationId);
  } catch (error) {
    // Transform ALL errors to BlaizeError instances
    transformClientError(error, {
      url: config.baseUrl,
      method,
      correlationId,
    });
  }
}

function extractRoutePath(routeRegistry: any, method: string, routeName: string): string {
  if (!routeRegistry) {
    throw new Error(`Route '${routeName}' not found for method '${method}'`);
  }

  const methodKey = `$${method.toLowerCase()}`;
  const route = routeRegistry[methodKey]?.[routeName];

  if (!route?.path) {
    throw new Error(`Route '${routeName}' not found for method '${method}'`);
  }

  return route.path;
}

async function executeRequest(
  url: string,
  options: RequestOptions,
  correlationId: string
): Promise<any> {
  try {
    const response = await fetch(url, {
      method: options.method,
      headers: options.headers,
      body: options.body,
    });

    if (!response.ok) {
      await parseAndThrowErrorResponse(response);
    }
    try {
      return await response.json();
    } catch (parseError) {
      // For successful responses that fail to parse, use actual response status
      transformClientError(parseError, {
        url,
        method: options.method,
        correlationId,
        statusCode: response.status,
        contentType: response.headers.get('content-type') || 'unknown',
        responseSample: 'Unable to parse response as JSON',
      });
    }
  } catch (error) {
    if (error instanceof BlaizeError) {
      throw error;
    }
    transformClientError(error, {
      url,
      method: options.method,
      correlationId,
      statusCode: 0, // Unknown for client errors
      contentType: 'unknown',
      responseSample: 'Unable to capture response sample',
    });
  }
}
