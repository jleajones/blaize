# 🧩 BlaizeJS Plugins Module

> A comprehensive plugin system for extending BlaizeJS framework functionality with lifecycle management, validation, and seamless integration

[![npm version](https://badge.fury.io/js/blaizejs.svg)](https://badge.fury.io/js/blaizejs)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

## 📋 Table of Contents

- [🌟 Features](#-features)
- [📦 Installation](#-installation)
- [🚀 Quick Start](#-quick-start)
- [🏗️ Creating Plugins](#️-creating-plugins)
- [🔗 Plugin Integration](#-plugin-integration)
- [♻️ Lifecycle Management](#️-lifecycle-management)
- [🔍 Route Management](#-route-management)
- [✅ Validation & Options](#-validation--options)
- [🛡️ Error Handling](#️-error-handling)
- [🧪 Testing](#-testing)
- [🤝 Contributing](#-contributing)
- [🗺️ Roadmap](#️-roadmap)

## 🌟 Features

- 🏗️ **Simple plugin creation** with factory functions and default options
- ♻️ **Complete lifecycle management** with hooks for all server phases
- 🔗 **File-based route integration** for isolated plugin routing
- ✅ **Comprehensive validation** with configurable rules and schemas
- 🛡️ **Specialized error handling** with detailed error types and context
- 🔥 **Hot reloading support** in development mode
- 🎯 **Type-safe plugin options** with TypeScript support
- 📊 **Route conflict detection** to prevent plugin interference
- 🚀 **High performance** with minimal overhead
- 🧩 **Composable architecture** for building complex plugin ecosystems

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

### Basic Plugin Usage

```typescript
import { createServer, createPlugin } from 'blaizejs';

// Create a simple plugin
const loggingPlugin = createPlugin('logger', '1.0.0', (server, options) => {
  console.log(`Logger plugin initialized with level: ${options.level}`);
  
  // Add middleware to server
  server.use(createMiddleware({
    name: 'request-logger',
    handler: async (ctx, next) => {
      console.log(`${ctx.request.method} ${ctx.request.path}`);
      await next();
    }
  }));
}, { level: 'info' }); // Default options

// Create server with plugin
const server = createServer({
  routesDir: './routes',
  plugins: [
    loggingPlugin(), // Use default options
    loggingPlugin({ level: 'debug' }) // Override options
  ]
});

await server.listen();
```

### Plugin with Routes

```typescript
import { createPlugin } from 'blaizejs';
import path from 'path';

const apiPlugin = createPlugin('api-v1', '1.0.0', async (server, options) => {
  // Register plugin's route directory
  await server.router.addRouteDirectory(
    path.join(__dirname, 'routes'), 
    { prefix: '/api/v1' }
  );
  
  return {
    initialize: async () => {
      console.log('API v1 plugin routes registered');
    },
    
    terminate: async () => {
      console.log('API v1 plugin cleanup complete');
    }
  };
});

// Plugin directory structure:
// plugins/api-v1/
// ├── routes/
// │   ├── users.ts      → /api/v1/users
// │   ├── posts.ts      → /api/v1/posts
// │   └── auth/
// │       └── login.ts  → /api/v1/auth/login
```

## 🏗️ Creating Plugins

### Pattern 1: Simple Plugin Function

```typescript
import { createPlugin } from 'blaizejs';

// Basic plugin without lifecycle hooks
const corsPlugin = createPlugin('cors', '1.0.0', (server, options) => {
  const corsMiddleware = createMiddleware({
    name: 'cors',
    handler: async (ctx, next) => {
      ctx.response
        .header('Access-Control-Allow-Origin', options.origin)
        .header('Access-Control-Allow-Methods', options.methods.join(', '))
        .header('Access-Control-Allow-Headers', options.headers.join(', '));
      
      if (ctx.request.method === 'OPTIONS') {
        return ctx.response.status(204).text('');
      }
      
      await next();
    }
  });
  
  server.use(corsMiddleware);
}, {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  headers: ['Content-Type', 'Authorization']
});
```

### Pattern 2: Plugin with Lifecycle Hooks

```typescript
import { createPlugin } from 'blaizejs';

const databasePlugin = createPlugin('database', '2.0.0', async (server, options) => {
  let dbConnection: DatabaseConnection;
  
  return {
    // Called during server initialization
    initialize: async () => {
      console.log('Connecting to database...');
      dbConnection = await createConnection(options.connectionString);
      
      // Make connection available to routes
      server.context.setGlobal('db', dbConnection);
    },
    
    // Called when server starts listening
    onServerStart: async (httpServer) => {
      console.log('Database plugin ready');
      await dbConnection.healthCheck();
    },
    
    // Called when server stops
    onServerStop: async (httpServer) => {
      console.log('Preparing database for shutdown...');
      await dbConnection.gracefulClose();
    },
    
    // Called during server termination (cleanup phase)
    terminate: async () => {
      console.log('Database connection closed');
      dbConnection = null;
    }
  };
}, {
  connectionString: 'mongodb://localhost:27017/myapp',
  poolSize: 10,
  retryAttempts: 3
});
```

### Pattern 3: Advanced Plugin with Route Management

```typescript
import { createPlugin } from 'blaizejs';
import { z } from 'zod';

const adminPlugin = createPlugin('admin-panel', '1.0.0', async (server, options) => {
  // Authentication middleware for admin routes
  const adminAuth = createMiddleware({
    name: 'admin-auth',
    handler: async (ctx, next) => {
      const token = ctx.request.header('authorization');
      
      if (!token || !await validateAdminToken(token)) {
        return ctx.response.status(403).json({ error: 'Admin access required' });
      }
      
      await next();
    }
  });
  
  // Register admin routes with authentication
  await server.router.addRouteDirectory(
    path.join(__dirname, 'admin-routes'),
    { 
      prefix: '/admin',
      middleware: [adminAuth] // Applied to all admin routes
    }
  );
  
  // Add utility routes programmatically
  server.router.addRoute('GET', '/admin/status', {
    middleware: [adminAuth],
    handler: async (ctx) => ({
      status: 'operational',
      plugins: server.plugins.map(p => ({ name: p.name, version: p.version })),
      uptime: process.uptime()
    })
  });
  
  return {
    initialize: async () => {
      console.log(`Admin panel available at ${options.basePath}/admin`);
    }
  };
}, {
  basePath: '',
  theme: 'dark',
  features: ['user-management', 'system-monitoring']
});
```

## 🔗 Plugin Integration

### Registering Plugins with Server

```typescript
import { createServer, createPlugin } from 'blaizejs';

// Option 1: During server creation
const server = createServer({
  routesDir: './routes',
  plugins: [
    loggingPlugin(),
    databasePlugin({ connectionString: 'mongodb://prod:27017/app' }),
    adminPlugin({ theme: 'light' })
  ]
});

// Option 2: Runtime registration
await server.register(cachePlugin({ ttl: 3600 }));
await server.register(metricsPlugin());

await server.listen();
```

### Plugin Dependencies and Loading Order

```typescript
// Plugins are initialized in registration order
const server = createServer({
  plugins: [
    databasePlugin(),      // 1st: Database connection
    cachePlugin(),         // 2nd: Requires database
    authPlugin(),          // 3rd: Requires database and cache
    apiPlugin()            // 4th: Requires auth
  ]
});

// Termination happens in reverse order
// 1. apiPlugin.terminate()
// 2. authPlugin.terminate()  
// 3. cachePlugin.terminate()
// 4. databasePlugin.terminate()
```

### Access Plugin Data in Routes

```typescript
// routes/users.ts
import { createGetRoute } from 'blaizejs';
import { getCurrentContext } from 'blaizejs';

export const getUsers = createGetRoute({
  handler: async () => {
    const ctx = getCurrentContext();
    
    // Access plugin-provided services
    const db = ctx.state.db;           // From database plugin
    const cache = ctx.state.cache;     // From cache plugin
    
    // Use plugin services
    const cacheKey = 'users:all';
    let users = await cache.get(cacheKey);
    
    if (!users) {
      users = await db.collection('users').find({}).toArray();
      await cache.set(cacheKey, users, 300); // Cache for 5 minutes
    }
    
    return { users };
  }
});
```

## ♻️ Lifecycle Management

### Plugin Lifecycle Phases

The plugin system manages plugins through five distinct phases:

```typescript
// 1. Registration - Plugin is added to server
server.register(myPlugin());

// 2. Initialize - Setup resources and connections
await plugin.initialize(server);

// 3. Server Start - HTTP server begins listening
await plugin.onServerStart(httpServer);

// 4. Server Stop - HTTP server stops accepting connections
await plugin.onServerStop(httpServer);

// 5. Terminate - Cleanup and resource disposal (reverse order)
await plugin.terminate(server);
```

### Lifecycle Manager Configuration

```typescript
import { createServer } from 'blaizejs';

const server = createServer({
  routesDir: './routes',
  plugins: [myPlugin()],
  
  // Plugin lifecycle options
  pluginOptions: {
    continueOnError: true,    // Continue if a plugin fails
    debug: true,              // Log lifecycle events
    timeout: 30000,           // Max time per lifecycle phase
    
    onError: (plugin, phase, error) => {
      console.error(`Plugin ${plugin.name} failed in ${phase}:`, error);
      
      // Custom error handling
      if (phase === 'initialize' && plugin.name === 'critical-plugin') {
        process.exit(1); // Fail fast for critical plugins
      }
    }
  }
});
```

### Graceful Plugin Shutdown

```typescript
const resourcePlugin = createPlugin('resources', '1.0.0', async (server, options) => {
  const resources = new Map();
  
  return {
    initialize: async () => {
      // Setup resources
      resources.set('database', await connectToDatabase());
      resources.set('redis', await connectToRedis());
      resources.set('queue', await connectToQueue());
    },
    
    onServerStop: async () => {
      // Gracefully stop accepting new work
      const queue = resources.get('queue');
      await queue.pause();
      
      // Wait for in-flight operations
      await queue.waitForEmpty();
    },
    
    terminate: async () => {
      // Clean up resources in dependency order
      await resources.get('queue')?.close();
      await resources.get('redis')?.disconnect();
      await resources.get('database')?.close();
      
      resources.clear();
      console.log('All resources cleaned up');
    }
  };
});
```

## 🔍 Route Management

### Plugin Route Registration

```typescript
const blogPlugin = createPlugin('blog', '1.0.0', async (server, options) => {
  // Register routes from directory
  await server.router.addRouteDirectory(
    path.join(__dirname, 'blog-routes'),
    {
      prefix: '/blog',
      middleware: [
        createMiddleware({
          name: 'blog-auth',
          handler: async (ctx, next) => {
            // Blog-specific authentication
            await next();
          }
        })
      ]
    }
  );
  
  // Check for route conflicts with other plugins
  const conflicts = server.router.getRouteConflicts();
  if (conflicts.length > 0) {
    console.warn('Route conflicts detected:', conflicts);
  }
  
  return {
    initialize: async () => {
      console.log('Blog routes registered successfully');
    }
  };
});

// Plugin route structure:
// plugins/blog/blog-routes/
// ├── index.ts           → /blog (list posts)
// ├── [slug].ts          → /blog/:slug (single post)
// ├── admin/
// │   ├── posts.ts       → /blog/admin/posts
// │   └── [id]/
// │       └── edit.ts    → /blog/admin/:id/edit
```

### Dynamic Route Registration

```typescript
const apiPlugin = createPlugin('dynamic-api', '1.0.0', async (server, options) => {
  // Register routes programmatically
  for (const entity of options.entities) {
    // GET /api/entities/:type
    server.router.addRoute('GET', `/api/entities/${entity.type}`, {
      schema: {
        params: z.object({
          type: z.literal(entity.type)
        }),
        response: z.array(entity.schema)
      },
      handler: async (ctx) => {
        return await entity.repository.findAll();
      }
    });
    
    // POST /api/entities/:type
    server.router.addRoute('POST', `/api/entities/${entity.type}`, {
      schema: {
        params: z.object({
          type: z.literal(entity.type)
        }),
        body: entity.schema,
        response: entity.schema
      },
      handler: async (ctx) => {
        const data = ctx.request.body;
        return await entity.repository.create(data);
      }
    });
  }
}, {
  entities: [
    {
      type: 'users',
      schema: z.object({
        id: z.string(),
        name: z.string(),
        email: z.string().email()
      }),
      repository: userRepository
    },
    {
      type: 'posts',
      schema: z.object({
        id: z.string(),
        title: z.string(),
        content: z.string()
      }),
      repository: postRepository
    }
  ]
});
```

### Route Conflict Detection

```typescript
const conflictPlugin = createPlugin('analytics', '1.0.0', async (server, options) => {
  await server.router.addRouteDirectory('./analytics-routes', { prefix: '/api' });
  
  // Check for conflicts after registration
  const conflicts = server.router.getRouteConflicts();
  
  if (conflicts.length > 0) {
    console.warn('Route conflicts detected:');
    conflicts.forEach(conflict => {
      console.warn(`  ${conflict.method} ${conflict.path}:`);
      conflict.plugins.forEach(plugin => {
        console.warn(`    - ${plugin} (${conflict.sources[plugin]})`);
      });
    });
    
    if (options.failOnConflicts) {
      throw new Error('Route conflicts detected - aborting');
    }
  }
}, {
  failOnConflicts: false
});
```

## ✅ Validation & Options

### Plugin Name and Version Validation

```typescript
import { createPlugin } from 'blaizejs';

// ✅ Valid plugin names
createPlugin('my-plugin', '1.0.0', setup);
createPlugin('api-v2', '2.1.0-beta', setup);
createPlugin('cache123', '1.0.0+build.123', setup);

// ❌ Invalid plugin names (will throw PluginValidationError)
// createPlugin('My_Plugin', '1.0.0', setup);     // Uppercase/underscores
// createPlugin('-invalid', '1.0.0', setup);      // Leading hyphen
// createPlugin('core', '1.0.0', setup);          // Reserved name
// createPlugin('valid-name', 'v1.0.0', setup);   // Invalid version format
```

### Plugin Options Schema Validation

```typescript
import { createPlugin } from 'blaizejs';
import { z } from 'zod';

// Define option schema
const cacheOptionsSchema = z.object({
  ttl: z.number().min(0).default(300),
  maxSize: z.number().min(1).default(1000),
  strategy: z.enum(['lru', 'fifo']).default('lru'),
  redis: z.object({
    host: z.string().default('localhost'),
    port: z.number().min(1).max(65535).default(6379),
    password: z.string().optional()
  }).optional()
});

const cachePlugin = createPlugin(
  'cache',
  '1.0.0',
  async (server, options) => {
    // Options are automatically validated against schema
    console.log(`Cache TTL: ${options.ttl}s`);
    console.log(`Max size: ${options.maxSize} items`);
    console.log(`Strategy: ${options.strategy}`);
    
    // Setup cache with validated options
    const cache = new Cache(options);
    server.context.setGlobal('cache', cache);
  },
  
  // Default options (also validated)
  {
    ttl: 600,
    maxSize: 5000,
    strategy: 'lru'
  },
  
  // Options schema
  cacheOptionsSchema
);

// Usage with validation
const plugin = cachePlugin({
  ttl: 1800,           // ✅ Valid
  maxSize: 10000,      // ✅ Valid
  strategy: 'fifo',    // ✅ Valid
  // invalid: 'value'  // ❌ Would throw validation error
});
```

### Manual Validation Functions

```typescript
import { 
  validatePlugin,
  validatePluginOptions,
  isValidPluginName,
  isValidVersion,
  sanitizePluginName
} from 'blaizejs';

// Validate plugin objects
const plugin = createPlugin('test', '1.0.0', () => {});
validatePlugin(plugin, {
  requireVersion: true,         // Require version property
  validateNameFormat: true,     // Check name format
  checkReservedNames: true,     // Check reserved names
  allowEmptySetup: false        // Require setup function
});

// Validate plugin names
console.log(isValidPluginName('my-plugin'));      // true
console.log(isValidPluginName('My_Plugin'));      // false
console.log(isValidPluginName('core'));           // false (reserved)

// Validate versions
console.log(isValidVersion('1.0.0'));             // true
console.log(isValidVersion('2.1.0-beta.1'));      // true
console.log(isValidVersion('v1.0.0'));            // false

// Sanitize names
console.log(sanitizePluginName('My Cool Plugin!')); // 'my-cool-plugin'
console.log(sanitizePluginName('API_v2'));          // 'api-v2'
```

## 🛡️ Error Handling

### Plugin Error Types

BlaizeJS provides specialized error classes for different plugin failure scenarios:

```typescript
import {
  PluginError,
  PluginLifecycleError,
  PluginValidationError,
  PluginRegistrationError,
  PluginDependencyError
} from 'blaizejs';

const problematicPlugin = createPlugin('problem', '1.0.0', async (server, options) => {
  return {
    initialize: async () => {
      try {
        await connectToExternalService();
      } catch (error) {
        // Wrap and rethrow with context
        throw new PluginLifecycleError('problem', 'initialize', error);
      }
    },
    
    terminate: async () => {
      if (!server.hasPlugin('database')) {
        throw new PluginDependencyError('problem', 'database');
      }
    }
  };
});
```

### Global Error Handling

```typescript
const server = createServer({
  routesDir: './routes',
  plugins: [problematicPlugin()],
  
  pluginOptions: {
    continueOnError: true,
    
    onError: (plugin, phase, error) => {
      // Log detailed error information
      console.error(`Plugin Error Details:`, {
        plugin: plugin.name,
        version: plugin.version,
        phase,
        error: error.message,
        stack: error.stack
      });
      
      // Custom error handling by type
      if (error instanceof PluginValidationError) {
        console.error('Configuration issue - check plugin options');
      } else if (error instanceof PluginDependencyError) {
        console.error('Missing dependency - install required plugin');
      } else if (error instanceof PluginLifecycleError) {
        console.error('Lifecycle error - check external services');
      }
      
      // Metrics collection
      metrics.increment('plugin.errors', {
        plugin: plugin.name,
        phase,
        type: error.constructor.name
      });
    }
  }
});
```

### Plugin Error Recovery

```typescript
const resilientPlugin = createPlugin('resilient', '1.0.0', async (server, options) => {
  let connectionRetries = 0;
  const maxRetries = options.maxRetries;
  
  return {
    initialize: async () => {
      while (connectionRetries < maxRetries) {
        try {
          await connectToService();
          console.log('Connection established');
          return;
        } catch (error) {
          connectionRetries++;
          console.warn(`Connection attempt ${connectionRetries} failed:`, error.message);
          
          if (connectionRetries >= maxRetries) {
            throw new PluginError(
              'resilient',
              `Failed to connect after ${maxRetries} attempts`
            );
          }
          
          // Exponential backoff
          await new Promise(resolve => 
            setTimeout(resolve, Math.pow(2, connectionRetries) * 1000)
          );
        }
      }
    }
  };
}, {
  maxRetries: 3
});
```

### Error Handling in Routes

```typescript
// Plugin-provided error middleware
const errorHandlingPlugin = createPlugin('error-handler', '1.0.0', (server, options) => {
  const errorMiddleware = createMiddleware({
    name: 'plugin-error-handler',
    handler: async (ctx, next) => {
      try {
        await next();
      } catch (error) {
        // Handle plugin-specific errors
        if (error instanceof PluginError) {
          console.error(`Plugin ${error.pluginName} error:`, error.message);
          
          ctx.response.status(503).json({
            error: 'Service Temporarily Unavailable',
            message: 'A plugin service is experiencing issues',
            code: 'PLUGIN_ERROR'
          });
        } else {
          // Re-throw other errors
          throw error;
        }
      }
    }
  });
  
  server.use(errorMiddleware);
});
```

## 🧪 Testing

### Testing Plugin Creation

```typescript
// tests/plugins/creation.test.ts
import { describe, test, expect, vi } from 'vitest';
import { createPlugin } from 'blaizejs';
import { createMockServer } from '@blaizejs/testing-utils';

describe('Plugin Creation', () => {
  test('should create plugin with default options', () => {
    const plugin = createPlugin('test-plugin', '1.0.0', vi.fn(), { 
      defaultValue: 'test' 
    });
    
    const instance = plugin();
    
    expect(instance.name).toBe('test-plugin');
    expect(instance.version).toBe('1.0.0');
    expect(typeof instance.register).toBe('function');
  });

  test('should override default options', () => {
    const setupSpy = vi.fn();
    
    const plugin = createPlugin('test-plugin', '1.0.0', setupSpy, { 
      value: 'default' 
    });
    
    const server = createMockServer();
    const instance = plugin({ value: 'custom' });
    
    instance.register(server);
    
    expect(setupSpy).toHaveBeenCalledWith(server, { value: 'custom' });
  });

  test('should validate plugin name format', () => {
    expect(() => {
      createPlugin('Invalid_Name', '1.0.0', vi.fn());
    }).toThrow('Invalid plugin name format');
    
    expect(() => {
      createPlugin('core', '1.0.0', vi.fn());
    }).toThrow('Reserved plugin name');
  });
});
```

### Testing Plugin Lifecycle

```typescript
// tests/plugins/lifecycle.test.ts
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { createPlugin } from 'blaizejs';
import { createMockServer } from '@blaizejs/testing-utils';

describe('Plugin Lifecycle', () => {
  let mockServer: ReturnType<typeof createMockServer>;
  
  beforeEach(() => {
    mockServer = createMockServer();
  });

  test('should execute lifecycle hooks in correct order', async () => {
    const executionOrder: string[] = [];
    
    const plugin = createPlugin('lifecycle-test', '1.0.0', () => {
      executionOrder.push('register');
      
      return {
        initialize: async () => {
          executionOrder.push('initialize');
        },
        onServerStart: async () => {
          executionOrder.push('onServerStart');
        },
        onServerStop: async () => {
          executionOrder.push('onServerStop');
        },
        terminate: async () => {
          executionOrder.push('terminate');
        }
      };
    });
    
    const instance = plugin();
    
    // Register phase
    instance.register(mockServer);
    
    // Initialize phase
    await instance.initialize(mockServer);
    
    // Server start phase
    await instance.onServerStart(mockServer.server);
    
    // Server stop phase
    await instance.onServerStop(mockServer.server);
    
    // Terminate phase
    await instance.terminate(mockServer);
    
    expect(executionOrder).toEqual([
      'register',
      'initialize', 
      'onServerStart',
      'onServerStop',
      'terminate'
    ]);
  });

  test('should handle lifecycle errors gracefully', async () => {
    const plugin = createPlugin('error-test', '1.0.0', () => {
      return {
        initialize: async () => {
          throw new Error('Initialization failed');
        }
      };
    });
    
    const instance = plugin();
    
    await expect(instance.initialize(mockServer)).rejects.toThrow('Initialization failed');
  });
});
```

### Testing Plugin Integration

```typescript
// tests/plugins/integration.test.ts
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { createServer, createPlugin } from 'blaizejs';
import { Server } from '@blaizejs/types';

describe('Plugin Integration', () => {
  let server: Server;
  
  afterEach(async () => {
    if (server) {
      await server.close();
    }
  });

  test('should register plugin and make services available', async () => {
    const servicePlugin = createPlugin('service', '1.0.0', (server, options) => {
      return {
        initialize: async () => {
          server.context.setGlobal('testService', {
            getValue: () => options.value
          });
        }
      };
    }, { value: 'test-value' });
    
    server = createServer({
      port: 0,
      routesDir: './test-fixtures/routes',
      plugins: [servicePlugin()]
    });
    
    await server.listen();
    
    // Test that service is available
    const testService = server.context.getGlobal('testService');
    expect(testService.getValue()).toBe('test-value');
  });

  test('should handle plugin route registration', async () => {
    const routePlugin = createPlugin('routes', '1.0.0', async (server, options) => {
      server.router.addRoute('GET', '/plugin-test', {
        handler: async () => ({ message: 'Plugin route works' })
      });
    });
    
    server = createServer({
      port: 0,
      routesDir: './test-fixtures/routes', 
      plugins: [routePlugin()]
    });
    
    await server.listen();
    
    const response = await fetch(`http://localhost:${server.port}/plugin-test`);
    const data = await response.json();
    
    expect(response.ok).toBe(true);
    expect(data.message).toBe('Plugin route works');
  });
});
```

### Testing Plugin Options Validation

```typescript
// tests/plugins/validation.test.ts
import { describe, test, expect } from 'vitest';
import { createPlugin } from 'blaizejs';
import { z } from 'zod';

describe('Plugin Options Validation', () => {
  const optionsSchema = z.object({
    host: z.string().default('localhost'),
    port: z.number().min(1).max(65535).default(3000),
    ssl: z.boolean().default(false)
  });
  
  const plugin = createPlugin(
    'config-test',
    '1.0.0',
    (server, options) => {
      // Plugin implementation
    },
    { host: 'localhost', port: 3000, ssl: false },
    optionsSchema
  );

  test('should accept valid options', () => {
    expect(() => {
      plugin({ host: 'example.com', port: 8080, ssl: true });
    }).not.toThrow();
  });

  test('should reject invalid options', () => {
    expect(() => {
      plugin({ port: -1 }); // Invalid port
    }).toThrow();
    
    expect(() => {
      plugin({ port: 70000 }); // Port too high
    }).toThrow();
  });

  test('should use default values for missing options', () => {
    const instance = plugin({ host: 'custom.com' });
    
    // Should merge with defaults
    expect(instance).toBeDefined();
  });
});
```