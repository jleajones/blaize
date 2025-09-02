import { AsyncLocalStorage } from 'node:async_hooks';
import EventEmitter from 'node:events';

import { createMockMiddleware } from '@blaizejs/testing-utils';

import { create, DEFAULT_OPTIONS } from './create';
import * as startModule from './start';
import * as stopModule from './stop';
import * as validationModule from './validation';

import type { Server, ServerOptionsInput } from '@blaize-types/server';

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

// Mock ONLY the correlation module for these tests
vi.mock('../tracing/correlation', () => ({
  _setCorrelationConfig: vi.fn(),
  getCorrelationId: vi.fn(() => 'test-correlation-id'),
}));

// eslint-disable-next-line import/order
import { _setCorrelationConfig } from '../tracing/correlation';

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
    const middleware1 = createMockMiddleware();
    const middleware2 = createMockMiddleware({
      name: 'middleware2',
    });

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
      'Plugin validation error: Plugin must have a name (string)'
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
      const middleware = createMockMiddleware();
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
    const middleware1 = createMockMiddleware();
    const middleware2 = createMockMiddleware({
      name: 'middleware2',
    });
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

  describe('Default Correlation Behavior', () => {
    test('should not call _setCorrelationConfig when no correlation options provided', async () => {
      const server = create();
      await server.listen();

      expect(_setCorrelationConfig).not.toHaveBeenCalled();
    });

    test('should not call _setCorrelationConfig with empty options', async () => {
      const server = create({});
      await server.listen();

      expect(_setCorrelationConfig).not.toHaveBeenCalled();
    });
  });

  describe('Custom Header Configuration', () => {
    test('should configure custom header name only', async () => {
      const server = create({
        correlation: {
          headerName: 'x-request-id',
        },
      });

      await server.listen();

      expect(_setCorrelationConfig).toHaveBeenCalledTimes(1);
      expect(_setCorrelationConfig).toHaveBeenCalledWith('x-request-id', undefined);
    });

    test('should handle different header name formats', async () => {
      const headerNames = [
        'x-trace-id',
        'x-correlation-id',
        'x-request-trace',
        'traceparent', // W3C Trace Context
      ];

      for (const headerName of headerNames) {
        vi.clearAllMocks();

        const server = create({
          correlation: { headerName },
        });

        await server.listen();

        expect(_setCorrelationConfig).toHaveBeenCalledWith(headerName, undefined);
      }
    });
  });

  describe('Custom Generator Configuration', () => {
    test('should configure custom generator only', async () => {
      const customGenerator = () => `custom_${Date.now()}`;

      const server = create({
        correlation: {
          generator: customGenerator,
        },
      });

      await server.listen();

      expect(_setCorrelationConfig).toHaveBeenCalledTimes(1);
      expect(_setCorrelationConfig).toHaveBeenCalledWith(undefined, customGenerator);
    });

    test('should pass generator function reference correctly', async () => {
      const generator1 = () => 'id1';
      const generator2 = () => 'id2';

      const server1 = create({
        correlation: { generator: generator1 },
      });

      const server2 = create({
        correlation: { generator: generator2 },
      });

      await server1.listen();
      expect(_setCorrelationConfig).toHaveBeenLastCalledWith(undefined, generator1);

      vi.clearAllMocks();

      await server2.listen();
      expect(_setCorrelationConfig).toHaveBeenLastCalledWith(undefined, generator2);
    });
  });

  describe('Combined Configuration', () => {
    test('should configure both header name and generator', async () => {
      const customGenerator = () => `trace_${Date.now()}`;

      const server = create({
        correlation: {
          headerName: 'x-trace-id',
          generator: customGenerator,
        },
      });

      await server.listen();

      expect(_setCorrelationConfig).toHaveBeenCalledTimes(1);
      expect(_setCorrelationConfig).toHaveBeenCalledWith('x-trace-id', customGenerator);
    });

    test('should work with full server configuration', async () => {
      const customGenerator = () => `app_${Date.now()}`;

      const options: ServerOptionsInput = {
        port: 8080,
        host: '0.0.0.0',
        routesDir: './api',
        http2: { enabled: false },
        middleware: [],
        plugins: [],
        correlation: {
          headerName: 'x-app-trace',
          generator: customGenerator,
        },
      };

      const server = create(options);
      await server.listen();

      expect(_setCorrelationConfig).toHaveBeenCalledWith('x-app-trace', customGenerator);
    });
  });

  describe('Configuration Timing', () => {
    test('should configure correlation before starting server', async () => {
      const callOrder: string[] = [];

      vi.mocked(_setCorrelationConfig).mockImplementation(() => {
        callOrder.push('correlation');
      });

      vi.mocked(startModule.startServer).mockImplementation(async () => {
        callOrder.push('server-start');
      });

      const server = create({
        correlation: {
          headerName: 'x-timing-test',
        },
      });

      await server.listen();

      // Correlation should be configured BEFORE server starts
      expect(callOrder).toEqual(['correlation', 'server-start']);
    });

    test('should configure correlation before registering signal handlers', async () => {
      const callOrder: string[] = [];

      vi.mocked(_setCorrelationConfig).mockImplementation(() => {
        callOrder.push('correlation');
      });

      vi.mocked(stopModule.registerSignalHandlers).mockImplementation(_stopFn => {
        callOrder.push('signal-handlers');
        return { unregister: vi.fn() };
      });

      const server = create({
        correlation: {
          headerName: 'x-signal-test',
        },
      });

      await server.listen();

      // Correlation should be configured BEFORE signal handlers
      expect(callOrder[0]).toBe('correlation');
      expect(callOrder).toContain('signal-handlers');
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty correlation object', async () => {
      const server = create({
        correlation: {},
      });

      await server.listen();

      // Empty object should still call config with undefined values
      expect(_setCorrelationConfig).toHaveBeenCalledWith(undefined, undefined);
    });

    test('should only configure correlation once per listen', async () => {
      const server = create({
        correlation: {
          headerName: 'x-once-test',
        },
      });

      await server.listen();
      expect(_setCorrelationConfig).toHaveBeenCalledTimes(1);

      // Calling listen again should reconfigure
      // (This is current behavior - could be changed if needed)
      await server.listen(4000);
      expect(_setCorrelationConfig).toHaveBeenCalledTimes(2);
    });

    test('should maintain correlation config after server close', async () => {
      const server = create({
        correlation: {
          headerName: 'x-lifecycle-test',
        },
      });

      await server.listen();
      expect(_setCorrelationConfig).toHaveBeenCalledWith('x-lifecycle-test', undefined);

      await server.close();
      vi.clearAllMocks();

      // Listen again after close
      await server.listen();
      expect(_setCorrelationConfig).toHaveBeenCalledWith('x-lifecycle-test', undefined);
    });
  });
});
