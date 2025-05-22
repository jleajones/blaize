/**
 * Base router error class
 */
export class RouterError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Route not found error
 */
export class RouteNotFoundError extends RouterError {
  constructor(path: string, method: string) {
    super(`Route not found: ${method} ${path}`, 404);
    this.name = 'RouteNotFoundError';
  }
}

/**
 * Method not allowed error
 */
export class MethodNotAllowedError extends RouterError {
  constructor(path: string, method: string, allowedMethods: string[]) {
    super(`Method ${method} not allowed for route ${path}`, 405);
    this.name = 'MethodNotAllowedError';
    this.allowedMethods = allowedMethods;
  }

  allowedMethods: string[];
}

/**
 * Validation error
 */
export class ValidationError extends RouterError {
  constructor(message: string, details: unknown) {
    super(message, 400);
    this.name = 'ValidationError';
    this.details = details;
  }

  details: unknown;
}

/**
 * Route load error
 */
export class RouteLoadError extends RouterError {
  constructor(filePath: string, cause: Error) {
    super(`Failed to load route from ${filePath}: ${cause.message}`, 500);
    this.name = 'RouteLoadError';
    this.cause = cause;
  }

  cause: Error;
}
