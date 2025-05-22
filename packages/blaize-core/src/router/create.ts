import { RouteDefinition, CreateRoute, RouteOptions } from '@blaizejs/types';

import { getGlobalConfig } from '../config/global';

function isTestEnvironment(filePath: string): boolean {
  return (
    // Environment variables
    process.env.NODE_ENV === 'test' ||
    process.env.VITEST === 'true' ||
    process.env.JEST_WORKER_ID !== undefined ||
    // File path indicators
    filePath.includes('.test.') ||
    filePath.includes('.spec.') ||
    filePath.includes('__tests__') ||
    filePath.includes('/test/') ||
    filePath.includes('/tests/')
  );
}

/**
 * Get the calling file path and convert to API path
 */
function getCallerApiPath(options: RouteOptions = {}): string {
  const stack = new Error().stack;
  if (!stack) throw new Error('Could not determine caller file path');

  const stackLines = stack.split('\n');
  // Find the line that called createRoute (usually 3rd line)
  const callerLine = stackLines[3];
  const match =
    callerLine?.match(/\((.+):[\d]+:[\d]+\)/) || callerLine?.match(/at (.+):[\d]+:[\d]+/);

  if (!match) throw new Error('Could not parse caller file path');

  const filePath = match[1];

  // Convert file path to API path
  let apiPath = convertFilePathToApiPath(filePath!);

  // Apply basePath if provided
  if (options.basePath) {
    // Ensure basePath starts with / and doesn't end with /
    let basePath = options.basePath;
    if (!basePath.startsWith('/')) {
      basePath = '/' + basePath;
    }
    if (basePath.endsWith('/')) {
      basePath = basePath.slice(0, -1);
    }

    // Combine basePath with apiPath
    if (apiPath === '/') {
      apiPath = basePath;
    } else {
      apiPath = basePath + apiPath;
    }
  }

  return apiPath;
}

/**
 * Convert file system path to API path
 * routes/users/[userId]/posts.ts -> /users/[userId]/posts
 * But also handle your existing :userId format for compatibility
 */
function convertFilePathToApiPath(filePath: string): string {
  const config = getGlobalConfig();
  const routesDir = config.routesDir || './routes';

  // Extract just the directory name from the path
  const routesDirName = routesDir.replace(/^\.\//, '').replace(/\/$/, '');

  // Look for the routes directory name
  const routesIndex = filePath.lastIndexOf(`/${routesDirName}/`);
  if (routesIndex === -1) {
    if (isTestEnvironment(filePath)) {
      console.log('Test environment detected, returning default path');
      return '/';
    }

    throw new Error(`Route file must be in a '${routesDir}' directory: ${filePath}`);
  }

  let apiPath = filePath.substring(routesIndex + routesDirName.length + 2);

  // Remove file extension
  apiPath = apiPath.replace(/\.(ts|js)$/, '');

  // Handle index files
  if (apiPath.endsWith('/index')) {
    apiPath = apiPath.slice(0, -6); // Remove '/index'
  }

  // Convert [param] to :param format to match your router's expectations
  apiPath = apiPath.replace(/\[([^\]]+)\]/g, ':$1');

  // Ensure it starts with /
  if (!apiPath.startsWith('/')) {
    apiPath = `/${apiPath}`;
  }

  // Handle root index
  if (apiPath === '/') {
    return '/';
  }

  return apiPath;
}

/**
 * Create a new route definition with type checking
 */
export const create: CreateRoute = (definition, options = {}) => {
  // Validate the route definition
  validateRouteDefinition(definition as RouteDefinition);

  // Get the API path from the calling file
  const apiPath = getCallerApiPath(options);

  // Create the route object with the provided path or default
  // return {
  //   ...definition,
  //   path: options.basePath || '/',
  // } as Route;
  return {
    ...definition,
    path: apiPath,
    __routeRegistry: {} as any,
  } as typeof definition & {
    path: string;
    __routeRegistry: any;
  };
};

/**
 * Validate a route definition
 */
function validateRouteDefinition(definition: RouteDefinition): void {
  // Ensure at least one method is defined
  if (Object.keys(definition).length === 0) {
    throw new Error('Route definition must contain at least one HTTP method');
  }

  // Validate each method handler
  for (const [method, methodOptions] of Object.entries(definition)) {
    if (!methodOptions) continue;

    if (!methodOptions.handler || typeof methodOptions.handler !== 'function') {
      throw new Error(`Handler for method ${method} must be a function`);
    }

    // Validate middleware if provided
    if (methodOptions.middleware && !Array.isArray(methodOptions.middleware)) {
      throw new Error(`Middleware for method ${method} must be an array`);
    }
  }
}
