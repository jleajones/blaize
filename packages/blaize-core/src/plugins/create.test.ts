import { create } from './create';

import type { Middleware } from '@blaize-types/middleware';

describe('Plugin Creation', () => {
  // Mock server object for testing
  const mockServer = {
    use: vi.fn(),
    register: vi.fn(),
    listen: vi.fn(),
    close: vi.fn(),
  } as any;

  const TEST_PLUGIN_NAME = 'test-plugin';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Plugin Creation', () => {
    test('creates a plugin factory function', () => {
      const factory = create(TEST_PLUGIN_NAME, '1.0.0', () => {});

      expect(typeof factory).toBe('function');
    });

    test('factory creates plugin with correct name and version', () => {
      const factory = create(TEST_PLUGIN_NAME, '1.0.0', () => {});
      const plugin = factory();

      expect(plugin.name).toBe(TEST_PLUGIN_NAME);
      expect(plugin.version).toBe('1.0.0');
      expect(typeof plugin.register).toBe('function');
      expect(plugin._types).toBeDefined();
      expect(plugin._types).toHaveProperty('serverMods');
      expect(plugin._types).toHaveProperty('contextMods');
    });

    test('calls setup function with server and options', async () => {
      const setupSpy = vi.fn();
      const options = { setting: 'value' };

      const factory = create(TEST_PLUGIN_NAME, '1.0.0', setupSpy);
      const plugin = factory(options);

      await plugin.register(mockServer);

      expect(setupSpy).toHaveBeenCalledWith(mockServer, options);
    });

    test('merges default options with user options', async () => {
      const setupSpy = vi.fn();
      const defaultOptions = { default: 'value', override: 'default' };
      const userOptions = { override: 'user', additional: 'extra' };

      const factory = create(TEST_PLUGIN_NAME, '1.0.0', setupSpy, defaultOptions);
      const plugin = factory(userOptions);

      await plugin.register(mockServer);

      expect(setupSpy).toHaveBeenCalledWith(mockServer, {
        default: 'value',
        override: 'user',
        additional: 'extra',
      });
    });

    test('handles setup function that returns partial hooks', async () => {
      const additionalHooks = {
        initialize: vi.fn(),
        terminate: vi.fn(),
        onServerStart: vi.fn(),
      };

      const factory = create(TEST_PLUGIN_NAME, '1.0.0', () => additionalHooks);
      const plugin = factory();

      await plugin.register(mockServer);

      // Check that hooks were merged into the plugin
      expect(plugin.initialize).toBe(additionalHooks.initialize);
      expect(plugin.terminate).toBe(additionalHooks.terminate);
      expect(plugin.onServerStart).toBe(additionalHooks.onServerStart);

      // Register method exists (provided by factory)
      expect(typeof plugin.register).toBe('function');
    });
  });

  describe('Type-Safe Plugin Patterns', () => {
    test('server modifications plugin', async () => {
      interface DatabaseConfig {
        connectionString: string;
      }

      interface DatabaseService {
        database: {
          query: (sql: string) => Promise<any[]>;
        };
      }

      const factory = create<DatabaseConfig, DatabaseService>(
        'database-plugin',
        '1.0.0',
        (server, _options) => {
          // Add database to server
          server.database = {
            query: async () => [],
          };
        },
        { connectionString: 'localhost' }
      );

      const plugin = factory();
      await plugin.register(mockServer);

      expect(plugin.name).toBe('database-plugin');
      expect(plugin._types).toBeDefined();
    });

    test('context modifications plugin', async () => {
      interface LoggerConfig {
        level: string;
      }

      interface LoggerContext {
        logger: {
          log: (message: string) => void;
        };
      }

      const factory = create<LoggerConfig, unknown, LoggerContext>(
        'logger-plugin',
        '1.0.0',
        (_server, _options) => {
          // This would normally modify context creation
        },
        { level: 'info' }
      );

      const plugin = factory();
      await plugin.register(mockServer);

      expect(plugin.name).toBe('logger-plugin');
      expect(plugin._types).toBeDefined();
    });

    test('middleware providing plugin', async () => {
      const authMiddleware: Middleware = {
        name: 'auth',
        execute: async (ctx, next) => {
          await next();
        },
      };

      // Plugin provides middleware through server.use() - types flow through middleware system
      const factory = create<{ secret: string }>(
        'auth-plugin',
        '1.0.0',
        (server, _options) => {
          server.use(authMiddleware); // Middleware types flow through server.use()
        },
        { secret: 'default' }
      );

      const plugin = factory();
      await plugin.register(mockServer);

      expect(plugin.name).toBe('auth-plugin');
      expect(plugin._types).toBeDefined();
      expect(mockServer.use).toHaveBeenCalledWith(authMiddleware);
    });

    test('complex plugin with server and context modifications', async () => {
      interface CacheConfig {
        redisUrl: string;
        defaultTtl: number;
      }

      interface CacheService {
        cache: {
          get: <T>(key: string) => Promise<T | null>;
          set: <T>(key: string, value: T, ttl?: number) => Promise<void>;
        };
      }

      interface CacheContext {
        cached: (key: string, factory: () => Promise<any>, ttl?: number) => Promise<any>;
      }

      const cacheMiddleware: Middleware = {
        name: 'cache',
        execute: async (ctx, next) => {
          await next();
        },
      };

      // Complex plugin with server + context modifications, middleware flows through server.use()
      const factory = create<CacheConfig, CacheService, CacheContext>(
        'cache-plugin',
        '1.0.0',
        (server, _options) => {
          // Add cache service to server
          server.cache = {
            get: async () => null,
            set: async () => {},
          };

          // Register middleware - types flow through middleware system
          server.use(cacheMiddleware);

          return {
            initialize: async () => {
              console.log('Cache initialized');
            },
          };
        },
        { redisUrl: 'redis://localhost', defaultTtl: 300 }
      );

      const plugin = factory();
      await plugin.register(mockServer);

      expect(plugin.name).toBe('cache-plugin');
      expect(plugin._types).toBeDefined();
      expect(mockServer.use).toHaveBeenCalledWith(cacheMiddleware);
      expect(typeof plugin.initialize).toBe('function');
    });
  });

  describe('Edge Cases', () => {
    test('validates plugin name', () => {
      expect(() => create('', '1.0.0', () => {})).toThrow('Plugin name must be a non-empty string');
      expect(() => create(null as any, '1.0.0', () => {})).toThrow(
        'Plugin name must be a non-empty string'
      );
    });

    test('validates plugin version', () => {
      expect(() => create('test', '', () => {})).toThrow(
        'Plugin version must be a non-empty string'
      );
      expect(() => create('test', null as any, () => {})).toThrow(
        'Plugin version must be a non-empty string'
      );
    });

    test('validates setup function', () => {
      expect(() => create(TEST_PLUGIN_NAME, '1.0.0', null as any)).toThrow(
        'Plugin setup must be a function'
      );
      expect(() => create(TEST_PLUGIN_NAME, '1.0.0', 'not-a-function' as any)).toThrow(
        'Plugin setup must be a function'
      );
    });

    test('handles async setup function', async () => {
      const setupSpy = vi.fn().mockResolvedValue(undefined);

      const factory = create(TEST_PLUGIN_NAME, '1.0.0', setupSpy);
      const plugin = factory();

      await plugin.register(mockServer);

      expect(setupSpy).toHaveBeenCalled();
    });

    test('handles setup function with no return value', async () => {
      const setupSpy = vi.fn().mockReturnValue(undefined);

      const factory = create(TEST_PLUGIN_NAME, '1.0.0', setupSpy);
      const plugin = factory();

      await expect(plugin.register(mockServer)).resolves.toBeUndefined();
    });

    test('works with empty default options', () => {
      const factory = create(TEST_PLUGIN_NAME, '1.0.0', () => {});
      const plugin = factory({ custom: 'value' });

      expect(plugin.name).toBe(TEST_PLUGIN_NAME);
    });
  });

  describe('Type Safety', () => {
    test('plugin factory enforces option types', () => {
      interface PluginOptions {
        apiKey: string;
        timeout?: number;
      }

      const factory = create<PluginOptions>('typed-plugin', '1.0.0', (server, options) => {
        // options is typed as PluginOptions
        expect(typeof options.apiKey).toBe('string');
      });

      // This should pass TypeScript compilation
      const plugin = factory({ apiKey: 'test-key', timeout: 5000 });
      expect(plugin.name).toBe('typed-plugin');
    });

    test('type parameters are preserved', () => {
      interface Config {
        url: string;
      }
      interface ServerMods {
        db: any;
      }
      interface ContextMods {
        logger: any;
      }

      const factory = create<Config, ServerMods, ContextMods>(
        'full-typed-plugin',
        '1.0.0',
        (server, options) => {
          // All types are available and enforced
          expect(typeof options.url).toBe('string');
        }
      );

      const plugin = factory({ url: 'test' });
      expect(plugin.name).toBe('full-typed-plugin');
      expect(plugin._types).toBeDefined();
    });
  });

  describe('Plugin Lifecycle', () => {
    test('executes lifecycle hooks in correct order', async () => {
      const executionOrder: string[] = [];

      const factory = create('lifecycle-plugin', '1.0.0', () => ({
        initialize: async () => {
          executionOrder.push('initialize');
        },
        onServerStart: async () => {
          executionOrder.push('onServerStart');
        },
        onServerStop: async () => {
          executionOrder.push('onServerStop');
        },
        terminate: async () => {
          executionOrder.push('terminate');
        },
      }));

      const plugin = factory();

      // Register
      await plugin.register(mockServer);

      // Initialize
      if (plugin.initialize) {
        await plugin.initialize(mockServer);
      }

      // Server start
      if (plugin.onServerStart) {
        await plugin.onServerStart(mockServer);
      }

      // Server stop
      if (plugin.onServerStop) {
        await plugin.onServerStop(mockServer);
      }

      // Terminate
      if (plugin.terminate) {
        await plugin.terminate(mockServer);
      }

      expect(executionOrder).toEqual(['initialize', 'onServerStart', 'onServerStop', 'terminate']);
    });

    test('handles lifecycle hook errors gracefully', async () => {
      const factory = create('error-plugin', '1.0.0', () => ({
        initialize: async () => {
          throw new Error('Initialize failed');
        },
      }));

      const plugin = factory();
      await plugin.register(mockServer);

      // Initialize error should propagate
      if (plugin.initialize) {
        await expect(plugin.initialize(mockServer)).rejects.toThrow('Initialize failed');
      }
    });
  });
});
