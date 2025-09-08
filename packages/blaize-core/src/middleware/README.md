# 🔧 BlaizeJS Middleware Module

> **Type-safe, composable middleware system** with automatic type composition, conditional execution, and async flow control
>
> Build authentication, logging, validation, and more with full TypeScript type safety

[![npm version](https://badge.fury.io/js/blaizejs.svg)](https://badge.fury.io/js/blaizejs)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

## 📋 Table of Contents

- [🌟 Features](#-features)
- [📦 Installation](#-installation)
- [🚀 Quick Start](#-quick-start)
- [🎨 Type-Safe Middleware](#-type-safe-middleware)
- [📖 Core Concepts](#-core-concepts)
- [🎯 Core APIs](#-core-apis)
- [💡 Common Patterns](#-common-patterns)
- [🔄 Type Composition Flow](#-type-composition-flow)
- [♻️ Helper Functions](#️-helper-functions)
- [🛡️ Error Handling](#️-error-handling)
- [🧪 Testing](#-testing)
- [📚 Type Reference](#-type-reference)
- [🗺️ Roadmap](#️-roadmap)

## 🌟 Features

### Why Typed Middleware?

With the new type composition system:

- **Full IntelliSense** - Know exactly what's available in context
- **Compile-time safety** - Catch errors before runtime  
- **Self-documenting** - Types show what middleware provides
- **Refactoring confidence** - TypeScript helps with changes
- **No more guessing** - See all available state and services
- **Zero runtime overhead** - It's just TypeScript!

Core capabilities:
- ⚡ **Type Composition** - Automatic type flow from middleware to routes
- 🔗 **Composable** - Types combine when middleware are chained
- 🎯 **State & Services** - Separate per-request state from shared services
- 🔄 **Async/Sync Support** - Handle both patterns seamlessly
- 🛡️ **Error Propagation** - Type-safe error handling
- 📊 **Conditional Execution** - Skip middleware based on runtime conditions

## 📦 Installation

```bash
# Using pnpm (recommended)
pnpm add blaizejs

# Using npm
npm install blaizejs

# Using yarn
yarn add blaizejs
```

## 🚀 Quick Start

### Creating Your First Typed Middleware

```typescript
import { createMiddleware } from 'blaizejs';
import type { User, AuthService } from './types';

// Typed middleware declaring state and service modifications
const authMiddleware = createMiddleware<
  { user: User },        // State modifications (per-request)
  { auth: AuthService }  // Service modifications (shared)
>({
  name: 'auth',
  handler: async (ctx, next) => {
    const token = ctx.request.header('authorization');
    
    if (!token) {
      return ctx.response.status(401).json({ error: 'Unauthorized' });
    }
    
    // Type-safe assignments
    ctx.state.user = await validateToken(token);
    ctx.services.auth = authService;
    
    await next();
  }
});

// Routes automatically get types!
export const GET = createGetRoute({
  middleware: [authMiddleware],
  handler: async (ctx) => {
    // Full type safety - ctx.state.user is typed as User
    // ctx.services.auth is typed as AuthService
    return { 
      message: `Hello, ${ctx.state.user.name}!`,
      userId: ctx.state.user.id 
    };
  }
});
```

## 🎨 Type-Safe Middleware

### The New Type System

Middleware declares what it adds to state and services, and these types automatically flow to routes:

```typescript
// Middleware declares its type contributions
const loggingMiddleware = createMiddleware<
  { requestId: string; startTime: number },  // State
  { logger: Logger }                         // Services
>({
  name: 'logger',
  handler: async (ctx, next) => {
    // Type-safe modifications
    ctx.state.requestId = generateId();
    ctx.state.startTime = Date.now();
    ctx.services.logger = logger;
    
    await next();
    
    // Post-processing with typed access
    const duration = Date.now() - ctx.state.startTime;
    ctx.services.logger.info(`Request ${ctx.state.requestId} took ${duration}ms`);
  }
});

// Multiple middleware compose their types
const middleware1 = createMiddleware<{ a: string }, { x: Service1 }>({...});
const middleware2 = createMiddleware<{ b: number }, { y: Service2 }>({...});

// Route sees combined types from all middleware
export const GET = createGetRoute({
  middleware: [middleware1, middleware2],
  handler: async (ctx) => {
    // All types are available!
    ctx.state.a;    // string ✅
    ctx.state.b;    // number ✅
    ctx.services.x; // Service1 ✅
    ctx.services.y; // Service2 ✅
  }
});
```

> 📦 **Migration Note**: Starting in v0.4.0, middleware supports full type composition. While untyped middleware still works, we recommend updating to typed middleware for better IntelliSense.

## 📖 Core Concepts

### 🎭 The Middleware Contract

Every middleware:
1. **Modifies state** (per-request) and **services** (shared)
2. **Types flow automatically** through composition
3. **Routes see everything** their middleware provide

```typescript
const middleware = createMiddleware<
  { requestData: string },     // What I add to state
  { myService: MyService }     // What I add to services
>({
  handler: async (ctx, next) => {
    // 1. Pre-processing (before)
    ctx.state.requestData = 'some data';
    ctx.services.myService = serviceInstance;
    
    // 2. Call next middleware
    await next();
    
    // 3. Post-processing (after)
    console.log('Request complete');
  }
});
```

### State vs Services

- **State**: Per-request data (user, requestId, etc.)
- **Services**: Shared instances (database, logger, etc.)

## 🎯 Core APIs

### `createMiddleware<TState, TServices>`

Creates typed middleware with automatic type composition.

```typescript
const middleware = createMiddleware<
  { user: User },           // State type
  { database: Database }    // Services type
>({
  name: 'my-middleware',
  
  handler: async (ctx, next) => {
    ctx.state.user = await getUser();
    ctx.services.database = db;
    await next();
  },
  
  skip: ctx => {
    // Optional: Skip condition
    return ctx.request.path === '/public';
  }
});
```

### `compose`

Combines multiple middleware with type composition:

```typescript
const composed = compose([
  authMiddleware,    // Adds { user } to state
  loggerMiddleware,  // Adds { requestId } to state
  cacheMiddleware    // Adds { cache } to services
]);

// Composed middleware has all types!
```

## 💡 Common Patterns

### 🔐 Authentication Middleware

```typescript
const authMiddleware = createMiddleware<
  { user: User; isAuthenticated: boolean },
  { auth: AuthService }
>({
  name: 'auth',
  handler: async (ctx, next) => {
    const token = ctx.request.header('authorization');
    
    if (!token) {
      ctx.state.isAuthenticated = false;
      return ctx.response.status(401).json({ error: 'No token provided' });
    }
    
    try {
      ctx.state.user = await verifyToken(token);
      ctx.state.isAuthenticated = true;
      ctx.services.auth = authService;
      await next();
    } catch (error) {
      ctx.state.isAuthenticated = false;
      ctx.response.status(401).json({ error: 'Invalid token' });
    }
  },
  skip: ctx => {
    const publicPaths = ['/health', '/public', '/login'];
    return publicPaths.some(path => ctx.request.path.startsWith(path));
  }
});
```

### 📊 Logging Middleware

```typescript
const loggingMiddleware = createMiddleware<
  { requestId: string; startTime: number },
  { logger: Logger }
>({
  name: 'logger',
  handler: async (ctx, next) => {
    ctx.state.requestId = generateId();
    ctx.state.startTime = Date.now();
    ctx.services.logger = loggerInstance;
    
    ctx.services.logger.info({
      type: 'request',
      requestId: ctx.state.requestId,
      method: ctx.request.method,
      path: ctx.request.path
    });
    
    await next();
    
    const duration = Date.now() - ctx.state.startTime;
    ctx.services.logger.info({
      type: 'response',
      requestId: ctx.state.requestId,
      status: ctx.response.statusCode,
      duration
    });
  }
});
```

### ⚡ Caching Middleware

```typescript
const cacheMiddleware = createMiddleware<
  { cacheKey: string; cacheHit: boolean },
  { cache: CacheService }
>({
  name: 'cache',
  handler: async (ctx, next) => {
    if (ctx.request.method !== 'GET') {
      return next();
    }
    
    ctx.state.cacheKey = `${ctx.request.path}:${ctx.request.query}`;
    ctx.services.cache = cacheService;
    
    const cached = await ctx.services.cache.get(ctx.state.cacheKey);
    
    if (cached) {
      ctx.state.cacheHit = true;
      ctx.response.header('X-Cache', 'HIT');
      return ctx.response.json(cached);
    }
    
    ctx.state.cacheHit = false;
    
    // Override response to cache it
    const originalJson = ctx.response.json.bind(ctx.response);
    ctx.response.json = (data: any) => {
      ctx.services.cache.set(ctx.state.cacheKey, data, { ttl: 300 });
      ctx.response.header('X-Cache', 'MISS');
      return originalJson(data);
    };
    
    await next();
  }
});
```

### 🚦 Rate Limiting Middleware

```typescript
const rateLimitMiddleware = createMiddleware<
  { requestCount: number; clientIp: string },
  { rateLimiter: RateLimiter }
>({
  name: 'rate-limit',
  handler: async (ctx, next) => {
    ctx.state.clientIp = ctx.request.header('x-forwarded-for') || 
                         ctx.request.raw.socket.remoteAddress;
    ctx.services.rateLimiter = rateLimiter;
    
    ctx.state.requestCount = await ctx.services.rateLimiter
      .increment(ctx.state.clientIp);
    
    const limit = 100;
    ctx.response
      .header('X-RateLimit-Limit', String(limit))
      .header('X-RateLimit-Remaining', String(Math.max(0, limit - ctx.state.requestCount)));
    
    if (ctx.state.requestCount > limit) {
      return ctx.response.status(429).json({ error: 'Too many requests' });
    }
    
    await next();
  }
});
```

## 🔄 Type Composition Flow

### How Types Flow Through the System

```typescript
// 1. Server middleware adds base types
const serverMiddleware = createMiddleware<
  { serverId: string },
  { config: ServerConfig }
>({...});

// 2. Plugin middleware adds more types
const pluginMiddleware = createMiddleware<
  { pluginData: string },
  { database: Database }
>({...});

// 3. Route middleware adds route-specific types
const routeMiddleware = createMiddleware<
  { routeData: number },
  { routeService: RouteService }
>({...});

// 4. Route handler sees ALL composed types
export const GET = createGetRoute({
  middleware: [routeMiddleware],  // Plus server & plugin middleware
  handler: async (ctx) => {
    // Everything is available and typed!
    ctx.state.serverId;     // ✅ From server
    ctx.state.pluginData;   // ✅ From plugin
    ctx.state.routeData;    // ✅ From route
    ctx.services.config;    // ✅ From server
    ctx.services.database;  // ✅ From plugin
    ctx.services.routeService; // ✅ From route
  }
});
```

### Visual Type Flow

```
Server Middleware Types
        ↓
    Plugin Middleware Types
        ↓
    Route Middleware Types
        ↓
    [All Types Available in Route Handler]
```

## ♻️ Helper Functions

For simpler cases, use these convenience helpers:

```typescript
import { stateMiddleware, serviceMiddleware } from 'blaizejs';

// For state-only modifications
const userMiddleware = stateMiddleware<{ user: User }>(
  async (ctx, next) => {
    ctx.state.user = await getUser();
    await next();
  }
);

// For service-only modifications  
const dbMiddleware = serviceMiddleware<{ db: Database }>(
  async (ctx, next) => {
    ctx.services.db = database;
    await next();
  }
);

// For simple middleware without modifications
const simpleMiddleware = createMiddleware(
  async (ctx, next) => {
    console.log('Processing request');
    await next();
  }
);
```

## 🛡️ Error Handling

### Type-Safe Error Handling

```typescript
import { ValidationError, UnauthorizedError } from 'blaizejs';

const validationMiddleware = createMiddleware<
  { validationErrors?: string[] },
  {}
>({
  name: 'validator',
  handler: async (ctx, next) => {
    const errors = validateRequest(ctx.request);
    
    if (errors.length > 0) {
      ctx.state.validationErrors = errors;
      throw new ValidationError('Request validation failed', { errors });
    }
    
    await next();
  }
});

// Error types are preserved
export const POST = createPostRoute({
  middleware: [validationMiddleware],
  handler: async (ctx) => {
    // ctx.state.validationErrors is typed as string[] | undefined
    // Won't reach here if validation fails
    return { success: true };
  }
});
```

## 🧪 Testing

### Testing Typed Middleware

```typescript
import { describe, test, expect, vi } from 'vitest';
import { createTestContext } from '@blaizejs/testing-utils';
import { createMiddleware } from 'blaizejs';

describe('Typed Authentication Middleware', () => {
  const authMiddleware = createMiddleware<
    { user: User },
    { auth: AuthService }
  >({
    name: 'auth',
    handler: async (ctx, next) => {
      const token = ctx.request.header('authorization');
      
      if (!token) {
        return ctx.response.status(401).json({ error: 'Unauthorized' });
      }
      
      ctx.state.user = { id: '123', name: 'Test User' };
      ctx.services.auth = mockAuthService;
      await next();
    }
  });
  
  test('should set typed user state', async () => {
    const ctx = createTestContext({
      request: {
        headers: { authorization: 'Bearer token' }
      }
    });
    
    const next = vi.fn();
    await authMiddleware.execute(ctx, next);
    
    // Type-safe assertions
    expect(ctx.state.user).toBeDefined();
    expect(ctx.state.user.id).toBe('123');
    expect(ctx.services.auth).toBeDefined();
  });
});
```

### Testing Type Composition

```typescript
describe('Middleware Type Composition', () => {
  test('should compose types from multiple middleware', async () => {
    const middleware1 = createMiddleware<{ a: string }, { x: Service1 }>({
      handler: async (ctx, next) => {
        ctx.state.a = 'value';
        ctx.services.x = service1;
        await next();
      }
    });
    
    const middleware2 = createMiddleware<{ b: number }, { y: Service2 }>({
      handler: async (ctx, next) => {
        ctx.state.b = 42;
        ctx.services.y = service2;
        await next();
      }
    });
    
    const composed = compose([middleware1, middleware2]);
    const ctx = createTestContext();
    
    await composed(ctx, async () => {
      // Both types are available
      expect(ctx.state.a).toBe('value');
      expect(ctx.state.b).toBe(42);
      expect(ctx.services.x).toBeDefined();
      expect(ctx.services.y).toBeDefined();
    });
  });
});
```

## 📚 Type Reference

### Core Types

```typescript
// Middleware with type parameters
export interface Middleware<TState = {}, TServices = {}> {
  name: string;
  execute: MiddlewareFunction;
  skip?: (ctx: Context) => boolean;
  debug?: boolean;
  _state?: TState;      // Type carrier (not used at runtime)
  _services?: TServices; // Type carrier (not used at runtime)
}

// Context with composed types
export interface Context<S extends State, Svc extends Services> {
  request: ContextRequest;
  response: ContextResponse;
  state: S;        // Request-scoped state (per-request)
  services: Svc;   // Shared services (singletons)
}

// Middleware function signature
export type MiddlewareFunction = (
  ctx: Context<any, any>, 
  next: NextFunction
) => Promise<void> | void;

// Helper function types
export function stateMiddleware<T>(
  handler: MiddlewareFunction
): Middleware<T, {}>;

export function serviceMiddleware<T>(
  handler: MiddlewareFunction
): Middleware<{}, T>;
```

## 🗺️ Roadmap

### ✅ Current (v0.4.0)
- Full type composition system
- State and service type parameters
- Automatic type flow to routes
- Helper functions for common patterns
- Type-safe error handling

### 🎯 MVP/1.0 Release
- Enhanced type inference
- Middleware type validation
- Runtime type checking (dev mode)
- Type composition debugging tools
- Pre-built typed middleware library

### 🔮 Post-MVP (v1.1+)
- Middleware dependency resolution with types
- Type-safe middleware lifecycle hooks
- Advanced type composition patterns
- Cross-platform type safety (Deno, Bun)

---

**Built with ❤️ by the BlaizeJS team**

_Middleware is the heart of BlaizeJS - compose powerful, type-safe request processing pipelines where types flow automatically from middleware to routes._