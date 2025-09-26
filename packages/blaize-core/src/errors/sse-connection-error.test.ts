import { ErrorType } from '@blaize-types/errors';

import { SSEConnectionError } from './sse-connection-error';

// Mock the correlation system
vi.mock('../tracing/correlation', () => ({
  getCorrelationId: vi.fn().mockReturnValue('test-sse-correlation-502'),
}));

describe('SSEConnectionError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    test('creates SSEConnectionError with correct type and status', () => {
      const error = new SSEConnectionError('SSE connection failed');

      expect(error).toBeInstanceOf(SSEConnectionError);
      expect(error).toBeInstanceOf(Error);
      expect(error.type).toBe(ErrorType.SSE_CONNECTION_ERROR);
      expect(error.status).toBe(502);
      expect(error.title).toBe('SSE connection failed');
      expect(error.name).toBe('SSEConnectionError');
    });

    test('uses current correlation ID when not provided', () => {
      const error = new SSEConnectionError('Connection failed');

      expect(error.correlationId).toBe('test-sse-correlation-502');
    });

    test('accepts custom correlation ID', () => {
      const customCorrelationId = 'custom-sse-502-correlation';
      const error = new SSEConnectionError('Connection failed', undefined, customCorrelationId);

      expect(error.correlationId).toBe(customCorrelationId);
    });

    test('handles undefined details gracefully', () => {
      const error = new SSEConnectionError('Connection failed');

      expect(error.details).toBeUndefined();
    });

    test('preserves connection details when provided', () => {
      const connectionDetails = {
        clientId: 'client-123',
        attemptNumber: 3,
        maxRetries: 5,
        cause: 'Network timeout',
        suggestion: 'Check network connectivity',
      };

      const error = new SSEConnectionError('SSE connection failed', connectionDetails);

      expect(error.details).toEqual(connectionDetails);
    });

    test('sets timestamp to current date', () => {
      const beforeCreation = new Date();
      const error = new SSEConnectionError('Connection failed');
      const afterCreation = new Date();

      expect(error.timestamp.getTime()).toBeGreaterThanOrEqual(beforeCreation.getTime());
      expect(error.timestamp.getTime()).toBeLessThanOrEqual(afterCreation.getTime());
    });

    test('has proper name for stack traces', () => {
      const error = new SSEConnectionError('Connection failed');

      expect(error.name).toBe('SSEConnectionError');
      expect(error.stack).toContain('SSEConnectionError');
    });

    test('preserves complex connection details', () => {
      const complexDetails = {
        clientId: 'client-456',
        attemptNumber: 1,
        maxRetries: 10,
        cause: 'Connection limit exceeded',
        suggestion: 'Wait for existing connections to close',
      };

      const error = new SSEConnectionError('Connection limit reached', complexDetails);

      expect(error.details!.clientId).toBe('client-456');
      expect(error.details!.attemptNumber).toBe(1);
      expect(error.details!.maxRetries).toBe(10);
      expect(error.details!.cause).toBe('Connection limit exceeded');
      expect(error.details!.suggestion).toBe('Wait for existing connections to close');
    });
  });

  describe('common usage patterns', () => {
    test('simple connection failure', () => {
      const error = new SSEConnectionError('Failed to establish SSE connection');

      expect(error.status).toBe(502);
      expect(error.type).toBe(ErrorType.SSE_CONNECTION_ERROR);
      expect(error.title).toBe('Failed to establish SSE connection');
    });

    test('connection with retry context', () => {
      const error = new SSEConnectionError('SSE connection failed after retries', {
        clientId: 'client-789',
        attemptNumber: 5,
        maxRetries: 5,
        cause: 'All retry attempts exhausted',
      });

      expect(error.details?.attemptNumber).toBe(5);
      expect(error.details?.maxRetries).toBe(5);
    });

    test('connection limit error', () => {
      const error = new SSEConnectionError('Maximum connections reached', {
        cause: 'Server at capacity',
        suggestion: 'Try again later',
      });

      expect(error.details!.cause).toBe('Server at capacity');
      expect(error.details!.suggestion).toBe('Try again later');
    });
  });

  describe('integration with error handling', () => {
    test('can be thrown and caught properly', () => {
      expect(() => {
        throw new SSEConnectionError('Test connection error');
      }).toThrow(SSEConnectionError);

      expect(() => {
        throw new SSEConnectionError('Test connection error');
      }).toThrow('Test connection error');
    });

    test('maintains correlation ID when thrown across async boundaries', async () => {
      const error = new SSEConnectionError('Async connection error');

      await expect(async () => {
        await new Promise(resolve => setTimeout(resolve, 1));
        throw error;
      }).rejects.toThrow(SSEConnectionError);

      expect(error.correlationId).toBe('test-sse-correlation-502');
    });
  });
});
