import { AsyncLocalStorage } from 'node:async_hooks';
import EventEmitter from 'node:events';

import { Server, ServerOptionsInput } from '@blaizejs/types';

import { create, DEFAULT_OPTIONS } from './create';
import * as startModule from './start';
import * as stopModule from './stop';
import * as validationModule from './validation';

// Mock the modules we depend on
vi.mock('./start', () => ({
  startServer: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./stop', () => ({
  stopServer: vi.fn().mockResolvedValue(undefined),
  registerSignalHandlers: vi.fn().mockReturnValue({
    unregister: vi.fn(),
  }),
}));

vi.mock('./validation', () => ({
  validateServerOptions: vi.fn(options => options),
}));

describe('create', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  test('should create a server with default options', () => {
    const server = create();

    expect(server).toBeDefined();
    expect(server.port).toBe(DEFAULT_OPTIONS.port);
    expect(server.host).toBe(DEFAULT_OPTIONS.host);
    expect(server.middleware).toEqual([]);
    expect(server.plugins).toEqual([]);
    expect(server.events).toBeInstanceOf(EventEmitter);
    expect(server.context).toBeInstanceOf(AsyncLocalStorage);
    expect(typeof server.listen).toBe('function');
    expect(typeof server.close).toBe('function');
    expect(typeof server.use).toBe('function');
    expect(typeof server.register).toBe('function');
  });

  test('should create a server with custom options', () => {
    const customOptions: ServerOptionsInput = {
      port: 8080,
      host: '0.0.0.0',
      routesDir: './custom-routes',
      http2: {
        enabled: false,
      },
    };

    const server = create(customOptions);

    expect(server.port).toBe(customOptions.port);
    expect(server.host).toBe(customOptions.host);
    expect(validationModule.validateServerOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        port: customOptions.port,
        host: customOptions.host,
        routesDir: customOptions.routesDir,
        http2: customOptions.http2,
      })
    );
  });

  test('should throw error if validation fails', () => {
    vi.mocked(validationModule.validateServerOptions).mockImplementationOnce(() => {
      throw new Error('Validation error');
    });

    expect(() => create()).toThrow('Failed to create server: Validation error');
  });

  test('should add middleware with use method', () => {
    const server = create();
    const middleware1 = vi.fn();
    const middleware2 = vi.fn();

    server.use(middleware1);
    expect(server.middleware).toContain(middleware1);

    server.use([middleware1, middleware2]);
    expect(server.middleware).toEqual([middleware1, middleware1, middleware2]);
  });

  test('should register plugin with register method', async () => {
    const server = create();
    const plugin = {
      register: vi.fn().mockResolvedValue(undefined),
      name: 'test-plugin',
      version: '1.0.0',
    };

    await server.register(plugin);

    expect(server.plugins).toContain(plugin);
    expect(plugin.register).toHaveBeenCalledWith(server);
  });

  test('should throw error when registering invalid plugin', async () => {
    const server = create();
    const invalidPlugin = {} as any;

    await expect(server.register(invalidPlugin)).rejects.toThrow(
      'Invalid plugin. Must be a valid BlaizeJS plugin object with a register method.'
    );
  });

  describe('server.listen', () => {
    let server: Server;

    beforeEach(() => {
      server = create();
    });

    test('should start the server and setup lifecycle', async () => {
      const result = await server.listen();

      expect(startModule.startServer).toHaveBeenCalled();
      expect(stopModule.registerSignalHandlers).toHaveBeenCalled();
      expect(result).toBe(server);
    });

    test('should initialize middleware and plugins', async () => {
      const middleware = vi.fn();
      const plugin = {
        register: vi.fn().mockResolvedValue(undefined),
        name: 'test-plugin',
        version: '1.0.0',
      };

      const customServer = create({
        middleware: [middleware],
        plugins: [plugin],
      });

      await customServer.listen();

      expect(customServer.middleware).toContain(middleware);
      expect(customServer.plugins).toContain(plugin);
      expect(plugin.register).toHaveBeenCalled();
    });

    test('should emit started event', async () => {
      const emitSpy = vi.spyOn(server.events, 'emit');
      await server.listen();
      expect(emitSpy).toHaveBeenCalledWith('started');
    });
  });

  describe('server.close', () => {
    let server: Server;

    beforeEach(async () => {
      server = create();
      server.server = {} as any; // Mock the server existing
      await server.listen();
      vi.mocked(stopModule.stopServer).mockClear();
    });

    test('should call stopServer with correct arguments', async () => {
      const stopOptions = { timeout: 5000 };
      await server.close(stopOptions);

      expect(stopModule.stopServer).toHaveBeenCalledWith(server, stopOptions);
    });

    test('should unregister signal handlers', async () => {
      const unregisterSpy = vi.fn();
      server._signalHandlers = { unregister: unregisterSpy };

      await server.close();

      expect(unregisterSpy).toHaveBeenCalled();
      expect(server._signalHandlers).toBeUndefined();
    });

    test('should do nothing if server is not initialized', async () => {
      const newServer = create();
      newServer.server = undefined;

      await newServer.close();

      expect(stopModule.stopServer).not.toHaveBeenCalled();
    });
  });

  test('should use initial middleware and plugins from options', async () => {
    const middleware1 = vi.fn();
    const middleware2 = vi.fn();
    const plugin1 = {
      name: 'test-plugin-1',
      version: '1.0.0',
      register: vi.fn().mockResolvedValue(undefined),
    };
    const plugin2 = {
      name: 'test-plugin-2',
      version: '1.0.0',
      register: vi.fn().mockResolvedValue(undefined),
    };

    const server = create({
      middleware: [middleware1, middleware2],
      plugins: [plugin1, plugin2],
    });

    await server.listen();

    expect(server.middleware).toContain(middleware1);
    expect(server.middleware).toContain(middleware2);
    expect(server.plugins).toContain(plugin1);
    expect(server.plugins).toContain(plugin2);
    expect(plugin1.register).toHaveBeenCalled();
    expect(plugin2.register).toHaveBeenCalled();
  });

  test('should handle errors in plugin initialization', async () => {
    const plugin = {
      name: 'failing-plugin',
      version: '1.0.0',
      register: vi.fn().mockRejectedValue(new Error('Plugin initialization failed')),
    };

    const server = create({ plugins: [plugin] });

    await expect(server.listen()).rejects.toThrow();
  });
});
