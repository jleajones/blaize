# 🚀 BlaizeJS Router Module

> A blazing-fast, type-safe file-based routing system for Node.js applications

[![npm version](https://badge.fury.io/js/blaizejs.svg)](https://badge.fury.io/js/blaizejs)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

## 📋 Table of Contents

- [🌟 Features](#-features)
- [📦 Installation](#-installation)
- [🚀 Quick Start](#-quick-start)
- [📁 ESM Path Resolution](#-esm-path-resolution)
- [📂 File-Based Routing](#-file-based-routing)
- [🔒 Type-Safe Route Creation](#-type-safe-route-creation)
- [🔧 API Reference](#-api-reference)
- [🧩 Plugin Route Creation](#-plugin-route-creation)
- [🔍 Error Handling](#-error-handling)
- [✅ Testing](#-testing)
- [🤝 Contributing](#-contributing)
- [🗺️ Roadmap](#️-roadmap)

## 🌟 Features

- ⚡ **File-based routing** with automatic path generation
- 🔒 **End-to-end type safety** with Zod schema validation
- 🔥 **Hot reloading** in development mode
- 🧩 **Plugin system** for extensible functionality
- 🛡️ **Built-in error handling** with custom error types
- 📊 **Route conflict detection** for plugin management
- 🎯 **Route-specific middleware** support
- 🚀 **High performance** with radix tree matching
- 🔗 **Type-safe client generation** from route definitions
- 📁 **ESM module support** with proper path resolution

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

### Basic Setup

```typescript
import { createServer } from 'blaizejs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Get the directory name of the current module (required for ESM)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create and start server - router is created automatically!
const server = createServer({
  port: 3000,
  routesDir: path.resolve(__dirname, './routes')  // Proper ESM path resolution
});

await server.listen();
console.log('🚀 Server running on https://localhost:3000');
```

> **💡 How it works:** BlaizeJS automatically creates and configures a router behind the scenes when you create a server. The router discovers all route files in your `routesDir` and sets up the routing table with hot reloading in development mode.

### Advanced Router Access

For advanced use cases, you can access the router directly:

```typescript
import { createServer } from 'blaizejs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const server = createServer({
  routesDir: path.resolve(__dirname, './routes')
});

// Access the router for advanced operations
const router = server.router;

// Check for route conflicts
const conflicts = router.getRouteConflicts();
console.log('Route conflicts:', conflicts);

// Add additional route directories (for plugins, etc.)
await router.addRouteDirectory(
  path.resolve(__dirname, './api-routes'),
  { prefix: '/api' }
);
```

## 📁 ESM Path Resolution

### 🛠️ Why Path Resolution Matters

Since BlaizeJS is built for modern ESM modules, proper path resolution is crucial for reliable route discovery:

```typescript
import { createServer } from 'blaizejs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// ✅ REQUIRED: Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ CORRECT: Use path.resolve() for absolute paths
const server = createServer({
  routesDir: path.resolve(__dirname, './routes')
});

// ❌ AVOID: Relative paths are unreliable in ESM
const badServer = createServer({
  routesDir: './routes'  // May not work in all environments
});
```

### 📂 Common Project Structures

```typescript
import { createServer } from 'blaizejs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Pattern 1: Routes alongside server file
// src/
// ├── server.ts
// └── routes/
//     ├── index.ts
//     └── users.ts
const server1 = createServer({
  routesDir: path.resolve(__dirname, './routes')
});

// Pattern 2: Nested API structure
// src/
// ├── server.ts
// ├── api/
// │   └── routes/
// │       ├── v1/
// │       └── v2/
const server2 = createServer({
  routesDir: path.resolve(__dirname, './api/routes')
});

// Pattern 3: Monorepo structure
// apps/
// ├── api-server/
// │   ├── index.ts
// │   └── routes/
// └── shared/
//     └── routes/
const server3 = createServer({
  routesDir: path.resolve(__dirname, './routes')
});

// Pattern 4: TypeScript build output
// dist/
// ├── server.js
// └── routes/
//     └── compiled-routes.js
const productionServer = createServer({
  routesDir: path.resolve(__dirname, './routes')
});
```

### 🌍 Environment-Aware Path Resolution

```typescript
import { createServer } from 'blaizejs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const getRoutesDirectory = () => {
  const env = process.env.NODE_ENV || 'development';
  
  switch (env) {
    case 'development':
      // Source TypeScript files
      return path.resolve(__dirname, './routes');
    
    case 'production':
      // Compiled JavaScript files
      return path.resolve(__dirname, './dist/routes');
    
    case 'test':
      // Test fixtures
      return path.resolve(__dirname, './test-fixtures/routes');
    
    default:
      return path.resolve(__dirname, './routes');
  }
};

const server = createServer({
  routesDir: getRoutesDirectory()
});
```

### 🔗 Multiple Route Directories

```typescript
import { createServer } from 'blaizejs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const server = createServer({
  // Primary routes directory
  routesDir: path.resolve(__dirname, './routes')
});

// Add additional route directories
await server.router.addRouteDirectory(
  path.resolve(__dirname, './api-v2-routes'),
  { prefix: '/api/v2' }
);

await server.router.addRouteDirectory(
  path.resolve(__dirname, './admin-routes'),
  { 
    prefix: '/admin',
    middleware: [adminAuthMiddleware]
  }
);

// Result:
// ./routes/users.ts           → /users
// ./api-v2-routes/posts.ts    → /api/v2/posts  
// ./admin-routes/dashboard.ts → /admin/dashboard
```

### ⚙️ Plugin Route Registration

```typescript
import { createPlugin } from 'blaizejs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const blogPlugin = createPlugin('blog', '1.0.0', async (server, options) => {
  // Register plugin routes with proper path resolution
  await server.router.addRouteDirectory(
    path.resolve(__dirname, './blog-routes'),
    { prefix: '/blog' }
  );
  
  return {
    initialize: async () => {
      console.log('Blog routes loaded from:', path.resolve(__dirname, './blog-routes'));
    }
  };
});

// Plugin directory structure:
// plugins/blog/
// ├── index.ts
// └── blog-routes/
//     ├── index.ts       → /blog
//     ├── [slug].ts      → /blog/:slug
//     └── admin/
//         └── posts.ts   → /blog/admin/posts
```

## 📂 File-Based Routing

The router automatically maps file structure to URL paths:

```
routes/
├── index.ts          → /
├── users.ts          → /users
├── users/
│   ├── [id].ts       → /users/:id
│   └── profile.ts    → /users/profile
├── api/
│   ├── v1/
│   │   └── posts.ts  → /api/v1/posts
│   └── health.ts     → /api/health
└── products/
    └── [category]/
        └── [id].ts   → /products/:category/:id
```

### 🏷️ Route Parameters

```typescript
// routes/users/[id].ts - Dynamic route parameter
import { createGetRoute } from 'blaizejs';
import { z } from 'zod';

export const getUserById = createGetRoute({
  schema: {
    params: z.object({
      id: z.string().uuid()
    }),
    response: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string()
    })
  },
  handler: async (ctx, params) => {
    // params.id is automatically typed as string & validated as UUID
    const user = await findUserById(params.id);
    return user;
  }
});
```

### 🌐 Multiple Parameters

```typescript
// routes/products/[category]/[id].ts
import { createGetRoute } from 'blaizejs';
import { z } from 'zod';

export const getProduct = createGetRoute({
  schema: {
    params: z.object({
      category: z.enum(['electronics', 'clothing', 'books']),
      id: z.string().uuid()
    }),
    response: z.object({
      id: z.string(),
      name: z.string(),
      category: z.string(),
      price: z.number()
    })
  },
  handler: async (ctx, params) => {
    // params: { category: "electronics" | "clothing" | "books", id: string }
    const product = await findProduct(params.category, params.id);
    return product;
  }
});
```

### 🔥 Hot Reloading in Development

BlaizeJS watches your routes directory and automatically reloads routes when files change:

```typescript
// NODE_ENV=development
const server = createServer({
  routesDir: path.resolve(__dirname, './routes')
});

await server.listen();

// The server will automatically:
// ✅ Watch for file changes in routes directory
// ✅ Reload routes when files are added/modified/deleted
// ✅ Emit 'routes:reloaded' events
// ✅ Preserve server connections during reload

server.events.on('routes:reloaded', (count) => {
  console.log(`🔄 Reloaded ${count} routes`);
});
```

## 🔒 Type-Safe Route Creation

BlaizeJS provides two patterns for creating routes, with **route creator functions being the recommended approach** for maximum type safety and client generation capabilities.

### ⭐ Pattern 1: Route Creator Functions (Recommended)

**Why route creators are preferred:**
- 🔒 **End-to-end type safety** from API to client
- 🔗 **Automatic client generation** with full type inference
- 📝 **Schema-driven development** with Zod validation
- ⚡ **Compile-time error catching** vs runtime failures
- 🎯 **Better IDE experience** with autocomplete and refactoring

```typescript
// routes/users.ts
import { 
  createGetRoute, 
  createPostRoute,
  createPutRoute,
  createDeleteRoute,
  createPatchRoute,
  createHeadRoute,
  createOptionsRoute
} from 'blaizejs';
import { z } from 'zod';

// GET /users - List users with pagination
export const getUsers = createGetRoute({
  schema: {
    query: z.object({
      limit: z.coerce.number().min(1).max(100).default(10),
      offset: z.coerce.number().min(0).default(0),
      search: z.string().optional()
    }),
    response: z.object({
      users: z.array(z.object({
        id: z.string(),
        name: z.string(),
        email: z.string(),
        createdAt: z.string().datetime()
      })),
      total: z.number(),
      hasMore: z.boolean()
    })
  },
  handler: async (ctx, params) => {
    // Query params are automatically typed and validated
    const { limit, offset, search } = ctx.request.query;
    
    const result = await getUsersWithPagination({ limit, offset, search });
    return result; // Return type is automatically inferred and validated
  }
});

// POST /users - Create new user
export const createUser = createPostRoute({
  schema: {
    body: z.object({
      name: z.string().min(1).max(100),
      email: z.string().email(),
      age: z.number().min(13).max(120).optional()
    }),
    response: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
      age: z.number().optional(),
      createdAt: z.string().datetime()
    })
  },
  handler: async (ctx, params) => {
    // Request body is typed and validated automatically
    const userData = ctx.request.body;
    
    const newUser = await createNewUser(userData);
    return newUser; // Response automatically validated
  }
});

// PUT /users/:id - Update user completely
export const updateUser = createPutRoute({
  schema: {
    params: z.object({
      id: z.string().uuid()
    }),
    body: z.object({
      name: z.string().min(1).max(100),
      email: z.string().email(),
      age: z.number().min(13).max(120).optional()
    }),
    response: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
      age: z.number().optional(),
      updatedAt: z.string().datetime()
    })
  },
  handler: async (ctx, params) => {
    // Both params and body are fully typed
    const updates = ctx.request.body;
    const userId = params.id;
    
    const updatedUser = await updateUserById(userId, updates);
    return updatedUser;
  }
});

// PATCH /users/:id - Partial user update
export const patchUser = createPatchRoute({
  schema: {
    params: z.object({
      id: z.string().uuid()
    }),
    body: z.object({
      name: z.string().min(1).max(100).optional(),
      email: z.string().email().optional(),
      age: z.number().min(13).max(120).optional()
    }).refine(data => Object.keys(data).length > 0, {
      message: "At least one field must be provided for update"
    }),
    response: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
      age: z.number().optional(),
      updatedAt: z.string().datetime()
    })
  },
  handler: async (ctx, params) => {
    const patches = ctx.request.body;
    const userId = params.id;
    
    const patchedUser = await patchUserById(userId, patches);
    return patchedUser;
  }
});

// DELETE /users/:id - Remove user
export const deleteUser = createDeleteRoute({
  schema: {
    params: z.object({
      id: z.string().uuid()
    }),
    response: z.object({
      success: z.boolean(),
      message: z.string(),
      deletedAt: z.string().datetime()
    })
  },
  handler: async (ctx, params) => {
    await deleteUserById(params.id);
    
    return {
      success: true,
      message: `User ${params.id} deleted successfully`,
      deletedAt: new Date().toISOString()
    };
  }
});

// HEAD /users/:id - Check if user exists (no response body)
export const checkUser = createHeadRoute({
  schema: {
    params: z.object({
      id: z.string().uuid()
    })
  },
  handler: async (ctx, params) => {
    const userExists = await checkUserExists(params.id);
    
    if (!userExists) {
      ctx.response.status(404);
    } else {
      ctx.response.status(200);
    }
    // HEAD requests don't return data
  }
});

// OPTIONS /users - CORS preflight handling
export const usersOptions = createOptionsRoute({
  handler: async (ctx) => {
    ctx.response
      .header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS')
      .header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
      .status(204);
  }
});
```

### 📝 Pattern 2: Default Export (Simple)

For simpler use cases or when client generation isn't needed:

```typescript
// routes/health.ts
import { z } from 'zod';

export default {
  GET: {
    schema: {
      response: z.object({
        status: z.literal('ok'),
        timestamp: z.string(),
        uptime: z.number()
      })
    },
    handler: async (ctx, params) => {
      return {
        status: 'ok' as const,
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      };
    }
  },

  // Multiple methods in one file
  POST: {
    schema: {
      body: z.object({
        service: z.string()
      }),
      response: z.object({
        service: z.string(),
        healthy: z.boolean()
      })
    },
    handler: async (ctx, params) => {
      const { service } = ctx.request.body;
      const isHealthy = await checkServiceHealth(service);
      
      return {
        service,
        healthy: isHealthy
      };
    }
  }
};
```

## 🔧 API Reference

### Route Creator Functions

All HTTP methods are supported with their respective creator functions:

```typescript
import {
  createGetRoute,      // GET requests
  createPostRoute,     // POST requests  
  createPutRoute,      // PUT requests (full updates)
  createDeleteRoute,   // DELETE requests
  createPatchRoute,    // PATCH requests (partial updates)
  createHeadRoute,     // HEAD requests (metadata only)
  createOptionsRoute   // OPTIONS requests (CORS, capabilities)
} from 'blaizejs';
```

### Route Configuration

```typescript
interface RouteConfig<P, Q, B, R> {
  schema?: {
    params?: P;    // URL parameters schema (Zod schema)
    query?: Q;     // Query string schema (Zod schema)
    body?: B;      // Request body schema (Zod schema)
    response?: R;  // Response schema (Zod schema)
  };
  handler: RouteHandler<P, Q, B, R>;
  middleware?: Middleware[];           // Route-specific middleware
  options?: Record<string, unknown>;   // Additional route options
}
```

### Route-Specific Middleware

Routes can have their own middleware that runs before the handler:

```typescript
// routes/protected.ts
import { createGetRoute, createMiddleware } from 'blaizejs';
import { z } from 'zod';

const authMiddleware = createMiddleware({
  name: 'auth',
  handler: async (ctx, next) => {
    const token = ctx.request.header('authorization');
    if (!token?.startsWith('Bearer ')) {
      return ctx.response.status(401).json({ error: 'Unauthorized' });
    }
    
    // Validate token and attach user to context
    const user = await validateToken(token);
    ctx.state.user = user;
    
    await next();
  }
});

const rateLimitMiddleware = createMiddleware({
  name: 'rateLimit',
  handler: async (ctx, next) => {
    const remaining = await checkRateLimit(ctx.request.ip);
    if (remaining <= 0) {
      return ctx.response.status(429).json({ error: 'Rate limit exceeded' });
    }
    await next();
  }
});

export const getProtectedData = createGetRoute({
  middleware: [authMiddleware, rateLimitMiddleware], // Runs in order
  schema: {
    response: z.object({
      message: z.string(),
      user: z.object({
        id: z.string(),
        name: z.string()
      }),
      sensitiveData: z.array(z.string())
    })
  },
  handler: async (ctx) => {
    // User is available from auth middleware
    const user = ctx.state.user;
    
    const data = await getSensitiveUserData(user.id);
    
    return {
      message: 'Protected data accessed successfully',
      user,
      sensitiveData: data
    };
  }
});
```

> **ℹ️ Global Middleware:** For server-wide middleware (CORS, logging, etc.), see the [Server Module documentation](../server/README.md).

## 🧩 Plugin Route Creation

Plugins create routes using the exact same patterns as your main application. This ensures consistency and type safety across your entire codebase.

### Plugin Route Example

```typescript
// plugins/auth/routes/login.ts
import { createPostRoute } from 'blaizejs';
import { z } from 'zod';

export const login = createPostRoute({
  schema: {
    body: z.object({
      email: z.string().email(),
      password: z.string().min(8)
    }),
    response: z.object({
      token: z.string(),
      user: z.object({
        id: z.string(),
        email: z.string(),
        name: z.string()
      }),
      expiresAt: z.string().datetime()
    })
  },
  handler: async (ctx, params) => {
    const { email, password } = ctx.request.body;
    
    const authResult = await authenticateUser(email, password);
    
    if (!authResult.success) {
      return ctx.response.status(401).json({ 
        error: 'Invalid credentials' 
      });
    }
    
    return {
      token: authResult.token,
      user: authResult.user,
      expiresAt: authResult.expiresAt
    };
  }
});

// plugins/auth/routes/profile.ts  
export const getProfile = createGetRoute({
  middleware: [authMiddleware], // Same middleware system
  schema: {
    response: z.object({
      user: z.object({
        id: z.string(),
        email: z.string(),
        name: z.string(),
        lastLogin: z.string().datetime()
      })
    })
  },
  handler: async (ctx) => {
    const user = await getUserProfile(ctx.state.user.id);
    return { user };
  }
});
```

### Plugin Integration with ESM Paths

```typescript
// plugins/auth/index.ts
import { createPlugin } from 'blaizejs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const authPlugin = createPlugin('auth', '1.0.0', async (server, options) => {
  // Register plugin routes with proper ESM path resolution
  await server.router.addRouteDirectory(
    path.resolve(__dirname, './routes'),
    { prefix: '/auth' }
  );
  
  return {
    initialize: async () => {
      console.log('Auth routes loaded from:', path.resolve(__dirname, './routes'));
    }
  };
});

// When plugin routes are added, they get prefixed automatically
// POST /auth/login
// GET /auth/profile
```

> **🔗 Learn More:** For complete plugin system documentation including lifecycle management, dependency injection, and configuration, see the [Plugins Module documentation](../plugins/README.md).

## 🔍 Error Handling

### Built-in Validation

Route creators automatically validate requests using your Zod schemas:

```typescript
export const createUser = createPostRoute({
  schema: {
    body: z.object({
      email: z.string().email(),
      age: z.number().min(13)
    })
  },
  handler: async (ctx, params) => {
    // If we reach here, body is guaranteed to be valid
    const { email, age } = ctx.request.body;
    // ...
  }
});

// Invalid request (age < 13) automatically returns:
// 400 Bad Request
// {
//   "error": "Validation Error", 
//   "details": [
//     {
//       "path": ["age"],
//       "message": "Number must be greater than or equal to 13"
//     }
//   ]
// }
```

### Custom Error Handling

```typescript
import { createGetRoute } from 'blaizejs';
import { z } from 'zod';

// Custom error types
class UserNotFoundError extends Error {
  constructor(userId: string) {
    super(`User ${userId} not found`);
    this.name = 'UserNotFoundError';
  }
}

export const getUserById = createGetRoute({
  schema: {
    params: z.object({
      id: z.string().uuid()
    }),
    response: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string()
    })
  },
  handler: async (ctx, params) => {
    const user = await findUser(params.id);
    
    if (!user) {
      // Custom error handling
      throw new UserNotFoundError(params.id);
    }
    
    return user;
  }
});
```

### Error Response Formats

BlaizeJS provides consistent error responses:

```typescript
// Validation Error (400)
{
  "error": "Validation Error",
  "details": [
    {
      "path": ["email"],
      "message": "Invalid email format"
    }
  ]
}

// Not Found (404)
{
  "error": "Not Found",
  "message": "Route not found: GET /nonexistent"
}

// Method Not Allowed (405)  
{
  "error": "Method Not Allowed",
  "allowed": ["GET", "POST"],
  "message": "DELETE method not allowed for /users"
}

// Internal Server Error (500)
{
  "error": "Internal Server Error",
  "message": "An unexpected error occurred"
}
```

> **🛡️ Error Middleware:** For global error handling and custom error processing, see the [Middleware Module documentation](../middleware/README.md).

## ✅ Testing

### Testing Route Creator Functions

```typescript
// tests/routes/users.test.ts
import { describe, test, expect, vi } from 'vitest';
import { createTestContext } from '@blaizejs/testing-utils';
import { getUsers, createUser } from '../routes/users';

describe('Users Routes', () => {
  test('should return paginated users list', async () => {
    // Arrange
    const ctx = createTestContext({
      method: 'GET',
      path: '/users',
      query: { limit: '5', offset: '10' }
    });

    // Mock the database call
    vi.mock('../services/userService', () => ({
      getUsersWithPagination: vi.fn().mockResolvedValue({
        users: [
          { id: '1', name: 'John', email: 'john@example.com', createdAt: '2023-01-01T00:00:00Z' }
        ],
        total: 1,
        hasMore: false
      })
    }));

    // Act
    const result = await getUsers.handler(ctx, {});

    // Assert
    expect(result).toEqual({
      users: expect.arrayContaining([
        expect.objectContaining({
          id: expect.any(String),
          name: expect.any(String),
          email: expect.any(String)
        })
      ]),
      total: expect.any(Number),
      hasMore: expect.any(Boolean)
    });

    // Verify query parameters were properly typed
    expect(ctx.request.query.limit).toBe(5); // Coerced to number
    expect(ctx.request.query.offset).toBe(10);
  });

  test('should create user with valid data', async () => {
    const ctx = createTestContext({
      method: 'POST',
      path: '/users',
      body: {
        name: 'Jane Doe',
        email: 'jane@example.com',
        age: 25
      }
    });

    const result = await createUser.handler(ctx, {});

    expect(result).toMatchObject({
      id: expect.any(String),
      name: 'Jane Doe',
      email: 'jane@example.com',
      age: 25,
      createdAt: expect.any(String)
    });
  });

  test('should validate request body schema', async () => {
    const ctx = createTestContext({
      method: 'POST',
      path: '/users',
      body: {
        name: '', // Invalid: empty string
        email: 'invalid-email', // Invalid: not an email
        age: 12 // Invalid: under 13
      }
    });

    // Schema validation should catch these errors
    await expect(createUser.handler(ctx, {})).rejects.toThrow();
  });
});
```

### Testing Default Export Routes

```typescript
// tests/routes/health.test.ts
import { describe, test, expect } from 'vitest';
import { createTestContext } from '@blaizejs/testing-utils';
import healthRoute from '../routes/health';

describe('Health Route', () => {
  test('should return health status', async () => {
    const ctx = createTestContext({
      method: 'GET',
      path: '/health'
    });

    const result = await healthRoute.GET.handler(ctx, {});

    expect(result).toEqual({
      status: 'ok',
      timestamp: expect.any(String),
      uptime: expect.any(Number)
    });
  });
});
```

### Testing Route Parameters

```typescript
// tests/routes/users-params.test.ts
import { describe, test, expect } from 'vitest';
import { createTestContext } from '@blaizejs/testing-utils';
import { getUserById, updateUser } from '../routes/users/[id]';

describe('User Parameter Routes', () => {
  test('should handle valid UUID parameter', async () => {
    const validUuid = '123e4567-e89b-12d3-a456-426614174000';
    const ctx = createTestContext({
      method: 'GET',
      path: `/users/${validUuid}`
    });

    // Mock successful user lookup
    vi.mock('../services/userService', () => ({
      findUserById: vi.fn().mockResolvedValue({
        id: validUuid,
        name: 'Test User',
        email: 'test@example.com'
      })
    }));

    const result = await getUserById.handler(ctx, { id: validUuid });

    expect(result.id).toBe(validUuid);
  });

  test('should reject invalid UUID parameter', async () => {
    const ctx = createTestContext({
      method: 'GET',
      path: '/users/invalid-uuid'
    });

    // Schema validation should reject invalid UUID
    await expect(
      getUserById.handler(ctx, { id: 'invalid-uuid' })
    ).rejects.toThrow(/uuid/i);
  });
});
```

### Testing All HTTP Methods

```typescript
// tests/routes/crud-operations.test.ts
import { describe, test, expect } from 'vitest';
import { createTestContext } from '@blaizejs/testing-utils';
import { 
  getUsers,
  createUser,
  updateUser,
  patchUser,
  deleteUser,
  checkUser
} from '../routes/users';

describe('CRUD Operations', () => {
  const validUserId = '123e4567-e89b-12d3-a456-426614174000';

  test('GET: should list users', async () => {
    const ctx = createTestContext({ method: 'GET', path: '/users' });
    const result = await getUsers.handler(ctx, {});
    
    expect(result).toHaveProperty('users');
    expect(result).toHaveProperty('total');
    expect(result).toHaveProperty('hasMore');
  });

  test('POST: should create user', async () => {
    const ctx = createTestContext({
      method: 'POST',
      path: '/users',
      body: { name: 'New User', email: 'new@example.com' }
    });
    
    const result = await createUser.handler(ctx, {});
    expect(result).toHaveProperty('id');
    expect(result.name).toBe('New User');
  });

  test('PUT: should update entire user', async () => {
    const ctx = createTestContext({
      method: 'PUT',
      path: `/users/${validUserId}`,
      body: { name: 'Updated User', email: 'updated@example.com' }
    });
    
    const result = await updateUser.handler(ctx, { id: validUserId });
    expect(result.name).toBe('Updated User');
  });

  test('PATCH: should partially update user', async () => {
    const ctx = createTestContext({
      method: 'PATCH',
      path: `/users/${validUserId}`,
      body: { name: 'Patched Name' } // Only updating name
    });
    
    const result = await patchUser.handler(ctx, { id: validUserId });
    expect(result.name).toBe('Patched Name');
  });

  test('DELETE: should remove user', async () => {
    const ctx = createTestContext({
      method: 'DELETE',
      path: `/users/${validUserId}`
    });
    
    const result = await deleteUser.handler(ctx, { id: validUserId });
    expect(result.success).toBe(true);
  });

  test('HEAD: should check user existence', async () => {
    const ctx = createTestContext({
      method: 'HEAD',
      path: `/users/${validUserId}`
    });
    
    await checkUser.handler(ctx, { id: validUserId });
    
    // HEAD requests set status but don't return data
    expect(ctx.response.status).toHaveBeenCalledWith(200);
  });
});
```

### Testing ESM Path Resolution

```typescript
// tests/integration/router-paths.test.ts
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { createServer } from 'blaizejs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Router Path Resolution', () => {
  let server: ReturnType<typeof createServer>;

  afterEach(async () => {
    if (server) {
      await server.close();
    }
  });

  test('should resolve routes directory correctly', async () => {
    server = createServer({ 
      port: 0,
      routesDir: path.resolve(__dirname, '../test-fixtures/routes'),
      watchMode: false 
    });
    
    // Wait for routes to load
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(server.router).toBeDefined();
    // Routes should be loaded from the correct directory
  });

  test('should handle multiple route directories', async () => {
    server = createServer({ 
      port: 0,
      routesDir: path.resolve(__dirname, '../test-fixtures/routes'),
      watchMode: false 
    });

    // Add additional route directory
    await server.router.addRouteDirectory(
      path.resolve(__dirname, '../test-fixtures/api-routes'),
      { prefix: '/api' }
    );

    await server.listen();

    // Test routes from both directories
    const mainResponse = await fetch(`http://localhost:${server.port}/test`);
    const apiResponse = await fetch(`http://localhost:${server.port}/api/test`);

    expect(mainResponse.ok).toBe(true);
    expect(apiResponse.ok).toBe(true);
  });
});
```

### Integration Testing

```typescript
// tests/integration/router.test.ts
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { createServer } from 'blaizejs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createTestContext } from '@blaizejs/testing-utils';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Router Integration', () => {
  let server: ReturnType<typeof createServer>;

  beforeEach(async () => {
    server = createServer({ 
      port: 0,
      routesDir: path.resolve(__dirname, '../test-fixtures/routes'),
      watchMode: false 
    });
    
    // Wait for routes to load
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterEach(async () => {
    if (server) {
      await server.close();
    }
  });

  test('should handle successful route resolution', async () => {
    const ctx = createTestContext({
      method: 'GET',
      path: '/users'
    });

    await server.router.handleRequest(ctx);

    expect(ctx.response.status).toHaveBeenCalledWith(200);
  });

  test('should return 404 for unknown routes', async () => {
    const ctx = createTestContext({
      method: 'GET',
      path: '/nonexistent'
    });

    await server.router.handleRequest(ctx);

    expect(ctx.response.status).toHaveBeenCalledWith(404);
    expect(ctx.response.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Not Found' })
    );
  });

  test('should return 405 for unsupported methods', async () => {
    const ctx = createTestContext({
      method: 'DELETE',
      path: '/users' // Assuming only GET/POST are supported
    });

    await server.router.handleRequest(ctx);

    expect(ctx.response.status).toHaveBeenCalledWith(405);
    expect(ctx.response.header).toHaveBeenCalledWith(
      'Allow', 
      expect.stringContaining('GET')
    );
  });
});
```

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage

# Run only router tests
pnpm test router

# Run specific test file
pnpm test tests/routes/users.test.ts
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](../../CONTRIBUTING.md) for details.

### 🛠️ Development Setup

```bash
# Clone the repository
git clone https://github.com/jleajones/blaize.git
cd blaize

# Install dependencies
pnpm install

# Run tests
pnpm test

# Start development
pnpm dev
```

### 📝 Code Standards

- ✅ Use TypeScript for all source code
- ✅ Follow existing code patterns and naming conventions
- ✅ Write comprehensive tests using Vitest
- ✅ Update documentation for new features
- ✅ Use conventional commits for clear history
- ✅ Test ESM path resolution in different environments

### 🔧 Available Scripts

```bash
pnpm build          # Build all packages
pnpm dev            # Start development mode
pnpm lint           # Run ESLint
pnpm format         # Format code with Prettier
pnpm type-check     # Run TypeScript checks
pnpm clean          # Clean build artifacts
```

## 🗺️ Roadmap

### 🚀 Current (v0.1.x)
- ✅ File-based routing with automatic path generation
- ✅ Type-safe route handlers with Zod schema validation
- ✅ All HTTP method support (GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS)
- ✅ Route creator functions for enhanced type safety
- ✅ Plugin route creation with same patterns as main app
- ✅ Hot reloading in development mode with chokidar
- ✅ Built-in error handling with custom error types
- ✅ Radix tree routing for high performance matching
- ✅ Request/response validation middleware
- ✅ Multiple route definition patterns (default export + creators)
- ✅ Route-specific middleware support
- ✅ ESM module support with proper path resolution

### 🎯 Next Release (v0.2.x)
- 🔄 **Route Groups** - Organize routes with shared middleware and prefixes
- 🔄 **Advanced Caching** - Built-in response caching strategies with TTL
- 🔄 **Route Metadata** - Enhanced route introspection and documentation
- 🔄 **Performance Metrics** - Built-in timing and performance monitoring
- 🔄 **Router Composition** - Combine multiple routers with namespace isolation

### 🔮 Future (v0.3.x+)
- 🔄 **Wildcard Routes** - Support for catch-all route patterns
- 🔄 **Route Inheritance** - Composable route definitions and inheritance
- 🔄 **OpenAPI Generation** - Automatic API documentation from Zod schemas
- 🔄 **Advanced Parameter Types** - Complex parameter validation and coercion
- 🔄 **Route Versioning** - Built-in API versioning support

### 🌟 Long-term Vision
- 🔄 **GraphQL Integration** - File-based GraphQL resolvers alongside REST routes
- 🔄 **WebSocket Routing** - Real-time endpoint management with type safety
- 🔄 **Visual Route Designer** - GUI tool for route management and visualization
- 🔄 **Multi-tenancy Support** - Route isolation and customization per tenant

---

## 📚 Related Documentation

- 🏠 [BlaizeJS Main Documentation](../../README.md)
- 🌐 [Server Module](../server/README.md) - HTTP server creation and global middleware
- 🔗 [Client Module](../client/README.md) - Type-safe API client generation
- 🔧 [Context Module](../context/README.md) - Request/response context management
- 🧩 [Plugins Module](../plugins/README.md) - Plugin system and lifecycle management
- 🛡️ [Middleware Module](../middleware/README.md) - Middleware creation and composition

---

**Built with ❤️ by the BlaizeJS team**

For questions, feature requests, or bug reports, please [open an issue](https://github.com/jleajones/blaize/issues) on GitHub.