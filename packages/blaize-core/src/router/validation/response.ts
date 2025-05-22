import { z } from 'zod';

/**
 * Validate response body
 */
export function validateResponse<T>(
  response: unknown,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>
): T {
  // Parse and validate with the provided schema
  return schema.parse(response);
}
