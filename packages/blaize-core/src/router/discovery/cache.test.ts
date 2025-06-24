import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { processChangedFile, hasRouteContentChanged, clearFileCache } from './cache';
import { loadRouteModule } from './loader';

// Mock dependencies
vi.mock('node:fs/promises', () => ({
  stat: vi.fn(),
}));

vi.mock('./loader', () => ({
  loadRouteModule: vi.fn(),
}));

// Mock path.resolve
vi.mock('node:path', async () => {
  const actual = await vi.importActual('node:path');
  return {
    ...actual,
    resolve: vi.fn(),
  };
});

// Create a safe mock for require that doesn't throw
const mockRequireCache: Record<string, any> = {};
const mockRequire = {
  resolve: vi.fn(),
  cache: mockRequireCache,
} as any;

// Mock global require
vi.stubGlobal('require', mockRequire);

const mockLoadRouteModule = vi.mocked(loadRouteModule);
const mockFsStat = vi.mocked(fs.stat);
const mockPathResolve = vi.mocked(path.resolve);

describe('cache.ts - File Caching', () => {
  const testFilePath = '/test/routes/users.ts';
  const testRoutesDir = '/test/routes';

  const mockRoute = {
    path: '/users',
    get: { handler: vi.fn() },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    clearFileCache(); // Clear cache between tests

    // Setup default mocks
    mockPathResolve.mockReturnValue('/absolute/test/routes/users.ts');
    mockRequire.resolve.mockReturnValue('/absolute/test/routes/users.ts');

    // Clear mock require cache
    Object.keys(mockRequireCache).forEach(key => {
      delete mockRequireCache[key];
    });
  });

  describe('processChangedFile', () => {
    it('should load and cache file on first access', async () => {
      // Mock successful file stat
      mockFsStat.mockResolvedValue({
        mtime: { getTime: () => 1000 },
      } as any);

      // Mock successful route loading
      mockLoadRouteModule.mockResolvedValue([mockRoute]);

      const routes = await processChangedFile(testFilePath, testRoutesDir);

      expect(routes).toEqual([mockRoute]);
      expect(mockLoadRouteModule).toHaveBeenCalledWith(testFilePath, testRoutesDir);
      expect(mockFsStat).toHaveBeenCalledWith(testFilePath);
    });

    it('should return cached routes if file unchanged', async () => {
      const mtime = 1000;
      mockFsStat.mockResolvedValue({
        mtime: { getTime: () => mtime },
      } as any);
      mockLoadRouteModule.mockResolvedValue([mockRoute]);

      // First call - loads and caches
      await processChangedFile(testFilePath, testRoutesDir);

      // Second call - should use cache
      const routes = await processChangedFile(testFilePath, testRoutesDir);

      expect(routes).toEqual([mockRoute]);
      expect(mockLoadRouteModule).toHaveBeenCalledTimes(1); // Only called once
    });

    it('should reload file if timestamp changed', async () => {
      mockLoadRouteModule.mockResolvedValue([mockRoute]);

      // First call with old timestamp
      mockFsStat.mockResolvedValue({
        mtime: { getTime: () => 1000 },
      } as any);
      await processChangedFile(testFilePath, testRoutesDir);

      // Second call with new timestamp
      mockFsStat.mockResolvedValue({
        mtime: { getTime: () => 2000 },
      } as any);
      const routes = await processChangedFile(testFilePath, testRoutesDir);

      expect(routes).toEqual([mockRoute]);
      expect(mockLoadRouteModule).toHaveBeenCalledTimes(2); // Called twice
    });

    it('should handle file stat errors', async () => {
      mockFsStat.mockRejectedValue(new Error('File not found'));

      await expect(processChangedFile(testFilePath, testRoutesDir)).rejects.toThrow(
        'File not found'
      );
    });

    it('should handle route loading errors', async () => {
      mockFsStat.mockResolvedValue({
        mtime: { getTime: () => 1000 },
      } as any);
      mockLoadRouteModule.mockRejectedValue(new Error('Invalid route'));

      await expect(processChangedFile(testFilePath, testRoutesDir)).rejects.toThrow(
        'Invalid route'
      );
    });

    it('should handle module cache invalidation errors gracefully', async () => {
      mockFsStat.mockResolvedValue({
        mtime: { getTime: () => 1000 },
      } as any);
      mockLoadRouteModule.mockResolvedValue([mockRoute]);

      // Mock require.resolve to throw (simulating file not in cache)
      mockRequire.resolve.mockImplementation(() => {
        throw new Error('Cannot resolve module');
      });

      // Should still work despite cache invalidation error
      const routes = await processChangedFile(testFilePath, testRoutesDir);
      expect(routes).toEqual([mockRoute]);
    });
  });

  describe('hasRouteContentChanged', () => {
    it('should return true for new file', () => {
      const changed = hasRouteContentChanged('/new/file.ts', [mockRoute]);
      expect(changed).toBe(true);
    });

    it('should return false for identical route content', async () => {
      mockFsStat.mockResolvedValue({
        mtime: { getTime: () => 1000 },
      } as any);
      mockLoadRouteModule.mockResolvedValue([mockRoute]);

      // Cache the route
      await processChangedFile(testFilePath, testRoutesDir);

      // Check if same content changed
      const changed = hasRouteContentChanged(testFilePath, [mockRoute]);
      expect(changed).toBe(false);
    });

    it('should return true for changed route content', async () => {
      mockFsStat.mockResolvedValue({
        mtime: { getTime: () => 1000 },
      } as any);
      mockLoadRouteModule.mockResolvedValue([mockRoute]);

      // Cache the route
      await processChangedFile(testFilePath, testRoutesDir);

      // Check with different content
      const differentRoute = { ...mockRoute, path: '/different' };
      const changed = hasRouteContentChanged(testFilePath, [differentRoute]);
      expect(changed).toBe(true);
    });

    it('should return true for routes with different methods', async () => {
      mockFsStat.mockResolvedValue({
        mtime: { getTime: () => 1000 },
      } as any);
      mockLoadRouteModule.mockResolvedValue([mockRoute]);

      // Cache the route
      await processChangedFile(testFilePath, testRoutesDir);

      // Check with additional method
      const routeWithPost = {
        ...mockRoute,
        post: { handler: vi.fn() },
      };
      const changed = hasRouteContentChanged(testFilePath, [routeWithPost]);
      expect(changed).toBe(true);
    });

    it('should handle routes with no methods', async () => {
      const routeWithoutMethods = { path: '/empty' };

      mockFsStat.mockResolvedValue({
        mtime: { getTime: () => 1000 },
      } as any);
      mockLoadRouteModule.mockResolvedValue([routeWithoutMethods]);

      // Cache the route
      await processChangedFile(testFilePath, testRoutesDir);

      // Check with same empty route
      const changed = hasRouteContentChanged(testFilePath, [routeWithoutMethods]);
      expect(changed).toBe(false);
    });
  });

  describe('clearFileCache', () => {
    it('should clear specific file from cache', async () => {
      mockFsStat.mockResolvedValue({
        mtime: { getTime: () => 1000 },
      } as any);
      mockLoadRouteModule.mockResolvedValue([mockRoute]);

      // Cache the file
      await processChangedFile(testFilePath, testRoutesDir);

      // Clear specific file
      clearFileCache(testFilePath);

      // Should reload on next access
      await processChangedFile(testFilePath, testRoutesDir);
      expect(mockLoadRouteModule).toHaveBeenCalledTimes(2);
    });

    it('should clear entire cache when no file specified', async () => {
      mockFsStat.mockResolvedValue({
        mtime: { getTime: () => 1000 },
      } as any);
      mockLoadRouteModule.mockResolvedValue([mockRoute]);

      // Cache multiple files
      await processChangedFile('/file1.ts', testRoutesDir);
      await processChangedFile('/file2.ts', testRoutesDir);

      // Clear entire cache
      clearFileCache();

      // Should reload both files
      await processChangedFile('/file1.ts', testRoutesDir);
      await processChangedFile('/file2.ts', testRoutesDir);
      expect(mockLoadRouteModule).toHaveBeenCalledTimes(4);
    });

    it('should not affect other files when clearing specific file', async () => {
      mockFsStat.mockResolvedValue({
        mtime: { getTime: () => 1000 },
      } as any);
      mockLoadRouteModule.mockResolvedValue([mockRoute]);

      // Cache multiple files
      await processChangedFile('/file1.ts', testRoutesDir);
      await processChangedFile('/file2.ts', testRoutesDir);

      // Clear only one file
      clearFileCache('/file1.ts');

      // file1 should reload, file2 should use cache
      await processChangedFile('/file1.ts', testRoutesDir);
      await processChangedFile('/file2.ts', testRoutesDir);

      // file1 loaded twice (initial + after clear), file2 loaded once (initial only)
      expect(mockLoadRouteModule).toHaveBeenCalledTimes(3);
    });
  });

  describe('hash consistency', () => {
    it('should generate same hash for identical routes', async () => {
      const route1 = { path: '/test', get: { handler: vi.fn() } };
      const route2 = { path: '/test', get: { handler: vi.fn() } };

      mockFsStat.mockResolvedValue({ mtime: { getTime: () => 1000 } } as any);

      // Cache first route
      mockLoadRouteModule.mockResolvedValue([route1]);
      await processChangedFile('/file1.ts', testRoutesDir);

      // Check if second identical route is detected as unchanged
      const changed = hasRouteContentChanged('/file1.ts', [route2]);
      expect(changed).toBe(false);
    });

    it('should generate different hash for different route structures', async () => {
      const route1 = { path: '/test', get: { handler: vi.fn() } };
      const route2 = { path: '/test', get: { handler: vi.fn() }, post: { handler: vi.fn() } };

      mockFsStat.mockResolvedValue({ mtime: { getTime: () => 1000 } } as any);

      // Cache first route
      mockLoadRouteModule.mockResolvedValue([route1]);
      await processChangedFile('/file1.ts', testRoutesDir);

      // Check if route with additional method is detected as changed
      const changed = hasRouteContentChanged('/file1.ts', [route2]);
      expect(changed).toBe(true);
    });
  });
});
