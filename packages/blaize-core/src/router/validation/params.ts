import { z } from 'zod';

/**
 * Validate request parameters
 */
export function validateParams<T>(
  params: Record<string, string>,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>
): T {
  if (schema instanceof z.ZodObject) {
    // If schema is an object, ensure strict parsing
    return schema.strict().parse(params) as T;
  }
  // Parse and validate with the provided schema
  return schema.parse(params);
}
