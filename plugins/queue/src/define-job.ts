/**
 * defineJob() Primitive
 *
 * Factory function for creating type-safe, validated job definitions.
 * Returns a frozen {@link JobDefinition} object that can be registered
 * with the queue system.
 *
 * @module @blaizejs/queue/define-job
 * @since 0.4.0
 *
 * @example
 * ```typescript
 * import { defineJob } from '@blaizejs/queue';
 * import { z } from 'zod';
 *
 * // Define a type-safe job with input/output validation
 * const sendEmailJob = defineJob({
 *   jobType: 'email:send',
 *   queue: 'emails',
 *   input: z.object({
 *     to: z.string().email(),
 *     subject: z.string(),
 *     body: z.string(),
 *   }),
 *   output: z.object({
 *     messageId: z.string(),
 *     sentAt: z.number(),
 *   }),
 *   handler: async (ctx) => {
 *     const result = await sendEmail(ctx.data);
 *     return { messageId: result.id, sentAt: Date.now() };
 *   },
 *   options: { priority: 7, maxRetries: 5 },
 * });
 *
 * // sendEmailJob._type === 'definition'
 * // sendEmailJob.jobType === 'email:send'
 * // sendEmailJob is frozen (immutable)
 * ```
 */

import type { z } from 'zod';
import type { DefineJobConfig, JobDefinition } from './types';

/**
 * Checks whether a value looks like a Zod schema at runtime.
 *
 * Validates that the value has both a `_def` property (internal Zod
 * schema descriptor) and a `parse` method.
 *
 * @param value - The value to check
 * @returns `true` if the value appears to be a Zod schema
 */
function isZodSchema(value: unknown): value is z.ZodType {
  return (
    value != null &&
    typeof value === 'object' &&
    '_def' in value &&
    'parse' in value &&
    typeof (value as Record<string, unknown>).parse === 'function'
  );
}

/**
 * Creates a validated, immutable job definition.
 *
 * Performs runtime validation of the configuration:
 * - `input` and `output` must be valid Zod schemas (have `._def` and `.parse`)
 * - `handler` must be a function
 * - `jobType` must be a non-empty string
 * - `queue` must be a non-empty string
 *
 * Returns a frozen {@link JobDefinition} object with `_type: 'definition'`
 * that can be registered with the queue system.
 *
 * @template I - Zod schema type for job input validation
 * @template O - Zod schema type for job output validation
 *
 * @param config - Job definition configuration
 * @returns A frozen {@link JobDefinition} object
 * @throws {Error} If `jobType` is not a non-empty string
 * @throws {Error} If `queue` is not a non-empty string
 * @throws {Error} If `input` is not a valid Zod schema
 * @throws {Error} If `output` is not a valid Zod schema
 * @throws {Error} If `handler` is not a function
 *
 * @example
 * ```typescript
 * import { defineJob } from '@blaizejs/queue';
 * import { z } from 'zod';
 *
 * const resizeImageJob = defineJob({
 *   jobType: 'image:resize',
 *   queue: 'media',
 *   input: z.object({ url: z.string().url(), width: z.number() }),
 *   output: z.object({ resizedUrl: z.string() }),
 *   handler: async (ctx) => {
 *     const resized = await resize(ctx.data.url, ctx.data.width);
 *     return { resizedUrl: resized };
 *   },
 * });
 * ```
 */
export function defineJob<I extends z.ZodType, O extends z.ZodType>(
  config: DefineJobConfig<I, O>
): JobDefinition<I, O> {
  // Validate jobType
  if (typeof config.jobType !== 'string' || config.jobType.trim().length === 0) {
    throw new Error('defineJob: "jobType" must be a non-empty string');
  }

  // Validate queue
  if (typeof config.queue !== 'string' || config.queue.trim().length === 0) {
    throw new Error('defineJob: "queue" must be a non-empty string');
  }

  // Validate input schema
  if (!isZodSchema(config.input)) {
    throw new Error(
      'defineJob: "input" must be a Zod schema (expected ._def property and .parse method)'
    );
  }

  // Validate output schema
  if (!isZodSchema(config.output)) {
    throw new Error(
      'defineJob: "output" must be a Zod schema (expected ._def property and .parse method)'
    );
  }

  // Validate handler
  if (typeof config.handler !== 'function') {
    throw new Error('defineJob: "handler" must be a function');
  }

  const definition: JobDefinition<I, O> = {
    _type: 'definition',
    jobType: config.jobType,
    queue: config.queue,
    input: config.input,
    output: config.output,
    handler: config.handler,
    ...(config.options != null ? { options: config.options } : {}),
  };

  return Object.freeze(definition);
}

