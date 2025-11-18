import { createMockLogger } from '@blaizejs/testing-utils';
import type { MockLogger } from '@blaizejs/testing-utils';

import { createErrorBoundary } from './create';
import { NotFoundError } from '../../errors/not-found-error';
import { ValidationError } from '../../errors/validation-error';

import type { Context } from '@blaize-types/context';

// Mock context for testing
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
    services: {},
  } as any;
};

describe('Error Boundary Middleware', () => {
  let mockContext: Context;
  let mockNext: ReturnType<typeof vi.fn>;
  let mockLogger: MockLogger;

  beforeEach(() => {
    vi.clearAllMocks();
    mockContext = createMockContext();
    mockNext = vi.fn();
    mockLogger = createMockLogger();
  });

  describe('createErrorBoundary', () => {
    test('creates middleware with correct structure', () => {
      const middleware = createErrorBoundary();

      expect(middleware).toHaveProperty('name', 'ErrorBoundary');
      expect(middleware).toHaveProperty('execute');
      expect(middleware).toHaveProperty('debug', false);
      expect(typeof middleware.execute).toBe('function');
    });

    test('creates middleware with debug enabled', () => {
      const middleware = createErrorBoundary({ debug: true });

      expect(middleware.debug).toBe(true);
    });
  });

  describe('middleware execution', () => {
    test('calls next() when no error occurs', async () => {
      const middleware = createErrorBoundary();
      mockNext.mockResolvedValue(undefined);

      await middleware.execute(mockContext, mockNext, mockLogger);

      expect(mockNext).toHaveBeenCalled();
      expect(mockContext.response.json).not.toHaveBeenCalled();
    });

    test('catches errors and formats response', async () => {
      const middleware = createErrorBoundary();
      const error = new Error('Test error');
      mockNext.mockRejectedValue(error);

      await middleware.execute(mockContext, mockNext, mockLogger);

      expect(mockContext.response.status).toHaveBeenCalledWith(500);
      expect(mockContext.response.json).toHaveBeenCalled();
    });

    test('handles NotFoundError with 404 status', async () => {
      const middleware = createErrorBoundary();
      const error = new NotFoundError('User not found');
      mockNext.mockRejectedValue(error);

      await middleware.execute(mockContext, mockNext, mockLogger);

      expect(mockContext.response.status).toHaveBeenCalledWith(404);
      expect(mockContext.response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 404,
          type: 'NOT_FOUND',
        })
      );
    });

    test('handles ValidationError with 400 status', async () => {
      const middleware = createErrorBoundary();
      const error = new ValidationError('Invalid input', {
        fields: [
          {
            field: 'email',
            messages: ['Required'],
            rejectedValue: undefined,
            expectedType: 'string',
          },
        ],
        errorCount: 1,
        section: 'body',
      });
      mockNext.mockRejectedValue(error);

      await middleware.execute(mockContext, mockNext, mockLogger);

      expect(mockContext.response.status).toHaveBeenCalledWith(400);
      expect(mockContext.response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 400,
          type: 'VALIDATION_ERROR',
        })
      );
    });

    test('does not send response if already sent', async () => {
      const middleware = createErrorBoundary();
      mockContext.response.sent = true;
      const error = new Error('Test error');
      mockNext.mockRejectedValue(error);

      await middleware.execute(mockContext, mockNext, mockLogger);

      expect(mockContext.response.json).not.toHaveBeenCalled();
    });
  });

  describe('logger integration', () => {
    test('uses logger parameter for debug logging', async () => {
      const middleware = createErrorBoundary({ debug: true });
      const error = new Error('Test error');
      mockNext.mockRejectedValue(error);

      await middleware.execute(mockContext, mockNext, mockLogger);

      const errorLogs = mockLogger.getLogsByLevel('error');
      expect(errorLogs).toHaveLength(1);
      expect(errorLogs[0]?.message).toBe('Error boundary caught error:');
      expect(errorLogs[0]?.meta).toEqual({ error });
    });

    test('does not log when debug is false', async () => {
      const middleware = createErrorBoundary({ debug: false });
      const error = new Error('Test error');
      mockNext.mockRejectedValue(error);

      await middleware.execute(mockContext, mockNext, mockLogger);

      expect(mockLogger.logs).toHaveLength(0);
    });

    test('logs when response already sent', async () => {
      const middleware = createErrorBoundary({ debug: true });
      mockContext.response.sent = true;
      const error = new Error('Test error');
      mockNext.mockRejectedValue(error);

      await middleware.execute(mockContext, mockNext, mockLogger);

      const errorLogs = mockLogger.getLogsByLevel('error');
      expect(errorLogs).toHaveLength(1);
      expect(errorLogs[0]?.message).toBe('Error occurred after response was sent:');
      expect(errorLogs[0]?.meta).toEqual({ error });
    });

    test('no console.error calls', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const middleware = createErrorBoundary({ debug: true });
      const error = new Error('Test error');
      mockNext.mockRejectedValue(error);

      await middleware.execute(mockContext, mockNext, mockLogger);

      expect(consoleErrorSpy).not.toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('correlation ID handling', () => {
    test('preserves correlation ID in response', async () => {
      const middleware = createErrorBoundary();
      const correlationId = 'test-correlation-id';
      mockContext.request.header = vi.fn((name: string) => {
        if (name.toLowerCase() === 'x-correlation-id') {
          return correlationId;
        }
        return undefined;
      });

      const error = new Error('Test error');
      mockNext.mockRejectedValue(error);

      await middleware.execute(mockContext, mockNext, mockLogger);

      expect(mockContext.response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          correlationId,
        })
      );
    });

    test('generates correlation ID if not present', async () => {
      const middleware = createErrorBoundary();
      mockContext.request.header = vi.fn(() => undefined);

      const error = new Error('Test error');
      mockNext.mockRejectedValue(error);

      await middleware.execute(mockContext, mockNext, mockLogger);

      expect(mockContext.response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          correlationId: expect.any(String),
        })
      );
    });
  });
});
