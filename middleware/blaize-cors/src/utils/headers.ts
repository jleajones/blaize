import type { Context } from 'blaizejs';

/**
 * Normalize headers to array format
 */
export const normalizeHeaders = (headers: string[] | string | undefined): string[] => {
  if (!headers) return [];
  if (typeof headers === 'string') {
    return headers.split(',').map(h => h.trim());
  }
  return headers;
};

/**
 * Set CORS headers efficiently
 */
export const setCorsHeaders = (
  ctx: Context,
  {
    origin,
    credentials,
    exposedHeaders,
    methods,
    allowedHeaders,
    maxAge,
  }: {
    origin: string | false;
    credentials: boolean;
    exposedHeaders: string[];
    methods: string[];
    allowedHeaders: string[];
    maxAge: number;
  }
): void => {
  const { response } = ctx;

  // Set origin
  if (origin !== false) {
    response.header('Access-Control-Allow-Origin', origin);
  }

  // Set credentials
  if (credentials) {
    response.header('Access-Control-Allow-Credentials', 'true');
  }

  // Set exposed headers
  if (exposedHeaders.length > 0) {
    response.header('Access-Control-Expose-Headers', exposedHeaders.join(', '));
  }

  // Set methods for preflight
  if (ctx.request.method === 'OPTIONS') {
    response.header('Access-Control-Allow-Methods', methods.join(', '));

    if (allowedHeaders.length > 0) {
      response.header('Access-Control-Allow-Headers', allowedHeaders.join(', '));
    }

    response.header('Access-Control-Max-Age', maxAge.toString());
  }

  // TODO: Fix this when Blaize supports response.getHeaders
  // Set Vary header for proper caching
  const existingVary = false; // response.getHeaders('Vary') as string | undefined;
  const varyHeaders = ['Origin'];

  if (credentials) {
    varyHeaders.push('Access-Control-Request-Headers');
  }

  const newVary = existingVary
    ? `${existingVary}, ${varyHeaders.join(', ')}`
    : varyHeaders.join(', ');

  response.header('Vary', newVary);
};
