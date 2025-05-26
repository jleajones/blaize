import { z } from 'zod';

import {
  RouteSchema,
  Context,
  Middleware,
  MiddlewareFunction,
  NextFunction,
} from '@blaizejs/types';

import { validateBody } from './body';
import { validateParams } from './params';
import { validateQuery } from './query';
import { validateResponse } from './response';

/**
 * Create a validation middleware for request data
 */
export function createRequestValidator(schema: RouteSchema, debug: boolean = false): Middleware {
  const middlewareFn: MiddlewareFunction = async (ctx: Context, next: NextFunction) => {
    const errors: Record<string, unknown> = {};

    // Validate params if schema exists
    if (schema.params && ctx.request.params) {
      try {
        ctx.request.params = validateParams(ctx.request.params, schema.params);
      } catch (error) {
        errors.params = formatValidationError(error);
      }
    }

    // Validate query if schema exists
    if (schema.query && ctx.request.query) {
      try {
        ctx.request.query = validateQuery(ctx.request.query, schema.query);
      } catch (error) {
        errors.query = formatValidationError(error);
      }
    }

    // FIXED: Validate body if schema exists (regardless of body content)
    if (schema.body) {
      try {
        ctx.request.body = validateBody(ctx.request.body, schema.body);
      } catch (error) {
        errors.body = formatValidationError(error);
      }
    }

    // Handle validation errors
    if (Object.keys(errors).length > 0) {
      ctx.response.status(400).json({
        error: 'Validation Error',
        details: errors,
      });
      return;
    }

    // Continue if validation passed
    await next();
  };

  return {
    name: 'RequestValidator',
    execute: middlewareFn,
    debug,
  };
}

/**
 * Create a validation middleware for response data
 */
export function createResponseValidator<T>(
  responseSchema: z.ZodType<T, z.ZodTypeDef, unknown>,
  debug: boolean = false
): Middleware {
  const middlewareFn: MiddlewareFunction = async (ctx, next) => {
    // Store the original json method
    const originalJson = ctx.response.json;

    // Override the json method to validate the response
    ctx.response.json = (body: unknown, status?: number) => {
      try {
        // Validate the response body
        const validatedBody = validateResponse(body, responseSchema);

        // Restore the original json method
        ctx.response.json = originalJson;

        // Send the validated response
        return originalJson.call(ctx.response, validatedBody, status);
      } catch (error) {
        // Restore the original json method
        ctx.response.json = originalJson;

        // Log validation error but don't expose to client
        console.error('Response validation error:', error);

        // Send an error response
        ctx.response.status(500).json({
          error: 'Internal Server Error',
          message: 'Response validation failed',
        });

        return ctx.response;
      }
    };

    await next();
  };

  return {
    name: 'ResponseValidator',
    execute: middlewareFn,
    debug,
  };
}

/**
 * Format a validation error
 */
export function formatValidationError(error: unknown): unknown {
  // Handle Zod errors
  if (
    error &&
    typeof error === 'object' &&
    'format' in error &&
    typeof error.format === 'function'
  ) {
    return error.format();
  }

  // Handle other error types
  return error instanceof Error ? error.message : String(error);
}
