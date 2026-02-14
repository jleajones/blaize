# 🧩 BlaizeJS Plugins Module

> **Extensible plugin system** for managing expensive resources, adding typed middleware, and dynamically loading routes in your BlaizeJS applications with factory functions for safe service access
>
> Build database connections, authentication providers, monitoring tools, and more with lifecycle management, full type safety, and dual access patterns for routes and background jobs

[![npm version](https://badge.fury.io/js/blaizejs.svg)](https://badge.fury.io/js/blaizejs)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

## 📋 Table of Contents

- [🌟 Features](#-features)
- [📦 Installation](#-installation)
- [🚀 Quick Start](#-quick-start)
- [📖 Core Concepts](#-core-concepts)
- [🔑 Two Access Patterns](#-two-access-patterns)
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
| **Factory functions for external access** | ❌ | ✅ |
| **Add routes dynamically** | ❌ | ✅ |
| **Load route directories** | ❌ | ✅ |
| **Add typed middleware** | ✅ | ✅ |
| **Per-request logic** | ✅ | ✅ (via middleware) |

**Key Message**: Plugins = Resource Lifecycle + Typed Middleware + Route Management + Safe External Access

- 🏗️ **Resource Management** - Connect once, use everywhere pattern
- 🔑 **Dual Access** - `ctx.services` for routes, factory functions for jobs/utilities
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

### The Factory Pattern - Safe Access Everywhere

```typescript
import { createPlugin, createMiddleware } from 'blaizejs';
import type { Server } from 'blaizejs';

// 1️⃣ Internal singleton (private)
let _db: Database | null = null;

// 2️⃣ Factory function for external access (public)
/**
 * Get the database instance
 * Safe for use in job handlers, utilities, and worker processes
 */
export function getDatabase(): Database {
  if (!_db) {
    throw new Error(
      'Database not initialized. ' +
      'Make sure you have registered the database plugin.'
    );
  }
  return _db;
}

// 3️⃣ Optional initialization check
export function isDatabaseInitialized(): boolean {
  return _db !== null;
}

// 4️⃣ Plugin with lifecycle management
const databasePlugin = createPlugin<
  { connectionString: string },  // TConfig
  {},                            // TState (usually empty for plugins)
  { db: Database }               // TServices
>({
  name: 'database',
  version: '1.0.0',
  
  defaultConfig: {
    connectionString: 'postgresql://localhost/mydb',
  },
  
  setup: ({ config, logger, eventBus }) => {
    // Add typed middleware for route access
    return {
      register: async (server) => {
        server.use(createMiddleware<{}, { db: Database }>({
          name: 'database',
          handler: async ({ ctx, next }) => {
            ctx.services.db = getDatabase();  // Use factory
            await next();
          }
        }));
      },
      
      // Connect ONCE at startup (only place to assign _db)
      initialize: async () => {
        logger.info('Connecting to database');
        _db = await Database.connect(config.connectionString);
        await eventBus.publish('db:connected', { 
          host: config.connectionString 
        });
      },
      
      // Clean shutdown (only place to clear _db)
      terminate: async () => {
        const db = getDatabase();
        await db.close();
        _db = null;
        await eventBus.publish('db:disconnected', {});
      },
    };
  },
});

// ✅ Use in routes via ctx.services
export const GET = createGetRoute()({
  handler: async ({ ctx }) => {
    // ctx.services.db is fully typed!
    const data = await ctx.services.db.query('SELECT * FROM users');
    return data;
  }
});

// ✅ Use in job handlers via factory function
import { getDatabase } from './plugins/database';

export const cleanupHandler = createHandler(queues, 'maintenance', 'cleanup',
  async (data, ctx) => {
    const db = getDatabase();  // Safe external access
    await db.query('DELETE FROM old_sessions');
  }
);
```

## 📖 Core Concepts

### 🎯 The Plugin Value Proposition

Plugins solve the **"expensive setup"** problem with **two access patterns**:
- **Setup once**: Connect to databases, initialize services
- **Access in routes**: Via `ctx.services` (typed middleware)
- **Access in jobs/utilities**: Via factory functions (safe external access)
- **Clean shutdown**: Properly close connections on termination

### 🔍 How It Works

1. **Plugin Registration**: Setup function runs, returns lifecycle hooks
2. **Server Initialization**: `initialize()` hooks run, resources connect
3. **Request Handling**: Middleware provides typed access to resources via `ctx.services`
4. **External Access**: Factory functions provide safe access outside routes
5. **Type Composition**: Routes see ALL types from server, plugin, and route middleware
6. **Server Shutdown**: `terminate()` hooks run in reverse order, cleanup happens

**Middleware Execution Order**: Server middleware (including plugin middleware) runs first, then route middleware, then the route handler. All types compose together!

## 🔑 Two Access Patterns

BlaizeJS plugins provide **two ways** to access services, each optimized for different contexts:

| Context | Access Method | Example |
|---------|---------------|---------|
| **Route handlers** | `ctx.services.db` | `await ctx.services.db.query(...)` |
| **Job handlers** | `getDatabase()` | `const db = getDatabase()` |
| **Utility functions** | `getDatabase()` | `const db = getDatabase()` |
| **Worker processes** | `getDatabase()` | `const db = getDatabase()` |
| **Plugin internals** | `getDatabase()` | Use for consistency |

### Why Two Patterns?

- **Route handlers** receive context via middleware → use `ctx.services`
- **Everything else** doesn't have context → use factory functions

### Factory Function Benefits

1. ✅ **Clear error messages** — "Database not initialized..." instead of "Cannot read property of null"
2. ✅ **Explicit intent** — `getDatabase()` shows you're retrieving a service
3. ✅ **Easy testing** — Mock the factory function, not the instance
4. ✅ **Safety checks** — Factory verifies initialization state
5. ✅ **Consistency** — Same pattern across all plugins

### Naming Conventions

Follow these patterns for consistency:

| Service Type | Factory Function | Check Function | Private Variable |
|--------------|------------------|----------------|------------------|
| `Database` | `getDatabase()` | `isDatabaseInitialized()` | `_db` |
| `RedisCache` | `getRedisCache()` | `isRedisCacheInitialized()` | `_cache` |
| `AuthService` | `getAuthService()` | `isAuthServiceInitialized()` | `_authService` |

**Pattern:** `get[ServiceName]()` where ServiceName is PascalCase

## 🎯 Core APIs

### `createPlugin`

Creates a plugin with lifecycle management and type safety.

```typescript
function createPlugin<
  TConfig = {},      // Plugin configuration type
  TState = {},       // State additions (usually empty for plugins)
  TServices = {},    // Service additions
>(
  options: CreatePluginOptions<TConfig, TState, TServices>
): PluginFactory<TConfig, TState, TServices>
```

**CreatePluginOptions:**

```typescript
interface CreatePluginOptions<TConfig, TState, TServices> {
  name: string;                    // Plugin identifier (e.g., '@blaizejs/cache')
  version: string;                 // Semantic version (e.g., '1.0.0')
  defaultConfig?: TConfig;         // Default configuration values
  setup: (context: PluginSetupContext<TConfig>) => Partial<PluginHooks<TState, TServices>>;
}
```

**PluginSetupContext (NEW - object parameter, not positional):**

```typescript
interface PluginSetupContext<TConfig> {
  config: TConfig;                 // Merged config (defaultConfig + userConfig)
  logger: BlaizeLogger;            // Plugin-scoped logger
  eventBus: TypedEventBus;         // Typed event bus
}
```

**⚠️ CRITICAL CHANGE**: The setup function receives a **single object parameter**, not three positional parameters!

```typescript
// ✅ CORRECT (Current API)
setup: ({ config, logger, eventBus }) => {
  // Destructure the context object
  logger.info('Setting up plugin', { config });
  return { /* hooks */ };
}

// ❌ WRONG (Old API - don't use)
setup: (server, config, logger) => {
  // This signature is outdated!
}
```

### PluginHooks

```typescript
interface PluginHooks<TState, TServices> {
  register?: (server: Server<TState, TServices>) => void | Promise<void>;
  initialize?: (server: Server<TState, TServices>) => void | Promise<void>;
  onServerStart?: (server: Http2Server | HttpServer) => void | Promise<void>;
  onServerStop?: (server: Http2Server | HttpServer) => void | Promise<void>;
  terminate?: (server: Server<TState, TServices>) => void | Promise<void>;
}
```

All hooks are optional. The `register` hook is automatically created if not provided.

## 💡 Common Patterns

### 🔐 Authentication Plugin with Factory Functions

```typescript
// Internal singleton (private)
let _authService: AuthService | null = null;

// Factory function (public)
export function getAuthService(): AuthService {
  if (!_authService) {
    throw new Error('Auth service not initialized.');
  }
  return _authService;
}

export function isAuthServiceInitialized(): boolean {
  return _authService !== null;
}

const authPlugin = createPlugin<
  { secretKey: string },
  { user?: User },
  { auth: AuthService }
>({
  name: 'auth',
  version: '1.0.0',
  
  defaultConfig: {
    secretKey: process.env.JWT_SECRET || '',
  },
  
  setup: ({ config, logger, eventBus }) => {
    return {
      register: async (server) => {
        // Add typed auth middleware for routes
        server.use(createMiddleware<
          { user?: User },
          { auth: AuthService }
        >({
          name: 'auth',
          handler: async ({ ctx, next }) => {
            ctx.services.auth = getAuthService();  // Use factory
            
            const token = ctx.request.headers.get('authorization');
            if (token) {
              ctx.state.user = await ctx.services.auth.verifyToken(token);
            }
            
            await next();
          }
        }));
      },
      
      initialize: async () => {
        logger.info('Initializing auth service');
        _authService = new AuthService(config);
        await _authService.initialize();
      },
      
      terminate: async () => {
        const auth = getAuthService();
        await auth.cleanup();
        _authService = null;
      },
    };
  },
});

// ✅ Use in routes
export const GET = createGetRoute()({
  handler: async ({ ctx }) => {
    const user = ctx.state.user;  // From middleware
    return { user };
  }
});

// ✅ Use in background jobs
import { getAuthService } from './plugins/auth';

export const verifyTokensJob = createHandler(queues, 'auth', 'verify-tokens',
  async (data, ctx) => {
    const auth = getAuthService();  // Factory function
    await auth.verifyAllTokens();
  }
);
```

### 📊 Database Plugin with Connection Pool

```typescript
// Internal singleton (private)
let _pool: DatabasePool | null = null;

// Factory function (public)
export function getDatabasePool(): DatabasePool {
  if (!_pool) {
    throw new Error('Database pool not initialized.');
  }
  return _pool;
}

const databasePlugin = createPlugin<
  { connectionString: string; poolSize?: number },
  {},
  { db: DatabasePool }
>({
  name: 'database',
  version: '2.0.0',
  
  defaultConfig: {
    connectionString: 'postgresql://localhost/mydb',
    poolSize: 10,
  },
  
  setup: ({ config, logger, eventBus }) => {
    return {
      register: async (server) => {
        // Provide typed database access to routes
        server.use(createMiddleware<{}, { db: DatabasePool }>({
          name: 'database',
          handler: async ({ ctx, next }) => {
            ctx.services.db = getDatabasePool();  // Use factory
            await next();
          }
        }));
      },
      
      initialize: async () => {
        logger.info('Creating database pool');
        _pool = await createPool(config);  // Only place to assign
        await eventBus.publish('db:initialized', {});
      },
      
      onServerStart: async () => {
        const pool = getDatabasePool();
        await pool.query('SELECT 1');
        logger.info('Database connection verified');
      },
      
      onServerStop: async () => {
        const pool = getDatabasePool();
        logger.info('Draining database connections');
        await pool.drain();
      },
      
      terminate: async () => {
        const pool = getDatabasePool();
        await pool.close();
        _pool = null;  // Only place to clear
        logger.info('Database pool closed');
      },
    };
  },
});

// ✅ Use in routes (destructured object parameter)
export const GET = createGetRoute()({
  handler: async ({ ctx }) => {
    const users = await ctx.services.db.query('SELECT * FROM users');
    return users;
  }
});

// ✅ Use in utilities
import { getDatabasePool } from './plugins/database';

export async function getUserStats(userId: number) {
  const pool = getDatabasePool();  // Factory function
  const stats = await pool.query(
    'SELECT COUNT(*) FROM user_actions WHERE user_id = ?', 
    [userId]
  );
  return stats;
}
```

### 📈 Monitoring Plugin

```typescript
// Internal singleton (private)
let _metrics: MetricsCollector | null = null;

// Factory function (public)
export function getMetricsCollector(): MetricsCollector {
  if (!_metrics) {
    throw new Error('Metrics collector not initialized.');
  }
  return _metrics;
}

const monitoringPlugin = createPlugin<
  { interval?: number },
  { requestStart: number },
  { metrics: MetricsCollector }
>({
  name: 'monitoring',
  version: '1.0.0',
  
  defaultConfig: {
    interval: 60000,
  },
  
  setup: ({ config, logger, eventBus }) => {
    return {
      register: async (server) => {
        // Add typed middleware
        server.use(createMiddleware<
          { requestStart: number },
          { metrics: MetricsCollector }
        >({
          name: 'metrics',
          handler: async ({ ctx, next }) => {
            ctx.state.requestStart = Date.now();
            ctx.services.metrics = getMetricsCollector();  // Use factory
            
            try {
              await next();
            } finally {
              const duration = Date.now() - ctx.state.requestStart;
              ctx.services.metrics.record({
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
            handler: async ({ ctx }) => {
              const metrics = getMetricsCollector();
              const data = await metrics.export();
              return ctx.response.text(data);
            }
          }
        });
      },
      
      initialize: async () => {
        _metrics = new MetricsCollector(config);
        await _metrics.start();
      },
      
      terminate: async () => {
        const metrics = getMetricsCollector();
        await metrics.stop();
        _metrics = null;
      },
    };
  },
});
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

1. **Declare internal singleton** (private, null initially)
2. **Export factory function** for safe external access
3. **Initialize resources in `initialize()` hook** (only place to assign)
4. **Add typed middleware in `register()` hook** to provide `ctx.services` access
5. **Add routes if needed via `server.router.addRoute()`**
6. **Clean up in `terminate()` hook** (only place to clear)

```typescript
// 1. Internal singleton (private)
let _service: MyService | null = null;
let _connection: Connection | null = null;

// 2. Factory function (public)
export function getMyService(): MyService {
  if (!_service) {
    throw new Error('MyService not initialized.');
  }
  return _service;
}

export function getConnection(): Connection {
  if (!_connection) {
    throw new Error('Connection not initialized.');
  }
  return _connection;
}

const completePlugin = createPlugin<
  { url: string },
  { requestId: string },
  { service: MyService; connection: Connection }
>({
  name: 'complete-example',
  version: '1.0.0',
  
  setup: ({ config, logger, eventBus }) => {
    return {
      // 4. Add typed middleware (MUST be in register hook)
      register: async (server) => {
        server.use(createMiddleware<
          { requestId: string },
          { service: MyService; connection: Connection }
        >({
          name: 'my-plugin',
          handler: async ({ ctx, next }) => {
            ctx.state.requestId = generateId();
            ctx.services.service = getMyService();  // Use factory
            ctx.services.connection = getConnection();  // Use factory
            await next();
          }
        }));
        
        // 5. Add routes
        server.router.addRoute({
          path: '/plugin/status',
          GET: {
            handler: async ({ ctx }) => {
              return { 
                healthy: await ctx.services.service.healthCheck() 
              };
            }
          }
        });
      },
      
      // 3. Initialize resources (only place to assign)
      initialize: async () => {
        logger.info('Initializing plugin');
        _connection = await Connection.create(config.url);
        _service = new MyService(_connection);
        await _service.start();
        await eventBus.publish('plugin:ready', {});
      },
      
      // 6. Clean up resources (only place to clear)
      terminate: async () => {
        const service = getMyService();
        const connection = getConnection();
        
        await service.stop();
        await connection.close();
        
        _service = null;
        _connection = null;
        
        await eventBus.publish('plugin:stopped', {});
      },
    };
  },
});
```

## ⚠️ Anti-Patterns

### ❌ BAD: Creating connections per request

```typescript
// ❌ WRONG: New connection every request!
server.use(createMiddleware({
  handler: async ({ ctx, next }) => {
    ctx.services.db = await Database.connect();  // NEW CONNECTION EVERY TIME!
    await next();
    await ctx.services.db.close();  // Wasteful!
  }
}));

// ✅ CORRECT: Factory function + singleton
let _db: Database | null = null;

export function getDatabase(): Database {
  if (!_db) throw new Error('Database not initialized');
  return _db;
}

return {
  initialize: async () => {
    _db = await Database.connect();  // Connect ONCE
  },
  // ... middleware uses getDatabase()
};
```

### ❌ BAD: Direct access to internal singleton

```typescript
// ❌ WRONG: Accessing internal variable directly
import { _db } from './plugins/database';  // Don't do this!

export const handler = async (data) => {
  await _db.query(...);  // Might be null!
};

// ✅ CORRECT: Use factory function
import { getDatabase } from './plugins/database';

export const handler = async (data) => {
  const db = getDatabase();  // Safe, throws clear error if not initialized
  await db.query(...);
};
```

### ❌ BAD: No cleanup

```typescript
// ❌ WRONG: No cleanup in terminate
return {
  initialize: async () => {
    _service = new Service();
  }
  // Missing terminate! Resource leak!
};

// ✅ CORRECT: Always clean up
return {
  initialize: async () => {
    _service = new Service();
  },
  terminate: async () => {
    const service = getService();
    await service.cleanup();
    _service = null;  // Clear singleton
  }
};
```

### ❌ BAD: Using old positional parameter setup

```typescript
// ❌ WRONG: Old API signature
setup: (server, config, logger) => {
  // This signature is outdated!
  return { /* hooks */ };
}

// ✅ CORRECT: Object parameter
setup: ({ config, logger, eventBus }) => {
  // Destructure the context object
  return { /* hooks */ };
}
```

## 🧪 Testing

### Testing Factory Functions

```typescript
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  getDatabase, 
  isDatabaseInitialized,
  createDatabasePlugin 
} from './database-plugin';

describe('Database Plugin Factory Functions', () => {
  afterEach(() => {
    // Reset state between tests
    if (isDatabaseInitialized()) {
      // Cleanup if needed
    }
  });

  test('should throw before initialization', () => {
    expect(() => getDatabase()).toThrow('Database not initialized');
    expect(isDatabaseInitialized()).toBe(false);
  });

  test('should return database after initialization', async () => {
    const plugin = createDatabasePlugin();
    const server = createMockServer();
    const instance = plugin();
    
    await instance.register(server);
    await instance.initialize?.(server);
    
    expect(() => getDatabase()).not.toThrow();
    expect(isDatabaseInitialized()).toBe(true);
    
    const db = getDatabase();
    expect(db).toBeDefined();
  });

  test('should throw after cleanup', async () => {
    const plugin = createDatabasePlugin();
    const server = createMockServer();
    const instance = plugin();
    
    await instance.register(server);
    await instance.initialize?.(server);
    
    const db = getDatabase();
    expect(db).toBeDefined();
    
    await instance.terminate?.(server);
    
    expect(() => getDatabase()).toThrow('Database not initialized');
    expect(isDatabaseInitialized()).toBe(false);
  });
});
```

### Mocking Factory Functions in Route Tests

```typescript
import { vi } from 'vitest';

// Mock the factory function
vi.mock('./plugins/database', () => ({
  getDatabase: vi.fn(() => mockDb),
  isDatabaseInitialized: vi.fn(() => true),
}));

const mockDb = {
  query: vi.fn().mockResolvedValue([{ id: 1, name: 'Test' }]),
};

describe('GET /users', () => {
  test('should fetch users', async () => {
    const response = await request(app).get('/users');

    expect(mockDb.query).toHaveBeenCalledWith('SELECT * FROM users');
    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ id: 1, name: 'Test' }]);
  });
});
```

### Testing Plugin Setup Context

```typescript
describe('Plugin with Setup Context', () => {
  test('should receive config, logger, and eventBus', () => {
    const mockConfig = { host: 'localhost', port: 5432 };
    const mockLogger = createMockLogger();
    const mockEventBus = createMockEventBus();
    
    const plugin = createPlugin({
      name: 'test-plugin',
      version: '1.0.0',
      setup: ({ config, logger, eventBus }) => {
        // Verify all three are present
        expect(config).toEqual(mockConfig);
        expect(logger).toBeDefined();
        expect(eventBus).toBeDefined();
        
        return {
          initialize: async () => {
            logger.info('Initialized with config', { config });
            await eventBus.publish('plugin:ready', {});
          }
        };
      }
    });
    
    const instance = plugin(mockConfig);
    expect(instance.name).toBe('test-plugin');
  });
});
```

## 📚 Type Reference

### Core Types

```typescript
// Plugin lifecycle hooks
export interface PluginHooks<TState, TServices> {
  // Called when plugin is registered (optional)
  register?: (server: Server<TState, TServices>) => void | Promise<void>;
  
  // Called during server initialization (optional)
  initialize?: (server: Server<TState, TServices>) => void | Promise<void>;
  
  // Called when server starts (optional)
  onServerStart?: (server: Http2Server | HttpServer) => void | Promise<void>;
  
  // Called when server stops (optional)
  onServerStop?: (server: Http2Server | HttpServer) => void | Promise<void>;
  
  // Called during server termination (optional)
  terminate?: (server: Server<TState, TServices>) => void | Promise<void>;
}

// Plugin setup context (object parameter)
export interface PluginSetupContext<TConfig> {
  config: TConfig;              // Merged configuration
  logger: BlaizeLogger;         // Plugin-scoped logger
  eventBus: TypedEventBus;      // Typed event bus
}

// Plugin factory function
export type PluginFactory<TConfig, TState, TServices> = 
  (userConfig?: Partial<TConfig>) => Plugin<TState, TServices>;

// Plugin instance
export interface Plugin<TState, TServices> {
  name: string;
  version: string;
  register: (server: Server<TState, TServices>) => void | Promise<void>;
  initialize?: (server: Server<TState, TServices>) => void | Promise<void>;
  onServerStart?: (server: Http2Server | HttpServer) => void | Promise<void>;
  onServerStop?: (server: Http2Server | HttpServer) => void | Promise<void>;
  terminate?: (server: Server<TState, TServices>) => void | Promise<void>;
}
```

## 🗺️ Roadmap

### ✅ Current (v0.7.x)
- Object-based setup context (config, logger, eventBus)
- Dual access pattern (ctx.services + factory functions)
- Safe external access for jobs/utilities
- Typed middleware integration
- Dynamic route addition
- Clean shutdown handling
- EventBus integration

### 🎯 MVP / v1.0
- Plugin dependency management
- Enhanced testing utilities
- Conflict detection
- Plugin validation exports
- Factory function best practices documentation

### 🔮 Future (v1.x+)
- Hot reload in development
- Plugin marketplace
- CLI scaffolding tools
- Performance monitoring
- Remote plugin loading
- Plugin composition utilities

---

## 🔗 Related Documentation

- [Plugin Guide](../docs/guides/plugins.md) — Comprehensive plugin documentation
- [Database Integration](../docs/guides/database-integration.md) — Database plugin examples with factory functions
- [Type System](../docs/architecture/type-system.md) — How types flow through plugins
- [Testing Guide](../docs/guides/testing.md) — Testing plugins and factory functions

---

**Built with ❤️ by the BlaizeJS team**

_Plugins manage expensive resources with the "setup once, use everywhere" pattern - providing type-safe access through middleware for routes and factory functions for jobs/utilities, with clean lifecycle management._