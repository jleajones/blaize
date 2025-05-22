import { z } from 'zod';

/**
 * Validate request body
 */
export function validateBody<T>(body: unknown, schema: z.ZodType<T>): T {
  // Parse and validate with the provided schema
  return schema.parse(body);
}
