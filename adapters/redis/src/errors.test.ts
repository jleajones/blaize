/**
 * Unit tests for Redis error types
 *
 * @module @blaizejs/adapter-redis/errors
 */

import { ErrorType } from 'blaizejs';

import { RedisConnectionError, RedisOperationError, CircuitBreakerOpenError } from './errors';

import type {
  CircuitBreakerErrorDetails,
  RedisConnectionErrorDetails,
  RedisOperationErrorDetails,
} from './types';

describe('Redis Error Types', () => {
  describe('RedisConnectionError', () => {
    it('should create error with all details', () => {
      const details: RedisConnectionErrorDetails = {
        host: 'localhost',
        port: 6379,
        reason: 'CONNECTION_REFUSED',
        originalError: 'ECONNREFUSED',
      };

      const error = new RedisConnectionError('Failed to connect to Redis', details);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(RedisConnectionError);
      expect(error.name).toBe('RedisConnectionError');
      expect(error.message).toBe('Failed to connect to Redis');
      expect(error.title).toBe('Failed to connect to Redis');
      expect(error.type).toBe(ErrorType.INTERNAL_SERVER_ERROR);
      expect(error.status).toBe(500);
      expect(error.details).toEqual(details);
      expect(error.correlationId).toBeDefined();
      expect(error.timestamp).toBeInstanceOf(Date);
    });

    it('should create error with custom correlation ID', () => {
      const details: RedisConnectionErrorDetails = {
        host: 'redis.example.com',
        port: 6380,
        reason: 'TIMEOUT',
      };

      const correlationId = 'test-correlation-id';
      const error = new RedisConnectionError('Connection timeout', details, correlationId);

      expect(error.correlationId).toBe(correlationId);
    });

    it('should handle missing optional originalError field', () => {
      const details: RedisConnectionErrorDetails = {
        host: 'localhost',
        port: 6379,
        reason: 'AUTH_FAILED',
      };

      const error = new RedisConnectionError('Authentication failed', details);

      expect(error.details?.originalError).toBeUndefined();
    });

    it('should truncate very long original error messages', () => {
      const longError = 'A'.repeat(1500); // 1500 characters
      const details: RedisConnectionErrorDetails = {
        host: 'localhost',
        port: 6379,
        reason: 'UNKNOWN',
        originalError: longError,
      };

      const error = new RedisConnectionError('Unknown error', details);

      expect(error.details?.originalError).toBeDefined();
      expect(error.details?.originalError?.length).toBeLessThan(1100); // 1000 + truncation message
      expect(error.details?.originalError).toContain('(truncated)');
    });

    it('should not truncate short error messages', () => {
      const shortError = 'Short error message';
      const details: RedisConnectionErrorDetails = {
        host: 'localhost',
        port: 6379,
        reason: 'CONNECTION_REFUSED',
        originalError: shortError,
      };

      const error = new RedisConnectionError('Connection refused', details);

      expect(error.details?.originalError).toBe(shortError);
      expect(error.details?.originalError).not.toContain('(truncated)');
    });

    it('should support all reason types', () => {
      const reasons: Array<RedisConnectionErrorDetails['reason']> = [
        'CONNECTION_REFUSED',
        'TIMEOUT',
        'AUTH_FAILED',
        'UNKNOWN',
      ];

      reasons.forEach(reason => {
        const details: RedisConnectionErrorDetails = {
          host: 'localhost',
          port: 6379,
          reason,
        };

        const error = new RedisConnectionError(`Test ${reason}`, details);

        expect(error.details?.reason).toBe(reason);
      });
    });

    it('should serialize to JSON correctly', () => {
      const details: RedisConnectionErrorDetails = {
        host: 'localhost',
        port: 6379,
        reason: 'CONNECTION_REFUSED',
        originalError: 'Test error',
      };

      const error = new RedisConnectionError('Test error', details);
      const json = error.toJSON();

      expect(json).toHaveProperty('type', ErrorType.INTERNAL_SERVER_ERROR);
      expect(json).toHaveProperty('title', 'Test error');
      expect(json).toHaveProperty('status', 500);
      expect(json).toHaveProperty('details', details);
      expect(json).toHaveProperty('correlationId');
      expect(json).toHaveProperty('timestamp');
    });

    it('should have useful toString output', () => {
      const details: RedisConnectionErrorDetails = {
        host: 'localhost',
        port: 6379,
        reason: 'CONNECTION_REFUSED',
      };

      const error = new RedisConnectionError('Test error', details);
      const string = error.toString();

      expect(string).toContain('RedisConnectionError');
      expect(string).toContain('Test error');
      expect(string).toContain(error.correlationId);
    });
  });

  describe('RedisOperationError', () => {
    it('should create error with all details', () => {
      const details: RedisOperationErrorDetails = {
        operation: 'GET',
        key: 'user:123',
        originalError: 'Command failed',
      };

      const error = new RedisOperationError('GET operation failed', details);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(RedisOperationError);
      expect(error.name).toBe('RedisOperationError');
      expect(error.message).toBe('GET operation failed');
      expect(error.type).toBe(ErrorType.INTERNAL_SERVER_ERROR);
      expect(error.status).toBe(500);
      expect(error.details).toEqual(details);
    });

    it('should create error with custom correlation ID', () => {
      const details: RedisOperationErrorDetails = {
        operation: 'SET',
        key: 'cache:data',
      };

      const correlationId = 'operation-123';
      const error = new RedisOperationError('SET failed', details, correlationId);

      expect(error.correlationId).toBe(correlationId);
    });

    it('should handle missing optional fields', () => {
      const details: RedisOperationErrorDetails = {
        operation: 'PUBLISH',
      };

      const error = new RedisOperationError('PUBLISH failed', details);

      expect(error.details?.key).toBeUndefined();
      expect(error.details?.originalError).toBeUndefined();
    });

    it('should truncate very long original error messages', () => {
      const longError = 'B'.repeat(2000);
      const details: RedisOperationErrorDetails = {
        operation: 'EVALSHA',
        key: 'script:1',
        originalError: longError,
      };

      const error = new RedisOperationError('Script execution failed', details);

      expect(error.details?.originalError).toBeDefined();
      expect(error.details?.originalError?.length).toBeLessThan(1100);
      expect(error.details?.originalError).toContain('(truncated)');
    });

    it('should support all operation types', () => {
      const operations: Array<RedisOperationErrorDetails['operation']> = [
        'GET',
        'SET',
        'DEL',
        'MGET',
        'MSET',
        'PUBLISH',
        'SUBSCRIBE',
        'LPUSH',
        'RPOP',
        'ZADD',
        'ZRANGE',
        'EVALSHA',
      ];

      operations.forEach(operation => {
        const details: RedisOperationErrorDetails = {
          operation,
          key: 'test:key',
        };

        const error = new RedisOperationError(`${operation} failed`, details);

        expect(error.details?.operation).toBe(operation);
      });
    });

    it('should serialize to JSON correctly', () => {
      const details: RedisOperationErrorDetails = {
        operation: 'MGET',
        originalError: 'Multiple get failed',
      };

      const error = new RedisOperationError('MGET failed', details);
      const json = error.toJSON();

      expect(json).toHaveProperty('type', ErrorType.INTERNAL_SERVER_ERROR);
      expect(json).toHaveProperty('status', 500);
      expect(json).toHaveProperty('details');
    });
  });

  describe('CircuitBreakerOpenError', () => {
    it('should create error with all details', () => {
      const lastFailure = new Date();
      const details: CircuitBreakerErrorDetails = {
        state: 'OPEN',
        failures: 5,
        lastFailure,
        resetTimeout: 30000,
      };

      const error = new CircuitBreakerOpenError('Circuit breaker is open', details);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(CircuitBreakerOpenError);
      expect(error.name).toBe('CircuitBreakerOpenError');
      expect(error.message).toBe('Circuit breaker is open');
      expect(error.type).toBe(ErrorType.SERVICE_UNAVAILABLE);
      expect(error.status).toBe(503);
      expect(error.details).toEqual(details);
    });

    it('should not accept correlation ID parameter', () => {
      const details: CircuitBreakerErrorDetails = {
        state: 'OPEN',
        failures: 3,
        resetTimeout: 15000,
      };

      // Constructor signature only accepts message and details
      const error = new CircuitBreakerOpenError('Circuit open', details);

      // Correlation ID is auto-generated
      expect(error.correlationId).toBeDefined();
    });

    it('should handle missing optional lastFailure field', () => {
      const details: CircuitBreakerErrorDetails = {
        state: 'HALF_OPEN',
        failures: 1,
        resetTimeout: 30000,
      };

      const error = new CircuitBreakerOpenError('Test call failed', details);

      expect(error.details?.lastFailure).toBeUndefined();
    });

    it('should support all circuit states', () => {
      const states: Array<CircuitBreakerErrorDetails['state']> = ['CLOSED', 'OPEN', 'HALF_OPEN'];

      states.forEach(state => {
        const details: CircuitBreakerErrorDetails = {
          state,
          failures: 2,
          resetTimeout: 20000,
        };

        const error = new CircuitBreakerOpenError(`Circuit ${state}`, details);

        expect(error.details?.state).toBe(state);
      });
    });

    it('should preserve Date objects in details', () => {
      const lastFailure = new Date('2024-01-15T10:30:00Z');
      const details: CircuitBreakerErrorDetails = {
        state: 'OPEN',
        failures: 5,
        lastFailure,
        resetTimeout: 30000,
      };

      const error = new CircuitBreakerOpenError('Circuit open', details);

      expect(error.details?.lastFailure).toBeInstanceOf(Date);
      expect(error.details?.lastFailure?.getTime()).toBe(lastFailure.getTime());
    });

    it('should serialize to JSON correctly', () => {
      const details: CircuitBreakerErrorDetails = {
        state: 'OPEN',
        failures: 10,
        lastFailure: new Date(),
        resetTimeout: 60000,
      };

      const error = new CircuitBreakerOpenError('Too many failures', details);
      const json = error.toJSON();

      expect(json).toHaveProperty('type', ErrorType.SERVICE_UNAVAILABLE);
      expect(json).toHaveProperty('status', 503);
      expect(json).toHaveProperty('details');
    });

    it('should have useful toString output', () => {
      const details: CircuitBreakerErrorDetails = {
        state: 'OPEN',
        failures: 5,
        resetTimeout: 30000,
      };

      const error = new CircuitBreakerOpenError('Circuit breaker open', details);
      const string = error.toString();

      expect(string).toContain('CircuitBreakerOpenError');
      expect(string).toContain('Circuit breaker open');
    });
  });

  describe('Error inheritance', () => {
    it('should all be instances of Error', () => {
      const connError = new RedisConnectionError('test', {
        host: 'localhost',
        port: 6379,
        reason: 'UNKNOWN',
      });

      const opError = new RedisOperationError('test', {
        operation: 'GET',
      });

      const cbError = new CircuitBreakerOpenError('test', {
        state: 'OPEN',
        failures: 5,
        resetTimeout: 30000,
      });

      expect(connError).toBeInstanceOf(Error);
      expect(opError).toBeInstanceOf(Error);
      expect(cbError).toBeInstanceOf(Error);
    });

    it('should have proper error names', () => {
      const connError = new RedisConnectionError('test', {
        host: 'localhost',
        port: 6379,
        reason: 'UNKNOWN',
      });

      const opError = new RedisOperationError('test', {
        operation: 'GET',
      });

      const cbError = new CircuitBreakerOpenError('test', {
        state: 'OPEN',
        failures: 5,
        resetTimeout: 30000,
      });

      // Name should match class name
      expect(connError.name).toBe('RedisConnectionError');
      expect(opError.name).toBe('RedisOperationError');
      expect(cbError.name).toBe('CircuitBreakerOpenError');
    });
  });
});
