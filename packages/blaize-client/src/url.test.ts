import { buildUrl } from "./url";
const TEST_BASE_URL = "https://api.example.com";
const TEST_BASE_USER_URL = "https://api.example.com/users";


describe('buildUrl', () => {
  describe('basic URL construction', () => {
    it('should build URL with base and path only', () => {
      const result = buildUrl(TEST_BASE_URL, '/users');
      expect(result).toBe(TEST_BASE_USER_URL);
    });

    it('should handle base URL without trailing slash', () => {
      const result = buildUrl(TEST_BASE_URL, '/users');
      expect(result).toBe(TEST_BASE_USER_URL);
    });

    it('should handle base URL with trailing slash', () => {
      const result = buildUrl('https://api.example.com/', '/users');
      expect(result).toBe(TEST_BASE_USER_URL);
    });
  });

  describe('path parameter replacement', () => {
    it('should replace single parameter', () => {
      const result = buildUrl(TEST_BASE_URL, '/users/:userId', {
        params: { userId: '123' }
      });
      expect(result).toBe('https://api.example.com/users/123');
    });

    it('should replace multiple parameters', () => {
      const result = buildUrl(TEST_BASE_URL, '/users/:userId/posts/:postId', {
        params: { userId: '123', postId: '456' }
      });
      expect(result).toBe('https://api.example.com/users/123/posts/456');
    });

    it('should URL encode parameter values', () => {
      const result = buildUrl(TEST_BASE_URL, '/users/:name', {
        params: { name: 'john doe' }
      });
      expect(result).toBe('https://api.example.com/users/john%20doe');
    });

    it('should handle special characters in parameters', () => {
      const result = buildUrl(TEST_BASE_URL, '/search/:query', {
        params: { query: 'hello@world.com' }
      });
      expect(result).toBe('https://api.example.com/search/hello%40world.com');
    });

    it('should leave unused parameters in URL unchanged', () => {
      const result = buildUrl(TEST_BASE_URL, '/users/:userId/posts/:postId', {
        params: { userId: '123' }
      });
      expect(result).toBe('https://api.example.com/users/123/posts/:postId');
    });

    it('should ignore extra parameters not in path', () => {
      const result = buildUrl(TEST_BASE_URL, '/users/:userId', {
        params: { userId: '123', extraParam: 'ignored' }
      });
      expect(result).toBe('https://api.example.com/users/123');
    });
  });

  describe('query parameter handling', () => {
    it('should add single query parameter', () => {
      const result = buildUrl(TEST_BASE_URL, '/users', {
        query: { limit: '10' }
      });
      expect(result).toBe('https://api.example.com/users?limit=10');
    });

    it('should add multiple query parameters', () => {
      const result = buildUrl(TEST_BASE_URL, '/users', {
        query: { limit: '10', offset: '20' }
      });
      expect(result).toBe('https://api.example.com/users?limit=10&offset=20');
    });

    it('should URL encode query parameter values', () => {
      const result = buildUrl(TEST_BASE_URL, '/search', {
        query: { q: 'hello world' }
      });
      expect(result).toBe('https://api.example.com/search?q=hello+world');
    });

    it('should skip undefined query parameters', () => {
      const result = buildUrl(TEST_BASE_URL, '/users', {
        query: { limit: '10', offset: undefined }
      });
      expect(result).toBe('https://api.example.com/users?limit=10');
    });

    it('should skip null query parameters', () => {
      const result = buildUrl(TEST_BASE_URL, '/users', {
        query: { limit: '10', offset: null }
      });
      expect(result).toBe('https://api.example.com/users?limit=10');
    });

    it('should convert non-string query values to strings', () => {
      const result = buildUrl(TEST_BASE_URL, '/users', {
        query: { limit: 10, active: true }
      });
      expect(result).toBe('https://api.example.com/users?limit=10&active=true');
    });
  });

  describe('combined parameters and query', () => {
    it('should handle both path parameters and query parameters', () => {
      const result = buildUrl(TEST_BASE_URL, '/users/:userId/posts', {
        params: { userId: '123' },
        query: { limit: '10', sort: 'desc' }
      });
      expect(result).toBe('https://api.example.com/users/123/posts?limit=10&sort=desc');
    });
  });

  describe('edge cases', () => {
    it('should handle empty args object', () => {
      const result = buildUrl(TEST_BASE_URL, '/users', {});
      expect(result).toBe('https://api.example.com/users');
    });

    it('should handle undefined args', () => {
      const result = buildUrl(TEST_BASE_URL, '/users');
      expect(result).toBe(TEST_BASE_USER_URL);
    });

    it('should handle empty params object', () => {
      const result = buildUrl(TEST_BASE_URL, '/users/:userId', {
        params: {}
      });
      expect(result).toBe('https://api.example.com/users/:userId');
    });

    it('should handle empty query object', () => {
      const result = buildUrl(TEST_BASE_URL, '/users', {
        query: {}
      });
      expect(result).toBe(TEST_BASE_USER_URL);
    });
  });
});