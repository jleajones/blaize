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
