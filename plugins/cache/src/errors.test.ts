/**
 * Unit Tests for Cache Plugin Error Classes
 *
 * Tests verify error properties, inheritance, and typed details.
 */

import { ErrorType } from 'blaizejs';

import { CacheConnectionError, CacheOperationError, CacheValidationError } from './errors';

import type {
  CacheConnectionErrorDetails,
  CacheOperationErrorDetails,
  CacheValidationErrorDetails,
} from './types';

// ============================================================================
// Mock getCorrelationId
// ============================================================================

vi.mock('blaizejs', async () => {
  const actual = await vi.importActual('blaizejs');
  return {
    ...actual,
    getCorrelationId: vi.fn().mockReturnValue('test-correlation-id-12345'),
  };
});

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Helper to verify common error properties
 */
function expectCommonErrorProperties(
  error: Error,
  expectedName: string,
  expectedStatus: number,
  expectedType: ErrorType
) {
  expect(error).toBeInstanceOf(Error);
  expect(error.name).toBe(expectedName);
  expect((error as any).status).toBe(expectedStatus);
  expect((error as any).type).toBe(expectedType);
  expect((error as any).correlationId).toBe('test-correlation-id-12345');
}

// ============================================================================
// CacheConnectionError Tests
// ============================================================================

describe('CacheConnectionError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('creates error with message only', () => {
    const error = new CacheConnectionError('Connection failed');

    expectCommonErrorProperties(
      error,
      'CacheConnectionError',
      503,
      ErrorType.INTERNAL_SERVER_ERROR
    );
    expect(error.title).toBe('Connection failed');
    expect(error.details).toBeUndefined();
  });

  test('creates error with details', () => {
    const details: CacheConnectionErrorDetails = {
      adapter: 'RedisAdapter',
      host: 'localhost',
      port: 6379,
      reason: 'Connection timeout',
    };

    const error = new CacheConnectionError('Redis connection failed', details);

    expect(error.details).toEqual(details);
    expect(error.details?.adapter).toBe('RedisAdapter');
    expect(error.details?.host).toBe('localhost');
    expect(error.details?.port).toBe(6379);
    expect(error.details?.reason).toBe('Connection timeout');
  });

  test('includes base error fields in details', () => {
    const details: CacheConnectionErrorDetails = {
      operation: 'connect',
      key: undefined,
      adapter: 'RedisAdapter',
      host: '127.0.0.1',
      port: 6379,
    };

    const error = new CacheConnectionError('Failed to connect', details);

    expect(error.details?.operation).toBe('connect');
    expect(error.details?.adapter).toBe('RedisAdapter');
  });

  test('includes original error message', () => {
    const details: CacheConnectionErrorDetails = {
      adapter: 'RedisAdapter',
      originalError: 'ECONNREFUSED',
    };

    const error = new CacheConnectionError('Connection refused', details);

    expect(error.details?.originalError).toBe('ECONNREFUSED');
  });

  test('accepts custom correlation ID', () => {
    const customCorrelationId = 'custom-corr-id-456';
    const error = new CacheConnectionError('Connection failed', undefined, customCorrelationId);

    expect((error as any).correlationId).toBe(customCorrelationId);
  });

  test('has correct HTTP status code (503)', () => {
    const error = new CacheConnectionError('Service unavailable');
    expect((error as any).status).toBe(503);
  });

  test('has correct error type', () => {
    const error = new CacheConnectionError('Connection failed');
    expect((error as any).type).toBe(ErrorType.INTERNAL_SERVER_ERROR);
  });

  test('is catchable as Error', () => {
    try {
      throw new CacheConnectionError('Test error');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect(error instanceof CacheConnectionError).toBe(true);
    }
  });

  test('message is accessible via title property', () => {
    const message = 'Redis connection timeout after 5 seconds';
    const error = new CacheConnectionError(message);
    expect(error.title).toBe(message);
  });
});

// ============================================================================
// CacheOperationError Tests
// ============================================================================

describe('CacheOperationError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('creates error with message only', () => {
    const error = new CacheOperationError('Operation failed');

    expectCommonErrorProperties(error, 'CacheOperationError', 500, ErrorType.INTERNAL_SERVER_ERROR);
    expect(error.title).toBe('Operation failed');
    expect(error.details).toBeUndefined();
  });

  test('creates error with basic operation details', () => {
    const details: CacheOperationErrorDetails = {
      operation: 'set',
      method: 'set',
      key: 'user:123',
      adapter: 'RedisAdapter',
    };

    const error = new CacheOperationError('Set operation failed', details);

    expect(error.details).toEqual(details);
    expect(error.details?.method).toBe('set');
    expect(error.details?.key).toBe('user:123');
  });

  test('includes TTL in details', () => {
    const details: CacheOperationErrorDetails = {
      method: 'set',
      key: 'session:abc',
      ttl: 3600,
    };

    const error = new CacheOperationError('Failed to set with TTL', details);

    expect(error.details?.ttl).toBe(3600);
  });

  test('includes value in details (truncated)', () => {
    const details: CacheOperationErrorDetails = {
      method: 'set',
      key: 'data:large',
      value: { data: 'large payload' },
    };

    const error = new CacheOperationError('Value too large', details);

    expect(error.details?.value).toEqual({ data: 'large payload' });
  });

  test('includes original error', () => {
    const details: CacheOperationErrorDetails = {
      method: 'get',
      key: 'test:key',
      originalError: 'WRONGTYPE Operation against a key holding the wrong kind of value',
    };

    const error = new CacheOperationError('Redis operation failed', details);

    expect(error.details?.originalError).toContain('WRONGTYPE');
  });

  test('supports all cache methods', () => {
    const methods: Array<CacheOperationErrorDetails['method']> = [
      'get',
      'set',
      'delete',
      'mget',
      'mset',
    ];

    methods.forEach(method => {
      const error = new CacheOperationError('Operation failed', { method });
      expect(error.details?.method).toBe(method);
    });
  });

  test('accepts custom correlation ID', () => {
    const customCorrelationId = 'operation-corr-789';
    const error = new CacheOperationError('Failed', undefined, customCorrelationId);

    expect((error as any).correlationId).toBe(customCorrelationId);
  });

  test('has correct HTTP status code (500)', () => {
    const error = new CacheOperationError('Internal error');
    expect((error as any).status).toBe(500);
  });

  test('has correct error type', () => {
    const error = new CacheOperationError('Operation failed');
    expect((error as any).type).toBe(ErrorType.INTERNAL_SERVER_ERROR);
  });

  test('is catchable as Error', () => {
    try {
      throw new CacheOperationError('Test error', {
        method: 'get',
        key: 'test',
      });
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect(error instanceof CacheOperationError).toBe(true);
    }
  });
});

// ============================================================================
// CacheValidationError Tests
// ============================================================================

describe('CacheValidationError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('creates error with message only', () => {
    const error = new CacheValidationError('Validation failed');

    expectCommonErrorProperties(error, 'CacheValidationError', 400, ErrorType.VALIDATION_ERROR);
    expect(error.title).toBe('Validation failed');
    expect(error.details).toBeUndefined();
  });

  test('creates error with field validation details', () => {
    const details: CacheValidationErrorDetails = {
      field: 'ttl',
      expectedType: 'positive number',
      receivedType: 'string',
      constraint: 'ttl >= 0',
      value: '-100',
    };

    const error = new CacheValidationError('Invalid TTL value', details);

    expect(error.details).toEqual(details);
    expect(error.details?.field).toBe('ttl');
    expect(error.details?.expectedType).toBe('positive number');
    expect(error.details?.receivedType).toBe('string');
  });

  test('includes constraint information', () => {
    const details: CacheValidationErrorDetails = {
      field: 'key',
      constraint: 'key.length > 0',
      value: '',
    };

    const error = new CacheValidationError('Key cannot be empty', details);

    expect(error.details?.constraint).toBe('key.length > 0');
    expect(error.details?.value).toBe('');
  });

  test('includes operation context', () => {
    const details: CacheValidationErrorDetails = {
      operation: 'set',
      field: 'value',
      expectedType: 'string',
      receivedType: 'number',
    };

    const error = new CacheValidationError('Value must be string', details);

    expect(error.details?.operation).toBe('set');
  });

  test('handles missing value gracefully', () => {
    const details: CacheValidationErrorDetails = {
      field: 'key',
      expectedType: 'string',
      receivedType: 'undefined',
    };

    const error = new CacheValidationError('Key is required', details);

    expect(error.details?.field).toBe('key');
  });

  test('accepts custom correlation ID', () => {
    const customCorrelationId = 'validation-corr-999';
    const error = new CacheValidationError('Invalid input', undefined, customCorrelationId);

    expect((error as any).correlationId).toBe(customCorrelationId);
  });

  test('has correct HTTP status code (400)', () => {
    const error = new CacheValidationError('Bad request');
    expect((error as any).status).toBe(400);
  });

  test('has correct error type', () => {
    const error = new CacheValidationError('Validation failed');
    expect((error as any).type).toBe(ErrorType.VALIDATION_ERROR);
  });

  test('is catchable as Error', () => {
    try {
      throw new CacheValidationError('Test validation error', {
        field: 'test',
        expectedType: 'string',
      });
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect(error instanceof CacheValidationError).toBe(true);
    }
  });

  test('message is accessible via title property', () => {
    const message = 'Cache key must not be empty';
    const error = new CacheValidationError(message);
    expect(error.title).toBe(message);
  });
});

// ============================================================================
// Error Hierarchy Tests
// ============================================================================

describe('Error Hierarchy', () => {
  test('all errors are instanceof Error', () => {
    expect(new CacheConnectionError('test')).toBeInstanceOf(Error);
    expect(new CacheOperationError('test')).toBeInstanceOf(Error);
    expect(new CacheValidationError('test')).toBeInstanceOf(Error);
  });

  test('errors can be differentiated by name', () => {
    const errors = [
      new CacheConnectionError('test'),
      new CacheOperationError('test'),
      new CacheValidationError('test'),
    ];

    const names = errors.map(e => e.name);
    expect(names).toEqual(['CacheConnectionError', 'CacheOperationError', 'CacheValidationError']);
  });

  test('errors can be differentiated by status code', () => {
    const errors = [
      new CacheConnectionError('test'),
      new CacheOperationError('test'),
      new CacheValidationError('test'),
    ];

    const statuses = errors.map(e => (e as any).status);
    expect(statuses).toEqual([503, 500, 400]);
  });

  test('errors can be caught by specific type', () => {
    const testError = () => {
      throw new CacheValidationError('Invalid input');
    };

    try {
      testError();
    } catch (error) {
      if (error instanceof CacheValidationError) {
        expect(error.name).toBe('CacheValidationError');
        return;
      }
      throw new Error('Should have caught CacheValidationError');
    }
  });
});

// ============================================================================
// Correlation ID Tests
// ============================================================================

describe('Correlation ID', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('auto-generates correlation ID when not provided', () => {
    const error = new CacheConnectionError('Test');
    expect((error as any).correlationId).toBe('test-correlation-id-12345');
  });

  test('uses provided correlation ID', () => {
    const customId = 'my-custom-correlation-id';
    const error = new CacheOperationError('Test', undefined, customId);
    expect((error as any).correlationId).toBe(customId);
  });

  test('correlation ID is consistent across error types', () => {
    const errors = [
      new CacheConnectionError('test'),
      new CacheOperationError('test'),
      new CacheValidationError('test'),
    ];

    errors.forEach(error => {
      expect((error as any).correlationId).toBe('test-correlation-id-12345');
    });
  });
});

// ============================================================================
// Details Type Safety Tests
// ============================================================================

describe('Details Type Safety', () => {
  test('CacheConnectionErrorDetails has correct types', () => {
    const details: CacheConnectionErrorDetails = {
      adapter: 'RedisAdapter',
      host: 'localhost',
      port: 6379,
      reason: 'timeout',
      originalError: 'ECONNREFUSED',
      operation: 'connect',
      key: undefined,
    };

    const error = new CacheConnectionError('Test', details);
    expect(error.details).toEqual(details);
  });

  test('CacheOperationErrorDetails has correct types', () => {
    const details: CacheOperationErrorDetails = {
      method: 'set',
      operation: 'set',
      key: 'test:key',
      adapter: 'MemoryAdapter',
      ttl: 3600,
      value: { some: 'data' },
      originalError: 'Error message',
    };

    const error = new CacheOperationError('Test', details);
    expect(error.details).toEqual(details);
  });

  test('CacheValidationErrorDetails has correct types', () => {
    const details: CacheValidationErrorDetails = {
      field: 'ttl',
      expectedType: 'number',
      receivedType: 'string',
      constraint: 'ttl >= 0',
      value: 'invalid',
      operation: 'set',
      key: 'test',
      adapter: 'MemoryAdapter',
    };

    const error = new CacheValidationError('Test', details);
    expect(error.details).toEqual(details);
  });
});
