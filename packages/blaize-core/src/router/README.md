# 🚀 BlaizeJS Router Module

> **Type-safe, file-based routing system** for building blazing-fast APIs with automatic validation, middleware integration, and full TypeScript support
>
> Create RESTful endpoints with schema validation, dynamic parameters, and seamless middleware composition

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
- [🛡️ Schema Validation](#️-schema-validation)
- [🔧 Advanced Usage](#-advanced-usage)
- [🧪 Testing](#-testing)
- [📚 Type Reference](#-type-reference)
- [🗺️ Roadmap](#️-roadmap)
- [🤝 Contributing](#-contributing)

## 🌟 Features

- 📁 **File-Based Routing** - Routes automatically discovered from file structure
- 🎯 **Type-Safe Handlers** - Full TypeScript support with type inference
- ✅ **Schema Validation** - Built-in Zod validation for params, query, body, and response
- 🔗 **Dynamic Parameters** - Support for `/users/[userId]` style routes
- 🧩 **Middleware Integration** - Composable middleware at route and method level
- 🚦 **All HTTP Methods** - GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS
- ⚡ **Zero Configuration** - Works out of the box with sensible defaults
- 🔄 **Hot Reloading** - Automatic route updates in development mode
- 🛡️ **Error Handling** - Built-in error handling with typed responses
- 📊 **Route Conflicts Detection** - Automatic detection of overlapping routes

## 📦 Installation

The router module is included with the main BlaizeJS package:

```bash
# Using pnpm (recommended)
pnpm add blaizejs

# Using npm
npm install blaizejs

# Using yarn
yarn add blaizejs
```

## 🚀 Quick Start

### Creating Your First Route

Create a file-based route in your routes directory:

```typescript
// routes/users/[userId]/index.ts
import { createGetRoute, createPutRoute } from 'blaizejs';
import { z } from 'zod';

// Schema definitions
const userParamsSchema = z.object({
  userId: z.string().uuid(),
});

const updateUserBodySchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  age: z.number().int().positive().optional(),
});

const userResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string(),
  age: z.number().optional(),
  createdAt: z.string(),
});

// GET /users/:userId
export const getUserRoute = createGetRoute({
  schema: {
    params: userParamsSchema,
    response: userResponseSchema,
  },
  handler: async (ctx, params) => {
    // params is fully typed: { userId: string }
    const user = await db.users.findById(params.userId);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Response is validated against schema
    return user;
  },
});

// PUT /users/:userId
export const updateUserRoute = createPutRoute({
  schema: {
    params: userParamsSchema,
    body: updateUserBodySchema,
    response: userResponseSchema,
  },
  handler: async (ctx, params) => {
    // ctx.body is fully typed based on schema
    const updatedUser = await db.users.update(params.userId, ctx.body);
    return updatedUser;
  },
});
```

### Using Routes in Your Server

```typescript
import { createServer } from 'blaizejs';

const server = createServer({
  port: 3000,
  routesDir: './routes', // Routes are auto-discovered
});

await server.listen();
```

## 📖 Core Concepts

### 🗂️ File-Based Routing

Routes are automatically discovered based on your file structure:

```
routes/
├── index.ts              → /
├── users/
│   ├── index.ts         → /users
│   └── [userId]/
│       ├── index.ts     → /users/:userId
│       └── posts.ts     → /users/:userId/posts
├── posts/
│   ├── index.ts         → /posts
│   └── [postId].ts      → /posts/:postId
└── api/
    └── v1/
        └── status.ts     → /api/v1/status
```

### 🎭 Route Handlers

Each route file exports handlers for different HTTP methods:

```typescript
// routes/posts/index.ts
import { createGetRoute, createPostRoute } from 'blaizejs';

// GET /posts - List all posts
export const listPostsRoute = createGetRoute({
  handler: async ctx => {
    const posts = await db.posts.findAll();
    return posts;
  },
});

// POST /posts - Create a new post
export const createPostRoute = createPostRoute({
  schema: {
    body: postSchema,
  },
  handler: async ctx => {
    const newPost = await db.posts.create(ctx.body);
    ctx.response.status(201);
    return newPost;
  },
});
```

### 🔗 Dynamic Parameters

Use brackets for dynamic route segments:

```typescript
// routes/teams/[teamId]/members/[memberId].ts
// Matches: /teams/123/members/456

export const getMemberRoute = createGetRoute({
  schema: {
    params: z.object({
      teamId: z.string(),
      memberId: z.string(),
    }),
  },
  handler: async (ctx, params) => {
    // params: { teamId: string, memberId: string }
    return await getTeamMember(params.teamId, params.memberId);
  },
});
```

## 🎯 Core APIs

### Route Creation Functions

All route creators are exported from the main package:

| Function             | HTTP Method | Body Support | Description                |
| -------------------- | ----------- | ------------ | -------------------------- |
| `createGetRoute`     | GET         | ❌           | Retrieve resources         |
| `createPostRoute`    | POST        | ✅           | Create new resources       |
| `createPutRoute`     | PUT         | ✅           | Replace resources          |
| `createPatchRoute`   | PATCH       | ✅           | Partially update resources |
| `createDeleteRoute`  | DELETE      | ❌           | Remove resources           |
| `createHeadRoute`    | HEAD        | ❌           | Check resource existence   |
| `createOptionsRoute` | OPTIONS     | ❌           | Get allowed methods        |

### Route Configuration

Each route creator accepts a configuration object:

```typescript
interface RouteConfig<TParams, TQuery, TBody, TResponse> {
  // Schema validation (all optional)
  schema?: {
    params?: ZodSchema; // URL parameters
    query?: ZodSchema; // Query string
    body?: ZodSchema; // Request body (POST/PUT/PATCH only)
    response?: ZodSchema; // Response validation
  };

  // Route handler function
  handler: (ctx: Context, params: TParams) => Promise<TResponse> | TResponse;

  // Route-specific middleware
  middleware?: Middleware[];

  // Additional options
  options?: Record<string, unknown>;
}
```

## 💡 Common Patterns

### 🔒 Protected Routes with Middleware

```typescript
import { createGetRoute, createMiddleware } from 'blaizejs';

// Auth middleware
const requireAuth = createMiddleware({
  name: 'require-auth',
  handler: async (ctx, next) => {
    const token = ctx.request.header('authorization');

    if (!token) {
      throw new UnauthorizedError('Authentication required');
    }

    ctx.state.user = await verifyToken(token);
    await next();
  },
});

// Protected route
export const getProfileRoute = createGetRoute({
  middleware: [requireAuth],
  handler: async ctx => {
    // ctx.state.user is available from middleware
    return await getUserProfile(ctx.state.user.id);
  },
});
```

### 📄 Pagination Pattern

```typescript
const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['asc', 'desc']).default('desc'),
});

export const listItemsRoute = createGetRoute({
  schema: {
    query: paginationSchema,
  },
  handler: async (ctx, params) => {
    const { page, limit, sort } = ctx.query;

    const items = await db.items.findMany({
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: sort },
    });

    const total = await db.items.count();

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  },
});
```

### 🔍 Search and Filtering

```typescript
const searchSchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  inStock: z.coerce.boolean().optional(),
});

export const searchProductsRoute = createGetRoute({
  schema: {
    query: searchSchema,
  },
  handler: async ctx => {
    const filters = ctx.query;

    const products = await db.products.search({
      where: {
        ...(filters.q && { name: { contains: filters.q } }),
        ...(filters.category && { category: filters.category }),
        ...(filters.minPrice && { price: { gte: filters.minPrice } }),
        ...(filters.maxPrice && { price: { lte: filters.maxPrice } }),
        ...(filters.inStock !== undefined && { inStock: filters.inStock }),
      },
    });

    return products;
  },
});
```

### 📤 File Upload Routes

```typescript
import { createPostRoute } from 'blaizejs';

export const uploadFileRoute = createPostRoute({
  schema: {
    body: z.object({
      file: z.instanceof(File),
      description: z.string().optional(),
    }),
  },
  handler: async ctx => {
    const { file, description } = ctx.body;

    // Process file upload
    const uploadedFile = await storage.upload(file);

    return {
      id: uploadedFile.id,
      url: uploadedFile.url,
      description,
    };
  },
});
```

## 🛡️ Schema Validation

### Comprehensive Validation Example

```typescript
import { z } from 'zod';
import { createPostRoute, ValidationError } from 'blaizejs';

// Define schemas with custom error messages
const createUserSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be at most 20 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),

  email: z.string().email('Invalid email address'),

  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),

  age: z
    .number()
    .int('Age must be a whole number')
    .min(13, 'Must be at least 13 years old')
    .max(120, 'Invalid age')
    .optional(),

  preferences: z
    .object({
      newsletter: z.boolean().default(false),
      notifications: z.boolean().default(true),
    })
    .optional(),
});

export const createUserRoute = createPostRoute({
  schema: {
    body: createUserSchema,
    response: z.object({
      id: z.string(),
      username: z.string(),
      email: z.string(),
      createdAt: z.string(),
    }),
  },
  handler: async ctx => {
    // Input is fully validated and typed
    const user = await db.users.create(ctx.body);

    // Response is validated before sending
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      createdAt: user.createdAt.toISOString(),
    };
  },
});
```

### Custom Validation Logic

```typescript
const customValidationSchema = z
  .object({
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
  })
  .refine(data => new Date(data.endDate) > new Date(data.startDate), {
    message: 'End date must be after start date',
    path: ['endDate'],
  });
```

## 🔧 Advanced Usage

### Route Composition

```typescript
// Shared route configuration
const baseRouteConfig = {
  middleware: [authMiddleware, loggingMiddleware],
  options: { rateLimit: 100 },
};

// Compose routes with shared config
export const getRoute = createGetRoute({
  ...baseRouteConfig,
  handler: async ctx => {
    // Implementation
  },
});

export const postRoute = createPostRoute({
  ...baseRouteConfig,
  schema: { body: createSchema },
  handler: async ctx => {
    // Implementation
  },
});
```

### Conditional Middleware

```typescript
const conditionalAuth = createMiddleware({
  name: 'conditional-auth',
  handler: async (ctx, next) => {
    // Skip auth for public endpoints
    if (ctx.request.path.startsWith('/public')) {
      return next();
    }

    // Require auth for other endpoints
    const token = ctx.request.header('authorization');
    if (!token) {
      throw new UnauthorizedError();
    }

    ctx.state.user = await verifyToken(token);
    await next();
  },
});
```

### Error Response Handling

```typescript
import { ValidationError, NotFoundError, UnauthorizedError, ConflictError } from 'blaizejs';

export const updateRoute = createPutRoute({
  schema: {
    params: z.object({ id: z.string() }),
    body: updateSchema,
  },
  handler: async (ctx, params) => {
    try {
      const resource = await db.resources.findById(params.id);

      if (!resource) {
        throw new NotFoundError('Resource not found');
      }

      if (resource.ownerId !== ctx.state.user.id) {
        throw new UnauthorizedError('Not authorized to update this resource');
      }

      if (await isDuplicate(ctx.body.name)) {
        throw new ConflictError('A resource with this name already exists');
      }

      return await db.resources.update(params.id, ctx.body);
    } catch (error) {
      // Framework automatically handles error responses
      throw error;
    }
  },
});
```

## 🧪 Testing

### Testing Route Handlers

```typescript
import { describe, test, expect, vi } from 'vitest';
import { createMockContext } from '@blaizejs/testing-utils';
import { getUserRoute } from './routes/users/[userId]';

describe('User Routes', () => {
  test('GET /users/:userId returns user', async () => {
    const mockUser = {
      id: '123',
      name: 'John Doe',
      email: 'john@example.com',
    };

    // Mock database call
    vi.mocked(db.users.findById).mockResolvedValue(mockUser);

    // Create mock context
    const ctx = createMockContext({
      method: 'GET',
      path: '/users/123',
    });

    // Execute handler
    const result = await getUserRoute.GET.handler(ctx, { userId: '123' });

    expect(result).toEqual(mockUser);
    expect(db.users.findById).toHaveBeenCalledWith('123');
  });

  test('GET /users/:userId throws 404 for missing user', async () => {
    vi.mocked(db.users.findById).mockResolvedValue(null);

    const ctx = createMockContext({
      method: 'GET',
      path: '/users/999',
    });

    await expect(getUserRoute.GET.handler(ctx, { userId: '999' })).rejects.toThrow(NotFoundError);
  });
});
```

### Testing with Validation

```typescript
import { createMockRoute } from '@blaizejs/testing-utils';

describe('Route Validation', () => {
  test('validates request body', async () => {
    const route = createPostRoute({
      schema: {
        body: z.object({
          email: z.string().email(),
        }),
      },
      handler: async ctx => ctx.body,
    });

    const ctx = createMockContext({
      method: 'POST',
      body: { email: 'invalid-email' },
    });

    // Validation should fail
    await expect(route.POST.handler(ctx, {})).rejects.toThrow(ValidationError);
  });
});
```

### Integration Testing

```typescript
import { createTestServer } from '@blaizejs/testing-utils';

describe('API Integration', () => {
  test('complete user flow', async () => {
    const server = await createTestServer({
      routesDir: './routes',
    });

    // Create user
    const createResponse = await server.inject({
      method: 'POST',
      url: '/users',
      payload: {
        name: 'Jane Doe',
        email: 'jane@example.com',
      },
    });

    expect(createResponse.statusCode).toBe(201);
    const user = JSON.parse(createResponse.payload);

    // Get user
    const getResponse = await server.inject({
      method: 'GET',
      url: `/users/${user.id}`,
    });

    expect(getResponse.statusCode).toBe(200);
    expect(JSON.parse(getResponse.payload)).toEqual(user);

    await server.close();
  });
});
```

## 📚 Type Reference

### Core Types (Exported)

```typescript
// Route handler function
export type RouteHandler<
  TParams = Record<string, string>,
  TQuery = Record<string, string | string[] | undefined>,
  TBody = unknown,
  TResponse = unknown,
> = (ctx: Context<State, TBody, TQuery>, params: TParams) => Promise<TResponse> | TResponse;

// Route method options
export interface RouteMethodOptions<P, Q, B, R> {
  schema?: RouteSchema<P, Q, B, R>;
  handler: RouteHandler;
  middleware?: Middleware[];
  options?: Record<string, unknown>;
}

// Route definition
export interface Route {
  path: string;
  GET?: RouteMethodOptions;
  POST?: RouteMethodOptions;
  PUT?: RouteMethodOptions;
  DELETE?: RouteMethodOptions;
  PATCH?: RouteMethodOptions;
  HEAD?: RouteMethodOptions;
  OPTIONS?: RouteMethodOptions;
}

// HTTP Methods
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
```

### Internal Types (Not Exported)

The following are used internally but not exported from the main package:

- `Router` interface - Used internally by the server
- `RouteMatch` - Internal matching result
- `Matcher` - Internal route matching engine
- `RouteNode` - Internal radix tree structure
- File system utilities (`findRouteFiles`, `loadRoute`, etc.)

To use the router, work with the exported route creation functions and let the server handle routing internally.

## 🗺️ Roadmap

### 🚀 Current (v0.3.1) - Beta

- ✅ **Route Creation Functions** - All HTTP methods supported
- ✅ **Schema Validation** - Zod integration for type safety
- ✅ **Dynamic Parameters** - Bracket-based dynamic routes
- ✅ **File-Based Discovery** - Automatic route loading
- ✅ **Middleware Support** - Route-level middleware
- ✅ **Type Inference** - Full TypeScript support
- ✅ **Error Classes** - Built-in error types

### 🎯 MVP/1.0 Release

#### Core Router Exports _(Need to Export)_

- 🔄 **Router Interface** - Export for plugin/extension use
- 🔄 **Route Matching Utilities** - Export `extractParams`, `compilePathPattern`
- 🔄 **Route Registry** - Export route management utilities

#### Enhanced Features

- 🔄 **Route Groups** - Logical grouping with shared middleware
- 🔄 **Route Versioning** - Built-in API versioning support
- 🔄 **Response Helpers** - Utility functions for common responses
- 🔄 **Route Metadata** - Attach custom metadata to routes
- 🔄 **Async Route Loading** - Lazy load route handlers

### 🔮 Post-MVP (v1.1+)

#### Advanced Routing

- 🔄 **Route Inheritance** - Extend and override routes
- 🔄 **Conditional Routes** - Environment-based route activation
- 🔄 **Route Aliases** - Multiple paths to same handler
- 🔄 **Regex Path Patterns** - Advanced path matching
- 🔄 **Route Namespacing** - Modular route organization

#### Developer Experience

- 🔄 **Route CLI Generator** - Scaffold routes from CLI
- 🔄 **Route Documentation** - Auto-generate API docs
- 🔄 **Route Testing Helpers** - Enhanced testing utilities
- 🔄 **Route Visualization** - Visual route tree explorer
- 🔄 **Type-Safe Client** - Auto-generated client SDK

#### Performance & Monitoring

- 🔄 **Route Caching** - Response caching strategies
- 🔄 **Route Analytics** - Usage metrics and monitoring
- 🔄 **Route Rate Limiting** - Per-route rate limits
- 🔄 **Route Compression** - Automatic response compression

### 🌟 Future Considerations

- 🔄 **GraphQL Integration** - GraphQL endpoint support
- 🔄 **WebSocket Routes** - Real-time communication
- 🔄 **gRPC Support** - Protocol buffer integration
- 🔄 **OpenAPI Generation** - Automatic OpenAPI specs
- 🔄 **Route Federation** - Distributed routing
- 🔄 **AI-Powered Routing** - Intelligent route suggestions

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](../../CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/jleajones/blaize.git
cd blaize

# Install dependencies (using pnpm)
pnpm install

# Run tests for router module
pnpm test router

# Run tests in watch mode
pnpm test:watch router

# Build the package
pnpm build

# Run linting
pnpm lint
```

### Important Notes for Contributors

When adding router features:

1. **Check exports**: Currently, only route creation functions are exported
2. **Internal utilities**: Router, Matcher, and utilities are internal
3. **Type location**: Router types are in `packages/blaize-types/src/router.ts`
4. **Testing**: Use `@blaizejs/testing-utils` for testing routes
5. **File structure**: Follow the file-based routing conventions

### Testing Your Changes

1. Write tests for new features
2. Ensure all tests pass: `pnpm test`
3. Check type safety: `pnpm type-check`
4. Verify linting: `pnpm lint`

## 📚 Related Documentation

- 🏠 [BlaizeJS Main Documentation](../../README.md)
- 🔧 [Middleware Module](../middleware/README.md) - Route middleware
- 🔗 [Context Module](../context/README.md) - Request/response context
- 🌐 [Server Module](../server/README.md) - Server configuration
- 🧩 [Plugins Module](../plugins/README.md) - Extending routing
- 🧪 [Testing Utils](../../../blaize-testing-utils/README.md) - Testing utilities

---

**Built with ❤️ by the BlaizeJS team**

_The router module powers BlaizeJS with type-safe, file-based routing - making API development fast, safe, and enjoyable._
