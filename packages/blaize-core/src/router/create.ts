import {
  CreateGetRoute,
  CreatePostRoute,
  CreatePutRoute,
  CreateDeleteRoute,
  CreatePatchRoute,
  Route,
} from '@blaizejs/types';

/**
 * Create a GET route
 */
export const createGetRoute: CreateGetRoute = config => {
  validateMethodConfig('GET', config);

  const route: any = {
    GET: config,
  };

  return route as Route;
};

/**
 * Create a POST route
 */
export const createPostRoute: CreatePostRoute = config => {
  validateMethodConfig('POST', config);

  const route: any = {
    POST: config,
  };

  return route as Route;
};

/**
 * Create a PUT route
 */
export const createPutRoute: CreatePutRoute = config => {
  validateMethodConfig('PUT', config);

  const route: any = {
    PUT: config,
  };

  return route as Route;
};

/**
 * Create a DELETE route
 */
export const createDeleteRoute: CreateDeleteRoute = config => {
  validateMethodConfig('DELETE', config);

  const route: any = {
    DELETE: config,
  };

  return route as Route;
};

/**
 * Create a PATCH route
 */
export const createPatchRoute: CreatePatchRoute = config => {
  validateMethodConfig('PATCH', config);
  const route: any = {
    PATCH: config,
  };

  return route as Route;
};

/**
 * Create a HEAD route (same signature as GET - no body)
 */
export const createHeadRoute: CreateGetRoute = config => {
  validateMethodConfig('HEAD', config);

  const route: any = {
    HEAD: config,
  };

  return route as Route;
};

/**
 * Create an OPTIONS route (same signature as GET - no body)
 */
export const createOptionsRoute: CreateGetRoute = config => {
  validateMethodConfig('OPTIONS', config);

  const route: any = {
    OPTIONS: config,
  };

  return route as Route;
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
