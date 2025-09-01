import { ErrorType } from '@blaize-types/errors';

import { NotFoundError } from './not-found-error';

// Mock the correlation system
vi.mock('../tracing/correlation', () => ({
  getCurrentCorrelationId: vi.fn().mockReturnValue('test-correlation-404'),
}));

describe('NotFoundError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    test('creates NotFoundError with correct type and status', () => {
      const error = new NotFoundError('Resource not found');

      expect(error).toBeInstanceOf(NotFoundError);
      expect(error).toBeInstanceOf(Error);
      expect(error.type).toBe(ErrorType.NOT_FOUND);
      expect(error.status).toBe(404);
      expect(error.title).toBe('Resource not found');
      expect(error.name).toBe('NotFoundError');
    });

    test('uses current correlation ID when not provided', () => {
      const error = new NotFoundError('User not found');

      expect(error.correlationId).toBe('test-correlation-404');
    });

    test('accepts custom correlation ID', () => {
      const customCorrelationId = 'custom-404-correlation';
      const error = new NotFoundError('User not found', undefined, customCorrelationId);

      expect(error.correlationId).toBe(customCorrelationId);
    });

    test('handles undefined details gracefully', () => {
      const error = new NotFoundError('Resource not found');

      expect(error.details).toBeUndefined();
    });

    test('preserves resource details when provided', () => {
      const resourceDetails = {
        resourceType: 'User',
        resourceId: 'user-123',
        searchCriteria: { email: 'user@example.com' },
        suggestion: 'Check if the user ID is correct',
      };

      const error = new NotFoundError('User not found', resourceDetails);

      expect(error.details).toEqual(resourceDetails);
    });

    test('sets timestamp to current date', () => {
      const beforeCreation = new Date();
      const error = new NotFoundError('Resource not found');
      const afterCreation = new Date();

      expect(error.timestamp.getTime()).toBeGreaterThanOrEqual(beforeCreation.getTime());
      expect(error.timestamp.getTime()).toBeLessThanOrEqual(afterCreation.getTime());
    });
  });

  describe('inheritance and error properties', () => {
    test('inherits from BlaizeError correctly', () => {
      const error = new NotFoundError('Resource not found');

      expect(error.type).toBeDefined();
      expect(error.title).toBeDefined();
      expect(error.status).toBeDefined();
      expect(error.correlationId).toBeDefined();
      expect(error.timestamp).toBeDefined();
    });

    test('extends Error correctly', () => {
      const error = new NotFoundError('Resource not found');

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Resource not found');
      expect(error.stack).toBeDefined();
    });

    test('preserves error stack trace', () => {
      const error = new NotFoundError('Resource not found');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('NotFoundError');
      expect(error.stack).toContain('Resource not found');
    });
  });

  describe('toJSON serialization', () => {
    test('serializes to proper HTTP response format', () => {
      const error = new NotFoundError('User not found');
      const serialized = error.toJSON();

      expect(serialized).toEqual({
        type: ErrorType.NOT_FOUND,
        title: 'User not found',
        status: 404,
        correlationId: 'test-correlation-404',
        timestamp: error.timestamp.toISOString(),
      });
    });

    test('includes details in serialization when present', () => {
      const resourceDetails = {
        resourceType: 'Article',
        resourceId: 'article-456',
        attemptedPath: '/api/articles/456',
      };

      const error = new NotFoundError('Article not found', resourceDetails);
      const serialized = error.toJSON();

      expect(serialized).toEqual({
        type: ErrorType.NOT_FOUND,
        title: 'Article not found',
        status: 404,
        correlationId: 'test-correlation-404',
        timestamp: error.timestamp.toISOString(),
        details: resourceDetails,
      });
    });

    test('omits details from serialization when undefined', () => {
      const error = new NotFoundError('Resource not found');
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
      const error = new NotFoundError('User not found');
      const stringRep = error.toString();

      expect(stringRep).toBe('NotFoundError: User not found [test-correlation-404]');
    });

    test('includes correlation ID in string representation', () => {
      const customCorrelationId = 'custom-notfound-123';
      const error = new NotFoundError('Resource not found', undefined, customCorrelationId);
      const stringRep = error.toString();

      expect(stringRep).toContain(customCorrelationId);
      expect(stringRep).toBe(`NotFoundError: Resource not found [${customCorrelationId}]`);
    });
  });

  describe('resource context details', () => {
    test('preserves resource identification details', () => {
      const resourceContext = {
        resourceType: 'Product',
        resourceId: 'prod-789',
        collection: 'products',
        query: { slug: 'awesome-product' },
        suggestion: 'Try searching by product ID instead',
      };

      const error = new NotFoundError('Product not found', resourceContext);

      expect(error.details?.resourceType).toBe('Product');
      expect(error.details?.resourceId).toBe('prod-789');
      expect(error.details?.query).toEqual({ slug: 'awesome-product' });
      expect(error.details?.suggestion).toBe('Try searching by product ID instead');
    });

    test('handles nested resource paths', () => {
      const nestedResourceDetails = {
        resourceType: 'Comment',
        resourceId: 'comment-999',
        parentResource: {
          type: 'Post',
          id: 'post-123',
        },
        path: '/posts/123/comments/999',
      };

      const error = new NotFoundError('Comment not found', nestedResourceDetails);

      expect(error.details?.parentResource?.type).toBe('Post');
      expect(error.details?.parentResource?.id).toBe('post-123');
      expect(error.details?.path).toBe('/posts/123/comments/999');
    });
  });

  describe('common usage patterns', () => {
    test('simple resource not found', () => {
      const error = new NotFoundError('User not found');

      expect(error.status).toBe(404);
      expect(error.type).toBe(ErrorType.NOT_FOUND);
      expect(error.title).toBe('User not found');
    });

    test('resource not found with ID context', () => {
      const error = new NotFoundError('User not found', {
        resourceType: 'User',
        resourceId: 'user-123',
      });

      expect(error.details?.resourceType).toBe('User');
      expect(error.details?.resourceId).toBe('user-123');
    });

    test('API endpoint not found', () => {
      const error = new NotFoundError('Endpoint not found', {
        path: '/api/v1/unknown',
        method: 'GET',
        suggestion: 'Check the API documentation for available endpoints',
      });

      expect(error.details?.path).toBe('/api/v1/unknown');
      expect(error.details?.method).toBe('GET');
    });
  });

  describe('integration with error handling', () => {
    test('can be thrown and caught properly', () => {
      expect(() => {
        throw new NotFoundError('Test not found error');
      }).toThrow(NotFoundError);

      expect(() => {
        throw new NotFoundError('Test not found error');
      }).toThrow('Test not found error');
    });

    test('maintains correlation ID when thrown across async boundaries', async () => {
      const error = new NotFoundError('Async not found error');

      await expect(async () => {
        await new Promise(resolve => setTimeout(resolve, 1));
        throw error;
      }).rejects.toThrow(NotFoundError);

      expect(error.correlationId).toBe('test-correlation-404');
    });
  });
});
