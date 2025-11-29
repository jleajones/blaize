/**
 * HTML Dashboard Renderer for Queue Plugin
 *
 * Generates standalone HTML dashboard for queue visualization.
 * Features responsive design, BlaizeJS branding, and no external dependencies.
 * Styling matches the metrics plugin dashboard.
 *
 * @module @blaizejs/queue/dashboard
 * @since 0.4.0
 */

import type { QueueService } from './queue-service';
import type { DashboardData, DashboardOptions, Job, JobStatus } from './types';

// ============================================================================
// Data Gathering
// ============================================================================

/**
 * Gather dashboard data from queue service
 *
 * Collects statistics and recent jobs from all specified queues.
 *
 * @param queueService - Queue service instance
 * @param queueNames - Queue names to include
 * @returns Dashboard data ready for rendering
 *
 * @example
 * ```typescript
 * const data = await gatherDashboardData(queueService, ['emails', 'reports']);
 * const html = renderDashboard(data);
 * ```
 */
export async function gatherDashboardData(
  queueService: QueueService,
  queueNames: string[]
): Promise<DashboardData> {
  const queues = await Promise.all(
    queueNames.map(async name => {
      const stats = await queueService.getQueueStats(name);
      const jobs = await queueService.listJobs(name, { limit: 50 });
      return { name, stats, jobs };
    })
  );

  return {
    queues,
    timestamp: Date.now(),
  };
}

// ============================================================================
// Format Helpers (Exported)
// ============================================================================

/**
 * Format milliseconds duration into human-readable string
 *
 * @param ms - Duration in milliseconds
 * @returns Formatted string like "2h 15m" or "45m 30s"
 *
 * @example
 * ```typescript
 * formatUptime(7200000);  // "2h 0m"
 * formatUptime(3665000);  // "1h 1m"
 * formatUptime(45000);    // "0m 45s"
 * ```
 */
export function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

/**
 * Format bytes into human-readable string
 *
 * @param bytes - Number of bytes
 * @returns Formatted string like "1.5 GB" or "256 MB"
 *
 * @example
 * ```typescript
 * formatBytes(1536);       // "1.5 KB"
 * formatBytes(1048576);    // "1.0 MB"
 * formatBytes(1073741824); // "1.0 GB"
 * ```
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`;
}

/**
 * Format timestamp for display
 *
 * @param ts - Timestamp in milliseconds since epoch
 * @returns Formatted date string
 *
 * @example
 * ```typescript
 * formatTimestamp(Date.now()); // "1/15/2025, 12:30:45 PM"
 * ```
 */
export function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString();
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Escape HTML special characters
 *
 * @param str - String to escape
 * @returns Escaped string safe for HTML
 * @internal
 */
function escapeHtml(str: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return str.replace(/[&<>"']/g, char => map[char] || char);
}

/**
 * Get CSS class for status badge
 *
 * @param status - Job status
 * @returns CSS class name
 * @internal
 */
function getStatusBadgeClass(status: JobStatus): string {
  switch (status) {
    case 'completed':
      return 'badge-success';
    case 'failed':
      return 'badge-error';
    case 'running':
      return 'badge-info';
    case 'cancelled':
      return 'badge-warning';
    case 'queued':
    default:
      return 'badge-default';
  }
}

/**
 * Get status color for progress bar
 *
 * @param status - Job status
 * @returns CSS color value
 * @internal
 */
function getStatusColor(status: JobStatus): string {
  switch (status) {
    case 'completed':
      return '#4caf50';
    case 'failed':
      return '#f44336';
    case 'running':
      return '#2196f3';
    case 'cancelled':
      return '#ff9800';
    case 'queued':
    default:
      return '#9e9e9e';
  }
}

/**
 * Format job duration
 *
 * @param job - Job to format duration for
 * @returns Formatted duration or dash
 * @internal
 */
function formatJobDuration(job: Job): string {
  if (!job.startedAt) return '-';
  const endTime = job.completedAt ?? Date.now();
  const duration = endTime - job.startedAt;
  return formatUptime(duration);
}

// ============================================================================
// CSS Styles
// ============================================================================

/**
 * Get inline CSS styles matching metrics plugin
 *
 * @returns CSS string
 * @internal
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

    .queue-card {
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }

    .queue-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .queue-name {
      font-size: 1.25rem;
      font-weight: 600;
      color: #f107a3;
    }

    .queue-total {
      font-size: 0.875rem;
      color: #a0a0a0;
    }

    .queue-stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
      gap: 1rem;
    }

    .queue-stat {
      text-align: center;
      padding: 0.75rem;
      background: rgba(255, 255, 255, 0.03);
      border-radius: 8px;
    }

    .queue-stat-value {
      font-size: 1.5rem;
      font-weight: 700;
      color: #fff;
    }

    .queue-stat-label {
      font-size: 0.75rem;
      color: #a0a0a0;
      text-transform: uppercase;
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

    .table tr.clickable {
      cursor: pointer;
    }

    .badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: 20px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
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

    .badge-default {
      background: rgba(158, 158, 158, 0.2);
      color: #bdbdbd;
      border: 1px solid rgba(158, 158, 158, 0.3);
    }

    .progress-bar {
      width: 100%;
      height: 6px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 3px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      border-radius: 3px;
      transition: width 0.3s ease;
    }

    .empty {
      padding: 2rem;
      text-align: center;
      color: #808080;
      font-style: italic;
    }

    .job-id {
      font-family: 'SF Mono', Monaco, 'Courier New', monospace;
      font-size: 0.8rem;
      color: #a0a0a0;
    }

    .footer {
      text-align: center;
      padding: 2rem 0;
      margin-top: 2rem;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      color: #808080;
    }

    .footer a {
      color: #7b2ff7;
      text-decoration: none;
    }

    .footer a:hover {
      text-decoration: underline;
    }

    /* Modal styles */
    .modal-overlay {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      z-index: 1000;
      justify-content: center;
      align-items: center;
    }

    .modal-overlay.active {
      display: flex;
    }

    .modal {
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 2rem;
      max-width: 600px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .modal-title {
      font-size: 1.25rem;
      font-weight: 600;
      color: #f107a3;
    }

    .modal-close {
      background: none;
      border: none;
      color: #a0a0a0;
      font-size: 1.5rem;
      cursor: pointer;
      padding: 0.25rem;
    }

    .modal-close:hover {
      color: #fff;
    }

    .modal-content {
      display: grid;
      gap: 1rem;
    }

    .modal-row {
      display: grid;
      grid-template-columns: 120px 1fr;
      gap: 1rem;
      padding: 0.5rem 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }

    .modal-label {
      font-size: 0.875rem;
      color: #a0a0a0;
      text-transform: uppercase;
    }

    .modal-value {
      font-size: 0.875rem;
      color: #e0e0e0;
      word-break: break-all;
    }

    .modal-value pre {
      background: rgba(0, 0, 0, 0.3);
      padding: 0.75rem;
      border-radius: 6px;
      overflow-x: auto;
      font-size: 0.8rem;
      margin: 0;
    }

    @media (max-width: 768px) {
      .title {
        font-size: 1.75rem;
      }

      .cards {
        grid-template-columns: repeat(2, 1fr);
      }

      .queue-stats {
        grid-template-columns: repeat(3, 1fr);
      }

      .modal {
        padding: 1.5rem;
      }

      .modal-row {
        grid-template-columns: 1fr;
        gap: 0.25rem;
      }
    }

    @media (max-width: 480px) {
      .cards {
        grid-template-columns: 1fr;
      }

      .queue-stats {
        grid-template-columns: repeat(2, 1fr);
      }
    }
  `;
}

/**
 * Get inline JavaScript for interactivity
 *
 * @returns JavaScript string
 * @internal
 */
function getScript(): string {
  return `
    // Job details modal
    const modal = document.getElementById('jobModal');
    const modalContent = document.getElementById('modalContent');

    function showJobDetails(jobData) {
      const job = JSON.parse(decodeURIComponent(jobData));
      
      modalContent.innerHTML = \`
        <div class="modal-row">
          <span class="modal-label">Job ID</span>
          <span class="modal-value">\${job.id}</span>
        </div>
        <div class="modal-row">
          <span class="modal-label">Queue</span>
          <span class="modal-value">\${job.queueName}</span>
        </div>
        <div class="modal-row">
          <span class="modal-label">Type</span>
          <span class="modal-value">\${job.type}</span>
        </div>
        <div class="modal-row">
          <span class="modal-label">Status</span>
          <span class="modal-value">\${job.status}</span>
        </div>
        <div class="modal-row">
          <span class="modal-label">Priority</span>
          <span class="modal-value">\${job.priority}</span>
        </div>
        <div class="modal-row">
          <span class="modal-label">Progress</span>
          <span class="modal-value">\${job.progress}%</span>
        </div>
        <div class="modal-row">
          <span class="modal-label">Retries</span>
          <span class="modal-value">\${job.retries} / \${job.maxRetries}</span>
        </div>
        <div class="modal-row">
          <span class="modal-label">Queued At</span>
          <span class="modal-value">\${new Date(job.queuedAt).toLocaleString()}</span>
        </div>
        \${job.startedAt ? \`
        <div class="modal-row">
          <span class="modal-label">Started At</span>
          <span class="modal-value">\${new Date(job.startedAt).toLocaleString()}</span>
        </div>
        \` : ''}
        \${job.completedAt ? \`
        <div class="modal-row">
          <span class="modal-label">Completed At</span>
          <span class="modal-value">\${new Date(job.completedAt).toLocaleString()}</span>
        </div>
        \` : ''}
        <div class="modal-row">
          <span class="modal-label">Data</span>
          <span class="modal-value"><pre>\${JSON.stringify(job.data, null, 2)}</pre></span>
        </div>
        \${job.result !== undefined ? \`
        <div class="modal-row">
          <span class="modal-label">Result</span>
          <span class="modal-value"><pre>\${JSON.stringify(job.result, null, 2)}</pre></span>
        </div>
        \` : ''}
        \${job.error ? \`
        <div class="modal-row">
          <span class="modal-label">Error</span>
          <span class="modal-value" style="color: #e57373;">
            \${job.error.message}
            \${job.error.code ? \`(Code: \${job.error.code})\` : ''}
          </span>
        </div>
        \` : ''}
      \`;
      
      modal.classList.add('active');
    }

    function closeModal() {
      modal.classList.remove('active');
    }

    // Close on overlay click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });

    // Close on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeModal();
      }
    });

    // Table sorting
    document.querySelectorAll('.table th.sortable').forEach(th => {
      th.addEventListener('click', () => {
        const table = th.closest('table');
        const tbody = table.querySelector('tbody');
        const rows = Array.from(tbody.querySelectorAll('tr'));
        const column = th.dataset.column;
        const isAsc = th.classList.contains('sort-asc');
        
        // Remove sort classes from all headers
        table.querySelectorAll('th').forEach(h => {
          h.classList.remove('sort-asc', 'sort-desc');
        });
        
        // Add sort class to current header
        th.classList.add(isAsc ? 'sort-desc' : 'sort-asc');
        
        // Sort rows
        rows.sort((a, b) => {
          const aVal = a.querySelector(\`td[data-\${column}]\`)?.dataset[column] || '';
          const bVal = b.querySelector(\`td[data-\${column}]\`)?.dataset[column] || '';
          
          const aNum = parseFloat(aVal);
          const bNum = parseFloat(bVal);
          
          if (!isNaN(aNum) && !isNaN(bNum)) {
            return isAsc ? bNum - aNum : aNum - bNum;
          }
          
          return isAsc ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
        });
        
        rows.forEach(row => tbody.appendChild(row));
      });
    });
  `;
}

// ============================================================================
// Rendering Functions
// ============================================================================

/**
 * Render summary cards showing totals across all queues
 *
 * @param data - Dashboard data
 * @returns HTML string
 * @internal
 */
function renderSummaryCards(data: DashboardData): string {
  const totals = data.queues.reduce(
    (acc, q) => ({
      total: acc.total + q.stats.total,
      queued: acc.queued + q.stats.queued,
      running: acc.running + q.stats.running,
      completed: acc.completed + q.stats.completed,
      failed: acc.failed + q.stats.failed,
      cancelled: acc.cancelled + q.stats.cancelled,
    }),
    { total: 0, queued: 0, running: 0, completed: 0, failed: 0, cancelled: 0 }
  );

  return `
    <div class="card">
      <div class="card-label">Total Jobs</div>
      <div class="card-value">${totals.total.toLocaleString()}</div>
    </div>
    <div class="card">
      <div class="card-label">Queued</div>
      <div class="card-value">${totals.queued.toLocaleString()}</div>
    </div>
    <div class="card">
      <div class="card-label">Running</div>
      <div class="card-value">${totals.running.toLocaleString()}</div>
    </div>
    <div class="card">
      <div class="card-label">Completed</div>
      <div class="card-value">${totals.completed.toLocaleString()}</div>
    </div>
    <div class="card">
      <div class="card-label">Failed</div>
      <div class="card-value">${totals.failed.toLocaleString()}</div>
    </div>
    <div class="card">
      <div class="card-label">Queues</div>
      <div class="card-value">${data.queues.length}</div>
    </div>
  `;
}

/**
 * Render individual queue cards
 *
 * @param data - Dashboard data
 * @returns HTML string
 * @internal
 */
function renderQueueCards(data: DashboardData): string {
  if (data.queues.length === 0) {
    return '<p class="empty">No queues configured</p>';
  }

  return data.queues
    .map(
      q => `
      <div class="queue-card">
        <div class="queue-card-header">
          <span class="queue-name">${escapeHtml(q.name)}</span>
          <span class="queue-total">${q.stats.total} total jobs</span>
        </div>
        <div class="queue-stats">
          <div class="queue-stat">
            <div class="queue-stat-value">${q.stats.queued}</div>
            <div class="queue-stat-label">Queued</div>
          </div>
          <div class="queue-stat">
            <div class="queue-stat-value">${q.stats.running}</div>
            <div class="queue-stat-label">Running</div>
          </div>
          <div class="queue-stat">
            <div class="queue-stat-value">${q.stats.completed}</div>
            <div class="queue-stat-label">Completed</div>
          </div>
          <div class="queue-stat">
            <div class="queue-stat-value">${q.stats.failed}</div>
            <div class="queue-stat-label">Failed</div>
          </div>
          <div class="queue-stat">
            <div class="queue-stat-value">${q.stats.cancelled}</div>
            <div class="queue-stat-label">Cancelled</div>
          </div>
        </div>
      </div>
    `
    )
    .join('');
}

/**
 * Render jobs table with clickable rows for details modal
 *
 * @param data - Dashboard data
 * @returns HTML string
 * @internal
 */
function renderJobsTable(data: DashboardData): string {
  const allJobs = data.queues
    .flatMap(q => q.jobs)
    .sort((a, b) => b.queuedAt - a.queuedAt)
    .slice(0, 50);

  if (allJobs.length === 0) {
    return '<p class="empty">No jobs found</p>';
  }

  const rows = allJobs
    .map(job => {
      // Create a safe JSON representation for the onclick handler
      const jobData = encodeURIComponent(
        JSON.stringify({
          id: job.id,
          type: job.type,
          queueName: job.queueName,
          status: job.status,
          priority: job.priority,
          progress: job.progress,
          retries: job.retries,
          maxRetries: job.maxRetries,
          queuedAt: job.queuedAt,
          startedAt: job.startedAt,
          completedAt: job.completedAt,
          data: job.data,
          result: job.result,
          error: job.error ? { message: job.error.message, code: job.error.code } : undefined,
        })
      );

      return `
        <tr class="clickable" onclick="showJobDetails('${jobData}')">
          <td data-id="${job.id}">
            <span class="job-id">${escapeHtml(job.id.slice(0, 8))}...</span>
          </td>
          <td data-queue="${escapeHtml(job.queueName)}">${escapeHtml(job.queueName)}</td>
          <td data-type="${escapeHtml(job.type)}">${escapeHtml(job.type)}</td>
          <td>
            <span class="badge ${getStatusBadgeClass(job.status)}">${job.status}</span>
          </td>
          <td class="number" data-priority="${job.priority}">${job.priority}</td>
          <td>
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${job.progress}%; background: ${getStatusColor(job.status)};"></div>
            </div>
          </td>
          <td class="number" data-duration="${job.startedAt ? (job.completedAt ?? Date.now()) - job.startedAt : 0}">
            ${formatJobDuration(job)}
          </td>
          <td data-queued="${job.queuedAt}">${formatTimestamp(job.queuedAt)}</td>
        </tr>
      `;
    })
    .join('');

  return `
    <div class="table-container">
      <table class="table">
        <thead>
          <tr>
            <th class="sortable" data-column="id">ID</th>
            <th class="sortable" data-column="queue">Queue</th>
            <th class="sortable" data-column="type">Type</th>
            <th>Status</th>
            <th class="sortable number" data-column="priority">Priority</th>
            <th>Progress</th>
            <th class="sortable number" data-column="duration">Duration</th>
            <th class="sortable" data-column="queued">Queued At</th>
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
 * Render job details modal
 *
 * @returns HTML string
 * @internal
 */
function renderModal(): string {
  return `
    <div id="jobModal" class="modal-overlay">
      <div class="modal">
        <div class="modal-header">
          <span class="modal-title">Job Details</span>
          <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
        <div id="modalContent" class="modal-content">
          <!-- Populated by JavaScript -->
        </div>
      </div>
    </div>
  `;
}

// ============================================================================
// Main Render Function
// ============================================================================

/**
 * Render HTML dashboard
 *
 * Generates a complete HTML document with inline CSS and JavaScript.
 * Matches the metrics plugin styling with BlaizeJS branding.
 *
 * @param data - Dashboard data to render
 * @param options - Rendering options
 * @returns Complete HTML document string
 *
 * @example
 * ```typescript
 * const data = await gatherDashboardData(queueService, ['emails']);
 * const html = renderDashboard(data, { refreshInterval: 30 });
 * ctx.response.html(html);
 * ```
 */
export function renderDashboard(data: DashboardData, options: DashboardOptions = {}): string {
  const timestamp = formatTimestamp(data.timestamp);
  const refreshMeta = options.refreshInterval
    ? `<meta http-equiv="refresh" content="${options.refreshInterval}">`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="BlaizeJS Queue Dashboard">
  ${refreshMeta}
  <title>BlaizeJS Queue Dashboard</title>
  <style>
    ${getStyles()}
  </style>
</head>
<body>
  <header class="header">
    <div class="container">
      <h1 class="title">🔥 BlaizeJS Queue</h1>
      <p class="subtitle">Last updated: ${timestamp}</p>
    </div>
  </header>

  <main class="container">
    <!-- Summary Cards -->
    <section class="cards">
      ${renderSummaryCards(data)}
    </section>

    <!-- Queue Overview -->
    <section class="section">
      <h2 class="section-title">Queue Overview</h2>
      ${renderQueueCards(data)}
    </section>

    <!-- Recent Jobs -->
    <section class="section">
      <h2 class="section-title">Recent Jobs</h2>
      ${renderJobsTable(data)}
    </section>
  </main>

  <footer class="footer">
    <div class="container">
      <p>Powered by <strong>BlaizeJS</strong> • <a href="/queue/metrics">Prometheus Metrics</a></p>
    </div>
  </footer>

  ${renderModal()}

  <script>
    ${getScript()}
  </script>
</body>
</html>`;
}
