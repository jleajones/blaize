[![npm version](https://badge.fury.io/js/%40blaizejs%2Fclient.svg)](https://www.npmjs.com/package/@blaizejs/client)
[![npm downloads](https://img.shields.io/npm/dm/@blaizejs/client.svg)](https://www.npmjs.com/package/@blaizejs/client)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

# @blaizejs/client

A type-safe, universal HTTP client for BlaizeJS APIs with end-to-end type safety and zero configuration. Works seamlessly in browsers, Node.js, serverless functions, and edge environments.

## 🔥 Features

- **End-to-End Type Safety**: Automatically inferred types from your BlaizeJS server routes
- **Universal Runtime**: Works in browsers, Node.js 18+, serverless, and edge environments
- **Zero Configuration**: Auto-generates client methods from your route definitions
- **Intelligent URL Construction**: Automatic path parameter replacement and query string handling
- **Built-in Error Handling**: Proper error classification for network, HTTP, and application errors
- **Modern Standards**: Uses native fetch API with HTTP/2 support
- **TypeScript First**: Designed for TypeScript with full IntelliSense support

## 📦 Installation

```bash
# npm
npm install @blaizejs/client

# yarn
yarn add @blaizejs/client

# pnpm
pnpm add @blaizejs/client
```

## 🚀 Quick Start

### Server Setup (BlaizeJS)

First, create your BlaizeJS server with typed routes:

```typescript
// server/routes.ts
import { createGetRoute, createPostRoute, BuildRoutesRegistry } from '@blaizejs/core';
import { z } from 'zod';

export const getUserRoute = createGetRoute({
  schema: {
    params: z.object({
      userId: z.string(),
    }),
    query: z.object({
      include: z.string().optional(),
    }),
    response: z.object({
      user: z.object({
        id: z.string(),
        name: z.string(),
        email: z.string(),
      }),
    }),
  },
  handler: async ({ request }, params) => {
    const user = await getUserById(params.userId);
    return { user };
  },
});

export const createUserRoute = createPostRoute({
  schema: {
    body: z.object({
      name: z.string(),
      email: z.string().email(),
    }),
    response: z.object({
      user: z.object({
        id: z.string(),
        name: z.string(),
        email: z.string(),
      }),
    }),
  },
  handler: async ({ request }) => {
    const newUser = await createUser(request.body);
    return { user: newUser };
  },
});

// Export your routes registry
export const routes = {
  getUser: getUserRoute,
  createUser: createUserRoute,
} as const;

// Export the auto-generated type (optional - client can infer this)
export type AppRoutes = BuildRoutesRegistry<typeof routes>;
```

### Client Usage

```typescript
// client/api.ts
import { createClient } from '@blaizejs/client';
import { routes } from '../server/routes';

// Create type-safe client - TypeScript automatically infers all types!
const api = createClient('https://api.example.com', routes);

// Usage with full type safety and autocompletion
async function example() {
  // GET request with path parameters and query
  const { user } = await api.$get.getUser({
    params: { userId: '123' }, // ✅ Typed - userId: string
    query: { include: 'profile' }, // ✅ Typed - include?: string
  });

  console.log(user.name); // ✅ Typed - user.name: string
  console.log(user.age); // ❌ TypeScript error - age doesn't exist

  // POST request with body
  const newUser = await api.$post.createUser({
    body: {
      name: 'John Doe', // ✅ Typed - name: string
      email: 'john@example.com', // ✅ Typed - email: string (validated)
    },
  });

  return newUser.user; // ✅ Typed return value
}
```

## 🏗️ Architecture

### Package Structure

```
packages/blaize-client/
├── src/
│   ├── client.test.ts      # Client creation and proxy tests
│   ├── client.ts           # Main createClient function with Proxy-based API
│   ├── request.test.ts     # HTTP request logic tests
│   ├── request.ts          # HTTP request logic and fetch wrapper
│   ├── url.test.ts         # URL construction tests
│   ├── url.ts              # URL construction and parameter handling
│   └── errors.test.ts      # Error handling tests
│   ├── errors.ts           # Error classes and handling
│   └── index.ts            # Public API exports
├── test/
├── eslint.config.js
├── package.json
├── README.md
├── tsconfig.json
├── tsconfig.test.json
├── tsup.config.mjs
├── viest.config.ts
└── README.md
```

### Key Components

- **Client Factory**: Creates type-safe client instances with automatic method generation
- **Request Engine**: Handles HTTP requests, parameter replacement, and error management
- **URL Builder**: Constructs URLs with path parameters and query strings
- **Type System**: Provides end-to-end type safety from server routes to client calls
- **Error Handling**: Classifies and handles network, HTTP, and application errors

## 📖 API Reference

### `createClient<TRoutes>(config, routes)`

Creates a type-safe client for your BlaizeJS API.

```typescript
function createClient<TRoutes extends Record<string, any>>(
  config: string | ClientConfig,
  routes: TRoutes
): CreateClient<BuildRoutesRegistry<TRoutes>>;
```

#### Parameters

- **`config`**: Base URL string or configuration object
- **`routes`**: Your BlaizeJS routes registry (exported from server)

#### Configuration Options

```typescript
interface ClientConfig {
  baseUrl: string;
  defaultHeaders?: Record<string, string>;
  timeout?: number; // milliseconds, default: 5000
}
```

#### Examples

```typescript
// Simple string configuration
const client = createClient('https://api.example.com', routes);

// Advanced configuration
const client = createClient(
  {
    baseUrl: 'https://api.example.com',
    timeout: 10000,
    defaultHeaders: {
      'User-Agent': 'MyApp/1.0',
      Accept: 'application/json',
    },
  },
  routes
);
```

### Generated Client Methods

The client automatically generates methods based on your route definitions:

```typescript
// For each HTTP method, you get a $method property
client.$get      // GET requests
client.$post     // POST requests
client.$put      // PUT requests
client.$delete   // DELETE requests
client.$patch    // PATCH requests
client.$head     // HEAD requests
client.$options  // OPTIONS requests

// Each method contains your route functions
client.$get.routeName(args?)
client.$post.routeName(args?)
// etc.
```

### Request Arguments

```typescript
interface RequestArgs {
  params?: Record<string, string>; // URL path parameters
  query?: Record<string, any>; // Query string parameters
  body?: unknown; // Request body (POST/PUT/PATCH)
}

// Usage
await client.$get.getUser({
  params: { userId: '123' }, // Replaces :userId in path
  query: { include: 'profile' }, // Adds ?include=profile
});

await client.$post.createUser({
  body: { name: 'John', email: 'john@example.com' },
});
```

## 🌟 Advanced Features

### Authentication & Headers

Handle authentication by configuring headers at client creation or per-request:

```typescript
// Option 1: Configure default headers at creation
const authenticatedClient = createClient(
  {
    baseUrl: 'https://api.example.com',
    defaultHeaders: {
      Authorization: 'Bearer ' + getAuthToken(),
    },
  },
  routes
);

// Option 2: Per-request headers (Coming Soon)
await client.$get.getUser(
  { params: { userId: '123' } },
  { headers: { Authorization: 'Bearer ' + freshToken } }
);
```

### Error Handling

The client provides structured error handling for different failure scenarios:

```typescript
import { ClientError, NetworkError } from '@blaizejs/client';

try {
  const user = await client.$get.getUser({ params: { userId: '123' } });
} catch (error) {
  if (error instanceof ClientError) {
    // HTTP errors (4xx, 5xx)
    console.log(`HTTP ${error.status}: ${error.message}`);
    console.log('Response:', error.response);
  } else if (error instanceof NetworkError) {
    // Network failures (timeout, connection refused, etc.)
    console.log('Network error:', error.message);
    console.log('Cause:', error.cause);
  } else {
    // Other errors
    console.log('Unexpected error:', error);
  }
}
```

### Universal Environment Support

The client works seamlessly across different JavaScript environments:

#### Browser/Frontend

```typescript
// React, Vue, Svelte, etc.
import { createClient } from '@blaizejs/client';
import { routes } from '../shared/routes';

const api = createClient('https://api.example.com', routes);

function UserProfile({ userId }: { userId: string }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    api.$get.getUser({ params: { userId } })
      .then(({ user }) => setUser(user));
  }, [userId]);

  return <div>{user?.name}</div>;
}
```

#### Node.js Server (Server-to-Server)

```typescript
// BlaizeJS server calling another BlaizeJS server
import { createClient } from '@blaizejs/client';
import { externalServiceRoutes } from './external-routes';

const externalAPI = createClient('https://external-service.com', externalServiceRoutes);

export const enrichUserRoute = createGetRoute({
  // ... route definition
  handler: async ({ request }, params) => {
    // Call external service from your server
    const userData = await externalAPI.$get.getUser({
      params: { userId: params.userId },
    });

    // Enrich and return
    return {
      user: {
        ...userData.user,
        enrichedBy: 'our-service',
      },
    };
  },
});
```

#### Serverless Functions

```typescript
// Vercel, Netlify, AWS Lambda
import { createClient } from '@blaizejs/client';

export default async function handler(req, res) {
  const api = createClient('https://api.example.com', routes);
  const data = await api.$get.getData({ params: { id: req.query.id } });
  res.json(data);
}
```

#### Edge Functions

```typescript
// Cloudflare Workers, Vercel Edge
export default {
  async fetch(request, env, ctx) {
    const api = createClient('https://api.example.com', routes);
    const data = await api.$get.getData({ params: { id: '123' } });
    return new Response(JSON.stringify(data));
  },
};
```

### Microservices Architecture

Perfect for microservices built with BlaizeJS:

```typescript
// Service A calling Service B
const userService = createClient('https://user-service.com', userRoutes);
const orderService = createClient('https://order-service.com', orderRoutes);
const paymentService = createClient('https://payment-service.com', paymentRoutes);

// Compose data from multiple services with full type safety
async function getOrderSummary(orderId: string) {
  const order = await orderService.$get.getOrder({ params: { orderId } });
  const user = await userService.$get.getUser({ params: { userId: order.userId } });
  const payment = await paymentService.$get.getPayment({ params: { orderId } });

  return {
    order: order.order,
    customer: user.user,
    payment: payment.payment,
  };
}
```

## 🔧 Development

### Prerequisites

- Node.js v18.0.0 or higher
- TypeScript 4.7+
- A BlaizeJS server to connect to

### Local Development

```bash
# Clone the repository
git clone https://github.com/blaizejs/blaizejs.git
cd blaizejs

# Install dependencies
pnpm install

# Build the client package
pnpm build --filter @blaizejs/client

# Run tests
pnpm test --filter @blaizejs/client

# Run tests in watch mode
pnpm test:watch --filter @blaizejs/client
```

### Testing

The client package includes comprehensive tests:

```bash
# Run all tests
pnpm test

# Run specific test suites
pnpm test url        # URL construction tests
pnpm test client     # Client creation tests
pnpm test request    # HTTP request tests
pnpm test errors     # Error handling tests

# Coverage report
pnpm test:coverage
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](../../CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes with tests
4. Run the test suite: `pnpm test`
5. Submit a pull request

### Reporting Issues

Found a bug or have a feature request? Please check our [GitHub Issues](https://github.com/blaizejs/blaizejs/issues) and create a new issue if needed.

## 📝 Examples

### Basic CRUD Operations

```typescript
// Create
const newUser = await api.$post.createUser({
  body: { name: 'Alice', email: 'alice@example.com' },
});

// Read
const user = await api.$get.getUser({
  params: { userId: newUser.user.id },
});

// Update
const updatedUser = await api.$put.updateUser({
  params: { userId: user.user.id },
  body: { name: 'Alice Smith' },
});

// Delete
await api.$delete.deleteUser({
  params: { userId: user.user.id },
});
```

### Complex Queries

```typescript
// Search with filters and pagination
const results = await api.$get.searchUsers({
  query: {
    q: 'john',
    status: 'active',
    limit: 20,
    offset: 0,
    sortBy: 'created_at',
    order: 'desc',
  },
});

// Nested resource access
const userPosts = await api.$get.getUserPosts({
  params: { userId: '123' },
  query: {
    published: true,
    limit: 10,
  },
});
```

### Error Handling Patterns

```typescript
// Retry pattern
async function getUserWithRetry(userId: string, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await api.$get.getUser({ params: { userId } });
    } catch (error) {
      if (error instanceof NetworkError && attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        continue;
      }
      throw error;
    }
  }
}

// Graceful degradation
async function getUserProfile(userId: string) {
  try {
    const user = await api.$get.getUser({ params: { userId } });
    return user;
  } catch (error) {
    if (error instanceof ClientError && error.status === 404) {
      return { user: { id: userId, name: 'Unknown User', email: '' } };
    }
    throw error;
  }
}
```

## 🔗 Related Packages

- **[@blaizejs/core](../core)** - The core BlaizeJS framework for building APIs
- **[@blaizejs/cli](../cli)** - Command-line tools for BlaizeJS development
- **[@blaizejs/testing](../testing)** - Testing utilities for BlaizeJS applications

## 📄 License

MIT © [BlaizeJS](../../LICENSE)

## 🌟 Why BlaizeJS Client?

### vs. axios

- ✅ **Type Safety**: Full TypeScript integration vs. manual typing
- ✅ **Auto-generated API**: No manual endpoint configuration
- ✅ **Modern**: Built on fetch vs. XMLHttpRequest
- ✅ **Universal**: Works everywhere vs. Node.js focused

### vs. fetch

- ✅ **Type Safety**: End-to-end typing vs. untyped
- ✅ **Developer Experience**: Auto-completion and error handling
- ✅ **Convenience**: Automatic URL construction and parameter handling
- ✅ **Error Handling**: Structured error classification

### vs. tRPC Client

- ✅ **HTTP Standard**: Uses standard REST vs. custom protocol
- ✅ **Framework Agnostic**: Works with any frontend vs. React focused
- ✅ **Simpler**: No complex setup or code generation
- ✅ **Cacheable**: Standard HTTP caching vs. custom implementation

---

<div align="center">
  <sub>Built with ❤️ for the modern web. Made by the BlaizeJS team.</sub>
</div>
