import { ErrorType } from '@blaize-types/errors';

import { createErrorBoundary } from './error-boundary';
import { NotFoundError } from '../errors/not-found-error';
import { ValidationError } from '../errors/validation-error';

import type { Context } from '@blaize-types/context';

// Mock context and response for testing
const createMockContext = (): Context => {
  const response = {
    sent: false,
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    header: vi.fn().mockReturnThis(),
  };

  return {
    request: {
      method: 'GET',
      path: '/test',
      header: vi.fn(),
      headers: vi.fn(),
    },
    response,
    state: {},
  } as any;
};

describe('Error Boundary Middleware', () => {
  let mockContext: Context;
  let mockNext: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockContext = createMockContext();
    mockNext = vi.fn();
  });

  describe('createErrorBoundary', () => {
    it('should create middleware with correct structure', () => {
      const middleware = createErrorBoundary();

      expect(middleware).toHaveProperty('name', 'ErrorBoundary');
      expect(middleware).toHaveProperty('execute');
      expect(middleware).toHaveProperty('debug', false);
      expect(typeof middleware.execute).toBe('function');
    });

    it('should create middleware with debug enabled', () => {
      const middleware = createErrorBoundary({ debug: true });

      expect(middleware.debug).toBe(true);
    });
  });

  describe('middleware execution', () => {
    it('should call next() when no error occurs', async () => {
      const middleware = createErrorBoundary();
      mockNext.mockResolvedValue(undefined);

      await middleware.execute(mockContext, mockNext);

      expect(mockNext).toHaveBeenCalledOnce();
      expect(mockContext.response.json).not.toHaveBeenCalled();
    });

    it('should catch ValidationError and format response', async () => {
      const middleware = createErrorBoundary();
      const error = new ValidationError('Invalid input', {
        fields: [
          {
            field: 'email',
            messages: ['Email is required'],
            rejectedValue: '',
            expectedType: 'email',
          },
        ],
        errorCount: 1,
        section: 'body',
      });
      mockNext.mockRejectedValue(error);

      await middleware.execute(mockContext, mockNext);

      expect(mockContext.response.status).toHaveBeenCalledWith(400);
      expect(mockContext.response.header).toHaveBeenCalledWith(
        'x-correlation-id',
        expect.any(String)
      );
      expect(mockContext.response.json).toHaveBeenCalledWith({
        type: ErrorType.VALIDATION_ERROR,
        title: 'Invalid input',
        status: 400,
        correlationId: expect.any(String),
        timestamp: expect.any(String),
        details: {
          fields: [
            {
              field: 'email',
              messages: ['Email is required'],
              rejectedValue: '',
              expectedType: 'email',
            },
          ],
          errorCount: 1,
          section: 'body',
        },
      });
    });

    it('should catch NotFoundError and format response', async () => {
      const middleware = createErrorBoundary();
      const error = new NotFoundError('User not found');
      mockNext.mockRejectedValue(error);

      await middleware.execute(mockContext, mockNext);

      expect(mockContext.response.status).toHaveBeenCalledWith(404);
      expect(mockContext.response.json).toHaveBeenCalledWith({
        type: ErrorType.NOT_FOUND,
        title: 'User not found',
        status: 404,
        correlationId: expect.any(String),
        timestamp: expect.any(String),
        details: undefined,
      });
    });

    it('should catch unexpected errors and format as InternalServerError', async () => {
      const middleware = createErrorBoundary();
      const error = new Error('Database failed');
      mockNext.mockRejectedValue(error);

      await middleware.execute(mockContext, mockNext);

      expect(mockContext.response.status).toHaveBeenCalledWith(500);
      expect(mockContext.response.json).toHaveBeenCalledWith({
        type: ErrorType.INTERNAL_SERVER_ERROR,
        title: 'Internal Server Error',
        status: 500,
        correlationId: expect.any(String),
        timestamp: expect.any(String),
        details: {
          originalMessage: 'Database failed',
        },
      });
    });

    it('should not send response if already sent', async () => {
      const middleware = createErrorBoundary();
      const error = new NotFoundError('Test error');
      mockContext.response.sent = true;
      mockNext.mockRejectedValue(error);

      await middleware.execute(mockContext, mockNext);

      expect(mockContext.response.status).not.toHaveBeenCalled();
      expect(mockContext.response.json).not.toHaveBeenCalled();
    });

    it('should preserve correlation ID from request headers', async () => {
      const middleware = createErrorBoundary();
      const correlationId = 'request_correlation_123';
      const error = new NotFoundError('Test error');

      // Mock request header to return correlation ID
      vi.mocked(mockContext.request.header).mockImplementation((name: string) => {
        return name === 'x-correlation-id' ? correlationId : undefined;
      });

      mockNext.mockRejectedValue(error);

      await middleware.execute(mockContext, mockNext);

      expect(mockContext.response.header).toHaveBeenCalledWith('x-correlation-id', correlationId);
      expect(mockContext.response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          correlationId,
        })
      );
    });

    it('should log errors in debug mode', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const middleware = createErrorBoundary({ debug: true });
      const error = new Error('Test error');
      mockNext.mockRejectedValue(error);

      await middleware.execute(mockContext, mockNext);

      expect(consoleSpy).toHaveBeenCalledWith('Error boundary caught error:', error);

      consoleSpy.mockRestore();
    });

    it('should not log errors when debug is false', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const middleware = createErrorBoundary({ debug: false });
      const error = new Error('Test error');
      mockNext.mockRejectedValue(error);

      await middleware.execute(mockContext, mockNext);

      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});
