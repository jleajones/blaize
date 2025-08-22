# 🔥 BlaizeJS

> **Modern, type-safe Node.js framework** for building blazing-fast APIs with end-to-end type safety, HTTP/2 support, and zero-configuration development

[![npm version](https://badge.fury.io/js/blaizejs.svg)](https://badge.fury.io/js/blaizejs)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-23.0+-green.svg)](https://nodejs.org/)
[![Build Status](https://github.com/jleajones/blaize/workflows/Test/badge.svg)](https://github.com/jleajones/blaize/actions)

## 🌟 Why BlaizeJS?

BlaizeJS is a next-generation Node.js framework that brings together the best of modern web development:

- **🚀 Blazing Performance** - HTTP/2 by default with automatic HTTPS in development
- **🔒 End-to-End Type Safety** - Full TypeScript support from server to client with automatic type inference
- **⚡ Zero Configuration** - Works out of the box with sensible defaults and auto-discovery
- **🎯 Developer Experience** - Hot reloading, intelligent error messages, and powerful debugging
- **🏗️ Production Ready** - Built-in error handling, validation, middleware, and plugin system

## 📋 Table of Contents

- [🚀 Quick Start](#-quick-start)
- [⚙️ Core Technologies](#️-core-technologies)
- [📦 Project Structure](#-project-structure)
- [🎯 Getting Started](#-getting-started)
- [🔗 Advanced Usage with Client](#-advanced-usage-with-client)
- [🧪 Testing](#-testing)
- [🤝 Contributing](#-contributing)
- [📦 Release Management](#-release-management)
- [📚 Documentation](#-documentation)
- [📄 License](#-license)

## 🚀 Quick Start

Get up and running with BlaizeJS in under a minute:

```bash
# Create a new project
npx create-blaize-app my-api
cd my-api

# Install dependencies
pnpm install

# Start development server
pnpm dev

# Your API is now running at https://localhost:3000 🎉
```

## ⚙️ Core Technologies

BlaizeJS leverages modern, battle-tested technologies:

### 🏗️ Framework Foundation
- **Node.js 23+** - Latest JavaScript runtime features
- **TypeScript 5.3+** - Advanced type system with full inference
- **HTTP/2** - Modern protocol with multiplexing and server push
- **Zod** - Runtime type validation with TypeScript integration

### 🛠️ Development Tools
- **pnpm** - Fast, disk space efficient package manager
- **Turbo** - High-performance build system for monorepos
- **Vitest** - Blazing fast unit testing framework
- **ESLint & Prettier** - Code quality and formatting
- **Changesets** - Automated versioning and changelogs

### 🎨 Architecture Patterns
- **File-based Routing** - Automatic route discovery from file structure
- **Middleware Pipeline** - Composable request/response processing
- **Plugin System** - Extend functionality with lifecycle hooks
- **AsyncLocalStorage** - Isolated context management per request

## 📦 Project Structure

BlaizeJS is organized as a monorepo with clear separation of concerns:

```
blaize/
├── 📦 packages/                    # Core framework packages
│   ├── blaize-core/               # Main framework (published as 'blaizejs')
│   │   ├── src/
│   │   │   ├── server/           # HTTP/2 server implementation
│   │   │   ├── router/           # File-based routing engine
│   │   │   ├── middleware/       # Middleware system
│   │   │   ├── plugins/          # Plugin architecture
│   │   │   ├── context/          # Request context management
│   │   │   └── errors/           # Semantic error classes
│   │   └── package.json
│   │
│   ├── blaize-client/             # Type-safe API client
│   │   ├── src/
│   │   │   ├── client.ts         # Proxy-based client creation
│   │   │   ├── request.ts        # HTTP request handling
│   │   │   └── errors/           # Client-side error handling
│   │   └── package.json
│   │
│   ├── blaize-types/              # Shared TypeScript definitions
│   └── blaize-testing-utils/      # Testing utilities
│
├── 🧩 plugins/                    # Official plugins (coming soon)
│   ├── blaize-auth-plugin/        # Authentication & authorization
│   └── blaize-database-plugin/    # Database integrations
│
├── 🎯 apps/                       # Applications & examples
│   ├── docs/                      # Documentation website
│   ├── examples/                  # Example applications
│   └── playground/                # Development playground
│
├── ⚙️ configs/                    # Shared configurations
│   ├── eslint-config/             # ESLint presets
│   ├── typescript-config/         # TypeScript configs
│   └── vitest-config/             # Test configuration
│
└── 📄 Root files
    ├── package.json               # Workspace configuration
    ├── pnpm-workspace.yaml       # pnpm workspace settings
    ├── turbo.json                # Turbo build configuration
    └── .changeset/               # Version management
```

## 🎯 Getting Started

### 📋 Prerequisites

- **Node.js**: >= 23.0.0
- **pnpm**: >= 9.7.0

### 🏁 Installation

```bash
# Using pnpm (recommended)
pnpm add blaizejs
pnpm add -D chokidar selfsigned # Development dependencies

# Using npm
npm install blaizejs
npm install -D chokidar selfsigned # Development dependencies

# Using yarn
yarn add blaizejs
yarn add -D chokidar selfsigned # Development dependencies
```

### 🔨 Create Your First Server

```typescript
// server.ts
import { createServer } from 'blaizejs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// ESM path resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create server with file-based routing
const server = createServer({
  port: 3000,
  routesDir: path.resolve(__dirname, './routes'),
  http2: { enabled: true }  // Auto-generates dev certificates
});

await server.listen();
console.log('🚀 Server running at https://localhost:3000');
```

### 📁 Define Routes

Create route files in your `routes` directory:

```typescript
// routes/users/[userId].ts
import { createGetRoute, createPutRoute, NotFoundError } from 'blaizejs';
import { z } from 'zod';

// GET /users/:userId
export const GET = createGetRoute({
  schema: {
    params: z.object({
      userId: z.string().uuid()
    }),
    response: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
      createdAt: z.string()
    })
  },
  handler: async (ctx, params) => {
    const user = await db.users.findById(params.userId);
    
    if (!user) {
      throw new NotFoundError('User not found', {
        resourceType: 'user',
        resourceId: params.userId
      });
    }
    
    return user;
  }
});

// PUT /users/:userId
export const PUT = createPutRoute({
  schema: {
    params: z.object({
      userId: z.string().uuid()
    }),
    body: z.object({
      name: z.string().min(1).optional(),
      email: z.string().email().optional()
    })
  },
  handler: async (ctx, params) => {
    const updatedUser = await db.users.update(params.userId, ctx.body);
    return updatedUser;
  }
});
```

### 🔧 Add Middleware

```typescript
import { createMiddleware, compose } from 'blaizejs';

// Logging middleware
const logger = createMiddleware(async (ctx, next) => {
  const start = Date.now();
  console.log(`→ ${ctx.request.method} ${ctx.request.path}`);
  
  await next();
  
  const duration = Date.now() - start;
  console.log(`← ${ctx.response.statusCode} (${duration}ms)`);
});

// Authentication middleware
const auth = createMiddleware({
  name: 'auth',
  handler: async (ctx, next) => {
    const token = ctx.request.header('authorization');
    
    if (!token) {
      throw new UnauthorizedError('No token provided');
    }
    
    ctx.state.user = await verifyToken(token);
    await next();
  }
});

// Apply to server
const server = createServer({
  middleware: [logger, auth],
  routesDir: './routes'
});
```

## 🔗 Advanced Usage with Client

BlaizeJS provides automatic client generation with full type safety:

### 🎯 Server Setup

First, export your route registry from the server:

```typescript
// server/routes/index.ts
import { createGetRoute, createPostRoute } from 'blaizejs';
import { z } from 'zod';

export const getUsers = createGetRoute({
  schema: {
    query: z.object({
      page: z.number().default(1),
      limit: z.number().default(10)
    }),
    response: z.object({
      users: z.array(z.object({
        id: z.string(),
        name: z.string(),
        email: z.string()
      })),
      total: z.number()
    })
  },
  handler: async (ctx) => {
    const { page, limit } = ctx.request.query;
    return await db.users.paginate(page, limit);
  }
});

export const createUser = createPostRoute({
  schema: {
    body: z.object({
      name: z.string().min(1),
      email: z.string().email(),
      password: z.string().min(8)
    }),
    response: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string()
    })
  },
  handler: async (ctx) => {
    return await db.users.create(ctx.body);
  }
});

// Export route registry for client
export const routes = {
  getUsers,
  createUser
} as const;
```

### 🔌 Client Usage

Install the client package:

```bash
pnpm add @blaizejs/client
```

Create a type-safe client:

```typescript
// client/api.ts
import bc from '@blaizejs/client';
import { routes } from '../server/routes';

// Create client with automatic type inference
const api = bc.create('https://api.example.com', routes);

// Use with full type safety and autocompletion
async function example() {
  // GET request with query parameters
  const { users, total } = await api.$get.getUsers({
    query: { 
      page: 2,      // ✅ Typed as number
      limit: 20     // ✅ Typed as number
    }
  });
  
  console.log(users[0].name);  // ✅ Fully typed
  console.log(users[0].age);   // ❌ TypeScript error - property doesn't exist
  
  // POST request with body
  const newUser = await api.$post.createUser({
    body: {
      name: 'Jane Doe',         // ✅ Required string
      email: 'jane@example.com', // ✅ Valid email required
      password: 'secure123'      // ✅ Min 8 characters
    }
  });
  
  return newUser; // ✅ Return type is inferred
}
```

### 🛡️ Error Handling

```typescript
import { BlaizeError } from 'blaizejs';

try {
  const user = await api.$get.getUser({ 
    params: { userId: '123' } 
  });
} catch (error) {
  if (error instanceof BlaizeError) {
    switch (error.status) {
      case 404:
        console.log('User not found');
        break;
      case 401:
        console.log('Authentication required');
        break;
      case 500:
        console.log('Server error:', error.correlationId);
        break;
    }
  }
}
```

## 🧪 Testing

BlaizeJS provides comprehensive testing utilities:

```typescript
import { describe, test, expect } from 'vitest';
import { createTestContext } from '@blaizejs/testing-utils';
import { GET } from './routes/users/[userId]';

describe('User Routes', () => {
  test('should return user by ID', async () => {
    const ctx = createTestContext({
      method: 'GET',
      path: '/users/123',
      params: { userId: '123' }
    });
    
    const result = await GET.handler(ctx, { userId: '123' });
    
    expect(result).toEqual({
      id: '123',
      name: 'Test User',
      email: 'test@example.com'
    });
  });
  
  test('should handle not found', async () => {
    const ctx = createTestContext({
      method: 'GET',
      path: '/users/999'
    });
    
    await expect(
      GET.handler(ctx, { userId: '999' })
    ).rejects.toThrow(NotFoundError);
  });
});
```

### 🔧 Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Generate coverage report
pnpm test:coverage

# Test specific package
pnpm --filter blaizejs test
```

## 🤝 Contributing

We welcome contributions! BlaizeJS is built by the community, for the community.

### 🚀 Quick Contribution Guide

1. **Fork & Clone**
   ```bash
   git clone https://github.com/[your-username]/blaize.git
   cd blaize
   pnpm install
   ```

2. **Create Feature Branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```

3. **Make Changes**
   - Write code with tests
   - Update documentation
   - Follow TypeScript strict mode

4. **Run Quality Checks**
   ```bash
   pnpm test
   pnpm lint
   pnpm type-check
   ```

5. **Create Changeset**
   ```bash
   pnpm changeset
   ```

6. **Submit Pull Request**

### 📚 Full Guidelines

For detailed contribution guidelines, code standards, and development workflow:

**→ [CONTRIBUTING.md](CONTRIBUTING.md)**

## 📦 Release Management

BlaizeJS uses an automated release workflow with Changesets and GitHub Actions.

### 🔄 Release Process

1. Merge PRs with changesets to `main`
2. Bot creates/updates "Version Packages" PR
3. Review and merge when ready to release
4. Packages automatically published to npm

### 📖 Detailed Documentation

For complete release workflow, versioning strategy, and troubleshooting:

**→ [RELEASE-MANAGEMENT.md](RELEASE-MANAGEMENT.md)**

## 📚 Documentation

- 📖 **[API Reference](packages/blaize-core/README.md)** - Complete framework API
- 🔗 **[Client Documentation](packages/blaize-client/README.md)** - Type-safe client usage
- 🧪 **[Testing Guide](packages/blaize-testing-utils/README.md)** - Testing utilities
- 💡 **[Examples](apps/examples)** - Sample applications
- 🎓 **[Tutorials](docs/tutorials)** - Step-by-step guides

## 🗺️ Roadmap

### ✅ Current (v0.3.x)
- Core framework with HTTP/2
- Type-safe client generation
- Testing utilities
- Error handling system
- Middleware & plugins

### 🎯 MVP/1.0 Release
- WebSocket support
- Built-in auth plugin
- Database integrations
- CLI scaffolding tool
- Performance monitoring

### 🔮 Future (v1.1+)
- GraphQL integration
- gRPC support
- Edge runtime compatibility
- OpenAPI generation
- Distributed tracing

## 📞 Support

- 🐛 **[Issues](https://github.com/jleajones/blaize/issues)** - Bug reports and feature requests
- 💬 **[Discussions](https://github.com/jleajones/blaize/discussions)** - Questions and ideas

## 📄 License

MIT © [BlaizeJS Team](https://github.com/jleajones)

---

<div align="center">
  <strong>Built with ❤️ by the BlaizeJS team</strong>
  <br />
  <sub>Fast, safe, and delightful API development for the modern web</sub>
</div>