import { ErrorType } from '@blaize-types/errors';

import { SSEStreamClosedError } from './sse-stream-closed-error';

// Mock the correlation system
vi.mock('../tracing/correlation', () => ({
  getCorrelationId: vi.fn().mockReturnValue('test-sse-correlation-410'),
}));

describe('SSEStreamClosedError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    test('creates SSEStreamClosedError with correct type and status', () => {
      const error = new SSEStreamClosedError('Stream closed');

      expect(error).toBeInstanceOf(SSEStreamClosedError);
      expect(error).toBeInstanceOf(Error);
      expect(error.type).toBe(ErrorType.SSE_STREAM_CLOSED);
      expect(error.status).toBe(410);
      expect(error.title).toBe('Stream closed');
      expect(error.name).toBe('SSEStreamClosedError');
    });

    test('uses current correlation ID when not provided', () => {
      const error = new SSEStreamClosedError('Stream closed');

      expect(error.correlationId).toBe('test-sse-correlation-410');
    });

    test('accepts custom correlation ID', () => {
      const customCorrelationId = 'custom-sse-410-correlation';
      const error = new SSEStreamClosedError('Stream closed', undefined, customCorrelationId);

      expect(error.correlationId).toBe(customCorrelationId);
    });

    test('handles undefined details gracefully', () => {
      const error = new SSEStreamClosedError('Stream closed');

      expect(error.details).toBeUndefined();
    });

    test('preserves stream closure details when provided', () => {
      const closureDetails = {
        clientId: 'client-123',
        closedAt: '2024-01-15T10:00:00.000Z',
        closeReason: 'client-disconnect' as const,
        canReconnect: true,
        retryAfter: 5000,
      };

      const error = new SSEStreamClosedError('Stream closed by client', closureDetails);

      expect(error.details).toEqual(closureDetails);
    });

    test('sets timestamp to current date', () => {
      const beforeCreation = new Date();
      const error = new SSEStreamClosedError('Stream closed');
      const afterCreation = new Date();

      expect(error.timestamp.getTime()).toBeGreaterThanOrEqual(beforeCreation.getTime());
      expect(error.timestamp.getTime()).toBeLessThanOrEqual(afterCreation.getTime());
    });

    test('has proper name for stack traces', () => {
      const error = new SSEStreamClosedError('Stream closed');

      expect(error.name).toBe('SSEStreamClosedError');
      expect(error.stack).toContain('SSEStreamClosedError');
    });
  });

  describe('close reasons', () => {
    test('client disconnect', () => {
      const error = new SSEStreamClosedError('Client disconnected', {
        clientId: 'client-456',
        closedAt: new Date().toISOString(),
        closeReason: 'client-disconnect',
        canReconnect: true,
        retryAfter: 1000,
      });

      expect(error.details?.closeReason).toBe('client-disconnect');
      expect(error.details?.canReconnect).toBe(true);
    });

    test('server close', () => {
      const error = new SSEStreamClosedError('Server closed stream', {
        closeReason: 'server-close',
        canReconnect: false,
      });

      expect(error.details?.closeReason).toBe('server-close');
      expect(error.details?.canReconnect).toBe(false);
    });

    test('timeout', () => {
      const error = new SSEStreamClosedError('Stream timed out', {
        clientId: 'client-789',
        closeReason: 'timeout',
        canReconnect: true,
        retryAfter: 3000,
      });

      expect(error.details?.closeReason).toBe('timeout');
      expect(error.details?.retryAfter).toBe(3000);
    });

    test('error closure', () => {
      const error = new SSEStreamClosedError('Stream closed due to error', {
        closeReason: 'error',
        canReconnect: false,
      });

      expect(error.details?.closeReason).toBe('error');
      expect(error.details?.canReconnect).toBe(false);
    });

    test('buffer overflow closure', () => {
      const error = new SSEStreamClosedError('Stream closed due to buffer overflow', {
        closeReason: 'buffer-overflow',
        canReconnect: true,
        retryAfter: 10000,
      });

      expect(error.details?.closeReason).toBe('buffer-overflow');
      expect(error.details?.canReconnect).toBe(true);
      expect(error.details?.retryAfter).toBe(10000);
    });
  });

  describe('common usage patterns', () => {
    test('simple stream closed', () => {
      const error = new SSEStreamClosedError('Cannot send event to closed stream');

      expect(error.status).toBe(410);
      expect(error.type).toBe(ErrorType.SSE_STREAM_CLOSED);
      expect(error.title).toBe('Cannot send event to closed stream');
    });

    test('stream closed with reconnection info', () => {
      const error = new SSEStreamClosedError('Temporary stream closure', {
        clientId: 'client-123',
        closedAt: new Date().toISOString(),
        closeReason: 'timeout',
        canReconnect: true,
        retryAfter: 5000,
      });

      expect(error.details?.canReconnect).toBe(true);
      expect(error.details?.retryAfter).toBe(5000);
    });

    test('permanent stream closure', () => {
      const error = new SSEStreamClosedError('Stream permanently closed', {
        clientId: 'client-456',
        closedAt: new Date().toISOString(),
        closeReason: 'error',
        canReconnect: false,
      });

      expect(error.details?.canReconnect).toBe(false);
      expect(error.details?.retryAfter).toBeUndefined();
    });
  });

  describe('integration with error handling', () => {
    test('can be thrown and caught properly', () => {
      expect(() => {
        throw new SSEStreamClosedError('Test stream closed error');
      }).toThrow(SSEStreamClosedError);

      expect(() => {
        throw new SSEStreamClosedError('Test stream closed error');
      }).toThrow('Test stream closed error');
    });

    test('maintains correlation ID when thrown across async boundaries', async () => {
      const error = new SSEStreamClosedError('Async stream closed error');

      await expect(async () => {
        await new Promise(resolve => setTimeout(resolve, 1));
        throw error;
      }).rejects.toThrow(SSEStreamClosedError);

      expect(error.correlationId).toBe('test-sse-correlation-410');
    });
  });
});
