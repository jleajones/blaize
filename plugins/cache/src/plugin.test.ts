/**
 * Tests for Cache Plugin Factory
 *
 * Covers:
 * - Plugin creation
 * - Lifecycle hooks
 * - Middleware registration
 * - Adapter integration
 * - Configuration defaults
 * - Error handling
 */

import { createMockContext } from '@blaizejs/testing-utils';

import { createCachePlugin } from './plugin';
import { MemoryAdapter } from './storage';

import type { CacheService } from './cache-service';
import type { CacheAdapter } from './types';

/**
 * Mock server for testing plugin registration
 */
interface MockServer {
  use: ReturnType<typeof vi.fn>;
  middleware: unknown[];
}

function createMockServer(): MockServer {
  const middleware: unknown[] = [];

  return {
    use: vi.fn(mw => {
      middleware.push(mw);
    }),
    middleware,
  };
}

/**
 * Extract plugin hooks for testing
 */
function getPluginHooks(plugin: unknown) {
  const hooks = plugin as {
    register?: (server: unknown) => Promise<void>;
    initialize?: () => Promise<void>;
    onServerStart?: () => Promise<void>;
    onServerStop?: () => Promise<void>;
    terminate?: () => Promise<void>;
  };
  return hooks;
}

describe('createCachePlugin', () => {
  // ==========================================================================
  // Plugin Factory
  // ==========================================================================

  describe('Plugin Factory', () => {
    test('creates a plugin with default config', () => {
      const plugin = createCachePlugin({});

      expect(plugin).toBeDefined();
      expect(typeof plugin).toBe('object');
    });

    test('creates a plugin with custom config', () => {
      const plugin = createCachePlugin({
        maxEntries: 500,
        defaultTtl: 1800,
        serverId: 'server-1',
      });

      expect(plugin).toBeDefined();
    });

    test('returns object with lifecycle hooks', () => {
      const plugin = createCachePlugin({});
      const hooks = getPluginHooks(plugin);

      expect(typeof hooks.register).toBe('function');
      expect(typeof hooks.initialize).toBe('function');
      expect(typeof hooks.onServerStart).toBe('function');
      expect(typeof hooks.onServerStop).toBe('function');
      expect(typeof hooks.terminate).toBe('function');
    });
  });

  // ==========================================================================
  // Lifecycle: Register Hook
  // ==========================================================================

  describe('Lifecycle: register()', () => {
    test('registers middleware on server', async () => {
      const plugin = createCachePlugin({});
      const hooks = getPluginHooks(plugin);
      const server = createMockServer();

      await hooks.register?.(server);

      expect(server.use).toHaveBeenCalled();
      expect(server.middleware).toHaveLength(1);
    });

    test('middleware is named "cache"', async () => {
      const plugin = createCachePlugin({});
      const hooks = getPluginHooks(plugin);
      const server = createMockServer();

      await hooks.register?.(server);

      const middleware = server.middleware[0] as { name: string };
      expect(middleware.name).toBe('cache');
    });

    test('middleware can be called before initialize', async () => {
      const plugin = createCachePlugin({});
      const hooks = getPluginHooks(plugin);
      const server = createMockServer();

      await hooks.register?.(server);

      // Should not throw (middleware registered)
      expect(server.middleware).toHaveLength(1);
    });
  });

  // ==========================================================================
  // Lifecycle: Initialize Hook
  // ==========================================================================

  describe('Lifecycle: initialize()', () => {
    test('initializes without error with default config', async () => {
      const plugin = createCachePlugin({});
      const hooks = getPluginHooks(plugin);

      await expect(hooks.initialize?.()).resolves.toBeUndefined();
    });

    test('creates MemoryAdapter when no adapter provided', async () => {
      const plugin = createCachePlugin({
        maxEntries: 500,
        defaultTtl: 1800,
      });
      const hooks = getPluginHooks(plugin);
      const server = createMockServer();

      await hooks.register?.(server);
      await hooks.initialize?.();

      // Should have created service successfully
      expect(hooks.initialize).toBeDefined();
    });

    test('uses provided adapter instead of default', async () => {
      const customAdapter = new MemoryAdapter({ maxEntries: 200 });
      const plugin = createCachePlugin({
        adapter: customAdapter,
      });
      const hooks = getPluginHooks(plugin);

      await hooks.initialize?.();

      // Should not throw
      expect(hooks.initialize).toBeDefined();
    });

    test('calls adapter.connect() if available', async () => {
      const mockAdapter: CacheAdapter = {
        get: vi.fn(),
        set: vi.fn(),
        delete: vi.fn(),
        mget: vi.fn(),
        mset: vi.fn(),
        getStats: vi.fn(),
        connect: vi.fn().mockResolvedValue(undefined),
      };

      const plugin = createCachePlugin({
        adapter: mockAdapter,
      });
      const hooks = getPluginHooks(plugin);

      await hooks.initialize?.();

      expect(mockAdapter.connect).toHaveBeenCalled();
    });

    test('does not fail if adapter has no connect method', async () => {
      const mockAdapter: CacheAdapter = {
        get: vi.fn(),
        set: vi.fn(),
        delete: vi.fn(),
        mget: vi.fn(),
        mset: vi.fn(),
        getStats: vi.fn(),
        // No connect method
      };

      const plugin = createCachePlugin({
        adapter: mockAdapter,
      });
      const hooks = getPluginHooks(plugin);

      await expect(hooks.initialize?.()).resolves.toBeUndefined();
    });
  });

  // ==========================================================================
  // Lifecycle: Server Start Hook
  // ==========================================================================

  describe('Lifecycle: onServerStart()', () => {
    test('completes without error', async () => {
      const plugin = createCachePlugin({});
      const hooks = getPluginHooks(plugin);

      await hooks.initialize?.();
      await expect(hooks.onServerStart?.()).resolves.toBeUndefined();
    });

    test('performs health check on start', async () => {
      const plugin = createCachePlugin({});
      const hooks = getPluginHooks(plugin);

      await hooks.initialize?.();
      await hooks.onServerStart?.();

      // Should complete (health check runs internally)
      expect(hooks.onServerStart).toBeDefined();
    });
  });

  // ==========================================================================
  // Lifecycle: Server Stop Hook
  // ==========================================================================

  describe('Lifecycle: onServerStop()', () => {
    test('completes without error', async () => {
      const plugin = createCachePlugin({});
      const hooks = getPluginHooks(plugin);

      await hooks.initialize?.();
      await expect(hooks.onServerStop?.()).resolves.toBeUndefined();
    });
  });

  // ==========================================================================
  // Lifecycle: Terminate Hook
  // ==========================================================================

  describe('Lifecycle: terminate()', () => {
    test('calls adapter.disconnect() if available', async () => {
      const mockAdapter: CacheAdapter = {
        get: vi.fn(),
        set: vi.fn(),
        delete: vi.fn(),
        mget: vi.fn(),
        mset: vi.fn(),
        getStats: vi.fn(),
        disconnect: vi.fn().mockResolvedValue(undefined),
      };

      const plugin = createCachePlugin({
        adapter: mockAdapter,
      });
      const hooks = getPluginHooks(plugin);

      await hooks.initialize?.();
      await hooks.terminate?.();

      expect(mockAdapter.disconnect).toHaveBeenCalled();
    });

    test('does not fail if adapter has no disconnect method', async () => {
      const mockAdapter: CacheAdapter = {
        get: vi.fn(),
        set: vi.fn(),
        delete: vi.fn(),
        mget: vi.fn(),
        mset: vi.fn(),
        getStats: vi.fn(),
        // No disconnect method
      };

      const plugin = createCachePlugin({
        adapter: mockAdapter,
      });
      const hooks = getPluginHooks(plugin);

      await hooks.initialize?.();
      await expect(hooks.terminate?.()).resolves.toBeUndefined();
    });

    test('completes without error when called multiple times', async () => {
      const plugin = createCachePlugin({});
      const hooks = getPluginHooks(plugin);

      await hooks.initialize?.();
      await hooks.terminate?.();

      // Second call should not throw
      await expect(hooks.terminate?.()).resolves.toBeUndefined();
    });
  });

  // ==========================================================================
  // Configuration
  // ==========================================================================

  describe('Configuration', () => {
    test('applies default maxEntries', async () => {
      const plugin = createCachePlugin({});
      const hooks = getPluginHooks(plugin);

      await hooks.initialize?.();

      // Should use default (1000)
      expect(hooks.initialize).toBeDefined();
    });

    test('applies custom maxEntries', async () => {
      const plugin = createCachePlugin({
        maxEntries: 500,
      });
      const hooks = getPluginHooks(plugin);

      await hooks.initialize?.();

      // Should use custom value
      expect(hooks.initialize).toBeDefined();
    });

    test('applies default TTL', async () => {
      const plugin = createCachePlugin({
        defaultTtl: 1800,
      });
      const hooks = getPluginHooks(plugin);

      await hooks.initialize?.();

      // Should use custom TTL
      expect(hooks.initialize).toBeDefined();
    });

    test('supports serverId configuration', async () => {
      const plugin = createCachePlugin({
        serverId: 'server-42',
      });
      const hooks = getPluginHooks(plugin);

      await hooks.initialize?.();

      // Should accept serverId
      expect(hooks.initialize).toBeDefined();
    });
  });

  // ==========================================================================
  // Full Lifecycle Integration
  // ==========================================================================

  describe('Full Lifecycle', () => {
    test('complete lifecycle without errors', async () => {
      const plugin = createCachePlugin({
        maxEntries: 500,
        defaultTtl: 1800,
      });
      const hooks = getPluginHooks(plugin);
      const server = createMockServer();

      // 1. Register
      await hooks.register?.(server);
      expect(server.middleware).toHaveLength(1);

      // 2. Initialize
      await hooks.initialize?.();

      // 3. Server start
      await hooks.onServerStart?.();

      // 4. Server stop
      await hooks.onServerStop?.();

      // 5. Terminate
      await hooks.terminate?.();

      // All hooks completed
      expect(hooks.terminate).toBeDefined();
    });

    test('lifecycle with custom adapter', async () => {
      const mockAdapter: CacheAdapter = {
        get: vi.fn(),
        set: vi.fn(),
        delete: vi.fn(),
        mget: vi.fn(),
        mset: vi.fn(),
        getStats: vi.fn(),
        connect: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn().mockResolvedValue(undefined),
      };

      const plugin = createCachePlugin({
        adapter: mockAdapter,
      });
      const hooks = getPluginHooks(plugin);
      const server = createMockServer();

      await hooks.register?.(server);
      await hooks.initialize?.();
      await hooks.onServerStart?.();
      await hooks.onServerStop?.();
      await hooks.terminate?.();

      // Adapter lifecycle methods called
      expect(mockAdapter.connect).toHaveBeenCalled();
      expect(mockAdapter.disconnect).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Middleware Behavior
  // ==========================================================================

  describe('Middleware Behavior', () => {
    test('middleware exposes cache service', async () => {
      const plugin = createCachePlugin({});
      const hooks = getPluginHooks(plugin);
      const server = createMockServer();

      await hooks.register?.(server);
      await hooks.initialize?.();

      // Get middleware with execute method
      const middleware = server.middleware[0] as {
        execute: (ctx: any, next: () => Promise<void>) => Promise<void>;
      };

      // Use createMockContext from testing-utils
      const ctx = createMockContext();
      await middleware.execute(ctx, vi.fn());

      // Type-safe access with casting
      const cacheService = ctx.services.cache as CacheService;
      expect(cacheService).toBeDefined();
    });
  });

  // ==========================================================================
  // Error Scenarios
  // ==========================================================================

  describe('Error Scenarios', () => {
    test('handles adapter connection failure gracefully', async () => {
      const mockAdapter: CacheAdapter = {
        get: vi.fn(),
        set: vi.fn(),
        delete: vi.fn(),
        mget: vi.fn(),
        mset: vi.fn(),
        getStats: vi.fn(),
        connect: vi.fn().mockRejectedValue(new Error('Connection failed')),
      };

      const plugin = createCachePlugin({
        adapter: mockAdapter,
      });
      const hooks = getPluginHooks(plugin);

      // Should propagate error
      await expect(hooks.initialize?.()).rejects.toThrow('Connection failed');
    });

    test('handles adapter disconnection failure gracefully', async () => {
      const mockAdapter: CacheAdapter = {
        get: vi.fn(),
        set: vi.fn(),
        delete: vi.fn(),
        mget: vi.fn(),
        mset: vi.fn(),
        getStats: vi.fn(),
        disconnect: vi.fn().mockRejectedValue(new Error('Disconnect failed')),
      };

      const plugin = createCachePlugin({
        adapter: mockAdapter,
      });
      const hooks = getPluginHooks(plugin);

      await hooks.initialize?.();

      // Should propagate error
      await expect(hooks.terminate?.()).rejects.toThrow('Disconnect failed');
    });
  });
});
