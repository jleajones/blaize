# 🚨 BlaizeJS Error Handling Module

> **Type-safe, semantic error handling with automatic HTTP response formatting and request correlation tracking**

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Module Structure](#-module-structure)
- [Quick Start](#-quick-start)
- [Error Classes](#-error-classes)
- [Error Boundary System](#-error-boundary-system)
- [Correlation Tracking](#-correlation-tracking)
- [Client-Side Integration](#-client-side-integration)
- [Testing](#-testing)
- [Best Practices](#-best-practices)
- [Advanced Usage](#-advanced-usage)
- [Roadmap](#-roadmap)
- [Contributing](#-contributing)

## 🎯 Overview

The BlaizeJS error module provides a comprehensive error handling system that automatically catches, formats, and sends structured error responses. Every error includes correlation IDs for distributed tracing and follows a consistent, type-safe structure across your entire application stack.

```typescript
// Throw semantic errors that automatically become proper HTTP responses
throw new NotFoundError('User not found', {
  resourceType: 'user',
  resourceId: params.userId,
  suggestion: 'Please verify the user ID exists'
});

// Response automatically formatted as:
// HTTP 404
// {
//   "type": "NOT_FOUND",
//   "title": "User not found",
//   "status": 404,
//   "correlationId": "req_k3x2m1_9z8y7w6v",
//   "timestamp": "2024-01-15T10:30:00.000Z",
//   "details": { ... }
// }
```

## ✨ Features

- 🏷️ **Semantic Error Classes** - Express intent with `NotFoundError`, `ValidationError`, `ForbiddenError`, etc.
- 🔍 **Automatic Correlation Tracking** - Every error includes a correlation ID for request tracing
- 🛡️ **Global Error Boundary** - Catches all errors and converts them to proper HTTP responses
- 📝 **Rich Error Details** - Attach context-specific information to each error type
- 🔄 **AsyncLocalStorage Integration** - Correlation IDs flow through async operations automatically
- 🧪 **Comprehensive Testing** - Full test coverage with unit and integration tests
- 🌐 **Client-Side Support** - Errors are automatically reconstructed on the client with full type safety
- 📊 **Consistent Format** - All errors follow the same response structure

## 📦 Module Structure

```
packages/blaize-core/src/errors/
├── 🎯 Core Error Classes
│   ├── not-found-error.ts          # 404 - Resource not found
│   ├── validation-error.ts         # 400 - Request validation failed
│   ├── unauthorized-error.ts       # 401 - Authentication required
│   ├── forbidden-error.ts          # 403 - Authorization failed
│   ├── conflict-error.ts           # 409 - Resource conflict
│   ├── rate-limit-error.ts         # 429 - Rate limit exceeded
│   └── internal-server-error.ts    # 500 - Unexpected server error
│
├── 🔧 Infrastructure
│   ├── boundary.ts                 # Error formatting and response generation
│   ├── correlation.ts              # Request tracing with AsyncLocalStorage
│   └── index.ts                    # Module exports
│
└── 🧪 Tests
    ├── *.test.ts                   # Unit tests for each error class
    ├── boundary.test.ts            # Error boundary tests
    ├── correlation.test.ts        # Correlation system tests
    └── integration.test.ts        # End-to-end error flow tests
```

## 🚀 Quick Start

### Basic Usage

```typescript
import { 
  NotFoundError, 
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  RateLimitError,
  InternalServerError,
  PayloadTooLargeError,
  UnsupportedMediaTypeError,
  RequestTimeoutError,
  UnprocessableEntityError
} from 'blaizejs';

export const getUserRoute = createGetRoute({
  schema: {
    params: z.object({ userId: z.string().uuid() })
  },
  handler: async (ctx, params) => {
    const user = await findUser(params.userId);
    
    if (!user) {
      // This error is automatically caught and formatted as HTTP response
      throw new NotFoundError('User not found', {
        resourceType: 'user',
        resourceId: params.userId,
        suggestion: 'Please verify the user ID exists'
      });
    }
    
    return { user };
  }
});
```

### With Custom Error Handling

```typescript
export const createUserRoute = createPostRoute({
  handler: async (ctx, body) => {
    try {
      const user = await createUser(body);
      return { user };
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ConflictError('Email already exists', {
          conflictType: 'duplicate_key',
          field: 'email',
          existingValue: body.email,
          resolution: 'Use a different email address'
        });
      }
      
      // Unexpected errors are caught by error boundary
      throw error;
    }
  }
});
```

## 📚 Error Classes

### Core HTTP Errors (4xx/5xx)

#### 🔍 NotFoundError (404)

Used when a requested resource cannot be found.

```typescript
throw new NotFoundError('User not found', {
  resourceType: 'user',
  resourceId: params.userId,
  collection: 'users',
  query: { email: params.email },
  searchCriteria: { active: true },
  path: request.path,
  method: 'GET',
  parentResource: {
    type: 'organization',
    id: 'org-123'
  },
  suggestion: 'Check the user ID or try searching by email'
});
```

#### ❌ ValidationError (400)

Automatically thrown by validation middleware or manually for custom validation.

```typescript
throw new ValidationError('Validation failed', {
  fields: [{
    field: 'email',
    messages: ['Email is required', 'Must be a valid email address'],
    rejectedValue: 'not-an-email',
    expectedType: 'email'
  }],
  errorCount: 1,
  section: 'body',
  schemaName: 'CreateUserSchema'
});
```

#### 🔒 UnauthorizedError (401)

For authentication failures.

```typescript
throw new UnauthorizedError('Token expired', {
  reason: 'expired_token',
  authScheme: 'Bearer',
  realm: 'api',
  error_description: 'The access token expired at 2024-01-15T10:00:00Z',
  requiredScopes: ['read:users', 'write:users'],
  loginUrl: '/auth/login'
});
```

#### 🚫 ForbiddenError (403)

For authorization failures.

```typescript
throw new ForbiddenError('Access denied', {
  requiredPermission: 'admin:users:delete',
  userPermissions: ['admin:users:read', 'admin:users:write'],
  resource: 'user-123',
  action: 'delete',
  reason: 'insufficient_permissions'
});
```

#### 💥 ConflictError (409)

For resource conflicts and concurrency issues.

```typescript
throw new ConflictError('Resource conflict', {
  conflictType: 'version_mismatch',
  field: 'version',
  existingValue: 'v2',
  providedValue: 'v1',
  conflictingResource: 'document-456',
  currentVersion: '2.0.0',
  expectedVersion: '1.0.0',
  resolution: 'Refresh the resource and retry with the latest version'
});
```

#### ⏱️ RateLimitError (429)

For rate limiting violations.

```typescript
throw new RateLimitError('Rate limit exceeded', {
  limit: 100,
  remaining: 0,
  resetTime: new Date('2024-01-15T11:00:00Z'),
  retryAfter: 3600,
  window: 'hour',
  identifier: 'user-123',
  limitType: 'per_user'
});
```

#### 💔 InternalServerError (500)

For unexpected server errors.

```typescript
throw new InternalServerError('Database connection failed', {
  originalError: error.message,
  stackTrace: error.stack,
  component: 'database-service',
  operation: 'user-lookup',
  internalErrorCode: 'DB_CONN_001',
  timestamp: new Date(),
  retryable: true
});
```

### Additional HTTP Error Classes

The framework includes these specialized error classes for more granular error handling:

#### 📦 PayloadTooLargeError (413)

For requests exceeding size limits.

```typescript
throw new PayloadTooLargeError('File too large', {
  fileCount: 11,
  maxFiles: 10,
  filename: 'huge-video.mp4',
  currentSize: 104857600,  // 100MB
  maxSize: 52428800        // 50MB
});
```

#### 📄 UnsupportedMediaTypeError (415)

For unsupported content types.

```typescript
throw new UnsupportedMediaTypeError('File type not allowed', {
  receivedMimeType: 'application/x-executable',
  allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf'],
  filename: 'virus.exe'
});
```

#### ⏰ RequestTimeoutError (408)

For request timeouts (different from client-side timeout).

```typescript
throw new RequestTimeoutError('Upload timeout', {
  timeoutMs: 30000,
  elapsedMs: 31000,
  operation: 'file-upload'
});
```

#### ⚠️ UnprocessableEntityError (422)

For semantically invalid requests (valid format, invalid content).

```typescript
throw new UnprocessableEntityError('Business rule violation', {
  rule: 'minimum_order_amount',
  currentValue: 5.00,
  requiredValue: 10.00,
  message: 'Order total must be at least $10.00'
});
```

### Status Code Reference

| Error Class | HTTP Status | Use Case |
|------------|-------------|----------|
| `ValidationError` | 400 | Invalid request format/parameters |
| `UnauthorizedError` | 401 | Missing or invalid authentication |
| `ForbiddenError` | 403 | Authenticated but not authorized |
| `NotFoundError` | 404 | Resource doesn't exist |
| `RequestTimeoutError` | 408 | Request took too long |
| `ConflictError` | 409 | Resource state conflict |
| `PayloadTooLargeError` | 413 | Request body too large |
| `UnsupportedMediaTypeError` | 415 | Wrong content type |
| `UnprocessableEntityError` | 422 | Valid format, invalid semantics |
| `RateLimitError` | 429 | Too many requests |
| `InternalServerError` | 500 | Unexpected server error |

## 🛡️ Error Boundary System

The error boundary automatically catches all errors and formats them as HTTP responses:

```typescript
// Automatically added to every request
const errorBoundary = createErrorBoundaryMiddleware();

// Catches and formats all errors
try {
  await handler(ctx);
} catch (error) {
  const response = formatErrorResponse(error);
  ctx.response.status(response.status);
  ctx.response.json(response);
}
```

### Response Format

All errors follow this consistent structure:

```json
{
  "type": "NOT_FOUND",
  "title": "User not found",
  "status": 404,
  "correlationId": "req_k3x2m1_9z8y7w6v",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "details": {
    "resourceType": "user",
    "resourceId": "user-123",
    "suggestion": "Please verify the user ID exists"
  }
}
```

## 🔍 Correlation Tracking

Every request gets a unique correlation ID that flows through all operations:

```typescript
// Correlation ID is automatically extracted or generated
const correlationId = getCorrelationId(request);

// Available anywhere in the request lifecycle
const currentId = getCurrentCorrelationId();

// Included in all error responses
throw new NotFoundError('Not found'); // Automatically includes correlation ID
```

### How It Works

1. **Extraction**: Correlation ID from `x-correlation-id` header or generated
2. **Storage**: Stored in AsyncLocalStorage for the request lifecycle
3. **Propagation**: Automatically flows through async operations
4. **Response**: Added to error responses as `x-correlation-id` header

## 🌐 Client-Side Integration

The BlaizeJS client automatically handles all error transformations, ensuring every error you catch is a `BlaizeError` instance. This includes server errors, network failures, timeouts, and parsing errors.

### Server Error Handling

When the server returns an error response, it's automatically transformed:

```typescript
import { createClient } from '@blaize/client';

const api = createClient('https://api.example.com', routes);

try {
  const user = await api.$get.getUser({ params: { userId: 'invalid' } });
} catch (error) {
  // error is ALWAYS a BlaizeError - no type guards needed!
  console.log(error.type);          // "NOT_FOUND"
  console.log(error.status);        // 404
  console.log(error.correlationId); // "req_abc123" (from server)
  
  if (error.type === ErrorType.NOT_FOUND && error.details) {
    console.log(error.details.resourceType);  // "user"
    console.log(error.details.suggestion);    // "Please verify..."
  }
}
```

### Client-Side Error Types

The client also generates its own error types for network and parsing failures:

```typescript
try {
  const data = await api.$get.getData();
} catch (error) {
  // All client errors have status: 0 (no HTTP status)
  switch (error.type) {
    case ErrorType.NETWORK_ERROR:
      // Connection failed, DNS issues, etc.
      console.log(error.details?.networkDetails?.isDnsFailure);
      break;
      
    case ErrorType.TIMEOUT_ERROR:
      // Request took too long
      console.log(error.details?.timeoutMs);
      console.log(error.details?.elapsedMs);
      break;
      
    case ErrorType.PARSE_ERROR:
      // Response couldn't be parsed (e.g., HTML instead of JSON)
      console.log(error.details?.expectedFormat);  // "json"
      console.log(error.details?.contentType);      // "text/html"
      break;
  }
}
```

For complete details on client-side error handling, see the [BlaizeJS Client Error Handling documentation](../../../blaize-client/README.md#error-handling).
```

## 🧪 Testing

### Unit Testing

```typescript
import { NotFoundError } from 'blaizejs';
import { describe, test, expect } from 'vitest';

describe('User Handler', () => {
  test('throws NotFoundError for invalid user', async () => {
    await expect(
      getUserHandler({ params: { userId: 'invalid' } })
    ).rejects.toThrow(NotFoundError);
  });
  
  test('includes proper error details', async () => {
    try {
      await getUserHandler({ params: { userId: 'invalid' } });
    } catch (error) {
      expect(error).toBeInstanceOf(NotFoundError);
      expect(error.details?.resourceType).toBe('user');
      expect(error.details?.resourceId).toBe('invalid');
    }
  });
});
```

### Integration Testing

```typescript
import { formatErrorResponse } from '@blaize-core/errors/boundary';

test('formats error response correctly', () => {
  const error = new NotFoundError('User not found', {
    resourceType: 'user',
    resourceId: '123'
  });
  
  const response = formatErrorResponse(error);
  
  expect(response).toEqual({
    type: 'NOT_FOUND',
    title: 'User not found',
    status: 404,
    correlationId: expect.any(String),
    timestamp: expect.any(String),
    details: {
      resourceType: 'user',
      resourceId: '123'
    }
  });
});
```

## 💡 Best Practices

### 1. Use Semantic Errors

```typescript
// ✅ Good - Clear intent
throw new NotFoundError('User not found', { resourceType: 'user' });

// ❌ Bad - Generic error
throw new Error('User not found');
```

### 2. Provide Rich Context

```typescript
// ✅ Good - Helpful context
throw new ConflictError('Email already exists', {
  field: 'email',
  existingValue: email,
  resolution: 'Use a different email address'
});

// ❌ Bad - No context
throw new ConflictError('Conflict');
```

### 3. Let Errors Bubble

```typescript
// ✅ Good - Let error boundary handle it
const user = await findUser(id);
if (!user) {
  throw new NotFoundError('User not found');
}

// ❌ Bad - Manual error handling
try {
  const user = await findUser(id);
  if (!user) {
    ctx.response.status(404);
    ctx.response.json({ error: 'Not found' });
  }
} catch (error) {
  // Manual handling
}
```

### 4. Use Type-Safe Error Details

```typescript
// Define error details in route schema
export const userRoute = createGetRoute({
  schema: {
    errorResponseDetails: z.object({
      resourceType: z.string(),
      resourceId: z.string(),
      customField: z.string().optional()
    })
  },
  handler: async (ctx, params) => {
    // Error details are now typed
    throw new NotFoundError('Not found', {
      resourceType: 'user',
      resourceId: params.id,
      customField: 'value' // Type-safe!
    });
  }
});
```

## 🔧 Advanced Usage

### Custom Error Classes (Framework Internal)

> **⚠️ Important**: The `BlaizeError` base class has a `protected` constructor, meaning **you cannot create custom error classes in your application code**. Custom error classes must be added to the BlaizeJS framework itself.

If you need a custom error type for your application, you have these options:

#### Option 1: Use Existing Error Classes with Custom Details

```typescript
// Use the most appropriate existing error class
throw new ConflictError('Payment failed', {
  conflictType: 'payment_failure',  // Custom type
  field: 'payment',
  providedValue: {
    method: 'credit_card',
    amount: 99.99,
    currency: 'USD'
  },
  resolution: 'Please try a different payment method',
  // Add any custom fields - they're preserved
  paymentGateway: 'stripe',
  failureCode: 'insufficient_funds',
  attemptId: 'pay_attempt_123'
});
```

#### Option 2: Use UnprocessableEntityError for Business Logic

```typescript
// For complex business logic failures, use 422 Unprocessable Entity
throw new UnprocessableEntityError('Payment processing failed', {
  paymentMethod: 'credit_card',
  amount: 99.99,
  currency: 'USD',
  failureCode: 'insufficient_funds',
  gateway: 'stripe',
  attemptId: 'pay_attempt_123'
});
```

#### Option 3: Contribute to BlaizeJS

If you need a truly custom error type, consider contributing to the framework:

```typescript
// This would be added to packages/blaize-core/src/errors/
// NOT in your application code

import { BlaizeError, ErrorType } from '@blaize-types/errors';
import { getCurrentCorrelationId } from './correlation';

export class PaymentError extends BlaizeError<PaymentErrorDetails> {
  constructor(
    message: string,
    details?: PaymentErrorDetails
  ) {
    super(
      ErrorType.PAYMENT_FAILED,  // Would need to add to ErrorType enum
      message,
      402,  // Payment Required
      getCurrentCorrelationId(),
      details
    );
  }
}
```

### Error Transformation

```typescript
export const paymentRoute = createPostRoute({
  handler: async (ctx, body) => {
    try {
      return await processPayment(body);
    } catch (error) {
      // Transform third-party errors
      if (isStripeError(error)) {
        throw new PaymentError('Payment failed', {
          paymentMethod: body.method,
          amount: body.amount,
          currency: body.currency,
          failureCode: error.code
        });
      }
      throw error;
    }
  }
});
```

### Conditional Error Details

```typescript
const isDevelopment = process.env.NODE_ENV === 'development';

throw new InternalServerError('Database error', {
  // Always include basic info
  component: 'database',
  operation: 'user-lookup',
  
  // Only include sensitive info in development
  ...(isDevelopment && {
    stackTrace: error.stack,
    query: sql,
    connectionString: dbUrl
  })
});
```

## 🗺️ Roadmap

### 🚀 Current Beta (v0.3.1)
- ✅ Complete error class hierarchy with 11 HTTP status codes
- ✅ AsyncLocalStorage correlation tracking  
- ✅ Global error boundary with automatic error formatting
- ✅ Client-side error reconstruction and transformation
- ✅ Comprehensive test coverage (>95%)
- ✅ Upload and validation specific errors (413, 415, 408, 422)

### 🎯 MVP/1.0 Release
- 🔄 **Custom Error API** - Simple factory function for creating custom errors:
  ```typescript
  export const PaymentError = createErrorClass({
    name: 'PaymentError',
    status: 402,
    type: 'PAYMENT_ERROR',
    defaultMessage: 'Payment processing failed'
  });
  ```
- 🔄 **Error Metrics** - Built-in error tracking and observability:
  ```typescript
  // Automatic metrics collection
  server.on('error', (error, context) => {
    // Error type, status, rate tracking
    // Integration points for DataDog, Prometheus, etc.
  });
  ```
- 🔄 **Missing Core Status Codes**:
  - `MethodNotAllowedError` (405) - Invalid HTTP method
  - `BadGatewayError` (502) - Upstream service failure
  - `ServiceUnavailableError` (503) - Service temporarily down
  - `GatewayTimeoutError` (504) - Upstream timeout
- 🔄 **Context Helpers** - Utilities for enriching errors:
  ```typescript
  import { getErrorContext } from 'blaizejs';
  
  throw new ForbiddenError('Access denied', {
    ...getErrorContext(), // Adds user, request, session info
    resource: 'admin-panel'
  });
  ```
- 🔄 **Simple Retry Hints** - Basic retry information for errors:
  ```typescript
  throw new InternalServerError('Temporary failure', {
    retryable: true,
    retryAfter: 5000, // ms
    maxRetries: 3
  });
  ```

### 🚀 Fast Follow (v1.1)
- 🔄 **Retry Strategies** - Automatic retry with exponential backoff, jitter, and circuit breakers
- 🔄 **Error Recovery Middleware** - Pluggable recovery strategies per error type
- 🔄 **Error Reporting Integrations** - Sentry, Rollbar, Bugsnag adapters
- 🔄 **Enhanced Metrics** - Percentiles, error budgets, SLO tracking
- 🔄 **Error Recovery Middleware** - Pluggable recovery strategies per error type
- 🔄 **Distributed Tracing** - OpenTelemetry integration for microservices
- 🔄 **Error Reporting Integrations** - Sentry, Rollbar, Bugsnag adapters
- 🔄 **Enhanced Status Codes** - Additional specialized codes:
  - 406 Not Acceptable
  - 410 Gone  
  - 418 I'm a teapot (IoT)
  - 423 Locked
  - 424 Failed Dependency
  - 428 Precondition Required
  - 451 Unavailable For Legal Reasons
  - 507 Insufficient Storage
- 🔄 **Semantic Error Subtypes** - More specific error categories:
  ```typescript
  class DuplicateKeyError extends ConflictError { }
  class OptimisticLockError extends ConflictError { }
  class ResourceLockedError extends ConflictError { }
  ```

## 🤝 Contributing

Contributions are welcome! When adding new error classes:

1. Extend `BlaizeError` with appropriate type parameters
2. Use semantic HTTP status codes
3. Include comprehensive JSDoc documentation
4. Add unit tests with >90% coverage
5. Update this README with examples

### Adding a New Error Class

```typescript
// 1. Define the error details interface
export interface MyErrorDetails {
  customField: string;
  // ... other fields
}

// 2. Create the error class
export class MyError extends BlaizeError<MyErrorDetails> {
  constructor(
    message: string,
    details?: MyErrorDetails
  ) {
    super(
      ErrorType.MY_ERROR, // Add to ErrorType enum
      message,
      499, // Appropriate HTTP status
      getCurrentCorrelationId(),
      details
    );
  }
}

// 3. Add tests
describe('MyError', () => {
  test('creates error with correct properties', () => {
    const error = new MyError('Test message', {
      customField: 'value'
    });
    
    expect(error.type).toBe(ErrorType.MY_ERROR);
    expect(error.status).toBe(499);
    expect(error.details?.customField).toBe('value');
  });
});
```

---

**Built with ❤️ by the BlaizeJS team**

For questions or issues, please [open an issue](https://github.com/blaizejs/blaize/issues) on GitHub.