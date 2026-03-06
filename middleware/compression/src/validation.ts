/**
 * @file Configuration validation for compression middleware
 * @module @blaizejs/middleware-compression/validation
 */

import { z } from 'zod';

import { CompressionConfigurationError } from './errors';

import type { CompressionOptions } from './types';

/**
 * Zod schema for CompressionAlgorithm values.
 */
const CompressionAlgorithmSchema = z.enum(['gzip', 'deflate', 'br', 'identity'], {
  message: 'algorithms must be one of: gzip, deflate, br, identity',
});

/**
 * Zod schema for CompressionLevel values.
 * Can be a preset string or a numeric level.
 */
const CompressionLevelSchema = z.union([
  z.enum(['fastest', 'default', 'best'], {
    message: 'level must be "fastest", "default", "best", or a number',
  }),
  z.number({ message: 'level must be a string preset or number' }).int({ message: 'level must be an integer' }),
]);

/**
 * Zod schema for ContentTypeFilterConfig.
 */
const ContentTypeFilterConfigSchema = z.object({
  include: z.array(z.string()).optional(),
  exclude: z.array(z.string()).optional(),
});

/**
 * Zod schema for ContentTypeFilter (function or config object).
 */
const ContentTypeFilterSchema = z.union([
  z.function().args(z.string()).returns(z.boolean()),
  ContentTypeFilterConfigSchema,
]);

/**
 * Zod schema for CompressionPreset values.
 */
const CompressionPresetSchema = z.enum(['fast', 'balanced', 'maximum', 'api', 'static'], {
  message: 'preset must be one of: fast, balanced, maximum, api, static',
});

/**
 * Main compression options schema.
 *
 * Validates all compression middleware configuration options.
 */
export const CompressionOptionsSchema = z.object({
  algorithms: z
    .array(CompressionAlgorithmSchema, {
      message: 'algorithms must be an array of compression algorithms',
    })
    .min(1, { message: 'algorithms must contain at least one algorithm' })
    .optional(),
  level: CompressionLevelSchema.optional(),
  threshold: z
    .number({ message: 'threshold must be a number' })
    .int({ message: 'threshold must be an integer' })
    .nonnegative({ message: 'threshold must be a non-negative integer' })
    .optional(),
  contentTypeFilter: ContentTypeFilterSchema.optional(),
  skip: z.function().optional(),
  vary: z.boolean({ message: 'vary must be a boolean' }).optional(),
  flush: z.boolean({ message: 'flush must be a boolean' }).optional(),
  memoryLevel: z
    .number({ message: 'memoryLevel must be a number' })
    .int({ message: 'memoryLevel must be an integer' })
    .min(1, { message: 'memoryLevel must be between 1 and 9' })
    .max(9, { message: 'memoryLevel must be between 1 and 9' })
    .optional(),
  windowBits: z
    .number({ message: 'windowBits must be a number' })
    .int({ message: 'windowBits must be an integer' })
    .optional(),
  brotliQuality: z
    .number({ message: 'brotliQuality must be a number' })
    .int({ message: 'brotliQuality must be an integer' })
    .min(0, { message: 'brotliQuality must be between 0 and 11' })
    .max(11, { message: 'brotliQuality must be between 0 and 11' })
    .optional(),
  preset: CompressionPresetSchema.optional(),
});

/**
 * Parsed and validated compression configuration type.
 * This is the output type after Zod parsing with defaults applied.
 */
export type ParsedCompressionConfig = z.infer<typeof CompressionOptionsSchema>;

/**
 * Parse and validate compression middleware configuration options.
 *
 * Uses Zod schemas for type-safe validation. Throws CompressionConfigurationError
 * if any validation rules fail.
 *
 * @param options - Compression options to validate
 * @returns Parsed and validated compression options
 * @throws {CompressionConfigurationError} If validation fails
 */
export function parseCompressionOptions(options: CompressionOptions): ParsedCompressionConfig {
  const result = CompressionOptionsSchema.safeParse(options);

  if (!result.success) {
    const firstIssue = result.error.issues[0];
    if (!firstIssue) {
      throw new CompressionConfigurationError('Invalid compression configuration', 'unknown');
    }

    const fieldPath = firstIssue.path.length > 0 ? firstIssue.path.join('.') : 'root';

    let errorMessage = firstIssue.message;
    if (errorMessage === 'Invalid input' || errorMessage === 'Required') {
      const fieldName = firstIssue.path[firstIssue.path.length - 1] || 'field';
      errorMessage = `${fieldName}: ${errorMessage}`;
    }

    const message = `Invalid compression configuration: ${errorMessage}`;

    throw new CompressionConfigurationError(message, fieldPath);
  }

  return result.data;
}

