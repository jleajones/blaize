import { ErrorType } from '@blaize-types/errors';

import { SSEBufferOverflowError } from './sse-buffer-overflow-error';

// Mock the correlation system
vi.mock('../tracing/correlation', () => ({
  getCorrelationId: vi.fn().mockReturnValue('test-sse-correlation-503'),
}));

describe('SSEBufferOverflowError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    test('creates SSEBufferOverflowError with correct type and status', () => {
      const error = new SSEBufferOverflowError('Buffer overflow', {
        currentSize: 1000,
        maxSize: 1000,
        strategy: 'drop-oldest',
      });

      expect(error).toBeInstanceOf(SSEBufferOverflowError);
      expect(error).toBeInstanceOf(Error);
      expect(error.type).toBe(ErrorType.SSE_BUFFER_OVERFLOW);
      expect(error.status).toBe(503);
      expect(error.title).toBe('Buffer overflow');
      expect(error.name).toBe('SSEBufferOverflowError');
    });

    test('uses current correlation ID when not provided', () => {
      const error = new SSEBufferOverflowError('Buffer overflow', {
        currentSize: 100,
        maxSize: 100,
        strategy: 'close',
      });

      expect(error.correlationId).toBe('test-sse-correlation-503');
    });

    test('accepts custom correlation ID', () => {
      const customCorrelationId = 'custom-sse-503-correlation';
      const error = new SSEBufferOverflowError(
        'Buffer overflow',
        {
          currentSize: 500,
          maxSize: 500,
          strategy: 'drop-newest',
        },
        customCorrelationId
      );

      expect(error.correlationId).toBe(customCorrelationId);
    });

    test('requires buffer details', () => {
      const bufferDetails = {
        currentSize: 1000,
        maxSize: 1000,
        strategy: 'drop-oldest' as const,
      };

      const error = new SSEBufferOverflowError('Buffer limit exceeded', bufferDetails);

      expect(error.details).toEqual(bufferDetails);
      expect(error.details!.currentSize).toBe(1000);
      expect(error.details!.maxSize).toBe(1000);
      expect(error.details!.strategy).toBe('drop-oldest');
    });

    test('preserves full buffer overflow details', () => {
      const fullDetails = {
        clientId: 'client-123',
        currentSize: 5000,
        maxSize: 5000,
        eventsDropped: 25,
        strategy: 'drop-oldest' as const,
        triggeringEvent: 'large-data-update',
      };

      const error = new SSEBufferOverflowError('High-frequency stream overflow', fullDetails);

      expect(error.details).toEqual(fullDetails);
      expect(error.details!.clientId).toBe('client-123');
      expect(error.details!.eventsDropped).toBe(25);
      expect(error.details!.triggeringEvent).toBe('large-data-update');
    });

    test('sets timestamp to current date', () => {
      const beforeCreation = new Date();
      const error = new SSEBufferOverflowError('Buffer overflow', {
        currentSize: 100,
        maxSize: 100,
        strategy: 'close',
      });
      const afterCreation = new Date();

      expect(error.timestamp.getTime()).toBeGreaterThanOrEqual(beforeCreation.getTime());
      expect(error.timestamp.getTime()).toBeLessThanOrEqual(afterCreation.getTime());
    });
  });

  describe('buffer strategies', () => {
    test('drop-oldest strategy', () => {
      const error = new SSEBufferOverflowError('Buffer overflow with drop-oldest', {
        currentSize: 1000,
        maxSize: 1000,
        strategy: 'drop-oldest',
        eventsDropped: 10,
      });

      expect(error.details!.strategy).toBe('drop-oldest');
      expect(error.details!.eventsDropped).toBe(10);
    });

    test('drop-newest strategy', () => {
      const error = new SSEBufferOverflowError('Buffer overflow with drop-newest', {
        currentSize: 2000,
        maxSize: 2000,
        strategy: 'drop-newest',
        eventsDropped: 5,
      });

      expect(error.details!.strategy).toBe('drop-newest');
      expect(error.details!.eventsDropped).toBe(5);
    });

    test('close strategy', () => {
      const error = new SSEBufferOverflowError('Stream closed due to overflow', {
        clientId: 'client-456',
        currentSize: 500,
        maxSize: 500,
        strategy: 'close',
      });

      expect(error.details!.strategy).toBe('close');
      expect(error.details!.clientId).toBe('client-456');
    });
  });

  describe('common usage patterns', () => {
    test('simple buffer overflow', () => {
      const error = new SSEBufferOverflowError('SSE buffer limit exceeded', {
        currentSize: 100,
        maxSize: 100,
        strategy: 'drop-oldest',
      });

      expect(error.status).toBe(503);
      expect(error.type).toBe(ErrorType.SSE_BUFFER_OVERFLOW);
    });

    test('overflow with client context', () => {
      const error = new SSEBufferOverflowError('Client buffer overflow', {
        clientId: 'client-789',
        currentSize: 1000,
        maxSize: 1000,
        strategy: 'drop-newest',
        eventsDropped: 15,
      });

      expect(error.details!.clientId).toBe('client-789');
      expect(error.details!.eventsDropped).toBe(15);
    });

    test('overflow triggering stream closure', () => {
      const error = new SSEBufferOverflowError('Fatal buffer overflow', {
        currentSize: 10000,
        maxSize: 10000,
        strategy: 'close',
        triggeringEvent: 'bulk-update',
      });

      expect(error.details!.strategy).toBe('close');
      expect(error.details!.triggeringEvent).toBe('bulk-update');
    });
  });

  describe('integration with error handling', () => {
    test('can be thrown and caught properly', () => {
      expect(() => {
        throw new SSEBufferOverflowError('Test overflow error', {
          currentSize: 100,
          maxSize: 100,
          strategy: 'close',
        });
      }).toThrow(SSEBufferOverflowError);
    });

    test('maintains correlation ID when thrown across async boundaries', async () => {
      const error = new SSEBufferOverflowError('Async overflow error', {
        currentSize: 200,
        maxSize: 200,
        strategy: 'drop-oldest',
      });

      await expect(async () => {
        await new Promise(resolve => setTimeout(resolve, 1));
        throw error;
      }).rejects.toThrow(SSEBufferOverflowError);

      expect(error.correlationId).toBe('test-sse-correlation-503');
    });
  });
});
