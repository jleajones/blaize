/**
 * Security headers helper
 *
 * Applies security headers to BlaizeJS response context.
 * Handles X-Frame-Options, X-Content-Type-Options, X-XSS-Protection,
 * Referrer-Policy, and X-Powered-By removal.
 *
 * @module @blaizejs/middleware-security/headers
 */

import { buildCSPHeader } from './csp.js';
import { buildHSTSHeader } from './hsts.js';

import type { SecurityOptions } from './types.js';
import type { Context } from 'blaizejs';

/**
 * Apply all configured security headers to the response.
 *
 * This function orchestrates the application of multiple security headers
 * to the BlaizeJS response context. It handles:
 * - Content Security Policy (CSP)
 * - HTTP Strict Transport Security (HSTS)
 * - X-Frame-Options
 * - X-Content-Type-Options
 * - X-XSS-Protection (legacy)
 * - Referrer-Policy
 * - X-Powered-By removal
 *
 * Headers are only set if their corresponding options are enabled.
 * Setting an option to `false` will skip that header entirely.
 *
 * @param ctx - BlaizeJS request/response context
 * @param options - Security configuration options
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers | MDN HTTP Headers}
 *
 * @example
 * ```typescript
 * import { applySecurityHeaders } from '@blaizejs/middleware-security';
 *
 * // In middleware
 * const securityOptions: SecurityOptions = {
 *   csp: {
 *     directives: { defaultSrc: ["'self'"] }
 *   },
 *   hsts: {
 *     maxAge: 31536000,
 *     includeSubDomains: true
 *   },
 *   frameOptions: 'DENY',
 *   noSniff: true,
 *   xssFilter: true,
 *   referrerPolicy: 'strict-origin-when-cross-origin',
 *   hidePoweredBy: true
 * };
 *
 * applySecurityHeaders(ctx, securityOptions);
 * // Sets all configured headers on ctx.response
 * ```
 *
 * @example
 * ```typescript
 * // Selective headers (disable some)
 * const options: SecurityOptions = {
 *   csp: false,                    // CSP disabled
 *   hsts: false,                   // HSTS disabled
 *   frameOptions: 'SAMEORIGIN',    // X-Frame-Options enabled
 *   noSniff: true,                 // X-Content-Type-Options enabled
 *   xssFilter: false,              // X-XSS-Protection disabled
 *   referrerPolicy: false,         // Referrer-Policy disabled
 *   hidePoweredBy: true            // Remove X-Powered-By
 * };
 *
 * applySecurityHeaders(ctx, options);
 * // Only sets: X-Frame-Options, X-Content-Type-Options, removes X-Powered-By
 * ```
 */
export function applySecurityHeaders(ctx: Context, options: SecurityOptions): void {
  // Content Security Policy
  if (options.csp) {
    const cspHeader = buildCSPHeader(options.csp);
    if (cspHeader) {
      const headerName = options.csp.reportOnly
        ? 'Content-Security-Policy-Report-Only'
        : 'Content-Security-Policy';
      ctx.response.header(headerName, cspHeader);
    }
  }

  // HTTP Strict Transport Security (production only)
  if (options.hsts) {
    const hstsHeader = buildHSTSHeader(options.hsts);
    if (hstsHeader) {
      ctx.response.header('Strict-Transport-Security', hstsHeader);
    }
  }

  // X-Frame-Options
  if (options.frameOptions) {
    ctx.response.header('X-Frame-Options', options.frameOptions);
  }

  // X-Content-Type-Options
  if (options.noSniff) {
    ctx.response.header('X-Content-Type-Options', 'nosniff');
  }

  // X-XSS-Protection (legacy, CSP is preferred)
  if (options.xssFilter) {
    ctx.response.header('X-XSS-Protection', '1; mode=block');
  }

  // Referrer-Policy
  if (options.referrerPolicy) {
    ctx.response.header('Referrer-Policy', options.referrerPolicy);
  }
}
