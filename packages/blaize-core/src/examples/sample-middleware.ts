/**
 * Logger middleware using BlaizeJS framework's actual create function
 */

import { create as createMiddleware } from '../middleware/create';
import { getCorrelationId } from '../tracing/correlation';

import type { State, Services } from '@blaize-types/index';

/**
 * Logger configuration options
 */
export interface LoggerOptions {
  /** Prefix for all log messages */
  prefix?: string;
  /** Whether to log request details */
  logRequests?: boolean;
  /** Whether to log response details */
  logResponses?: boolean;
  /** Timestamp format function */
  timestampFn?: () => string;
}

/**
 * Logger service interface
 */
export interface LoggerService {
  info: (message: string, ...args: any[]) => void;
  error: (message: string, ...args: any[]) => void;
  warn: (message: string, ...args: any[]) => void;
  debug: (message: string, ...args: any[]) => void;
}

/**
 * State contributed by logger middleware
 */
export interface LoggerState extends State {
  startTime: number;
  correlationId: string;
}

/**
 * Services contributed by logger middleware
 */
export interface LoggerServices extends Services {
  logger: LoggerService;
}

/**
 * Creates a typed logger middleware using the framework's create function
 *
 * @example
 * ```typescript
 * import { loggerMiddleware } from './middleware/logger';
 *
 * const server = createServer()
 *   .use(loggerMiddleware({ prefix: '[API]' }));
 * ```
 */
export function loggerMiddleware(options: LoggerOptions = {}) {
  const {
    prefix = '[Server]',
    logRequests = true,
    logResponses = true,
    timestampFn = () => new Date().toISOString(),
  } = options;

  // Create the logger service
  const logger: LoggerService = {
    info: (message: string, ...args: any[]) => {
      console.log(`${timestampFn()} ${prefix} INFO:`, message, ...args);
    },
    error: (message: string, ...args: any[]) => {
      console.error(`${timestampFn()} ${prefix} ERROR:`, message, ...args);
    },
    warn: (message: string, ...args: any[]) => {
      console.warn(`${timestampFn()} ${prefix} WARN:`, message, ...args);
    },
    debug: (message: string, ...args: any[]) => {
      if (process.env.NODE_ENV === 'development') {
        console.debug(`${timestampFn()} ${prefix} DEBUG:`, message, ...args);
      }
    },
  };

  // Use the framework's create function with MiddlewareOptions
  return createMiddleware<LoggerState, LoggerServices>({
    name: 'logger',
    handler: async (ctx, next) => {
      const startTime = Date.now();
      const correlationId = getCorrelationId();

      // Add state
      ctx.state.startTime = startTime;
      ctx.state.correlationId = correlationId;

      // Add logger service
      (ctx.services as any).logger = logger;

      // Log request
      if (logRequests) {
        logger.info(`→ ${ctx.request.method} ${ctx.request.path}`, {
          correlationId,
          query: ctx.request.query,
          headers: ctx.request.headers,
        });
      }

      try {
        // Continue to next middleware
        await next();

        // Log response
        if (logResponses) {
          const duration = Date.now() - startTime;
          logger.info(`← ${ctx.request.method} ${ctx.request.path}`, {
            correlationId,
            status: ctx.response.statusCode,
            duration: `${duration}ms`,
          });
        }
      } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`✗ ${ctx.request.method} ${ctx.request.path}`, {
          correlationId,
          status: ctx.response.statusCode,
          error: error instanceof Error ? error.message : 'Unknown error',
          duration: `${duration}ms`,
        });
        throw error;
      }
    },
    // Optional: add debug flag
    debug: process.env.NODE_ENV === 'development',
    // Optional: add skip condition
    skip: ctx => {
      // Skip logging for health checks if needed
      return ctx.request.path === '/health' && !options.logRequests;
    },
  });
}
