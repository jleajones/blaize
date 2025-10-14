/**
 * CORS Preflight Request Handler
 *
 * Handles OPTIONS requests for CORS preflight checks according to W3C spec.
 * Validates requested methods and headers, sets appropriate response headers,
 * and returns 403 Forbidden on validation failures.
 */

import { validateOrigin } from './origin-validator';
import { ValidationError } from '../../errors/validation-error';

import type { Context } from '@blaize-types/context';
import type { CorsOptions } from '@blaize-types/cors';

/**
 * Extract Access-Control-Request-* headers from OPTIONS request
 */
interface PreflightRequest {
  origin: string | undefined;
  requestedMethod: string | undefined;
  requestedHeaders: string[] | undefined;
}

/**
 * Parse preflight request headers
 */
function parsePreflightRequest(ctx: Context): PreflightRequest {
  // Extract origin using the context's header method
  const origin = ctx.request.header('origin') || ctx.request.header('Origin');

  // Extract requested method (case-insensitive header name)
  const requestedMethod =
    ctx.request.header('access-control-request-method') ||
    ctx.request.header('Access-Control-Request-Method');

  // Extract requested headers (comma-delimited string)
  const requestedHeadersRaw =
    ctx.request.header('access-control-request-headers') ||
    ctx.request.header('Access-Control-Request-Headers');

  const requestedHeaders = requestedHeadersRaw
    ? requestedHeadersRaw.split(',').map(h => h.trim().toLowerCase())
    : undefined;

  return {
    origin,
    requestedMethod,
    requestedHeaders,
  };
}

/**
 * Normalize method names for comparison
 * HTTP methods are case-sensitive per spec
 */
function normalizeMethod(method: string): string {
  return method.toUpperCase();
}

/**
 * Check if a method is allowed
 */
function isMethodAllowed(
  requestedMethod: string,
  allowedMethods: string[] | string | undefined
): boolean {
  if (!allowedMethods) {
    // Default allowed methods per W3C spec
    const defaults = ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'];
    return defaults.includes(normalizeMethod(requestedMethod));
  }

  // Convert to array if string
  const methodsArray =
    typeof allowedMethods === 'string'
      ? allowedMethods.split(',').map(m => m.trim())
      : allowedMethods;

  return methodsArray.map(m => normalizeMethod(m)).includes(normalizeMethod(requestedMethod));
}

/**
 * Check if headers are allowed
 * Headers are case-insensitive per HTTP spec
 */
function areHeadersAllowed(
  requestedHeaders: string[] | undefined,
  allowedHeaders: string[] | string | undefined
): boolean {
  // If no headers requested, always allowed
  if (!requestedHeaders || requestedHeaders.length === 0) {
    return true;
  }

  // If allowedHeaders is undefined, mirror the requested headers (permissive)
  if (allowedHeaders === undefined) {
    return true;
  }

  // Convert to array if string
  const allowedArray =
    typeof allowedHeaders === 'string'
      ? allowedHeaders.split(',').map(h => h.trim().toLowerCase())
      : allowedHeaders.map(h => h.toLowerCase());

  // Check if all requested headers are in allowed list
  return requestedHeaders.every(header => allowedArray.includes(header.toLowerCase()));
}

/**
 * Set CORS response headers for preflight
 */
function setPreflightHeaders(
  ctx: Context,
  options: CorsOptions,
  origin: string,
  originAllowed: boolean
): void {
  // Set origin header based on validation result
  if (originAllowed) {
    if (options.origin === true && !options.credentials) {
      // Wildcard allowed when credentials not enabled
      ctx.response.header('Access-Control-Allow-Origin', '*');
    } else {
      // Reflect the specific origin
      ctx.response.header('Access-Control-Allow-Origin', origin);
      // Add Vary header when origin is dynamic
      ctx.response.header('Vary', 'Origin');
    }
  }

  // Set credentials header if enabled
  if (options.credentials && originAllowed) {
    ctx.response.header('Access-Control-Allow-Credentials', 'true');
  }

  // Set allowed methods
  const methods = options.methods || ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'];
  const methodsString = typeof methods === 'string' ? methods : methods.join(', ');
  ctx.response.header('Access-Control-Allow-Methods', methodsString);

  // Set allowed headers
  if (options.allowedHeaders) {
    const headers =
      typeof options.allowedHeaders === 'string'
        ? options.allowedHeaders
        : options.allowedHeaders.join(', ');
    ctx.response.header('Access-Control-Allow-Headers', headers);
  } else {
    // Mirror requested headers if not specified
    const requestedHeaders =
      ctx.request.header('access-control-request-headers') ||
      ctx.request.header('Access-Control-Request-Headers');
    if (requestedHeaders) {
      ctx.response.header('Access-Control-Allow-Headers', requestedHeaders);
    }
  }

  // Set max age if specified
  if (options.maxAge !== undefined && options.maxAge >= 0) {
    ctx.response.header('Access-Control-Max-Age', String(options.maxAge));
  }
}

/**
 * Handle CORS preflight request
 *
 * @param ctx - The request context
 * @param options - CORS configuration options
 * @returns Promise that resolves when preflight is handled
 * @throws ValidationError with 400 status on validation failure (403 behavior via response.status)
 */
export async function handlePreflight(ctx: Context, options: CorsOptions): Promise<void> {
  const preflight = parsePreflightRequest(ctx);

  // Preflight requires both origin and method headers
  if (!preflight.origin || !preflight.requestedMethod) {
    // Set 403 status directly
    ctx.response.status(403);

    throw new ValidationError('Invalid preflight request: missing required headers', {
      fields: [
        {
          field: preflight.origin ? 'Access-Control-Request-Method' : 'Origin',
          messages: ['Required header is missing'],
        },
      ],
      errorCount: 1,
      section: 'body', // Using valid section type
    });
  }

  // Validate origin
  const originAllowed = await validateOrigin(preflight.origin, options.origin || false, ctx);

  if (!originAllowed) {
    // Set 403 status directly
    ctx.response.status(403);

    throw new ValidationError('CORS origin not allowed', {
      fields: [
        {
          field: 'Origin',
          messages: [`Origin '${preflight.origin}' is not allowed`],
          rejectedValue: preflight.origin,
        },
      ],
      errorCount: 1,
      section: 'body',
    });
  }

  // Validate requested method
  if (!isMethodAllowed(preflight.requestedMethod, options.methods)) {
    // Set 403 status directly
    ctx.response.status(403);

    throw new ValidationError('CORS method not allowed', {
      fields: [
        {
          field: 'Access-Control-Request-Method',
          messages: [`Method '${preflight.requestedMethod}' is not allowed`],
          rejectedValue: preflight.requestedMethod,
          expectedType:
            typeof options.methods === 'string' ? options.methods : options.methods?.join(', '),
        },
      ],
      errorCount: 1,
      section: 'body',
    });
  }

  // Validate requested headers
  if (!areHeadersAllowed(preflight.requestedHeaders, options.allowedHeaders)) {
    const rejectedHeaders = preflight.requestedHeaders?.filter(h => {
      const allowed = options.allowedHeaders;
      if (!allowed) return false;
      const allowedArray =
        typeof allowed === 'string'
          ? allowed.split(',').map(h => h.trim().toLowerCase())
          : allowed.map(h => h.toLowerCase());
      return !allowedArray.includes(h.toLowerCase());
    });

    // Set 403 status directly
    ctx.response.status(403);

    throw new ValidationError('CORS headers not allowed', {
      fields: [
        {
          field: 'Access-Control-Request-Headers',
          messages: [`Headers not allowed: ${rejectedHeaders?.join(', ')}`],
          rejectedValue: rejectedHeaders,
        },
      ],
      errorCount: 1,
      section: 'body',
    });
  }

  // All validations passed - set response headers
  setPreflightHeaders(ctx, options, preflight.origin, originAllowed);

  // Set response status
  const successStatus = options.optionsSuccessStatus || 204;
  ctx.response.status(successStatus);

  // If preflightContinue is false (default), end the response here
  if (!options.preflightContinue) {
    // Send empty response body
    ctx.response.text('');
  }
}

/**
 * Check if a request is a preflight request
 *
 * @param ctx - The request context
 * @returns True if this is a CORS preflight request
 */
export function isPreflightRequest(ctx: Context): boolean {
  return (
    ctx.request.method === 'OPTIONS' &&
    !!(
      ctx.request.header('access-control-request-method') ||
      ctx.request.header('Access-Control-Request-Method')
    )
  );
}

/**
 * Create a standalone preflight handler for router mounting
 *
 * @param options - CORS configuration options
 * @returns Async handler function for preflight requests
 */
export function createPreflightHandler(options: CorsOptions) {
  return async (ctx: Context) => {
    await handlePreflight(ctx, options);
  };
}
