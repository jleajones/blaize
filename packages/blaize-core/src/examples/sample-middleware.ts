/**
 * Example logger middleware with full type safety
 * Demonstrates how to create typed middleware for BlaizeJS
 */
import { getCorrelationId } from 'src/tracing/correlation';

import type { Middleware, MiddlewareFunction, Services, State } from '@blaize-types/index';

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
 * Creates a typed logger middleware
 */
export function createLoggerMiddleware(
  options: LoggerOptions = {}
): Middleware<LoggerState, LoggerServices> {
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

  const execute: MiddlewareFunction = async (ctx, next) => {
    const startTime = Date.now();

    // Add state
    ctx.state.startTime = startTime;

    // Check for correlation ID from headers
    const correlationId = getCorrelationId();

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
          status: ctx.response.status,
          duration: `${duration}ms`,
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`✗ ${ctx.request.method} ${ctx.request.path}`, {
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: `${duration}ms`,
      });
      throw error;
    }
  };

  return {
    name: 'logger',
    execute,
  };
}
