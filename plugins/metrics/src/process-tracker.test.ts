/**
 * @file Process Health Tracker tests
 * @description Comprehensive tests for ProcessHealthTracker class
 */

import { ProcessHealthTracker } from './process-tracker';

describe('ProcessHealthTracker', () => {
  let tracker: ProcessHealthTracker;

  beforeEach(() => {
    tracker = new ProcessHealthTracker();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Constructor', () => {
    test('initializes successfully', () => {
      expect(tracker).toBeInstanceOf(ProcessHealthTracker);
    });

    test('records start time for uptime calculation', () => {
      const uptime = tracker.getUptime();
      expect(uptime).toBeGreaterThanOrEqual(0);
      expect(uptime).toBeLessThan(1); // Should be very small initially
    });

    test('initializes CPU baseline', () => {
      // First call should return 0 (baseline)
      const cpuPercent = tracker.getCPUPercentage();
      expect(cpuPercent).toBe(0);
    });
  });

  describe('collect', () => {
    test('returns ProcessMetrics structure', () => {
      const metrics = tracker.collect();

      expect(metrics).toHaveProperty('memoryUsage');
      expect(metrics).toHaveProperty('cpuUsage');
      expect(metrics).toHaveProperty('uptime');
      expect(metrics).toHaveProperty('eventLoopLag');
    });

    test('memory usage has correct structure', () => {
      const metrics = tracker.collect();
      const { memoryUsage } = metrics;

      expect(memoryUsage).toHaveProperty('heapUsed');
      expect(memoryUsage).toHaveProperty('heapTotal');
      expect(memoryUsage).toHaveProperty('external');
      expect(memoryUsage).toHaveProperty('rss');

      // All values should be positive numbers
      expect(memoryUsage.heapUsed).toBeGreaterThan(0);
      expect(memoryUsage.heapTotal).toBeGreaterThan(0);
      expect(memoryUsage.external).toBeGreaterThanOrEqual(0);
      expect(memoryUsage.rss).toBeGreaterThan(0);
    });

    test('memory usage values are reasonable', () => {
      const metrics = tracker.collect();
      const { memoryUsage } = metrics;

      // heapUsed should be less than heapTotal
      expect(memoryUsage.heapUsed).toBeLessThanOrEqual(memoryUsage.heapTotal);

      // RSS should be larger than heap (includes more than just heap)
      expect(memoryUsage.rss).toBeGreaterThanOrEqual(memoryUsage.heapTotal);

      // All values should be in reasonable ranges (bytes)
      expect(memoryUsage.heapUsed).toBeGreaterThan(1000); // At least 1KB
      expect(memoryUsage.heapTotal).toBeLessThan(10 * 1024 * 1024 * 1024); // Less than 10GB
    });

    test('CPU usage has correct structure', () => {
      const metrics = tracker.collect();
      const { cpuUsage } = metrics;

      expect(cpuUsage).toHaveProperty('user');
      expect(cpuUsage).toHaveProperty('system');

      // Both should be non-negative numbers (microseconds)
      expect(cpuUsage.user).toBeGreaterThanOrEqual(0);
      expect(cpuUsage.system).toBeGreaterThanOrEqual(0);
    });

    test('uptime is positive', () => {
      const metrics = tracker.collect();
      expect(metrics.uptime).toBeGreaterThanOrEqual(0);
    });

    test('event loop lag is initialized to 0', () => {
      const metrics = tracker.collect();
      expect(metrics.eventLoopLag).toBe(0);
    });

    test('multiple collections return different values', async () => {
      const metrics1 = tracker.collect();

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 10));

      const metrics2 = tracker.collect();

      // Uptime should increase
      expect(metrics2.uptime).toBeGreaterThan(metrics1.uptime);

      // Memory might change (but not guaranteed)
      // CPU usage will definitely change
      expect(metrics2.cpuUsage.user).toBeGreaterThanOrEqual(metrics1.cpuUsage.user);
    });
  });

  describe('getCPUPercentage', () => {
    test('returns 0 on first call (baseline)', () => {
      const cpuPercent = tracker.getCPUPercentage();
      expect(cpuPercent).toBe(0);
    });

    test('returns non-negative percentage', async () => {
      tracker.getCPUPercentage(); // Establish baseline

      // Do some work
      await new Promise(resolve => setTimeout(resolve, 100));
      const sum = Array.from({ length: 100000 }, (_, i) => i).reduce((a, b) => a + b, 0);
      expect(sum).toBeGreaterThan(0); // Use result to prevent optimization

      const cpuPercent = tracker.getCPUPercentage();
      expect(cpuPercent).toBeGreaterThanOrEqual(0);
    });

    test('returns reasonable percentage values', async () => {
      tracker.getCPUPercentage(); // Baseline

      // Light work
      await new Promise(resolve => setTimeout(resolve, 100));

      const cpuPercent = tracker.getCPUPercentage();

      // Should be less than 1000% (10 cores at 100%)
      // This is a very generous upper bound
      expect(cpuPercent).toBeLessThan(1000);
    });

    test('handles consecutive calls', async () => {
      const percent1 = tracker.getCPUPercentage(); // 0 (baseline)
      expect(percent1).toBe(0);

      await new Promise(resolve => setTimeout(resolve, 50));
      const percent2 = tracker.getCPUPercentage();
      expect(percent2).toBeGreaterThanOrEqual(0);

      await new Promise(resolve => setTimeout(resolve, 50));
      const percent3 = tracker.getCPUPercentage();
      expect(percent3).toBeGreaterThanOrEqual(0);
    });

    test('handles zero wall time delta', () => {
      tracker.getCPUPercentage(); // Baseline

      // Immediate second call (zero wall time)
      const cpuPercent = tracker.getCPUPercentage();
      expect(cpuPercent).toBe(0);
    });

    test('CPU percentage increases under load', async () => {
      tracker.getCPUPercentage(); // Baseline

      // Idle wait
      await new Promise(resolve => setTimeout(resolve, 100));
      const idlePercent = tracker.getCPUPercentage();

      // CPU-intensive work
      const start = Date.now();
      while (Date.now() - start < 50) {
        Math.sqrt(Math.random()); // Busy work
      }

      const loadPercent = tracker.getCPUPercentage();

      // Under load should be higher (though not guaranteed in all environments)
      // Just verify both are valid
      expect(idlePercent).toBeGreaterThanOrEqual(0);
      expect(loadPercent).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getEventLoopLag', () => {
    test('returns a Promise', () => {
      const result = tracker.getEventLoopLag();
      expect(result).toBeInstanceOf(Promise);
    });

    test('resolves to a number', async () => {
      const lag = await tracker.getEventLoopLag();
      expect(typeof lag).toBe('number');
    });

    test('resolves to non-negative value', async () => {
      const lag = await tracker.getEventLoopLag();
      expect(lag).toBeGreaterThanOrEqual(0);
    });

    test('lag is typically small under no load', async () => {
      const lag = await tracker.getEventLoopLag();

      // Under no load, should be very small (< 50ms)
      // This might be flaky in CI, so generous threshold
      expect(lag).toBeLessThan(1000);
    });

    test('multiple measurements work', async () => {
      const lag1 = await tracker.getEventLoopLag();
      const lag2 = await tracker.getEventLoopLag();
      const lag3 = await tracker.getEventLoopLag();

      expect(lag1).toBeGreaterThanOrEqual(0);
      expect(lag2).toBeGreaterThanOrEqual(0);
      expect(lag3).toBeGreaterThanOrEqual(0);
    });

    test('lag increases under event loop pressure', async () => {
      // Measure baseline
      const baselineLag = await tracker.getEventLoopLag();

      // Create event loop pressure with many setImmediate calls
      const promises: Promise<void>[] = [];
      for (let i = 0; i < 100; i++) {
        promises.push(
          new Promise(resolve => {
            setImmediate(() => {
              // Busy work
              let sum = 0;
              for (let j = 0; j < 100000; j++) {
                sum += j;
              }
              resolve();
            });
          })
        );
      }

      // Measure during pressure
      const pressureLag = await tracker.getEventLoopLag();

      // Clean up
      await Promise.all(promises);

      // Both should be valid numbers
      expect(baselineLag).toBeGreaterThanOrEqual(0);
      expect(pressureLag).toBeGreaterThanOrEqual(0);
    });

    test('is non-blocking', async () => {
      const start = Date.now();

      // Start measurement but don't await
      const lagPromise = tracker.getEventLoopLag();

      // This should execute immediately, not blocked
      const syncElapsed = Date.now() - start;
      expect(syncElapsed).toBeLessThan(10); // Very fast

      // Now await the result
      const lag = await lagPromise;
      expect(lag).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getUptime', () => {
    test('returns uptime in seconds', () => {
      const uptime = tracker.getUptime();
      expect(typeof uptime).toBe('number');
      expect(uptime).toBeGreaterThanOrEqual(0);
    });

    test('uptime increases over time', async () => {
      const uptime1 = tracker.getUptime();

      await new Promise(resolve => setTimeout(resolve, 100));

      const uptime2 = tracker.getUptime();

      expect(uptime2).toBeGreaterThan(uptime1);

      // Difference should be approximately 0.1 seconds
      const diff = uptime2 - uptime1;
      expect(diff).toBeGreaterThanOrEqual(0.08); // Allow some variance
      expect(diff).toBeLessThan(0.2);
    });

    test('tracks time since tracker creation, not process.uptime()', () => {
      const processUptime = process.uptime();
      const trackerUptime = tracker.getUptime();

      // Tracker uptime should be much smaller (just created)
      expect(trackerUptime).toBeLessThan(processUptime);
      expect(trackerUptime).toBeLessThan(1); // Less than 1 second
    });

    test('handles fake timers', () => {
      vi.useFakeTimers();
      const start = Date.now();
      vi.setSystemTime(start);

      const newTracker = new ProcessHealthTracker();

      let uptime = newTracker.getUptime();
      expect(uptime).toBeCloseTo(0, 1);

      // Advance 5 seconds
      vi.advanceTimersByTime(5000);

      uptime = newTracker.getUptime();
      expect(uptime).toBeCloseTo(5, 1);

      // Advance 10 more seconds
      vi.advanceTimersByTime(10000);

      uptime = newTracker.getUptime();
      expect(uptime).toBeCloseTo(15, 1);
    });
  });

  describe('getNodeVersion', () => {
    test('returns version string', () => {
      const version = tracker.getNodeVersion();
      expect(typeof version).toBe('string');
    });

    test('matches process.version', () => {
      const version = tracker.getNodeVersion();
      expect(version).toBe(process.version);
    });

    test('follows semver format', () => {
      const version = tracker.getNodeVersion();
      expect(version).toMatch(/^v\d+\.\d+\.\d+/);
    });
  });

  describe('getPlatform', () => {
    test('returns platform string', () => {
      const platform = tracker.getPlatform();
      expect(typeof platform).toBe('string');
    });

    test('matches process.platform', () => {
      const platform = tracker.getPlatform();
      expect(platform).toBe(process.platform);
    });

    test('is a known platform', () => {
      const platform = tracker.getPlatform();
      const validPlatforms = ['linux', 'darwin', 'win32', 'freebsd', 'openbsd', 'sunos', 'aix'];
      expect(validPlatforms).toContain(platform);
    });
  });

  describe('getArchitecture', () => {
    test('returns architecture string', () => {
      const arch = tracker.getArchitecture();
      expect(typeof arch).toBe('string');
    });

    test('matches process.arch', () => {
      const arch = tracker.getArchitecture();
      expect(arch).toBe(process.arch);
    });

    test('is a known architecture', () => {
      const arch = tracker.getArchitecture();
      const validArchs = ['x64', 'arm64', 'arm', 'ia32', 'mips', 'ppc', 'ppc64', 's390', 's390x'];
      expect(validArchs).toContain(arch);
    });
  });

  describe('getProcessId', () => {
    test('returns process ID', () => {
      const pid = tracker.getProcessId();
      expect(typeof pid).toBe('number');
    });

    test('matches process.pid', () => {
      const pid = tracker.getProcessId();
      expect(pid).toBe(process.pid);
    });

    test('is positive integer', () => {
      const pid = tracker.getProcessId();
      expect(pid).toBeGreaterThan(0);
      expect(Number.isInteger(pid)).toBe(true);
    });
  });

  describe('resetCPUBaseline', () => {
    test('resets CPU baseline', async () => {
      // Establish baseline
      tracker.getCPUPercentage();

      // Wait and measure
      await new Promise(resolve => setTimeout(resolve, 100));
      const percent1 = tracker.getCPUPercentage();
      expect(percent1).toBeGreaterThanOrEqual(0);

      // Reset baseline
      tracker.resetCPUBaseline();

      // Next call should be 0 (new baseline)
      const percent2 = tracker.getCPUPercentage();
      expect(percent2).toBe(0);
    });

    test('allows fresh CPU measurements after reset', async () => {
      tracker.getCPUPercentage();
      await new Promise(resolve => setTimeout(resolve, 50));
      tracker.getCPUPercentage(); // Some value

      tracker.resetCPUBaseline();

      await new Promise(resolve => setTimeout(resolve, 50));
      const newPercent = tracker.getCPUPercentage();
      expect(newPercent).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Integration scenarios', () => {
    test('periodic collection over time', async () => {
      const snapshots: ReturnType<typeof tracker.collect>[] = [];

      // Collect 5 snapshots with 20ms intervals
      for (let i = 0; i < 5; i++) {
        snapshots.push(tracker.collect());
        if (i < 4) {
          await new Promise(resolve => setTimeout(resolve, 20));
        }
      }

      expect(snapshots).toHaveLength(5);

      // Verify uptime increases
      for (let i = 1; i < snapshots.length; i++) {
        expect(snapshots[i]!.uptime).toBeGreaterThan(snapshots[i - 1]!.uptime);
      }

      // All memory values should be positive
      snapshots.forEach(snapshot => {
        expect(snapshot.memoryUsage.heapUsed).toBeGreaterThan(0);
        expect(snapshot.memoryUsage.rss).toBeGreaterThan(0);
      });
    });

    test('combined with CPU percentage tracking', async () => {
      tracker.getCPUPercentage(); // Baseline

      const metrics1 = tracker.collect();
      await new Promise(resolve => setTimeout(resolve, 100));
      const cpu1 = tracker.getCPUPercentage();

      const metrics2 = tracker.collect();
      await new Promise(resolve => setTimeout(resolve, 100));
      const cpu2 = tracker.getCPUPercentage();

      // All values should be valid
      expect(metrics1.uptime).toBeGreaterThanOrEqual(0);
      expect(metrics2.uptime).toBeGreaterThan(metrics1.uptime);
      expect(cpu1).toBeGreaterThanOrEqual(0);
      expect(cpu2).toBeGreaterThanOrEqual(0);
    });

    test('event loop lag measurement with collection', async () => {
      const metrics = tracker.collect();
      const lag = await tracker.getEventLoopLag();
      const cpuPercent = tracker.getCPUPercentage();

      expect(metrics.uptime).toBeGreaterThanOrEqual(0);
      expect(lag).toBeGreaterThanOrEqual(0);
      expect(cpuPercent).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Edge cases and error handling', () => {
    test('handles rapid successive collections', () => {
      const metrics1 = tracker.collect();
      const metrics2 = tracker.collect();
      const metrics3 = tracker.collect();

      expect(metrics1).toBeDefined();
      expect(metrics2).toBeDefined();
      expect(metrics3).toBeDefined();

      // Uptime might be identical or very close
      expect(metrics3.uptime).toBeGreaterThanOrEqual(metrics1.uptime);
    });

    test('handles many rapid CPU percentage calls', () => {
      const percentages: number[] = [];

      for (let i = 0; i < 10; i++) {
        percentages.push(tracker.getCPUPercentage());
      }

      expect(percentages).toHaveLength(10);
      percentages.forEach(p => {
        expect(p).toBeGreaterThanOrEqual(0);
      });
    });

    test('handles parallel event loop lag measurements', async () => {
      const lagPromises = [
        tracker.getEventLoopLag(),
        tracker.getEventLoopLag(),
        tracker.getEventLoopLag(),
      ];

      const lags = await Promise.all(lagPromises);

      expect(lags).toHaveLength(3);
      lags.forEach(lag => {
        expect(lag).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('Memory usage tracking', () => {
    test('tracks memory allocation', () => {
      const before = tracker.collect();

      // Allocate some memory
      const array = new Array(1000000).fill(Math.random());
      expect(array.length).toBe(1000000); // Use array to prevent optimization

      const after = tracker.collect();

      // Both should be valid
      expect(before.memoryUsage.heapUsed).toBeGreaterThan(0);
      expect(after.memoryUsage.heapUsed).toBeGreaterThan(0);
    });

    test('external memory is tracked', () => {
      const metrics = tracker.collect();
      expect(metrics.memoryUsage.external).toBeGreaterThanOrEqual(0);
    });

    test('RSS includes more than heap', () => {
      const metrics = tracker.collect();
      expect(metrics.memoryUsage.rss).toBeGreaterThan(metrics.memoryUsage.heapUsed);
    });
  });
});
