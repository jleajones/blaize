/**
 * Prometheus Exporter
 *
 * Converts MetricsSnapshot to Prometheus text exposition format v0.0.4.
 * Generates HELP, TYPE, and metric lines with proper formatting and labels.
 *
 * @module @blaizejs/plugin-metrics/prometheus
 */

import type { MetricsSnapshot, HistogramStats } from './types';

/**
 * Standard Prometheus histogram buckets (in seconds for latency metrics)
 * Covers 5ms to 10s range
 */
const STANDARD_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

/**
 * Export metrics snapshot to Prometheus text format
 *
 * Generates Prometheus exposition format v0.0.4 with proper TYPE and HELP comments.
 * Converts millisecond timings to seconds, generates histogram buckets, and applies labels.
 *
 * @param snapshot - Metrics snapshot to export
 * @param labels - Optional global labels to apply to all metrics
 * @returns Prometheus text format string
 *
 * @example
 * ```typescript
 * const snapshot = collector.getSnapshot();
 * const prometheus = exportPrometheus(snapshot, {
 *   service: 'api',
 *   environment: 'production',
 * });
 *
 * // Returns Prometheus format:
 * // # HELP http_requests_total Total number of HTTP requests
 * // # TYPE http_requests_total counter
 * // http_requests_total{service="api",environment="production"} 1000
 * ```
 */
export function exportPrometheus(
  snapshot: MetricsSnapshot,
  labels: Record<string, string> = {}
): string {
  const lines: string[] = [];
  const labelStr = formatLabels(labels);

  // HTTP Metrics
  lines.push(...exportHttpMetrics(snapshot, labelStr));

  // Process Metrics
  lines.push(...exportProcessMetrics(snapshot, labelStr));

  // Custom Metrics
  lines.push(...exportCustomMetrics(snapshot, labelStr));

  return lines.join('\n') + '\n';
}

/**
 * Export HTTP request metrics
 *
 * @private
 */
function exportHttpMetrics(snapshot: MetricsSnapshot, labelStr: string): string[] {
  const lines: string[] = [];
  const { http } = snapshot;

  // Total requests counter
  lines.push('# HELP http_requests_total Total number of HTTP requests processed');
  lines.push('# TYPE http_requests_total counter');
  lines.push(`http_requests_total${labelStr} ${http.totalRequests}`);
  lines.push('');

  // Active requests gauge
  lines.push('# HELP http_requests_active Number of HTTP requests currently being processed');
  lines.push('# TYPE http_requests_active gauge');
  lines.push(`http_requests_active${labelStr} ${http.activeRequests}`);
  lines.push('');

  // Requests per second gauge
  lines.push('# HELP http_requests_per_second Average HTTP requests per second');
  lines.push('# TYPE http_requests_per_second gauge');
  lines.push(`http_requests_per_second${labelStr} ${http.requestsPerSecond.toFixed(3)}`);
  lines.push('');

  // Status codes
  lines.push('# HELP http_requests_by_status_total HTTP requests by status code');
  lines.push('# TYPE http_requests_by_status_total counter');
  for (const [status, count] of Object.entries(http.statusCodes)) {
    const statusLabel = formatLabels({ ...parseLabels(labelStr), status });
    lines.push(`http_requests_by_status_total${statusLabel} ${count}`);
  }
  lines.push('');

  // Request duration histogram (convert milliseconds to seconds)
  lines.push('# HELP http_request_duration_seconds HTTP request latency in seconds');
  lines.push('# TYPE http_request_duration_seconds histogram');
  lines.push(...exportHistogram('http_request_duration_seconds', http.latency, labelStr, true));
  lines.push('');

  // By method
  lines.push('# HELP http_requests_by_method_total HTTP requests by method');
  lines.push('# TYPE http_requests_by_method_total counter');
  for (const [method, metrics] of Object.entries(http.byMethod)) {
    const methodLabel = formatLabels({ ...parseLabels(labelStr), method });
    lines.push(`http_requests_by_method_total${methodLabel} ${metrics.count}`);
  }
  lines.push('');

  // By route
  lines.push('# HELP http_requests_by_route_total HTTP requests by route');
  lines.push('# TYPE http_requests_by_route_total counter');
  for (const [route, metrics] of Object.entries(http.byRoute)) {
    const routeLabel = formatLabels({ ...parseLabels(labelStr), route });
    lines.push(`http_requests_by_route_total${routeLabel} ${metrics.count}`);
  }
  lines.push('');

  return lines;
}

/**
 * Export process health metrics
 *
 * @private
 */
function exportProcessMetrics(snapshot: MetricsSnapshot, labelStr: string): string[] {
  const lines: string[] = [];
  const { process } = snapshot;

  // Memory metrics (in bytes)
  lines.push('# HELP process_memory_heap_used_bytes Process heap memory used in bytes');
  lines.push('# TYPE process_memory_heap_used_bytes gauge');
  lines.push(`process_memory_heap_used_bytes${labelStr} ${process.memoryUsage.heapUsed}`);
  lines.push('');

  lines.push('# HELP process_memory_heap_total_bytes Process heap memory total in bytes');
  lines.push('# TYPE process_memory_heap_total_bytes gauge');
  lines.push(`process_memory_heap_total_bytes${labelStr} ${process.memoryUsage.heapTotal}`);
  lines.push('');

  lines.push('# HELP process_memory_external_bytes Process external memory in bytes');
  lines.push('# TYPE process_memory_external_bytes gauge');
  lines.push(`process_memory_external_bytes${labelStr} ${process.memoryUsage.external}`);
  lines.push('');

  lines.push('# HELP process_memory_rss_bytes Process resident set size in bytes');
  lines.push('# TYPE process_memory_rss_bytes gauge');
  lines.push(`process_memory_rss_bytes${labelStr} ${process.memoryUsage.rss}`);
  lines.push('');

  // CPU metrics (convert microseconds to seconds)
  lines.push('# HELP process_cpu_user_seconds_total Total user CPU time in seconds');
  lines.push('# TYPE process_cpu_user_seconds_total counter');
  lines.push(
    `process_cpu_user_seconds_total${labelStr} ${(process.cpuUsage.user / 1000000).toFixed(6)}`
  );
  lines.push('');

  lines.push('# HELP process_cpu_system_seconds_total Total system CPU time in seconds');
  lines.push('# TYPE process_cpu_system_seconds_total counter');
  lines.push(
    `process_cpu_system_seconds_total${labelStr} ${(process.cpuUsage.system / 1000000).toFixed(6)}`
  );
  lines.push('');

  // Uptime (in seconds)
  lines.push('# HELP process_uptime_seconds Process uptime in seconds');
  lines.push('# TYPE process_uptime_seconds gauge');
  lines.push(`process_uptime_seconds${labelStr} ${process.uptime.toFixed(3)}`);
  lines.push('');

  // Event loop lag (convert milliseconds to seconds)
  lines.push('# HELP process_event_loop_lag_seconds Event loop lag in seconds');
  lines.push('# TYPE process_event_loop_lag_seconds gauge');
  lines.push(
    `process_event_loop_lag_seconds${labelStr} ${(process.eventLoopLag / 1000).toFixed(6)}`
  );
  lines.push('');

  return lines;
}

/**
 * Export custom application metrics
 *
 * @private
 */
function exportCustomMetrics(snapshot: MetricsSnapshot, labelStr: string): string[] {
  const lines: string[] = [];
  const { custom } = snapshot;

  // Counters
  for (const [name, value] of Object.entries(custom.counters)) {
    const safeName = sanitizeMetricName(name);
    lines.push(`# HELP ${safeName} Custom counter metric`);
    lines.push(`# TYPE ${safeName} counter`);
    lines.push(`${safeName}${labelStr} ${value}`);
    lines.push('');
  }

  // Gauges
  for (const [name, value] of Object.entries(custom.gauges)) {
    const safeName = sanitizeMetricName(name);
    lines.push(`# HELP ${safeName} Custom gauge metric`);
    lines.push(`# TYPE ${safeName} gauge`);
    lines.push(`${safeName}${labelStr} ${value}`);
    lines.push('');
  }

  // Histograms (keep in original units - app-specific)
  for (const [name, stats] of Object.entries(custom.histograms)) {
    const safeName = sanitizeMetricName(name);
    lines.push(`# HELP ${safeName} Custom histogram metric`);
    lines.push(`# TYPE ${safeName} histogram`);
    lines.push(...exportHistogram(safeName, stats, labelStr, false));
    lines.push('');
  }

  // Timers (convert milliseconds to seconds)
  for (const [name, stats] of Object.entries(custom.timers)) {
    const safeName = sanitizeMetricName(name);
    lines.push(`# HELP ${safeName}_seconds Custom timer metric in seconds`);
    lines.push(`# TYPE ${safeName}_seconds histogram`);
    lines.push(...exportHistogram(`${safeName}_seconds`, stats, labelStr, true));
    lines.push('');
  }

  return lines;
}

/**
 * Export histogram with buckets
 *
 * @private
 * @param name - Metric name
 * @param stats - Histogram statistics
 * @param labelStr - Formatted label string
 * @param convertToSeconds - Whether to convert milliseconds to seconds
 */
function exportHistogram(
  name: string,
  stats: HistogramStats,
  labelStr: string,
  convertToSeconds: boolean
): string[] {
  const lines: string[] = [];
  const baseLabels = parseLabels(labelStr);

  // Generate bucket counts
  const buckets = convertToSeconds ? STANDARD_BUCKETS : generateCustomBuckets(stats);
  let cumulativeCount = 0;

  for (const bucket of buckets) {
    // Count how many samples are <= bucket
    const bucketValue = convertToSeconds ? bucket : bucket;
    const maxValue = convertToSeconds ? stats.max / 1000 : stats.max;

    if (maxValue <= bucketValue) {
      cumulativeCount = stats.count;
    } else {
      // Estimate count for this bucket (linear interpolation)
      cumulativeCount = Math.floor((bucketValue / maxValue) * stats.count);
    }

    const bucketLabel = formatLabels({ ...baseLabels, le: bucket.toString() });
    lines.push(`${name}_bucket${bucketLabel} ${cumulativeCount}`);
  }

  // +Inf bucket (all samples)
  const infLabel = formatLabels({ ...baseLabels, le: '+Inf' });
  lines.push(`${name}_bucket${infLabel} ${stats.count}`);

  // Sum and count
  const sum = convertToSeconds ? (stats.sum / 1000).toFixed(6) : stats.sum.toFixed(6);
  lines.push(`${name}_sum${labelStr} ${sum}`);
  lines.push(`${name}_count${labelStr} ${stats.count}`);

  return lines;
}

/**
 * Generate custom histogram buckets for non-time metrics
 *
 * @private
 */
function generateCustomBuckets(stats: HistogramStats): number[] {
  if (stats.max === 0) {
    return [0, 1, 10, 100];
  }

  const buckets: number[] = [];
  const max = stats.max;
  const magnitude = Math.pow(10, Math.floor(Math.log10(max)));

  // Generate buckets covering the range
  for (let i = 0.1; i <= 10; i *= 2.5) {
    const bucket = magnitude * i;
    if (bucket <= max * 1.2) {
      buckets.push(bucket);
    }
  }

  return buckets.sort((a, b) => a - b);
}

/**
 * Format labels into Prometheus label string
 *
 * @private
 * @param labels - Label key-value pairs
 * @returns Formatted label string like {key="value",key2="value2"}
 */
function formatLabels(labels: Record<string, string>): string {
  const entries = Object.entries(labels);
  if (entries.length === 0) {
    return '';
  }

  const labelPairs = entries.map(([key, value]) => {
    const safeKey = sanitizeMetricName(key);
    const safeValue = escapeLabel(value);
    return `${safeKey}="${safeValue}"`;
  });

  return `{${labelPairs.join(',')}}`;
}

/**
 * Parse label string back into object
 *
 * @private
 */
function parseLabels(labelStr: string): Record<string, string> {
  if (!labelStr || labelStr === '{}') {
    return {};
  }

  const labels: Record<string, string> = {};
  const match = labelStr.match(/\{([^}]+)\}/);

  if (match) {
    const pairs = match[1]!.split(',');
    for (const pair of pairs) {
      const [key, value] = pair.split('=');
      if (key && value) {
        labels[key] = value.replace(/"/g, '');
      }
    }
  }

  return labels;
}

/**
 * Sanitize metric name to comply with Prometheus naming rules
 *
 * Metric names must match [a-zA-Z_:][a-zA-Z0-9_:]*
 *
 * @private
 * @param name - Original metric name
 * @returns Sanitized metric name
 */
export function sanitizeMetricName(name: string): string {
  // Replace invalid characters with underscore
  let sanitized = name.replace(/[^a-zA-Z0-9_:]/g, '_');

  // Ensure it starts with a letter or underscore
  if (!/^[a-zA-Z_:]/.test(sanitized)) {
    sanitized = '_' + sanitized;
  }

  return sanitized;
}

/**
 * Escape special characters in label values
 *
 * Must escape: backslash (\), double-quote ("), and newline (\n)
 *
 * @private
 * @param value - Original label value
 * @returns Escaped label value
 */
export function escapeLabel(value: string): string {
  return value
    .replace(/\\/g, '\\\\') // Escape backslash
    .replace(/"/g, '\\"') // Escape quotes
    .replace(/\n/g, '\\n'); // Escape newlines
}
