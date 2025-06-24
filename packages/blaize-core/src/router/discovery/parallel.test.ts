import * as os from 'node:os';

import { processChangedFile } from './cache';
import { findRouteFiles } from './finder';
import { processFilesInParallel, loadInitialRoutesParallel } from './parallel';

// Mock dependencies
vi.mock('./cache', () => ({
  processChangedFile: vi.fn(),
}));

vi.mock('./finder', () => ({
  findRouteFiles: vi.fn(),
}));

vi.mock('node:os', () => ({
  cpus: vi.fn(),
}));

const mockProcessChangedFile = vi.mocked(processChangedFile);
const mockFindRouteFiles = vi.mocked(findRouteFiles);
const mockOsCpus = vi.mocked(os.cpus);

describe('parallel.ts - Parallel Processing', () => {
  const mockRoute1 = { path: '/users', get: { handler: vi.fn() } };
  const mockRoute2 = { path: '/posts', get: { handler: vi.fn() } };
  const mockRoute3 = { path: '/comments', get: { handler: vi.fn() } };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock 4 CPU cores by default
    mockOsCpus.mockReturnValue([{}, {}, {}, {}] as any);
  });

  describe('processFilesInParallel', () => {
    it('should process files concurrently', async () => {
      const files = ['/file1.ts', '/file2.ts', '/file3.ts'];
      const processor = vi
        .fn()
        .mockResolvedValueOnce([mockRoute1])
        .mockResolvedValueOnce([mockRoute2])
        .mockResolvedValueOnce([mockRoute3]);

      const result = await processFilesInParallel(files, processor, 2);

      expect(processor).toHaveBeenCalledTimes(3);
      expect(processor).toHaveBeenCalledWith('/file1.ts');
      expect(processor).toHaveBeenCalledWith('/file2.ts');
      expect(processor).toHaveBeenCalledWith('/file3.ts');
      expect(result).toEqual([[mockRoute1], [mockRoute2], [mockRoute3]]);
    });

    it('should handle processor failures gracefully', async () => {
      const files = ['/file1.ts', '/file2.ts', '/file3.ts'];
      const processor = vi
        .fn()
        .mockResolvedValueOnce([mockRoute1])
        .mockRejectedValueOnce(new Error('Failed to process'))
        .mockResolvedValueOnce([mockRoute3]);

      const result = await processFilesInParallel(files, processor, 2);

      expect(processor).toHaveBeenCalledTimes(3);
      expect(result).toEqual([[mockRoute1], [mockRoute3]]); // Only successful results
    });

    it('should respect concurrency limit', async () => {
      const files = ['/file1.ts', '/file2.ts', '/file3.ts', '/file4.ts'];
      let concurrentCalls = 0;
      let maxConcurrent = 0;

      const processor = vi.fn().mockImplementation(async (filePath: string) => {
        concurrentCalls++;
        maxConcurrent = Math.max(maxConcurrent, concurrentCalls);

        // Simulate async work
        await new Promise(resolve => setTimeout(resolve, 10));

        concurrentCalls--;
        return [{ path: filePath, get: { handler: vi.fn() } }];
      });

      await processFilesInParallel(files, processor, 2);

      // With concurrency of 2, we should never have more than 2 concurrent calls
      expect(maxConcurrent).toBeLessThanOrEqual(2);
      expect(processor).toHaveBeenCalledTimes(4);
    });

    it('should use default concurrency based on CPU count', async () => {
      const files = ['/file1.ts'];
      const processor = vi.fn().mockResolvedValue([mockRoute1]);

      // Mock 8 CPU cores with proper CpuInfo structure
      mockOsCpus.mockReturnValue(
        new Array(8).fill({
          model: 'Intel',
          speed: 2400,
          times: {
            user: 1000,
            nice: 0,
            sys: 1000,
            idle: 1000,
            irq: 0,
          },
        }) as os.CpuInfo[]
      );

      // We can't directly test the concurrency value, but we can verify the function works
      const result = await processFilesInParallel(files, processor);

      expect(processor).toHaveBeenCalledTimes(1);
      expect(result).toEqual([[mockRoute1]]);
      // The important thing is it doesn't throw and processes all files
    });

    it('should handle minimum concurrency of 1', async () => {
      const files = ['/file1.ts'];
      const processor = vi.fn().mockResolvedValue([mockRoute1]);

      // Mock single CPU core with proper CpuInfo structure
      mockOsCpus.mockReturnValue([
        {
          model: 'Intel',
          speed: 2400,
          times: {
            user: 1000,
            nice: 0,
            sys: 1000,
            idle: 1000,
            irq: 0,
          },
        },
      ] as os.CpuInfo[]);

      const result = await processFilesInParallel(files, processor);

      expect(processor).toHaveBeenCalledTimes(1);
      expect(result).toEqual([[mockRoute1]]);
      // Verifies it works with minimal CPU setup
    });

    it('should respect explicit concurrency over CPU detection', async () => {
      const files = ['/file1.ts', '/file2.ts'];
      const processor = vi
        .fn()
        .mockResolvedValueOnce([mockRoute1])
        .mockResolvedValueOnce([mockRoute2]);

      // Mock any number of CPUs - shouldn't matter when explicit concurrency provided
      mockOsCpus.mockReturnValue(
        new Array(16).fill({
          model: 'Intel',
          speed: 2400,
          times: { user: 1000, nice: 0, sys: 1000, idle: 1000, irq: 0 },
        }) as os.CpuInfo[]
      );

      const result = await processFilesInParallel(files, processor, 1); // Explicit concurrency

      expect(processor).toHaveBeenCalledTimes(2);
      expect(result).toEqual([[mockRoute1], [mockRoute2]]);
      // Should use explicit concurrency (1) regardless of CPU count (16)
    });

    it('should handle empty file list', async () => {
      const processor = vi.fn();

      const result = await processFilesInParallel([], processor, 2);

      expect(processor).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('should handle single file', async () => {
      const files = ['/file1.ts'];
      const processor = vi.fn().mockResolvedValue([mockRoute1]);

      const result = await processFilesInParallel(files, processor, 2);

      expect(processor).toHaveBeenCalledTimes(1);
      expect(processor).toHaveBeenCalledWith('/file1.ts');
      expect(result).toEqual([[mockRoute1]]);
    });

    it('should process chunks sequentially but files within chunks in parallel', async () => {
      const files = ['/file1.ts', '/file2.ts', '/file3.ts', '/file4.ts', '/file5.ts'];
      const callOrder: string[] = [];

      const processor = vi.fn().mockImplementation(async (filePath: string) => {
        callOrder.push(`start-${filePath}`);
        await new Promise(resolve => setTimeout(resolve, 10));
        callOrder.push(`end-${filePath}`);
        return [{ path: filePath, get: { handler: vi.fn() } }];
      });

      await processFilesInParallel(files, processor, 2);

      expect(processor).toHaveBeenCalledTimes(5);

      // Should have processed in chunks of 2
      // First chunk: file1, file2 (parallel)
      // Second chunk: file3, file4 (parallel)
      // Third chunk: file5 (alone)
      expect(callOrder).toContain('start-/file1.ts');
      expect(callOrder).toContain('start-/file2.ts');
      expect(callOrder).toContain('start-/file3.ts');
      expect(callOrder).toContain('start-/file4.ts');
      expect(callOrder).toContain('start-/file5.ts');
    });

    it('should handle all processors failing', async () => {
      const files = ['/file1.ts', '/file2.ts'];
      const processor = vi
        .fn()
        .mockRejectedValue(new Error('Failed 1'))
        .mockRejectedValue(new Error('Failed 2'));

      const result = await processFilesInParallel(files, processor, 2);

      expect(processor).toHaveBeenCalledTimes(2);
      expect(result).toEqual([]); // No successful results
    });

    it('should handle processor returning empty arrays', async () => {
      const files = ['/file1.ts', '/file2.ts'];
      const processor = vi
        .fn()
        .mockResolvedValueOnce([]) // Empty route array
        .mockResolvedValueOnce([mockRoute1]); // Use mockResolvedValueOnce for sequence

      const result = await processFilesInParallel(files, processor, 2);

      expect(result).toEqual([[], [mockRoute1]]);
    });
  });

  describe('loadInitialRoutesParallel', () => {
    const routesDir = '/test/routes';

    it('should load routes from directory in parallel', async () => {
      const files = ['/test/routes/file1.ts', '/test/routes/file2.ts'];

      mockFindRouteFiles.mockResolvedValue(files);
      mockProcessChangedFile
        .mockResolvedValueOnce([mockRoute1])
        .mockResolvedValueOnce([mockRoute2]);

      const result = await loadInitialRoutesParallel(routesDir);

      expect(mockFindRouteFiles).toHaveBeenCalledWith(routesDir);
      expect(mockProcessChangedFile).toHaveBeenCalledTimes(2);
      expect(mockProcessChangedFile).toHaveBeenCalledWith('/test/routes/file1.ts', routesDir);
      expect(mockProcessChangedFile).toHaveBeenCalledWith('/test/routes/file2.ts', routesDir);
      expect(result).toEqual([mockRoute1, mockRoute2]);
    });

    it('should handle empty directories', async () => {
      mockFindRouteFiles.mockResolvedValue([]);

      const result = await loadInitialRoutesParallel('/empty/dir');

      expect(mockFindRouteFiles).toHaveBeenCalledWith('/empty/dir');
      expect(result).toEqual([]);
      expect(mockProcessChangedFile).not.toHaveBeenCalled();
    });

    it('should flatten nested route arrays', async () => {
      const files = ['/file1.ts', '/file2.ts'];

      mockFindRouteFiles.mockResolvedValue(files);
      mockProcessChangedFile
        .mockResolvedValueOnce([mockRoute1, mockRoute2]) // Multiple routes in one file
        .mockResolvedValueOnce([mockRoute3]); // Single route in another file

      const result = await loadInitialRoutesParallel(routesDir);

      expect(result).toEqual([mockRoute1, mockRoute2, mockRoute3]);
    });

    it('should handle file processing errors gracefully', async () => {
      const files = ['/file1.ts', '/file2.ts', '/file3.ts'];

      mockFindRouteFiles.mockResolvedValue(files);
      mockProcessChangedFile
        .mockResolvedValueOnce([mockRoute1])
        .mockRejectedValueOnce(new Error('File error'))
        .mockResolvedValueOnce([mockRoute3]);

      const result = await loadInitialRoutesParallel(routesDir);

      expect(result).toEqual([mockRoute1, mockRoute3]); // Only successful files
    });

    it('should handle findRouteFiles error', async () => {
      mockFindRouteFiles.mockRejectedValue(new Error('Directory not found'));

      await expect(loadInitialRoutesParallel('/nonexistent')).rejects.toThrow(
        'Directory not found'
      );
    });

    it('should work with files that return empty route arrays', async () => {
      const files = ['/file1.ts', '/file2.ts'];

      mockFindRouteFiles.mockResolvedValue(files);
      mockProcessChangedFile
        .mockResolvedValueOnce([]) // Empty routes
        .mockResolvedValueOnce([mockRoute1]); // Has routes

      const result = await loadInitialRoutesParallel(routesDir);

      expect(result).toEqual([mockRoute1]);
    });

    it('should use optimal concurrency for large numbers of files', async () => {
      // Create 20 files to test chunking behavior
      const files = Array.from({ length: 20 }, (_, i) => `/file${i}.ts`);

      mockFindRouteFiles.mockResolvedValue(files);
      mockProcessChangedFile.mockImplementation(async filePath => {
        return [{ path: filePath, get: { handler: vi.fn() } }];
      });

      const result = await loadInitialRoutesParallel(routesDir);

      expect(mockProcessChangedFile).toHaveBeenCalledTimes(20);
      expect(result).toHaveLength(20);
    });
  });

  describe('chunkArray (via processFilesInParallel)', () => {
    it('should chunk array correctly', async () => {
      const files = ['a', 'b', 'c', 'd', 'e'];
      const processor = vi.fn().mockImplementation(async file => [file]);

      await processFilesInParallel(files, processor, 2);

      // Should be called 5 times total (all files processed)
      expect(processor).toHaveBeenCalledTimes(5);
    });

    it('should handle array smaller than chunk size', async () => {
      const files = ['a', 'b'];
      const processor = vi.fn().mockImplementation(async file => [file]);

      await processFilesInParallel(files, processor, 5);

      expect(processor).toHaveBeenCalledTimes(2);
    });

    it('should handle exact chunk size multiples', async () => {
      const files = ['a', 'b', 'c', 'd'];
      const processor = vi.fn().mockImplementation(async file => [file]);

      await processFilesInParallel(files, processor, 2);

      expect(processor).toHaveBeenCalledTimes(4);
    });
  });

  describe('performance characteristics', () => {
    it('should complete faster with higher concurrency for I/O bound tasks', async () => {
      const files = Array.from({ length: 10 }, (_, i) => `/file${i}.ts`);

      const slowProcessor = vi.fn().mockImplementation(async file => {
        await new Promise(resolve => setTimeout(resolve, 50)); // Simulate I/O
        return [{ path: file, get: { handler: vi.fn() } }];
      });

      // Test with low concurrency
      const start1 = Date.now();
      await processFilesInParallel([...files], slowProcessor, 1);
      const time1 = Date.now() - start1;

      // Reset mock
      slowProcessor.mockClear();

      // Test with higher concurrency
      const start2 = Date.now();
      await processFilesInParallel([...files], slowProcessor, 5);
      const time2 = Date.now() - start2;

      // Higher concurrency should be faster (with some tolerance)
      expect(time2).toBeLessThan(time1 * 0.8);
    });

    it('should handle CPU-bound tasks appropriately', async () => {
      const files = ['/file1.ts', '/file2.ts'];

      const cpuBoundProcessor = vi.fn().mockImplementation(async file => {
        // Simulate some CPU work
        let sum = 0;
        for (let i = 0; i < 1000; i++) {
          sum += Math.random();
        }
        return [{ path: file, computedValue: sum }];
      });

      const result = await processFilesInParallel(files, cpuBoundProcessor, 2);

      expect(result).toHaveLength(2);
      expect(cpuBoundProcessor).toHaveBeenCalledTimes(2);
    });
  });
});
