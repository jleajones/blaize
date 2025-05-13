# BlaizeJS Server Module

The Server module provides a modern, TypeScript-first HTTP/HTTP2 server implementation for the BlaizeJS framework. It's designed to offer high performance, type safety, and modern developer experience with minimal boilerplate.

## Overview

The BlaizeJS Server module:

- Supports both HTTP/2 and HTTP/1.1
- Automatically handles SSL certificate configuration for HTTP/2
- Provides development certificate generation for local development
- Includes plugin lifecycle management
- Implements graceful server startup and shutdown

## Installation

```bash
# The server module is part of the core package
npm install blaizejs
```

## Basic Usage

```typescript
import { createServer } from 'blaizejs';

// Create a server with default options
const app = createServer();

// Start listening
app.listen(3000).then(() => {
  console.log('Server is running!');
});
```

## Configuration Options

The server can be configured with various options:

```typescript
import { createServer } from 'blaizejs';

const app = createServer({
  // Server options
  port: 3000,
  host: 'localhost',
  
  // HTTP/2 configuration
  http2: {
    enabled: true,
    keyFile: 'path/to/key.pem',   // Optional in development
    certFile: 'path/to/cert.pem'  // Optional in development
  },
  
  // Routes configuration
  routesDir: './routes'
});
```

## HTTP/2 Support

The server supports HTTP/2 by default with fallback to HTTP/1.1 for clients that don't support it. In development mode, it can automatically generate self-signed certificates for local development.

### Automatic Certificate Generation

When running in development mode (`NODE_ENV=development`), the server will automatically generate self-signed certificates if none are provided:

```typescript
// No need to provide certificates in development
const app = createServer({
  http2: { enabled: true }
});
```

For production, you should always provide proper SSL certificates:

```typescript
const app = createServer({
  http2: {
    enabled: true,
    keyFile: '/path/to/production/key.pem',
    certFile: '/path/to/production/cert.pem'
  }
});
```

## Lifecycle Management

The server implements proper lifecycle management:

```typescript
const app = createServer();

// Start the server
await app.listen();

// Gracefully stop the server
await app.stop();
```

## Plugin System

The server supports a plugin system for extending functionality:

```typescript
import { createServer } from 'blaizejs';
import { loggerPlugin } from '@blaizejs/logger-plugin';

const app = createServer();

// Register a plugin
await app.register(loggerPlugin({
  level: 'info'
}));

await app.listen();
```

Plugins can hook into server lifecycle events:

- `initialize`: Called when the server starts
- `terminate`: Called when the server stops

## API Reference

### `createServer(options?: ServerOptions): Server`

Creates a new server instance with the specified options.

#### ServerOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `port` | number | 3000 | Port to listen on |
| `host` | string | 'localhost' | Host to bind to |
| `http2` | Http2Options | `{ enabled: true }` | HTTP/2 configuration |
| `routesDir` | string | './routes' | Directory to scan for routes |

#### Http2Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | true | Enable HTTP/2 |
| `keyFile` | string | null | Path to key file |
| `certFile` | string | null | Path to certificate file |

### Server Methods

#### `listen(port?: number, host?: string): Promise<void>`

Starts the server on the specified port and host. If not provided, uses the options from server creation.

#### `stop(): Promise<void>`

Gracefully stops the server, waiting for existing connections to close.

#### `register(plugin: Plugin): Promise<Server>`

Registers a plugin with the server.

#### `use(middleware: Middleware): Server`

Adds global middleware to the server.

## Internal Architecture

The server module consists of several key components:

1. **create.ts**: Factory function for creating server instances
2. **start.ts**: Handles server startup, certificate generation and request handling
3. **stop.ts**: Implements graceful server shutdown
4. **dev-certificate.ts**: Generates development SSL certificates
5. **types.ts**: TypeScript interfaces and types for the server
6. **validation.ts**: Schema validation for server options

## Testing

The server module includes comprehensive tests:

- Unit tests for each component
- Integration tests for HTTP and HTTP/2 functionality
- Certificate generation tests

## Best Practices

- In development, let the server generate certificates automatically
- For production, always provide proper SSL certificates
- Use the plugin system to extend functionality
- Implement graceful shutdown for better reliability

## License

MIT