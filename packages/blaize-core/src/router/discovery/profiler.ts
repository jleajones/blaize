import type { ReloadMetrics } from '@blaize-types/router';

const profilerState: ReloadMetrics = {
  fileChanges: 0,
  totalReloadTime: 0,
  averageReloadTime: 0,
  slowReloads: [],
};

export function trackReloadPerformance(filePath: string, startTime: number): void {
  const duration = Date.now() - startTime;

  profilerState.fileChanges++;
  profilerState.totalReloadTime += duration;
  profilerState.averageReloadTime = profilerState.totalReloadTime / profilerState.fileChanges;

  if (duration > 100) {
    profilerState.slowReloads.push({ file: filePath, time: duration });
    if (profilerState.slowReloads.length > 10) {
      profilerState.slowReloads.shift();
    }
  }

  if (process.env.NODE_ENV === 'development') {
    const emoji = duration < 50 ? '⚡' : duration < 100 ? '🔄' : '🐌';
    console.log(`${emoji} Route reload: ${filePath} (${duration}ms)`);
  }
}

export function getReloadMetrics(): Readonly<ReloadMetrics> {
  return { ...profilerState };
}

export function resetReloadMetrics(): void {
  profilerState.fileChanges = 0;
  profilerState.totalReloadTime = 0;
  profilerState.averageReloadTime = 0;
  profilerState.slowReloads = [];
}

export function withPerformanceTracking<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  filePath: string
): T {
  console.log(`Tracking performance for: ${filePath}`);
  return (async (...args: Parameters<T>) => {
    const startTime = Date.now();
    try {
      const result = await fn(...args);
      trackReloadPerformance(filePath, startTime);
      return result;
    } catch (error) {
      trackReloadPerformance(filePath, startTime);
      throw error;
    }
  }) as T;
}
