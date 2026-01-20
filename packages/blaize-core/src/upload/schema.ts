/**
 * Zod extension for file upload validation
 *
 * Task [T1.2]: Implement z.file() Zod Extension
 *
 * Provides type-safe file validation with:
 * - MIME type validation (exact matches and wildcards)
 * - Size validation (min/max with human-readable units)
 * - Full Zod combinator support (.optional, .array, .refine)
 * - TypeScript inference to UploadedFile type
 *
 * @packageDocumentation
 */

import { z } from 'zod';

import { parseSize, formatBytes } from './parse-size';

import type { FileSchemaOptions, UploadedFile } from '@blaize-types/upload';

/**
 * Check if a Zod schema is a file schema
 *
 * Detects file schemas by checking for the `isFileSchema` marker.
 * Unwraps optional, nullable, and array wrappers.
 *
 * @param schema - Zod schema to check
 * @returns true if schema is a file schema
 *
 * @example Direct check
 * ```typescript
 * const schema = file();
 * isFileSchema(schema); // true
 * ```
 *
 * @example With wrappers
 * ```typescript
 * isFileSchema(file().optional()); // true
 * isFileSchema(file().array());    // true
 * isFileSchema(z.string());        // false
 * ```
 */
export function isFileSchema(schema: z.ZodTypeAny): boolean {
  // Unwrap optional, nullable, default
  let unwrapped: z.ZodTypeAny = schema;
  
  let changed = true;
  while (changed) {
    changed = false;
    if (
      unwrapped instanceof z.ZodOptional ||
      unwrapped instanceof z.ZodNullable ||
      unwrapped instanceof z.ZodDefault
    ) {
      unwrapped = unwrapped._def.innerType;
      changed = true;
      continue;
    }

    // Unwrap arrays
    if (unwrapped instanceof z.ZodArray) {
      unwrapped = unwrapped._def.type;
      changed = true;
      continue;
    }
  }

  // Check for our marker on the schema object itself
  return (unwrapped as any)._isFileSchema === true;
}

/**
 * Check if MIME type matches pattern (exact or wildcard)
 *
 * @param mimetype - Actual MIME type (e.g., "image/jpeg")
 * @param pattern - Pattern to match (e.g., "image/jpeg" or "image/*")
 * @returns true if MIME matches pattern
 *
 * @internal
 */
function matchesMimeType(mimetype: string, pattern: string): boolean {
  // Exact match
  if (mimetype === pattern) {
    return true;
  }

  // Wildcard match (e.g., "image/*")
  if (pattern.endsWith('/*')) {
    const baseType = pattern.slice(0, -2); // Remove "/*"
    const actualBaseType = mimetype.split('/')[0];
    return actualBaseType === baseType;
  }

  return false;
}

/**
 * Validate that value is an UploadedFile object
 *
 * @param value - Value to check
 * @returns true if value looks like UploadedFile
 *
 * @internal
 */
function isUploadedFile(value: unknown): value is UploadedFile {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const file = value as any;

  // Check required fields from UploadedFile interface
  return (
    typeof file.fieldname === 'string' &&
    typeof file.originalname === 'string' &&
    typeof file.encoding === 'string' &&
    typeof file.mimetype === 'string' &&
    typeof file.size === 'number' &&
    // Buffer is optional (depends on strategy), but if present must be Buffer
    (file.buffer === undefined || Buffer.isBuffer(file.buffer))
  );
}

/**
 * Create a Zod schema for file upload validation
 *
 * Returns a schema that validates uploaded files with:
 * - Type checking (ensures value is UploadedFile)
 * - MIME type validation (exact and wildcard matching)
 * - Size validation (min/max with human-readable units)
 * - Detailed error messages
 *
 * The schema is marked with `isFileSchema: true` for detection by
 * the request validator.
 *
 * @param options - Validation options
 * @returns Zod schema that infers to UploadedFile
 *
 * @example No restrictions
 * ```typescript
 * const schema = file();
 * // Accepts any file
 * ```
 *
 * @example Size limits
 * ```typescript
 * const schema = file({
 *   minSize: '100KB',
 *   maxSize: '5MB'
 * });
 * ```
 *
 * @example MIME type restrictions
 * ```typescript
 * const schema = file({
 *   accept: ['image/jpeg', 'image/png'],
 *   maxSize: '10MB'
 * });
 * ```
 *
 * @example Wildcard MIME types
 * ```typescript
 * const schema = file({
 *   accept: ['image/*'],  // All image types
 *   maxSize: '5MB'
 * });
 * ```
 *
 * @example With Zod combinators
 * ```typescript
 * // Optional file
 * const optionalFile = file({ maxSize: '5MB' }).optional();
 *
 * // Array of files
 * const multipleFiles = z.array(file({ maxSize: '5MB' }));
 *
 * // Custom validation
 * const jpgOnly = file().refine(
 *   file => file.originalname.endsWith('.jpg'),
 *   { message: 'Only .jpg files allowed' }
 * );
 * ```
 *
 * @example In route schema
 * ```typescript
 * export const POST = route.post({
 *   schema: {
 *     files: z.object({
 *       avatar: file({ maxSize: '5MB', accept: ['image/*'] }),
 *       resume: file({ maxSize: '10MB', accept: ['application/pdf'] }),
 *     }),
 *   },
 *   handler: async ({ ctx }) => {
 *     const { avatar, resume } = ctx.request.files;
 *     // avatar and resume are typed as UploadedFile
 *   },
 * });
 * ```
 */
export function file(options?: FileSchemaOptions): z.ZodType<UploadedFile> {
  // Parse size options
  const maxSizeBytes =
    options?.maxSize !== undefined
      ? typeof options.maxSize === 'number'
        ? options.maxSize
        : parseSize(options.maxSize)
      : undefined;

  const minSizeBytes =
    options?.minSize !== undefined
      ? typeof options.minSize === 'number'
        ? options.minSize
        : parseSize(options.minSize)
      : undefined;

  // Create base schema using z.custom() with a type guard
  // We'll mark it as a file schema by wrapping it with metadata
  const baseSchema = z.custom<UploadedFile>(
    (value): value is UploadedFile => {
      // This is just for type inference, actual validation happens in superRefine
      return isUploadedFile(value);
    },
    {
      message: 'Expected an uploaded file object',
    }
  );

  // Apply validation via superRefine and store marker in the schema
  const validatedSchema = baseSchema.superRefine((value, ctx) => {
    // Check if value is an UploadedFile
    if (!isUploadedFile(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Expected an uploaded file object',
      });
      return;
    }

    const file = value as UploadedFile;

    // Validate MIME type
    if (options?.accept && options.accept.length > 0) {
      const matches = options.accept.some(pattern => matchesMimeType(file.mimetype, pattern));

      if (!matches) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Invalid file type "${file.mimetype}". Accepted types: ${options.accept.join(', ')}`,
        });
      }
    }

    // Validate minimum size
    if (minSizeBytes !== undefined && file.size < minSizeBytes) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `File size ${formatBytes(file.size)} is below minimum ${formatBytes(minSizeBytes)}`,
      });
    }

    // Validate maximum size
    if (maxSizeBytes !== undefined && file.size > maxSizeBytes) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `File size ${formatBytes(file.size)} exceeds maximum ${formatBytes(maxSizeBytes)}`,
      });
    }

    // Validate size is not negative (corrupted file)
    if (file.size < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'File size cannot be negative',
      });
    }

    // Validate MIME type exists
    if (!file.mimetype || file.mimetype.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'File must have a MIME type',
      });
    }
  });

  // Store marker for isFileSchema detection
  // We attach it directly to the schema object
  (validatedSchema as any)._isFileSchema = true;

  return validatedSchema;
}
