/* eslint-disable @typescript-eslint/no-empty-object-type */
import { createMockLogger } from '@blaizejs/testing-utils';
import type { MockLogger } from '@blaizejs/testing-utils';

import { create, serviceMiddleware, stateMiddleware } from './create';

import type { Context } from '@blaize-types/context';
import type { MiddlewareOptions, MiddlewareFunction } from '@blaize-types/middleware';

describe('createMiddleware', () => {
  let mockContext: Context;
  let mockNext: ReturnType<typeof vi.fn>;
  let mockLogger: MockLogger;

  beforeEach(() => {
    mockContext = {
      state: {},
      services: {},
    } as Context;
    mockNext = vi.fn(async () => {});
    mockLogger = createMockLogger();
  });

  // Helper to create a test middleware function with 3 parameters
  function createTestMiddlewareFunction(): MiddlewareFunction {
    return vi.fn((_ctx, next, _logger) => next()); // ← Now has 3 parameters
  }

  // Helper to create test middleware options with all fields
  function createTestMiddlewareOptions(
    overrides: Partial<MiddlewareOptions> = {}
  ): MiddlewareOptions {
    const testFn = createTestMiddlewareFunction();

    return {
      name: overrides.name || 'test-middleware',
      handler: overrides.handler || testFn,
      skip: overrides.skip || undefined,
      debug: overrides.debug ?? false,
    };
  }

  test('creates middleware from a function', () => {
    const testFn = createTestMiddlewareFunction();
    const middleware = create(testFn);

    expect(middleware.name).toBe('anonymous');
    expect(middleware.execute).toBe(testFn);
    expect(middleware.debug).toBe(false);
    expect(middleware.skip).toBeUndefined();
  });

  test('creates middleware from options with only handler', () => {
    const testHandler = createTestMiddlewareFunction();
    const middleware = create({ handler: testHandler });

    expect(middleware.name).toBe('anonymous');
    expect(middleware.execute).toBe(testHandler);
    expect(middleware.debug).toBe(false);
    expect(middleware.skip).toBeUndefined();
  });

  test('creates middleware with custom name and debug setting', () => {
    const options = createTestMiddlewareOptions({
      name: 'custom-middleware',
      debug: true,
    });

    const middleware = create(options);

    expect(middleware.name).toBe('custom-middleware');
    expect(middleware.execute).toBe(options.handler);
    expect(middleware.debug).toBe(true);
    expect(middleware.skip).toBeUndefined();
  });

  test('middleware handler receives logger parameter', async () => {
    const handlerSpy = vi.fn(async (ctx, next, logger) => {
      expect(logger).toBeDefined();
      await next();
    });

    const middleware = create({ name: 'test', handler: handlerSpy });

    await middleware.execute(mockContext, mockNext, mockLogger);

    expect(handlerSpy).toHaveBeenCalledWith(mockContext, mockNext, mockLogger);
  });

  test('creates middleware with skip function', () => {
    const testSkip = (ctx: Context) => ctx.request?.method === 'GET';
    const options = createTestMiddlewareOptions({ skip: testSkip });
    const middleware = create(options);

    expect(middleware.name).toBe('test-middleware');
    expect(middleware.execute).toBe(options.handler);
    expect(middleware.skip).toBe(testSkip);
  });

  test('function shorthand works with 3 parameters', async () => {
    const handler = vi.fn(async (_ctx, next, logger) => {
      logger.info('test');
      await next();
    });

    const middleware = create(handler);
    await middleware.execute(mockContext, mockNext, mockLogger);

    expect(handler).toHaveBeenCalledWith(mockContext, mockNext, mockLogger);
    expect(mockLogger.info).toHaveBeenCalledWith('test');
  });

  test('stateMiddleware helper works with logger', async () => {
    const middleware = stateMiddleware<{ value: string }>(async (ctx, next, logger) => {
      ctx.state.value = 'test';
      logger.debug('Setting state');
      await next();
    });

    await middleware.execute(mockContext, mockNext, mockLogger);

    expect((mockContext.state as any).value).toBe('test');
    expect(mockLogger.debug).toHaveBeenCalledWith('Setting state');
  });

  test('serviceMiddleware helper works with logger', async () => {
    const middleware = serviceMiddleware<{ service: string }>(async (ctx, next, logger) => {
      (ctx.services as any).service = 'test-service';
      logger.debug('Adding service');
      await next();
    });

    await middleware.execute(mockContext, mockNext, mockLogger);

    expect((mockContext.services as any).service).toBe('test-service');
    expect(mockLogger.debug).toHaveBeenCalledWith('Adding service');
  });

  describe('type inference', () => {
    test('preserves state type parameter', () => {
      type TestState = { userId: string };

      const middleware = create<TestState, {}>(async (ctx, next, _logger) => {
        ctx.state.userId = '123';
        await next();
      });

      expect(middleware.name).toBe('anonymous');
    });

    test('preserves service type parameter', () => {
      type TestServices = { db: { query: () => void } };

      const middleware = create<{}, TestServices>(async (_ctx, next, _logger) => {
        await next();
      });

      expect(middleware.name).toBe('anonymous');
    });
  });

  describe('edge cases', () => {
    test('handles middleware with all optional properties', () => {
      const handler = createTestMiddlewareFunction();

      const middleware = create({
        handler,
      });

      expect(middleware.name).toBe('anonymous');
      expect(middleware.debug).toBe(false);
      expect(middleware.skip).toBeUndefined();
    });

    test('preserves skip function when provided', () => {
      const skipFn = (_ctx: Context) => true;
      const handler = createTestMiddlewareFunction();

      const middleware = create({
        name: 'test',
        handler,
        skip: skipFn,
      });

      expect(middleware.skip).toBe(skipFn);
    });

    test('function shorthand creates anonymous middleware', () => {
      const handler = vi.fn((_ctx, next, _logger) => next());
      const middleware = create(handler);

      expect(middleware.name).toBe('anonymous');
      expect(middleware.execute).toBe(handler);
    });
  });
});
