/**
 * Security configuration presets
 *
 * Pre-defined security configurations for common use cases.
 * These presets provide sensible defaults for different environments
 * and application types.
 *
 * @module @blaizejs/middleware-security/presets
 */
import { DEVELOPMENT_DEFAULTS, PRODUCTION_DEFAULTS } from './defaults.js';

import type { SecurityOptions, SecurityPreset } from './types.js';

/**
 * Preset security configurations for common scenarios.
 *
 * Each preset provides a complete SecurityOptions configuration optimized
 * for a specific use case.
 *
 * @example
 * ```typescript
 * import { security, securityPresets } from '@blaizejs/middleware-security';
 *
 * // Use preset directly
 * server.use(security(securityPresets.production));
 *
 * // Customize preset
 * server.use(security({
 *   ...securityPresets.spa,
 *   csp: {
 *     directives: {
 *       ...securityPresets.spa.csp!.directives,
 *       scriptSrc: ["'self'", "https://cdn.example.com"]
 *     }
 *   }
 * }));
 * ```
 */
export const securityPresets: Record<SecurityPreset, SecurityOptions> = {
  /**
   * Development preset: Permissive for local development with HMR support.
   *
   * Features:
   * - Allows unsafe-inline and unsafe-eval for HMR
   * - No HSTS (development typically uses HTTP)
   * - SAMEORIGIN frame options
   * - Permissive CSP for development tools
   */
  development: DEVELOPMENT_DEFAULTS,

  /**
   * Production preset: Strict security for production deployments.
   *
   * Features:
   * - No unsafe directives
   * - HSTS enabled with 1 year max-age
   * - DENY frame options
   * - Strict CSP policy
   * - All security headers enabled
   */
  production: PRODUCTION_DEFAULTS,

  /**
   * API preset: Optimized for REST/GraphQL APIs.
   *
   * Features:
   * - Minimal CSP (APIs don't serve HTML/CSS/scripts)
   * - No frame options (not relevant for APIs)
   * - No XSS filter (APIs don't render HTML)
   * - HSTS enabled
   * - Focus on data security headers
   */
  api: {
    ...PRODUCTION_DEFAULTS,
    csp: {
      directives: {
        defaultSrc: ["'none'"],
      },
    },
    frameOptions: false,
    xssFilter: false,
  },

  /**
   * SPA preset: Single-Page Application optimized.
   *
   * Features:
   * - Allows common SPA patterns
   * - Supports bundler requirements
   * - HSTS enabled
   * - SAMEORIGIN frame options (for embedding)
   * - Balanced security for modern SPAs
   */
  spa: {
    ...PRODUCTION_DEFAULTS,
    csp: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"], // Many SPAs need inline styles
        imgSrc: ["'self'", 'data:', 'https:'],
        fontSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameSrc: ["'self'"],
      },
    },
    frameOptions: 'SAMEORIGIN',
    xssFilter: true,
    noSniff: true,
    referrerPolicy: 'strict-origin-when-cross-origin',
    audit: false,
  },
};

/**
 * Get a security preset by name.
 *
 * @param preset - The preset name
 * @returns SecurityOptions configuration for the preset
 *
 * @example
 * ```typescript
 * import { security, getSecurityPreset } from '@blaizejs/middleware-security';
 *
 * // Get preset
 * const config = getSecurityPreset('production');
 *
 * // Customize and use
 * server.use(security({
 *   ...config,
 *   hsts: {
 *     ...config.hsts!,
 *     preload: true
 *   }
 * }));
 * ```
 */
export function getSecurityPreset(preset: SecurityPreset): SecurityOptions {
  return securityPresets[preset];
}
