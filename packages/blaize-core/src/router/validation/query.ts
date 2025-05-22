import { z } from 'zod';

/**
 * Validate query parameters
 */
export function validateQuery<T>(
  query: Record<string, string | string[] | undefined>,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>
): T {
  // Parse and validate with the provided schema
  return schema.parse(query);
}
