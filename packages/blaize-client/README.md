# 🔥 BlaizeJS Client

> **Type-safe, universal HTTP client** for BlaizeJS APIs with automatic route inference, end-to-end type safety, and zero configuration

[![npm version](https://badge.fury.io/js/%40blaizejs%2Fclient.svg)](https://badge.fury.io/js/%40blaizejs%2Fclient)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

## 📋 Table of Contents

- [🌟 Features](#-features)
- [📦 Installation](#-installation)
- [🚀 Quick Start](#-quick-start)
- [📖 Core API](#-core-api)
- [🛡️ Error Handling](#️-error-handling)
- [🎯 API Reference](#-api-reference)
- [💡 Common Patterns](#-common-patterns)
- [🧪 Testing](#-testing)
- [📚 Type System](#-type-system)
- [🗺️ Roadmap](#️-roadmap)
- [🤝 Contributing](#-contributing)

## 🌟 Features

- 🔒 **End-to-End Type Safety** - Automatically inferred types from your BlaizeJS server routes
- 🌍 **Universal Runtime** - Works in browsers, Node.js 18+, serverless, and edge environments
- ⚡ **Zero Configuration** - Auto-generates client methods from your route definitions
- 🎯 **Intelligent URL Construction** - Automatic path parameter replacement and query string handling
- 🛡️ **Built-in Error Handling** - Proper error classification for network, HTTP, and application errors
- 🚀 **Modern Standards** - Uses native fetch API with HTTP/2 support
- 📊 **TypeScript First** - Designed for TypeScript with full IntelliSense support
- 🔄 **Lightweight** - Minimal runtime overhead with proxy-based implementation

## 📦 Installation

```bash
# Using pnpm (recommended)
pnpm add @blaizejs/client

# Using npm
npm install @blaizejs/client

# Using yarn
yarn add @blaizejs/client
```

## 🚀 Quick Start

### Server Setup

First, create your BlaizeJS server with typed routes:

```typescript
// server/routes.ts
import { createGetRoute, createPostRoute } from 'blaizejs';
import { z } from 'zod';

// GET /users/:userId
export const getUser = createGetRoute({
  schema: {
    params: z.object({
      userId: z.string().uuid(),
    }),
    query: z.object({
      include: z.string().optional(),
    }),
    response: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
    }),
  },
  handler: async (ctx, params) => {
    const user = await db.users.findById(params.userId);
    return user;
  },
});

// POST /users
export const createUser = createPostRoute({
  schema: {
    body: z.object({
      name: z.string().min(1),
      email: z.string().email(),
    }),
    response: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
    }),
  },
  handler: async ctx => {
    const newUser = await db.users.create(ctx.body);
    return newUser;
  },
});

// Export your routes registry
export const routes = {
  getUser,
  createUser,
} as const;
```

### Client Usage

```typescript
// client/api.ts
import bc from '@blaizejs/client';

// Import your server routes
import { routes } from '../server/routes';

// Create type-safe client - TypeScript automatically infers all types!
const client = bc.create('https://api.example.com', routes);

// Use with full type safety and autocompletion
async function example() {
  // GET request with path parameters and query
  const user = await client.$get.getUser({
    params: { userId: '123' }, // ✅ Typed - userId: string
    query: { include: 'profile' }, // ✅ Typed - include?: string
  });

  console.log(user.name); // ✅ Typed - user.name: string
  console.log(user.age); // ❌ TypeScript error - age doesn't exist

  // POST request with body
  const newUser = await client.$post.createUser({
    body: {
      name: 'John Doe', // ✅ Typed - name: string
      email: 'john@example.com', // ✅ Typed - email: string (validated)
    },
  });

  return newUser; // ✅ Typed return value
}
```

## 📖 Core API

### Default Export _(Available)_

The client package uses a default export pattern:

```typescript
import bc from '@blaizejs/client';

// Access client features
const client = bc.create(config, routes); // Create client
console.log(bc.version); // Get version
```

### Creating Clients

The main API for creating clients is through the default export:

```typescript
import bc from '@blaizejs/client';

// Simple configuration
const client = bc.create('https://api.example.com', routes);

// Advanced configuration
const client = bc.create(
  {
    baseUrl: 'https://api.example.com',
    timeout: 10000,
    defaultHeaders: {
      Authorization: 'Bearer token',
      'X-API-Key': 'secret',
    },
  },
  routes
);
```

### Client Method Structure

The client organizes methods by HTTP verb using the `$method` pattern:

```typescript
// Available client methods
client.$get.routeName(); // GET requests
client.$post.routeName(); // POST requests
client.$put.routeName(); // PUT requests
client.$delete.routeName(); // DELETE requests
client.$patch.routeName(); // PATCH requests
client.$head.routeName(); // HEAD requests
client.$options.routeName(); // OPTIONS requests
```

### Request Arguments

```typescript
interface RequestArgs {
  params?: Record<string, string>; // URL path parameters
  query?: Record<string, any>; // Query string parameters
  body?: unknown; // Request body (POST/PUT/PATCH)
}

// Usage examples
await client.$get.getUser({
  params: { userId: '123' }, // Replaces :userId in path
  query: { include: 'profile' }, // Adds ?include=profile
});

await client.$post.createUser({
  body: { name: 'John', email: 'john@example.com' },
});
```

## 🛡️ Error Handling

### Error Classification System

**⚠️ Note**: Error classes are used internally for error transformation. Client errors are automatically transformed to BlaizeError instances.

The client internally uses several error classes to classify failures:

- **NetworkError** - Connection failures, DNS issues, network timeouts _(internal)_
- **TimeoutError** - Request timeout exceeded _(internal)_
- **ParseError** - Response parsing failures _(internal)_
- **BlaizeError** - Server-side errors with status codes _(thrown to client)_

### Handling Errors

All errors thrown to your application are BlaizeError instances:

```typescript
import bc from '@blaizejs/client';
import { BlaizeError } from 'blaizejs'; // Import from core package

try {
  const user = await client.$get.getUser({ params: { userId: '123' } });
} catch (error) {
  if (error instanceof BlaizeError) {
    // All client errors are transformed to BlaizeError
    console.log(`Error ${error.status}: ${error.title}`);
    console.log(`Correlation ID: ${error.correlationId}`);
    console.log(`Details:`, error.details);

    // Check specific error types
    if (error.status === 404) {
      console.log('User not found');
    } else if (error.status === 0) {
      // Client-side errors (network, timeout, parse)
      console.log('Client-side error occurred');
    }
  }
}
```

### Error Response Format

All errors follow a consistent format:

```typescript
{
  type: 'NETWORK_ERROR',               // Error type enum
  title: 'Network request failed',     // Human-readable message
  status: 0,                           // HTTP status (0 for client errors)
  correlationId: 'client_k3x2m1_9z8',  // Tracking ID
  timestamp: '2024-01-15T10:30:00Z',   // When error occurred
  details: {                           // Error-specific details
    url: 'https://api.example.com',
    method: 'GET',
    originalError: Error
  }
}
```

## 🎯 API Reference

### Exported Functions

| Function                    | Description                      |
| --------------------------- | -------------------------------- |
| **Default Export**          |                                  |
| `bc.create(config, routes)` | Create type-safe client instance |
| `bc.version`                | Get client package version       |

### Configuration Types

```typescript
interface ClientConfig {
  baseUrl: string; // API base URL
  defaultHeaders?: Record<string, string>; // Headers for all requests
  timeout?: number; // Request timeout in ms (default: 5000)
}
```

### Internal Types _(Not Exported)_

The following types are used internally but not exported:

- ❌ `CreateClient` - Client creation type (inferred automatically)
- ❌ `BuildRoutesRegistry` - Route registry builder (internal transformation)
- ❌ `InternalRequestArgs` - Internal request arguments
- ❌ `RequestOptions` - Internal fetch options
- ❌ Error classes (`NetworkError`, `TimeoutError`, `ParseError`) - Internal error handling

**Note**: You don't need these types - TypeScript automatically infers everything from your route definitions!

## 💡 Common Patterns

### Authentication

```typescript
import bc from '@blaizejs/client';

// Configure default headers at creation
const authenticatedClient = bc.create(
  {
    baseUrl: 'https://api.example.com',
    defaultHeaders: {
      Authorization: `Bearer ${getAuthToken()}`,
    },
  },
  routes
);

// All requests will include the auth header
const user = await authenticatedClient.$get.getProfile();
```

### Error Recovery

```typescript
async function fetchWithRetry(userId: string, maxRetries = 3) {
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      return await client.$get.getUser({ params: { userId } });
    } catch (error) {
      attempt++;

      if (error instanceof BlaizeError) {
        // Don't retry client errors (4xx)
        if (error.status >= 400 && error.status < 500) {
          throw error;
        }

        // Retry on server errors (5xx) or network issues (0)
        if (attempt === maxRetries) {
          throw error;
        }

        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }
}
```

### Request Interceptors

```typescript
// Wrap client for custom behavior
function createInterceptedClient(baseUrl: string, routes: any) {
  const client = bc.create(baseUrl, routes);

  // Create proxy to intercept calls
  return new Proxy(client, {
    get(target, prop) {
      const original = target[prop];

      if (typeof original === 'object') {
        return new Proxy(original, {
          get(methodTarget, methodProp) {
            const method = methodTarget[methodProp];

            if (typeof method === 'function') {
              return async (...args) => {
                console.log(`Calling ${String(prop)}.${String(methodProp)}`);
                const start = Date.now();

                try {
                  const result = await method(...args);
                  console.log(`Success in ${Date.now() - start}ms`);
                  return result;
                } catch (error) {
                  console.log(`Failed in ${Date.now() - start}ms`);
                  throw error;
                }
              };
            }

            return method;
          },
        });
      }

      return original;
    },
  });
}
```

## 🧪 Testing

### Testing with Mock Clients

```typescript
import { describe, test, expect, vi } from 'vitest';
import bc from '@blaizejs/client';

describe('API Client Tests', () => {
  test('should fetch user data', async () => {
    // Mock the fetch function
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: '123',
        name: 'Test User',
        email: 'test@example.com',
      }),
    });

    const client = bc.create('https://api.example.com', routes);
    const user = await client.$get.getUser({ params: { userId: '123' } });

    expect(user.name).toBe('Test User');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.example.com/users/123',
      expect.objectContaining({
        method: 'GET',
      })
    );
  });

  test('should handle errors', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({
        type: 'NOT_FOUND',
        title: 'User not found',
        status: 404,
      }),
    });

    const client = bc.create('https://api.example.com', routes);

    await expect(client.$get.getUser({ params: { userId: '999' } })).rejects.toThrow();
  });
});
```

## 📚 Type System

### Automatic Type Inference

The client automatically infers all types from your server routes:

```typescript
// Server route definition
const getUserRoute = createGetRoute({
  schema: {
    params: z.object({ id: z.string() }),
    response: z.object({
      user: z.object({
        id: z.string(),
        name: z.string(),
      }),
    }),
  },
  handler: async (ctx, params) => {
    // Implementation
  },
});

// Client usage - types are automatically inferred!
const result = await client.$get.getUser({
  params: { id: '123' }, // TypeScript knows this needs { id: string }
});

// result is typed as { user: { id: string, name: string } }
console.log(result.user.name); // ✅ TypeScript knows this exists
console.log(result.user.age); // ❌ TypeScript error - property doesn't exist
```

### Working with Generic Routes

For routes without schemas, the client still provides type safety:

```typescript
// Route without schemas
const healthCheck = createGetRoute({
  handler: async () => ({ status: 'ok' }),
});

// Client usage - no arguments needed
const health = await client.$get.healthCheck();
// health is typed as unknown (no schema defined)
```

## 🗺️ Roadmap

### 🚀 Current Beta (v0.3.1)

- ✅ Core client with automatic type inference
- ✅ Proxy-based method generation
- ✅ URL construction with parameter replacement
- ✅ Error transformation to BlaizeError
- ✅ Native fetch with timeout support
- ✅ Default export pattern
- ✅ Correlation ID generation

### 🎯 MVP/1.0 Release

#### Core Improvements

- 🔄 **Export Error Classes** - Make client error types available for instanceof checks
- 🔄 **Request Interceptors** - Official API for request/response interceptors
- 🔄 **Retry Logic** - Built-in retry with exponential backoff
- 🔄 **Request Cancellation** - AbortController support for canceling requests
- 🔄 **Progress Tracking** - Upload/download progress for large payloads

#### New Features

- 🔄 **WebSocket Client** - Type-safe WebSocket connections
- 🔄 **Request Caching** - Intelligent request caching with TTL
- 🔄 **Batch Requests** - Send multiple requests in a single HTTP call
- 🔄 **Custom Headers per Request** - Override headers for specific calls
- 🔄 **Response Transformers** - Transform responses before returning

### 🔮 Post-MVP (v1.1+)

- 🔄 **GraphQL Client** - Type-safe GraphQL queries and mutations
- 🔄 **gRPC-Web Support** - Connect to gRPC services from browsers
- 🔄 **OpenAPI Integration** - Generate clients from OpenAPI specs
- 🔄 **Offline Support** - Queue requests when offline, sync when online
- 🔄 **Request Deduplication** - Prevent duplicate in-flight requests
- 🔄 **React Query Integration** - First-class React Query adapter
- 🔄 **SWR Integration** - First-class SWR adapter

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](../../CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/jleajones/blaize.git
cd blaize

# Install dependencies
pnpm install

# Run tests for client package
pnpm --filter @blaizejs/client test

# Build client package
pnpm --filter @blaizejs/client build

# Run in watch mode
pnpm --filter @blaizejs/client dev
```

### Package Structure

```
packages/blaize-client/
├── src/
│   ├── client.ts            # Main client creation (proxy-based)
│   ├── request.ts           # HTTP request logic
│   ├── url.ts              # URL construction
│   ├── error-transformer.ts # Error transformation system
│   ├── errors/             # Internal error classes
│   │   ├── network-error.ts
│   │   ├── timeout-error.ts
│   │   └── parse-error.ts
│   └── index.ts            # Default export
├── test/                   # Test files
├── tsconfig.json          # TypeScript config
└── package.json
```

### Important Notes

When contributing to BlaizeJS Client:

1. **Maintain Type Safety**: Ensure all changes preserve automatic type inference
2. **Error Handling**: All errors must be transformed to BlaizeError instances
3. **No Breaking Changes**: The default export pattern must be maintained
4. **Test Coverage**: Add tests for new features using Vitest
5. **Documentation**: Update README for any API changes

### Current Limitations

- **No Direct Error Exports**: Error classes are internal only (planned for 1.0)
- **No Request Cancellation**: AbortController support coming in 1.0
- **No Built-in Retry**: Manual retry logic required (planned for 1.0)
- **Single Request Headers**: Can't override headers per request (planned for 1.0)

---

**Built with ❤️ by the BlaizeJS team**

_For questions or issues, please [open an issue](https://github.com/jleajones/blaize/issues) on GitHub._
