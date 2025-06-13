import { createMatcher } from './matcher';

import type { RouteMethodOptions } from '../../index';

describe('Route Matcher', () => {
  let matcher: ReturnType<typeof createMatcher>;

  beforeEach(() => {
    matcher = createMatcher();
  });

  describe('Route Registration (add method)', () => {
    test('should add a simple route', () => {
      const routeOptions: RouteMethodOptions = {
        handler: async () => ({ message: 'Hello' }),
      };

      // This should not throw
      expect(() => {
        matcher.add('/users', 'GET', routeOptions);
      }).not.toThrow();

      // Verify the route was added
      const routes = matcher.getRoutes();
      expect(routes).toHaveLength(1);
      expect(routes[0]).toEqual({
        path: '/users',
        method: 'GET',
      });
    });

    test('should add multiple routes with different methods', () => {
      const getOptions: RouteMethodOptions = {
        handler: async () => ({ users: [] }),
      };
      const postOptions: RouteMethodOptions = {
        handler: async () => ({ created: true }),
      };

      matcher.add('/users', 'GET', getOptions);
      matcher.add('/users', 'POST', postOptions);
      matcher.add('/users/:id', 'DELETE', getOptions);

      const routes = matcher.getRoutes();
      expect(routes).toHaveLength(3);

      // Verify all routes are present
      expect(routes).toContainEqual({ path: '/users', method: 'GET' });
      expect(routes).toContainEqual({ path: '/users', method: 'POST' });
      expect(routes).toContainEqual({ path: '/users/:id', method: 'DELETE' });
    });

    test('should handle parameterized routes', () => {
      const routeOptions: RouteMethodOptions = {
        handler: async () => ({}),
      };

      matcher.add('/users/:id', 'GET', routeOptions);
      matcher.add('/users/:id/posts/:postId', 'GET', routeOptions);

      const routes = matcher.getRoutes();
      expect(routes).toHaveLength(2);
      expect(routes).toContainEqual({ path: '/users/:id', method: 'GET' });
      expect(routes).toContainEqual({ path: '/users/:id/posts/:postId', method: 'GET' });
    });
  });

  describe('Route Matching (match method)', () => {
    const mockRouteOptions: RouteMethodOptions = {
      handler: async () => ({ success: true }),
    };

    beforeEach(() => {
      // Set up common routes for matching tests
      matcher.add('/users', 'GET', mockRouteOptions);
      matcher.add('/users', 'POST', mockRouteOptions);
      matcher.add('/users/:id', 'GET', mockRouteOptions);
      matcher.add('/users/:id/posts/:postId', 'GET', mockRouteOptions);
      matcher.add('/api/v1/health', 'GET', mockRouteOptions);
    });

    test('should match exact static routes', () => {
      const result = matcher.match('/users', 'GET');

      expect(result).not.toBeNull();
      expect(result!.route).toBe(mockRouteOptions);
      expect(result!.params).toEqual({});
    });

    test('should match parameterized routes and extract parameters', () => {
      const result = matcher.match('/users/123', 'GET');

      expect(result).not.toBeNull();
      expect(result!.route).toBe(mockRouteOptions);
      expect(result!.params).toEqual({ id: '123' });
    });

    test('should match complex parameterized routes', () => {
      const result = matcher.match('/users/123/posts/456', 'GET');

      expect(result).not.toBeNull();
      expect(result!.route).toBe(mockRouteOptions);
      expect(result!.params).toEqual({
        id: '123',
        postId: '456',
      });
    });

    test('should match routes with special characters in parameters', () => {
      const result = matcher.match('/users/user-123_test', 'GET');

      expect(result).not.toBeNull();
      expect(result!.params).toEqual({ id: 'user-123_test' });
    });

    test('should return null for non-existent routes', () => {
      const result = matcher.match('/nonexistent', 'GET');
      expect(result).toBeNull();
    });

    test('should be case-sensitive for paths', () => {
      const result = matcher.match('/USERS', 'GET');
      expect(result).toBeNull();
    });

    test('should match the most specific route first', () => {
      // Add a more specific route
      const specificOptions: RouteMethodOptions = {
        handler: async () => ({ specific: true }),
      };
      matcher.add('/users/admin', 'GET', specificOptions);

      // Test that /users/admin matches the specific route, not /users/:id
      const adminResult = matcher.match('/users/admin', 'GET');
      expect(adminResult!.route).toBe(specificOptions);

      // Test that /users/123 still matches the parameterized route
      const paramResult = matcher.match('/users/123', 'GET');
      expect(paramResult!.route).toBe(mockRouteOptions);
      expect(paramResult!.params).toEqual({ id: '123' });
    });
  });

  describe('HTTP Method Handling', () => {
    const mockRouteOptions: RouteMethodOptions = {
      handler: async () => ({}),
    };

    beforeEach(() => {
      matcher.add('/users', 'GET', mockRouteOptions);
      matcher.add('/users', 'POST', mockRouteOptions);
      matcher.add('/users/:id', 'PUT', mockRouteOptions);
    });

    test('should match correct HTTP method', () => {
      const getResult = matcher.match('/users', 'GET');
      const postResult = matcher.match('/users', 'POST');

      expect(getResult).not.toBeNull();
      expect(postResult).not.toBeNull();
      expect(getResult!.route).toBe(mockRouteOptions);
      expect(postResult!.route).toBe(mockRouteOptions);
    });

    test('should detect method not allowed (405)', () => {
      const result = matcher.match('/users', 'DELETE');

      expect(result).not.toBeNull();
      expect(result!.route).toBeNull();
      expect(result!.methodNotAllowed).toBe(true);
      expect(result!.allowedMethods).toContain('GET');
      expect(result!.allowedMethods).toContain('POST');
      expect(result!.allowedMethods).not.toContain('DELETE');
    });

    test('should return allowed methods for parameterized routes', () => {
      const result = matcher.match('/users/123', 'DELETE');

      expect(result).not.toBeNull();
      expect(result!.methodNotAllowed).toBe(true);
      expect(result!.allowedMethods).toContain('PUT');
    });

    test('should return null for completely unknown paths (404)', () => {
      const result = matcher.match('/completely/unknown/path', 'GET');
      expect(result).toBeNull();
    });
  });

  describe('Route Listing (getRoutes method)', () => {
    test('should return empty array when no routes registered', () => {
      const routes = matcher.getRoutes();
      expect(routes).toEqual([]);
    });

    test('should return all registered routes', () => {
      const routeOptions: RouteMethodOptions = {
        handler: async () => ({}),
      };

      matcher.add('/users', 'GET', routeOptions);
      matcher.add('/users', 'POST', routeOptions);
      matcher.add('/posts/:id', 'DELETE', routeOptions);

      const routes = matcher.getRoutes();
      expect(routes).toHaveLength(3);

      // Check that all routes are returned (order doesn't matter)
      expect(routes).toContainEqual({ path: '/users', method: 'GET' });
      expect(routes).toContainEqual({ path: '/users', method: 'POST' });
      expect(routes).toContainEqual({ path: '/posts/:id', method: 'DELETE' });
    });

    test('should not modify original routes when returned array is modified', () => {
      const routeOptions: RouteMethodOptions = {
        handler: async () => ({}),
      };

      matcher.add('/users', 'GET', routeOptions);

      const routes = matcher.getRoutes();
      routes.push({ path: '/fake', method: 'POST' });

      // Original should be unchanged
      const routesAgain = matcher.getRoutes();
      expect(routesAgain).toHaveLength(1);
    });
  });

  describe('Route Finding (findRoutes method)', () => {
    const mockRouteOptions: RouteMethodOptions = {
      handler: async () => ({}),
    };

    beforeEach(() => {
      matcher.add('/users', 'GET', mockRouteOptions);
      matcher.add('/users', 'POST', mockRouteOptions);
      matcher.add('/users/:id', 'PUT', mockRouteOptions);
      matcher.add('/users/:id', 'DELETE', mockRouteOptions);
      matcher.add('/posts/:id', 'GET', mockRouteOptions);
    });

    test('should find all routes matching a static path', () => {
      const routes = matcher.findRoutes('/users');

      expect(routes).toHaveLength(2);
      expect(routes).toContainEqual({
        path: '/users',
        method: 'GET',
        params: {},
      });
      expect(routes).toContainEqual({
        path: '/users',
        method: 'POST',
        params: {},
      });
    });

    test('should find routes matching parameterized path', () => {
      const routes = matcher.findRoutes('/users/123');

      expect(routes).toHaveLength(2);
      expect(routes).toContainEqual({
        path: '/users/:id',
        method: 'PUT',
        params: { id: '123' },
      });
      expect(routes).toContainEqual({
        path: '/users/:id',
        method: 'DELETE',
        params: { id: '123' },
      });
    });

    test('should return empty array for non-matching paths', () => {
      const routes = matcher.findRoutes('/nonexistent');
      expect(routes).toEqual([]);
    });

    test('should extract parameters correctly for found routes', () => {
      const routes = matcher.findRoutes('/posts/456');

      expect(routes).toHaveLength(1);
      expect(routes[0]).toEqual({
        path: '/posts/:id',
        method: 'GET',
        params: { id: '456' },
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    const mockRouteOptions: RouteMethodOptions = {
      handler: async () => ({}),
    };

    test('should handle empty path', () => {
      matcher.add('/', 'GET', mockRouteOptions);

      const result = matcher.match('/', 'GET');
      expect(result).not.toBeNull();
      expect(result!.params).toEqual({});
    });

    test('should handle paths with trailing slashes', () => {
      matcher.add('/users/', 'GET', mockRouteOptions);

      const result = matcher.match('/users/', 'GET');
      expect(result).not.toBeNull();
    });

    test('should handle paths with query parameters', () => {
      matcher.add('/users', 'GET', mockRouteOptions);

      // Note: Query parameters should typically be stripped before matching
      // This test verifies current behavior
      const result = matcher.match('/users?page=1&limit=10', 'GET');
      expect(result).not.toBeNull();
      expect(result!.route).toBe(mockRouteOptions);
      expect(result!.params).toEqual({});
    });

    test('should handle special characters in static paths', () => {
      matcher.add('/api/v1.0/users-list', 'GET', mockRouteOptions);

      const result = matcher.match('/api/v1.0/users-list', 'GET');
      expect(result).not.toBeNull();
    });

    test('should handle multiple consecutive parameters', () => {
      matcher.add('/users/:userId/posts/:postId/comments/:commentId', 'GET', mockRouteOptions);

      const result = matcher.match('/users/1/posts/2/comments/3', 'GET');
      expect(result).not.toBeNull();
      expect(result!.params).toEqual({
        userId: '1',
        postId: '2',
        commentId: '3',
      });
    });
  });

  describe('Performance and Scale', () => {
    const mockRouteOptions: RouteMethodOptions = {
      handler: async () => ({}),
    };

    test('should handle many routes efficiently', () => {
      // Add 100 routes
      for (let i = 0; i < 100; i++) {
        matcher.add(`/route${i}`, 'GET', mockRouteOptions);
        matcher.add(`/route${i}/:id`, 'POST', mockRouteOptions);
      }

      const routes = matcher.getRoutes();
      expect(routes).toHaveLength(200);

      // Should still match efficiently
      const result = matcher.match('/route50', 'GET');
      expect(result).not.toBeNull();

      const paramResult = matcher.match('/route75/123', 'POST');
      expect(paramResult).not.toBeNull();
      expect(paramResult!.params).toEqual({ id: '123' });
    });
  });
});
