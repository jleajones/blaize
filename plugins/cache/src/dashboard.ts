/**
 * Cache Dashboard Rendering
 *
 * Generates HTML dashboard for cache visualization with:
 * - Summary cards (hits, misses, hit rate, memory)
 * - Recent keys table
 * - Auto-refresh support
 * - BlaizeJS branding
 *
 * @module @blaizejs/plugin-cache/dashboard
 * @packageDocumentation
 */

import type { CacheService } from './cache-service';
import type { DashboardData } from './types';

// ============================================================================
// Data Gathering
// ============================================================================

/**
 * Gather data for dashboard rendering
 *
 * @param cache - Cache service instance
 * @returns Dashboard data
 */
export async function gatherDashboardData(cache: CacheService): Promise<DashboardData> {
  const stats = await cache.getStats();
  const totalRequests = stats.hits + stats.misses;
  const hitRate = totalRequests > 0 ? stats.hits / totalRequests : 0;

  // Get recent keys (implementation depends on adapter capabilities)
  // For now, return empty array - adapters can extend this
  let recentKeys: DashboardData['recentKeys'] = [];
  try {
    // Get all keys (limited to 50 most recent)
    const allKeys = await cache.keys('*');
    const keysToShow = allKeys.slice(0, 50);

    // Fetch value and TTL for each key
    recentKeys = await Promise.all(
      keysToShow.map(async key => {
        const result = await cache.getWithTTL(key);
        return {
          key,
          size: result.value ? result.value.length : 0,
          ttl: result.ttl,
        };
      })
    );
  } catch (error) {
    // If adapter doesn't support keys(), recentKeys stays empty
    console.error('Failed to fetch cache keys:', error);
  }

  return {
    stats,
    hitRate,
    recentKeys,
    timestamp: Date.now(),
  };
}

// ============================================================================
// Formatting Utilities
// ============================================================================

/**
 * Format bytes to human-readable string
 *
 * @param bytes - Number of bytes
 * @returns Formatted string (e.g., "1.5 MB")
 *
 * @example
 * ```typescript
 * formatBytes(1536000) // "1.5 MB"
 * formatBytes(1024)    // "1.0 KB"
 * ```
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);

  return `${value.toFixed(1)} ${units[i]}`;
}

/**
 * Format uptime to human-readable string
 *
 * @param ms - Uptime in milliseconds
 * @returns Formatted string (e.g., "2d 5h 30m")
 *
 * @example
 * ```typescript
 * formatUptime(186000000) // "2d 3h 40m"
 * formatUptime(3600000)   // "1h 0m"
 * ```
 */
export function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Format timestamp to ISO string
 *
 * @param timestamp - Milliseconds since epoch
 * @returns ISO 8601 string
 */
export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

/**
 * Format percentage to 2 decimal places
 *
 * @param value - Decimal value (0-1)
 * @returns Percentage string (e.g., "95.67%")
 */
export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

// ============================================================================
// HTML Rendering
// ============================================================================

/**
 * Render cache dashboard HTML
 *
 * @param data - Dashboard data
 * @param refreshInterval - Auto-refresh interval in seconds (optional)
 * @returns HTML string
 */
export function renderDashboard(data: DashboardData, refreshInterval?: number): string {
  const { stats, hitRate, recentKeys, timestamp } = data;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cache Dashboard - BlaizeJS</title>
  ${refreshInterval ? `<meta http-equiv="refresh" content="${refreshInterval}">` : ''}
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #1a202c;
      padding: 2rem;
      min-height: 100vh;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
    }

    .header {
      background: white;
      border-radius: 12px;
      padding: 2rem;
      margin-bottom: 2rem;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    .header h1 {
      font-size: 2rem;
      color: #2d3748;
      margin-bottom: 0.5rem;
    }

    .header p {
      color: #718096;
      font-size: 0.95rem;
    }

    .branding {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-top: 1rem;
    }

    .branding-logo {
      width: 24px;
      height: 24px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 6px;
    }

    .branding-text {
      font-size: 0.875rem;
      color: #a0aec0;
    }

    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }

    .card {
      background: white;
      border-radius: 12px;
      padding: 1.5rem;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      transition: transform 0.2s;
    }

    .card:hover {
      transform: translateY(-2px);
    }

    .card-label {
      font-size: 0.875rem;
      color: #718096;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.5rem;
    }

    .card-value {
      font-size: 2.25rem;
      font-weight: 700;
      color: #2d3748;
    }

    .card-subtitle {
      font-size: 0.875rem;
      color: #a0aec0;
      margin-top: 0.5rem;
    }

    .card.success .card-value {
      color: #38a169;
    }

    .card.warning .card-value {
      color: #d69e2e;
    }

    .card.info .card-value {
      color: #3182ce;
    }

    .section {
      background: white;
      border-radius: 12px;
      padding: 2rem;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      margin-bottom: 2rem;
    }

    .section-title {
      font-size: 1.25rem;
      font-weight: 600;
      color: #2d3748;
      margin-bottom: 1.5rem;
      padding-bottom: 0.75rem;
      border-bottom: 2px solid #e2e8f0;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    thead {
      background: #f7fafc;
    }

    th {
      text-align: left;
      padding: 0.75rem 1rem;
      font-size: 0.875rem;
      font-weight: 600;
      color: #4a5568;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    td {
      padding: 0.75rem 1rem;
      border-top: 1px solid #e2e8f0;
      font-size: 0.9rem;
      color: #2d3748;
    }

    .code {
      font-family: "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, monospace;
      background: #f7fafc;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.85rem;
    }

    .empty-state {
      text-align: center;
      padding: 3rem 1rem;
      color: #a0aec0;
    }

    .footer {
      text-align: center;
      color: white;
      font-size: 0.875rem;
      margin-top: 2rem;
      opacity: 0.8;
    }

    .refresh-badge {
      display: inline-block;
      background: #48bb78;
      color: white;
      padding: 0.25rem 0.75rem;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 600;
      margin-left: 0.5rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <h1>
        Cache Dashboard
        ${refreshInterval ? `<span class="refresh-badge">Auto-refresh: ${refreshInterval}s</span>` : ''}
      </h1>
      <p>Real-time cache statistics and monitoring</p>
      <div class="branding">
        <div class="branding-logo"></div>
        <span class="branding-text">Powered by BlaizeJS</span>
      </div>
    </div>

    <!-- Summary Cards -->
    <div class="cards">
      <div class="card success">
        <div class="card-label">Cache Hits</div>
        <div class="card-value">${stats.hits.toLocaleString()}</div>
        <div class="card-subtitle">Total successful cache retrievals</div>
      </div>

      <div class="card warning">
        <div class="card-label">Cache Misses</div>
        <div class="card-value">${stats.misses.toLocaleString()}</div>
        <div class="card-subtitle">Total cache misses</div>
      </div>

      <div class="card info">
        <div class="card-label">Hit Rate</div>
        <div class="card-value">${formatPercent(hitRate)}</div>
        <div class="card-subtitle">Efficiency metric</div>
      </div>

      <div class="card">
        <div class="card-label">Memory Usage</div>
        <div class="card-value">${formatBytes(stats.memoryUsage)}</div>
        <div class="card-subtitle">${stats.entryCount.toLocaleString()} entries</div>
      </div>

      <div class="card">
        <div class="card-label">Evictions</div>
        <div class="card-value">${stats.evictions.toLocaleString()}</div>
        <div class="card-subtitle">LRU + TTL evictions</div>
      </div>

      ${
        stats.uptime !== undefined
          ? `
      <div class="card">
        <div class="card-label">Uptime</div>
        <div class="card-value">${formatUptime(stats.uptime)}</div>
        <div class="card-subtitle">Since cache started</div>
      </div>
      `
          : ''
      }
    </div>

    <!-- Recent Keys -->
    <div class="section">
      <h2 class="section-title">Recent Cache Keys</h2>
      ${
        recentKeys.length > 0
          ? `
        <table>
          <thead>
            <tr>
              <th>Key</th>
              <th>Size</th>
              <th>TTL</th>
            </tr>
          </thead>
          <tbody>
            ${recentKeys
              .map(
                key => `
              <tr>
                <td><span class="code">${escapeHtml(key.key)}</span></td>
                <td>${formatBytes(key.size)}</td>
                <td>${key.ttl ? `${key.ttl}s` : 'No expiration'}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      `
          : `
        <div class="empty-state">
          <p>No recent keys available</p>
          <p style="font-size: 0.875rem; margin-top: 0.5rem;">
            Recent keys tracking may not be supported by the current cache adapter
          </p>
        </div>
      `
      }
    </div>

    <!-- Footer -->
    <div class="footer">
      <p>Generated at ${formatTimestamp(timestamp)}</p>
      <p style="margin-top: 0.5rem;">
        ${refreshInterval ? `Dashboard auto-refreshes every ${refreshInterval} seconds` : 'Refresh page for latest data'}
      </p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Escape HTML special characters
 *
 * @param unsafe - Unsafe string
 * @returns HTML-safe string
 * @internal
 */
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
