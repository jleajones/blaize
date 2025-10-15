/* eslint-disable @typescript-eslint/no-empty-object-type */
import { create } from './create';

import type { Plugin } from '@blaize-types/plugins';
import type { UnknownServer } from '@blaize-types/server';

describe('Plugin Creation', () => {
  // Mock server object for testing
  const mockServer: UnknownServer = {
    // Add minimal required properties for testing
    use: vi.fn(),
    register: vi.fn(),
    listen: vi.fn(),
    close: vi.fn(),
  } as any;

  const TEST_PLUGIN_NAME = 'test-plugin';

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

    test('handles setup function that returns partial hooks', async () => {
      // Don't include 'register' - our factory provides that
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

      // Should not throw
      await expect(plugin.register(mockServer)).resolves.toBeUndefined();
    });

    test('works with empty default options', () => {
      const factory = create(TEST_PLUGIN_NAME, '1.0.0', () => {});
      const plugin = factory({ custom: 'value' });

      expect(plugin.name).toBe(TEST_PLUGIN_NAME);
    });
  });

  describe('Type preservation with generics', () => {
    test('creates plugin with state and services types', () => {
      interface TestState {
        pluginEnabled: boolean;
        startTime: number;
      }

      interface TestServices {
        testService: {
          doSomething: () => void;
        };
      }

      const factory = create<any, TestState, TestServices>(TEST_PLUGIN_NAME, '1.0.0', () => {});
      const plugin = factory();

      expect(plugin.name).toBe(TEST_PLUGIN_NAME);
      expect(plugin.version).toBe('1.0.0');

      // Type test - would fail compilation if types aren't preserved
      const _typeTest: Plugin<TestState, TestServices> = plugin;
    });

    test('creates plugin with only state type', () => {
      interface AuthState {
        user: { id: string; name: string };
      }

      const factory = create<any, AuthState>(TEST_PLUGIN_NAME, '1.0.0', () => {});
      const plugin = factory();

      // Type test - services should default to {}
      const _typeTest: Plugin<AuthState, {}> = plugin;
      expect(plugin.name).toBe(TEST_PLUGIN_NAME);
    });

    test('creates plugin with only services type', () => {
      interface DatabaseServices {
        db: { query: (sql: string) => Promise<any> };
      }

      const factory = create<any, {}, DatabaseServices>(TEST_PLUGIN_NAME, '1.0.0', () => {});
      const plugin = factory();

      // Type test - state should default to {}
      const _typeTest: Plugin<{}, DatabaseServices> = plugin;
      expect(plugin.name).toBe(TEST_PLUGIN_NAME);
    });

    test('creates plugin with complex nested types', () => {
      interface ComplexState {
        auth: {
          user: {
            id: string;
            profile: {
              name: string;
              email: string;
            };
          };
          session: {
            token: string;
            expiresAt: Date;
          };
        };
      }

      interface ComplexServices {
        db: {
          users: { findById: (id: string) => Promise<any> };
          posts: { findAll: () => Promise<any[]> };
        };
        cache: {
          get: (key: string) => any;
          set: (key: string, value: any) => void;
        };
      }

      const factory = create<any, ComplexState, ComplexServices>(
        TEST_PLUGIN_NAME,
        '1.0.0',
        () => {}
      );
      const plugin = factory();

      expect(plugin.name).toBe(TEST_PLUGIN_NAME);
      // Type carriers are compile-time only
      expect('_state' in plugin).toBe(false);
      expect('_services' in plugin).toBe(false);
    });

    test('factory function preserves types through options', async () => {
      interface PluginConfig {
        enabled?: boolean;
        timeout?: number;
      }

      interface PluginState {
        initialized: boolean;
      }

      interface PluginServices {
        manager: { status: () => string };
      }

      const setupSpy = vi.fn();
      const factory = create<PluginConfig, PluginState, PluginServices>(
        TEST_PLUGIN_NAME,
        '1.0.0',
        setupSpy,
        { enabled: true, timeout: 5000 }
      );

      const plugin = factory({ timeout: 10000 });

      await plugin.register(mockServer);

      expect(setupSpy).toHaveBeenCalledWith(mockServer, {
        enabled: true,
        timeout: 10000,
      });

      // Type test
      const _typeTest: Plugin<PluginState, PluginServices> = plugin;
    });

    test('works with empty object types (defaults)', () => {
      const factory = create<any>(TEST_PLUGIN_NAME, '1.0.0', () => {});
      const plugin = factory();

      // Should default to Plugin<{}, {}>
      const _typeTest: Plugin<{}, {}> = plugin;
      expect(plugin.name).toBe(TEST_PLUGIN_NAME);
    });
  });

  describe('Plugin composition compatibility', () => {
    test('plugins with different types can be used together', () => {
      interface AuthState {
        user: string;
      }
      interface AuthServices {
        auth: any;
      }

      interface DbState {
        connected: boolean;
      }
      interface DbServices {
        db: any;
      }

      const authPlugin = create<any, AuthState, AuthServices>('auth', '1.0.0', () => {})();
      const dbPlugin = create<any, DbState, DbServices>('database', '1.0.0', () => {})();

      // Array of plugins should be valid
      const pluginStack: Plugin[] = [authPlugin, dbPlugin];

      expect(pluginStack).toHaveLength(2);
      expect(pluginStack[0]).toBe(authPlugin);
      expect(pluginStack[1]).toBe(dbPlugin);
    });

    test('plugin types are preserved in array', () => {
      interface MetricsState {
        metricsEnabled: boolean;
      }
      interface MetricsServices {
        metrics: any;
      }

      const plugin = create<any, MetricsState, MetricsServices>('metrics', '1.0.0', () => {})();

      // Should be assignable to both typed and untyped arrays
      const typedArray: Plugin<MetricsState, MetricsServices>[] = [plugin];
      const untypedArray: Plugin[] = [plugin];

      expect(typedArray[0]).toBe(plugin);
      expect(untypedArray[0]).toBe(plugin);
    });
  });

  describe('Backwards compatibility', () => {
    test('old single-generic syntax still works', () => {
      interface OldConfig {
        setting: string;
      }

      // Old way - just config generic
      const factory = create<OldConfig>(TEST_PLUGIN_NAME, '1.0.0', () => {}, {
        setting: 'default',
      });
      const plugin = factory({ setting: 'custom' });

      expect(plugin.name).toBe(TEST_PLUGIN_NAME);
      // State and services default to {}
      const _typeTest: Plugin<{}, {}> = plugin;
    });

    test('no generics still works', () => {
      const factory = create(TEST_PLUGIN_NAME, '1.0.0', () => {});
      const plugin = factory();

      expect(plugin.name).toBe(TEST_PLUGIN_NAME);
      expect(plugin.version).toBe('1.0.0');
    });
  });
});
