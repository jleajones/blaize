# 🔥 BlaizeJS Client

> **Type-safe RPC client** for BlaizeJS APIs - Call your server functions directly from the client with full end-to-end type safety

[![npm version](https://badge.fury.io/js/%40blaizejs%2Fclient.svg)](https://badge.fury.io/js/%40blaizejs%2Fclient)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

## 🚀 **Yes, We Have RPC!**

BlaizeJS Client provides **true RPC (Remote Procedure Call) functionality** similar to tRPC or Hono RPC, but with a cleaner API:

```typescript
// Your server function
export const getUser = createGetRoute({
  schema: { /* ... */ },
  handler: async (ctx, params) => {
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

## 📋 Table of Contents

- [🌟 What Makes This RPC?](#-what-makes-this-rpc)
- [📦 Installation](#-installation)
- [🚀 Quick Start](#-quick-start)
- [🎯 RPC Features](#-rpc-features)
- [📖 Core API](#-core-api)
- [🛡️ Error Handling](#️-error-handling)
- [💡 Advanced RPC Patterns](#-advanced-rpc-patterns)
- [🧪 Testing](#-testing)
- [📚 Type System](#-type-system)
- [🗺️ Roadmap](#️-roadmap)
- [🤝 Contributing](#-contributing)

## 🌟 What Makes This RPC?

**RPC (Remote Procedure Call)** means calling server functions as if they were local functions. BlaizeJS Client achieves this through:

### 1️⃣ **Direct Function Mapping**
Your server handlers become client methods automatically:
```typescript
// Server: Define a function
export const calculateTax = createPostRoute({
  handler: async (ctx) => {
    return { tax: ctx.body.amount * 0.2 };
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
const createUser = createPostRoute({
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
  handler: async (ctx) => { /* ... */ }
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

### Step 1: Set Up Your Server with File-Based Routing

BlaizeJS requires file-based routing - routes must be in a specific directory structure:

```typescript
// server/index.ts
import { createServer } from 'blaizejs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// ESM path resolution (required for route discovery)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create server - routes MUST be in a directory
const server = createServer({
  port: 3000,
  host: 'localhost',
  routesDir: path.resolve(__dirname, './routes') // Required!
});

await server.listen();
console.log('🚀 Server running at https://localhost:3000');
```

### Step 2: Define Your Server Functions in Route Files

Routes must follow the file-based structure:

```
server/
├── index.ts                    # Server setup (above)
└── routes/                     # Routes directory (required!)
    ├── users/
    │   ├── index.ts           # GET /users, POST /users
    │   └── [userId]/
    │       └── index.ts       # GET /users/:userId, PUT /users/:userId
    └── posts/
        └── index.ts           # GET /posts, POST /posts
```

```typescript
// server/routes/users/[userId]/index.ts
import { createGetRoute, createPutRoute } from 'blaizejs';
import { z } from 'zod';

// GET /users/:userId - the file path determines the route!
export const getUser = createGetRoute({
  schema: {
    params: z.object({
      userId: z.string().uuid(),
    }),
    response: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
    }),
  },
  handler: async (ctx, params) => {
    // Your actual server logic
    const user = await db.users.findById(params.userId);
    if (!user) throw new NotFoundError('User not found');
    return user;
  },
});

// PUT /users/:userId
export const updateUser = createPutRoute({
  schema: {
    params: z.object({
      userId: z.string().uuid(),
    }),
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
  handler: async (ctx, params) => {
    const updatedUser = await db.users.update(params.userId, ctx.body);
    return updatedUser;
  },
});
```

```typescript
// server/routes/users/index.ts
import { createPostRoute } from 'blaizejs';
import { z } from 'zod';

// POST /users - file location = route path
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
  handler: async (ctx) => {
    // Your actual server logic
    const newUser = await db.users.create(ctx.body);
    await sendWelcomeEmail(newUser.email);
    return newUser;
  },
});
```

### Step 3: Export Your Route Registry for the Client

**Important**: Do NOT create this file in the `routes` directory as it will interfere with file-based routing!

```typescript
// server/src/app-routes.ts - Route registry for client (NOT in routes directory!)
import { getUser, updateUser } from './routes/users/[userId]/index.js';
import { createUser } from './routes/users/index.js';

// Export your route registry - this is your RPC interface!
export const routes = {
  getUser,
  updateUser,
  createUser,
} as const;

// Alternative naming: app-type.ts
export type AppType = typeof routes;
```

### Step 4: Create Your RPC Client

```typescript
// client/api.ts
import bc from '@blaizejs/client';
import { routes } from '../server/src/app-routes'; // Import from src, NOT routes directory!

// Create your RPC client
const client = bc.create('https://api.example.com', routes);

// Now you have an RPC client that calls your server functions!
export default client;
```

### Step 5: Call Server Functions from Client

```typescript
// client/app.ts
import client from './api';

async function myApp() {
  // 🎯 RPC in action - calling server functions directly!
  
  // Call getUser function on the server
  const user = await client.$get.getUser({
    params: { userId: '123e4567-e89b-12d3-a456-426614174000' }
  });
  console.log(user.name); // ✅ Fully typed!
  
  // Call createUser function on the server
  const newUser = await client.$post.createUser({
    body: {
      name: 'Jane Doe',
      email: 'jane@example.com'
    }
  });
  console.log(newUser.id); // ✅ Fully typed!
  
  // TypeScript prevents errors at compile time
  await client.$get.nonExistent(); // ❌ TypeScript error!
  await client.$post.createUser({
    body: { name: 'John' } // ❌ TypeScript error: missing email!
  });
}
```

## 🎯 RPC Features

### 🔄 Automatic Method Generation

The client automatically generates methods for all your routes:

```typescript
// Server routes
export const routes = {
  // User operations
  getUser: createGetRoute({ /* ... */ }),
  createUser: createPostRoute({ /* ... */ }),
  updateUser: createPutRoute({ /* ... */ }),
  deleteUser: createDeleteRoute({ /* ... */ }),
  
  // Post operations  
  getPosts: createGetRoute({ /* ... */ }),
  createPost: createPostRoute({ /* ... */ }),
  
  // Auth operations
  login: createPostRoute({ /* ... */ }),
  logout: createPostRoute({ /* ... */ }),
  refreshToken: createPostRoute({ /* ... */ }),
} as const;

// Client automatically has all these methods!
client.$get.getUser()     // ✅
client.$post.createUser() // ✅
client.$put.updateUser()  // ✅
client.$delete.deleteUser() // ✅
client.$get.getPosts()    // ✅
client.$post.createPost() // ✅
client.$post.login()      // ✅
client.$post.logout()     // ✅
client.$post.refreshToken() // ✅
```

### 🎨 Full IntelliSense Support

Get autocomplete for everything:

```typescript
// As you type, your IDE shows available methods
client.$get.  // IDE shows: getUser, getPosts, etc.
client.$post. // IDE shows: createUser, createPost, login, etc.

// Parameter hints
client.$get.getUser({
  // IDE shows required params structure
  params: {
    userId: // IDE shows: string (uuid format)
  }
});
```

### 🔒 Type-Safe Parameters

All parameters are fully typed based on your schemas:

```typescript
// Path parameters
await client.$get.getUser({
  params: { 
    userId: 123 // ❌ Type error: Expected string, got number
  }
});

// Query parameters  
await client.$get.getPosts({
  query: {
    page: 1,      // ✅ number
    limit: "10"   // ❌ Type error: Expected number
  }
});

// Request body
await client.$post.createUser({
  body: {
    name: "John",
    email: "invalid" // ❌ Type error: Invalid email format
  }
});
```

### 🎁 Type-Safe Responses

Response types are automatically inferred:

```typescript
const user = await client.$get.getUser({ params: { userId: '123' } });

// TypeScript knows the exact shape of 'user'
console.log(user.id);    // ✅ string
console.log(user.name);  // ✅ string  
console.log(user.email); // ✅ string
console.log(user.age);   // ❌ Property 'age' does not exist
```

## 📖 Core API

### Creating an RPC Client

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
    'X-API-Key': 'secret'
  }
}, routes);
```

### RPC Method Pattern

All RPC methods follow the pattern: `client.$[method].[routeName](...)`

```typescript
client.$get.routeName()    // GET requests
client.$post.routeName()   // POST requests
client.$put.routeName()    // PUT requests
client.$delete.routeName() // DELETE requests
client.$patch.routeName()  // PATCH requests
```

### Request Parameters

```typescript
interface RequestArgs {
  params?: Record<string, string>;  // URL path parameters
  query?: Record<string, any>;      // Query string parameters
  body?: unknown;                   // Request body (POST/PUT/PATCH)
}
```

## 🛡️ Error Handling

RPC calls can fail. Handle errors properly:

```typescript
import { BlaizeError } from 'blaizejs';

try {
  const user = await client.$get.getUser({ 
    params: { userId: 'invalid-id' } 
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
      default:
        console.log('Unknown error:', error.message);
    }
  }
}
```

## 💡 Project Structure Best Practices

When using BlaizeJS with the RPC client, follow this recommended structure:

```
my-app/
├── server/
│   ├── src/
│   │   ├── index.ts           # Server setup with createServer
│   │   ├── app-routes.ts      # ✅ Route registry export (for client)
│   │   └── routes/            # ✅ File-based routing directory
│   │       ├── users/
│   │       │   ├── index.ts
│   │       │   └── [userId]/
│   │       │       └── index.ts
│   │       └── posts/
│   │           └── index.ts
│   └── package.json
└── client/
    ├── src/
    │   ├── api.ts             # RPC client setup
    │   └── app.ts             # Your client application
    └── package.json
```

**⚠️ Important**: Never put the route registry export (`app-routes.ts` or `app-type.ts`) inside the `routes` directory! This will cause errors with the file-based routing system.

## 💡 Advanced RPC Patterns

### Authentication with RPC

```typescript
// Create authenticated RPC client
const createAuthClient = (token: string) => {
  return bc.create({
    baseUrl: 'https://api.example.com',
    defaultHeaders: {
      Authorization: `Bearer ${token}`
    }
  }, routes);
};

// Use it
const authClient = createAuthClient(userToken);
const profile = await authClient.$get.getProfile();
```

### Typed Error Handling

```typescript
// Define custom error types on server
class UserNotFoundError extends BlaizeError {
  constructor(userId: string) {
    super(`User ${userId} not found`, 404);
  }
}

// Handle specific errors on client
try {
  const user = await client.$get.getUser({ params: { userId } });
} catch (error) {
  if (error instanceof BlaizeError && error.status === 404) {
    // Handle user not found
  }
}
```

### Request Interceptors

```typescript
// Wrap RPC client for logging, metrics, etc.
function withLogging(client: any) {
  return new Proxy(client, {
    get(target, method) {
      return new Proxy(target[method], {
        get(methodTarget, routeName) {
          const original = methodTarget[routeName];
          return async (...args: any[]) => {
            console.log(`RPC Call: ${String(method)}.${String(routeName)}`);
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
        }
      });
    }
  });
}

const loggedClient = withLogging(client);
```

### Batch RPC Calls

```typescript
// Execute multiple RPC calls in parallel
const [users, posts, comments] = await Promise.all([
  client.$get.getUsers({ query: { limit: 10 } }),
  client.$get.getPosts({ query: { limit: 5 } }),
  client.$get.getComments({ query: { limit: 20 } })
]);
```

## 🧪 Testing

Testing RPC calls is straightforward:

```typescript
import { describe, test, expect, vi } from 'vitest';
import bc from '@blaizejs/client';

describe('RPC Client Tests', () => {
  test('should call server function', async () => {
    // Mock the underlying fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: '123',
        name: 'Test User',
        email: 'test@example.com'
      })
    });

    const client = bc.create('https://api.example.com', routes);
    
    // Call RPC method
    const user = await client.$get.getUser({ 
      params: { userId: '123' } 
    });
    
    // Verify the call
    expect(user.name).toBe('Test User');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.example.com/users/123',
      expect.objectContaining({ method: 'GET' })
    );
  });
});
```

## 📚 Type System

### How RPC Types Work

The magic happens through TypeScript's type system:

```typescript
// 1. Your server defines the contract
const getUser = createGetRoute({
  schema: {
    params: z.object({ id: z.string() }),
    response: z.object({ 
      id: z.string(),
      name: z.string() 
    })
  },
  handler: async (ctx, params) => { /* ... */ }
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

### Type Transformation Pipeline

```typescript
// Server Route Definition
RouteDefinition 
  ↓
// Type Extraction  
ExtractRouteTypes<RouteDefinition>
  ↓
// Registry Building
BuildRoutesRegistry<Routes>
  ↓
// Client Creation
CreateClient<Registry>
  ↓
// Fully Typed RPC Client
client.$method.routeName(args)
```

## ⚠️ Known Limitations

### Current Version (v0.3.1)

- **Zod `.transform()` not supported** - Route schemas using Zod's `.transform()` method are not currently supported. This is a known issue that will be fixed in an upcoming release.
  ```typescript
  // ❌ Currently not supported
  const route = createPostRoute({
    schema: {
      body: z.object({
        date: z.string().transform(str => new Date(str))
      })
    },
    handler: async (ctx) => { /* ... */ }
  });
  
  // ✅ Workaround: Handle transformation in the handler
  const route = createPostRoute({
    schema: {
      body: z.object({
        date: z.string()
      })
    },
    handler: async (ctx) => {
      const date = new Date(ctx.body.date);
      // ... rest of your logic
    }
  });
  ```

- **File-Based Routing Required** - The server requires routes to be in a specific directory structure. Routes cannot be defined arbitrarily - they must follow the file-based routing pattern where the file path determines the URL path.

## 🗺️ Roadmap

### 🚀 Current (v0.3.1)
- ✅ **Full RPC functionality** with type safety
- ✅ Proxy-based method generation
- ✅ Automatic type inference
- ✅ RESTful URL mapping
- ✅ Error transformation

### 🎯 MVP/1.0 Release
- 🔄 **Fix Zod `.transform()` support** - Full support for Zod transformations
- 🔄 **Streaming RPC** - Server-sent events support
- 🔄 **WebSocket RPC** - Bidirectional real-time RPC
- 🔄 **Request batching** - Send multiple RPC calls in one request
- 🔄 **Request cancellation** - AbortController support
- 🔄 **Optimistic updates** - Update UI before server confirms

### 🔮 Post-MVP (v1.1+)
- 🔄 **GraphQL integration** - Use RPC with GraphQL endpoints
- 🔄 **gRPC-Web support** - Connect to gRPC services
- 🔄 **Offline queue** - Queue RPC calls when offline
- 🔄 **React Query adapter** - First-class React Query integration
- 🔄 **SWR adapter** - First-class SWR integration

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
```

### Why Our RPC Implementation?

1. **HTTP-Native**: Unlike tRPC, we use standard HTTP semantics
2. **RESTful URLs**: Your RPC calls map to clean REST endpoints
3. **Zero Config**: No schema definitions or code generation needed
4. **Framework Agnostic**: Works with any TypeScript backend
5. **Progressive Enhancement**: Start with REST, add RPC seamlessly

---

**Built with ❤️ by the BlaizeJS team**

_Yes, we have RPC, and it's awesome! 🚀_