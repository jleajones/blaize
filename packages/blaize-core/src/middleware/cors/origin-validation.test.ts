/**
 * Unit tests for origin validation module
 */

import {
  validateOrigin,
  validateCredentialsWithOrigin,
  setOriginCache,
  getCacheStats,
  resetOriginCache,
  prevalidateOrigins,
  cleanExpiredCacheEntries,
  startCacheCleanup,
} from './origin-validator';

import type { Context } from '@blaize-types/context';

describe('Origin Validator', () => {
  beforeEach(() => {
    // Reset cache before each test
    resetOriginCache();
    // Reset console mocks
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('validateOrigin', () => {
    describe('boolean origins', () => {
      test('should allow all origins when true', async () => {
        expect(await validateOrigin('https://example.com', true)).toBe(true);
        expect(await validateOrigin('http://localhost:3000', true)).toBe(true);
        expect(await validateOrigin('https://any-origin.com', true)).toBe(true);
      });

      test('should deny all origins when false', async () => {
        expect(await validateOrigin('https://example.com', false)).toBe(false);
        expect(await validateOrigin('http://localhost:3000', false)).toBe(false);
        expect(await validateOrigin('https://any-origin.com', false)).toBe(false);
      });

      test('boolean origins should not be cached', async () => {
        // Validate with boolean true
        await validateOrigin('https://example.com', true);
        await validateOrigin('https://example.com', true);

        // Cache should remain empty (booleans aren't cached)
        expect(getCacheStats().size).toBe(0);
      });
    });

    describe('string origins', () => {
      test('should match exact string origin', async () => {
        expect(await validateOrigin('https://example.com', 'https://example.com')).toBe(true);
        expect(await validateOrigin('https://other.com', 'https://example.com')).toBe(false);
      });

      test('should handle wildcard string', async () => {
        expect(await validateOrigin('https://example.com', '*')).toBe(true);
        expect(await validateOrigin('http://localhost', '*')).toBe(true);
      });

      test('should be case-sensitive for string matching', async () => {
        expect(await validateOrigin('https://Example.com', 'https://example.com')).toBe(false);
        expect(await validateOrigin('HTTPS://EXAMPLE.COM', 'https://example.com')).toBe(false);
      });

      test('should handle ports in origin strings', async () => {
        expect(await validateOrigin('https://example.com:3000', 'https://example.com:3000')).toBe(
          true
        );
        expect(await validateOrigin('https://example.com:3000', 'https://example.com:8080')).toBe(
          false
        );
        expect(await validateOrigin('https://example.com', 'https://example.com:3000')).toBe(false);
      });

      test('string origins should be cached', async () => {
        // First call
        await validateOrigin('https://example.com', 'https://example.com');
        expect(getCacheStats().size).toBe(1);

        // Second call - should use cache
        await validateOrigin('https://example.com', 'https://example.com');
        expect(getCacheStats().size).toBe(1); // Still just 1 entry
      });
    });

    describe('RegExp origins', () => {
      test('should match against regex pattern', async () => {
        const pattern = /^https:\/\/.*\.example\.com$/;
        expect(await validateOrigin('https://api.example.com', pattern)).toBe(true);
        expect(await validateOrigin('https://www.example.com', pattern)).toBe(true);
        expect(await validateOrigin('https://example.com', pattern)).toBe(false);
        expect(await validateOrigin('http://api.example.com', pattern)).toBe(false);
      });

      test('should handle complex regex patterns', async () => {
        const pattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
        expect(await validateOrigin('http://localhost', pattern)).toBe(true);
        expect(await validateOrigin('https://localhost:3000', pattern)).toBe(true);
        expect(await validateOrigin('http://127.0.0.1:8080', pattern)).toBe(true);
        expect(await validateOrigin('https://example.com', pattern)).toBe(false);
      });

      test('RegExp origins should be cached', async () => {
        const pattern = /^https:\/\/.*\.example\.com$/;

        // First call
        await validateOrigin('https://api.example.com', pattern);
        expect(getCacheStats().size).toBe(1);

        // Second call with same origin and pattern - should use cache
        await validateOrigin('https://api.example.com', pattern);
        expect(getCacheStats().size).toBe(1);

        // Different origin, same pattern - adds new cache entry
        await validateOrigin('https://www.example.com', pattern);
        expect(getCacheStats().size).toBe(2);
      });
    });

    describe('function origins', () => {
      test('should call sync validation function every time (no caching)', async () => {
        const validator = vi.fn((origin: string) => origin === 'https://example.com');

        expect(await validateOrigin('https://example.com', validator)).toBe(true);
        expect(await validateOrigin('https://example.com', validator)).toBe(true);
        expect(validator).toHaveBeenCalledTimes(2); // Called every time, no caching

        expect(await validateOrigin('https://different.com', validator)).toBe(false);
        expect(validator).toHaveBeenCalledTimes(3);
      });

      test('should call async validation function', async () => {
        const validator = vi.fn(async (origin: string) => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return origin === 'https://example.com';
        });

        expect(await validateOrigin('https://example.com', validator)).toBe(true);
        expect(await validateOrigin('https://different.com', validator)).toBe(false);
        expect(validator).toHaveBeenCalledTimes(2);
      });

      test('should pass context to validation function', async () => {
        const validator = vi.fn((origin: string, ctx?: Context<any, any>) => {
          return ctx?.state?.user?.role === 'admin';
        });

        const ctx = {
          state: { user: { id: '123', role: 'admin' } },
        } as Context<any, any>;

        expect(await validateOrigin('https://example.com', validator, ctx)).toBe(true);

        const userCtx = {
          state: { user: { id: '456', role: 'user' } },
        } as Context<any, any>;

        expect(await validateOrigin('https://example.com', validator, userCtx)).toBe(false);
      });

      test('should timeout slow validation functions', async () => {
        const slowValidator = async (_origin: string) => {
          await new Promise(resolve => setTimeout(resolve, 200));
          return true;
        };

        const start = Date.now();
        const result = await validateOrigin('https://example.com', slowValidator);
        const duration = Date.now() - start;

        expect(result).toBe(false); // Should deny on timeout
        expect(duration).toBeLessThan(150); // Should timeout at ~100ms
        expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('timed out'));
      });

      test('should handle function errors gracefully', async () => {
        const errorValidator = () => {
          throw new Error('Validation error');
        };

        expect(await validateOrigin('https://example.com', errorValidator)).toBe(false);
        expect(console.error).toHaveBeenCalledWith(
          'CORS origin validation function error:',
          expect.any(Error)
        );
      });

      test('function validators should not be cached', async () => {
        const validator = vi.fn(() => true);

        await validateOrigin('https://example.com', validator);
        await validateOrigin('https://example.com', validator);

        // Should be called twice (no caching for functions)
        expect(validator).toHaveBeenCalledTimes(2);

        // Cache should remain empty
        expect(getCacheStats().size).toBe(0);
      });
    });

    describe('array origins', () => {
      test('should match if any origin in array matches', async () => {
        const origins = ['https://app1.com', 'https://app2.com', /^https:\/\/.*\.dev\.com$/];

        expect(await validateOrigin('https://app1.com', origins)).toBe(true);
        expect(await validateOrigin('https://app2.com', origins)).toBe(true);
        expect(await validateOrigin('https://test.dev.com', origins)).toBe(true);
        expect(await validateOrigin('https://other.com', origins)).toBe(false);
      });

      test('should handle mixed types in array', async () => {
        const validator = (origin: string) => origin.includes('localhost');
        const origins = ['https://production.com', /^https:\/\/.*\.staging\.com$/, validator];

        expect(await validateOrigin('https://production.com', origins)).toBe(true);
        expect(await validateOrigin('https://api.staging.com', origins)).toBe(true);
        expect(await validateOrigin('http://localhost:3000', origins)).toBe(true);
        expect(await validateOrigin('https://unknown.com', origins)).toBe(false);
      });

      test('should process array validations in parallel', async () => {
        const callOrder: number[] = [];
        const createValidator = (delay: number, index: number) => async () => {
          await new Promise(resolve => setTimeout(resolve, delay));
          callOrder.push(index);
          return false;
        };

        const origins = [createValidator(30, 1), createValidator(10, 2), createValidator(20, 3)];

        const start = Date.now();
        await validateOrigin('https://example.com', origins);
        const duration = Date.now() - start;

        // Should complete in ~30ms (parallel), not ~60ms (sequential)
        expect(duration).toBeLessThan(50);
        // Order should reflect completion times
        expect(callOrder).toEqual([2, 3, 1]);
      });

      test('arrays with only strings/regexps should be cached', async () => {
        const origins = ['https://app1.com', 'https://app2.com', /^https:\/\/.*\.dev\.com$/];

        await validateOrigin('https://app1.com', origins);
        expect(getCacheStats().size).toBe(1);

        // Same origin, should use cache
        await validateOrigin('https://app1.com', origins);
        expect(getCacheStats().size).toBe(1);
      });

      test('arrays with functions should not be cached', async () => {
        const validator = vi.fn((origin: string) => origin.includes('localhost'));
        const origins = ['https://production.com', validator];

        await validateOrigin('http://localhost:3000', origins);
        await validateOrigin('http://localhost:3000', origins);

        // Validator should be called twice (no caching)
        expect(validator).toHaveBeenCalledTimes(2);
        expect(getCacheStats().size).toBe(0);
      });
    });
  });

  describe('Cache functionality', () => {
    test('should cache string validation results', async () => {
      const origin = 'https://example.com';
      const configuredOrigin = 'https://example.com';

      // First call
      await validateOrigin(origin, configuredOrigin);
      expect(getCacheStats().size).toBe(1);

      // Second call - should use cache
      await validateOrigin(origin, configuredOrigin);
      expect(getCacheStats().size).toBe(1); // Still just 1 entry
    });

    test('should cache RegExp validation results', async () => {
      const pattern = /^https:\/\/.*\.example\.com$/;

      // First set of calls
      await validateOrigin('https://api.example.com', pattern);
      expect(getCacheStats().size).toBe(1);

      // Should use cache
      await validateOrigin('https://api.example.com', pattern);
      expect(getCacheStats().size).toBe(1);

      // Different origin creates new cache entry
      await validateOrigin('https://www.example.com', pattern);
      expect(getCacheStats().size).toBe(2);
    });

    test('should NOT cache function validation results', async () => {
      const validator = vi.fn(() => true);

      await validateOrigin('https://example.com', validator);
      await validateOrigin('https://example.com', validator);

      // Should be called twice (no caching)
      expect(validator).toHaveBeenCalledTimes(2);
      expect(getCacheStats().size).toBe(0);
    });

    test('should use different cache keys for different users with string origins', async () => {
      const configuredOrigin = 'https://example.com';

      const ctx1 = { state: { user: { id: 'user1' } } } as Context<any, any>;
      const ctx2 = { state: { user: { id: 'user2' } } } as Context<any, any>;

      await validateOrigin('https://example.com', configuredOrigin, ctx1);
      await validateOrigin('https://example.com', configuredOrigin, ctx2);

      // Should have 2 cache entries (one per user)
      expect(getCacheStats().size).toBe(2);
    });

    test('should support userId from state.userId with string origins', async () => {
      const configuredOrigin = 'https://example.com';
      const ctx = { state: { userId: 'user123' } } as Context<any, any>;

      await validateOrigin('https://example.com', configuredOrigin, ctx);
      expect(getCacheStats().size).toBe(1);

      // Should use cache for same userId
      await validateOrigin('https://example.com', configuredOrigin, ctx);
      expect(getCacheStats().size).toBe(1);
    });

    test('should expire cache entries after TTL for string origins', async () => {
      setOriginCache(100, 10); // 100ms TTL

      const configuredOrigin = 'https://example.com';

      await validateOrigin('https://example.com', configuredOrigin);
      expect(getCacheStats().size).toBe(1);

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Cache entry should be expired and removed on next access
      await validateOrigin('https://example.com', configuredOrigin);

      // Size should still be 1 (old entry removed, new one added)
      expect(getCacheStats().size).toBe(1);
    });

    test('should enforce max cache size with LRU eviction for string origins', async () => {
      setOriginCache(60000, 3); // Max 3 entries

      // Use the same configured origin (wildcard) for all requests
      // This tests cache entries for different request origins
      const configuredOrigin = '*';

      // Add 3 origins to fill the cache
      await validateOrigin('https://origin1.com', configuredOrigin);
      expect(getCacheStats().size).toBe(1);

      await validateOrigin('https://origin2.com', configuredOrigin);
      expect(getCacheStats().size).toBe(2);

      await validateOrigin('https://origin3.com', configuredOrigin);
      expect(getCacheStats().size).toBe(3);

      // Access origin1 to make it recently used (updates lastAccessed via get())
      await validateOrigin('https://origin1.com', configuredOrigin);
      expect(getCacheStats().size).toBe(3); // Should still be 3

      // Add origin4, should evict origin2 (least recently used)
      await validateOrigin('https://origin4.com', configuredOrigin);

      // After eviction, we should have origin1, origin3, and origin4
      expect(getCacheStats().size).toBe(3);

      // Verify origin2 was evicted by checking if it needs to be recalculated
      // We can't directly test this with wildcard since it always returns true
      // So let's use a different test approach with a specific string match
    });

    test('should enforce max cache size with LRU eviction for specific string origins', async () => {
      setOriginCache(60000, 3); // Max 3 entries

      // Add 3 different origin pairs to fill the cache
      await validateOrigin('https://origin1.com', 'https://origin1.com');
      await validateOrigin('https://origin2.com', 'https://origin2.com');
      await validateOrigin('https://origin3.com', 'https://origin3.com');

      expect(getCacheStats().size).toBe(3);

      // Access origin1 to update its lastAccessed time
      await validateOrigin('https://origin1.com', 'https://origin1.com');
      expect(getCacheStats().size).toBe(3); // Should still be 3

      // Add origin4, should evict origin2 (least recently used)
      await validateOrigin('https://origin4.com', 'https://origin4.com');

      expect(getCacheStats().size).toBe(3);
    });

    test('should clean expired entries for string origins', async () => {
      setOriginCache(100, 10); // 100ms TTL

      // Add string entries
      await validateOrigin('https://origin1.com', 'https://origin1.com');
      await validateOrigin('https://origin2.com', 'https://origin2.com');

      // Immediately clean (nothing expired)
      expect(cleanExpiredCacheEntries()).toBe(0);
      expect(getCacheStats().size).toBe(2);

      // Wait for expiry and clean
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(cleanExpiredCacheEntries()).toBe(2);
      expect(getCacheStats().size).toBe(0);
    });

    test('should support automatic cache cleanup for string origins', async () => {
      vi.useFakeTimers();

      setOriginCache(100, 10); // 100ms TTL

      // Start cleanup every 200ms
      const stopCleanup = startCacheCleanup(200);

      // Add some string entries
      await validateOrigin('https://origin1.com', 'https://origin1.com');
      await validateOrigin('https://origin2.com', 'https://origin2.com');

      // Advance time past TTL and cleanup interval
      vi.advanceTimersByTime(350);

      // Should have cleaned up
      expect(console.debug).toHaveBeenCalledWith('Cleaned 2 expired CORS cache entries');

      stopCleanup();
      vi.useRealTimers();
    });

    test('should handle cache reset', async () => {
      // Use string origin for caching
      const configuredOrigin = 'https://example.com';

      // Add to cache
      await validateOrigin('https://example.com', configuredOrigin);
      expect(getCacheStats().size).toBe(1);

      // Reset cache
      resetOriginCache();
      expect(getCacheStats().size).toBe(0);

      // Should create new cache entry after reset
      await validateOrigin('https://example.com', configuredOrigin);
      expect(getCacheStats().size).toBe(1);
    });
  });

  describe('validateCredentialsWithOrigin', () => {
    test('should allow any origin when credentials are false', () => {
      expect(() => validateCredentialsWithOrigin(true, false)).not.toThrow();
      expect(() => validateCredentialsWithOrigin('*', false)).not.toThrow();
      expect(() =>
        validateCredentialsWithOrigin(['*', 'https://example.com'], false)
      ).not.toThrow();
    });

    test('should reject wildcard with credentials', () => {
      expect(() => validateCredentialsWithOrigin(true, true)).toThrow(
        'Cannot use wildcard origin with credentials=true'
      );

      expect(() => validateCredentialsWithOrigin('*', true)).toThrow(
        'Cannot use wildcard origin with credentials=true'
      );
    });

    test('should reject wildcard in array with credentials', () => {
      expect(() => validateCredentialsWithOrigin(['https://example.com', '*'], true)).toThrow(
        'Cannot include wildcard (*) in origin array'
      );
    });

    test('should allow specific origins with credentials', () => {
      expect(() => validateCredentialsWithOrigin('https://example.com', true)).not.toThrow();
      expect(() => validateCredentialsWithOrigin(/^https:\/\//, true)).not.toThrow();
      expect(() =>
        validateCredentialsWithOrigin(['https://a.com', 'https://b.com'], true)
      ).not.toThrow();
    });

    test('should allow false origin with credentials', () => {
      expect(() => validateCredentialsWithOrigin(false, true)).not.toThrow();
    });
  });

  describe('prevalidateOrigins', () => {
    test('should pre-populate cache with string origins', async () => {
      const origins = [
        'https://app.example.com',
        'https://api.example.com',
        'https://admin.example.com',
      ];

      const configuredOrigin = 'https://app.example.com';

      await prevalidateOrigins(origins, configuredOrigin);

      // Should have cached ALL validation results (both matches and non-matches)
      // - 'https://app.example.com' vs 'https://app.example.com' = true (cached)
      // - 'https://api.example.com' vs 'https://app.example.com' = false (cached)
      // - 'https://admin.example.com' vs 'https://app.example.com' = false (cached)
      expect(getCacheStats().size).toBe(3);

      // Now validate again - should use cache
      await validateOrigin('https://app.example.com', configuredOrigin);

      // Cache size should remain the same
      expect(getCacheStats().size).toBe(3);
    });

    test('should pre-populate cache with RegExp origins', async () => {
      const origins = [
        'https://app.example.com',
        'https://api.example.com',
        'https://admin.example.com',
      ];

      const pattern = /^https:\/\/.*\.example\.com$/;

      await prevalidateOrigins(origins, pattern);

      // Should have cached all 3 origins
      expect(getCacheStats().size).toBe(3);
    });

    test('should NOT cache prevalidation with function validators', async () => {
      const origins = ['https://allowed.com', 'https://denied.com'];
      const validator = vi.fn((origin: string) => origin.includes('allowed'));

      await prevalidateOrigins(origins, validator);

      // Validator should have been called for each origin
      expect(validator).toHaveBeenCalledTimes(2);

      // But nothing should be cached
      expect(getCacheStats().size).toBe(0);

      // Validate again - function should be called again (no cache)
      await validateOrigin('https://allowed.com', validator);
      expect(validator).toHaveBeenCalledTimes(3);
    });
  });

  describe('Edge cases', () => {
    test('should handle empty string origin', async () => {
      expect(await validateOrigin('', 'https://example.com')).toBe(false);
      expect(await validateOrigin('', '*')).toBe(true);
      expect(await validateOrigin('', true)).toBe(true);
    });

    test('should handle null/undefined in context with function validators', async () => {
      const validator = vi.fn(() => true);

      await validateOrigin('https://example.com', validator, undefined);
      await validateOrigin('https://example.com', validator, {} as Context<any, any>);
      await validateOrigin('https://example.com', validator, { state: {} } as Context<any, any>);

      // Function should be called 3 times (no caching)
      expect(validator).toHaveBeenCalledTimes(3);
    });

    test('should handle null/undefined in context with string origins', async () => {
      const configuredOrigin = 'https://example.com';

      await validateOrigin('https://example.com', configuredOrigin, undefined);
      await validateOrigin('https://example.com', configuredOrigin, {} as Context<any, any>);
      await validateOrigin('https://example.com', configuredOrigin, { state: {} } as Context<
        any,
        any
      >);

      // Should use cache (same anonymous user for all)
      expect(getCacheStats().size).toBe(1);
    });

    test('should handle malformed origins gracefully', async () => {
      const pattern = /^https:\/\//;

      expect(await validateOrigin('not-a-url', pattern)).toBe(false);
      expect(await validateOrigin('ftp://example.com', pattern)).toBe(false);
      expect(await validateOrigin('//example.com', pattern)).toBe(false);
    });

    test('should handle special characters in origins', async () => {
      const origin = 'https://example.com/path?query=1#hash';

      expect(await validateOrigin(origin, origin)).toBe(true);
      expect(await validateOrigin(origin, 'https://example.com')).toBe(false);
    });
  });
});
