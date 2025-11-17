/* eslint-disable @typescript-eslint/no-empty-object-type */
/**
 * Tests for Logger Middleware
 *
 * Verifies that the logger middleware correctly provides ctx.services.log
 * with request metadata and correlation ID.
 */

import { createMockContext } from '@blaizejs/testing-utils';

import { createLoggerMiddleware } from './create';
import * as correlation from '../../tracing/correlation';

import type { BlaizeLogger, LogMetadata } from '@blaize-types/logger';

/**
 * Mock logger implementation for testing
 */
class MockLogger implements BlaizeLogger {
  public logs: Array<{ level: string; message: string; meta?: LogMetadata }> = [];
  public childContexts: LogMetadata[] = [];

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

  child(context: LogMetadata): BlaizeLogger {
    this.childContexts.push(context);
    const childLogger = new MockLogger();
    // Inherit parent logs reference for easier testing
    childLogger.logs = this.logs;
    return childLogger;
  }

  async flush(): Promise<void> {
    // No-op for mock
  }
}

describe('createLoggerMiddleware', () => {
  let serverLogger: MockLogger;
  let getCorrelationIdSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    serverLogger = new MockLogger();
    getCorrelationIdSpy = vi.spyOn(correlation, 'getCorrelationId');
  });

  test('creates middleware with correct name', () => {
    const middleware = createLoggerMiddleware(serverLogger);

    expect(middleware.name).toBe('__logger');
  });

  test('provides ctx.services.log as child logger', async () => {
    getCorrelationIdSpy.mockReturnValue('test-correlation-id');

    const middleware = createLoggerMiddleware(serverLogger);
    const ctx = createMockContext<{}, { log: BlaizeLogger }>({
      method: 'GET',
      path: '/api/users',
    });

    const next = vi.fn(async () => {});

    await middleware.execute(ctx, next);

    // Verify ctx.services.log exists
    expect(ctx.services.log).toBeDefined();
    expect(typeof ctx.services.log.info).toBe('function');
    expect(typeof ctx.services.log.error).toBe('function');
  });

  test('child logger includes correlation ID', async () => {
    getCorrelationIdSpy.mockReturnValue('req_12345');

    const middleware = createLoggerMiddleware(serverLogger);
    const ctx = createMockContext({
      method: 'POST',
      path: '/api/login',
    });

    await middleware.execute(
      ctx,
      vi.fn(async () => {})
    );

    // Verify child was created with correlation ID
    expect(serverLogger.childContexts).toHaveLength(1);
    expect(serverLogger.childContexts[0]).toEqual({
      correlationId: 'req_12345',
      method: 'POST',
      path: '/api/login',
    });
  });

  test('child logger includes request method', async () => {
    getCorrelationIdSpy.mockReturnValue('req_99999');

    const middleware = createLoggerMiddleware(serverLogger);
    const ctx = createMockContext({
      method: 'DELETE',
      path: '/api/users/123',
    });

    await middleware.execute(
      ctx,
      vi.fn(async () => {})
    );

    expect(serverLogger.childContexts[0]).toMatchObject({
      method: 'DELETE',
    });
  });

  test('child logger includes request path', async () => {
    getCorrelationIdSpy.mockReturnValue('req_00000');

    const middleware = createLoggerMiddleware(serverLogger);
    const ctx = createMockContext({
      method: 'PATCH',
      path: '/api/posts/456',
    });

    await middleware.execute(
      ctx,
      vi.fn(async () => {})
    );

    expect(serverLogger.childContexts[0]).toMatchObject({
      path: '/api/posts/456',
    });
  });

  test('calls next() to continue middleware chain', async () => {
    getCorrelationIdSpy.mockReturnValue('req_chain');

    const middleware = createLoggerMiddleware(serverLogger);
    const ctx = createMockContext({
      method: 'GET',
      path: '/test',
    });

    const next = vi.fn(async () => {});

    await middleware.execute(ctx, next);

    expect(next).toHaveBeenCalledOnce();
  });

  test('logger is available in next() execution', async () => {
    getCorrelationIdSpy.mockReturnValue('req_available');

    const middleware = createLoggerMiddleware(serverLogger);
    const ctx = createMockContext<{}, { log: BlaizeLogger }>({
      method: 'GET',
      path: '/test',
    });

    let loggerInNext: BlaizeLogger | undefined;
    const next = vi.fn(async () => {
      loggerInNext = ctx.services.log;
    });

    await middleware.execute(ctx, next);

    expect(loggerInNext).toBeDefined();
    expect(loggerInNext).toBe(ctx.services.log);
  });

  test('logger can be used by downstream middleware', async () => {
    getCorrelationIdSpy.mockReturnValue('req_downstream');

    const middleware = createLoggerMiddleware(serverLogger);
    const ctx = createMockContext<{}, { log: BlaizeLogger }>({
      method: 'POST',
      path: '/api/data',
    });

    const next = vi.fn(async () => {
      // Simulate downstream middleware using the logger
      ctx.services.log.info('Processing request', { userId: '123' });
    });

    await middleware.execute(ctx, next);

    // Verify the log was captured
    expect(serverLogger.logs).toHaveLength(1);
    expect(serverLogger.logs[0]).toEqual({
      level: 'info',
      message: 'Processing request',
      meta: { userId: '123' },
    });
  });

  test('handles errors from next() properly', async () => {
    getCorrelationIdSpy.mockReturnValue('req_error');

    const middleware = createLoggerMiddleware(serverLogger);
    const ctx = createMockContext({
      method: 'GET',
      path: '/error',
    });

    const error = new Error('Test error');
    const next = vi.fn(async () => {
      throw error;
    });

    await expect(middleware.execute(ctx, next)).rejects.toThrow('Test error');

    // Logger should still be set before error
    expect(ctx.services.log).toBeDefined();
  });

  test('creates independent child logger for each request', async () => {
    getCorrelationIdSpy.mockReturnValueOnce('req_first').mockReturnValueOnce('req_second');

    const middleware = createLoggerMiddleware(serverLogger);

    // First request
    const ctx1 = createMockContext({
      method: 'GET',
      path: '/first',
    });
    await middleware.execute(
      ctx1,
      vi.fn(async () => {})
    );

    // Second request
    const ctx2 = createMockContext({
      method: 'POST',
      path: '/second',
    });
    await middleware.execute(
      ctx2,
      vi.fn(async () => {})
    );

    // Verify two separate child loggers were created
    expect(serverLogger.childContexts).toHaveLength(2);
    expect(serverLogger.childContexts[0]).toEqual({
      correlationId: 'req_first',
      method: 'GET',
      path: '/first',
    });
    expect(serverLogger.childContexts[1]).toEqual({
      correlationId: 'req_second',
      method: 'POST',
      path: '/second',
    });
  });

  test('middleware type signature contributes { log: BlaizeLogger }', () => {
    const middleware = createLoggerMiddleware(serverLogger);

    // TypeScript compilation test - verify the type signature
    type _MiddlewareServices = typeof middleware extends {
      handler: (ctx: any, next: any) => any;
      contributes: { services: infer S };
    }
      ? S
      : never;

    // This test primarily validates at compile-time
    // At runtime, we just verify the handler exists
    expect(middleware.execute).toBeDefined();
  });
});
