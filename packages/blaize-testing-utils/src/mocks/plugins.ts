import { Plugin, PluginLifecycleManager } from '@blaizejs/types';

/**
 * Create a mock plugin for testing
 */
export function createMockPlugin(overrides: Partial<Plugin> = {}): Plugin {
  return {
    name: 'test-plugin',
    version: '1.0.0',
    register: vi.fn().mockResolvedValue(undefined),
    initialize: vi.fn().mockResolvedValue(undefined),
    terminate: vi.fn().mockResolvedValue(undefined),
    onServerStart: vi.fn().mockResolvedValue(undefined),
    onServerStop: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

/**
 * Create multiple mock plugins for testing
 */
export function createMockPlugins(count: number, baseOverrides: Partial<Plugin> = {}): Plugin[] {
  return Array.from({ length: count }, (_, index) =>
    createMockPlugin({
      name: `test-plugin-${index + 1}`,
      ...baseOverrides,
    })
  );
}

/**
 * Create a mock plugin lifecycle manager for testing
 */
export function createMockPluginLifecycleManager(
  overrides: Partial<PluginLifecycleManager> = {}
): PluginLifecycleManager {
  return {
    initializePlugins: vi.fn().mockResolvedValue(undefined),
    terminatePlugins: vi.fn().mockResolvedValue(undefined),
    onServerStart: vi.fn().mockResolvedValue(undefined),
    onServerStop: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}
