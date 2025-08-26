# 🔥 BlaizeJS

> **The TypeScript-first Node.js framework with native RPC support** - Build type-safe APIs with automatic client generation, file-based routing, and progressive middleware pipelines

[![npm version](https://badge.fury.io/js/blaizejs.svg)](https://badge.fury.io/js/blaizejs)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

## 🚀 What Makes BlaizeJS Different?

**BlaizeJS brings true RPC (Remote Procedure Call) to Node.js** - call your server functions directly from the client with full end-to-end type safety, no code generation, and zero configuration.

```typescript
// 🖥️ Server: Define your function
export const getUser = createGetRoute({
  schema: { params: z.object({ id: z.string() }) },
  handler: async (ctx) => {
    return await db.users.findById(ctx.params.id);
  }
});

// 🔌 Client: Call it like a local function!
const user = await client.$get.getUser({ params: { id: '123' } });
//                              ^^^^^^^ Full type safety & autocomplete!

// 🎯 That's it! No REST endpoints to document, no Axios, no type definitions. Just functions.
```

### ✨ Key Features

- 🔌 **RPC-First Development** - Call server functions from the client with automatic type inference
- 📂 **File-Based Routing** - Routes are automatically discovered from your file structure
- 🧩 **Progressive Middleware** - Type-safe middleware that progressively enhances context
- ⚡ **HTTP/2 Support** - Native HTTP/2 with automatic HTTPS in development
- 🛡️ **End-to-End Type Safety** - Types flow seamlessly from server to client
- 🎯 **Zero Configuration** - Works out of the box with sensible defaults
- 🔄 **Hot Module Replacement** - Fast development with instant feedback

## 📦 Quick Start

Get started in under 60 seconds:

```bash
# Create a new BlaizeJS app
npx create-blaize-app my-app
cd my-app

# Start developing
npm run dev
```

Visit `http://localhost:3000` to see your app running!

## 🎯 Core Concepts

### 🔌 RPC-Style API Development

BlaizeJS provides true RPC functionality similar to tRPC, but with cleaner HTTP semantics:

```typescript
// server/routes/users.ts
import { createGetRoute, createPostRoute } from 'blaizejs';
import { z } from 'zod';

export const getUsers = createGetRoute({
  schema: {
    query: z.object({
      page: z.number().default(1),
      limit: z.number().max(100).default(10)
    })
  },
  handler: async (ctx) => {
    const { page, limit } = ctx.query;
    return await db.users.paginate({ page, limit });
  }
});

export const createUser = createPostRoute({
  schema: {
    body: z.object({
      name: z.string().min(1),
      email: z.string().email()
    })
  },
  handler: async (ctx) => {
    const user = await db.users.create(ctx.body);
    return { id: user.id, name: user.name, email: user.email };
  }
});
```

### 🔗 Type-Safe Client

Install the client package and get automatic type inference:

```typescript
// client/api.ts
import bc from '@blaizejs/client';
import type { routes } from '../server/routes';

const client = bc.create('https://api.example.com', routes);

// Full type safety and autocomplete!
const users = await client.$get.getUsers({ 
  query: { page: 2, limit: 20 } 
});

const newUser = await client.$post.createUser({
  body: { 
    name: 'Jane Doe',
    email: 'jane@example.com'
  }
});
```

### 🧩 Progressive Middleware System

Build composable, type-safe middleware pipelines where context enhancements are tracked:

```typescript
import { createMiddleware, compose } from 'blaizejs';

// Logger middleware
const logger = createMiddleware({
  name: 'logger',
  handler: async (ctx, next) => {
    const start = Date.now();
    console.log(`→ ${ctx.request.method} ${ctx.request.url}`);
    await next();
    console.log(`← ${ctx.response.statusCode} (${Date.now() - start}ms)`);
  }
});

// Auth middleware that enhances context
const auth = createMiddleware({
  name: 'auth',
  handler: async (ctx, next) => {
    const token = ctx.request.header('authorization');
    if (!token) throw new UnauthorizedError('No token');
    
    ctx.state.user = await verifyToken(token);
    await next();
  }
});

// Routes automatically know about middleware context!
export const getProfile = createGetRoute({
  middleware: [auth],
  handler: async (ctx) => {
    // TypeScript knows ctx.state.user exists here!
    return { profile: ctx.state.user };
  }
});
```

## 🌐 Building Public APIs

BlaizeJS excels at public APIs with automatic SDK generation:

```typescript
// server/api/v1/products.ts
export const listProducts = createGetRoute({
  schema: {
    query: z.object({
      category: z.string().optional(),
      minPrice: z.number().optional(),
      maxPrice: z.number().optional(),
    }),
    response: z.array(ProductSchema)
  },
  handler: async (ctx) => {
    return await db.products.find(ctx.query);
  }
});

// Your API consumers get:
// 1. ✅ Type-safe JavaScript/TypeScript SDK
// 2. ✅ Auto-generated API documentation  
// 3. ✅ Validation error messages
// 4. ✅ Versioning support via routes/v1, routes/v2
// 5. ✅ Standard REST semantics (works with any HTTP client)
```

Unlike GraphQL or tRPC, BlaizeJS APIs are just REST:
- Works with `curl`, Postman, or any HTTP client
- Standard HTTP caching  
- CDN friendly
- No special client required (but you get a typed one free!)

## 💡 Why Teams Choose BlaizeJS

**10x less code than Express:**
```typescript
// Express: 50+ lines with types, validation, error handling, documentation
// BlaizeJS: 10 lines with everything built-in

export const createUser = createPostRoute({
  schema: {
    body: z.object({
      name: z.string(),
      email: z.string().email()
    })
  },
  handler: async (ctx) => db.users.create(ctx.body)
});
// ✅ Validated ✅ Typed ✅ Client SDK ready ✅ Error handled
```

**No more API maintenance overhead:**
- ❌ No OpenAPI/Swagger schemas to maintain
- ❌ No Postman collections to update  
- ❌ No client SDKs to generate and publish
- ❌ No API versioning headaches
- ✅ Just write functions, get everything automatically

## 📚 Ecosystem

| Package | Version | Description |
|---------|---------|-------------|
| **[blaizejs](./packages/blaize-core)** | ![npm](https://img.shields.io/npm/v/blaizejs.svg) | Core framework with server, routing, and middleware |
| **[@blaizejs/client](./packages/blaize-client)** | ![npm](https://img.shields.io/npm/v/@blaizejs/client.svg) | Type-safe RPC client for BlaizeJS APIs |
| **[@blaizejs/testing-utils](./packages/blaize-testing-utils)** | ![npm](https://img.shields.io/npm/v/@blaizejs/testing-utils.svg) | Testing utilities for BlaizeJS applications |
| **[create-blaize-app](./packages/create-blaize-app)** | ![npm](https://img.shields.io/npm/v/create-blaize-app.svg) | CLI for scaffolding BlaizeJS projects |

## 🎯 When to Use BlaizeJS

**BlaizeJS is perfect for:**
- ✅ Full-stack TypeScript applications with type-safe client-server communication
- ✅ Public REST APIs that need automatic client SDKs
- ✅ Teams who want tRPC-style DX with REST semantics
- ✅ Projects requiring real-time features (SSE, WebSockets)
- ✅ Applications needing background job processing
- ✅ Developers tired of maintaining API contracts manually

**Consider alternatives if:**
- ❌ You need multi-runtime support today (Cloudflare Workers, Bun, Deno) → use Hono
- ❌ You require GraphQL as your primary API → use Apollo Server
- ❌ You're not using TypeScript → use Express or Fastify

## ⚡ Performance

BlaizeJS prioritizes **developer velocity** over micro-optimizations:

- **Fast enough** for 99% of production applications
- **HTTP/2 native** with multiplexing and server push ready
- **Optimized** for developer productivity and type safety
- **Scalable** with standard Node.js deployment practices

We focus on features that save you hours of development time. Benchmarks coming in v1.0.

## 🗺️ Roadmap

### ✅ Current (v0.3.x)
- ✅ Core server with HTTP/2 support
- ✅ File-based routing with auto-discovery
- ✅ RPC-style route creation
- ✅ Type-safe client with automatic inference
- ✅ Middleware system with composition
- ✅ Plugin architecture
- ✅ Comprehensive error handling
- ✅ Schema validation with Zod
- ✅ Testing utilities
- ✅ Project scaffolding CLI

### 🎯 Coming Soon (v1.0)
- 🔄 **Streaming RPC** - Server-sent events with type-safe subscriptions
- 🔄 **WebSocket RPC** - Bidirectional real-time function calls
- 🔄 **Background Jobs** - Type-safe async job processing
- 🔄 **Built-in Middleware** - Auth, CORS, rate limiting, compression

### 🔮 Future Vision
- 📊 **BlaizeKV** - Managed cache/queue/pubsub service
- 🎨 **DevTools** - Browser extension for debugging RPC calls
- 📝 **OpenAPI Export** - Generate OpenAPI from your typed routes
- 🌐 **Edge Runtime** - Deploy to Cloudflare Workers/Vercel Edge

## 🌟 Why BlaizeJS?

| Feature | BlaizeJS | Express | Fastify | Hono |
|---------|----------|---------|---------|------|
| **RPC Support** | ✅ Native | ❌ No | ❌ No | ✅ Via RPC |
| **Type Safety** | ✅ End-to-end | ⚠️ Partial | ⚠️ Partial | ✅ Yes |
| **File Routing** | ✅ Built-in | ❌ No | ❌ No | ✅ Yes |
| **HTTP/2** | ✅ Native | ⚠️ Manual | ✅ Yes | ✅ Yes |
| **Auto Client** | ✅ Yes | ❌ No | ❌ No | ✅ Via RPC |
| **Zero Config** | ✅ Yes | ❌ No | ⚠️ Partial | ✅ Yes |

## 🤝 Contributing

We welcome contributions! See our [Contributing Guide](./CONTRIBUTING.md) for details.

```bash
# Clone the repository
git clone https://github.com/jleajones/blaize.git
cd blaize

# Install dependencies (we use pnpm)
pnpm install

# Run tests
pnpm test

# Start playground
pnpm dev
```

## 📖 Documentation

- [Getting Started Guide](./docs/guides/getting-started.md)
- [RPC & Client Guide](./docs/guides/rpc-client.md)  
- [Middleware Guide](./docs/guides/middleware.md)
- [Testing Guide](./docs/guides/testing.md)
- [API Reference](./docs/reference/api.md)
- [Examples](./examples)

## 📄 License

MIT © [BlaizeJS Team](https://github.com/jleajones)

---

<div align="center">
  <strong>Built with ❤️ by developers, for developers</strong>
  <br />
  <a href="https://github.com/jleajones/blaize">GitHub</a> •
  <a href="https://discord.gg/blaizejs">Discord</a> •
  <a href="https://twitter.com/blaizejs">Twitter</a>
</div>