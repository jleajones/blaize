/**
 * CORS Default Configurations
 *
 * Environment-aware default configurations for CORS middleware.
 * Provides secure defaults for production and permissive defaults for development.
 *
 * SECURITY IMPLICATIONS:
 *
 * Development Mode (NODE_ENV !== 'production'):
 * - Allows ALL origins (wildcard '*')
 * - No credentials allowed with wildcard (security requirement)
 * - All common HTTP methods allowed
 * - Suitable for local development and testing
 * - WARNING: Never use in production as it allows any website to make requests
 *
 * Production Mode (NODE_ENV === 'production'):
 * - Denies all cross-origin requests by default (origin: false)
 * - Only GET and HEAD methods allowed (read-only)
 * - No credentials by default
 * - Forces explicit origin configuration for security
 * - Requires deliberate configuration of allowed origins
 *
 * @module @blaize-core/middleware/cors/defaults
 */

import type { CorsOptions } from '@blaize-types/cors';

/**
 * Development environment CORS defaults
 *
 * SECURITY WARNING: These settings are ONLY for development.
 * They allow any origin to access your API, which is a security risk in production.
 *
 * Features:
 * - origin: true (allows all origins)
 * - credentials: false (prevents credential sharing with wildcard)
 * - methods: All common HTTP methods
 * - optionsSuccessStatus: 204 (standard)
 *
 * @internal
 */
const DEVELOPMENT_DEFAULTS: CorsOptions = {
  origin: true, // Allow all origins in development
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
  credentials: false, // Cannot use credentials with wildcard origin
  optionsSuccessStatus: 204,
};

/**
 * Production environment CORS defaults
 *
 * SECURITY: These settings are restrictive by default.
 * Cross-origin requests are denied unless explicitly configured.
 *
 * Features:
 * - origin: false (denies all cross-origin requests)
 * - methods: Only GET and HEAD (read-only)
 * - credentials: false (no credential sharing)
 * - optionsSuccessStatus: 204 (standard)
 *
 * To allow cross-origin requests in production, you must explicitly set:
 * - origin: specific domain(s) or validation function
 * - methods: only the methods your API actually needs
 * - credentials: true only if necessary for authentication
 *
 * @internal
 */
const PRODUCTION_DEFAULTS: CorsOptions = {
  origin: false, // Deny all cross-origin requests by default
  methods: ['GET', 'HEAD'], // Only safe methods by default
  credentials: false, // No credentials by default
  optionsSuccessStatus: 204,
};

/**
 * Get default CORS options based on environment
 *
 * Automatically detects the environment and returns appropriate defaults.
 * Uses NODE_ENV environment variable to determine if in production.
 *
 * @param isDevelopment - Override environment detection (optional)
 * @returns CORS options with environment-appropriate defaults
 *
 * @example
 * ```typescript
 * // Automatic environment detection
 * const options = getDefaultCorsOptions();
 *
 * // Force development mode
 * const devOptions = getDefaultCorsOptions(true);
 *
 * // Force production mode
 * const prodOptions = getDefaultCorsOptions(false);
 * ```
 *
 * @security
 * In production, this returns restrictive defaults that deny all cross-origin
 * requests. You must explicitly configure allowed origins to enable CORS.
 *
 * Example production configuration:
 * ```typescript
 * const corsOptions = {
 *   ...getDefaultCorsOptions(),
 *   origin: 'https://app.example.com', // Explicit origin
 *   credentials: true, // If needed for auth
 * };
 * ```
 */
export function getDefaultCorsOptions(isDevelopment?: boolean): CorsOptions {
  // If isDevelopment is not provided, detect from environment
  if (isDevelopment === undefined) {
    isDevelopment = process.env.NODE_ENV !== 'production';
  }

  return isDevelopment ? { ...DEVELOPMENT_DEFAULTS } : { ...PRODUCTION_DEFAULTS };
}

/**
 * Detect if running in development environment
 *
 * @returns True if in development mode
 */
export function isDevelopmentEnvironment(): boolean {
  return process.env.NODE_ENV !== 'production';
}

/**
 * Get environment name for logging
 *
 * @returns Current environment name
 */
export function getEnvironmentName(): string {
  return process.env.NODE_ENV || 'development';
}

/**
 * Validate that production configuration is secure
 *
 * Checks if CORS options are appropriate for production use.
 * Logs warnings if insecure configurations are detected.
 *
 * @param options - CORS options to validate
 * @returns True if configuration appears secure
 */
export function validateProductionConfig(options: CorsOptions): boolean {
  const warnings: string[] = [];

  // Check for wildcard origin in production
  if (options.origin === true || options.origin === '*') {
    warnings.push('SECURITY WARNING: Wildcard origin (*) should not be used in production');
  }

  // Check for credentials with permissive origin
  if (options.credentials === true && (options.origin === true || options.origin === '*')) {
    warnings.push('SECURITY ERROR: Cannot use credentials with wildcard origin');
    // Log warnings before returning false
    if (!isDevelopmentEnvironment() && warnings.length > 0) {
      warnings.forEach(warning => console.warn(`[CORS] ${warning}`));
    }
    return false; // This is a hard error
  }

  // Check for overly permissive methods
  const methods = options.methods || [];
  const methodsList = typeof methods === 'string' ? methods.split(',').map(m => m.trim()) : methods;

  if (
    methodsList.includes('DELETE') ||
    methodsList.includes('CONNECT') ||
    methodsList.includes('TRACE')
  ) {
    warnings.push('SECURITY WARNING: Dangerous HTTP methods (DELETE, CONNECT, TRACE) are allowed');
  }

  // Log warnings if in production
  if (!isDevelopmentEnvironment() && warnings.length > 0) {
    warnings.forEach(warning => console.warn(`[CORS] ${warning}`));
  }

  return warnings.length === 0;
}
