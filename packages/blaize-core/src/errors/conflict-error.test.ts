/**
 * Tests for remaining server-side error classes
 */

import { ErrorType } from '../index';
import { ConflictError } from './conflict-error';

// Mock the correlation system
vi.mock('./correlation', () => ({
  getCurrentCorrelationId: vi.fn().mockReturnValue('test-correlation-common'),
}));

describe('ConflictError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('creates ConflictError with correct properties', () => {
    const error = new ConflictError('Resource conflict');

    expect(error).toBeInstanceOf(ConflictError);
    expect(error.type).toBe(ErrorType.CONFLICT);
    expect(error.status).toBe(409);
    expect(error.title).toBe('Resource conflict');
    expect(error.correlationId).toBe('test-correlation-common');
  });

  test('accepts conflict details', () => {
    const conflictDetails = {
      conflictType: 'duplicate_key',
      field: 'email',
      existingValue: 'user@example.com',
      conflictingResource: 'user-456',
      resolution: 'Use a different email address',
    };

    const error = new ConflictError('Email already exists', conflictDetails);

    expect(error.details).toEqual(conflictDetails);
  });

  test('serializes correctly to JSON', () => {
    const error = new ConflictError('Version conflict');
    const serialized = error.toJSON();

    expect(serialized.type).toBe(ErrorType.CONFLICT);
    expect(serialized.status).toBe(409);
    expect(serialized.title).toBe('Version conflict');
  });
});
