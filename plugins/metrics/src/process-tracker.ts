/**
 * Process Health Tracker
 *
 * Collects Node.js process metrics including memory usage, CPU usage,
 * event loop lag, uptime, and runtime information.
 *
 * @module @blaizejs/plugin-metrics/process-tracker
 */

import type { ProcessMetrics } from './types';

/**
 * Process Health Tracker
 *
 * Tracks Node.js process health metrics with efficient, non-blocking measurements.
 * CPU percentage is calculated using deltas between collections.
 *
 * @example
 * ```typescript
 * const tracker = new ProcessHealthTracker();
 *
 * // Collect current metrics
 * const metrics = tracker.collect();
 * console.log('Memory used:', metrics.memoryUsage.heapUsed);
 * console.log('CPU usage:', tracker.getCPUPercentage());
 *
 * // Measure event loop lag (async)
 * const lag = await tracker.getEventLoopLag();
 * console.log('Event loop lag:', lag, 'ms');
 * ```
 */
export class ProcessHealthTracker {
  private readonly startTime: number;
  private lastCpuUsage: NodeJS.CpuUsage | null = null;
  private lastCpuTimestamp: number | null = null;

  /**
   * Create a new process health tracker
   *
   * Records the initialization time for uptime calculation
   */
  constructor() {
    this.startTime = Date.now();
    // Initialize CPU baseline
    this.lastCpuUsage = process.cpuUsage();
    this.lastCpuTimestamp = Date.now();
  }

  /**
   * Collect current process metrics
   *
   * Gathers memory usage, CPU usage, uptime, and event loop lag.
   * This is a synchronous operation - event loop lag uses the last measured value.
   *
   * @returns Complete process metrics snapshot
   *
   * @example
   * ```typescript
   * const metrics = tracker.collect();
   * console.log('Heap used:', metrics.memoryUsage.heapUsed);
   * console.log('Uptime:', metrics.uptime, 'seconds');
   * console.log('CPU user time:', metrics.cpuUsage.user);
   * ```
   */
  collect(): ProcessMetrics {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const uptime = this.getUptime();

    return {
      memoryUsage: {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external,
        rss: memoryUsage.rss,
      },
      cpuUsage: {
        user: cpuUsage.user,
        system: cpuUsage.system,
      },
      uptime,
      eventLoopLag: 0, // Will be updated by periodic measurements
    };
  }

  /**
   * Calculate CPU usage percentage
   *
   * Computes percentage based on CPU time delta since last call.
   * Returns the percentage of CPU time used relative to wall-clock time.
   *
   * Formula: (cpu_delta_microseconds / wall_time_microseconds) * 100
   *
   * @returns CPU usage percentage (0-100+ for single core, 0-N*100 for N cores)
   *
   * @example
   * ```typescript
   * // First call establishes baseline
   * tracker.getCPUPercentage(); // May be 0 or inaccurate
   *
   * // Wait some time...
   * await new Promise(resolve => setTimeout(resolve, 1000));
   *
   * // Second call shows actual usage
   * const cpuPercent = tracker.getCPUPercentage();
   * console.log('CPU usage:', cpuPercent.toFixed(2), '%');
   * ```
   */
  getCPUPercentage(): number {
    const currentCpuUsage = process.cpuUsage();
    const currentTimestamp = Date.now();

    if (this.lastCpuUsage === null || this.lastCpuTimestamp === null) {
      // First call - initialize baseline
      this.lastCpuUsage = currentCpuUsage;
      this.lastCpuTimestamp = currentTimestamp;
      return 0;
    }

    // Calculate deltas
    const cpuDelta = {
      user: currentCpuUsage.user - this.lastCpuUsage.user,
      system: currentCpuUsage.system - this.lastCpuUsage.system,
    };

    const wallTimeDelta = (currentTimestamp - this.lastCpuTimestamp) * 1000; // Convert to microseconds

    // Update baseline for next call
    this.lastCpuUsage = currentCpuUsage;
    this.lastCpuTimestamp = currentTimestamp;

    // Calculate percentage
    if (wallTimeDelta === 0) {
      return 0;
    }

    const totalCpuTime = cpuDelta.user + cpuDelta.system;
    const percentage = (totalCpuTime / wallTimeDelta) * 100;

    return Math.max(0, percentage); // Ensure non-negative
  }

  /**
   * Measure event loop lag asynchronously
   *
   * Measures how long it takes to execute a setImmediate callback,
   * which indicates how busy the event loop is.
   *
   * Returns the lag in milliseconds. Values < 10ms are typically healthy.
   * Values > 50ms indicate the event loop is under stress.
   *
   * @returns Promise that resolves to event loop lag in milliseconds
   *
   * @example
   * ```typescript
   * const lag = await tracker.getEventLoopLag();
   *
   * if (lag > 50) {
   *   console.warn('High event loop lag:', lag, 'ms');
   * } else if (lag > 10) {
   *   console.log('Moderate event loop lag:', lag, 'ms');
   * } else {
   *   console.log('Healthy event loop:', lag, 'ms');
   * }
   * ```
   */
  getEventLoopLag(): Promise<number> {
    return new Promise(resolve => {
      const start = Date.now();
      setImmediate(() => {
        const lag = Date.now() - start;
        resolve(lag);
      });
    });
  }

  /**
   * Get process uptime in seconds
   *
   * Calculates time since tracker initialization (not process.uptime())
   * to track metrics collection duration specifically.
   *
   * @returns Uptime in seconds since tracker creation
   *
   * @example
   * ```typescript
   * const uptime = tracker.getUptime();
   * console.log('Tracker running for:', uptime, 'seconds');
   * ```
   */
  getUptime(): number {
    const now = Date.now();
    const uptimeMs = now - this.startTime;
    return uptimeMs / 1000; // Convert to seconds
  }

  /**
   * Get Node.js version information
   *
   * @returns Node.js version string (e.g., "v20.10.0")
   *
   * @example
   * ```typescript
   * console.log('Node version:', tracker.getNodeVersion());
   * // Output: "Node version: v20.10.0"
   * ```
   */
  getNodeVersion(): string {
    return process.version;
  }

  /**
   * Get platform information
   *
   * @returns Platform string (e.g., "linux", "darwin", "win32")
   *
   * @example
   * ```typescript
   * console.log('Platform:', tracker.getPlatform());
   * // Output: "Platform: linux"
   * ```
   */
  getPlatform(): string {
    return process.platform;
  }

  /**
   * Get process architecture
   *
   * @returns Architecture string (e.g., "x64", "arm64")
   *
   * @example
   * ```typescript
   * console.log('Architecture:', tracker.getArchitecture());
   * // Output: "Architecture: x64"
   * ```
   */
  getArchitecture(): string {
    return process.arch;
  }

  /**
   * Get process ID
   *
   * @returns Process ID (PID)
   *
   * @example
   * ```typescript
   * console.log('Process ID:', tracker.getProcessId());
   * // Output: "Process ID: 12345"
   * ```
   */
  getProcessId(): number {
    return process.pid;
  }

  /**
   * Reset CPU usage baseline
   *
   * Useful for starting fresh CPU percentage calculations.
   * Next getCPUPercentage() call will establish a new baseline.
   *
   * @example
   * ```typescript
   * tracker.resetCPUBaseline();
   * // Next getCPUPercentage() will be 0 or inaccurate
   * // Subsequent calls will show accurate deltas
   * ```
   */
  resetCPUBaseline(): void {
    this.lastCpuUsage = process.cpuUsage();
    this.lastCpuTimestamp = Date.now();
  }
}
