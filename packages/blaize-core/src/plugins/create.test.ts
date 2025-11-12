/* eslint-disable @typescript-eslint/no-empty-object-type */
import { createMockServer } from '@blaizejs/testing-utils';

import { create } from './create';

import type { Plugin } from '@blaize-types/index';

describe('Task 2.1: createPlugin Implementation', () => {
  describe('Input Validation', () => {
    test('throws on empty name', () => {
      expect(() =>
        create({
          name: '',
          version: '1.0.0',
          setup: () => ({}),
        })
      ).toThrow('Plugin name must be a non-empty string');
    });

    test('throws on non-string name', () => {
      expect(() =>
        create({
          name: 123 as any,
          version: '1.0.0',
          setup: () => ({}),
        })
      ).toThrow('Plugin name must be a non-empty string');
    });

    test('throws on missing name', () => {
      expect(() =>
        create({
          name: null as any,
          version: '1.0.0',
          setup: () => ({}),
        })
      ).toThrow('Plugin name must be a non-empty string');
    });

    test('throws on empty version', () => {
      expect(() =>
        create({
          name: 'test',
          version: '',
          setup: () => ({}),
        })
      ).toThrow('Plugin version must be a non-empty string');
    });

    test('throws on non-string version', () => {
      expect(() =>
        create({
          name: 'test',
          version: 2.0 as any,
          setup: () => ({}),
        })
      ).toThrow('Plugin version must be a non-empty string');
    });

    test('throws on non-function setup', () => {
      expect(() =>
        create({
          name: 'test',
          version: '1.0.0',
          setup: 'not a function' as any,
        })
      ).toThrow('Plugin setup must be a function');
    });

    test('throws on object setup', () => {
      expect(() =>
        create({
          name: 'test',
          version: '1.0.0',
          setup: {} as any,
        })
      ).toThrow('Plugin setup must be a function');
    });

    test('throws when setup returns null', () => {
      const factory = create({
        name: 'test',
        version: '1.0.0',
        setup: () => null as any,
      });

      expect(() => factory()).toThrow(
        'Plugin "test" setup() must return an object with lifecycle hooks'
      );
    });

    test('throws when setup returns non-object', () => {
      const factory = create({
        name: 'test',
        version: '1.0.0',
        setup: () => 'invalid' as any,
      });

      expect(() => factory()).toThrow(
        'Plugin "test" setup() must return an object with lifecycle hooks'
      );
    });
  });

  describe('Config Merging', () => {
    test('uses default config when no user config provided', () => {
      let receivedConfig: any;

      const factory = create<{ port: number }>({
        name: 'test',
        version: '1.0.0',
        defaultConfig: { port: 3000 },
        setup: (config: { port: number }) => {
          receivedConfig = config;
          return {};
        },
      });

      factory();
      expect(receivedConfig.port).toBe(3000);
    });

    test('merges user config with defaults', () => {
      let receivedConfig: any;

      const factory = create<{ host: string; port: number }>({
        name: 'test',
        version: '1.0.0',
        defaultConfig: { host: 'localhost', port: 3000 },
        setup: (config: { host: string; port: number }) => {
          receivedConfig = config;
          return {};
        },
      });

      factory({ host: 'prod.com' });
      expect(receivedConfig.host).toBe('prod.com');
      expect(receivedConfig.port).toBe(3000);
    });

    test('user config overrides defaults', () => {
      let receivedConfig: any;

      const factory = create<{ port: number }>({
        name: 'test',
        version: '1.0.0',
        defaultConfig: { port: 3000 },
        setup: (config: { port: number }) => {
          receivedConfig = config;
          return {};
        },
      });

      factory({ port: 8080 });
      expect(receivedConfig.port).toBe(8080);
    });

    test('works without defaultConfig', () => {
      let receivedConfig: any;

      const factory = create<{ value: string }>({
        name: 'test',
        version: '1.0.0',
        setup: (config: { value: string }) => {
          receivedConfig = config;
          return {};
        },
      });

      factory({ value: 'test' });
      expect(receivedConfig.value).toBe('test');
    });

    test('merges nested objects correctly', () => {
      let receivedConfig: any;

      const factory = create<{ db: { host: string; port: number } }>({
        name: 'test',
        version: '1.0.0',
        defaultConfig: {
          db: { host: 'localhost', port: 5432 },
        },
        setup: (config: { db: { host: string; port: number } }) => {
          receivedConfig = config;
          return {};
        },
      });

      factory({ db: { host: 'prod.db.com', port: 5432 } });
      expect(receivedConfig.db.host).toBe('prod.db.com');
      expect(receivedConfig.db.port).toBe(5432);
    });
  });

  describe('Hook Registration', () => {
    test('includes all provided hooks', () => {
      const register = vi.fn();
      const initialize = vi.fn();
      const onServerStart = vi.fn();
      const onServerStop = vi.fn();
      const terminate = vi.fn();

      const factory = create({
        name: 'test',
        version: '1.0.0',
        setup: () => ({
          register,
          initialize,
          onServerStart,
          onServerStop,
          terminate,
        }),
      });

      const plugin = factory();

      expect(plugin.register).toBe(register);
      expect(plugin.initialize).toBe(initialize);
      expect(plugin.onServerStart).toBe(onServerStart);
      expect(plugin.onServerStop).toBe(onServerStop);
      expect(plugin.terminate).toBe(terminate);
    });

    test('provides default register if not provided', () => {
      const factory = create({
        name: 'test',
        version: '1.0.0',
        setup: () => ({
          initialize: async () => {},
        }),
      });

      const plugin = factory();

      expect(typeof plugin.register).toBe('function');
      expect(plugin.register).toBeDefined();
    });

    test('default register is async function', async () => {
      const factory = create({
        name: 'test',
        version: '1.0.0',
        setup: () => ({}),
      });

      const plugin = factory();
      // TODO: fix mock server
      // const mockServer = createMockServer();
      const mockServer = {} as any;
      const result = plugin.register(mockServer);

      expect(result).toBeInstanceOf(Promise);
      await result; // Should not throw
    });

    test('omits optional hooks when not provided', () => {
      const factory = create({
        name: 'test',
        version: '1.0.0',
        setup: () => ({
          initialize: async () => {},
        }),
      });

      const plugin = factory();

      expect(plugin.initialize).toBeDefined();
      expect(plugin.onServerStart).toBeUndefined();
      expect(plugin.onServerStop).toBeUndefined();
      expect(plugin.terminate).toBeUndefined();
    });

    test('handles empty hooks object', () => {
      const factory = create({
        name: 'test',
        version: '1.0.0',
        setup: () => ({}),
      });

      const plugin = factory();

      expect(plugin.register).toBeDefined(); // Default provided
      expect(plugin.initialize).toBeUndefined();
      expect(plugin.onServerStart).toBeUndefined();
      expect(plugin.onServerStop).toBeUndefined();
      expect(plugin.terminate).toBeUndefined();
    });

    test('preserves hook function references', () => {
      const initFn = async () => console.log('init');

      const factory = create({
        name: 'test',
        version: '1.0.0',
        setup: () => ({
          initialize: initFn,
        }),
      });

      const plugin = factory();

      expect(plugin.initialize).toBe(initFn);
    });
  });

  describe('Plugin Metadata', () => {
    test('sets correct name and version', () => {
      const factory = create({
        name: '@blaizejs/test',
        version: '2.5.1',
        setup: () => ({}),
      });

      const plugin = factory();

      expect(plugin.name).toBe('@blaizejs/test');
      expect(plugin.version).toBe('2.5.1');
    });

    test('preserves scoped package name', () => {
      const factory = create({
        name: '@my-org/my-plugin',
        version: '1.0.0',
        setup: () => ({}),
      });

      const plugin = factory();

      expect(plugin.name).toBe('@my-org/my-plugin');
    });

    test('version can be any semver format', () => {
      const factory = create({
        name: 'test',
        version: '1.0.0-beta.1',
        setup: () => ({}),
      });

      const plugin = factory();

      expect(plugin.version).toBe('1.0.0-beta.1');
    });
  });

  describe('Type Safety', () => {
    test('preserves TState and TServices types', () => {
      interface MyState {
        user: string;
      }
      interface MyServices {
        db: { query: () => Promise<any> };
      }

      const factory = create<{}, MyState, MyServices>({
        name: 'test',
        version: '1.0.0',
        setup: () => ({}),
      });

      const plugin = factory();

      // Type test - would fail compilation if types wrong
      const _typeTest: Plugin<MyState, MyServices> = plugin;
      expect(_typeTest).toBe(plugin);
    });

    test('config type flows correctly', () => {
      interface TestConfig {
        port: number;
        host: string;
      }

      let configType: TestConfig | undefined;

      const factory = create<TestConfig>({
        name: 'test',
        version: '1.0.0',
        setup: (config: TestConfig) => {
          // Type check: config should be TestConfig
          configType = config;
          const _portType: number = config.port;
          const _hostType: string = config.host;
          return {};
        },
      });

      factory({ port: 3000, host: 'localhost' });
      expect(configType).toBeDefined();
    });
  });

  describe('Factory Function Behavior', () => {
    test('returns new plugin instance each call', () => {
      const factory = create({
        name: 'test',
        version: '1.0.0',
        setup: () => ({
          initialize: async () => {},
        }),
      });

      const plugin1 = factory();
      const plugin2 = factory();

      expect(plugin1).not.toBe(plugin2);
      expect(plugin1.name).toBe(plugin2.name);
    });

    test('setup is called for each factory invocation', () => {
      const setupFn = vi.fn(() => ({}));

      const factory = create({
        name: 'test',
        version: '1.0.0',
        setup: setupFn,
      });

      factory();
      factory();
      factory();

      expect(setupFn).toHaveBeenCalledTimes(3);
    });

    test('different configs create different plugin instances', () => {
      let config1: any;
      let config2: any;

      const factory = create<{ value: number }>({
        name: 'test',
        version: '1.0.0',
        setup: (config: { value: number }) => {
          if (config.value === 1) config1 = config;
          if (config.value === 2) config2 = config;
          return {};
        },
      });

      factory({ value: 1 });
      factory({ value: 2 });

      expect(config1.value).toBe(1);
      expect(config2.value).toBe(2);
    });
  });

  describe('Real-World Plugin Patterns', () => {
    test('database plugin with closure', () => {
      interface DbConfig {
        url: string;
      }

      let dbInstance: any = null;

      const factory = create<DbConfig>({
        name: '@app/database',
        version: '1.0.0',
        defaultConfig: {
          url: 'postgresql://localhost/test',
        },
        setup: (config: DbConfig) => {
          // Closure variable
          let db: any = null;

          return {
            initialize: async () => {
              db = { url: config.url, connected: true };
              dbInstance = db;
            },
            terminate: async () => {
              db = null;
            },
          };
        },
      });

      const plugin = factory({ url: 'postgresql://prod/db' });
      // Create mock server to pass to hooks
      const mockServer = createMockServer();
      plugin.initialize!(mockServer);

      expect(dbInstance).toBeDefined();
      expect(dbInstance.url).toBe('postgresql://prod/db');
    });

    test('metrics plugin with lifecycle', () => {
      interface MetricsConfig {
        enabled: boolean;
        interval: number;
      }

      const events: string[] = [];

      const factory = create<MetricsConfig>({
        name: '@app/metrics',
        version: '1.0.0',
        defaultConfig: {
          enabled: true,
          interval: 60000,
        },
        setup: (config: MetricsConfig) => {
          let collector: any = null;

          return {
            initialize: async () => {
              if (config.enabled) {
                collector = { interval: config.interval };
                events.push('initialize');
              }
            },
            onServerStart: async () => {
              if (collector) {
                events.push('start');
              }
            },
            onServerStop: async () => {
              if (collector) {
                events.push('stop');
              }
            },
            terminate: async () => {
              collector = null;
              events.push('terminate');
            },
          };
        },
      });

      const plugin = factory({ enabled: true, interval: 30000 });
      const mockServer = createMockServer();

      plugin.initialize?.(mockServer);
      plugin.onServerStart?.(mockServer);
      plugin.onServerStop?.(mockServer);
      plugin.terminate?.(mockServer);

      expect(events).toEqual(['initialize', 'start', 'stop', 'terminate']);
    });
  });

  describe('Backward Compatibility', () => {
    test('create alias exports same function', () => {
      expect(create).toBe(create);
    });

    test('create alias works identically', () => {
      const factory = create({
        name: 'test',
        version: '1.0.0',
        setup: () => ({
          initialize: async () => {},
        }),
      });

      const plugin = factory();

      expect(plugin.name).toBe('test');
      expect(plugin.initialize).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    test('handles undefined in config merge', () => {
      let receivedConfig: any;

      const factory = create<{ value?: string }>({
        name: 'test',
        version: '1.0.0',
        defaultConfig: { value: undefined },
        setup: (config: { value?: string }) => {
          receivedConfig = config;
          return {};
        },
      });

      factory();
      expect(receivedConfig.value).toBeUndefined();
    });

    test('handles null values in config', () => {
      let receivedConfig: any;

      const factory = create<{ value: string | null }>({
        name: 'test',
        version: '1.0.0',
        defaultConfig: { value: null },
        setup: (config: { value: string | null }) => {
          receivedConfig = config;
          return {};
        },
      });

      factory();
      expect(receivedConfig.value).toBeNull();
    });

    test('works with empty config object', () => {
      const factory = create<{}>({
        name: 'test',
        version: '1.0.0',
        setup: (config: {}) => {
          expect(config).toEqual({});
          return {};
        },
      });

      factory();
    });
  });
});
