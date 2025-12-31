import { z } from 'zod';

import { serverCorsSchema } from '../middleware/cors/validation';

import type { Middleware } from '@blaize-types/middleware';
import type { Plugin } from '@blaize-types/plugins';
import type { ServerOptions } from '@blaize-types/server';

// Create a more flexible validation for the middleware function type
const middlewareSchema = z.custom<Middleware>(
  data =>
    data !== null &&
    typeof data === 'object' &&
    'execute' in data &&
    typeof data.execute === 'function',
  {
    message: 'Expected middleware to have an execute function',
  }
);

// Create a schema for plugins
const pluginSchema = z.custom<Plugin>(
  data =>
    data !== null &&
    typeof data === 'object' &&
    'register' in data &&
    typeof data.register === 'function',
  {
    message: 'Expected a valid plugin object with a register method',
  }
);

// Create a schema for HTTP/2 options with conditional validation
const http2Schema = z
  .object({
    enabled: z.boolean().optional().default(true),
    keyFile: z.string().optional(),
    certFile: z.string().optional(),
  })
  .refine(
    data => {
      // If HTTP/2 is enabled and not in development mode,
      // both keyFile and certFile must be provided
      if (data.enabled && process.env.NODE_ENV === 'production') {
        return data.keyFile && data.certFile;
      }
      return true;
    },
    {
      message:
        'When HTTP/2 is enabled (outside of development mode), both keyFile and certFile must be provided',
    }
  );

// Create a schema for correlation options
const correlationSchema = z
  .object({
    /**
     * HTTP header name for correlation IDs
     * Must be a valid HTTP header name (lowercase, alphanumeric with hyphens)
     */
    headerName: z
      .string()
      .regex(/^[a-z][a-z0-9-]*$/, {
        message:
          'Header name must start with a letter and contain only lowercase letters, numbers, and hyphens',
      })
      .optional(),

    /**
     * Custom generator function for correlation IDs
     * Must be a function that returns a string
     */
    generator: z.function().args().returns(z.string()).optional(),
  })
  .optional();

const multipartLimitsSchema = z.object({
  maxFileSize: z
    .number()
    .positive()
    .default(50 * 1024 * 1024),
  maxTotalSize: z
    .number()
    .positive()
    .default(100 * 1024 * 1024),
  maxFiles: z.number().positive().int().default(10),
  maxFieldSize: z
    .number()
    .positive()
    .default(1024 * 1024),
});

const bodyLimitsSchema = z.object({
  json: z
    .number()
    .positive()
    .default(512 * 1024),
  form: z
    .number()
    .positive()
    .default(1024 * 1024),
  text: z
    .number()
    .positive()
    .default(5 * 1024 * 1024),
  raw: z
    .number()
    .positive()
    .default(10 * 1024 * 1024),
  multipart: multipartLimitsSchema,
});

/**
 * Request logger options validation schema
 */
const requestLoggerOptionsSchema = z
  .object({
    includeHeaders: z.boolean().optional(),
    headerWhitelist: z.array(z.string().min(1)).optional(),
    includeQuery: z.boolean().optional(),
  })
  .optional();

/**
 * Logger configuration validation schema
 *
 * NOTE: Defaults are NOT set here - they're handled by:
 * - Core logger config: logger.ts:createLogger()
 * - Request config: server/create.ts:initializeLogger()
 */
const loggerConfigSchema = z
  .object({
    level: z.enum(['debug', 'info', 'warn', 'error']).optional(),
    transport: z.any().optional(),
    redactKeys: z.array(z.string().min(1)).optional(),
    includeTimestamp: z.boolean().optional(),
    requestLogging: z.boolean().optional(),
    requestLoggerOptions: requestLoggerOptionsSchema,
  })
  .optional();

// Validation schema for server options
export const serverOptionsSchema = z.object({
  port: z.number().int().positive().optional().default(3000),
  host: z.string().optional().default('localhost'),
  routesDir: z.string().optional().default('./routes'),
  http2: http2Schema.optional().default({
    enabled: true,
  }),
  eventSchemas: z.record(z.any()).optional().default({}),
  middleware: z.array(middlewareSchema).optional().default([]),
  plugins: z.array(pluginSchema).optional().default([]),
  correlation: correlationSchema,
  cors: serverCorsSchema,
  bodyLimits: bodyLimitsSchema,
  logging: loggerConfigSchema,
  serverId: z.string().min(1).optional(),
});

export function validateServerOptions(options: ServerOptions): ServerOptions {
  try {
    return serverOptionsSchema.parse(options);
  } catch (error) {
    // Properly type the error as Zod validation error
    if (error instanceof z.ZodError) {
      // Format the Zod error for better readability
      const formattedError = error.format();
      throw new Error(`Invalid server options: ${JSON.stringify(formattedError, null, 2)}`);
    }
    // For other types of errors
    throw new Error(`Invalid server options: ${String(error)}`);
  }
}
