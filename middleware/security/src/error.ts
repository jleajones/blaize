/**
 * @file Security configuration error class
 * @module @blaizejs/middleware-security/errors
 */

import { BlaizeError, ErrorType } from 'blaizejs';

/**
 * Error thrown when security middleware configuration is invalid.
 *
 * This error indicates that the user provided invalid configuration options
 * to the security middleware. The error includes detailed context about what
 * was invalid and what was expected to help users fix their configuration.
 *
 * @example
 * ```typescript
 * throw new SecurityConfigurationError(
 *   'HSTS maxAge must be a positive number',
 *   { value: -1, expected: 'positive number' }
 * );
 * ```
 */
export class SecurityConfigurationError extends BlaizeError {
  /**
   * Creates a new SecurityConfigurationError.
   *
   * @param message - Human-readable error message explaining what is invalid
   * @param context - Optional context object with details about the invalid configuration
   *
   * @example
   * ```typescript
   * new SecurityConfigurationError(
   *   'Invalid frameOptions value',
   *   {
   *     value: 'INVALID',
   *     expected: "'DENY', 'SAMEORIGIN', or false"
   *   }
   * );
   * ```
   */
  constructor(message: string, context?: Record<string, unknown>) {
    super(
      ErrorType.VALIDATION_ERROR,
      message,
      500, // Internal Server Error - configuration error prevents server from starting properly
      'security-config', // Static correlation ID for configuration errors
      context
    );
  }
}
