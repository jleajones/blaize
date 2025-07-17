/**
 * Tests for remaining server-side error classes
 */

import { ErrorType } from '../index';
import { InternalServerError } from './internal-server-error';

// Mock the correlation system
vi.mock('./correlation', () => ({
  getCurrentCorrelationId: vi.fn().mockReturnValue('test-correlation-common'),
}));

describe('InternalServerError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('creates InternalServerError with correct properties', () => {
    const error = new InternalServerError('Something went wrong');

    expect(error).toBeInstanceOf(InternalServerError);
    expect(error.type).toBe(ErrorType.INTERNAL_SERVER_ERROR);
    expect(error.status).toBe(500);
    expect(error.title).toBe('Something went wrong');
    expect(error.correlationId).toBe('test-correlation-common');
  });

  test('accepts error details for debugging', () => {
    const errorDetails = {
      originalError: 'Database connection failed',
      stackTrace: 'Error: Connection timeout...',
      component: 'database-service',
      operation: 'user-lookup',
      timestamp: new Date('2024-01-01T10:00:00Z'),
    };

    const error = new InternalServerError('Database error', errorDetails);

    expect(error.details).toEqual(errorDetails);
    expect(error.details?.component).toBe('database-service');
    expect(error.details?.operation).toBe('user-lookup');
  });

  test('serializes correctly to JSON', () => {
    const error = new InternalServerError('Internal error');
    const serialized = error.toJSON();

    expect(serialized.type).toBe(ErrorType.INTERNAL_SERVER_ERROR);
    expect(serialized.status).toBe(500);
    expect(serialized.title).toBe('Internal error');
  });

  test('handles production vs development details', () => {
    const debugDetails = {
      stackTrace: 'Very detailed stack trace...',
      internalErrorCode: 'DB_CONN_001',
      sensitiveData: 'should not be exposed',
    };

    const error = new InternalServerError('Database error', debugDetails);

    // In production, sensitive details should be filtered out by error boundary
    // But the error class itself stores all details for logging
    expect(error.details?.stackTrace).toBeDefined();
    expect(error.details?.internalErrorCode).toBeDefined();
  });
});
