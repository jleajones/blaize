/**
 * CORS Validation Schemas
 *
 * Zod schemas for validating CORS configuration options
 * following BlaizeJS validation patterns.
 */

import { z } from 'zod';

import type { Context } from '@blaize-types/context';
import type { CorsOptions, CorsOrigin, CorsHttpMethod } from '@blaize-types/cors';

/**
 * Validation for CORS HTTP methods
 * Includes all standard HTTP methods plus CONNECT and TRACE
 */
const corsHttpMethodSchema = z.enum([
  'GET',
  'POST',
  'PUT',
  'DELETE',
  'PATCH',
  'HEAD',
  'OPTIONS',
  'CONNECT',
  'TRACE',
]) as z.ZodType<CorsHttpMethod>;

/**
 * Validation for methods field - can be array or comma-delimited string
 */
const corsMethodsSchema = z
  .union([
    z.array(corsHttpMethodSchema),
    z.string().transform(val => {
      // Transform comma-delimited string to array
      return val.split(',').map(m => m.trim()) as CorsHttpMethod[];
    }),
  ])
  .optional();

/**
 * Validation for headers - can be array or comma-delimited string
 * Note: Headers are case-insensitive per HTTP spec. Node.js handles
 * normalization automatically (lowercase for HTTP/2, case-preserving for HTTP/1.1)
 */
const corsHeadersSchema = z
  .union([
    z.array(z.string()),
    z.string().transform(val => {
      // Transform comma-delimited string to array
      return val.split(',').map(h => h.trim());
    }),
  ])
  .optional();

/**
 * Custom validation for origin functions
 * Zod doesn't have built-in function validation with specific signatures
 */
const corsOriginFunctionSchema = z.custom<
  (origin: string, ctx?: Context<any, any>) => boolean | Promise<boolean>
>(
  data => {
    return typeof data === 'function' && data.length <= 2;
  },
  {
    message: 'Origin validator must be a function accepting (origin, ctx?) parameters',
  }
);

/**
 * Validation for single origin value
 * Can be string, RegExp, or validation function
 */
const singleOriginSchema = z.union([z.string(), z.instanceof(RegExp), corsOriginFunctionSchema]);

/**
 * Full origin validation schema
 * Supports boolean, single origin, or array of origins
 */
const corsOriginSchema: z.ZodType<boolean | CorsOrigin> = z.union([
  z.boolean(),
  singleOriginSchema,
  z.array(singleOriginSchema),
]);

/**
 * Main CORS options validation schema
 */
export const corsOptionsSchema = z
  .object({
    /**
     * Origin configuration
     * - true: allow all origins
     * - false: disable CORS
     * - string/RegExp/function: specific origin validation
     * - array: multiple origin validators
     */
    origin: corsOriginSchema.optional(),

    /**
     * Allowed HTTP methods
     * Default: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE']
     */
    methods: corsMethodsSchema,

    /**
     * Allowed request headers
     * Default: mirror Access-Control-Request-Headers
     */
    allowedHeaders: corsHeadersSchema,

    /**
     * Headers exposed to the client
     * Default: []
     */
    exposedHeaders: corsHeadersSchema,

    /**
     * Allow credentials (cookies, auth headers)
     * Default: false
     */
    credentials: z.boolean().optional(),

    /**
     * Preflight cache duration in seconds
     * -1 disables caching
     */
    maxAge: z.number().int().optional(),

    /**
     * Pass preflight to next handler
     * Default: false
     */
    preflightContinue: z.boolean().optional(),

    /**
     * Success status for OPTIONS requests
     * Default: 204
     */
    optionsSuccessStatus: z.number().int().min(200).max(299).optional(),
  })
  .strict() as z.ZodType<CorsOptions>;

/**
 * Schema for server options CORS field
 * Can be boolean or CorsOptions
 */
export const serverCorsSchema = z.union([z.boolean(), corsOptionsSchema]).optional();

/**
 * Validate CORS options with detailed error messages
 */
export function validateCorsOptions(options: unknown): CorsOptions {
  try {
    // Handle boolean shortcuts
    if (typeof options === 'boolean') {
      if (options === false) {
        // CORS disabled
        return { origin: false };
      }
      // true means allow all origins (dev mode)
      return { origin: true };
    }

    // Validate as CorsOptions
    return corsOptionsSchema.parse(options);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const formattedErrors = formatCorsValidationErrors(error);
      throw new Error(`Invalid CORS options:\n${formattedErrors}`);
    }
    throw new Error(`Invalid CORS options: ${String(error)}`);
  }
}

/**
 * Format Zod validation errors for CORS options
 */
function formatCorsValidationErrors(error: z.ZodError): string {
  const errors = error.errors.map(err => {
    const path = err.path.join('.');
    return `  - ${path || 'root'}: ${err.message}`;
  });
  return errors.join('\n');
}

/**
 * Type guards for origin types
 * Note: These guards work with the union type, not recursive arrays
 */
export function isOriginString(origin: unknown): origin is string {
  return typeof origin === 'string';
}

export function isOriginRegExp(origin: unknown): origin is RegExp {
  return origin instanceof RegExp;
}

export function isOriginFunction(
  origin: unknown
): origin is (origin: string, ctx?: Context<any, any>) => boolean | Promise<boolean> {
  return typeof origin === 'function';
}

export function isOriginArray(
  origin: unknown
): origin is Array<
  string | RegExp | ((origin: string, ctx?: Context<any, any>) => boolean | Promise<boolean>)
> {
  return Array.isArray(origin);
}

/**
 * Validate that wildcard (*) is not used with credentials
 * This is a security requirement per W3C CORS specification
 */
export function validateOriginSecurity(options: CorsOptions): void {
  if (options.credentials === true && options.origin !== undefined) {
    if (options.origin === true || options.origin === '*') {
      throw new Error(
        'CORS security violation: Cannot use wildcard origin (*) with credentials. ' +
          'When credentials are enabled, you must specify explicit origins.'
      );
    }

    // Check for wildcard in array
    if (isOriginArray(options.origin)) {
      const hasWildcard = options.origin.some(o => o === '*');
      if (hasWildcard) {
        throw new Error(
          'CORS security violation: Cannot include wildcard origin (*) in array when credentials are enabled.'
        );
      }
    }
  }
}

/**
 * Merge user options with defaults
 */
export function mergeCorsOptions(
  userOptions: CorsOptions | boolean | undefined,
  defaults: CorsOptions
): CorsOptions {
  // Handle boolean shortcuts
  if (userOptions === true) {
    return { ...defaults, origin: true };
  }
  if (userOptions === false) {
    return { origin: false };
  }
  if (!userOptions) {
    return defaults;
  }

  // Merge with defaults
  return {
    ...defaults,
    ...userOptions,
    // Special handling for methods and headers to avoid overwriting with undefined
    methods: userOptions.methods ?? defaults.methods,
    allowedHeaders: userOptions.allowedHeaders ?? defaults.allowedHeaders,
    exposedHeaders: userOptions.exposedHeaders ?? defaults.exposedHeaders,
  };
}
