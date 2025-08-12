# 🌐 BlaizeJS Server Module

> **High-performance HTTP/2 server** with automatic HTTPS, graceful lifecycle management, middleware integration, and plugin support for building modern web applications
>
> Built on Node.js native HTTP/2 with HTTP/1.1 fallback, self-signed certificates for development, and production-ready configuration

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
- [⚙️ Configuration](#️-configuration)
- [🔧 Server Lifecycle](#-server-lifecycle)
- [🌐 Production Deployment](#-production-deployment)
- [🛡️ Error Handling](#️-error-handling)
- [🧪 Testing](#-testing)
- [📚 Type Reference](#-type-reference)
- [🗺️ Roadmap](#️-roadmap)
- [🤝 Contributing](#-contributing)

## 🌟 Features

- 🚀 **HTTP/2 by Default** - Modern protocol with multiplexing and server push
- 🔒 **Automatic HTTPS** - Self-signed certificates for development
- 📁 **File-Based Routing** - Automatic route discovery via integrated router
- 🔌 **Plugin System** - Extend functionality with lifecycle hooks
- 🎯 **Middleware Support** - Composable request/response processing
- ♻️ **Graceful Lifecycle** - Clean startup and shutdown management
- 🔄 **Hot Reloading** - Route changes without restarts (development)
- 📊 **Event System** - Server lifecycle events
- 🧩 **Context Storage** - AsyncLocalStorage for request state
- ⚡ **Zero Configuration** - Works out of the box with sensible defaults

## 📦 Installation

The server module is included with the main BlaizeJS package:

```bash
# Using pnpm (recommended)
pnpm add blaizejs

# Using npm
npm install blaizejs

# Using yarn
yarn add blaizejs
```

## 🚀 Quick Start

### Basic Server Setup

```typescript
import { createServer } from 'blaizejs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// ESM path resolution (required for route discovery)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create and start server
const server = createServer({
  port: 3000,
  host: 'localhost',
  routesDir: path.resolve(__dirname, './routes')
});

await server.listen();
console.log(`🚀 Server running at https://${server.host}:${server.port}`);
```

### Server with Middleware and Plugins

```typescript
import { createServer, createMiddleware, createPlugin } from 'blaizejs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create middleware
const loggingMiddleware = createMiddleware({
  name: 'logger',
  handler: async (ctx, next) => {
    console.log(`→ ${ctx.request.method} ${ctx.request.path}`);
    await next();
    console.log(`← ${ctx.response.statusCode}`);
  }
});

// Create plugin
const metricsPlugin = createPlugin(
  'metrics',
  '1.0.0',
  (server) => {
    console.log('Metrics plugin initialized');
    return {
      initialize: async () => {
        console.log('Starting metrics collection...');
      },
      terminate: async () => {
        console.log('Stopping metrics collection...');
      }
    };
  }
);

// Create server with configuration
const server = createServer({
  port: 8080,
  host: '0.0.0.0',
  routesDir: path.resolve(__dirname, './api'),
  middleware: [loggingMiddleware],
  plugins: [metricsPlugin()]
});

await server.listen();
```

## 📖 Core Concepts

### 🏗️ Server Architecture

The BlaizeJS server is built on a layered architecture:

```
┌─────────────────────────────────────┐
│         HTTP/2 or HTTP/1.1          │
├─────────────────────────────────────┤
│          Plugin System              │
├─────────────────────────────────────┤
│       Middleware Pipeline           │
├─────────────────────────────────────┤
│         Router (Internal)           │
├─────────────────────────────────────┤
│        Context Storage              │
└─────────────────────────────────────┘
```

### 🔄 Request Flow

1. **Request arrives** at HTTP/2 or HTTP/1.1 server
2. **Context created** with AsyncLocalStorage
3. **Global middleware** processes request
4. **Router matches** route from file system
5. **Route middleware** processes request
6. **Route handler** executes
7. **Response sent** back to client

### 📁 Route Discovery

The server automatically discovers routes through the integrated router:

```typescript
// routes/users.ts
export const GET = createGetRoute({
  handler: async (ctx) => {
    return { users: [] };
  }
});

// Automatically available at GET /users
```

## 🎯 Core APIs

### `createServer`

Creates a new BlaizeJS server instance.

#### Signature

```typescript
function createServer(options?: ServerOptionsInput): Server
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `options` | `ServerOptionsInput` | Server configuration options |

#### Options

```typescript
interface ServerOptionsInput {
  /** Port to listen on (default: 3000) */
  port?: number;
  
  /** Host to bind to (default: 'localhost') */
  host?: string;
  
  /** Directory containing route files (required for routing) */
  routesDir?: string;
  
  /** HTTP/2 configuration */
  http2?: {
    /** Enable HTTP/2 (default: true) */
    enabled?: boolean;
    
    /** Path to SSL key file */
    keyFile?: string;
    
    /** Path to SSL certificate file */
    certFile?: string;
  };
  
  /** Global middleware to apply */
  middleware?: Middleware[];
  
  /** Plugins to register */
  plugins?: Plugin[];
}
```

#### Returns

Returns a `Server` instance with methods for lifecycle management.

### Server Instance Methods

#### `server.listen(port?, host?)`

Starts the server and begins accepting connections.

```typescript
// Use configured port/host
await server.listen();

// Override port/host
await server.listen(8080, '0.0.0.0');
```

#### `server.close(options?)`

Gracefully shuts down the server.

```typescript
await server.close({
  timeout: 30000,  // Max wait time for connections
  onStopping: async () => {
    console.log('Server stopping...');
  },
  onStopped: async () => {
    console.log('Server stopped');
  }
});
```

#### `server.use(middleware)`

Adds global middleware to the server.

```typescript
// Single middleware
server.use(corsMiddleware);

// Multiple middleware
server.use([authMiddleware, compressionMiddleware]);
```

#### `server.register(plugin)`

Registers a plugin with the server.

```typescript
await server.register(databasePlugin());
await server.register(cachePlugin({ ttl: 300 }));
```

### Server Properties

```typescript
interface Server {
  /** Underlying Node.js server instance */
  server: http.Server | http2.Http2Server | undefined;
  
  /** Server port */
  port: number;
  
  /** Server host */
  host: string;
  
  /** Event emitter for lifecycle events */
  events: EventEmitter;
  
  /** Registered plugins */
  plugins: Plugin[];
  
  /** Registered middleware */
  middleware: Middleware[];
  
  /** Router instance (internal) */
  router: Router;
  
  /** Context storage system */
  context: AsyncLocalStorage<Context>;
  
  /** Plugin lifecycle manager (internal) */
  pluginManager: PluginLifecycleManager;
}
```

## 💡 Common Patterns

### 🔒 HTTPS in Development

BlaizeJS automatically generates self-signed certificates for development:

```typescript
const server = createServer({
  routesDir: path.resolve(__dirname, './routes'),
  http2: {
    enabled: true  // Auto-generates dev certificates
  }
});

// Access via https://localhost:3000
// Note: Browser will warn about self-signed certificate
```

### 🌍 Environment-Based Configuration

```typescript
import { createServer } from 'blaizejs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

const server = createServer({
  port: parseInt(process.env.PORT || '3000'),
  host: process.env.HOST || 'localhost',
  routesDir: path.resolve(__dirname, isProduction ? './dist/routes' : './routes'),
  http2: {
    enabled: isDevelopment || !!process.env.SSL_CERT_PATH,
    keyFile: process.env.SSL_KEY_PATH,
    certFile: process.env.SSL_CERT_PATH
  }
});
```

### 🔌 Dynamic Plugin Registration

```typescript
const server = createServer({
  routesDir: path.resolve(__dirname, './routes')
});

// Register plugins conditionally
if (process.env.ENABLE_METRICS) {
  await server.register(metricsPlugin());
}

if (process.env.DATABASE_URL) {
  await server.register(databasePlugin({
    url: process.env.DATABASE_URL
  }));
}

await server.listen();
```

### 🎯 Middleware Composition

```typescript
const server = createServer({
  routesDir: path.resolve(__dirname, './routes'),
  middleware: [
    // Order matters: runs top to bottom
    corsMiddleware,
    compressionMiddleware,
    authMiddleware,
    rateLimitMiddleware
  ]
});

// Add conditional middleware at runtime
if (process.env.ENABLE_LOGGING) {
  server.use(loggingMiddleware);
}
```

## ⚙️ Configuration

### 🚀 Default Configuration

```typescript
const DEFAULT_OPTIONS = {
  port: 3000,
  host: 'localhost',
  routesDir: './routes',
  http2: {
    enabled: true
  },
  middleware: [],
  plugins: []
};
```

### 🔐 HTTP/2 with Custom Certificates

```typescript
const server = createServer({
  routesDir: path.resolve(__dirname, './routes'),
  http2: {
    enabled: true,
    keyFile: '/path/to/private-key.pem',
    certFile: '/path/to/certificate.pem'
  }
});
```

### 🔄 HTTP/1.1 Fallback

```typescript
// Disable HTTP/2 for compatibility
const server = createServer({
  routesDir: path.resolve(__dirname, './routes'),
  http2: {
    enabled: false  // Use HTTP/1.1 only
  }
});
```

## 🔧 Server Lifecycle

### 📊 Lifecycle Events

```typescript
const server = createServer({
  routesDir: path.resolve(__dirname, './routes')
});

// Subscribe to lifecycle events
server.events.on('started', () => {
  console.log('Server started successfully');
});

server.events.on('stopping', () => {
  console.log('Server is stopping...');
});

await server.listen();
```

### 🛑 Graceful Shutdown

The server automatically handles graceful shutdown on process signals:

```typescript
// Automatic signal handling (SIGTERM, SIGINT)
const server = createServer({
  routesDir: path.resolve(__dirname, './routes')
});

await server.listen();

// Manual shutdown with cleanup
process.on('SIGUSR2', async () => {
  console.log('Custom shutdown signal received');
  
  await server.close({
    timeout: 30000,
    onStopping: async () => {
      // Cleanup resources
      await saveMetrics();
      await flushLogs();
    }
  });
  
  process.exit(0);
});
```

### 🔄 Startup Sequence

1. **Validation** - Options are validated
2. **Router Creation** - File-based router initialized
3. **Plugin Registration** - Plugins registered from options
4. **Middleware Setup** - Global middleware configured
5. **Plugin Initialization** - Plugin `initialize` hooks called
6. **Server Start** - HTTP/2 or HTTP/1.1 server created
7. **Port Binding** - Server begins listening
8. **Plugin Start** - Plugin `onServerStart` hooks called
9. **Signal Handlers** - Graceful shutdown handlers registered

### 🔚 Shutdown Sequence

1. **Signal Received** - SIGTERM/SIGINT or manual close
2. **Plugin Stop** - Plugin `onServerStop` hooks called
3. **Stop Accepting** - Server stops accepting new connections
4. **Drain Connections** - Wait for existing connections
5. **Router Cleanup** - File watchers closed
6. **Plugin Termination** - Plugin `terminate` hooks called (reverse order)
7. **Server Closed** - All resources released

## 🌐 Production Deployment

### ⚠️ Hosting Considerations

Many hosting providers don't provide SSL certificate access needed for HTTP/2:

```typescript
// Vercel, Netlify, Heroku (HTTP/1.1 only)
const server = createServer({
  port: parseInt(process.env.PORT || '3000'),
  host: '0.0.0.0',
  routesDir: path.resolve(__dirname, './routes'),
  http2: {
    enabled: false  // Providers handle HTTPS termination
  }
});

// VPS/Dedicated with Let's Encrypt
const server = createServer({
  port: 443,
  host: '0.0.0.0',
  routesDir: path.resolve(__dirname, './routes'),
  http2: {
    enabled: true,
    keyFile: '/etc/letsencrypt/live/domain.com/privkey.pem',
    certFile: '/etc/letsencrypt/live/domain.com/fullchain.pem'
  }
});
```

### 🐳 Docker Deployment

```typescript
// Docker container configuration
const server = createServer({
  port: parseInt(process.env.PORT || '3000'),
  host: '0.0.0.0',  // Important: bind to all interfaces
  routesDir: path.resolve(__dirname, './routes'),
  http2: {
    enabled: !!process.env.SSL_CERT_PATH,
    keyFile: process.env.SSL_KEY_PATH,
    certFile: process.env.SSL_CERT_PATH
  }
});
```

```dockerfile
# Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm install
EXPOSE 3000
CMD ["node", "server.js"]
```

## 🛡️ Error Handling

### Server Creation Errors

```typescript
try {
  const server = createServer({
    port: -1,  // Invalid port
    routesDir: './invalid'
  });
} catch (error) {
  console.error('Failed to create server:', error.message);
  // "Failed to create server: Port must be between 0 and 65535"
}
```

### Startup Errors

```typescript
const server = createServer({
  port: 80,  // May require privileges
  routesDir: path.resolve(__dirname, './routes')
});

try {
  await server.listen();
} catch (error) {
  if (error.code === 'EACCES') {
    console.error('Permission denied. Try a port > 1024');
  } else if (error.code === 'EADDRINUSE') {
    console.error('Port already in use');
  }
}
```

### Plugin Errors

```typescript
const server = createServer({
  routesDir: path.resolve(__dirname, './routes'),
  plugins: [
    createPlugin('failing', '1.0.0', () => {
      return {
        initialize: async () => {
          throw new Error('Plugin initialization failed');
        }
      };
    })()
  ]
});

// Plugin errors are handled gracefully by default
// Set continueOnError: false to fail on plugin errors
```

## 🧪 Testing

### Testing Server Creation

```typescript
import { describe, test, expect } from 'vitest';
import { createServer } from 'blaizejs';
import path from 'node:path';

describe('Server Creation', () => {
  test('should create server with default options', () => {
    const server = createServer();
    
    expect(server.port).toBe(3000);
    expect(server.host).toBe('localhost');
    expect(server.middleware).toEqual([]);
    expect(server.plugins).toEqual([]);
  });
  
  test('should create server with custom options', () => {
    const server = createServer({
      port: 8080,
      host: '0.0.0.0',
      routesDir: path.resolve(__dirname, './test-routes')
    });
    
    expect(server.port).toBe(8080);
    expect(server.host).toBe('0.0.0.0');
  });
});
```

### Testing Server Lifecycle

```typescript
import { createMockServer } from '@blaizejs/testing-utils';

describe('Server Lifecycle', () => {
  test('should start and stop server', async () => {
    const server = createMockServer({
      port: 0  // Use random port for testing
    });
    
    await server.listen();
    expect(server.server).toBeDefined();
    
    await server.close();
    expect(server.server).toBeUndefined();
  });
  
  test('should emit lifecycle events', async () => {
    const server = createMockServer();
    const events: string[] = [];
    
    server.events.on('started', () => events.push('started'));
    server.events.on('stopping', () => events.push('stopping'));
    
    await server.listen();
    await server.close();
    
    expect(events).toEqual(['started', 'stopping']);
  });
});
```

### Testing with Middleware and Plugins

```typescript
import { createMockServer, createMockMiddleware, createMockPlugin } from '@blaizejs/testing-utils';

describe('Server Integration', () => {
  test('should register middleware', () => {
    const server = createMockServer();
    const middleware = createMockMiddleware();
    
    server.use(middleware);
    
    expect(server.middleware).toContain(middleware);
  });
  
  test('should register plugins', async () => {
    const server = createMockServer();
    const plugin = createMockPlugin({
      name: 'test-plugin',
      version: '1.0.0'
    });
    
    await server.register(plugin);
    
    expect(server.plugins).toContain(plugin);
    expect(plugin.register).toHaveBeenCalledWith(server);
  });
});
```

## 📚 Type Reference

### Core Types

```typescript
// From blaizejs (exported from main package)

/**
 * Server configuration options
 */
export interface ServerOptionsInput {
  port?: number;
  host?: string;
  routesDir?: string;
  http2?: {
    enabled?: boolean;
    keyFile?: string;
    certFile?: string;
  };
  middleware?: Middleware[];
  plugins?: Plugin[];
}

/**
 * Server instance
 */
export interface Server {
  // Properties
  server: http.Server | http2.Http2Server | undefined;
  port: number;
  host: string;
  events: EventEmitter;
  plugins: Plugin[];
  middleware: Middleware[];
  router: Router;
  context: AsyncLocalStorage<Context>;
  pluginManager: PluginLifecycleManager;
  
  // Methods
  listen(port?: number, host?: string): Promise<Server>;
  close(options?: StopOptions): Promise<void>;
  use(middleware: Middleware | Middleware[]): Server;
  register(plugin: Plugin): Promise<Server>;
}

/**
 * Server stop options
 */
export interface StopOptions {
  timeout?: number;
  onStopping?: () => Promise<void> | void;
  onStopped?: () => Promise<void> | void;
}
```

## 🗺️ Roadmap

### 🚀 Current (v0.3.1) - Beta

- ✅ **HTTP/2 Support** - Default HTTP/2 with HTTP/1.1 fallback
- ✅ **Auto HTTPS** - Self-signed certificates for development
- ✅ **Lifecycle Management** - Graceful startup and shutdown
- ✅ **Plugin System** - Extensible architecture
- ✅ **Middleware Pipeline** - Composable request processing
- ✅ **Router Integration** - Automatic file-based routing
- ✅ **Context Storage** - AsyncLocalStorage for state
- ✅ **Event System** - Lifecycle event emitters
- ✅ **Signal Handling** - Graceful shutdown on signals

### 🎯 MVP/1.0 Release

- 🔄 **Server Push** - HTTP/2 server push support
- 🔄 **WebSocket Support** - Integrated WebSocket handling
- 🔄 **Request Streaming** - Stream request/response bodies
- 🔄 **Enhanced Error Handling** - Centralized error management
- 🔄 **Performance Monitoring** - Built-in metrics collection
- 🔄 **Health Checks** - Standard health/readiness endpoints
- 🔄 **Cluster Support** - Multi-process scaling

### 🔮 Post-MVP (v1.1+)

- 🔄 **HTTP/3 Support** - QUIC protocol support
- 🔄 **Service Worker** - Server-side service worker
- 🔄 **GraphQL Integration** - Built-in GraphQL server
- 🔄 **gRPC Support** - Protocol buffer services
- 🔄 **Load Balancing** - Built-in load balancer
- 🔄 **Rate Limiting** - Configurable rate limits
- 🔄 **Request Caching** - Server-side cache layer
- 🔄 **API Gateway** - Routing and aggregation

### 🌟 Future Considerations

- 🔄 **Edge Runtime** - Cloudflare Workers, Deno Deploy
- 🔄 **Bun Support** - Native Bun.serve integration
- 🔄 **Auto-scaling** - Dynamic resource management
- 🔄 **Federation** - Distributed server mesh
- 🔄 **Observability** - OpenTelemetry integration
- 🔄 **Security Scanner** - Automated vulnerability scanning

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](../../CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/jleajones/blaize.git
cd blaize

# Install dependencies (using pnpm)
pnpm install

# Run server tests
pnpm test server

# Run tests in watch mode
pnpm test:watch server

# Build the package
pnpm build

# Run linting
pnpm lint
```

### Testing Your Changes

1. Write tests for new features
2. Ensure all tests pass: `pnpm test`
3. Check type safety: `pnpm type-check`
4. Verify linting: `pnpm lint`

### Important Notes for Contributors

When adding new server features:

1. **Check exports**: Ensure features are exported in `/packages/blaize-core/src/index.ts`
2. **Update types**: Add types to `@blaize-types/server`
3. **Add tests**: Use `@blaizejs/testing-utils` for testing
4. **Consider lifecycle**: How does it fit in startup/shutdown?
5. **Document behavior**: Update this README with examples

### ⚠️ Internal Components

The following are internal and not exported:
- `router` property access (use `routesDir` for configuration)
- `pluginManager` (managed internally)
- Direct HTTP/2 server configuration (use `http2` options)
- Certificate generation utilities (automatic in development)

## 📚 Related Documentation

- 🏠 [BlaizeJS Main Documentation](../../README.md)
- 🚀 [Router Module](../router/README.md) - File-based routing *(internal)*
- 🔧 [Middleware Module](../middleware/README.md) - Request processing
- 🧩 [Plugins Module](../plugins/README.md) - Server extensions
- 🔗 [Context Module](../context/README.md) - State management
- 🧪 [Testing Utils](../../../blaize-testing-utils/README.md) - Testing utilities

---

**Built with ❤️ by the BlaizeJS team**

_The BlaizeJS server provides a modern, performant foundation for your web applications with HTTP/2, automatic HTTPS, and a powerful plugin system._