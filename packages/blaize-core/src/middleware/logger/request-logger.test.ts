/**
 * Tests for requestLoggerMiddleware
 *
 * Verifies lifecycle logging, header filtering, and error handling.
 * The logger parameter is passed to the middleware (already request-scoped).
 */

import { createMockLogger } from '@blaizejs/testing-utils';
import type { MockLogger } from '@blaizejs/testing-utils';

import { requestLoggerMiddleware } from './request-logger';
import { InternalServerError } from '../../errors/internal-server-error';
import { NotFoundError } from '../../errors/not-found-error';
import { ValidationError } from '../../errors/validation-error';

import type { Context } from '@blaize-types/context';

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
  let mockLogger: MockLogger;
  let ctx: Context;
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockLogger = createMockLogger();
    next = vi.fn(async () => {});
    ctx = createMockContext();
  });

  describe('Request lifecycle logging', () => {
    test('logs "Request started" with timestamp', async () => {
      const middleware = requestLoggerMiddleware();

      await middleware.execute(ctx, next, mockLogger);

      const startLog = mockLogger.logs.find(l => l.message === 'Request started');

      expect(startLog).toBeDefined();
      expect(startLog?.level).toBe('info');
      expect(startLog?.meta).toHaveProperty('timestamp');
    });

    test('logs "Request completed" on success', async () => {
      const middleware = requestLoggerMiddleware();

      await middleware.execute(ctx, next, mockLogger);

      const completedLog = mockLogger.logs.find(l => l.message === 'Request completed');

      expect(completedLog).toBeDefined();
      expect(completedLog?.level).toBe('info');
      expect(completedLog?.meta).toHaveProperty('statusCode', 200);
      expect(completedLog?.meta).toHaveProperty('duration');
      expect(completedLog?.meta).toHaveProperty('timestamp');
    });

    test('uses ctx.response.statusCode for completed log', async () => {
      ctx.response.statusCode = 201;
      const middleware = requestLoggerMiddleware();

      await middleware.execute(ctx, next, mockLogger);

      const completedLog = mockLogger.logs.find(l => l.message === 'Request completed');

      expect(completedLog?.meta?.statusCode).toBe(201);
    });

    test('defaults to 200 status code when not set', async () => {
      ctx.response.statusCode = undefined as any;
      const middleware = requestLoggerMiddleware();

      await middleware.execute(ctx, next, mockLogger);

      const completedLog = mockLogger.logs.find(l => l.message === 'Request completed');

      expect(completedLog?.meta?.statusCode).toBe(200);
    });

    test('calculates duration correctly', async () => {
      const middleware = requestLoggerMiddleware();

      const before = Date.now();
      await middleware.execute(
        ctx,
        async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
        },
        mockLogger
      );
      const after = Date.now();

      const completedLog = mockLogger.logs.find(l => l.message === 'Request completed');
      const duration = completedLog?.meta?.duration as number;

      expect(duration).toBeGreaterThanOrEqual(50);
      expect(duration).toBeLessThan(after - before + 10);
    });

    test('includes IP address when available', async () => {
      const middleware = requestLoggerMiddleware();

      await middleware.execute(ctx, next, mockLogger);

      const startLog = mockLogger.logs.find(l => l.message === 'Request started');
      expect(startLog?.meta).toHaveProperty('ip', '192.168.1.1');
    });

    test('omits IP when not available', async () => {
      ctx.request.raw = {} as any; // No socket
      const middleware = requestLoggerMiddleware();

      await middleware.execute(ctx, next, mockLogger);

      const startLog = mockLogger.logs.find(l => l.message === 'Request started');
      expect(startLog?.meta).not.toHaveProperty('ip');
    });
  });

  describe('Error handling', () => {
    test('logs "Request failed" when error occurs', async () => {
      const error = new Error('Test error');
      next.mockRejectedValue(error);

      const middleware = requestLoggerMiddleware();

      await expect(middleware.execute(ctx, next, mockLogger)).rejects.toThrow('Test error');

      const failedLog = mockLogger.logs.find(l => l.message === 'Request failed');

      expect(failedLog).toBeDefined();
      expect(failedLog?.level).toBe('error');
      expect(failedLog?.meta).toHaveProperty('duration');
      expect(failedLog?.meta).toHaveProperty('timestamp');
      expect(failedLog?.meta?.error).toMatchObject({
        message: 'Test error',
        name: 'Error',
      });
    });

    test('includes stack trace for standard errors', async () => {
      const error = new Error('Test error with stack');
      next.mockRejectedValue(error);

      const middleware = requestLoggerMiddleware();

      await expect(middleware.execute(ctx, next, mockLogger)).rejects.toThrow();

      const failedLog = mockLogger.logs.find(l => l.message === 'Request failed');
      expect(failedLog?.meta?.error).toHaveProperty('stack');
    });

    test('re-throws error after logging', async () => {
      const error = new Error('Test error');
      next.mockRejectedValue(error);

      const middleware = requestLoggerMiddleware();

      await expect(middleware.execute(ctx, next, mockLogger)).rejects.toThrow('Test error');

      // Verify error was logged before re-throwing
      const failedLog = mockLogger.logs.find(l => l.message === 'Request failed');
      expect(failedLog).toBeDefined();
    });

    test('handles BlaizeError with structured error info', async () => {
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
      next.mockRejectedValue(error);

      const middleware = requestLoggerMiddleware();

      await expect(middleware.execute(ctx, next, mockLogger)).rejects.toThrow();

      const failedLog = mockLogger.logs.find(l => l.message === 'Request failed');
      expect(failedLog?.meta?.error).toMatchObject({
        type: 'VALIDATION_ERROR',
        title: 'Validation failed',
        status: 400,
        message: 'Validation failed',
      });
    });

    test('includes stack trace only for 5xx BlaizeErrors', async () => {
      const error = new InternalServerError('Server error');
      next.mockRejectedValue(error);

      const middleware = requestLoggerMiddleware();

      await expect(middleware.execute(ctx, next, mockLogger)).rejects.toThrow();

      const failedLog = mockLogger.logs.find(l => l.message === 'Request failed');
      expect(failedLog?.meta?.error).toHaveProperty('stack');
    });

    test('does not include stack trace for 4xx BlaizeErrors', async () => {
      const error = new NotFoundError('Resource not found');
      next.mockRejectedValue(error);

      const middleware = requestLoggerMiddleware();

      await expect(middleware.execute(ctx, next, mockLogger)).rejects.toThrow();

      const failedLog = mockLogger.logs.find(l => l.message === 'Request failed');
      expect(failedLog?.meta?.error).not.toHaveProperty('stack');
    });

    test('handles non-Error thrown values', async () => {
      next.mockRejectedValue('String error');

      const middleware = requestLoggerMiddleware();

      await expect(middleware.execute(ctx, next, mockLogger)).rejects.toBe('String error');

      const failedLog = mockLogger.logs.find(l => l.message === 'Request failed');
      expect(failedLog?.meta?.error).toBe('String error');
    });
  });

  describe('Header inclusion', () => {
    test('includes headers when includeHeaders=true', async () => {
      ctx.request.headers = () => ({
        'content-type': 'application/json',
        'user-agent': 'Test/1.0',
      });

      const middleware = requestLoggerMiddleware({ includeHeaders: true });

      await middleware.execute(ctx, next, mockLogger);

      const startLog = mockLogger.logs.find(l => l.message === 'Request started');
      expect(startLog?.meta?.headers).toEqual({
        'content-type': 'application/json',
        'user-agent': 'Test/1.0',
      });
    });

    test('omits headers when includeHeaders=false', async () => {
      ctx.request.headers = () => ({
        'content-type': 'application/json',
      });

      const middleware = requestLoggerMiddleware({ includeHeaders: false });

      await middleware.execute(ctx, next, mockLogger);

      const startLog = mockLogger.logs.find(l => l.message === 'Request started');
      expect(startLog?.meta).not.toHaveProperty('headers');
    });

    test('redacts sensitive headers even when in custom whitelist', async () => {
      ctx.request.headers = () => ({
        'content-type': 'application/json',
        authorization: 'Bearer secret-token',
        cookie: 'session=xyz',
      });

      // ✅ Explicitly whitelist sensitive headers (should still be redacted)
      const middleware = requestLoggerMiddleware({
        includeHeaders: true,
        headerWhitelist: ['content-type', 'authorization', 'cookie'], // ✅ Try to whitelist sensitive headers
      });

      await middleware.execute(ctx, next, mockLogger);

      const startLog = mockLogger.logs.find(l => l.message === 'Request started');
      expect(startLog?.meta?.headers).toEqual({
        'content-type': 'application/json',
        authorization: '[REDACTED]', // ✅ Still redacted despite whitelist
        cookie: '[REDACTED]', // ✅ Still redacted despite whitelist
      });
    });

    test('filters headers by whitelist', async () => {
      ctx.request.headers = () => ({
        'content-type': 'application/json',
        'user-agent': 'Test/1.0',
        'x-custom': 'value',
      });

      const middleware = requestLoggerMiddleware({
        includeHeaders: true,
        headerWhitelist: ['content-type', 'user-agent'],
      });

      await middleware.execute(ctx, next, mockLogger);

      const startLog = mockLogger.logs.find(l => l.message === 'Request started');
      expect(startLog?.meta?.headers).toEqual({
        'content-type': 'application/json',
        'user-agent': 'Test/1.0',
      });
      expect(startLog?.meta?.headers).not.toHaveProperty('x-custom');
    });

    test('uses default safe headers when no whitelist provided', async () => {
      ctx.request.headers = () => ({
        'content-type': 'application/json',
        accept: 'application/json',
        'user-agent': 'Test/1.0',
        'x-custom': 'value',
      });

      const middleware = requestLoggerMiddleware({ includeHeaders: true });

      await middleware.execute(ctx, next, mockLogger);

      const startLog = mockLogger.logs.find(l => l.message === 'Request started');
      // Should include default safe headers
      expect(startLog?.meta?.headers).toHaveProperty('content-type');
      expect(startLog?.meta?.headers).toHaveProperty('accept');
      expect(startLog?.meta?.headers).toHaveProperty('user-agent');
      // Should not include non-whitelisted headers
      expect(startLog?.meta?.headers).not.toHaveProperty('x-custom');
    });

    test('always redacts sensitive headers even if in whitelist', async () => {
      ctx.request.headers = () => ({
        'content-type': 'application/json',
        authorization: 'Bearer secret-token',
      });

      const middleware = requestLoggerMiddleware({
        includeHeaders: true,
        headerWhitelist: ['content-type', 'authorization'], // Try to whitelist authorization
      });

      await middleware.execute(ctx, next, mockLogger);

      const startLog = mockLogger.logs.find(l => l.message === 'Request started');
      expect(startLog?.meta?.headers).toEqual({
        'content-type': 'application/json',
        authorization: '[REDACTED]', // Still redacted!
      });
    });
  });

  describe('Query parameter inclusion', () => {
    test('includes query params when includeQuery=true', async () => {
      ctx.request.query = {
        page: '1',
        limit: '10',
      };

      const middleware = requestLoggerMiddleware({ includeQuery: true });

      await middleware.execute(ctx, next, mockLogger);

      const startLog = mockLogger.logs.find(l => l.message === 'Request started');
      expect(startLog?.meta?.query).toEqual({
        page: '1',
        limit: '10',
      });
    });

    test('omits query params when includeQuery=false', async () => {
      ctx.request.query = {
        page: '1',
      };

      const middleware = requestLoggerMiddleware({ includeQuery: false });

      await middleware.execute(ctx, next, mockLogger);

      const startLog = mockLogger.logs.find(l => l.message === 'Request started');
      expect(startLog?.meta).not.toHaveProperty('query');
    });

    test('omits query params when empty', async () => {
      ctx.request.query = {};

      const middleware = requestLoggerMiddleware({ includeQuery: true });

      await middleware.execute(ctx, next, mockLogger);

      const startLog = mockLogger.logs.find(l => l.message === 'Request started');
      expect(startLog?.meta).not.toHaveProperty('query');
    });
  });

  describe('Middleware chain continuation', () => {
    test('calls next() middleware', async () => {
      const middleware = requestLoggerMiddleware();

      await middleware.execute(ctx, next, mockLogger);

      expect(next).toHaveBeenCalledTimes(1);
    });

    test('executes middleware chain in correct order', async () => {
      const executionOrder: string[] = [];

      const middleware = requestLoggerMiddleware();

      await middleware.execute(
        ctx,
        async () => {
          executionOrder.push('next');
        },
        mockLogger
      );

      // Verify logs occurred before and after next()
      const logs = mockLogger.logs.map(l => l.message);
      expect(logs).toEqual(['Request started', 'Request completed']);
      expect(executionOrder).toEqual(['next']);
    });
  });
});
