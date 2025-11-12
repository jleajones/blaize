/**
 * Main entry point for @blaizejs/middleware-security
 *
 * Provides the security() middleware function that applies security headers
 * including CSP, HSTS, and other protective HTTP headers. Uses BlaizeJS's
 * createMiddleware pattern for consistent middleware behavior.
 *
 * @module @blaizejs/middleware-security
 *
 * @example
 * ```typescript
 * import { createServer } from 'blaizejs';
 * import { security } from '@blaizejs/middleware-security';
 *
 * const server = createServer();
 *
 * // Zero-config usage (environment-aware defaults)
 * server.use(security());
 *
 * // Custom configuration
 * server.use(security({
 *   csp: {
 *     directives: {
 *       scriptSrc: ["'self'", "https://cdn.example.com"]
 *     }
 *   },
 *   hsts: {
 *     maxAge: 31536000,
 *     includeSubDomains: true
 *   }
 * }));
 * ```
 */

import { createMiddleware } from 'blaizejs';

import { mergeSecurityOptions } from './defaults';
import { applySecurityHeaders } from './headers';
import { validateSecurityOptions } from './validation';

import type { SecurityOptions } from './types';
import type { Context, Middleware, NextFunction } from 'blaizejs';

/**
 * Create security headers middleware for BlaizeJS.
 *
 * This middleware applies security headers including Content Security Policy (CSP),
 * HTTP Strict Transport Security (HSTS), and other protective HTTP headers. It uses
 * environment-aware defaults and can be fully customized.
 *
 * The middleware automatically:
 * - Skips /health and /healthz endpoints
 * - Skips if headers already sent
 * - Skips if disabled via enabled: false
 * - Uses development-friendly defaults in dev, strict defaults in production
 *
 * @param userOptions - Security configuration options (optional)
 * @returns BlaizeJS middleware
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/Security | MDN Web Security}
 *
 * @example
 * ```typescript
 * import { createServer } from 'blaizejs';
 * import { createSecurityMiddleware } from '@blaizejs/middleware-security';
 *
 * const server = createServer();
 *
 * // Zero-config usage (environment-aware defaults)
 * server.use(createSecurityMiddleware());
 * ```
 *
 * @example
 * ```typescript
 * // Custom CSP configuration
 * server.use(createSecurityMiddleware({
 *   csp: {
 *     directives: {
 *       defaultSrc: ["'self'"],
 *       scriptSrc: ["'self'", "https://cdn.example.com"],
 *       styleSrc: ["'self'", "'unsafe-inline'"]
 *     }
 *   }
 * }));
 * ```
 *
 * @example
 * ```typescript
 * // Disable specific headers
 * server.use(createSecurityMiddleware({
 *   csp: false,              // Disable CSP
 *   hsts: false,             // Disable HSTS
 *   frameOptions: 'SAMEORIGIN',
 *   noSniff: true
 * }));
 * ```
 *
 * @example
 * ```typescript
 * // Audit mode for testing configurations
 * server.use(createSecurityMiddleware({
 *   audit: true,  // Logs warnings without throwing errors
 *   csp: {
 *     directives: {
 *       scriptSrc: ["'self'", "'unsafe-inline'"]  // Will log warning
 *     }
 *   }
 * }));
 * ```
 *
 * @example
 * ```typescript
 * // Using with route-specific configuration
 * // Admin routes with strict CSP
 * server.use('/admin', createSecurityMiddleware({
 *   csp: {
 *     directives: {
 *       defaultSrc: ["'self'"],
 *       scriptSrc: ["'self'"]
 *     }
 *   },
 *   frameOptions: 'DENY'
 * }));
 *
 * // Public routes with more permissive CSP
 * server.use('/public', createSecurityMiddleware({
 *   csp: {
 *     directives: {
 *       defaultSrc: ["'self'"],
 *       scriptSrc: ["'self'", "https://cdn.example.com"]
 *     }
 *   }
 * }));
 * ```
 */
export function createSecurityMiddleware(userOptions?: Partial<SecurityOptions>): Middleware {
  // Merge user options with defaults (handled by applySecurityHeaders)
  const options = mergeSecurityOptions(userOptions);
  validateSecurityOptions(options);

  return createMiddleware({
    name: 'security',

    /**
     * Main middleware handler.
     *
     * Applies security headers to the response if:
     * - Middleware is enabled (enabled !== false)
     * - Headers not already sent
     * - Not a skipped path (/health, /healthz)
     */
    handler: async (ctx: Context, next: NextFunction) => {
      // Skip if middleware is disabled
      if (options.enabled === false) {
        await next();
        return;
      }

      // Skip if headers already sent (can't modify headers)
      if (ctx.response.sent) {
        await next();
        return;
      }

      // Apply all configured security headers
      applySecurityHeaders(ctx, options);

      // Continue to next middleware
      await next();
    },

    /**
     * Skip middleware for health check endpoints.
     *
     * Health checks shouldn't have security headers that might
     * interfere with monitoring systems or health check tools.
     */
    skip: (ctx: Context) => {
      return ctx.request.path === '/health' || ctx.request.path === '/healthz';
    },
  });
}

// Re-export all types from types.ts
export type {
  SecurityOptions,
  CSPOptions,
  CSPDirectives,
  HSTSOptions,
  ReferrerPolicyOption,
  SecurityPreset,
} from './types.js';

// Re-export presets from presets.ts
// Note: This export is for convenience but users can also import from './presets' directly
export { securityPresets } from './presets';
