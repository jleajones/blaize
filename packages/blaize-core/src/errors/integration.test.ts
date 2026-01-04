import { ErrorType } from '@blaize-types/errors';

import { createMockEventBus, createMockLogger, MockLogger } from '@blaizejs/testing-utils';

import { NotFoundError } from './not-found-error';
import { UnauthorizedError } from './unauthorized-error';
import { ValidationError } from './validation-error';
import { compose } from '../middleware/compose';
import { create as createMiddleware } from '../middleware/create';
import { createErrorBoundary } from '../middleware/error-boundary/create';

import type { EventSchemas, TypedEventBus, Context, NextFunction } from '@blaize-types';

// Mock context helper
const createMockContext = (headers: Record<string, string> = {}): Context => {
  const response = {
    sent: false,
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    header: vi.fn().mockReturnThis(),
  };

  const request = {
    method: 'GET',
    path: '/test',
    header: vi.fn((name: string) => headers[name.toLowerCase()]),
    headers: vi.fn(),
  };

  return {
    request,
    response,
    state: {},
  } as any;
};

describe('Error Boundary Integration Tests', () => {
  let mockContext: Context;
  let mockLogger: MockLogger;
  let mockNext: NextFunction;
  let mockEventBus: TypedEventBus<EventSchemas>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockContext = createMockContext();
    mockLogger = createMockLogger();
    mockEventBus = createMockEventBus();
    mockNext = vi.fn();
  });

  describe('end-to-end error handling', () => {
    it('should catch ValidationError from route handler and format properly', async () => {
      const errorBoundary = createErrorBoundary();

      // Simulate a route handler that throws ValidationError
      const routeHandler = createMiddleware({
        name: 'route-handler',
        handler: async () => {
          throw new ValidationError('Email is required', {
            fields: [
              {
                field: 'email',
                messages: ['This field is required'],
                rejectedValue: undefined,
                expectedType: 'string',
              },
            ],
            errorCount: 1,
            section: 'body',
          });
        },
      });

      const middlewareChain = compose([errorBoundary, routeHandler]);
      await middlewareChain({
        ctx: mockContext,
        next: mockNext,
        logger: mockLogger,
        eventBus: mockEventBus,
      });

      expect(mockContext.response.status).toHaveBeenCalledWith(400);
      expect(mockContext.response.json).toHaveBeenCalledWith({
        type: ErrorType.VALIDATION_ERROR,
        title: 'Email is required',
        status: 400,
        correlationId: expect.any(String),
        timestamp: expect.any(String),
        details: {
          fields: [
            {
              field: 'email',
              messages: ['This field is required'],
              rejectedValue: undefined,
              expectedType: 'string',
            },
          ],
          errorCount: 1,
          section: 'body',
        },
      });
    });

    it('should catch NotFoundError from nested middleware and preserve correlation ID', async () => {
      const correlationId = 'test_correlation_456';
      mockContext = createMockContext({ 'x-correlation-id': correlationId });

      const errorBoundary = createErrorBoundary();

      // Simulate nested middleware chain
      const authMiddleware = createMiddleware({
        name: 'auth',
        handler: async ({ next }) => {
          await next(); // Pass through to next middleware
        },
      });

      const routeHandler = createMiddleware({
        name: 'route-handler',
        handler: async () => {
          throw new NotFoundError('User not found', {
            userId: '123',
            suggestion: 'Check if the user ID is correct',
          });
        },
      });

      const middlewareChain = compose([errorBoundary, authMiddleware, routeHandler]);
      await middlewareChain({
        ctx: mockContext,
        next: mockNext,
        logger: mockLogger,
        eventBus: mockEventBus,
      });

      expect(mockContext.response.header).toHaveBeenCalledWith('x-correlation-id', correlationId);
      expect(mockContext.response.json).toHaveBeenCalledWith({
        type: ErrorType.NOT_FOUND,
        title: 'User not found',
        status: 404,
        correlationId,
        timestamp: expect.any(String),
        details: {
          userId: '123',
          suggestion: 'Check if the user ID is correct',
        },
      });
    });

    it('should catch unexpected Error and wrap in InternalServerError', async () => {
      const errorBoundary = createErrorBoundary();

      const faultyMiddleware = createMiddleware({
        name: 'faulty-middleware',
        handler: async () => {
          throw new Error('Database connection timeout');
        },
      });

      const middlewareChain = compose([errorBoundary, faultyMiddleware]);
      await middlewareChain({
        ctx: mockContext,
        next: mockNext,
        logger: mockLogger,
        eventBus: mockEventBus,
      });

      expect(mockContext.response.status).toHaveBeenCalledWith(500);
      expect(mockContext.response.json).toHaveBeenCalledWith({
        type: ErrorType.INTERNAL_SERVER_ERROR,
        title: 'Internal Server Error',
        status: 500,
        correlationId: expect.any(String),
        timestamp: expect.any(String),
        details: {
          originalMessage: 'Database connection timeout',
        },
      });
    });

    it('should handle multiple middleware throwing errors (first error wins)', async () => {
      const errorBoundary = createErrorBoundary();

      const firstMiddleware = createMiddleware({
        name: 'first-middleware',
        handler: async ({ next }) => {
          await next();
          // This won't run because next() throws
          throw new Error('Second error');
        },
      });

      const secondMiddleware = createMiddleware({
        name: 'second-middleware',
        handler: async () => {
          throw new UnauthorizedError('Authentication required');
        },
      });

      const middlewareChain = compose([errorBoundary, firstMiddleware, secondMiddleware]);
      await middlewareChain({
        ctx: mockContext,
        next: mockNext,
        logger: mockLogger,
        eventBus: mockEventBus,
      });

      // Should only see the first error that occurred
      expect(mockContext.response.status).toHaveBeenCalledWith(401);
      expect(mockContext.response.json).toHaveBeenCalledWith({
        type: ErrorType.UNAUTHORIZED,
        title: 'Authentication required',
        status: 401,
        correlationId: expect.any(String),
        timestamp: expect.any(String),
        details: undefined,
      });
    });

    it('should not handle errors if response already sent', async () => {
      const errorBoundary = createErrorBoundary();

      const responseMiddleware = createMiddleware({
        name: 'response-middleware',
        handler: async ({ ctx, next }) => {
          ctx.response.json({ success: true });
          ctx.response.sent = true;
          await next();
        },
      });

      const errorMiddleware = createMiddleware({
        name: 'error-middleware',
        handler: async () => {
          throw new Error('Late error');
        },
      });

      const middlewareChain = compose([errorBoundary, responseMiddleware, errorMiddleware]);
      await middlewareChain({
        ctx: mockContext,
        next: mockNext,
        logger: mockLogger,
        eventBus: mockEventBus,
      });

      // Should only have been called once by responseMiddleware
      expect(mockContext.response.json).toHaveBeenCalledTimes(1);
      expect(mockContext.response.json).toHaveBeenCalledWith({ success: true });
    });

    it('should work with validation middleware throwing ValidationError', async () => {
      const errorBoundary = createErrorBoundary();

      // Simulate validation middleware that throws
      const validationMiddleware = createMiddleware({
        name: 'validation',
        handler: async () => {
          throw new ValidationError('Request validation failed', {
            fields: [
              {
                field: 'name',
                messages: ['Name is required'],
                rejectedValue: undefined,
                expectedType: 'string',
              },
              {
                field: 'email',
                messages: ['Invalid email format'],
                rejectedValue: 'invalid-email',
                expectedType: 'email',
              },
            ],
            errorCount: 2,
            section: 'body',
          });
        },
      });

      const routeHandler = createMiddleware({
        name: 'route-handler',
        handler: async ({ next }) => {
          // This won't run because validation fails
          await next();
        },
      });

      const middlewareChain = compose([errorBoundary, validationMiddleware, routeHandler]);
      await middlewareChain({
        ctx: mockContext,
        next: mockNext,
        logger: mockLogger,
        eventBus: mockEventBus,
      });

      expect(mockContext.response.status).toHaveBeenCalledWith(400);
      expect(mockContext.response.json).toHaveBeenCalledWith({
        type: ErrorType.VALIDATION_ERROR,
        title: 'Request validation failed',
        status: 400,
        correlationId: expect.any(String),
        timestamp: expect.any(String),
        details: {
          fields: [
            {
              field: 'name',
              messages: ['Name is required'],
              rejectedValue: undefined,
              expectedType: 'string',
            },
            {
              field: 'email',
              messages: ['Invalid email format'],
              rejectedValue: 'invalid-email',
              expectedType: 'email',
            },
          ],
          errorCount: 2,
          section: 'body',
        },
      });
    });
  });

  describe('error boundary placement', () => {
    it('should catch errors from all downstream middleware when placed first', async () => {
      const errorBoundary = createErrorBoundary();

      const middleware1 = createMiddleware({
        name: 'middleware1',
        handler: async ({ next }) => next(),
      });

      const middleware2 = createMiddleware({
        name: 'middleware2',
        handler: async ({ next }) => next(),
      });

      const errorMiddleware = createMiddleware({
        name: 'error-middleware',
        handler: async () => {
          throw new NotFoundError('Resource not found');
        },
      });

      // Error boundary first in chain
      const middlewareChain = compose([errorBoundary, middleware1, middleware2, errorMiddleware]);

      await middlewareChain({
        ctx: mockContext,
        next: mockNext,
        logger: mockLogger,
        eventBus: mockEventBus,
      });

      expect(mockContext.response.status).toHaveBeenCalledWith(404);
      expect(mockContext.response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ErrorType.NOT_FOUND,
          title: 'Resource not found',
        })
      );
    });
  });
});
