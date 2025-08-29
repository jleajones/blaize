import { Plugin, PluginLifecycleManager } from '../../../blaize-types/src/index';

/**
 * Create a mock plugin for testing
 */
export function createMockPlugin<TServerMods = unknown, TContextMods = unknown>(
  overrides: Partial<Plugin<TServerMods, TContextMods>> = {}
): Plugin<TServerMods, TContextMods> {
  return {
    name: 'test-plugin',
    version: '1.0.0',
    register: vi.fn().mockResolvedValue(undefined),
    initialize: vi.fn().mockResolvedValue(undefined),
    terminate: vi.fn().mockResolvedValue(undefined),
    onServerStart: vi.fn().mockResolvedValue(undefined),
    onServerStop: vi.fn().mockResolvedValue(undefined),
    _types: {
      serverMods: undefined as unknown as TServerMods,
      contextMods: undefined as unknown as TContextMods,
    },
    ...overrides,
  };
}

/**
 * Create multiple mock plugins for testing
 */
export function createMockPlugins<TServerMods = unknown, TContextMods = unknown>(
  count: number,
  baseOverrides: Partial<Plugin<TServerMods, TContextMods>> = {}
): Plugin<TServerMods, TContextMods>[] {
  return Array.from({ length: count }, (_, index) =>
    createMockPlugin<TServerMods, TContextMods>({
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

/**
 * Create a typed mock plugin with specific server modifications
 */
export function createMockServerPlugin<TServerMods>(
  serverMods: TServerMods,
  overrides: Partial<Plugin<TServerMods, unknown>> = {}
): Plugin<TServerMods, unknown> {
  return createMockPlugin<TServerMods, unknown>({
    name: 'mock-server-plugin',
    _types: {
      serverMods,
      contextMods: undefined as unknown,
    },
    ...overrides,
  });
}

/**
 * Create a typed mock plugin with specific context modifications
 */
export function createMockContextPlugin<TContextMods>(
  contextMods: TContextMods,
  overrides: Partial<Plugin<unknown, TContextMods>> = {}
): Plugin<unknown, TContextMods> {
  return createMockPlugin<unknown, TContextMods>({
    name: 'mock-context-plugin',
    _types: {
      serverMods: undefined as unknown,
      contextMods,
    },
    ...overrides,
  });
}

/**
 * Create a mock plugin with both server and context modifications
 */
export function createMockFullPlugin<TServerMods, TContextMods>(
  serverMods: TServerMods,
  contextMods: TContextMods,
  overrides: Partial<Plugin<TServerMods, TContextMods>> = {}
): Plugin<TServerMods, TContextMods> {
  return createMockPlugin<TServerMods, TContextMods>({
    name: 'mock-full-plugin',
    _types: {
      serverMods,
      contextMods,
    },
    ...overrides,
  });
}
