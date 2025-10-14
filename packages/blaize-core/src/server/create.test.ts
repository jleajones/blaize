/* eslint-disable @typescript-eslint/no-empty-object-type */
import { AsyncLocalStorage } from 'node:async_hooks';
import EventEmitter from 'node:events';

import { createMockMiddleware } from '@blaizejs/testing-utils';

import { create, DEFAULT_OPTIONS } from './create';
import * as startModule from './start';
import * as stopModule from './stop';
import * as validationModule from './validation';

import type {
  Server,
  ServerOptionsInput,
  Plugin,
  Middleware,
  UnknownServer,
} from '@blaize-types/index';

// Mock middleware with specific type contributions
const authMiddleware: Middleware<
  { user: { id: string; email: string } },
  { auth: { verify: (token: string) => boolean } }
> = {
  name: 'auth',
  execute: async (ctx, next) => {
    ctx.state.user = { id: '123', email: 'test@example.com' };
    (ctx.services as any).auth = {
      verify: (token: string) => token === 'valid',
    };
    await next();
  },
};

const loggerMiddleware: Middleware<
  { requestId: string },
  { logger: { log: (msg: string) => void } }
> = {
  name: 'logger',
  execute: async (ctx, next) => {
    ctx.state.requestId = `req_${Date.now()}`;
    (ctx.services as any).logger = {
      log: console.log,
    };
    await next();
  },
};

const cacheMiddleware: Middleware<
  { cacheKey: string },
  { cache: { get: (key: string) => any; set: (key: string, value: any) => void } }
> = {
  name: 'cache',
  execute: async (ctx, next) => {
    ctx.state.cacheKey = 'cache_key';
    (ctx.services as any).cache = {
      get: vi.fn(),
      set: vi.fn(),
    };
    await next();
  },
};

// Mock plugins with type contributions
const databasePlugin: Plugin<{}, { db: { query: (sql: string) => Promise<any[]> } }> = {
  name: 'database',
  version: '1.0.0',
  register: async _server => {},
};

const metricsPlugin: Plugin<
  { metricsEnabled: boolean },
  { metrics: { track: (event: string) => void } }
> = {
  name: 'metrics',
  version: '1.0.0',
  register: async _server => {},
};

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

  describe('basic use case', () => {
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
  });

  describe('server.listen', () => {
    let server: UnknownServer;

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
    let server: UnknownServer;

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

  describe('initial middleware and plugins', () => {
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

  describe('createServer Type Accumulation', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    describe('Initial Middleware and Plugin Types', () => {
      it('should infer types from initial middleware array', () => {
        const server = create({
          middleware: [authMiddleware, loggerMiddleware] as const,
        });

        // Type test: server should have composed types
        type ServerState = typeof server extends Server<infer S, any> ? S : never;
        type ServerServices = typeof server extends Server<any, infer Svc> ? Svc : never;

        // These should compile without errors
        const _testState: ServerState = {
          user: { id: '1', email: 'test@test.com' },
          requestId: 'req_123',
        };

        const _testServices: ServerServices = {
          auth: { verify: (_t: string) => true },
          logger: { log: (_m: string) => {} },
        };

        expect(server).toBeDefined();
        expect(server.middleware).toHaveLength(2);
      });

      it('should infer types from initial plugins array', () => {
        const server = create({
          plugins: [databasePlugin, metricsPlugin] as const,
        });

        // Type test: server should have plugin types
        type ServerState = typeof server extends Server<infer S, any> ? S : never;
        type ServerServices = typeof server extends Server<any, infer Svc> ? Svc : never;

        // These should compile
        const _testState: ServerState = {
          metricsEnabled: true,
        };

        const _testServices: ServerServices = {
          db: { query: async (_sql: string) => [] },
          metrics: { track: (_e: string) => {} },
        };

        expect(server).toBeDefined();
        expect(server.plugins).toHaveLength(2);
      });

      it('should compose both middleware and plugin types from options', () => {
        const server = create({
          middleware: [authMiddleware, loggerMiddleware] as const,
          plugins: [databasePlugin, metricsPlugin] as const,
        });

        // Combined types from both middleware and plugins
        type ServerState = typeof server extends Server<infer S, any> ? S : never;
        type ServerServices = typeof server extends Server<any, infer Svc> ? Svc : never;

        // Should have all state properties
        const _testState: ServerState = {
          user: { id: '1', email: 'test@test.com' },
          requestId: 'req_123',
          metricsEnabled: true,
        };

        // Should have all services
        const _testServices: ServerServices = {
          auth: { verify: (_t: string) => true },
          logger: { log: (_m: string) => {} },
          db: { query: async (_sql: string) => [] },
          metrics: { track: (_e: string) => {} },
        };

        expect(server).toBeDefined();
        expect(server.middleware).toHaveLength(2);
        expect(server.plugins).toHaveLength(2);
      });
    });

    describe('Method Chaining with Type Accumulation', () => {
      it('should accumulate types through use() with single middleware', () => {
        const server = create();
        const serverWithAuth = server.use(authMiddleware);
        const serverWithAll = serverWithAuth.use(loggerMiddleware);

        // Each call should accumulate types
        type AuthState = typeof serverWithAuth extends Server<infer S, any> ? S : never;
        type AllState = typeof serverWithAll extends Server<infer S, any> ? S : never;

        // serverWithAuth should only have auth types
        const _authState: AuthState = {
          user: { id: '1', email: 'test@test.com' },
        };

        // serverWithAll should have both
        const _allState: AllState = {
          user: { id: '1', email: 'test@test.com' },
          requestId: 'req_123',
        };

        expect(serverWithAll.middleware).toHaveLength(2);
      });

      it('should accumulate types through use() with middleware array', () => {
        const server = create();
        const serverWithMiddleware = server.use([
          authMiddleware,
          loggerMiddleware,
          cacheMiddleware,
        ] as const);

        // Should compose ALL types from the array
        type ServerState = typeof serverWithMiddleware extends Server<infer S, any> ? S : never;
        type ServerServices =
          typeof serverWithMiddleware extends Server<any, infer Svc> ? Svc : never;

        const _testState: ServerState = {
          user: { id: '1', email: 'test@test.com' },
          requestId: 'req_123',
          cacheKey: 'key',
        };

        const _testServices: ServerServices = {
          auth: { verify: (_t: string) => true },
          logger: { log: (_m: string) => {} },
          cache: { get: (_k: string) => null, set: (_k: string, _v: any) => {} },
        };

        expect(serverWithMiddleware.middleware).toHaveLength(3);
      });

      it('should handle mixed single and array middleware', () => {
        const server = create();
        const enhanced = server
          .use(authMiddleware)
          .use([loggerMiddleware, cacheMiddleware] as const);

        type ServerState = typeof enhanced extends Server<infer S, any> ? S : never;

        // Should have all state from both calls
        const _testState: ServerState = {
          user: { id: '1', email: 'test@test.com' },
          requestId: 'req_123',
          cacheKey: 'key',
        };

        expect(enhanced.middleware).toHaveLength(3);
      });

      it('should accumulate types through register() with plugins', async () => {
        const server = create();
        const serverWithDb = await server.register(databasePlugin);
        const serverWithAll = await serverWithDb.register(metricsPlugin);

        type DbServices = typeof serverWithDb extends Server<any, infer Svc> ? Svc : never;
        type AllServices = typeof serverWithAll extends Server<any, infer Svc> ? Svc : never;

        const _dbServices: DbServices = {
          db: { query: async (_sql: string) => [] },
        };

        const _allServices: AllServices = {
          db: { query: async (_sql: string) => [] },
          metrics: { track: (_e: string) => {} },
        };

        expect(serverWithAll.plugins).toHaveLength(2);
      });

      it('should handle plugin arrays', async () => {
        const server = create();
        const serverWithPlugins = await server.register([databasePlugin, metricsPlugin] as const);

        type ServerState = typeof serverWithPlugins extends Server<infer S, any> ? S : never;
        type ServerServices = typeof serverWithPlugins extends Server<any, infer Svc> ? Svc : never;

        const _testState: ServerState = {
          metricsEnabled: true,
        };

        const _testServices: ServerServices = {
          db: { query: async (_sql: string) => [] },
          metrics: { track: (_e: string) => {} },
        };

        expect(serverWithPlugins.plugins).toHaveLength(2);
      });
    });

    describe('Reassignment Pattern', () => {
      it('should preserve types with reassignment pattern', async () => {
        // This is the critical pattern users will use
        let server = create();

        // Reassign to preserve types
        server = server.use(authMiddleware);

        // Types should be preserved after reassignment
        type State1 = typeof server extends Server<infer S, any> ? S : never;
        const _state1: State1 = {
          user: { id: '1', email: 'test@test.com' },
        };

        // Continue reassigning with arrays
        server = server.use([loggerMiddleware, cacheMiddleware] as const);

        // All types should accumulate
        type State2 = typeof server extends Server<infer S, any> ? S : never;
        const _state2: State2 = {
          user: { id: '1', email: 'test@test.com' },
          requestId: 'req_123',
          cacheKey: 'key',
        };

        // Plugins too
        server = await server.register(databasePlugin);

        type Services = typeof server extends Server<any, infer Svc> ? Svc : never;
        const _services: Services = {
          auth: { verify: (_t: string) => true },
          logger: { log: (_m: string) => {} },
          cache: { get: (_k: string) => null, set: (_k: string, _v: any) => {} },
          db: { query: async (_sql: string) => [] },
        };

        expect(server.middleware).toHaveLength(3);
        expect(server.plugins).toHaveLength(1);
      });

      it('should work with conditional middleware', () => {
        let server = create();
        const isDevelopment = true;
        const isProduction = false;

        // Always add auth
        server = server.use(authMiddleware);

        // Conditionally add middleware
        if (isDevelopment) {
          server = server.use(loggerMiddleware);
        }

        if (isProduction) {
          server = server.use(cacheMiddleware);
        }

        // Types reflect actual middleware added
        type ServerState = typeof server extends Server<infer S, any> ? S : never;

        // In this case, should have auth and logger but not cache
        const _testState: ServerState = {
          user: { id: '1', email: 'test@test.com' },
          requestId: 'req_123',
          // cacheKey would be an error here since cache wasn't added
        };

        expect(server.middleware).toHaveLength(2);
      });
    });

    describe('listen() and close() preserve types', () => {
      it('should preserve types through listen()', async () => {
        const server = create({
          middleware: [authMiddleware] as const,
        });

        // Mock the actual listen implementation
        server.listen = vi.fn().mockResolvedValue(server);

        const _listeningServer = await server.listen(3000, 'localhost');

        // Types should be preserved
        type State = typeof _listeningServer extends Server<infer S, any> ? S : never;
        const _state: State = {
          user: { id: '1', email: 'test@test.com' },
        };

        expect(server.listen).toHaveBeenCalledWith(3000, 'localhost');
      });

      it('should handle close() without losing types', async () => {
        let server = create();
        server = server.use(authMiddleware);

        // Mock the close implementation
        server.close = vi.fn().mockResolvedValue(undefined);

        await server.close();

        // Server still has its types even after close
        type State = typeof server extends Server<infer S, any> ? S : never;
        const _state: State = {
          user: { id: '1', email: 'test@test.com' },
        };

        expect(server.close).toHaveBeenCalled();
      });
    });

    describe('Empty and untyped middleware', () => {
      it('should handle empty middleware arrays', () => {
        const server = create({
          middleware: [] as const,
        });

        type State = typeof server extends Server<infer S, any> ? S : never;
        type Services = typeof server extends Server<any, infer Svc> ? Svc : never;

        // Should be empty objects
        const _state: State = {};
        const _services: Services = {};

        expect(server.middleware).toHaveLength(0);
      });

      it('should handle untyped middleware for backward compatibility', () => {
        const untypedMiddleware: Middleware = {
          name: 'untyped',
          execute: async (_ctx, next) => {
            await next();
          },
        };

        const server = create();
        const serverWithUntyped = server.use(untypedMiddleware);

        // Untyped middleware contributes empty types
        type State = typeof serverWithUntyped extends Server<infer S, any> ? S : never;
        const _state: State = {};

        expect(serverWithUntyped.middleware).toHaveLength(1);
      });
    });
  });

  describe('CORS options storage', () => {
    test('should store cors options when provided', () => {
      const server = create({
        cors: { origin: 'https://example.com', credentials: true },
      });

      expect(server.corsOptions).toEqual({
        origin: 'https://example.com',
        credentials: true,
      });
    });

    test('should store false when cors is explicitly false', () => {
      const server = create({ cors: false });
      expect(server.corsOptions).toBe(false);
    });

    test('should store undefined when cors is not provided', () => {
      const server = create({});
      expect(server.corsOptions).toBeUndefined();
    });
  });
});
