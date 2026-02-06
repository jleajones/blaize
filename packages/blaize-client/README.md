# 🔥 BlaizeJS Client

> **Type-safe RPC client** for BlaizeJS APIs - Call your server functions directly from the client with full end-to-end type safety

[![npm version](https://badge.fury.io/js/%40blaizejs%2Fclient.svg)](https://badge.fury.io/js/%40blaizejs%2Fclient)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

## 🚀 **Yes, We Have RPC!**

BlaizeJS Client provides **true RPC (Remote Procedure Call) functionality** similar to tRPC or Hono RPC, but with a cleaner API:

```typescript
// Your server function
export const getUser = route.get({
  schema: { /* ... */ },
  handler: async ({ ctx, params }) => {
    // This is your actual server function
    return await db.users.findById(params.userId);
  },
});

// Call it from the client like a local function! 🎯
const user = await client.$get.getUser({ params: { userId: '123' } });
//                              ^^^^^^^ This calls your server function directly!
```

### 🔥 RPC Features Comparison

| Feature | BlaizeJS | Hono RPC | tRPC |
|---------|----------|----------|------|
| **Type-safe RPC** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Auto-completion** | ✅ Yes | ✅ Yes | ✅ Yes |
| **No code generation** | ✅ Yes | ✅ Yes | ✅ Yes |
| **HTTP-native** | ✅ Yes | ✅ Yes | ❌ Custom protocol |
| **RESTful URLs** | ✅ Yes | ❌ No | ❌ No |
| **Zero config** | ✅ Yes | ⚠️ Partial | ❌ Requires setup |
| **Proxy-based** | ✅ Yes | ✅ Yes | ✅ Yes |

---

## 📋 Table of Contents

- [🌟 What Makes This RPC?](#-what-makes-this-rpc)
- [📦 Installation](#-installation)
- [🚀 Quick Start](#-quick-start)
- [🎯 RPC Features](#-rpc-features)
- [📖 Core API](#-core-api)
- [🛡️ Error Handling](#️-error-handling)
- [💡 Advanced Patterns](#-advanced-patterns)
- [🧪 Testing](#-testing)
- [📚 Type System](#-type-system)
- [🗺️ Roadmap](#️-roadmap)

---

## 🌟 What Makes This RPC?

**RPC (Remote Procedure Call)** means calling server functions as if they were local functions. BlaizeJS Client achieves this through:

### 1️⃣ **Direct Function Mapping**

Your server handlers become client methods automatically:

```typescript
// Server: Define a function
export const calculateTax = route.post({
  handler: async ({ ctx }) => {
    return { tax: ctx.request.body.amount * 0.2 };
  }
});

// Client: Call it like a local function
const result = await client.$post.calculateTax({ 
  body: { amount: 100 } 
});
```

### 2️⃣ **Automatic Type Inference**

Types flow from server to client without any manual work:

```typescript
// Server defines the contract
const createUser = route.post({
  schema: {
    body: z.object({
      name: z.string(),
      email: z.string().email()
    }),
    response: z.object({
      id: z.string(),
      name: z.string()
    })
  },
  handler: async ({ ctx }) => { /* ... */ }
});

// Client knows the types automatically!
const newUser = await client.$post.createUser({
  body: { 
    name: "John",  // ✅ TypeScript knows this is required
    email: "test"  // ❌ TypeScript error: invalid email
  }
});
// newUser.id ✅ TypeScript knows this exists
// newUser.age ❌ TypeScript error: doesn't exist
```

### 3️⃣ **Proxy-Based Method Generation**

We use JavaScript Proxies to create methods dynamically:

```typescript
// No manual client method definitions needed!
// Methods are created automatically from your routes:
client.$get.getUser()      // ✅ Exists if route exists
client.$post.createUser()   // ✅ Exists if route exists  
client.$delete.deleteUser() // ✅ Exists if route exists
client.$get.nonExistent()   // ❌ TypeScript error!
```

---

## 📦 Installation

```bash
# Using pnpm (recommended)
pnpm add @blaizejs/client

# Using npm
npm install @blaizejs/client

# Using yarn
yarn add @blaizejs/client
```

**Current Version:** 0.5.1

---

## 🚀 Quick Start

### Step 1: Set Up Your Server

```typescript
// server/src/app.ts
import { Blaize, type InferContext } from 'blaizejs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = Blaize.createServer({
  port: 3000,
  routesDir: path.resolve(__dirname, './routes'),
});

// Create typed route factory
type AppContext = InferContext<typeof app>;
export const route = Blaize.Router.createRouteFactory<
  AppContext['state'],
  AppContext['services']
>();

await app.listen();
```

### Step 2: Define Your Routes

```typescript
// server/src/routes/users/[userId].ts
import { route } from '../../app';
import { z } from 'zod';

export const getUser = route.get({
  schema: {
    params: z.object({ userId: z.string().uuid() }),
    response: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
    }),
  },
  handler: async ({ ctx, params }) => {
    const user = await db.users.findById(params.userId);
    if (!user) throw new NotFoundError('User not found');
    return user;
  },
});
```

### Step 3: Export Your Routes Registry

**⚠️ Important:** Create this file in `src/`, **NOT** in the `routes/` directory!

```typescript
// server/src/app-routes.ts
import { getUser } from './routes/users/[userId]';
import { listUsers, createUser } from './routes/users';

export const routes = {
  getUser,
  listUsers,
  createUser,
} as const; // ← 'as const' is important!
```

### Step 4: Create Your Client

```typescript
// client/src/api.ts
import bc from '@blaizejs/client';
import { routes } from '../../server/src/app-routes';

// Create the RPC client
const client = bc.create('https://api.example.com', routes);

export default client;
```

**Alternative:** Use named import:

```typescript
import { createClient } from '@blaizejs/client';

const client = createClient('https://api.example.com', routes);
```

### Step 5: Use the Client

```typescript
// client/src/app.ts
import client from './api';

async function loadUser(userId: string) {
  try {
    const user = await client.$get.getUser({
      params: { userId },
    });
    
    // TypeScript knows the exact shape of 'user'
    console.log(user.name);  // ✅ string
    console.log(user.email); // ✅ string
    
  } catch (error) {
    console.error('Failed to load user:', error);
  }
}
```

---

## 🎯 RPC Features

### 🔄 Automatic Method Generation

The client automatically generates methods for all your routes:

```typescript
// Server routes
export const routes = {
  // User operations
  getUser,
  createUser,
  updateUser,
  deleteUser,
  
  // Auth operations
  login,
  logout,
  refreshToken,
} as const;

// Client automatically has all these methods!
client.$get.getUser()       // ✅
client.$post.createUser()   // ✅
client.$put.updateUser()    // ✅
client.$delete.deleteUser() // ✅
client.$post.login()        // ✅
client.$post.logout()       // ✅
client.$post.refreshToken() // ✅
```

### 🎨 Full IntelliSense Support

Your IDE shows all available methods with autocomplete:

```typescript
client.$get.  // IDE shows: getUser, getPosts, etc.
client.$post. // IDE shows: createUser, login, etc.
```

### 🔒 Type-Safe Parameters

All parameters are fully typed:

```typescript
// ✅ Correct
await client.$get.getUser({
  params: { userId: '550e8400-e29b-41d4-a716-446655440000' },
});

// ❌ TypeScript error - wrong type
await client.$get.getUser({
  params: { userId: 123 }, // Expected string, got number
});

// ❌ TypeScript error - missing required param
await client.$get.getUser({
  params: {}, // Missing userId
});
```

### 🎁 Type-Safe Responses

Response types are automatically inferred:

```typescript
const user = await client.$get.getUser({ params: { userId: '123' } });

// TypeScript knows the exact shape
console.log(user.id);    // ✅ string
console.log(user.name);  // ✅ string
console.log(user.age);   // ❌ Property 'age' does not exist
```

---

## 📖 Core API

### Creating a Client

```typescript
import bc from '@blaizejs/client';

// Simple - just URL and routes
const client = bc.create('https://api.example.com', routes);

// With configuration
const client = bc.create({
  baseUrl: 'https://api.example.com',
  timeout: 10000,
  defaultHeaders: {
    'Authorization': 'Bearer token',
    'X-API-Key': 'secret',
  },
}, routes);
```

### Method Pattern

All RPC methods follow: `client.$[method].[routeName](...)`

```typescript
client.$get.routeName()    // GET requests
client.$post.routeName()   // POST requests
client.$put.routeName()    // PUT requests
client.$patch.routeName()  // PATCH requests
client.$delete.routeName() // DELETE requests
```

### Request Arguments

```typescript
interface RequestArgs {
  params?: Record<string, string>;  // URL path parameters
  query?: Record<string, any>;      // Query string
  body?: unknown;                   // Request body (POST/PUT/PATCH)
  files?: Record<string, File | File[]>; // File uploads
}
```

---

## 🛡️ Error Handling

All errors are automatically transformed to `BlaizeError`:

```typescript
import { BlaizeError } from 'blaizejs';

try {
  const user = await client.$get.getUser({ 
    params: { userId: 'invalid' } 
  });
} catch (error) {
  if (error instanceof BlaizeError) {
    switch (error.status) {
      case 404:
        console.log('User not found');
        break;
      case 401:
        console.log('Unauthorized');
        break;
      case 500:
        console.log('Server error');
        break;
    }
  }
}
```

### Error Structure

```typescript
interface BlaizeError {
  type: string;           // Error type (e.g., 'NOT_FOUND')
  title: string;          // Human-readable message
  status: number;         // HTTP status code
  correlationId: string;  // Request correlation ID
  timestamp: string;      // ISO timestamp
  details?: unknown;      // Error-specific details
}
```

---

## 💡 Advanced Patterns

### Authentication

```typescript
// Create authenticated client
const createAuthClient = (token: string) => {
  return bc.create({
    baseUrl: 'https://api.example.com',
    defaultHeaders: {
      Authorization: `Bearer ${token}`,
    },
  }, routes);
};

// Use it
const authClient = createAuthClient(userToken);
const profile = await authClient.$get.getProfile();
```

### Request Logging

```typescript
// Wrap client for logging
function withLogging(client: any) {
  return new Proxy(client, {
    get(target, method) {
      return new Proxy(target[method], {
        get(methodTarget, routeName) {
          const original = methodTarget[routeName];
          return async (...args: any[]) => {
            console.log(`[RPC] ${String(method)}.${String(routeName)}`);
            const start = Date.now();
            try {
              const result = await original(...args);
              console.log(`✅ Success in ${Date.now() - start}ms`);
              return result;
            } catch (error) {
              console.log(`❌ Failed in ${Date.now() - start}ms`);
              throw error;
            }
          };
        },
      });
    },
  });
}

const loggedClient = withLogging(client);
```

### Batch Requests

```typescript
// Execute multiple requests in parallel
const [users, posts, stats] = await Promise.all([
  client.$get.getUsers({ query: { limit: 10 } }),
  client.$get.getPosts({ query: { limit: 5 } }),
  client.$get.getStats(),
]);
```

---

## 🧪 Testing

Testing RPC calls is straightforward:

```typescript
import { describe, test, expect, vi } from 'vitest';
import bc from '@blaizejs/client';

describe('RPC Client', () => {
  test('should call server function', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: '123',
        name: 'Test User',
        email: 'test@example.com',
      }),
    });

    const client = bc.create('https://api.example.com', routes);
    
    const user = await client.$get.getUser({ 
      params: { userId: '123' } 
    });
    
    expect(user.name).toBe('Test User');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.example.com/users/123',
      expect.objectContaining({ method: 'GET' })
    );
  });
});
```

---

## 📚 Type System

### How It Works

```typescript
// 1. Server defines the contract
const getUser = route.get({
  schema: {
    params: z.object({ id: z.string() }),
    response: z.object({ 
      id: z.string(),
      name: z.string() 
    })
  },
  handler: async ({ ctx, params }) => { /* ... */ }
});

// 2. TypeScript infers the types
type GetUserParams = { id: string };
type GetUserResponse = { id: string; name: string };

// 3. Client gets automatic typing
const user = await client.$get.getUser({ 
  params: { id: '123' } // Must match GetUserParams
});
// user is typed as GetUserResponse
```

### Type Flow

```
Server Route Definition
    ↓
Type Extraction
    ↓
Registry Building
    ↓
Client Creation
    ↓
Fully Typed RPC Client
```

---

## 🗺️ Roadmap

### ✅ Current (v0.5.1)

- ✅ Full RPC functionality with type safety
- ✅ Proxy-based method generation
- ✅ Automatic type inference
- ✅ RESTful URL mapping
- ✅ Error transformation
- ✅ SSE support
- ✅ File upload support
- ✅ Correlation ID tracking

### 🎯 v1.0 Release

- 🔄 WebSocket RPC (bidirectional real-time)
- 🔄 Request batching
- 🔄 Request cancellation (AbortController)
- 🔄 Optimistic updates helper
- 🔄 React Query adapter
- 🔄 SWR adapter

### 🔮 Post-1.0

- 🔄 GraphQL integration
- 🔄 gRPC-Web support
- 🔄 Offline queue
- 🔄 Request deduplication
- 🔄 Streaming responses

---

## 🤝 Contributing

We welcome contributions! See our [Contributing Guide](../../CONTRIBUTING.md).

### Development Setup

```bash
git clone https://github.com/jleajones/blaize.git
cd blaize
pnpm install
pnpm --filter @blaizejs/client test
```

---

## 📄 License

MIT © [BlaizeJS Contributors](https://github.com/jleajones/blaize/graphs/contributors)

---

**Built with ❤️ by the BlaizeJS team**

_Yes, we have RPC, and it's awesome! 🚀_