/**
 * Tests for Unauthorized server-side error classes
 */

import { ErrorType } from '@blaize-types/errors';

import { UnauthorizedError } from './unauthorized-error';

// Mock the correlation system
vi.mock('./correlation', () => ({
  getCurrentCorrelationId: vi.fn().mockReturnValue('test-correlation-common'),
}));

describe('UnauthorizedError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('creates UnauthorizedError with correct properties', () => {
    const error = new UnauthorizedError('Authentication required');

    expect(error).toBeInstanceOf(UnauthorizedError);
    expect(error.type).toBe(ErrorType.UNAUTHORIZED);
    expect(error.status).toBe(401);
    expect(error.title).toBe('Authentication required');
    expect(error.correlationId).toBe('test-correlation-common');
  });

  test('accepts authentication details', () => {
    const authDetails = {
      reason: 'invalid_token',
      authScheme: 'Bearer',
      realm: 'api',
      error_description: 'Token has expired',
    };

    const error = new UnauthorizedError('Token expired', authDetails);

    expect(error.details).toEqual(authDetails);
  });

  test('serializes correctly to JSON', () => {
    const error = new UnauthorizedError('Invalid credentials');
    const serialized = error.toJSON();

    expect(serialized.type).toBe(ErrorType.UNAUTHORIZED);
    expect(serialized.status).toBe(401);
    expect(serialized.title).toBe('Invalid credentials');
  });
});
