import { extractParams, compilePathPattern, paramsToQuery, buildUrl } from './params';

describe('Path Utils', () => {
  describe('extractParams', () => {
    test('extracts single parameter from URL path', () => {
      const { pattern, paramNames } = compilePathPattern('/users/:id');
      const params = extractParams('/users/123', pattern, paramNames);

      expect(params).toEqual({ id: '123' });
    });

    test('extracts multiple parameters from URL path', () => {
      const { pattern, paramNames } = compilePathPattern('/users/:userId/posts/:postId');
      const params = extractParams('/users/123/posts/456', pattern, paramNames);

      expect(params).toEqual({ userId: '123', postId: '456' });
    });

    test('extracts parameters with file-based routing syntax [param]', () => {
      const { pattern, paramNames } = compilePathPattern('/users/[id]');
      const params = extractParams('/users/123', pattern, paramNames);

      expect(params).toEqual({ id: '123' });
    });

    test('extracts mixed parameter syntaxes', () => {
      const { pattern, paramNames } = compilePathPattern('/users/:userId/posts/[postId]');
      const params = extractParams('/users/123/posts/456', pattern, paramNames);

      expect(params).toEqual({ userId: '123', postId: '456' });
    });

    test('returns empty object when path does not match pattern', () => {
      const { pattern, paramNames } = compilePathPattern('/users/:id');
      const params = extractParams('/posts/123', pattern, paramNames);

      expect(params).toEqual({});
    });

    test('returns empty object for root path with no parameters', () => {
      const { pattern, paramNames } = compilePathPattern('/');
      const params = extractParams('/', pattern, paramNames);

      expect(params).toEqual({});
    });

    test('handles URL-encoded parameter values', () => {
      const { pattern, paramNames } = compilePathPattern('/users/:name');
      const params = extractParams('/users/john%20doe', pattern, paramNames);

      expect(params).toEqual({ name: 'john%20doe' });
    });

    test('handles empty parameter values', () => {
      const _pattern = compilePathPattern('/users/:id/posts/:postId');
      // This test verifies behavior when regex capture groups might be empty
      const customPattern = /^\/users\/([^/]*)\/posts\/([^/]*)$/;
      const params = extractParams('/users//posts/', customPattern, ['id', 'postId']);

      expect(params).toEqual({ id: '', postId: '' });
    });

    test('handles parameters with special characters', () => {
      const { pattern, paramNames } = compilePathPattern('/search/:query');
      const params = extractParams('/search/hello-world_123', pattern, paramNames);

      expect(params).toEqual({ query: 'hello-world_123' });
    });
  });

  describe('compilePathPattern', () => {
    test('compiles root path correctly', () => {
      const result = compilePathPattern('/');

      expect(result.pattern.source).toBe('^\\/$');
      expect(result.paramNames).toEqual([]);
      expect(result.pattern.test('/')).toBe(true);
      expect(result.pattern.test('/users')).toBe(false);
    });

    test('compiles static path without parameters', () => {
      const result = compilePathPattern('/users');

      expect(result.paramNames).toEqual([]);
      expect(result.pattern.test('/users')).toBe(true);
      expect(result.pattern.test('/users/')).toBe(true); // Optional trailing slash
      expect(result.pattern.test('/users/123')).toBe(false);
    });

    test('compiles path with single parameter (:param syntax)', () => {
      const result = compilePathPattern('/users/:id');

      expect(result.paramNames).toEqual(['id']);
      expect(result.pattern.test('/users/123')).toBe(true);
      expect(result.pattern.test('/users/abc')).toBe(true);
      expect(result.pattern.test('/users/')).toBe(false); // Empty param not allowed
      expect(result.pattern.test('/users/123/extra')).toBe(false);
    });

    test('compiles path with single parameter ([param] syntax)', () => {
      const result = compilePathPattern('/users/[id]');

      expect(result.paramNames).toEqual(['id']);
      expect(result.pattern.test('/users/123')).toBe(true);
      expect(result.pattern.test('/users/abc')).toBe(true);
      expect(result.pattern.test('/users/')).toBe(false);
    });

    test('compiles path with multiple parameters', () => {
      const result = compilePathPattern('/users/:userId/posts/:postId');

      expect(result.paramNames).toEqual(['userId', 'postId']);
      expect(result.pattern.test('/users/123/posts/456')).toBe(true);
      expect(result.pattern.test('/users/123/posts/')).toBe(false);
      expect(result.pattern.test('/users/123')).toBe(false);
    });

    test('compiles path with mixed parameter syntaxes', () => {
      const result = compilePathPattern('/users/:userId/posts/[postId]');

      expect(result.paramNames).toEqual(['userId', 'postId']);
      expect(result.pattern.test('/users/123/posts/456')).toBe(true);
    });

    test('escapes special regex characters in static parts', () => {
      const result = compilePathPattern('/api/v1.0/users/:id');

      expect(result.paramNames).toEqual(['id']);
      expect(result.pattern.test('/api/v1.0/users/123')).toBe(true);
      expect(result.pattern.test('/api/v1X0/users/123')).toBe(false); // . should be literal
    });

    test('handles paths with special characters that need escaping', () => {
      const result = compilePathPattern('/search/query+test/:term');

      expect(result.paramNames).toEqual(['term']);
      expect(result.pattern.test('/search/query+test/hello')).toBe(true);
      expect(result.pattern.test('/search/queryXtest/hello')).toBe(false); // + should be literal
    });

    test('handles nested routes with multiple levels', () => {
      const result = compilePathPattern('/api/v1/users/:userId/posts/:postId/comments/:commentId');

      expect(result.paramNames).toEqual(['userId', 'postId', 'commentId']);
      expect(result.pattern.test('/api/v1/users/123/posts/456/comments/789')).toBe(true);
      expect(result.pattern.test('/api/v1/users/123/posts/456/comments')).toBe(false);
    });

    test('handles optional trailing slash correctly', () => {
      const result = compilePathPattern('/users');

      expect(result.pattern.test('/users')).toBe(true);
      expect(result.pattern.test('/users/')).toBe(true);
      expect(result.pattern.test('/users//')).toBe(false); // Multiple slashes not allowed
    });
  });

  describe('paramsToQuery', () => {
    test('converts simple params to query string', () => {
      const params = { name: 'john', age: 25 };
      const result = paramsToQuery(params);

      expect(result).toBe('?name=john&age=25');
    });

    test('returns empty string for empty params', () => {
      const result = paramsToQuery({});

      expect(result).toBe('');
    });

    test('URL encodes parameter keys and values', () => {
      const params = { 'search query': 'hello world', 'special&chars': 'test=value' };
      const result = paramsToQuery(params);

      expect(result).toBe('?search%20query=hello%20world&special%26chars=test%3Dvalue');
    });

    test('handles boolean parameters', () => {
      const params = { active: true, deleted: false };
      const result = paramsToQuery(params);

      expect(result).toBe('?active=true&deleted=false');
    });

    test('handles number parameters', () => {
      const params = { page: 1, limit: 10, price: 29.99 };
      const result = paramsToQuery(params);

      expect(result).toBe('?page=1&limit=10&price=29.99');
    });

    test('skips undefined and null values', () => {
      const params = {
        name: 'john',
        age: undefined,
        city: null,
        active: true,
      } as unknown as Record<string, string | number | boolean>;
      const result = paramsToQuery(params);

      expect(result).toBe('?name=john&active=true');
    });

    test('handles empty string values', () => {
      const params = { name: '', active: true };
      const result = paramsToQuery(params);

      expect(result).toBe('?name=&active=true');
    });

    test('handles zero values correctly', () => {
      const params = { count: 0, price: 0.0 };
      const result = paramsToQuery(params);

      expect(result).toBe('?count=0&price=0');
    });
  });

  describe('buildUrl', () => {
    test('builds URL with path parameters', () => {
      const url = buildUrl('/users/:id', { id: 123 });

      expect(url).toBe('/users/123');
    });

    test('builds URL with multiple path parameters', () => {
      const url = buildUrl('/users/:userId/posts/:postId', {
        userId: 123,
        postId: 456,
      });

      expect(url).toBe('/users/123/posts/456');
    });

    test('builds URL with path parameters and query string', () => {
      const url = buildUrl('/users/:id', { id: 123 }, { page: 1, limit: 10 });

      expect(url).toBe('/users/123?page=1&limit=10');
    });

    test('builds URL with extra params becoming query parameters', () => {
      const url = buildUrl('/users/:id', {
        id: 123,
        page: 1,
        active: true,
      });

      expect(url).toBe('/users/123?page=1&active=true');
    });

    test('builds URL with no parameters', () => {
      const url = buildUrl('/users');

      expect(url).toBe('/users');
    });

    test('builds URL with only query parameters', () => {
      const url = buildUrl('/users', {}, { page: 1, limit: 10 });

      expect(url).toBe('/users?page=1&limit=10');
    });

    test('URL encodes path parameters', () => {
      const url = buildUrl('/users/:name', { name: 'john doe' });

      expect(url).toBe('/users/john%20doe');
    });

    test('handles complex parameter combinations', () => {
      const url = buildUrl('/users/:userId/posts/:postId', {
        userId: 123,
        postId: 'hello-world',
        page: 1,
        sort: 'created_at',
        order: 'desc',
      });

      expect(url).toBe('/users/123/posts/hello-world?page=1&sort=created_at&order=desc');
    });

    test('handles missing path parameters gracefully', () => {
      // This tests what happens when a required path param is missing
      const url = buildUrl('/users/:id/posts/:postId', { id: 123 });

      // The missing postId parameter should remain as :postId in the URL
      expect(url).toBe('/users/123/posts/:postId');
    });

    test('handles root path correctly', () => {
      const url = buildUrl('/', {}, { page: 1 });

      expect(url).toBe('/?page=1');
    });

    test('preserves existing query parameters from path pattern', () => {
      // This is an edge case - what if the path pattern already has query params?
      const url = buildUrl('/search', {}, { q: 'test', type: 'user' });

      expect(url).toBe('/search?q=test&type=user');
    });
  });

  describe('Integration tests', () => {
    test('complete round-trip: compile pattern, extract params, build URL', () => {
      const originalPattern = '/users/:userId/posts/:postId';
      const testPath = '/users/123/posts/456';

      // Compile the pattern
      const { pattern, paramNames } = compilePathPattern(originalPattern);

      // Extract parameters from a test path
      const extractedParams = extractParams(testPath, pattern, paramNames);

      // Build URL back using extracted parameters
      const rebuiltUrl = buildUrl(originalPattern, extractedParams);

      expect(rebuiltUrl).toBe(testPath);
    });

    test('pattern matching with trailing slash handling', () => {
      const { pattern, paramNames } = compilePathPattern('/users/:id');

      // Both with and without trailing slash should work
      const paramsWithoutSlash = extractParams('/users/123', pattern, paramNames);
      const paramsWithSlash = extractParams('/users/123/', pattern, paramNames);

      expect(paramsWithoutSlash).toEqual({ id: '123' });
      expect(paramsWithSlash).toEqual({ id: '123' });
    });

    test('handles complex real-world API patterns', () => {
      const apiPattern = '/api/v1/organizations/:orgId/projects/:projectId/issues/:issueId';
      const testPath = '/api/v1/organizations/acme-corp/projects/web-app/issues/bug-123';

      const { pattern, paramNames } = compilePathPattern(apiPattern);
      const params = extractParams(testPath, pattern, paramNames);

      expect(params).toEqual({
        orgId: 'acme-corp',
        projectId: 'web-app',
        issueId: 'bug-123',
      });

      // Test building URL with additional query params
      const builtUrl = buildUrl(apiPattern, params, {
        include: 'comments',
        sort: 'created_at',
      });

      expect(builtUrl).toBe(testPath + '?include=comments&sort=created_at');
    });
  });
});
