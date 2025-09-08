/* eslint-disable @typescript-eslint/no-empty-object-type */
import EventEmitter from 'node:events';

import { createMockPluginLifecycleManager, createMockPlugins } from './plugins';
import { createMockRouter } from './router';
import { Plugin, PluginLifecycleManager, Server } from '../../../blaize-types/src/index';

/**
 * Create a mock server instance for testing
 */
export function createMockServer<TState, TServices>(
  overrides: Partial<Server<TState, TServices>> = {},
  pluginManagerOverrides: Partial<PluginLifecycleManager> = {}
): Server<TState, TServices> {
  const mockRouter = createMockRouter();
  const mockPluginManager = createMockPluginLifecycleManager(pluginManagerOverrides);

  return {
    server: undefined,
    port: 3000,
    host: 'localhost',
    events: new EventEmitter(),
    plugins: [],
    middleware: [],
    _signalHandlers: { unregister: vi.fn() },
    listen: vi.fn().mockResolvedValue({} as Server<TState, TServices>),
    close: vi.fn().mockResolvedValue(undefined),
    use: vi.fn().mockReturnThis(),
    register: vi.fn().mockResolvedValue({} as Server<TState, TServices>),
    router: mockRouter,
    pluginManager: mockPluginManager,
    context: {
      getStore: vi.fn(),
      run: vi.fn(),
      enterWith: vi.fn(),
      disable: vi.fn(),
      exit: vi.fn(),
    } as any,
    ...overrides,
  } as Server<TState, TServices>;
}

/**
 * Create a mock server with plugins for testing
 */
export function createMockServerWithPlugins<TState, TServices>(
  pluginCount: number = 2,
  serverOverrides: Partial<Server<TState, TServices>> = {},
  pluginOverrides: Partial<Plugin> = {},
  pluginManagerOverrides: Partial<PluginLifecycleManager> = {}
): { server: Server<TState, TServices>; plugins: Plugin[] } {
  const plugins = createMockPlugins(pluginCount, pluginOverrides);

  const pluginManager = createMockPluginLifecycleManager(pluginManagerOverrides);
  const server = createMockServer<TState, TServices>({
    plugins,
    pluginManager,
    ...serverOverrides,
  });

  return { server, plugins };
}

/**
 * Create a mock HTTP server for testing
 */
export function createMockHttpServer(overrides: any = {}) {
  return {
    close: vi.fn().mockImplementation(callback => {
      if (callback) callback();
    }),
    listen: vi.fn(),
    address: vi.fn().mockReturnValue({ port: 3000, address: 'localhost' }),
    on: vi.fn(),
    removeListener: vi.fn(),
    addListener: vi.fn(),
    emit: vi.fn(),
    once: vi.fn(),
    ...overrides,
  } as any;
}

/**
 * Test server lifecycle (listen -> close) with automatic cleanup
 * This eliminates the repetitive beforeEach/afterEach pattern in server tests
 */
export async function testServerLifecycle<TState = {}, TServices = {}>(
  server: Server<TState, TServices>,
  testFn: (server: Server<TState, TServices>) => Promise<void> | void
): Promise<void> {
  try {
    await server.listen();
    await testFn(server);
  } finally {
    await server.close();
  }
}

/**
 * Create a spy for server events that's easy to test
 * This eliminates repetitive event spying setup
 */
export function spyOnServerEvents<TState = {}, TServices = {}>(server: Server<TState, TServices>) {
  const eventSpy = vi.spyOn(server.events, 'emit');

  return {
    expectEvent: (eventName: string) => {
      expect(eventSpy).toHaveBeenCalledWith(eventName);
    },
    expectNoEvents: () => {
      expect(eventSpy).not.toHaveBeenCalled();
    },
    reset: () => eventSpy.mockClear(),
  };
}

/**
 * Reset all mocks in a server instance
 */
export function resetServerMocks<TState = {}, TServices = {}>(
  server: Server<TState, TServices>
): void {
  // Reset plugin mocks
  server.plugins.forEach(plugin => {
    if (vi.isMockFunction(plugin.register)) vi.mocked(plugin.register).mockClear();
    if (vi.isMockFunction(plugin.initialize)) vi.mocked(plugin.initialize).mockClear();
    if (vi.isMockFunction(plugin.terminate)) vi.mocked(plugin.terminate).mockClear();
    if (vi.isMockFunction(plugin.onServerStart)) vi.mocked(plugin.onServerStart).mockClear();
    if (vi.isMockFunction(plugin.onServerStop)) vi.mocked(plugin.onServerStop).mockClear();
  });

  // Reset middleware mocks
  server.middleware.forEach(middleware => {
    if (vi.isMockFunction(middleware.execute)) {
      vi.mocked(middleware.execute).mockClear();
    }
  });

  // Reset server method mocks
  if (vi.isMockFunction(server.listen)) vi.mocked(server.listen).mockClear();
  if (vi.isMockFunction(server.close)) vi.mocked(server.close).mockClear();
  if (vi.isMockFunction(server.use)) vi.mocked(server.use).mockClear();
  if (vi.isMockFunction(server.register)) vi.mocked(server.register).mockClear();

  // Reset router mocks
  const router = server.router as any;
  if (vi.isMockFunction(router.handleRequest)) vi.mocked(router.handleRequest).mockClear();
  if (vi.isMockFunction(router.getRoutes)) vi.mocked(router.getRoutes).mockClear();
  if (vi.isMockFunction(router.addRoute)) vi.mocked(router.addRoute).mockClear();
  if (vi.isMockFunction(router.addRouteDirectory)) vi.mocked(router.addRouteDirectory).mockClear();
  if (vi.isMockFunction(router.getRouteConflicts)) vi.mocked(router.getRouteConflicts).mockClear();
}
