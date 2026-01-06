/**
 * Cache Route Handlers Tests
 *
 * Comprehensive test suite for all cache route handlers:
 * - cacheStatsHandler
 * - cachePrometheusHandler
 * - cacheDashboardHandler
 * - cacheEventsHandler (SSE)
 *
 * @packageDocumentation
 */

import { ServiceNotAvailableError } from 'blaizejs';

import { createMockLogger } from '@blaizejs/testing-utils';

import { CacheService } from './cache-service';
import {
  cacheStatsHandler,
  cachePrometheusHandler,
  cacheDashboardHandler,
  cacheEventsHandler,
} from './routes';
import { MemoryAdapter } from './storage/memory';

import type { CacheSSEStream } from './routes';
import type { Context } from 'blaizejs';

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Create mock context with cache service
 *
 * NOTE: This is a custom implementation following the queue plugin pattern.
 * We do NOT use createMockContext from @blaizejs/testing-utils for route tests
 * because we need the _getResponse() helper to inspect response data.
 */
function createMockContext(
  query: Record<string, string> = {},
  cacheService?: CacheService
): Context & { _getResponse(): { contentType?: string; content?: string; statusCode: number } } {
  let contentType: string | undefined;
  let content: string | undefined;
  let statusCode = 200;

  const response = {
    statusCode,
    sent: false,
    raw: {} as any,
    status(code: number) {
      statusCode = code;
      return response;
    },
    header: () => undefined,
    headers: () => ({}),
    type(ct: string) {
      contentType = ct;
      return response;
    },
    json(data: unknown, status?: number) {
      if (status !== undefined) statusCode = status;
      content = JSON.stringify(data);
      contentType = contentType || 'application/json';
      response.sent = true;
    },
    text(data: string, status?: number) {
      if (status !== undefined) statusCode = status;
      content = data;
      response.sent = true;
    },
    html(data: string, status?: number) {
      if (status !== undefined) statusCode = status;
      content = data;
      response.sent = true;
    },
    redirect(location: string, status?: number) {
      if (status !== undefined) statusCode = status;
      response.sent = true;
    },
  };

  return {
    request: {
      method: 'GET',
      path: '/cache/stats',
      url: null,
      query: query as any,
      params: {},
      body: null,
      protocol: 'http',
      isHttp2: false,
      header: () => undefined,
      headers: () => ({}),
      raw: {} as any,
    },
    response,
    state: {},
    services: {
      cache: cacheService,
    },
    _getResponse() {
      return { contentType, content, statusCode };
    },
  } as any;
}

/**
 * Create mock SSE stream
 */
/**
 * Create a mock SSE stream
 */
function createMockStream(): CacheSSEStream & {
  events: Array<{ event: string; data: unknown }>;
  closeCallbacks: Array<() => void>;
  closed: boolean;
} {
  const events: Array<{ event: string; data: unknown }> = [];
  const closeCallbacks: Array<() => void> = [];

  // Use an object to hold state so it can be mutated
  const state = { closed: false };

  return {
    events,
    closeCallbacks,

    get closed() {
      return state.closed;
    },

    send<T>(event: string, data: T): void {
      if (state.closed) return;
      events.push({ event, data });
    },

    sendError(error: Error): void {
      if (state.closed) return;
      events.push({ event: 'error', data: { message: error.message } });
    },

    close(): void {
      if (state.closed) return;
      state.closed = true;
      // Execute close callbacks
      for (const cb of closeCallbacks) {
        cb();
      }
    },

    onClose(cb: () => void): void {
      closeCallbacks.push(cb);
    },
  } as CacheSSEStream & {
    // ← Cast to the proper type here
    events: Array<{ event: string; data: unknown }>;
    closeCallbacks: Array<() => void>;
    closed: boolean;
  };
}

// ============================================================================
// cacheStatsHandler Tests
// ============================================================================

describe('cacheStatsHandler', () => {
  test('should throw ServiceNotAvailableError when cache service unavailable', async () => {
    const ctx = createMockContext();
    const logger = createMockLogger();

    await expect(cacheStatsHandler({ ctx, logger } as any)).rejects.toThrow(
      ServiceNotAvailableError
    );
  });

  test('should return cache statistics with hit rate', async () => {
    const adapter = new MemoryAdapter({ maxEntries: 100 });
    const cacheService = new CacheService({
      adapter,
      logger: createMockLogger() as any,
    });

    // Generate some stats
    await cacheService.set('key1', 'value1');
    await cacheService.get('key1'); // hit
    await cacheService.get('key2'); // miss

    const ctx = createMockContext({}, cacheService);
    const logger = createMockLogger();

    const result = await cacheStatsHandler({ ctx, logger } as any);

    expect(result).toMatchObject({
      stats: expect.objectContaining({
        hits: expect.any(Number),
        misses: expect.any(Number),
        evictions: expect.any(Number),
        memoryUsage: expect.any(Number),
        entryCount: expect.any(Number),
      }),
      hitRate: expect.any(Number),
      timestamp: expect.any(Number),
    });

    expect(result.hitRate).toBeGreaterThanOrEqual(0);
    expect(result.hitRate).toBeLessThanOrEqual(1);
  });

  test('should calculate hit rate correctly', async () => {
    const adapter = new MemoryAdapter({ maxEntries: 100 });
    const cacheService = new CacheService({
      adapter,
      logger: createMockLogger() as any,
    });

    // 2 hits, 1 miss = 66.7% hit rate
    await cacheService.set('key1', 'value1');
    await cacheService.get('key1'); // hit
    await cacheService.get('key1'); // hit
    await cacheService.get('key2'); // miss

    const ctx = createMockContext({}, cacheService);
    const logger = createMockLogger();

    const result = await cacheStatsHandler({ ctx, logger });

    // Hit rate should be 2/3 ≈ 0.667
    expect(result.hitRate).toBeCloseTo(0.667, 2);
  });

  test('should handle zero requests (no division by zero)', async () => {
    const adapter = new MemoryAdapter({ maxEntries: 100 });
    const cacheService = new CacheService({
      adapter,
      logger: createMockLogger() as any,
    });

    const ctx = createMockContext({}, cacheService);
    const logger = createMockLogger();

    const result = await cacheStatsHandler({ ctx, logger });

    expect(result.hitRate).toBe(0);
  });

  test('should log debug message', async () => {
    const adapter = new MemoryAdapter({ maxEntries: 100 });
    const cacheService = new CacheService({
      adapter,
      logger: createMockLogger() as any,
    });

    const ctx = createMockContext({}, cacheService);
    const logger = createMockLogger();

    await cacheStatsHandler({ ctx, logger } as any);

    expect(logger.debug).toHaveBeenCalledWith('Fetching cache statistics');
  });
});

// ============================================================================
// cachePrometheusHandler Tests
// ============================================================================

describe('cachePrometheusHandler', () => {
  test('should throw ServiceNotAvailableError when cache service unavailable', async () => {
    const ctx = createMockContext();
    const logger = createMockLogger();

    await expect(cachePrometheusHandler({ ctx, logger })).rejects.toThrow(ServiceNotAvailableError);
  });

  test('should return Prometheus format metrics', async () => {
    const adapter = new MemoryAdapter({ maxEntries: 100 });
    const cacheService = new CacheService({
      adapter,
      logger: createMockLogger() as any,
    });

    // Generate some stats
    await cacheService.set('key1', 'value1');
    await cacheService.get('key1'); // hit

    const ctx = createMockContext({}, cacheService);
    const logger = createMockLogger();

    await cachePrometheusHandler({ ctx, logger });

    const response = (ctx as any)._getResponse();
    expect(response.contentType).toBe('text/plain; version=0.0.4; charset=utf-8');
    expect(response.content).toContain('# HELP blaize_cache_hits_total');
    expect(response.content).toContain('# TYPE blaize_cache_hits_total counter');
    expect(response.content).toContain('blaize_cache_hits_total');
    expect(response.content).toContain('blaize_cache_misses_total');
    expect(response.content).toContain('blaize_cache_evictions_total');
    expect(response.content).toContain('blaize_cache_memory_bytes');
    expect(response.content).toContain('blaize_cache_entries');
    expect(response.content).toContain('blaize_cache_hit_rate');
  });

  test('should include uptime metric if available', async () => {
    const adapter = new MemoryAdapter({ maxEntries: 100 });
    const cacheService = new CacheService({
      adapter,
      logger: createMockLogger() as any,
    });

    const ctx = createMockContext({}, cacheService);
    const logger = createMockLogger();

    await cachePrometheusHandler({ ctx, logger });

    const response = (ctx as any)._getResponse();
    expect(response.content).toContain('blaize_cache_uptime_seconds');
  });

  test('should format metrics correctly', async () => {
    const adapter = new MemoryAdapter({ maxEntries: 100 });
    const cacheService = new CacheService({
      adapter,
      logger: createMockLogger() as any,
    });

    await cacheService.set('key1', 'value1');
    await cacheService.get('key1'); // 1 hit
    await cacheService.get('key2'); // 1 miss

    const ctx = createMockContext({}, cacheService);
    const logger = createMockLogger();

    await cachePrometheusHandler({ ctx, logger });

    const response = (ctx as any)._getResponse();
    const content = response.content as string;

    // Should have numeric values
    expect(content).toMatch(/blaize_cache_hits_total \d+/);
    expect(content).toMatch(/blaize_cache_misses_total \d+/);
    expect(content).toMatch(/blaize_cache_hit_rate 0\.\d+/);
  });

  test('should log debug message', async () => {
    const adapter = new MemoryAdapter({ maxEntries: 100 });
    const cacheService = new CacheService({
      adapter,
      logger: createMockLogger() as any,
    });

    const ctx = createMockContext({}, cacheService);
    const logger = createMockLogger();

    await cachePrometheusHandler({ ctx, logger });

    expect(logger.debug).toHaveBeenCalledWith('Generating Prometheus metrics');
  });
});

// ============================================================================
// cacheDashboardHandler Tests
// ============================================================================

describe('cacheDashboardHandler', () => {
  test('should throw ServiceNotAvailableError when cache service unavailable', async () => {
    const ctx = createMockContext();
    const logger = createMockLogger();

    await expect(cacheDashboardHandler({ ctx, logger })).rejects.toThrow(ServiceNotAvailableError);
  });

  test('should return HTML dashboard', async () => {
    const adapter = new MemoryAdapter({ maxEntries: 100 });
    const cacheService = new CacheService({
      adapter,
      logger: createMockLogger() as any,
    });

    const ctx = createMockContext({}, cacheService);
    const logger = createMockLogger();

    await cacheDashboardHandler({ ctx, logger });

    const response = (ctx as any)._getResponse();
    expect(response.contentType).toBe('text/html; charset=utf-8');
    expect(response.content).toContain('<!DOCTYPE html>');
    expect(response.content).toContain('Cache Dashboard');
    expect(response.content).toContain('BlaizeJS');
  });

  test('should include summary cards', async () => {
    const adapter = new MemoryAdapter({ maxEntries: 100 });
    const cacheService = new CacheService({
      adapter,
      logger: createMockLogger() as any,
    });

    await cacheService.set('key1', 'value1');
    await cacheService.get('key1'); // hit

    const ctx = createMockContext({}, cacheService);
    const logger = createMockLogger();

    await cacheDashboardHandler({ ctx, logger });

    const response = (ctx as any)._getResponse();
    expect(response.content).toContain('Cache Hits');
    expect(response.content).toContain('Cache Misses');
    expect(response.content).toContain('Hit Rate');
    expect(response.content).toContain('Memory Usage');
    expect(response.content).toContain('Evictions');
  });

  test('should support auto-refresh', async () => {
    const adapter = new MemoryAdapter({ maxEntries: 100 });
    const cacheService = new CacheService({
      adapter,
      logger: createMockLogger() as any,
    });

    const ctx = createMockContext({ refresh: '30' }, cacheService);
    const logger = createMockLogger();

    await cacheDashboardHandler({ ctx, logger });

    const response = (ctx as any)._getResponse();
    expect(response.content).toContain('http-equiv="refresh"');
    expect(response.content).toContain('content="30"');
    expect(response.content).toContain('Auto-refresh: 30s');
  });

  test('should handle no auto-refresh', async () => {
    const adapter = new MemoryAdapter({ maxEntries: 100 });
    const cacheService = new CacheService({
      adapter,
      logger: createMockLogger() as any,
    });

    const ctx = createMockContext({}, cacheService);
    const logger = createMockLogger();

    await cacheDashboardHandler({ ctx, logger });

    const response = (ctx as any)._getResponse();
    expect(response.content).not.toContain('http-equiv="refresh"');
  });

  test('should log debug message', async () => {
    const adapter = new MemoryAdapter({ maxEntries: 100 });
    const cacheService = new CacheService({
      adapter,
      logger: createMockLogger() as any,
    });

    const ctx = createMockContext({ refresh: '60' }, cacheService);
    const logger = createMockLogger();

    await cacheDashboardHandler({ ctx, logger });

    expect(logger.debug).toHaveBeenCalledWith('Rendering cache dashboard', {
      refreshInterval: 60,
    });
  });
});

// ============================================================================
// cacheEventsHandler Tests (SSE)
// ============================================================================

describe('cacheEventsHandler', () => {
  test('should throw ServiceNotAvailableError when cache service unavailable', async () => {
    const stream = createMockStream();
    const ctx = createMockContext();
    const logger = createMockLogger();

    await expect(cacheEventsHandler({ stream, ctx, logger })).rejects.toThrow(
      ServiceNotAvailableError
    );
  });

  test('should stream cache set events', async () => {
    const adapter = new MemoryAdapter({ maxEntries: 100 });
    const cacheService = new CacheService({
      adapter,
      logger: createMockLogger() as any,
    });

    const stream = createMockStream();
    const ctx = createMockContext({}, cacheService);
    const logger = createMockLogger();

    // Start handler (returns immediately after setup)
    await cacheEventsHandler({ stream, ctx, logger });

    // Trigger cache events
    await cacheService.set('test:key', 'value');

    // Wait a bit for event propagation
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(stream.events.length).toBeGreaterThan(0);

    const setEvent = stream.events.find(e => e.event === 'cache.set');
    expect(setEvent).toBeDefined();
    expect(setEvent!.data).toMatchObject({
      type: 'set',
      key: 'test:key',
    });

    // Cleanup
    stream.close();
  });

  test('should stream cache delete events', async () => {
    const adapter = new MemoryAdapter({ maxEntries: 100 });
    const cacheService = new CacheService({
      adapter,
      logger: createMockLogger() as any,
    });

    await cacheService.set('test:key', 'value');

    const stream = createMockStream();
    const ctx = createMockContext({}, cacheService);
    const logger = createMockLogger();

    // Start handler
    await cacheEventsHandler({ stream, ctx, logger });

    // Trigger delete event
    await cacheService.delete('test:key');

    await new Promise(resolve => setTimeout(resolve, 50));

    const deleteEvent = stream.events.find(e => e.event === 'cache.delete');
    expect(deleteEvent).toBeDefined();
    expect(deleteEvent!.data).toMatchObject({
      type: 'delete',
      key: 'test:key',
    });

    // Cleanup
    stream.close();
  });

  test('should filter events by pattern', async () => {
    const adapter = new MemoryAdapter({ maxEntries: 100 });
    const cacheService = new CacheService({
      adapter,
      logger: createMockLogger() as any,
    });

    const stream = createMockStream();
    const ctx = createMockContext({ pattern: 'user:*' }, cacheService);
    const logger = createMockLogger();

    // Start handler
    await cacheEventsHandler({ stream, ctx, logger });

    // Set keys that match and don't match pattern
    await cacheService.set('user:123', 'data');
    await cacheService.set('session:456', 'data');

    await new Promise(resolve => setTimeout(resolve, 50));

    const setEvents = stream.events.filter(e => e.event === 'cache.set');

    // Should only have user:123, not session:456
    expect(setEvents.some(e => (e.data as any).key === 'user:123')).toBe(true);
    expect(setEvents.some(e => (e.data as any).key === 'session:456')).toBe(false);

    // Cleanup
    stream.close();
  });

  test('should cleanup subscription on close', async () => {
    const adapter = new MemoryAdapter({ maxEntries: 100 });
    const cacheService = new CacheService({
      adapter,
      logger: createMockLogger() as any,
    });

    const stream = createMockStream();
    const ctx = createMockContext({}, cacheService);
    const logger = createMockLogger();

    // Start handler
    await cacheEventsHandler({ stream, ctx, logger });

    // Close immediately
    stream.close();

    // Trigger event after close - should not be sent
    await cacheService.set('test:key', 'value');
    await new Promise(resolve => setTimeout(resolve, 50));

    // Should have no events since we closed before any cache operations
    expect(stream.events).toHaveLength(0);
  });

  test('should log debug messages', async () => {
    const adapter = new MemoryAdapter({ maxEntries: 100 });
    const cacheService = new CacheService({
      adapter,
      logger: createMockLogger() as any,
    });

    const stream = createMockStream();
    const ctx = createMockContext({ pattern: 'test:*' }, cacheService);
    const logger = createMockLogger();

    const handlerPromise = cacheEventsHandler({ stream, ctx, logger });
    stream.close();
    await handlerPromise;

    expect(logger.debug).toHaveBeenCalledWith(
      'Starting cache events stream',
      expect.objectContaining({
        pattern: 'test:*',
      })
    );

    expect(logger.debug).toHaveBeenCalledWith(
      'Cache events stream closed',
      expect.objectContaining({
        pattern: 'test:*',
      })
    );
  });
});
