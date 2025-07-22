import {
  addRouteToMatcher,
  removeRouteFromMatcher,
  updateRouteInMatcher,
  rebuildMatcherWithRoutes,
} from './matching-helpers';

import type { Route, Matcher } from '@blaize-types/router';

describe('matcher-helpers.ts - Matcher Utilities', () => {
  let mockMatcher: Matcher;

  const mockRoute: Route = {
    path: '/users',
    GET: { handler: vi.fn() },
    POST: { handler: vi.fn() },
  };

  const mockRoute2: Route = {
    path: '/posts',
    GET: { handler: vi.fn() },
    POST: { handler: vi.fn() },
    DELETE: { handler: vi.fn() },
  };

  beforeEach(() => {
    mockMatcher = {
      add: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn(),
      match: vi.fn(), // Required by Matcher interface
    } as any;
  });

  describe('addRouteToMatcher', () => {
    it('should add all HTTP methods to matcher', () => {
      addRouteToMatcher(mockRoute, mockMatcher);

      expect(mockMatcher.add).toHaveBeenCalledTimes(2);
      expect(mockMatcher.add).toHaveBeenCalledWith('/users', 'GET', mockRoute.GET);
      expect(mockMatcher.add).toHaveBeenCalledWith('/users', 'POST', mockRoute.POST);
    });

    it('should skip path property', () => {
      addRouteToMatcher(mockRoute, mockMatcher);

      // Verify path property was not passed to matcher.add
      const addCalls = vi.mocked(mockMatcher.add).mock.calls;
      const pathCalls = addCalls.filter(call => call[1] === ('path' as any));
      expect(pathCalls).toHaveLength(0);
    });

    it('should skip undefined method options', () => {
      const routeWithUndefined: Route = {
        path: '/test',
        GET: { handler: vi.fn() },
        POST: undefined as any,
      };

      addRouteToMatcher(routeWithUndefined, mockMatcher);

      expect(mockMatcher.add).toHaveBeenCalledTimes(1);
      expect(mockMatcher.add).toHaveBeenCalledWith('/test', 'GET', routeWithUndefined.GET);
    });

    it('should skip null method options', () => {
      const routeWithNull: Route = {
        path: '/test',
        GET: { handler: vi.fn() },
        POST: null as any,
      };

      addRouteToMatcher(routeWithNull, mockMatcher);

      expect(mockMatcher.add).toHaveBeenCalledTimes(1);
      expect(mockMatcher.add).toHaveBeenCalledWith('/test', 'GET', routeWithNull.GET);
    });

    it('should handle route with only path', () => {
      const pathOnlyRoute: Route = { path: '/empty' };

      addRouteToMatcher(pathOnlyRoute, mockMatcher);

      expect(mockMatcher.add).not.toHaveBeenCalled();
    });

    it('should handle route with many HTTP methods', () => {
      const fullRoute: Route = {
        path: '/api/resource',
        GET: { handler: vi.fn() },
        POST: { handler: vi.fn() },
        PUT: { handler: vi.fn() },
        PATCH: { handler: vi.fn() },
        DELETE: { handler: vi.fn() },
        HEAD: { handler: vi.fn() },
        OPTIONS: { handler: vi.fn() },
      };

      addRouteToMatcher(fullRoute, mockMatcher);

      expect(mockMatcher.add).toHaveBeenCalledTimes(7);
      expect(mockMatcher.add).toHaveBeenCalledWith('/api/resource', 'GET', fullRoute.GET);
      expect(mockMatcher.add).toHaveBeenCalledWith('/api/resource', 'POST', fullRoute.POST);
      expect(mockMatcher.add).toHaveBeenCalledWith('/api/resource', 'PUT', fullRoute.PUT);
      expect(mockMatcher.add).toHaveBeenCalledWith('/api/resource', 'PATCH', fullRoute.PATCH);
      expect(mockMatcher.add).toHaveBeenCalledWith('/api/resource', 'DELETE', fullRoute.DELETE);
      expect(mockMatcher.add).toHaveBeenCalledWith('/api/resource', 'HEAD', fullRoute.HEAD);
      expect(mockMatcher.add).toHaveBeenCalledWith('/api/resource', 'OPTIONS', fullRoute.OPTIONS);
    });
  });

  describe('removeRouteFromMatcher', () => {
    it('should call matcher remove method when available', () => {
      removeRouteFromMatcher('/users', mockMatcher);

      expect(mockMatcher.remove).toHaveBeenCalledWith('/users');
    });

    it('should warn when matcher lacks remove method', () => {
      const matcherWithoutRemove = {
        add: vi.fn(),
        clear: vi.fn(),
        match: vi.fn(),
      } as any;
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      removeRouteFromMatcher('/users', matcherWithoutRemove);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Matcher does not support selective removal, consider adding remove() method'
      );

      consoleSpy.mockRestore();
    });

    it('should handle matcher with remove property that is not a function', () => {
      const matcherWithInvalidRemove = {
        add: vi.fn(),
        clear: vi.fn(),
        match: vi.fn(),
        remove: 'not-a-function',
      } as any;
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      removeRouteFromMatcher('/users', matcherWithInvalidRemove);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Matcher does not support selective removal, consider adding remove() method'
      );

      consoleSpy.mockRestore();
    });

    it('should not throw when remove method is undefined', () => {
      const matcherWithUndefinedRemove = {
        add: vi.fn(),
        clear: vi.fn(),
        match: vi.fn(),
        remove: undefined,
      } as any;

      expect(() => {
        removeRouteFromMatcher('/users', matcherWithUndefinedRemove);
      }).not.toThrow();
    });
  });

  describe('updateRouteInMatcher', () => {
    it('should remove then add route', () => {
      updateRouteInMatcher(mockRoute, mockMatcher);

      expect(mockMatcher.remove).toHaveBeenCalledWith('/users');
      expect(mockMatcher.add).toHaveBeenCalledTimes(2);
      expect(mockMatcher.add).toHaveBeenCalledWith('/users', 'GET', mockRoute.GET);
      expect(mockMatcher.add).toHaveBeenCalledWith('/users', 'POST', mockRoute.POST);
    });

    it('should call remove before add', () => {
      const callOrder: string[] = [];

      vi.mocked(mockMatcher.remove).mockImplementation(() => {
        callOrder.push('remove');
      });

      vi.mocked(mockMatcher.add).mockImplementation(() => {
        callOrder.push('add');
      });

      updateRouteInMatcher(mockRoute, mockMatcher);

      expect(callOrder[0]).toBe('remove');
      expect(callOrder.slice(1)).toEqual(['add', 'add']); // Two add calls for get/post
    });

    it('should work even when remove fails', () => {
      const matcherWithoutRemove = {
        add: vi.fn(),
        clear: vi.fn(),
        match: vi.fn(),
      } as any;
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      expect(() => {
        updateRouteInMatcher(mockRoute, matcherWithoutRemove);
      }).not.toThrow();

      expect(matcherWithoutRemove.add).toHaveBeenCalledTimes(2);
      consoleSpy.mockRestore();
    });
  });

  describe('rebuildMatcherWithRoutes', () => {
    it('should clear matcher and add all routes', () => {
      const routes = [mockRoute, mockRoute2];

      rebuildMatcherWithRoutes(routes, mockMatcher);

      expect(mockMatcher.clear).toHaveBeenCalled();
      expect(mockMatcher.add).toHaveBeenCalledTimes(5); // 2 methods + 3 methods

      // Verify all routes were added// Verify all routes were added
      expect(mockMatcher.add).toHaveBeenCalledWith('/users', 'GET', mockRoute.GET);
      expect(mockMatcher.add).toHaveBeenCalledWith('/users', 'POST', mockRoute.POST);
      expect(mockMatcher.add).toHaveBeenCalledWith('/posts', 'GET', mockRoute2.GET);
      expect(mockMatcher.add).toHaveBeenCalledWith('/posts', 'POST', mockRoute2.POST);
      expect(mockMatcher.add).toHaveBeenCalledWith('/posts', 'DELETE', mockRoute2.DELETE);
    });

    it('should handle matcher without clear method', () => {
      const matcherWithoutClear = {
        add: vi.fn(),
        match: vi.fn(),
      } as any;
      const routes = [mockRoute];

      expect(() => {
        rebuildMatcherWithRoutes(routes, matcherWithoutClear);
      }).not.toThrow();

      expect(matcherWithoutClear.add).toHaveBeenCalledTimes(2);
    });

    it('should handle matcher with clear property that is not a function', () => {
      const matcherWithInvalidClear = {
        add: vi.fn(),
        match: vi.fn(),
        clear: 'not-a-function',
      } as any;
      const routes = [mockRoute];

      expect(() => {
        rebuildMatcherWithRoutes(routes, matcherWithInvalidClear);
      }).not.toThrow();

      expect(matcherWithInvalidClear.add).toHaveBeenCalledTimes(2);
    });

    it('should handle empty routes array', () => {
      rebuildMatcherWithRoutes([], mockMatcher);

      expect(mockMatcher.clear).toHaveBeenCalled();
      expect(mockMatcher.add).not.toHaveBeenCalled();
    });

    it('should call clear before adding routes', () => {
      const callOrder: string[] = [];

      vi.mocked(mockMatcher.clear).mockImplementation(() => {
        callOrder.push('clear');
      });

      vi.mocked(mockMatcher.add).mockImplementation(() => {
        callOrder.push('add');
      });

      rebuildMatcherWithRoutes([mockRoute], mockMatcher);

      expect(callOrder[0]).toBe('clear');
      expect(callOrder.slice(1)).toEqual(['add', 'add']);
    });

    it('should handle routes with mixed method availability', () => {
      const routeWithSomeMethods: Route = {
        path: '/mixed',
        GET: { handler: vi.fn() },
        POST: undefined as any,
        PUT: { handler: vi.fn() },
      };

      rebuildMatcherWithRoutes([routeWithSomeMethods], mockMatcher);

      expect(mockMatcher.clear).toHaveBeenCalled();
      expect(mockMatcher.add).toHaveBeenCalledTimes(2); // Only get and put
      expect(mockMatcher.add).toHaveBeenCalledWith('/mixed', 'GET', routeWithSomeMethods.GET);
      expect(mockMatcher.add).toHaveBeenCalledWith('/mixed', 'PUT', routeWithSomeMethods.PUT);
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete route lifecycle', () => {
      // Add route
      addRouteToMatcher(mockRoute, mockMatcher);
      expect(mockMatcher.add).toHaveBeenCalledTimes(2);

      // Update route
      vi.mocked(mockMatcher.add).mockClear();
      const updatedRoute = { ...mockRoute, put: { handler: vi.fn() } };
      updateRouteInMatcher(updatedRoute, mockMatcher);

      expect(mockMatcher.remove).toHaveBeenCalledWith('/users');
      expect(mockMatcher.add).toHaveBeenCalledTimes(3); // get, post, put

      // Remove route
      vi.mocked(mockMatcher.remove).mockClear();
      removeRouteFromMatcher('/users', mockMatcher);
      expect(mockMatcher.remove).toHaveBeenCalledWith('/users');
    });

    it('should handle multiple routes with rebuild', () => {
      const routes = [mockRoute, mockRoute2];

      // Initial build
      rebuildMatcherWithRoutes(routes, mockMatcher);
      expect(mockMatcher.add).toHaveBeenCalledTimes(5);

      // Rebuild with different routes
      vi.mocked(mockMatcher.add).mockClear();
      vi.mocked(mockMatcher.clear).mockClear();

      const newRoutes = [mockRoute2]; // Only one route now
      rebuildMatcherWithRoutes(newRoutes, mockMatcher);

      expect(mockMatcher.clear).toHaveBeenCalled();
      expect(mockMatcher.add).toHaveBeenCalledTimes(3); // Only mockRoute2 methods
    });

    it('should work with matchers that have partial functionality', () => {
      const minimalMatcher = {
        add: vi.fn(),
        match: vi.fn(),
        // No remove or clear methods
      } as any;

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Should work despite limited matcher functionality
      addRouteToMatcher(mockRoute, minimalMatcher);
      expect(minimalMatcher.add).toHaveBeenCalledTimes(2);

      removeRouteFromMatcher('/users', minimalMatcher);
      expect(consoleSpy).toHaveBeenCalled();

      updateRouteInMatcher(mockRoute, minimalMatcher);
      expect(minimalMatcher.add).toHaveBeenCalledTimes(4); // 2 + 2 from update

      rebuildMatcherWithRoutes([mockRoute], minimalMatcher);
      expect(minimalMatcher.add).toHaveBeenCalledTimes(6); // 4 + 2 from rebuild

      consoleSpy.mockRestore();
    });
  });
});
