/* eslint-disable @typescript-eslint/no-empty-object-type */
import { createMockServer } from '@blaizejs/testing-utils';

import { create } from './create';

import type { Plugin, Services, State } from '@blaize-types/index';

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

  test('throws when setup returns null', async () => {
    const factory = create({
      name: 'test',
      version: '1.0.0',
      setup: () => null as any,
    });

    const plugin = factory();
    const mockServer = createMockServer();

    await expect(plugin.register(mockServer)).rejects.toThrow(
      'Plugin "test" setup() must return an object with lifecycle hooks'
    );
  });

  test('throws when setup returns non-object', async () => {
    const factory = create({
      name: 'test',
      version: '1.0.0',
      setup: () => 'invalid' as any,
    });

    const plugin = factory();
    const mockServer = createMockServer();

    await expect(plugin.register(mockServer)).rejects.toThrow(
      'Plugin "test" setup() must return an object with lifecycle hooks'
    );
  });
});

describe('Config Merging', () => {
  test('uses default config when no user config provided', async () => {
    let receivedConfig: any;

    const factory = create<{ port: number }>({
      name: 'test',
      version: '1.0.0',
      defaultConfig: { port: 3000 },
      setup: ({ config }) => {
        receivedConfig = config;
        return {};
      },
    });

    const plugin = factory();
    await plugin.register(createMockServer());
    expect(receivedConfig.port).toBe(3000);
  });

  test('merges user config with defaults', async () => {
    let receivedConfig: any;

    const factory = create<{ host: string; port: number }>({
      name: 'test',
      version: '1.0.0',
      defaultConfig: { host: 'localhost', port: 3000 },
      setup: ({ config }) => {
        receivedConfig = config;
        return {};
      },
    });

    const plugin = factory({ host: 'prod.com' });
    await plugin.register(createMockServer());
    expect(receivedConfig.host).toBe('prod.com');
    expect(receivedConfig.port).toBe(3000);
  });

  test('user config overrides defaults', async () => {
    let receivedConfig: any;

    const factory = create<{ port: number }>({
      name: 'test',
      version: '1.0.0',
      defaultConfig: { port: 3000 },
      setup: ({ config }) => {
        receivedConfig = config;
        return {};
      },
    });

    const plugin = factory({ port: 8080 });
    await plugin.register(createMockServer());
    expect(receivedConfig.port).toBe(8080);
  });

  test('works without defaultConfig', async () => {
    let receivedConfig: any;

    const factory = create<{ value: string }>({
      name: 'test',
      version: '1.0.0',
      setup: ({ config }) => {
        receivedConfig = config;
        return {};
      },
    });

    const plugin = factory({ value: 'test' });
    await plugin.register(createMockServer());
    expect(receivedConfig.value).toBe('test');
  });

  test('merges nested objects correctly', async () => {
    let receivedConfig: any;

    const factory = create<{ db: { host: string; port: number } }>({
      name: 'test',
      version: '1.0.0',
      defaultConfig: {
        db: { host: 'localhost', port: 5432 },
      },
      setup: ({ config }) => {
        receivedConfig = config;
        return {};
      },
    });

    const plugin = factory({ db: { host: 'prod.db.com', port: 5432 } });
    await plugin.register(createMockServer());
    expect(receivedConfig.db.host).toBe('prod.db.com');
    expect(receivedConfig.db.port).toBe(5432);
  });
});

describe('Hook Registration', () => {
  test('delegates to all provided hooks', async () => {
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

    const plugin = factory({});
    const mockServer = createMockServer();

    // Trigger setup and call hooks
    await plugin.register(mockServer);
    await plugin.initialize?.(mockServer);
    await plugin.onServerStart?.({} as any);
    await plugin.onServerStop?.({} as any);
    await plugin.terminate?.(mockServer);

    // Verify delegation happened
    expect(register).toHaveBeenCalledWith(mockServer);
    expect(initialize).toHaveBeenCalledWith(mockServer);
    expect(onServerStart).toHaveBeenCalled();
    expect(onServerStop).toHaveBeenCalled();
    expect(terminate).toHaveBeenCalled();
  });

  test('register hook always exists', () => {
    const factory = create({
      name: 'test',
      version: '1.0.0',
      setup: () => ({
        initialize: async () => {},
      }),
    });

    const plugin = factory({});

    expect(typeof plugin.register).toBe('function');
    expect(plugin.register).toBeDefined();
  });

  test('default register is async function', async () => {
    const factory = create({
      name: 'test',
      version: '1.0.0',
      setup: () => ({}),
    });

    const plugin = factory({});
    const mockServer = createMockServer();
    const result = plugin.register(mockServer);

    expect(result).toBeInstanceOf(Promise);
    await result; // Should not throw
  });

  test('all lifecycle hooks are present', () => {
    const factory = create({
      name: 'test',
      version: '1.0.0',
      setup: () => ({
        initialize: async () => {},
      }),
    });

    const plugin = factory({});

    // All hooks exist as wrapper functions
    expect(plugin.register).toBeDefined();
    expect(plugin.initialize).toBeDefined();
    expect(plugin.onServerStart).toBeDefined();
    expect(plugin.onServerStop).toBeDefined();
    expect(plugin.terminate).toBeDefined();
  });

  test('hooks delegate correctly when not provided by setup', async () => {
    const factory = create({
      name: 'test',
      version: '1.0.0',
      setup: () => ({}),
    });

    const plugin = factory({});
    const mockServer = createMockServer();

    await plugin.register(mockServer); // Setup runs

    // These should not throw even though setup didn't return them
    await expect(plugin.initialize?.(mockServer)).resolves.toBeUndefined();
    await expect(plugin.onServerStart?.({} as any)).resolves.toBeUndefined();
    await expect(plugin.onServerStop?.({} as any)).resolves.toBeUndefined();
    await expect(plugin.terminate?.(mockServer)).resolves.toBeUndefined();
  });

  test('setup-returned hooks are called', async () => {
    const initFn = vi.fn();

    const factory = create({
      name: 'test',
      version: '1.0.0',
      setup: () => ({
        initialize: initFn,
      }),
    });

    const plugin = factory();
    await plugin.register(createMockServer());
    await plugin.initialize?.(createMockServer());

    expect(initFn).toHaveBeenCalled();
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
    interface MyState extends State {
      user: string;
    }
    interface MyServices extends Services {
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

  test('config type flows correctly', async () => {
    interface TestConfig {
      port: number;
      host: string;
    }

    let configType: TestConfig | undefined;

    const factory = create<TestConfig>({
      name: 'test',
      version: '1.0.0',
      setup: ({ config }) => {
        // Type check: config should be TestConfig
        configType = config;
        const _portType: number = config.port;
        const _hostType: string = config.host;
        return {};
      },
    });

    const p = factory({ port: 3000, host: 'localhost' });
    await p.register(createMockServer());
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

  test('setup is called for each factory invocation', async () => {
    const setupFn = vi.fn(() => ({}));
    const mockServer = createMockServer();

    const factory = create({
      name: 'test',
      version: '1.0.0',
      setup: setupFn,
    });

    const p = factory();
    const p1 = factory();
    const p2 = factory();
    await p.register(mockServer);
    await p1.register(mockServer);
    await p2.register(mockServer);

    expect(setupFn).toHaveBeenCalledTimes(3);
  });

  test('different configs create different plugin instances', async () => {
    let config1: any;
    let config2: any;
    const mockServer = createMockServer();

    const factory = create<{ value: number }>({
      name: 'test',
      version: '1.0.0',
      setup: ({ config }) => {
        if (config.value === 1) config1 = config;
        if (config.value === 2) config2 = config;
        return {};
      },
    });

    const p1 = factory({ value: 1 });
    const p2 = factory({ value: 2 });
    await p1.register(mockServer);
    await p2.register(mockServer);

    expect(config1.value).toBe(1);
    expect(config2.value).toBe(2);
  });
});

describe('Real-World Plugin Patterns', () => {
  test('database plugin with closure', async () => {
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
      setup: ({ config }) => {
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
    await plugin.register!(mockServer);
    await plugin.initialize!(mockServer);

    expect(dbInstance).toBeDefined();
    expect(dbInstance.url).toBe('postgresql://prod/db');
  });

  test('metrics plugin with lifecycle', async () => {
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
      setup: ({ config }: { config: MetricsConfig }) => {
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

    await plugin.register?.(mockServer);
    await plugin.initialize!(mockServer);
    await plugin.onServerStart?.(mockServer.server!);
    await plugin.onServerStop?.(mockServer.server!);
    await plugin.terminate?.(mockServer);

    expect(events).toEqual(['initialize', 'start', 'stop', 'terminate']);
  });
});

describe('Edge Cases', () => {
  test('handles undefined in config merge', () => {
    let receivedConfig: any;

    const factory = create<{ value?: string }>({
      name: 'test',
      version: '1.0.0',
      defaultConfig: { value: undefined },
      setup: ({ config }: { config: { value?: string } }) => {
        receivedConfig = config;
        return {};
      },
    });

    const p = factory();
    p.register(createMockServer());
    expect(receivedConfig.value).toBeUndefined();
  });

  test('handles null values in config', () => {
    let receivedConfig: any;
    const mockServer = createMockServer();

    const factory = create<{ value: string | null }>({
      name: 'test',
      version: '1.0.0',
      defaultConfig: { value: null },
      setup: ({ config }) => {
        receivedConfig = config;
        return {};
      },
    });

    const p = factory();
    p.register(mockServer);
    expect(receivedConfig.value).toBeNull();
  });

  test('works with empty config object', () => {
    const factory = create<{}>({
      name: 'test',
      version: '1.0.0',
      setup: ({ config }) => {
        expect(config).toEqual({});
        return {};
      },
    });

    const p = factory();
    p.register(createMockServer());
  });
});
