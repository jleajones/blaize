# BlaizeJS Error Module

A comprehensive error handling system that provides type-safe, structured error responses with automatic correlation tracking and consistent HTTP formatting across your BlaizeJS application.

## 🎯 Overview

The BlaizeJS error module provides semantic error classes that are automatically caught, formatted, and sent as proper HTTP responses. All errors include correlation IDs for request tracing and follow a consistent response structure.

```typescript
// Throw semantic errors - automatically becomes HTTP response
throw new NotFoundError('User not found', {
  resourceType: 'user',
  resourceId: params.userId
});
```

## 📦 Module Structure

```
packages/blaize-core/src/errors/
├── boundary.ts                 # Error formatting and boundary functions
├── boundary.test.ts           # Error boundary tests
├── correlation.ts              # Request tracing with AsyncLocalStorage
├── correlation.test.ts        # Correlation system tests
├── not-found-error.ts          # 404 errors
├── not-found-error.test.ts    # NotFoundError tests
├── validation-error.ts         # 400 validation errors  
├── validation-error.test.ts   # ValidationError tests
├── forbidden-error.ts          # 403 authorization errors
├── forbidden-error.test.ts    # ForbiddenError tests
├── conflict-error.ts           # 409 resource conflicts
├── conflict-error.test.ts     # ConflictError tests
├── unauthorized-error.ts       # 401 authentication errors
├── unauthorized-error.test.ts # UnauthorizedError tests
├── rate-limit-error.ts         # 429 rate limiting errors
├── rate-limit-error.test.ts   # RateLimitError tests
├── internal-server-error.ts    # 500 server errors
├── internal-server-error.test.ts # InternalServerError tests
└── integration.test.ts         # End-to-end error flow tests
```

## 🔧 Core Components

### 1. **Error Classes**
Semantic error classes that extend `BlaizeError` with rich context and automatic HTTP status codes.

### 2. **Correlation Tracking**
Automatic request tracing using Node.js AsyncLocalStorage that generates unique correlation IDs per request and propagates them across async operations.

### 3. **Error Boundary**
Global error boundary middleware that catches all thrown errors, converts them to proper HTTP responses, and preserves correlation IDs.

## 🚀 Quick Start

### Basic Usage

```typescript
import { NotFoundError, ValidationError } from 'blaizejs';

export const getUserRoute = createGetRoute({
  schema: {
    params: z.object({ userId: z.string().uuid() })
  },
  handler: async (ctx, params) => {
    const user = await findUser(params.userId);
    
    if (!user) {
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

## 📋 Error Classes Reference

### NotFoundError (404)

For resources that cannot be found.

```typescript
throw new NotFoundError('User not found', {
  resourceType: 'user',
  resourceId: params.userId,
  collection: 'users',
  suggestion: 'Check the user ID'
});
```

**Available Properties:**
- `resourceType`, `resourceId`, `collection`
- `query`, `searchCriteria`, `path`, `method`
- `parentResource` (for nested resources)
- `suggestion`, `attemptedPath`

### ValidationError (400)

For request validation failures. Automatically thrown by validation middleware.

```typescript
throw new ValidationError('Validation failed', {
  fields: [{
    field: 'email',
    messages: ['Email is required', 'Must be valid email'],
    rejectedValue: 'invalid-email',
    expectedType: 'email'
  }],
  errorCount: 1,
  section: 'body'
});
```

**Available Properties:**
- `fields` - Array of field-level errors with `field`, `messages`, `rejectedValue`, `expectedType`
- `errorCount` - Total number of validation errors
- `section` - Where validation failed (`'params'`, `'query'`, `'body'`, `'response'`)
- `schemaName` - Optional schema identifier

### ForbiddenError (403)

For authorization failures.

```typescript
throw new ForbiddenError('Access denied', {
  requiredPermission: 'admin:users:delete',
  userPermissions: ['admin:users:read'],
  resource: 'user-123',
  action: 'delete'
});
```

**Available Properties:**
- `requiredPermission`, `userPermissions`, `resource`, `action`
- `reason` - Reason for denial (`'insufficient_permissions'`, `'account_suspended'`, etc.)

### ConflictError (409)

For resource conflicts.

```typescript
throw new ConflictError('Email already exists', {
  conflictType: 'duplicate_key',
  field: 'email',
  existingValue: 'user@example.com',
  resolution: 'Use a different email address'
});
```

**Available Properties:**
- `conflictType` - Type of conflict (`'duplicate_key'`, `'version_mismatch'`, etc.)
- `field`, `existingValue`, `providedValue`, `conflictingResource`
- `currentVersion`, `expectedVersion`, `resolution`

### UnauthorizedError (401)

For authentication failures.

```typescript
throw new UnauthorizedError('Token expired', {
  reason: 'expired_token',
  authScheme: 'Bearer',
  loginUrl: '/auth/login'
});
```

**Available Properties:**
- `reason` - Authentication failure reason (`'missing_token'`, `'invalid_token'`, etc.)
- `authScheme`, `realm`, `error_description`
- `requiredScopes`, `loginUrl`

### RateLimitError (429)

For rate limiting violations.

```typescript
throw new RateLimitError('Rate limit exceeded', {
  limit: 100,
  remaining: 0,
  retryAfter: 3600,
  window: 'hour'
});
```

**Available Properties:**
- `limit`, `remaining`, `retryAfter`, `window`
- `resetTime`, `identifier`, `limitType`

### InternalServerError (500)

For unexpected server errors.

```typescript
throw new InternalServerError('Database error', {
  originalError: error.message,
  component: 'user-service',
  operation: 'createUser'
});
```

**Available Properties:**
- `originalError`, `stackTrace`, `component`, `operation`
- `internalErrorCode`, `timestamp`, `retryable`

## 🔄 Client-Side Error Handling

All errors are automatically transformed to `BlaizeError` instances on the client:

```typescript
try {
  const user = await client.$get.getUser({ params: { userId: 'invalid' } });
} catch (error: BlaizeError) {
  console.log(error.type);          // "NOT_FOUND"
  console.log(error.status);        // 404
  console.log(error.correlationId); // "req_abc123"
  
  if (error.details) {
    console.log(error.details.resourceType);  // Framework properties
    console.log(error.details.customProperty); // Custom properties (if route defines schema)
  }
}
```

## 🧪 Testing

```typescript
import { NotFoundError } from 'blaizejs';
import { formatErrorResponse } from '@blaize-core/errors/boundary';

describe('Error handling', () => {
  test('throws NotFoundError for invalid user', async () => {
    await expect(
      getUserHandler({ params: { userId: 'invalid' } })
    ).rejects.toThrow(NotFoundError);
  });
  
  test('formats error response correctly', () => {
    const error = new NotFoundError('User not found');
    const formatted = formatErrorResponse(error);
    
    expect(formatted.type).toBe('NOT_FOUND');
    expect(formatted.status).toBe(404);
  });
});
```

## 🔗 Integration Points

### Request Handler Integration
The request handler (`packages/blaize-core/src/server/request-handler.ts`) automatically:
- Creates an error boundary middleware as the first middleware in the chain
- Catches all thrown errors and converts them to HTTP responses
- Throws `NotFoundError` for unhandled routes
- Runs all middleware within the error boundary context

### Router Integration
- **Route Creation** (`packages/blaize-core/src/router/create.ts`): Validates route schemas and configurations
- **Validation Middleware** (`packages/blaize-core/src/router/validation/schema.ts`): Automatically throws `ValidationError` for schema violations in params, query, and body
- **Response Validation**: Throws `InternalServerError` for response schema violations

### Error Boundary Middleware
The error boundary (`packages/blaize-core/src/middleware/error-boundary.ts`):
- Catches all thrown `BlaizeError` instances and unexpected errors
- Formats errors into consistent HTTP responses
- Extracts/generates correlation IDs from request headers
- Sets correlation headers on error responses
- Handles cases where responses were already sent

### Context Integration  
- **Correlation IDs**: Extracted from `x-correlation-id` header or generated automatically
- **AsyncLocalStorage**: Maintains correlation context across the entire request lifecycle
- **Request Tracing**: All errors automatically include correlation IDs for debugging

## ⚙️ Custom Error Details

To get full type safety for custom error properties, define `errorResponseDetails` in your route schema:

```typescript
export const userRoute = createGetRoute({
  schema: {
    params: z.object({ userId: z.string() }),
    response: z.object({ user: UserSchema }),
    
    // Include framework properties + custom properties
    errorResponseDetails: z.object({
      ...NotFoundErrorDetailsSchema.shape,  // Framework properties
      searchHistory: z.array(z.string()).optional(), // Custom properties
      debugInfo: z.object({
        queryCount: z.number(),
        cacheHit: z.boolean()
      }).optional()
    })
  },
  
  handler: async (ctx, params) => {
    // Error details will be fully typed
  }
});
```

**Note:** If you don't define `errorResponseDetails`, framework properties are still typed but custom properties will be `unknown`.

## 📊 Error Response Format

All errors follow this HTTP response format:

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

## 💡 Best Practices

1. **Use semantic error classes** instead of manual response creation
2. **Include helpful context** in error details for better debugging
3. **Define `errorResponseDetails` schemas** when you need custom typed properties  
4. **Let the error boundary handle formatting** - just throw the errors
5. **Use correlation IDs** for tracing errors across distributed systems

---

**Built with ❤️ by the BlaizeJS team**