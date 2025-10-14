import { z } from 'zod';

import { serverCorsSchema } from 'src/middleware/cors/validation';

import type { Middleware } from '@blaize-types/middleware';
import type { Plugin } from '@blaize-types/plugins';
import type { ServerOptions, ServerOptionsInput } from '@blaize-types/server';

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

// Validation schema for server options
export const serverOptionsSchema = z.object({
  port: z.number().int().positive().optional().default(3000),
  host: z.string().optional().default('localhost'),
  routesDir: z.string().optional().default('./routes'),
  http2: http2Schema.optional().default({
    enabled: true,
  }),
  middleware: z.array(middlewareSchema).optional().default([]),
  plugins: z.array(pluginSchema).optional().default([]),
  correlation: correlationSchema,
  cors: serverCorsSchema.optional().default(false),
});

export function validateServerOptions(options: ServerOptionsInput): ServerOptions {
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
