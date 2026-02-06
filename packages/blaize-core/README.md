# 🔥 BlaizeJS

> Call server functions like local functions — fully typed

[![npm version](https://badge.fury.io/js/blaizejs.svg)](https://badge.fury.io/js/blaizejs)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20.0+-green.svg)](https://nodejs.org/)
[![Build Status](https://github.com/jleajones/blaize/workflows/Test/badge.svg)](https://github.com/jleajones/blaize/actions)

BlaizeJS is a TypeScript-first backend framework that brings end-to-end type safety to Node.js APIs. Define your routes once, and get full autocomplete and type checking on both server and client — no code generation, no manual type syncing, no runtime overhead.

---

## ✨ The Magic

```typescript
// src/app.ts — Create your server and typed route factory
import { Blaize, type InferContext } from 'blaizejs';

const app = Blaize.createServer({
  port: 3000,
  routesDir: './src/routes',
});

// Create a typed route factory — shares types across all routes
type AppContext = InferContext<typeof app>;
export const route = Blaize.Router.createRouteFactory<
  AppContext['state'],
  AppContext['services']
>();

await app.listen();
```

```typescript
// src/routes/users/[userId].ts — Routes get full type inference
import { route } from '../../app';
import { z } from 'zod';

export const getUser = route.get({
  schema: {
    params: z.object({ userId: z.string().uuid() }),
    response: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string().email(),
    }),
  },
  handler: async ({ ctx, params }) => {
    // ctx.state and ctx.services are fully typed from middleware/plugins!
    return await db.users.findById(params.userId);
  },
});
```

```typescript
// src/app-type.ts — Export your route registry for the client
import { getUser } from './routes/users/[userId]';
import { listUsers, createUser } from './routes/users';

export const routes = {
  getUser,
  listUsers,
  createUser,
} as const;
```

```typescript
// client.ts — Full autocomplete, zero configuration
import { createClient } from '@blaizejs/client';
import { routes } from './server/app-type';

// Create client with URL and routes registry
const client = createClient('https://api.example.com', routes);

// Methods use the EXPORT NAME — not the path!
const user = await client.$get.getUser({
  params: { userId: '550e8400-e29b-41d4-a716-446655440000' },
});
// ^ user is typed as { id: string; name: string; email: string }
```

**Define once. Infer everywhere.** Your IDE knows every route, every parameter, every response shape — automatically.

---

## 🎯 Why BlaizeJS?

### 🔒 End-to-End Type Safety

Types flow from your Zod schemas through your handlers to your client calls. Change a response field and TypeScript catches it everywhere — no manual syncing required.

```typescript
// Define your schema once
const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.enum(['admin', 'user']), // Add a field here...
});

export const listUsers = route.get({
  schema: { response: z.array(userSchema) },
  handler: async () => getUsers(),
});

// Export to routes registry, client automatically knows about `role`
const users = await client.$get.listUsers();
users[0].role; // ✅ Autocomplete: 'admin' | 'user'
```

### 📡 Real-Time Built In

Server-Sent Events with typed event schemas. Stream data to clients with the same type safety as your REST endpoints.

```typescript
// Server: Stream job progress
export const getJobStatus = route.sse({
  schema: {
    query: z.object({ jobId: z.string() }),
    events: {
      progress: z.object({ percent: z.number(), message: z.string() }),
      complete: z.object({ result: z.string() }),
      error: z.object({ code: z.string(), message: z.string() }),
    },
  },
  handler: async ({ stream, ctx }) => {
    stream.send('progress', { percent: 0, message: 'Starting...' });
    // ... do work ...
    stream.send('complete', { result: 'Done!' });
  },
});
```

```typescript
// Client: Typed event listeners (browser only)
const events = await client.$sse.getJobStatus({ query: { jobId: '123' } });
events.on('progress', data => {
  console.log(`${data.percent}%: ${data.message}`);
});
```

### ⚙️ Background Jobs with Progress Tracking

Built-in job queues with priority scheduling, retries, and real-time progress streaming via SSE.

```typescript
// Define a job handler
const processVideo = async (ctx: JobContext<{ videoId: string }>) => {
  ctx.progress(10, 'Downloading...');
  const video = await download(ctx.data.videoId);

  ctx.progress(50, 'Transcoding...');
  const output = await transcode(video);

  ctx.progress(90, 'Uploading...');
  await upload(output);

  return { url: output.url };
};

// Queue a job from any route
const jobId = await ctx.services.queue.add('media', 'process-video', {
  videoId: '123',
});
```

### 🛡️ Errors That Make Sense

12 semantic error classes that automatically format to proper HTTP responses with correlation IDs for distributed tracing.

```typescript
// Throw semantic errors
if (!user) {
  throw new NotFoundError('User not found', {
    resourceType: 'user',
    resourceId: userId,
    suggestion: 'Verify the user ID exists',
  });
}

// Automatic HTTP response:
// {
//   "type": "NOT_FOUND",
//   "title": "User not found",
//   "status": 404,
//   "correlationId": "req_k3x2m1_9z8y7w6v",
//   "timestamp": "2024-01-15T10:30:00.000Z",
//   "details": {
//     "resourceType": "user",
//     "resourceId": "123",
//     "suggestion": "Verify the user ID exists"
//   }
// }
```

---

## 🚀 Quick Start

### Create a New Project

The fastest way to get started is with `create-blaize-app`:

```bash
# Using pnpm (recommended)
pnpm dlx create-blaize-app my-app

# Using npm
npx create-blaize-app my-app

# Using yarn
yarn dlx create-blaize-app my-app
```

```bash
cd my-app
pnpm dev
# 🔥 Server running at https://localhost:7485
```

### Verify It Works

```bash
curl -k https://localhost:7485/health
# {"status":"ok","timestamp":1703001234567}
```

That's it! You have a fully configured BlaizeJS project with TypeScript, file-based routing, and example routes.

<details>
<summary><strong>📦 Manual Installation</strong></summary>

If you prefer to add BlaizeJS to an existing project:

```bash
# Using pnpm
pnpm add blaizejs zod

# Using npm
npm install blaizejs zod

# Using yarn
yarn add blaizejs zod
```

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

// Create typed route factory
type AppContext = InferContext<typeof app>;
export const route = Blaize.Router.createRouteFactory<
  AppContext['state'],
  AppContext['services']
>();

await app.listen();
console.log('🔥 Server running at https://localhost:3000');
```

```typescript
// src/routes/health.ts
import { route } from '../app';
import { z } from 'zod';

export const getHealth = route.get({
  schema: {
    response: z.object({ status: z.literal('ok'), timestamp: z.number() }),
  },
  handler: async () => ({
    status: 'ok' as const,
    timestamp: Date.now(),
  }),
});
```

```typescript
// src/app-type.ts — Export routes registry for the client
import { getHealth } from './routes/health';

export const routes = {
  getHealth,
} as const;
```

</details>

### Add a Type-Safe Client

Connect to your API with full type inference:

```bash
pnpm add @blaizejs/client
```

```typescript
// client.ts
import { createClient } from '@blaizejs/client';
import { routes } from './server/app-type';

// Create client with URL and routes registry
const client = createClient('https://localhost:3000', routes);

// Methods use the EXPORT NAME from your routes
const health = await client.$get.getHealth();
console.log(health.status); // ✅ Typed as 'ok'
console.log(health.timestamp); // ✅ Typed as number
```

---

## 📦 Ecosystem

| Package | Version | Description | Status |
|---------|---------|-------------|--------|
| [`blaizejs`](./packages/blaize-core) | 0.9.2 | Core framework | 🟡 Beta |
| [`@blaizejs/client`](./packages/blaize-client) | 0.5.1 | Type-safe RPC client | 🟡 Beta |
| [`@blaizejs/plugin-queue`](./plugins/queue) | 2.0.0 | Background job processing with Redis | 🟢 Stable |
| [`@blaizejs/plugin-cache`](./plugins/cache) | 2.0.0 | Caching with memory/Redis adapters | 🟢 Stable |
| [`@blaizejs/plugin-metrics`](./plugins/metrics) | 4.0.0 | Prometheus metrics & dashboard | 🟡 Beta |
| [`@blaizejs/middleware-security`](./middleware/security) | 4.0.0 | Security headers (CSP, HSTS) | 🟡 Beta |
| [`@blaizejs/testing-utils`](./packages/blaize-testing-utils) | 0.2.0 | Test helpers & mocks | 🟡 Beta |
| [`@blaizejs/adapter-redis`](./adapters/redis) | 2.0.0 | Redis adapter for queue & cache | 🟢 Stable |
| `create-blaize-app` | 0.1.21 | Project scaffolding CLI | 🟡 Beta |

### 🔮 Coming Soon

| Package | Description |
|---------|-------------|
| `@blaizejs/plugin-storage` | File storage abstraction (S3, local, etc.) |
| `@blaizejs/plugin-db` | Database integration with migrations |
| `@blaizejs/plugin-rate-limit` | Flexible rate limiting |
| `@blaizejs/middleware-compression` | Response compression |
| `@blaizejs/plugin-auth` | Authentication strategies |

---

## 📚 Documentation

### Getting Started

- [Quick Start](#-quick-start) — Zero to API in 5 minutes
- [30-Minute Tutorial](./docs/getting-started/tutorial.md) — Build a complete task API
- [Architecture Overview](./ARCHITECTURE.md) — How BlaizeJS works under the hood

### Core Guides

- [Routing Guide](./docs/guides/routing.md) — File-based routing patterns
- [Middleware Guide](./docs/guides/middleware.md) — Request processing pipeline
- [Plugins Guide](./docs/guides/plugins.md) — Resource management & lifecycle
- [Error Handling Guide](./docs/guides/error-handling.md) — Semantic errors & debugging
- [Real-Time Guide](./docs/guides/real-time.md) — SSE and Event Bus
- [Client Guide](./docs/guides/client.md) — Type-safe RPC & SSE client
- [Testing Guide](./docs/guides/testing.md) — Test your BlaizeJS apps

### API Reference

- [`blaizejs`](./packages/blaize-core/README.md) — Core framework API
- [`@blaizejs/client`](./packages/blaize-client/README.md) — Client SDK API
- [`@blaizejs/plugin-queue`](./plugins/queue/README.md) — Queue plugin API
- [`@blaizejs/plugin-cache`](./plugins/cache/README.md) — Cache plugin API
- [`@blaizejs/testing-utils`](./packages/blaize-testing-utils/README.md) — Testing utilities API

---

## 🗺️ Roadmap

### ✅ v0.9.2 (Current)

- ✅ Event Bus for distributed coordination
- ✅ Redis adapter for queue and cache
- ✅ Type-safe file handling
- ✅ Enhanced SSE streaming
- ✅ BlaizeLogger as first-class citizen
- ✅ Correlation IDs for distributed tracing

### 🎯 v1.0 (Stable Release)

- [ ] Rate limiting plugin
- [ ] Compression middleware
- [ ] Database plugin with migrations
- [ ] Storage plugin (S3, local)
- [ ] OpenAPI/Swagger generation
- [ ] Authentication plugin
- [ ] Production deployment guides

### 🔮 Future (Post-1.0)

- [ ] Edge runtime support
- [ ] WebSocket support (bidirectional real-time)
- [ ] External queue workers
- [ ] GraphQL integration
- [ ] gRPC-Web support
- [ ] Distributed tracing (OpenTelemetry)
- [ ] AI-powered route generation

[View full roadmap →](https://github.com/jleajones/blaize/projects)

---

## 🌟 Key Features

### Type Safety Everywhere

- **Zero runtime overhead** — Types are compile-time only
- **No code generation** — Pure TypeScript inference
- **Zod integration** — Runtime validation + type inference
- **End-to-end types** — Server schemas → Client calls

### Developer Experience

- **File-based routing** — URL structure mirrors your files
- **Hot reload** — Changes reflect instantly
- **Full autocomplete** — Your IDE knows everything
- **Clear errors** — Helpful error messages with suggestions

### Production Ready

- **HTTP/2 native** — Better performance by default
- **Correlation IDs** — Track requests across services
- **Structured logging** — BlaizeLogger with context
- **Semantic errors** — 12 error types with automatic HTTP formatting
- **Redis adapters** — Production-ready queue & cache

### Real-Time & Background Jobs

- **Server-Sent Events** — Type-safe streaming
- **Event Bus** — Distributed coordination
- **Job queues** — Priority scheduling with retries
- **Progress tracking** — Stream job updates via SSE

---

## 🤝 Contributing

We welcome contributions! BlaizeJS is built by developers, for developers.

- 🐛 **Found a bug?** [Open an issue](https://github.com/jleajones/blaize/issues)
- 💡 **Have an idea?** [Start a discussion](https://github.com/jleajones/blaize/discussions)
- 🔧 **Want to contribute?** See our [Contributing Guide](./CONTRIBUTING.md)

### Development Setup

```bash
git clone https://github.com/jleajones/blaize.git
cd blaize
pnpm install
pnpm test
pnpm build
```

---

## 📄 License

MIT © [BlaizeJS Contributors](https://github.com/jleajones/blaize/graphs/contributors)

---

## 🙏 Acknowledgments

BlaizeJS stands on the shoulders of giants:

- **[tRPC](https://trpc.io/)** — Inspiration for type-safe RPC
- **[Hono](https://hono.dev/)** — Influence on middleware patterns
- **[Fastify](https://fastify.io/)** — Performance benchmarks
- **[Zod](https://zod.dev/)** — Schema validation excellence

---

<p align="center">
  <strong>Built with ❤️ by the BlaizeJS team</strong>
  <br>
  <a href="https://github.com/jleajones/blaize">GitHub</a> •
  <a href="https://discord.gg/blaizejs">Discord</a> •
  <a href="https://twitter.com/blaizejs">Twitter</a>
</p>