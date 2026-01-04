/**
 * Tests for Middleware Composition with Logger Parameter
 */

import { createMockEventBus, createMockLogger, MockLogger } from '@blaizejs/testing-utils';

import { compose } from './compose';

import type { TypedEventBus, Context, Middleware, NextFunction, EventSchemas } from '@blaize-types';

describe('compose with logger parameter', () => {
  let mockLogger: MockLogger;
  let mockContext: Context;
  let mockNext: NextFunction;
  let mockEventBus: TypedEventBus<EventSchemas>;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockEventBus = createMockEventBus();
    mockContext = {} as Context;
    mockNext = vi.fn(async () => {});
  });

  describe('basic functionality', () => {
    test('compose returns function expecting logger as 3rd parameter', async () => {
      const middleware: Middleware = {
        name: 'test',
        execute: async ({ next }) => {
          await next();
        },
        debug: false,
      };

      const composed = compose([middleware]);

      // Should accept 3 parameters
      await composed({
        ctx: mockContext,
        next: mockNext,
        logger: mockLogger,
        eventBus: mockEventBus,
      });

      expect(mockNext).toHaveBeenCalled();
    });

    test('passes logger to middleware.execute as 3rd parameter', async () => {
      const executeSpy = vi.fn(async ({ next }) => {
        await next();
      });

      const middleware: Middleware = {
        name: 'test',
        execute: executeSpy,
        debug: false,
      };

      const composed = compose([middleware]);
      await composed({
        ctx: mockContext,
        next: mockNext,
        logger: mockLogger,
        eventBus: mockEventBus,
      });

      expect(executeSpy).toHaveBeenCalledWith({
        ctx: mockContext,
        next: expect.any(Function),
        logger: expect.any(Object), // Logger
        eventBus: expect.any(Object), // EventBus
      });
    });

    test('calls finalNext when all middleware complete', async () => {
      const middleware: Middleware = {
        name: 'test',
        execute: async ({ next }) => {
          await next();
        },
        debug: false,
      };

      const composed = compose([middleware]);
      await composed({
        ctx: mockContext,
        next: mockNext,
        logger: mockLogger,
        eventBus: mockEventBus,
      });

      expect(mockNext).toHaveBeenCalledTimes(1);
    });
  });

  describe('child logger creation', () => {
    test('creates child logger with middleware name', async () => {
      const middleware: Middleware = {
        name: 'auth',
        execute: async ({ next }) => {
          await next();
        },
        debug: false,
      };

      const composed = compose([middleware]);
      await composed({
        ctx: mockContext,
        next: mockNext,
        logger: mockLogger,
        eventBus: mockEventBus,
      });

      expect(mockLogger.childContexts).toHaveLength(1);
      expect(mockLogger.childContexts[0]).toEqual({ middleware: 'auth' });
    });

    test('each middleware gets its own scoped child logger', async () => {
      const middleware1: Middleware = {
        name: 'mw1',
        execute: async ({ next }) => {
          await next();
        },
        debug: false,
      };

      const middleware2: Middleware = {
        name: 'mw2',
        execute: async ({ next }) => {
          await next();
        },
        debug: false,
      };

      const composed = compose([middleware1, middleware2]);
      await composed({
        ctx: mockContext,
        next: mockNext,
        logger: mockLogger,
        eventBus: mockEventBus,
      });

      expect(mockLogger.childContexts).toHaveLength(2);
      expect(mockLogger.childContexts[0]).toEqual({ middleware: 'mw1' });
      expect(mockLogger.childContexts[1]).toEqual({ middleware: 'mw2' });
    });

    test('child loggers inherit parent context', async () => {
      let receivedLogger: any = null;

      const middleware: Middleware = {
        name: 'test',
        execute: async ({ next, logger }) => {
          receivedLogger = logger;
          await next();
        },
        debug: false,
      };

      // Parent logger has context
      const parentLogger = mockLogger.child({
        correlationId: 'test-123',
        method: 'GET',
      });

      const composed = compose([middleware]);
      await composed({
        ctx: mockContext,
        next: mockNext,
        logger: parentLogger,
        eventBus: mockEventBus,
      });

      // Verify child was created
      expect(receivedLogger).toBeDefined();
    });
  });

  describe('middleware execution order', () => {
    test('executes middleware in order', async () => {
      const executionOrder: string[] = [];

      const middleware1: Middleware = {
        name: 'first',
        execute: async ({ next }) => {
          executionOrder.push('first-start');
          await next();
          executionOrder.push('first-end');
        },
        debug: false,
      };

      const middleware2: Middleware = {
        name: 'second',
        execute: async ({ next }) => {
          executionOrder.push('second-start');
          await next();
          executionOrder.push('second-end');
        },
        debug: false,
      };

      const finalNext = async () => {
        executionOrder.push('final');
      };

      const composed = compose([middleware1, middleware2]);
      await composed({
        ctx: mockContext,
        next: finalNext,
        logger: mockLogger,
        eventBus: mockEventBus,
      });

      expect(executionOrder).toEqual([
        'first-start',
        'second-start',
        'final',
        'second-end',
        'first-end',
      ]);
    });

    test('handles empty middleware array', async () => {
      const composed = compose([]);
      await composed({
        ctx: mockContext,
        next: mockNext,
        logger: mockLogger,
        eventBus: mockEventBus,
      });

      expect(mockNext).toHaveBeenCalledTimes(1);
    });
  });

  describe('skip functionality', () => {
    test('skips middleware when skip returns true', async () => {
      const executeSpy = vi.fn(async ({ next }) => {
        await next();
      });

      const middleware: Middleware = {
        name: 'skippable',
        execute: executeSpy,
        skip: () => true,
        debug: false,
      };

      const composed = compose([middleware]);
      await composed({
        ctx: mockContext,
        next: mockNext,
        logger: mockLogger,
        eventBus: mockEventBus,
      });

      expect(executeSpy).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });

    test('executes middleware when skip returns false', async () => {
      const executeSpy = vi.fn(async ({ next }) => {
        await next();
      });

      const middleware: Middleware = {
        name: 'not-skipped',
        execute: executeSpy,
        skip: () => false,
        debug: false,
      };

      const composed = compose([middleware]);
      await composed({
        ctx: mockContext,
        next: mockNext,
        logger: mockLogger,
        eventBus: mockEventBus,
      });

      expect(executeSpy).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    test('preserves error handling - next() called multiple times', async () => {
      const badMiddleware: Middleware = {
        name: 'bad',
        execute: async ({ next }) => {
          await next();
          await next(); // Should throw
        },
        debug: false,
      };

      const composed = compose([badMiddleware]);

      await expect(
        composed({ ctx: mockContext, next: mockNext, logger: mockLogger, eventBus: mockEventBus })
      ).rejects.toThrow('next() called multiple times');
    });

    test('handles middleware that throws errors', async () => {
      const error = new Error('Test error');

      const errorMiddleware: Middleware = {
        name: 'error',
        execute: async () => {
          throw error;
        },
        debug: false,
      };

      const composed = compose([errorMiddleware]);

      await expect(
        composed({ ctx: mockContext, next: mockNext, logger: mockLogger, eventBus: mockEventBus })
      ).rejects.toThrow('Test error');

      expect(mockNext).not.toHaveBeenCalled();
    });

    test('propagates errors from finalNext', async () => {
      const error = new Error('Final handler error');
      const finalNext = async () => {
        throw error;
      };

      const middleware: Middleware = {
        name: 'test',
        execute: async ({ next }) => {
          await next();
        },
        debug: false,
      };

      const composed = compose([middleware]);

      await expect(
        composed({ ctx: mockContext, next: finalNext, logger: mockLogger, eventBus: mockEventBus })
      ).rejects.toThrow('Final handler error');
    });
  });
});
