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

  /** SSE Not Acceptable (406) */
  SSE_NOT_ACCEPTABLE = 'SSE_NOT_ACCEPTABLE',

  /** Resource conflict (409) */
  CONFLICT = 'CONFLICT',

  /** Rate limit exceeded (429) */
  RATE_LIMITED = 'RATE_LIMITED',

  /** Internal server error (500) */
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',

  /** File/Request Too Large (413) */
  PAYLOAD_TOO_LARGE = 'PAYLOAD_TOO_LARGE',

  /** Wrong Content Type (415) */
  UNSUPPORTED_MEDIA_TYPE = 'UNSUPPORTED_MEDIA_TYPE',

  /** Upload Timeout (408) */
  UPLOAD_TIMEOUT = 'UPLOAD_TIMEOUT',

  /** Valid Format Invalid Semantics (422) */
  UNPROCESSABLE_ENTITY = 'UNPROCESSABLE_ENTITY',

  // Client-side errors
  /** Network connectivity failure (0) */
  NETWORK_ERROR = 'NETWORK_ERROR',

  /** Request or response timeout (0) */
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',

  /** Response parsing failure (0) */
  PARSE_ERROR = 'PARSE_ERROR',

  /** Generic HTTP error (varies) */
  HTTP_ERROR = 'HTTP_ERROR',

  // SSE-specific errors
  /** SSE connection failed (502) */
  SSE_CONNECTION_ERROR = 'SSE_CONNECTION_ERROR',

  /** SSE buffer overflow (503) */
  SSE_BUFFER_OVERFLOW = 'SSE_BUFFER_OVERFLOW',

  /** SSE stream closed (410) */
  SSE_STREAM_CLOSED = 'SSE_STREAM_CLOSED',
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

/**
 * Interface for payload too large error details
 */
export interface PayloadTooLargeErrorDetails {
  fileCount?: number;
  maxFiles?: number;
  filename?: string;
  field?: string;
  contentType?: string;
  currentSize?: number;
  maxSize?: number;
}

/**
 * Interface for unsupported media type error details
 */
export interface UnsupportedMediaTypeErrorDetails {
  receivedMimeType?: string;
  allowedMimeTypes?: string[];
  filename?: string;
}

/**
 * Interface for authentication error details
 */
export interface UnauthorizedErrorDetails {
  /** Reason for authentication failure */
  reason?:
    | 'missing_token'
    | 'invalid_token'
    | 'expired_token'
    | 'malformed_token'
    | 'insufficient_scope'
    | string;

  /** Authentication scheme (Bearer, Basic, etc.) */
  authScheme?: string;

  /** Authentication realm */
  realm?: string;

  /** Detailed error description */
  error_description?: string;

  /** Required scopes or permissions */
  requiredScopes?: string[];

  /** Login URL for interactive authentication */
  loginUrl?: string;

  /** Additional context */
  [key: string]: unknown;
}

/**
 * Interface for authorization/permission error details
 */
export interface ForbiddenErrorDetails {
  /** Required permission or role */
  requiredPermission?: string;

  /** User's current permissions */
  userPermissions?: string[];

  /** Resource being accessed */
  resource?: string;

  /** Action being attempted */
  action?: string;

  /** Reason for access denial */
  reason?: 'insufficient_permissions' | 'account_suspended' | 'resource_locked' | string;

  /** Additional context */
  [key: string]: unknown;
}

/**
 * Interface for resource conflict error details
 */
export interface ConflictErrorDetails {
  /** Type of conflict */
  conflictType?:
    | 'duplicate_key'
    | 'version_mismatch'
    | 'concurrent_modification'
    | 'business_rule'
    | string;

  /** Field that caused the conflict */
  field?: string;

  /** Existing value that conflicts */
  existingValue?: unknown;

  /** Provided value that conflicts */
  providedValue?: unknown;

  /** Resource that has the conflicting value */
  conflictingResource?: string;

  /** Current version/etag of the resource */
  currentVersion?: string;

  /** Expected version/etag */
  expectedVersion?: string;

  /** Suggested resolution */
  resolution?: string;

  /** Additional context */
  [key: string]: unknown;
}

/**
 * Interface for rate limiting error details
 */
export interface RateLimitErrorDetails {
  /** Maximum requests allowed in the time window */
  limit?: number;

  /** Remaining requests in current window */
  remaining?: number;

  /** When the rate limit resets */
  resetTime?: Date;

  /** Seconds until the rate limit resets */
  retryAfter?: number;

  /** Time window for the rate limit */
  window?: string;

  /** Identifier used for rate limiting (IP, user ID, etc.) */
  identifier?: string;

  /** Type of rate limit hit */
  limitType?: 'global' | 'per_user' | 'per_ip' | 'per_endpoint' | string;

  /** Additional context */
  [key: string]: unknown;
}

/**
 * Interface for internal server error details
 */
export interface InternalServerErrorDetails {
  /** Original error message (for debugging) */
  originalError?: string;

  /** Stack trace (for debugging) */
  stackTrace?: string;

  /** Component where the error occurred */
  component?: string;

  /** Operation being performed */
  operation?: string;

  /** Internal error code */
  internalErrorCode?: string;

  /** When the error occurred */
  timestamp?: Date;

  /** Whether this error should be retryable */
  retryable?: boolean;

  /** Additional debugging context */
  [key: string]: unknown;
}

/**
 * Interface for NotFound error details
 * Provides context about the missing resource
 */
export interface NotFoundErrorDetails {
  /** Type of resource that was not found */
  resourceType?: string;

  /** ID or identifier of the resource */
  resourceId?: string;

  /** Collection or table where the resource was searched */
  collection?: string;

  /** Search criteria that was used */
  query?: Record<string, unknown>;

  /** Search criteria that was used (for backward compatibility) */
  searchCriteria?: Record<string, unknown>;

  /** The path that was attempted */
  path?: string;

  /** HTTP method used (for API endpoints) */
  method?: string;

  /** The path that was attempted (for backward compatibility) */
  attemptedPath?: string;

  /** Parent resource information for nested resources */
  parentResource?: {
    type: string;
    id: string;
  };

  /** Helpful suggestion for the user */
  suggestion?: string;

  /** Additional context */
  [key: string]: unknown;
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

// TODO: Consider moving to blaize-core
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

/**
 * Context information for error transformation
 */
export interface ErrorTransformContext {
  url: string;
  method: string;
  correlationId: string;
  timeoutMs?: number;
  elapsedMs?: number;
  statusCode?: number;
  contentType?: string;
  responseSample?: string;
  [key: string]: unknown;
}

/**
 * SSE-specific error detail interfaces for BlaizeJS framework
 *
 * These interfaces define the structure of details for SSE errors.
 * The actual error classes are implemented in blaize-core.
 */

/**
 * Details for SSE connection errors
 */
export interface SSEConnectionErrorDetails {
  /** Client identifier if available */
  clientId?: string;

  /** Connection attempt number */
  attemptNumber?: number;

  /** Maximum retry attempts configured */
  maxRetries?: number;

  /** The underlying error that caused connection failure */
  cause?: string;

  /** Suggested resolution */
  suggestion?: string;
}

/**
 * Details for SSE buffer overflow errors
 */
export interface SSEBufferOverflowErrorDetails {
  /** Client identifier */
  clientId?: string;

  /** Current buffer size when overflow occurred */
  currentSize: number;

  /** Maximum buffer size configured */
  maxSize: number;

  /** Number of events dropped */
  eventsDropped?: number;

  /** Buffer strategy that was applied */
  strategy: 'drop-oldest' | 'drop-newest' | 'close';

  /** Event that triggered the overflow */
  triggeringEvent?: string;
}

/**
 * Details for SSE stream closed errors
 */
export interface SSEStreamClosedErrorDetails {
  /** Client identifier */
  clientId?: string;

  /** When the stream was closed */
  closedAt?: string;

  /** Reason for closure */
  closeReason?: 'client-disconnect' | 'server-close' | 'timeout' | 'error' | 'buffer-overflow';

  /** Whether reconnection is possible */
  canReconnect?: boolean;

  /** Suggested retry interval in milliseconds */
  retryAfter?: number;
}

/**
 * Context for SSE connection errors
 */
export interface SSEConnectionErrorContext {
  /** The SSE endpoint URL */
  url: string;

  /** Correlation ID for tracing */
  correlationId: string;

  /** Connection state when error occurred */
  state: 'connecting' | 'connected' | 'disconnected' | 'closed';

  /** Number of reconnection attempts made */
  reconnectAttempts?: number;

  /** The original error if available */
  originalError?: Error;

  /** Additional SSE-specific details */
  sseDetails?: {
    /** Whether credentials were included */
    withCredentials?: boolean;

    /** Last received event ID */
    lastEventId?: string;

    /** EventSource ready state */
    readyState?: number;
  };
}

/**
 * Context for SSE stream errors (server-sent errors)
 */
export interface SSEStreamErrorContext {
  /** The SSE endpoint URL */
  url: string;

  /** Correlation ID from server or client */
  correlationId: string;

  /** Error message from server */
  message: string;

  /** Error code if provided */
  code?: string;

  /** Error name/type from server */
  name?: string;

  /** Raw error data from server */
  rawData?: any;
}

/**
 * Context for SSE heartbeat timeout errors
 */
export interface SSEHeartbeatErrorContext {
  /** The SSE endpoint URL */
  url: string;

  /** Correlation ID for tracing */
  correlationId: string;

  /** Configured heartbeat timeout in ms */
  heartbeatTimeout: number;

  /** Time since last event in ms */
  timeSinceLastEvent?: number;

  /** Last event ID received */
  lastEventId?: string;
}
