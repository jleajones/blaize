/**
 * Error type definitions and interfaces for the BlaizeJS framework
 *
 * This module contains all the type definitions used for error handling
 * across the BlaizeJS framework, including server-side errors, client-side
 * errors, and HTTP response formats.
 */

/**
 * Structure of error responses sent over HTTP
 *
 * This interface defines the JSON format used for all error responses
 * from BlaizeJS servers. It matches the structure returned by BlaizeError.toJSON()
 *
 * @example
 * ```json
 * {
 *   "type": "VALIDATION_ERROR",
 *   "title": "Request validation failed",
 *   "status": 400,
 *   "correlationId": "req_abc123",
 *   "timestamp": "2024-01-15T10:30:00.000Z",
 *   "details": {
 *     "fields": ["email", "password"]
 *   }
 * }
 * ```
 */
export interface BlaizeErrorResponse {
  /** Error type from the ErrorType enum */
  type: ErrorType;

  /** Human-readable error message */
  title: string;

  /** HTTP status code */
  status: number;

  /** Correlation ID for request tracing */
  correlationId: string;

  /** ISO timestamp when error occurred */
  timestamp: string;

  /** Optional error-specific details */
  details?: unknown;
}

/**
 * Context information for network-related errors
 *
 * Used by client-side error classes to provide additional context
 * about network failures, timeouts, and connection issues.
 */
export interface NetworkErrorContext {
  /** The URL that failed */
  url: string;

  /** HTTP method being attempted */
  method: string;

  /** Correlation ID for tracing */
  correlationId: string;

  /** Timeout value if applicable */
  timeout?: number;

  /** The original error that caused the network failure */
  originalError: Error;

  /** Additional network-specific details */
  networkDetails?: {
    /** Whether this was a connection timeout */
    isTimeout?: boolean;

    /** Whether this was a DNS resolution failure */
    isDnsFailure?: boolean;

    /** Whether this was a connection refused error */
    isConnectionRefused?: boolean;

    /** HTTP status code if received before failure */
    statusCode?: number;
  };
}

/**
 * Context information for request timeout errors
 *
 * Specialized context for timeout-specific errors with timing information.
 */
export interface TimeoutErrorContext {
  /** The URL that timed out */
  url: string;

  /** HTTP method being attempted */
  method: string;

  /** Correlation ID for tracing */
  correlationId: string;

  /** Configured timeout value in milliseconds */
  timeoutMs: number;

  /** Actual duration before timeout in milliseconds */
  elapsedMs: number;

  /** Type of timeout (request, connection, etc.) */
  timeoutType: 'request' | 'connection' | 'response' | 'idle';
}

/**
 * Context information for response parsing errors
 *
 * Used when the client receives a response but cannot parse it properly.
 */
export interface ParseErrorContext {
  /** The URL that returned unparseable content */
  url: string;

  /** HTTP method used */
  method: string;

  /** Correlation ID for tracing */
  correlationId: string;

  /** HTTP status code received */
  statusCode: number;

  /** Content-Type header if available */
  contentType?: string;

  /** Expected response format */
  expectedFormat: 'json' | 'text' | 'binary';

  /** Sample of the actual response content (truncated for safety) */
  responseSample?: string;

  /** The original parsing error */
  originalError: Error;
}

/**
 * Validation error field details
 *
 * Structure for field-level validation errors with multiple error messages
 * per field.
 */
export interface ValidationFieldError {
  /** Field name or path (e.g., "email", "user.profile.name") */
  field: string;

  /** Array of error messages for this field */
  messages: string[];

  /** The invalid value that caused the error */
  rejectedValue?: unknown;

  /** Expected type or format */
  expectedType?: string;
}

/**
 * Validation error details structure
 *
 * Used by ValidationError to provide structured information about
 * what fields failed validation and why.
 */
export interface ValidationErrorDetails {
  /** Array of field-level errors */
  fields: ValidationFieldError[];

  /** Total number of validation errors */
  errorCount: number;

  /** The section that failed validation */
  section: 'params' | 'query' | 'body' | 'response';

  /** Schema name if available */
  schemaName?: string;
}

/**
 * All available error types in the BlaizeJS framework
 *
 * This enum provides both compile-time type safety and runtime values
 * for error type identification across server and client packages.
 *
 * @example Type-safe error handling:
 * ```typescript
 * function handleError(errorType: ErrorType) {
 *   switch (errorType) {
 *     case ErrorType.VALIDATION_ERROR:
 *       // Handle validation error
 *       break;
 *     case ErrorType.NOT_FOUND:
 *       // Handle not found error
 *       break;
 *     // TypeScript ensures all cases are covered
 *   }
 * }
 * ```
 */
export enum ErrorType {
  // Server-side business logic errors
  /** Request validation failed (400) */
  VALIDATION_ERROR = 'VALIDATION_ERROR',

  /** Resource not found (404) */
  NOT_FOUND = 'NOT_FOUND',

  /** Authentication required (401) */
  UNAUTHORIZED = 'UNAUTHORIZED',

  /** Access forbidden (403) */
  FORBIDDEN = 'FORBIDDEN',

  /** Resource conflict (409) */
  CONFLICT = 'CONFLICT',

  /** Rate limit exceeded (429) */
  RATE_LIMITED = 'RATE_LIMITED',

  /** Internal server error (500) */
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',

  // Client-side errors
  /** Network connectivity failure (0) */
  NETWORK_ERROR = 'NETWORK_ERROR',

  /** Request or response timeout (0) */
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',

  /** Response parsing failure (0) */
  PARSE_ERROR = 'PARSE_ERROR',

  /** Generic HTTP error (varies) */
  HTTP_ERROR = 'HTTP_ERROR',
}

/**
 * Error severity levels for logging and monitoring
 *
 * Provides a way to categorize errors by their impact and urgency.
 */
export enum ErrorSeverity {
  /** Low impact, often user errors */
  LOW = 'low',

  /** Medium impact, application errors */
  MEDIUM = 'medium',

  /** High impact, system errors */
  HIGH = 'high',

  /** Critical impact, service disruption */
  CRITICAL = 'critical',
}

/**
 * Abstract base class for all BlaizeJS errors
 *
 * This class provides the foundation for all error types in the BlaizeJS framework.
 * It extends JavaScript's built-in Error class and adds framework-specific properties
 * for consistent error handling across server and client.
 *
 * @example
 * ```typescript
 * import { ErrorType } from './types';
 *
 * class NotFoundError extends BlaizeError<{ resourceId: string }> {
 *   constructor(message = 'Resource not found', details?: { resourceId: string }) {
 *     super(ErrorType.NOT_FOUND, message, 404, getCurrentCorrelationId(), details);
 *   }
 * }
 * ```
 *
 * @template TDetails - Type for error-specific details object
 */
export abstract class BlaizeError<TDetails = unknown> extends Error {
  /**
   * Error type identifier from the ErrorType enum
   * Used for programmatic error handling and client-side error routing
   */
  readonly type: ErrorType;

  /**
   * Human-readable error title/message
   * Should be descriptive enough for debugging but safe for end users
   */
  readonly title: string;

  /**
   * HTTP status code associated with this error
   * Used by the error boundary to set appropriate response status
   */
  readonly status: number;

  /**
   * Correlation ID for request tracing
   * Links this error to the specific request that generated it
   */
  readonly correlationId: string;

  /**
   * Timestamp when the error occurred
   * Useful for debugging and log correlation
   */
  readonly timestamp: Date;

  /**
   * Additional error-specific details
   * Type-safe error context that varies by error type
   */
  readonly details?: TDetails | undefined;

  /**
   * Creates a new BlaizeError instance
   *
   * @param type - Error type from the ErrorType enum
   * @param title - Human-readable error message
   * @param status - HTTP status code
   * @param correlationId - Request correlation ID for tracing
   * @param details - Optional error-specific details
   */
  protected constructor(
    type: ErrorType,
    title: string,
    status: number,
    correlationId: string,
    details?: TDetails | undefined
  ) {
    super(title);

    // Set the error name to the class name for better stack traces
    this.name = this.constructor.name;

    // Framework-specific properties
    this.type = type;
    this.title = title;
    this.status = status;
    this.correlationId = correlationId;
    this.timestamp = new Date();
    this.details = details;

    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);

    // Capture stack trace if available (V8 feature)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Serializes the error to a plain object suitable for HTTP responses
   *
   * @returns Object representation of the error
   */
  toJSON() {
    const base = {
      type: this.type,
      title: this.title,
      status: this.status,
      correlationId: this.correlationId,
      timestamp: this.timestamp.toISOString(),
    };

    // Only include details if they are not undefined
    if (this.details !== undefined) {
      return { ...base, details: this.details };
    }

    return base;
  }

  /**
   * Returns a string representation of the error
   * Includes correlation ID for easier debugging
   */
  toString(): string {
    return `${this.name}: ${this.title} [${this.correlationId}]`;
  }
}

// TODO: This can potentiall be removed
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
