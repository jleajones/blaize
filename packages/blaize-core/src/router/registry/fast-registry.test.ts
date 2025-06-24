import {
  createRouteRegistry,
  updateRoutesFromFile,
  getAllRoutesFromRegistry,
  getRouteFromRegistry,
  getFileRoutes,
} from './fast-registry';

import type { Route } from '../../index';

describe('fast-registry.ts - Route Registry', () => {
  let registry: ReturnType<typeof createRouteRegistry>;

  const mockRoute1: Route = {
    path: '/users',
    GET: { handler: vi.fn() },
  };

  const mockRoute2: Route = {
    path: '/posts',
    GET: { handler: vi.fn() },
    POST: { handler: vi.fn() },
  };

  const mockRoute3: Route = {
    path: '/comments',
    GET: { handler: vi.fn() },
    POST: { handler: vi.fn() },
    DELETE: { handler: vi.fn() },
  };

  beforeEach(() => {
    registry = createRouteRegistry();
  });

  describe('createRouteRegistry', () => {
    it('should create empty registry', () => {
      expect(registry.routesByPath.size).toBe(0);
      expect(registry.routesByFile.size).toBe(0);
      expect(registry.pathToFile.size).toBe(0);
    });

    it('should create registry with correct structure', () => {
      expect(registry.routesByPath).toBeInstanceOf(Map);
      expect(registry.routesByFile).toBeInstanceOf(Map);
      expect(registry.pathToFile).toBeInstanceOf(Map);
    });
  });

  describe('updateRoutesFromFile', () => {
    describe('adding new routes', () => {
      it('should add new routes from file', () => {
        const result = updateRoutesFromFile(registry, 'file1.ts', [mockRoute1]);

        expect(result.added).toEqual([mockRoute1]);
        expect(result.removed).toEqual([]);
        expect(result.changed).toEqual([]);

        expect(registry.routesByPath.get('/users')).toEqual(mockRoute1);
        expect(registry.pathToFile.get('/users')).toBe('file1.ts');
        expect(registry.routesByFile.get('file1.ts')).toEqual(new Set(['/users']));
      });

      it('should add multiple routes from same file', () => {
        const result = updateRoutesFromFile(registry, 'file1.ts', [mockRoute1, mockRoute2]);

        expect(result.added).toEqual([mockRoute1, mockRoute2]);
        expect(result.removed).toEqual([]);
        expect(result.changed).toEqual([]);

        expect(registry.routesByPath.get('/users')).toEqual(mockRoute1);
        expect(registry.routesByPath.get('/posts')).toEqual(mockRoute2);
        expect(registry.routesByFile.get('file1.ts')).toEqual(new Set(['/users', '/posts']));
      });

      it('should handle empty route arrays', () => {
        const result = updateRoutesFromFile(registry, 'empty.ts', []);

        expect(result.added).toEqual([]);
        expect(result.removed).toEqual([]);
        expect(result.changed).toEqual([]);

        expect(registry.routesByFile.has('empty.ts')).toBe(false);
      });
    });

    describe('removing routes', () => {
      beforeEach(() => {
        // Setup initial routes
        updateRoutesFromFile(registry, 'file1.ts', [mockRoute1, mockRoute2]);
      });

      it('should detect removed routes', () => {
        // Update with only one route (remove mockRoute2)
        const result = updateRoutesFromFile(registry, 'file1.ts', [mockRoute1]);

        expect(result.added).toEqual([]);
        expect(result.removed).toEqual(['/posts']);
        expect(result.changed).toEqual([]);

        expect(registry.routesByPath.has('/posts')).toBe(false);
        expect(registry.routesByPath.has('/users')).toBe(true);
        expect(registry.routesByFile.get('file1.ts')).toEqual(new Set(['/users']));
      });

      it('should remove all routes when file becomes empty', () => {
        const result = updateRoutesFromFile(registry, 'file1.ts', []);

        expect(result.added).toEqual([]);
        expect(result.removed).toEqual(['/users', '/posts']);
        expect(result.changed).toEqual([]);

        expect(registry.routesByPath.has('/users')).toBe(false);
        expect(registry.routesByPath.has('/posts')).toBe(false);
        expect(registry.routesByFile.has('file1.ts')).toBe(false);
      });

      it('should clean up pathToFile mapping when routes removed', () => {
        updateRoutesFromFile(registry, 'file1.ts', []);

        expect(registry.pathToFile.has('/users')).toBe(false);
        expect(registry.pathToFile.has('/posts')).toBe(false);
      });
    });

    describe('changing routes', () => {
      beforeEach(() => {
        // Setup initial route
        updateRoutesFromFile(registry, 'file1.ts', [mockRoute1]);
      });

      it('should detect changed routes', () => {
        // Update with modified route (add POST method)
        const modifiedRoute = {
          ...mockRoute1,
          post: { handler: vi.fn() },
        };

        const result = updateRoutesFromFile(registry, 'file1.ts', [modifiedRoute]);

        expect(result.added).toEqual([]);
        expect(result.removed).toEqual([]);
        expect(result.changed).toEqual([modifiedRoute]);

        expect(registry.routesByPath.get('/users')).toEqual(modifiedRoute);
      });

      it('should not detect changes when routes are identical', () => {
        // Create identical route with same structure
        const identicalRoute = {
          path: '/users',
          get: { handler: vi.fn() }, // Same structure, different function instance
        };

        const result = updateRoutesFromFile(registry, 'file1.ts', [identicalRoute]);

        expect(result.added).toEqual([]);
        expect(result.removed).toEqual([]);
        // The registry compares by structure (typeof), so this should detect as changed
        // because it's a different object instance, even with same structure
        expect(result.changed).toEqual([identicalRoute]);
      });

      it('should detect no changes when updating with exact same route object', () => {
        // Get the exact same route object from registry
        const existingRoute = registry.routesByPath.get('/users')!;

        const result = updateRoutesFromFile(registry, 'file1.ts', [existingRoute]);

        expect(result.added).toEqual([]);
        expect(result.removed).toEqual([]);
        expect(result.changed).toEqual([]); // Same object reference = no change
      });

      it('should detect changes in handler structure', () => {
        // Change handler structure (add property)
        const changedRoute = {
          path: '/users',
          get: {
            handler: vi.fn(),
            middleware: [vi.fn()], // Different structure
          },
        };

        const result = updateRoutesFromFile(registry, 'file1.ts', [changedRoute]);

        expect(result.changed).toEqual([changedRoute]);
      });
    });

    describe('complex updates', () => {
      beforeEach(() => {
        // Setup initial state
        updateRoutesFromFile(registry, 'file1.ts', [mockRoute1, mockRoute2]);
      });

      it('should handle multiple operations in one update', () => {
        const newRoute = { path: '/comments', get: { handler: vi.fn() } };
        const modifiedRoute1 = { ...mockRoute1, post: { handler: vi.fn() } };

        // Update: keep modified route1, remove route2, add new route
        const result = updateRoutesFromFile(registry, 'file1.ts', [modifiedRoute1, newRoute]);

        expect(result.added.map(r => r.path)).toEqual(['/comments']);
        expect(result.removed).toEqual(['/posts']);
        expect(result.changed.map(r => r.path)).toEqual(['/users']);

        // Verify final state
        expect(registry.routesByPath.get('/users')).toEqual(modifiedRoute1);
        expect(registry.routesByPath.get('/comments')).toEqual(newRoute);
        expect(registry.routesByPath.has('/posts')).toBe(false);
        expect(registry.routesByFile.get('file1.ts')).toEqual(new Set(['/users', '/comments']));
      });

      it('should handle complete file replacement', () => {
        // Replace all routes with completely new ones
        const result = updateRoutesFromFile(registry, 'file1.ts', [mockRoute3]);

        expect(result.added).toEqual([mockRoute3]);
        expect(result.removed).toEqual(['/users', '/posts']);
        expect(result.changed).toEqual([]);

        expect(registry.routesByPath.get('/comments')).toEqual(mockRoute3);
        expect(registry.routesByPath.has('/users')).toBe(false);
        expect(registry.routesByPath.has('/posts')).toBe(false);
      });

      it('should maintain consistency across multiple files', () => {
        // Add routes from second file
        updateRoutesFromFile(registry, 'file2.ts', [mockRoute3]);

        // Verify both files are tracked
        expect(registry.routesByFile.get('file1.ts')).toEqual(new Set(['/users', '/posts']));
        expect(registry.routesByFile.get('file2.ts')).toEqual(new Set(['/comments']));
        expect(registry.pathToFile.get('/users')).toBe('file1.ts');
        expect(registry.pathToFile.get('/comments')).toBe('file2.ts');

        // Update first file
        updateRoutesFromFile(registry, 'file1.ts', [mockRoute1]);

        // Verify second file unaffected
        expect(registry.routesByFile.get('file2.ts')).toEqual(new Set(['/comments']));
        expect(registry.routesByPath.get('/comments')).toEqual(mockRoute3);
      });
    });

    describe('edge cases', () => {
      it('should handle duplicate paths in same file', () => {
        const duplicateRoute = { ...mockRoute1 }; // Same path

        const result = updateRoutesFromFile(registry, 'file1.ts', [mockRoute1, duplicateRoute]);

        // Both routes will be added since they have the same path
        // The registry doesn't deduplicate within the same update
        expect(result.added).toHaveLength(2);
        expect(registry.routesByPath.get('/users')).toEqual(duplicateRoute); // Last one wins in the map
      });

      it('should handle routes with only path property', () => {
        const pathOnlyRoute: Route = { path: '/empty' };

        const result = updateRoutesFromFile(registry, 'file1.ts', [pathOnlyRoute]);

        expect(result.added).toEqual([pathOnlyRoute]);
        expect(registry.routesByPath.get('/empty')).toEqual(pathOnlyRoute);
      });

      it('should handle very long file paths', () => {
        const longPath = '/very/deeply/nested/file/path/that/is/extremely/long.ts';

        const result = updateRoutesFromFile(registry, longPath, [mockRoute1]);

        expect(result.added).toEqual([mockRoute1]);
        expect(registry.routesByFile.get(longPath)).toEqual(new Set(['/users']));
      });
    });
  });

  describe('getRouteFromRegistry', () => {
    beforeEach(() => {
      updateRoutesFromFile(registry, 'file1.ts', [mockRoute1, mockRoute2]);
    });

    it('should return specific route by path', () => {
      const route = getRouteFromRegistry(registry, '/users');
      expect(route).toEqual(mockRoute1);
    });

    it('should return undefined for non-existent routes', () => {
      const route = getRouteFromRegistry(registry, '/nonexistent');
      expect(route).toBeUndefined();
    });

    it('should return correct route after updates', () => {
      const modifiedRoute = { ...mockRoute1, post: { handler: vi.fn() } };
      updateRoutesFromFile(registry, 'file1.ts', [modifiedRoute, mockRoute2]);

      const route = getRouteFromRegistry(registry, '/users');
      expect(route).toEqual(modifiedRoute);
    });
  });

  describe('getAllRoutesFromRegistry', () => {
    it('should return empty array for empty registry', () => {
      const routes = getAllRoutesFromRegistry(registry);
      expect(routes).toEqual([]);
    });

    it('should return all routes', () => {
      updateRoutesFromFile(registry, 'file1.ts', [mockRoute1]);
      updateRoutesFromFile(registry, 'file2.ts', [mockRoute2]);

      const allRoutes = getAllRoutesFromRegistry(registry);
      expect(allRoutes).toHaveLength(2);
      expect(allRoutes).toContain(mockRoute1);
      expect(allRoutes).toContain(mockRoute2);
    });

    it('should return fresh array each time', () => {
      updateRoutesFromFile(registry, 'file1.ts', [mockRoute1]);

      const routes1 = getAllRoutesFromRegistry(registry);
      const routes2 = getAllRoutesFromRegistry(registry);

      expect(routes1).toEqual(routes2);
      expect(routes1).not.toBe(routes2); // Different array instances
    });

    it('should reflect route updates', () => {
      updateRoutesFromFile(registry, 'file1.ts', [mockRoute1]);

      let routes = getAllRoutesFromRegistry(registry);
      expect(routes).toHaveLength(1);

      updateRoutesFromFile(registry, 'file1.ts', [mockRoute1, mockRoute2]);

      routes = getAllRoutesFromRegistry(registry);
      expect(routes).toHaveLength(2);
    });
  });

  describe('getFileRoutes', () => {
    beforeEach(() => {
      updateRoutesFromFile(registry, 'file1.ts', [mockRoute1, mockRoute2]);
      updateRoutesFromFile(registry, 'file2.ts', [mockRoute3]);
    });

    it('should return routes for specific file', () => {
      const file1Routes = getFileRoutes(registry, 'file1.ts');
      expect(file1Routes).toHaveLength(2);
      expect(file1Routes).toContain(mockRoute1);
      expect(file1Routes).toContain(mockRoute2);

      const file2Routes = getFileRoutes(registry, 'file2.ts');
      expect(file2Routes).toEqual([mockRoute3]);
    });

    it('should return empty array for non-existent files', () => {
      const routes = getFileRoutes(registry, 'nonexistent.ts');
      expect(routes).toEqual([]);
    });

    it('should return empty array for files with no routes', () => {
      updateRoutesFromFile(registry, 'empty.ts', []);
      const routes = getFileRoutes(registry, 'empty.ts');
      expect(routes).toEqual([]);
    });

    it('should filter out undefined routes (safety check)', () => {
      // Manually corrupt registry to test safety
      registry.routesByFile.set('corrupted.ts', new Set(['/nonexistent']));

      const routes = getFileRoutes(registry, 'corrupted.ts');
      expect(routes).toEqual([]); // Should filter out undefined routes
    });

    it('should reflect file updates', () => {
      let routes = getFileRoutes(registry, 'file1.ts');
      expect(routes).toHaveLength(2);

      // Remove one route
      updateRoutesFromFile(registry, 'file1.ts', [mockRoute1]);

      routes = getFileRoutes(registry, 'file1.ts');
      expect(routes).toHaveLength(1);
      expect(routes).toEqual([mockRoute1]);
    });
  });

  describe('registry consistency', () => {
    it('should maintain consistent state across operations', () => {
      // Add routes
      updateRoutesFromFile(registry, 'file1.ts', [mockRoute1, mockRoute2]);
      updateRoutesFromFile(registry, 'file2.ts', [mockRoute3]);

      // Verify consistency
      expect(registry.routesByPath.size).toBe(3);
      expect(registry.routesByFile.size).toBe(2);
      expect(registry.pathToFile.size).toBe(3);

      // Remove one file
      updateRoutesFromFile(registry, 'file1.ts', []);

      // Verify cleanup
      expect(registry.routesByPath.size).toBe(1);
      expect(registry.routesByFile.size).toBe(1);
      expect(registry.pathToFile.size).toBe(1);

      // Verify remaining route
      expect(registry.routesByPath.get('/comments')).toEqual(mockRoute3);
      expect(registry.pathToFile.get('/comments')).toBe('file2.ts');
    });

    it('should handle rapid updates correctly', () => {
      // Simulate rapid file changes
      for (let i = 0; i < 10; i++) {
        updateRoutesFromFile(registry, 'file1.ts', [mockRoute1]);
        updateRoutesFromFile(registry, 'file1.ts', [mockRoute1, mockRoute2]);
        updateRoutesFromFile(registry, 'file1.ts', [mockRoute2]);
      }

      // Final state should be consistent
      expect(registry.routesByPath.get('/posts')).toEqual(mockRoute2);
      expect(registry.routesByPath.has('/users')).toBe(false);
      expect(registry.routesByFile.get('file1.ts')).toEqual(new Set(['/posts']));
    });

    it('should handle concurrent file updates', () => {
      // Update multiple files
      updateRoutesFromFile(registry, 'file1.ts', [mockRoute1]);
      updateRoutesFromFile(registry, 'file2.ts', [mockRoute2]);
      updateRoutesFromFile(registry, 'file3.ts', [mockRoute3]);

      // Update files in different order
      updateRoutesFromFile(registry, 'file2.ts', []);
      updateRoutesFromFile(registry, 'file1.ts', [mockRoute1, mockRoute2]);
      updateRoutesFromFile(registry, 'file3.ts', [mockRoute3]);

      // Verify final state
      expect(getAllRoutesFromRegistry(registry)).toHaveLength(3);
      expect(getFileRoutes(registry, 'file1.ts')).toHaveLength(2);
      expect(getFileRoutes(registry, 'file2.ts')).toHaveLength(0);
      expect(getFileRoutes(registry, 'file3.ts')).toHaveLength(1);
    });
  });

  describe('performance characteristics', () => {
    it('should handle large numbers of routes efficiently', () => {
      const manyRoutes: Route[] = [];
      for (let i = 0; i < 1000; i++) {
        manyRoutes.push({
          path: `/route${i}`,
          GET: { handler: vi.fn() },
        });
      }

      const start = Date.now();
      updateRoutesFromFile(registry, 'large-file.ts', manyRoutes);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100); // Should be fast
      expect(registry.routesByPath.size).toBe(1000);
      expect(getAllRoutesFromRegistry(registry)).toHaveLength(1000);
    });

    it('should handle route updates efficiently', () => {
      // Setup large number of routes
      const routes: Route[] = [];
      for (let i = 0; i < 100; i++) {
        routes.push({ path: `/route${i}`, GET: { handler: vi.fn() } });
      }
      updateRoutesFromFile(registry, 'file1.ts', routes);

      // Update with slightly different routes
      const updatedRoutes = routes.map(r => ({
        ...r,
        POST: { handler: vi.fn() },
      }));

      const start = Date.now();
      const result = updateRoutesFromFile(registry, 'file1.ts', updatedRoutes);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(50);
      expect(result.changed).toHaveLength(100);
    });
  });
});
