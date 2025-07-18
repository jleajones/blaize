import { handleRouteError } from './error';

import type { Context } from '@blaize-types/context';
import type { ErrorHandlerOptions } from '@blaize-types/router';

describe('Error Handler', () => {
  // Mock console.error to avoid noise in test output
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper to create mock context
  function createMockContext(): Context {
    return {
      response: {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      },
    } as unknown as Context;
  }

  describe('handleRouteError', () => {
    test('handles standard Error object', () => {
      // Arrange
      const ctx = createMockContext();
      const error = new Error('Something went wrong');

      // Act
      handleRouteError(ctx, error);

      // Assert
      expect(ctx.response.status).toHaveBeenCalledWith(500);
      expect(ctx.response.json).toHaveBeenCalledWith({
        error: 'Error',
        message: 'Something went wrong',
      });
    });

    test('logs error when logging is enabled', () => {
      // Arrange
      const ctx = createMockContext();
      const error = new Error('Something went wrong');
      const options: ErrorHandlerOptions = { log: true };

      // Act
      handleRouteError(ctx, error, options);

      // Assert
      expect(console.error).toHaveBeenCalledWith('Route error:', error);
    });

    test('does not log error when logging is disabled', () => {
      // Arrange
      const ctx = createMockContext();
      const error = new Error('Something went wrong');
      const options: ErrorHandlerOptions = { log: false };

      // Act
      handleRouteError(ctx, error, options);

      // Assert
      expect(console.error).not.toHaveBeenCalled();
    });

    test('includes stack trace when detailed is enabled', () => {
      // Arrange
      const ctx = createMockContext();
      const error = new Error('Something went wrong');
      const options: ErrorHandlerOptions = { detailed: true };

      // Act
      handleRouteError(ctx, error, options);

      // Assert
      expect(ctx.response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Error',
          message: 'Something went wrong',
          stack: error.stack,
        })
      );
    });

    test('includes validation details when available', () => {
      // Arrange
      const ctx = createMockContext();
      const validationError = new Error('Validation failed');
      (validationError as any).details = { field: 'email', message: 'Invalid email' };
      const options: ErrorHandlerOptions = { detailed: true };

      // Act
      handleRouteError(ctx, validationError, options);

      // Assert
      expect(ctx.response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          details: { field: 'email', message: 'Invalid email' },
        })
      );
    });
  });

  describe('Error status code detection', () => {
    test('detects status property', () => {
      // Arrange
      const ctx = createMockContext();
      const error = new Error('Not found');
      (error as any).status = 404;

      // Act
      handleRouteError(ctx, error);

      // Assert
      expect(ctx.response.status).toHaveBeenCalledWith(404);
    });

    test('detects statusCode property', () => {
      // Arrange
      const ctx = createMockContext();
      const error = new Error('Unauthorized');
      (error as any).statusCode = 401;

      // Act
      handleRouteError(ctx, error);

      // Assert
      expect(ctx.response.status).toHaveBeenCalledWith(401);
    });

    test('detects code property and maps to status', () => {
      // Arrange
      const ctx = createMockContext();
      const error = new Error('Not found');
      (error as any).code = 'NOT_FOUND';

      // Act
      handleRouteError(ctx, error);

      // Assert
      expect(ctx.response.status).toHaveBeenCalledWith(404);
    });

    test('handles different error code mappings', () => {
      // Create a test for each error code mapping
      const testCases = [
        { code: 'NOT_FOUND', expectedStatus: 404 },
        { code: 'UNAUTHORIZED', expectedStatus: 401 },
        { code: 'FORBIDDEN', expectedStatus: 403 },
        { code: 'BAD_REQUEST', expectedStatus: 400 },
        { code: 'CONFLICT', expectedStatus: 409 },
        { code: 'UNKNOWN_CODE', expectedStatus: 500 },
      ];

      testCases.forEach(({ code, expectedStatus }) => {
        // Arrange
        const ctx = createMockContext();
        const error = new Error('Error with code');
        (error as any).code = code;

        // Act
        handleRouteError(ctx, error);

        // Assert
        expect(ctx.response.status).toHaveBeenCalledWith(expectedStatus);
      });
    });

    test('defaults to 500 for unknown errors', () => {
      // Arrange
      const ctx = createMockContext();
      const error = 'Just a string';

      // Act
      handleRouteError(ctx, error);

      // Assert
      expect(ctx.response.status).toHaveBeenCalledWith(500);
    });
  });

  describe('Error type detection', () => {
    test('uses type property if available', () => {
      // Arrange
      const ctx = createMockContext();
      const error = new Error('Error with type');
      (error as any).type = 'ValidationFailure';

      // Act
      handleRouteError(ctx, error);

      // Assert
      expect(ctx.response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'ValidationFailure',
        })
      );
    });

    test('uses name property if available', () => {
      // Arrange
      const ctx = createMockContext();
      const error = new Error('Error with name');
      error.name = 'NotFoundError';

      // Act
      handleRouteError(ctx, error);

      // Assert
      expect(ctx.response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'NotFoundError',
        })
      );
    });

    test('uses constructor name for Error instances', () => {
      // Arrange
      const ctx = createMockContext();

      // Create a custom error class
      class CustomError extends Error {
        constructor(message: string) {
          super(message);
          this.name = 'CustomError';
        }
      }

      const error = new CustomError('Custom error occurred');

      // Act
      handleRouteError(ctx, error);

      // Assert
      expect(ctx.response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'CustomError',
        })
      );
    });

    test('defaults to "Error" for non-Error objects', () => {
      // Arrange
      const ctx = createMockContext();
      const error = { message: 'Not an Error instance' };

      // Act
      handleRouteError(ctx, error);

      // Assert
      expect(ctx.response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Error',
        })
      );
    });
  });

  describe('Error message detection', () => {
    test('uses message from Error instance', () => {
      // Arrange
      const ctx = createMockContext();
      const error = new Error('Specific error message');

      // Act
      handleRouteError(ctx, error);

      // Assert
      expect(ctx.response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Specific error message',
        })
      );
    });

    test('uses message property from object', () => {
      // Arrange
      const ctx = createMockContext();
      const error = { message: 'Object with message property' };

      // Act
      handleRouteError(ctx, error);

      // Assert
      expect(ctx.response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Object with message property',
        })
      );
    });

    test('converts non-string errors to string', () => {
      // Arrange
      const ctx = createMockContext();
      const error = 42; // Number instead of Error

      // Act
      handleRouteError(ctx, error);

      // Assert
      expect(ctx.response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '42',
        })
      );
    });

    test('handles null and undefined errors', () => {
      // Arrange
      const ctx = createMockContext();

      // Act & Assert for null
      handleRouteError(ctx, null);
      expect(ctx.response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'null',
        })
      );

      // Reset mocks
      vi.clearAllMocks();

      // Act & Assert for undefined
      handleRouteError(ctx, undefined);
      expect(ctx.response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'undefined',
        })
      );
    });
  });

  describe('Integration tests', () => {
    test('handles a complete custom error object', () => {
      // Arrange
      const ctx = createMockContext();
      const customError = {
        name: 'ValidationError',
        type: 'InputValidation', // This should take precedence over name
        message: 'Invalid input provided',
        status: 400,
        details: {
          fields: ['email', 'password'],
          reasons: ['Email format invalid', 'Password too short'],
        },
        code: 'BAD_REQUEST', // This should be ignored since status is present
      };

      const options: ErrorHandlerOptions = {
        detailed: true,
        log: true,
      };

      // Act
      handleRouteError(ctx, customError, options);

      // Assert
      expect(console.error).toHaveBeenCalled();
      expect(ctx.response.status).toHaveBeenCalledWith(400); // From status property
      expect(ctx.response.json).toHaveBeenCalledWith({
        error: 'InputValidation', // From type property
        message: 'Invalid input provided',
        details: {
          fields: ['email', 'password'],
          reasons: ['Email format invalid', 'Password too short'],
        },
      });
    });

    test('handles non-Error JavaScript exceptions', () => {
      // Arrange
      const ctx = createMockContext();

      // Create various non-Error exceptions
      const testCases = [
        { value: 'string error', expectedMessage: 'string error' },
        { value: 42, expectedMessage: '42' },
        { value: false, expectedMessage: 'false' },
        { value: { custom: 'object' }, expectedMessage: '[object Object]' }, // Default string conversion
        { value: [1, 2, 3], expectedMessage: '1,2,3' }, // Default array toString
      ];

      testCases.forEach(({ value, expectedMessage }) => {
        // Reset mocks
        vi.clearAllMocks();

        // Act
        handleRouteError(ctx, value);

        // Assert
        expect(ctx.response.status).toHaveBeenCalledWith(500);
        expect(ctx.response.json).toHaveBeenCalledWith({
          error: 'Error',
          message: expectedMessage,
        });
      });
    });
  });
});
