/**
 * Tests for requestLoggerMiddleware
 *
 * Verifies child logger creation, request context inclusion,
 * lifecycle logging, header filtering, and error handling.
 */

import { requestLoggerMiddleware } from './request-logger';
import { InternalServerError } from '../../errors/internal-server-error';
import { NotFoundError } from '../../errors/not-found-error';
import { ValidationError } from '../../errors/validation-error';

import type { Context } from '@blaize-types/context';
import type { BlaizeLogger, LogLevel, LogMetadata } from '@blaize-types/logger';

// Mock correlation ID
vi.mock('../../tracing/correlation', () => ({
  getCorrelationId: vi.fn(() => 'test-correlation-123'),
}));

/**
 * Mock logger for testing
 */
class MockLogger implements BlaizeLogger {
  public logs: Array<{ level: LogLevel; message: string; meta?: LogMetadata }> = [];
  public childMetadata: LogMetadata = {};
  public flushCalled = false;

  debug(message: string, meta?: LogMetadata): void {
    this.logs.push({ level: 'debug', message, meta });
  }

  info(message: string, meta?: LogMetadata): void {
    this.logs.push({ level: 'info', message, meta });
  }

  warn(message: string, meta?: LogMetadata): void {
    this.logs.push({ level: 'warn', message, meta });
  }

  error(message: string, meta?: LogMetadata): void {
    this.logs.push({ level: 'error', message, meta });
  }

  child(meta: LogMetadata): BlaizeLogger {
    const childLogger = new MockLogger();
    childLogger.childMetadata = { ...this.childMetadata, ...meta };
    return childLogger;
  }

  async flush(): Promise<void> {
    this.flushCalled = true;
  }

  clear(): void {
    this.logs = [];
    this.flushCalled = false;
  }
}

/**
 * Create mock context for testing
 */
function createMockContext(overrides?: Partial<Context>): Context {
  const ctx: Context = {
    request: {
      raw: {
        socket: {
          remoteAddress: '192.168.1.1',
        },
      } as any,
      method: 'GET',
      path: '/api/users',
      url: null,
      query: {},
      params: {},
      protocol: 'http',
      isHttp2: false,
      header: (_name: string) => undefined,
      headers: (_names?: string[]) => ({}),
    } as any,
    response: {
      statusCode: 200,
      sent: false,
    } as any,
    state: {},
    services: {},
    ...overrides,
  };

  return ctx;
}

describe('requestLoggerMiddleware', () => {
  let rootLogger: MockLogger;
  let ctx: Context;
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    rootLogger = new MockLogger();
    next = vi.fn(async () => {});

    ctx = createMockContext({
      services: {
        log: rootLogger,
      },
    });
  });

  describe('Child logger creation', () => {
    test('always creates child logger with request context', async () => {
      const middleware = requestLoggerMiddleware(undefined, false);

      await middleware.execute(ctx, next);

      // ctx.services.log should be replaced with child logger
      expect(ctx.services.log).not.toBe(rootLogger);
      expect(ctx.services.log).toBeDefined();

      // Child logger should have request context
      const childLogger = ctx.services.log as MockLogger;
      expect(childLogger.childMetadata).toMatchObject({
        correlationId: 'test-correlation-123',
        method: 'GET',
        path: '/api/users',
        ip: '192.168.1.1',
      });
    });

    test('includes correlationId in child metadata', async () => {
      const middleware = requestLoggerMiddleware();

      await middleware.execute(ctx, next);

      const childLogger = ctx.services.log as MockLogger;
      expect(childLogger.childMetadata.correlationId).toBe('test-correlation-123');
    });

    test('includes method in child metadata', async () => {
      ctx.request.method = 'POST';
      const middleware = requestLoggerMiddleware();

      await middleware.execute(ctx, next);

      const childLogger = ctx.services.log as MockLogger;
      expect(childLogger.childMetadata.method).toBe('POST');
    });

    test('includes path in child metadata', async () => {
      ctx.request.path = '/api/posts/123';
      const middleware = requestLoggerMiddleware();

      await middleware.execute(ctx, next);

      const childLogger = ctx.services.log as MockLogger;
      expect(childLogger.childMetadata.path).toBe('/api/posts/123');
    });

    test('includes IP address when available', async () => {
      const middleware = requestLoggerMiddleware();

      await middleware.execute(ctx, next);

      const childLogger = ctx.services.log as MockLogger;
      expect(childLogger.childMetadata.ip).toBe('192.168.1.1');
    });

    test('omits IP when not available', async () => {
      ctx.request.raw = {} as any; // No socket
      const middleware = requestLoggerMiddleware();

      await middleware.execute(ctx, next);

      const childLogger = ctx.services.log as MockLogger;
      expect(childLogger.childMetadata).not.toHaveProperty('ip');
    });

    test('works when no root logger is configured', async () => {
      ctx.services = {}; // No logger
      const middleware = requestLoggerMiddleware();

      // Should not throw
      await expect(middleware.execute(ctx, next)).resolves.toBeUndefined();
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Request lifecycle logging', () => {
    test('logs "Request started" when requestLogging=true', async () => {
      const middleware = requestLoggerMiddleware(undefined, true);

      await middleware.execute(ctx, next);

      const childLogger = ctx.services.log as MockLogger;
      const startLog = childLogger.logs.find(l => l.message === 'Request started');

      expect(startLog).toBeDefined();
      expect(startLog?.level).toBe('info');
      expect(startLog?.meta).toHaveProperty('timestamp');
    });

    test('logs "Request completed" on success when requestLogging=true', async () => {
      const middleware = requestLoggerMiddleware(undefined, true);

      await middleware.execute(ctx, next);

      const childLogger = ctx.services.log as MockLogger;
      const completedLog = childLogger.logs.find(l => l.message === 'Request completed');

      expect(completedLog).toBeDefined();
      expect(completedLog?.level).toBe('info');
      expect(completedLog?.meta).toHaveProperty('statusCode', 200);
      expect(completedLog?.meta).toHaveProperty('duration');
      expect(completedLog?.meta).toHaveProperty('timestamp');
    });

    test('uses ctx.response.statusCode for completed log', async () => {
      ctx.response.statusCode = 201;
      const middleware = requestLoggerMiddleware(undefined, true);

      await middleware.execute(ctx, next);

      const childLogger = ctx.services.log as MockLogger;
      const completedLog = childLogger.logs.find(l => l.message === 'Request completed');

      expect(completedLog?.meta?.statusCode).toBe(201);
    });

    test('defaults to 200 status code when not set', async () => {
      ctx.response.statusCode = undefined as any;
      const middleware = requestLoggerMiddleware(undefined, true);

      await middleware.execute(ctx, next);

      const childLogger = ctx.services.log as MockLogger;
      const completedLog = childLogger.logs.find(l => l.message === 'Request completed');

      expect(completedLog?.meta?.statusCode).toBe(200);
    });

    test('calculates duration correctly', async () => {
      const middleware = requestLoggerMiddleware(undefined, true);

      const before = Date.now();
      await middleware.execute(ctx, async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      });
      const after = Date.now();

      const childLogger = ctx.services.log as MockLogger;
      const completedLog = childLogger.logs.find(l => l.message === 'Request completed');

      const duration = completedLog?.meta?.duration as number;
      expect(duration).toBeGreaterThanOrEqual(40); // Allow some slack
      expect(duration).toBeLessThanOrEqual(after - before + 10);
    });

    test('does NOT log lifecycle events when requestLogging=false', async () => {
      const middleware = requestLoggerMiddleware(undefined, false);

      await middleware.execute(ctx, next);

      const childLogger = ctx.services.log as MockLogger;

      // Should have no logs
      expect(childLogger.logs).toHaveLength(0);
    });

    test('child logger still has request context when requestLogging=false', async () => {
      const middleware = requestLoggerMiddleware(undefined, false);

      await middleware.execute(ctx, next);

      const childLogger = ctx.services.log as MockLogger;

      // No lifecycle logs, but child logger should exist with metadata
      expect(childLogger.logs).toHaveLength(0);
      expect(childLogger.childMetadata).toMatchObject({
        correlationId: 'test-correlation-123',
        method: 'GET',
        path: '/api/users',
      });
    });
  });

  describe('Error handling', () => {
    test('logs "Request failed" when error occurs', async () => {
      const error = new Error('Test error');
      next.mockRejectedValueOnce(error);

      const middleware = requestLoggerMiddleware(undefined, true);

      await expect(middleware.execute(ctx, next)).rejects.toThrow('Test error');

      const childLogger = ctx.services.log as MockLogger;
      const failedLog = childLogger.logs.find(l => l.message === 'Request failed');

      expect(failedLog).toBeDefined();
      expect(failedLog?.level).toBe('error');
      expect(failedLog?.meta).toHaveProperty('duration');
      expect(failedLog?.meta).toHaveProperty('timestamp');
      expect(failedLog?.meta).toHaveProperty('error');
    });

    test('includes error details in log', async () => {
      const error = new Error('Database connection failed');
      error.stack = 'Error: Database connection failed\n    at test.ts:123';
      next.mockRejectedValueOnce(error);

      const middleware = requestLoggerMiddleware(undefined, true);

      await expect(middleware.execute(ctx, next)).rejects.toThrow();

      const childLogger = ctx.services.log as MockLogger;
      const failedLog = childLogger.logs.find(l => l.message === 'Request failed');

      const errorMeta = failedLog?.meta?.error as any;
      expect(errorMeta).toMatchObject({
        message: 'Database connection failed',
        name: 'Error',
        stack: expect.stringContaining('Database connection failed'),
      });
    });

    test('handles non-Error thrown values', async () => {
      next.mockRejectedValueOnce('String error');

      const middleware = requestLoggerMiddleware(undefined, true);

      await expect(middleware.execute(ctx, next)).rejects.toBe('String error');

      const childLogger = ctx.services.log as MockLogger;
      const failedLog = childLogger.logs.find(l => l.message === 'Request failed');

      expect(failedLog?.meta?.error).toBe('String error');
    });

    test('handles BlaizeError with structured details', async () => {
      const error = new NotFoundError('User not found', {
        resourceType: 'user',
        resourceId: '123',
      });
      next.mockRejectedValueOnce(error);

      const middleware = requestLoggerMiddleware(undefined, true);

      await expect(middleware.execute(ctx, next)).rejects.toThrow('User not found');

      const childLogger = ctx.services.log as MockLogger;
      const failedLog = childLogger.logs.find(l => l.message === 'Request failed');

      const errorMeta = failedLog?.meta?.error as any;
      expect(errorMeta).toMatchObject({
        type: 'NOT_FOUND',
        title: 'User not found',
        status: 404,
        message: 'User not found',
        details: {
          resourceType: 'user',
          resourceId: '123',
        },
      });

      // 404 errors should not include stack trace
      expect(errorMeta).not.toHaveProperty('stack');
    });

    test('includes stack trace for BlaizeError with 5xx status', async () => {
      const error = new InternalServerError('Database failure', {
        originalError: 'Connection timeout',
      });
      next.mockRejectedValueOnce(error);

      const middleware = requestLoggerMiddleware(undefined, true);

      await expect(middleware.execute(ctx, next)).rejects.toThrow();

      const childLogger = ctx.services.log as MockLogger;
      const failedLog = childLogger.logs.find(l => l.message === 'Request failed');

      const errorMeta = failedLog?.meta?.error as any;
      expect(errorMeta).toMatchObject({
        type: 'INTERNAL_SERVER_ERROR',
        status: 500,
        message: 'Database failure',
      });

      // 5xx errors should include stack trace
      expect(errorMeta).toHaveProperty('stack');
      expect(typeof errorMeta.stack).toBe('string');
    });

    test('handles ValidationError with field details', async () => {
      const error = new ValidationError('Validation failed', {
        fields: [
          {
            field: 'email',
            messages: ['Invalid email format'],
            rejectedValue: 'not-an-email',
          },
        ],
        errorCount: 1,
        section: 'body',
      });
      next.mockRejectedValueOnce(error);

      const middleware = requestLoggerMiddleware(undefined, true);

      await expect(middleware.execute(ctx, next)).rejects.toThrow();

      const childLogger = ctx.services.log as MockLogger;
      const failedLog = childLogger.logs.find(l => l.message === 'Request failed');

      const errorMeta = failedLog?.meta?.error as any;
      expect(errorMeta).toMatchObject({
        type: 'VALIDATION_ERROR',
        status: 400,
        details: {
          fields: expect.arrayContaining([
            expect.objectContaining({
              field: 'email',
              messages: ['Invalid email format'],
            }),
          ]),
        },
      });

      // 4xx errors should not include stack trace
      expect(errorMeta).not.toHaveProperty('stack');
    });

    test('re-throws error after logging', async () => {
      const error = new Error('Test error');
      next.mockRejectedValueOnce(error);

      const middleware = requestLoggerMiddleware(undefined, true);

      await expect(middleware.execute(ctx, next)).rejects.toThrow('Test error');
    });

    test('does NOT log error when requestLogging=false', async () => {
      const error = new Error('Test error');
      next.mockRejectedValueOnce(error);

      const middleware = requestLoggerMiddleware(undefined, false);

      await expect(middleware.execute(ctx, next)).rejects.toThrow('Test error');

      const childLogger = ctx.services.log as MockLogger;
      expect(childLogger.logs).toHaveLength(0);
    });
  });

  describe('Header filtering', () => {
    test('includes headers when includeHeaders=true', async () => {
      ctx.request.headers = () => ({
        'content-type': 'application/json',
        'user-agent': 'TestAgent/1.0',
        accept: 'application/json',
      });

      const middleware = requestLoggerMiddleware({ includeHeaders: true }, false);

      await middleware.execute(ctx, next);

      const childLogger = ctx.services.log as MockLogger;
      expect(childLogger.childMetadata.headers).toMatchObject({
        'content-type': 'application/json',
        'user-agent': 'TestAgent/1.0',
        accept: 'application/json',
      });
    });

    test('uses default safe headers when no whitelist provided', async () => {
      ctx.request.headers = () => ({
        'content-type': 'application/json',
        authorization: 'Bearer secret',
        'x-custom-header': 'custom-value',
      });

      const middleware = requestLoggerMiddleware({ includeHeaders: true }, false);

      await middleware.execute(ctx, next);

      const childLogger = ctx.services.log as MockLogger;
      const headers = childLogger.childMetadata.headers as Record<string, any>;

      // Should include content-type (default safe header)
      expect(headers['content-type']).toBe('application/json');

      // Should NOT include authorization (not in default whitelist)
      expect(headers).not.toHaveProperty('authorization');

      // Should NOT include custom header (not in default whitelist)
      expect(headers).not.toHaveProperty('x-custom-header');
    });

    test('uses custom headerWhitelist when provided', async () => {
      ctx.request.headers = () => ({
        'content-type': 'application/json',
        'x-custom-header': 'custom-value',
        'user-agent': 'TestAgent/1.0',
      });

      const middleware = requestLoggerMiddleware(
        {
          includeHeaders: true,
          headerWhitelist: ['content-type', 'x-custom-header'],
        },
        false
      );

      await middleware.execute(ctx, next);

      const childLogger = ctx.services.log as MockLogger;
      const headers = childLogger.childMetadata.headers as Record<string, any>;

      expect(headers['content-type']).toBe('application/json');
      expect(headers['x-custom-header']).toBe('custom-value');
      expect(headers).not.toHaveProperty('user-agent');
    });

    test('ALWAYS redacts sensitive headers even if in whitelist', async () => {
      ctx.request.headers = () => ({
        authorization: 'Bearer secret-token',
        cookie: 'session=abc123',
        'x-api-key': 'api-key-secret',
        'content-type': 'application/json',
      });

      const middleware = requestLoggerMiddleware(
        {
          includeHeaders: true,
          headerWhitelist: ['authorization', 'cookie', 'x-api-key', 'content-type'],
        },
        false
      );

      await middleware.execute(ctx, next);

      const childLogger = ctx.services.log as MockLogger;
      const headers = childLogger.childMetadata.headers as Record<string, any>;

      // Sensitive headers should be redacted
      expect(headers.authorization).toBe('[REDACTED]');
      expect(headers.cookie).toBe('[REDACTED]');
      expect(headers['x-api-key']).toBe('[REDACTED]');

      // Non-sensitive header should pass through
      expect(headers['content-type']).toBe('application/json');
    });

    test('header filtering is case-insensitive', async () => {
      ctx.request.headers = () => ({
        'Content-Type': 'application/json',
        'USER-AGENT': 'TestAgent/1.0',
      });

      const middleware = requestLoggerMiddleware(
        {
          includeHeaders: true,
          headerWhitelist: ['content-type', 'user-agent'],
        },
        false
      );

      await middleware.execute(ctx, next);

      const childLogger = ctx.services.log as MockLogger;
      const headers = childLogger.childMetadata.headers as Record<string, any>;

      expect(headers['Content-Type']).toBe('application/json');
      expect(headers['USER-AGENT']).toBe('TestAgent/1.0');
    });

    test('does NOT include headers when includeHeaders=false', async () => {
      ctx.request.headers = () => ({
        'content-type': 'application/json',
        'user-agent': 'TestAgent/1.0',
      });

      const middleware = requestLoggerMiddleware({ includeHeaders: false }, false);

      await middleware.execute(ctx, next);

      const childLogger = ctx.services.log as MockLogger;
      expect(childLogger.childMetadata).not.toHaveProperty('headers');
    });
  });

  describe('Query parameter inclusion', () => {
    test('includes query parameters when includeQuery=true', async () => {
      ctx.request.query = {
        page: '1',
        limit: '10',
        filter: 'active',
      };

      const middleware = requestLoggerMiddleware({ includeQuery: true }, false);

      await middleware.execute(ctx, next);

      const childLogger = ctx.services.log as MockLogger;
      expect(childLogger.childMetadata.query).toEqual({
        page: '1',
        limit: '10',
        filter: 'active',
      });
    });

    test('does NOT include query when includeQuery=false', async () => {
      ctx.request.query = {
        page: '1',
        limit: '10',
      };

      const middleware = requestLoggerMiddleware({ includeQuery: false }, false);

      await middleware.execute(ctx, next);

      const childLogger = ctx.services.log as MockLogger;
      expect(childLogger.childMetadata).not.toHaveProperty('query');
    });

    test('omits empty query object', async () => {
      ctx.request.query = {};

      const middleware = requestLoggerMiddleware({ includeQuery: true }, false);

      await middleware.execute(ctx, next);

      const childLogger = ctx.services.log as MockLogger;
      expect(childLogger.childMetadata).not.toHaveProperty('query');
    });
  });

  describe('Middleware properties', () => {
    test('has name "requestLogger"', () => {
      const middleware = requestLoggerMiddleware();

      expect(middleware.name).toBe('requestLogger');
    });

    test('calls next() middleware', async () => {
      const middleware = requestLoggerMiddleware();

      await middleware.execute(ctx, next);

      expect(next).toHaveBeenCalledOnce();
    });
  });
});
