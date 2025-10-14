/**
 * CORS Middleware for BlaizeJS
 *
 * W3C-compliant CORS implementation with origin validation, preflight handling,
 * and proper error responses. Must run early in middleware chain before SSE.
 */
import { ForbiddenError } from '../../errors/forbidden-error';
import { create as createMiddleware } from '../create';
import { getDefaultCorsOptions } from './defaults';
import { validateOrigin } from './origin-validator';
import { handlePreflight, isPreflightRequest } from './preflight';
import { validateCorsOptions, mergeCorsOptions, validateOriginSecurity } from './validation';

import type { Context } from '@blaize-types/context';
import type { CorsOptions } from '@blaize-types/cors';
import type { Middleware, NextFunction } from '@blaize-types/middleware';

/**
 * Set CORS headers for simple (non-preflight) requests
 */
function setCorsHeaders(
  ctx: Context,
  options: CorsOptions,
  origin: string | undefined,
  originAllowed: boolean
): void {
  // Only set headers if origin is allowed
  if (!originAllowed || !origin) {
    return;
  }

  // Set origin header
  if (options.origin === true && !options.credentials) {
    // Wildcard allowed when credentials not enabled
    ctx.response.header('Access-Control-Allow-Origin', '*');
  } else {
    // Reflect the specific origin
    ctx.response.header('Access-Control-Allow-Origin', origin);
    // Add Vary header when origin is dynamic
    ctx.response.header('Vary', 'Origin');
  }

  // Set credentials header if enabled
  if (options.credentials) {
    ctx.response.header('Access-Control-Allow-Credentials', 'true');
  }

  // Set exposed headers if specified
  if (options.exposedHeaders) {
    const headers =
      typeof options.exposedHeaders === 'string'
        ? options.exposedHeaders
        : options.exposedHeaders.join(', ');
    ctx.response.header('Access-Control-Expose-Headers', headers);
  }
}

/**
 * Create CORS middleware with the specified options
 *
 * @param userOptions - CORS configuration options or boolean
 * @returns Middleware function that handles CORS
 *
 * @example
 * ```typescript
 * import { cors } from '@blaize-core/middleware/cors';
 *
 * // Development mode - allow all origins
 * server.use(cors(true));
 *
 * // Production - specific origin
 * server.use(cors({
 *   origin: 'https://app.example.com',
 *   credentials: true,
 *   maxAge: 86400
 * }));
 *
 * // Multiple origins with regex
 * server.use(cors({
 *   origin: [
 *     'https://app.example.com',
 *     /^https:\/\/.*\.example\.com$/
 *   ]
 * }));
 *
 * // Dynamic origin validation
 * server.use(cors({
 *   origin: async (origin, ctx) => {
 *     return await checkOriginAllowed(origin, ctx.state.user);
 *   }
 * }));
 * ```
 */
export function cors(userOptions?: CorsOptions | boolean): Middleware {
  // Determine environment
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Get defaults based on environment
  const defaults = getDefaultCorsOptions(isDevelopment);

  // Merge and validate options
  const options = mergeCorsOptions(userOptions, defaults);
  const validatedOptions = validateCorsOptions(options);

  // Security validation
  validateOriginSecurity(validatedOptions);

  // Create the middleware using createMiddleware
  return createMiddleware({
    name: 'cors',
    handler: async (ctx: Context, next: NextFunction) => {
      // Extract origin from request
      const origin = ctx.request.header('origin') || ctx.request.header('Origin');

      // Check if this is a preflight request
      if (isPreflightRequest(ctx)) {
        // Handle preflight - this may throw ValidationError
        await handlePreflight(ctx, validatedOptions);

        // If preflightContinue is false, we're done
        if (!validatedOptions.preflightContinue) {
          return; // Don't call next()
        }
      } else {
        // Simple request - validate origin and set headers

        // Skip CORS for same-origin requests (no Origin header)
        if (!origin) {
          // No origin header means same-origin request or non-browser client
          // Continue without CORS headers
          await next();
          return;
        }

        // Validate the origin
        const originAllowed = await validateOrigin(origin, validatedOptions.origin || false, ctx);

        // If origin is not allowed, return 403 Forbidden
        if (!originAllowed) {
          // Set 403 status
          ctx.response.status(403);

          throw new ForbiddenError('CORS validation failed', {
            reason: 'origin_not_allowed',
            origin,
            allowedOrigins: validatedOptions.origin,
          });
        }

        // Origin is allowed - set CORS headers
        setCorsHeaders(ctx, validatedOptions, origin, originAllowed);
      }

      // Continue to next middleware
      await next();
    },
    debug: process.env.DEBUG?.includes('cors'),
  });
}

/**
 * Create a strict CORS middleware that denies all cross-origin requests
 * Useful for internal APIs that should never be accessed cross-origin
 */
export function corsStrict(): Middleware {
  return cors({ origin: false });
}

/**
 * Create a permissive CORS middleware for development
 * Allows all origins but logs warnings
 */
export function corsDevelopment(): Middleware {
  const baseMiddleware = cors({
    origin: true,
    credentials: false, // Don't allow credentials with wildcard
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
    maxAge: 3600,
  });

  // Create a wrapper middleware that adds the warning
  return createMiddleware({
    name: 'cors-development',
    handler: async (ctx: Context, next: NextFunction) => {
      console.warn('[CORS] Running in development mode - all origins allowed');
      // Execute the base CORS middleware
      await baseMiddleware.execute(ctx, next);
    },
    debug: baseMiddleware.debug,
  });
}

/**
 * Create CORS middleware for specific allowed origins
 * Convenience function for common production use case
 */
export function corsForOrigins(
  origins: string[],
  options?: Omit<CorsOptions, 'origin'>
): Middleware {
  return cors({
    ...options,
    origin: origins,
  });
}

// Re-export types and utilities for convenience
export { validateOrigin } from './origin-validator';
export { isPreflightRequest } from './preflight';
