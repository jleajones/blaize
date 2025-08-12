# 🔧 BlaizeJS Middleware Module

> **Powerful, composable middleware system** for request/response processing with conditional execution, error handling, and async flow control
>
> Build authentication, logging, validation, and more with a simple, chainable API

[![npm version](https://badge.fury.io/js/blaizejs.svg)](https://badge.fury.io/js/blaizejs)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

## 📋 Table of Contents

- [🌟 Features](#-features)
- [📦 Installation](#-installation)
- [🚀 Quick Start](#-quick-start)
- [📖 Core Concepts](#-core-concepts)
- [🎯 Core APIs](#-core-apis)
- [💡 Common Patterns](#-common-patterns)
- [🔄 Execution Order](#-execution-order)
- [🛡️ Error Handling](#️-error-handling)
- [🧪 Testing](#-testing)
- [📚 Type Reference](#-type-reference)
- [🗺️ Roadmap](#️-roadmap)
- [🤝 Contributing](#-contributing)

## 🌟 Features

- ⚡ **Simple API** - Create middleware with functions or configuration objects
- 🔗 **Composable** - Combine multiple middleware into reusable stacks
- 🎯 **Conditional Execution** - Skip middleware based on runtime conditions
- 🔄 **Async/Sync Support** - Handle both patterns seamlessly
- 🛡️ **Error Propagation** - Automatic error handling throughout the chain
- 🐛 **Debug Mode** - Enable debugging for specific middleware
- 📊 **Execution Control** - Full control over the middleware pipeline
- 🔒 **Type-Safe** - Full TypeScript support with excellent inference
- 🏗️ **Framework Integration** - Works seamlessly with routes and plugins
- ⚙️ **Zero Configuration** - Works out of the box with sensible defaults

## 📦 Installation

Middleware is included with the main BlaizeJS package:

```bash
# Using pnpm (recommended)
pnpm add blaizejs

# Using npm
npm install blaizejs

# Using yarn
yarn add blaizejs
```

## 🚀 Quick Start

### Creating Your First Middleware

```typescript
import { createMiddleware } from 'blaizejs';
import type { Context, NextFunction } from 'blaizejs';

// Simple function middleware
const loggerMiddleware = createMiddleware(async (ctx: Context, next: NextFunction) => {
  const start = Date.now();
  console.log(`→ ${ctx.request.method} ${ctx.request.path}`);

  await next(); // Call the next middleware

  const duration = Date.now() - start;
  console.log(`← ${ctx.response.statusCode} (${duration}ms)`);
});

// Middleware with configuration
const authMiddleware = createMiddleware({
  name: 'auth',
  handler: async (ctx, next) => {
    const token = ctx.request.header('authorization');

    if (!token) {
      return ctx.response.status(401).json({
        error: 'Unauthorized',
      });
    }

    // Validate token and set user
    ctx.state.user = await validateToken(token);
    await next();
  },
  skip: ctx => {
    // Skip auth for public routes
    return ctx.request.path.startsWith('/public');
  },
});
```

### Using Middleware in Routes

```typescript
// routes/api/users.ts
export default {
  GET: {
    middleware: [authMiddleware, loggerMiddleware],
    handler: async ctx => {
      const user = ctx.state.user; // Set by auth middleware
      return {
        message: `Hello, ${user.name}!`,
        timestamp: Date.now(),
      };
    },
  },
};
```

### Global Middleware

```typescript
import { createServer } from 'blaizejs';

const server = createServer({
  port: 3000,
  middleware: [
    corsMiddleware, // Runs on every request
    loggerMiddleware, // Runs on every request
  ],
});

// Add middleware after server creation
server.use(rateLimitMiddleware);

await server.listen();
```

## 📖 Core Concepts

### 🎭 The Middleware Contract

Every middleware follows this simple contract:

1. **Receives context** - Access to request, response, and state
2. **Performs work** - Modify context, validate, log, etc.
3. **Calls next()** - Pass control to the next middleware
4. **Post-processes** - Optionally run code after the chain

```typescript
const middleware = createMiddleware(async (ctx, next) => {
  // 1. Pre-processing (before)
  console.log('Before');

  // 2. Call next middleware in chain
  await next();

  // 3. Post-processing (after)
  console.log('After');
});
```

### 🔗 Middleware Composition

Combine multiple middleware into reusable stacks:

```typescript
import { compose } from 'blaizejs';

// Create a reusable API middleware stack
const apiMiddleware = compose([
  corsMiddleware,
  authMiddleware,
  rateLimitMiddleware,
  validationMiddleware,
]);

// Use as a single middleware
export default {
  GET: {
    middleware: [apiMiddleware], // All 4 middleware run
    handler: async ctx => {
      return { message: 'Protected API endpoint' };
    },
  },
};
```

## 🎯 Core APIs

### `createMiddleware`

Creates a middleware instance from a function or options object.

#### Function Form

```typescript
const middleware = createMiddleware(async (ctx, next) => {
  // Your middleware logic
  await next();
});
```

#### Options Form

```typescript
const middleware = createMiddleware({
  name: 'my-middleware', // For debugging (default: 'anonymous')

  handler: async (ctx, next) => {
    // Middleware logic
    await next();
  },

  skip: ctx => {
    // Optional: Skip condition
    return ctx.request.path.startsWith('/public');
  },

  debug: true, // Optional: Enable debug mode
});
```

#### Parameters

| Parameter          | Type                                      | Description                      |
| ------------------ | ----------------------------------------- | -------------------------------- |
| `handlerOrOptions` | `MiddlewareFunction \| MiddlewareOptions` | Function or configuration object |

#### Returns

Returns a `Middleware` object with:

- `name`: Middleware identifier
- `execute`: The handler function
- `skip?`: Optional skip condition
- `debug?`: Debug flag

### `compose`

Combines multiple middleware into a single middleware function.

```typescript
const composed = compose([middleware1, middleware2, middleware3]);
```

#### Parameters

| Parameter         | Type           | Description                    |
| ----------------- | -------------- | ------------------------------ |
| `middlewareStack` | `Middleware[]` | Array of middleware to compose |

#### Returns

Returns a `MiddlewareFunction` that executes all middleware in sequence.

## 💡 Common Patterns

### 🔐 Authentication Middleware

```typescript
const authMiddleware = createMiddleware({
  name: 'auth',
  handler: async (ctx, next) => {
    const token = ctx.request.header('authorization');

    if (!token) {
      return ctx.response.status(401).json({
        error: 'No token provided',
      });
    }

    try {
      const user = await verifyToken(token);
      ctx.state.user = user;
      await next();
    } catch (error) {
      ctx.response.status(401).json({
        error: 'Invalid token',
      });
    }
  },
  skip: ctx => {
    // Skip auth for public endpoints
    const publicPaths = ['/health', '/public', '/login'];
    return publicPaths.some(path => ctx.request.path.startsWith(path));
  },
});
```

### 📊 Logging Middleware

```typescript
const loggingMiddleware = createMiddleware({
  name: 'logger',
  handler: async (ctx, next) => {
    const start = Date.now();
    const requestId = ctx.state.requestId || generateId();

    console.log({
      type: 'request',
      requestId,
      method: ctx.request.method,
      path: ctx.request.path,
      timestamp: new Date().toISOString(),
    });

    await next();

    console.log({
      type: 'response',
      requestId,
      status: ctx.response.statusCode,
      duration: Date.now() - start,
    });
  },
});
```

### ⚡ Caching Middleware

```typescript
const cacheMiddleware = createMiddleware({
  name: 'cache',
  handler: async (ctx, next) => {
    // Only cache GET requests
    if (ctx.request.method !== 'GET') {
      return next();
    }

    const cacheKey = `${ctx.request.path}:${ctx.request.query}`;
    const cached = await cache.get(cacheKey);

    if (cached) {
      // Short-circuit with cached response
      ctx.response.header('X-Cache', 'HIT');
      return ctx.response.json(cached);
    }

    // Store original json method
    const originalJson = ctx.response.json.bind(ctx.response);

    // Override to cache the response
    ctx.response.json = (data: any) => {
      cache.set(cacheKey, data, { ttl: 300 }); // 5 minutes
      ctx.response.header('X-Cache', 'MISS');
      return originalJson(data);
    };

    await next();
  },
});
```

### 🛡️ CORS Middleware

```typescript
const corsMiddleware = createMiddleware({
  name: 'cors',
  handler: async (ctx, next) => {
    const origin = ctx.request.header('origin') || '*';

    ctx.response
      .header('Access-Control-Allow-Origin', origin)
      .header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
      .header('Access-Control-Allow-Headers', 'Content-Type,Authorization')
      .header('Access-Control-Max-Age', '86400');

    // Handle preflight
    if (ctx.request.method === 'OPTIONS') {
      return ctx.response.status(204).text('');
    }

    await next();
  },
});
```

### 🚦 Rate Limiting Middleware

```typescript
const rateLimitMiddleware = createMiddleware({
  name: 'rate-limit',
  handler: async (ctx, next) => {
    const ip = ctx.request.header('x-forwarded-for') || ctx.request.raw.socket.remoteAddress;

    const key = `rate:${ip}`;
    const limit = 100;
    const window = 60000; // 1 minute

    const count = await incrementCounter(key, window);

    ctx.response
      .header('X-RateLimit-Limit', String(limit))
      .header('X-RateLimit-Remaining', String(Math.max(0, limit - count)));

    if (count > limit) {
      return ctx.response.status(429).json({
        error: 'Too many requests',
      });
    }

    await next();
  },
});
```

## 🔄 Execution Order

### The Onion Model

Middleware executes in an "onion" pattern - each layer wraps the next:

```typescript
const middleware1 = createMiddleware({
  name: 'outer',
  handler: async (ctx, next) => {
    console.log('1: Start');
    await next();
    console.log('1: End');
  },
});

const middleware2 = createMiddleware({
  name: 'middle',
  handler: async (ctx, next) => {
    console.log('2: Start');
    await next();
    console.log('2: End');
  },
});

const middleware3 = createMiddleware({
  name: 'inner',
  handler: async (ctx, next) => {
    console.log('3: Start');
    await next();
    console.log('3: End');
  },
});

// Execution output:
// 1: Start
// 2: Start
// 3: Start
// [route handler executes]
// 3: End
// 2: End
// 1: End
```

### Visual Representation

```
Request →  [Middleware 1] → [Middleware 2] → [Middleware 3] → [Handler]
                ↓                ↓                ↓                ↓
Response ← [Middleware 1] ← [Middleware 2] ← [Middleware 3] ← [Response]
```

## 🛡️ Error Handling

### Automatic Error Propagation

Errors automatically bubble up through the middleware chain and are handled by the framework's error boundary:

```typescript
const errorHandlingMiddleware = createMiddleware({
  name: 'error-handler',
  handler: async (ctx, next) => {
    try {
      await next();
    } catch (error) {
      console.error('Caught error:', error);

      // Errors are automatically formatted by the framework
      // with correlation IDs, timestamps, and proper status codes
      throw error; // Re-throw to let framework handle it
    }
  },
});

// Custom error handling for specific cases
const validationMiddleware = createMiddleware({
  name: 'validator',
  handler: async (ctx, next) => {
    if (!ctx.request.body.email) {
      // Framework's error classes handle the response format
      throw new ValidationError('Email is required');
    }

    await next();
  },
});
```

### Framework Error Classes

The framework provides semantic error classes that automatically format responses:

```typescript
import { ValidationError, UnauthorizedError, NotFoundError } from 'blaizejs';

const authMiddleware = createMiddleware({
  name: 'auth',
  handler: async (ctx, next) => {
    const token = ctx.request.header('authorization');

    if (!token) {
      // Framework handles the response format
      throw new UnauthorizedError('Authentication required');
    }

    try {
      const user = await verifyToken(token);
      ctx.state.user = user;
      await next();
    } catch (error) {
      throw new UnauthorizedError('Invalid token');
    }
  },
});

// The framework's error boundary will format these as:
// {
//   "type": "UNAUTHORIZED",
//   "title": "Authentication required",
//   "status": 401,
//   "correlationId": "req_abc123",
//   "timestamp": "2024-01-15T10:30:00.000Z"
// }
```

### Protected Responses

The framework prevents double responses:

```typescript
const safeMiddleware = createMiddleware(async (ctx, next) => {
  await next();

  // Check if response was already sent
  if (!ctx.response.sent) {
    // Safe to send a response
    ctx.response.json({ fallback: true });
  }
});
```

## 🧪 Testing

### Enhanced Testing Utilities (Coming in v1.0)

The testing utilities for middleware are being enhanced for the 1.0 release to provide:

- Middleware execution tracking and assertions
- Request/response mocking with full context
- Middleware chain simulation
- Performance testing helpers
- Error scenario testing

### Current Testing with `@blaizejs/testing-utils`

```typescript
import { describe, test, expect, vi } from 'vitest';
import { createTestContext, createMockMiddleware } from '@blaizejs/testing-utils';
import { createMiddleware } from 'blaizejs';

describe('Authentication Middleware', () => {
  const authMiddleware = createMiddleware({
    name: 'auth',
    handler: async (ctx, next) => {
      const token = ctx.request.header('authorization');

      if (!token) {
        return ctx.response.status(401).json({
          error: 'Unauthorized',
        });
      }

      ctx.state.user = { id: '123', name: 'Test User' };
      await next();
    },
  });

  test('should block unauthenticated requests', async () => {
    const ctx = createTestContext({
      request: {
        headers: {}, // No auth header
      },
    });

    const next = vi.fn();
    await authMiddleware.execute(ctx, next);

    expect(ctx.response.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('should allow authenticated requests', async () => {
    const ctx = createTestContext({
      request: {
        headers: {
          authorization: 'Bearer valid-token',
        },
      },
    });

    const next = vi.fn();
    await authMiddleware.execute(ctx, next);

    expect(next).toHaveBeenCalled();
    expect(ctx.state.user).toBeDefined();
    expect(ctx.state.user.id).toBe('123');
  });
});
```

### Mock Middleware Helpers

```typescript
import { createMockMiddleware } from '@blaizejs/testing-utils';

describe('Route with Middleware', () => {
  test('should process through middleware chain', async () => {
    // Create mock middleware
    const mockAuth = createMockMiddleware({
      name: 'mock-auth',
      behavior: 'pass',
      stateChanges: {
        user: { id: 1, name: 'Test User' },
      },
    });

    const mockLogger = createMockMiddleware({
      name: 'mock-logger',
      behavior: 'pass',
    });

    // Test your route with mocked middleware
    const ctx = createTestContext();
    const next = vi.fn();

    await mockAuth.execute(ctx, next);
    expect(ctx.state.user).toBeDefined();
  });
});
```

### Testing Middleware Composition

```typescript
import { compose } from 'blaizejs';

describe('Middleware Composition', () => {
  test('should execute middleware in order', async () => {
    const order: string[] = [];

    const first = createMiddleware(async (ctx, next) => {
      order.push('first-before');
      await next();
      order.push('first-after');
    });

    const second = createMiddleware(async (ctx, next) => {
      order.push('second-before');
      await next();
      order.push('second-after');
    });

    const composed = compose([first, second]);
    const ctx = createTestContext();

    await composed(ctx, async () => {
      order.push('handler');
    });

    expect(order).toEqual([
      'first-before',
      'second-before',
      'handler',
      'second-after',
      'first-after',
    ]);
  });
});
```

## 📚 Type Reference

### Core Types

```typescript
// From blaizejs (re-exported from @blaizejs/types)

/**
 * Middleware configuration object
 */
export interface Middleware {
  name: string;
  execute: MiddlewareFunction;
  skip?: (ctx: Context) => boolean;
  debug?: boolean;
}

/**
 * Options for creating middleware
 */
export interface MiddlewareOptions {
  name?: string;
  handler: MiddlewareFunction;
  skip?: (ctx: Context) => boolean;
  debug?: boolean;
}

/**
 * Middleware function signature
 */
export type MiddlewareFunction = (ctx: Context, next: NextFunction) => Promise<void> | void;

/**
 * Function to pass control to the next middleware
 */
export type NextFunction = () => Promise<void> | void;
```

## 🗺️ Roadmap

### 🚀 Current (v0.3.1) - Beta

- ✅ **Function-based API** - Simple createMiddleware function
- ✅ **Composition Support** - Combine middleware with compose
- ✅ **Skip Conditions** - Conditional middleware execution
- ✅ **Debug Mode** - Per-middleware debugging
- ✅ **Error Propagation** - Automatic error handling
- ✅ **Testing Utilities** - Mock middleware helpers

### 🎯 MVP/1.0 Release

- 🔄 **Enhanced Testing Utilities** - Comprehensive middleware testing helpers
- 🔄 **Performance Metrics** - Built-in timing and monitoring
- 🔄 **Middleware Library** - Pre-built common middleware
  - CORS, compression, rate limiting, security headers
- 🔄 **Middleware Groups** - Named middleware collections
- 🔄 **TypeScript Inference** - Better state type inference
- 🔄 **Middleware Priorities** - Execution order control
- 🔄 **Async Context** - Better async operation tracking

### 🔮 Post-MVP (v1.1+)

- 🔄 **Dependency Resolution** - Automatic middleware ordering
- 🔄 **Lifecycle Hooks** - onStart, onError, onComplete
- 🔄 **Distributed Tracing** - OpenTelemetry integration
- 🔄 **WebSocket Support** - Middleware for WebSocket connections
- 🔄 **GraphQL Integration** - GraphQL-specific middleware
- 🔄 **Middleware Marketplace** - Community middleware registry

### 🌟 Future Considerations

- 🔄 **Visual Debugger** - Browser DevTools for middleware
- 🔄 **AI-Powered Optimization** - Automatic performance tuning
- 🔄 **Middleware Analytics** - Usage patterns and insights
- 🔄 **Smart Composition** - AI-suggested middleware stacks
- 🔄 **Cross-Platform Support** - Deno and Bun compatibility

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](../../CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/jleajones/blaize.git
cd blaize

# Install dependencies (using pnpm)
pnpm install

# Run tests for middleware
pnpm test middleware

# Run tests in watch mode
pnpm test:watch middleware

# Build the package
pnpm build

# Run linting
pnpm lint
```

### Testing Your Changes

1. Write tests for new features
2. Ensure all tests pass: `pnpm test`
3. Check type safety: `pnpm type-check`
4. Verify linting: `pnpm lint`

## 📚 Related Documentation

- 🏠 [BlaizeJS Main Documentation](../../README.md)
- 🔗 [Context Module](../context/README.md) - Request/response context
- 🌐 [Server Module](../server/README.md) - HTTP server with middleware
- 🚀 [Router Module](../router/README.md) - Route-specific middleware
- 🧩 [Plugins Module](../plugins/README.md) - Plugin middleware hooks
- 🧪 [Testing Utils](../../../blaize-testing-utils/README.md) - Testing utilities

---

**Built with ❤️ by the BlaizeJS team**

_Middleware is the heart of BlaizeJS - compose powerful, reusable request processing pipelines with ease._
