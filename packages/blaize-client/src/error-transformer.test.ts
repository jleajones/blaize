/**
 * Tests for Error Transformation System
 */
import {
  parseAndThrowErrorResponse,
  transformClientError,
  generateClientCorrelationId,
  isNativeError,
  createGenericBlaizeError,
} from './error-transformer';
import { NetworkError } from './errors/network-error';
import { ParseError } from './errors/parse-error';
import { TimeoutError } from './errors/timeout-error';
import { ErrorType, BlaizeError } from '../../blaize-types/src/errors';

import type { BlaizeErrorResponse } from '../../blaize-types/src/errors';

// Mock fetch globally for tests
global.fetch = vi.fn();

describe('Error Transformation System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateClientCorrelationId', () => {
    test('generates unique correlation IDs with client prefix', () => {
      const id1 = generateClientCorrelationId();
      const id2 = generateClientCorrelationId();

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^client_[a-z0-9_]+$/);
      expect(id2).toMatch(/^client_[a-z0-9_]+$/);
    });

    test('includes timestamp component for ordering', () => {
      const beforeTime = Date.now();
      const correlationId = generateClientCorrelationId();
      const afterTime = Date.now();

      // Extract timestamp from correlation ID (base36 encoded)
      const timestampPart = correlationId.split('_')[1];
      const decodedTimestamp = parseInt(timestampPart!, 36);

      expect(decodedTimestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(decodedTimestamp).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('parseAndThrowErrorResponse', () => {
    test('parses and throws proper BlaizeError response from server', async () => {
      const serverErrorResponse: BlaizeErrorResponse = {
        type: ErrorType.VALIDATION_ERROR,
        title: 'Validation failed',
        status: 400,
        correlationId: 'req_server_123',
        timestamp: new Date().toISOString(),
        details: {
          fields: [{ field: 'email', messages: ['Email is required'] }],
          errorCount: 1,
          section: 'body',
        },
      };

      const mockResponse = {
        status: 400,
        statusText: 'Bad Request',
        headers: new Map([['x-correlation-id', 'req_server_123']]),
        json: vi.fn().mockResolvedValue(serverErrorResponse),
      } as any;

      let thrownError: BlaizeError | null = null;
      
      try {
        await parseAndThrowErrorResponse(mockResponse);
        expect.fail('Expected function to throw, but it did not');
      } catch (err) {
        thrownError = err as BlaizeError;
      }

      expect(thrownError).toBeInstanceOf(BlaizeError);
      expect(thrownError!.type).toBe(ErrorType.VALIDATION_ERROR);
      expect(thrownError!.title).toBe('Validation failed');
      expect(thrownError!.status).toBe(400);
      expect(thrownError!.correlationId).toBe('req_server_123');
      expect(thrownError!.details).toEqual(serverErrorResponse.details);
    });

    test('handles non-BlaizeError server responses', async () => {
      const genericErrorResponse = {
        error: 'Something went wrong',
        message: 'Internal server error',
      };

      const mockResponse = {
        status: 500,
        statusText: 'Internal Server Error',
        headers: new Map([['x-correlation-id', 'req_generic_456']]),
        json: vi.fn().mockResolvedValue(genericErrorResponse),
      } as any;

      let thrownError: BlaizeError | null = null;

      try {
        await parseAndThrowErrorResponse(mockResponse);
        expect.fail('Expected function to throw, but it did not');
      } catch (err) {
        thrownError = err as BlaizeError;
      }

      expect(thrownError).toBeInstanceOf(BlaizeError);
      expect(thrownError!.type).toBe(ErrorType.HTTP_ERROR);
      expect(thrownError!.title).toBe('Internal Server Error');
      expect(thrownError!.status).toBe(500);
      expect(thrownError!.correlationId).toBe('req_generic_456');
    });

    test('handles JSON parsing failures from server', async () => {
      const mockResponse = {
        status: 500,
        statusText: 'Internal Server Error',
        headers: new Map([['x-correlation-id', 'req_json_fail_789']]),
        json: vi.fn().mockRejectedValue(new SyntaxError('Unexpected token')),
      } as any;

      let thrownError: ParseError | null = null;

      try {
        await parseAndThrowErrorResponse(mockResponse);
        expect.fail('Expected function to throw, but it did not');
      } catch (err) {
        thrownError = err as ParseError;
      }

      expect(thrownError).toBeInstanceOf(ParseError);
      expect(thrownError!.type).toBe(ErrorType.PARSE_ERROR);
      expect(thrownError!.correlationId).toBe('req_json_fail_789');
      expect(thrownError!.details!.expectedFormat!).toBe('json');
      expect(thrownError!.details!.statusCode!).toBe(500);
    });

    test('extracts correlation ID from headers or generates fallback', async () => {
      const mockResponse = {
        status: 404,
        statusText: 'Not Found',
        headers: new Map(), // No correlation ID header
        json: vi.fn().mockResolvedValue({ error: 'Not found' }),
      } as any;

      let thrownError: BlaizeError | null = null;

      try {
        await parseAndThrowErrorResponse(mockResponse);
        expect.fail('Expected function to throw, but it did not');
      } catch (err) {
        thrownError = err as BlaizeError;
      }

      expect(thrownError).toBeInstanceOf(BlaizeError);
      expect(thrownError!.correlationId).toMatch(/^client_[a-z0-9_]+$/); // Generated client ID
    });

    test('always throws, never returns', async () => {
      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: new Map(),
        json: vi.fn().mockResolvedValue({ data: 'success' }),
      } as any;

      // Even for successful responses, this function should throw
      await expect(parseAndThrowErrorResponse(mockResponse)).rejects.toThrow();
    });
  });

  describe('transformClientError', () => {
    test('transforms TypeError fetch failures to NetworkError', () => {
      const originalError = new TypeError('Failed to fetch');
      const context = {
        url: 'https://api.example.com/users',
        method: 'GET',
        correlationId: 'client_network_test',
      };

      let thrownError: NetworkError | null = null;

      try {
        transformClientError(originalError, context);
        expect.fail('Expected function to throw, but it did not');
      } catch (err) {
        thrownError = err as NetworkError;
      }

      expect(thrownError).toBeInstanceOf(NetworkError);
      expect(thrownError).toBeInstanceOf(BlaizeError);
      expect(thrownError!.type).toBe(ErrorType.NETWORK_ERROR);
      expect(thrownError!.details?.url).toBe(context.url);
      expect(thrownError!.details?.method).toBe(context.method);
      expect(thrownError!.details?.originalError).toBe(originalError);
      expect(thrownError!.correlationId).toBe(context.correlationId);
    });

    test('transforms AbortError to TimeoutError', () => {
      const originalError = new Error('AbortError');
      originalError.name = 'AbortError';

      const context = {
        url: 'https://api.example.com/slow',
        method: 'POST',
        correlationId: 'client_timeout_test',
        timeoutMs: 5000,
        elapsedMs: 5100,
      };

      let thrownError: TimeoutError | null = null;

      try {
        transformClientError(originalError, context);
        expect.fail('Expected function to throw, but it did not');
      } catch (err) {
        thrownError = err as TimeoutError;
      }

      expect(thrownError).toBeInstanceOf(TimeoutError);
      expect(thrownError).toBeInstanceOf(BlaizeError);
      expect(thrownError!.type).toBe(ErrorType.TIMEOUT_ERROR);
      expect(thrownError!.details?.url).toBe(context.url);
      expect(thrownError!.details?.timeoutMs).toBe(context.timeoutMs);
      expect(thrownError!.details?.elapsedMs).toBe(context.elapsedMs);
      expect(thrownError!.correlationId).toBe(context.correlationId);
    });

    test('transforms SyntaxError to ParseError', () => {
      const originalError = new SyntaxError('Unexpected end of JSON input');
      const context = {
        url: 'https://api.example.com/data',
        method: 'GET',
        correlationId: 'client_parse_test',
        statusCode: 200,
        contentType: 'application/json',
        responseSample: '{"incomplete": true',
      };

      let thrownError: ParseError | null = null;

      try {
        transformClientError(originalError, context);
        expect.fail('Expected function to throw, but it did not');
      } catch (err) {
        thrownError = err as ParseError;
      }

      expect(thrownError).toBeInstanceOf(ParseError);
      expect(thrownError).toBeInstanceOf(BlaizeError);
      expect(thrownError!.type).toBe(ErrorType.PARSE_ERROR);
      expect(thrownError!.details?.url).toBe(context.url);
      expect(thrownError!.details?.statusCode).toBe(context.statusCode);
      expect(thrownError!.details?.originalError).toBe(originalError);
      expect(thrownError!.correlationId).toBe(context.correlationId);
    });

    test('preserves existing BlaizeError instances', () => {
      const existingError = new NetworkError('Existing network error', {
        url: 'https://api.example.com/test',
        method: 'GET',
        correlationId: 'existing_correlation',
        originalError: new Error('Original'),
      });

      let thrownError: NetworkError | null = null;

      try {
        transformClientError(existingError, {
          url: 'different_url',
          method: 'POST',
          correlationId: 'different_correlation',
        });
        expect.fail('Expected function to throw, but it did not');
      } catch (err) {
        thrownError = err as NetworkError;
      }

      // Should be the exact same error instance
      expect(thrownError).toBe(existingError);
      expect(thrownError!.correlationId).toBe('existing_correlation'); // Unchanged
    });

    test('transforms unknown errors to generic BlaizeError', () => {
      const unknownError = new Error('Unknown error type');
      const context = {
        url: 'https://api.example.com/unknown',
        method: 'GET',
        correlationId: 'client_unknown_test',
      };

      let thrownError: BlaizeError | null = null;

      try {
        transformClientError(unknownError, context);
        expect.fail('Expected function to throw, but it did not');
      } catch (err) {
        thrownError = err as BlaizeError;
      }

      expect(thrownError).toBeInstanceOf(BlaizeError);
      expect(thrownError!.type).toBe(ErrorType.HTTP_ERROR);
      expect(thrownError!.title).toContain('Unknown error type');
      expect(thrownError!.correlationId).toBe(context.correlationId);
    });

    test('always throws, never returns', () => {
      const error = new Error('Test error');
      const context = {
        url: 'https://api.example.com/test',
        method: 'GET',
        correlationId: 'test_correlation',
      };

      expect(() => {
        transformClientError(error, context);
      }).toThrow();
    });
  });

  describe('isNativeError', () => {
    test('identifies native JavaScript error types', () => {
      expect(isNativeError(new Error('Generic error'))).toBe(true);
      expect(isNativeError(new TypeError('Type error'))).toBe(true);
      expect(isNativeError(new SyntaxError('Syntax error'))).toBe(true);
      expect(isNativeError(new ReferenceError('Reference error'))).toBe(true);
      expect(isNativeError(new RangeError('Range error'))).toBe(true);
    });

    test('identifies BlaizeError instances as non-native', () => {
      const networkError = new NetworkError('Network error', {
        url: 'https://api.example.com/test',
        method: 'GET',
        correlationId: 'test_correlation',
        originalError: new Error('Original'),
      });

      expect(isNativeError(networkError)).toBe(false);
    });

    test('handles edge cases', () => {
      expect(isNativeError(null)).toBe(false);
      expect(isNativeError(undefined)).toBe(false);
      expect(isNativeError('string error')).toBe(false);
      expect(isNativeError({ message: 'object error' })).toBe(false);
    });
  });

  describe('createGenericBlaizeError', () => {
    test('creates generic BlaizeError from Error instance', () => {
      const originalError = new Error('Generic error message');
      const correlationId = 'test_correlation_123';

      const genericError = createGenericBlaizeError(originalError, correlationId);

      expect(genericError).toBeInstanceOf(BlaizeError);
      expect(genericError.type).toBe(ErrorType.HTTP_ERROR);
      expect(genericError.title).toBe('Generic error message');
      expect(genericError.status).toBe(0);
      expect(genericError.correlationId).toBe(correlationId);
      expect(genericError.details).toEqual({
        originalError,
        errorType: 'Error',
      });
    });

    test('creates generic BlaizeError from string', () => {
      const errorMessage = 'String error message';
      const correlationId = 'test_correlation_456';

      const genericError = createGenericBlaizeError(errorMessage, correlationId);

      expect(genericError).toBeInstanceOf(BlaizeError);
      expect(genericError.type).toBe(ErrorType.HTTP_ERROR);
      expect(genericError.title).toBe('String error message');
      expect(genericError.status).toBe(0);
      expect(genericError.correlationId).toBe(correlationId);
      expect(genericError.details).toEqual({
        originalError: errorMessage,
        errorType: 'string',
      });
    });

    test('creates generic BlaizeError from unknown object', () => {
      const errorObject = { code: 'UNKNOWN', message: 'Object error' };
      const correlationId = 'test_correlation_789';

      const genericError = createGenericBlaizeError(errorObject, correlationId);

      expect(genericError).toBeInstanceOf(BlaizeError);
      expect(genericError.type).toBe(ErrorType.HTTP_ERROR);
      expect(genericError.title).toContain('Unknown error');
      expect(genericError.status).toBe(0);
      expect(genericError.correlationId).toBe(correlationId);
      expect(genericError.details).toEqual({
        originalError: errorObject,
        errorType: 'object',
      });
    });
  });

  describe('Error transformation integration', () => {
    test('network error transformation preserves correlation ID', () => {
      const correlationId = 'integration_network_test';
      const originalError = new TypeError('Failed to fetch');
      const context = {
        url: 'https://api.example.com/integration',
        method: 'POST',
        correlationId,
      };

      let thrownError: NetworkError | null = null;

      try {
        transformClientError(originalError, context);
        expect.fail('Expected function to throw, but it did not');
      } catch (err) {
        thrownError = err as NetworkError;
      }

      expect(thrownError).toBeInstanceOf(NetworkError);
      expect(thrownError!.correlationId).toBe(correlationId);
      expect(thrownError!.details?.correlationId).toBe(correlationId);
    });

    test('timeout error transformation preserves timing context', () => {
      const correlationId = 'integration_timeout_test';
      const originalError = new Error('AbortError');
      originalError.name = 'AbortError';

      const context = {
        url: 'https://api.example.com/timeout-test',
        method: 'GET',
        correlationId,
        timeoutMs: 10000,
        elapsedMs: 10500,
      };

      let thrownError: TimeoutError | null = null;

      try {
        transformClientError(originalError, context);
        expect.fail('Expected function to throw, but it did not');
      } catch (err) {
        thrownError = err as TimeoutError;
      }

      expect(thrownError).toBeInstanceOf(TimeoutError);
      expect(thrownError!.details?.timeoutMs).toBe(10000);
      expect(thrownError!.details?.elapsedMs).toBe(10500);
      expect(thrownError!.correlationId).toBe(correlationId);
    });

    test('parse error transformation preserves response context', () => {
      const correlationId = 'integration_parse_test';
      const originalError = new SyntaxError('Unexpected token');
      const context = {
        url: 'https://api.example.com/parse-test',
        method: 'GET',
        correlationId,
        statusCode: 200,
        contentType: 'application/json',
        responseSample: '{"malformed": json}',
      };

      let thrownError: ParseError | null = null;

      try {
        transformClientError(originalError, context);
        expect.fail('Expected function to throw, but it did not');
      } catch (err) {
        thrownError = err as ParseError;
      }

      expect(thrownError).toBeInstanceOf(ParseError);
      expect(thrownError!.details?.statusCode).toBe(200);
      expect(thrownError!.details?.contentType).toBe('application/json');
      expect(thrownError!.details?.responseSample).toBe('{"malformed": json}');
      expect(thrownError!.correlationId).toBe(correlationId);
    });
  });

  describe('Error transformation guarantees', () => {
    test('all transformed errors are BlaizeError instances', () => {
      const testCases = [
        {
          error: new TypeError('Failed to fetch'),
          context: { url: 'test', method: 'GET', correlationId: 'test1' },
        },
        {
          error: new Error('AbortError'),
          context: { url: 'test', method: 'GET', correlationId: 'test2' },
        },
        {
          error: new SyntaxError('Parse error'),
          context: { url: 'test', method: 'GET', correlationId: 'test3' },
        },
        {
          error: new Error('Generic error'),
          context: { url: 'test', method: 'GET', correlationId: 'test4' },
        },
      ];

      // Set AbortError name for second test case
      (testCases[1]!.error as any).name = 'AbortError';

      testCases.forEach(({ error, context }, index) => {
        let transformedError: BlaizeError | null = null;
        
        try {
          transformClientError(error, context);
          expect.fail(`Test case ${index} should have thrown an error`);
        } catch (err) {
          transformedError = err as BlaizeError;
        }

        expect(transformedError).toBeInstanceOf(BlaizeError);
        expect(transformedError!.correlationId).toBe(context.correlationId);
      });
    });

    test('no type guards needed in client code', () => {
      // Simulate client code that handles errors
      const handleClientError = (error: BlaizeError) => {
        // Client code can safely assume all errors are BlaizeError instances
        expect(error.type).toBeDefined();
        expect(error.title).toBeDefined();
        expect(error.status).toBeDefined();
        expect(error.correlationId).toBeDefined();
        expect(error.timestamp).toBeDefined();

        // No instanceof checks needed - framework guarantees BlaizeError
        return {
          type: error.type,
          message: error.title,
          correlationId: error.correlationId,
        };
      };

      const testErrors = [
        new TypeError('Network failure'),
        new Error('AbortError'),
        new SyntaxError('JSON parse error'),
      ];

      // Set AbortError name
      (testErrors[1] as any).name = 'AbortError';

      testErrors.forEach((originalError, index) => {
        let transformedError: BlaizeError | null = null;
        
        try {
          transformClientError(originalError, {
            url: 'https://api.example.com/test',
            method: 'GET',
            correlationId: `no_type_guard_test_${index}`,
          });
          expect.fail(`Error ${index} should have been thrown`);
        } catch (err) {
          transformedError = err as BlaizeError;
        }

        // Client can handle without type guards
        const result = handleClientError(transformedError!);
        expect(result.type).toBeDefined();
        expect(result.message).toBeDefined();
        expect(result.correlationId).toBe(`no_type_guard_test_${index}`);
      });
    });
  });
});