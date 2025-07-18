/**
 * Tests for remaining server-side error classes
 */

import { ErrorType } from '@blaize-types/errors';

import { RateLimitError } from './rate-limit-error';

// Mock the correlation system
vi.mock('./correlation', () => ({
  getCurrentCorrelationId: vi.fn().mockReturnValue('test-correlation-common'),
}));

describe('RateLimitError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('creates RateLimitError with correct properties', () => {
    const error = new RateLimitError('Rate limit exceeded');

    expect(error).toBeInstanceOf(RateLimitError);
    expect(error.type).toBe(ErrorType.RATE_LIMITED);
    expect(error.status).toBe(429);
    expect(error.title).toBe('Rate limit exceeded');
    expect(error.correlationId).toBe('test-correlation-common');
  });

  test('accepts rate limit details', () => {
    const rateLimitDetails = {
      limit: 100,
      remaining: 0,
      resetTime: new Date('2024-01-01T12:00:00Z'),
      retryAfter: 3600,
      window: 'hour',
      identifier: 'user-123',
    };

    const error = new RateLimitError('Too many requests', rateLimitDetails);

    expect(error.details).toEqual(rateLimitDetails);
    expect(error.details?.limit).toBe(100);
    expect(error.details?.retryAfter).toBe(3600);
  });

  test('serializes correctly to JSON', () => {
    const error = new RateLimitError('Rate limit hit');
    const serialized = error.toJSON();

    expect(serialized.type).toBe(ErrorType.RATE_LIMITED);
    expect(serialized.status).toBe(429);
    expect(serialized.title).toBe('Rate limit hit');
  });
});
