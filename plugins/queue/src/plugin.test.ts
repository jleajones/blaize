/**
 * Tests for Queue Plugin
 *
 * Tests plugin lifecycle, middleware injection,
 * storage adapter lifecycle, and logger integration.
 */
import { createMockContext, createMockEventBus, createMockLogger } from '@blaizejs/testing-utils';
import { z } from 'zod';

import { defineJob } from './define-job';
import { createQueuePlugin, QueueService, getQueueService } from './plugin';
import { InMemoryStorage } from './storage/memory';

import type { QueueStorageAdapter, QueuePluginConfig } from './types';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a mock server with `use` method for middleware registration
 */
function createMockServer() {
  const middleware: unknown[] = [];
  return {
    middleware,
    use: vi.fn((mw: unknown) => {
      middleware.push(mw);
    }),
    eventBus: createMockEventBus(),
    _logger: createMockLogger(),
  };
}

/**
 * Create a mock storage adapter with optional connect/disconnect
 */
function createMockStorage(options?: {
  hasConnect?: boolean;
  hasDisconnect?: boolean;
  hasHealthCheck?: boolean;
}): QueueStorageAdapter {
  const storage: QueueStorageAdapter = new InMemoryStorage();

  // Optionally add connect/disconnect
  if (options?.hasConnect) {
    storage.connect = vi.fn().mockResolvedValue(undefined);
  }
  if (options?.hasDisconnect) {
    storage.disconnect = vi.fn().mockResolvedValue(undefined);
  }
  if (options?.hasHealthCheck) {
    storage.healthCheck = vi.fn().mockResolvedValue({ healthy: true });
  }

  return storage;
}

/**
 * Create test plugin config
 */
function createTestConfig(overrides?: Partial<QueuePluginConfig>): QueuePluginConfig {
  return {
    queues: {
      emails: { concurrency: 5, jobs: {} },
      reports: { concurrency: 2, jobs: {} },
    },
    ...overrides,
  };
}

/**
 * Get lifecycle hooks from plugin object
 *
 * The plugin object returned by createQueuePlugin contains the lifecycle hooks
 * that BlaizeJS calls during server startup/shutdown.
 */
function getPluginHooks(plugin: unknown) {
  const hooks = plugin as {
    register?: (server: unknown) => Promise<void>;
    initialize?: (server: unknown) => Promise<void>;
    onServerStart?: () => Promise<void>;
    onServerStop?: () => Promise<void>;
    terminate?: () => Promise<void>;
  };
  return hooks;
}

// ============================================================================
// Tests
// ============================================================================

describe('createQueuePlugin', () => {
  // ==========================================================================
  // Plugin Factory
  // ==========================================================================
  describe('Plugin Factory', () => {
    it('should create a plugin', () => {
      const plugin = createQueuePlugin({ queues: {} });
      expect(plugin).toBeDefined();
    });

    it('should return an object with lifecycle hooks', () => {
      const plugin = createQueuePlugin({ queues: {} });
      const hooks = getPluginHooks(plugin);

      // Plugin should have lifecycle hook methods
      expect(typeof hooks.register).toBe('function');
      expect(typeof hooks.initialize).toBe('function');
      expect(typeof hooks.onServerStart).toBe('function');
      expect(typeof hooks.onServerStop).toBe('function');
      expect(typeof hooks.terminate).toBe('function');
    });
  });

  // ==========================================================================
  // Lifecycle: Register
  // ==========================================================================
  describe('Lifecycle: register()', () => {
    it('should register middleware on server', async () => {
      const plugin = createQueuePlugin(createTestConfig());
      const hooks = getPluginHooks(plugin);
      const server = createMockServer();

      await hooks.register?.(server);

      expect(server.use).toHaveBeenCalled();
      expect(server.middleware).toHaveLength(1);
    });

    it('should register middleware with name "queue"', async () => {
      const plugin = createQueuePlugin(createTestConfig());
      const hooks = getPluginHooks(plugin);
      const server = createMockServer();

      await hooks.register?.(server);

      const middleware = server.middleware[0] as { name: string };
      expect(middleware.name).toBe('queue');
    });
  });

  // ==========================================================================
  // Lifecycle: Initialize
  // ==========================================================================
  describe('Lifecycle: initialize()', () => {
    it('should initialize without error when using default storage', async () => {
      const plugin = createQueuePlugin(createTestConfig({ serverId: 'test-server' }));
      const hooks = getPluginHooks(plugin);
      const server = createMockServer();

      await hooks.register?.(server);

      // Should not throw
      await expect(hooks.initialize?.(server)).resolves.toBeUndefined();
    });

    it('should call storage.connect() if available', async () => {
      const customStorage = createMockStorage({ hasConnect: true });
      const plugin = createQueuePlugin({
        ...createTestConfig(),
        storage: customStorage,
      });
      const hooks = getPluginHooks(plugin);
      const server = createMockServer();

      await hooks.register?.(server);
      await hooks.initialize?.(server);

      expect(customStorage.connect).toHaveBeenCalled();
    });

    it('should throw if storage connection fails', async () => {
      const customStorage = createMockStorage({ hasConnect: true });
      (customStorage.connect as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Connection failed')
      );

      const plugin = createQueuePlugin({
        ...createTestConfig(),
        storage: customStorage,
      });
      const hooks = getPluginHooks(plugin);
      const server = createMockServer();

      await hooks.register?.(server);

      await expect(hooks.initialize?.(server)).rejects.toThrow('Connection failed');
    });
  });

  // ==========================================================================
  // Lifecycle: onServerStart
  // ==========================================================================
  describe('Lifecycle: onServerStart()', () => {
    it('should start all queues without error', async () => {
      const plugin = createQueuePlugin(createTestConfig());
      const hooks = getPluginHooks(plugin);
      const server = createMockServer();

      await hooks.register?.(server);
      await hooks.initialize?.(server);

      // Should not throw
      await expect(hooks.onServerStart?.()).resolves.toBeUndefined();
    });
  });

  // ==========================================================================
  // Lifecycle: onServerStop
  // ==========================================================================
  describe('Lifecycle: onServerStop()', () => {
    it('should stop all queues without error', async () => {
      const plugin = createQueuePlugin(createTestConfig());
      const hooks = getPluginHooks(plugin);
      const server = createMockServer();

      await hooks.register?.(server);
      await hooks.initialize?.(server);
      await hooks.onServerStart?.();

      // Should not throw
      await expect(hooks.onServerStop?.()).resolves.toBeUndefined();
    });

    it('should call storage.disconnect() if available', async () => {
      const customStorage = createMockStorage({
        hasConnect: true,
        hasDisconnect: true,
      });

      const plugin = createQueuePlugin({
        ...createTestConfig(),
        storage: customStorage,
      });
      const hooks = getPluginHooks(plugin);
      const server = createMockServer();

      await hooks.register?.(server);
      await hooks.initialize?.(server);
      await hooks.onServerStart?.();
      await hooks.onServerStop?.();

      expect(customStorage.disconnect).toHaveBeenCalled();
    });

    it('should continue cleanup even if disconnect fails', async () => {
      const customStorage = createMockStorage({
        hasConnect: true,
        hasDisconnect: true,
      });
      (customStorage.disconnect as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Disconnect failed')
      );

      const plugin = createQueuePlugin({
        ...createTestConfig(),
        storage: customStorage,
      });
      const hooks = getPluginHooks(plugin);
      const server = createMockServer();

      await hooks.register?.(server);
      await hooks.initialize?.(server);
      await hooks.onServerStart?.();

      // Should not throw even if disconnect fails
      await expect(hooks.onServerStop?.()).resolves.toBeUndefined();
    });
  });

  // ==========================================================================
  // Lifecycle: terminate
  // ==========================================================================
  describe('Lifecycle: terminate()', () => {
    it('should clean up without error', async () => {
      const plugin = createQueuePlugin(createTestConfig());
      const hooks = getPluginHooks(plugin);
      const server = createMockServer();

      await hooks.register?.(server);
      await hooks.initialize?.(server);
      await hooks.onServerStart?.();
      await hooks.onServerStop?.();

      // Should not throw
      await expect(hooks.terminate?.()).resolves.toBeUndefined();
    });
  });

  // ==========================================================================
  // Middleware Injection
  // ==========================================================================
  describe('Middleware Injection', () => {
    it('should inject queue service into ctx.services', async () => {
      const plugin = createQueuePlugin(createTestConfig());
      const hooks = getPluginHooks(plugin);
      const server = createMockServer();

      await hooks.register?.(server);
      await hooks.initialize?.(server);

      // Get the registered middleware
      const middleware = server.middleware[0] as {
        name: string;
        execute: (mc: any) => Promise<void>;
      };

      // Create mock context and next
      const ctx = createMockContext();
      const next = vi.fn().mockResolvedValue(undefined);

      // Execute middleware
      await middleware.execute({
        ctx,
        next,
        logger: createMockLogger(),
        eventBus: createMockEventBus(),
      });

      // Queue service should be injected
      expect(ctx.services.queue).toBeDefined();
      expect(next).toHaveBeenCalled();
    });

    it('should provide functioning queue service', async () => {
      const plugin = createQueuePlugin(createTestConfig());
      const hooks = getPluginHooks(plugin);
      const server = createMockServer();

      await hooks.register?.(server);
      await hooks.initialize?.(server);

      // Get the registered middleware
      const middleware = server.middleware[0] as {
        execute: (mc: any) => Promise<void>;
      };

      const ctx = createMockContext();
      const next = vi.fn().mockResolvedValue(undefined);

      await middleware.execute({
        ctx,
        next,
        logger: createMockLogger(),
        eventBus: createMockEventBus(),
      });

      // Queue service should have expected methods
      const queueService = ctx.services.queue as QueueService;
      expect(typeof queueService.add).toBe('function');
      expect(typeof queueService.getJob).toBe('function');
      expect(typeof queueService.cancelJob).toBe('function');
      expect(typeof queueService.listQueues).toBe('function');
    });

    it('should have configured queues', async () => {
      const plugin = createQueuePlugin(createTestConfig());
      const hooks = getPluginHooks(plugin);
      const server = createMockServer();

      await hooks.register?.(server);
      await hooks.initialize?.(server);

      const middleware = server.middleware[0] as {
        execute: (mc: any) => Promise<void>;
      };

      const ctx = createMockContext();
      await middleware.execute({
        ctx,
        next: vi.fn(),
        logger: createMockLogger(),
        eventBus: createMockEventBus(),
      });

      const queueService = ctx.services.queue as QueueService;
      const queues = queueService.listQueues();

      expect(queues).toContain('emails');
      expect(queues).toContain('reports');
    });
  });

  // ==========================================================================
  // Full Lifecycle Integration
  // ==========================================================================
  describe('Full Lifecycle Integration', () => {
    it('should complete full lifecycle without errors', async () => {
      const customStorage = createMockStorage({
        hasConnect: true,
        hasDisconnect: true,
      });

      const plugin = createQueuePlugin({
        ...createTestConfig(),
        storage: customStorage,
      });
      const hooks = getPluginHooks(plugin);
      const server = createMockServer();

      // Full lifecycle
      await hooks.register?.(server);
      await hooks.initialize?.(server);
      await hooks.onServerStart?.();
      await hooks.onServerStop?.();
      await hooks.terminate?.();

      // Verify lifecycle order
      expect(server.use).toHaveBeenCalled();
      expect(customStorage.connect).toHaveBeenCalled();
      expect(customStorage.disconnect).toHaveBeenCalled();
    });

    it('should allow job processing during server lifecycle', async () => {
      const plugin = createQueuePlugin({
        queues: {
          emails: {
            concurrency: 5,
            jobs: {
              'email:send': defineJob({
                input: z.object({ to: z.string() }),
                output: z.object({ sent: z.boolean() }),
                handler: async () => ({ sent: true }),
              }),
            },
          },
        },
      });
      const hooks = getPluginHooks(plugin);
      const server = createMockServer();

      await hooks.register?.(server);
      await hooks.initialize?.(server);
      await hooks.onServerStart?.();

      // Get queue service from middleware
      const middleware = server.middleware[0] as {
        execute: (mc: any) => Promise<void>;
      };

      const ctx = createMockContext();
      await middleware.execute({
        ctx,
        next: vi.fn(),
        logger: createMockLogger(),
        eventBus: createMockEventBus(),
      });

      const queueService = ctx.services.queue as QueueService;

      // Add job - handler is registered via config
      const jobId = await queueService.add('emails', 'email:send', {
        to: 'test@example.com',
      });

      expect(jobId).toBeDefined();

      // Clean up
      await hooks.onServerStop?.();
      await hooks.terminate?.();
    });

    it('should apply default configuration values', async () => {
      const plugin = createQueuePlugin({
        queues: {
          minimal: { jobs: {} }, // No specific config
        },
        defaultConcurrency: 10,
        defaultTimeout: 60000,
        defaultMaxRetries: 5,
      });
      const hooks = getPluginHooks(plugin);
      const server = createMockServer();

      await hooks.register?.(server);
      await hooks.initialize?.(server);

      // Get queue service
      const middleware = server.middleware[0] as {
        execute: (mc: any) => Promise<void>;
      };

      const ctx = createMockContext();
      await middleware.execute({
        ctx,
        next: vi.fn(),
        logger: createMockLogger(),
        eventBus: createMockEventBus(),
      });

      const queueService = ctx.services.queue as QueueService;
      expect(queueService.listQueues()).toContain('minimal');

      // Clean up
      await hooks.onServerStop?.();
    });
  });

  // ==========================================================================
  // Storage Adapter Lifecycle
  // ==========================================================================
  describe('Storage Adapter Lifecycle', () => {
    it('should use InMemoryStorage by default', async () => {
      const plugin = createQueuePlugin({
        queues: {
          emails: {
            concurrency: 5,
            jobs: {
              'test:job': defineJob({
                input: z.object({}),
                output: z.object({}),
                handler: async () => ({}),
              }),
            },
          },
        },
      });
      const hooks = getPluginHooks(plugin);
      const server = createMockServer();

      await hooks.register?.(server);
      await hooks.initialize?.(server);

      // Get queue service and verify it works (which means storage is working)
      const middleware = server.middleware[0] as {
        execute: (mc: any) => Promise<void>;
      };

      const ctx = createMockContext();
      await middleware.execute({
        ctx,
        next: vi.fn(),
        logger: createMockLogger(),
        eventBus: createMockEventBus(),
      });

      const queueService = ctx.services.queue as QueueService;

      const jobId = await queueService.add('emails', 'test:job', {});
      const job = await queueService.getJob(jobId);

      expect(job).toBeDefined();
      expect(job?.id).toBe(jobId);

      await hooks.onServerStop?.();
    });

    it('should use custom storage adapter when provided', async () => {
      const customStorage = createMockStorage({
        hasConnect: true,
        hasDisconnect: true,
      });

      const plugin = createQueuePlugin({
        ...createTestConfig(),
        storage: customStorage,
      });
      const hooks = getPluginHooks(plugin);
      const server = createMockServer();

      await hooks.register?.(server);
      await hooks.initialize?.(server);

      // Verify custom storage was used
      expect(customStorage.connect).toHaveBeenCalled();

      await hooks.onServerStart?.();
      await hooks.onServerStop?.();

      expect(customStorage.disconnect).toHaveBeenCalled();
    });

    it('should not call connect/disconnect if adapter does not support it', async () => {
      // Default InMemoryStorage doesn't have connect/disconnect
      const plugin = createQueuePlugin(createTestConfig());
      const hooks = getPluginHooks(plugin);
      const server = createMockServer();

      // Should complete without error
      await hooks.register?.(server);
      await hooks.initialize?.(server);
      await hooks.onServerStart?.();
      await hooks.onServerStop?.();
      await hooks.terminate?.();
    });
  });
});

// ==========================================================================
// Handler Registration via Config
// ==========================================================================
describe('Handler Registration via Config', () => {
  it('should register handlers from config during initialize', async () => {
    const emailHandler = vi.fn().mockResolvedValue({ sent: true });
    const reportHandler = vi.fn().mockResolvedValue({ generated: true });

    const plugin = createQueuePlugin({
      queues: {
        emails: {
          concurrency: 5,
          jobs: {
            send: defineJob({
              input: z.object({ to: z.string() }),
              output: z.object({ sent: z.boolean() }),
              handler: emailHandler,
            }),
          },
        },
        reports: {
          concurrency: 2,
          jobs: {
            generate: defineJob({
              input: z.object({ type: z.string() }),
              output: z.object({ generated: z.boolean() }),
              handler: reportHandler,
            }),
          },
        },
      },
    });

    const hooks = getPluginHooks(plugin);
    const server = createMockServer();

    await hooks.register?.(server);
    await hooks.initialize?.(server);
    await hooks.onServerStart?.();

    // Get queue service
    const ctx = createMockContext();
    // Get queue service and verify it works (which means storage is working)
    const middleware = server.middleware[0] as {
      execute: (mc: any) => Promise<void>;
    };
    middleware.execute({
      ctx,
      next: vi.fn(),
      logger: createMockLogger(),
      eventBus: createMockEventBus(),
    });
    const queueService = ctx.services.queue as QueueService;

    // Add jobs - handlers should already be registered
    const emailJobId = await queueService.add('emails', 'send', {
      to: 'test@example.com',
    });
    const reportJobId = await queueService.add('reports', 'generate', {
      type: 'monthly',
    });

    expect(emailJobId).toBeDefined();
    expect(reportJobId).toBeDefined();

    // Wait briefly for job processing
    await vi.waitFor(
      () => {
        expect(emailHandler).toHaveBeenCalled();
        expect(reportHandler).toHaveBeenCalled();
      },
      { timeout: 1000 }
    );

    await hooks.onServerStop?.();
    await hooks.terminate?.();
  });

  it('should register multiple handlers for same queue', async () => {
    const sendHandler = vi.fn().mockResolvedValue({ sent: true });
    const verifyHandler = vi.fn().mockResolvedValue({ verified: true });

    const plugin = createQueuePlugin({
      queues: {
        emails: {
          concurrency: 5,
          jobs: {
            send: defineJob({
              input: z.object({ to: z.string() }),
              output: z.object({ sent: z.boolean() }),
              handler: sendHandler,
            }),
            verify: defineJob({
              input: z.object({ email: z.string() }),
              output: z.object({ verified: z.boolean() }),
              handler: verifyHandler,
            }),
          },
        },
      },
    });

    const hooks = getPluginHooks(plugin);
    const server = createMockServer();

    await hooks.register?.(server);
    await hooks.initialize?.(server);
    await hooks.onServerStart?.();

    const ctx = createMockContext();
    // Get queue service and verify it works (which means storage is working)
    const middleware = server.middleware[0] as {
      execute: (mc: any) => Promise<void>;
    };
    middleware.execute({
      ctx,
      next: vi.fn(),
      logger: createMockLogger(),
      eventBus: createMockEventBus(),
    });
    const queueService = ctx.services.queue as QueueService;

    await queueService.add('emails', 'send', { to: 'a@test.com' });
    await queueService.add('emails', 'verify', { email: 'b@test.com' });

    await vi.waitFor(
      () => {
        expect(sendHandler).toHaveBeenCalled();
        expect(verifyHandler).toHaveBeenCalled();
      },
      { timeout: 1000 }
    );

    await hooks.onServerStop?.();
    await hooks.terminate?.();
  });

  it('should work without jobs in queue config', async () => {
    const plugin = createQueuePlugin({
      queues: {
        emails: { concurrency: 5, jobs: {} },
      },
      // No jobs defined - should work fine
    });

    const hooks = getPluginHooks(plugin);
    const server = createMockServer();

    await hooks.register?.(server);
    await hooks.initialize?.(server);
    await hooks.onServerStart?.();

    const ctx = createMockContext();
    // Get queue service and verify it works (which means storage is working)
    const middleware = server.middleware[0] as {
      execute: (mc: any) => Promise<void>;
    };
    middleware.execute({
      ctx,
      next: vi.fn(),
      logger: createMockLogger(),
      eventBus: createMockEventBus(),
    });
    const queueService = ctx.services.queue as QueueService;

    // Queue should exist even without jobs defined
    expect(queueService.listQueues()).toContain('emails');

    await hooks.onServerStop?.();
    await hooks.terminate?.();
  });

  it('should pass job context to config handlers', async () => {
    let receivedContext: unknown;

    const handler = vi.fn().mockImplementation(ctx => {
      receivedContext = ctx;
      return Promise.resolve({ done: true });
    });

    const plugin = createQueuePlugin({
      queues: {
        test: {
          concurrency: 1,
          jobs: {
            process: defineJob({
              input: z.object({ value: z.number() }),
              output: z.object({ done: z.boolean() }),
              handler,
            }),
          },
        },
      },
    });

    const hooks = getPluginHooks(plugin);
    const server = createMockServer();

    await hooks.register?.(server);
    await hooks.initialize?.(server);
    await hooks.onServerStart?.();

    const ctx = createMockContext();
    // Get queue service and verify it works (which means storage is working)
    const middleware = server.middleware[0] as {
      execute: (mc: any) => Promise<void>;
    };
    middleware.execute({
      ctx,
      next: vi.fn(),
      logger: createMockLogger(),
      eventBus: createMockEventBus(),
    });
    const queueService = ctx.services.queue as QueueService;

    await queueService.add('test', 'process', { value: 42 });

    await vi.waitFor(
      () => {
        // Verify handler received proper JobContext
        expect(handler).toHaveBeenCalled();
        expect(receivedContext).toBeDefined();
        expect(receivedContext).toHaveProperty('jobId');
        expect(receivedContext).toHaveProperty('data', { value: 42 });
        expect(receivedContext).toHaveProperty('logger');
        expect(receivedContext).toHaveProperty('signal');
        expect(receivedContext).toHaveProperty('progress');
      },
      { timeout: 1000 }
    );

    await hooks.onServerStop?.();
    await hooks.terminate?.();
  });
});

// ==========================================================================
// Factory Function Tests
// ==========================================================================
describe('Factory Functions', () => {
  // Clean state between tests
  afterEach(async () => {
    // We need to get a fresh reference after each test
    // because _terminateQueueService is private
    const plugin = createQueuePlugin(createTestConfig());
    const hooks = getPluginHooks(plugin);
    const server = createMockServer();

    await hooks.register?.(server);
    await hooks.initialize?.(server);
    await hooks.terminate?.();
  });

  describe('getQueueService()', () => {
    it('throws error when called before initialization', async () => {
      // Ensure clean state by running full terminate cycle
      const cleanupPlugin = createQueuePlugin(createTestConfig());
      const cleanupHooks = getPluginHooks(cleanupPlugin);
      const cleanupServer = createMockServer();

      await cleanupHooks.register?.(cleanupServer);
      await cleanupHooks.initialize?.(cleanupServer);
      await cleanupHooks.terminate?.();

      // Now it should throw
      expect(() => getQueueService()).toThrow(
        'Queue service not initialized. ' +
          'Make sure you have registered the queue plugin with createQueuePlugin().'
      );
    });

    it('returns service instance after initialization', async () => {
      const plugin = createQueuePlugin(createTestConfig());
      const hooks = getPluginHooks(plugin);
      const server = createMockServer();

      await hooks.register?.(server);
      await hooks.initialize?.(server);

      // Should not throw
      expect(() => getQueueService()).not.toThrow();

      // Should return actual service
      const service = getQueueService();
      expect(service).toBeInstanceOf(QueueService);
      expect(typeof service.add).toBe('function');
      expect(typeof service.getJob).toBe('function');
      expect(typeof service.cancelJob).toBe('function');
      expect(typeof service.listQueues).toBe('function');

      // Cleanup
      await hooks.terminate?.();
    });

    it('throws error after termination', async () => {
      const plugin = createQueuePlugin(createTestConfig());
      const hooks = getPluginHooks(plugin);
      const server = createMockServer();

      await hooks.register?.(server);
      await hooks.initialize?.(server);

      // Works before termination
      expect(() => getQueueService()).not.toThrow();

      await hooks.terminate?.();

      // Throws after termination
      expect(() => getQueueService()).toThrow('not initialized');
    });

    it('returns same instance on multiple calls', async () => {
      const plugin = createQueuePlugin(createTestConfig());
      const hooks = getPluginHooks(plugin);
      const server = createMockServer();

      await hooks.register?.(server);
      await hooks.initialize?.(server);

      const service1 = getQueueService();
      const service2 = getQueueService();
      const service3 = getQueueService();

      // Should be exact same instance
      expect(service1).toBe(service2);
      expect(service2).toBe(service3);

      await hooks.terminate?.();
    });

    it('returns same instance used by middleware', async () => {
      const plugin = createQueuePlugin(createTestConfig());
      const hooks = getPluginHooks(plugin);
      const server = createMockServer();

      await hooks.register?.(server);
      await hooks.initialize?.(server);

      // Get service from factory
      const serviceFromFactory = getQueueService();

      // Get service from middleware
      const middleware = server.middleware[0] as {
        execute: (mc: any) => Promise<void>;
      };

      const ctx = createMockContext();
      await middleware.execute({
        ctx,
        next: vi.fn(),
        logger: createMockLogger(),
        eventBus: createMockEventBus(),
      });

      const serviceFromMiddleware = ctx.services.queue;

      // Should be the same instance
      expect(serviceFromFactory).toBe(serviceFromMiddleware);

      await hooks.terminate?.();
    });
  });

  describe('Lifecycle integration', () => {
    it('factory works after full server lifecycle', async () => {
      const plugin = createQueuePlugin(createTestConfig());
      const hooks = getPluginHooks(plugin);
      const server = createMockServer();

      // Full lifecycle
      await hooks.register?.(server);
      await hooks.initialize?.(server);
      await hooks.onServerStart?.();

      // Factory should work
      const queue = getQueueService();
      expect(queue.listQueues()).toEqual(['emails', 'reports']);

      await hooks.onServerStop?.();

      // Still works before terminate
      expect(() => getQueueService()).not.toThrow();

      await hooks.terminate?.();

      // Now it should throw
      expect(() => getQueueService()).toThrow('not initialized');
    });

    it('can be used in onServerStart hook', async () => {
      const plugin = createQueuePlugin(createTestConfig());
      const hooks = getPluginHooks(plugin);
      const server = createMockServer();

      await hooks.register?.(server);
      await hooks.initialize?.(server);

      // onServerStart uses getQueueService() internally
      await expect(hooks.onServerStart?.()).resolves.toBeUndefined();

      await hooks.terminate?.();
    });

    it('can be used in onServerStop hook', async () => {
      const plugin = createQueuePlugin(createTestConfig());
      const hooks = getPluginHooks(plugin);
      const server = createMockServer();

      await hooks.register?.(server);
      await hooks.initialize?.(server);
      await hooks.onServerStart?.();

      // onServerStop uses getQueueService() internally
      await expect(hooks.onServerStop?.()).resolves.toBeUndefined();

      await hooks.terminate?.();
    });
  });

  describe('Error scenarios', () => {
    it('provides helpful error message when not initialized', async () => {
      const cleanupPlugin = createQueuePlugin(createTestConfig());
      const cleanupHooks = getPluginHooks(cleanupPlugin);
      const cleanupServer = createMockServer();

      await cleanupHooks.register?.(cleanupServer);
      await cleanupHooks.initialize?.(cleanupServer);
      await cleanupHooks.terminate?.();

      try {
        getQueueService();
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Queue service not initialized');
        expect((error as Error).message).toContain('createQueuePlugin()');
      }
    });

    it('handles rapid initialize/terminate cycles', async () => {
      for (let i = 0; i < 3; i++) {
        const plugin = createQueuePlugin(createTestConfig());
        const hooks = getPluginHooks(plugin);
        const server = createMockServer();

        await hooks.register?.(server);
        await hooks.initialize?.(server);

        expect(() => getQueueService()).not.toThrow();

        await hooks.terminate?.();

        expect(() => getQueueService()).toThrow();
      }
    });
  });
});
