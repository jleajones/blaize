import { z } from 'zod';

import { validateBody } from './body';
import { validateParams } from './params';
import { validateQuery } from './query';
import { validateResponse } from './response';
import { InternalServerError } from '../../errors/internal-server-error';
import { ValidationError } from '../../errors/validation-error';

import type { Context } from '@blaize-types/context';
import type { Middleware, MiddlewareFunction, NextFunction } from '@blaize-types/middleware';
import type { RouteSchema } from '@blaize-types/router';

/**
 * Create a validation middleware for request data
 */
export function createRequestValidator(schema: RouteSchema, debug: boolean = false): Middleware {
  const middlewareFn: MiddlewareFunction = async (ctx: Context, next: NextFunction) => {
    // Validate params if schema exists - throw immediately on failure
    if (schema.params && ctx.request.params) {
      try {
        ctx.request.params = validateParams(ctx.request.params, schema.params);
      } catch (error) {
        const fieldErrors = extractZodFieldErrors(error);
        const errorCount = fieldErrors.reduce((sum, fe) => sum + fe.messages.length, 0);

        throw new ValidationError('Request validation failed', {
          fields: fieldErrors,
          errorCount,
          section: 'params',
        });
      }
    }

    // Validate query if schema exists - throw immediately on failure
    if (schema.query && ctx.request.query) {
      try {
        ctx.request.query = validateQuery(ctx.request.query, schema.query);
      } catch (error) {
        const fieldErrors = extractZodFieldErrors(error);
        const errorCount = fieldErrors.reduce((sum, fe) => sum + fe.messages.length, 0);

        throw new ValidationError('Request validation failed', {
          fields: fieldErrors,
          errorCount,
          section: 'query',
        });
      }
    }

    // Validate body if schema exists - throw immediately on failure
    if (schema.body) {
      try {
        ctx.request.body = validateBody(ctx.request.body, schema.body);
      } catch (error) {
        const fieldErrors = extractZodFieldErrors(error);
        const errorCount = fieldErrors.reduce((sum, fe) => sum + fe.messages.length, 0);

        throw new ValidationError('Request validation failed', {
          fields: fieldErrors,
          errorCount,
          section: 'body',
        });
      }
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

        throw new InternalServerError('Response validation failed', {
          responseSchema: responseSchema.description || 'Unknown schema',
          validationError: extractZodFieldErrors(error),
          originalResponse: body,
        });
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
 * Extract structured field errors from Zod validation errors
 *
 * Converts Zod errors into a clean array of error messages per field.
 *
 * @param error - The validation error (typically a ZodError)
 * @returns Array of error messages for the field
 *
 * @example
 * ```typescript
 * const zodError = new z.ZodError([
 *   { path: ['email'], message: 'Invalid email' },
 *   { path: ['email'], message: 'Email is required' }
 * ]);
 *
 * const fieldErrors = extractZodFieldErrors(zodError);
 * // Returns: ['Invalid email', 'Email is required']
 * ```
 */
function extractZodFieldErrors(error: unknown): { field: string; messages: string[] }[] {
  if (error instanceof z.ZodError) {
    // Group errors by field path
    const fieldErrorMap = new Map<string, string[]>();

    for (const issue of error.issues) {
      // Get the field path (e.g., ['user', 'email'] becomes 'user.email')
      const fieldPath = issue.path.length > 0 ? issue.path.join('.') : 'root';

      if (!fieldErrorMap.has(fieldPath)) {
        fieldErrorMap.set(fieldPath, []);
      }
      fieldErrorMap.get(fieldPath)!.push(issue.message);
    }

    // Convert map to array of field errors
    return Array.from(fieldErrorMap.entries()).map(([field, messages]) => ({
      field,
      messages,
    }));
  }

  if (error instanceof Error) {
    return [{ field: 'unknown', messages: [error.message] }];
  }

  return [{ field: 'unknown', messages: [String(error)] }];
}

/**
 * 🔄 DEPRECATED: Keep for backward compatibility but mark as deprecated
 *
 * This function maintains the old API for any existing code that might depend on it.
 * New code should use extractZodFieldErrors for better structured error handling.
 *
 * @deprecated Use extractZodFieldErrors instead for better structured error details
 * @param error - The validation error to format
 * @returns Formatted error object (maintains old structure)
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
