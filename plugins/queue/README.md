**Great! Let's update the Queue plugin README to include the factory function pattern.**

Here's the updated README with a new section on direct access:

---

# 📋 @blaizejs/queue

> **Type-safe background job processing** for BlaizeJS applications - Priority scheduling, automatic retries, and real-time SSE monitoring built for AI/ML workloads

[![npm version](https://badge.fury.io/js/%40blaizejs%2Fplugin-queue.svg)](https://badge.fury.io/js/%40blaizejs%2Fplugin-queue)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

## 🎯 Why Queue?

Long-running operations like AI inference, image processing, or email campaigns block your API. BlaizeJS Queue handles these jobs in the background with **native SSE streaming** for real-time progress updates - perfect for AI/ML applications that need to show progress to users.

## 📦 Installation

```bash
pnpm add @blaizejs/queue
```

## 🚀 Quick Start

```typescript
import { createServer } from 'blaizejs';
import { createQueuePlugin } from '@blaizejs/queue';
import type { JobContext } from '@blaizejs/queue';

// 1. Define your job handlers
interface ImageData {
  prompt: string;
}

const generateImageHandler = async (ctx: JobContext<ImageData>) => {
  const { prompt } = ctx.data;

  ctx.progress(10, 'Starting AI model...');
  const model = await loadModel();

  ctx.progress(50, 'Generating image...');
  const image = await model.generate(prompt);

  ctx.progress(90, 'Saving result...');
  const url = await saveToStorage(image);

  return { url, generatedAt: Date.now() };
};

// 2. Register plugin with handlers
const server = createServer({
  port: 3000,
  plugins: [
    createQueuePlugin({
      queues: {
        default: { concurrency: 5 },
        ai: { concurrency: 2, defaultTimeout: 120000 },
      },
      handlers: {
        ai: {
          'generate-image': generateImageHandler,
        },
      },
    }),
  ],
});

// 3. Enqueue jobs from routes
// routes/images/generate.ts
export default createPostRoute()({
  handler: async ctx => {
    const jobId = await ctx.services.queue.add(
      'ai',
      'generate-image',
      {
        prompt: ctx.body.prompt,
      },
      {
        priority: 8,
      }
    );

    return { jobId, status: 'queued' };
  },
});

// 4. Stream progress via SSE
// routes/jobs/stream.ts
import { jobStreamHandler, jobStreamQuerySchema, jobSseEventSchemas } from '@blaizejs/queue';

export default createSSERoute()({
  schema: {
    query: jobStreamQuerySchema,
    events: jobSseEventSchemas,
  },
  handler: jobStreamHandler,
});

// Client receives: job.progress → job.completed
```

## ✨ Features

- 🎯 **Type-Safe Job Processing** - Full TypeScript generics for job data, results, and handlers
- ⚡ **Native SSE Streaming** - Real-time progress updates using BlaizeJS's built-in Server-Sent Events
- 📊 **Priority Scheduling** - Critical jobs run first with 1-10 priority levels and configurable concurrency
- 🔄 **Automatic Retry Logic** - Exponential backoff with configurable limits and timeout via AbortSignal
- 🔌 **Storage Adapter Pattern** - In-memory default, swappable backends for Redis/PostgreSQL
- 📈 **Built-in Observability** - Prometheus metrics, HTML dashboard, and structured logging

## 📖 Usage Patterns

### In Route Handlers (via ctx.services)

Most common usage - enqueue jobs from API endpoints:

```typescript
// routes/emails/send.ts
export default createPostRoute()({
  handler: async ctx => {
    // ✅ Use ctx.services.queue in routes
    const jobId = await ctx.services.queue.add('emails', 'send-welcome', {
      to: ctx.body.email,
      name: ctx.body.name,
    });

    return { jobId, status: 'queued' };
  },
});
```

### In Job Handlers (direct import)

Access queue service directly in job handlers for monitoring or managing other jobs:

```typescript
// queues/monitoring/stats.ts
import { getQueueService } from '@blaizejs/plugin-queue';
import type { JobContext } from '@blaizejs/queue';

interface StatsData {
  queueName: string;
}

export const collectQueueStats = async (ctx: JobContext<StatsData>) => {
  // ✅ Import service directly in job handlers
  const queue = getQueueService();

  const stats = await queue.getQueueStats(ctx.data.queueName);
  const isPaused = queue.isPaused(ctx.data.queueName);

  ctx.logger.info('Queue stats collected', {
    stats,
    isPaused,
  });

  return { stats, isPaused };
};
```

### In Utility Functions

Share queue logic across your application:

```typescript
// lib/queue-utils.ts
import { getQueueService } from '@blaizejs/plugin-queue';

/**
 * Get health status of all queues
 */
export async function getQueueHealth() {
  const queue = getQueueService();
  const queues = queue.listQueues();

  return await Promise.all(
    queues.map(async name => ({
      name,
      stats: await queue.getQueueStats(name),
      isPaused: queue.isPaused(name),
      workers: queue.getWorkerCount?.(name) ?? 0,
    }))
  );
}

/**
 * Bulk cancel jobs by pattern
 */
export async function cancelJobsByPattern(queueName: string, pattern: RegExp) {
  const queue = getQueueService();
  const jobs = await queue.listJobs(queueName, { status: 'pending' });

  const matching = jobs.filter(job => pattern.test(JSON.stringify(job.data)));

  for (const job of matching) {
    await queue.cancelJob(job.id, queueName, 'Bulk cancellation');
  }

  return { cancelled: matching.length };
}
```

### In Worker Processes

Run standalone workers without the full BlaizeJS server:

```typescript
// worker.ts
import { getQueueService } from '@blaizejs/plugin-queue';

async function startWorker() {
  // Get queue service (plugin must be registered in main process)
  const queue = getQueueService();

  // Start processing
  await queue.startAll();

  console.log('Worker processing queues:', queue.listQueues());

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('Shutting down worker...');
    await queue.stopAll({ graceful: true, timeout: 30000 });
    process.exit(0);
  });
}

startWorker();
```

### Why Two Access Patterns?

BlaizeJS provides two ways to access the queue service:

- **`ctx.services.queue`** - For route handlers

  - ✅ Convenient within HTTP request/response cycle
  - ✅ Middleware automatically provides service
  - ✅ No imports needed

- **`getQueueService()`** - For job handlers, utilities, workers
  - ✅ Works outside HTTP context
  - ✅ Portable across different environments
  - ✅ Direct import, no framework dependency

**Important:** Both patterns access the **same QueueService instance**.

## 📖 Main Exports

```typescript
// Service Factory
getQueueService(): QueueService  // Direct access to queue service

// Plugin Factory
createQueuePlugin(config: QueuePluginConfig): Plugin

// Route Handlers (import separately from schemas)
jobStreamHandler        // SSE: Real-time job progress
queueStatusHandler      // JSON: Queue stats and job list
queuePrometheusHandler  // Text: Prometheus metrics
queueDashboardHandler   // HTML: Dashboard UI

// Context API (via ctx.services.queue or getQueueService())
add(queueName, jobType, data, options?): Promise<string>
getJob(jobId, queueName?): Promise<Job | null>
cancelJob(jobId, queueName?, reason?): Promise<boolean>
listJobs(queueName, filters?): Promise<Job[]>
subscribe(jobId, callbacks): () => void

// Key Types
interface JobContext<TData> {
  jobId: string;
  data: TData;
  logger: BlaizeLogger;
  signal: AbortSignal;
  progress(percent: number, message?: string): Promise<void>;
}
```

## 🧪 Testing

### Mocking in Route Tests

```typescript
import { vi } from 'vitest';

describe('POST /emails/send', () => {
  it('enqueues email job', async () => {
    // Routes use ctx.services
    const mockQueue = {
      add: vi.fn().mockResolvedValue('job-123'),
      getJob: vi.fn(),
    };

    const ctx = createMockContext({
      services: { queue: mockQueue },
    });

    await POST.handler({ ctx });

    expect(mockQueue.add).toHaveBeenCalledWith(
      'emails',
      'send-welcome',
      expect.objectContaining({ to: 'user@example.com' })
    );
  });
});
```

### Mocking in Job Handler Tests

```typescript
import { vi } from 'vitest';

// Mock the factory function
vi.mock('@blaizejs/plugin-queue', () => ({
  getQueueService: vi.fn(() => mockQueueService),
}));

const mockQueueService = {
  getQueueStats: vi.fn(),
  isPaused: vi.fn(),
};

describe('collectQueueStats handler', () => {
  it('collects and returns stats', async () => {
    mockQueueService.getQueueStats.mockResolvedValue({
      pending: 5,
      processing: 2,
    });
    mockQueueService.isPaused.mockReturnValue(false);

    const result = await collectQueueStats({
      jobId: 'job-1',
      data: { queueName: 'emails' },
      logger: mockLogger,
      signal: new AbortController().signal,
      progress: vi.fn(),
    });

    expect(result.stats.pending).toBe(5);
    expect(result.isPaused).toBe(false);
  });
});
```

## 📚 Documentation

- 📘 **[Complete Queue Guide](../../docs/guides/queue-plugin.md)** - Full usage and patterns
- 🎯 **[SSE Streaming Tutorial](../../docs/guides/sse-streaming.md)** - Real-time job progress
- 🏗️ **[Storage Adapters](../../docs/reference/queue-storage.md)** - Redis, PostgreSQL setup
- 📊 **[Monitoring Guide](../../docs/guides/queue-monitoring.md)** - Metrics and observability
- 💡 **[AI/ML Job Patterns](../../docs/examples/ai-job-queue.md)** - LLM inference, image generation

## 🔗 Related Packages

- [`blaizejs`](../blaize-core) - Core framework with SSE and plugin support
- [`@blaizejs/plugin-metrics`](../metrics) - Production metrics and observability

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](../../CONTRIBUTING.md) for details.

## 📄 License

MIT © BlaizeJS Team

---

**Built with ❤️ by the BlaizeJS team**

_Background jobs that scale - from simple email queues to complex AI pipelines with real-time progress tracking._
