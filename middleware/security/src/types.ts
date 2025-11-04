/**
 * Type definitions for @blaizejs/middleware-security
 *
 * This module defines all TypeScript interfaces and types for the security
 * middleware package, forming the public API contract.
 *
 * @module @blaizejs/middleware-security/types
 */

/**
 * Content Security Policy directive configuration.
 *
 * Supports 8 essential directives covering 95% of common security needs.
 * Additional directives can be passed via the index signature and will be
 * automatically converted from camelCase to kebab-case.
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP | MDN CSP Documentation}
 * @see {@link https://www.w3.org/TR/CSP3/ | W3C CSP Level 3 Specification}
 *
 * @example
 * ```typescript
 * const directives: CSPDirectives = {
 *   defaultSrc: ["'self'"],
 *   scriptSrc: ["'self'", "https://cdn.example.com"],
 *   styleSrc: ["'self'", "'unsafe-inline'"],
 *   imgSrc: ["'self'", "data:", "https:"],
 *   fontSrc: ["'self'", "https://fonts.gstatic.com"],
 *   connectSrc: ["'self'", "https://api.example.com"],
 *   objectSrc: ["'none'"],
 *   frameSrc: ["'none'"]
 * };
 * ```
 */
export interface CSPDirectives {
  /**
   * Fallback directive for all fetch directives.
   * Defines the default policy for loading resources.
   *
   * @default ["'self'"] in production
   * @default ["'self'", "'unsafe-inline'", "'unsafe-eval'"] in development
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/default-src | MDN default-src}
   */
  defaultSrc?: string[];

  /**
   * Valid sources for JavaScript.
   * Critical for preventing XSS attacks.
   *
   * @default ["'self'"] in production
   * @default ["'self'", "'unsafe-inline'", "'unsafe-eval'"] in development
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/script-src | MDN script-src}
   *
   * @example
   * ```typescript
   * // Strict production config
   * scriptSrc: ["'self'", "https://cdn.example.com"]
   *
   * // Development with inline scripts
   * scriptSrc: ["'self'", "'unsafe-inline'"]
   *
   * // Using nonces (recommended)
   * scriptSrc: ["'self'", "'nonce-abc123'"]
   * ```
   */
  scriptSrc?: string[];

  /**
   * Valid sources for stylesheets.
   * Controls CSS loading to prevent style-based attacks.
   *
   * @default ["'self'"] in production
   * @default ["'self'", "'unsafe-inline'"] in development
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/style-src | MDN style-src}
   */
  styleSrc?: string[];

  /**
   * Valid sources for images.
   * Includes img elements, favicons, and background images.
   *
   * @default ["'self'", "data:", "https:"] in production
   * @default ["'self'", "data:", "https:", "http:"] in development
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/img-src | MDN img-src}
   *
   * @example
   * ```typescript
   * // Allow images from self and CDN
   * imgSrc: ["'self'", "https://cdn.example.com"]
   *
   * // Allow data URIs (common for inlined images)
   * imgSrc: ["'self'", "data:"]
   * ```
   */
  imgSrc?: string[];

  /**
   * Valid sources for web fonts.
   * Controls @font-face sources.
   *
   * @default ["'self'"] in production
   * @default ["'self'", "data:"] in development
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/font-src | MDN font-src}
   *
   * @example
   * ```typescript
   * // Google Fonts
   * fontSrc: ["'self'", "https://fonts.gstatic.com"]
   * ```
   */
  fontSrc?: string[];

  /**
   * Valid sources for fetch, XMLHttpRequest, WebSocket, and EventSource.
   * Critical for API security.
   *
   * @default ["'self'"] in production
   * @default ["'self'"] in development
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/connect-src | MDN connect-src}
   *
   * @example
   * ```typescript
   * // Allow API calls to backend
   * connectSrc: ["'self'", "https://api.example.com", "wss://ws.example.com"]
   * ```
   */
  connectSrc?: string[];

  /**
   * Valid sources for plugins (Flash, Java, etc.).
   * Usually set to 'none' as plugins are deprecated.
   *
   * @default ["'none'"] in all environments
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/object-src | MDN object-src}
   *
   * @example
   * ```typescript
   * // Recommended: block all plugins
   * objectSrc: ["'none'"]
   * ```
   */
  objectSrc?: string[];

  /**
   * Valid sources for nested browsing contexts (iframes).
   * Controls where the app can be embedded.
   *
   * @default ["'self'"] in production
   * @default ["'self'"] in development
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/frame-src | MDN frame-src}
   *
   * @example
   * ```typescript
   * // Block all iframes
   * frameSrc: ["'none'"]
   *
   * // Allow YouTube embeds
   * frameSrc: ["'self'", "https://www.youtube.com"]
   * ```
   */
  frameSrc?: string[];

  /**
   * Extensible index signature for additional CSP directives.
   *
   * Allows passing any CSP directive not explicitly defined above.
   * Keys are automatically converted from camelCase to kebab-case.
   *
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy | All CSP Directives}
   *
   * @example
   * ```typescript
   * {
   *   // Worker sources (camelCase → kebab-case)
   *   workerSrc: ["'self'"],  // → worker-src 'self'
   *
   *   // Upgrade insecure requests (boolean directive)
   *   upgradeInsecureRequests: true,  // → upgrade-insecure-requests
   *
   *   // Media sources
   *   mediaSrc: ["'self'", "https://media.example.com"],
   *
   *   // Form action restrictions
   *   formAction: ["'self'"],
   *
   *   // Frame ancestors (who can embed this page)
   *   frameAncestors: ["'none'"],
   *
   *   // Base URI restrictions
   *   baseUri: ["'self'"],
   *
   *   // Manifest sources
   *   manifestSrc: ["'self'"]
   * }
   * ```
   */
  [key: string]: string[] | boolean | string | undefined;
}

/**
 * Content Security Policy configuration options.
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP | MDN CSP Overview}
 *
 * @example
 * ```typescript
 * const cspOptions: CSPOptions = {
 *   directives: {
 *     defaultSrc: ["'self'"],
 *     scriptSrc: ["'self'", "https://cdn.example.com"]
 *   },
 *   reportOnly: false,
 *   reportUri: "https://csp-reports.example.com/report"
 * };
 * ```
 */
export interface CSPOptions {
  /**
   * CSP directive configuration object.
   * Defines what resources can be loaded and from where.
   */
  directives: CSPDirectives;

  /**
   * Use Content-Security-Policy-Report-Only header instead.
   *
   * When true, violations are reported but not enforced.
   * Useful for testing CSP policies before enforcing them.
   *
   * @default false
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy-Report-Only | MDN Report-Only Mode}
   *
   * @example
   * ```typescript
   * // Test CSP without breaking functionality
   * { reportOnly: true, reportUri: "https://csp-reports.example.com" }
   * ```
   */
  reportOnly?: boolean;

  /**
   * Legacy CSP violation reporting endpoint.
   *
   * ⚠️ Deprecated: Use the Reporting API (report-to) instead.
   * This directive is kept for backward compatibility.
   *
   * @deprecated Use Reporting API with report-to directive instead
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/report-uri | MDN report-uri}
   *
   * @example
   * ```typescript
   * reportUri: "https://csp-reports.example.com/report"
   * ```
   */
  reportUri?: string;
}

/**
 * HTTP Strict Transport Security (HSTS) configuration.
 *
 * Forces browsers to use HTTPS for all future connections.
 * Automatically disabled in development environments.
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security | MDN HSTS}
 * @see {@link https://hstspreload.org/ | HSTS Preload List}
 *
 * @example
 * ```typescript
 * // Recommended production config
 * const hstsOptions: HSTSOptions = {
 *   maxAge: 31536000,        // 1 year in seconds
 *   includeSubDomains: true,
 *   preload: false           // Set to true only after submitting to preload list
 * };
 * ```
 */
export interface HSTSOptions {
  /**
   * Maximum age in seconds that the browser should remember to only use HTTPS.
   *
   * Common values:
   * - 31536000 (1 year) - Recommended for production
   * - 63072000 (2 years) - Required for HSTS preload
   * - 300 (5 minutes) - For testing
   *
   * @default 31536000 (1 year)
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security#max-age | MDN max-age}
   *
   * @example
   * ```typescript
   * maxAge: 31536000  // 1 year
   * maxAge: 63072000  // 2 years (preload requirement)
   * ```
   */
  maxAge: number;

  /**
   * Apply HSTS policy to all subdomains.
   *
   * ⚠️ Only enable if ALL subdomains support HTTPS.
   *
   * @default true in production
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security#includesubdomains | MDN includeSubDomains}
   *
   * @example
   * ```typescript
   * includeSubDomains: true  // example.com, www.example.com, api.example.com
   * ```
   */
  includeSubDomains?: boolean;

  /**
   * Signal intent to submit domain to browser HSTS preload list.
   *
   * ⚠️ IMPORTANT: Enabling this does NOT automatically add your domain.
   * You must manually submit your domain at https://hstspreload.org/
   *
   * Requirements for preload:
   * - maxAge must be at least 31536000 (1 year)
   * - includeSubDomains must be true
   * - All subdomains must support HTTPS
   * - Domain must be submitted at hstspreload.org
   *
   * @default false
   * @see {@link https://hstspreload.org/ | HSTS Preload List Submission}
   *
   * @example
   * ```typescript
   * // After submitting to preload list
   * {
   *   maxAge: 63072000,
   *   includeSubDomains: true,
   *   preload: true
   * }
   * ```
   */
  preload?: boolean;
}

/**
 * Referrer-Policy header values.
 *
 * Controls how much referrer information is sent with requests.
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referrer-Policy | MDN Referrer-Policy}
 *
 * @example
 * ```typescript
 * // Recommended for most sites
 * const policy: ReferrerPolicyOption = 'strict-origin-when-cross-origin';
 *
 * // For maximum privacy
 * const policy: ReferrerPolicyOption = 'no-referrer';
 *
 * // For analytics-heavy sites
 * const policy: ReferrerPolicyOption = 'origin-when-cross-origin';
 * ```
 */
export type ReferrerPolicyOption =
  /**
   * Never send referrer information.
   * Most private but may break some integrations.
   */
  | 'no-referrer'
  /**
   * Send full URL for same-origin, nothing for cross-origin.
   * Browser default for older browsers.
   */
  | 'no-referrer-when-downgrade'
  /**
   * Only send origin (no path) in all cases.
   */
  | 'origin'
  /**
   * Send full URL for same-origin, only origin for cross-origin.
   * Good balance of privacy and functionality.
   */
  | 'origin-when-cross-origin'
  /**
   * Send full URL only for same-origin requests.
   */
  | 'same-origin'
  /**
   * Send origin only when protocol security level stays same (HTTPS→HTTPS).
   * Recommended for most sites.
   */
  | 'strict-origin'
  /**
   * Send full URL for same-origin, origin for cross-origin (HTTPS→HTTPS only).
   * Current browser default and recommended.
   */
  | 'strict-origin-when-cross-origin'
  /**
   * Always send full URL (least secure).
   * ⚠️ Not recommended - exposes full URL even over HTTP.
   */
  | 'unsafe-url';

/**
 * Complete security middleware configuration.
 *
 * Provides comprehensive security headers with environment-aware defaults.
 * Set individual options to false to disable specific security features.
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers | MDN HTTP Headers}
 *
 * @example
 * ```typescript
 * // Zero-config (uses environment-aware defaults)
 * const options: SecurityOptions = {};
 *
 * // Custom CSP with other defaults
 * const options: SecurityOptions = {
 *   csp: {
 *     directives: {
 *       defaultSrc: ["'self'"],
 *       scriptSrc: ["'self'", "https://cdn.example.com"]
 *     }
 *   }
 * };
 *
 * // Disable CSP but keep other headers
 * const options: SecurityOptions = {
 *   csp: false,
 *   hsts: { maxAge: 31536000 }
 * };
 *
 * // Audit mode for testing
 * const options: SecurityOptions = {
 *   audit: true  // Log warnings without throwing errors
 * };
 * ```
 */
export interface SecurityOptions {
  /**
   * Enable or disable security middleware entirely.
   *
   * When false, all security headers are skipped.
   *
   * @default true
   *
   * @example
   * ```typescript
   * // Disable for specific routes
   * if (ctx.request.path === '/webhooks') {
   *   return next(); // Skip security middleware
   * }
   * ```
   */
  enabled?: boolean;

  /**
   * Content Security Policy configuration.
   *
   * Set to false to disable CSP headers entirely.
   * Omit to use environment-aware defaults.
   *
   * @default environment-aware directives
   * @see {@link CSPOptions}
   *
   * @example
   * ```typescript
   * // Use defaults
   * csp: undefined
   *
   * // Custom CSP
   * csp: {
   *   directives: {
   *     defaultSrc: ["'self'"],
   *     scriptSrc: ["'self'", "https://cdn.example.com"]
   *   }
   * }
   *
   * // Disable CSP
   * csp: false
   * ```
   */
  csp?: CSPOptions | false;

  /**
   * HTTP Strict Transport Security configuration.
   *
   * Set to false to disable HSTS.
   * Automatically disabled in development environments.
   *
   * @default { maxAge: 31536000, includeSubDomains: true } in production
   * @default false in development
   * @see {@link HSTSOptions}
   *
   * @example
   * ```typescript
   * // Use defaults
   * hsts: undefined
   *
   * // Custom HSTS
   * hsts: {
   *   maxAge: 63072000,        // 2 years
   *   includeSubDomains: true,
   *   preload: true
   * }
   *
   * // Disable HSTS
   * hsts: false
   * ```
   */
  hsts?: HSTSOptions | false;

  /**
   * X-Frame-Options header value.
   *
   * Controls whether the site can be embedded in iframes.
   * Modern alternative: frame-ancestors CSP directive.
   *
   * Set to false to disable.
   *
   * @default 'DENY' in production
   * @default 'SAMEORIGIN' in development
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Frame-Options | MDN X-Frame-Options}
   *
   * @example
   * ```typescript
   * frameOptions: 'DENY'         // Never allow embedding
   * frameOptions: 'SAMEORIGIN'   // Allow same-origin embedding
   * frameOptions: false          // No restrictions (use CSP instead)
   * ```
   */
  frameOptions?: 'DENY' | 'SAMEORIGIN' | false;

  /**
   * Enable X-XSS-Protection header.
   *
   * Legacy XSS filter (mostly obsolete, CSP is preferred).
   * Sets X-XSS-Protection: 1; mode=block
   *
   * ℹ️ Modern browsers ignore this in favor of CSP.
   *
   * @default true
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-XSS-Protection | MDN X-XSS-Protection}
   *
   * @example
   * ```typescript
   * xssFilter: true   // Enable legacy XSS filter
   * xssFilter: false  // Disable (CSP provides better protection)
   * ```
   */
  xssFilter?: boolean;

  /**
   * Enable X-Content-Type-Options: nosniff header.
   *
   * Prevents browsers from MIME-sniffing responses.
   * Critical for security, should always be enabled.
   *
   * @default true
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Content-Type-Options | MDN X-Content-Type-Options}
   *
   * @example
   * ```typescript
   * noSniff: true   // Recommended - prevent MIME sniffing
   * noSniff: false  // Not recommended - allows MIME sniffing
   * ```
   */
  noSniff?: boolean;

  /**
   * Referrer-Policy header value.
   *
   * Controls how much referrer information is sent with requests.
   * Set to false to disable.
   *
   * @default 'strict-origin-when-cross-origin' in production
   * @default 'no-referrer-when-downgrade' in development
   * @see {@link ReferrerPolicyOption}
   *
   * @example
   * ```typescript
   * referrerPolicy: 'strict-origin-when-cross-origin'  // Recommended
   * referrerPolicy: 'no-referrer'                       // Maximum privacy
   * referrerPolicy: false                               // No policy
   * ```
   */
  referrerPolicy?: ReferrerPolicyOption | false;

  /** TODO: Enable this when we add ability to remove context */
  /**
   * Remove X-Powered-By header.
   *
   * Hides framework/technology information from responses.
   * Reduces information disclosure to potential attackers.
   *
   * @default true
   *
   * @example
   * ```typescript
   * hidePoweredBy: true   // Remove X-Powered-By header
   * hidePoweredBy: false  // Keep X-Powered-By header
   * ```
   */
  // hidePoweredBy?: boolean;

  /**
   * Enable audit mode.
   *
   * When enabled:
   * - Logs warnings about insecure configurations
   * - Does NOT throw errors for invalid configs
   * - Useful for testing security settings
   * - Helps identify CSP violations before enforcement
   *
   * ⚠️ Should be disabled in production after testing.
   *
   * @default false
   *
   * @example
   * ```typescript
   * // Enable for testing
   * {
   *   audit: true,
   *   csp: {
   *     directives: {
   *       scriptSrc: ["'unsafe-inline'"]  // Will log warning
   *     }
   *   }
   * }
   *
   * // Audit mode will log:
   * // [Security Audit] Warning: unsafe-inline in scriptSrc (production)
   * ```
   */
  audit?: boolean;
}

/**
 * Security configuration preset names.
 *
 * Pre-defined security configurations for common use cases.
 * Can be used as a starting point and customized as needed.
 *
 * @see {@link getSecurityPreset}
 *
 * @example
 * ```typescript
 * import { security } from '@blaizejs/middleware-security';
 *
 * // Use preset
 * server.use(security('production'));
 *
 * // Customize preset
 * server.use(security({
 *   ...getSecurityPreset('spa'),
 *   csp: {
 *     directives: {
 *       ...getSecurityPreset('spa').csp.directives,
 *       scriptSrc: ["'self'", "https://cdn.example.com"]
 *     }
 *   }
 * }));
 * ```
 */
export type SecurityPreset =
  /**
   * Permissive defaults for local development.
   * - Allows unsafe-inline and unsafe-eval
   * - No HSTS
   * - SAMEORIGIN frame options
   */
  | 'development'
  /**
   * Strict security for production web applications.
   * - No unsafe directives
   * - HSTS enabled
   * - DENY frame options
   */
  | 'production'
  /**
   * Optimized for REST/GraphQL APIs.
   * - Minimal CSP (APIs don't serve HTML)
   * - No frame options
   * - No XSS filter
   * - HSTS enabled
   */
  | 'api'
  /**
   * Single-Page Application optimized.
   * - Allows common SPA patterns
   * - Supports bundler requirements
   * - HSTS enabled
   * - SAMEORIGIN frame options
   */
  | 'spa';
