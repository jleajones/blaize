# @blaizejs/queue

Background job processing plugin for BlaizeJS with priority scheduling, retry logic, and real-time SSE monitoring.

## Features

- 🎯 **Type-Safe Job Processing** - Full TypeScript support with generics
- 📊 **Priority Scheduling** - Process high-priority jobs first
- 🔄 **Automatic Retry Logic** - Exponential backoff with configurable limits
- 📡 **Real-Time Monitoring** - Server-Sent Events (SSE) for live job updates
- 🔌 **Storage Adapter Pattern** - Swappable backends (in-memory default, Redis/Postgres future)
- 📈 **Prometheus Metrics** - Built-in metrics endpoint
- 🎨 **Dashboard UI** - HTML dashboard for queue visualization
- 🧩 **Route Building Blocks** - Export handlers + schemas separately for flexible routing

## Installation

```bash
pnpm add @blaizejs/queue
```

## Quick Start

### 1. Register the Plugin

```typescript
import { createServer } from 'blaizejs';
import { createQueuePlugin } from '@blaizejs/queue';

const server = createServer({
  plugins: [
    createQueuePlugin({
      queues: {
        default: {
          concurrency: 5,
          retryLimit: 3,
          retryDelay: 1000,
        },
        emails: {
          concurrency: 10,
          retryLimit: 5,
          retryDelay: 2000,
        },
      },
    }),
  ],
});
```

### 2. Register Job Handlers

```typescript
import type { QueueService } from '@blaizejs/queue';

// Get queue service from context
const queue: QueueService = ctx.services.queue;

// Register a job handler
queue.registerHandler('send-email', async (job, ctx) => {
  const { to, subject, body } = job.data;
  
  // Send email logic
  await sendEmail(to, subject, body);
  
  // Update progress
  ctx.updateProgress(50, 'Email sent');
  
  // Return result
  return { emailId: '123', sentAt: new Date() };
});
```

### 3. Enqueue Jobs

```typescript
// Enqueue a job
const job = await queue.enqueue('send-email', {
  to: 'user@example.com',
  subject: 'Welcome!',
  body: 'Thanks for signing up',
}, {
  queueName: 'emails',
  priority: 5,
  maxRetries: 3,
  timeout: 30000,
});

console.log(`Job enqueued: ${job.id}`);
```

### 4. Mount Route Handlers

> ⚠️ Example should use route factory

Import handlers and schemas separately, then mount them in your routes:

```typescript
// routes/queue/status.ts
import { createGetRoute } from 'blaizejs';
import { queueStatusHandler, queueStatusQuerySchema } from '@blaizejs/queue';

export default createGetRoute()({
  schema: { query: queueStatusQuerySchema },
  handler: queueStatusHandler,
});
```

```typescript
// routes/queue/stream.ts
import { createSSERoute } from 'blaizejs';
import { jobStreamHandler, jobStreamQuerySchema, jobEventsSchema } from '@blaizejs/queue';

export default createSSERoute()({
  schema: { 
    query: jobStreamQuerySchema,
    events: jobEventsSchema,
  },
  handler: jobStreamHandler,
});
```

## Storage Adapters

The queue plugin uses a storage adapter pattern for flexibility:

```typescript
import { createQueuePlugin, createInMemoryStorage } from '@blaizejs/queue';

// Use default in-memory storage (zero config)
const plugin = createQueuePlugin({
  // storage defaults to in-memory if not provided
});

// Or explicitly provide in-memory storage
const plugin = createQueuePlugin({
  storage: createInMemoryStorage(),
});

// Future: Redis adapter (separate package)
// import { createRedisStorage } from '@blaizejs/queue-redis';
// storage: createRedisStorage({ url: 'redis://localhost:6379' })
```

## Available Route Handlers

All handlers are exported separately from their schemas:

- **`jobStreamHandler`** (SSE) - Real-time job progress updates
- **`queueStatusHandler`** (JSON) - Queue statistics and job list
- **`queuePrometheusHandler`** (Text) - Prometheus metrics
- **`queueDashboardHandler`** (HTML) - Dashboard UI
- **`createJobHandler`** (JSON) - Enqueue jobs via API
- **`cancelJobHandler`** (JSON) - Cancel running/queued jobs

## Configuration

```typescript
interface QueuePluginConfig {
  // Queue configurations
  queues?: Record<string, QueueConfig>;
  
  // Storage adapter (defaults to in-memory)
  storage?: QueueStorageAdapter;
  
  // Global retry settings
  retryLimit?: number;
  retryDelay?: number;
  
  // Enable/disable features
  enableMetrics?: boolean;
  enableDashboard?: boolean;
}
```

## Job Options

```typescript
interface JobOptions {
  // Queue name (default: 'default')
  queueName?: string;
  
  // Priority (0-10, higher = more urgent)
  priority?: number;
  
  // Max retry attempts
  maxRetries?: number;
  
  // Timeout in milliseconds
  timeout?: number;
  
  // Schedule for future execution
  scheduledFor?: Date;
  
  // Job metadata
  metadata?: Record<string, unknown>;
}
```

## Job Context

Job handlers receive a `JobContext` with utilities:

```typescript
interface JobContext {
  // Update job progress (0-100)
  updateProgress: (percent: number, message?: string) => Promise<void>;
  
  // Check if job is cancelled
  isCancelled: () => boolean;
  
  // Abort signal for cancellation
  signal: AbortSignal;
  
  // Logger with job context
  logger: BlaizeLogger;
}
```

## SSE Events

The job stream handler emits these events:

- `job.progress` - Progress updates (0-100%)
- `job.completed` - Job finished successfully
- `job.failed` - Job failed after retries
- `job.cancelled` - Job was cancelled

## Development

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Generate coverage report
pnpm test:coverage

# Build the package
pnpm build

# Type check
pnpm type-check

# Lint
pnpm lint
```

## Architecture

```
plugins/queue/
├── src/
│   ├── index.ts              # Main exports
│   ├── plugin.ts             # Plugin factory
│   ├── types.ts              # TypeScript types
│   ├── errors.ts             # Error classes
│   ├── schemas.ts            # Zod schemas
│   ├── routes.ts             # Route handlers (exported separately)
│   ├── dashboard.ts          # HTML dashboard
│   ├── queue-instance.ts     # Single queue implementation
│   ├── queue-service.ts      # Multi-queue service
│   ├── priority-queue.ts     # Priority queue wrapper
│   ├── job-context.ts        # Job execution context
│   └── storage/
│       ├── index.ts          # Storage exports
│       └── in-memory.ts      # Default in-memory adapter
└── ...
```

## License

MIT © BlaizeJS Contributors