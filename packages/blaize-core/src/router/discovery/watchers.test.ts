import * as path from 'node:path';

import { processChangedFile, hasRouteContentChanged } from './cache';
import { findRouteFiles } from './finder';
import { watchRoutes } from './watchers';

import type { WatchOptions } from '@blaize-types/router';

// Create a mock chokidar watcher
const mockWatcher = {
  on: vi.fn(),
  close: vi.fn(),
};

// Mock chokidar
vi.mock('chokidar', () => ({
  watch: vi.fn(() => mockWatcher),
}));

// Mock dependencies
vi.mock('./cache', () => ({
  processChangedFile: vi.fn(),
  hasRouteContentChanged: vi.fn(),
}));

vi.mock('./finder', () => ({
  findRouteFiles: vi.fn(),
}));

vi.mock('node:path', async () => {
  const actual = await vi.importActual('node:path');
  return {
    ...actual,
    normalize: vi.fn((path: string) => path), // Simple passthrough for tests
  };
});

// Import the actual chokidar to get its types
// eslint-disable-next-line import/order
import { watch as chokidarWatch } from 'chokidar';

const mockChokidarWatch = vi.mocked(chokidarWatch);
const mockProcessChangedFile = vi.mocked(processChangedFile);
const mockHasRouteContentChanged = vi.mocked(hasRouteContentChanged);
const mockFindRouteFiles = vi.mocked(findRouteFiles);
const mockPathNormalize = vi.mocked(path.normalize);

describe('watchers.ts - File Watching', () => {
  const routesDir = '/test/routes';
  const mockRoute1 = { path: '/users', get: { handler: vi.fn() } };
  const mockRoute2 = { path: '/posts', get: { handler: vi.fn() } };

  // Simulate chokidar event handlers
  let addHandler: (filePath: string) => void;
  let changeHandler: (filePath: string) => void;
  let unlinkHandler: (filePath: string) => void;
  let errorHandler: (error: Error) => void;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Setup chokidar mock to capture event handlers
    mockWatcher.on.mockImplementation((event: string, handler: any) => {
      switch (event) {
        case 'add':
          addHandler = handler;
          break;
        case 'change':
          changeHandler = handler;
          break;
        case 'unlink':
          unlinkHandler = handler;
          break;
        case 'error':
          errorHandler = handler;
          break;
      }
      return mockWatcher;
    });

    mockWatcher.close.mockResolvedValue(undefined);
    mockChokidarWatch.mockReturnValue(mockWatcher as any);
    mockPathNormalize.mockImplementation((p: string) => p);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initialization', () => {
    it('should create watcher with correct options', () => {
      const options: WatchOptions = {
        debounceMs: 50,
        ignore: ['custom-ignore'],
      };

      watchRoutes(routesDir, options);

      expect(mockChokidarWatch).toHaveBeenCalledWith(routesDir, {
        awaitWriteFinish: {
          stabilityThreshold: 50,
          pollInterval: 10,
        },
        usePolling: false,
        atomic: true,
        followSymlinks: false,
        depth: 10,
        ignored: expect.arrayContaining([
          /(^|[/\\])\../,
          /node_modules/,
          /\.git/,
          /\.DS_Store/,
          /Thumbs\.db/,
          /\.(test|spec)\.(ts|js)$/,
          /\.d\.ts$/,
          /\.map$/,
          /~$/,
          'custom-ignore',
        ]),
      });
    });

    it('should register all event handlers', () => {
      watchRoutes(routesDir);

      expect(mockWatcher.on).toHaveBeenCalledWith('add', expect.any(Function));
      expect(mockWatcher.on).toHaveBeenCalledWith('change', expect.any(Function));
      expect(mockWatcher.on).toHaveBeenCalledWith('unlink', expect.any(Function));
      expect(mockWatcher.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should load initial routes on startup', async () => {
      const files = ['/test/routes/users.ts', '/test/routes/posts.ts'];
      mockFindRouteFiles.mockResolvedValue(files);
      mockProcessChangedFile.mockResolvedValue([mockRoute1]);

      watchRoutes(routesDir);

      // Wait for initial loading to complete
      await vi.waitFor(async () => {
        expect(mockFindRouteFiles).toHaveBeenCalledWith(routesDir, {
          ignore: undefined,
        });
      });
    });

    it('should handle initial loading errors gracefully', async () => {
      mockFindRouteFiles.mockRejectedValue(new Error('Directory not found'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      watchRoutes(routesDir);

      await vi.waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('⚠️ Route watcher error:', expect.any(Error));
      });

      consoleSpy.mockRestore();
    });
  });

  describe('file addition', () => {
    it('should handle new file addition', async () => {
      const onRouteAdded = vi.fn();
      mockProcessChangedFile.mockResolvedValue([mockRoute1]);

      watchRoutes(routesDir, { onRouteAdded });

      // Simulate file addition
      addHandler('/test/routes/users.ts');

      // Wait for debounce
      vi.advanceTimersByTime(16);

      await vi.waitFor(() => {
        expect(mockProcessChangedFile).toHaveBeenCalledTimes(2);
        expect(mockProcessChangedFile).toHaveBeenNthCalledWith(
          1,
          '/test/routes/users.ts',
          routesDir,
          false
        );
        expect(mockProcessChangedFile).toHaveBeenNthCalledWith(
          2,
          '/test/routes/users.ts',
          routesDir,
          true
        );
        expect(onRouteAdded).toHaveBeenCalledWith('/test/routes/users.ts', [mockRoute1]);
      });
    });

    it('should skip empty route files', async () => {
      const onRouteAdded = vi.fn();
      mockProcessChangedFile.mockResolvedValue([]); // Empty routes

      watchRoutes(routesDir, { onRouteAdded });

      addHandler('/test/routes/empty.ts');
      vi.advanceTimersByTime(16);

      await vi.waitFor(() => {
        expect(mockProcessChangedFile).toHaveBeenCalled();
        expect(onRouteAdded).not.toHaveBeenCalled();
      });
    });

    it('should handle file processing errors', async () => {
      const onError = vi.fn();
      mockProcessChangedFile.mockRejectedValue(new Error('Parse error'));

      watchRoutes(routesDir, { onError });

      addHandler('/test/routes/broken.ts');
      vi.advanceTimersByTime(16);

      await vi.waitFor(() => {
        expect(onError).toHaveBeenCalledWith(expect.any(Error));
      });
    });
  });

  describe('file changes', () => {
    it('should handle file content changes', async () => {
      const onRouteAdded = vi.fn();
      const onRouteChanged = vi.fn();

      mockProcessChangedFile.mockResolvedValue([mockRoute1]);
      mockHasRouteContentChanged.mockReturnValue(true);

      const _watcher = watchRoutes(routesDir, { onRouteAdded, onRouteChanged });

      // First add the file
      addHandler('/test/routes/users.ts');
      vi.advanceTimersByTime(16);

      await vi.waitFor(() => {
        expect(onRouteAdded).toHaveBeenCalledWith('/test/routes/users.ts', [mockRoute1]);
      });

      // Now change the file
      const modifiedRoute = { ...mockRoute1, post: { handler: vi.fn() } };
      mockProcessChangedFile.mockResolvedValue([modifiedRoute]);

      changeHandler('/test/routes/users.ts');
      vi.advanceTimersByTime(16);

      await vi.waitFor(() => {
        expect(onRouteChanged).toHaveBeenCalledWith('/test/routes/users.ts', [modifiedRoute]);
      });
    });

    it('should skip unchanged file content', async () => {
      const onRouteAdded = vi.fn();
      const onRouteChanged = vi.fn();

      mockProcessChangedFile.mockResolvedValue([mockRoute1]);
      mockHasRouteContentChanged.mockReturnValue(false); // No content change

      watchRoutes(routesDir, { onRouteAdded, onRouteChanged });

      // Add file first
      addHandler('/test/routes/users.ts');
      vi.advanceTimersByTime(16);

      await vi.waitFor(() => {
        expect(onRouteAdded).toHaveBeenCalledWith('/test/routes/users.ts', [mockRoute1]);
      });

      // Change file but content is the same
      changeHandler('/test/routes/users.ts');
      vi.advanceTimersByTime(16);

      await vi.waitFor(() => {
        expect(mockHasRouteContentChanged).toHaveBeenCalled();
        expect(onRouteChanged).not.toHaveBeenCalled();
      });
    });
  });

  describe('file removal', () => {
    it('should handle file removal', async () => {
      const onRouteAdded = vi.fn();
      const onRouteRemoved = vi.fn();

      mockProcessChangedFile.mockResolvedValue([mockRoute1]);

      const _watcher = watchRoutes(routesDir, { onRouteAdded, onRouteRemoved });

      // Add file first
      addHandler('/test/routes/users.ts');
      vi.advanceTimersByTime(16);

      await vi.waitFor(() => {
        expect(onRouteAdded).toHaveBeenCalledWith('/test/routes/users.ts', [mockRoute1]);
      });

      // Remove the file
      unlinkHandler('/test/routes/users.ts');
      vi.advanceTimersByTime(16);

      await vi.waitFor(() => {
        expect(onRouteRemoved).toHaveBeenCalledWith('/test/routes/users.ts', [mockRoute1]);
      });
    });

    it('should handle removal of non-existent files gracefully', async () => {
      const onRouteRemoved = vi.fn();

      watchRoutes(routesDir, { onRouteRemoved });

      unlinkHandler('/test/routes/nonexistent.ts');
      vi.advanceTimersByTime(16);

      await vi.waitFor(() => {
        // Should not call onRouteRemoved for non-existent files
        expect(onRouteRemoved).not.toHaveBeenCalled();
      });
    });

    it('should clean up internal state on file removal', async () => {
      mockProcessChangedFile.mockResolvedValue([mockRoute1]);

      const watcher = watchRoutes(routesDir);

      // Add file
      addHandler('/test/routes/users.ts');
      vi.advanceTimersByTime(16);

      await vi.waitFor(() => {
        // Wait for both processChangedFile calls (load without cache, then with cache)
        expect(mockProcessChangedFile).toHaveBeenCalledTimes(2);
      });

      // Verify file is tracked
      const routesBefore = watcher.getRoutes();
      expect(routesBefore).toContain(mockRoute1);

      // Clear mock calls for removal test
      mockProcessChangedFile.mockClear();

      // Remove file
      unlinkHandler('/test/routes/users.ts');
      vi.advanceTimersByTime(16);

      await vi.waitFor(() => {
        // After removal, the routes should no longer contain mockRoute1
        const routesAfter = watcher.getRoutes();
        expect(routesAfter).not.toContain(mockRoute1);
        expect(routesAfter).toHaveLength(0);
      });

      // Verify processChangedFile was NOT called during removal
      // (removal should only update internal state, not process the file)
      expect(mockProcessChangedFile).not.toHaveBeenCalled();
    });
  });

  describe('debouncing', () => {
    it('should debounce rapid file changes', async () => {
      const onRouteChanged = vi.fn();
      mockProcessChangedFile.mockResolvedValue([mockRoute1]);
      mockHasRouteContentChanged.mockReturnValue(true);

      watchRoutes(routesDir, { onRouteChanged, debounceMs: 50 });

      // STEP 1: First add the file so it exists in the watcher's internal tracking
      addHandler('/test/routes/users.ts');
      vi.advanceTimersByTime(50);

      await vi.waitFor(() => {
        // Wait for the file to be added (should call processChangedFile twice)
        expect(mockProcessChangedFile).toHaveBeenCalledTimes(2);
      });

      // Reset mocks for the change testing
      mockProcessChangedFile.mockClear();
      onRouteChanged.mockClear();

      // STEP 2: Now test rapid changes to the existing file
      // Rapid changes
      changeHandler('/test/routes/users.ts');
      changeHandler('/test/routes/users.ts');
      changeHandler('/test/routes/users.ts');

      // Only advance time partially
      vi.advanceTimersByTime(25);
      expect(onRouteChanged).toHaveBeenCalledTimes(0);

      // Complete the debounce period
      vi.advanceTimersByTime(50);

      await vi.waitFor(() => {
        // Should only process once due to debouncing
        expect(onRouteChanged).toHaveBeenCalledTimes(1);
        expect(onRouteChanged).toHaveBeenCalledWith('/test/routes/users.ts', [mockRoute1]);
      });
    });

    it('should handle per-file debouncing correctly', async () => {
      const onRouteChanged = vi.fn();
      mockProcessChangedFile.mockResolvedValue([mockRoute1]);
      mockHasRouteContentChanged.mockReturnValue(true);

      watchRoutes(routesDir, { onRouteChanged, debounceMs: 100 });

      // STEP 1: Add both files first so they exist in the watcher's tracking
      addHandler('/test/routes/users.ts');
      addHandler('/test/routes/posts.ts');
      vi.advanceTimersByTime(100);

      await vi.waitFor(() => {
        // Wait for both files to be added (2 calls each = 4 total)
        expect(mockProcessChangedFile).toHaveBeenCalledTimes(4);
      });

      // Reset for change testing
      onRouteChanged.mockClear();
      mockProcessChangedFile.mockClear();

      // STEP 2: Test debouncing on SAME file (should debounce to 1 call)
      changeHandler('/test/routes/users.ts');
      changeHandler('/test/routes/users.ts');
      changeHandler('/test/routes/users.ts');

      // Don't advance time yet - no calls should happen
      expect(onRouteChanged).toHaveBeenCalledTimes(0);

      // Now advance time to trigger debounce
      vi.advanceTimersByTime(100);

      await vi.waitFor(() => {
        expect(onRouteChanged).toHaveBeenCalledTimes(1); // Multiple changes = 1 call
      });

      // Reset and test different files process independently
      onRouteChanged.mockClear();

      // STEP 3: Change different files - each should process independently
      changeHandler('/test/routes/users.ts');
      changeHandler('/test/routes/posts.ts');

      // Advance time - both should process (different files = separate debouncing)
      vi.advanceTimersByTime(100);

      await vi.waitFor(() => {
        expect(onRouteChanged).toHaveBeenCalledTimes(2); // Different files = 2 calls
      });
    });

    it('should use default debounce time when not specified', async () => {
      const onRouteAdded = vi.fn();
      mockProcessChangedFile.mockResolvedValue([mockRoute1]);

      watchRoutes(routesDir, { onRouteAdded }); // No debounceMs specified

      addHandler('/test/routes/users.ts');

      // Should use default 16ms
      vi.advanceTimersByTime(16);

      await vi.waitFor(() => {
        expect(onRouteAdded).toHaveBeenCalled();
      });
    });
  });

  describe('error handling', () => {
    it('should call custom error handler when provided', async () => {
      const onError = vi.fn();
      const testError = new Error('Test error');

      watchRoutes(routesDir, { onError });

      errorHandler(testError);

      expect(onError).toHaveBeenCalledWith(testError);
    });

    it('should fallback to console.error when no custom handler', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const testError = new Error('Test error');

      watchRoutes(routesDir); // No error handler

      errorHandler(testError);

      expect(consoleSpy).toHaveBeenCalledWith('⚠️ Route watcher error:', testError);
      consoleSpy.mockRestore();
    });

    it('should handle non-Error objects gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      watchRoutes(routesDir);

      errorHandler('string error' as any);

      expect(consoleSpy).toHaveBeenCalledWith('⚠️ Route watcher error:', 'string error');
      consoleSpy.mockRestore();
    });
  });

  describe('watcher control methods', () => {
    it('should return correct routes from getRoutes', async () => {
      mockProcessChangedFile
        .mockResolvedValueOnce([mockRoute1])
        .mockResolvedValueOnce([mockRoute2]);

      const watcher = watchRoutes(routesDir);

      // Add multiple files
      addHandler('/test/routes/users.ts');
      addHandler('/test/routes/posts.ts');
      vi.advanceTimersByTime(16);

      await vi.waitFor(() => {
        const routes = watcher.getRoutes();
        expect(routes).toContain(mockRoute1);
        expect(routes).toContain(mockRoute2);
        expect(routes).toHaveLength(2);
      });
    });

    it('should return correct file-to-routes mapping', async () => {
      mockProcessChangedFile.mockResolvedValue([mockRoute1]);

      const watcher = watchRoutes(routesDir);

      addHandler('/test/routes/users.ts');
      vi.advanceTimersByTime(16);

      await vi.waitFor(() => {
        const routesByFile = watcher.getRoutesByFile();
        expect(routesByFile.get('/test/routes/users.ts')).toEqual([mockRoute1]);
      });
    });

    it('should properly close watcher and clean up', async () => {
      const watcher = watchRoutes(routesDir, { debounceMs: 100 });

      // Add some pending operations
      addHandler('/test/routes/users.ts');
      // Don't advance timers - leave operations pending

      await watcher.close();

      expect(mockWatcher.close).toHaveBeenCalled();

      // Advance timers after close - should not process pending operations
      vi.advanceTimersByTime(100);
      expect(mockProcessChangedFile).not.toHaveBeenCalled();
    });
  });

  describe('integration scenarios', () => {
    it('should handle complex file lifecycle', async () => {
      const onRouteAdded = vi.fn();
      const onRouteChanged = vi.fn();
      const onRouteRemoved = vi.fn();

      // Set up sequential mock responses for different stages
      mockProcessChangedFile
        .mockResolvedValueOnce([mockRoute1]) // 1st call: Initial add (without cache)
        .mockResolvedValueOnce([mockRoute1]) // 2nd call: Initial add (with cache)
        .mockResolvedValueOnce([mockRoute1, mockRoute2]) // 3rd call: Add route to file (without cache)
        .mockResolvedValueOnce([mockRoute1, mockRoute2]) // 4th call: Add route to file (with cache)
        .mockResolvedValueOnce([mockRoute2]) // 5th call: Remove route from file (without cache)
        .mockResolvedValueOnce([mockRoute2]); // 6th call: Remove route from file (with cache)

      mockHasRouteContentChanged.mockReturnValue(true);

      watchRoutes(routesDir, {
        onRouteAdded,
        onRouteChanged,
        onRouteRemoved,
      });

      // 1. Add file
      addHandler('/test/routes/users.ts');
      vi.advanceTimersByTime(16);

      await vi.waitFor(() => {
        expect(onRouteAdded).toHaveBeenCalledWith('/test/routes/users.ts', [mockRoute1]);
      });

      // Clear calls for next step
      onRouteAdded.mockClear();
      onRouteChanged.mockClear();

      // 2. Modify file (add route)
      changeHandler('/test/routes/users.ts');
      vi.advanceTimersByTime(16);

      await vi.waitFor(() => {
        expect(onRouteChanged).toHaveBeenCalledWith('/test/routes/users.ts', [
          mockRoute1,
          mockRoute2,
        ]);
      });

      // Clear calls for next step
      onRouteChanged.mockClear();

      // 3. Modify file again (remove route)
      changeHandler('/test/routes/users.ts');
      vi.advanceTimersByTime(16);

      await vi.waitFor(() => {
        expect(onRouteChanged).toHaveBeenCalledWith('/test/routes/users.ts', [mockRoute2]);
      });

      // Clear calls for final step
      onRouteChanged.mockClear();
      onRouteRemoved.mockClear();

      // 4. Remove file
      unlinkHandler('/test/routes/users.ts');
      vi.advanceTimersByTime(16);

      await vi.waitFor(() => {
        expect(onRouteRemoved).toHaveBeenCalledWith('/test/routes/users.ts', [mockRoute2]);
      });
    });

    it('should handle multiple files with different timing', async () => {
      const onRouteAdded = vi.fn();

      // Set up mock to return different routes based on which file is being processed
      mockProcessChangedFile.mockImplementation((filePath: string) => {
        if (filePath.includes('users.ts')) {
          return Promise.resolve([mockRoute1]);
        } else if (filePath.includes('posts.ts')) {
          return Promise.resolve([mockRoute2]);
        }
        return Promise.resolve([]);
      });

      watchRoutes(routesDir, { onRouteAdded, debounceMs: 50 });

      // Add first file and let it complete
      addHandler('/test/routes/users.ts');
      vi.advanceTimersByTime(50);

      await vi.waitFor(() => {
        expect(onRouteAdded).toHaveBeenCalledTimes(1);
        expect(onRouteAdded).toHaveBeenCalledWith('/test/routes/users.ts', [mockRoute1]);
      });

      // Clear calls for second file
      onRouteAdded.mockClear();

      // Now add second file after first is complete
      addHandler('/test/routes/posts.ts');
      vi.advanceTimersByTime(50);

      await vi.waitFor(() => {
        expect(onRouteAdded).toHaveBeenCalledTimes(1);
        expect(onRouteAdded).toHaveBeenCalledWith('/test/routes/posts.ts', [mockRoute2]);
      });
    });
  });
});
