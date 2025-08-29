# 🔧 BlaizeJS Middleware

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

## 🌟 Features

⚡ **RPC-First Design** - Middleware integrates seamlessly with BlaizeJS's type-safe RPC system
🔗 **Composable Architecture** - Combine multiple middleware into reusable, hierarchical stacks
🎯 **Conditional Execution** - Skip middleware based on runtime conditions with zero overhead
🔄 **Async/Sync Support** - Handle both patterns seamlessly with automatic promise resolution
🛡️ **Error Propagation** - Automatic error handling with framework error classes
🐛 **Debug Mode** - Built-in debugging with execution tracing
📊 **Execution Control** - Full control over middleware pipeline execution
🔒 **Type-Safe** - Full TypeScript support with progressive type tracking across middleware
🏗️ **Framework Integration** - Deep integration with routes, plugins, and AI/ML pipelines
⚙️ **Zero Configuration** - Works out of the box with intelligent defaults

## 📦 Installation

```bash
# Middleware is included with BlaizeJS core
pnpm add blaizejs

# For testing middleware
pnpm add -D @blaizejs/testing-utils
```

## 🚀 Quick Start

### 🎯 End-to-End Auth Example (Server + RPC Client)

Let's build a complete authentication system showing middleware, server routes, and RPC client integration:

#### Step 1: Create Auth Middleware with Type Safety

```typescript
// server/src/middleware/auth.ts
import { createMiddleware, UnauthorizedError } from 'blaizejs';
import { verifyJWT } from '../utils/jwt';
import type { State } from 'blaizejs';

// Define the user type for better type safety
interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
}

// Define the state that this middleware adds
interface AuthState extends State {
  user: AuthUser;
}

export const authMiddleware = createMiddleware<AuthState>({
  name: 'auth',
  handler: async (ctx, next) => {
    const token = ctx.request.header('authorization')?.replace('Bearer ', '');

    if (!token) {
      throw new UnauthorizedError('Authentication token required');
    }

    try {
      // Validate token and add user to context state
      const user = await verifyJWT(token);

      // TypeScript knows ctx.state.user is typed as AuthUser
      ctx.state.user = user;
      await next();
    } catch (error) {
      throw new UnauthorizedError('Invalid authentication token');
    }
  },
  skip: ctx => ctx.request.path.startsWith('/public'),
});
```

#### Step 2: Create Protected Route with User Data

```typescript
// server/src/routes/api/profile.ts
import { createGetRoute } from 'blaizejs';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/auth';

export const getProfile = createGetRoute({
  middleware: [authMiddleware],
  schema: {
    response: z.object({
      user: z.object({
        id: z.string().uuid(),
        name: z.string(),
        email: z.string().email(),
        role: z.enum(['admin', 'user']),
      }),
      message: z.string(),
      timestamp: z.number(),
    }),
  },
  handler: async ctx => {
    // TypeScript knows ctx.state.user exists thanks to middleware + route type inference
    const user = ctx.state.user; // ✅ Fully typed as AuthUser with autocomplete for id, name, email, role

    return {
      user: {
        id: user.id, // ✅ TypeScript autocomplete: string
        name: user.name, // ✅ TypeScript autocomplete: string
        email: user.email, // ✅ TypeScript autocomplete: string
        role: user.role, // ✅ TypeScript autocomplete: 'admin' | 'user'
      },
      message: `Welcome back, ${user.name}!`,
      timestamp: Date.now(),
    };
  },
});
```

#### Step 3: Export Routes for RPC Client

```typescript
// server/src/app-routes.ts
import { getProfile } from './routes/api/profile';

export const routes = {
  getProfile,
  // ... other routes
} as const;
```

#### Step 4: Use RPC Client

```typescript
// client/src/api.ts
import bc from '@blaizejs/client';
import { routes } from '../server/src/app-routes';

const client = bc.create('http://localhost:3000', routes);

// Get user profile with full type safety
async function fetchUserProfile(authToken: string) {
  try {
    // Create authenticated client
    const authClient = bc.create(
      {
        baseUrl: 'http://localhost:3000',
        defaultHeaders: {
          Authorization: `Bearer ${authToken}`,
        },
      },
      routes
    );

    // RPC call - middleware runs on server automatically
    const response = await authClient.$get.getProfile();

    // TypeScript knows exact response shape from server schema
    console.log(`Hello ${response.user.name}!`); // ✅ Fully typed
    console.log(`Email: ${response.user.email}`); // ✅ Fully typed
    console.log(`Role: ${response.user.role}`); // ✅ Fully typed ("admin" | "user")
    console.log(response.message); // ✅ "Welcome back, John!"

    return response;
  } catch (error) {
    // Framework error classes are reconstructed on client
    if (error instanceof UnauthorizedError) {
      console.log('Please login to continue');
      // Redirect to login
    }
    throw error;
  }
}

// Usage
const userProfile = await fetchUserProfile('your-jwt-token');
// userProfile.user.name is fully typed and available!
```

### 🔥 What Just Happened?

1. **Server Middleware** → `authMiddleware` validates the JWT and adds `user` to `ctx.state`
2. **Route Handler** → Accesses `ctx.state.user` and returns it in the response
3. **Type Safety** → Response schema ensures type safety end-to-end
4. **RPC Client** → Calls server function directly with full TypeScript support
5. **Error Handling** → Framework errors automatically flow to the client

**🎯 The Result:** Your client gets fully typed user data that was validated and enriched by server middleware!

## 📖 Core Concepts

### 🎭 The Middleware Contract

BlaizeJS middleware follows a simple, predictable contract that integrates seamlessly with the framework's RPC and type system:

```typescript
const middleware = createMiddleware(async (ctx, next) => {
  // 1. Pre-processing (before next middleware/handler)
  console.log('Before');

  // 2. Pass control to next middleware in chain
  await next();

  // 3. Post-processing (after next middleware/handler)
  console.log('After');
});
```

### 🔗 Middleware Composition

Create reusable middleware stacks that maintain full type safety:

```typescript
import { compose } from 'blaizejs';

// Create a reusable API middleware stack
const apiMiddleware = compose([
  corsMiddleware,
  authMiddleware,
  rateLimitMiddleware,
  validationMiddleware,
]);

// Use as a single function
export default {
  GET: {
    middleware: [apiMiddleware], // All 4 middleware execute
    handler: async ctx => {
      return { message: 'Protected API endpoint' };
    },
  },
};
```

## 🎯 Core APIs

### `createMiddleware`

Creates a middleware instance from a function or configuration object with full type safety.

#### Function Form

```typescript
const middleware = createMiddleware(async (ctx, next) => {
  // Your middleware logic
  await next();
});
```

#### Configuration Form

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

**Parameters:**

| Parameter          | Type                                      | Description                      |
| ------------------ | ----------------------------------------- | -------------------------------- |
| `handlerOrOptions` | `MiddlewareFunction \| MiddlewareOptions` | Function or configuration object |

**Returns:** `Middleware` object with:

- `name`: Middleware identifier
- `execute`: The handler function
- `skip?`: Optional skip condition
- `debug?`: Debug flag

### `compose`

Combines multiple middleware into a single middleware function that executes all middleware in sequence.

```typescript
const composed = compose([middleware1, middleware2, middleware3]);

// Use composed middleware in routes
app.get('/api/users', {
  middleware: [composed],
  handler: async ctx => {
    // All three middleware have executed
    return { users: [] };
  },
});

// Or execute directly
await composed(ctx, next);
```

**Parameters:**

| Parameter         | Type                    | Description                    |
| ----------------- | ----------------------- | ------------------------------ |
| `middlewareStack` | `readonly Middleware[]` | Array of middleware to compose |

**Returns:** `MiddlewareFunction` that executes all middleware in sequence following the onion model.

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

### 📊 Request Logging Middleware

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

### ⚡ Response Caching Middleware

```typescript
const cacheMiddleware = createMiddleware({
  name: 'cache',
  handler: async (ctx, next) => {
    // Only cache GET requests
    if (ctx.request.method !== 'GET') {
      return next();
    }

    const cacheKey = `${ctx.request.path}:${JSON.stringify(ctx.request.query)}`;
    const cached = await cache.get(cacheKey);

    if (cached) {
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

    // Handle preflight requests
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

### 🎯 Hierarchical Middleware Composition

```typescript
// Group related middleware for better organization
const securityGroup = compose([
  corsMiddleware,
  rateLimitMiddleware,
  csrfMiddleware,
  helmetMiddleware,
  authMiddleware,
]);

const validationGroup = compose([
  bodyParserMiddleware,
  schemaValidatorMiddleware,
  sanitizerMiddleware,
]);

const loggingGroup = compose([
  requestLoggerMiddleware,
  responseLoggerMiddleware,
  metricsMiddleware,
]);

// Combine groups for comprehensive middleware stack
const apiMiddleware = compose([securityGroup, validationGroup, loggingGroup]);

// Use in routes - all 11 middleware execute efficiently
app.post('/api/orders', {
  middleware: [apiMiddleware],
  handler: async ctx => {
    return { orderId: await createOrder(ctx.request.body) };
  },
});
```

## 🔄 Execution Order

### The Onion Model

Middleware executes in an "onion" pattern where each layer wraps the next:

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

### Visual Flow

```
Request →  [Middleware 1] → [Middleware 2] → [Middleware 3] → [Handler]
                ↓                ↓                ↓                ↓
Response ← [Middleware 1] ← [Middleware 2] ← [Middleware 3] ← [Response]
```

## 🛡️ Error Handling

### Automatic Error Propagation

Errors bubble up through the middleware chain and are handled by BlaizeJS's error boundary:

```typescript
const errorHandlingMiddleware = createMiddleware({
  name: 'error-handler',
  handler: async (ctx, next) => {
    try {
      await next();
    } catch (error) {
      console.error('Middleware chain error:', error);

      // Let framework handle error formatting with correlation IDs
      throw error;
    }
  },
});
```

### Framework Error Classes

Use BlaizeJS's semantic error classes for consistent API responses:

```typescript
import { ValidationError, UnauthorizedError, NotFoundError } from 'blaizejs';

const authMiddleware = createMiddleware({
  name: 'auth',
  handler: async (ctx, next) => {
    const token = ctx.request.header('authorization');

    if (!token) {
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

// Framework automatically formats as:
// {
//   "type": "UNAUTHORIZED",
//   "title": "Authentication required",
//   "status": 401,
//   "correlationId": "req_abc123",
//   "timestamp": "2024-01-15T10:30:00.000Z"
// }
```

### Response Safety

The framework prevents double responses automatically:

```typescript
const safeMiddleware = createMiddleware(async (ctx, next) => {
  await next();

  // Framework checks ctx.response.sent internally
  if (!ctx.response.sent) {
    ctx.response.json({ fallback: true });
  }
});
```

## 🧪 Testing

### Testing with `@blaizejs/testing-utils`

```typescript
import { describe, test, expect, vi } from 'vitest';
import { createMockContext, createMockMiddleware } from '@blaizejs/testing-utils';
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
    const ctx = createMockContext({
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
    const ctx = createMockContext({
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

    const ctx = createMockContext();
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
  test('should execute middleware in correct order', async () => {
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

## 📖 Best Practices

### 🚨 Middleware Composition Limits & Strategy

BlaizeJS middleware composition is highly optimized, but there are important type safety limits to understand:

#### ⚠️ 10 Middleware Type Safety Limit

**TypeScript type tracking degrades after 10 middleware per composition level:**

```typescript
// ✅ GOOD - Full type safety (under 10 middleware)
const apiMiddleware = compose([
  corsMiddleware, // 1
  rateLimitMiddleware, // 2
  authMiddleware, // 3
  validationMiddleware, // 4
  auditMiddleware, // 5
  cacheMiddleware, // 6
  compressionMiddleware, // 7
  metricsMiddleware, // 8
  tracingMiddleware, // 9
]); // ✅ All 9 middleware types are tracked

// ⚠️ CAUTION - Type safety degrades after 10
const overloadedMiddleware = compose([m1, m2, m3, m4, m5, m6, m7, m8, m9, m10, m11, m12]); // ⚠️ Types fall back to base State after 10th middleware
```

#### ✅ Solution: Hierarchical Composition

Use nested composition to maintain full type safety with unlimited middleware:

```typescript
// ✅ PERFECT - Hierarchical composition maintains full types
const securityGroup = compose([
  // 5 middleware = 1 group
  corsMiddleware,
  rateLimitMiddleware,
  csrfMiddleware,
  helmetMiddleware,
  authMiddleware,
]);

const validationGroup = compose([
  // 4 middleware = 1 group
  bodyParserMiddleware,
  schemaValidatorMiddleware,
  sanitizerMiddleware,
  typeCoercionMiddleware,
]);

const observabilityGroup = compose([
  // 3 middleware = 1 group
  loggingMiddleware,
  metricsMiddleware,
  tracingMiddleware,
]);

// Final composition: only 3 groups = full type safety maintained!
const apiMiddleware = compose([
  securityGroup, // Group 1
  validationGroup, // Group 2
  observabilityGroup, // Group 3
]); // ✅ All 12 middleware types tracked perfectly through groups
```

#### 🎯 Best Practices for Type Safety

```typescript
// ✅ GOOD - Organize by logical groups
const authStack = compose([authMiddleware, sessionMiddleware, permissionMiddleware]);
const dataStack = compose([validationMiddleware, sanitizationMiddleware]);
const apiStack = compose([authStack, dataStack]);

// ❌ AVOID - Flat array over 10 middleware
const badStack = compose([
  auth,
  session,
  permission,
  validation,
  sanitization,
  cors,
  rate,
  cache,
  log,
  metrics,
  trace,
]); // 11 middleware - types degrade

// ⚠️ WARNING - BlaizeJS will warn in development mode
// Console: "Middleware composition: 11 middleware detected. Type tracking degrades after 10. Consider hierarchical composition."
```

### 🛡️ Error Handling Best Practices

```typescript
// ✅ GOOD - Let framework handle error formatting
const authMiddleware = createMiddleware({
  name: 'auth',
  handler: async (ctx, next) => {
    if (!ctx.request.header('authorization')) {
      // Framework handles response formatting automatically
      throw new UnauthorizedError('Authentication required');
    }

    try {
      await next();
    } catch (error) {
      // Re-throw to let framework error boundary handle it
      throw error;
    }
  },
});

// ❌ AVOID - Manual error responses bypass framework features
const badAuthMiddleware = createMiddleware({
  name: 'bad-auth',
  handler: async (ctx, next) => {
    if (!ctx.request.header('authorization')) {
      // Manual response - loses correlation IDs, consistent formatting
      return ctx.response.status(401).json({ error: 'Unauthorized' });
    }
    await next();
  },
});
```

### 🎯 Conditional Logic Best Practices

```typescript
// ✅ GOOD - Use skip for route-level conditions
const authMiddleware = createMiddleware({
  name: 'auth',
  handler: async (ctx, next) => {
    // Authentication logic here
    await validateAuth(ctx);
    await next();
  },
  skip: ctx => {
    // Clean conditional logic
    return ctx.request.path.startsWith('/public') || ctx.request.path === '/health';
  },
});

// ✅ GOOD - Use early return for complex conditions
const rateLimitMiddleware = createMiddleware({
  name: 'rate-limit',
  handler: async (ctx, next) => {
    // Early return for specific conditions
    if (ctx.request.method === 'OPTIONS') {
      return next();
    }

    // Rate limiting logic
    await enforceRateLimit(ctx);
    await next();
  },
});
```

### 🧪 Testing Best Practices

```typescript
// ✅ GOOD - Test middleware in isolation
describe('Auth Middleware', () => {
  test('should authenticate valid tokens', async () => {
    const ctx = createTestContext({
      headers: { authorization: 'Bearer valid-token' },
    });

    const next = vi.fn();
    await authMiddleware.execute(ctx, next);

    expect(next).toHaveBeenCalled();
    expect(ctx.state.user).toBeDefined();
  });

  test('should skip middleware for public routes', async () => {
    const ctx = createTestContext({
      path: '/public/info',
    });

    // Test skip function directly
    expect(authMiddleware.skip?.(ctx)).toBe(true);
  });
});

// ✅ GOOD - Test composed middleware chains
describe('API Middleware Chain', () => {
  test('should execute all middleware in correct order', async () => {
    const executionOrder: string[] = [];

    const middleware1 = createTrackingMiddleware('auth', executionOrder);
    const middleware2 = createTrackingMiddleware('validation', executionOrder);

    const composed = compose([middleware1, middleware2]);
    const ctx = createTestContext();

    await composed(ctx, async () => {
      executionOrder.push('handler');
    });

    expect(executionOrder).toEqual([
      'auth-before',
      'validation-before',
      'handler',
      'validation-after',
      'auth-after',
    ]);
  });
});
```

### 📊 Naming & Organization

```typescript
// ✅ GOOD - Descriptive, consistent naming
const authenticationMiddleware = createMiddleware({ name: 'authentication' /* ... */ });
const requestLoggingMiddleware = createMiddleware({ name: 'request-logging' /* ... */ });
const rateLimitingMiddleware = createMiddleware({ name: 'rate-limiting' /* ... */ });

// ✅ GOOD - Group related middleware
const securityMiddleware = {
  cors: createMiddleware({ name: 'security.cors' /* ... */ }),
  rateLimit: createMiddleware({ name: 'security.rate-limit' /* ... */ }),
  auth: createMiddleware({ name: 'security.auth' /* ... */ }),
};

// ✅ GOOD - Logical file organization
// middleware/
// ├── security/
// │   ├── auth.ts
// │   ├── cors.ts
// │   └── rate-limit.ts
// ├── validation/
// │   ├── schema.ts
// │   └── sanitizer.ts
// └── observability/
//     ├── logging.ts
//     └── metrics.ts
```

## 🗺️ Roadmap

### ✅ Current (v0.3.1) - Beta

- ✅ **Function-based API** - Simple createMiddleware function
- ✅ **Composition Support** - Combine middleware with compose function
- ✅ **Skip Conditions** - Conditional middleware execution
- ✅ **Debug Mode** - Per-middleware debugging
- ✅ **Error Propagation** - Automatic error handling with framework classes
- ✅ **Testing Utilities** - Mock middleware helpers with @blaizejs/testing-utils

### 🎯 MVP/1.0 Release

- 🔄 **Enhanced Testing Utilities** - Comprehensive middleware testing helpers
- 🔄 **Performance Metrics** - Built-in timing and monitoring
- 🔄 **Middleware Library** - Pre-built common middleware (CORS, compression, rate limiting, security headers)
- 🔄 **TypeScript Inference** - Advanced state type inference across middleware composition
- 🔄 **Middleware Priorities** - Execution order control and dependencies
- 🔄 **Async Context** - Better async operation tracking and context isolation

### 🔮 Post-MVP (v1.1+)

- 🔄 **Dependency Resolution** - Automatic middleware ordering based on dependencies
- 🔄 **Lifecycle Hooks** - onStart, onError, onComplete middleware hooks
- 🔄 **Distributed Tracing** - OpenTelemetry integration for middleware chains
- 🔄 **WebSocket Support** - Middleware for WebSocket connections and events
- 🔄 **GraphQL Integration** - GraphQL-specific middleware for resolvers
- 🔄 **Middleware Marketplace** - Community middleware registry and discovery

### 🌟 Future Considerations

- 🔄 **Visual Debugger** - Browser DevTools extension for middleware visualization
- 🔄 **AI-Powered Optimization** - Automatic performance tuning and recommendations
- 🔄 **Middleware Analytics** - Usage patterns, performance insights, and bottleneck detection
- 🔄 **Smart Composition** - AI-suggested middleware stacks based on route patterns
- 🔄 **Cross-Platform Support** - Deno and Bun compatibility with platform-specific optimizations

---

**Built with ❤️ by the BlaizeJS team**

_Middleware is the foundation of BlaizeJS - compose powerful, type-safe request processing pipelines with zero configuration._
