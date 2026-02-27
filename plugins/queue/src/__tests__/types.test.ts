/**
 * Type-Level Tests for Queue Plugin Type Inference
 *
 * These are compile-time tests using vitest's `expectTypeOf`.
 * They verify that generic type parameters, inference utilities,
 * and Zod-based type mappings work correctly.
 */
import { expectTypeOf } from 'vitest';
import { z } from 'zod';

import type {
  InferQueueManifest,
  QueueManifest,
  JobDefinition,
  DefineJobConfig,
  JobContext,
  QueueConfig,
  QueuePluginConfig,
} from '../types';
import { defineJob } from '../define-job';

// ---------------------------------------------------------------------------
// Test fixtures: Zod schemas used across tests
// ---------------------------------------------------------------------------
const EmailInput = z.object({ to: z.string(), subject: z.string() });
const EmailOutput = z.object({ messageId: z.string(), sentAt: z.number() });

const ReportInput = z.object({ reportId: z.number(), format: z.enum(['pdf', 'csv']) });
const ReportOutput = z.object({ url: z.string() });

// ---------------------------------------------------------------------------
// 1. InferQueueManifest correctly infers input/output types
// ---------------------------------------------------------------------------
describe('InferQueueManifest', () => {
  it('infers input/output types from a config with defineJob() definitions', () => {
    const emailJob = defineJob({
      input: EmailInput,
      output: EmailOutput,
      handler: async (ctx) => ({ messageId: 'id', sentAt: Date.now() }),
    });

    const reportJob = defineJob({
      input: ReportInput,
      output: ReportOutput,
      handler: async (ctx) => ({ url: 'https://example.com/report.pdf' }),
    });

    const config = {
      queues: {
        emails: {
          jobs: { sendEmail: emailJob },
        },
        reports: {
          jobs: { generate: reportJob },
        },
      },
    } satisfies QueuePluginConfig;

    type Manifest = InferQueueManifest<typeof config>;

    // Verify email queue job types
    expectTypeOf<Manifest['emails']['sendEmail']['input']>().toEqualTypeOf<{
      to: string;
      subject: string;
    }>();
    expectTypeOf<Manifest['emails']['sendEmail']['output']>().toEqualTypeOf<{
      messageId: string;
      sentAt: number;
    }>();

    // Verify report queue job types
    expectTypeOf<Manifest['reports']['generate']['input']>().toEqualTypeOf<{
      reportId: number;
      format: 'pdf' | 'csv';
    }>();
    expectTypeOf<Manifest['reports']['generate']['output']>().toEqualTypeOf<{
      url: string;
    }>();
  });
});

// ---------------------------------------------------------------------------
// 2. QueueManifest accepts the inferred type
// ---------------------------------------------------------------------------
describe('QueueManifest', () => {
  it('accepts an InferQueueManifest-derived type', () => {
    const emailJob = defineJob({
      input: EmailInput,
      output: EmailOutput,
      handler: async () => ({ messageId: 'id', sentAt: 0 }),
    });

    const config = {
      queues: {
        emails: { jobs: { sendEmail: emailJob } },
      },
    } satisfies QueuePluginConfig;

    type Manifest = InferQueueManifest<typeof config>;

    // The inferred manifest should be assignable to QueueManifest
    expectTypeOf<Manifest>().toMatchTypeOf<QueueManifest>();
  });
});

// ---------------------------------------------------------------------------
// 3. JobDefinition preserves generic type parameters
// ---------------------------------------------------------------------------
describe('JobDefinition', () => {
  it('preserves Zod schema generic type parameters', () => {
    type Def = JobDefinition<typeof EmailInput, typeof EmailOutput>;

    expectTypeOf<Def['input']>().toEqualTypeOf<typeof EmailInput>();
    expectTypeOf<Def['output']>().toEqualTypeOf<typeof EmailOutput>();
    expectTypeOf<Def['_type']>().toEqualTypeOf<'definition'>();
  });

  it('handler receives correctly typed context and returns correct output', () => {
    type Def = JobDefinition<typeof EmailInput, typeof EmailOutput>;

    expectTypeOf<Def['handler']>().toEqualTypeOf<
      (ctx: JobContext<z.output<typeof EmailInput>>) => Promise<z.output<typeof EmailOutput>>
    >();
  });
});

// ---------------------------------------------------------------------------
// 4. DefineJobConfig handler receives correctly typed JobContext<z.output<I>>
// ---------------------------------------------------------------------------
describe('DefineJobConfig', () => {
  it('handler parameter is JobContext with z.output of input schema', () => {
    type Config = DefineJobConfig<typeof EmailInput, typeof EmailOutput>;

    // The handler should accept JobContext<{ to: string; subject: string }>
    expectTypeOf<Config['handler']>().toEqualTypeOf<
      (ctx: JobContext<{ to: string; subject: string }>) => Promise<{
        messageId: string;
        sentAt: number;
      }>
    >();
  });
});

// ---------------------------------------------------------------------------
// 5. QueueConfig.jobs accepts Record<string, JobDefinition<any, any>>
// ---------------------------------------------------------------------------
describe('QueueConfig.jobs', () => {
  it('accepts Record<string, JobDefinition<any, any>>', () => {
    expectTypeOf<QueueConfig['jobs']>().toEqualTypeOf<
      Record<string, JobDefinition<any, any>>
    >();
  });

  it('accepts concrete defineJob() results', () => {
    const emailJob = defineJob({
      input: EmailInput,
      output: EmailOutput,
      handler: async () => ({ messageId: 'id', sentAt: 0 }),
    });

    // A concrete JobDefinition should be assignable to the jobs record value type
    expectTypeOf(emailJob).toMatchTypeOf<JobDefinition<any, any>>();
  });
});

