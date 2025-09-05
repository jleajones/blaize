# 🔍 BlaizeJS Tracing Module

> **Automatic correlation ID system for distributed request tracing with zero configuration**

## ✨ Overview

The BlaizeJS tracing module provides automatic correlation ID management for tracking requests across your entire application stack. Every request gets a unique identifier that flows through async operations, middleware, database calls, and external services—all without manual passing or configuration.

### 🎯 Key Features

- **🚀 Zero Configuration**: Works out of the box with sensible defaults
- **🔄 Automatic Propagation**: IDs flow through Promise chains, callbacks, and async/await
- **🌐 Protocol Support**: Full HTTP/1.1 and HTTP/2 support with streaming responses
- **⚡ AsyncLocalStorage Integration**: Context-aware without manual passing
- **🎨 Customizable**: Optional configuration for headers and ID generation

## 🚀 Quick Start

```typescript
import { createServer, getCorrelationId, createMiddleware } from 'blaizejs';

const server = createServer({
  port: 3000,
  // Correlation works automatically - no config needed!
});

// Access correlation ID anywhere in your request handlers
server.use(
  createMiddleware({
    name: 'logger',
    execute: async (ctx, next) => {
      const correlationId = getCorrelationId();
      console.log(`[${correlationId}] ${ctx.request.method} ${ctx.request.path}`);
      await next();
    },
  })
);

await server.listen();
```

## 📦 Installation

The tracing module is included in the core BlaizeJS package:

```bash
npm install blaizejs
```

## 🔧 Configuration

### Default Behavior

By default, BlaizeJS:

- Extracts correlation IDs from the `x-correlation-id` header
- Generates IDs in the format: `req_[timestamp]_[random]`
- Automatically includes IDs in all response headers

### Custom Configuration

```typescript
import { createServer } from 'blaizejs';

const server = createServer({
  correlation: {
    // Use a custom header name
    headerName: 'x-request-id',

    // Custom ID generator
    generator: () => `org_${Date.now()}_${crypto.randomUUID()}`,
  },
});
```

## 📚 API Reference

### `getCorrelationId()`

Returns the current request's correlation ID, or `'unknown'` if called outside a request context.

```typescript
import { getCorrelationId } from 'blaizejs';

// Inside any request handler or middleware
const correlationId = getCorrelationId();
console.log(`Processing request: ${correlationId}`);
```

**Returns:** `string` - The current correlation ID

## 💡 Usage Examples

### 📝 Logging Integration

Create a logger that automatically includes correlation IDs:

```typescript
import { getCorrelationId } from 'blaizejs';

class Logger {
  private log(level: string, message: string, data?: any) {
    const correlationId = getCorrelationId();
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        correlationId,
        level,
        message,
        ...data,
      })
    );
  }

  info(message: string, data?: any) {
    this.log('INFO', message, data);
  }

  error(message: string, error?: Error) {
    this.log('ERROR', message, {
      error: error?.message,
      stack: error?.stack,
    });
  }
}

const logger = new Logger();
// Use anywhere in request context - correlation ID is automatic!
logger.info('User authenticated', { userId: 123 });
```

### 🌐 External Service Calls

Pass correlation IDs to downstream services:

```typescript
import { getCorrelationId } from 'blaizejs';

async function callUserService(userId: string) {
  const correlationId = getCorrelationId();

  const response = await fetch(`https://api.example.com/users/${userId}`, {
    headers: {
      'x-correlation-id': correlationId,
      'content-type': 'application/json',
    },
  });

  return response.json();
}
```

### 📱 Client-Side Correlation with BlaizeJS Client

Track requests using the type-safe BlaizeJS client:

```typescript
// client/api.ts
import bc from '@blaizejs/client';
import { routes } from '../server/routes'; // Your server route exports

// Create client with custom headers including correlation ID
const api = bc.create(
  {
    baseUrl: 'http://localhost:3000',
    defaultHeaders: {
      'x-correlation-id': `client_${Date.now()}_${crypto.randomUUID()}`,
    },
  },
  routes
);

// All requests will include the correlation ID
const users = await api.$get.getUsers();
// Server response includes same correlation ID in headers
```

```typescript
// Advanced: Per-request correlation IDs
import bc from '@blaizejs/client';
import { routes } from '../server/routes';

const api = bc.create('http://localhost:3000', routes);

// Generate unique correlation ID for each user action
async function fetchUserData(userId: string) {
  const correlationId = `fetch_user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    // Pass correlation ID with specific request
    const user = await api.$get.getUser({
      params: { userId },
      headers: {
        'x-correlation-id': correlationId,
      },
    });

    console.log(`Request completed: ${correlationId}`);
    return user;
  } catch (error) {
    // BlaizeError includes correlation ID from server
    console.error(`Request failed: ${error.correlationId}`);
    throw error;
  }
}
```

```typescript
// Browser: Track user sessions
const sessionId = crypto.randomUUID().split('-')[0];
let requestCounter = 0;

function generateCorrelationId(action: string): string {
  requestCounter++;
  return `browser_${sessionId}_${action}_${requestCounter}`;
}

// Use for different user actions
await api.$post.createUser({
  body: { name: 'John', email: 'john@example.com' },
  headers: {
    'x-correlation-id': generateCorrelationId('create_user'),
  },
});

await api.$get.listPosts({
  query: { page: 1 },
  headers: {
    'x-correlation-id': generateCorrelationId('list_posts'),
  },
});
```

### 🗄️ Database Operations

Include correlation IDs in database query logging:

```typescript
import { getCorrelationId } from 'blaizejs';

class DatabaseClient {
  async query(sql: string, params: any[]) {
    const correlationId = getCorrelationId();
    const startTime = Date.now();

    try {
      const result = await this.pool.query(sql, params);

      console.log({
        correlationId,
        query: sql,
        duration: Date.now() - startTime,
        rows: result.rowCount,
      });

      return result;
    } catch (error) {
      console.error({
        correlationId,
        query: sql,
        error: error.message,
      });
      throw error;
    }
  }
}
```

### ⚠️ Error Handling

Correlation IDs are automatically included in error responses:

```typescript
import { createMiddleware, ValidationError, getCorrelationId } from 'blaizejs';

const errorHandler = createMiddleware({
  name: 'error-handler',
  execute: async (ctx, next) => {
    try {
      await next();
    } catch (error) {
      const correlationId = getCorrelationId();

      // Log with correlation for debugging
      console.error(`[${correlationId}] Error:`, error);

      // BlaizeJS automatically includes correlation ID in error responses
      // Response will have x-correlation-id header and include it in body
      throw error;
    }
  },
});
```

### 🔀 Middleware Integration

Use correlation IDs in any middleware:

```typescript
import { createMiddleware, getCorrelationId } from 'blaizejs';

export const auditMiddleware = createMiddleware({
  name: 'audit',
  execute: async (ctx, next) => {
    const correlationId = getCorrelationId();
    const start = Date.now();

    // Log request
    await auditLog.write({
      correlationId,
      event: 'request_start',
      method: ctx.request.method,
      path: ctx.request.path,
      timestamp: new Date().toISOString(),
    });

    await next();

    // Log response
    await auditLog.write({
      correlationId,
      event: 'request_complete',
      duration: Date.now() - start,
      status: ctx.response.raw.statusCode,
    });
  },
});
```

## 🎯 Best Practices

### ✅ DO

- **Use structured logging** with correlation IDs as a field
- **Pass to external services** using the same header name
- **Include in error reports** for easier debugging
- **Filter logs by correlation ID** to trace entire request flows

### ❌ DON'T

- Don't manually pass correlation IDs between functions (AsyncLocalStorage handles it)
- Don't generate IDs manually inside request handlers (use the configured generator)
- Don't access `getCorrelationId()` outside request context (it will return 'unknown')

## 🔬 How It Works

1. **Request arrives** → BlaizeJS extracts or generates a correlation ID
2. **AsyncLocalStorage context** → ID stored in request-scoped storage
3. **Automatic propagation** → Available throughout the request lifecycle
4. **Response sent** → ID included in response headers automatically

### ID Format

Default correlation IDs follow the pattern: `req_[timestamp]_[random]`

- `req` - Prefix indicating request origin
- `timestamp` - Base36 encoded timestamp for ordering
- `random` - Base36 random string for uniqueness

Example: `req_lk3x2m1_9z8y7w6v`

### Performance

- **Overhead**: < 0.5ms per request
- **Memory**: ~100 bytes per active request
- **No impact** on response streaming
- **Efficient** AsyncLocalStorage usage

## 🧪 Testing

### Unit Tests

```typescript
import { describe, it, expect, vi } from 'vitest';
import { getCorrelationId } from 'blaizejs';

describe('My Service', () => {
  it('should log with correlation ID', async () => {
    // Mock getCorrelationId for predictable tests
    vi.mocked(getCorrelationId).mockReturnValue('test_correlation_123');

    const result = await myService.process();

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        correlationId: 'test_correlation_123',
      })
    );
  });
});
```

### Integration Tests

```typescript
import { test } from '@blaizejs/testing-utils';

test('should propagate correlation ID', async ({ client }) => {
  const response = await client.get('/api/users', {
    headers: {
      'x-correlation-id': 'test_123',
    },
  });

  // Verify correlation ID in response
  expect(response.headers['x-correlation-id']).toBe('test_123');
});
```

## 🐛 Troubleshooting

### Correlation ID shows as 'unknown'

This happens when `getCorrelationId()` is called outside a request context. Ensure you're calling it within:

- Request handlers
- Middleware
- Functions called from handlers/middleware

### Custom header not working

Verify your server configuration:

```typescript
const server = createServer({
  correlation: {
    headerName: 'x-request-id', // Must be lowercase
  },
});
```

### Missing in responses

Ensure you're using BlaizeJS response methods (`ctx.response.json()`, etc.) which automatically include correlation headers.

## 🔄 Version History

- **v0.4.0** - Initial release with automatic correlation ID support
- **v0.3.x** - No correlation support (upgrade recommended)

## 📋 Requirements

- Node.js 18.0+ (AsyncLocalStorage support)
- BlaizeJS v0.4.0+

## 🔗 Related

- [Middleware Guide](../guides/middleware.md) - Using correlation in middleware
- [Error Handling](../guides/error-handling.md) - Correlation in error responses
- [Production Guide](../guides/production.md) - Distributed tracing setup
