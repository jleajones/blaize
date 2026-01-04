/**
 * Tests for EventValidationError
 *
 * Verifies error creation, serialization, and edge cases.
 *
 * Location: packages/blaize-core/src/errors/event-validation-error.test.ts
 */

import { ErrorType } from '@blaize-types/errors';
import { z } from 'zod';

import { EventValidationError } from './event-validation-error';

import type { EventValidationErrorDetails } from '@blaize-types/errors';

describe('EventValidationError', () => {
  let correlationId: string;

  beforeEach(() => {
    correlationId = 'test-correlation-id';
  });

  describe('Construction', () => {
    it('should create error with all fields', () => {
      const zodError = new z.ZodError([
        {
          code: z.ZodIssueCode.invalid_type,
          expected: 'string',
          received: 'number',
          path: ['userId'],
          message: 'Expected string, received number',
        },
      ]);

      const details: EventValidationErrorDetails = {
        eventType: 'user:created',
        context: 'publish',
        zodError,
        data: { userId: 123 },
      };

      const error = new EventValidationError('Validation failed', details, correlationId);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(EventValidationError);
      expect(error.name).toBe('EventValidationError');
      expect(error.message).toBe('Validation failed');
      expect(error.type).toBe(ErrorType.VALIDATION_ERROR);
      expect(error.status).toBe(400);
      expect(error.correlationId).toBe(correlationId);
      expect(error.details).toEqual(details);
      expect(error.timestamp).toBeInstanceOf(Date);
    });

    it('should auto-generate correlationId if not provided', () => {
      const details: EventValidationErrorDetails = {
        eventType: 'user:created',
        context: 'publish',
      };

      const error = new EventValidationError('Validation failed', details);

      expect(error.correlationId).toBeDefined();
      expect(error.correlationId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it('should work with publish context', () => {
      const details: EventValidationErrorDetails = {
        eventType: 'order:placed',
        context: 'publish',
      };

      const error = new EventValidationError('Validation failed', details, correlationId);

      expect(error.details?.context).toBe('publish');
    });

    it('should work with receive context', () => {
      const details: EventValidationErrorDetails = {
        eventType: 'order:placed',
        context: 'receive',
      };

      const error = new EventValidationError('Validation failed', details, correlationId);

      expect(error.details?.context).toBe('receive');
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing optional fields', () => {
      const details: EventValidationErrorDetails = {
        eventType: 'system:ready',
        context: 'publish',
      };

      const error = new EventValidationError('Validation failed', details, correlationId);

      expect(error.details?.zodError).toBeUndefined();
      expect(error.details?.data).toBeUndefined();
    });

    it('should handle Zod error with very long path', () => {
      const longPath = [
        'user',
        'profile',
        'settings',
        'notifications',
        'email',
        'preferences',
        'frequency',
      ];
      const zodError = new z.ZodError([
        {
          code: z.ZodIssueCode.invalid_type,
          expected: 'string',
          received: 'number',
          path: longPath,
          message: 'Invalid type',
        },
      ]);

      const details: EventValidationErrorDetails = {
        eventType: 'user:settings:updated',
        context: 'publish',
        zodError,
      };

      const error = new EventValidationError('Validation failed', details, correlationId);

      expect(error.details?.zodError).toBeDefined();
      expect(error.details?.zodError?.issues[0]!.path).toEqual(longPath);
    });

    it('should handle data that cannot be JSON serialized', () => {
      const circularRef: any = { name: 'test' };
      circularRef.self = circularRef;

      const details: EventValidationErrorDetails = {
        eventType: 'test:event',
        context: 'publish',
        data: circularRef,
      };

      const error = new EventValidationError('Validation failed', details, correlationId);

      // The error should be created successfully
      expect(error.details?.data).toBeDefined();

      // toJSON should handle the circular reference safely
      const json = error.toJSON();
      expect(json).toBeDefined();
      if ('details' in json) {
        expect(json.details.data).toBeDefined();
      }
    });

    it('should handle undefined data', () => {
      const details: EventValidationErrorDetails = {
        eventType: 'test:event',
        context: 'publish',
        data: undefined,
      };

      const error = new EventValidationError('Validation failed', details, correlationId);

      expect(error.details?.data).toBeUndefined();
    });

    it('should handle null data', () => {
      const details: EventValidationErrorDetails = {
        eventType: 'test:event',
        context: 'publish',
        data: null,
      };

      const error = new EventValidationError('Validation failed', details, correlationId);

      expect(error.details?.data).toBeNull();
    });

    it('should handle multiple Zod validation errors', () => {
      const zodError = new z.ZodError([
        {
          code: z.ZodIssueCode.invalid_type,
          expected: 'string',
          received: 'number',
          path: ['userId'],
          message: 'Expected string, received number',
        },
        {
          code: z.ZodIssueCode.invalid_string,
          validation: 'email',
          path: ['email'],
          message: 'Invalid email format',
        },
        {
          code: z.ZodIssueCode.too_small,
          minimum: 8,
          type: 'string',
          inclusive: true,
          path: ['password'],
          message: 'String must contain at least 8 characters',
        },
      ]);

      const details: EventValidationErrorDetails = {
        eventType: 'user:created',
        context: 'publish',
        zodError,
      };

      const error = new EventValidationError('Validation failed', details, correlationId);

      expect(error.details?.zodError?.issues).toHaveLength(3);
    });
  });

  describe('Serialization', () => {
    it('should serialize to JSON without zodError', () => {
      const details: EventValidationErrorDetails = {
        eventType: 'user:created',
        context: 'publish',
        data: { userId: '123' },
      };

      const error = new EventValidationError('Validation failed', details, correlationId);
      const json = error.toJSON();

      expect(json).toEqual({
        type: ErrorType.VALIDATION_ERROR,
        title: 'Validation failed',
        status: 400,
        correlationId,
        timestamp: error.timestamp.toISOString(),
        details: {
          eventType: 'user:created',
          context: 'publish',
          data: { userId: '123' },
        },
      });
    });

    it('should serialize to JSON with zodError', () => {
      const zodError = new z.ZodError([
        {
          code: z.ZodIssueCode.invalid_type,
          expected: 'string',
          received: 'number',
          path: ['userId'],
          message: 'Expected string, received number',
        },
      ]);

      const details: EventValidationErrorDetails = {
        eventType: 'user:created',
        context: 'publish',
        zodError,
        data: { userId: 123 },
      };

      const error = new EventValidationError('Validation failed', details, correlationId);
      const json = error.toJSON();

      expect(json).toEqual({
        type: ErrorType.VALIDATION_ERROR,
        title: 'Validation failed',
        status: 400,
        correlationId,
        timestamp: error.timestamp.toISOString(),
        details: {
          eventType: 'user:created',
          context: 'publish',
          errors: [
            {
              path: 'userId',
              message: 'Expected string, received number',
              code: 'invalid_type',
            },
          ],
          data: { userId: 123 },
        },
      });
    });

    it('should serialize zodError with nested paths', () => {
      const zodError = new z.ZodError([
        {
          code: z.ZodIssueCode.invalid_type,
          expected: 'string',
          received: 'number',
          path: ['user', 'profile', 'name'],
          message: 'Invalid type',
        },
      ]);

      const details: EventValidationErrorDetails = {
        eventType: 'user:updated',
        context: 'publish',
        zodError,
      };

      const error = new EventValidationError('Validation failed', details, correlationId);
      const json = error.toJSON();

      if ('details' in json) {
        expect(json.details.errors).toEqual([
          {
            path: 'user.profile.name',
            message: 'Invalid type',
            code: 'invalid_type',
          },
        ]);
      }
    });

    it('should serialize without data if not provided', () => {
      const details: EventValidationErrorDetails = {
        eventType: 'user:created',
        context: 'publish',
      };

      const error = new EventValidationError('Validation failed', details, correlationId);
      const json = error.toJSON();

      expect('details' in json).toBe(true);
      if ('details' in json) {
        expect(json.details).toEqual({
          eventType: 'user:created',
          context: 'publish',
        });
        expect(json.details.data).toBeUndefined();
      }
    });

    it('should be JSON-stringifiable', () => {
      const zodError = new z.ZodError([
        {
          code: z.ZodIssueCode.invalid_type,
          expected: 'string',
          received: 'number',
          path: ['userId'],
          message: 'Expected string, received number',
        },
      ]);

      const details: EventValidationErrorDetails = {
        eventType: 'user:created',
        context: 'publish',
        zodError,
        data: { userId: 123 },
      };

      const error = new EventValidationError('Validation failed', details, correlationId);

      // Should not throw
      expect(() => JSON.stringify(error)).not.toThrow();

      const jsonString = JSON.stringify(error);
      const parsed = JSON.parse(jsonString);

      expect(parsed.type).toBe(ErrorType.VALIDATION_ERROR);
      expect(parsed.details.eventType).toBe('user:created');
    });
  });

  describe('toString()', () => {
    it('should include event type and context', () => {
      const details: EventValidationErrorDetails = {
        eventType: 'user:created',
        context: 'publish',
      };

      const error = new EventValidationError('Validation failed', details, correlationId);
      const str = error.toString();

      expect(str).toBe(
        "EventValidationError: Validation failed for 'user:created' during publish [test-correlation-id]"
      );
    });

    it('should work without event type', () => {
      const details: EventValidationErrorDetails = {
        eventType: '',
        context: 'publish',
      };

      const error = new EventValidationError('Validation failed', details, correlationId);
      const str = error.toString();

      expect(str).toContain('EventValidationError: Validation failed');
      expect(str).toContain('during publish');
      expect(str).toContain('[test-correlation-id]');
    });

    it('should be useful for debugging', () => {
      const details: EventValidationErrorDetails = {
        eventType: 'order:placed',
        context: 'receive',
      };

      const error = new EventValidationError('Invalid order data', details, correlationId);
      const str = error.toString();

      expect(str).toContain('order:placed');
      expect(str).toContain('receive');
      expect(str).toContain('Invalid order data');
    });
  });

  describe('Inheritance', () => {
    it('should be instanceof Error', () => {
      const details: EventValidationErrorDetails = {
        eventType: 'user:created',
        context: 'publish',
      };

      const error = new EventValidationError('Validation failed', details, correlationId);

      expect(error instanceof Error).toBe(true);
    });

    it('should have correct prototype chain', () => {
      const details: EventValidationErrorDetails = {
        eventType: 'user:created',
        context: 'publish',
      };

      const error = new EventValidationError('Validation failed', details, correlationId);

      expect(Object.getPrototypeOf(error).constructor.name).toBe('EventValidationError');
    });

    it('should have stack trace', () => {
      const details: EventValidationErrorDetails = {
        eventType: 'user:created',
        context: 'publish',
      };

      const error = new EventValidationError('Validation failed', details, correlationId);

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('EventValidationError');
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle publish validation failure', () => {
      const schema = z.object({
        userId: z.string().uuid(),
        email: z.string().email(),
      });

      const invalidData = {
        userId: 'not-a-uuid',
        email: 'invalid-email',
      };

      const result = schema.safeParse(invalidData);
      expect(result.success).toBe(false);

      if (!result.success) {
        const details: EventValidationErrorDetails = {
          eventType: 'user:created',
          context: 'publish',
          zodError: result.error,
          data: invalidData,
        };

        const error = new EventValidationError('Event validation failed', details, correlationId);

        expect(error.details?.zodError?.issues.length).toBeGreaterThan(0);
        expect(error.details?.context).toBe('publish');
      }
    });

    it('should handle receive validation failure', () => {
      const schema = z.object({
        orderId: z.string(),
        total: z.number().positive(),
      });

      const invalidData = {
        orderId: '123',
        total: -100, // Invalid: not positive
      };

      const result = schema.safeParse(invalidData);
      expect(result.success).toBe(false);

      if (!result.success) {
        const details: EventValidationErrorDetails = {
          eventType: 'order:placed',
          context: 'receive',
          zodError: result.error,
          data: invalidData,
        };

        const error = new EventValidationError('Received invalid event', details, correlationId);

        expect(error.details?.context).toBe('receive');
        const json = error.toJSON();
        if ('details' in json) {
          expect(json.details.errors).toBeDefined();
        }
      }
    });

    it('should handle unknown event type', () => {
      const details: EventValidationErrorDetails = {
        eventType: 'unknown:event:type',
        context: 'publish',
        data: { some: 'data' },
      };

      const error = new EventValidationError('Unknown event type', details, correlationId);

      expect(error.details?.eventType).toBe('unknown:event:type');
      expect(error.details?.zodError).toBeUndefined();
    });
  });
});
