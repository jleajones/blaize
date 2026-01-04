/**
 * Tests for Middleware Execution with Logger Parameter
 */

import { createMockEventBus, createMockLogger, MockLogger } from '@blaizejs/testing-utils';

import { execute } from './execute';

import type { EventSchemas, TypedEventBus } from '@blaize-types';
import type { Context } from '@blaize-types/context';
import type { Middleware, NextFunction } from '@blaize-types/middleware';

describe('execute', () => {
  let mockLogger: MockLogger;
  let mockContext: Context;
  let mockNext: NextFunction;
  let mockEventBus: TypedEventBus<EventSchemas>;

  beforeEach(() => {
    mockContext = {} as Context;
    mockNext = vi.fn(async () => {});
    mockLogger = createMockLogger();
    mockEventBus = createMockEventBus();
  });

  describe('basic execution', () => {
    test('passes logger to middleware.execute', async () => {
      const executeSpy = vi.fn(async ({ next }) => {
        await next();
      });

      const middleware: Middleware = {
        name: 'test',
        execute: executeSpy,
        debug: false,
      };

      await execute(middleware, mockContext, mockNext, mockLogger, mockEventBus);

      expect(executeSpy).toHaveBeenCalledWith({
        ctx: mockContext,
        next: mockNext,
        logger: mockLogger,
        eventBus: mockEventBus,
      });
    });

    test('calls next when middleware completes', async () => {
      const middleware: Middleware = {
        name: 'test',
        execute: async ({ next }) => {
          await next();
        },
        debug: false,
      };

      await execute(middleware, mockContext, mockNext, mockLogger, mockEventBus);

      expect(mockNext).toHaveBeenCalledTimes(1);
    });
  });

  describe('undefined middleware handling', () => {
    test('handles undefined middleware gracefully', async () => {
      await expect(
        execute(undefined, mockContext, mockNext, mockLogger, mockEventBus)
      ).resolves.toBeUndefined();

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('skip functionality', () => {
    test('skips middleware when skip returns true', async () => {
      const executeSpy = vi.fn();

      const middleware: Middleware = {
        name: 'test',
        execute: executeSpy,
        skip: () => true,
        debug: false,
      };

      await execute(middleware, mockContext, mockNext, mockLogger, mockEventBus);

      expect(executeSpy).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });

    test('executes middleware when skip returns false', async () => {
      const executeSpy = vi.fn(async ({ next }) => {
        await next();
      });

      const middleware: Middleware = {
        name: 'test',
        execute: executeSpy,
        skip: () => false,
        debug: false,
      };

      await execute(middleware, mockContext, mockNext, mockLogger, mockEventBus);

      expect(executeSpy).toHaveBeenCalled();
    });

    test('passes context to skip function', async () => {
      const skipSpy = vi.fn(() => false);
      const executeSpy = vi.fn(async ({ next }) => {
        await next();
      });

      const middleware: Middleware = {
        name: 'test',
        execute: executeSpy,
        skip: skipSpy,
        debug: false,
      };

      await execute(middleware, mockContext, mockNext, mockLogger, mockEventBus);

      expect(skipSpy).toHaveBeenCalledWith(mockContext);
    });
  });

  describe('error handling', () => {
    test('handles synchronous errors', async () => {
      const error = new Error('Sync error');

      const middleware: Middleware = {
        name: 'test',
        execute: () => {
          throw error;
        },
        debug: false,
      };

      await expect(
        execute(middleware, mockContext, mockNext, mockLogger, mockEventBus)
      ).rejects.toThrow('Sync error');

      expect(mockNext).not.toHaveBeenCalled();
    });

    test('handles async errors', async () => {
      const error = new Error('Async error');

      const middleware: Middleware = {
        name: 'test',
        execute: async () => {
          throw error;
        },
        debug: false,
      };

      await expect(
        execute(middleware, mockContext, mockNext, mockLogger, mockEventBus)
      ).rejects.toThrow('Async error');

      expect(mockNext).not.toHaveBeenCalled();
    });

    test('propagates errors from next()', async () => {
      const error = new Error('Next error');
      const nextWithError = vi.fn(async () => {
        throw error;
      });

      const middleware: Middleware = {
        name: 'test',
        execute: async ({ next }) => {
          await next();
        },
        debug: false,
      };

      await expect(
        execute(middleware, mockContext, nextWithError, mockLogger, mockEventBus)
      ).rejects.toThrow('Next error');
    });
  });

  describe('promise handling', () => {
    test('handles synchronous middleware that returns non-Promise', async () => {
      const middleware: Middleware = {
        name: 'test',
        execute: ({ next }) => {
          next(); // Don't await
          return undefined as any;
        },
        debug: false,
      };

      await expect(
        execute(middleware, mockContext, mockNext, mockLogger, mockEventBus)
      ).resolves.toBeUndefined();
    });

    test('handles async middleware that returns Promise', async () => {
      const middleware: Middleware = {
        name: 'test',
        execute: async ({ next }) => {
          await next();
        },
        debug: false,
      };

      await expect(
        execute(middleware, mockContext, mockNext, mockLogger, mockEventBus)
      ).resolves.toBeUndefined();

      expect(mockNext).toHaveBeenCalled();
    });

    test('handles middleware that returns void', async () => {
      const middleware: Middleware = {
        name: 'test',
        execute: () => {
          // Synchronous, returns void
        },
        debug: false,
      };

      await expect(
        execute(middleware, mockContext, mockNext, mockLogger, mockEventBus)
      ).resolves.toBeUndefined();
    });
  });

  describe('middleware with no skip function', () => {
    test('executes middleware without skip function', async () => {
      const executeSpy = vi.fn(async ({ next }) => {
        await next();
      });

      const middleware: Middleware = {
        name: 'test',
        execute: executeSpy,
        debug: false,
        // No skip function
      };

      await execute(middleware, mockContext, mockNext, mockLogger, mockEventBus);

      expect(executeSpy).toHaveBeenCalled();
    });
  });
});
