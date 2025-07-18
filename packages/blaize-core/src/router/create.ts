import { fileURLToPath } from 'node:url';

import { getRoutesDir } from '../config';
import { parseRoutePath } from './discovery/parser';

import type {
  CreateGetRoute,
  CreatePostRoute,
  CreatePutRoute,
  CreateDeleteRoute,
  CreatePatchRoute,
  CreateHeadRoute,
  CreateOptionsRoute,
} from '@blaize-types/router';

/**
 * Get the file path of the function that called createXRoute
 */
function getCallerFilePath(): string {
  const originalPrepareStackTrace = Error.prepareStackTrace;

  try {
    Error.prepareStackTrace = (_, stack) => stack;
    const stack = new Error().stack as unknown as NodeJS.CallSite[];

    // Stack: getCallerFilePath -> createXRoute -> route file
    const callerFrame = stack[3];
    if (!callerFrame || typeof callerFrame.getFileName !== 'function') {
      throw new Error('Unable to determine caller file frame');
    }
    const fileName = callerFrame.getFileName();

    if (!fileName) {
      throw new Error('Unable to determine caller file name');
    }

    if (fileName.startsWith('file://')) {
      return fileURLToPath(fileName);
    }

    return fileName;
  } finally {
    Error.prepareStackTrace = originalPrepareStackTrace;
  }
}

/**
 * Convert caller file path to route path using existing parsing logic
 */
function getRoutePath(): string {
  const callerPath = getCallerFilePath();
  const routesDir = getRoutesDir();

  const parsedRoute = parseRoutePath(callerPath, routesDir);
  console.log(`🔎 Parsed route path: ${parsedRoute.routePath} from file: ${callerPath}`);

  return parsedRoute.routePath;
}

/**
 * Create a GET route
 */
export const createGetRoute: CreateGetRoute = config => {
  validateMethodConfig('GET', config);

  const path = getRoutePath();

  return {
    GET: config,
    path,
  };
};

/**
 * Create a POST route
 */
export const createPostRoute: CreatePostRoute = config => {
  validateMethodConfig('POST', config);

  const path = getRoutePath();

  return {
    POST: config,
    path,
  };
};

/**
 * Create a PUT route
 */
export const createPutRoute: CreatePutRoute = config => {
  validateMethodConfig('PUT', config);

  const path = getRoutePath();

  return {
    PUT: config,
    path,
  };
};

/**
 * Create a DELETE route
 */
export const createDeleteRoute: CreateDeleteRoute = config => {
  validateMethodConfig('DELETE', config);

  const path = getRoutePath();

  return {
    DELETE: config,
    path,
  };
};

/**
 * Create a PATCH route
 */
export const createPatchRoute: CreatePatchRoute = config => {
  validateMethodConfig('PATCH', config);

  const path = getRoutePath();

  return {
    PATCH: config,
    path,
  };
};

/**
 * Create a HEAD route (same signature as GET - no body)
 */
export const createHeadRoute: CreateHeadRoute = config => {
  validateMethodConfig('HEAD', config);

  const path = getRoutePath();

  return {
    HEAD: config,
    path,
  };
};

/**
 * Create an OPTIONS route (same signature as GET - no body)
 */
export const createOptionsRoute: CreateOptionsRoute = config => {
  validateMethodConfig('OPTIONS', config);

  const path = getRoutePath();

  return {
    OPTIONS: config,
    path,
  };
};

/**
 * Validate a method configuration
 */
function validateMethodConfig(method: string, config: any): void {
  if (!config.handler || typeof config.handler !== 'function') {
    throw new Error(`Handler for method ${method} must be a function`);
  }

  if (config.middleware && !Array.isArray(config.middleware)) {
    throw new Error(`Middleware for method ${method} must be an array`);
  }

  // Validate schema if provided
  if (config.schema) {
    validateSchema(method, config.schema);
  }

  // Method-specific warnings
  switch (method) {
    case 'GET':
    case 'HEAD':
    case 'DELETE':
      if (config.schema?.body) {
        console.warn(`Warning: ${method} requests typically don't have request bodies`);
      }
      break;
  }
}

/**
 * Validate schema structure
 */
function validateSchema(method: string, schema: any): void {
  const { params, query, body, response } = schema;

  // Basic validation - ensure they look like Zod schemas
  if (params && (!params._def || typeof params.parse !== 'function')) {
    throw new Error(`Params schema for ${method} must be a valid Zod schema`);
  }

  if (query && (!query._def || typeof query.parse !== 'function')) {
    throw new Error(`Query schema for ${method} must be a valid Zod schema`);
  }

  if (body && (!body._def || typeof body.parse !== 'function')) {
    throw new Error(`Body schema for ${method} must be a valid Zod schema`);
  }

  if (response && (!response._def || typeof response.parse !== 'function')) {
    throw new Error(`Response schema for ${method} must be a valid Zod schema`);
  }
}
