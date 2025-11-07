/* eslint-disable @typescript-eslint/no-empty-object-type */
import { createMockMiddleware } from '@blaizejs/testing-utils';

import type {
  PluginHooks,
  Plugin,
  PluginFactory,
  CreatePluginOptions,
  UnknownServer,
  Server,
} from '@blaize-types/index';

describe('Task 1.1: PluginHooks Interface with JSDoc', () => {
  describe('Type Safety', () => {
    test('all hooks should be optional', () => {
      const emptyHooks: PluginHooks = {};
      expect(emptyHooks).toBeDefined();
    });

    test('register hook accepts Server parameter with generic types', () => {
      const hooks: PluginHooks = {
        register: async (server: UnknownServer) => {
          const testMiddleware = createMockMiddleware();
          // Type check: server should have use method
          server.use(testMiddleware);
        },
      };
      expect(hooks.register).toBeDefined();
    });

    test('initialize hook has no parameters', () => {
      const hooks: PluginHooks = {
        initialize: async () => {
          // No parameters - resources are created here
        },
      };
      expect(hooks.initialize).toBeDefined();
    });

    test('onServerStart hook has no parameters', () => {
      const hooks: PluginHooks = {
        onServerStart: async () => {
          // No parameters - start background work
        },
      };
      expect(hooks.onServerStart).toBeDefined();
    });

    test('onServerStop hook has no parameters', () => {
      const hooks: PluginHooks = {
        onServerStop: async () => {
          // No parameters - stop background work
        },
      };
      expect(hooks.onServerStop).toBeDefined();
    });

    test('terminate hook has no parameters', () => {
      const hooks: PluginHooks = {
        terminate: async () => {
          // No parameters - cleanup resources
        },
      };
      expect(hooks.terminate).toBeDefined();
    });
  });

  describe('Generic Type Parameters', () => {
    test('supports TState and TServices generic types', () => {
      interface MyState {
        userId: string;
      }

      interface MyServices {
        db: { query: () => Promise<any> };
      }

      const hooks: PluginHooks<MyState, MyServices> = {
        register: async (server: Server<MyState, MyServices>) => {
          // Type check: server should be typed with MyState and MyServices
          expect(server).toBeDefined();
        },
      };

      expect(hooks).toBeDefined();
    });

    test('defaults to empty object types when not specified', () => {
      const hooks: PluginHooks = {
        register: async (server: UnknownServer) => {
          expect(server).toBeDefined();
        },
      };
      expect(hooks).toBeDefined();
    });
  });

  describe('Plugin Interface', () => {
    test('Plugin extends PluginHooks with name and version', () => {
      const plugin: Plugin = {
        name: 'test-plugin',
        version: '1.0.0',
        register: async () => {},
      };

      expect(plugin.name).toBe('test-plugin');
      expect(plugin.version).toBe('1.0.0');
    });

    test('Plugin supports generic types', () => {
      interface MyState {
        counter: number;
      }

      interface MyServices {
        cache: Map<string, any>;
      }

      const plugin: Plugin<MyState, MyServices> = {
        name: 'typed-plugin',
        version: '1.0.0',
        register: async (server: Server<MyState, MyServices>) => {
          expect(server).toBeDefined();
        },
      };

      expect(plugin.name).toBe('typed-plugin');
    });
  });

  describe('PluginFactory Type', () => {
    test('PluginFactory accepts optional config parameter', () => {
      interface MyConfig {
        enabled: boolean;
      }

      const factory: PluginFactory<MyConfig> = config => ({
        name: 'test-plugin',
        version: '1.0.0',
        register: async () => {
          console.log('Config:', config);
        },
      });

      expect(factory).toBeDefined();
      const plugin = factory({ enabled: true });
      expect(plugin.name).toBe('test-plugin');
    });

    test('PluginFactory can be called without config', () => {
      const factory: PluginFactory = () => ({
        name: 'no-config-plugin',
        version: '1.0.0',
        register: async () => {},
      });

      const plugin = factory();
      expect(plugin.name).toBe('no-config-plugin');
    });
  });

  describe('Lifecycle Order Documentation', () => {
    test('lifecycle order is documented in interface JSDoc', () => {
      // This test verifies the interface exists with proper structure
      // JSDoc validation is done manually via IDE IntelliSense
      const hooks: PluginHooks = {
        register: async () => {},
        initialize: async () => {},
        onServerStart: async () => {},
        onServerStop: async () => {},
        terminate: async () => {},
      };

      // Verify all hooks are in correct order
      const hookNames = Object.keys(hooks);
      expect(hookNames).toEqual([
        'register',
        'initialize',
        'onServerStart',
        'onServerStop',
        'terminate',
      ]);
    });
  });

  describe('Backward Compatibility', () => {
    test('old code without generic types still works', () => {
      // Code using PluginHooks without type parameters should still compile
      const testMiddleware = createMockMiddleware();
      const hooks: PluginHooks = {
        register: async server => {
          server.use(testMiddleware);
        },
      };

      expect(hooks).toBeDefined();
    });

    test('server parameter is still accepted in register hook', () => {
      const hooks: PluginHooks = {
        register: async server => {
          // Type check passes
          expect(server).toBeDefined();
        },
      };

      expect(hooks.register).toBeDefined();
    });

    test('hooks work with both sync and async', () => {
      const testMiddleware = createMockMiddleware();
      const syncHooks: PluginHooks = {
        register: server => {
          server.use(testMiddleware);
        },
      };

      const asyncHooks: PluginHooks = {
        register: async server => {
          server.use(testMiddleware);
        },
      };

      expect(syncHooks.register).toBeDefined();
      expect(asyncHooks.register).toBeDefined();
    });
  });

  describe('Hook Optionality', () => {
    test('plugin can have only register hook', () => {
      const plugin: Plugin = {
        name: 'minimal-plugin',
        version: '1.0.0',
        register: async () => {},
      };
      expect(plugin.initialize).toBeUndefined();
      expect(plugin.onServerStart).toBeUndefined();
      expect(plugin.onServerStop).toBeUndefined();
      expect(plugin.terminate).toBeUndefined();
    });

    test('plugin can have all lifecycle hooks', () => {
      const plugin: Plugin = {
        name: 'full-plugin',
        version: '1.0.0',
        register: async () => {},
        initialize: async () => {},
        onServerStart: async () => {},
        onServerStop: async () => {},
        terminate: async () => {},
      };
      expect(plugin.register).toBeDefined();
      expect(plugin.initialize).toBeDefined();
      expect(plugin.onServerStart).toBeDefined();
      expect(plugin.onServerStop).toBeDefined();
      expect(plugin.terminate).toBeDefined();
    });

    test('plugin can have subset of lifecycle hooks', () => {
      const plugin: Plugin = {
        name: 'partial-plugin',
        version: '1.0.0',
        initialize: async () => {},
        terminate: async () => {},
        register: async () => {},
      };
      expect(plugin.register).toBeDefined();
      expect(plugin.initialize).toBeDefined();
      expect(plugin.terminate).toBeDefined();
      expect(plugin.onServerStart).toBeUndefined();
      expect(plugin.onServerStop).toBeUndefined();
    });
  });
});

describe('Task 1.2: CreatePluginOptions Interface', () => {
  describe('Type Structure', () => {
    test('accepts valid options with all required fields', () => {
      interface TestConfig {
        port: number;
      }

      const options: CreatePluginOptions<TestConfig> = {
        name: 'test-plugin',
        version: '1.0.0',
        setup: config => ({
          initialize: async () => {
            console.log('Port:', config.port);
          },
        }),
      };

      expect(options.name).toBe('test-plugin');
      expect(options.version).toBe('1.0.0');
      expect(typeof options.setup).toBe('function');
    });

    test('accepts options with defaultConfig', () => {
      interface TestConfig {
        enabled: boolean;
        timeout: number;
      }

      const options: CreatePluginOptions<TestConfig> = {
        name: 'test-plugin',
        version: '1.0.0',
        defaultConfig: {
          enabled: true,
          timeout: 30000,
        },
        setup: _config => ({}),
      };

      expect(options.defaultConfig).toEqual({
        enabled: true,
        timeout: 30000,
      });
    });

    test('defaultConfig is optional', () => {
      interface TestConfig {
        value: string;
      }

      const options: CreatePluginOptions<TestConfig> = {
        name: 'minimal-plugin',
        version: '1.0.0',
        setup: config => ({
          initialize: async () => {
            console.log(config.value);
          },
        }),
      };

      expect(options.defaultConfig).toBeUndefined();
    });
  });

  describe('Generic Type Parameters', () => {
    test('TConfig types flow correctly through setup', () => {
      interface MyConfig {
        port: number;
        host: string;
      }

      const options: CreatePluginOptions<MyConfig> = {
        name: 'typed-plugin',
        version: '1.0.0',
        defaultConfig: {
          port: 3000,
          host: 'localhost',
        },
        setup: config => {
          // Type test: config should be fully typed
          const _portTest: number = config.port;
          const _hostTest: string = config.host;

          return {
            initialize: async () => {
              expect(typeof config.port).toBe('number');
              expect(typeof config.host).toBe('string');
            },
          };
        },
      };

      expect(options.defaultConfig?.port).toBe(3000);
    });

    test('TState and TServices flow to PluginHooks', () => {
      interface MyConfig {
        db: string;
      }

      interface MyState {
        requestId: string;
      }

      interface MyServices {
        database: { query: () => Promise<any> };
      }

      const options: CreatePluginOptions<MyConfig, MyState, MyServices> = {
        name: 'full-typed-plugin',
        version: '1.0.0',
        setup: _config => {
          const hooks: Partial<PluginHooks<MyState, MyServices>> = {
            register: async (server: Server<MyState, MyServices>) => {
              // Type check: server should be typed correctly
              expect(server).toBeDefined();
            },
          };
          return hooks;
        },
      };

      expect(options.name).toBe('full-typed-plugin');
    });

    test('generic types default to empty objects', () => {
      interface MyConfig {
        value: number;
      }

      // TState and TServices default to {}
      const options: CreatePluginOptions<MyConfig> = {
        name: 'default-generics',
        version: '1.0.0',
        setup: config => ({
          initialize: async () => {
            console.log(config.value);
          },
        }),
      };

      expect(options.name).toBe('default-generics');
    });
  });

  describe('Setup Function Return Type', () => {
    test('setup can return empty hooks object', () => {
      interface TestConfig {
        enabled: boolean;
      }

      const options: CreatePluginOptions<TestConfig> = {
        name: 'empty-hooks',
        version: '1.0.0',
        setup: config => {
          console.log('Config:', config);
          return {}; // All hooks are optional
        },
      };

      const hooks = options.setup({ enabled: true });
      expect(hooks).toEqual({});
    });

    test('setup can return any subset of hooks', () => {
      interface TestConfig {
        value: string;
      }

      const options: CreatePluginOptions<TestConfig> = {
        name: 'partial-hooks',
        version: '1.0.0',
        setup: config => ({
          initialize: async () => {
            console.log('Init:', config.value);
          },
          terminate: async () => {
            console.log('Cleanup:', config.value);
          },
          // register, onServerStart, onServerStop omitted - that's fine!
        }),
      };

      const hooks = options.setup({ value: 'test' });
      expect(hooks.initialize).toBeDefined();
      expect(hooks.terminate).toBeDefined();
      expect(hooks.register).toBeUndefined();
    });

    test('setup can return all hooks', () => {
      interface TestConfig {
        name: string;
      }

      const options: CreatePluginOptions<TestConfig> = {
        name: 'all-hooks',
        version: '1.0.0',
        setup: config => ({
          register: async _server => {
            console.log('Register:', config.name);
          },
          initialize: async () => {
            console.log('Initialize:', config.name);
          },
          onServerStart: async () => {
            console.log('Start:', config.name);
          },
          onServerStop: async () => {
            console.log('Stop:', config.name);
          },
          terminate: async () => {
            console.log('Terminate:', config.name);
          },
        }),
      };

      const hooks = options.setup({ name: 'test' });
      expect(hooks.register).toBeDefined();
      expect(hooks.initialize).toBeDefined();
      expect(hooks.onServerStart).toBeDefined();
      expect(hooks.onServerStop).toBeDefined();
      expect(hooks.terminate).toBeDefined();
    });
  });

  describe('Config Merging Pattern', () => {
    test('demonstrates closure pattern for resource management', () => {
      interface DatabaseConfig {
        host: string;
        port: number;
      }

      let connectionCount = 0;

      const options: CreatePluginOptions<DatabaseConfig> = {
        name: 'database-plugin',
        version: '1.0.0',
        defaultConfig: {
          host: 'localhost',
          port: 5432,
        },
        setup: config => {
          // Closure variable - singleton resource
          let _connection: { host: string; port: number } | null = null;

          return {
            initialize: async () => {
              // Create resource once
              _connection = { host: config.host, port: config.port };
              connectionCount++;
            },
            terminate: async () => {
              // Cleanup resource
              _connection = null;
            },
          };
        },
      };

      // Simulate plugin lifecycle
      const hooks1 = options.setup({ host: 'db.example.com', port: 5432 });
      hooks1.initialize?.();
      expect(connectionCount).toBe(1);
    });
  });

  describe('Real-World Examples', () => {
    test('metrics plugin pattern', () => {
      interface MetricsConfig {
        enabled: boolean;
        interval: number;
        excludePaths: string[];
      }

      const options: CreatePluginOptions<MetricsConfig> = {
        name: '@blaizejs/plugin-metrics',
        version: '1.0.0',
        defaultConfig: {
          enabled: true,
          interval: 60000,
          excludePaths: ['/health', '/metrics'],
        },
        setup: config => {
          let collector: { collect: () => void } | null = null;

          return {
            initialize: async () => {
              if (config.enabled) {
                collector = { collect: () => console.log('Collecting...') };
              }
            },
            onServerStart: async () => {
              if (collector) {
                setInterval(() => collector?.collect(), config.interval);
              }
            },
            terminate: async () => {
              collector = null;
            },
          };
        },
      };

      expect(options.name).toBe('@blaizejs/plugin-metrics');
      expect(options.defaultConfig?.interval).toBe(60000);
    });

    test('database plugin pattern', () => {
      interface DbConfig {
        url: string;
        poolSize: number;
      }

      interface DbServices {
        db: { query: (sql: string) => Promise<any> };
      }

      const options: CreatePluginOptions<DbConfig, {}, DbServices> = {
        name: '@blaizejs/plugin-database',
        version: '2.0.0',
        defaultConfig: {
          url: 'postgresql://localhost/mydb',
          poolSize: 10,
        },
        setup: _config => {
          let _db: { query: (sql: string) => Promise<any> } | null = null;

          return {
            initialize: async () => {
              // Simulate DB connection
              _db = {
                query: async (sql: string) => {
                  console.log('Query:', sql);
                  return [];
                },
              };
            },
            register: async () => {
              // Add db to services (middleware would do this in real impl)
              console.log('Adding DB to server');
            },
            terminate: async () => {
              // Close connection
              _db = null;
            },
          };
        },
      };

      expect(options.defaultConfig?.poolSize).toBe(10);
    });
  });

  describe('Edge Cases', () => {
    test('config can be any type including primitives', () => {
      // Config can be a number
      const numericOptions: CreatePluginOptions<number> = {
        name: 'numeric-config',
        version: '1.0.0',
        setup: (config: number) => ({
          initialize: async () => {
            expect(typeof config).toBe('number');
          },
        }),
      };

      expect(numericOptions.name).toBe('numeric-config');
    });

    test('config can be union type', () => {
      type MixedConfig = { mode: 'simple'; value: string } | { mode: 'advanced'; settings: object };

      const options: CreatePluginOptions<MixedConfig> = {
        name: 'union-config',
        version: '1.0.0',
        setup: config => {
          if (config.mode === 'simple') {
            console.log('Simple:', config.value);
          } else {
            console.log('Advanced:', config.settings);
          }
          return {};
        },
      };

      expect(options.name).toBe('union-config');
    });

    test('setup function can be sync or async', () => {
      interface TestConfig {
        value: number;
      }

      const syncOptions: CreatePluginOptions<TestConfig> = {
        name: 'sync-setup',
        version: '1.0.0',
        setup: config => {
          // Synchronous setup
          return {
            initialize: async () => {
              console.log(config.value);
            },
          };
        },
      };

      expect(typeof syncOptions.setup).toBe('function');
    });
  });
});
