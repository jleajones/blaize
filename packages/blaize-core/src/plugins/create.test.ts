import type { Server } from '@blaizejs/types';

import { create } from './create';

describe('Plugin Creation', () => {
  // Mock server object for testing
  const mockServer: Server = {
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
});
