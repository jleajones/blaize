/**
 * Tests for metrics plugin factory
 */

import { createMockEventBus, createMockLogger } from '@blaizejs/testing-utils';

import { createMetricsPlugin, getMetricsCollector } from './plugin';

import type { MetricsPluginConfig, MetricsPluginState, MetricsPluginServices } from './types';
import type { Context, Plugin } from 'blaizejs';

// Mock the collector
vi.mock('./collector', () => ({
  MetricsCollectorImpl: vi.fn().mockImplementation(() => ({
    startCollection: vi.fn(),
    stopCollection: vi.fn(),
    startHttpRequest: vi.fn(),
    recordHttpRequest: vi.fn(),
    increment: vi.fn(),
    gauge: vi.fn(),
    histogram: vi.fn(),
    startTimer: vi.fn(() => vi.fn()),
    getSnapshot: vi.fn().mockReturnValue({
      timestamp: Date.now(),
      http: {
        totalRequests: 100,
        activeRequests: 5,
        requestsPerSecond: 10.5,
        statusCodes: { '200': 95, '404': 5 },
        latency: {
          count: 100,
          sum: 5000,
          min: 10,
          max: 200,
          mean: 50,
          p50: 45,
          p95: 120,
          p99: 180,
        },
        byMethod: { GET: { count: 80, avgLatency: 45 } },
        byRoute: { '/api/test': { count: 100, avgLatency: 50 } },
      },
      process: {
        memoryUsage: {
          heapUsed: 50000000,
          heapTotal: 100000000,
          external: 1000000,
          rss: 120000000,
        },
        cpuUsage: { user: 1000000, system: 500000 },
        uptime: 3600,
        eventLoopLag: 5,
      },
      custom: {
        counters: {},
        gauges: {},
        histograms: {},
        timers: {},
      },
    }),
    reset: vi.fn(),
    isCollecting: vi.fn().mockReturnValue(true),
  })),
}));

describe('createMetricsPlugin', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.clearAllMocks();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('plugin creation', () => {
    test('creates plugin with correct name and version', () => {
      const plugin = createMetricsPlugin();

      expect(plugin.name).toBe('@blaizejs/plugin-metrics');
      expect(plugin.register).toBeInstanceOf(Function);
    });

    test('returns properly typed plugin', () => {
      const plugin = createMetricsPlugin();

      // Type test - would fail compilation if types aren't correct
      const _typeTest: Plugin<MetricsPluginState, MetricsPluginServices> = plugin;
      expect(_typeTest).toBe(plugin);
    });

    test('accepts custom config', () => {
      const config: MetricsPluginConfig = {
        enabled: true,
        excludePaths: ['/health'],
        histogramLimit: 2000,
      };

      const plugin = createMetricsPlugin(config);
      expect(plugin).toBeDefined();
      expect(plugin.name).toBe('@blaizejs/plugin-metrics');
    });

    test('accepts partial config with defaults', () => {
      const plugin = createMetricsPlugin({ excludePaths: ['/custom'] });
      expect(plugin).toBeDefined();
    });
  });

  describe('plugin lifecycle', () => {
    test('executes all lifecycle hooks in correct order', async () => {
      const mockServer = createMockServer();
      const plugin = createMetricsPlugin({ enabled: true });

      const executionOrder: string[] = [];

      await plugin.register(mockServer as any);
      executionOrder.push('register');

      if (plugin.initialize) {
        await plugin.initialize(mockServer as any);
        executionOrder.push('initialize');
      }

      if (plugin.onServerStart) {
        await plugin.onServerStart({} as any);
        executionOrder.push('onServerStart');
      }

      if (plugin.onServerStop) {
        await plugin.onServerStop({} as any);
        executionOrder.push('onServerStop');
      }

      if (plugin.terminate) {
        await plugin.terminate(mockServer as any);
        executionOrder.push('terminate');
      }

      expect(executionOrder).toEqual([
        'register',
        'initialize',
        'onServerStart',
        'onServerStop',
        'terminate',
      ]);
    });

    test('registers middleware on register', async () => {
      const mockServer = createMockServer();
      const plugin = createMetricsPlugin({ enabled: true });

      await plugin.register(mockServer as any);

      expect(mockServer.use).toHaveBeenCalledTimes(1);
      expect(mockServer.use).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'metrics',
          execute: expect.any(Function),
        })
      );
    });

    test('creates collector in initialize', async () => {
      const mockServer = createMockServer();
      const plugin = createMetricsPlugin({ enabled: true });

      await plugin.register(mockServer as any);

      if (plugin.initialize) {
        await plugin.initialize(mockServer as any);
      }

      const { MetricsCollectorImpl } = await import('./collector');
      expect(MetricsCollectorImpl).toHaveBeenCalledWith({
        histogramLimit: 1000,
        collectionInterval: 60000,
        maxCardinality: 10000,
        onCardinalityLimit: 'drop',
        logger: expect.objectContaining({
          debug: expect.any(Function),
          info: expect.any(Function),
          warn: expect.any(Function),
          error: expect.any(Function),
          child: expect.any(Function),
          flush: expect.any(Function),
        }),
      });
    });

    test('starts collection in initialize', async () => {
      const mockServer = createMockServer();
      const plugin = createMetricsPlugin({ enabled: true });

      await plugin.register(mockServer as any);

      if (plugin.initialize) {
        await plugin.initialize(mockServer as any);
      }

      const { MetricsCollectorImpl } = await import('./collector');
      const collectorInstance = (MetricsCollectorImpl as any).mock.results[0]?.value;
      expect(collectorInstance.startCollection).toHaveBeenCalled();
    });

    test('stops collection in terminate', async () => {
      const mockServer = createMockServer();
      const plugin = createMetricsPlugin({ enabled: true });

      await plugin.register(mockServer as any);

      if (plugin.initialize) {
        await plugin.initialize(mockServer as any);
      }

      if (plugin.terminate) {
        await plugin.terminate(mockServer as any);
      }

      const { MetricsCollectorImpl } = await import('./collector');
      const collectorInstance = (MetricsCollectorImpl as any).mock.results[0]?.value;
      expect(collectorInstance.stopCollection).toHaveBeenCalled();
    });
  });

  describe('middleware behavior', () => {
    test('injects collector into context', async () => {
      const mockServer = createMockServer();
      const plugin = createMetricsPlugin({ enabled: true });

      await plugin.register(mockServer as any);
      if (plugin.initialize) await plugin.initialize(mockServer as any);

      const middleware = mockServer.use.mock.calls[0]![0];
      const mockContext = createMockContext('/api/test', 'GET');

      await middleware.execute({
        ctx: mockContext,
        next: async () => {},
        logger: createMockLogger(),
        eventBus: createMockEventBus(),
      });

      expect(mockContext.services.metrics).toBeDefined();
    });

    test('tracks HTTP requests', async () => {
      const mockServer = createMockServer();
      const plugin = createMetricsPlugin({ enabled: true });

      await plugin.register(mockServer as any);
      if (plugin.initialize) await plugin.initialize(mockServer as any);

      const middleware = mockServer.use.mock.calls[0]![0];
      const mockContext = createMockContext('/api/test', 'GET');

      await middleware.execute({
        ctx: mockContext,
        next: async () => {},
        logger: createMockLogger(),
        eventBus: createMockEventBus(),
      });

      const { MetricsCollectorImpl } = await import('./collector');
      const collector = (MetricsCollectorImpl as any).mock.results[0]?.value;

      expect(collector.startHttpRequest).toHaveBeenCalled();
      expect(collector.recordHttpRequest).toHaveBeenCalledWith(
        'GET',
        '/api/test',
        200,
        expect.any(Number)
      );
    });

    test('excludes paths from tracking', async () => {
      const mockServer = createMockServer();
      const plugin = createMetricsPlugin({
        enabled: true,
        excludePaths: ['/health', '/metrics'],
      });

      await plugin.register(mockServer as any);
      if (plugin.initialize) await plugin.initialize(mockServer as any);

      const middleware = mockServer.use.mock.calls[0]![0];
      const mockContext = createMockContext('/health', 'GET');

      await middleware.execute({
        ctx: mockContext,
        next: async () => {},
        logger: createMockLogger(),
        eventBus: createMockEventBus(),
      });

      const { MetricsCollectorImpl } = await import('./collector');
      const collector = (MetricsCollectorImpl as any).mock.results[0]?.value;

      expect(collector.startHttpRequest).not.toHaveBeenCalled();
    });

    test('tracks errors with correct status code', async () => {
      const mockServer = createMockServer();
      const plugin = createMetricsPlugin({ enabled: true });

      await plugin.register(mockServer as any);
      if (plugin.initialize) await plugin.initialize(mockServer as any);

      const middleware = mockServer.use.mock.calls[0]![0];
      const mockContext = createMockContext('/api/error', 'GET');

      const error = new Error('Test error');
      (error as any).status = 500;

      await expect(
        middleware.execute({
          ctx: mockContext,
          next: async () => {
            throw error;
          },
          logger: createMockLogger(),
          eventBus: createMockEventBus(),
        })
      ).rejects.toThrow('Test error');

      const { MetricsCollectorImpl } = await import('./collector');
      const collector = (MetricsCollectorImpl as any).mock.results[0]?.value;

      expect(collector.recordHttpRequest).toHaveBeenCalledWith(
        'GET',
        '/api/error',
        500,
        expect.any(Number)
      );
    });
  });

  describe('configuration', () => {
    test('skips tracking when disabled', async () => {
      const mockServer = createMockServer();
      const plugin = createMetricsPlugin({ enabled: false });

      await plugin.register(mockServer as any);
      if (plugin.initialize) await plugin.initialize(mockServer as any);

      const { MetricsCollectorImpl } = await import('./collector');
      expect(MetricsCollectorImpl).not.toHaveBeenCalled();
    });

    test('calls reporter periodically', async () => {
      vi.useFakeTimers();

      const reporter = vi.fn();
      const mockServer = createMockServer();
      const plugin = createMetricsPlugin({
        enabled: true,
        reporter,
        collectionInterval: 1000,
      });

      await plugin.register(mockServer as any);
      if (plugin.initialize) await plugin.initialize(mockServer as any);
      if (plugin.onServerStart) await plugin.onServerStart({} as any);

      vi.advanceTimersByTime(1000);

      expect(reporter).toHaveBeenCalledWith(expect.any(Object));

      vi.useRealTimers();
    });

    test('calls reporter on server stop', async () => {
      const reporter = vi.fn();
      const mockServer = createMockServer();
      const plugin = createMetricsPlugin({ enabled: true, reporter });

      await plugin.register(mockServer as any);
      if (plugin.initialize) await plugin.initialize(mockServer as any);
      if (plugin.onServerStart) await plugin.onServerStart({} as any);
      if (plugin.onServerStop) await plugin.onServerStop({} as any);

      expect(reporter).toHaveBeenCalled();
    });

    test('logs to console when enabled', async () => {
      const mockServer = createMockServer();
      const plugin = createMetricsPlugin({ enabled: true });

      await plugin.register(mockServer as any);
      if (plugin.initialize) await plugin.initialize(mockServer as any);

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Initialized'));
    });
  });

  describe('custom metrics', () => {
    test('exposes custom metrics methods', async () => {
      const mockServer = createMockServer();
      const plugin = createMetricsPlugin({ enabled: true });

      await plugin.register(mockServer as any);
      if (plugin.initialize) await plugin.initialize(mockServer as any);

      const middleware = mockServer.use.mock.calls[0]![0];
      const mockContext = createMockContext('/api/test', 'POST');

      await middleware.execute({
        ctx: mockContext,
        next: async () => {
          const { metrics } = mockContext.services!;
          metrics.increment('orders.created');
          metrics.gauge('queue.size', 42);
          metrics.histogram('order.value', 99.99);
          const stopTimer = metrics.startTimer('processing');
          stopTimer();
        },
        logger: createMockLogger(),
        eventBus: createMockEventBus(),
      });

      const { MetricsCollectorImpl } = await import('./collector');
      const collector = (MetricsCollectorImpl as any).mock.results[0]?.value;

      expect(collector.increment).toHaveBeenCalledWith('orders.created');
      expect(collector.gauge).toHaveBeenCalledWith('queue.size', 42);
      expect(collector.histogram).toHaveBeenCalledWith('order.value', 99.99);
      expect(collector.startTimer).toHaveBeenCalledWith('processing');
    });
  });

  describe('type preservation', () => {
    test('plugin has correct generic types', () => {
      const plugin = createMetricsPlugin({ enabled: true });

      // Type test - ensures Plugin<TState, TServices> is preserved
      const _typeTest: Plugin<MetricsPluginState, MetricsPluginServices> = plugin;
      expect(plugin.name).toBe('@blaizejs/plugin-metrics');
    });

    test('can be used in plugin array', () => {
      const plugin = createMetricsPlugin();

      // Should work in both typed and untyped arrays
      const typedArray: Plugin<MetricsPluginState, MetricsPluginServices>[] = [plugin];
      const untypedArray: Plugin[] = [plugin];

      expect(typedArray[0]).toBe(plugin);
      expect(untypedArray[0]).toBe(plugin);
    });
  });

  describe('Factory Functions', () => {
    // Import what we need
    afterEach(async () => {
      const plugin = createMetricsPlugin({ enabled: true });
      const mockServer = createMockServer();

      await plugin.register(mockServer as any);
      if (plugin.initialize) await plugin.initialize(mockServer as any);
      if (plugin.terminate) await plugin.terminate(mockServer as any);
    });

    describe('getMetricsCollector()', () => {
      it('throws error when called before initialization', async () => {
        const cleanupPlugin = createMetricsPlugin({ enabled: true });
        const cleanupServer = createMockServer();

        await cleanupPlugin.register(cleanupServer as any);
        if (cleanupPlugin.initialize) await cleanupPlugin.initialize(cleanupServer as any);
        if (cleanupPlugin.terminate) await cleanupPlugin.terminate(cleanupServer as any);

        expect(() => getMetricsCollector()).toThrow(
          'Metrics collector not initialized. ' +
            'Make sure you have registered the metrics plugin with createMetricsPlugin().'
        );
      });

      it('returns collector instance after initialization', async () => {
        const plugin = createMetricsPlugin({ enabled: true });
        const mockServer = createMockServer();

        await plugin.register(mockServer as any);
        if (plugin.initialize) await plugin.initialize(mockServer as any);

        expect(() => getMetricsCollector()).not.toThrow();

        const collector = getMetricsCollector();
        expect(collector).toBeDefined();
        expect(typeof collector.increment).toBe('function');
        expect(typeof collector.gauge).toBe('function');
        expect(typeof collector.histogram).toBe('function');
        expect(typeof collector.startTimer).toBe('function');
        expect(typeof collector.getSnapshot).toBe('function');

        if (plugin.terminate) await plugin.terminate(mockServer as any);
      });

      it('throws error after termination', async () => {
        const plugin = createMetricsPlugin({ enabled: true });
        const mockServer = createMockServer();

        await plugin.register(mockServer as any);
        if (plugin.initialize) await plugin.initialize(mockServer as any);

        expect(() => getMetricsCollector()).not.toThrow();

        if (plugin.terminate) await plugin.terminate(mockServer as any);

        expect(() => getMetricsCollector()).toThrow('not initialized');
      });

      it('returns same instance on multiple calls', async () => {
        const plugin = createMetricsPlugin({ enabled: true });
        const mockServer = createMockServer();

        await plugin.register(mockServer as any);
        if (plugin.initialize) await plugin.initialize(mockServer as any);

        const collector1 = getMetricsCollector();
        const collector2 = getMetricsCollector();
        const collector3 = getMetricsCollector();

        expect(collector1).toBe(collector2);
        expect(collector2).toBe(collector3);

        if (plugin.terminate) await plugin.terminate(mockServer as any);
      });

      it('returns same instance used by middleware', async () => {
        const plugin = createMetricsPlugin({ enabled: true });
        const mockServer = createMockServer();

        await plugin.register(mockServer as any);
        if (plugin.initialize) await plugin.initialize(mockServer as any);

        const collectorFromFactory = getMetricsCollector();

        const middleware = mockServer.use.mock.calls[0]![0];
        const mockContext = createMockContext('/api/test', 'GET');

        await middleware.execute({
          ctx: mockContext,
          next: vi.fn(),
          logger: createMockLogger(),
          eventBus: createMockEventBus(),
        });

        const collectorFromMiddleware = mockContext.services.metrics;

        expect(collectorFromFactory).toBe(collectorFromMiddleware);

        if (plugin.terminate) await plugin.terminate(mockServer as any);
      });
    });

    describe('Lifecycle integration', () => {
      it('factory works after full server lifecycle', async () => {
        const plugin = createMetricsPlugin({ enabled: true });
        const mockServer = createMockServer();

        await plugin.register(mockServer as any);
        if (plugin.initialize) await plugin.initialize(mockServer as any);
        if (plugin.onServerStart) await plugin.onServerStart({} as any);

        const collector = getMetricsCollector();
        expect(collector).toBeDefined();

        if (plugin.onServerStop) await plugin.onServerStop({} as any);

        expect(() => getMetricsCollector()).not.toThrow();

        if (plugin.terminate) await plugin.terminate(mockServer as any);

        expect(() => getMetricsCollector()).toThrow('not initialized');
      });

      it('can be used in onServerStart hook', async () => {
        const plugin = createMetricsPlugin({ enabled: true });
        const mockServer = createMockServer();

        await plugin.register(mockServer as any);
        if (plugin.initialize) await plugin.initialize(mockServer as any);

        await expect(plugin.onServerStart?.({} as any)).resolves.toBeUndefined();

        if (plugin.terminate) await plugin.terminate(mockServer as any);
      });

      it('can be used in onServerStop hook', async () => {
        const plugin = createMetricsPlugin({ enabled: true });
        const mockServer = createMockServer();

        await plugin.register(mockServer as any);
        if (plugin.initialize) await plugin.initialize(mockServer as any);
        if (plugin.onServerStart) await plugin.onServerStart({} as any);

        await expect(plugin.onServerStop?.({} as any)).resolves.toBeUndefined();

        if (plugin.terminate) await plugin.terminate(mockServer as any);
      });
    });

    describe('Error scenarios', () => {
      it('provides helpful error message when not initialized', async () => {
        const cleanupPlugin = createMetricsPlugin({ enabled: true });
        const cleanupServer = createMockServer();

        await cleanupPlugin.register(cleanupServer as any);
        if (cleanupPlugin.initialize) await cleanupPlugin.initialize(cleanupServer as any);
        if (cleanupPlugin.terminate) await cleanupPlugin.terminate(cleanupServer as any);

        try {
          getMetricsCollector();
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toContain('Metrics collector not initialized');
          expect((error as Error).message).toContain('createMetricsPlugin()');
        }
      });

      it('handles rapid initialize/terminate cycles', async () => {
        for (let i = 0; i < 3; i++) {
          const plugin = createMetricsPlugin({ enabled: true });
          const mockServer = createMockServer();

          await plugin.register(mockServer as any);
          if (plugin.initialize) await plugin.initialize(mockServer as any);

          expect(() => getMetricsCollector()).not.toThrow();

          if (plugin.terminate) await plugin.terminate(mockServer as any);

          expect(() => getMetricsCollector()).toThrow();
        }
      });

      it('does not throw when disabled', async () => {
        const plugin = createMetricsPlugin({ enabled: false });
        const mockServer = createMockServer();

        await plugin.register(mockServer as any);
        if (plugin.initialize) await plugin.initialize(mockServer as any);

        // When disabled, factory is never initialized, so it should throw
        expect(() => getMetricsCollector()).toThrow('not initialized');
      });
    });
  });
});
// Test helpers

// Test helpers

function createMockServer() {
  return {
    use: vi.fn(),
    router: {
      addRoute: vi.fn(),
    },
    plugins: [],
  };
}

// Create a context type that includes our plugin's types
type TestContext = Context<MetricsPluginState, MetricsPluginServices>;

function createMockContext(path: string, method: string): TestContext {
  return {
    request: {
      path,
      method,
    } as any,
    response: {
      raw: { statusCode: 200 },
    } as any,
    services: {} as MetricsPluginServices, // Will be populated by middleware
    state: {} as MetricsPluginState, // Will be populated by middleware
  };
}
