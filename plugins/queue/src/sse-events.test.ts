/**
 * Tests for SSE Event Schemas
 *
 * Tests validation and type inference for job event schemas.
 */
import {
  jobProgressEventSchema,
  jobCompletedEventSchema,
  jobFailedEventSchema,
  jobCancelledEventSchema,
  jobEventsSchema,
} from './schema';

import type {
  JobProgressEvent,
  JobCompletedEvent,
  JobFailedEvent,
  JobCancelledEvent,
  JobEvent,
  JobEventName,
} from './schema';

// ============================================================================
// Test Data
// ============================================================================

const validUUID = '550e8400-e29b-41d4-a716-446655440000';
const timestamp = Date.now();

// ============================================================================
// Tests: jobProgressEventSchema
// ============================================================================

describe('jobProgressEventSchema', () => {
  describe('valid payloads', () => {
    it('should accept valid progress event with message', () => {
      const event = {
        jobId: validUUID,
        percent: 50,
        message: 'Processing batch 5 of 10',
        timestamp,
      };

      const result = jobProgressEventSchema.parse(event);

      expect(result.jobId).toBe(validUUID);
      expect(result.percent).toBe(50);
      expect(result.message).toBe('Processing batch 5 of 10');
      expect(result.timestamp).toBe(timestamp);
    });

    it('should accept valid progress event without message', () => {
      const event = {
        jobId: validUUID,
        percent: 75,
        timestamp,
      };

      const result = jobProgressEventSchema.parse(event);

      expect(result.jobId).toBe(validUUID);
      expect(result.percent).toBe(75);
      expect(result.message).toBeUndefined();
    });

    it('should accept 0% progress', () => {
      const event = {
        jobId: validUUID,
        percent: 0,
        timestamp,
      };

      const result = jobProgressEventSchema.parse(event);
      expect(result.percent).toBe(0);
    });

    it('should accept 100% progress', () => {
      const event = {
        jobId: validUUID,
        percent: 100,
        timestamp,
      };

      const result = jobProgressEventSchema.parse(event);
      expect(result.percent).toBe(100);
    });
  });

  describe('invalid payloads', () => {
    it('should reject invalid UUID', () => {
      const event = {
        jobId: 'not-a-uuid',
        percent: 50,
        timestamp,
      };

      expect(() => jobProgressEventSchema.parse(event)).toThrow('UUID');
    });

    it('should reject percent below 0', () => {
      const event = {
        jobId: validUUID,
        percent: -1,
        timestamp,
      };

      expect(() => jobProgressEventSchema.parse(event)).toThrow('at least 0');
    });

    it('should reject percent above 100', () => {
      const event = {
        jobId: validUUID,
        percent: 101,
        timestamp,
      };

      expect(() => jobProgressEventSchema.parse(event)).toThrow('at most 100');
    });

    it('should reject missing jobId', () => {
      const event = {
        percent: 50,
        timestamp,
      };

      expect(() => jobProgressEventSchema.parse(event)).toThrow();
    });

    it('should reject missing timestamp', () => {
      const event = {
        jobId: validUUID,
        percent: 50,
      };

      expect(() => jobProgressEventSchema.parse(event)).toThrow();
    });
  });
});

// ============================================================================
// Tests: jobCompletedEventSchema
// ============================================================================

describe('jobCompletedEventSchema', () => {
  describe('valid payloads', () => {
    it('should accept valid completed event with object result', () => {
      const event = {
        jobId: validUUID,
        result: { emailsSent: 150, success: true },
        completedAt: timestamp,
      };

      const result = jobCompletedEventSchema.parse(event);

      expect(result.jobId).toBe(validUUID);
      expect(result.result).toEqual({ emailsSent: 150, success: true });
      expect(result.completedAt).toBe(timestamp);
    });

    it('should accept null result', () => {
      const event = {
        jobId: validUUID,
        result: null,
        completedAt: timestamp,
      };

      const result = jobCompletedEventSchema.parse(event);
      expect(result.result).toBeNull();
    });

    it('should accept undefined result', () => {
      const event = {
        jobId: validUUID,
        result: undefined,
        completedAt: timestamp,
      };

      const result = jobCompletedEventSchema.parse(event);
      expect(result.result).toBeUndefined();
    });

    it('should accept primitive result', () => {
      const event = {
        jobId: validUUID,
        result: 'done',
        completedAt: timestamp,
      };

      const result = jobCompletedEventSchema.parse(event);
      expect(result.result).toBe('done');
    });

    it('should accept array result', () => {
      const event = {
        jobId: validUUID,
        result: [1, 2, 3],
        completedAt: timestamp,
      };

      const result = jobCompletedEventSchema.parse(event);
      expect(result.result).toEqual([1, 2, 3]);
    });
  });

  describe('invalid payloads', () => {
    it('should reject invalid UUID', () => {
      const event = {
        jobId: 'invalid',
        result: {},
        completedAt: timestamp,
      };

      expect(() => jobCompletedEventSchema.parse(event)).toThrow('UUID');
    });

    it('should reject missing completedAt', () => {
      const event = {
        jobId: validUUID,
        result: {},
      };

      expect(() => jobCompletedEventSchema.parse(event)).toThrow();
    });
  });
});

// ============================================================================
// Tests: jobFailedEventSchema
// ============================================================================

describe('jobFailedEventSchema', () => {
  describe('valid payloads', () => {
    it('should accept valid failed event with code', () => {
      const event = {
        jobId: validUUID,
        error: {
          message: 'Connection timeout',
          code: 'ETIMEDOUT',
        },
        failedAt: timestamp,
      };

      const result = jobFailedEventSchema.parse(event);

      expect(result.jobId).toBe(validUUID);
      expect(result.error.message).toBe('Connection timeout');
      expect(result.error.code).toBe('ETIMEDOUT');
      expect(result.failedAt).toBe(timestamp);
    });

    it('should accept valid failed event without code', () => {
      const event = {
        jobId: validUUID,
        error: {
          message: 'Unknown error',
        },
        failedAt: timestamp,
      };

      const result = jobFailedEventSchema.parse(event);

      expect(result.error.message).toBe('Unknown error');
      expect(result.error.code).toBeUndefined();
    });
  });

  describe('invalid payloads', () => {
    it('should reject invalid UUID', () => {
      const event = {
        jobId: 'invalid',
        error: { message: 'Error' },
        failedAt: timestamp,
      };

      expect(() => jobFailedEventSchema.parse(event)).toThrow('UUID');
    });

    it('should reject missing error message', () => {
      const event = {
        jobId: validUUID,
        error: {},
        failedAt: timestamp,
      };

      expect(() => jobFailedEventSchema.parse(event)).toThrow();
    });

    it('should reject missing error object', () => {
      const event = {
        jobId: validUUID,
        failedAt: timestamp,
      };

      expect(() => jobFailedEventSchema.parse(event)).toThrow();
    });

    it('should reject missing failedAt', () => {
      const event = {
        jobId: validUUID,
        error: { message: 'Error' },
      };

      expect(() => jobFailedEventSchema.parse(event)).toThrow();
    });
  });
});

// ============================================================================
// Tests: jobCancelledEventSchema
// ============================================================================

describe('jobCancelledEventSchema', () => {
  describe('valid payloads', () => {
    it('should accept valid cancelled event with reason', () => {
      const event = {
        jobId: validUUID,
        reason: 'User requested cancellation',
        cancelledAt: timestamp,
      };

      const result = jobCancelledEventSchema.parse(event);

      expect(result.jobId).toBe(validUUID);
      expect(result.reason).toBe('User requested cancellation');
      expect(result.cancelledAt).toBe(timestamp);
    });

    it('should accept valid cancelled event without reason', () => {
      const event = {
        jobId: validUUID,
        cancelledAt: timestamp,
      };

      const result = jobCancelledEventSchema.parse(event);

      expect(result.jobId).toBe(validUUID);
      expect(result.reason).toBeUndefined();
    });
  });

  describe('invalid payloads', () => {
    it('should reject invalid UUID', () => {
      const event = {
        jobId: 'invalid',
        cancelledAt: timestamp,
      };

      expect(() => jobCancelledEventSchema.parse(event)).toThrow('UUID');
    });

    it('should reject missing cancelledAt', () => {
      const event = {
        jobId: validUUID,
        reason: 'Test',
      };

      expect(() => jobCancelledEventSchema.parse(event)).toThrow();
    });
  });
});

// ============================================================================
// Tests: jobEventsSchema (combined)
// ============================================================================

describe('jobEventsSchema', () => {
  it('should contain all four event types', () => {
    expect(jobEventsSchema['job.progress']).toBeDefined();
    expect(jobEventsSchema['job.completed']).toBeDefined();
    expect(jobEventsSchema['job.failed']).toBeDefined();
    expect(jobEventsSchema['job.cancelled']).toBeDefined();
  });

  it('should have exactly four event types', () => {
    const keys = Object.keys(jobEventsSchema);
    expect(keys).toHaveLength(4);
  });

  it('should use correct event names', () => {
    const keys = Object.keys(jobEventsSchema);
    expect(keys).toContain('job.progress');
    expect(keys).toContain('job.completed');
    expect(keys).toContain('job.failed');
    expect(keys).toContain('job.cancelled');
  });
});

// ============================================================================
// Tests: Type Inference
// ============================================================================

describe('Type Inference', () => {
  it('should infer JobProgressEvent type correctly', () => {
    const event: JobProgressEvent = {
      jobId: validUUID,
      percent: 50,
      message: 'Test',
      timestamp,
    };

    // Type assertion test - if this compiles, types are correct
    expect(event.jobId).toBe(validUUID);
    expect(event.percent).toBe(50);
    expect(event.message).toBe('Test');
    expect(event.timestamp).toBe(timestamp);
  });

  it('should infer JobCompletedEvent type correctly', () => {
    const event: JobCompletedEvent = {
      jobId: validUUID,
      result: { success: true },
      completedAt: timestamp,
    };

    expect(event.jobId).toBe(validUUID);
    expect(event.result).toEqual({ success: true });
    expect(event.completedAt).toBe(timestamp);
  });

  it('should infer JobFailedEvent type correctly', () => {
    const event: JobFailedEvent = {
      jobId: validUUID,
      error: { message: 'Error', code: 'ERR' },
      failedAt: timestamp,
    };

    expect(event.jobId).toBe(validUUID);
    expect(event.error.message).toBe('Error');
    expect(event.error.code).toBe('ERR');
    expect(event.failedAt).toBe(timestamp);
  });

  it('should infer JobCancelledEvent type correctly', () => {
    const event: JobCancelledEvent = {
      jobId: validUUID,
      reason: 'Cancelled',
      cancelledAt: timestamp,
    };

    expect(event.jobId).toBe(validUUID);
    expect(event.reason).toBe('Cancelled');
    expect(event.cancelledAt).toBe(timestamp);
  });

  it('should allow JobEvent union type', () => {
    const events: JobEvent[] = [
      { jobId: validUUID, percent: 50, timestamp },
      { jobId: validUUID, result: null, completedAt: timestamp },
      { jobId: validUUID, error: { message: 'Err' }, failedAt: timestamp },
      { jobId: validUUID, cancelledAt: timestamp },
    ];

    expect(events).toHaveLength(4);
  });

  it('should infer JobEventName type correctly', () => {
    const eventNames: JobEventName[] = [
      'job.progress',
      'job.completed',
      'job.failed',
      'job.cancelled',
    ];

    expect(eventNames).toHaveLength(4);
  });
});

// ============================================================================
// Tests: Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  it('should handle very long message strings', () => {
    const longMessage = 'a'.repeat(10000);
    const event = {
      jobId: validUUID,
      percent: 50,
      message: longMessage,
      timestamp,
    };

    const result = jobProgressEventSchema.parse(event);
    expect(result.message).toBe(longMessage);
  });

  it('should handle decimal percentages', () => {
    const event = {
      jobId: validUUID,
      percent: 50.5,
      timestamp,
    };

    const result = jobProgressEventSchema.parse(event);
    expect(result.percent).toBe(50.5);
  });

  it('should handle large timestamps', () => {
    const futureTimestamp = Date.now() + 1000000000;
    const event = {
      jobId: validUUID,
      percent: 50,
      timestamp: futureTimestamp,
    };

    const result = jobProgressEventSchema.parse(event);
    expect(result.timestamp).toBe(futureTimestamp);
  });

  it('should handle complex result objects', () => {
    const complexResult = {
      nested: {
        deeply: {
          value: [1, 2, { key: 'value' }],
        },
      },
      array: [1, 'two', null, undefined],
      date: new Date().toISOString(),
    };

    const event = {
      jobId: validUUID,
      result: complexResult,
      completedAt: timestamp,
    };

    const result = jobCompletedEventSchema.parse(event);
    expect(result.result).toEqual(complexResult);
  });
});
