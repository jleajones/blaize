# Migration Guide: v0.3 → v0.4

This guide covers all breaking changes introduced in `@blaizejs/plugin-queue` v0.4.0 and provides step-by-step migration instructions with before/after examples.

## Overview of Breaking Changes

| # | Change | Impact |
|---|--------|--------|
| 1 | Handler definition: `JobHandler<T>` → `defineJob()` | All job handlers must be rewritten |
| 2 | Config restructuring: `handlers` → `queues[name].jobs` | Plugin config shape changed |
| 3 | Handler context: `ctx.data` now typed via Zod schema | Handler signatures updated |
| 4 | `registerHandler()` removed | No runtime handler registration |
| 5 | Typed accessor: `getQueueService<M>()` | Optional generic for type safety |
| 6 | Typed `getJob()` overload | New overload with queue/job generics |
| 7 | Input validation at enqueue | `add()` validates data against Zod schema |
| 8 | Output validation at execution | Handler return value validated against schema |

---

## Step 1: Install Zod (if not already installed)

v0.4 uses [Zod](https://zod.dev) for input/output schema validation. Add it as a dependency:

```bash
npm install zod
```

---

## Step 2: Convert Handlers to `defineJob()`

### Before (v0.3)

```typescript
import type { JobHandler } from '@blaizejs/plugin-queue';

interface EmailData {
  to: string;
  subject: string;
  body: string;
}

const sendEmailHandler: JobHandler<EmailData> = async (ctx) => {
  const { to, subject, body } = ctx.data;
  await sendEmail({ to, subject, body });
  return { messageId: 'msg-123', sentAt: Date.now() };
};
```

### After (v0.4)

```typescript
import { defineJob } from '@blaizejs/plugin-queue';
import { z } from 'zod';

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
    const { to, subject, body } = ctx.data;
    await sendEmail({ to, subject, body });
    return { messageId: 'msg-123', sentAt: Date.now() };
  },
});
```

**Key differences:**
- Replace `JobHandler<T>` type annotation with `defineJob()` call
- Define `input` and `output` as Zod schemas instead of TypeScript interfaces
- The handler's `ctx.data` is now automatically typed from the Zod `input` schema
- The handler's return type is validated against the `output` schema at runtime

---

## Step 3: Restructure Plugin Config

### Before (v0.3)

```typescript
import { createQueuePlugin } from '@blaizejs/plugin-queue';

const queuePlugin = createQueuePlugin({
  queues: {
    emails: { concurrency: 10 },
    reports: { concurrency: 2 },
  },
  handlers: {
    emails: {
      'email:send': sendEmailHandler,
      'email:welcome': welcomeEmailHandler,
    },
    reports: {
      'report:generate': generateReportHandler,
    },
  },
});
```

### After (v0.4)

```typescript
import { createQueuePlugin, defineJob } from '@blaizejs/plugin-queue';
import { z } from 'zod';

const sendEmailJob = defineJob({ /* ... */ });
const welcomeEmailJob = defineJob({ /* ... */ });
const generateReportJob = defineJob({ /* ... */ });

const queuePlugin = createQueuePlugin({
  queues: {
    emails: {
      concurrency: 10,
      jobs: {
        'email:send': sendEmailJob,
        'email:welcome': welcomeEmailJob,
      },
    },
    reports: {
      concurrency: 2,
      jobs: {
        'report:generate': generateReportJob,
      },
    },
  },
});
```

**Key differences:**
- The top-level `handlers` config property is **removed**
- Job definitions are co-located with their queue config under `queues[name].jobs`
- Each job value is a `JobDefinition` created by `defineJob()`, not a bare function

---

## Step 4: Update Handler Context Usage

The `JobContext` interface is unchanged — handlers still receive `ctx` with `ctx.data`, `ctx.logger`, `ctx.signal`, and `ctx.progress()`. The difference is that `ctx.data` is now **automatically typed** via Zod schema inference instead of a manual generic parameter.

### Before (v0.3)

```typescript
const handler: JobHandler<EmailData> = async (ctx) => {
  // ctx.data is typed as EmailData (manual generic)
  ctx.logger.info('Sending to', { to: ctx.data.to });
  return { sent: true };
};
```

### After (v0.4)

```typescript
const emailJob = defineJob({
  input: z.object({ to: z.string().email(), subject: z.string() }),
  output: z.object({ sent: z.boolean() }),
  handler: async (ctx) => {
    // ctx.data is typed as { to: string; subject: string } (inferred from Zod)
    ctx.logger.info('Sending to', { to: ctx.data.to });
    return { sent: true };
  },
});
```

**Key difference:** Type safety comes from the Zod schema, not a manual `JobHandler<T>` generic. No interface definitions needed.

---

## Step 5: Remove `registerHandler()` Calls

`registerHandler()` has been removed from `QueueService`. Handlers are now automatically registered from the `defineJob()` definitions in your config during plugin initialization.

### Before (v0.3)

```typescript
// Runtime handler registration (e.g., in a setup function)
const queue = getQueueService();
queue.registerHandler('emails', 'email:send', sendEmailHandler);
queue.registerHandler('emails', 'email:welcome', welcomeEmailHandler);
```

### After (v0.4)

```typescript
// No runtime registration needed!
// Handlers are auto-registered from config:
createQueuePlugin({
  queues: {
    emails: {
      jobs: {
        'email:send': sendEmailJob,       // ← registered automatically
        'email:welcome': welcomeEmailJob,  // ← registered automatically
      },
    },
  },
});
```

**Action:** Search your codebase for `registerHandler` and remove all calls. Move handler definitions into the plugin config.

---

## Step 6: Add Type Parameter to `getQueueService()` (Recommended)

`getQueueService()` now accepts an optional generic parameter to preserve the manifest type outside of route handlers. This enables full autocomplete for `queue.add()` calls anywhere in your app.

### Before (v0.3)

```typescript
import { getQueueService } from '@blaizejs/plugin-queue';

// No type safety — queueName, jobType, and data are all untyped
const queue = getQueueService();
await queue.add('emails', 'email:send', { to: 'user@example.com' });
```

### After (v0.4) — Recommended Pattern

```typescript
// src/queue.ts — create a typed re-export
import { getQueueService, type InferQueueManifest } from '@blaizejs/plugin-queue';
import { queueConfig } from './queue-config';

type MyManifest = InferQueueManifest<typeof queueConfig>;

export const getTypedQueue = () => getQueueService() as QueueService<MyManifest>;
```

```typescript
// src/some-service.ts — use the typed accessor
import { getTypedQueue } from './queue';

const queue = getTypedQueue();

// ✅ Full autocomplete: queue names, job types, and data shapes
await queue.add('emails', 'email:send', {
  to: 'user@example.com',  // ← typed, IDE autocompletes fields
  subject: 'Welcome',
});

// ❌ TypeScript error: 'invalid-queue' is not a valid queue name
await queue.add('invalid-queue', 'job', {});
```

**Note:** Inside route handlers, `ctx.services.queue` already carries the manifest type — this pattern is only needed for code outside the request lifecycle (utilities, workers, scripts).

---

## Step 7: Use Typed `getJob()` Overload (Optional)

`getJob()` now has a typed overload that narrows the `result` field when you provide queue name and job type generics.

### Before (v0.3)

```typescript
const job = await queue.getJob(jobId);
// job.result is `unknown` — requires manual casting
const result = job?.result as { messageId: string; sentAt: number };
```

### After (v0.4) — Typed Overload

```typescript
const job = await queue.getJob(jobId, 'emails', 'email:send');
// job.result is typed as { messageId: string; sentAt: number } | undefined
if (job?.result) {
  console.log(job.result.messageId); // ← fully typed, no casting
}
```

### After (v0.4) — Untyped Overload (Still Available)

```typescript
// The single-argument overload still works for backward compatibility
const job = await queue.getJob(jobId);
// job.result is `unknown` — same as v0.3
```

---

## Step 8: Handle New Validation Errors

v0.4 validates job data at two points. Both throw `BlaizeValidationError` (imported from `@blaizejs/plugin-queue` as `JobValidationError`).

### Input Validation at Enqueue

`queue.add()` now validates the `data` argument against the job's Zod `input` schema **before** the job is enqueued. Invalid data is rejected immediately.

```typescript
import { JobValidationError } from '@blaizejs/plugin-queue';

try {
  await queue.add('emails', 'email:send', {
    to: 'not-an-email',  // ← fails z.string().email()
    subject: 123,         // ← fails z.string()
  });
} catch (error) {
  if (error instanceof JobValidationError) {
    // error.details.stage === 'enqueue'
    // error.details.validationErrors contains Zod issues
    console.error('Invalid job data:', error.message);
  }
}
```

### Output Validation at Execution

Handler return values are validated against the `output` schema. If validation fails, the job fails **without retry**.

```typescript
const badJob = defineJob({
  input: z.object({ id: z.string() }),
  output: z.object({ url: z.string().url() }),
  handler: async (ctx) => {
    return { url: 'not-a-url' }; // ← fails z.string().url() at runtime
    // Job will fail with JobValidationError, stage: 'execution-output'
    // Job will NOT be retried
  },
});
```

---

## Quick Migration Checklist

- [ ] Install `zod` as a dependency
- [ ] Convert all `JobHandler<T>` functions to `defineJob({ input, output, handler })` definitions
- [ ] Move handlers from `config.handlers[queue][type]` to `config.queues[queue].jobs[type]`
- [ ] Remove the top-level `handlers` property from plugin config
- [ ] Remove all `registerHandler()` calls
- [ ] Update handler context usage: `ctx.data` is now typed via Zod (no manual generics needed)
- [ ] (Recommended) Create a typed `getQueueService()` re-export with `InferQueueManifest`
- [ ] (Optional) Use typed `getJob(id, queueName, jobType)` overload where you need typed results
- [ ] Add error handling for `JobValidationError` at enqueue sites if needed
- [ ] Run TypeScript compiler to catch any remaining type errors
- [ ] Run your test suite to verify all handlers process correctly
