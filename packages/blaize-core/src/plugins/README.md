# 🧩 BlaizeJS Plugins Module

> **Extensible plugin system** for managing expensive resources, adding typed middleware, and dynamically loading routes in your BlaizeJS applications
>
> Build database connections, authentication providers, monitoring tools, and more with lifecycle management and full type safety

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
- [⚠️ Anti-Patterns](#️-anti-patterns)
- [🧪 Testing](#-testing)
- [📚 Type Reference](#-type-reference)
- [🗺️ Roadmap](#️-roadmap)

## 🌟 Features

### Why Use Plugins?

| Feature | Middleware | Plugins |
|---------|-----------|---------|
| **Lifecycle hooks** (initialize/terminate) | ❌ | ✅ |
| **One-time resource setup** | ❌ | ✅ |
| **Clean shutdown** | ❌ | ✅ |
| **Service singletons** | ❌ | ✅ |
| **Add routes dynamically** | ❌ | ✅ |
| **Load route directories** | ❌ | ✅ |
| **Add typed middleware** | ✅ | ✅ |
| **Per-request logic** | ✅ | ✅ (via middleware) |

**Key Message**: Plugins = Resource Lifecycle + Typed Middleware + Route Management

- 🏗️ **Resource Management** - Connect once, use everywhere pattern
- ♻️ **Lifecycle Hooks** - Initialize resources, clean shutdown
- 🎯 **Type-Safe Services** - Full TypeScript type flow through the system
- 🔗 **Middleware Integration** - Add typed middleware that routes can use
- 📂 **Dynamic Routes** - Add routes and load directories at runtime
- 🧩 **Composable** - Types flow through server → plugins → routes

## 📦 Installation

```bash
# Using pnpm (recommended)
pnpm add blaizejs

# Using npm
npm install blaizejs

# Using yarn
yarn add blaizejs
```

## 🚀 Quick Start

### The Closure Pattern - Connect Once, Use Everywhere

```typescript
import { createPlugin, createMiddleware } from 'blaizejs';
import type { Server } from 'blaizejs';

// ✅ CORRECT: Plugin manages lifecycle, middleware provides typed access
const databasePlugin = createPlugin(
  'database',
  '1.0.0',
  (server, options) => {
    let db: Database;  // Singleton via closure
    
    // Middleware provides typed access to the singleton
    server.use(createMiddleware<{}, { db: Database }>({
      name: 'database',
      handler: async (ctx, next) => {
        ctx.services.db = db;  // Reference, not create!
        await next();
      }
    }));
    
    return {
      initialize: async () => {
        db = await Database.connect(options);  // Connect ONCE
      },
      terminate: async () => {
        await db?.close();  // Clean shutdown
      }
    };
  }
);

// Routes automatically get types!
export const GET = createGetRoute({
  handler: async (ctx) => {
    // ctx.services.db is fully typed as Database!
    // This includes types from:
    // - Server middleware
    // - Plugin middleware (like this database)
    // - Route middleware
    const data = await ctx.services.db.query('SELECT * FROM users');
    return ctx.response.json(data);
  }
});
```

## 📖 Core Concepts

### 🎯 The Plugin Value Proposition

Plugins solve the **"expensive setup"** problem:
- **Setup once**: Connect to databases, initialize services
- **Access everywhere**: Routes get typed access via middleware
- **Clean shutdown**: Properly close connections on termination

### 🔍 How It Works

1. **Plugin Registration**: Setup function runs, adds middleware and routes
2. **Server Initialization**: `initialize()` hooks run, resources connect
3. **Request Handling**: Middleware provides typed access to resources
4. **Type Composition**: Routes see ALL types from server, plugin, and route middleware
5. **Server Shutdown**: `terminate()` hooks run in reverse order, cleanup happens

**Middleware Execution Order**: Server middleware (including plugin middleware) runs first, then route middleware, then the route handler. All types compose together!

### 🎨 Type Safety with the New System

```typescript
const typedPlugin = createPlugin(
  'typed-example',
  '1.0.0',
  (server, options) => {
    let cache: RedisCache;
    
    // Add TYPED middleware - routes will see these types!
    server.use(createMiddleware<
      { cacheKey?: string },      // State types
      { cache: RedisCache }        // Service types
    >({
      name: 'cache',
      handler: async (ctx, next) => {
        ctx.services.cache = cache;  // Type-safe!
        await next();
      }
    }));
    
    return {
      initialize: async () => {
        cache = await RedisCache.connect(options);
      },
      terminate: async () => {
        await cache.disconnect();
      }
    };
  }
);
```

## 🎯 Core APIs

### `createPlugin`

Creates a plugin factory function with lifecycle management.

```typescript
function createPlugin<T = any>(
  name: string,
  version: string,
  setup: (server: Server, options: T) => void | Partial<PluginHooks> | Promise<void> | Promise<Partial<PluginHooks>>,
  defaultOptions?: Partial<T>
): PluginFactory<T>
```

### Adding Routes in Plugins

```typescript
const apiPlugin = createPlugin(
  'api',
  '1.0.0',
  (server, options) => {
    // ✅ CORRECT: Use server.router.addRoute
    server.router.addRoute({
      path: '/api/status',
      GET: {
        handler: async (ctx) => {
          return ctx.response.json({ status: 'ok' });
        }
      }
    });
    
    // ✅ ALSO CORRECT: Load from directory
    return {
      initialize: async () => {
        await server.router.addRouteDirectory('./api-routes', { 
          prefix: '/api' 
        });
      }
    };
  }
);
```

## 💡 Common Patterns

### 🔐 Authentication Plugin

```typescript
const authPlugin = createPlugin(
  'auth',
  '1.0.0',
  (server, options) => {
    let authService: AuthService;
    
    // Add typed auth middleware
    server.use(createMiddleware<
      { user?: User },
      { auth: AuthService }
    >({
      name: 'auth',
      handler: async (ctx, next) => {
        ctx.services.auth = authService;
        
        const token = ctx.request.header('authorization');
        if (token) {
          ctx.state.user = await authService.verifyToken(token);
        }
        
        await next();
      }
    }));
    
    return {
      initialize: async () => {
        authService = new AuthService(options);
        await authService.initialize();
      },
      terminate: async () => {
        await authService.cleanup();
      }
    };
  }
);
```

### 📊 Database Plugin with Connection Pool

```typescript
const databasePlugin = createPlugin(
  'database',
  '2.0.0',
  (server, options) => {
    let pool: DatabasePool;
    
    // Provide typed database access
    server.use(createMiddleware<{}, { db: DatabasePool }>({
      name: 'database',
      handler: async (ctx, next) => {
        ctx.services.db = pool;
        await next();
      }
    }));
    
    return {
      initialize: async () => {
        console.log('Creating database pool...');
        pool = await createPool(options);
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
        console.log('Database pool closed');
      }
    };
  }
);
```

### 📈 Monitoring Plugin

```typescript
const monitoringPlugin = createPlugin(
  'monitoring',
  '1.0.0',
  (server, options) => {
    let metrics: MetricsCollector;
    
    // Add typed middleware
    server.use(createMiddleware<
      { requestStart: number },
      { metrics: MetricsCollector }
    >({
      name: 'metrics',
      handler: async (ctx, next) => {
        ctx.state.requestStart = Date.now();
        ctx.services.metrics = metrics;
        
        try {
          await next();
        } finally {
          const duration = Date.now() - ctx.state.requestStart;
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
    server.router.addRoute({
      path: '/metrics',
      GET: {
        handler: async (ctx) => {
          return ctx.response.text(await metrics.export());
        }
      }
    });
    
    return {
      initialize: async () => {
        metrics = new MetricsCollector(options);
        await metrics.start();
      },
      terminate: async () => {
        await metrics.stop();
      }
    };
  }
);
```

## ♻️ Lifecycle Management

### Execution Order

```typescript
// Initialization: Forward order (first to last)
plugin1.initialize() → plugin2.initialize() → plugin3.initialize()

// Server events: Forward order
plugin1.onServerStart() → plugin2.onServerStart() → plugin3.onServerStart()

// Termination: Reverse order (last to first)
plugin3.terminate() → plugin2.terminate() → plugin1.terminate()
```

### Complete Flow Pattern

Every plugin should follow this pattern:

1. **Declare resource variables in closure**
2. **Initialize resources in `initialize()` hook**
3. **Add typed middleware to provide access**
4. **Add routes if needed via `server.router.addRoute()`**
5. **Clean up in `terminate()` hook**

```typescript
const completePlugin = createPlugin(
  'complete-example',
  '1.0.0',
  (server, options) => {
    // 1. Declare resources in closure
    let service: MyService;
    let connection: Connection;
    
    // 3. Add typed middleware
    server.use(createMiddleware<
      { requestId: string },
      { service: MyService; connection: Connection }
    >({
      name: 'my-plugin',
      handler: async (ctx, next) => {
        ctx.state.requestId = generateId();
        ctx.services.service = service;
        ctx.services.connection = connection;
        await next();
      }
    }));
    
    // 4. Add routes
    server.router.addRoute({
      path: '/plugin/status',
      GET: {
        handler: async (ctx) => {
          return ctx.response.json({ 
            healthy: await ctx.services.service.healthCheck() 
          });
        }
      }
    });
    
    return {
      // 2. Initialize resources
      initialize: async () => {
        connection = await Connection.create(options.url);
        service = new MyService(connection);
        await service.start();
      },
      
      // 5. Clean up resources
      terminate: async () => {
        await service?.stop();
        await connection?.close();
      }
    };
  }
);
```

## ⚠️ Anti-Patterns

### ❌ BAD: Creating connections per request

```typescript
// ❌ WRONG: New connection every request!
server.use(createMiddleware({
  handler: async (ctx, next) => {
    ctx.services.db = await Database.connect();  // NEW CONNECTION EVERY TIME!
    await next();
    await ctx.services.db.close();  // Wasteful!
  }
}));

// ✅ CORRECT: Reference singleton from closure
let db: Database;
return {
  initialize: async () => {
    db = await Database.connect();  // Connect ONCE
  },
  // ... middleware references db
};
```

## 🧪 Testing

### Testing Plugin Creation

```typescript
import { describe, test, expect, vi } from 'vitest';
import { createPlugin, createMiddleware } from 'blaizejs';
import { createMockServer } from '@blaizejs/testing-utils';

describe('Plugin with Typed Middleware', () => {
  test('should provide typed services', async () => {
    const mockService = { getValue: () => 'test' };
    
    const plugin = createPlugin(
      'test-plugin',
      '1.0.0',
      (server) => {
        let service = mockService;
        
        server.use(createMiddleware<{}, { service: typeof mockService }>({
          handler: async (ctx, next) => {
            ctx.services.service = service;
            await next();
          }
        }));
        
        return {
          initialize: async () => {
            // Service is ready
          }
        };
      }
    );
    
    const server = createMockServer();
    const instance = plugin();
    
    await instance.register(server);
    await instance.initialize?.(server);
    
    // Verify middleware was added
    expect(server.use).toHaveBeenCalled();
  });

  test('should reuse singleton across requests', async () => {
    let connectionCount = 0;
    const mockConnect = vi.fn(() => {
      connectionCount++;
      return { id: connectionCount };
    });
    
    const plugin = createPlugin(
      'singleton-test',
      '1.0.0',
      (server) => {
        let db: any;
        
        server.use(createMiddleware<{}, { db: any }>({
          handler: async (ctx, next) => {
            ctx.services.db = db;  // Same instance every time
            await next();
          }
        }));
        
        return {
          initialize: async () => {
            db = mockConnect();  // Called only once
          }
        };
      }
    );
    
    const server = createMockServer();
    const instance = plugin();
    
    await instance.register(server);
    await instance.initialize?.(server);
    
    // Simulate multiple requests
    const middleware = server.use.mock.calls[0][0];
    const ctx1 = { services: {} };
    const ctx2 = { services: {} };
    
    await middleware.handler(ctx1, () => Promise.resolve());
    await middleware.handler(ctx2, () => Promise.resolve());
    
    // Verify the same instance is used, not recreated
    expect(mockConnect).toHaveBeenCalledTimes(1);
    expect(ctx1.services.db).toBe(ctx2.services.db);
    expect(ctx1.services.db.id).toBe(1);
  });
});
```

## 📚 Type Reference

### Core Types

```typescript
// Plugin lifecycle hooks
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

// Plugin factory function
export type PluginFactory<T = any> = (options?: T) => Plugin;

// Middleware types for plugins
export interface Middleware<TState = {}, TServices = {}> {
  name?: string;
  handler: MiddlewareHandler<TState, TServices>;
  skip?: (ctx: Context) => boolean;
}
```

## 🗺️ Roadmap

### ✅ Current (v0.3.x)
- Factory function API with lifecycle hooks
- Closure pattern for resource management
- Typed middleware integration
- Dynamic route addition
- Clean shutdown handling

### 🎯 MVP / v1.0
- Plugin dependency management
- Enhanced testing utilities
- Conflict detection
- Plugin validation exports

### 🔮 Future (v1.x+)
- Hot reload in development
- Plugin marketplace
- CLI scaffolding tools
- Performance monitoring
- Remote plugin loading

---

**Built with ❤️ by the BlaizeJS team**

_Plugins manage expensive resources with the "setup once, use everywhere" pattern - providing type-safe access through middleware and clean lifecycle management._