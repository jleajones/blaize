import { z } from 'zod';

import { ValidationError } from './error';
import { ok, err } from '../utils/functional';

import type { Result, SchemaValidator } from '@/types';

/**
 * Zod adapter for schema validation
 * Allows us to swap validation libraries in the future
 */
export class ZodValidator<T> implements SchemaValidator<T> {
  constructor(private schema: z.ZodSchema<T>) {}

  /**
   * Parse data and return Result type
   */
  parse(data: unknown): Result<T, ValidationError> {
    const result = this.schema.safeParse(data);

    if (result.success) {
      return ok(result.data);
    }

    const firstError = result.error.errors[0];
    if (!firstError) {
      return err(new ValidationError('Validation failed', 'VALIDATION_ERROR'));
    }

    return err(
      new ValidationError(
        firstError.message,
        'VALIDATION_ERROR',
        firstError.path.length > 0 ? firstError.path.join('.') : undefined
      )
    );
  }

  /**
   * Safe parse with success flag
   */
  safeParse(data: unknown): { success: boolean; data?: T; error?: ValidationError } {
    const result = this.schema.safeParse(data);

    if (result.success) {
      return {
        success: true,
        data: result.data,
      };
    }

    const firstError = result.error.errors[0];
    if (!firstError) {
      return {
        success: false,
        error: new ValidationError('Validation failed', 'VALIDATION_ERROR'),
      };
    }

    return {
      success: false,
      error: new ValidationError(
        firstError.message,
        'VALIDATION_ERROR',
        firstError.path.length > 0 ? firstError.path.join('.') : undefined
      ),
    };
  }
}

/**
 * Helper to create validator from Zod schema
 */
export const createValidator = <T>(schema: z.ZodSchema<T>): SchemaValidator<T> => {
  return new ZodValidator(schema);
};
