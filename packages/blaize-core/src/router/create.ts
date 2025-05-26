import {
  CreateGetRoute,
  CreatePostRoute,
  CreatePutRoute,
  CreateDeleteRoute,
  CreatePatchRoute,
  CreateHeadRoute,
  CreateOptionsRoute,
} from '@blaizejs/types';

/**
 * Create a GET route
 */
export const createGetRoute: CreateGetRoute = config => {
  validateMethodConfig('GET', config);

  return {
    GET: config,
  };
};

/**
 * Create a POST route
 */
export const createPostRoute: CreatePostRoute = config => {
  validateMethodConfig('POST', config);

  return {
    POST: config,
  };
};

/**
 * Create a PUT route
 */
export const createPutRoute: CreatePutRoute = config => {
  validateMethodConfig('PUT', config);

  return {
    PUT: config,
  };
};

/**
 * Create a DELETE route
 */
export const createDeleteRoute: CreateDeleteRoute = config => {
  validateMethodConfig('DELETE', config);

  return {
    DELETE: config,
  };
};

/**
 * Create a PATCH route
 */
export const createPatchRoute: CreatePatchRoute = config => {
  validateMethodConfig('PATCH', config);

  return {
    PATCH: config,
  };
};

/**
 * Create a HEAD route (same signature as GET - no body)
 */
export const createHeadRoute: CreateHeadRoute = config => {
  validateMethodConfig('HEAD', config);

  return {
    HEAD: config,
  };
};

/**
 * Create an OPTIONS route (same signature as GET - no body)
 */
export const createOptionsRoute: CreateOptionsRoute = config => {
  validateMethodConfig('OPTIONS', config);

  return {
    OPTIONS: config,
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
