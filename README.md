# 🔥 BlaizeJS

> A blazing-fast, type-safe Node.js framework with file-based routing, powerful middleware, and end-to-end type safety

[![npm version](https://badge.fury.io/js/blaizejs.svg)](https://badge.fury.io/js/blaizejs)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![Build Status](https://github.com/jleajones/blaize/workflows/Test/badge.svg)](https://github.com/jleajones/blaize/actions)

## 🌟 Features

- ⚡ **HTTP/2 by default** with automatic HTTP/1.1 fallback
- 🔒 **End-to-end type safety** from API to client
- 📁 **File-based routing** with automatic path generation
- 🔗 **Composable middleware** with onion-style execution
- 🧩 **Plugin architecture** with lifecycle management
- 🌐 **Context management** with AsyncLocalStorage
- 🔄 **Hot reloading** in development
- 🛡️ **Schema validation** with built-in Zod integration

## 📦 Quick Start

```bash
pnpm add blaizejs
```

```typescript
import { createServer } from 'blaizejs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const server = createServer({
  routesDir: path.resolve(__dirname, './routes'),
});

await server.listen();
// 🚀 Server running on https://localhost:3000
```

**Create a route** (`routes/users.ts`):

```typescript
import { createGetRoute } from 'blaizejs';
import { z } from 'zod';

export const getUsers = createGetRoute({
  schema: {
    query: z.object({
      limit: z.coerce.number().default(10),
    }),
    response: z.object({
      users: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
        })
      ),
    }),
  },
  handler: async ctx => {
    const { limit } = ctx.request.query;
    return { users: await findUsers(limit) };
  },
});
```

## 🏗️ Monorepo Structure

```
blaize/
├── 📦 packages/                    # Core framework packages
│   ├── blaize-core/               # Main framework (blaizejs)
│   ├── blaize-client/             # Type-safe client generator
│   ├── blaize-types/              # Shared TypeScript types
│   └── blaize-testing-utils/      # Testing utilities
├── 🧩 plugins/                    # Official plugins
│   ├── blaize-auth-plugin/        # Authentication (coming soon)
│   └── blaize-database-plugin/    # Database integration (coming soon)
├── 🎯 apps/                       # Applications & examples
│   ├── docs/                      # Documentation website
│   ├── examples/                  # Example applications
│   └── playground/                # Development playground
└── ⚙️ configs/                    # Shared configurations
```

## 📁 Core Packages

### 🔥 [`blaizejs`](packages/blaize-core) - Main Framework

The core framework providing servers, routing, middleware, and plugins.

```typescript
import { createServer, createGetRoute, createMiddleware, createPlugin } from 'blaizejs';
```

### 🔗 [`@blaizejs/client`](packages/blaize-client) - Type-Safe Client

Automatic API client generation with full type inference.

```typescript
import { createClient } from '@blaizejs/client';

const client = createClient('http://localhost:3000', routes);
const users = await client.$get.getUsers({ query: { limit: 10 } });
```

### 🧪 [`@blaizejs/testing-utils`](packages/blaize-testing-utils) - Testing Tools

Utilities for testing BlaizeJS applications.

```typescript
import { createTestContext } from '@blaizejs/testing-utils';

const ctx = createTestContext({ method: 'GET', path: '/users' });
const result = await getUsers.handler(ctx, {});
```

### 🏷️ [`@blaizejs/types`](packages/blaize-types) - Type Definitions

Shared TypeScript types and interfaces.

```typescript
import type { Context, Middleware, Plugin } from 'blaizejs';
```

## 🛠️ Development

### 📋 Prerequisites

- **Node.js**: >= 22.0.0
- **pnpm**: >= 9.7.0

### 🏁 Setup

```bash
git clone https://github.com/jleajones/blaize.git
cd blaize
pnpm install
```

### 🔧 Scripts

```bash
# Development
pnpm dev                    # Start all packages in dev mode
pnpm build                  # Build all packages

# Testing
pnpm test                   # Run all tests
pnpm test:watch            # Watch mode
pnpm test:coverage         # Coverage reports

# Code Quality
pnpm lint                   # ESLint
pnpm format                # Prettier
pnpm type-check            # TypeScript

# Package Management
pnpm changeset             # Create changeset
pnpm version-packages      # Version packages
pnpm release               # Publish to npm
```

### 🎯 Package-Specific Development

```bash
# Work on specific packages
pnpm --filter blaizejs dev
pnpm --filter @blaizejs/client test
pnpm --filter playground start
```

## 🧪 Testing

Uses Vitest across all packages with shared configuration:

```typescript
// Example test
import { describe, test, expect } from 'vitest';
import { createTestContext } from '@blaizejs/testing-utils';

describe('API Tests', () => {
  test('should handle requests', async () => {
    const ctx = createTestContext({ method: 'GET', path: '/test' });
    const result = await handler(ctx, {});
    expect(result).toBeDefined();
  });
});
```

## 🤝 Contributing

1. **Fork & clone** the repository
2. **Install dependencies**: `pnpm install`
3. **Create feature branch**: `git checkout -b feature/my-feature`
4. **Make changes** with tests and documentation
5. **Run checks**: `pnpm test && pnpm lint && pnpm type-check`
6. **Create changeset**: `pnpm changeset`
7. **Submit pull request**

### 📝 Standards

- ✅ TypeScript strict mode
- ✅ Comprehensive tests with Vitest
- ✅ ESLint + Prettier formatting
- ✅ Conventional commits
- ✅ Changesets for versioning

## 🗺️ Roadmap

### 🚀 Current (v0.1.x)

- ✅ Core framework with HTTP/2, routing, middleware
- ✅ Type-safe client generation
- ✅ Plugin system and testing utilities
- ✅ Monorepo with pnpm + Turbo

### 🎯 Next (v0.2.x)

- 🔄 Official auth and database plugins
- 🔄 CLI for project scaffolding
- 🔄 Performance optimizations
- 🔄 Enhanced deployment tooling

### 🔮 Future (v0.3.x+)

- 🔄 GraphQL integration
- 🔄 WebSocket support
- 🔄 Edge runtime deployment
- 🔄 Microservices toolkit

## 📞 Links

- 📖 **Documentation**: Each package includes comprehensive README
- 🐛 **Issues**: [GitHub Issues](https://github.com/jleajones/blaize/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/jleajones/blaize/discussions)
- 📧 **Contact**: jason@careymarcel.com

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

**Built with ❤️ by the BlaizeJS team**
