# 📊 @blaizejs/plugin-metrics

> **Production-ready metrics and observability** for BlaizeJS applications - Track HTTP requests, process health, and custom application metrics with Prometheus and HTML dashboard exports

[![npm version](https://badge.fury.io/js/%40blaizejs%2Fplugin-metrics.svg)](https://badge.fury.io/js/%40blaizejs%2Fplugin-metrics)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

## 📦 Installation

```bash
pnpm add @blaizejs/plugin-metrics
```

## 🚀 Quick Start

```typescript
import { Blaize } from 'blaizejs';
import { createMetricsPlugin } from '@blaizejs/plugin-metrics';

// 1. Create the metrics plugin
const metricsPlugin = createMetricsPlugin({
  enabled: true,
  excludePaths: ['/health', '/favicon.ico'],
  labels: {
    service: 'my-api',
    environment: process.env.NODE_ENV || 'development',
  },
});

// 2. Register it with your server
export const server = Blaize.createServer({
  port: 3000,
  plugins: [metricsPlugin],
});

// 3. Add metrics endpoints in your routes
// routes/metrics/index.ts
import { metricsPrometheusRoute } from '@blaizejs/plugin-metrics';
import { appRouter } from '../../app-router';

export const GET = appRouter.get(metricsPrometheusRoute); // GET /metrics

// 4. Use custom metrics in your handlers
export const createOrder = appRouter.post({
  handler: async ctx => {
    ctx.services.metrics.increment('orders.created');

    const stopTimer = ctx.services.metrics.startTimer('order.processing');
    const order = await processOrder(ctx.body);
    stopTimer();

    return order;
  },
});
```

## 🌟 Features

### 🚀 **Automatic HTTP Tracking**

Zero-configuration request monitoring with latency percentiles (P50, P95, P99), status code distribution, and per-route metrics

### 📊 **Process Health Monitoring**

Memory usage, CPU time, event loop lag, and uptime tracking for production insights

### 🎯 **Custom Application Metrics**

Counters, gauges, histograms, and timers for tracking business metrics

### 📈 **Multiple Export Formats**

- **Prometheus** - Industry-standard format for monitoring systems
- **HTML Dashboard** - Beautiful, zero-dependency web interface
- **JSON API** - Raw data for custom integrations

### 🔧 **Production Ready**

Type-safe throughout, configurable path exclusions, memory-efficient with FIFO limits, and graceful shutdown support

## 📖 Usage Patterns

### In Route Handlers (via ctx.services)

Most common usage - track metrics from API endpoints:

```typescript
// routes/orders/create.ts
export default createPostRoute()({
  handler: async ctx => {
    // ✅ Use ctx.services.metrics in routes
    ctx.services.metrics.increment('orders.created');

    const stopTimer = ctx.services.metrics.startTimer('order.processing');

    const order = await processOrder(ctx.body);

    stopTimer(); // Records duration automatically

    ctx.services.metrics.gauge('orders.active', await getActiveOrderCount());

    return order;
  },
});
```

### In Job Handlers (direct import)

Track metrics from background jobs:

```typescript
// queues/reports/generate.ts
import { getMetricsCollector } from '@blaizejs/plugin-metrics';
import type { JobContext } from '@blaizejs/plugin-queue';

interface ReportData {
  reportType: string;
  userId: string;
}

export const generateReport = async (ctx: JobContext<ReportData>) => {
  // ✅ Import collector directly in job handlers
  const metrics = getMetricsCollector();

  metrics.increment('reports.generated', 1);

  const stopTimer = metrics.startTimer('report.generation');

  try {
    const report = await buildReport(ctx.data);

    metrics.histogram('report.size', report.sizeInBytes);
    metrics.increment('reports.success');

    stopTimer();

    return { reportId: report.id };
  } catch (error) {
    metrics.increment('reports.failed');
    throw error;
  }
};
```

### In Utility Functions

Track metrics from shared business logic:

```typescript
// lib/metrics-utils.ts
import { getMetricsCollector } from '@blaizejs/plugin-metrics';

/**
 * Record a user action across the application
 */
export function recordUserAction(action: string, userId: string, metadata?: Record<string, any>) {
  const metrics = getMetricsCollector();

  metrics.increment('user.actions', 1);
  metrics.increment(`user.actions.${action}`, 1);

  // Track metadata as separate metrics
  if (metadata?.duration) {
    metrics.histogram('user.action.duration', metadata.duration);
  }
}

/**
 * Track cache hit/miss rates
 */
export function recordCacheAccess(hit: boolean, key: string) {
  const metrics = getMetricsCollector();

  metrics.increment('cache.access');
  metrics.increment(hit ? 'cache.hits' : 'cache.misses');

  // Calculate hit rate
  const snapshot = metrics.getSnapshot();
  const hits = snapshot.custom.counters['cache.hits'] || 0;
  const total = snapshot.custom.counters['cache.access'] || 1;

  metrics.gauge('cache.hit_rate', (hits / total) * 100);
}
```

### In Monitoring Scripts

Collect metrics for external monitoring systems:

```typescript
// scripts/health-check.ts
import { getMetricsCollector } from '@blaizejs/plugin-metrics';

async function checkHealth() {
  const metrics = getMetricsCollector();

  const snapshot = metrics.getSnapshot();

  // Check HTTP health
  const errorRate = (snapshot.http.statusCodes['500'] || 0) / snapshot.http.totalRequests;

  if (errorRate > 0.01) {
    console.error('High error rate detected:', errorRate);
    process.exit(1);
  }

  // Check memory
  const heapUsedMB = snapshot.process.memoryUsage.heapUsed / 1024 / 1024;

  if (heapUsedMB > 1024) {
    console.warn('High memory usage:', heapUsedMB, 'MB');
  }

  console.log('Health check passed');
}

checkHealth();
```

### Why Two Access Patterns?

BlaizeJS provides two ways to access the metrics collector:

- **`ctx.services.metrics`** - For route handlers

  - ✅ Convenient within HTTP request/response cycle
  - ✅ Middleware automatically provides service
  - ✅ No imports needed

- **`getMetricsCollector()`** - For job handlers, utilities, scripts
  - ✅ Works outside HTTP context
  - ✅ Portable across different environments
  - ✅ Direct import, no framework dependency

**Important:** Both patterns access the **same MetricsCollector instance**.

## 📖 Main Exports

### Service Factory

```typescript
getMetricsCollector(): MetricsCollector  // Direct access to metrics collector
```

### Plugin Factory

```typescript
createMetricsPlugin(config?: MetricsPluginConfig): Plugin
```

### Route Exports

```typescript
metricsPrometheusRoute; // Prometheus format at /metrics
metricsDashboardRoute; // HTML dashboard at /metrics/dashboard
metricsJsonRoute; // JSON snapshot at /metrics/json
```

### Context API (via `ctx.services.metrics` or `getMetricsCollector()`)

```typescript
increment(name: string, value?: number): void
gauge(name: string, value: number): void
histogram(name: string, value: number): void
startTimer(name: string): () => void
getSnapshot(): MetricsSnapshot
```

### Configuration Type

```typescript
interface MetricsPluginConfig {
  enabled?: boolean; // Default: true
  excludePaths?: string[]; // Paths to skip tracking
  histogramLimit?: number; // Max samples (default: 1000)
  collectionInterval?: number; // Collection interval in ms (default: 60000)
  labels?: Record<string, string>; // Global labels
  logToConsole?: boolean; // Debug logging (default: false)
  reporter?: (snapshot: MetricsSnapshot) => void | Promise<void>;
  maxCardinality?: number; // Max unique metric names (default: 10000)
  onCardinalityLimit?: 'drop' | 'warn'; // Behavior on limit (default: 'drop')
}
```

## 🧪 Testing

### Mocking in Route Tests

```typescript
import { vi } from 'vitest';

describe('POST /orders/create', () => {
  it('tracks order creation metrics', async () => {
    // Routes use ctx.services
    const mockMetrics = {
      increment: vi.fn(),
      gauge: vi.fn(),
      histogram: vi.fn(),
      startTimer: vi.fn(() => vi.fn()), // Returns stop function
    };

    const ctx = createMockContext({
      services: { metrics: mockMetrics },
    });

    await POST.handler({ ctx });

    expect(mockMetrics.increment).toHaveBeenCalledWith('orders.created');
    expect(mockMetrics.startTimer).toHaveBeenCalledWith('order.processing');
  });
});
```

### Mocking in Job Handler Tests

```typescript
import { vi } from 'vitest';

// Mock the factory function
vi.mock('@blaizejs/plugin-metrics', () => ({
  getMetricsCollector: vi.fn(() => mockMetrics),
}));

const mockMetrics = {
  increment: vi.fn(),
  histogram: vi.fn(),
  startTimer: vi.fn(() => vi.fn()),
  getSnapshot: vi.fn(),
};

describe('generateReport handler', () => {
  it('tracks report generation metrics', async () => {
    const result = await generateReport({
      jobId: 'job-1',
      data: { reportType: 'monthly', userId: 'user-123' },
      logger: mockLogger,
      signal: new AbortController().signal,
      progress: vi.fn(),
    });

    expect(mockMetrics.increment).toHaveBeenCalledWith('reports.generated', 1);
    expect(mockMetrics.increment).toHaveBeenCalledWith('reports.success');
    expect(mockMetrics.histogram).toHaveBeenCalledWith('report.size', expect.any(Number));
  });
});
```

## 📊 Prometheus Integration

Export metrics to Prometheus for monitoring and alerting:

```typescript
// routes/metrics/index.ts
import { metricsPrometheusRoute } from '@blaizejs/plugin-metrics';

export const GET = createGetRoute()({
  handler: metricsPrometheusRoute,
});
```

**Prometheus config:**

```yaml
scrape_configs:
  - job_name: 'blaize-api'
    scrape_interval: 30s
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
```

## 📚 Documentation

- 📘 **[Full Plugin Guide](../../docs/guides/metrics-plugin.md)** - Complete usage and configuration
- 🏗️ **[Plugin Architecture](../../docs/architecture/plugins.md)** - How plugins work in BlaizeJS
- 🔍 **[API Reference](../../docs/reference/plugin-metrics.md)** - Detailed API documentation
- 📊 **[Prometheus Setup](../../docs/guides/prometheus-integration.md)** - Monitoring integration guide
- 🎯 **[Custom Metrics Guide](../../docs/guides/custom-metrics.md)** - Application metrics patterns
- 💡 **[Examples](../../docs/examples/metrics-dashboard.md)** - Real-world examples

## 🔗 Related Packages

- [`blaizejs`](../blaize-core) - Core framework with plugin system
- [`@blaizejs/testing-utils`](../blaize-testing-utils) - Test your metrics collection
- [`@blaizejs/plugin-queue`](../queue) - Background job processing with metrics

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](../../CONTRIBUTING.md) for details.

## 📄 License

MIT © BlaizeJS Team

---

**Built with ❤️ by the BlaizeJS team**

_Add production-grade observability to your BlaizeJS APIs in minutes - track everything from HTTP latency to custom business metrics with full type safety._
