/**
 * Tests for ParseError class
 */

import { ParseError } from './parse-error';
import { ErrorType } from '../../../blaize-types/src/errors';

import type { ParseErrorContext } from '../../../blaize-types/src/errors';

describe('ParseError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    test('creates ParseError with correct type and status', () => {
      const originalError = new SyntaxError('Unexpected token');
      const context: ParseErrorContext = {
        url: 'https://api.example.com/data',
        method: 'GET',
        correlationId: 'client_parse_123',
        statusCode: 200,
        contentType: 'application/json',
        expectedFormat: 'json',
        responseSample: '{"incomplete": true',
        originalError,
      };

      const error = new ParseError('Failed to parse JSON response', context);

      expect(error).toBeInstanceOf(ParseError);
      expect(error).toBeInstanceOf(Error);
      expect(error.type).toBe(ErrorType.PARSE_ERROR);
      expect(error.status).toBe(0); // Client-side errors have 0 status
      expect(error.title).toBe('Failed to parse JSON response');
      expect(error.name).toBe('ParseError');
    });

    test('uses correlation ID from context', () => {
      const originalError = new Error('Parse failure');
      const context: ParseErrorContext = {
        url: 'https://api.example.com/xml',
        method: 'POST',
        correlationId: 'client_parse_xyz_789',
        statusCode: 200,
        expectedFormat: 'json',
        originalError,
      };

      const error = new ParseError('XML response when JSON expected', context);

      expect(error.correlationId).toBe('client_parse_xyz_789');
    });

    test('accepts custom correlation ID override', () => {
      const originalError = new Error('Invalid format');
      const context: ParseErrorContext = {
        url: 'https://api.example.com/binary',
        method: 'GET',
        correlationId: 'client_default_parse',
        statusCode: 200,
        expectedFormat: 'json',
        originalError,
      };

      const customCorrelationId = 'custom_parse_override_123';
      const error = new ParseError('Binary response received', context, customCorrelationId);

      expect(error.correlationId).toBe(customCorrelationId);
    });

    test('preserves parse context details', () => {
      const originalError = new SyntaxError('Unexpected end of JSON input');
      const context: ParseErrorContext = {
        url: 'https://api.example.com/incomplete',
        method: 'GET',
        correlationId: 'client_incomplete_456',
        statusCode: 200,
        contentType: 'application/json; charset=utf-8',
        expectedFormat: 'json',
        responseSample: '{"data": [{"id": 1, "name": "John"',
        originalError,
      };

      const error = new ParseError('Incomplete JSON response', context);

      expect(error.details).toEqual(context);
      expect(error.details?.url).toBe('https://api.example.com/incomplete');
      expect(error.details?.method).toBe('GET');
      expect(error.details?.statusCode).toBe(200);
      expect(error.details?.contentType).toBe('application/json; charset=utf-8');
      expect(error.details?.expectedFormat).toBe('json');
      expect(error.details?.responseSample).toContain('{"data": [');
      expect(error.details?.originalError).toBe(originalError);
    });

    test('sets timestamp to current date', () => {
      const originalError = new Error('Parse error');
      const context: ParseErrorContext = {
        url: 'https://api.example.com/test',
        method: 'GET',
        correlationId: 'client_timestamp_test',
        statusCode: 200,
        expectedFormat: 'json',
        originalError,
      };

      const beforeCreation = new Date();
      const error = new ParseError('Test parse error', context);
      const afterCreation = new Date();

      expect(error.timestamp.getTime()).toBeGreaterThanOrEqual(beforeCreation.getTime());
      expect(error.timestamp.getTime()).toBeLessThanOrEqual(afterCreation.getTime());
    });
  });

  describe('inheritance and error properties', () => {
    test('inherits from BlaizeError correctly', () => {
      const originalError = new Error('Parse error');
      const context: ParseErrorContext = {
        url: 'https://api.example.com/test',
        method: 'GET',
        correlationId: 'client_inheritance_test',
        statusCode: 200,
        expectedFormat: 'json',
        originalError,
      };

      const error = new ParseError('Parse error', context);

      expect(error.type).toBeDefined();
      expect(error.title).toBeDefined();
      expect(error.status).toBeDefined();
      expect(error.correlationId).toBeDefined();
      expect(error.timestamp).toBeDefined();
      expect(error.details).toBeDefined();
    });

    test('extends Error correctly', () => {
      const originalError = new Error('Parse error');
      const context: ParseErrorContext = {
        url: 'https://api.example.com/test',
        method: 'GET',
        correlationId: 'client_error_test',
        statusCode: 200,
        expectedFormat: 'json',
        originalError,
      };

      const error = new ParseError('Parse error', context);

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Parse error');
      expect(error.stack).toBeDefined();
    });

    test('preserves error stack trace', () => {
      const originalError = new Error('Parse error');
      const context: ParseErrorContext = {
        url: 'https://api.example.com/test',
        method: 'GET',
        correlationId: 'client_stack_test',
        statusCode: 200,
        expectedFormat: 'json',
        originalError,
      };

      const error = new ParseError('Parse error', context);

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('ParseError');
      expect(error.stack).toContain('Parse error');
    });
  });

  describe('toJSON serialization', () => {
    test('serializes to proper error response format', () => {
      const originalError = new SyntaxError('Invalid JSON');
      const context: ParseErrorContext = {
        url: 'https://api.example.com/malformed',
        method: 'GET',
        correlationId: 'client_serialize_test',
        statusCode: 200,
        contentType: 'application/json',
        expectedFormat: 'json',
        responseSample: '{invalid json}',
        originalError,
      };

      const error = new ParseError('JSON parse failed', context);
      const serialized = error.toJSON();

      expect(serialized).toEqual({
        type: ErrorType.PARSE_ERROR,
        title: 'JSON parse failed',
        status: 0,
        correlationId: 'client_serialize_test',
        timestamp: error.timestamp.toISOString(),
        details: context,
      });
    });

    test('includes all parse context in serialization', () => {
      const originalError = new Error('Encoding error');
      const context: ParseErrorContext = {
        url: 'https://api.example.com/binary-data',
        method: 'POST',
        correlationId: 'client_full_context',
        statusCode: 200,
        contentType: 'application/octet-stream',
        expectedFormat: 'json',
        responseSample: 'Binary data: 0x89504E47...',
        originalError,
      };

      const error = new ParseError('Cannot parse binary as JSON', context);
      const serialized = error.toJSON();
      const serializedError = serialized as typeof serialized & { details: ParseErrorContext };

      expect(serializedError.details).toEqual(context);
      expect(serializedError.details?.contentType).toBe('application/octet-stream');
      expect(serializedError.details?.responseSample).toContain('Binary data');
      expect(serializedError.details?.expectedFormat).toBe('json');
    });
  });

  describe('toString method', () => {
    test('returns formatted string representation', () => {
      const originalError = new Error('Parse error');
      const context: ParseErrorContext = {
        url: 'https://api.example.com/test',
        method: 'GET',
        correlationId: 'client_tostring_test',
        statusCode: 200,
        expectedFormat: 'json',
        originalError,
      };

      const error = new ParseError('Parse failed', context);
      const stringRep = error.toString();

      expect(stringRep).toBe('ParseError: Parse failed [client_tostring_test]');
    });

    test('includes correlation ID in string representation', () => {
      const originalError = new Error('Parse error');
      const context: ParseErrorContext = {
        url: 'https://api.example.com/test',
        method: 'GET',
        correlationId: 'custom_parse_correlation_xyz',
        statusCode: 200,
        expectedFormat: 'json',
        originalError,
      };

      const error = new ParseError('Parse error', context);
      const stringRep = error.toString();

      expect(stringRep).toContain('custom_parse_correlation_xyz');
      expect(stringRep).toBe('ParseError: Parse error [custom_parse_correlation_xyz]');
    });
  });

  describe('parse error scenarios', () => {
    test('malformed JSON response scenario', () => {
      const originalError = new SyntaxError('Unexpected token } in JSON at position 15');
      const context: ParseErrorContext = {
        url: 'https://api.example.com/users',
        method: 'GET',
        correlationId: 'client_malformed_json',
        statusCode: 200,
        contentType: 'application/json',
        expectedFormat: 'json',
        responseSample: '{"users": [}]}',
        originalError,
      };

      const error = new ParseError('Malformed JSON in response', context);

      expect(error.details?.url).toBe('https://api.example.com/users');
      expect(error.details?.statusCode).toBe(200);
      expect(error.details?.contentType).toBe('application/json');
      expect(error.details?.responseSample).toBe('{"users": [}]}');
      expect(error.details?.originalError.message).toContain('Unexpected token');
    });

    test('wrong content type scenario', () => {
      const originalError = new Error('Expected JSON but received HTML');
      const context: ParseErrorContext = {
        url: 'https://api.example.com/error-page',
        method: 'GET',
        correlationId: 'client_wrong_content_type',
        statusCode: 500,
        contentType: 'text/html',
        expectedFormat: 'json',
        responseSample: '<!DOCTYPE html><html><head><title>500 Error</title>',
        originalError,
      };

      const error = new ParseError('HTML error page instead of JSON', context);

      expect(error.details?.contentType).toBe('text/html');
      expect(error.details?.expectedFormat).toBe('json');
      expect(error.details?.responseSample).toContain('<!DOCTYPE html>');
      expect(error.details?.statusCode).toBe(500);
    });

    test('empty response scenario', () => {
      const originalError = new Error('Unexpected end of input');
      const context: ParseErrorContext = {
        url: 'https://api.example.com/empty',
        method: 'POST',
        correlationId: 'client_empty_response',
        statusCode: 204,
        contentType: 'application/json',
        expectedFormat: 'json',
        responseSample: '',
        originalError,
      };

      const error = new ParseError('Empty response body', context);

      expect(error.details?.statusCode).toBe(204);
      expect(error.details?.responseSample).toBe('');
      expect(error.details?.expectedFormat).toBe('json');
    });

    test('binary data as JSON scenario', () => {
      const originalError = new Error('Invalid character in JSON');
      const context: ParseErrorContext = {
        url: 'https://api.example.com/download',
        method: 'GET',
        correlationId: 'client_binary_data',
        statusCode: 200,
        contentType: 'application/octet-stream',
        expectedFormat: 'json',
        responseSample: '�PNG\r\n\x1a\n\x00\x00\x00\rIHDR...',
        originalError,
      };

      const error = new ParseError('Binary file received instead of JSON', context);

      expect(error.details?.contentType).toBe('application/octet-stream');
      expect(error.details?.responseSample).toContain('�PNG');
      expect(error.details?.expectedFormat).toBe('json');
    });

    test('text response as JSON scenario', () => {
      const originalError = new SyntaxError('Unexpected token h in JSON at position 0');
      const context: ParseErrorContext = {
        url: 'https://api.example.com/health',
        method: 'GET',
        correlationId: 'client_text_response',
        statusCode: 200,
        contentType: 'text/plain',
        expectedFormat: 'json',
        responseSample: 'healthy',
        originalError,
      };

      const error = new ParseError('Plain text response when JSON expected', context);

      expect(error.details?.contentType).toBe('text/plain');
      expect(error.details?.responseSample).toBe('healthy');
      expect(error.details?.expectedFormat).toBe('json');
    });
  });

  describe('different expected formats', () => {
    test('handles text format expectation', () => {
      const originalError = new Error('Encoding issue');
      const context: ParseErrorContext = {
        url: 'https://api.example.com/log',
        method: 'GET',
        correlationId: 'client_text_format',
        statusCode: 200,
        contentType: 'application/json',
        expectedFormat: 'text',
        responseSample: '{"message": "Should be plain text"}',
        originalError,
      };

      const error = new ParseError('JSON received when text expected', context);

      expect(error.details?.expectedFormat).toBe('text');
      expect(error.details?.contentType).toBe('application/json');
    });

    test('handles binary format expectation', () => {
      const originalError = new Error('Not binary data');
      const context: ParseErrorContext = {
        url: 'https://api.example.com/image',
        method: 'GET',
        correlationId: 'client_binary_format',
        statusCode: 200,
        contentType: 'text/plain',
        expectedFormat: 'binary',
        responseSample: 'This is not binary data',
        originalError,
      };

      const error = new ParseError('Text received when binary expected', context);

      expect(error.details?.expectedFormat).toBe('binary');
      expect(error.details?.contentType).toBe('text/plain');
    });
  });

  describe('integration with error handling', () => {
    test('can be thrown and caught properly', () => {
      const originalError = new Error('Parse error');
      const context: ParseErrorContext = {
        url: 'https://api.example.com/test',
        method: 'GET',
        correlationId: 'client_throw_test',
        statusCode: 200,
        expectedFormat: 'json',
        originalError,
      };

      expect(() => {
        throw new ParseError('Test parse error', context);
      }).toThrow(ParseError);

      expect(() => {
        throw new ParseError('Test parse error', context);
      }).toThrow('Test parse error');
    });

    test('maintains context when thrown across async boundaries', async () => {
      const originalError = new Error('Async parse error');
      const context: ParseErrorContext = {
        url: 'https://api.example.com/async-test',
        method: 'GET',
        correlationId: 'client_async_parse',
        statusCode: 200,
        expectedFormat: 'json',
        originalError,
      };

      const error = new ParseError('Async parse error', context);

      await expect(async () => {
        await new Promise(resolve => setTimeout(resolve, 1));
        throw error;
      }).rejects.toThrow(ParseError);

      expect(error.correlationId).toBe('client_async_parse');
      expect(error.details?.url).toBe('https://api.example.com/async-test');
      expect(error.details?.expectedFormat).toBe('json');
    });
  });
});
