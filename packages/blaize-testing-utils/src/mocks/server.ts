import EventEmitter from 'node:events';

import { createMockPluginLifecycleManager, createMockPlugins } from './plugins';
import { createMockRouter } from './router';
import { Plugin, PluginLifecycleManager, Server } from '../../../blaize-types/src/index';

/**
 * Create a mock server instance for testing
 */
export function createMockServer(
  overrides: Partial<Server> = {},
  pluginManagerOverrides: Partial<PluginLifecycleManager> = {}
): Server {
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
    listen: vi.fn().mockResolvedValue({} as Server),
    close: vi.fn().mockResolvedValue(undefined),
    use: vi.fn().mockReturnThis(),
    register: vi.fn().mockResolvedValue({} as Server),
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
  };
}

/**
 * Create a mock server with plugins for testing
 */
export function createMockServerWithPlugins(
  pluginCount: number = 2,
  serverOverrides: Partial<Server> = {},
  pluginOverrides: Partial<Plugin> = {},
  pluginManagerOverrides: Partial<PluginLifecycleManager> = {}
): { server: Server; plugins: Plugin[] } {
  const plugins = createMockPlugins(pluginCount, pluginOverrides);

  const pluginManager = createMockPluginLifecycleManager(pluginManagerOverrides);
  const server = createMockServer({
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
 * Reset all mocks in a server instance
 */
export function resetServerMocks(server: Server): void {
  // Reset plugin mocks
  server.plugins.forEach(plugin => {
    if (vi.isMockFunction(plugin.register)) plugin.register.mockReset();
    if (vi.isMockFunction(plugin.initialize)) plugin.initialize.mockReset();
    if (vi.isMockFunction(plugin.terminate)) plugin.terminate.mockReset();
    if (vi.isMockFunction(plugin.onServerStart)) plugin.onServerStart.mockReset();
    if (vi.isMockFunction(plugin.onServerStop)) plugin.onServerStop.mockReset();
  });

  // Reset server method mocks
  if (vi.isMockFunction(server.listen)) server.listen.mockReset();
  if (vi.isMockFunction(server.close)) server.close.mockReset();
  if (vi.isMockFunction(server.use)) server.use.mockReset();
  if (vi.isMockFunction(server.register)) server.register.mockReset();

  // Reset router mocks
  const router = server.router as any;
  if (vi.isMockFunction(router.handleRequest)) router.handleRequest.mockReset();
  if (vi.isMockFunction(router.getRoutes)) router.getRoutes.mockReset();
  if (vi.isMockFunction(router.addRoute)) router.addRoute.mockReset();
  if (vi.isMockFunction(router.addRouteDirectory)) router.addRouteDirectory.mockReset();
  if (vi.isMockFunction(router.getRouteConflicts)) router.getRouteConflicts.mockReset();
}
