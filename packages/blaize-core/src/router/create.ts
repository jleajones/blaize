import { RouteDefinition, Route, CreateRoute } from '@blaizejs/types';

/**
 * Create a new route definition with type checking
 */
export const create: CreateRoute = (definition, options = {}) => {
  // Validate the route definition
  validateRouteDefinition(definition as RouteDefinition);

  // Create the route object with the provided path or default
  return {
    ...definition,
    path: options.basePath || '/',
  } as Route;
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
