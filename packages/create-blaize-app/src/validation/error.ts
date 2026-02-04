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
