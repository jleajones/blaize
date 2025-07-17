import { ValidationError } from './validation-error';
import { ErrorType } from '../index';

import type { ValidationErrorDetails } from '../index';

// Mock the correlation system
vi.mock('./correlation', () => ({
  getCurrentCorrelationId: vi.fn().mockReturnValue('test-correlation-123'),
}));

describe('ValidationError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    test('creates ValidationError with correct type and status', () => {
      const error = new ValidationError('Validation failed');

      expect(error).toBeInstanceOf(ValidationError);
      expect(error).toBeInstanceOf(Error);
      expect(error.type).toBe(ErrorType.VALIDATION_ERROR);
      expect(error.status).toBe(400);
      expect(error.title).toBe('Validation failed');
      expect(error.name).toBe('ValidationError');
    });

    test('uses current correlation ID when not provided', () => {
      const error = new ValidationError('Validation failed');

      expect(error.correlationId).toBe('test-correlation-123');
    });

    test('accepts custom correlation ID', () => {
      const customCorrelationId = 'custom-correlation-456';
      const error = new ValidationError('Validation failed', undefined, customCorrelationId);

      expect(error.correlationId).toBe(customCorrelationId);
    });

    test('handles undefined details gracefully', () => {
      const error = new ValidationError('Validation failed');

      expect(error.details).toBeUndefined();
    });

    test('preserves validation details when provided', () => {
      const validationDetails: ValidationErrorDetails = {
        fields: [
          {
            field: 'email',
            messages: ['Email is required', 'Email must be valid'],
            rejectedValue: '',
            expectedType: 'string',
          },
          {
            field: 'password',
            messages: ['Password must be at least 8 characters'],
            rejectedValue: '123',
            expectedType: 'string',
          },
        ],
        errorCount: 2,
        section: 'body',
        schemaName: 'UserRegistration',
      };

      const error = new ValidationError('Validation failed', validationDetails);

      expect(error.details).toEqual(validationDetails);
    });

    test('sets timestamp to current date', () => {
      const beforeCreation = new Date();
      const error = new ValidationError('Validation failed');
      const afterCreation = new Date();

      expect(error.timestamp.getTime()).toBeGreaterThanOrEqual(beforeCreation.getTime());
      expect(error.timestamp.getTime()).toBeLessThanOrEqual(afterCreation.getTime());
    });
  });

  describe('inheritance and error properties', () => {
    test('inherits from BlaizeError correctly', () => {
      const error = new ValidationError('Validation failed');

      // Should have all BlaizeError properties
      expect(error.type).toBeDefined();
      expect(error.title).toBeDefined();
      expect(error.status).toBeDefined();
      expect(error.correlationId).toBeDefined();
      expect(error.timestamp).toBeDefined();
    });

    test('extends Error correctly', () => {
      const error = new ValidationError('Validation failed');

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Validation failed');
      expect(error.stack).toBeDefined();
    });

    test('can be caught as BlaizeError', () => {
      const error = new ValidationError('Validation failed');

      expect(() => {
        throw error;
      }).toThrow('Validation failed');
    });

    test('preserves error stack trace', () => {
      const error = new ValidationError('Validation failed');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('ValidationError');
      expect(error.stack).toContain('Validation failed');
    });
  });

  describe('toJSON serialization', () => {
    test('serializes to proper HTTP response format', () => {
      const error = new ValidationError('Validation failed');
      const serialized = error.toJSON();

      expect(serialized).toEqual({
        type: ErrorType.VALIDATION_ERROR,
        title: 'Validation failed',
        status: 400,
        correlationId: 'test-correlation-123',
        timestamp: error.timestamp.toISOString(),
      });
    });

    test('includes details in serialization when present', () => {
      const validationDetails: ValidationErrorDetails = {
        fields: [
          {
            field: 'email',
            messages: ['Email is required'],
            rejectedValue: null,
            expectedType: 'string',
          },
        ],
        errorCount: 1,
        section: 'body',
      };

      const error = new ValidationError('Validation failed', validationDetails);
      const serialized = error.toJSON();

      expect(serialized).toEqual({
        type: ErrorType.VALIDATION_ERROR,
        title: 'Validation failed',
        status: 400,
        correlationId: 'test-correlation-123',
        timestamp: error.timestamp.toISOString(),
        details: validationDetails,
      });
    });

    test('omits details from serialization when undefined', () => {
      const error = new ValidationError('Validation failed');
      const serialized = error.toJSON();

      expect(serialized).not.toHaveProperty('details');
      expect(Object.keys(serialized)).toEqual([
        'type',
        'title',
        'status',
        'correlationId',
        'timestamp',
      ]);
    });
  });

  describe('toString method', () => {
    test('returns formatted string representation', () => {
      const error = new ValidationError('Validation failed');
      const stringRep = error.toString();

      expect(stringRep).toBe('ValidationError: Validation failed [test-correlation-123]');
    });

    test('includes correlation ID in string representation', () => {
      const customCorrelationId = 'custom-corr-789';
      const error = new ValidationError('Validation failed', undefined, customCorrelationId);
      const stringRep = error.toString();

      expect(stringRep).toContain(customCorrelationId);
      expect(stringRep).toBe(`ValidationError: Validation failed [${customCorrelationId}]`);
    });
  });

  describe('field-level error information', () => {
    test('preserves field-level validation errors correctly', () => {
      const fieldErrors: ValidationErrorDetails = {
        fields: [
          {
            field: 'user.profile.email',
            messages: ['Invalid email format', 'Email already exists'],
            rejectedValue: 'invalid-email',
            expectedType: 'email',
          },
          {
            field: 'user.profile.age',
            messages: ['Age must be between 13 and 120'],
            rejectedValue: 5,
            expectedType: 'number',
          },
        ],
        errorCount: 2,
        section: 'body',
        schemaName: 'UserProfileUpdate',
      };

      const error = new ValidationError('Profile validation failed', fieldErrors);

      expect(error.details?.fields).toHaveLength(2);
      expect(error.details?.fields[0]!.field).toBe('user.profile.email');
      expect(error.details?.fields[0]!.messages).toEqual([
        'Invalid email format',
        'Email already exists',
      ]);
      expect(error.details?.fields[1]!.rejectedValue).toBe(5);
      expect(error.details?.errorCount).toBe(2);
    });

    test('handles multiple validation sections', () => {
      const queryValidationError = new ValidationError('Query validation failed', {
        fields: [
          {
            field: 'limit',
            messages: ['Limit must be a positive number'],
            rejectedValue: -1,
            expectedType: 'number',
          },
        ],
        errorCount: 1,
        section: 'query',
      });

      expect(queryValidationError.details?.section).toBe('query');
    });
  });

  describe('integration with error handling', () => {
    test('can be thrown and caught properly', () => {
      expect(() => {
        throw new ValidationError('Test validation error');
      }).toThrow(ValidationError);

      expect(() => {
        throw new ValidationError('Test validation error');
      }).toThrow('Test validation error');
    });

    test('maintains correlation ID when thrown across async boundaries', async () => {
      const error = new ValidationError('Async validation error');

      await expect(async () => {
        await new Promise(resolve => setTimeout(resolve, 1));
        throw error;
      }).rejects.toThrow(ValidationError);

      // Error should maintain its correlation ID
      expect(error.correlationId).toBe('test-correlation-123');
    });
  });
});
