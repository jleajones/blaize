/**
 * Tests for SSE Error Classes
 * Location: packages/blaize-client/src/errors/sse-errors.test.ts
 */

import {
  SSEConnectionError,
  SSEStreamError,
  SSEHeartbeatError,
  isSSEError,
  isSSEConnectionError,
  isSSEStreamError,
  isSSEHeartbeatError,
} from './sse-errors';
import {
  ErrorType,
  type SSEConnectionErrorContext,
  type SSEStreamErrorContext,
  type SSEHeartbeatErrorContext,
} from '../../../blaize-types/src/errors';

describe('SSE Error Classes', () => {
  describe('SSEConnectionError', () => {
    test('creates error with correct type and status', () => {
      const context: SSEConnectionErrorContext = {
        url: 'https://api.example.com/events',
        correlationId: 'client_123',
        state: 'connecting',
        reconnectAttempts: 2,
      };

      const error = new SSEConnectionError('Connection failed', context);

      expect(error).toBeInstanceOf(SSEConnectionError);
      expect(error).toBeInstanceOf(Error);
      expect(error.type).toBe(ErrorType.NETWORK_ERROR);
      expect(error.status).toBe(0);
      expect(error.title).toBe('Connection failed');
      expect(error.name).toBe('SSEConnectionError');
      expect(error.correlationId).toBe('client_123');
    });

    test('preserves connection context details', () => {
      const originalError = new Error('EventSource failed');
      const context: SSEConnectionErrorContext = {
        url: 'https://api.example.com/stream',
        correlationId: 'client_456',
        state: 'disconnected',
        reconnectAttempts: 5,
        originalError,
        sseDetails: {
          withCredentials: true,
          lastEventId: 'evt_789',
          readyState: 2,
        },
      };

      const error = new SSEConnectionError('SSE connection lost', context);

      expect(error.details).toEqual(context);
      expect(error.details?.state).toBe('disconnected');
      expect(error.details?.reconnectAttempts).toBe(5);
      expect(error.details?.sseDetails?.withCredentials).toBe(true);
      expect(error.details?.sseDetails?.lastEventId).toBe('evt_789');
    });

    test('accepts custom correlation ID override', () => {
      const context: SSEConnectionErrorContext = {
        url: 'https://api.example.com/events',
        correlationId: 'default_id',
        state: 'connecting',
      };

      const error = new SSEConnectionError('Connection failed', context, 'custom_id');
      expect(error.correlationId).toBe('custom_id');
    });
  });

  describe('SSEStreamError', () => {
    test('creates error with correct type for server errors', () => {
      const context: SSEStreamErrorContext = {
        url: 'https://api.example.com/events',
        correlationId: 'req_server_123',
        message: 'Subscription limit exceeded',
        code: 'SUB_LIMIT',
        name: 'SubscriptionError',
      };

      const error = new SSEStreamError('Server error', context);

      expect(error).toBeInstanceOf(SSEStreamError);
      expect(error.type).toBe(ErrorType.VALIDATION_ERROR);
      expect(error.status).toBe(0);
      expect(error.name).toBe('SSEStreamError');
      expect(error.correlationId).toBe('req_server_123');
    });

    test('preserves server error details', () => {
      const context: SSEStreamErrorContext = {
        url: 'https://api.example.com/notifications',
        correlationId: 'req_server_456',
        message: 'Invalid event filter',
        code: 'INVALID_FILTER',
        name: 'ValidationError',
        rawData: {
          field: 'filter',
          value: 'invalid*regex',
          reason: 'Invalid regex pattern',
        },
      };

      const error = new SSEStreamError('Validation failed', context);

      expect(error.details).toEqual(context);
      expect(error.details?.message).toBe('Invalid event filter');
      expect(error.details?.code).toBe('INVALID_FILTER');
      expect(error.details?.rawData?.field).toBe('filter');
    });
  });

  describe('SSEHeartbeatError', () => {
    test('creates error with timeout type', () => {
      const context: SSEHeartbeatErrorContext = {
        url: 'https://api.example.com/events',
        correlationId: 'client_hb_123',
        heartbeatTimeout: 30000,
        timeSinceLastEvent: 35000,
        lastEventId: 'evt_last',
      };

      const error = new SSEHeartbeatError('Heartbeat timeout', context);

      expect(error).toBeInstanceOf(SSEHeartbeatError);
      expect(error.type).toBe(ErrorType.TIMEOUT_ERROR);
      expect(error.status).toBe(0);
      expect(error.name).toBe('SSEHeartbeatError');
    });

    test('includes timing information', () => {
      const context: SSEHeartbeatErrorContext = {
        url: 'https://api.example.com/live',
        correlationId: 'client_hb_456',
        heartbeatTimeout: 60000,
        timeSinceLastEvent: 65000,
      };

      const error = new SSEHeartbeatError('Connection stale', context);

      expect(error.details?.heartbeatTimeout).toBe(60000);
      expect(error.details?.timeSinceLastEvent).toBe(65000);
      expect(error.details?.timeSinceLastEvent).toBeGreaterThan(error.details!.heartbeatTimeout);
    });
  });

  describe('Type guards', () => {
    test('isSSEError identifies all SSE error types', () => {
      const connectionError = new SSEConnectionError('Connection failed', {
        url: 'test',
        correlationId: 'test',
        state: 'connecting',
      });

      const streamError = new SSEStreamError('Stream error', {
        url: 'test',
        correlationId: 'test',
        message: 'Error',
      });

      const heartbeatError = new SSEHeartbeatError('Timeout', {
        url: 'test',
        correlationId: 'test',
        heartbeatTimeout: 30000,
      });

      const regularError = new Error('Regular error');

      expect(isSSEError(connectionError)).toBe(true);
      expect(isSSEError(streamError)).toBe(true);
      expect(isSSEError(heartbeatError)).toBe(true);
      expect(isSSEError(regularError)).toBe(false);
    });

    test('specific type guards work correctly', () => {
      const connectionError = new SSEConnectionError('Connection failed', {
        url: 'test',
        correlationId: 'test',
        state: 'connecting',
      });

      const streamError = new SSEStreamError('Stream error', {
        url: 'test',
        correlationId: 'test',
        message: 'Error',
      });

      const heartbeatError = new SSEHeartbeatError('Timeout', {
        url: 'test',
        correlationId: 'test',
        heartbeatTimeout: 30000,
      });

      // Positive checks
      expect(isSSEConnectionError(connectionError)).toBe(true);
      expect(isSSEStreamError(streamError)).toBe(true);
      expect(isSSEHeartbeatError(heartbeatError)).toBe(true);

      // Negative checks
      expect(isSSEConnectionError(streamError)).toBe(false);
      expect(isSSEConnectionError(heartbeatError)).toBe(false);
      expect(isSSEStreamError(connectionError)).toBe(false);
      expect(isSSEStreamError(heartbeatError)).toBe(false);
      expect(isSSEHeartbeatError(connectionError)).toBe(false);
      expect(isSSEHeartbeatError(streamError)).toBe(false);
    });
  });

  describe('Error serialization', () => {
    test('all SSE errors serialize to JSON correctly', () => {
      const connectionError = new SSEConnectionError('Connection failed', {
        url: 'https://api.example.com/events',
        correlationId: 'client_123',
        state: 'connecting',
      });

      const streamError = new SSEStreamError('Stream error', {
        url: 'https://api.example.com/events',
        correlationId: 'req_456',
        message: 'Error message',
      });

      const heartbeatError = new SSEHeartbeatError('Timeout', {
        url: 'https://api.example.com/events',
        correlationId: 'client_789',
        heartbeatTimeout: 30000,
      });

      [connectionError, streamError, heartbeatError].forEach(error => {
        const serialized = error.toJSON();
        expect(serialized).toHaveProperty('type');
        expect(serialized).toHaveProperty('title');
        expect(serialized).toHaveProperty('status', 0);
        expect(serialized).toHaveProperty('correlationId');
        expect(serialized).toHaveProperty('timestamp');
        expect(serialized).toHaveProperty('details');
      });
    });
  });

  describe('Error message formatting', () => {
    test('includes correlation ID in toString()', () => {
      const error = new SSEConnectionError('Connection failed', {
        url: 'test',
        correlationId: 'client_formatted_123',
        state: 'connecting',
      });

      const stringRep = error.toString();
      expect(stringRep).toContain('client_formatted_123');
      expect(stringRep).toBe('SSEConnectionError: Connection failed [client_formatted_123]');
    });
  });
});
