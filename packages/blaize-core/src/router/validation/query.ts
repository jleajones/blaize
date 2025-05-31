import { z } from 'zod';

/**
 * Validate query parameters
 */
export function validateQuery<T>(
  query: Record<string, string | string[] | undefined>,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>
): T {
  if (schema instanceof z.ZodObject) {
    // If schema is an object, ensure strict parsing
    return schema.strict().parse(query) as T;
  }
  // Parse and validate with the provided schema
  return schema.parse(query);
}
