/**
 * @file Configuration validation for security middleware
 * @module @blaizejs/middleware-security/validation
 */

import { z } from 'zod';

import { SecurityConfigurationError } from './error';

import type { SecurityOptions } from './types';

/**
 * Zod schema for ReferrerPolicy values.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referrer-Policy
 */
const ReferrerPolicySchema = z.enum([
  'no-referrer',
  'no-referrer-when-downgrade',
  'origin',
  'origin-when-cross-origin',
  'same-origin',
  'strict-origin',
  'strict-origin-when-cross-origin',
  'unsafe-url',
]);

/**
 * Zod schema for CSP directive values.
 *
 * Each directive can be:
 * - string[] (list of sources)
 * - boolean (directive flag)
 * - string (single source value)
 */
const CSPDirectiveValueSchema = z.union([z.array(z.string()), z.boolean(), z.string()]);

/**
 * Zod schema for CSP directives.
 *
 * Supports 8 core directives plus extensible index signature.
 */
const CSPDirectivesSchema = z.record(z.string(), CSPDirectiveValueSchema.optional());

/**
 * Zod schema for CSP options.
 */
const CSPOptionsSchema = z.object({
  directives: CSPDirectivesSchema,
  reportOnly: z.boolean().optional(),
  reportUri: z.string().optional(),
});

/**
 * Zod schema for HSTS options.
 */
const HSTSOptionsSchema = z.object({
  maxAge: z
    .number({ message: 'HSTS maxAge must be a number' })
    .positive({ message: 'HSTS maxAge must be a positive number' })
    .finite({ message: 'HSTS maxAge must be a finite number' }),
  includeSubDomains: z.boolean().optional(),
  preload: z.boolean().optional(),
});

/**
 * Main security options schema.
 *
 * Validates all security middleware configuration options.
 */
const SecurityOptionsSchema = z.object({
  enabled: z.boolean({ message: 'enabled must be a boolean' }).optional(),
  csp: z.union([CSPOptionsSchema, z.literal(false)]).optional(),
  hsts: z.union([HSTSOptionsSchema, z.literal(false)]).optional(),
  frameOptions: z
    .enum(['DENY', 'SAMEORIGIN'], {
      message: 'frameOptions must be "DENY", "SAMEORIGIN", or false',
    })
    .or(z.literal(false))
    .optional(),
  xssFilter: z.boolean().optional(),
  noSniff: z.boolean().optional(),
  referrerPolicy: z.union([ReferrerPolicySchema, z.literal(false)]).optional(),
  hidePoweredBy: z.boolean().optional(),
  audit: z.boolean().optional(),
});

/**
 * Validate security middleware configuration options.
 *
 * Uses Zod schemas for type-safe validation. Throws SecurityConfigurationError
 * if any validation rules fail.
 *
 * @param options - Security options to validate
 * @throws {SecurityConfigurationError} If validation fails
 *
 * @example
 * ```typescript
 * try {
 *   validateSecurityOptions({
 *     hsts: { maxAge: -1 }, // Invalid!
 *   });
 * } catch (error) {
 *   if (error instanceof SecurityConfigurationError) {
 *     console.error(error.message, error.details);
 *   }
 * }
 * ```
 */
export function validateSecurityOptions(options: SecurityOptions): void {
  const result = SecurityOptionsSchema.safeParse(options);

  if (!result.success) {
    const firstIssue = result.error.issues[0];
    if (!firstIssue) {
      throw new SecurityConfigurationError('Invalid security configuration', {});
    }

    // Get field path for context
    const fieldPath = firstIssue.path.length > 0 ? firstIssue.path.join('.') : 'root';

    // If message is generic, prepend field name for clarity
    let errorMessage = firstIssue.message;
    if (errorMessage === 'Invalid input' || errorMessage === 'Required') {
      const fieldName = firstIssue.path[firstIssue.path.length - 1] || 'field';
      errorMessage = `${fieldName}: ${errorMessage}`;
    }

    const message = `Invalid security configuration: ${errorMessage}`;

    // Simple context with just field path
    const context = {
      field: fieldPath,
    };

    throw new SecurityConfigurationError(message, context);
  }
}

/**
 * Export schemas for reuse in other modules (e.g., audit mode).
 */
export {
  SecurityOptionsSchema,
  HSTSOptionsSchema,
  CSPOptionsSchema,
  CSPDirectivesSchema,
  ReferrerPolicySchema,
};
