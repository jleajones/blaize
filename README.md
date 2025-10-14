# 🔥 BlaizeJS

> **Type-safe RPC for Node.js** - Call server functions from the client like local functions, with full TypeScript inference and zero configuration

[![npm version](https://badge.fury.io/js/blaizejs.svg)](https://badge.fury.io/js/blaizejs)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-23.0+-green.svg)](https://nodejs.org/)
[![Build Status](https://github.com/jleajones/blaize/workflows/Test/badge.svg)](https://github.com/jleajones/blaize/actions)

## ✨ What is BlaizeJS?

BlaizeJS brings the simplicity of **function calls** to API development. Write functions on your server, call them from your client - with full type safety, autocompletion, and no code generation.

```typescript
// Server: Write a function
import { createRouteFactory } from 'blaizejs';

const route = createRouteFactory();

export const getUser = route.get({
  handler: async (ctx, params) => {
    return { id: params.userId, name: 'Alice' };
  },
});

// Client: Call it like a function
const user = await client.$get.getUser({
  params: { userId: '123' },
});
// ↑ This is RPC! Full type safety, no REST boilerplate
```

## 🚀 Quick Start

```bash
# Create a new BlaizeJS project
npx create-blaize-app my-api
cd my-api
pnpm dev

# Or use your preferred package manager
pnpm create blaize-app my-api
yarn create blaize-app my-api
```

## 🤔 Why BlaizeJS?

**If you want Express:** Use Express - it has a massive ecosystem  
**If you want speed:** Use Fastify - it's battle-tested  
**If you want simplicity:** Use Hono - it's elegant

**Use BlaizeJS if you want:**

- 🎯 **Type-safe RPC** - Call server functions directly from the client
- 📡 **Built-in SSE** - Real-time streaming with typed events
- 🔒 **End-to-end type safety** - Without code generation
- 📂 **File-based routing** - Your file structure is your API
- ⚡ **HTTP/2 native** - Modern protocol from the ground up

### How We Compare

| Feature       | BlaizeJS | Express | Hono | tRPC | Fastify |
| ------------- | -------- | ------- | ---- | ---- | ------- |
| Type-safe RPC | ✅       | ❌      | 🟡   | ✅   | ❌      |
| RESTful URLs  | ✅       | ✅      | ✅   | ❌   | ✅      |
| Built-in SSE  | ✅       | ❌      | ✅   | ❌   | ❌      |
| File routing  | ✅       | ❌      | ❌   | ❌   | ❌      |
| Zero config   | ✅       | ❌      | ✅   | 🟡   | ❌      |
| HTTP/2 native | ✅       | 🟡      | 🟡   | 🟡   | ✅      |

## 🎯 The RPC Magic

BlaizeJS turns your server functions into type-safe client methods with full context awareness:

### 1. Setup Your Server with Shared Route Factory

```typescript
// server.ts
import {
  createServer,
  createStateMiddleware,
  createPlugin,
  inferContext,
  createRouteFactory,
} from 'blaizejs';
import type { User, Database } from './types';

// Create auth middleware that adds user to state
const authMiddleware = createStateMiddleware<{ user?: User }>({
  name: 'auth',
  handler: async (ctx, next) => {
    const token = ctx.request.header('authorization');
    if (token) {
      ctx.state.user = await validateToken(token);
    }
    await next();
  },
});

// Create database plugin that adds db service
const databasePlugin = createPlugin('database', '1.0.0', config => ({
  name: 'database',
  initialize: async () => {
    const db = await connectDB(config);
    return { db };
  },
  middleware: async (ctx, next) => {
    ctx.services.db = db;
    await next();
  },
}));

// Create the server with everything composed
export const server = createServer({
  port: 3000,
  middleware: [authMiddleware],
  plugins: [databasePlugin({ connectionString: process.env.DATABASE_URL })],
  routesDir: './routes',
});

// Export the inferred context type
type AppContext = inferContext<typeof server>;

// Export a shared route factory for all route files to use
export const appRoute = createRouteFactory<
  AppContext['state'], // Includes { user?: User } from auth middleware
  AppContext['services'] // Includes { db: Database } from db plugin
>();
```

### 2. Define Type-Safe Routes Using Shared Factory

```typescript
// routes/users/[userId].ts
import { appRoute } from '../../server';
import { ForbiddenError, NotFoundError, UnauthorizedError } from 'blaizejs';
import { z } from 'zod';

// Use the shared route factory - types are already set up!
export const getUser = appRoute.get({
  schema: {
    params: z.object({ userId: z.string() }),
    response: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
      isCurrentUser: z.boolean(),
    }),
  },
  handler: async (ctx, params) => {
    // ✅ ctx.state.user is typed from middleware!
    // ✅ ctx.services.db is typed from plugin!

    const user = await ctx.services.db.users.findById(params.userId);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    return {
      ...user,
      isCurrentUser: ctx.state.user?.id === user.id,
    };
  },
});

export const updateUser = appRoute.put({
  schema: {
    params: z.object({ userId: z.string() }),
    body: z.object({ name: z.string(), email: z.string().email() }),
  },
  handler: async (ctx, params) => {
    // Check authorization using typed state
    if (!ctx.state.user) {
      throw new UnauthorizedError('Must be logged in');
    }

    if (ctx.state.user.id !== params.userId) {
      throw new ForbiddenError('Can only update your own profile');
    }

    // Use typed services
    return await ctx.services.db.users.update(params.userId, ctx.body);
  },
});
```

```typescript
// routes/posts/index.ts
import { appRoute } from '../../server';
import { z } from 'zod';

// Same factory, same types, different file!
export const listPosts = appRoute.get({
  schema: {
    query: z.object({
      limit: z.number().default(10),
      offset: z.number().default(0),
    }),
  },
  handler: async ctx => {
    // Every route has access to the same typed context
    const posts = await ctx.services.db.posts.list({
      limit: ctx.query.limit,
      offset: ctx.query.offset,
      userId: ctx.state.user?.id, // Optional: filter by logged-in user
    });

    return { posts };
  },
});
```

### 3. Export Your API Contract (Separate File)

```typescript
// app-contract.ts
import { getUser, updateUser } from './routes/users/[userId]';
import { listUsers, createUser } from './routes/users';
import { listPosts, createPost } from './routes/posts';
import { notifications } from './routes/notifications';

// This is your type-safe API contract!
// Client imports this to get all available endpoints
export const apiContract = {
  // User endpoints
  getUser,
  updateUser,
  listUsers,
  createUser,

  // Post endpoints
  listPosts,
  createPost,

  // Real-time endpoints
  notifications,
} as const;

// Optional: Export type for the contract
export type ApiContract = typeof apiContract;
```

### 4. Call From Client (The Magic Part!)

```typescript
// client.ts
import bc from '@blaizejs/client';
import { apiContract } from '../server/app-contract';

// Create typed client from your API contract
const api = bc.create('https://api.example.com', apiContract, {
  defaultHeaders: {
    Authorization: `Bearer ${getToken()}`,
  },
});

// Call your server functions with full type safety!
const user = await api.$get.getUser({
  params: { userId: '123' },
});
// ↑ TypeScript knows: user.isCurrentUser exists!

const posts = await api.$get.listPosts({
  query: { limit: 20, offset: 0 },
});
// ↑ TypeScript knows: posts.posts is an array!

// Even errors are typed and meaningful!
try {
  await api.$put.updateUser({
    params: { userId: 'other-user-id' },
    body: { name: 'Hacker', email: 'hack@evil.com' },
  });
} catch (error) {
  if (error.type === 'FORBIDDEN') {
    console.log(error.title); // "Can only update your own profile"
  }
}
```

**This is the full picture: Server → Shared Route Factory → Routes → Contract → Client. All type-safe!** ✨

## 📡 Real-time with SSE

Built-in Server-Sent Events with the same type-safe approach:

```typescript
// Server: Define typed event streams
import { createRouteFactory } from 'blaizejs';
import { z } from 'zod';

const route = createRouteFactory();

export const notifications = route.sse({
  schema: {
    events: {
      notification: z.object({
        id: z.string(),
        type: z.enum(['info', 'warning', 'error']),
        message: z.string(),
      }),
      userStatus: z.object({
        userId: z.string(),
        status: z.enum(['online', 'offline', 'away']),
      }),
    },
  },
  handler: async (stream, ctx, params) => {
    // Send typed events
    stream.send('notification', {
      id: '1',
      type: 'info',
      message: 'Welcome!',
    });

    // TypeScript enforces event schemas!
    // stream.send('notification', { wrong: 'shape' }); // ❌ Error!
  },
});

// Client: Consume typed events
const events = await api.$sse.notifications();
events.on('notification', data => {
  console.log(data.message); // ← TypeScript knows this exists!
});
```

## 📁 File-Based Routing

Your file structure becomes your API - no route configuration needed:

```
routes/
├── index.ts              → /
├── users/
│   ├── index.ts         → /users
│   └── [userId]/
│       ├── index.ts     → /users/:userId
│       └── posts.ts     → /users/:userId/posts
└── notifications.ts     → /notifications (SSE)
```

## 🧩 Additional Features

### Type-Safe Middleware

```typescript
const auth = createStateMiddleware<{ user?: User }>({
  handler: async (ctx, next) => {
    const token = ctx.request.header('authorization');
    if (token) {
      ctx.state.user = await verifyToken(token);
      // ↑ TypeScript tracks state changes!
    }
    await next();
  },
});
```

### Semantic Error Handling

```typescript
// 11 built-in error classes that become HTTP responses
throw new NotFoundError('User not found', {
  resourceType: 'user',
  resourceId: params.userId,
});

// Automatic response formatting:
// HTTP 404
// {
//   "type": "NOT_FOUND",
//   "title": "User not found",
//   "status": 404,
//   "correlationId": "req_abc123",
//   "details": { ... }
// }
```

### Plugin System

```typescript
const metricsPlugin = createPlugin('metrics', '1.0.0', () => ({
  initialize: async server => {
    // Extend your server
  },
}));
```

## 📦 Installation Options

### Quick Start (Recommended)

```bash
npx create-blaize-app my-api
```

### Manual Installation

```bash
# Core framework
npm install blaizejs zod

# Type-safe client
npm install @blaizejs/client

# Testing utilities
npm install -D @blaizejs/testing-utils vitest
```

## 🧪 Testing

Test with the same type safety:

```typescript
import { createTestContext } from '@blaizejs/testing-utils';

test('user endpoint', async () => {
  const ctx = createTestContext({
    method: 'GET',
    params: { userId: '123' },
  });

  const result = await getUser(ctx, ctx.params);
  expect(result.id).toBe('123');
});
```

## 📚 Documentation

- **[Getting Started](https://github.com/jleajones/blaize/wiki/Getting-Started)** - Complete tutorial
- **[RPC Guide](https://github.com/jleajones/blaize/wiki/RPC-Guide)** - Deep dive into RPC features
- **[API Reference](https://github.com/jleajones/blaize/wiki/API-Reference)** - Complete API docs
- **[Examples](https://github.com/jleajones/blaize/tree/main/examples)** - Sample applications
- **[Roadmap](https://github.com/jleajones/blaize/wiki/Roadmap)** - Future plans

## 🏗️ Project Status

**Current:** v0.4.0 - Core features stable, working towards v1.0  
**Production Ready:** Q1 2025 (estimated)

### Working Today

- ✅ Type-safe RPC (server → client)
- ✅ File-based routing
- ✅ Server-Sent Events (SSE)
- ✅ Middleware system
- ✅ Error handling (11 error classes)
- ✅ HTTP/2 support
- ✅ Create-blaize-app CLI

### Coming Soon

- 🚧 **Job Queues & Pipelines** - Background processing with type-safe jobs
- 🚧 **Essential Middleware** - CORS, rate limiting, compression, security headers
- 🚧 **Auth Plugin** - Authentication & authorization out of the box
- 🚧 **Database Plugin** - Type-safe database access with migrations
- 🚧 **Caching Layer** - Built-in caching with Redis/memory adapters
- 🚧 **API Documentation** - Auto-generated OpenAPI specs from your types

## 🤝 Contributing

We welcome contributions! See our [Contributing Guide](CONTRIBUTING.md).

```bash
git clone https://github.com/jleajones/blaize.git
cd blaize
pnpm install
pnpm test
pnpm --filter playground dev
```

## 📞 Support

- 🐛 **[Issues](https://github.com/jleajones/blaize/issues)** - Bug reports and feature requests
- 💬 **[Discussions](https://github.com/jleajones/blaize/discussions)** - Questions and ideas

## 📄 License

MIT © [J.Lea-Jones](https://github.com/jleajones)

## 🙏 Acknowledgments

Built on the shoulders of giants:

- **Next.js** - For pioneering file-based routing
- **Express** - For pioneering Node.js frameworks
- **Fastify** - For performance insights
- **Hono** - For modern edge-first patterns
- **tRPC** - For proving type-safe RPC
- **Zod** - For runtime validation

---

**🔥 Stop writing REST boilerplate. Start calling functions.**
