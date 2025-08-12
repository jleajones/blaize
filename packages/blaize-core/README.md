# 🔥 BlaizeJS Core

> **Type-safe, blazing-fast Node.js framework** with HTTP/2 support, file-based routing, powerful middleware system, and end-to-end type safety for building modern APIs

[![npm version](https://badge.fury.io/js/blaizejs.svg)](https://badge.fury.io/js/blaizejs)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

## 📋 Table of Contents

- [🌟 Features](#-features)
- [📦 Installation](#-installation)
- [🚀 Quick Start](#-quick-start)
- [📖 Core Modules](#-core-modules)
- [🛡️ Error Handling](#️-error-handling)
- [🎯 API Reference](#-api-reference)
- [💡 Common Patterns](#-common-patterns)
- [🧪 Testing](#-testing)
- [📚 Type System](#-type-system)
- [🗺️ Roadmap](#️-roadmap)
- [🤝 Contributing](#-contributing)

## 🌟 Features

- 🚀 **HTTP/2 by Default** - Modern protocol with automatic HTTPS in development
- 📁 **File-Based Routing** - Routes auto-discovered from file structure *(internal)*
- 🔧 **Composable Middleware** - Build reusable request/response pipelines
- 🧩 **Plugin System** - Extend server functionality with lifecycle hooks
- ✅ **Schema Validation** - Built-in Zod validation for type safety
- 🛡️ **Semantic Errors** - Rich error classes with automatic formatting
- 🔗 **Context Management** - AsyncLocalStorage-powered state isolation *(internal)*
- ⚡ **Zero Configuration** - Works out of the box with sensible defaults
- 📊 **Type Inference** - Full TypeScript support with automatic types
- 🔄 **Hot Reloading** - Development mode with automatic route updates

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

### Creating Your First Server

```typescript
import { createServer, createGetRoute, createPostRoute } from 'blaizejs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { z } from 'zod';

// ESM path resolution (required for route discovery)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create server with file-based routing
const server = createServer({
  port: 3000,
  host: 'localhost',
  routesDir: path.resolve(__dirname, './routes')
});

await server.listen();
console.log(`🚀 Server running at https://localhost:3000`);
```

### Creating Routes

Create route files in your routes directory:

```typescript
// routes/users/[userId].ts
import { createGetRoute, createPutRoute, NotFoundError } from 'blaizejs';
import { z } from 'zod';

// GET /users/:userId
export const GET = createGetRoute({
  schema: {
    params: z.object({
      userId: z.string().uuid()
    }),
    response: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string()
    })
  },
  handler: async (ctx, params) => {
    const user = await db.users.findById(params.userId);
    
    if (!user) {
      throw new NotFoundError('User not found', {
        resourceType: 'user',
        resourceId: params.userId
      });
    }
    
    return user;
  }
});

// PUT /users/:userId
export const PUT = createPutRoute({
  schema: {
    params: z.object({
      userId: z.string().uuid()
    }),
    body: z.object({
      name: z.string().min(1),
      email: z.string().email()
    })
  },
  handler: async (ctx, params) => {
    const updatedUser = await db.users.update(params.userId, ctx.body);
    return updatedUser;
  }
});
```

## 📖 Core Modules

BlaizeJS Core consists of several integrated modules. Some are exported for direct use, while others work internally:

### 🌐 Server Module *(Exported)*

Create HTTP/2 servers with automatic HTTPS, middleware, and plugins:

```typescript
import { createServer, createMiddleware, createPlugin } from 'blaizejs';

const server = createServer({
  port: 3000,
  routesDir: './routes',
  http2: { enabled: true },  // Auto-generates dev certificates
  middleware: [loggingMiddleware],
  plugins: [metricsPlugin()]
});

// Add middleware after creation
server.use(corsMiddleware);

// Register plugins dynamically
await server.register(databasePlugin());

await server.listen();
```

### 🚀 Router Module *(Partially Exported)*

**⚠️ Note**: The router itself is internal. Only route creation functions are exported.

#### Available Exports:
- ✅ `createGetRoute` - Create GET endpoints
- ✅ `createPostRoute` - Create POST endpoints  
- ✅ `createPutRoute` - Create PUT endpoints
- ✅ `createPatchRoute` - Create PATCH endpoints
- ✅ `createDeleteRoute` - Create DELETE endpoints
- ✅ `createHeadRoute` - Create HEAD endpoints
- ✅ `createOptionsRoute` - Create OPTIONS endpoints

#### Internal (Not Exported):
- ❌ `Router` interface - Used internally by server
- ❌ `Matcher` - Internal route matching
- ❌ `extractParams` - Internal parameter extraction
- ❌ Route discovery utilities - Internal file system operations

```typescript
// ✅ This is how you use routing:
export const GET = createGetRoute({
  schema: { /* ... */ },
  handler: async (ctx) => { /* ... */ }
});

// ❌ You cannot directly access the router:
// import { Router } from 'blaizejs'; // NOT AVAILABLE
```

### 🔧 Middleware Module *(Exported)*

Build composable request/response pipelines:

```typescript
import { createMiddleware, compose } from 'blaizejs';

// Simple middleware
const logger = createMiddleware(async (ctx, next) => {
  console.log(`→ ${ctx.request.method} ${ctx.request.path}`);
  await next();
  console.log(`← ${ctx.response.statusCode}`);
});

// Middleware with options
const auth = createMiddleware({
  name: 'auth',
  handler: async (ctx, next) => {
    const token = ctx.request.header('authorization');
    if (!token) {
      throw new UnauthorizedError('No token provided');
    }
    ctx.state.user = await verifyToken(token);
    await next();
  },
  skip: ctx => ctx.request.path.startsWith('/public')
});

// Compose multiple middleware
const apiMiddleware = compose([cors, auth, rateLimit]);
```

### 🧩 Plugins Module *(Exported)*

Extend server functionality with lifecycle hooks:

```typescript
import { createPlugin } from 'blaizejs';

const databasePlugin = createPlugin(
  'database',
  '1.0.0',
  (server) => {
    let connection;
    
    return {
      initialize: async () => {
        connection = await db.connect();
        console.log('Database connected');
      },
      onServerStart: async () => {
        await connection.migrate();
      },
      onServerStop: async () => {
        await connection.close();
      },
      terminate: async () => {
        console.log('Database plugin terminated');
      }
    };
  }
);

// Use in server
const server = createServer({
  plugins: [databasePlugin()]
});
```

### 🔗 Context Module *(Internal)*

**⚠️ Note**: Context is automatically managed. You interact with it in handlers.

Context is automatically provided to all route handlers and middleware:

```typescript
// Context is the first parameter in handlers
export const GET = createGetRoute({
  handler: async (ctx) => {
    // Request information
    const userId = ctx.request.header('x-user-id');
    const query = ctx.request.query;
    
    // State management
    ctx.state.requestStart = Date.now();
    
    // Response methods (usually return instead)
    // ctx.response.json({ data });
    // ctx.response.redirect('/login');
    
    return { message: 'Hello' };
  }
});
```

## 🛡️ Error Handling

### Available Error Classes

BlaizeJS exports semantic error classes that automatically format responses:

```typescript
import {
  ValidationError,            // 400 - Bad Request
  UnauthorizedError,          // 401 - Authentication Required
  ForbiddenError,             // 403 - Access Denied
  NotFoundError,              // 404 - Resource Not Found
  RequestTimeoutError,        // 408 - Request Timeout
  ConflictError,              // 409 - Resource Conflict
  PayloadTooLargeError,       // 413 - Payload Too Large
  UnsupportedMediaTypeError,  // 415 - Unsupported Media Type
  UnprocessableEntityError,   // 422 - Unprocessable Entity
  RateLimitError,             // 429 - Too Many Requests
  InternalServerError         // 500 - Server Error
} from 'blaizejs';

// Throw semantic errors
throw new NotFoundError('User not found', {
  resourceType: 'user',
  resourceId: params.userId,
  suggestion: 'Check the user ID'
});

// Automatic response format:
// {
//   "type": "NOT_FOUND",
//   "title": "User not found", 
//   "status": 404,
//   "correlationId": "req_abc123",
//   "timestamp": "2024-01-15T10:30:00.000Z",
//   "details": { ... }
// }
```

### Additional Error Classes

The following error classes are also available for specific scenarios:

```typescript
import {
  PayloadTooLargeError,      // 413 - Request Entity Too Large
  UnsupportedMediaTypeError,  // 415 - Unsupported Media Type
  RequestTimeoutError,        // 408 - Request Timeout
  UnprocessableEntityError    // 422 - Unprocessable Entity
} from 'blaizejs';

// File size exceeded
throw new PayloadTooLargeError('File too large', {
  fileCount: 11,
  maxFiles: 10,
  filename: 'huge-video.mp4',
  currentSize: 104857600,  // 100MB
  maxSize: 52428800        // 50MB
});

// Wrong content type
throw new UnsupportedMediaTypeError('File type not allowed', {
  receivedMimeType: 'application/x-executable',
  allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf'],
  filename: 'virus.exe'
});

// Request timeout
throw new RequestTimeoutError('Upload timeout', {
  timeoutMs: 30000,
  elapsedMs: 31000,
  operation: 'file-upload'
});

// Business rule violation
throw new UnprocessableEntityError('Business rule violation', {
  rule: 'minimum_order_amount',
  currentValue: 5.00,
  requiredValue: 10.00,
  message: 'Order total must be at least $10.00'
});
```

## 🎯 API Reference

### Exported Functions

| Function | Description |
|----------|-------------|
| **Server** | |
| `createServer(options?)` | Create HTTP/2 server instance |
| **Routing** | |
| `createGetRoute(config)` | Create GET endpoint |
| `createPostRoute(config)` | Create POST endpoint |
| `createPutRoute(config)` | Create PUT endpoint |
| `createPatchRoute(config)` | Create PATCH endpoint |
| `createDeleteRoute(config)` | Create DELETE endpoint |
| `createHeadRoute(config)` | Create HEAD endpoint |
| `createOptionsRoute(config)` | Create OPTIONS endpoint |
| **Middleware** | |
| `createMiddleware(handler)` | Create middleware instance |
| `compose(middleware[])` | Compose multiple middleware |
| **Plugins** | |
| `createPlugin(name, version, factory)` | Create server plugin |
| **Errors** | |
| `ValidationError` | 400 Bad Request |
| `UnauthorizedError` | 401 Unauthorized |
| `ForbiddenError` | 403 Forbidden |
| `NotFoundError` | 404 Not Found |
| `RequestTimeoutError` | 408 Request Timeout |
| `ConflictError` | 409 Conflict |
| `PayloadTooLargeError` | 413 Payload Too Large |
| `UnsupportedMediaTypeError` | 415 Unsupported Media Type |
| `UnprocessableEntityError` | 422 Unprocessable Entity |
| `RateLimitError` | 429 Too Many Requests |
| `InternalServerError` | 500 Internal Server Error |

### Exported Types

All types are re-exported from `@blaize-types`:

```typescript
import type {
  // Server types
  Server,
  ServerOptionsInput,
  
  // Middleware types
  Middleware,
  MiddlewareFunction,
  MiddlewareOptions,
  NextFunction,
  
  // Plugin types
  Plugin,
  PluginFactory,
  PluginHooks,
  
  // Router types (limited export)
  HttpMethod,
  RouteHandler,
  RouteMethodOptions,
  
  // Context types
  Context,
  
  // Error types
  BlaizeError,
  ErrorType
} from 'blaizejs';
```

## 💡 Common Patterns

### Protected Routes

```typescript
const authMiddleware = createMiddleware({
  name: 'auth',
  handler: async (ctx, next) => {
    const token = ctx.request.header('authorization');
    if (!token) {
      throw new UnauthorizedError('Authentication required');
    }
    ctx.state.user = await verifyToken(token);
    await next();
  }
});

export const GET = createGetRoute({
  middleware: [authMiddleware],
  handler: async (ctx) => {
    return { user: ctx.state.user };
  }
});
```

### Request Validation

```typescript
export const POST = createPostRoute({
  schema: {
    body: z.object({
      email: z.string().email(),
      password: z.string().min(8),
      age: z.number().int().positive().optional()
    })
  },
  handler: async (ctx) => {
    // Body is fully validated and typed
    const user = await createUser(ctx.body);
    return user;
  }
});
```

### Error Handling

```typescript
export const GET = createGetRoute({
  handler: async (ctx, params) => {
    try {
      const resource = await findResource(params.id);
      
      if (!resource) {
        throw new NotFoundError('Resource not found', {
          resourceType: 'item',
          resourceId: params.id
        });
      }
      
      if (!hasPermission(ctx.state.user, resource)) {
        throw new ForbiddenError('Access denied', {
          resource: resource.id,
          requiredPermission: 'read'
        });
      }
      
      return resource;
    } catch (error) {
      // Framework automatically handles error responses
      throw error;
    }
  }
});
```

## 🧪 Testing

Use `@blaizejs/testing-utils` for testing:

```typescript
import { createTestContext } from '@blaizejs/testing-utils';
import { describe, test, expect } from 'vitest';

describe('User Routes', () => {
  test('GET /users/:id returns user', async () => {
    const ctx = createTestContext({
      method: 'GET',
      path: '/users/123'
    });
    
    const handler = createGetRoute({
      handler: async (ctx, params) => {
        return { id: params.userId, name: 'Test User' };
      }
    });
    
    const result = await handler.handler(ctx, { userId: '123' });
    expect(result.id).toBe('123');
  });
});
```

## 📚 Type System

BlaizeJS provides full type safety through TypeScript:

### Automatic Type Inference

```typescript
const route = createPostRoute({
  schema: {
    body: z.object({
      name: z.string(),
      age: z.number()
    }),
    response: z.object({
      id: z.string(),
      created: z.boolean()
    })
  },
  handler: async (ctx) => {
    // ctx.body is typed as { name: string; age: number }
    // Return type must match response schema
    return {
      id: '123',
      created: true
    };
  }
});
```

### Custom Type Extensions

```typescript
// Extend context state
declare module 'blaizejs' {
  interface State {
    user?: {
      id: string;
      role: string;
    };
  }
}
```

## 🗺️ Roadmap

### 🚀 Current Beta (v0.3.1)

- ✅ Core server with HTTP/2 support
- ✅ File-based routing (internal)
- ✅ Middleware system
- ✅ Plugin architecture
- ✅ 11 semantic error classes (400-500 status codes)
- ✅ Schema validation with Zod
- ✅ Context management (internal)
- ✅ Type-safe route creation

### 🎯 MVP/1.0 Release

#### Core Improvements
- 🔄 **Export Router Utilities** - Parameter extraction, route matching for extensions
- 🔄 **Custom Error Factory** - Allow user-defined error classes
- 🔄 **Enhanced Testing Utils** - More comprehensive testing helpers
- 🔄 **Performance Monitoring** - Built-in metrics and profiling
- 🔄 **Additional HTTP Status Codes** - 405, 502, 503, 504 error classes

#### New Features
- 🔄 **WebSocket Support** - Real-time communication
- 🔄 **Response Helpers** - Utility functions for common responses
- 🔄 **Route Metadata** - Attach custom metadata to routes
- 🔄 **Built-in Middleware** - CORS, compression, security headers
- 🔄 **Request Streaming** - Handle large payloads efficiently

### 🔮 Post-MVP (v1.1+)

- 🔄 **GraphQL Integration** - Built-in GraphQL support
- 🔄 **gRPC Support** - Protocol buffer services
- 🔄 **OpenAPI Generation** - Automatic API documentation
- 🔄 **Distributed Tracing** - OpenTelemetry integration
- 🔄 **Edge Runtime Support** - Cloudflare Workers, Deno Deploy
- 🔄 **Bun Compatibility** - Native Bun.serve integration

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](../../CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/jleajones/blaize.git
cd blaize

# Install dependencies
pnpm install

# Run tests
pnpm test

# Build packages
pnpm build

# Run examples
pnpm --filter blaizejs dev
```

### Package Structure

```
packages/
├── blaize-core/          # Main framework (this package)
│   ├── src/
│   │   ├── server/       # Server implementation
│   │   ├── router/       # Router (mostly internal)
│   │   ├── middleware/   # Middleware system
│   │   ├── plugins/      # Plugin system
│   │   ├── context/      # Context (internal)
│   │   ├── errors/       # Error classes
│   │   └── index.ts      # Main exports
│   └── package.json
├── blaize-types/         # Shared TypeScript types
├── blaize-client/        # Client SDK
└── blaize-testing-utils/ # Testing utilities
```

### Important Notes

When contributing to BlaizeJS Core:

1. **Check Exports**: Ensure new features are exported in `src/index.ts`
2. **Update Types**: Add types to `@blaize-types` package
3. **Document Internal APIs**: Mark internal-only features clearly
4. **Add Tests**: Use `@blaizejs/testing-utils` for testing
5. **Follow Patterns**: Match existing code style and patterns

---

**Built with ❤️ by the BlaizeJS team**

_For questions or issues, please [open an issue](https://github.com/jleajones/blaize/issues) on GitHub._