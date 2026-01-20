import { z } from 'zod';

/**
 * Validate request files
 */
export function validateFiles<T>(files: unknown, schema: z.ZodType<T>): T {
  if (schema instanceof z.ZodObject) {
    return schema.strict().parse(files) as T;
  }
  // Parse and validate with the provided schema
  return schema.parse(files);
}
