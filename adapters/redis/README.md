# @blaizejs/adapter-redis

Redis adapter package for BlaizeJS providing production-ready implementations of EventBus, Cache, and Queue adapters with built-in circuit breaker support and multi-server coordination.

## Features

- **EventBus Adapter**: Distributed event publishing and subscription using Redis Pub/Sub
- **Cache Adapter**: High-performance caching with TTL support and batch operations
- **Queue Adapter**: Reliable job queue with priority support and Lua-optimized operations
- **Circuit Breaker**: Automatic failure detection and recovery for resilient Redis connections
- **Type-Safe**: Full TypeScript support with comprehensive type inference
- **Production-Ready**: Battle-tested patterns with extensive test coverage

## Installation

```bash
# Using pnpm (recommended)
pnpm add @blaizejs/adapter-redis

# Using npm
npm install @blaizejs/adapter-redis

# Using yarn
yarn add @blaizejs/adapter-redis
```

### Prerequisites

- Node.js >= 20.0.0
- Redis >= 6.0.0 (Redis 8+ recommended)
- BlaizeJS >= 0.8.0

## Quick Start

### EventBus Adapter

The Redis adapter enables distributed event propagation across multiple server instances:

```typescript
import { createApp, MemoryEventBus } from 'blaizejs';
import { createRedisClient, RedisEventBusAdapter } from '@blaizejs/adapter-redis';

// Create Redis client
const redisClient = createRedisClient({
  host: 'localhost',
  port: 6379,
});

// Create Redis adapter
const adapter = new RedisEventBusAdapter(redisClient);

// Create EventBus and attach adapter
const eventBus = new MemoryEventBus('server-1');
await eventBus.setAdapter(adapter);

// Use in your app
const app = createApp({
  eventBus,
});

// Events now propagate across all servers using Redis
await eventBus.publish('cache:invalidate', { key: 'users' });
```

### With TypedEventBus

For type-safe events with Zod validation:

```typescript
import { createTypedEventBus } from 'blaizejs';
import { z } from 'zod';

const schemas = {
  'user:created': z.object({
    userId: z.string().uuid(),
    email: z.string().email(),
  }),
} satisfies EventSchemas;

// Wrap EventBus with TypedEventBus
const typedBus = createTypedEventBus(eventBus, { schemas });

// Type-safe publish and subscribe
await typedBus.publish('user:created', {
  userId: '123',
  email: 'user@example.com',
});
```

### Cache Adapter

```typescript
import { RedisCacheAdapter } from '@blaizejs/adapter-redis';

const cache = new RedisCacheAdapter(redisClient, {
  prefix: 'myapp:',
  defaultTTL: 3600, // 1 hour
});

// Set a value
await cache.set('user:123', JSON.stringify(userData), 300); // 5 minutes

// Get a value
const cached = await cache.get('user:123');
```

### Queue Adapter

```typescript
import { RedisQueueAdapter } from '@blaizejs/adapter-redis';

const queue = new RedisQueueAdapter(redisClient, {
  queueName: 'jobs',
});

// Enqueue a job
await queue.enqueue({
  id: 'job-123',
  data: { userId: '456', action: 'send-email' },
  priority: 1,
});

// Dequeue and process
const job = await queue.dequeue();
if (job) {
  try {
    await processJob(job);
    await queue.complete(job.id);
  } catch (error) {
    await queue.fail(job.id, error.message);
  }
}
```

## Configuration

### Redis Client Options

```typescript
interface RedisClientConfig {
  host?: string;           // Default: 'localhost'
  port?: number;           // Default: 6379
  password?: string;       // Optional
  db?: number;             // Default: 0
  maxRetries?: number;     // Default: 3
  retryDelay?: number;     // Default: 1000ms
}
```

### Circuit Breaker Options

The Redis client includes a built-in circuit breaker for resilience:

```typescript
const client = createRedisClient({
  host: 'localhost',
  port: 6379,
  circuitBreaker: {
    threshold: 5,           // Open after 5 failures
    timeout: 60000,         // Try to close after 1 minute
    monitorInterval: 5000,  // Check every 5 seconds
  },
});
```

## Multi-Server Setup

For distributed systems, each server creates its own EventBus instance with a unique server ID and attaches the Redis adapter:

```typescript
import { randomUUID } from 'node:crypto';
import { MemoryEventBus } from 'blaizejs';

const serverId = process.env.SERVER_ID || randomUUID();

// Create EventBus with unique server ID
const eventBus = new MemoryEventBus(serverId);

// Create and attach Redis adapter
const adapter = new RedisEventBusAdapter(redisClient, { serverId });
await eventBus.setAdapter(adapter);

// Events published from this server will be propagated to all other servers
await eventBus.publish('cache:invalidate', { key: 'users' });
```

## Testing

The package includes Docker Compose configuration for local testing:

```bash
# Start Redis container
docker-compose -f compose.test.yaml up -d

# Run tests
pnpm test

# Run integration tests
pnpm test:integration

# Stop Redis
docker-compose -f compose.test.yaml down
```

## Documentation

For detailed documentation, visit the [BlaizeJS Documentation](https://github.com/jleajones/blaize/tree/main/docs).

### Topics

- Circuit Breaker Configuration and Monitoring
- Performance Optimization
- Multi-Server Coordination
- Error Handling Best Practices
- Lua Scripts and Custom Operations

## Contributing

Contributions are welcome! Please read the [Contributing Guide](https://github.com/jleajones/blaize/blob/main/CONTRIBUTING.md) for details.

## License

MIT © BlaizeJS Contributors

## Support

- [GitHub Issues](https://github.com/jleajones/blaize/issues)
- [Documentation](https://github.com/jleajones/blaize/tree/main/docs)
- [Discussions](https://github.com/jleajones/blaize/discussions)