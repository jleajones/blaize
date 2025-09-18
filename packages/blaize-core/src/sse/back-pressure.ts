/**
 * Backpressure strategy types and validation schemas for SSE streaming.
 * Provides runtime type checking and sensible defaults for buffer management.
 */

import { z } from 'zod';

/**
 * Buffer overflow strategies when high watermark is reached.
 */
export const BufferStrategySchema = z.enum([
  'drop-oldest', // Drop oldest messages from buffer (FIFO)
  'drop-newest', // Drop newest messages (reject new)
  'pause', // Pause upstream until buffer drains
  'sample', // Keep every Nth message when full
]);

export type BufferStrategy = z.infer<typeof BufferStrategySchema>;

/**
 * Watermark configuration for buffer management.
 * Low watermark resumes flow, high watermark triggers strategy.
 */
export const WatermarkConfigSchema = z
  .object({
    low: z.number().int().positive().describe('Resume threshold in messages'),
    high: z.number().int().positive().describe('Trigger threshold in messages'),
  })
  .refine(data => data.low < data.high, {
    message: 'Low watermark must be less than high watermark',
    path: ['low'],
  });

export type WatermarkConfig = z.infer<typeof WatermarkConfigSchema>;

/**
 * Size limits for buffer management.
 */
export const SizeLimitsSchema = z.object({
  maxMessages: z
    .number()
    .int()
    .positive()
    .max(100000)
    .describe('Maximum number of messages in buffer'),
  maxBytes: z
    .number()
    .int()
    .positive()
    .max(100 * 1024 * 1024) // 100MB max
    .optional()
    .describe('Maximum buffer size in bytes'),
  messageTimeout: z
    .number()
    .int()
    .nonnegative()
    .max(300000) // 5 minutes max
    .optional()
    .describe('Message TTL in milliseconds'),
});

export type SizeLimits = z.infer<typeof SizeLimitsSchema>;

/**
 * Sampling configuration for the 'sample' strategy.
 */
export const SamplingConfigSchema = z.object({
  rate: z
    .number()
    .positive()
    .max(1)
    .default(0.1)
    .describe('Sampling rate (0-1) when buffer is full'),
  minInterval: z
    .number()
    .int()
    .nonnegative()
    .default(100)
    .describe('Minimum ms between sampled messages'),
});

export type SamplingConfig = z.infer<typeof SamplingConfigSchema>;

/**
 * Complete backpressure configuration.
 */
export const BackpressureConfigSchema = z
  .object({
    enabled: z.boolean().default(true).describe('Enable backpressure management'),

    strategy: BufferStrategySchema.default('pause').describe(
      'Strategy when buffer reaches high watermark'
    ),

    watermarks: WatermarkConfigSchema.default({
      low: 100,
      high: 1000,
    }).describe('Buffer watermark thresholds'),

    limits: SizeLimitsSchema.default({
      maxMessages: 10000,
    }).describe('Buffer size constraints'),

    sampling: SamplingConfigSchema.optional().describe('Configuration for sample strategy'),

    metrics: z
      .object({
        enabled: z.boolean().default(false),
        interval: z.number().int().positive().default(5000),
      })
      .optional()
      .describe('Metrics collection configuration'),
  })
  .refine(
    data => {
      // Ensure watermarks are within limits
      return data.watermarks.high <= data.limits.maxMessages;
    },
    {
      message: 'High watermark cannot exceed maxMessages limit',
      path: ['watermarks', 'high'],
    }
  )
  .refine(
    data => {
      // Require sampling config when using sample strategy
      if (data.strategy === 'sample' && !data.sampling) {
        return false;
      }
      return true;
    },
    {
      message: 'Sampling configuration required when using sample strategy',
      path: ['sampling'],
    }
  );

export type BackpressureConfig = z.infer<typeof BackpressureConfigSchema>;

/**
 * Factory for creating default configurations.
 */
export const createDefaultConfig = (
  overrides?: Partial<BackpressureConfig>
): BackpressureConfig => {
  return BackpressureConfigSchema.parse(overrides || {});
};

/**
 * Validation helper with detailed error messages.
 */
export const validateConfig = (
  config: unknown
): { success: true; data: BackpressureConfig } | { success: false; errors: string[] } => {
  const result = BackpressureConfigSchema.safeParse(config);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors = result.error.issues.map(issue => {
    const path = issue.path.join('.');
    return path ? `${path}: ${issue.message}` : issue.message;
  });

  return { success: false, errors };
};

/**
 * Type guards for runtime checks.
 */
export const isValidStrategy = (value: unknown): value is BufferStrategy => {
  return BufferStrategySchema.safeParse(value).success;
};

export const isValidWatermarks = (value: unknown): value is WatermarkConfig => {
  return WatermarkConfigSchema.safeParse(value).success;
};

export const isValidConfig = (value: unknown): value is BackpressureConfig => {
  return BackpressureConfigSchema.safeParse(value).success;
};
