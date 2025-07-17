/**
 * Tests for remaining server-side error classes
 */

import { ErrorType } from '../index';
import { ForbiddenError } from './forbidden-error';

// Mock the correlation system
vi.mock('./correlation', () => ({
  getCurrentCorrelationId: vi.fn().mockReturnValue('test-correlation-common'),
}));

describe('ForbiddenError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('creates ForbiddenError with correct properties', () => {
    const error = new ForbiddenError('Access denied');

    expect(error).toBeInstanceOf(ForbiddenError);
    expect(error.type).toBe(ErrorType.FORBIDDEN);
    expect(error.status).toBe(403);
    expect(error.title).toBe('Access denied');
    expect(error.correlationId).toBe('test-correlation-common');
  });

  test('accepts permission details', () => {
    const permissionDetails = {
      requiredPermission: 'admin:read',
      userPermissions: ['user:read', 'user:write'],
      resource: 'admin-dashboard',
      action: 'view',
    };

    const error = new ForbiddenError('Insufficient permissions', permissionDetails);

    expect(error.details).toEqual(permissionDetails);
  });

  test('serializes correctly to JSON', () => {
    const error = new ForbiddenError('Access forbidden');
    const serialized = error.toJSON();

    expect(serialized.type).toBe(ErrorType.FORBIDDEN);
    expect(serialized.status).toBe(403);
    expect(serialized.title).toBe('Access forbidden');
  });
});
