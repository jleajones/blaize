import { z } from 'zod';

/**
 * Validate request body
 */
export function validateBody<T>(body: unknown, schema: z.ZodType<T>): T {
  if (schema instanceof z.ZodObject) {
    return schema.strict().parse(body) as T;
  }
  // Parse and validate with the provided schema
  return schema.parse(body);
}
