# 🔗 BlaizeJS Context Module

> _(Internal Module - Used automatically by BlaizeJS)_
>
> Powerful request/response context management with AsyncLocalStorage, state isolation, and type-safe API access

[![npm version](https://badge.fury.io/js/blaizejs.svg)](https://badge.fury.io/js/blaizejs)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

## ⚠️ Important Note

**The context module is primarily internal to BlaizeJS.** While the `createContext` function exists in the codebase, it's not exported from the main package. Context management happens automatically through the framework. Users interact with context through helper functions that are available when needed.

## 📋 Table of Contents

- [🌟 Features](#-features)
- [📦 Installation](#-installation)
- [🚀 Quick Start](#-quick-start)
- [📖 Core Concepts](#-core-concepts)
- [🔧 Available Context Functions](#-available-context-functions)
- [🏪 State Management](#-state-management)
- [🛡️ Error Handling](#-error-handling)
- [✅ Testing](#-testing)
- [🗺️ Roadmap](#️-roadmap)

## 🌟 Features

- ⚡ **AsyncLocalStorage integration** for automatic context propagation
- 🔒 **Type-safe request/response handling** with full TypeScript support
- 🏪 **Advanced state management** with namespaced and typed state accessors
- 🌐 **HTTP/1.1 and HTTP/2 support** with unified API
- 📤 **Rich response methods** (JSON, HTML, streaming, redirects)
- 🛡️ **Built-in error protection** against double responses and invalid operations
- 🔍 **Request parsing** with automatic body handling for JSON, form data, and text
- 📂 **File upload support** with multipart/form-data handling
- 📊 **Query and parameter parsing** with array support
- 🎯 **Context binding** for preserving context across async operations
- 🚀 **High performance** with minimal overhead and memory efficiency

## 📦 Installation

The context module is included with BlaizeJS:

```bash
# Using pnpm (recommended)
pnpm add blaizejs

# Using npm
npm install blaizejs

# Using yarn
yarn add blaizejs
```

## 🚀 Quick Start

### Automatic Context in Route Handlers

Context is automatically provided to all route handlers and middleware:

```typescript
import { createServer, createGetRoute } from 'blaizejs';

// Context is automatically injected into route handlers
export const getUserProfile = createGetRoute({
  handler: async ctx => {
    // Context is provided as the first parameter
    const userId = ctx.request.header('x-user-id');
    const userAgent = ctx.request.header('user-agent');

    // Store data in request-scoped state
    ctx.state.requestStart = Date.now();

    // Pass context to helper functions that need it
    const profile = await fetchUserData(ctx, userId);

    // Return response
    return {
      profile,
      userAgent,
      processingTime: Date.now() - ctx.state.requestStart,
    };
  },
});

// Helper functions should receive context as a parameter
async function fetchUserData(ctx: Context, userId: string) {
  // Use the passed context
  const correlationId = ctx.request.header('x-correlation-id');
  console.log(`Fetching user ${userId} [${correlationId}]`);

  // Fetch user data...
  return { id: userId, name: 'John Doe' };
}

// Start server - context management is automatic
const server = createServer({
  routesDir: './routes',
});

await server.listen();
```

## 📖 Core Concepts

### 🔄 How Context Works Internally

BlaizeJS uses Node.js AsyncLocalStorage behind the scenes to manage context throughout the request lifecycle:

1. **Server receives request** → Creates context automatically
2. **Error boundary middleware** → Catches all errors with context
3. **Middleware runs** → Receives context as first parameter
4. **Route handler executes** → Receives context as first parameter
5. **Response is sent** → Context is cleaned up automatically

```typescript
// This is what happens internally (you don't write this):

// 1. Server creates context for each request (internal)
const context = await createContext(req, res);

// 2. Error boundary catches all errors
const errorBoundary = createErrorBoundary();

// 3. Your middleware receives context
await middleware(context, next);

// 4. Your route handler receives context
const result = await handler(context);

// 5. Response sent and context cleaned up
context.response.json(result);
```

### 📝 Context Structure

The context object passed to your handlers contains:

```typescript
interface Context {
  request: {
    // Request information
    method: string; // 'GET', 'POST', etc.
    path: string; // '/api/users/123'
    url: URL | null; // Full URL object
    query: QueryParams; // Parsed query parameters
    params: RouteParams; // Route parameters (/:id)
    body: any; // Parsed request body
    protocol: string; // 'http' or 'https'
    isHttp2: boolean; // HTTP/2 flag

    // Header access
    header(name: string): string | undefined;
    headers(names?: string[]): Record<string, string | undefined>;

    // Raw Node.js request
    raw: IncomingMessage | Http2ServerRequest;
  };

  response: {
    // Response methods
    status(code: number): this;
    header(name: string, value: string): this;
    headers(headers: Record<string, string>): this;
    type(contentType: string): this;

    // Send response
    json(data: any, status?: number): void;
    text(content: string, status?: number): void;
    html(content: string, status?: number): void;
    redirect(location: string, status?: number): void;
    stream(readable: Readable, options?: StreamOptions): void;

    // Response state
    sent: boolean; // Has response been sent?

    // Raw Node.js response
    raw: ServerResponse | Http2ServerResponse;
  };

  state: Record<string, any>; // Request-scoped state storage
}
```

## 🔧 Available Context Functions

### Context Access in Handlers

```typescript
import { createGetRoute, createPostRoute } from 'blaizejs';

// GET route with context
export const getUser = createGetRoute({
  handler: async ctx => {
    const userId = ctx.request.params.id;
    const includeDetails = ctx.request.query.details === 'true';

    // Use context directly
    if (!userId) {
      ctx.response.status(400).json({
        error: 'User ID required',
      });
      return;
    }

    // Or return data (framework handles response)
    return { userId, includeDetails };
  },
});

// POST route with body parsing
export const createUser = createPostRoute({
  handler: async ctx => {
    const userData = ctx.request.body;

    // Validate and process...
    const user = await saveUser(userData);

    // Set custom headers
    ctx.response.status(201).header('X-User-Id', user.id).json(user);
  },
});
```

### Response Methods

```typescript
export const responseExamples = createGetRoute({
  handler: async ctx => {
    // JSON response
    ctx.response.json({ message: 'Hello' });

    // HTML response
    ctx.response.html('<h1>Welcome</h1>');

    // Text response
    ctx.response.text('Plain text response');

    // Redirect
    ctx.response.redirect('/new-location', 301);

    // Stream response
    const stream = createReadStream('./file.json');
    ctx.response.stream(stream, {
      contentType: 'application/json',
    });
  },
});
```

## 🏪 State Management

### Using Context State

Request-scoped state is available directly on the context object:

```typescript
export const stateExample = createPostRoute({
  handler: async ctx => {
    // Store values directly in ctx.state
    ctx.state.userId = '123';
    ctx.state.startTime = Date.now();
    ctx.state.permissions = ['read', 'write'];

    // Access state values
    const processingTime = Date.now() - ctx.state.startTime;

    // Pass context to functions that need state
    await processWithState(ctx);

    return {
      userId: ctx.state.userId,
      processingTime,
    };
  },
});

async function processWithState(ctx: Context) {
  // Access state from passed context
  const userId = ctx.state.userId;
  const permissions = ctx.state.permissions;

  // Process based on state...
}
```

### State Organization Patterns

Since there are no built-in namespacing utilities, organize state with prefixes:

```typescript
export const organizedStateExample = createGetRoute({
  handler: async ctx => {
    // Use prefixes to organize state
    ctx.state['user.id'] = '123';
    ctx.state['user.role'] = 'admin';
    ctx.state['session.id'] = 'sess_456';
    ctx.state['session.startTime'] = Date.now();

    // Or use nested objects (be careful with mutations)
    ctx.state.user = {
      id: '123',
      role: 'admin',
    };

    ctx.state.session = {
      id: 'sess_456',
      startTime: Date.now(),
    };

    return {
      user: ctx.state.user,
      sessionDuration: Date.now() - ctx.state.session.startTime,
    };
  },
});
```

## 🛡️ Error Handling

The context module includes built-in protection and automatic error handling:

```typescript
export const errorHandling = createPostRoute({
  handler: async (ctx, params, logger) => {
    // Correlation IDs are automatically added to errors
    // Check for existing correlation ID from request
    const correlationId = ctx.request.header('x-correlation-id');

    // Send first response
    ctx.response.json({ message: 'Success' });

    // These will throw errors (response already sent):
    try {
      ctx.response.json({ error: true }); // ❌ Throws ResponseSentError
    } catch (error) {
      logger.error('Cannot send multiple responses');
    }

    // Check if response was sent
    if (!ctx.response.sent) {
      ctx.response.json({ message: 'Not sent yet' });
    }
  },
});
```

### Automatic Error Context

All errors automatically include:

- **Correlation ID**: From `x-correlation-id` header or auto-generated
- **Timestamp**: When the error occurred
- **Request Details**: Method, path, and other context
- **Error Type**: Semantic error classification

```typescript
export const errorExample = createGetRoute({
  handler: async ctx => {
    // Any thrown error will automatically include context
    throw new NotFoundError('User not found');

    // Error response will include:
    // {
    //   "type": "NOT_FOUND",
    //   "title": "User not found",
    //   "status": 404,
    //   "correlationId": "req_k3x2m1_9z8y7w6v",
    //   "timestamp": "2024-01-15T10:30:00.000Z"
    // }
  },
});
```

## ✅ Testing

### Testing with Context

When testing route handlers and middleware, the context is provided automatically:

```typescript
import { describe, test, expect } from 'vitest';
import { createTestContext } from '@blaizejs/testing-utils';

describe('Route Handler Tests', () => {
  test('should handle request with context', async () => {
    // Your route handler
    const handler = async ctx => {
      const name = ctx.request.query.name || 'World';
      return { message: `Hello, ${name}!` };
    };

    // Create test context
    const ctx = createTestContext({
      method: 'GET',
      path: '/hello',
      query: { name: 'Test' },
    });

    // Test the handler
    const result = await handler(ctx);

    expect(result.message).toBe('Hello, Test!');
  });

  test('should modify response headers', async () => {
    const handler = async ctx => {
      ctx.response.status(201).header('X-Custom', 'value').json({ created: true });
    };

    const ctx = createTestContext();
    await handler(ctx);

    expect(ctx.response.sent).toBe(true);
    // Additional assertions based on your test utilities
  });
});
```

## 🗺️ Roadmap

### 🚀 Current (v0.3.x) - Beta

- ✅ AsyncLocalStorage-based context propagation _(internal)_
- ✅ Type-safe request/response handling
- ✅ State management on context object
- ✅ Automatic body parsing for JSON, form data, and text
- ✅ Query parameter parsing with array support
- ✅ Response protection against multiple sends
- ✅ Stream response support with error handling
- ✅ Request header access with unified API
- ✅ Integrated Zod validation via route creators
- ✅ **Request Correlation IDs** - Automatic generation and propagation via `x-correlation-id` headers
- ✅ **Enhanced Error Context** - All errors include correlation IDs, timestamps, and request details
- ✅ **Error Boundary Middleware** - Automatic error catching and formatting with full context

### 🎯 MVP/1.0 Release

- 🔄 **Enhance Testing Utilities** - Provide more testing utilities
- 🔄 **Performance Optimizations** - Context pooling and reuse
- 🔄 **Context Profiling** - Built-in timing and performance metrics
- 🔄 **Response Compression** - Automatic gzip/brotli based on Accept-Encoding
- 🔄 **Context Snapshots** - Save/restore context state for debugging
- 🔄 **Request Timeout Control** - Configurable timeouts with automatic cleanup

### 🔮 Post-MVP (v1.1+)

- 🔄 **WebSocket Context** - Extend context to WebSocket connections
- 🔄 **Distributed Context** - Cross-service context propagation
- 🔄 **Context Middleware Pipeline** - Composable context transformations
- 🔄 **Advanced State Management** - Redis-backed state option
- 🔄 **Server-Sent Events Support** - SSE context management
- 🔄 **Request Retry Context** - Maintain context across retries

### 🌟 Future Considerations

- 🔄 **GraphQL Context Integration** - If GraphQL support is added
- 🔄 **OpenTelemetry Integration** - Full observability support
- 🔄 **Visual Context Debugger** - Browser DevTools extension
- 🔄 **Context Analytics** - Performance insights and optimization suggestions
- 🔄 **Multi-Protocol Context** - Unified context for HTTP, WebSocket, and gRPC

## 📚 Related Documentation

- 🏠 [BlaizeJS Main Documentation](../../README.md)
- 🌐 [Server Module](../server/README.md) - HTTP server creation with automatic context
- 🚀 [Router Module](../router/README.md) - File-based routing with context injection
- 🔗 [Middleware Module](../middleware/README.md) - Middleware with context access
- 🧩 [Plugins Module](../plugins/README.md) - Plugin system with context hooks

---

**Built with ❤️ by the BlaizeJS team**

_Note: The context module is primarily internal. Most users will interact with context through route handlers and middleware where it's automatically provided._
