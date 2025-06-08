# 🔗 BlaizeJS Context Module

> Powerful request/response context management with AsyncLocalStorage, state isolation, and type-safe API access

[![npm version](https://badge.fury.io/js/blaizejs.svg)](https://badge.fury.io/js/blaizejs)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

## 📋 Table of Contents

- [🌟 Features](#-features)
- [📦 Installation](#-installation)
- [🚀 Quick Start](#-quick-start)
- [📖 Core Concepts](#-core-concepts)
- [🔧 Request Context API](#-request-context-api)
- [📤 Response Context API](#-response-context-api)
- [🏪 State Management](#-state-management)
- [🧩 Context Integration](#-context-integration)
- [🛡️ Error Handling](#-error-handling)
- [✅ Testing](#-testing)
- [🤝 Contributing](#-contributing)
- [🗺️ Roadmap](#️-roadmap)

## 🌟 Features

- ⚡ **AsyncLocalStorage integration** for automatic context propagation
- 🔒 **Type-safe request/response handling** with full TypeScript support
- 🏪 **Advanced state management** with namespaced and typed state accessors
- 🌐 **HTTP/1.1 and HTTP/2 support** with unified API
- 📤 **Rich response methods** (JSON, HTML, streaming, redirects)
- 🛡️ **Built-in error protection** against double responses and invalid operations
- 🔍 **Request parsing** with automatic body handling for JSON, form data, and text
- 📊 **Query and parameter parsing** with array support
- 🎯 **Context binding** for preserving context across async operations
- 🚀 **High performance** with minimal overhead and memory efficiency

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

### Automatic Context Access (Recommended)

BlaizeJS automatically provides context in route handlers, middleware, and any functions called within a request:

```typescript
import { createServer, createGetRoute } from 'blaizejs';
import { getCurrentContext, setState, getState } from 'blaizejs';

// Context is automatically available in route handlers
export const getUserProfile = createGetRoute({
  handler: async () => {
    // Get current context - no parameters needed!
    const ctx = getCurrentContext();
    
    // Access request data
    const userId = ctx.request.header('x-user-id');
    const userAgent = ctx.request.header('user-agent');
    
    // Store data in request-scoped state
    setState('requestStart', Date.now());
    
    // Call other functions - context is preserved
    const profile = await fetchUserData(userId);
    
    // Return response (or use ctx.response methods)
    return { profile, userAgent };
  }
});

// Context is preserved in called functions
async function fetchUserData(userId: string) {
  // Context is still available here!
  const ctx = getCurrentContext();
  const startTime = getState<number>('requestStart');
  
  console.log(`Fetching user ${userId}, request started ${Date.now() - startTime}ms ago`);
  
  // ... fetch user data
  return { id: userId, name: 'John Doe' };
}

// Start server - context management is automatic
const server = createServer({
  routesDir: './routes'
});

await server.listen();
```

### Manual Context Creation (Advanced)

For custom server implementations or testing:

```typescript
import { createContext } from 'blaizejs';
import { IncomingMessage, ServerResponse } from 'node:http';

async function handleRequest(req: IncomingMessage, res: ServerResponse) {
  // Create context manually
  const ctx = await createContext(req, res, {
    parseBody: true, // Enable automatic body parsing
    initialState: { 
      requestId: generateRequestId(),
      startTime: Date.now()
    }
  });
  
  // Use context
  ctx.response.json({ 
    message: 'Hello World',
    requestId: ctx.state.requestId 
  });
}
```

## 📖 Core Concepts

### 🔄 Automatic Context Propagation

BlaizeJS uses Node.js AsyncLocalStorage to automatically propagate context through your entire request handling pipeline:

```typescript
import { getCurrentContext, setState, getState } from 'blaizejs';

// In your route handler
export const processOrder = createPostRoute({
  handler: async () => {
    setState('orderId', 'order-123');
    
    // Context flows automatically to all called functions
    await validateOrder();    // ✅ Has context
    await chargePayment();    // ✅ Has context  
    await sendConfirmation(); // ✅ Has context
    
    return { success: true };
  }
});

async function validateOrder() {
  const ctx = getCurrentContext(); // ✅ Works automatically
  const orderId = getState<string>('orderId'); // ✅ Gets 'order-123'
  
  // Access request data
  const userAgent = ctx.request.header('user-agent');
  
  // ... validation logic
}

async function chargePayment() {
  const ctx = getCurrentContext(); // ✅ Same context instance
  const orderId = getState<string>('orderId'); // ✅ Same state
  
  // ... payment logic
}
```

### 🏪 Request-Scoped State

Each request gets its own isolated state that's automatically cleaned up:

```typescript
import { setState, getState, createNamespacedState } from 'blaizejs';

export const apiHandler = createPostRoute({
  handler: async () => {
    // Global state (be careful with key collisions)
    setState('userId', '123');
    setState('permissions', ['read', 'write']);
    
    // Namespaced state (recommended)
    const userState = createNamespacedState('user');
    userState.set('id', '123');
    userState.set('role', 'admin');
    
    // Type-safe state
    interface UserSession {
      id: string;
      role: string;
      lastActivity: number;
    }
    
    const sessionState = createTypedState<UserSession>('session');
    sessionState.set('id', '123');           // ✅ Type-safe
    sessionState.set('role', 'admin');       // ✅ Type-safe
    sessionState.set('lastActivity', Date.now()); // ✅ Type-safe
    // sessionState.set('invalid', 'value'); // ❌ TypeScript error
    
    return { success: true };
  }
});
```

### 🌐 HTTP Protocol Support

The context provides a unified API for both HTTP/1.1 and HTTP/2:

```typescript
export const protocolHandler = createGetRoute({
  handler: async () => {
    const ctx = getCurrentContext();
    
    // Unified request interface
    const protocol = ctx.request.protocol; // 'http' or 'https'
    const isHttp2 = ctx.request.isHttp2;   // boolean
    const method = ctx.request.method;     // 'GET', 'POST', etc.
    const path = ctx.request.path;         // '/api/users'
    
    // Headers work the same regardless of HTTP version
    const auth = ctx.request.header('authorization');
    const contentType = ctx.request.header('content-type');
    
    return {
      protocol,
      isHttp2,
      method,
      path,
      headers: { auth, contentType }
    };
  }
});
```

## 🔧 Request Context API

### 📥 Request Properties

```typescript
export const requestInfoHandler = createGetRoute({
  handler: async () => {
    const ctx = getCurrentContext();
    const { request } = ctx;
    
    // Basic properties
    const method = request.method;        // 'GET', 'POST', etc.
    const path = request.path;            // '/api/users/123'
    const protocol = request.protocol;    // 'http' or 'https'
    const isHttp2 = request.isHttp2;      // boolean
    
    // URL and query data
    const url = request.url;              // Full URL object or null
    const query = request.query;          // Parsed query parameters
    const params = request.params;        // Route parameters (/:id)
    
    // Request body (if parsed)
    const body = request.body;            // Parsed body data
    
    // Raw Node.js request object
    const rawReq = request.raw;           // IncomingMessage | Http2ServerRequest
    
    return {
      method,
      path,
      protocol,
      query,
      params,
      hasBody: !!body
    };
  }
});
```

### 🏷️ Header Access

```typescript
export const headerHandler = createGetRoute({
  handler: async () => {
    const ctx = getCurrentContext();
    
    // Get single header
    const auth = ctx.request.header('authorization');
    const userAgent = ctx.request.header('user-agent');
    const customHeader = ctx.request.header('x-custom-header');
    
    // Get multiple specific headers
    const specificHeaders = ctx.request.headers(['host', 'authorization', 'x-api-key']);
    // Returns: { host: 'example.com', authorization: 'Bearer ...', 'x-api-key': undefined }
    
    // Get all headers
    const allHeaders = ctx.request.headers();
    
    return {
      auth,
      userAgent,
      specificHeaders,
      totalHeaders: Object.keys(allHeaders).length
    };
  }
});
```

### 🔍 Query Parameter Handling

BlaizeJS automatically parses query parameters with array support:

```typescript
export const queryHandler = createGetRoute({
  handler: async () => {
    const ctx = getCurrentContext();
    
    // URL: /api/search?q=javascript&tags=web&tags=tutorial&limit=10&active=true
    const query = ctx.request.query;
    
    // Single values
    const searchTerm = query.q;          // 'javascript'
    const limit = query.limit;           // '10' (string)
    const active = query.active;         // 'true' (string)
    
    // Array values (multiple same-named parameters)
    const tags = query.tags;             // ['web', 'tutorial']
    
    // Type conversion (handle manually or use Zod in route schema)
    const limitNum = parseInt(query.limit as string, 10);
    const isActive = query.active === 'true';
    
    return {
      searchTerm,
      tags,
      limit: limitNum,
      active: isActive
    };
  }
});
```

### 📦 Body Parsing

Request bodies are automatically parsed based on Content-Type:

```typescript
export const bodyHandler = createPostRoute({
  handler: async () => {
    const ctx = getCurrentContext();
    const body = ctx.request.body;
    
    // JSON body (Content-Type: application/json)
    if (ctx.request.header('content-type')?.includes('application/json')) {
      const jsonData = body as { name: string; email: string };
      console.log('Received JSON:', jsonData);
    }
    
    // Form data (Content-Type: application/x-www-form-urlencoded)
    if (ctx.request.header('content-type')?.includes('application/x-www-form-urlencoded')) {
      const formData = body as Record<string, string | string[]>;
      console.log('Received form data:', formData);
    }
    
    // Plain text (Content-Type: text/*)
    if (ctx.request.header('content-type')?.includes('text/')) {
      const textData = body as string;
      console.log('Received text:', textData);
    }
    
    // Check for parsing errors
    const bodyError = ctx.state._bodyError;
    if (bodyError) {
      console.warn('Body parsing error:', bodyError);
    }
    
    return { success: true, bodyReceived: !!body };
  }
});
```

## 📤 Response Context API

### 🎯 Status and Headers

```typescript
export const responseHandler = createGetRoute({
  handler: async () => {
    const ctx = getCurrentContext();
    
    // Set status code
    ctx.response.status(201);
    
    // Set single header
    ctx.response.header('X-Custom-Header', 'custom-value');
    
    // Set multiple headers
    ctx.response.headers({
      'X-Rate-Limit': '1000',
      'X-Rate-Remaining': '999',
      'Cache-Control': 'no-cache'
    });
    
    // Set content type
    ctx.response.type('application/xml');
    
    // Method chaining works
    ctx.response
      .status(200)
      .header('X-Powered-By', 'BlaizeJS')
      .type('application/json');
    
    // Send response (or return data from handler)
    ctx.response.json({ message: 'Headers set!' });
  }
});
```

### 📨 Response Methods

```typescript
export const responseMethodsHandler = createGetRoute({
  handler: async () => {
    const ctx = getCurrentContext();
    
    // JSON response (most common)
    ctx.response.json({ 
      message: 'Success',
      timestamp: new Date().toISOString()
    }, 200); // Optional status code
    
    // Plain text response
    ctx.response.text('Hello, World!', 200);
    
    // HTML response
    ctx.response.html('<h1>Welcome!</h1><p>This is HTML content</p>', 200);
    
    // Redirect response
    ctx.response.redirect('/new-location', 301); // Permanent redirect
    ctx.response.redirect('/temporary', 302);    // Temporary redirect (default)
    
    // Stream response
    import { createReadStream } from 'fs';
    const fileStream = createReadStream('./large-file.json');
    
    ctx.response.stream(fileStream, {
      contentType: 'application/json',
      status: 200,
      headers: {
        'Content-Disposition': 'attachment; filename="data.json"'
      }
    });
  }
});
```

### 🔒 Response Protection

BlaizeJS prevents common response errors:

```typescript
export const protectedResponseHandler = createPostRoute({
  handler: async () => {
    const ctx = getCurrentContext();
    
    // First response
    ctx.response.json({ message: 'First response' });
    
    // These will throw errors:
    try {
      ctx.response.status(500);           // ❌ ResponseSentError
    } catch (error) {
      console.log('Cannot modify status after response sent');
    }
    
    try {
      ctx.response.header('X-Test', 'value'); // ❌ ResponseSentHeaderError
    } catch (error) {
      console.log('Cannot set headers after response sent');
    }
    
    try {
      ctx.response.json({ error: true });    // ❌ ResponseSentError
    } catch (error) {
      console.log('Cannot send multiple responses');
    }
    
    // Check if response was sent
    if (ctx.response.sent) {
      console.log('Response has been sent');
    }
  }
});
```

## 🏪 State Management

### 🌍 Global State Functions

```typescript
import { 
  getState, 
  setState, 
  removeState, 
  getStateMany, 
  setStateMany 
} from 'blaizejs';

export const stateHandler = createPostRoute({
  handler: async () => {
    // Basic state operations
    setState('userId', '123');
    setState('permissions', ['read', 'write']);
    
    const userId = getState<string>('userId');          // '123'
    const permissions = getState<string[]>('permissions'); // ['read', 'write']
    const missing = getState('nonexistent', 'default'); // 'default'
    
    // Multiple state operations
    setStateMany({
      sessionId: 'session-456',
      lastActivity: Date.now(),
      isAuthenticated: true
    });
    
    const multipleValues = getStateMany(['userId', 'sessionId', 'nonexistent']);
    // Returns: { userId: '123', sessionId: 'session-456' }
    
    // Remove state
    removeState('permissions');
    const removed = getState('permissions'); // undefined
    
    return { 
      userId, 
      multipleValues,
      removedExists: !!removed 
    };
  }
});
```

### 🏷️ Namespaced State

Prevent key collisions with namespaced state:

```typescript
import { createNamespacedState } from 'blaizejs';

export const namespacedStateHandler = createPostRoute({
  handler: async () => {
    // Create namespaced state accessors
    const userState = createNamespacedState('user');
    const sessionState = createNamespacedState('session');
    
    // Set namespaced values
    userState.set('id', '123');
    userState.set('name', 'John Doe');
    userState.set('role', 'admin');
    
    sessionState.set('id', 'session-456');
    sessionState.set('created', Date.now());
    sessionState.set('lastActivity', Date.now());
    
    // Get namespaced values
    const userName = userState.get('name');           // 'John Doe'
    const sessionId = sessionState.get('id');         // 'session-456'
    const defaultValue = userState.get('missing', 'default'); // 'default'
    
    // Get all keys in namespace
    const userKeys = userState.getAllKeys();          // ['id', 'name', 'role']
    const sessionKeys = sessionState.getAllKeys();    // ['id', 'created', 'lastActivity']
    
    // Remove specific keys
    userState.remove('role');
    
    // Clear entire namespace
    sessionState.clear();
    
    return {
      userName,
      sessionId,
      userKeys,
      sessionKeys: sessionState.getAllKeys() // Now empty
    };
  }
});
```

### 🔒 Type-Safe State

Get compile-time safety with typed state:

```typescript
import { createTypedState } from 'blaizejs';

// Define your state shape
interface UserSession {
  id: string;
  email: string;
  role: 'admin' | 'user' | 'guest';
  permissions: string[];
  lastActivity: number;
  preferences: {
    theme: 'light' | 'dark';
    language: string;
  };
}

export const typedStateHandler = createPostRoute({
  handler: async () => {
    const sessionState = createTypedState<UserSession>('session');
    
    // Type-safe setters
    sessionState.set('id', '123');                           // ✅ Valid
    sessionState.set('role', 'admin');                       // ✅ Valid
    sessionState.set('permissions', ['read', 'write']);      // ✅ Valid
    sessionState.set('lastActivity', Date.now());            // ✅ Valid
    // sessionState.set('invalidKey', 'value');              // ❌ TypeScript error
    // sessionState.set('role', 'invalid');                  // ❌ TypeScript error
    
    // Type-safe getters
    const userId = sessionState.get('id');                   // string | undefined
    const role = sessionState.get('role');                   // 'admin' | 'user' | 'guest' | undefined
    const permissions = sessionState.get('permissions', []); // string[]
    
    // Set multiple values with type safety
    sessionState.setMany({
      email: 'user@example.com',
      preferences: {
        theme: 'dark',
        language: 'en'
      }
    });
    
    // Get all values (only includes set values)
    const allSessionData = sessionState.getAll();
    // Type: Partial<UserSession>
    
    // Clear all session data
    sessionState.clear();
    
    return {
      userId,
      role,
      permissions,
      allSessionData
    };
  }
});
```

## 🧩 Context Integration

### 🔄 Context Binding

Preserve context across async operations:

```typescript
import { bindContext, getCurrentContext } from 'blaizejs';

export const asyncHandler = createPostRoute({
  handler: async () => {
    setState('requestId', 'req-123');
    
    // Bind context to preserve it in async operations
    const boundFunction = bindContext(async () => {
      // This function will run with the original context
      const ctx = getCurrentContext();
      const requestId = getState<string>('requestId');
      
      return { contextPreserved: true, requestId };
    });
    
    // Even if called later or passed around, context is preserved
    const result = await boundFunction();
    
    // Works with timeouts and intervals
    const boundTimeout = bindContext(() => {
      const ctx = getCurrentContext(); // ✅ Still works
      console.log('Timeout executed with context');
    });
    
    setTimeout(boundTimeout, 1000);
    
    return result;
  }
});
```

### 🎯 Context Utilities

```typescript
import { isInRequestContext, getCurrentContext } from 'blaizejs';

// Utility function that works both inside and outside requests
export function logMessage(message: string) {
  if (isInRequestContext()) {
    const ctx = getCurrentContext();
    const requestId = getState<string>('requestId');
    console.log(`[${requestId}] ${message}`);
  } else {
    console.log(`[NO_CONTEXT] ${message}`);
  }
}

export const utilityHandler = createGetRoute({
  handler: async () => {
    setState('requestId', 'req-456');
    
    logMessage('This has context');     // [req-456] This has context
    
    // Call without context
    setTimeout(() => {
      logMessage('This has no context'); // [NO_CONTEXT] This has no context
    }, 100);
    
    return { success: true };
  }
});
```

### 🧪 Manual Context Operations

For advanced use cases or testing:

```typescript
import { runWithContext, createContext } from 'blaizejs';
import { IncomingMessage, ServerResponse } from 'node:http';

// Create and use context manually
export async function manualContextExample(req: IncomingMessage, res: ServerResponse) {
  // Create context manually
  const ctx = await createContext(req, res, {
    parseBody: true,
    initialState: {
      customData: 'initial-value'
    }
  });
  
  // Run code with the context
  await runWithContext(ctx, async () => {
    // Now getCurrentContext() works
    const currentCtx = getCurrentContext();
    setState('processedAt', Date.now());
    
    // Call other functions that expect context
    await someBusinessLogic();
    
    currentCtx.response.json({ success: true });
  });
}

async function someBusinessLogic() {
  // This function expects to be called within a context
  const ctx = getCurrentContext();
  const processedAt = getState<number>('processedAt');
  
  console.log(`Business logic executed at ${processedAt}`);
}
```

## 🛡️ Error Handling

### 🚨 Built-in Error Types

```typescript
import { 
  ResponseSentError, 
  ResponseSentHeaderError, 
  ResponseSentContentError,
  ParseUrlError 
} from 'blaizejs';

export const errorHandlingHandler = createPostRoute({
  handler: async () => {
    const ctx = getCurrentContext();
    
    try {
      // Send initial response
      ctx.response.json({ message: 'First response' });
      
      // This will throw ResponseSentError
      ctx.response.json({ message: 'Second response' });
      
    } catch (error) {
      if (error instanceof ResponseSentError) {
        console.log('Attempted to send response multiple times');
      }
    }
    
    try {
      // After response is sent, header operations fail
      ctx.response.header('X-Too-Late', 'value');
      
    } catch (error) {
      if (error instanceof ResponseSentHeaderError) {
        console.log('Attempted to set header after response sent');
      }
    }
  }
});
```

### 🛠️ Body Parsing Errors

```typescript
export const bodyErrorHandler = createPostRoute({
  handler: async () => {
    const ctx = getCurrentContext();
    
    // Check for body parsing errors
    const bodyError = ctx.state._bodyError;
    
    if (bodyError) {
      console.error('Body parsing failed:', {
        type: bodyError.type,           // 'json_parse_error', 'form_parse_error', etc.
        message: bodyError.message,     // Human-readable message
        originalError: bodyError.error  // Original error object
      });
      
      return ctx.response.status(400).json({
        error: 'Invalid request body',
        details: bodyError.message
      });
    }
    
    // Body parsed successfully
    const body = ctx.request.body;
    return { receivedBody: body };
  }
});
```

### 🔒 Context Safety

```typescript
import { isInRequestContext, getCurrentContext } from 'blaizejs';

export function safeContextAccess() {
  // Always check if context is available
  if (!isInRequestContext()) {
    throw new Error('This function must be called within a request context');
  }
  
  const ctx = getCurrentContext();
  return ctx.request.path;
}

export function safestContextAccess() {
  try {
    const ctx = getCurrentContext();
    return ctx.request.path;
  } catch (error) {
    console.warn('No context available, using fallback');
    return '/unknown';
  }
}
```

## ✅ Testing

### 🧪 Testing with Context

```typescript
// tests/context/request-handling.test.ts
import { describe, test, expect, vi } from 'vitest';
import { createContext, getCurrentContext, setState, getState } from 'blaizejs';
import { createMockHttp1Request, createMockResponse } from '@blaizejs/testing-utils';

describe('Context Request Handling', () => {
  test('should create context with HTTP/1.1 request', async () => {
    const req = createMockHttp1Request();
    const res = createMockResponse();
    
    const context = await createContext(req as any, res as any);
    
    expect(context.request.method).toBe('GET');
    expect(context.request.path).toBe('/test');
    expect(context.request.isHttp2).toBe(false);
    expect(context.state).toEqual({});
  });
  
  test('should parse query parameters correctly', async () => {
    const req = {
      ...createMockHttp1Request(),
      url: '/api/search?q=javascript&tags=web&tags=tutorial&limit=10'
    };
    const res = createMockResponse();
    
    const context = await createContext(req as any, res as any);
    
    expect(context.request.query).toEqual({
      q: 'javascript',
      tags: ['web', 'tutorial'],
      limit: '10'
    });
  });
  
  test('should handle initial state', async () => {
    const req = createMockHttp1Request();
    const res = createMockResponse();
    const initialState = { userId: '123', sessionId: 'session-456' };
    
    const context = await createContext(req as any, res as any, { initialState });
    
    expect(context.state).toEqual(initialState);
  });
});
```

### 🎯 Testing State Management

```typescript
// tests/context/state-management.test.ts
import { describe, test, expect, beforeEach } from 'vitest';
import { 
  runWithContext, 
  createContext,
  setState, 
  getState,
  createNamespacedState,
  createTypedState 
} from 'blaizejs';
import { createMockHttp1Request, createMockResponse } from '@blaizejs/testing-utils';

describe('State Management', () => {
  let context: any;
  
  beforeEach(async () => {
    const req = createMockHttp1Request();
    const res = createMockResponse();
    context = await createContext(req, res);
  });
  
  test('should set and get state values', async () => {
    await runWithContext(context, () => {
      setState('testKey', 'testValue');
      const value = getState<string>('testKey');
      
      expect(value).toBe('testValue');
    });
  });
  
  test('should handle namespaced state', async () => {
    await runWithContext(context, () => {
      const userState = createNamespacedState('user');
      const sessionState = createNamespacedState('session');
      
      userState.set('id', '123');
      sessionState.set('id', 'session-456');
      
      expect(userState.get('id')).toBe('123');
      expect(sessionState.get('id')).toBe('session-456');
      
      // Verify isolation
      expect(userState.get('id')).not.toBe(sessionState.get('id'));
    });
  });
  
  test('should provide type safety with typed state', async () => {
    interface TestState {
      id: string;
      count: number;
      active: boolean;
    }
    
    await runWithContext(context, () => {
      const typedState = createTypedState<TestState>('test');
      
      typedState.set('id', '123');
      typedState.set('count', 42);
      typedState.set('active', true);
      
      expect(typedState.get('id')).toBe('123');
      expect(typedState.get('count')).toBe(42);
      expect(typedState.get('active')).toBe(true);
      
      const allValues = typedState.getAll();
      expect(allValues).toEqual({
        id: '123',
        count: 42,
        active: true
      });
    });
  });
});
```

### 📤 Testing Response Methods

```typescript
// tests/context/response-methods.test.ts
import { describe, test, expect, vi } from 'vitest';
import { createContext } from 'blaizejs';
import { createMockHttp1Request, createMockResponse } from '@blaizejs/testing-utils';

describe('Response Methods', () => {
  test('should send JSON response', async () => {
    const req = createMockHttp1Request();
    const res = createMockResponse();
    const context = await createContext(req as any, res as any);
    
    const data = { success: true, message: 'Test response' };
    context.response.json(data, 201);
    
    expect(res.statusCode).toBe(201);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json');
    expect(res.end).toHaveBeenCalledWith(JSON.stringify(data));
    expect(context.response.sent).toBe(true);
  });
  
  test('should send text response', async () => {
    const req = createMockHttp1Request();
    const res = createMockResponse();
    const context = await createContext(req as any, res as any);
    
    context.response.text('Hello World', 200);
    
    expect(res.statusCode).toBe(200);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/plain');
    expect(res.end).toHaveBeenCalledWith('Hello World');
    expect(context.response.sent).toBe(true);
  });
  
  test('should send redirect response', async () => {
    const req = createMockHttp1Request();
    const res = createMockResponse();
    const context = await createContext(req as any, res as any);
    
    context.response.redirect('/new-location', 301);
    
    expect(res.statusCode).toBe(301);
    expect(res.setHeader).toHaveBeenCalledWith('Location', '/new-location');
    expect(res.end).toHaveBeenCalled();
    expect(context.response.sent).toBe(true);
  });
  
  test('should prevent multiple responses', async () => {
    const req = createMockHttp1Request();
    const res = createMockResponse();
    const context = await createContext(req as any, res as any);
    
    // Send first response
    context.response.json({ first: true });
    
    // Attempt second response should throw
    expect(() => {
      context.response.json({ second: true });
    }).toThrow('Response has already been sent');
  });
});
```

### 🔄 Testing Context Integration

```typescript
// tests/context/integration.test.ts
import { describe, test, expect, vi } from 'vitest';
import { 
  runWithContext, 
  createContext, 
  getCurrentContext, 
  bindContext,
  setState,
  getState 
} from 'blaizejs';
import { createMockHttp1Request, createMockResponse } from '@blaizejs/testing-utils';

describe('Context Integration', () => {
  test('should preserve context across function calls', async () => {
    const req = createMockHttp1Request();
    const res = createMockResponse();
    const context = await createContext(req as any, res as any);
    
    const callStack: string[] = [];
    
    await runWithContext(context, async () => {
      setState('requestId', 'test-123');
      callStack.push('main');
      
      await levelOne();
      
      async function levelOne() {
        const ctx = getCurrentContext();
        const requestId = getState<string>('requestId');
        callStack.push(`level1-${requestId}`);
        
        await levelTwo();
      }
      
      async function levelTwo() {
        const ctx = getCurrentContext();
        const requestId = getState<string>('requestId');
        callStack.push(`level2-${requestId}`);
      }
    });
    
    expect(callStack).toEqual([
      'main',
      'level1-test-123',
      'level2-test-123'
    ]);
  });
  
  test('should bind context to functions', async () => {
    const req = createMockHttp1Request();
    const res = createMockResponse();
    const context = await createContext(req as any, res as any);
    
    let boundResult: any;
    
    await runWithContext(context, async () => {
      setState('testValue', 'bound-context');
      
      const boundFunction = bindContext(() => {
        const ctx = getCurrentContext();
        return getState<string>('testValue');
      });
      
      // Call bound function later (simulating async operation)
      setTimeout(() => {
        boundResult = boundFunction();
      }, 10);
    });
    
    // Wait for timeout
    await new Promise(resolve => setTimeout(resolve, 20));
    
    expect(boundResult).toBe('bound-context');
  });
});
```

### 🎯 Testing Route Handlers

```typescript
// tests/routes/context-usage.test.ts
import { describe, test, expect } from 'vitest';
import { createServer } from 'blaizejs';
import { createTestContext } from '@blaizejs/testing-utils';

describe('Route Handler Context Usage', () => {
  test('should access context in route handlers', async () => {
    // Mock route file
    const getUserHandler = async () => {
      const ctx = getCurrentContext();
      const userId = ctx.request.params.id;
      const userAgent = ctx.request.header('user-agent');
      
      setState('accessTime', Date.now());
      
      return {
        userId,
        userAgent,
        accessTime: getState<number>('accessTime')
      };
    };
    
    // Create test context
    const ctx = createTestContext({
      method: 'GET',
      path: '/users/123',
      params: { id: '123' },
      headers: { 'user-agent': 'test-browser' }
    });
    
    // Test the handler
    const result = await getUserHandler();
    
    expect(result.userId).toBe('123');
    expect(result.userAgent).toBe('test-browser');
    expect(result.accessTime).toBeTypeOf('number');
  });
});
```

### 🏃‍♂️ Running Tests

```bash
# Run all context tests
pnpm test context

# Run tests in watch mode
pnpm test:watch context

# Run tests with coverage
pnpm test:coverage --filter=blaizejs

# Run specific test file
pnpm test tests/context/state-management.test.ts

# Debug tests
pnpm test context --debug
```

## 🤝 Contributing

We welcome contributions to the Context Module! Please see our [Contributing Guide](../../CONTRIBUTING.md) for details.

### 🛠️ Development Setup

```bash
# Clone the repository
git clone https://github.com/jleajones/blaize.git
cd blaize

# Install dependencies
pnpm install

# Run context tests
pnpm test context

# Start development with context examples
pnpm dev
```

### 📝 Code Standards

- ✅ Use TypeScript with strict mode enabled
- ✅ Follow existing patterns for context management
- ✅ Write comprehensive tests using Vitest and @blaizejs/testing-utils
- ✅ Include JSDoc comments for public APIs
- ✅ Update documentation for new features
- ✅ Use conventional commits for clear history

### 🔧 Available Scripts

```bash
pnpm build          # Build context module
pnpm dev            # Start development mode
pnpm lint           # Run ESLint on context code
pnpm format         # Format code with Prettier
pnpm type-check     # Run TypeScript checks
pnpm clean          # Clean build artifacts
```

### 🧪 Testing Guidelines

When contributing context features:

- ✅ Test both HTTP/1.1 and HTTP/2 compatibility
- ✅ Test AsyncLocalStorage context propagation
- ✅ Test state management isolation between requests
- ✅ Test error conditions and edge cases
- ✅ Test context binding and preservation
- ✅ Include integration tests with routes and middleware
- ✅ Test memory cleanup and leak prevention

### 🎯 Architecture Notes

For contributors working on context internals:

```typescript
// Core context architecture
//
// 1. AsyncLocalStorage provides automatic context propagation
// 2. createContext() factory creates request/response wrappers
// 3. State management provides request-scoped data storage
// 4. Response protection prevents double-send errors
// 5. Body parsing handles multiple content types automatically

// Key files:
// - create.ts: Context factory and request/response wrappers
// - store.ts: AsyncLocalStorage integration and utilities
// - state.ts: State management functions and namespacing
// - errors.ts: Custom error types for context operations
```

## 🗺️ Roadmap

### 🚀 Current (v0.1.x)
- ✅ AsyncLocalStorage-based context propagation
- ✅ Type-safe request/response handling for HTTP/1.1 and HTTP/2
- ✅ Advanced state management with namespaced and typed accessors
- ✅ Automatic body parsing for JSON, form data, and text
- ✅ Query parameter parsing with array support
- ✅ Response protection against multiple sends and header modifications
- ✅ Context binding for preserving context across async operations
- ✅ Comprehensive error handling with custom error types
- ✅ Stream response support with error handling
- ✅ Request header access with unified API
- ✅ **Integrated Zod validation** - Full schema validation for headers, query, body, and responses via route creators

### 🎯 Next Release (v0.2.x)
- 🔄 **Context Profiling** - Built-in timing and performance analysis for request processing
- 🔄 **Advanced State Persistence** - Redis-backed state for distributed applications
- 🔄 **Response Compression** - Automatic gzip/brotli compression based on Accept-Encoding
- 🔄 **Request ID Generation** - Automatic request tracking with correlation IDs
- 🔄 **Context Snapshots** - Save/restore context state for testing and debugging

### 🔮 Future (v0.3.x+)
- 🔄 **Context Middleware Pipeline** - Composable context transformations
- 🔄 **Advanced Streaming** - Server-sent events and WebSocket context integration
- 🔄 **Context Pooling** - Memory optimization for high-traffic applications
- 🔄 **Distributed Tracing** - OpenTelemetry integration for microservices
- 🔄 **Context Serialization** - Save/restore context state for debugging

### 🌟 Long-term Vision
- 🔄 **Visual Context Inspector** - Developer tools for debugging context flow
- 🔄 **AI-Powered Context Analysis** - Automatic optimization suggestions
- 🔄 **Multi-Protocol Context** - Unified context for HTTP, WebSocket, and gRPC
- 🔄 **Context-Aware Rate Limiting** - Sophisticated rate limiting based on context data

---

## 📚 Related Documentation

- 🏠 [BlaizeJS Main Documentation](../../README.md)
- 🌐 [Server Module](../server/README.md) - HTTP server creation and context integration
- 🚀 [Router Module](../router/README.md) - File-based routing with automatic context injection
- 🔗 [Middleware Module](../middleware/README.md) - Middleware creation with context access
- 🧩 [Plugins Module](../plugins/README.md) - Plugin system with context integration
- 🔗 [Client Module](../client/README.md) - Type-safe API client generation

---

**Built with ❤️ by the BlaizeJS team**

For questions, feature requests, or bug reports, please [open an issue](https://github.com/jleajones/blaize/issues) on GitHub.