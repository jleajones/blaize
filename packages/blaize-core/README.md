# 🔥 BlaizeJS Core

> The core BlaizeJS framework — type-safe APIs with file-based routing

[![npm version](https://badge.fury.io/js/blaizejs.svg)](https://badge.fury.io/js/blaizejs)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-23.0+-green.svg)](https://nodejs.org/)
[![Build Status](https://github.com/jleajones/blaize/workflows/Test/badge.svg)](https://github.com/jleajones/blaize/actions)

The `blaizejs` package is the core framework providing servers, routing, middleware, plugins, and error handling with end-to-end type safety.

---

## 📦 Installation

### Recommended: Create a New Project

```bash
# Using pnpm (recommended)
pnpm dlx create-blaize-app my-app

# Using npm
npx create-blaize-app my-app

# Using yarn
yarn dlx create-blaize-app my-app
```

This sets up a fully configured project with TypeScript, file-based routing, and example routes.

### Manual Installation

Add BlaizeJS to an existing project:

```bash
# Using pnpm
pnpm add blaizejs zod

# Using npm
npm install blaizejs zod

# Using yarn
yarn add blaizejs zod
```

---

## 🚀 Quick Start

```typescript
// src/app.ts
import { Blaize, type InferContext } from 'blaizejs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = Blaize.createServer({
  port: 3000,
  routesDir: path.resolve(__dirname, './routes'),
});

// Create a typed route factory for use in route files
type AppContext = InferContext;
export const route = Blaize.Router.createRouteFactory<
  AppContext['state'],
  AppContext['services']
>();

await app.listen();
console.log('🔥 Server running at https://localhost:3000');
```

```typescript
// src/routes/hello.ts
import { route } from '../app';
import { z } from 'zod';

// Named export — the name becomes the client method name
export const getHello = route.get({
  schema: {
    response: z.object({ message: z.string() }),
  },
  handler: async () => ({ message: 'Hello, BlaizeJS!' }),
});
```

```typescript
// src/app-type.ts — Export routes registry for the client
import { getHello } from './routes/hello';

export const routes = { getHello } as const;
```

---

## 📋 Table of Contents

- [Server](#-server)
- [Route Creators](#-route-creators)
- [Middleware](#-middleware)
- [Plugins](#-plugins)
- [Error Classes](#-error-classes)
- [Logging](#-logging)
- [Utilities](#-utilities)
- [Context Reference](#-context-reference)
- [Testing](#-testing)
- [Roadmap](#-roadmap)

---

## 🖥️ Server

### createServer

Creates and configures a BlaizeJS server instance.

```typescript
import { createServer } from 'blaizejs';

const server = createServer(options?: ServerOptions);
```

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `port` | `number` | `3000` | Port to listen on |
| `host` | `string` | `'localhost'` | Host to bind to |
| `routesDir` | `string` | — | Directory for file-based route discovery |
| `middleware` | `Middleware[]` | `[]` | Global middleware (runs for all routes) |
| `plugins` | `Plugin[]` | `[]` | Plugins to register |
| `http2` | `boolean` | `true` | Enable HTTP/2 (with HTTP/1.1 fallback) |
| `bodyLimits` | `object` | See below | Request body size limits |

**Body Limits:**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `bodyLimits.json` | `number` | `1048576` (1MB) | Max JSON body size in bytes |
| `bodyLimits.form` | `number` | `1048576` (1MB) | Max form body size in bytes |
| `bodyLimits.text` | `number` | `1048576` (1MB) | Max text body size in bytes |

#### Server Instance

The returned server instance provides:

| Method/Property | Type | Description |
|-----------------|------|-------------|
| `listen(port?, host?)` | `Promise<Server>` | Start the server |
| `close(options?)` | `Promise<void>` | Stop the server gracefully |
| `use(middleware)` | `Server` | Add middleware (chainable) |
| `register(plugin)` | `Promise<Server>` | Register a plugin |
| `port` | `number` (readonly) | Current port |
| `host` | `string` (readonly) | Current host |
| `middleware` | `Middleware[]` (readonly) | Registered middleware |

#### Examples

**Basic Setup:**

```typescript
import { createServer } from 'blaizejs';

const server = createServer({
  port: 3000,
  routesDir: './src/routes',
});

await server.listen();
```

**With Middleware:**

```typescript
import { createServer, createMiddleware } from 'blaizejs';

const logger = createMiddleware({
  name: 'logger',
  handler: async (ctx, next) => {
    console.log(`→ ${ctx.request.method} ${ctx.request.path}`);
    await next();
  },
});

const server = createServer({
  middleware: [logger],
  routesDir: './src/routes',
});
```

**With Plugins:**

```typescript
import { createServer } from 'blaizejs';
import { createCachePlugin } from '@blaizejs/plugin-cache';
import { createMetricsPlugin } from '@blaizejs/plugin-metrics';

const server = createServer({
  plugins: [
    createCachePlugin({ defaultTtl: 3600 }),
    createMetricsPlugin({ enabled: true }),
  ],
  routesDir: './src/routes',
});
```

**Custom Body Limits:**

```typescript
const server = createServer({
  bodyLimits: {
    json: 10 * 1024 * 1024,  // 10MB for JSON
    form: 50 * 1024 * 1024,  // 50MB for forms (file uploads)
    text: 1 * 1024 * 1024,   // 1MB for text
  },
  routesDir: './src/routes',
});
```

---

## 📂 Route Creators

BlaizeJS provides two approaches to creating routes:

1. **Route Factory (Recommended)** — Create a typed router that shares context types across all routes
2. **Individual Route Creators** — Lower-level functions for specific use cases

### createRouteFactory (Recommended)

The route factory pattern provides automatic type inference from your server's middleware and plugins.

```typescript
// src/app.ts
import { Blaize, type InferContext } from 'blaizejs';

// 1. Create your server with middleware and plugins
const app = Blaize.createServer({
  port: 3000,
  routesDir: './src/routes',
  middleware: [authMiddleware],
  plugins: [databasePlugin()],
});

// 2. Infer context types from the server
type AppContext = InferContext;

// 3. Create a typed route factory
export const route = Blaize.Router.createRouteFactory<
  AppContext['state'],    // Types from middleware (e.g., { user: User })
  AppContext['services']  // Types from plugins (e.g., { db: Database })
>();

await app.listen();
```

The route factory provides methods for all HTTP verbs:

| Method | HTTP Verb | Has Body |
|--------|-----------|----------|
| `route.get()` | GET | No |
| `route.post()` | POST | Yes |
| `route.put()` | PUT | Yes |
| `route.patch()` | PATCH | Yes |
| `route.delete()` | DELETE | No |
| `route.head()` | HEAD | No |
| `route.options()` | OPTIONS | No |
| `route.sse()` | GET (SSE) | No |

#### Using the Route Factory

```typescript
// src/routes/users/index.ts
import { route } from '../../app';
import { z } from 'zod';

// Named exports — these names become the client method names
export const listUsers = route.get({
  schema: {
    query: z.object({ limit: z.coerce.number().default(10) }),
    response: z.array(userSchema),
  },
  handler: async (ctx) => {
    // ctx.state.user is typed from authMiddleware!
    // ctx.services.db is typed from databasePlugin!
    return await ctx.services.db.users.findMany({
      take: ctx.request.query.limit,
    });
  },
});

export const createUser = route.post({
  schema: {
    body: z.object({
      name: z.string().min(1),
      email: z.string().email(),
    }),
    response: userSchema,
  },
  handler: async (ctx) => {
    return await ctx.services.db.users.create(ctx.request.body);
  },
});
```

```typescript
// src/routes/users/[userId].ts
import { route } from '../../app';
import { z } from 'zod';
import { NotFoundError, ForbiddenError } from 'blaizejs';

export const getUser = route.get({
  schema: {
    params: z.object({ userId: z.string().uuid() }),
    response: userSchema,
  },
  handler: async (ctx, params) => {
    const user = await ctx.services.db.users.findById(params.userId);
    if (!user) throw new NotFoundError('User not found');
    return user;
  },
});

export const updateUser = route.put({
  schema: {
    params: z.object({ userId: z.string() }),
    body: updateUserSchema,
    response: userSchema,
  },
  handler: async (ctx, params) => {
    // Check authorization using typed state
    if (ctx.state.user?.id !== params.userId && ctx.state.user?.role !== 'admin') {
      throw new ForbiddenError('Cannot update other users');
    }
    return await ctx.services.db.users.update(params.userId, ctx.request.body);
  },
});

export const deleteUser = route.delete({
  schema: {
    params: z.object({ userId: z.string() }),
  },
  handler: async (ctx, params) => {
    await ctx.services.db.users.delete(params.userId);
    ctx.response.status(204);
  },
});
```

```typescript
// src/app-type.ts — Export routes registry for the client
import { listUsers, createUser } from './routes/users';
import { getUser, updateUser, deleteUser } from './routes/users/[userId]';

export const routes = {
  listUsers,
  createUser,
  getUser,
  updateUser,
  deleteUser,
} as const;
```

#### SSE Routes with the Factory

```typescript
// src/routes/jobs/[jobId]/stream.ts
import { route } from '../../../app';
import { z } from 'zod';

export const getJobStream = route.sse({
  schema: {
    params: z.object({ jobId: z.string().uuid() }),
    events: {
      progress: z.object({
        percent: z.number().min(0).max(100),
        message: z.string().optional(),
      }),
      complete: z.object({ result: z.unknown() }),
      error: z.object({ code: z.string(), message: z.string() }),
    },
  },
  handler: async (stream, ctx, params, logger) => {
    const unsubscribe = ctx.services.queue.subscribe(params.jobId, {
      onProgress: (percent, message) => stream.send('progress', { percent, message }),
      onComplete: (result) => stream.send('complete', { result }),
      onError: (code, message) => stream.send('error', { code, message }),
    });

    stream.onClose(() => {
      unsubscribe();
      logger.info('Client disconnected');
    });
  },
});

// Client usage:
// const stream = await client.$sse.getJobStream({ params: { jobId: '123' } });
// stream.on('progress', (data) => console.log(data.percent));
```

**SSE Handler Signature:**

```typescript
handler: (
  stream: TypedSSEStream,  // Send typed events
  ctx: Context,            // Request context
  params: TParams,         // Validated parameters
  logger: BlaizeLogger     // Request-scoped logger
) => Promise
```

**TypedSSEStream Methods:**

| Method | Description |
|--------|-------------|
| `send(event, data)` | Send a typed event to the client |
| `close()` | Close the SSE connection |

---

### Individual Route Creators

For cases where you don't need shared context types, or when building custom abstractions, you can use the individual route creator functions directly.

> **Note:** These are higher-order functions (they return functions). The route factory pattern above is recommended for most applications.

```typescript
import {
  createGetRoute,
  createPostRoute,
  createPutRoute,
  createPatchRoute,
  createDeleteRoute,
  createHeadRoute,
  createOptionsRoute,
  createSSERoute,
} from 'blaizejs';
```

#### Example: Using Individual Route Creators

```typescript
import { createGetRoute } from 'blaizejs';
import { z } from 'zod';

// Note: createGetRoute() returns a function
const getRoute = createGetRoute();

export const GET = getRoute({
  schema: {
    params: z.object({ userId: z.string().uuid() }),
    response: z.object({
      id: z.string(),
      name: z.string(),
    }),
  },
  handler: async (ctx, params) => {
    return await db.users.findById(params.userId);
  },
});
```

---

## 🔗 Middleware

### createMiddleware

Create middleware with typed state and service additions.

```typescript
import { createMiddleware } from 'blaizejs';

const middleware = createMiddleware({
  name?: string;
  handler: (ctx: Context, next: NextFunction) => Promise;
  skip?: (ctx: Context) => boolean;
  debug?: boolean;
});
```

#### Options

| Option | Type | Description |
|--------|------|-------------|
| `name` | `string` | Middleware name (for debugging/logging) |
| `handler` | `function` | The middleware function |
| `skip` | `function` | Optional condition to skip this middleware |
| `debug` | `boolean` | Enable debug logging |

#### Type Parameters

| Parameter | Description |
|-----------|-------------|
| `TState` | Properties added to `ctx.state` |
| `TServices` | Properties added to `ctx.services` |

#### Examples

**Logging Middleware:**

```typescript
const loggingMiddleware = createMiddleware({
  name: 'logger',
  handler: async (ctx, next) => {
    const start = Date.now();
    console.log(`→ ${ctx.request.method} ${ctx.request.path}`);
    
    await next();
    
    const duration = Date.now() - start;
    console.log(`← ${ctx.response.statusCode} (${duration}ms)`);
  },
});
```

**Authentication Middleware:**

```typescript
interface User {
  id: string;
  email: string;
  role: 'admin' | 'user';
}

interface AuthService {
  verify(token: string): Promise;
}

const authMiddleware = createMiddleware<
  { user: User },
  { auth: AuthService }
>({
  name: 'auth',
  handler: async (ctx, next) => {
    const token = ctx.request.header('authorization')?.replace('Bearer ', '');
    
    if (!token) {
      throw new UnauthorizedError('Missing authentication token');
    }
    
    try {
      ctx.state.user = await authService.verify(token);
      ctx.services.auth = authService;
    } catch (error) {
      throw new UnauthorizedError('Invalid token');
    }
    
    await next();
  },
  skip: (ctx) => ctx.request.path === '/health',
});
```

**Timing Middleware:**

```typescript
const timingMiddleware = createMiddleware({
  name: 'timing',
  handler: async (ctx, next) => {
    ctx.state.requestStart = Date.now();
    await next();
    
    const duration = Date.now() - ctx.state.requestStart;
    ctx.response.header('X-Response-Time', `${duration}ms`);
  },
});
```

### createStateMiddleware

Shorthand for middleware that only adds state.

```typescript
import { createStateMiddleware } from 'blaizejs';

const timingMiddleware = createStateMiddleware(
  async (ctx, next) => {
    ctx.state.startTime = Date.now();
    await next();
  }
);
```

### createServiceMiddleware

Shorthand for middleware that only adds services.

```typescript
import { createServiceMiddleware } from 'blaizejs';

const dbMiddleware = createServiceMiddleware(
  async (ctx, next) => {
    ctx.services.db = database;
    await next();
  }
);
```

### compose

Combine multiple middleware into a single middleware.

```typescript
import { compose } from 'blaizejs';

const combined = compose([
  loggingMiddleware,
  authMiddleware,
  timingMiddleware,
]);

const server = createServer({
  middleware: [combined],
  routesDir: './routes',
});
```

---

## 🔌 Plugins

### createPlugin

Create a plugin with lifecycle hooks and service injection.

```typescript
import { createPlugin } from 'blaizejs';

const plugin = createPlugin(
  name: string,
  version: string,
  setup: (server: Server, options: TOptions) => void | PluginHooks | Promise,
  defaultOptions?: Partial
);
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | `string` | Unique plugin identifier |
| `version` | `string` | Plugin version (SemVer) |
| `setup` | `function` | Setup function called during registration |
| `defaultOptions` | `object` | Default option values |

#### Plugin Hooks

| Hook | When | Use Case |
|------|------|----------|
| `register` | During `createServer()` | Add middleware, register routes |
| `initialize` | Before `server.listen()` | Connect to databases, warm caches |
| `onServerStart` | After server is listening | Start background workers |
| `onServerStop` | Before `server.close()` | Stop accepting work |
| `terminate` | During shutdown | Disconnect resources |

#### Examples

**Simple Plugin:**

```typescript
const helloPlugin = createPlugin(
  'hello',
  '1.0.0',
  (server) => {
    console.log('Hello plugin registered!');
    
    return {
      onServerStart: () => {
        console.log('Server started!');
      },
    };
  }
);

const server = createServer({
  plugins: [helloPlugin()],
});
```

**Plugin with Services:**

```typescript
interface DatabaseOptions {
  connectionString: string;
  poolSize?: number;
}

const databasePlugin = createPlugin(
  'database',
  '1.0.0',
  (server, options) => {
    let db: Database;
    
    // Inject database into context
    server.use(createMiddleware({
      name: 'database-injection',
      handler: async (ctx, next) => {
        ctx.services.db = db;
        await next();
      },
    }));
    
    return {
      initialize: async () => {
        db = await Database.connect(options.connectionString, {
          poolSize: options.poolSize,
        });
        console.log('Database connected');
      },
      terminate: async () => {
        await db.disconnect();
        console.log('Database disconnected');
      },
    };
  },
  { poolSize: 10 }  // Default options
);

// Usage
const server = createServer({
  plugins: [
    databasePlugin({ connectionString: 'postgres://localhost/mydb' }),
  ],
});
```

---

## ⚠️ Error Classes

BlaizeJS provides 12 semantic error classes that automatically format to HTTP responses.

### Error Response Format

All errors produce this response structure:

```json
{
  "type": "ERROR_TYPE",
  "title": "Error message",
  "status": 400,
  "correlationId": "req_k3x2m1_9z8y7w6v",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "details": { }
}
```

### Error Classes Reference

| Class | Status | Use Case |
|-------|--------|----------|
| `ValidationError` | 400 | Schema validation failures, invalid input |
| `UnauthorizedError` | 401 | Missing or invalid authentication |
| `ForbiddenError` | 403 | Authenticated but not authorized |
| `NotFoundError` | 404 | Resource doesn't exist |
| `ConflictError` | 409 | Resource state conflict (duplicate, version mismatch) |
| `RequestTimeoutError` | 408 | Request took too long |
| `PayloadTooLargeError` | 413 | Request body exceeds limit |
| `UnsupportedMediaTypeError` | 415 | Wrong content type |
| `UnprocessableEntityError` | 422 | Valid syntax but invalid semantics |
| `RateLimitError` | 429 | Too many requests |
| `InternalServerError` | 500 | Unexpected server error |
| `ServiceNotAvailableError` | 503 | Dependency unavailable |

### Usage

```typescript
import {
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  RateLimitError,
} from 'blaizejs';

// Basic usage
throw new NotFoundError('User not found');

// With details
throw new NotFoundError('User not found', {
  resourceType: 'user',
  resourceId: userId,
  suggestion: 'Verify the user ID exists',
});

// Validation error with field details
throw new ValidationError('Invalid input', {
  fields: {
    email: 'Must be a valid email address',
    age: 'Must be at least 18',
  },
});

// Rate limit with retry info
throw new RateLimitError('Too many requests', {
  retryAfter: 60,
  limit: 100,
  remaining: 0,
});

// Conflict with version info
throw new ConflictError('Version mismatch', {
  currentVersion: 5,
  providedVersion: 3,
});
```

### Custom Correlation ID

```typescript
// Use custom correlation ID (for distributed tracing)
throw new NotFoundError('User not found', {}, 'custom-trace-id-123');
```

---

## 📝 Logging

### Global Logger

```typescript
import { logger } from 'blaizejs';

logger.info('Server started', { port: 3000 });
logger.warn('Cache miss', { key: 'user:123' });
logger.error('Database error', { error: err.message });
logger.debug('Request received', { path: '/users' });
```

### createLogger

Create a custom logger with specific transports.

```typescript
import { createLogger, ConsoleTransport, JSONTransport } from 'blaizejs';

const customLogger = createLogger({
  level: 'info',
  transports: [
    new ConsoleTransport({ colorize: true }),
    new JSONTransport({ destination: './logs/app.log' }),
  ],
});
```

### Available Transports

| Transport | Description |
|-----------|-------------|
| `ConsoleTransport` | Logs to stdout with optional colors |
| `JSONTransport` | Logs as JSON to file or stream |
| `NullTransport` | Discards all logs (for testing) |

### Route Handler Logger

Route handlers receive a request-scoped logger as the third parameter:

```typescript
export const getUser = route.get({
  schema: {
    params: z.object({ userId: z.string() }),
  },
  handler: async (ctx, params, logger) => {
    logger.info('Fetching user', { userId: params.userId });
    // Log includes correlation ID automatically
    
    const user = await db.users.findById(params.userId);
    
    logger.debug('User found', { user });
    return user;
  },
});
```

### configureGlobalLogger

Configure the global logger instance.

```typescript
import { configureGlobalLogger, JSONTransport } from 'blaizejs';

configureGlobalLogger({
  level: process.env.LOG_LEVEL || 'info',
  transports: [
    new JSONTransport({ pretty: process.env.NODE_ENV !== 'production' }),
  ],
});
```

---

## 🛠️ Utilities

### getCorrelationId

Get the current request's correlation ID (from AsyncLocalStorage).

```typescript
import { getCorrelationId } from 'blaizejs';

function someDeepFunction() {
  const correlationId = getCorrelationId();
  console.log(`Processing request ${correlationId}`);
}
```

### cors

CORS middleware for cross-origin requests.

```typescript
import { createServer, cors } from 'blaizejs';

const server = createServer({
  middleware: [
    cors({
      origin: 'https://example.com',
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
      maxAge: 86400,
    }),
  ],
  routesDir: './routes',
});
```

#### CORS Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `origin` | `string \| string[] \| function` | `'*'` | Allowed origins |
| `methods` | `string[]` | `['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE']` | Allowed methods |
| `allowedHeaders` | `string[]` | — | Allowed request headers |
| `exposedHeaders` | `string[]` | — | Headers to expose to client |
| `credentials` | `boolean` | `false` | Allow credentials |
| `maxAge` | `number` | — | Preflight cache duration (seconds) |

#### Examples

**Multiple Origins:**

```typescript
cors({
  origin: ['https://app.example.com', 'https://admin.example.com'],
});
```

**Dynamic Origin:**

```typescript
cors({
  origin: (origin) => {
    return origin?.endsWith('.example.com') ?? false;
  },
});
```

---

## 📦 Context Reference

The `Context` object is available in all route handlers and middleware.

### ctx.request

| Property/Method | Type | Description |
|-----------------|------|-------------|
| `method` | `string` | HTTP method (GET, POST, etc.) |
| `path` | `string` | Request path |
| `url` | `string \| null` | Full URL |
| `query` | `Record<string, unknown>` | Parsed query parameters |
| `params` | `Record<string, string>` | Route parameters |
| `body` | `unknown` | Parsed request body |
| `protocol` | `'http' \| 'https'` | Request protocol |
| `isHttp2` | `boolean` | Whether using HTTP/2 |
| `header(name)` | `string \| undefined` | Get a header value |
| `headers(names?)` | `Record<string, string>` | Get multiple headers |
| `raw` | `IncomingMessage` | Raw Node.js request |

### ctx.response

| Property/Method | Type | Description |
|-----------------|------|-------------|
| `sent` | `boolean` | Whether response was sent |
| `statusCode` | `number` | Current status code |
| `status(code)` | `ContextResponse` | Set status code (chainable) |
| `json(data)` | `ContextResponse` | Send JSON response |
| `html(content)` | `ContextResponse` | Send HTML response |
| `text(content)` | `ContextResponse` | Send text response |
| `redirect(url, code?)` | `ContextResponse` | Redirect response |
| `stream(readable)` | `ContextResponse` | Stream response |
| `header(name, value)` | `ContextResponse` | Set a header (chainable) |
| `headers(headers)` | `ContextResponse` | Set multiple headers |

### ctx.state

Request-scoped data added by middleware:

```typescript
// Added by authMiddleware
ctx.state.user       // User object

// Added by timingMiddleware
ctx.state.startTime  // number
```

### ctx.services

Plugin-injected services:

```typescript
// Added by databasePlugin
ctx.services.db      // Database instance

// Added by cachePlugin
ctx.services.cache   // CacheService

// Added by queuePlugin
ctx.services.queue   // QueueService
```

> 🔒 **Note:** `createContext` is internal and not exported. For testing, use `createTestContext` from `@blaizejs/testing-utils`.

---

## 🧪 Testing

BlaizeJS integrates with [Vitest](https://vitest.dev/) through the `@blaizejs/testing-utils` package.

### Quick Setup

```bash
pnpm add -D vitest @blaizejs/testing-utils
```

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
  },
});
```

### Testing Routes

```typescript
import { describe, it, expect } from 'vitest';
import { createTestContext, createMockLogger } from '@blaizejs/testing-utils';
import { GET } from './routes/users/[userId]';

describe('GET /users/:userId', () => {
  it('returns user by id', async () => {
    const ctx = createTestContext({
      method: 'GET',
      path: '/users/123',
      params: { userId: '123' },
    });
    const logger = createMockLogger();
    
    const result = await GET.handler(ctx, { userId: '123' }, logger);
    
    expect(result.id).toBe('123');
    expect(result.name).toBeDefined();
  });
  
  it('throws NotFoundError for missing user', async () => {
    const ctx = createTestContext({
      params: { userId: 'nonexistent' },
    });
    const logger = createMockLogger();
    
    await expect(
      GET.handler(ctx, { userId: 'nonexistent' }, logger)
    ).rejects.toThrow(NotFoundError);
  });
});
```

### Testing Middleware

```typescript
import { describe, it, expect, vi } from 'vitest';
import { createTestContext } from '@blaizejs/testing-utils';
import { authMiddleware } from './middleware/auth';

describe('authMiddleware', () => {
  it('adds user to state when token is valid', async () => {
    const ctx = createTestContext({
      headers: { authorization: 'Bearer valid-token' },
    });
    const next = vi.fn();
    
    await authMiddleware.handler(ctx, next);
    
    expect(ctx.state.user).toBeDefined();
    expect(ctx.state.user.id).toBe('user-123');
    expect(next).toHaveBeenCalled();
  });
  
  it('throws UnauthorizedError when token is missing', async () => {
    const ctx = createTestContext();
    const next = vi.fn();
    
    await expect(
      authMiddleware.handler(ctx, next)
    ).rejects.toThrow(UnauthorizedError);
    
    expect(next).not.toHaveBeenCalled();
  });
});
```

### Mocking Services

```typescript
import { describe, it, expect, vi } from 'vitest';
import { createTestContext } from '@blaizejs/testing-utils';
import { POST } from './routes/users';

describe('POST /users', () => {
  it('creates user with mocked database', async () => {
    const mockDb = {
      users: {
        create: vi.fn().mockResolvedValue({
          id: 'new-user-123',
          name: 'John',
          email: 'john@example.com',
        }),
      },
    };
    
    const ctx = createTestContext({
      method: 'POST',
      body: { name: 'John', email: 'john@example.com' },
      services: { db: mockDb },
    });
    
    const result = await POST.handler(ctx, {}, createMockLogger());
    
    expect(result.id).toBe('new-user-123');
    expect(mockDb.users.create).toHaveBeenCalledWith({
      name: 'John',
      email: 'john@example.com',
    });
  });
});
```

### Mock Logger

```typescript
import { createMockLogger } from '@blaizejs/testing-utils';

const logger = createMockLogger();

// Use in tests
await handler(ctx, params, logger);

// Assert logs
expect(logger.logs).toContainEqual({
  level: 'info',
  message: 'User created',
  meta: expect.objectContaining({ userId: '123' }),
});
```

See [`@blaizejs/testing-utils`](../blaize-testing-utils/README.md) for the full testing API.

---

## 🗺️ Roadmap

### 🎯 v1.0 (Stable)

- [ ] Redis adapter for queue plugin
- [ ] Rate limiting plugin (`@blaizejs/plugin-rate-limit`)
- [ ] Compression middleware (`@blaizejs/middleware-compression`)
- [ ] Database plugin with migrations (`@blaizejs/plugin-db`)
- [ ] Storage plugin (`@blaizejs/plugin-storage`)
- [ ] OpenAPI/Swagger generation

### 🔮 Future

- [ ] Authentication plugin (`@blaizejs/plugin-auth`)
- [ ] Edge runtime support
- [ ] External queue workers
- [ ] HTTP/2 hosting solutions
- [ ] Deeper AI integrations

---

## 📚 Related

- [`@blaizejs/client`](../blaize-client/README.md) — Type-safe RPC client
- [`@blaizejs/testing-utils`](../blaize-testing-utils/README.md) — Testing utilities
- [Architecture Guide](../../docs/ARCHITECTURE.md) — How BlaizeJS works
- [Getting Started](../../docs/GETTING-STARTED.md) — Build your first project

---

## 📄 License

MIT © [BlaizeJS Contributors](https://github.com/jleajones/blaize/graphs/contributors)

---

**Built with ❤️ by the BlaizeJS team**