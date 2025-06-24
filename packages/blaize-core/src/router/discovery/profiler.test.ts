import {
  trackReloadPerformance,
  getReloadMetrics,
  resetReloadMetrics,
  withPerformanceTracking,
} from './profiler';

describe('profiler.ts - Performance Tracking', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let originalNodeEnv: string | undefined;

  beforeEach(() => {
    resetReloadMetrics();
    vi.clearAllMocks();

    // Mock console.log to test development logging
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Store original NODE_ENV
    originalNodeEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    consoleSpy.mockRestore();

    // Restore original NODE_ENV
    if (originalNodeEnv !== undefined) {
      process.env.NODE_ENV = originalNodeEnv;
    } else {
      delete process.env.NODE_ENV;
    }
  });

  describe('trackReloadPerformance', () => {
    it('should track basic reload metrics', () => {
      const startTime = Date.now() - 50; // 50ms ago

      trackReloadPerformance('/test/file.ts', startTime);

      const metrics = getReloadMetrics();
      expect(metrics.fileChanges).toBe(1);
      expect(metrics.totalReloadTime).toBeGreaterThan(40);
      expect(metrics.totalReloadTime).toBeLessThan(60);
      expect(metrics.averageReloadTime).toBe(metrics.totalReloadTime);
    });

    it('should accumulate multiple reloads', () => {
      const now = Date.now();

      trackReloadPerformance('/file1.ts', now - 50); // 50ms
      trackReloadPerformance('/file2.ts', now - 30); // 30ms

      const metrics = getReloadMetrics();
      expect(metrics.fileChanges).toBe(2);
      expect(metrics.totalReloadTime).toBeGreaterThan(70);
      expect(metrics.totalReloadTime).toBeLessThan(90);
      expect(metrics.averageReloadTime).toBeCloseTo(40, 0); // ~40ms average
    });

    it('should calculate average reload time correctly', () => {
      const now = Date.now();

      trackReloadPerformance('/file1.ts', now - 100); // 100ms
      trackReloadPerformance('/file2.ts', now - 50); // 50ms
      trackReloadPerformance('/file3.ts', now - 75); // 75ms

      const metrics = getReloadMetrics();
      expect(metrics.fileChanges).toBe(3);
      expect(metrics.averageReloadTime).toBeCloseTo(75, 0); // (100+50+75)/3 = 75
    });

    it('should track slow reloads (>100ms)', () => {
      const now = Date.now();

      trackReloadPerformance('/slow1.ts', now - 150); // 150ms (slow)
      trackReloadPerformance('/fast.ts', now - 50); // 50ms (fast)
      trackReloadPerformance('/slow2.ts', now - 200); // 200ms (slow)

      const metrics = getReloadMetrics();
      expect(metrics.slowReloads).toHaveLength(2);

      // Use non-null assertion since we just verified length
      expect(metrics.slowReloads[0]!.file).toBe('/slow1.ts');
      expect(metrics.slowReloads[0]!.time).toBeGreaterThan(140);
      expect(metrics.slowReloads[1]!.file).toBe('/slow2.ts');
      expect(metrics.slowReloads[1]!.time).toBeGreaterThan(190);
    });

    it('should limit slow reloads to 10 entries', () => {
      const now = Date.now();

      // Add 12 slow reloads (>100ms each)
      for (let i = 0; i < 12; i++) {
        trackReloadPerformance(`/slow${i}.ts`, now - 150);
      }

      const metrics = getReloadMetrics();
      expect(metrics.slowReloads).toHaveLength(10); // Should be capped at 10

      // Should keep the most recent 10 (slow2 through slow11)
      expect(metrics.slowReloads[0]!.file).toBe('/slow2.ts'); // First entry after shift
      expect(metrics.slowReloads[9]!.file).toBe('/slow11.ts'); // Last entry
    });

    it('should only track fast reloads in metrics, not slowReloads array', () => {
      const now = Date.now();

      trackReloadPerformance('/fast1.ts', now - 30); // 30ms
      trackReloadPerformance('/fast2.ts', now - 50); // 50ms
      trackReloadPerformance('/fast3.ts', now - 80); // 80ms

      const metrics = getReloadMetrics();
      expect(metrics.fileChanges).toBe(3);
      expect(metrics.slowReloads).toHaveLength(0); // No slow reloads
      expect(metrics.averageReloadTime).toBeLessThan(100);
    });

    describe('development logging', () => {
      it('should log with fast emoji for <50ms reloads', () => {
        process.env.NODE_ENV = 'development';

        trackReloadPerformance('/fast.ts', Date.now() - 30);

        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('⚡ Route reload: /fast.ts (')
        );
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('ms)'));
      });

      it('should log with reload emoji for 50-100ms reloads', () => {
        process.env.NODE_ENV = 'development';

        trackReloadPerformance('/medium.ts', Date.now() - 75);

        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('🔄 Route reload: /medium.ts (')
        );
      });

      it('should log with slow emoji for >100ms reloads', () => {
        process.env.NODE_ENV = 'development';

        trackReloadPerformance('/slow.ts', Date.now() - 150);

        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('🐌 Route reload: /slow.ts (')
        );
      });

      it('should not log in production', () => {
        process.env.NODE_ENV = 'production';

        trackReloadPerformance('/file.ts', Date.now() - 50);

        expect(consoleSpy).not.toHaveBeenCalled();
      });

      it('should not log when NODE_ENV is undefined', () => {
        delete process.env.NODE_ENV;

        trackReloadPerformance('/file.ts', Date.now() - 50);

        expect(consoleSpy).not.toHaveBeenCalled();
      });
    });
  });

  describe('getReloadMetrics', () => {
    it('should return immutable copy of metrics', () => {
      trackReloadPerformance('/file.ts', Date.now() - 50);

      const metrics1 = getReloadMetrics();
      const metrics2 = getReloadMetrics();

      // Should be equal but not same reference
      expect(metrics1).toEqual(metrics2);
      expect(metrics1).not.toBe(metrics2);

      // Since returned object is readonly, we can't test mutation directly
      // Instead, test that we get fresh copies each time
      const metrics3 = getReloadMetrics();
      expect(metrics3.fileChanges).toBe(1); // Should still be 1
      expect(metrics3).toEqual(metrics1); // Should be identical to first call
    });

    it('should return readonly-typed metrics', () => {
      const metrics = getReloadMetrics();

      // TypeScript should prevent mutation (compile-time check)
      // This is more of a type-level test
      expect(typeof metrics.fileChanges).toBe('number');
      expect(typeof metrics.totalReloadTime).toBe('number');
      expect(typeof metrics.averageReloadTime).toBe('number');
      expect(Array.isArray(metrics.slowReloads)).toBe(true);
    });

    it('should handle empty state correctly', () => {
      const metrics = getReloadMetrics();

      expect(metrics.fileChanges).toBe(0);
      expect(metrics.totalReloadTime).toBe(0);
      expect(metrics.averageReloadTime).toBe(0);
      expect(metrics.slowReloads).toEqual([]);
    });
  });

  describe('resetReloadMetrics', () => {
    it('should reset all metrics to initial state', () => {
      const now = Date.now();

      // Add some metrics
      trackReloadPerformance('/file1.ts', now - 100);
      trackReloadPerformance('/file2.ts', now - 200);
      trackReloadPerformance('/file3.ts', now - 150);

      // Verify metrics exist
      let metrics = getReloadMetrics();
      expect(metrics.fileChanges).toBe(3);
      expect(metrics.totalReloadTime).toBeGreaterThan(0);
      expect(metrics.slowReloads.length).toBeGreaterThan(0);

      // Reset and verify clean state
      resetReloadMetrics();
      metrics = getReloadMetrics();

      expect(metrics.fileChanges).toBe(0);
      expect(metrics.totalReloadTime).toBe(0);
      expect(metrics.averageReloadTime).toBe(0);
      expect(metrics.slowReloads).toEqual([]);
    });

    it('should allow metrics tracking to continue after reset', () => {
      // Track some metrics
      trackReloadPerformance('/file1.ts', Date.now() - 50);

      // Reset
      resetReloadMetrics();

      // Track new metrics
      trackReloadPerformance('/file2.ts', Date.now() - 75);

      const metrics = getReloadMetrics();
      expect(metrics.fileChanges).toBe(1); // Should start fresh
      expect(metrics.averageReloadTime).toBeCloseTo(75, 0);
    });
  });

  describe('withPerformanceTracking', () => {
    it('should track performance of async function', async () => {
      const asyncFn = vi.fn().mockImplementation(async (arg1: string, arg2: number) => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return `${arg1}-${arg2}`;
      });

      const trackedFn = withPerformanceTracking(asyncFn, '/test/file.ts');
      const result = await trackedFn('hello', 42);

      expect(result).toBe('hello-42');
      expect(asyncFn).toHaveBeenCalledWith('hello', 42);

      const metrics = getReloadMetrics();
      expect(metrics.fileChanges).toBe(1);
      expect(metrics.averageReloadTime).toBeGreaterThan(40);
    });

    it('should preserve function signature and types', async () => {
      const typedFn = async (str: string, num: number): Promise<string> => {
        return `${str}:${num}`;
      };

      const trackedFn = withPerformanceTracking(typedFn, '/test.ts');

      // Should maintain type safety
      const result = await trackedFn('test', 123);
      expect(result).toBe('test:123');
      expect(typeof result).toBe('string');
    });

    it('should track performance even when function throws', async () => {
      const errorFn = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 30));
        throw new Error('Test error');
      });

      const trackedFn = withPerformanceTracking(errorFn, '/test/file.ts');

      await expect(trackedFn()).rejects.toThrow('Test error');
      expect(errorFn).toHaveBeenCalled();

      const metrics = getReloadMetrics();
      expect(metrics.fileChanges).toBe(1);
      expect(metrics.averageReloadTime).toBeGreaterThan(25);
    });

    it('should handle synchronous errors correctly', async () => {
      const syncErrorFn = vi.fn().mockImplementation(async () => {
        throw new Error('Immediate error');
      });

      const trackedFn = withPerformanceTracking(syncErrorFn, '/test/file.ts');

      await expect(trackedFn()).rejects.toThrow('Immediate error');

      const metrics = getReloadMetrics();
      expect(metrics.fileChanges).toBe(1);
      expect(metrics.averageReloadTime).toBeGreaterThanOrEqual(0);
    });

    it('should handle multiple tracked functions independently', async () => {
      const fn1 = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 30));
        return 'result1';
      });

      const fn2 = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 70));
        return 'result2';
      });

      const tracked1 = withPerformanceTracking(fn1, '/file1.ts');
      const tracked2 = withPerformanceTracking(fn2, '/file2.ts');

      const [result1, result2] = await Promise.all([tracked1(), tracked2()]);

      expect(result1).toBe('result1');
      expect(result2).toBe('result2');

      const metrics = getReloadMetrics();
      expect(metrics.fileChanges).toBe(2);
      // Allow for timing variance - real async operations have overhead
      expect(metrics.averageReloadTime).toBeGreaterThan(30);
      expect(metrics.averageReloadTime).toBeLessThan(120); // Should be roughly ~50 ± timing variance
    });

    it('should pass through all function arguments correctly', async () => {
      const complexFn = vi
        .fn()
        .mockImplementation(
          async (str: string, num: number, obj: { key: string }, arr: number[]) => {
            return { str, num, obj, arr };
          }
        );

      const trackedFn = withPerformanceTracking(complexFn, '/test.ts');
      const testObj = { key: 'value' };
      const testArr = [1, 2, 3];

      const result = await trackedFn('test', 42, testObj, testArr);

      expect(complexFn).toHaveBeenCalledWith('test', 42, testObj, testArr);
      expect(result).toEqual({
        str: 'test',
        num: 42,
        obj: testObj,
        arr: testArr,
      });
    });
  });

  describe('edge cases and timing', () => {
    it('should handle very fast operations (0ms)', () => {
      const exactNow = Date.now();

      trackReloadPerformance('/instant.ts', exactNow);

      const metrics = getReloadMetrics();
      expect(metrics.fileChanges).toBe(1);
      expect(metrics.averageReloadTime).toBeGreaterThanOrEqual(0);
      expect(metrics.slowReloads).toHaveLength(0);
    });

    it('should handle exactly 100ms (boundary case)', () => {
      trackReloadPerformance('/boundary.ts', Date.now() - 100);

      const metrics = getReloadMetrics();
      expect(metrics.slowReloads).toHaveLength(0); // 100ms is not > 100ms
    });

    it('should handle exactly 101ms (just over boundary)', () => {
      trackReloadPerformance('/just-slow.ts', Date.now() - 101);

      const metrics = getReloadMetrics();
      expect(metrics.slowReloads).toHaveLength(1); // 101ms is > 100ms
    });

    it('should handle negative durations gracefully', () => {
      // This could happen with clock adjustments
      trackReloadPerformance('/future.ts', Date.now() + 1000);

      const metrics = getReloadMetrics();
      expect(metrics.fileChanges).toBe(1);
      expect(metrics.totalReloadTime).toBeLessThanOrEqual(0);
      expect(metrics.slowReloads).toHaveLength(0); // Negative time not > 100
    });

    it('should handle very large durations', () => {
      trackReloadPerformance('/very-slow.ts', Date.now() - 5000); // 5 seconds

      const metrics = getReloadMetrics();
      expect(metrics.fileChanges).toBe(1);
      expect(metrics.averageReloadTime).toBeGreaterThan(4900);
      expect(metrics.slowReloads).toHaveLength(1);
      expect(metrics.slowReloads[0]!.time).toBeGreaterThan(4900);
    });
  });
});
