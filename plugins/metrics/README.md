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

## 📖 Main Exports

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

### Context API (via `ctx.services.metrics`)

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
}
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

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](../../CONTRIBUTING.md) for details.

## 📄 License

MIT © BlaizeJS Team

---

**Built with ❤️ by the BlaizeJS team**

_Add production-grade observability to your BlaizeJS APIs in minutes - track everything from HTTP latency to custom business metrics with full type safety._
