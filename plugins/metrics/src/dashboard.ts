/**
 * HTML Dashboard Renderer
 *
 * Generates standalone HTML dashboard for metrics visualization.
 * Features responsive design, BlaizeJS branding, and no external dependencies.
 *
 * @module @blaizejs/plugin-metrics/dashboard
 */

import type { MetricsSnapshot } from './types';

/**
 * Render metrics dashboard as standalone HTML
 *
 * Generates a complete HTML document with inline CSS and JavaScript.
 * Includes metric cards, route tables, and custom metrics display.
 * Fully responsive and works without external dependencies.
 *
 * @param snapshot - Metrics snapshot to visualize
 * @returns Complete HTML document string
 *
 * @example
 * ```typescript
 * const snapshot = collector.getSnapshot();
 * const html = renderDashboard(snapshot);
 *
 * // Serve via route handler
 * ctx.html(html);
 * ```
 */
export function renderDashboard(snapshot: MetricsSnapshot): string {
  const timestamp = new Date(snapshot.timestamp).toLocaleString();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="BlaizeJS Metrics Dashboard">
  <title>BlaizeJS Metrics Dashboard</title>
  <style>
    ${getStyles()}
  </style>
</head>
<body>
  <header class="header">
    <div class="container">
      <h1 class="title">🔥 BlaizeJS Metrics</h1>
      <p class="subtitle">Last updated: ${timestamp}</p>
    </div>
  </header>

  <main class="container">
    <!-- Key Metrics Cards -->
    <section class="cards">
      ${renderMetricCards(snapshot)}
      
    </section>

    <!-- HTTP Metrics -->
    <section class="section">
      <h2 class="section-title">HTTP Requests</h2>
      <div class="stats-grid">
        ${renderHttpStats(snapshot)}
      </div>
    </section>

    <!-- Top Routes Table -->
    <section class="section">
      <h2 class="section-title">Top Routes</h2>
      ${renderRoutesTable(snapshot)}
    </section>

    <!-- Status Codes -->
    <section class="section">
      <h2 class="section-title">Status Codes</h2>
      <div class="badges">
        ${renderStatusBadges(snapshot)}
      </div>
    </section>

    <!-- Process Metrics -->
    <section class="section">
      <h2 class="section-title">Process Health</h2>
      <div class="stats-grid">
        ${renderProcessStats(snapshot)}
      </div>
    </section>

    <!-- Custom Metrics -->
    ${renderCustomMetrics(snapshot)}
  </main>

  <footer class="footer">
    <div class="container">
      <p>Powered by <strong>BlaizeJS</strong> • <a href="/metrics" class="link">Prometheus Endpoint</a></p>
    </div>
  </footer>

  <script>
    ${getScript()}
  </script>
</body>
</html>`;
}

/**
 * Format uptime duration into human-readable string
 *
 * @param seconds - Uptime in seconds
 * @returns Formatted string like "2h 15m" or "45m 30s"
 *
 * @example
 * ```typescript
 * formatUptime(7200); // "2h 0m"
 * formatUptime(3665); // "1h 1m"
 * formatUptime(90);   // "1m 30s"
 * ```
 */
export function formatUptime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

/**
 * Format bytes into human-readable string
 *
 * @param bytes - Number of bytes
 * @returns Formatted string like "45.2 MB" or "1.3 GB"
 *
 * @example
 * ```typescript
 * formatBytes(1024);      // "1.0 KB"
 * formatBytes(1048576);   // "1.0 MB"
 * formatBytes(50000000);  // "47.7 MB"
 * ```
 */
export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }

  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Render metric cards for key statistics
 *
 * @private
 */
function renderMetricCards(snapshot: MetricsSnapshot): string {
  const { http, process, _meta } = snapshot;
  const avgResponseTime = http.latency.count > 0 ? http.latency.mean.toFixed(2) : '0';

  return `
    <div class="card">
      <div class="card-label">Total Requests</div>
      <div class="card-value">${http.totalRequests.toLocaleString()}</div>
    </div>
    <div class="card">
      <div class="card-label">Active Requests</div>
      <div class="card-value">${http.activeRequests}</div>
    </div>
    <div class="card">
      <div class="card-label">Avg Response Time</div>
      <div class="card-value">${avgResponseTime}ms</div>
    </div>
    <div class="card">
      <div class="card-label">Uptime</div>
      <div class="card-value">${formatUptime(process.uptime)}</div>
    </div>
    <div class="card">
      <div class="card-label">Memory Used</div>
      <div class="card-value">${formatBytes(process.memoryUsage.heapUsed)}</div>
    </div>
    <div class="card">
      <div class="card-label">Event Loop Lag</div>
      <div class="card-value">${process.eventLoopLag.toFixed(2)}ms</div>
    </div>
    ${
      _meta
        ? `
      <div class="metric-card">
        <h3>Metric Cardinality</h3>
        <div class="value">
          ${_meta.cardinality.toLocaleString()}
          <span class="unit">/ ${_meta.maxCardinality.toLocaleString()}</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${_meta.cardinalityUsagePercent}%; background: ${
            _meta.cardinalityUsagePercent >= 90
              ? '#dc3545'
              : _meta.cardinalityUsagePercent >= 80
                ? '#ffc107'
                : '#28a745'
          }"></div>
        </div>
        <small>${_meta.cardinalityUsagePercent}% used</small>
      </div>
      `
        : ''
    }
  `;
}

/**
 * Render HTTP statistics grid
 *
 * @private
 */
function renderHttpStats(snapshot: MetricsSnapshot): string {
  const { http } = snapshot;

  return `
    <div class="stat">
      <div class="stat-label">Requests/Second</div>
      <div class="stat-value">${http.requestsPerSecond.toFixed(2)}</div>
    </div>
    <div class="stat">
      <div class="stat-label">P50 Latency</div>
      <div class="stat-value">${http.latency.p50.toFixed(2)}ms</div>
    </div>
    <div class="stat">
      <div class="stat-label">P95 Latency</div>
      <div class="stat-value">${http.latency.p95.toFixed(2)}ms</div>
    </div>
    <div class="stat">
      <div class="stat-label">P99 Latency</div>
      <div class="stat-value">${http.latency.p99.toFixed(2)}ms</div>
    </div>
  `;
}

/**
 * Render routes table with sorting functionality
 *
 * @private
 */
function renderRoutesTable(snapshot: MetricsSnapshot): string {
  const routes = Object.entries(snapshot.http.byRoute)
    .map(([route, metrics]) => ({ route, ...metrics }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  if (routes.length === 0) {
    return '<p class="empty">No routes recorded yet</p>';
  }

  const rows = routes
    .map(
      r => `
      <tr>
        <td>${escapeHtml(r.route)}</td>
        <td class="number">${r.count.toLocaleString()}</td>
        <td class="number">${r.avgLatency.toFixed(2)}ms</td>
      </tr>
    `
    )
    .join('');

  return `
    <div class="table-container">
      <table class="table" id="routesTable">
        <thead>
          <tr>
            <th class="sortable" data-column="route">Route</th>
            <th class="sortable number" data-column="count">Requests</th>
            <th class="sortable number" data-column="latency">Avg Latency</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}

/**
 * Render status code badges
 *
 * @private
 */
function renderStatusBadges(snapshot: MetricsSnapshot): string {
  const codes = Object.entries(snapshot.http.statusCodes)
    .map(([code, count]) => ({ code: parseInt(code), count }))
    .sort((a, b) => b.count - a.count);

  if (codes.length === 0) {
    return '<p class="empty">No status codes recorded yet</p>';
  }

  return codes
    .map(
      ({ code, count }) => `
      <span class="badge badge-${getBadgeClass(code)}">
        ${code}: ${count.toLocaleString()}
      </span>
    `
    )
    .join('');
}

/**
 * Get badge class based on status code
 *
 * @private
 */
function getBadgeClass(code: number): string {
  if (code >= 200 && code < 300) return 'success';
  if (code >= 400 && code < 500) return 'warning';
  if (code >= 500) return 'error';
  return 'info';
}

/**
 * Render process statistics
 *
 * @private
 */
function renderProcessStats(snapshot: MetricsSnapshot): string {
  const { process } = snapshot;
  const { memoryUsage, cpuUsage } = process;

  return `
    <div class="stat">
      <div class="stat-label">Heap Total</div>
      <div class="stat-value">${formatBytes(memoryUsage.heapTotal)}</div>
    </div>
    <div class="stat">
      <div class="stat-label">RSS</div>
      <div class="stat-value">${formatBytes(memoryUsage.rss)}</div>
    </div>
    <div class="stat">
      <div class="stat-label">CPU User</div>
      <div class="stat-value">${(cpuUsage.user / 1000000).toFixed(2)}s</div>
    </div>
    <div class="stat">
      <div class="stat-label">CPU System</div>
      <div class="stat-value">${(cpuUsage.system / 1000000).toFixed(2)}s</div>
    </div>
  `;
}

/**
 * Render custom metrics section
 *
 * @private
 */
function renderCustomMetrics(snapshot: MetricsSnapshot): string {
  const { custom } = snapshot;
  const hasMetrics =
    Object.keys(custom.counters).length > 0 ||
    Object.keys(custom.gauges).length > 0 ||
    Object.keys(custom.histograms).length > 0 ||
    Object.keys(custom.timers).length > 0;

  if (!hasMetrics) {
    return '';
  }

  let content = '<section class="section"><h2 class="section-title">Custom Metrics</h2>';

  // Counters
  if (Object.keys(custom.counters).length > 0) {
    content += '<h3 class="subsection-title">Counters</h3><div class="stats-grid">';
    for (const [name, value] of Object.entries(custom.counters)) {
      content += `
        <div class="stat">
          <div class="stat-label">${escapeHtml(name)}</div>
          <div class="stat-value">${value.toLocaleString()}</div>
        </div>
      `;
    }
    content += '</div>';
  }

  // Gauges
  if (Object.keys(custom.gauges).length > 0) {
    content += '<h3 class="subsection-title">Gauges</h3><div class="stats-grid">';
    for (const [name, value] of Object.entries(custom.gauges)) {
      content += `
        <div class="stat">
          <div class="stat-label">${escapeHtml(name)}</div>
          <div class="stat-value">${value.toFixed(3)}</div>
        </div>
      `;
    }
    content += '</div>';
  }

  // Histograms
  if (Object.keys(custom.histograms).length > 0) {
    content += '<h3 class="subsection-title">Histograms</h3><div class="stats-grid">';
    for (const [name, stats] of Object.entries(custom.histograms)) {
      content += `
        <div class="stat">
          <div class="stat-label">${escapeHtml(name)}</div>
          <div class="stat-value">
            Count: ${stats.count} | Mean: ${stats.mean.toFixed(2)} | P95: ${stats.p95.toFixed(2)}
          </div>
        </div>
      `;
    }
    content += '</div>';
  }

  // Timers
  if (Object.keys(custom.timers).length > 0) {
    content += '<h3 class="subsection-title">Timers</h3><div class="stats-grid">';
    for (const [name, stats] of Object.entries(custom.timers)) {
      content += `
        <div class="stat">
          <div class="stat-label">${escapeHtml(name)}</div>
          <div class="stat-value">
            Count: ${stats.count} | Mean: ${stats.mean.toFixed(2)}ms | P95: ${stats.p95.toFixed(2)}ms
          </div>
        </div>
      `;
    }
    content += '</div>';
  }

  content += '</section>';
  return content;
}

/**
 * Escape HTML special characters
 *
 * @private
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, char => map[char] || char);
}

/**
 * Get inline CSS styles
 *
 * @private
 */
function getStyles(): string {
  return `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      color: #e0e0e0;
      min-height: 100vh;
      line-height: 1.6;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 20px;
    }

    .header {
      background: linear-gradient(135deg, #7b2ff7 0%, #f107a3 100%);
      padding: 2rem 0;
      box-shadow: 0 4px 20px rgba(123, 47, 247, 0.3);
    }

    .title {
      font-size: 2.5rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
      color: white;
    }

    .subtitle {
      font-size: 1rem;
      opacity: 0.9;
      color: white;
    }

    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 1.5rem;
      margin: 2rem 0;
    }

    .card {
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 1.5rem;
      text-align: center;
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .card:hover {
      transform: translateY(-5px);
      box-shadow: 0 8px 25px rgba(123, 47, 247, 0.3);
    }

    .card-label {
      font-size: 0.875rem;
      color: #a0a0a0;
      margin-bottom: 0.5rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .card-value {
      font-size: 2rem;
      font-weight: 700;
      background: linear-gradient(135deg, #7b2ff7 0%, #f107a3 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .section {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 2rem;
      margin: 2rem 0;
    }

    .section-title {
      font-size: 1.5rem;
      margin-bottom: 1.5rem;
      color: #f107a3;
    }

    .subsection-title {
      font-size: 1.25rem;
      margin: 1.5rem 0 1rem;
      color: #7b2ff7;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1.5rem;
    }

    .stat {
      padding: 1rem;
      background: rgba(255, 255, 255, 0.03);
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.05);
    }

    .stat-label {
      font-size: 0.875rem;
      color: #a0a0a0;
      margin-bottom: 0.5rem;
    }

    .stat-value {
      font-size: 1.5rem;
      font-weight: 600;
      color: #fff;
    }

    .table-container {
      overflow-x: auto;
    }

    .table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.95rem;
    }

    .table th {
      background: rgba(123, 47, 247, 0.2);
      padding: 1rem;
      text-align: left;
      font-weight: 600;
      border-bottom: 2px solid rgba(123, 47, 247, 0.5);
      cursor: pointer;
      user-select: none;
    }

    .table th:hover {
      background: rgba(123, 47, 247, 0.3);
    }

    .table th.sortable::after {
      content: ' ⇅';
      opacity: 0.3;
    }

    .table th.number {
      text-align: right;
    }

    .table td {
      padding: 0.875rem 1rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }

    .table td.number {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }

    .table tr:hover {
      background: rgba(255, 255, 255, 0.03);
    }

    .badges {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
    }

    .badge {
      display: inline-block;
      padding: 0.5rem 1rem;
      border-radius: 20px;
      font-size: 0.875rem;
      font-weight: 600;
      white-space: nowrap;
    }

    .badge-success {
      background: rgba(76, 175, 80, 0.2);
      color: #81c784;
      border: 1px solid rgba(76, 175, 80, 0.3);
    }

    .badge-warning {
      background: rgba(255, 152, 0, 0.2);
      color: #ffb74d;
      border: 1px solid rgba(255, 152, 0, 0.3);
    }

    .badge-error {
      background: rgba(244, 67, 54, 0.2);
      color: #e57373;
      border: 1px solid rgba(244, 67, 54, 0.3);
    }

    .badge-info {
      background: rgba(33, 150, 243, 0.2);
      color: #64b5f6;
      border: 1px solid rgba(33, 150, 243, 0.3);
    }

    .empty {
      padding: 2rem;
      text-align: center;
      color: #808080;
      font-style: italic;
    }

    .footer {
      text-align: center;
      padding: 2rem 0;
      margin-top: 3rem;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      color: #a0a0a0;
    }

    .link {
      color: #7b2ff7;
      text-decoration: none;
      transition: color 0.2s;
    }

    .link:hover {
      color: #f107a3;
    }

    .progress-bar {
      width: 100%;
      height: 8px;
      background: #e9ecef;
      border-radius: 4px;
      margin-top: 0.5rem;
      overflow: hidden;
    }
    
    .progress-fill {
      height: 100%;
      transition: width 0.3s ease, background 0.3s ease;
      border-radius: 4px;
    }

    @media (max-width: 768px) {
      .title {
        font-size: 2rem;
      }

      .cards {
        grid-template-columns: repeat(2, 1fr);
      }

      .stats-grid {
        grid-template-columns: 1fr;
      }

      .table {
        font-size: 0.875rem;
      }

      .table th,
      .table td {
        padding: 0.75rem;
      }
    }

    @media (max-width: 375px) {
      .cards {
        grid-template-columns: 1fr;
      }

      .card-value {
        font-size: 1.75rem;
      }
    }
  `;
}

/**
 * Get inline JavaScript for interactive features
 *
 * @private
 */
function getScript(): string {
  return `
    // Table sorting functionality
    (function() {
      const table = document.getElementById('routesTable');
      if (!table) return;

      const headers = table.querySelectorAll('th.sortable');
      let sortColumn = null;
      let sortAscending = false;

      headers.forEach(header => {
        header.addEventListener('click', function() {
          const column = this.dataset.column;
          
          if (sortColumn === column) {
            sortAscending = !sortAscending;
          } else {
            sortColumn = column;
            sortAscending = false;
          }

          sortTable(column, sortAscending);
          updateHeaders(this);
        });
      });

      function sortTable(column, ascending) {
        const tbody = table.querySelector('tbody');
        const rows = Array.from(tbody.querySelectorAll('tr'));

        rows.sort((a, b) => {
          let aVal, bVal;

          if (column === 'route') {
            aVal = a.cells[0].textContent;
            bVal = b.cells[0].textContent;
            return ascending ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
          } else if (column === 'count') {
            aVal = parseInt(a.cells[1].textContent.replace(/,/g, ''));
            bVal = parseInt(b.cells[1].textContent.replace(/,/g, ''));
          } else if (column === 'latency') {
            aVal = parseFloat(a.cells[2].textContent);
            bVal = parseFloat(b.cells[2].textContent);
          }

          return ascending ? aVal - bVal : bVal - aVal;
        });

        tbody.innerHTML = '';
        rows.forEach(row => tbody.appendChild(row));
      }

      function updateHeaders(clickedHeader) {
        headers.forEach(h => {
          h.classList.remove('sorted-asc', 'sorted-desc');
          h.style.background = '';
        });

        clickedHeader.style.background = 'rgba(123, 47, 247, 0.4)';
        clickedHeader.classList.add(sortAscending ? 'sorted-asc' : 'sorted-desc');
      }
    })();
  `;
}
