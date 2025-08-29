# 🧩 BlaizeJS Plugins

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

## 🌟 Features

🏗️ **Simple Factory API** - Create plugins with typed factory functions and configuration
♻️ **Lifecycle Hooks** - Initialize, start, stop, and terminate phases with async support
🔗 **Server Extension** - Add methods and properties directly to server instances
🎯 **Context Modification** - Extend request context through middleware integration
🔄 **Middleware Composition** - Use compose() for multi-middleware plugins
🧩 **Type-Safe Integration** - Full TypeScript support with server and context type tracking
📊 **Ordered Execution** - Predictable initialization and termination order
🛡️ **Error Resilience** - Configurable error handling strategies
🧪 **Testing Utilities** - Comprehensive mocks and helpers
⚙️ **Zero Configuration** - Works out of the box with sensible defaults

## 📦 Installation

```bash
# Plugins are included with the main BlaizeJS package
pnpm add blaizejs

# For testing plugins
pnpm add -D @blaizejs/testing-utils
```

## 🚀 Quick Start

### Creating Your First Plugin

```typescript
import { createPlugin, createMiddleware } from 'blaizejs';

// Simple logging plugin that adds middleware
const loggingPlugin = createPlugin(
  'logger',
  '1.0.0',
  (server, options) => {
    // Add logging middleware to the server
    const loggerMiddleware = createMiddleware({
      name: 'request-logger',
      handler: async (ctx, next) => {
        console.log(`→ ${ctx.request.method} ${ctx.request.path}`);
        const start = Date.now();
        
        await next();
        
        const duration = Date.now() - start;
        console.log(`← ${ctx.response.statusCode} (${duration}ms)`);
      }
    });
    
    server.use(loggerMiddleware);
    console.log(`Logger initialized with level: ${options.level}`);
  },
  { level: 'info' } // Default options
);

// Database plugin with lifecycle hooks
const databasePlugin = createPlugin(
  'database',
  '2.0.0',
  (server, options) => {
    let pool: DatabasePool;
    
    // Add database methods to server instance
    server.queryRaw = (sql: string) => pool.query(sql);
    server.closeConnections = () => pool.close();
    
    // Add database context via middleware
    const dbMiddleware = createMiddleware({
      name: 'database-context',
      handler: async (ctx, next) => {
        ctx.db = {
          query: (sql) => pool.query(sql),
          transaction: (fn) => pool.transaction(fn)
        };
        await next();
      }
    });
    
    server.use(dbMiddleware);
    
    return {
      initialize: async () => {
        console.log('Connecting to database...');
        pool = await createPool(options.connectionString);
      },
      
      terminate: async () => {
        console.log('Closing database connections...');
        await pool.close();
      }
    };
  },
  { connectionString: 'postgresql://localhost:5432/myapp' }
);
```

### Using Plugins in Your Server

```typescript
import { createServer } from 'blaizejs';

const server = createServer({
  port: 3000,
  plugins: [
    loggingPlugin(),                    // Use default options
    databasePlugin({ 
      connectionString: process.env.DATABASE_URL 
    }), // Override options
  ]
});

// TypeScript knows about plugin modifications
await server.queryRaw('SELECT * FROM users');  // From database plugin
await server.closeConnections();               // From database plugin

await server.listen();
```

### Context Modifications in Routes

```typescript
// Context modifications are available in route handlers
server.get('/api/users', async (ctx) => {
  // ctx.db available from database plugin middleware
  const users = await ctx.db.query('SELECT * FROM users');
  return { users };
});
```

## 📖 Core Concepts

### 🎭 The Plugin Contract

Every plugin follows this lifecycle:

1. **Registration** - Plugin factory creates instance with options
2. **Server Setup** - Plugin setup function runs, modifies server
3. **Initialization** - Optional initialize() hook runs
4. **Server Start** - Optional onServerStart() hook runs
5. **Server Stop** - Optional onServerStop() hook runs
6. **Termination** - Optional terminate() hook runs for cleanup

```typescript
const plugin = createPlugin(
  'lifecycle-example',
  '1.0.0',
  (server, options) => {
    // Registration phase - setup function runs immediately
    console.log('Plugin registered and setting up...');
    
    // Modify server or add middleware here
    server.customMethod = () => 'Hello from plugin!';
    
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

### 🔗 Plugin Composition with Middleware

Plugins integrate with BlaizeJS middleware system for context modifications:

```typescript
const authPlugin = createPlugin(
  'auth',
  '1.0.0',
  (server, options) => {
    const authService = new AuthService(options.secret);
    
    // Add server methods
    server.verifyToken = (token) => authService.verify(token);
    
    // Add context modifications via middleware
    const authMiddleware = createMiddleware({
      name: 'auth-context',
      handler: async (ctx, next) => {
        const token = ctx.request.header('authorization');
        
        if (token) {
          try {
            ctx.user = await authService.verify(token);
            ctx.authenticated = true;
          } catch (error) {
            ctx.authenticated = false;
          }
        } else {
          ctx.authenticated = false;
        }
        
        await next();
      }
    });
    
    server.use(authMiddleware);
    
    return {
      initialize: async () => {
        await authService.initialize();
      }
    };
  },
  { secret: process.env.JWT_SECRET }
);
```

## 🎯 Core APIs

### `createPlugin`

Creates a plugin factory function with full type safety for server and context modifications.

#### Signature

```typescript
function createPlugin<T = any, TServerMods = unknown, TContextMods = unknown>(
  name: string,
  version: string,
  setup: (server: Server, options: T) => void | Partial<PluginHooks> | Promise<void> | Promise<Partial<PluginHooks>>,
  defaultOptions?: Partial<T>
): PluginFactory<T, TServerMods, TContextMods>
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

All lifecycle hooks are optional and returned from the setup function:

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
import { createPlugin, createMiddleware } from 'blaizejs';

interface AuthConfig {
  secret: string;
  publicPaths: string[];
}

interface AuthServerMods {
  verifyToken: (token: string) => Promise<User>;
  generateToken: (user: User) => Promise<string>;
}

interface AuthContextMods {
  user?: User;
  authenticated: boolean;
}

const authPlugin = createPlugin<AuthConfig, AuthServerMods, AuthContextMods>(
  'auth',
  '1.0.0',
  (server, options) => {
    const authService = new AuthService(options.secret);
    
    // Server modifications - TypeScript knows server is Server & AuthServerMods
    server.verifyToken = (token) => authService.verify(token);
    server.generateToken = (user) => authService.generate(user);
    
    // Context modifications via middleware
    const authMiddleware = createMiddleware({
      name: 'auth-context',
      handler: async (ctx, next) => {
        const token = ctx.request.header('authorization');
        
        if (token) {
          try {
            // Direct context modification (not ctx.state)
            ctx.user = await authService.verify(token);
            ctx.authenticated = true;
          } catch (error) {
            ctx.authenticated = false;
            if (!options.publicPaths.includes(ctx.request.path)) {
              throw new UnauthorizedError('Invalid token');
            }
          }
        } else {
          ctx.authenticated = false;
          if (!options.publicPaths.includes(ctx.request.path)) {
            throw new UnauthorizedError('Authentication required');
          }
        }
        
        await next();
      }
    });
    
    server.use(authMiddleware);
    
    return {
      initialize: async () => {
        await authService.initialize();
        console.log('Auth plugin initialized');
      }
    };
  },
  {
    secret: process.env.JWT_SECRET || 'default-secret',
    publicPaths: ['/health', '/public', '/login']
  }
);
```

### 📊 Database Plugin

```typescript
import { createPlugin, createMiddleware } from 'blaizejs';

interface DatabaseConfig {
  connectionString: string;
  poolSize?: number;
}

interface DatabaseServerMods {
  queryRaw: (sql: string) => Promise<any[]>;
  closeConnections: () => Promise<void>;
}

interface DatabaseContextMods {
  db: {
    query: (sql: string) => Promise<any[]>;
    transaction: <T>(fn: (tx: any) => Promise<T>) => Promise<T>;
  };
}

const databasePlugin = createPlugin<DatabaseConfig, DatabaseServerMods, DatabaseContextMods>(
  'database',
  '1.0.0',
  (server, options) => {
    let pool: DatabasePool;
    
    // Server modifications - server becomes Server & DatabaseServerMods
    server.queryRaw = (sql: string) => pool.query(sql);
    server.closeConnections = () => pool.close();
    
    // Context modifications via middleware
    const dbMiddleware = createMiddleware({
      name: 'database-context',
      handler: async (ctx, next) => {
        // Direct context property (not ctx.state)
        ctx.db = {
          query: (sql) => pool.query(sql),
          transaction: (fn) => pool.transaction(fn)
        };
        await next();
      }
    });
    
    server.use(dbMiddleware);
    
    return {
      initialize: async () => {
        console.log('Connecting to database...');
        pool = await createPool(options.connectionString);
      },
      terminate: async () => {
        console.log('Closing database connections...');
        await pool.close();
      }
    };
  },
  { 
    connectionString: 'postgresql://localhost:5432/myapp',
    poolSize: 10 
  }
);
```

### 📈 Multi-Middleware Monitoring Plugin

```typescript
import { compose, createPlugin, createMiddleware } from 'blaizejs';

interface MonitoringConfig {
  metricsEnabled: boolean;
  tracingEnabled: boolean;
}

interface MonitoringContextMods {
  metrics: {
    record: (event: string, value: number) => void;
  };
  trace: {
    span: (name: string) => { end: () => void };
  };
}

const monitoringPlugin = createPlugin<MonitoringConfig, {}, MonitoringContextMods>(
  'monitoring',
  '1.0.0',
  (server, options) => {
    const metricsService = new MetricsService();
    const tracingService = new TracingService();
    
    // Create multiple middleware and compose them
    const metricsMiddleware = createMiddleware({
      name: 'metrics',
      handler: async (ctx, next) => {
        const start = Date.now();
        await next();
        if (options.metricsEnabled) {
          metricsService.record('request_duration', Date.now() - start);
        }
      }
    });
    
    const tracingMiddleware = createMiddleware({
      name: 'tracing', 
      handler: async (ctx, next) => {
        let span;
        if (options.tracingEnabled) {
          span = tracingService.startSpan(ctx.request.path);
        }
        try {
          await next();
        } finally {
          span?.end();
        }
      }
    });
    
    const contextMiddleware = createMiddleware({
      name: 'monitoring-context',
      handler: async (ctx, next) => {
        // Direct context modifications
        ctx.metrics = {
          record: (event, value) => metricsService.record(event, value)
        };
        ctx.trace = {
          span: (name) => tracingService.startSpan(name)
        };
        await next();
      }
    });
    
    // Compose all monitoring middleware into one unit
    // This counts as 1 middleware instead of 3 for type tracking
    const monitoringGroup = compose([
      metricsMiddleware,
      tracingMiddleware,
      contextMiddleware
    ]);
    
    server.use(monitoringGroup);
    
    return {
      initialize: async () => {
        if (options.metricsEnabled) {
          await metricsService.start();
        }
        if (options.tracingEnabled) {
          await tracingService.start();
        }
        console.log('Monitoring plugin initialized');
      },
      terminate: async () => {
        await metricsService.stop();
        await tracingService.stop();
      }
    };
  },
  { 
    metricsEnabled: true, 
    tracingEnabled: false 
  }
);
```

### Using Multi-Plugin Server

```typescript
const server = createServer({
  port: 3000,
  plugins: [
    databasePlugin(),
    authPlugin({ secret: process.env.JWT_SECRET }),
    monitoringPlugin({ tracingEnabled: true })
  ]
});

// TypeScript knows about server modifications (Server & DatabaseServerMods & AuthServerMods)
await server.queryRaw('SELECT * FROM users');     // From database plugin
const token = await server.generateToken(user);   // From auth plugin  
await server.closeConnections();                  // From database plugin

// Context modifications available in route handlers
server.get('/api/users', async (ctx) => {
  // Direct context properties (not ctx.state)
  // ctx.db available from database plugin
  // ctx.user, ctx.authenticated available from auth plugin  
  // ctx.metrics, ctx.trace available from monitoring plugin
  
  const users = await ctx.db.query('SELECT * FROM users');
  ctx.metrics.record('users_fetched', users.length);
  
  return { users, authenticated: ctx.authenticated };
});
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
[Plugin Registration] - Setup functions run, server modified
      ↓
[Plugin Initialization] - initialize() hooks (forward order)
      ↓
[Server Start] - onServerStart() hooks (forward order)
      ↓
    Running
      ↓
[Server Stop] - onServerStop() hooks (forward order)
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
        await queue?.pause();
        
        // Wait for in-flight operations
        await queue?.waitForEmpty();
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

### Plugin Error Management

The plugin system handles errors gracefully during lifecycle phases:

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
    // Validate options during setup
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

### Testing Plugin Integration

```typescript
describe('Plugin Integration', () => {
  test('should make services available to routes', async () => {
    const servicePlugin = createPlugin(
      'service',
      '1.0.0',
      (server, options) => {
        // Add middleware that provides service in context
        const serviceMiddleware = createMiddleware({
          name: 'service-context',
          handler: async (ctx, next) => {
            ctx.testService = {
              getValue: () => options.value
            };
            await next();
          }
        });
        
        server.use(serviceMiddleware);
      },
      { value: 'test-value' }
    );
    
    const server = createServer({
      port: 0,
      plugins: [servicePlugin()]
    });
    
    server.get('/test', async (ctx) => {
      return { value: ctx.testService.getValue() };
    });
    
    // Test the endpoint would work (in actual test, use server testing utils)
    // expect response to contain { value: 'test-value' }
  });
});
```

## 📚 Type Reference

### Core Types

```typescript
// From blaizejs (re-exported from @blaizejs/types)

/**
 * Plugin interface with type parameters for enhanced type safety
 */
export interface Plugin<TServerMods = unknown, TContextMods = unknown> extends PluginHooks {
  name: string;
  version: string;
  _types?: PluginTypeManifest<TServerMods, TContextMods>;
}

/**
 * Plugin lifecycle hooks
 */
export interface PluginHooks {
  register: (server: Server) => void | Promise<void>;
  initialize?: (server?: Server) => void | Promise<void>;
  onServerStart?: (server: Server) => void | Promise<void>;
  onServerStop?: (server: Server) => void | Promise<void>;
  terminate?: (server?: Server) => void | Promise<void>;
}

/**
 * Plugin factory function with type parameters
 */
export type PluginFactory<T = any, TServerMods = unknown, TContextMods = unknown> = (
  options?: T
) => Plugin<TServerMods, TContextMods>;

/**
 * Plugin setup function signature
 */
export type PluginSetup<T = any, TServerMods = unknown> = (
  app: Server & TServerMods, // Server is extended with plugin modifications
  options: T
) => void | Partial<PluginHooks> | Promise<void> | Promise<Partial<PluginHooks>>;
```

### Server Type Extension

When plugins are registered, the server becomes typed with all plugin modifications:

```typescript
// Before plugin registration
const server: Server = createServer({ port: 3000 });

// After plugin registration
const server: Server & DatabaseServerMods & AuthServerMods = createServer({
  port: 3000,
  plugins: [
    databasePlugin(),  // Adds DatabaseServerMods
    authPlugin()       // Adds AuthServerMods
  ]
});

// TypeScript now knows about plugin methods
await server.queryRaw('SELECT * FROM users');  // From DatabaseServerMods
const token = server.generateToken(user);       // From AuthServerMods
```

## 📊 Performance & Type Tracking Limits

### 🚨 Plugin Middleware Registration Limits

BlaizeJS tracks middleware registration per plugin and warns about performance impacts:

```typescript
// ❌ AVOID - Too many individual middleware registrations
const heavyPlugin = createPlugin(
  'heavy-plugin',
  '1.0.0',
  (server, options) => {
    server.use(middleware1);
    server.use(middleware2);
    server.use(middleware3);
    // ... 12 individual middleware
    // Development warning: "Plugin 'heavy-plugin' has registered 12 middleware. Consider using compose()..."
  }
);

// ✅ GOOD - Use compose for multiple middleware
const optimizedPlugin = createPlugin(
  'optimized-plugin', 
  '1.0.0',
  (server, options) => {
    const middlewareGroup = compose([
      middleware1,
      middleware2,
      middleware3,
      // ... up to 10 middleware with full type tracking
    ]);
    
    server.use(middlewareGroup); // Counts as 1 middleware registration
  }
);

// ✅ PERFECT - Hierarchical composition for 10+ middleware
const complexPlugin = createPlugin(
  'complex-plugin',
  '1.0.0', 
  (server, options) => {
    const authGroup = compose([auth1, auth2, auth3]);        // 3 middleware
    const dataGroup = compose([data1, data2, data3, data4]); // 4 middleware  
    const logGroup = compose([log1, log2, log3]);            // 3 middleware
    
    const allMiddleware = compose([authGroup, dataGroup, logGroup]); // 3 groups
    server.use(allMiddleware); // Perfect type safety for all 10 middleware
  }
);
```

### ⚠️ 10-Plugin Type Tracking Limit

TypeScript type composition degrades after 10 plugins per server:

```typescript
// ✅ GOOD - Full type tracking (under 10 plugins)
const server = createServer({
  plugins: [
    plugin1(), plugin2(), plugin3(), plugin4(), plugin5(),
    plugin6(), plugin7(), plugin8(), plugin9()
  ] // All 9 plugin types tracked
});

// ⚠️ CAUTION - Type tracking degrades after 10
const overloadedServer = createServer({
  plugins: [
    plugin1(), plugin2(), plugin3(), plugin4(), plugin5(),
    plugin6(), plugin7(), plugin8(), plugin9(), plugin10(),
    plugin11(), plugin12() // Types fall back to base after 10th plugin
  ]
});
// Development warning: "12 plugins registered. Type tracking degrades after 10."
```

### 🎯 Best Practices for Large Applications

```typescript
// ✅ RECOMMENDED - Plugin composition for large apps
const corePlugins = [
  databasePlugin(),
  authPlugin(), 
  loggingPlugin()
];

const featurePlugins = [
  cachePlugin(),
  metricsPlugin(),
  searchPlugin()
];

const server = createServer({
  plugins: [
    ...corePlugins,    // 3 plugins
    ...featurePlugins  // 3 plugins = 6 total
  ] // Full type safety maintained
});

// Alternative: Plugin groups (future feature)
const pluginGroup = createPluginGroup([
  plugin1, plugin2, plugin3, plugin4, plugin5
]); // Counts as 1 plugin for type tracking
```

## 🎯 Best Practices

### 📏 When to Use Compose vs Individual Registration

```typescript
// ✅ Individual registration - Simple plugins with 1-2 middleware
const simplePlugin = createPlugin('simple', '1.0.0', (server, options) => {
  server.use(loggingMiddleware);
  server.use(corsMiddleware);
}); 

// ✅ Compose - Plugins with 3+ related middleware  
const complexPlugin = createPlugin('complex', '1.0.0', (server, options) => {
  const middlewareStack = compose([
    authMiddleware,
    validationMiddleware, 
    auditMiddleware,
    cacheMiddleware
  ]);
  
  server.use(middlewareStack); // Better performance and type tracking
});

// ✅ Hierarchical compose - Plugins with 10+ middleware
const enterprisePlugin = createPlugin('enterprise', '1.0.0', (server, options) => {
  const securityGroup = compose([auth, session, csrf, rate]);
  const dataGroup = compose([db, cache, validation, transform]);
  const observabilityGroup = compose([logs, metrics, trace]);
  
  const allMiddleware = compose([securityGroup, dataGroup, observabilityGroup]);
  server.use(allMiddleware); // Perfect type safety for 12 middleware
});
```

### 🔀 Context vs State Modifications

**Context modifications** add properties directly to the context object, while **state modifications** use the middleware state system. Choose based on your use case:

```typescript
// ✅ Context modifications - Direct properties for services/utilities
interface DatabaseContextMods {
  db: Database;
  logger: Logger;
}

const contextPlugin = createPlugin<Config, {}, DatabaseContextMods>('context', '1.0.0', (server) => {
  server.use(createMiddleware({
    handler: async (ctx, next) => {
      ctx.db = database;      // ✅ Direct context property - available as ctx.db
      ctx.logger = logger;    // ✅ Direct context property - available as ctx.logger
      await next();
    }
  }));
});

// Route usage:
server.get('/api/users', async (ctx) => {
  const users = await ctx.db.query('SELECT * FROM users'); // Direct access
  ctx.logger.info('Users fetched');
  return users;
});
```

```typescript
// ✅ State modifications - Use middleware state system for request-scoped data
interface RequestState extends State {
  requestId: string;
  startTime: number;
  metadata: Record<string, any>;
}

const statePlugin = createPlugin('state', '1.0.0', (server) => {
  server.use(createMiddleware<RequestState>({
    handler: async (ctx, next) => {
      ctx.state.requestId = generateId();     // ✅ State property - available as ctx.state.requestId
      ctx.state.startTime = Date.now();       // ✅ State property - available as ctx.state.startTime
      ctx.state.metadata = {};                // ✅ State property - available as ctx.state.metadata
      await next();
    }
  }));
});

// Route usage:
server.get('/api/data', async (ctx) => {
  const requestId = ctx.state.requestId;  // Access through ctx.state
  const duration = Date.now() - ctx.state.startTime;
  
  ctx.state.metadata.responseTime = duration;
  return { requestId, duration };
});
```

**When to use each:**
- **Context modifications** (`ctx.property`): Services, utilities, database connections, loggers
- **State modifications** (`ctx.state.property`): Request-scoped data, user info, temporary values

## 🗺️ Roadmap

### ✅ Current (v0.3.1) - Beta

- ✅ **Factory Function API** - Simple createPlugin with type safety
- ✅ **Lifecycle Hooks** - Full lifecycle management with async support
- ✅ **Server Integration** - Direct server modification capabilities
- ✅ **Middleware Integration** - Context modifications through middleware
- ✅ **Type Safety** - Full TypeScript support with server/context type tracking
- ✅ **Testing Utilities** - Mock helpers via @blaizejs/testing-utils

### 🎯 MVP/1.0 Release

- 🔄 **Enhanced Testing Utilities** - Comprehensive plugin testing helpers
- 🔄 **Plugin Validation** - Validate plugin configurations and dependencies
- 🔄 **Dependency Management** - Plugin dependencies and ordering
- 🔄 **Conflict Detection** - Detect conflicting plugins automatically
- 🔄 **Plugin Metadata** - Enhanced plugin information and discovery

### 🔮 Post-MVP (v1.1+)

- 🔄 **Plugin Error Classes** - Specialized error types for plugins
- 🔄 **Hot Reload** - Development mode plugin reloading
- 🔄 **Plugin Registry** - Community plugin discovery and management
- 🔄 **Plugin CLI** - Scaffolding and management tools
- 🔄 **Performance Monitoring** - Plugin performance metrics and optimization

### 🌟 Future Considerations

- 🔄 **Visual Plugin Manager** - Browser-based plugin management interface
- 🔄 **Plugin Analytics** - Usage and performance insights
- 🔄 **AI-Assisted Creation** - Generate plugins from descriptions
- 🔄 **Cross-Platform Support** - Deno and Bun compatibility

---

**Built with ❤️ by the BlaizeJS team**

_Plugins extend BlaizeJS with powerful, reusable functionality - from databases to monitoring, authentication to caching._