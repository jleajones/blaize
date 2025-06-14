# 🔗 BlaizeJS Middleware Module

> A powerful, composable middleware system for request/response processing in Node.js applications

[![npm version](https://badge.fury.io/js/blaizejs.svg)](https://badge.fury.io/js/blaizejs)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

## 📋 Table of Contents

- [🌟 Features](#-features)
- [📦 Installation](#-installation)
- [🚀 Quick Start](#-quick-start)
- [🔧 Creating Middleware](#-creating-middleware)
- [🎯 Using Middleware](#-using-middleware)
- [⚡ Middleware Composition](#-middleware-composition)
- [🛡️ Error Handling](#-error-handling)
- [🔍 Debugging & Monitoring](#-debugging--monitoring)
- [✅ Testing](#-testing)
- [🤝 Contributing](#-contributing)
- [🗺️ Roadmap](#️-roadmap)

## 🌟 Features

- ⚡ **Composable architecture** with onion-style execution
- 🔒 **Type-safe middleware** with full TypeScript support
- 🎯 **Conditional execution** with skip functions
- 🔄 **Async/await support** with proper error propagation
- 🛡️ **Built-in error handling** with middleware chain protection
- 🔍 **Debug mode** for development and troubleshooting
- 📊 **Execution order control** with predictable flow
- 🧩 **Multiple creation patterns** for different use cases
- 🚀 **High performance** with minimal overhead
- 🔗 **Context integration** with AsyncLocalStorage support

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

### Basic Middleware Usage

```typescript
import { createServer, createMiddleware } from 'blaizejs';

// Create a simple logging middleware
const logger = createMiddleware({
  name: 'logger',
  handler: async (ctx, next) => {
    console.log(`${ctx.request.method} ${ctx.request.path}`);
    await next();
    console.log(`Response: ${ctx.response.raw.statusCode}`);
  },
});

// Create server with middleware
const server = createServer({
  routesDir: './routes',
  middleware: [logger],
});

await server.listen();
```

### Route-Specific Middleware

```typescript
// routes/protected.ts
import { createGetRoute } from 'blaizejs';
import { createMiddleware } from 'blaizejs';
import { z } from 'zod';

const authMiddleware = createMiddleware({
  name: 'auth',
  handler: async (ctx, next) => {
    const token = ctx.request.header('authorization');
    if (!token?.startsWith('Bearer ')) {
      return ctx.response.status(401).json({ error: 'Unauthorized' });
    }

    // Validate token and attach user to context
    const user = await validateToken(token);
    ctx.state.user = user;

    await next();
  },
});

export const getProtectedData = createGetRoute({
  middleware: [authMiddleware],
  schema: {
    response: z.object({
      message: z.string(),
      user: z.object({
        id: z.string(),
        name: z.string(),
      }),
    }),
  },
  handler: async ctx => {
    return {
      message: 'Protected data accessed successfully',
      user: ctx.state.user,
    };
  },
});
```

## 🔧 Creating Middleware

BlaizeJS provides multiple patterns for creating middleware to suit different development styles and use cases.

### Pattern 1: Function-Based Middleware (Quick & Simple)

```typescript
import { createMiddleware } from 'blaizejs';
import { MiddlewareFunction } from 'blaizejs/types';

// Simple function middleware
const simpleLogger: MiddlewareFunction = async (ctx, next) => {
  console.log(`Request: ${ctx.request.method} ${ctx.request.path}`);
  await next();
};

// Convert to middleware object
const middleware = createMiddleware(simpleLogger);
```

### Pattern 2: Options-Based Middleware (Recommended)

```typescript
import { createMiddleware } from 'blaizejs';

// Full-featured middleware with all options
const advancedMiddleware = createMiddleware({
  name: 'rate-limiter',
  handler: async (ctx, next) => {
    const ip = ctx.request.header('x-forwarded-for') || 'unknown';

    // Check rate limit
    if (await isRateLimited(ip)) {
      return ctx.response.status(429).json({
        error: 'Too Many Requests',
        retryAfter: 60,
      });
    }

    // Record request
    await recordRequest(ip);

    await next();
  },
  skip: ctx => {
    // Skip rate limiting for health checks
    return ctx.request.path === '/health';
  },
  debug: process.env.NODE_ENV === 'development',
});
```

### Pattern 3: Class-Based Middleware (Advanced)

```typescript
import { createMiddleware } from 'blaizejs';
import { Context, MiddlewareFunction } from 'blaizejs/types';

class CacheMiddleware {
  private cache = new Map<string, { data: any; expires: number }>();
  private ttl: number;

  constructor(ttlSeconds = 300) {
    this.ttl = ttlSeconds * 1000;
  }

  private getCacheKey(ctx: Context): string {
    return `${ctx.request.method}:${ctx.request.path}:${JSON.stringify(ctx.request.query)}`;
  }

  private isExpired(timestamp: number): boolean {
    return Date.now() > timestamp;
  }

  public middleware(): MiddlewareFunction {
    return async (ctx, next) => {
      const key = this.getCacheKey(ctx);
      const cached = this.cache.get(key);

      // Return cached response if valid
      if (cached && !this.isExpired(cached.expires)) {
        return ctx.response.json(cached.data);
      }

      // Intercept response to cache it
      const originalJson = ctx.response.json.bind(ctx.response);
      ctx.response.json = (data: any, status?: number) => {
        // Cache successful responses
        if (!status || status < 400) {
          this.cache.set(key, {
            data,
            expires: Date.now() + this.ttl,
          });
        }
        return originalJson(data, status);
      };

      await next();
    };
  }

  public clear(): void {
    this.cache.clear();
  }
}

// Usage
const cacheInstance = new CacheMiddleware(600); // 10 minutes
const cacheMiddleware = createMiddleware({
  name: 'response-cache',
  handler: cacheInstance.middleware(),
  skip: ctx => ctx.request.method !== 'GET',
});
```

## 🎯 Using Middleware

### Global Middleware

```typescript
import { createServer, createMiddleware } from 'blaizejs';

// CORS middleware
const cors = createMiddleware({
  name: 'cors',
  handler: async (ctx, next) => {
    ctx.response
      .header('Access-Control-Allow-Origin', '*')
      .header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
      .header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (ctx.request.method === 'OPTIONS') {
      return ctx.response.status(204).text('');
    }

    await next();
  },
});

// Request timing middleware
const timer = createMiddleware({
  name: 'request-timer',
  handler: async (ctx, next) => {
    const start = Date.now();

    await next();

    const duration = Date.now() - start;
    ctx.response.header('X-Response-Time', `${duration}ms`);
  },
});

const server = createServer({
  routesDir: './routes',
  middleware: [cors, timer], // Applied to all routes
});
```

### Adding Middleware at Runtime

```typescript
import { createServer, createMiddleware } from 'blaizejs';

const server = createServer({ routesDir: './routes' });

// Add single middleware
server.use(
  createMiddleware({
    name: 'security-headers',
    handler: async (ctx, next) => {
      ctx.response
        .header('X-Content-Type-Options', 'nosniff')
        .header('X-Frame-Options', 'DENY')
        .header('X-XSS-Protection', '1; mode=block');
      await next();
    },
  })
);

// Add multiple middleware
server.use([securityMiddleware, compressionMiddleware, rateLimitMiddleware]);
```

### Conditional Middleware

```typescript
import { createMiddleware } from 'blaizejs';

// Skip middleware based on request properties
const conditionalMiddleware = createMiddleware({
  name: 'analytics',
  handler: async (ctx, next) => {
    // Track request analytics
    await trackRequest(ctx.request);
    await next();
  },
  skip: ctx => {
    // Skip for:
    const skipPaths = ['/health', '/metrics', '/favicon.ico'];
    const isSkipPath = skipPaths.includes(ctx.request.path);
    const isBot = ctx.request.header('user-agent')?.includes('bot');

    return isSkipPath || !!isBot;
  },
});
```

## ⚡ Middleware Composition

### Understanding Execution Order

Middleware executes in an "onion" pattern where each middleware can run code before and after the next middleware in the chain:

```typescript
import { compose, createMiddleware } from 'blaizejs';

const middleware1 = createMiddleware({
  name: 'outer',
  handler: async (ctx, next) => {
    console.log('1: Before next');
    await next();
    console.log('1: After next');
  },
});

const middleware2 = createMiddleware({
  name: 'inner',
  handler: async (ctx, next) => {
    console.log('2: Before next');
    await next();
    console.log('2: After next');
  },
});

// Compose middleware into a single function
const composed = compose([middleware1, middleware2]);

// Execution output:
// 1: Before next
// 2: Before next
// [route handler executes]
// 2: After next
// 1: After next
```

### Manual Composition

```typescript
import { compose, createMiddleware } from 'blaizejs';

// Create a composed middleware stack
const apiMiddleware = compose([
  corsMiddleware,
  authMiddleware,
  rateLimitMiddleware,
  loggingMiddleware,
]);

// Use in routes
export default {
  GET: {
    middleware: [apiMiddleware], // All composed middleware runs as one
    handler: async ctx => {
      return { message: 'Hello from protected API' };
    },
  },
};
```

### Middleware Dependencies

```typescript
import { createMiddleware } from 'blaizejs';

// Order matters for dependent middleware
const securityStack = [
  createMiddleware({
    name: 'security-headers',
    handler: async (ctx, next) => {
      ctx.response.header('X-Content-Type-Options', 'nosniff');
      await next();
    },
  }),

  createMiddleware({
    name: 'auth-validator',
    handler: async (ctx, next) => {
      // Depends on security headers being set
      const user = await validateAuth(ctx.request.header('authorization'));
      ctx.state.user = user;
      await next();
    },
  }),

  createMiddleware({
    name: 'permission-check',
    handler: async (ctx, next) => {
      // Depends on user being set by auth middleware
      if (!hasPermission(ctx.state.user, ctx.request.path)) {
        return ctx.response.status(403).json({ error: 'Forbidden' });
      }
      await next();
    },
  }),
];
```

## 🛡️ Error Handling

### Automatic Error Propagation

```typescript
import { createMiddleware } from 'blaizejs';

const errorProneMiddleware = createMiddleware({
  name: 'database-check',
  handler: async (ctx, next) => {
    try {
      await checkDatabaseConnection();
      await next();
    } catch (error) {
      console.error('Database error:', error);

      // Don't call next() to prevent further execution
      ctx.response.status(503).json({
        error: 'Service Unavailable',
        message: 'Database temporarily unavailable',
      });
    }
  },
});
```

### Global Error Handler

```typescript
import { createServer, createMiddleware } from 'blaizejs';

const globalErrorHandler = createMiddleware({
  name: 'error-handler',
  handler: async (ctx, next) => {
    try {
      await next();
    } catch (error) {
      console.error('Unhandled error:', error);

      // Determine error response based on error type
      if (error instanceof ValidationError) {
        ctx.response.status(400).json({
          error: 'Validation Error',
          details: error.details,
        });
      } else if (error instanceof AuthenticationError) {
        ctx.response.status(401).json({
          error: 'Authentication Required',
        });
      } else {
        // Generic server error
        ctx.response.status(500).json({
          error: 'Internal Server Error',
          message:
            process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred',
        });
      }
    }
  },
});

// Place error handler first in the middleware stack
const server = createServer({
  middleware: [globalErrorHandler /* other middleware */],
});
```

### Next() Call Protection

```typescript
import { createMiddleware } from 'blaizejs';

// BlaizeJS automatically prevents multiple next() calls
const badMiddleware = createMiddleware({
  name: 'bad-example',
  handler: async (ctx, next) => {
    await next();
    await next(); // ❌ This will throw an error: "next() called multiple times"
  },
});

// Correct pattern - call next() only once
const goodMiddleware = createMiddleware({
  name: 'good-example',
  handler: async (ctx, next) => {
    const shouldContinue = await checkCondition();

    if (shouldContinue) {
      await next(); // ✅ Called conditionally, only once
    } else {
      ctx.response.status(403).json({ error: 'Access denied' });
      // ✅ Don't call next() when terminating early
    }
  },
});
```

## 🔍 Debugging & Monitoring

### Debug Mode

```typescript
import { createMiddleware } from 'blaizejs';

const debugMiddleware = createMiddleware({
  name: 'request-debugger',
  debug: true, // Enable debug mode
  handler: async (ctx, next) => {
    console.log(`[DEBUG] Processing ${ctx.request.method} ${ctx.request.path}`);

    const start = performance.now();
    await next();
    const duration = performance.now() - start;

    console.log(`[DEBUG] Completed in ${duration.toFixed(2)}ms`);
  },
});
```

### Monitoring & Metrics

```typescript
class MetricsMiddleware {
  private metrics = {
    requests: 0,
    responses: { 2xx: 0, 3xx: 0, 4xx: 0, 5xx: 0 },
    averageResponseTime: 0
  };

  middleware() {
    return create({
      name: 'metrics-collector',
      handler: async (ctx, next) => {
        this.metrics.requests++;
        const start = Date.now();

        await next();

        const duration = Date.now() - start;
        this.updateResponseTime(duration);
        this.updateStatusMetrics(ctx.response.raw.statusCode || 200);
      }
    });
  }

  private updateResponseTime(duration: number): void {
    const { requests, averageResponseTime } = this.metrics;
    this.metrics.averageResponseTime =
      (averageResponseTime * (requests - 1) + duration) / requests;
  }

  private updateStatusMetrics(statusCode: number): void {
    if (statusCode >= 200 && statusCode < 300) this.metrics.responses['2xx']++;
    else if (statusCode >= 300 && statusCode < 400) this.metrics.responses['3xx']++;
    else if (statusCode >= 400 && statusCode < 500) this.metrics.responses['4xx']++;
    else if (statusCode >= 500) this.metrics.responses['5xx']++;
  }

  getMetrics() {
    return { ...this.metrics };
  }
}

// Usage
const metricsCollector = new MetricsMiddleware();

const server = createServer({
  middleware: [metricsCollector.middleware()]
});

// Expose metrics endpoint
// routes/metrics.ts
export default {
  GET: {
    handler: () => metricsCollector.getMetrics()
  }
};
```

## ✅ Testing

### Testing Individual Middleware

```typescript
// tests/middleware/auth.test.ts
import { describe, test, expect, vi } from 'vitest';
import { createTestContext } from '@blaizejs/testing-utils';
import { create } from 'blaizejs/middleware';

describe('Auth Middleware', () => {
  const authMiddleware = create({
    name: 'auth',
    handler: async (ctx, next) => {
      const token = ctx.request.header('authorization');
      if (!token) {
        return ctx.response.status(401).json({ error: 'Unauthorized' });
      }

      ctx.state.user = { id: 'user-123', name: 'Test User' };
      await next();
    },
  });

  test('should reject requests without auth header', async () => {
    // Arrange
    const ctx = createTestContext({
      method: 'GET',
      path: '/protected',
    });
    const next = vi.fn();

    // Act
    await authMiddleware.execute(ctx, next);

    // Assert
    expect(ctx.response.status).toHaveBeenCalledWith(401);
    expect(ctx.response.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    expect(next).not.toHaveBeenCalled();
  });

  test('should allow requests with valid auth header', async () => {
    // Arrange
    const ctx = createTestContext({
      method: 'GET',
      path: '/protected',
      headers: {
        authorization: 'Bearer valid-token',
      },
    });
    const next = vi.fn();

    // Act
    await authMiddleware.execute(ctx, next);

    // Assert
    expect(ctx.state.user).toEqual({ id: 'user-123', name: 'Test User' });
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('should skip middleware when skip condition is met', async () => {
    const skipableMiddleware = create({
      name: 'conditional-auth',
      handler: async (ctx, next) => {
        ctx.state.authChecked = true;
        await next();
      },
      skip: ctx => ctx.request.path === '/public',
    });

    const ctx = createTestContext({
      method: 'GET',
      path: '/public',
    });
    const next = vi.fn();

    await skipableMiddleware.execute(ctx, next);

    expect(ctx.state.authChecked).toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
  });
});
```

### Testing Middleware Composition

```typescript
// tests/middleware/composition.test.ts
import { describe, test, expect, vi } from 'vitest';
import { createTestContext } from '@blaizejs/testing-utils';
import { compose, create } from 'blaizejs/middleware';

describe('Middleware Composition', () => {
  test('should execute middleware in correct order', async () => {
    const executionOrder: string[] = [];

    const middleware1 = create({
      name: 'first',
      handler: async (ctx, next) => {
        executionOrder.push('1-before');
        await next();
        executionOrder.push('1-after');
      },
    });

    const middleware2 = create({
      name: 'second',
      handler: async (ctx, next) => {
        executionOrder.push('2-before');
        await next();
        executionOrder.push('2-after');
      },
    });

    const finalHandler = vi.fn(async () => {
      executionOrder.push('handler');
    });

    const composed = compose([middleware1, middleware2]);
    const ctx = createTestContext();

    await composed(ctx, finalHandler);

    expect(executionOrder).toEqual(['1-before', '2-before', 'handler', '2-after', '1-after']);
  });

  test('should handle middleware that terminates early', async () => {
    const terminatingMiddleware = create({
      name: 'terminator',
      handler: async (ctx, next) => {
        ctx.response.status(403).json({ error: 'Forbidden' });
        // Don't call next()
      },
    });

    const nextMiddleware = create({
      name: 'should-not-run',
      handler: async (ctx, next) => {
        ctx.state.shouldNotBeSet = true;
        await next();
      },
    });

    const finalHandler = vi.fn();
    const composed = compose([terminatingMiddleware, nextMiddleware]);
    const ctx = createTestContext();

    await composed(ctx, finalHandler);

    expect(ctx.response.status).toHaveBeenCalledWith(403);
    expect(ctx.state.shouldNotBeSet).toBeUndefined();
    expect(finalHandler).not.toHaveBeenCalled();
  });
});
```

### Integration Testing with Server

```typescript
// tests/integration/middleware-integration.test.ts
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { createServer } from 'blaizejs';
import { create } from 'blaizejs/middleware';
import { Server } from 'blaizejs';

describe('Middleware Integration', () => {
  let server: Server;

  beforeEach(async () => {
    const requestLogger = create({
      name: 'test-logger',
      handler: async (ctx, next) => {
        ctx.state.requestLogged = true;
        await next();
      },
    });

    server = createServer({
      routesDir: './test-fixtures/routes',
      middleware: [requestLogger],
    });

    await server.listen();
  });

  afterEach(async () => {
    if (server) {
      await server.close();
    }
  });

  test('should apply global middleware to all routes', async () => {
    const response = await fetch(`http://localhost:3000/test`);

    expect(response.ok).toBe(true);
    // Middleware should have run and set state
    // (You'd need to expose this through a test endpoint)
  });

  test('should run middleware before route handlers', async () => {
    // Test implementation depends on your testing setup
    // This demonstrates the pattern for integration tests
  });
});
```

### Testing Utilities

```typescript
// utils/test-helpers.ts
import { createTestContext } from '@blaizejs/testing-utils';
import { create } from 'blaizejs/middleware';
import type { Context, Middleware } from 'blaizejs';

/**
 * Helper to test middleware execution
 */
export async function executeMiddleware(
  middleware: Middleware,
  contextOptions: Parameters<typeof createTestContext>[0] = {},
  shouldCallNext = true
): Promise<{ ctx: Context; nextCalled: boolean }> {
  const ctx = createTestContext(contextOptions);
  let nextCalled = false;

  const next = vi.fn(async () => {
    nextCalled = true;
  });

  await middleware.execute(ctx, next);

  return { ctx, nextCalled };
}

/**
 * Helper to create mock middleware for testing
 */
export function createMockMiddleware(
  name: string,
  behavior: 'pass' | 'block' | 'error' = 'pass'
): Middleware {
  return create({
    name,
    handler: async (ctx, next) => {
      switch (behavior) {
        case 'pass':
          await next();
          break;
        case 'block':
          ctx.response.status(403).json({ error: 'Blocked' });
          break;
        case 'error':
          throw new Error(`Error from ${name}`);
      }
    },
  });
}
```

### Running Tests

```bash
# Run all middleware tests
pnpm test middleware

# Run tests in watch mode
pnpm test:watch middleware

# Run tests with coverage
pnpm test:coverage --filter=middleware
```

## 🤝 Contributing

We welcome contributions to the middleware system! Please see our [Contributing Guide](../../CONTRIBUTING.md) for details.

### 🛠️ Development Setup

```bash
# Clone the repository
git clone https://github.com/jleajones/blaize.git
cd blaize

# Install dependencies
pnpm install

# Run middleware tests
pnpm test --filter=middleware

# Start development with middleware examples
pnpm dev
```

### 📝 Code Standards

- ✅ Use TypeScript with strict mode enabled
- ✅ Follow existing middleware patterns and interfaces
- ✅ Write comprehensive tests using Vitest
- ✅ Include JSDoc comments for public APIs
- ✅ Update documentation for new features
- ✅ Use conventional commits for clear history

### 🔧 Available Scripts

```bash
pnpm build          # Build middleware module
pnpm dev            # Start development mode
pnpm lint           # Run ESLint on middleware code
pnpm format         # Format code with Prettier
pnpm type-check     # Run TypeScript checks
pnpm clean          # Clean build artifacts
```

### 🧪 Testing Guidelines

When contributing middleware features:

- ✅ Test both success and error scenarios
- ✅ Test middleware composition and execution order
- ✅ Test conditional middleware with skip functions
- ✅ Test async/await behavior and error propagation
- ✅ Include integration tests with the server
- ✅ Test edge cases like multiple next() calls

## 🗺️ Roadmap

### 🚀 Current (v0.1.x)

- ✅ Composable middleware system with onion execution
- ✅ Type-safe middleware creation with TypeScript support
- ✅ Conditional middleware execution with skip functions
- ✅ Async/await support with proper error propagation
- ✅ Debug mode for development and troubleshooting
- ✅ Multiple middleware creation patterns (function + options)
- ✅ Automatic protection against multiple next() calls
- ✅ Integration with context state and AsyncLocalStorage

### 🎯 Next Release (v0.2.x)

- 🔄 **Middleware Registry** - Centralized middleware discovery and management
- 🔄 **Performance Profiling** - Built-in timing and performance analysis
- 🔄 **Middleware Dependencies** - Declare and enforce middleware prerequisites
- 🔄 **Hot Reloading** - Dynamic middleware replacement in development

### 🔮 Future (v0.3.x+)

- 🔄 **Middleware Packages** - Plugin system for shareable middleware
- 🔄 **Route-Level Caching** - Smart caching middleware with invalidation
- 🔄 **Schema Validation** - Automatic request/response validation middleware
- 🔄 **Circuit Breaker** - Fault tolerance middleware patterns

### 🌟 Long-term Vision

- 🔄 **Visual Middleware Designer** - GUI tool for middleware composition
- 🔄 **AI-Powered Optimization** - Automatic middleware ordering and optimization
- 🔄 **Distributed Middleware** - Cross-service middleware execution
- 🔄 **Real-time Monitoring** - Live middleware performance dashboard

---

## 📚 Related Documentation

- 🏠 [BlaizeJS Main Documentation](../../README.md)
- 🌐 [Server Module](../server/README.md) - HTTP server with middleware integration
- 🚀 [Router Module](../router/README.md) - File-based routing with middleware support
- 🔗 [Context Module](../context/README.md) - Request/response context and state management
- 🧩 [Plugins Module](../plugins/README.md) - Plugin system and lifecycle management
- 🔗 [Client Module](../client/README.md) - Type-safe API client generation

---

**Built with ❤️ by the BlaizeJS team**

For questions, feature requests, or bug reports, please [open an issue](https://github.com/jleajones/blaize/issues) on GitHub.
