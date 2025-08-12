# 🧩 BlaizeJS Plugins Module

> **Extensible plugin system** for adding functionality to your BlaizeJS applications with lifecycle hooks, middleware integration, and seamless server augmentation
>
> Build authentication providers, database connections, monitoring tools, and more with a simple, powerful API

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
- [♻️ Lifecycle Management](#️-lifecycle-management)
- [🛡️ Error Handling](#️-error-handling)
- [🧪 Testing](#-testing)
- [📚 Type Reference](#-type-reference)
- [🗺️ Roadmap](#️-roadmap)
- [🤝 Contributing](#-contributing)

## 🌟 Features

- 🏗️ **Simple API** - Create plugins with factory functions and configuration
- ♻️ **Lifecycle Hooks** - Initialize, start, stop, and terminate phases
- 🔗 **Server Integration** - Seamlessly extend server functionality
- 🎯 **Type-Safe Options** - Full TypeScript support with type inference
- 🔄 **Async/Sync Support** - Handle both patterns in lifecycle hooks
- 🧩 **Composable** - Plugins can work together and share state
- 📊 **Ordered Execution** - Predictable initialization and termination order
- 🛡️ **Error Resilience** - Configurable error handling strategies
- 🧪 **Testing Utilities** - Comprehensive mocks and helpers
- ⚙️ **Zero Configuration** - Works out of the box with sensible defaults

## 📦 Installation

Plugins are included with the main BlaizeJS package:

```bash
# Using pnpm (recommended)
pnpm add blaizejs

# Using npm
npm install blaizejs

# Using yarn
yarn add blaizejs
```

## 🚀 Quick Start

### Creating Your First Plugin

```typescript
import { createPlugin } from 'blaizejs';
import type { Server } from 'blaizejs';

// Simple plugin without lifecycle hooks
const loggingPlugin = createPlugin(
  'logger',
  '1.0.0',
  (server: Server, options) => {
    console.log(`Logger initialized with level: ${options.level}`);
    
    // Add middleware to the server
    server.use(createMiddleware({
      name: 'request-logger',
      handler: async (ctx, next) => {
        console.log(`→ ${ctx.request.method} ${ctx.request.path}`);
        await next();
        console.log(`← ${ctx.response.statusCode}`);
      }
    }));
  },
  { level: 'info' } // Default options
);

// Plugin with lifecycle hooks
const databasePlugin = createPlugin(
  'database',
  '2.0.0',
  async (server, options) => {
    let connection: DatabaseConnection;
    
    return {
      initialize: async () => {
        console.log('Connecting to database...');
        connection = await connectToDatabase(options.url);
      },
      
      terminate: async () => {
        console.log('Closing database connection...');
        await connection.close();
      }
    };
  },
  { url: 'postgresql://localhost:5432/myapp' }
);
```

### Using Plugins in Your Server

```typescript
import { createServer } from 'blaizejs';

const server = createServer({
  port: 3000,
  plugins: [
    loggingPlugin(),                    // Use default options
    databasePlugin({ url: process.env.DATABASE_URL }), // Override options
  ]
});

await server.listen();
```

### Adding Plugins at Runtime

```typescript
// Plugins can also be registered after server creation
const server = createServer({ port: 3000 });

// Register plugins dynamically
await server.register(authPlugin());
await server.register(cachePlugin({ ttl: 3600 }));

await server.listen();
```

## 📖 Core Concepts

### 🎭 The Plugin Contract

Every plugin follows this lifecycle:

1. **Registration** - Plugin is added to the server
2. **Initialization** - Setup resources and connections
3. **Server Start** - Server begins accepting requests
4. **Server Stop** - Server stops accepting new requests
5. **Termination** - Cleanup and resource disposal

```typescript
const plugin = createPlugin(
  'lifecycle-example',
  '1.0.0',
  async (server, options) => {
    // Registration phase - runs immediately
    console.log('Plugin registered');
    
    return {
      // Optional lifecycle hooks
      initialize: async () => {
        console.log('Plugin initializing...');
      },
      
      onServerStart: async (httpServer) => {
        console.log('Server started');
      },
      
      onServerStop: async (httpServer) => {
        console.log('Server stopping');
      },
      
      terminate: async () => {
        console.log('Plugin terminating...');
      }
    };
  }
);
```

### 🔗 Plugin Composition

Plugins can work together and share functionality:

```typescript
// Database plugin provides connection
const databasePlugin = createPlugin(
  'database',
  '1.0.0',
  (server, options) => {
    const db = new Database(options);
    
    // Make database available to other plugins
    server.context.setGlobal('db', db);
    
    return {
      initialize: async () => await db.connect(),
      terminate: async () => await db.close()
    };
  }
);

// Cache plugin uses database
const cachePlugin = createPlugin(
  'cache',
  '1.0.0',
  (server, options) => {
    return {
      initialize: async () => {
        const db = server.context.getGlobal('db');
        // Use database connection for cache
      }
    };
  }
);
```

## 🎯 Core APIs

### `createPlugin`

Creates a plugin factory function that can be instantiated with options.

#### Signature

```typescript
function createPlugin<T = any>(
  name: string,
  version: string,
  setup: (server: Server, options: T) => void | Partial<PluginHooks> | Promise<void> | Promise<Partial<PluginHooks>>,
  defaultOptions?: Partial<T>
): PluginFactory<T>
```

#### Parameters

| Parameter        | Type                                         | Description                           |
| ---------------- | -------------------------------------------- | ------------------------------------- |
| `name`           | `string`                                     | Plugin identifier                     |
| `version`        | `string`                                     | Semantic version                      |
| `setup`          | `(server, options) => void \| PluginHooks`  | Setup function                        |
| `defaultOptions` | `Partial<T>`                                 | Default configuration options         |

#### Returns

Returns a `PluginFactory` function that creates plugin instances.

### Plugin Lifecycle Hooks

All lifecycle hooks are optional:

```typescript
interface PluginHooks {
  // Called during server initialization
  initialize?: (server?: Server) => void | Promise<void>;
  
  // Called when HTTP server starts listening
  onServerStart?: (httpServer: any) => void | Promise<void>;
  
  // Called when HTTP server stops
  onServerStop?: (httpServer: any) => void | Promise<void>;
  
  // Called during server termination
  terminate?: (server?: Server) => void | Promise<void>;
}
```

## 💡 Common Patterns

### 🔐 Authentication Plugin

```typescript
const authPlugin = createPlugin(
  'auth',
  '1.0.0',
  (server, options) => {
    const authService = new AuthService(options);
    
    // Add auth middleware globally
    server.use(createMiddleware({
      name: 'auth',
      handler: async (ctx, next) => {
        const token = ctx.request.header('authorization');
        
        if (!token && !options.allowAnonymous) {
          throw new UnauthorizedError('Authentication required');
        }
        
        if (token) {
          ctx.state.user = await authService.verifyToken(token);
        }
        
        await next();
      },
      skip: ctx => {
        // Skip auth for public routes
        return options.publicPaths.some(path => 
          ctx.request.path.startsWith(path)
        );
      }
    }));
    
    // Make auth service available
    server.context.setGlobal('auth', authService);
    
    return {
      initialize: async () => {
        await authService.initialize();
        console.log('Auth plugin initialized');
      },
      
      terminate: async () => {
        await authService.cleanup();
      }
    };
  },
  {
    allowAnonymous: false,
    publicPaths: ['/health', '/public'],
    tokenSecret: process.env.JWT_SECRET
  }
);
```

### 📊 Database Plugin

```typescript
const databasePlugin = createPlugin(
  'database',
  '2.0.0',
  (server, options) => {
    let pool: DatabasePool;
    
    return {
      initialize: async () => {
        console.log('Connecting to database...');
        pool = await createPool(options);
        
        // Make database available in context
        server.context.setGlobal('db', {
          query: pool.query.bind(pool),
          transaction: pool.transaction.bind(pool)
        });
      },
      
      onServerStart: async () => {
        // Verify connection on startup
        await pool.query('SELECT 1');
        console.log('Database connection verified');
      },
      
      onServerStop: async () => {
        // Stop accepting new queries
        console.log('Draining database connections...');
        await pool.drain();
      },
      
      terminate: async () => {
        // Close all connections
        await pool.close();
        console.log('Database connections closed');
      }
    };
  },
  {
    host: 'localhost',
    port: 5432,
    database: 'myapp',
    max: 20,
    idleTimeoutMillis: 30000
  }
);
```

### ⚡ Caching Plugin

```typescript
const cachePlugin = createPlugin(
  'cache',
  '1.0.0',
  (server, options) => {
    const cache = new CacheStore(options);
    
    // Add caching middleware
    server.use(createMiddleware({
      name: 'cache',
      handler: async (ctx, next) => {
        if (ctx.request.method !== 'GET') {
          return next();
        }
        
        const key = `${ctx.request.path}:${ctx.request.query}`;
        const cached = await cache.get(key);
        
        if (cached) {
          ctx.response.header('X-Cache', 'HIT');
          return ctx.response.json(cached);
        }
        
        // Intercept response to cache it
        const originalJson = ctx.response.json.bind(ctx.response);
        ctx.response.json = (data: any) => {
          cache.set(key, data, options.ttl);
          ctx.response.header('X-Cache', 'MISS');
          return originalJson(data);
        };
        
        await next();
      }
    }));
    
    // Make cache available
    server.context.setGlobal('cache', cache);
    
    return {
      initialize: async () => {
        await cache.connect();
        console.log('Cache store connected');
      },
      
      terminate: async () => {
        await cache.disconnect();
      }
    };
  },
  {
    ttl: 300,
    maxSize: 1000,
    strategy: 'lru'
  }
);
```

### 📈 Monitoring Plugin

```typescript
const monitoringPlugin = createPlugin(
  'monitoring',
  '1.0.0',
  (server, options) => {
    const metrics = new MetricsCollector(options);
    
    // Track request metrics
    server.use(createMiddleware({
      name: 'metrics',
      handler: async (ctx, next) => {
        const start = Date.now();
        
        try {
          await next();
        } finally {
          const duration = Date.now() - start;
          
          metrics.record({
            method: ctx.request.method,
            path: ctx.request.path,
            status: ctx.response.statusCode,
            duration
          });
        }
      }
    }));
    
    // Add metrics endpoint
    server.get('/metrics', async (ctx) => {
      return ctx.response.text(await metrics.export());
    });
    
    return {
      initialize: async () => {
        await metrics.start();
        console.log('Monitoring initialized');
      },
      
      onServerStart: async () => {
        metrics.recordEvent('server_started');
      },
      
      onServerStop: async () => {
        metrics.recordEvent('server_stopped');
        await metrics.flush();
      },
      
      terminate: async () => {
        await metrics.stop();
      }
    };
  },
  {
    interval: 60000,
    endpoint: '/metrics',
    format: 'prometheus'
  }
);
```

## ♻️ Lifecycle Management

### Execution Order

Plugins follow a predictable execution order:

```typescript
// Initialization: Forward order (first to last)
plugin1.initialize() → plugin2.initialize() → plugin3.initialize()

// Server events: Forward order
plugin1.onServerStart() → plugin2.onServerStart() → plugin3.onServerStart()

// Termination: Reverse order (last to first)
plugin3.terminate() → plugin2.terminate() → plugin1.terminate()
```

### Visual Lifecycle Flow

```
Server Creation
      ↓
[Plugin Registration] - Setup functions run
      ↓
[Plugin Initialization] - initialize() hooks
      ↓
[Server Start] - onServerStart() hooks
      ↓
    Running
      ↓
[Server Stop] - onServerStop() hooks
      ↓
[Plugin Termination] - terminate() hooks (reverse order)
      ↓
Server Shutdown
```

### Graceful Shutdown Example

```typescript
const resourcePlugin = createPlugin(
  'resources',
  '1.0.0',
  (server, options) => {
    const resources = new Map();
    
    return {
      initialize: async () => {
        // Setup resources in dependency order
        resources.set('database', await connectDB());
        resources.set('redis', await connectRedis());
        resources.set('queue', await connectQueue());
      },
      
      onServerStop: async () => {
        // Stop accepting new work
        const queue = resources.get('queue');
        await queue.pause();
        
        // Wait for in-flight operations
        await queue.waitForEmpty();
        console.log('Queue drained');
      },
      
      terminate: async () => {
        // Cleanup in reverse dependency order
        await resources.get('queue')?.close();
        await resources.get('redis')?.disconnect();
        await resources.get('database')?.close();
        
        resources.clear();
        console.log('All resources cleaned up');
      }
    };
  }
);
```

## 🛡️ Error Handling

### Lifecycle Error Management

The plugin system handles errors gracefully during lifecycle phases:

```typescript
// Internal lifecycle manager behavior (automatic)
// Errors are logged but don't crash the server by default
const lifecycleOptions = {
  continueOnError: true,  // Continue if a plugin fails
  debug: true,            // Log lifecycle events
  onError: (plugin, phase, error) => {
    console.error(`Plugin ${plugin.name} failed in ${phase}:`, error);
  }
};
```

### Plugin Error Handling

```typescript
const robustPlugin = createPlugin(
  'robust',
  '1.0.0',
  (server, options) => {
    return {
      initialize: async () => {
        try {
          await riskyOperation();
        } catch (error) {
          // Log error but don't fail initialization
          console.error('Non-critical error during init:', error);
          
          // Or re-throw to fail the plugin
          if (error.critical) {
            throw error;
          }
        }
      },
      
      terminate: async () => {
        try {
          await cleanup();
        } catch (error) {
          // Always try to cleanup, even on error
          console.error('Error during cleanup:', error);
        }
      }
    };
  }
);
```

### Using Framework Error Classes

```typescript
import { ValidationError, InternalServerError } from 'blaizejs';

const validatedPlugin = createPlugin(
  'validated',
  '1.0.0',
  (server, options) => {
    // Validate options during registration
    if (!options.apiKey) {
      throw new ValidationError('API key is required');
    }
    
    return {
      initialize: async () => {
        try {
          await validateApiKey(options.apiKey);
        } catch (error) {
          throw new InternalServerError('Failed to validate API key');
        }
      }
    };
  }
);
```

## 🧪 Testing

### Testing Plugin Creation

```typescript
import { describe, test, expect, vi } from 'vitest';
import { createPlugin } from 'blaizejs';
import { createMockServer } from '@blaizejs/testing-utils';

describe('Plugin Creation', () => {
  test('should create plugin with default options', () => {
    const setupFn = vi.fn();
    
    const plugin = createPlugin(
      'test-plugin',
      '1.0.0',
      setupFn,
      { defaultValue: 'test' }
    );
    
    const instance = plugin();
    const server = createMockServer();
    
    // Register triggers setup function
    instance.register(server);
    
    expect(instance.name).toBe('test-plugin');
    expect(instance.version).toBe('1.0.0');
    expect(setupFn).toHaveBeenCalledWith(server, { defaultValue: 'test' });
  });
  
  test('should override default options', () => {
    const setupFn = vi.fn();
    
    const plugin = createPlugin(
      'test-plugin',
      '1.0.0',
      setupFn,
      { value: 'default' }
    );
    
    const instance = plugin({ value: 'custom' });
    const server = createMockServer();
    
    instance.register(server);
    
    expect(setupFn).toHaveBeenCalledWith(server, { value: 'custom' });
  });
});
```

### Testing Plugin Lifecycle

```typescript
import { createMockPlugin, createMockServerWithPlugins } from '@blaizejs/testing-utils';

describe('Plugin Lifecycle', () => {
  test('should execute lifecycle hooks in order', async () => {
    const executionOrder: string[] = [];
    
    const plugin = createPlugin(
      'lifecycle-test',
      '1.0.0',
      () => {
        executionOrder.push('register');
        
        return {
          initialize: async () => {
            executionOrder.push('initialize');
          },
          onServerStart: async () => {
            executionOrder.push('start');
          },
          onServerStop: async () => {
            executionOrder.push('stop');
          },
          terminate: async () => {
            executionOrder.push('terminate');
          }
        };
      }
    );
    
    const instance = plugin();
    const server = createMockServer();
    
    // Execute lifecycle
    await instance.register(server);
    await instance.initialize?.(server);
    await instance.onServerStart?.({});
    await instance.onServerStop?.({});
    await instance.terminate?.(server);
    
    expect(executionOrder).toEqual([
      'register',
      'initialize',
      'start',
      'stop',
      'terminate'
    ]);
  });
});
```

### Mock Plugin Helpers

```typescript
import { createMockPlugin } from '@blaizejs/testing-utils';

describe('Server with Plugins', () => {
  test('should register mock plugins', async () => {
    const mockPlugin = createMockPlugin({
      name: 'mock-database',
      version: '1.0.0',
      // All lifecycle methods are automatically mocked
    });
    
    const { server } = createMockServerWithPlugins(1);
    server.plugins[0] = mockPlugin;
    
    // Test lifecycle execution
    await mockPlugin.initialize?.(server);
    
    expect(mockPlugin.initialize).toHaveBeenCalledWith(server);
  });
  
  test('should handle plugin errors', async () => {
    const errorPlugin = createMockPlugin({
      name: 'error-plugin',
      initialize: vi.fn().mockRejectedValue(new Error('Init failed'))
    });
    
    const server = createMockServer();
    
    await expect(errorPlugin.initialize?.(server)).rejects.toThrow('Init failed');
  });
});
```

### Testing Plugin Integration

```typescript
describe('Plugin Integration', () => {
  test('should make services available to routes', async () => {
    const servicePlugin = createPlugin(
      'service',
      '1.0.0',
      (server, options) => {
        server.context.setGlobal('testService', {
          getValue: () => options.value
        });
      },
      { value: 'test-value' }
    );
    
    const server = createServer({
      port: 0,
      plugins: [servicePlugin()]
    });
    
    server.get('/test', async (ctx) => {
      const service = ctx.state.testService;
      return { value: service.getValue() };
    });
    
    // Test the endpoint
    const response = await fetch('/test');
    const data = await response.json();
    
    expect(data.value).toBe('test-value');
  });
});
```

## 📚 Type Reference

### Core Types

```typescript
// From blaizejs (re-exported from @blaizejs/types)

/**
 * Plugin interface
 */
export interface Plugin extends PluginHooks {
  name: string;
  version: string;
}

/**
 * Plugin lifecycle hooks
 */
export interface PluginHooks {
  // Called when plugin is registered
  register: (app: Server) => void | Promise<void>;
  
  // Called during server initialization
  initialize?: (app?: Server) => void | Promise<void>;
  
  // Called when server starts
  onServerStart?: (server: any) => void | Promise<void>;
  
  // Called when server stops
  onServerStop?: (server: any) => void | Promise<void>;
  
  // Called during server termination
  terminate?: (app?: Server) => void | Promise<void>;
}

/**
 * Plugin factory function
 */
export type PluginFactory<T = any> = (options?: T) => Plugin;

/**
 * Plugin lifecycle manager (internal)
 */
export interface PluginLifecycleManager {
  initializePlugins(server: Server): Promise<void>;
  terminatePlugins(server: Server): Promise<void>;
  onServerStart(server: Server, httpServer: any): Promise<void>;
  onServerStop(server: Server, httpServer: any): Promise<void>;
}
```

## 🗺️ Roadmap

### 🚀 Current (v0.3.1) - Beta

- ✅ **Factory Function** - Simple createPlugin API
- ✅ **Lifecycle Hooks** - Full lifecycle management
- ✅ **Server Integration** - Seamless server augmentation
- ✅ **Type Safety** - Full TypeScript support
- ✅ **Testing Utilities** - Mock helpers via @blaizejs/testing-utils
- ✅ **Error Resilience** - Graceful error handling

### 🎯 MVP/1.0 Release

- 🔄 **Plugin Validation** - Export validation utilities
- 🔄 **Enhanced Testing Utilities** - Comprehensive plugin testing helpers
  - Plugin lifecycle simulation and assertions
  - State tracking between lifecycle phases
  - Plugin interaction testing
  - Performance benchmarking for plugins
  - Mock plugin factories with preset behaviors
- 🔄 **Dependency Management** - Plugin dependencies and ordering
- 🔄 **Conflict Detection** - Detect conflicting plugins
- 🔄 **Plugin Metadata** - Enhanced plugin information

### 🔮 Post-MVP (v1.1+)

- 🔄 **Plugin Error Classes** - Export specialized error types
  - `PluginValidationError` for validation failures
  - `PluginLifecycleError` for lifecycle issues
  - `PluginDependencyError` for missing dependencies
- 🔄 **Hot Reload** - Development mode plugin reloading
- 🔄 **Plugin Marketplace** - Community plugin registry
- 🔄 **Plugin CLI** - Scaffolding and management tools
- 🔄 **Plugin Composition** - Advanced composition patterns
- 🔄 **Performance Monitoring** - Plugin performance metrics
- 🔄 **Version Compatibility** - Automatic compatibility checking

### 🌟 Future Considerations

- 🔄 **Visual Plugin Manager** - Browser-based plugin management
- 🔄 **Plugin Analytics** - Usage and performance insights
- 🔄 **AI-Assisted Creation** - Generate plugins from descriptions
- 🔄 **Cross-Platform Support** - Deno and Bun compatibility
- 🔄 **Plugin Bundling** - Optimized plugin distribution
- 🔄 **Remote Plugins** - Load plugins from external sources

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](../../CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/jleajones/blaize.git
cd blaize

# Install dependencies (using pnpm)
pnpm install

# Run tests for plugins
pnpm test plugins

# Run tests in watch mode
pnpm test:watch plugins

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

When adding new plugin features:

1. **Check exports**: Ensure features are exported in `/packages/blaize-core/src/index.ts`
2. **Update types**: Add types to `@blaize-types/plugins`
3. **Add tests**: Use `@blaizejs/testing-utils` for testing
4. **Document limitations**: Note any internal-only features
5. **Follow patterns**: Match existing plugin patterns

## 📚 Related Documentation

- 🏠 [BlaizeJS Main Documentation](../../README.md)
- 🔧 [Middleware Module](../middleware/README.md) - Plugin middleware integration
- 🔗 [Context Module](../context/README.md) - Plugin state management
- 🌐 [Server Module](../server/README.md) - Server plugin registration
- 🚀 [Router Module](../router/README.md) - Plugin route management
- 🧪 [Testing Utils](../../../blaize-testing-utils/README.md) - Testing utilities

---

**Built with ❤️ by the BlaizeJS team**

_Plugins extend BlaizeJS with powerful, reusable functionality - from databases to monitoring, authentication to caching._