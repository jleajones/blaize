import type { Context, ErrorHandlerOptions } from '../../index';

/**
 * Handle a route error
 */
export function handleRouteError(
  ctx: Context,
  error: unknown,
  options: ErrorHandlerOptions = {}
): void {
  // Log error if enabled
  if (options.log) {
    console.error('Route error:', error);
  }

  // Determine error status code
  const status = getErrorStatus(error);

  // Build error response
  const response: Record<string, unknown> = {
    error: getErrorType(error),
    message: getErrorMessage(error),
  };

  // Add details if enabled
  if (options.detailed) {
    // Add stack trace for Error instances
    if (error instanceof Error) {
      response.stack = error.stack;
    }

    // Add validation details if available (for any type of error)
    if (error && typeof error === 'object' && 'details' in error && error.details) {
      response.details = error.details;
    }
  }

  // Send error response
  ctx.response.status(status).json(response);
}

/**
 * Get the HTTP status code for an error
 */
function getErrorStatus(error: unknown): number {
  if (error && typeof error === 'object') {
    // Check for status property
    if ('status' in error && typeof error.status === 'number') {
      return error.status;
    }

    // Check for statusCode property
    if ('statusCode' in error && typeof error.statusCode === 'number') {
      return error.statusCode;
    }

    // Check for code property that maps to status
    if ('code' in error && typeof error.code === 'string') {
      return getStatusFromCode(error.code);
    }
  }

  // Default to 500 for unknown errors
  return 500;
}

/**
 * Get a status code from an error code
 */
function getStatusFromCode(code: string): number {
  switch (code) {
    case 'NOT_FOUND':
      return 404;
    case 'UNAUTHORIZED':
      return 401;
    case 'FORBIDDEN':
      return 403;
    case 'BAD_REQUEST':
      return 400;
    case 'CONFLICT':
      return 409;
    default:
      return 500;
  }
}

/**
 * Get the error type
 */
function getErrorType(error: unknown): string {
  if (error && typeof error === 'object') {
    if ('type' in error && typeof error.type === 'string') {
      return error.type;
    }

    if ('name' in error && typeof error.name === 'string') {
      return error.name;
    }

    if (error instanceof Error) {
      return error.constructor.name;
    }
  }

  return 'Error';
}

/**
 * Get the error message
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === 'object') {
    if ('message' in error && typeof error.message === 'string') {
      return error.message;
    }
  }

  return String(error);
}
