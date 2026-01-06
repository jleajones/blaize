/**
 * @module sse/route-creator
 * @description SSE route creator following BlaizeJS v0.4.x patterns
 */

import { z } from 'zod';

import { createSSEStream } from './stream';
import { SSENotAcceptableError } from '../errors/sse-not-acceptable-error';
import { getRoutePath } from '../router/create';

import type { EventSchemas, TypedEventBus } from '@blaize-types';
import type { State, Services, Context } from '@blaize-types/context';
import type { BlaizeLogger } from '@blaize-types/logger';
import type { CreateSSERoute, SSEStreamExtended, TypedSSEStream } from '@blaize-types/sse';

/**
 * Validate an SSE configuration
 */
function validateSSEConfig(config: any): void {
  if (!config.handler || typeof config.handler !== 'function') {
    throw new Error('SSE route handler must be a function');
  }

  if (config.middleware && !Array.isArray(config.middleware)) {
    throw new Error('Middleware for SSE route must be an array');
  }

  // Validate schema if provided
  if (config.schema) {
    const { params, query, events } = config.schema;

    if (params && (!params._def || typeof params.parse !== 'function')) {
      throw new Error('Params schema for SSE must be a valid Zod schema');
    }

    if (query && (!query._def || typeof query.parse !== 'function')) {
      throw new Error('Query schema for SSE must be a valid Zod schema');
    }

    // Events can be either a Zod schema or an object of Zod schemas
    if (events) {
      if (typeof events === 'object' && !events._def) {
        // It's an event map, validate each event schema
        for (const [eventName, eventSchema] of Object.entries(events)) {
          if (
            !eventSchema ||
            typeof eventSchema !== 'object' ||
            !(eventSchema as any)._def ||
            typeof (eventSchema as any).parse !== 'function'
          ) {
            throw new Error(`Event schema for '${eventName}' must be a valid Zod schema`);
          }
        }
      } else if (events._def && typeof events.parse === 'function') {
        // Single schema - that's fine too
      } else {
        throw new Error('Events schema for SSE must be a valid Zod schema or event map');
      }
    }
  }
}

/**
 * Create a typed SSE stream wrapper if event schemas are provided
 */
function createTypedStream<TEvents extends Record<string, z.ZodType>>(
  stream: SSEStreamExtended,
  eventSchemas: TEvents
): TypedSSEStream<TEvents> {
  const typedStream = Object.create(stream) as TypedSSEStream<TEvents>;

  // Override send method with validation
  const originalSend = stream.send.bind(stream);
  typedStream.send = function <K extends keyof TEvents>(
    event: K & string,
    data: z.infer<TEvents[K]>
  ): void {
    // Validate the data against the schema if it exists
    const schema = eventSchemas[event];
    if (schema) {
      try {
        const validated = schema.parse(data);
        originalSend(event, validated);
      } catch (error) {
        stream.sendError(
          new Error(
            `Event '${event}' validation failed: ${error instanceof Error ? error.message : String(error)}`
          )
        );
      }
    } else {
      // No schema for this event, send as-is
      originalSend(event, data);
    }
  };

  return typedStream;
}

/**
 * Create an SSE route following BlaizeJS patterns
 *
 * SSE routes use a stream-first handler signature: (stream, ctx, params)
 * This makes sense because SSE is fundamentally about streaming events.
 *
 * @example Basic usage:
 * ```typescript
 * export default createSSERoute<AppState, AppServices>()({
 *   handler: async (stream, ctx, params) => {
 *     stream.send('message', { text: 'Hello SSE!' });
 *
 *     // Access state and services as usual
 *     const user = ctx.state.user;
 *     const db = ctx.services.database;
 *   }
 * });
 * ```
 *
 * @example With typed events (automatic type inference!):
 * ```typescript
 * export default createSSERoute<AppState, AppServices>()({
 *   schema: {
 *     params: z.object({ roomId: z.string() }),
 *     events: {
 *       message: z.object({ content: z.string(), author: z.string() }),
 *       typing: z.object({ userId: z.string(), isTyping: z.boolean() }),
 *       presence: z.object({ users: z.array(z.string()) })
 *     }
 *   },
 *   handler: async (stream, ctx, params) => {
 *     // stream is automatically typed as TypedSSEStream!
 *     stream.send('message', { content: 'Hi', author: 'bot' }); // ✅ Type-safe!
 *     stream.send('typing', { userId: params.roomId, isTyping: true }); // ✅ Type-safe!
 *     // stream.send('unknown', {}); // ❌ TypeScript error!
 *   }
 * });
 * ```
 */
export const createSSERoute: CreateSSERoute = <
  _TState extends State = State,
  _TServices extends Services = Services,
  _TEvents extends EventSchemas = EventSchemas,
>() => {
  return (config: any) => {
    // Validate the configuration
    validateSSEConfig(config);

    // Get the route path
    const path = getRoutePath();

    // Create a wrapped handler that manages the SSE stream lifecycle
    const wrappedHandler = async ({
      ctx,
      params,
      logger,
      eventBus,
    }: {
      ctx: Context<_TState, _TServices, never, any>;
      params: any;
      logger: BlaizeLogger;
      eventBus: TypedEventBus<_TEvents>;
    }) => {
      // Validate SSE accept header
      const accept = ctx.request.header('accept');
      if (accept && !accept.includes('text/event-stream') && !accept.includes('*/*')) {
        throw new SSENotAcceptableError('This endpoint requires Server-Sent Events support', {
          acceptHeader: accept,
          requiredHeader: 'text/event-stream',
          endpoint: ctx.request.path,
        });
      }

      if (config.schema) {
        try {
          if (config.schema.params) {
            params = config.schema.params.parse(params);
          }
          if (config.schema.query) {
            ctx.request.query = config.schema.query.parse(ctx.request.query);
          }
        } catch (validationError) {
          // Validation failed BEFORE SSE started - safe to throw
          logger.error('[SSE] Validation error:', { error: validationError });
          throw validationError;
        }
      }

      // Create the SSE stream
      const baseStream = createSSEStream(ctx, config.options);
      const sseLogger = logger.child({
        streamId: baseStream.id,
        streamState: 'connected',
        eventStream: true,
      });

      // Create typed stream if event schemas provided
      const stream =
        config.schema?.events &&
        typeof config.schema.events === 'object' &&
        !config.schema.events._def
          ? createTypedStream(baseStream, config.schema.events)
          : baseStream;

      // Handle client disconnect
      ctx.request.raw.on('close', () => stream.close());

      try {
        await config.handler({ stream, ctx, params, logger: sseLogger, eventBus });
      } catch (error) {
        sseLogger.error('[SSE] Handler error - THIS IS THE REAL ERROR:', { error });
        sseLogger.error('[SSE] Stack trace:', {
          stack: error instanceof Error ? error.stack : 'No stack',
        });
        // Send error to stream if still writable
        if (stream.isWritable) {
          stream.sendError(error instanceof Error ? error : new Error(String(error)));
        }
        stream.close();

        throw error;
      }
    };

    // Return the route definition with GET method (SSE uses GET)
    return {
      GET: {
        handler: wrappedHandler,
        schema:
          config.schema?.params || config.schema?.query
            ? {
                params: config.schema?.params,
                query: config.schema?.query,
              }
            : undefined,
        middleware: config.middleware,
        options: config.options,
      },
      SSE: {
        schema: {
          params: config.schema?.params,
          query: config.schema?.query,
          events: config.schema?.events,
        },
      },
      path,
    } as const;
  };
};
