/* eslint-disable import/order */
import { ErrorType } from '@blaize-types/errors';

import {
  isHandledError,
  formatErrorResponse,
  extractOrGenerateCorrelationId,
  setErrorResponseHeaders,
} from './boundary';
import { NotFoundError } from './not-found-error';
import { ValidationError } from './validation-error';

const DEFAULT_CORRELATION_ID = 'generated-correlation-id';
const DEFAULT_CORRELATION_HEADER = 'x-correlation-id';
const DEFAULT_CURRENT_CORRELATION_ID = 'current-correlation-id';

// Mock the correlation module
vi.mock('../tracing/correlation', () => ({
  createCorrelationIdFromHeaders: vi.fn((headers: Record<string, string | undefined>) => {
    // Check for the header based on what's passed in
    const headerNames = Object.keys(headers);
    const headerName = headerNames[0];
    if (headerName) {
      const value = headers[headerName];
      return value || DEFAULT_CURRENT_CORRELATION_ID;
    }
    return DEFAULT_CORRELATION_ID;
  }),
  getCorrelationHeaderName: vi.fn(() => DEFAULT_CORRELATION_HEADER),
  getCorrelationId: vi.fn(() => DEFAULT_CURRENT_CORRELATION_ID),
}));

// Import after mocking to get mocked versions
import { getCorrelationId, getCorrelationHeaderName } from '../tracing/correlation';

describe('Error Boundary Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isHandledError', () => {
    it('should return true for BlaizeError instances', () => {
      const notFoundError = new NotFoundError('User not found');
      const validationError = new ValidationError('Invalid input');

      expect(isHandledError(notFoundError)).toBe(true);
      expect(isHandledError(validationError)).toBe(true);
    });

    it('should return false for non-BlaizeError instances', () => {
      const plainError = new Error('Regular error');
      const stringError = 'String error';
      const nullError = null;
      const undefinedError = undefined;

      expect(isHandledError(plainError)).toBe(false);
      expect(isHandledError(stringError)).toBe(false);
      expect(isHandledError(nullError)).toBe(false);
      expect(isHandledError(undefinedError)).toBe(false);
    });
  });

  describe('formatErrorResponse', () => {
    it('should format BlaizeError instances correctly', () => {
      const correlationId = 'test-correlation-123';
      const notFoundError = new NotFoundError(
        'User not found',
        { resourceType: 'user', resourceId: '123' },
        correlationId
      );

      const response = formatErrorResponse(notFoundError);

      expect(response).toEqual({
        type: ErrorType.NOT_FOUND,
        title: 'User not found',
        status: 404,
        correlationId,
        timestamp: expect.any(String),
        details: { resourceType: 'user', resourceId: '123' },
      });

      // Verify timestamp is valid ISO string
      expect(() => new Date(response.timestamp)).not.toThrow();
    });

    it('should generate correlation ID for BlaizeError without one', () => {
      // Create a validation error with a mock correlation ID
      const validationError = new ValidationError('Invalid input');
      // We'll test that the existing correlation ID is preserved
      // Note: correlationId is readonly, so we test with what the constructor provides

      const response = formatErrorResponse(validationError);

      // The ValidationError constructor will use getCurrentCorrelationId from the mock
      expect(response.correlationId).toBe(DEFAULT_CURRENT_CORRELATION_ID);
    });

    it('should format unexpected errors as InternalServerError', () => {
      const unexpectedError = new Error('Database connection failed');

      const response = formatErrorResponse(unexpectedError);

      expect(response).toEqual({
        type: ErrorType.INTERNAL_SERVER_ERROR,
        title: 'Internal Server Error',
        status: 500,
        correlationId: DEFAULT_CURRENT_CORRELATION_ID,
        timestamp: expect.any(String),
        details: {
          originalMessage: 'Database connection failed',
        },
      });

      expect(getCorrelationId).toHaveBeenCalled();
    });

    it('should handle non-error objects gracefully', () => {
      const response = formatErrorResponse('string error');

      expect(response).toEqual({
        type: ErrorType.INTERNAL_SERVER_ERROR,
        title: 'Internal Server Error',
        status: 500,
        correlationId: DEFAULT_CURRENT_CORRELATION_ID,
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
        correlationId: DEFAULT_CURRENT_CORRELATION_ID,
        timestamp: expect.any(String),
        details: {
          originalMessage: 'Unknown error occurred',
        },
      });
    });
  });

  describe('extractOrGenerateCorrelationId', () => {
    it('should extract correlation ID from configured header', () => {
      const headerGetter = vi.fn((name: string) => {
        if (name === DEFAULT_CORRELATION_HEADER) return 'request-correlation-456';
        return undefined;
      });

      const correlationId = extractOrGenerateCorrelationId(headerGetter);

      expect(headerGetter).toHaveBeenCalledWith(DEFAULT_CORRELATION_HEADER);
      expect(correlationId).toBe('request-correlation-456');
      expect(getCorrelationHeaderName).toHaveBeenCalled();
    });

    it('should generate correlation ID when header is missing', () => {
      const headerGetter = vi.fn(() => undefined);

      const correlationId = extractOrGenerateCorrelationId(headerGetter);

      expect(headerGetter).toHaveBeenCalledWith(DEFAULT_CORRELATION_HEADER);
      expect(correlationId).toBe(DEFAULT_CURRENT_CORRELATION_ID);
    });

    it('should use custom header name when configured', () => {
      // Mock custom header name
      vi.mocked(getCorrelationHeaderName).mockReturnValueOnce('x-request-id');

      const headerGetter = vi.fn((name: string) => {
        if (name === 'x-request-id') return 'custom-header-789';
        return undefined;
      });

      const correlationId = extractOrGenerateCorrelationId(headerGetter);

      expect(headerGetter).toHaveBeenCalledWith('x-request-id');
      expect(correlationId).toBe('custom-header-789');
    });

    it('should handle empty string header values', () => {
      const headerGetter = vi.fn(() => '');

      const correlationId = extractOrGenerateCorrelationId(headerGetter);

      expect(correlationId).toBe(DEFAULT_CURRENT_CORRELATION_ID);
    });
  });

  describe('setErrorResponseHeaders', () => {
    it('should set correlation header with default name', () => {
      const headerSetter = vi.fn();
      const correlationId = 'response-correlation-123';

      setErrorResponseHeaders(headerSetter, correlationId);

      expect(getCorrelationHeaderName).toHaveBeenCalled();
      expect(headerSetter).toHaveBeenCalledWith(DEFAULT_CORRELATION_HEADER, correlationId);
    });

    it('should set correlation header with custom name', () => {
      // Mock custom header name
      vi.mocked(getCorrelationHeaderName).mockReturnValueOnce('x-trace-id');

      const headerSetter = vi.fn();
      const correlationId = 'trace-correlation-456';

      setErrorResponseHeaders(headerSetter, correlationId);

      expect(headerSetter).toHaveBeenCalledWith('x-trace-id', correlationId);
    });

    it('should only call headerSetter once for correlation header', () => {
      const headerSetter = vi.fn();
      const correlationId = 'test-correlation';

      setErrorResponseHeaders(headerSetter, correlationId);

      // Should only be called once (for the correlation header)
      expect(headerSetter).toHaveBeenCalledTimes(1);
    });
  });

  describe('Integration with Configuration', () => {
    it('should work end-to-end with default configuration', () => {
      const headerGetter = vi.fn(() => 'incoming-correlation');
      const headerSetter = vi.fn();

      // Extract from request
      const correlationId = extractOrGenerateCorrelationId(headerGetter);
      expect(correlationId).toBe('incoming-correlation');

      // Set in response
      setErrorResponseHeaders(headerSetter, correlationId);
      expect(headerSetter).toHaveBeenCalledWith(DEFAULT_CORRELATION_HEADER, 'incoming-correlation');
    });

    it('should work end-to-end with custom header configuration', () => {
      // Mock custom configuration
      vi.mocked(getCorrelationHeaderName).mockReturnValue('x-request-trace-id');

      const headerGetter = vi.fn((name: string) => {
        if (name === 'x-request-trace-id') return 'custom-trace-999';
        return undefined;
      });
      const headerSetter = vi.fn();

      // Extract from request with custom header
      const correlationId = extractOrGenerateCorrelationId(headerGetter);
      expect(headerGetter).toHaveBeenCalledWith('x-request-trace-id');
      expect(correlationId).toBe('custom-trace-999');

      // Set in response with custom header
      setErrorResponseHeaders(headerSetter, correlationId);
      expect(headerSetter).toHaveBeenCalledWith('x-request-trace-id', 'custom-trace-999');
    });

    it('should maintain backward compatibility', () => {
      // Reset to default configuration
      vi.mocked(getCorrelationHeaderName).mockReturnValue(DEFAULT_CORRELATION_HEADER);

      const headerGetter = vi.fn((name: string) => {
        if (name === DEFAULT_CORRELATION_HEADER) return 'legacy-correlation';
        return undefined;
      });

      const correlationId = extractOrGenerateCorrelationId(headerGetter);

      // Should still work with default header
      expect(correlationId).toBe('legacy-correlation');
      expect(headerGetter).toHaveBeenCalledWith(DEFAULT_CORRELATION_HEADER);
    });
  });
});
