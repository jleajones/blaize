/**
 * Tests for NetworkError class
 */

import { NetworkError } from './network-error';
import { ErrorType } from '../../../blaize-types/src/index';

import type { NetworkErrorContext } from '../../../blaize-types/src/index';

describe('NetworkError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    test('creates NetworkError with correct type and status', () => {
      const context: NetworkErrorContext = {
        url: 'https://api.example.com/users',
        method: 'GET',
        correlationId: 'client_123',
        originalError: new Error('Connection failed'),
      };

      const error = new NetworkError('Network request failed', context);

      expect(error).toBeInstanceOf(NetworkError);
      expect(error).toBeInstanceOf(Error);
      expect(error.type).toBe(ErrorType.NETWORK_ERROR);
      expect(error.status).toBe(0); // Client-side errors have 0 status
      expect(error.title).toBe('Network request failed');
      expect(error.name).toBe('NetworkError');
    });

    test('uses correlation ID from context', () => {
      const context: NetworkErrorContext = {
        url: 'https://api.example.com/users',
        method: 'POST',
        correlationId: 'client_xyz_789',
        originalError: new Error('Connection timeout'),
      };

      const error = new NetworkError('Request timeout', context);

      expect(error.correlationId).toBe('client_xyz_789');
    });

    test('accepts custom correlation ID override', () => {
      const context: NetworkErrorContext = {
        url: 'https://api.example.com/users',
        method: 'PUT',
        correlationId: 'client_default',
        originalError: new Error('DNS resolution failed'),
      };

      const customCorrelationId = 'custom_override_123';
      const error = new NetworkError('DNS failure', context, customCorrelationId);

      expect(error.correlationId).toBe(customCorrelationId);
    });

    test('preserves network context details', () => {
      const originalError = new Error('ECONNREFUSED');
      const context: NetworkErrorContext = {
        url: 'https://api.example.com/posts/123',
        method: 'DELETE',
        correlationId: 'client_delete_456',
        timeout: 5000,
        originalError,
        networkDetails: {
          isTimeout: false,
          isDnsFailure: false,
          isConnectionRefused: true,
          statusCode: undefined,
        },
      };

      const error = new NetworkError('Connection refused', context);

      expect(error.details).toEqual(context);
      expect(error.details?.url).toBe('https://api.example.com/posts/123');
      expect(error.details?.method).toBe('DELETE');
      expect(error.details?.timeout).toBe(5000);
      expect(error.details?.originalError).toBe(originalError);
      expect(error.details?.networkDetails?.isConnectionRefused).toBe(true);
    });

    test('sets timestamp to current date', () => {
      const context: NetworkErrorContext = {
        url: 'https://api.example.com/test',
        method: 'GET',
        correlationId: 'client_timestamp_test',
        originalError: new Error('Test error'),
      };

      const beforeCreation = new Date();
      const error = new NetworkError('Test network error', context);
      const afterCreation = new Date();

      expect(error.timestamp.getTime()).toBeGreaterThanOrEqual(beforeCreation.getTime());
      expect(error.timestamp.getTime()).toBeLessThanOrEqual(afterCreation.getTime());
    });
  });

  describe('inheritance and error properties', () => {
    test('inherits from BlaizeError correctly', () => {
      const context: NetworkErrorContext = {
        url: 'https://api.example.com/test',
        method: 'GET',
        correlationId: 'client_inheritance_test',
        originalError: new Error('Test error'),
      };

      const error = new NetworkError('Network error', context);

      expect(error.type).toBeDefined();
      expect(error.title).toBeDefined();
      expect(error.status).toBeDefined();
      expect(error.correlationId).toBeDefined();
      expect(error.timestamp).toBeDefined();
      expect(error.details).toBeDefined();
    });

    test('extends Error correctly', () => {
      const context: NetworkErrorContext = {
        url: 'https://api.example.com/test',
        method: 'GET',
        correlationId: 'client_error_test',
        originalError: new Error('Test error'),
      };

      const error = new NetworkError('Network error', context);

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Network error');
      expect(error.stack).toBeDefined();
    });

    test('preserves error stack trace', () => {
      const context: NetworkErrorContext = {
        url: 'https://api.example.com/test',
        method: 'GET',
        correlationId: 'client_stack_test',
        originalError: new Error('Test error'),
      };

      const error = new NetworkError('Network error', context);

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('NetworkError');
      expect(error.stack).toContain('Network error');
    });
  });

  describe('toJSON serialization', () => {
    test('serializes to proper error response format', () => {
      const originalError = new Error('Connection failed');
      const context: NetworkErrorContext = {
        url: 'https://api.example.com/users',
        method: 'GET',
        correlationId: 'client_serialize_test',
        originalError,
      };

      const error = new NetworkError('Network request failed', context);
      const serialized = error.toJSON();

      expect(serialized).toEqual({
        type: ErrorType.NETWORK_ERROR,
        title: 'Network request failed',
        status: 0,
        correlationId: 'client_serialize_test',
        timestamp: error.timestamp.toISOString(),
        details: context,
      });
    });

    test('includes all network context in serialization', () => {
      const originalError = new Error('Timeout');
      const context: NetworkErrorContext = {
        url: 'https://api.example.com/slow-endpoint',
        method: 'POST',
        correlationId: 'client_full_context',
        timeout: 10000,
        originalError,
        networkDetails: {
          isTimeout: true,
          isDnsFailure: false,
          isConnectionRefused: false,
        },
      };

      const error = new NetworkError('Request timeout', context);
      const serialized = error.toJSON();
      const serializedError = serialized as typeof serialized & { details: NetworkErrorContext };

      expect(serializedError).toHaveProperty('details');
      expect(serializedError.details).toEqual(context);
      expect(serializedError.details?.timeout).toBe(10000);
      expect(serializedError.details?.networkDetails?.isTimeout).toBe(true);
    });
  });

  describe('toString method', () => {
    test('returns formatted string representation', () => {
      const context: NetworkErrorContext = {
        url: 'https://api.example.com/test',
        method: 'GET',
        correlationId: 'client_tostring_test',
        originalError: new Error('Test error'),
      };

      const error = new NetworkError('Network failed', context);
      const stringRep = error.toString();

      expect(stringRep).toBe('NetworkError: Network failed [client_tostring_test]');
    });

    test('includes correlation ID in string representation', () => {
      const context: NetworkErrorContext = {
        url: 'https://api.example.com/test',
        method: 'GET',
        correlationId: 'custom_correlation_xyz',
        originalError: new Error('Test error'),
      };

      const error = new NetworkError('Network error', context);
      const stringRep = error.toString();

      expect(stringRep).toContain('custom_correlation_xyz');
      expect(stringRep).toBe('NetworkError: Network error [custom_correlation_xyz]');
    });
  });

  describe('network context scenarios', () => {
    test('connection timeout scenario', () => {
      const originalError = new Error('ETIMEDOUT');
      const context: NetworkErrorContext = {
        url: 'https://slow-api.example.com/data',
        method: 'GET',
        correlationId: 'client_timeout_scenario',
        timeout: 5000,
        originalError,
        networkDetails: {
          isTimeout: true,
          isDnsFailure: false,
          isConnectionRefused: false,
        },
      };

      const error = new NetworkError('Connection timeout', context);

      expect(error.details?.url).toBe('https://slow-api.example.com/data');
      expect(error.details?.timeout).toBe(5000);
      expect(error.details?.networkDetails?.isTimeout).toBe(true);
      expect(error.details?.originalError.message).toBe('ETIMEDOUT');
    });

    test('DNS resolution failure scenario', () => {
      const originalError = new Error('ENOTFOUND');
      const context: NetworkErrorContext = {
        url: 'https://nonexistent-domain.example.com/api',
        method: 'POST',
        correlationId: 'client_dns_scenario',
        originalError,
        networkDetails: {
          isTimeout: false,
          isDnsFailure: true,
          isConnectionRefused: false,
        },
      };

      const error = new NetworkError('DNS resolution failed', context);

      expect(error.details?.url).toBe('https://nonexistent-domain.example.com/api');
      expect(error.details?.networkDetails?.isDnsFailure).toBe(true);
      expect(error.details?.originalError.message).toBe('ENOTFOUND');
    });

    test('connection refused scenario', () => {
      const originalError = new Error('ECONNREFUSED');
      const context: NetworkErrorContext = {
        url: 'https://localhost:9999/unavailable',
        method: 'PUT',
        correlationId: 'client_refused_scenario',
        originalError,
        networkDetails: {
          isTimeout: false,
          isDnsFailure: false,
          isConnectionRefused: true,
        },
      };

      const error = new NetworkError('Connection refused', context);

      expect(error.details?.url).toBe('https://localhost:9999/unavailable');
      expect(error.details?.method).toBe('PUT');
      expect(error.details?.networkDetails?.isConnectionRefused).toBe(true);
      expect(error.details?.originalError.message).toBe('ECONNREFUSED');
    });

    test('fetch API failure scenario', () => {
      const originalError = new TypeError('Failed to fetch');
      const context: NetworkErrorContext = {
        url: 'https://api.example.com/users',
        method: 'GET',
        correlationId: 'client_fetch_failure',
        originalError,
      };

      const error = new NetworkError('Fetch request failed', context);

      expect(error.details?.originalError).toBeInstanceOf(TypeError);
      expect(error.details?.originalError.message).toBe('Failed to fetch');
      expect(error.type).toBe(ErrorType.NETWORK_ERROR);
      expect(error.status).toBe(0);
    });
  });

  describe('integration with error handling', () => {
    test('can be thrown and caught properly', () => {
      const context: NetworkErrorContext = {
        url: 'https://api.example.com/test',
        method: 'GET',
        correlationId: 'client_throw_test',
        originalError: new Error('Test error'),
      };

      expect(() => {
        throw new NetworkError('Test network error', context);
      }).toThrow(NetworkError);

      expect(() => {
        throw new NetworkError('Test network error', context);
      }).toThrow('Test network error');
    });

    test('maintains context when thrown across async boundaries', async () => {
      const context: NetworkErrorContext = {
        url: 'https://api.example.com/async-test',
        method: 'GET',
        correlationId: 'client_async_test',
        originalError: new Error('Async test error'),
      };

      const error = new NetworkError('Async network error', context);

      await expect(async () => {
        await new Promise(resolve => setTimeout(resolve, 1));
        throw error;
      }).rejects.toThrow(NetworkError);

      expect(error.correlationId).toBe('client_async_test');
      expect(error.details?.url).toBe('https://api.example.com/async-test');
    });
  });
});
