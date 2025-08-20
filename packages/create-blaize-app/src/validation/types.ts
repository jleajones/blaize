import type { Result } from '../utils/functional';

/**
 * Validation error type that extends Error
 */
export class ValidationError extends Error {
  public field?: string | undefined;
  public code: string;

  constructor(message: string, code: string = 'VALIDATION_ERROR', field?: string) {
    super(message);
    this.name = 'ValidationError';
    this.code = code;
    this.field = field;
  }
}

/**
 * Schema validator interface (abstraction for future extensibility)
 */
export interface SchemaValidator<T> {
  parse(data: unknown): Result<T, ValidationError>;
  safeParse(data: unknown): {
    success: boolean;
    data?: T;
    error?: ValidationError;
  };
}
