import { createRouteTree } from './tree';

import type { RouteMethodOptions } from '@blaize-types/router';

// Mock handler for testing
const createMockHandler = (name: string): RouteMethodOptions => ({
  handler: async () => ({ message: `${name} handler` }),
  middleware: [],
  schema: {},
});

describe('Route Tree', () => {
  describe('Basic Route Addition', () => {
    test('should add and match simple routes', () => {
      const tree = createRouteTree();
      const homeHandler = createMockHandler('home');
      const usersHandler = createMockHandler('users');
      const productsHandler = createMockHandler('create-product');

      tree.add('/', 'GET', homeHandler);
      tree.add('/users', 'GET', usersHandler);
      tree.add('/products', 'POST', productsHandler);

      // Test root route
      const rootMatch = tree.match('/', 'GET');
      expect(rootMatch).not.toBeNull();
      expect(rootMatch).toEqual({
        handler: homeHandler,
        params: {},
      });

      // Test /users route
      const usersMatch = tree.match('/users', 'GET');
      expect(usersMatch).not.toBeNull();
      expect(usersMatch?.handler).toEqual(usersHandler);
      expect(usersMatch?.params).toEqual({});

      // Test /products POST
      const productsMatch = tree.match('/products', 'POST');
      expect(productsMatch).not.toBeNull();
      expect(productsMatch?.handler).toEqual(productsHandler);
    });

    test('should handle routes without leading slash', () => {
      const tree = createRouteTree();
      const handler = createMockHandler('users');

      tree.add('users', 'GET', handler);

      const match = tree.match('/users', 'GET');
      expect(match?.handler).toEqual(handler);
      expect(match?.params).toEqual({});
    });

    test('should handle multiple HTTP methods for same path', () => {
      const tree = createRouteTree();
      const getHandler = createMockHandler('get-users');
      const postHandler = createMockHandler('create-user');

      tree.add('/users', 'GET', getHandler);
      tree.add('/users', 'POST', postHandler);

      const getMatch = tree.match('/users', 'GET');
      expect(getMatch?.handler).toEqual(getHandler);

      const postMatch = tree.match('/users', 'POST');
      expect(postMatch?.handler).toEqual(postHandler);
    });
  });

  describe('Parameter Routes', () => {
    test('should match parameter routes', () => {
      const tree = createRouteTree();
      const handler = createMockHandler('user-by-id');

      tree.add('/users/:id', 'GET', handler);

      const match = tree.match('/users/123', 'GET');
      expect(match?.handler).toEqual(handler);
      expect(match?.params).toEqual({ id: '123' });
    });

    test('should handle different parameter names on same path level', () => {
      const tree = createRouteTree();
      const userHandler = createMockHandler('get-user');
      const userPostsHandler = createMockHandler('get-user-posts');

      // Same path structure but different parameter names
      tree.add('/users/:id', 'GET', userHandler);
      tree.add('/users/:userId/posts', 'GET', userPostsHandler);

      const userMatch = tree.match('/users/123', 'GET');
      expect(userMatch?.params).toEqual({ id: '123' });
      expect(userMatch?.handler).toEqual(userHandler);

      const postsMatch = tree.match('/users/456/posts', 'GET');
      expect(postsMatch?.params).toEqual({ userId: '456' });
      expect(postsMatch?.handler).toEqual(userPostsHandler);
    });

    test('should match multiple parameters', () => {
      const tree = createRouteTree();
      const handler = createMockHandler('user-post');

      tree.add('/users/:userId/posts/:postId', 'GET', handler);

      const match = tree.match('/users/456/posts/789', 'GET');
      expect(match?.handler).toEqual(handler);
      expect(match?.params).toEqual({
        userId: '456',
        postId: '789',
      });
    });

    test('should handle mixed static and parameter segments', () => {
      const tree = createRouteTree();
      const handler = createMockHandler('user-settings');

      tree.add('/users/:id/settings', 'GET', handler);

      const match = tree.match('/users/123/settings', 'GET');
      expect(match?.handler).toEqual(handler);
      expect(match?.params).toEqual({ id: '123' });
    });

    test('should prioritize exact matches over parameters', () => {
      const tree = createRouteTree();
      const exactHandler = createMockHandler('exact-admin');
      const paramHandler = createMockHandler('param-user');

      tree.add('/users/admin', 'GET', exactHandler);
      tree.add('/users/:id', 'GET', paramHandler);

      const exactMatch = tree.match('/users/admin', 'GET');
      expect(exactMatch?.handler).toEqual(exactHandler);

      const paramMatch = tree.match('/users/123', 'GET');
      expect(paramMatch?.handler).toEqual(paramHandler);
      expect(paramMatch?.params).toEqual({ id: '123' });
    });
  });

  describe('Wildcard Routes', () => {
    test('should match wildcard routes', () => {
      const tree = createRouteTree();
      const handler = createMockHandler('catch-all');

      tree.add('/api/*', 'GET', handler);

      const match = tree.match('/api/v1/users/123/posts', 'GET');
      expect(match?.handler).toEqual(handler);
      expect(match?.params).toEqual({
        '*': 'v1/users/123/posts',
      });
    });

    test('should handle wildcard at root level', () => {
      const tree = createRouteTree();
      const handler = createMockHandler('root-catch-all');

      tree.add('/*', 'GET', handler);

      const match = tree.match('/anything/goes/here', 'GET');
      expect(match?.handler).toEqual(handler);
      expect(match?.params).toEqual({
        '*': 'anything/goes/here',
      });
    });

    test('should match single segment with wildcard', () => {
      const tree = createRouteTree();
      const handler = createMockHandler('static-catch-all');

      tree.add('/static/*', 'GET', handler);

      const match = tree.match('/static/image.png', 'GET');
      expect(match?.handler).toEqual(handler);
      expect(match?.params).toEqual({
        '*': 'image.png',
      });
    });
  });

  describe('Route Precedence', () => {
    test('should prioritize exact > parameter > wildcard', () => {
      const tree = createRouteTree();
      const exactHandler = createMockHandler('exact');
      const paramHandler = createMockHandler('param');
      const wildcardHandler = createMockHandler('wildcard');

      tree.add('/users/admin', 'GET', exactHandler);
      tree.add('/users/:id', 'GET', paramHandler);
      tree.add('/users/*', 'GET', wildcardHandler);

      // Exact match should win
      const exactMatch = tree.match('/users/admin', 'GET');
      expect(exactMatch?.handler).toEqual(exactHandler);

      // Parameter should win over wildcard
      const paramMatch = tree.match('/users/123', 'GET');
      expect(paramMatch?.handler).toEqual(paramHandler);
      expect(paramMatch?.params).toEqual({ id: '123' });

      // Wildcard should catch multi-segment paths
      const wildcardMatch = tree.match('/users/123/extra/segments', 'GET');
      expect(wildcardMatch?.handler).toEqual(wildcardHandler);
      expect(wildcardMatch?.params).toEqual({
        '*': '123/extra/segments',
      });
    });
  });

  describe('No Match Scenarios', () => {
    test('should return null for unmatched routes', () => {
      const tree = createRouteTree();
      tree.add('/users', 'GET', createMockHandler('users'));

      const match = tree.match('/posts', 'GET');
      expect(match).toBeNull();
    });

    test('should return null for wrong HTTP method', () => {
      const tree = createRouteTree();
      tree.add('/users', 'GET', createMockHandler('get-users'));

      const match = tree.match('/users', 'POST');
      expect(match).toBeNull();
    });

    test('should return null for partial path matches', () => {
      const tree = createRouteTree();
      tree.add('/users/settings', 'GET', createMockHandler('user-settings'));

      const match = tree.match('/users', 'GET');
      expect(match).toBeNull();
    });

    test('should return null for over-matched paths', () => {
      const tree = createRouteTree();
      tree.add('/users', 'GET', createMockHandler('users'));

      const match = tree.match('/users/extra', 'GET');
      expect(match).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty segments gracefully', () => {
      const tree = createRouteTree();
      const handler = createMockHandler('users');

      tree.add('/users', 'GET', handler);

      // Test path with double slashes
      const match = tree.match('//users', 'GET');
      expect(match?.handler).toEqual(handler);
    });

    test('should handle trailing slashes', () => {
      const tree = createRouteTree();
      const handler = createMockHandler('users');

      tree.add('/users/', 'GET', handler);

      const match = tree.match('/users', 'GET');
      expect(match?.handler).toEqual(handler);
    });

    test('should handle parameter names correctly', () => {
      const tree = createRouteTree();
      const handler = createMockHandler('user-by-complex-id');

      tree.add('/users/:user_id', 'GET', handler);

      const match = tree.match('/users/user-123-abc', 'GET');
      expect(match?.handler).toEqual(handler);
      expect(match?.params).toEqual({ user_id: 'user-123-abc' });
    });
  });

  describe('Complex Routing Scenarios', () => {
    test('should handle nested API structure', () => {
      const tree = createRouteTree();
      const listUsersHandler = createMockHandler('list-users');
      const getUserHandler = createMockHandler('get-user');
      const updateUserHandler = createMockHandler('update-user');
      const userPostsHandler = createMockHandler('user-posts');
      const getPostHandler = createMockHandler('get-post');
      const apiFallbackHandler = createMockHandler('api-fallback');

      // Add various API routes
      tree.add('/api/v1/users', 'GET', listUsersHandler);
      tree.add('/api/v1/users/:id', 'GET', getUserHandler);
      tree.add('/api/v1/users/:id', 'PUT', updateUserHandler);
      tree.add('/api/v1/users/:userId/posts', 'GET', userPostsHandler);
      tree.add('/api/v1/users/:userId/posts/:postId', 'GET', getPostHandler);
      tree.add('/api/*', 'GET', apiFallbackHandler);

      // Test various matches
      const listUsers = tree.match('/api/v1/users', 'GET');
      expect(listUsers?.handler).toEqual(listUsersHandler);

      const getUser = tree.match('/api/v1/users/123', 'GET');
      expect(getUser?.handler).toEqual(getUserHandler);
      expect(getUser?.params).toEqual({ id: '123' });

      const updateUser = tree.match('/api/v1/users/123', 'PUT');
      expect(updateUser?.handler).toEqual(updateUserHandler);

      const userPosts = tree.match('/api/v1/users/456/posts', 'GET');
      expect(userPosts?.handler).toEqual(userPostsHandler);
      expect(userPosts?.params).toEqual({ userId: '456' });

      const getPost = tree.match('/api/v1/users/456/posts/789', 'GET');
      expect(getPost?.handler).toEqual(getPostHandler);
      expect(getPost?.params).toEqual({ userId: '456', postId: '789' });

      // Test fallback
      const fallback = tree.match('/api/v2/new-endpoint', 'GET');
      expect(fallback?.handler).toEqual(apiFallbackHandler);
      expect(fallback?.params).toEqual({ '*': 'v2/new-endpoint' });
    });

    test('should handle file serving patterns', () => {
      const tree = createRouteTree();

      tree.add('/static/*', 'GET', createMockHandler('serve-static'));
      tree.add('/uploads/:userId/*', 'GET', createMockHandler('serve-user-uploads'));

      const staticFile = tree.match('/static/css/main.css', 'GET');
      expect(staticFile?.params).toEqual({ '*': 'css/main.css' });

      const userUpload = tree.match('/uploads/123/documents/report.pdf', 'GET');
      expect(userUpload?.params).toEqual({
        userId: '123',
        '*': 'documents/report.pdf',
      });
    });
  });

  describe('Performance and Memory', () => {
    test('should handle large number of routes efficiently', () => {
      const isCI = process.env.CI === 'true';
      const threshold = isCI ? 200 : 100;
      const tree = createRouteTree();
      const startTime = performance.now();

      // Add many routes
      for (let i = 0; i < 1000; i++) {
        tree.add(`/route${i}`, 'GET', createMockHandler(`handler-${i}`));
        tree.add(`/route${i}/:param`, 'GET', createMockHandler(`param-handler-${i}`));
      }

      const addTime = performance.now() - startTime;
      expect(addTime).toBeLessThan(threshold); // Should be fast

      // Test matching performance
      const matchStartTime = performance.now();
      const match = tree.match('/route500/test-param', 'GET');
      const matchTime = performance.now() - matchStartTime;

      expect(match?.params).toEqual({ param: 'test-param' });
      expect(matchTime).toBeLessThan(10); // Should be very fast
    });
  });
});
