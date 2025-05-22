import { z } from 'zod';

/**
 * Validate request parameters
 */
export function validateParams<T>(
  params: Record<string, string>,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>
): T {
  // Parse and validate with the provided schema
  return schema.parse(params);
}
