/**
 * Tests for TimeoutError class
 * Location: packages/blaize-client/src/errors/timeout-error.test.ts
 */

import { TimeoutError } from './timeout-error';
import { ErrorType } from '../../../blaize-types/src/errors';

import type { TimeoutErrorContext } from '../../../blaize-types/src/errors';

describe('TimeoutError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    test('creates TimeoutError with correct type and status', () => {
      const context: TimeoutErrorContext = {
        url: 'https://api.example.com/slow-endpoint',
        method: 'GET',
        correlationId: 'client_timeout_123',
        timeoutMs: 5000,
        elapsedMs: 5100,
        timeoutType: 'request',
      };

      const error = new TimeoutError('Request timeout', context);

      expect(error).toBeInstanceOf(TimeoutError);
      expect(error).toBeInstanceOf(Error);
      expect(error.type).toBe(ErrorType.TIMEOUT_ERROR);
      expect(error.status).toBe(0); // Client-side errors have 0 status
      expect(error.title).toBe('Request timeout');
      expect(error.name).toBe('TimeoutError');
    });

    test('uses correlation ID from context', () => {
      const context: TimeoutErrorContext = {
        url: 'https://api.example.com/data',
        method: 'POST',
        correlationId: 'client_timeout_xyz_789',
        timeoutMs: 10000,
        elapsedMs: 10050,
        timeoutType: 'connection',
      };

      const error = new TimeoutError('Connection timeout', context);

      expect(error.correlationId).toBe('client_timeout_xyz_789');
    });

    test('accepts custom correlation ID override', () => {
      const context: TimeoutErrorContext = {
        url: 'https://api.example.com/upload',
        method: 'PUT',
        correlationId: 'client_default_timeout',
        timeoutMs: 30000,
        elapsedMs: 30100,
        timeoutType: 'response',
      };

      const customCorrelationId = 'custom_timeout_override_123';
      const error = new TimeoutError('Upload timeout', context, customCorrelationId);

      expect(error.correlationId).toBe(customCorrelationId);
    });

    test('preserves timeout context details', () => {
      const context: TimeoutErrorContext = {
        url: 'https://api.example.com/heavy-computation',
        method: 'POST',
        correlationId: 'client_heavy_task_456',
        timeoutMs: 15000,
        elapsedMs: 15200,
        timeoutType: 'idle',
      };

      const error = new TimeoutError('Idle timeout', context);

      expect(error.details).toEqual(context);
      expect(error.details?.url).toBe('https://api.example.com/heavy-computation');
      expect(error.details?.method).toBe('POST');
      expect(error.details?.timeoutMs).toBe(15000);
      expect(error.details?.elapsedMs).toBe(15200);
      expect(error.details?.timeoutType).toBe('idle');
    });

    test('sets timestamp to current date', () => {
      const context: TimeoutErrorContext = {
        url: 'https://api.example.com/test',
        method: 'GET',
        correlationId: 'client_timestamp_test',
        timeoutMs: 1000,
        elapsedMs: 1100,
        timeoutType: 'request',
      };

      const beforeCreation = new Date();
      const error = new TimeoutError('Test timeout error', context);
      const afterCreation = new Date();

      expect(error.timestamp.getTime()).toBeGreaterThanOrEqual(beforeCreation.getTime());
      expect(error.timestamp.getTime()).toBeLessThanOrEqual(afterCreation.getTime());
    });
  });

  describe('inheritance and error properties', () => {
    test('inherits from BlaizeError correctly', () => {
      const context: TimeoutErrorContext = {
        url: 'https://api.example.com/test',
        method: 'GET',
        correlationId: 'client_inheritance_test',
        timeoutMs: 5000,
        elapsedMs: 5100,
        timeoutType: 'request',
      };

      const error = new TimeoutError('Timeout error', context);

      expect(error.type).toBeDefined();
      expect(error.title).toBeDefined();
      expect(error.status).toBeDefined();
      expect(error.correlationId).toBeDefined();
      expect(error.timestamp).toBeDefined();
      expect(error.details).toBeDefined();
    });

    test('extends Error correctly', () => {
      const context: TimeoutErrorContext = {
        url: 'https://api.example.com/test',
        method: 'GET',
        correlationId: 'client_error_test',
        timeoutMs: 5000,
        elapsedMs: 5100,
        timeoutType: 'request',
      };

      const error = new TimeoutError('Timeout error', context);

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Timeout error');
      expect(error.stack).toBeDefined();
    });

    test('preserves error stack trace', () => {
      const context: TimeoutErrorContext = {
        url: 'https://api.example.com/test',
        method: 'GET',
        correlationId: 'client_stack_test',
        timeoutMs: 5000,
        elapsedMs: 5100,
        timeoutType: 'request',
      };

      const error = new TimeoutError('Timeout error', context);

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('TimeoutError');
      expect(error.stack).toContain('Timeout error');
    });
  });

  describe('toJSON serialization', () => {
    test('serializes to proper error response format', () => {
      const context: TimeoutErrorContext = {
        url: 'https://api.example.com/slow',
        method: 'GET',
        correlationId: 'client_serialize_test',
        timeoutMs: 8000,
        elapsedMs: 8150,
        timeoutType: 'request',
      };

      const error = new TimeoutError('Request timeout', context);
      const serialized = error.toJSON();

      expect(serialized).toEqual({
        type: ErrorType.TIMEOUT_ERROR,
        title: 'Request timeout',
        status: 0,
        correlationId: 'client_serialize_test',
        timestamp: error.timestamp.toISOString(),
        details: context,
      });
    });

    test('includes all timeout context in serialization', () => {
      const context: TimeoutErrorContext = {
        url: 'https://api.example.com/long-process',
        method: 'POST',
        correlationId: 'client_full_context',
        timeoutMs: 20000,
        elapsedMs: 20300,
        timeoutType: 'response',
      };

      const error = new TimeoutError('Response timeout', context);
      const serialized = error.toJSON();
      const serializedError = serialized as typeof serialized & { details: TimeoutErrorContext };

      expect(serializedError.details).toEqual(context);
      expect(serializedError.details?.timeoutMs).toBe(20000);
      expect(serializedError.details?.elapsedMs).toBe(20300);
      expect(serializedError.details?.timeoutType).toBe('response');
    });
  });

  describe('toString method', () => {
    test('returns formatted string representation', () => {
      const context: TimeoutErrorContext = {
        url: 'https://api.example.com/test',
        method: 'GET',
        correlationId: 'client_tostring_test',
        timeoutMs: 5000,
        elapsedMs: 5100,
        timeoutType: 'request',
      };

      const error = new TimeoutError('Timeout occurred', context);
      const stringRep = error.toString();

      expect(stringRep).toBe('TimeoutError: Timeout occurred [client_tostring_test]');
    });

    test('includes correlation ID in string representation', () => {
      const context: TimeoutErrorContext = {
        url: 'https://api.example.com/test',
        method: 'GET',
        correlationId: 'custom_timeout_correlation_xyz',
        timeoutMs: 5000,
        elapsedMs: 5100,
        timeoutType: 'request',
      };

      const error = new TimeoutError('Timeout error', context);
      const stringRep = error.toString();

      expect(stringRep).toContain('custom_timeout_correlation_xyz');
      expect(stringRep).toBe('TimeoutError: Timeout error [custom_timeout_correlation_xyz]');
    });
  });

  describe('timeout scenarios', () => {
    test('request timeout scenario', () => {
      const context: TimeoutErrorContext = {
        url: 'https://slow-api.example.com/data',
        method: 'GET',
        correlationId: 'client_request_timeout',
        timeoutMs: 5000,
        elapsedMs: 5050,
        timeoutType: 'request',
      };

      const error = new TimeoutError('Request took too long', context);

      expect(error.details?.url).toBe('https://slow-api.example.com/data');
      expect(error.details?.timeoutMs).toBe(5000);
      expect(error.details?.elapsedMs).toBe(5050);
      expect(error.details?.timeoutType).toBe('request');
      expect(error.type).toBe(ErrorType.TIMEOUT_ERROR);
    });

    test('connection timeout scenario', () => {
      const context: TimeoutErrorContext = {
        url: 'https://unresponsive-server.example.com/api',
        method: 'POST',
        correlationId: 'client_connection_timeout',
        timeoutMs: 10000,
        elapsedMs: 10100,
        timeoutType: 'connection',
      };

      const error = new TimeoutError('Failed to establish connection', context);

      expect(error.details?.url).toBe('https://unresponsive-server.example.com/api');
      expect(error.details?.method).toBe('POST');
      expect(error.details?.timeoutType).toBe('connection');
      expect(error.details?.elapsedMs).toBeGreaterThan(error.details!.timeoutMs!);
    });

    test('response timeout scenario', () => {
      const context: TimeoutErrorContext = {
        url: 'https://api.example.com/generate-report',
        method: 'POST',
        correlationId: 'client_response_timeout',
        timeoutMs: 30000,
        elapsedMs: 30200,
        timeoutType: 'response',
      };

      const error = new TimeoutError('Server response timeout', context);

      expect(error.details?.url).toBe('https://api.example.com/generate-report');
      expect(error.details?.timeoutType).toBe('response');
      expect(error.details?.timeoutMs).toBe(30000);
      expect(error.details?.elapsedMs).toBe(30200);
    });

    test('idle timeout scenario', () => {
      const context: TimeoutErrorContext = {
        url: 'https://api.example.com/streaming',
        method: 'GET',
        correlationId: 'client_idle_timeout',
        timeoutMs: 60000,
        elapsedMs: 65000,
        timeoutType: 'idle',
      };

      const error = new TimeoutError('Connection idle timeout', context);

      expect(error.details?.timeoutType).toBe('idle');
      expect(error.details?.elapsedMs).toBeGreaterThan(60000);
      expect(error.type).toBe(ErrorType.TIMEOUT_ERROR);
    });
  });

  describe('timing calculations', () => {
    test('calculates timeout exceeded correctly', () => {
      const context: TimeoutErrorContext = {
        url: 'https://api.example.com/test',
        method: 'GET',
        correlationId: 'client_timing_test',
        timeoutMs: 5000,
        elapsedMs: 7500,
        timeoutType: 'request',
      };

      const error = new TimeoutError('Request timeout', context);

      expect(error.details?.elapsedMs).toBeGreaterThan(error.details!.timeoutMs!);

      // Calculate how much the timeout was exceeded by
      const exceededBy = error.details!.elapsedMs - error.details!.timeoutMs;
      expect(exceededBy).toBe(2500);
    });

    test('handles edge case where elapsed equals timeout', () => {
      const context: TimeoutErrorContext = {
        url: 'https://api.example.com/edge-case',
        method: 'POST',
        correlationId: 'client_edge_case',
        timeoutMs: 5000,
        elapsedMs: 5000,
        timeoutType: 'request',
      };

      const error = new TimeoutError('Exact timeout', context);

      expect(error.details?.elapsedMs).toBe(error.details?.timeoutMs);
    });
  });

  describe('integration with error handling', () => {
    test('can be thrown and caught properly', () => {
      const context: TimeoutErrorContext = {
        url: 'https://api.example.com/test',
        method: 'GET',
        correlationId: 'client_throw_test',
        timeoutMs: 5000,
        elapsedMs: 5100,
        timeoutType: 'request',
      };

      expect(() => {
        throw new TimeoutError('Test timeout error', context);
      }).toThrow(TimeoutError);

      expect(() => {
        throw new TimeoutError('Test timeout error', context);
      }).toThrow('Test timeout error');
    });

    test('maintains context when thrown across async boundaries', async () => {
      const context: TimeoutErrorContext = {
        url: 'https://api.example.com/async-test',
        method: 'GET',
        correlationId: 'client_async_timeout',
        timeoutMs: 5000,
        elapsedMs: 5100,
        timeoutType: 'request',
      };

      const error = new TimeoutError('Async timeout error', context);

      await expect(async () => {
        await new Promise(resolve => setTimeout(resolve, 1));
        throw error;
      }).rejects.toThrow(TimeoutError);

      expect(error.correlationId).toBe('client_async_timeout');
      expect(error.details?.url).toBe('https://api.example.com/async-test');
      expect(error.details?.timeoutMs).toBe(5000);
    });
  });
});
