/**
 * HTTP Strict Transport Security (HSTS) header builder
 *
 * Builds HSTS headers for production environments only.
 * HSTS forces browsers to use HTTPS for all future connections.
 *
 * @module @blaizejs/middleware-security/hsts
 */

import { isProduction } from './env.js';

import type { HSTSOptions } from './types.js';

/**
 * Build Strict-Transport-Security header string.
 *
 * HSTS is only applied in production environments. Returns null for:
 * - Development environments (NODE_ENV !== 'production')
 * - When explicitly disabled
 *
 * The header includes max-age (required) and optional includeSubDomains
 * and preload directives.
 *
 * @param options - HSTS configuration options
 * @returns HSTS header string or null if should not be applied
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security | MDN HSTS}
 * @see {@link https://hstspreload.org/ | HSTS Preload List}
 *
 * @example
 * ```typescript
 * // Production environment
 * buildHSTSHeader({ maxAge: 31536000, includeSubDomains: true });
 * // Returns: "max-age=31536000; includeSubDomains"
 * ```
 *
 * @example
 * ```typescript
 * // Development environment
 * buildHSTSHeader({ maxAge: 31536000 });
 * // Returns: null (HSTS disabled in development)
 * ```
 *
 * @example
 * ```typescript
 * // Minimum configuration (production only)
 * buildHSTSHeader({ maxAge: 31536000 });
 * // Returns: "max-age=31536000"
 * ```
 *
 * @example
 * ```typescript
 * // Full configuration for preload
 * buildHSTSHeader({
 *   maxAge: 63072000,        // 2 years
 *   includeSubDomains: true,
 *   preload: true
 * });
 * // Returns: "max-age=63072000; includeSubDomains; preload"
 * ```
 */
export function buildHSTSHeader(options: HSTSOptions): string | null {
  // Don't apply HSTS in development environments
  // HSTS can break local development and cause issues
  if (!isProduction()) {
    return null;
  }

  // Start with required max-age directive
  const parts: string[] = [`max-age=${options.maxAge}`];

  // Add includeSubDomains if enabled
  if (options.includeSubDomains) {
    parts.push('includeSubDomains');
  }

  // Add preload if enabled
  if (options.preload) {
    parts.push('preload');
  }

  // Join directives with semicolon and space
  return parts.join('; ');
}
