import { ErrorType } from '@blaize-types/errors';

import { formatErrorResponse, isHandledError } from './boundary';
import { NotFoundError } from './not-found-error';
import { ValidationError } from './validation-error';

describe('Error Boundary Core Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isHandledError', () => {
    it('should return true for BlaizeError instances', () => {
      const error = new ValidationError('Test validation error');
      expect(isHandledError(error)).toBe(true);
    });

    it('should return true for NotFoundError instances', () => {
      const error = new NotFoundError('Test not found');
      expect(isHandledError(error)).toBe(true);
    });

    it('should return false for regular Error instances', () => {
      const error = new Error('Regular error');
      expect(isHandledError(error)).toBe(false);
    });

    it('should return false for non-error objects', () => {
      expect(isHandledError(null)).toBe(false);
      expect(isHandledError(undefined)).toBe(false);
      expect(isHandledError('string error')).toBe(false);
      expect(isHandledError({ message: 'error object' })).toBe(false);
    });
  });

  describe('formatErrorResponse', () => {
    it('should format BlaizeError with all properties', () => {
      const error = new ValidationError('Invalid data', {
        fields: [
          {
            field: 'email',
            messages: ['Email is required'],
            rejectedValue: undefined,
            expectedType: 'string',
          },
        ],
        errorCount: 1,
        section: 'body',
      });
      const response = formatErrorResponse(error);

      expect(response).toEqual({
        type: ErrorType.VALIDATION_ERROR,
        title: 'Invalid data',
        status: 400,
        correlationId: expect.any(String),
        timestamp: expect.any(String),
        details: {
          fields: [
            {
              field: 'email',
              messages: ['Email is required'],
              rejectedValue: undefined,
              expectedType: 'string',
            },
          ],
          errorCount: 1,
          section: 'body',
        },
      });
    });

    it('should format BlaizeError without details', () => {
      const error = new NotFoundError('User not found');

      const response = formatErrorResponse(error);

      expect(response).toEqual({
        type: ErrorType.NOT_FOUND,
        title: 'User not found',
        status: 404,
        correlationId: expect.any(String),
        timestamp: expect.any(String),
        details: undefined,
      });
    });

    it('should preserve correlation ID from error', () => {
      const correlationId = 'test_correlation_123';
      const error = new NotFoundError('Test error', undefined, correlationId);

      const response = formatErrorResponse(error);

      expect(response.correlationId).toBe(correlationId);
    });

    it('should format unexpected errors as InternalServerError', () => {
      const unexpectedError = new Error('Database connection failed');

      const response = formatErrorResponse(unexpectedError);

      expect(response).toEqual({
        type: ErrorType.INTERNAL_SERVER_ERROR,
        title: 'Internal Server Error',
        status: 500,
        correlationId: expect.any(String),
        timestamp: expect.any(String),
        details: {
          originalMessage: 'Database connection failed',
        },
      });
    });

    it('should handle non-error objects gracefully', () => {
      const response = formatErrorResponse('string error');

      expect(response).toEqual({
        type: ErrorType.INTERNAL_SERVER_ERROR,
        title: 'Internal Server Error',
        status: 500,
        correlationId: expect.any(String),
        timestamp: expect.any(String),
        details: {
          originalMessage: 'string error',
        },
      });
    });

    it('should handle null/undefined errors gracefully', () => {
      const response = formatErrorResponse(null);

      expect(response).toEqual({
        type: ErrorType.INTERNAL_SERVER_ERROR,
        title: 'Internal Server Error',
        status: 500,
        correlationId: expect.any(String),
        timestamp: expect.any(String),
        details: {
          originalMessage: 'Unknown error occurred',
        },
      });
    });
  });
});
