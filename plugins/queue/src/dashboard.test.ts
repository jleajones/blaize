/**
 * Dashboard Rendering Tests
 *
 * Unit tests for the HTML dashboard renderer and helpers.
 */

import {
  renderDashboard,
  gatherDashboardData,
  formatUptime,
  formatBytes,
  formatTimestamp,
} from './dashboard';
import { QueueService } from './queue-service';
import { InMemoryStorage } from './storage';

import type { DashboardData } from './types';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create mock logger
 */
function createMockLogger() {
  return {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
    child: () => createMockLogger(),
    flush: async () => {},
  };
}

/**
 * Create test dashboard data
 */
function createTestDashboardData(): DashboardData {
  return {
    queues: [
      {
        name: 'emails',
        stats: {
          total: 100,
          queued: 10,
          running: 5,
          completed: 80,
          failed: 3,
          cancelled: 2,
        },
        jobs: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            type: 'send-welcome',
            queueName: 'emails',
            data: { userId: '123' },
            status: 'completed',
            priority: 5,
            progress: 100,
            retries: 0,
            maxRetries: 3,
            timeout: 30000,
            metadata: {},
            queuedAt: Date.now() - 60000,
            startedAt: Date.now() - 50000,
            completedAt: Date.now() - 40000,
            result: { sent: true },
          },
          {
            id: '550e8400-e29b-41d4-a716-446655440001',
            type: 'send-notification',
            queueName: 'emails',
            data: { message: 'Hello' },
            status: 'running',
            priority: 8,
            progress: 50,
            retries: 0,
            maxRetries: 3,
            timeout: 30000,
            metadata: {},
            queuedAt: Date.now() - 30000,
            startedAt: Date.now() - 20000,
          },
          {
            id: '550e8400-e29b-41d4-a716-446655440002',
            type: 'send-report',
            queueName: 'emails',
            data: {},
            status: 'failed',
            priority: 3,
            progress: 0,
            retries: 3,
            maxRetries: 3,
            timeout: 30000,
            metadata: {},
            queuedAt: Date.now() - 120000,
            startedAt: Date.now() - 110000,
            completedAt: Date.now() - 100000,
            error: { message: 'Connection failed', code: 'ECONNREFUSED' },
          },
        ],
      },
      {
        name: 'reports',
        stats: {
          total: 50,
          queued: 5,
          running: 2,
          completed: 40,
          failed: 2,
          cancelled: 1,
        },
        jobs: [],
      },
    ],
    timestamp: Date.now(),
  };
}

// ============================================================================
// Format Helper Tests
// ============================================================================

describe('formatUptime', () => {
  it('should format seconds', () => {
    expect(formatUptime(5000)).toBe('5s');
    expect(formatUptime(45000)).toBe('45s');
  });

  it('should format minutes', () => {
    expect(formatUptime(60000)).toBe('1m 0s');
    expect(formatUptime(90000)).toBe('1m 30s');
    expect(formatUptime(3600000 - 1000)).toBe('59m 59s');
  });

  it('should format hours', () => {
    expect(formatUptime(3600000)).toBe('1h 0m');
    expect(formatUptime(3660000)).toBe('1h 1m');
    expect(formatUptime(7200000)).toBe('2h 0m');
  });

  it('should format days', () => {
    expect(formatUptime(86400000)).toBe('1d 0h');
    expect(formatUptime(90000000)).toBe('1d 1h');
    expect(formatUptime(172800000)).toBe('2d 0h');
  });
});

describe('formatBytes', () => {
  it('should format zero bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('should format bytes', () => {
    expect(formatBytes(500)).toBe('500.0 B');
    expect(formatBytes(1023)).toBe('1023.0 B');
  });

  it('should format kilobytes', () => {
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
  });

  it('should format megabytes', () => {
    expect(formatBytes(1048576)).toBe('1.0 MB');
    expect(formatBytes(52428800)).toBe('50.0 MB');
  });

  it('should format gigabytes', () => {
    expect(formatBytes(1073741824)).toBe('1.0 GB');
  });
});

describe('formatTimestamp', () => {
  it('should format timestamp to locale string', () => {
    const ts = new Date('2025-01-15T12:00:00Z').getTime();
    const result = formatTimestamp(ts);
    // Just verify it produces a non-empty string
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
  });

  it('should handle current timestamp', () => {
    const result = formatTimestamp(Date.now());
    expect(result).toBeTruthy();
  });
});

// ============================================================================
// renderDashboard Tests
// ============================================================================

describe('renderDashboard', () => {
  describe('HTML structure', () => {
    it('should generate valid HTML5 document', () => {
      const data = createTestDashboardData();
      const html = renderDashboard(data);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="en">');
      expect(html).toContain('</html>');
    });

    it('should include required meta tags', () => {
      const data = createTestDashboardData();
      const html = renderDashboard(data);

      expect(html).toContain('<meta charset="UTF-8">');
      expect(html).toContain('<meta name="viewport"');
      expect(html).toContain('<meta name="description"');
    });

    it('should include semantic HTML5 elements', () => {
      const data = createTestDashboardData();
      const html = renderDashboard(data);

      expect(html).toContain('<header');
      expect(html).toContain('<main');
      expect(html).toContain('<footer');
      expect(html).toContain('<section');
    });

    it('should have proper title', () => {
      const data = createTestDashboardData();
      const html = renderDashboard(data);

      expect(html).toContain('<title>BlaizeJS Queue Dashboard</title>');
    });
  });

  describe('inline dependencies', () => {
    it('should include inline CSS', () => {
      const data = createTestDashboardData();
      const html = renderDashboard(data);

      expect(html).toContain('<style>');
      expect(html).toContain('</style>');
      expect(html).toMatch(/body\s*\{/);
      expect(html).toMatch(/\.card\s*\{/);
    });

    it('should include inline JavaScript', () => {
      const data = createTestDashboardData();
      const html = renderDashboard(data);

      expect(html).toContain('<script>');
      expect(html).toContain('</script>');
    });

    it('should have no external dependencies', () => {
      const data = createTestDashboardData();
      const html = renderDashboard(data);

      expect(html).not.toContain('<link rel="stylesheet"');
      expect(html).not.toContain('<script src="');
    });
  });

  describe('BlaizeJS branding', () => {
    it('should include BlaizeJS title', () => {
      const data = createTestDashboardData();
      const html = renderDashboard(data);

      expect(html).toContain('BlaizeJS Queue');
    });

    it('should include purple gradient styling', () => {
      const data = createTestDashboardData();
      const html = renderDashboard(data);

      expect(html).toMatch(/#7b2ff7/i);
      expect(html).toMatch(/#f107a3/i);
      expect(html).toContain('gradient');
    });

    it('should include flame emoji', () => {
      const data = createTestDashboardData();
      const html = renderDashboard(data);

      expect(html).toContain('🔥');
    });
  });

  describe('summary cards', () => {
    it('should display total jobs', () => {
      const data = createTestDashboardData();
      const html = renderDashboard(data);

      expect(html).toContain('Total Jobs');
      expect(html).toContain('150'); // 100 + 50
    });

    it('should display queue count', () => {
      const data = createTestDashboardData();
      const html = renderDashboard(data);

      expect(html).toContain('Queues');
      expect(html).toContain('>2<'); // 2 queues
    });
  });

  describe('queue overview', () => {
    it('should display queue names', () => {
      const data = createTestDashboardData();
      const html = renderDashboard(data);

      expect(html).toContain('emails');
      expect(html).toContain('reports');
    });

    it('should display queue stats', () => {
      const data = createTestDashboardData();
      const html = renderDashboard(data);

      expect(html).toContain('Queued');
      expect(html).toContain('Running');
      expect(html).toContain('Completed');
      expect(html).toContain('Failed');
    });

    it('should show empty state when no queues', () => {
      const data: DashboardData = { queues: [], timestamp: Date.now() };
      const html = renderDashboard(data);

      expect(html).toContain('No queues configured');
    });
  });

  describe('jobs table', () => {
    it('should display job IDs (truncated)', () => {
      const data = createTestDashboardData();
      const html = renderDashboard(data);

      expect(html).toContain('550e8400');
    });

    it('should display job types', () => {
      const data = createTestDashboardData();
      const html = renderDashboard(data);

      expect(html).toContain('send-welcome');
      expect(html).toContain('send-notification');
    });

    it('should display status badges', () => {
      const data = createTestDashboardData();
      const html = renderDashboard(data);

      expect(html).toContain('badge-success');
      expect(html).toContain('badge-info');
      expect(html).toContain('badge-error');
    });

    it('should show empty state when no jobs', () => {
      const data: DashboardData = {
        queues: [
          {
            name: 'empty',
            stats: { total: 0, queued: 0, running: 0, completed: 0, failed: 0, cancelled: 0 },
            jobs: [],
          },
        ],
        timestamp: Date.now(),
      };
      const html = renderDashboard(data);

      expect(html).toContain('No jobs found');
    });
  });

  describe('job details modal', () => {
    it('should include modal overlay', () => {
      const data = createTestDashboardData();
      const html = renderDashboard(data);

      expect(html).toContain('modal-overlay');
      expect(html).toContain('jobModal');
    });

    it('should include close button', () => {
      const data = createTestDashboardData();
      const html = renderDashboard(data);

      expect(html).toContain('modal-close');
      expect(html).toContain('closeModal');
    });

    it('should include showJobDetails function', () => {
      const data = createTestDashboardData();
      const html = renderDashboard(data);

      expect(html).toContain('showJobDetails');
    });

    it('should make job rows clickable', () => {
      const data = createTestDashboardData();
      const html = renderDashboard(data);

      expect(html).toContain('class="clickable"');
      expect(html).toContain('onclick="showJobDetails');
    });
  });

  describe('auto-refresh', () => {
    it('should not include refresh meta tag by default', () => {
      const data = createTestDashboardData();
      const html = renderDashboard(data);

      expect(html).not.toContain('http-equiv="refresh"');
    });

    it('should include refresh meta tag when specified', () => {
      const data = createTestDashboardData();
      const html = renderDashboard(data, { refreshInterval: 30 });

      expect(html).toContain('http-equiv="refresh"');
      expect(html).toContain('content="30"');
    });

    it('should accept different refresh intervals', () => {
      const data = createTestDashboardData();
      const html = renderDashboard(data, { refreshInterval: 60 });

      expect(html).toContain('content="60"');
    });
  });

  describe('responsive design', () => {
    it('should include viewport meta tag', () => {
      const data = createTestDashboardData();
      const html = renderDashboard(data);

      expect(html).toContain('width=device-width');
      expect(html).toContain('initial-scale=1.0');
    });

    it('should include responsive CSS media queries', () => {
      const data = createTestDashboardData();
      const html = renderDashboard(data);

      expect(html).toContain('@media (max-width: 768px)');
      expect(html).toContain('@media (max-width: 480px)');
    });
  });

  describe('footer', () => {
    it('should include BlaizeJS branding', () => {
      const data = createTestDashboardData();
      const html = renderDashboard(data);

      expect(html).toContain('Powered by');
      expect(html).toContain('BlaizeJS');
    });

    it('should include link to Prometheus endpoint', () => {
      const data = createTestDashboardData();
      const html = renderDashboard(data);

      expect(html).toContain('/queue/metrics');
      expect(html).toContain('Prometheus Metrics');
    });
  });

  describe('HTML escaping', () => {
    it('should escape special characters in queue names', () => {
      const data: DashboardData = {
        queues: [
          {
            name: '<script>alert("xss")</script>',
            stats: { total: 0, queued: 0, running: 0, completed: 0, failed: 0, cancelled: 0 },
            jobs: [],
          },
        ],
        timestamp: Date.now(),
      };
      const html = renderDashboard(data);

      expect(html).not.toContain('<script>alert("xss")</script>');
      expect(html).toContain('&lt;script&gt;');
    });
  });
});

// ============================================================================
// gatherDashboardData Tests
// ============================================================================

describe('gatherDashboardData', () => {
  it('should gather data from queue service', async () => {
    const storage = new InMemoryStorage();
    await storage.connect?.();

    const queueService = new QueueService({
      queues: { emails: { concurrency: 1 } },
      storage,
      logger: createMockLogger() as any,
    });

    queueService.registerHandler('emails', 'send', async () => 'sent');
    await queueService.add('emails', 'send', { to: 'test@example.com' });

    const data = await gatherDashboardData(queueService, ['emails']);

    expect(data.queues).toHaveLength(1);
    expect(data.queues[0]!.name).toBe('emails');
    expect(data.queues[0]!.stats.total).toBe(1);
    expect(data.queues[0]!.stats.queued).toBe(1);
    expect(data.queues[0]!.jobs).toHaveLength(1);
    expect(data.timestamp).toBeDefined();
  });

  it('should gather data from multiple queues', async () => {
    const storage = new InMemoryStorage();
    await storage.connect?.();

    const queueService = new QueueService({
      queues: {
        emails: { concurrency: 1 },
        reports: { concurrency: 1 },
      },
      storage,
      logger: createMockLogger() as any,
    });

    queueService.registerHandler('emails', 'send', async () => 'sent');
    queueService.registerHandler('reports', 'generate', async () => 'done');
    await queueService.add('emails', 'send', {});
    await queueService.add('reports', 'generate', {});

    const data = await gatherDashboardData(queueService, ['emails', 'reports']);

    expect(data.queues).toHaveLength(2);
    expect(data.queues.map(q => q.name)).toContain('emails');
    expect(data.queues.map(q => q.name)).toContain('reports');
  });

  it('should return empty jobs for empty queue', async () => {
    const storage = new InMemoryStorage();
    await storage.connect?.();

    const queueService = new QueueService({
      queues: { empty: { concurrency: 1 } },
      storage,
      logger: createMockLogger() as any,
    });

    const data = await gatherDashboardData(queueService, ['empty']);

    expect(data.queues).toHaveLength(1);
    expect(data.queues[0]!.jobs).toHaveLength(0);
    expect(data.queues[0]!.stats.total).toBe(0);
  });
});
