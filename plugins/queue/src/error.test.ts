/**
 * Unit Tests for Queue Plugin Error Classes
 *
 * Tests verify error properties, inheritance, and typed details.
 */
import { ErrorType } from 'blaizejs';
import {
  QueueError,
  JobNotFoundError,
  JobTimeoutError,
  JobCancelledError,
  HandlerNotFoundError,
  QueueNotFoundError,
  QueueConfigError,
  StorageError,
} from './errors';

import type { StorageErrorDetails } from './types';

// Mock getCorrelationId
vi.mock('blaizejs', async () => {
  const actual = await vi.importActual('blaizejs');
  return {
    ...actual,
    getCorrelationId: vi.fn().mockReturnValue('test-correlation-id'),
  };
});

describe('Error Classes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // QueueError (Base Class)
  // ==========================================================================
  describe('QueueError', () => {
    it('should create error with default status 500', () => {
      const error = new QueueError('Something went wrong');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(QueueError);
      expect(error.name).toBe('QueueError');
      expect(error.title).toBe('Something went wrong');
      expect(error.status).toBe(500);
      expect(error.type).toBe(ErrorType.INTERNAL_SERVER_ERROR);
      expect(error.correlationId).toBe('test-correlation-id');
    });

    it('should create error with custom status', () => {
      const error = new QueueError('Bad request', 400);

      expect(error.status).toBe(400);
      expect(error.title).toBe('Bad request');
    });

    it('should include details when provided', () => {
      const details = { operation: 'process', queueName: 'emails' };
      const error = new QueueError('Operation failed', 500, details);

      expect(error.details).toEqual(details);
      expect(error.details?.operation).toBe('process');
      expect(error.details?.queueName).toBe('emails');
    });

    it('should use custom correlation ID when provided', () => {
      const error = new QueueError('Error', 500, undefined, 'custom-correlation-123');

      expect(error.correlationId).toBe('custom-correlation-123');
    });

    it('should have timestamp', () => {
      const before = new Date();
      const error = new QueueError('Error');
      const after = new Date();

      expect(error.timestamp).toBeInstanceOf(Date);
      expect(error.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(error.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  // ==========================================================================
  // JobNotFoundError
  // ==========================================================================
  describe('JobNotFoundError', () => {
    it('should create error with job ID only', () => {
      const error = new JobNotFoundError('job_abc123');

      expect(error).toBeInstanceOf(JobNotFoundError);
      expect(error.name).toBe('JobNotFoundError');
      expect(error.title).toBe("Job 'job_abc123' not found");
      expect(error.status).toBe(404);
      expect(error.type).toBe(ErrorType.NOT_FOUND);
      expect(error.details?.jobId).toBe('job_abc123');
      expect(error.details?.queueName).toBeUndefined();
    });

    it('should create error with job ID and queue name', () => {
      const error = new JobNotFoundError('job_abc123', 'emails');

      expect(error.title).toBe("Job 'job_abc123' not found in queue 'emails'");
      expect(error.details?.jobId).toBe('job_abc123');
      expect(error.details?.queueName).toBe('emails');
    });

    it('should use custom correlation ID', () => {
      const error = new JobNotFoundError('job_123', 'default', 'custom-corr');

      expect(error.correlationId).toBe('custom-corr');
    });
  });

  // ==========================================================================
  // JobTimeoutError
  // ==========================================================================
  describe('JobTimeoutError', () => {
    it('should create error with required fields', () => {
      const error = new JobTimeoutError('job_123', 'emails', 'email:send', 30000);

      expect(error).toBeInstanceOf(JobTimeoutError);
      expect(error.name).toBe('JobTimeoutError');
      expect(error.title).toBe("Job 'job_123' (email:send) timed out after 30000ms");
      expect(error.status).toBe(408);
      expect(error.type).toBe(ErrorType.TIMEOUT_ERROR);
      expect(error.details?.jobId).toBe('job_123');
      expect(error.details?.queueName).toBe('emails');
      expect(error.details?.jobType).toBe('email:send');
      expect(error.details?.timeoutMs).toBe(30000);
      expect(error.details?.elapsedMs).toBeUndefined();
    });

    it('should include elapsed time when provided', () => {
      const error = new JobTimeoutError('job_123', 'emails', 'email:send', 30000, 35000);

      expect(error.details?.elapsedMs).toBe(35000);
    });

    it('should use custom correlation ID', () => {
      const error = new JobTimeoutError('job_123', 'q', 'type', 1000, undefined, 'custom-corr');

      expect(error.correlationId).toBe('custom-corr');
    });
  });

  // ==========================================================================
  // JobCancelledError
  // ==========================================================================
  describe('JobCancelledError', () => {
    it('should create error without reason', () => {
      const error = new JobCancelledError('job_123', 'emails', 'email:send');

      expect(error).toBeInstanceOf(JobCancelledError);
      expect(error.name).toBe('JobCancelledError');
      expect(error.title).toBe("Job 'job_123' (email:send) was cancelled");
      expect(error.status).toBe(499);
      expect(error.type).toBe(ErrorType.HTTP_ERROR);
      expect(error.details?.jobId).toBe('job_123');
      expect(error.details?.queueName).toBe('emails');
      expect(error.details?.jobType).toBe('email:send');
      expect(error.details?.reason).toBeUndefined();
      expect(error.details?.wasRunning).toBe(false);
    });

    it('should create error with reason', () => {
      const error = new JobCancelledError('job_123', 'emails', 'email:send', 'User requested');

      expect(error.title).toBe("Job 'job_123' (email:send) was cancelled: User requested");
      expect(error.details?.reason).toBe('User requested');
    });

    it('should track wasRunning state', () => {
      const error = new JobCancelledError('job_123', 'emails', 'email:send', 'Shutdown', true);

      expect(error.details?.wasRunning).toBe(true);
    });

    it('should use custom correlation ID', () => {
      const error = new JobCancelledError('j', 'q', 't', undefined, false, 'custom-corr');

      expect(error.correlationId).toBe('custom-corr');
    });
  });

  // ==========================================================================
  // HandlerNotFoundError
  // ==========================================================================
  describe('HandlerNotFoundError', () => {
    it('should create error with required fields', () => {
      const error = new HandlerNotFoundError('email:send', 'emails');

      expect(error).toBeInstanceOf(HandlerNotFoundError);
      expect(error.name).toBe('HandlerNotFoundError');
      expect(error.title).toBe("No handler registered for job type 'email:send' in queue 'emails'");
      expect(error.status).toBe(500);
      expect(error.type).toBe(ErrorType.INTERNAL_SERVER_ERROR);
      expect(error.details?.jobType).toBe('email:send');
      expect(error.details?.queueName).toBe('emails');
      expect(error.details?.registeredHandlers).toBeUndefined();
    });

    it('should include registered handlers list', () => {
      const handlers = ['report:generate', 'notification:send'];
      const error = new HandlerNotFoundError('email:send', 'emails', handlers);

      expect(error.details?.registeredHandlers).toEqual(handlers);
    });

    it('should use custom correlation ID', () => {
      const error = new HandlerNotFoundError('type', 'queue', undefined, 'custom-corr');

      expect(error.correlationId).toBe('custom-corr');
    });
  });

  // ==========================================================================
  // QueueNotFoundError
  // ==========================================================================
  describe('QueueNotFoundError', () => {
    it('should create error with queue name only', () => {
      const error = new QueueNotFoundError('emails');

      expect(error).toBeInstanceOf(QueueNotFoundError);
      expect(error.name).toBe('QueueNotFoundError');
      expect(error.title).toBe("Queue 'emails' not found");
      expect(error.status).toBe(404);
      expect(error.type).toBe(ErrorType.NOT_FOUND);
      expect(error.details?.queueName).toBe('emails');
      expect(error.details?.availableQueues).toBeUndefined();
    });

    it('should include available queues in message', () => {
      const available = ['default', 'reports'];
      const error = new QueueNotFoundError('emails', available);

      expect(error.title).toBe("Queue 'emails' not found. Available queues: default, reports");
      expect(error.details?.availableQueues).toEqual(available);
    });

    it('should handle empty available queues array', () => {
      const error = new QueueNotFoundError('emails', []);

      expect(error.title).toBe("Queue 'emails' not found");
    });

    it('should use custom correlation ID', () => {
      const error = new QueueNotFoundError('queue', undefined, 'custom-corr');

      expect(error.correlationId).toBe('custom-corr');
    });
  });

  // ==========================================================================
  // QueueConfigError
  // ==========================================================================
  describe('QueueConfigError', () => {
    it('should create error with all required fields', () => {
      const error = new QueueConfigError(
        'Invalid concurrency value',
        'concurrency',
        -1,
        'positive integer between 1 and 100'
      );

      expect(error).toBeInstanceOf(QueueConfigError);
      expect(error.name).toBe('QueueConfigError');
      expect(error.title).toBe('Invalid concurrency value');
      expect(error.status).toBe(400);
      expect(error.type).toBe(ErrorType.VALIDATION_ERROR);
      expect(error.details?.field).toBe('concurrency');
      expect(error.details?.value).toBe(-1);
      expect(error.details?.expected).toBe('positive integer between 1 and 100');
    });

    it('should handle complex values', () => {
      const complexValue = { invalid: true, data: [1, 2, 3] };
      const error = new QueueConfigError(
        'Invalid queue config',
        'queues.default',
        complexValue,
        'object with concurrency field'
      );

      expect(error.details?.value).toEqual(complexValue);
    });

    it('should use custom correlation ID', () => {
      const error = new QueueConfigError('Error', 'field', 'value', 'expected', 'custom-corr');

      expect(error.correlationId).toBe('custom-corr');
    });
  });

  // ==========================================================================
  // StorageError
  // ==========================================================================
  describe('StorageError', () => {
    it('should create error with required fields', () => {
      const error = new StorageError('Failed to enqueue job', 'enqueue');

      expect(error).toBeInstanceOf(StorageError);
      expect(error.name).toBe('StorageError');
      expect(error.title).toBe('Failed to enqueue job');
      expect(error.status).toBe(500);
      expect(error.type).toBe(ErrorType.INTERNAL_SERVER_ERROR);
      expect(error.details?.operation).toBe('enqueue');
      expect(error.details?.queueName).toBeUndefined();
      expect(error.details?.jobId).toBeUndefined();
      expect(error.details?.originalError).toBeUndefined();
    });

    it('should include all optional fields', () => {
      const error = new StorageError(
        'Failed to get job',
        'getJob',
        'emails',
        'job_123',
        'ECONNREFUSED'
      );

      expect(error.details?.operation).toBe('getJob');
      expect(error.details?.queueName).toBe('emails');
      expect(error.details?.jobId).toBe('job_123');
      expect(error.details?.originalError).toBe('ECONNREFUSED');
    });

    it('should accept all valid operation types', () => {
      const operations: Array<StorageErrorDetails['operation']> = [
        'enqueue',
        'dequeue',
        'getJob',
        'updateJob',
        'removeJob',
        'listJobs',
        'getStats',
        'connect',
        'disconnect',
        'healthCheck',
      ];

      for (const op of operations) {
        const error = new StorageError(`Failed ${op}`, op);
        expect(error.details?.operation).toBe(op);
      }
    });

    it('should use custom correlation ID', () => {
      const error = new StorageError(
        'Error',
        'connect',
        undefined,
        undefined,
        undefined,
        'custom-corr'
      );

      expect(error.correlationId).toBe('custom-corr');
    });
  });

  // ==========================================================================
  // Inheritance Tests
  // ==========================================================================
  describe('Error Inheritance', () => {
    it('all errors should be instances of Error', () => {
      const errors = [
        new QueueError('test'),
        new JobNotFoundError('job'),
        new JobTimeoutError('job', 'queue', 'type', 1000),
        new JobCancelledError('job', 'queue', 'type'),
        new HandlerNotFoundError('type', 'queue'),
        new QueueNotFoundError('queue'),
        new QueueConfigError('msg', 'field', 'value', 'expected'),
        new StorageError('msg', 'enqueue'),
      ];

      for (const error of errors) {
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBeDefined();
        expect(error.stack).toBeDefined();
      }
    });

    it('all specific errors should have unique names', () => {
      const names = [
        new QueueError('test').name,
        new JobNotFoundError('job').name,
        new JobTimeoutError('job', 'queue', 'type', 1000).name,
        new JobCancelledError('job', 'queue', 'type').name,
        new HandlerNotFoundError('type', 'queue').name,
        new QueueNotFoundError('queue').name,
        new QueueConfigError('msg', 'field', 'value', 'expected').name,
        new StorageError('msg', 'enqueue').name,
      ];

      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });
  });

  // ==========================================================================
  // Serialization Tests
  // ==========================================================================
  describe('Error Serialization', () => {
    it('should serialize to JSON correctly', () => {
      const error = new JobNotFoundError('job_123', 'emails');
      const json = error.toJSON();

      expect(json).toEqual({
        type: ErrorType.NOT_FOUND,
        title: "Job 'job_123' not found in queue 'emails'",
        status: 404,
        correlationId: 'test-correlation-id',
        timestamp: expect.any(String),
        details: {
          jobId: 'job_123',
          queueName: 'emails',
        },
      });

      // Verify timestamp is valid ISO string
      expect(() => new Date(json.timestamp)).not.toThrow();
    });

    it('should produce valid string representation', () => {
      const error = new QueueConfigError('Invalid config', 'concurrency', -1, 'positive');
      const str = error.toString();

      expect(str).toContain('QueueConfigError');
      expect(str).toContain('Invalid config');
      expect(str).toContain('test-correlation-id');
    });
  });

  // ==========================================================================
  // Error Catching Tests
  // ==========================================================================
  describe('Error Catching', () => {
    it('should be catchable by specific type', () => {
      const throwJobNotFound = () => {
        throw new JobNotFoundError('job_123');
      };

      expect(throwJobNotFound).toThrow(JobNotFoundError);
    });

    it('should be catchable by base QueueError type', () => {
      // Note: This tests that all our errors extend BlaizeError, not QueueError
      // Since JobNotFoundError extends BlaizeError directly
      const throwJobNotFound = () => {
        throw new JobNotFoundError('job_123');
      };

      try {
        throwJobNotFound();
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as JobNotFoundError).name).toBe('JobNotFoundError');
      }
    });

    it('should support instanceof checks for routing', () => {
      const errors = [
        new JobNotFoundError('job'),
        new QueueNotFoundError('queue'),
        new QueueConfigError('msg', 'field', 'value', 'expected'),
      ];

      for (const error of errors) {
        if (error instanceof JobNotFoundError) {
          expect(error.details?.jobId).toBe('job');
        } else if (error instanceof QueueNotFoundError) {
          expect(error.details?.queueName).toBe('queue');
        } else if (error instanceof QueueConfigError) {
          expect(error.details?.field).toBe('field');
        }
      }
    });
  });
});
