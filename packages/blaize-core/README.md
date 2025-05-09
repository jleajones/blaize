# BlaizeJS

🔥 A blazing-fast, TypeScript-first API framework with file-based routing, powerful plugins, and end-to-end type safety.

## Overview

BlaizeJS is a modern Node.js framework designed for building high-performance, type-safe APIs. It features file-based routing, a powerful middleware system, an extensible plugin architecture, and end-to-end type safety with zero configuration. Both the middleware and plugin systems are designed to be powerful yet intuitive, allowing developers to extend functionality with minimal effort.

## Features

- **HTTP/2 Support** - Built on modern Node.js with HTTP/2 and HTTP/1.1 fallback
- **File-based Routing** - Just create files in your routes directory and they automatically become API endpoints
- **Type Safety** - Full TypeScript support with automatic route type inference
- **Middleware System** - Intuitive middleware chain for request/response processing
- **Plugin Architecture** - Extend functionality with a powerful plugin system
- **Context API** - Clean, unified interface for request handling using AsyncLocalStorage
- **Developer Experience** - Fast refresh during development with minimal configuration

## Project Structure

```
blaizejs/
├── src/                      # Source code
│   ├── context/              # Request/response context
│   ├── middleware/           # Middleware system
│   ├── plugins/              # Plugin system
│   ├── router/               # File-based routing
│   ├── server/               # HTTP/2 server implementation
│   ├── types/                # TypeScript type definitions
│   ├── utils/                # Utility functions
│   └── index.ts              # Main entry point
├── examples/                 # Example applications
│   ├── basic/                # Basic server example
│   ├── middleware/           # Middleware examples
│   ├── plugins/              # Plugin examples
│   └── routing/              # Routing examples
├── tests/                    # Test suite
│   ├── context/              # Context tests
│   ├── middleware/           # Middleware tests
│   ├── plugins/              # Plugin tests
│   ├── router/               # Router tests
│   ├── server/               # Server tests
│   └── integration/          # Integration tests
├── package.json              # Project configuration
└── tsconfig.json             # TypeScript configuration
```

## Getting Started

### Installation

```bash
pnpm install blaizejs
```

### Quick Start

Create a new file `server.ts`:

```typescript
import { createServer } from 'blaizejs';

const server = createServer({
  port: 3000,
  routesDir: './routes',
});

server.listen().then(() => {
  console.log(`Server running at http://localhost:${server.port}`);
});
```

Create a route file `routes/hello.ts`:

```typescript
import { Middleware } from 'blaizejs';

// Export default middleware function
export default function helloRoute(): Middleware {
  return async (ctx, next) => {
    ctx.json({ message: 'Hello, World!' });
    await next();
  };
}
```

Start the server:

```bash
ts-node server.ts
```

Visit http://localhost:3000/hello to see your API in action.

## Middleware

BlaizeJS uses a simple middleware system similar to Express or Koa, but with full TypeScript support:

```typescript
import { createServer, Middleware } from 'blaizejs';

// Create logging middleware
const logger: Middleware = async (ctx, next) => {
  const start = Date.now();
  console.log(`${ctx.method} ${ctx.path}`);

  await next();

  const ms = Date.now() - start;
  console.log(`${ctx.method} ${ctx.path} - ${ctx.status} (${ms}ms)`);
};

// Create error handling middleware
const errorHandler: Middleware = async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    console.error('Request error:', err);
    ctx.status = 500;
    ctx.json({
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'production' ? undefined : String(err),
    });
  }
};

// Create server with middleware
const server = createServer({
  middleware: [errorHandler, logger],
});

// Add more middleware after server creation
server.use(async (ctx, next) => {
  ctx.state.userIp = ctx.req.socket.remoteAddress;
  await next();
});

server.listen(3000);
```

## Context API

The Context object provides a unified interface for handling requests and responses:

```typescript
// Example middleware using context
const middleware: Middleware = async (ctx, next) => {
  // Access request data
  console.log('Method:', ctx.method);
  console.log('Path:', ctx.path);
  console.log('Query parameters:', ctx.query);

  // Add data to state (available to other middleware)
  ctx.state.userId = 'user_123';

  // Continue to next middleware
  await next();

  // Send response
  ctx.status = 200;
  ctx.json({
    user: ctx.state.userId,
    data: 'Response data',
  });
};
```

## HTTP/2 Support

BlaizeJS supports HTTP/2 with fallback to HTTP/1.1:

```typescript
import { createServer } from 'blaizejs';
import fs from 'node:fs';
import path from 'node:path';

// Create HTTP/2 server with TLS
const server = createServer({
  port: 3000,
  http2: {
    enabled: true,
    keyFile: path.join(__dirname, 'certs/key.pem'),
    certFile: path.join(__dirname, 'certs/cert.pem'),
  },
});

server.listen();
```

## Plugin System

Extend functionality with plugins:

```typescript
import { createServer } from 'blaizejs';
import corsPlugin from '@blaizejs/cors-plugin';
import loggerPlugin from '@blaizejs/logger-plugin';

const server = createServer({
  plugins: [corsPlugin({ origin: '*' }), loggerPlugin({ level: 'info' })],
});

// Register plugins after server creation
server.register(myCustomPlugin()).then(() => {
  server.listen(3000);
});
```

## CLI Commands (Coming Soon)

BlaizeJS will include a CLI for project creation and development:

```bash
# Install the CLI globally
pnpm install -g @blaizejs/cli

# Create a new project
blaize create my-api

# Start development server
blaize dev

# Build for production
blaize build

# Run in production
blaize start
```

## Development

### Building the Project

```bash
# Install dependencies
pnpm install

# Build the project
pnpm run build

# Run tests
pnpm test

# Start development server with example
pnpm run dev
```

### Running Examples

```bash
# Run basic example
pnpm run example:basic

# Run middleware example
pnpm run example:middleware

# Run routing example
pnpm run example:routing

# Run plugin example
pnpm run example:plugins
```

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details on how to contribute to BlaizeJS.

## Roadmap

### Phase 1: Core Implementation

- ✅ Basic HTTP server
- ✅ Context API
- ✅ Middleware system
- ⬜ HTTP/2 support
- ⬜ File-based router
- ⬜ Type-safe parameters

### Phase 2: Advanced Features

- ⬜ Plugin system
- ⬜ Type inference system
- ⬜ Client library generation
- ⬜ OpenAPI integration
- ⬜ Performance optimizations
- ⬜ Documentation

### Phase 3: Ecosystem

- ⬜ CLI tool
- ⬜ Core plugins (CORS, logging, validation)
- ⬜ Premium plugins (authentication, caching)
- ⬜ Example applications
- ⬜ Deployment guides

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

Inspired by modern frameworks and tools including Express, Fastify, Next.js, and tRPC, BlaizeJS aims to combine the best aspects of these approaches while embracing modern JavaScript and TypeScript features.

---

<div align="center">
  <sub>Built with ❤️ for the modern web.</sub>
</div>
