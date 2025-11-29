# 📋 @blaizejs/queue

> **Type-safe background job processing** for BlaizeJS applications - Priority scheduling, automatic retries, and real-time SSE monitoring built for AI/ML workloads

[![npm version](https://badge.fury.io/js/%40blaizejs%2Fqueue.svg)](https://badge.fury.io/js/%40blaizejs%2Fqueue)
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
  handler: async (ctx) => {
    const jobId = await ctx.services.queue.add('ai', 'generate-image', {
      prompt: ctx.body.prompt,
    }, {
      priority: 8,
    });
    
    return { jobId, status: 'queued' };
  },
});

// 4. Stream progress via SSE
// routes/jobs/stream.ts
import { jobStreamHandler, jobStreamQuerySchema, jobEventsSchema } from '@blaizejs/queue';

export default createSSERoute()({
  schema: {
    query: jobStreamQuerySchema,
    events: jobEventsSchema,
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

## 📖 Main Exports

```typescript
// Plugin Factory
createQueuePlugin(config: QueuePluginConfig): Plugin

// Route Handlers (import separately from schemas)
jobStreamHandler        // SSE: Real-time job progress
queueStatusHandler      // JSON: Queue stats and job list  
queuePrometheusHandler  // Text: Prometheus metrics
queueDashboardHandler   // HTML: Dashboard UI

// Context API (via ctx.services.queue)
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