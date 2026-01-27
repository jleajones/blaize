# @blaizejs/testing-utils

Comprehensive testing utilities for BlaizeJS applications with full TypeScript support.

## Installation

```bash
npm install --save-dev @blaizejs/testing-utils
# or
pnpm add -D @blaizejs/testing-utils
# or
yarn add -D @blaizejs/testing-utils
```

## Features

- ✅ **Route Testing Helpers** - Simplified setup for route handler tests
- ✅ **Mock Logger** - With assertion helpers for cleaner tests
- ✅ **Mock EventBus** - With assertion helpers for event validation
- ✅ **Context Mocking** - Full request/response context creation
- ✅ **SSE Testing** - Server-Sent Events stream mocking
- ✅ **Middleware Testing** - Test middleware in isolation
- ✅ **Plugin Testing** - Test plugin lifecycle and behavior
- ✅ **Server Mocking** - Full server instance mocking
- ✅ **TypeScript Support** - Full type safety and inference

---

## Quick Start

### Testing Routes (Recommended Pattern)

The easiest way to test route handlers is with `createRouteTestContext()`:

```typescript
import { createRouteTestContext } from '@blaizejs/testing-utils';
import { describe, it, expect } from 'vitest';
import { getUserById } from '../routes/users/[userId]';

describe('GET /users/:userId', () => {
  it('should fetch user and publish event', async () => {
    const { logger, eventBus, cleanup } = createRouteTestContext();

    const result = await getUserById.handler({
      params: { userId: 'test-123' },
      logger,
      eventBus,
    });

    expect(result.id).toBe('test-123');
    
    // Assert logging
    logger.assertInfoCalled('Fetching user', { userId: 'test-123' });
    
    // Assert events
    eventBus.assertPublished('user:viewed', { userId: 'test-123' });

    cleanup();
  });
});
```

**Benefits:**
- **1 line of setup** instead of 15+
- **Automatic cleanup** with `cleanup()`
- **Assertion helpers** built-in
- **Type-safe** by default

---

## Route Testing Helpers

### createRouteTestContext()

Creates a complete test context with logger, eventBus, and cleanup function.

**Returns:**
- `logger` - MockLogger with assertion helpers
- `eventBus` - MockEventBus with assertion helpers
- `cleanup()` - Resets all mocks and state

**Example:**

```typescript
import { createRouteTestContext } from '@blaizejs/testing-utils';

describe('User Routes', () => {
  it('should create user', async () => {
    const { logger, eventBus, cleanup } = createRouteTestContext();

    await createUser.handler({
      body: { name: 'John Doe', email: 'john@example.com' },
      logger,
      eventBus,
    });

    logger.assertInfoCalled('User created');
    eventBus.assertPublished('user:created', {
      email: 'john@example.com',
    });

    cleanup();
  });
});
```

**With beforeEach/afterEach:**

```typescript
describe('User Routes', () => {
  const { logger, eventBus, cleanup } = createRouteTestContext();

  afterEach(() => {
    cleanup(); // Reset state between tests
  });

  it('test 1', async () => {
    // Use logger and eventBus
  });

  it('test 2', async () => {
    // Fresh state from cleanup
  });
});
```

---

## Mock Logger

### createMockLogger()

Creates a mock logger with tracking and assertion helpers.

**Assertion Methods:**
- `assertInfoCalled(message, meta?)` - Assert info log was called
- `assertDebugCalled(message, meta?)` - Assert debug log was called
- `assertWarnCalled(message, meta?)` - Assert warn log was called
- `assertErrorCalled(message, meta?)` - Assert error log was called

**Helper Methods:**
- `getLogsByLevel(level)` - Get all logs for a specific level
- `clear()` - Reset all tracked logs

**Example:**

```typescript
import { createMockLogger } from '@blaizejs/testing-utils';

const logger = createMockLogger();

// Log something
logger.info('User created', { userId: '123', email: 'test@example.com' });

// Assert it was called
logger.assertInfoCalled('User created', { userId: '123' });

// Get all info logs
const infoLogs = logger.getLogsByLevel('info');
console.log(infoLogs); // [{ message: 'User created', meta: {...} }]

// Clear for next test
logger.clear();
```

**Partial Meta Matching:**

```typescript
logger.info('Request processed', {
  userId: '123',
  timestamp: 1234567890,
  ip: '192.168.1.1',
  extra: 'data',
});

// Only check userId - other fields ignored
logger.assertInfoCalled('Request processed', { userId: '123' });
```

---

## Mock EventBus

### createMockEventBus()

Creates a mock EventBus with tracking and assertion helpers.

**Assertion Methods:**
- `assertPublished(eventType, data?)` - Assert event was published
- `assertNotPublished(eventType)` - Assert event was NOT published

**Helper Methods:**
- `getPublishedEvents(eventType?)` - Get published events (optionally filtered)
- `clear()` - Reset all tracked events

**Example:**

```typescript
import { createMockEventBus } from '@blaizejs/testing-utils';

const eventBus = createMockEventBus();

// Publish events
await eventBus.publish('user:created', { userId: '123' });
await eventBus.publish('email:sent', { to: 'test@example.com' });

// Assert they were published
eventBus.assertPublished('user:created', { userId: '123' });
eventBus.assertPublished('email:sent');

// Assert event was NOT published
eventBus.assertNotPublished('user:deleted');

// Get all published events
const events = eventBus.getPublishedEvents();
console.log(events.length); // 2

// Get events by type
const userEvents = eventBus.getPublishedEvents('user:created');
console.log(userEvents.length); // 1

// Clear for next test
eventBus.clear();
```

**Partial Data Matching:**

```typescript
await eventBus.publish('order:placed', {
  orderId: '456',
  total: 99.99,
  items: [...],
  timestamp: 1234567890,
});

// Only check orderId - other fields ignored
eventBus.assertPublished('order:placed', { orderId: '456' });
```

---

## Context Mocking

### createMockContext()

Creates a mock context object for testing handlers.

**Example:**

```typescript
import { createMockContext } from '@blaizejs/testing-utils';

const ctx = createMockContext({
  method: 'GET',
  path: '/api/users',
  query: { page: '1' },
  params: { userId: '123' },
});

// Use in handler
const result = await handler({ ctx, logger, eventBus });
```

**With Request Body:**

```typescript
const ctx = createMockContext({
  method: 'POST',
  path: '/api/users',
  body: {
    name: 'John Doe',
    email: 'john@example.com',
  },
});
```

---

## SSE Testing

### createSSEMockContext()

Creates a mock context with SSE stream support.

**Example:**

```typescript
import { createSSEMockContext } from '@blaizejs/testing-utils';

const { ctx, stream } = createSSEMockContext();

// Test SSE handler
await sseHandler({ ctx, logger, eventBus });

// Verify stream was set up
expect(stream.send).toHaveBeenCalled();
expect(stream.onClose).toHaveBeenCalled();
```

---

## Middleware Testing

### createMockMiddleware()

Creates a mock middleware for testing.

**Example:**

```typescript
import { createMockMiddleware } from '@blaizejs/testing-utils';

const middleware = createMockMiddleware({
  name: 'test-middleware',
  execute: async ({ ctx, next }) => {
    ctx.state.testValue = 'test';
    await next();
  },
});

// Test middleware
await middleware.execute({
  ctx,
  next: async () => {},
  logger,
  eventBus,
});

expect(ctx.state.testValue).toBe('test');
```

---

## Server Mocking

### createMockServer()

Creates a mock server instance for testing plugins and lifecycle.

**Example:**

```typescript
import { createMockServer } from '@blaizejs/testing-utils';

const server = createMockServer();

// Test plugin
await plugin.register(server);
await plugin.initialize(server);

expect(server.plugins).toContainEqual(plugin);
```

---

## Migration from 0.5.x to 0.6.0

### New: createRouteTestContext

**Before:**

```typescript
const logger = createMockLogger();
const eventBus = createMockEventBus();

// ... test code ...

logger.clear();
eventBus.clear();
vi.clearAllMocks();
```

**After:**

```typescript
const { logger, eventBus, cleanup } = createRouteTestContext();

// ... test code ...

cleanup();
```

### New: Logger Assertion Helpers

**Before:**

```typescript
expect(logger.info).toHaveBeenCalledWith('User created', { userId: '123' });
```

**After:**

```typescript
logger.assertInfoCalled('User created', { userId: '123' });
```

### New: EventBus Assertion Helpers

**Before:**

```typescript
expect(eventBus.publish).toHaveBeenCalledWith('user:created', { userId: '123' });
```

**After:**

```typescript
eventBus.assertPublished('user:created', { userId: '123' });
```

---

## TypeScript Support

All utilities have full TypeScript support with type inference:

```typescript
import type { RouteTestContext } from '@blaizejs/testing-utils';

// Type-safe context
const context: RouteTestContext = createRouteTestContext();

// Inferred types
const logger = createMockLogger(); // MockLogger
const eventBus = createMockEventBus(); // TypedEventBus & MockEventBusHelpers
```

---

## API Reference

### Route Testing

- `createRouteTestContext<TSchemas>()` - Create complete test context

### Logger

- `createMockLogger()` - Create mock logger
- `MockLogger` - TypeScript type for mock logger

### EventBus

- `createMockEventBus<TSchemas>()` - Create mock event bus
- `createWorkingMockEventBus(serverId?)` - Create working mock with pub/sub
- `MockEventBusHelpers` - TypeScript type for assertion helpers

### Context

- `createMockContext(options)` - Create mock context
- `createSSEMockContext()` - Create mock context with SSE

### Middleware

- `createMockMiddleware(options)` - Create mock middleware

### Server

- `createMockServer(overrides?)` - Create mock server
- `createMockServerWithPlugins(plugins)` - Create mock server with plugins

### Routes

- `mockGetRoute()` - Create mock GET route
- `mockPostRoute()` - Create mock POST route
- `mockPutRoute()` - Create mock PUT route
- `mockPatchRoute()` - Create mock PATCH route
- `mockDeleteRoute()` - Create mock DELETE route

---

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for details on contributing to BlaizeJS.

---

## License

MIT © [J.Lea-Jones](mailto:jason@careymarcel.com)

---

**Built with ❤️ by the BlaizeJS team**