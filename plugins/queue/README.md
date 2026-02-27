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
import { createQueuePlugin, defineJob } from '@blaizejs/queue';
import { z } from 'zod';

// 1. Define your jobs with defineJob()
const generateImageJob = defineJob({
  input: z.object({ prompt: z.string() }),
  output: z.object({ url: z.string(), generatedAt: z.number() }),
  handler: async (ctx) => {
    const { prompt } = ctx.data;

    ctx.progress(10, 'Starting AI model...');
    const model = await loadModel();

    ctx.progress(50, 'Generating image...');
    const image = await model.generate(prompt);

    ctx.progress(90, 'Saving result...');
    const url = await saveToStorage(image);

    return { url, generatedAt: Date.now() };
  },
});

// 2. Register plugin with job definitions
const server = createServer({
  port: 3000,
  plugins: [
    createQueuePlugin({
      queues: {
        ai: {
          concurrency: 2,
          defaultTimeout: 120000,
          jobs: {
            'generate-image': generateImageJob,
          },
        },
      },
    }),
  ],
});

// 3. Enqueue jobs from routes
// routes/images/generate.ts
export default createPostRoute()({
  handler: async (ctx) => {
    const jobId = await ctx.services.queue.add(
      'ai',
      'generate-image',
      { prompt: ctx.body.prompt },
      { priority: 8 }
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

## 📖 Defining Jobs

Use `defineJob()` to create type-safe job definitions with Zod schemas for input/output validation:

```typescript
import { defineJob } from '@blaizejs/queue';
import { z } from 'zod';

// defineJob() takes { input, output, handler } — that's it
const sendEmailJob = defineJob({
  input: z.object({
    to: z.string().email(),
    subject: z.string(),
    body: z.string(),
  }),
  output: z.object({
    messageId: z.string(),
    sentAt: z.number(),
  }),
  handler: async (ctx) => {
    const result = await emailService.send(ctx.data);
    return { messageId: result.id, sentAt: Date.now() };
  },
});
```

Jobs are registered in the config under `queues[name].jobs[type]`:

```typescript
createQueuePlugin({
  queues: {
    emails: {
      concurrency: 10,
      jobs: {
        'send-welcome': sendEmailJob,
        'send-notification': sendNotificationJob,
      },
    },
    reports: {
      concurrency: 2,
      jobs: {
        generate: generateReportJob,
      },
    },
  },
});
```

## 🔒 Type-Safe Manifest with `InferQueueManifest`

Use the `InferQueueManifest` type utility to extract a full type manifest from your config. This powers type-safe access throughout your app:

```typescript
import { createQueuePlugin, defineJob } from '@blaizejs/queue';
import type { InferQueueManifest, QueuePluginConfig } from '@blaizejs/queue';
import { z } from 'zod';

const sendEmailJob = defineJob({
  input: z.object({ to: z.string(), subject: z.string() }),
  output: z.object({ messageId: z.string(), sentAt: z.number() }),
  handler: async (ctx) => ({ messageId: 'id', sentAt: Date.now() }),
});

const generateReportJob = defineJob({
  input: z.object({ reportId: z.number(), format: z.enum(['pdf', 'csv']) }),
  output: z.object({ url: z.string() }),
  handler: async (ctx) => ({ url: 'https://example.com/report.pdf' }),
});

// Define config with `satisfies` to preserve literal types
const queueConfig = {
  queues: {
    emails: { jobs: { sendEmail: sendEmailJob } },
    reports: { jobs: { generate: generateReportJob } },
  },
} satisfies QueuePluginConfig;

// Infer the manifest type from config
type AppManifest = InferQueueManifest<typeof queueConfig>;
// → { emails: { sendEmail: { input: { to: string; subject: string }; output: { ... } } }; ... }
```

## 🏭 Typed Accessor Pattern

Create a typed wrapper around `getQueueService()` for type-safe queue access across your app:

```typescript
// lib/queue.ts
import { getQueueService } from '@blaizejs/queue';
import type { AppManifest } from './queue-config';

export const getQueue = () => getQueueService<AppManifest>();
```

Now all calls through `getQueue()` are fully typed:

```typescript
import { getQueue } from '../lib/queue';

// ✅ Type-safe: input is validated against the manifest
await getQueue().add('emails', 'sendEmail', {
  to: 'user@example.com',
  subject: 'Welcome',
});
```

## 🔍 Typed `getJob()` Overload

When you provide both `queueName` and `jobType`, `getJob()` returns a typed `Job` with narrowed input/output:

```typescript
const queue = getQueue();

// Untyped — returns Job<unknown, unknown> | undefined
const job = await queue.getJob(jobId);

// Typed — returns Job<{ to: string; subject: string }, { messageId: string; sentAt: number }> | undefined
const typedJob = await queue.getJob(jobId, 'emails', 'sendEmail');

if (typedJob) {
  typedJob.data.to;       // ✅ string
  typedJob.result?.sentAt; // ✅ number | undefined
}
```

## 📖 Usage Patterns

### In Route Handlers (via ctx.services)

Most common usage - enqueue jobs from API endpoints:

```typescript
// routes/emails/send.ts
export default createPostRoute()({
  handler: async (ctx) => {
    const jobId = await ctx.services.queue.add('emails', 'sendEmail', {
      to: ctx.body.email,
      subject: 'Welcome!',
    });

    return { jobId, status: 'queued' };
  },
});
```

### Direct Import (job handlers, utilities, workers)

Access the queue service directly outside of HTTP context:

```typescript
import { getQueueService } from '@blaizejs/queue';

const queue = getQueueService();
const stats = await queue.getQueueStats('emails');
const jobs = await queue.listJobs('emails', { status: 'failed', limit: 10 });
```

**Important:** Both `ctx.services.queue` and `getQueueService()` access the **same QueueService instance**.

## 📖 Main Exports

```typescript
// Job Definition
defineJob({ input, output, handler })  // Create a type-safe job definition

// Service Factory
getQueueService<M>(): QueueService<M>  // Direct access to queue service

// Plugin Factory
createQueuePlugin(config: QueuePluginConfig): Plugin

// Type Utilities
type InferQueueManifest<Config>        // Infer manifest from config
type QueueManifest                     // Base manifest type
type JobDefinition<I, O>               // Job definition type

// Route Handlers
jobStreamHandler        // SSE: Real-time job progress
queueStatusHandler      // JSON: Queue stats and job list
queuePrometheusHandler  // Text: Prometheus metrics
queueDashboardHandler   // HTML: Dashboard UI

// Context API (via ctx.services.queue or getQueueService())
add(queueName, jobType, data, options?): Promise<string>
getJob(jobId): Promise<Job | undefined>
getJob(jobId, queueName, jobType): Promise<Job<TInput, TOutput> | undefined>
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

```typescript
import { vi } from 'vitest';

describe('POST /emails/send', () => {
  it('enqueues email job', async () => {
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
      'sendEmail',
      expect.objectContaining({ to: 'user@example.com' })
    );
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
