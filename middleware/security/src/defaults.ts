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

  // TODO: Add when supported
  // Hide X-Powered-By header (security through obscurity)
  // hidePoweredBy: true,

  // Audit mode disabled by default (can be enabled via options)
  audit: false,
};

/**
 * Production environment defaults (NODE_ENV === 'production').
 *
 * Strict security settings for production deployments with no compromises
 * for development convenience. Designed to protect against common web
 * vulnerabilities while allowing legitimate external resources.
 *
 * Key characteristics:
 * - HSTS enabled with 1 year max-age (enforces HTTPS)
 * - CSP strict: NO 'unsafe-inline' or 'unsafe-eval' (prevents XSS)
 * - No WebSocket protocols (use secure connections only)
 * - Frame options set to DENY (prevents clickjacking)
 * - Strict referrer policy (minimal information leakage)
 *
 * Security trade-offs:
 * - Allows https: for images (CDN support for performance)
 * - Allows data: for images (common for inline SVGs, base64 images)
 * - HSTS preload set to false (requires manual browser submission)
 *
 * @see {@link DEVELOPMENT_DEFAULTS} for permissive development settings
 * @see https://hstspreload.org/ for HSTS preload list submission
 */
export const PRODUCTION_DEFAULTS: SecurityOptions = {
  enabled: true,

  // HSTS enabled with strict settings for production
  // 31536000 seconds = 1 year (recommended minimum)
  // includeSubDomains protects all subdomains (e.g., api.example.com)
  // preload is false - requires manual submission to browser preload lists
  hsts: {
    maxAge: 31536000, // 1 year in seconds
    includeSubDomains: true,
    preload: false, // Set to true only after verifying HTTPS works everywhere
  },

  csp: {
    directives: {
      // Strict default: only same-origin resources
      defaultSrc: ["'self'"],

      // Scripts: ONLY same-origin, NO inline scripts, NO eval
      // This prevents XSS attacks from injected scripts
      // Use external .js files or nonces for legitimate inline scripts
      scriptSrc: ["'self'"],

      // Styles: ONLY same-origin, NO inline styles
      // Use external .css files or nonces for legitimate inline styles
      // Consider allowing 'unsafe-hashes' for specific inline styles if needed
      styleSrc: ["'self'"],

      // Images: Allow self, data URLs, and any HTTPS source
      // data: needed for inline SVGs and base64 encoded images
      // https: allows CDN images (e.g., https://cdn.example.com/image.jpg)
      imgSrc: ["'self'", 'data:', 'https:'],

      // Fonts: Only same-origin fonts
      // Add specific CDN origins if using web fonts (e.g., "https://fonts.gstatic.com")
      fontSrc: ["'self'"],

      // Connections: Only same-origin (XHR, fetch, WebSocket)
      // Add your API domains if different from app domain
      // Use wss: (secure WebSocket) instead of ws: in production
      connectSrc: ["'self'"],

      // Objects: Block all plugins (Flash, Java, etc.)
      // Plugins are legacy and pose security risks
      objectSrc: ["'none'"],

      // Frames: Block ALL iframes (no embeds)
      // Most secure option - prevents clickjacking and iframe-based attacks
      // Change to ["'self'"] if your app legitimately uses iframes
      frameSrc: ["'none'"],
    },
  },

  // DENY is strictest frame option - prevents ALL framing
  // Prevents clickjacking attacks where your site is embedded maliciously
  // Use SAMEORIGIN if you need to iframe your own pages
  frameOptions: 'DENY',

  // Enable XSS filter (legacy, CSP is the modern approach)
  // Kept enabled for defense in depth on older browsers
  xssFilter: true,

  // Prevent MIME type sniffing
  // Browsers won't guess content types, reducing attack surface
  noSniff: true,

  // Strict referrer policy for production
  // Only sends origin (not full URL) when navigating cross-origin
  // Minimizes information leakage while allowing analytics
  referrerPolicy: 'strict-origin-when-cross-origin',

  // Currently not supported in BlaizeJS
  // Hide X-Powered-By header
  // Don't advertise server technology to potential attackers
  // hidePoweredBy: true,

  // Audit mode disabled by default
  // Enable in staging to test security configuration before production
  audit: false,
};
