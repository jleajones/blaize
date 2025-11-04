import { isProduction } from './env';

import type { SecurityOptions } from './types';

/**
 * Development environment defaults (NODE_ENV !== 'production').
 *
 * Permissive settings to support HMR (Hot Module Replacement), debugging,
 * and local development workflows common in modern web development.
 *
 * Key characteristics:
 * - HSTS disabled (development typically uses HTTP, not HTTPS)
 * - CSP allows 'unsafe-inline' and 'unsafe-eval' (HMR and dev tools need this)
 * - WebSocket support (ws:/wss:) for HMR and live reload
 * - Blob/data URLs allowed for development tooling
 * - Frame options set to SAMEORIGIN (not DENY) for iframe-based dev tools
 *
 * @see {@link PRODUCTION_DEFAULTS} for strict production settings
 */
export const DEVELOPMENT_DEFAULTS: SecurityOptions = {
  enabled: true,

  // No HSTS in development (usually no HTTPS)
  // Development environments typically run on http://localhost
  hsts: false,

  csp: {
    directives: {
      // Allow same-origin content as baseline
      defaultSrc: ["'self'"],

      // HMR (Hot Module Replacement) needs eval for dynamic module loading
      // Dev tools often inject inline scripts for debugging
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],

      // HMR needs inline styles for live CSS reload
      // Framework dev tools often inject inline styles
      styleSrc: ["'self'", "'unsafe-inline'"],

      // Allow data: and blob: URLs for development tooling
      // Dev tools may generate images dynamically
      imgSrc: ["'self'", 'data:', 'blob:'],

      // Allow same-origin fonts
      fontSrc: ["'self'"],

      // WebSocket support for HMR, SSE (Server-Sent Events), and live reload
      // Vite, Next.js, and other dev servers use ws:/wss: for hot reload
      connectSrc: ["'self'", 'ws:', 'wss:'],

      // Block plugins (Flash, Java, etc.) - usually unnecessary even in dev
      objectSrc: ["'none'"],

      // Allow same-origin iframes (some dev tools use iframes)
      frameSrc: ["'self'"],
    },
  },

  // SAMEORIGIN allows iframes from same origin (dev tools, documentation)
  frameOptions: 'SAMEORIGIN',

  // Enable XSS filter (legacy but harmless)
  xssFilter: true,

  // Prevent MIME type sniffing
  noSniff: true,

  // Permissive referrer policy for development
  // Sends referrer only when navigating from HTTPS to HTTPS
  referrerPolicy: 'no-referrer-when-downgrade',

  // Hide X-Powered-By header (security through obscurity)
  // hidePoweredBy: true,

  // Audit mode disabled by default (can be enabled via options)
  audit: false,
};

/**
 * Production environment defaults (NODE_ENV === 'production').
 *
 * Strict security settings designed for production deployments with no
 * compromises for development convenience.
 *
 * Key characteristics:
 * - HSTS enabled with 1 year max-age and includeSubDomains
 * - CSP strict: NO 'unsafe-inline' or 'unsafe-eval' anywhere
 * - No WebSocket protocols (must be explicitly added if needed)
 * - DENY for frame options (strictest - no iframes allowed)
 * - Strict referrer policy for cross-origin requests
 *
 * @see {@link DEVELOPMENT_DEFAULTS} for permissive development settings
 */
export const PRODUCTION_DEFAULTS: SecurityOptions = {
  enabled: true,

  // HSTS enforces HTTPS for 1 year across all subdomains
  // preload is false by default (requires manual submission to browser vendors)
  hsts: {
    maxAge: 31536000, // 1 year in seconds (365 * 24 * 60 * 60)
    includeSubDomains: true, // Apply to all subdomains
    preload: false, // Manual submission required for browser preload lists
  },

  csp: {
    directives: {
      // Strict baseline: only same-origin content
      defaultSrc: ["'self'"],

      // Scripts must be from same origin only - no inline scripts or eval
      // This prevents most XSS attacks
      scriptSrc: ["'self'"],

      // Styles must be from same origin only - no inline styles
      styleSrc: ["'self'"],

      // Images: allow same-origin, data URIs, and HTTPS images
      // data: for inline base64 images (common pattern)
      // https: for external CDN images (common for production)
      imgSrc: ["'self'", 'data:', 'https:'],

      // Fonts must be from same origin
      fontSrc: ["'self'"],

      // XHR/fetch/WebSocket must be to same origin only
      // No WebSocket protocols in production by default (add if needed)
      connectSrc: ["'self'"],

      // Block all plugins (Flash, Java, etc.)
      objectSrc: ["'none'"],

      // Block all iframes (strictest setting)
      // Change to ["'self'"] if your app legitimately uses iframes
      frameSrc: ["'none'"],
    },
  },

  // DENY prevents the page from being framed entirely (strictest)
  // Protects against clickjacking attacks
  frameOptions: 'DENY',

  // Enable XSS filter (legacy but provides defense-in-depth)
  xssFilter: true,

  // Prevent MIME type sniffing (security best practice)
  noSniff: true,

  // Strict referrer policy: only send origin on cross-origin HTTPS requests
  // Balances privacy with functionality (analytics, etc.)
  referrerPolicy: 'strict-origin-when-cross-origin',

  // Hide X-Powered-By header to avoid revealing server technology
  // hidePoweredBy: true,

  // Audit mode disabled by default (can be enabled for testing)
  audit: false,
};

/**
 * Get default security options based on current environment.
 *
 * Returns development defaults when NODE_ENV !== 'production',
 * and production defaults when NODE_ENV === 'production'.
 *
 * This function enables zero-config security with automatic
 * environment detection.
 *
 * @returns Development or production defaults depending on NODE_ENV
 *
 * @example
 * ```typescript
 * // Automatically get environment-appropriate defaults
 * const defaults = getDefaultSecurityOptions();
 *
 * // In development (NODE_ENV=development):
 * // Returns DEVELOPMENT_DEFAULTS (permissive, allows HMR)
 *
 * // In production (NODE_ENV=production):
 * // Returns PRODUCTION_DEFAULTS (strict security)
 * ```
 *
 * @see {@link DEVELOPMENT_DEFAULTS}
 * @see {@link PRODUCTION_DEFAULTS}
 * @see {@link isProduction}
 */
export function getDefaultSecurityOptions(): SecurityOptions {
  return isProduction() ? PRODUCTION_DEFAULTS : DEVELOPMENT_DEFAULTS;
}

/**
 * Deep merge user options with environment-aware defaults.
 *
 * Performs intelligent merging:
 * - **Shallow merge** for most top-level options (enabled, frameOptions, etc.)
 * - **Deep merge** for CSP directives (allows overriding individual directives)
 * - **Respects false values** (csp: false, hsts: false) without merging
 *
 * This allows users to:
 * 1. Override specific CSP directives while keeping others
 * 2. Completely disable CSP or HSTS by passing `false`
 * 3. Override any top-level option
 *
 * @param userOptions - Partial user configuration to merge with defaults
 * @returns Complete SecurityOptions with defaults applied
 *
 * @example
 * ```typescript
 * // Override only scriptSrc, keep other defaults
 * mergeSecurityOptions({
 *   csp: {
 *     directives: {
 *       scriptSrc: ["'self'", "https://cdn.example.com"]
 *     }
 *   }
 * });
 * // Result: All default directives + custom scriptSrc
 *
 * // Completely disable CSP
 * mergeSecurityOptions({
 *   csp: false
 * });
 * // Result: All defaults except CSP is false
 *
 * // Override multiple top-level options
 * mergeSecurityOptions({
 *   frameOptions: 'SAMEORIGIN',
 *   audit: true
 * });
 * // Result: Defaults with frameOptions and audit overridden
 * ```
 *
 * @see {@link getDefaultSecurityOptions}
 */
export function mergeSecurityOptions(userOptions?: Partial<SecurityOptions>): SecurityOptions {
  const defaults = getDefaultSecurityOptions();

  // If no user options provided, return environment defaults
  if (!userOptions) {
    return defaults;
  }

  // Filter out undefined values from userOptions
  // undefined means "not provided", should use default
  // false, null, or any other value means "explicitly set"
  const cleanUserOptions = Object.fromEntries(
    Object.entries(userOptions).filter(([_, value]) => value !== undefined)
  ) as Partial<SecurityOptions>;

  // If all values were undefined, return defaults
  if (Object.keys(cleanUserOptions).length === 0) {
    return defaults;
  }

  // Handle CSP deep merge special case
  // We need deep merge for CSP directives to allow users to override
  // individual directives (like scriptSrc) while keeping others
  if (cleanUserOptions.csp && defaults.csp) {
    return {
      // Shallow merge: top-level options (enabled, frameOptions, etc.)
      ...defaults,
      ...cleanUserOptions,

      // Deep merge: CSP configuration
      csp: {
        // Merge CSP top-level options (reportOnly, reportUri)
        // User values take precedence via nullish coalescing
        reportOnly: cleanUserOptions.csp.reportOnly ?? defaults.csp.reportOnly,
        reportUri: cleanUserOptions.csp.reportUri ?? defaults.csp.reportUri,

        // Deep merge: CSP directives
        // Spread defaults first, then user directives override
        directives: {
          ...defaults.csp.directives,
          ...cleanUserOptions.csp.directives,
        },
      },
    };
  }

  // Simple shallow merge for all other cases:
  // - User passes csp: false (disable CSP entirely)
  // - User passes no CSP config
  // - User overrides other top-level options
  return {
    ...defaults,
    ...cleanUserOptions,
  };
}
