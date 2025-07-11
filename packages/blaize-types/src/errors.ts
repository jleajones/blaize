/**
 * Interface for body parsing errors stored in context state
 */
export interface BodyParseError {
  /**
   * Type of parsing error that occurred
   */
  readonly type:
    | 'json_parse_error'
    | 'form_parse_error'
    | 'multipart_parse_error'
    | 'body_read_error';

  /**
   * Human-readable error message
   */
  readonly message: string;

  /**
   * Original error object or details
   */
  readonly error: unknown;
}

/**
 * Type guard to check if an object is a BodyParseError
 */
export function isBodyParseError(error: unknown): error is BodyParseError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    'message' in error &&
    'error' in error &&
    typeof (error as any).type === 'string' &&
    typeof (error as any).message === 'string'
  );
}
