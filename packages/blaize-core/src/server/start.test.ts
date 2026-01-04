import * as fs from 'node:fs';
import * as http from 'node:http';
import * as http2 from 'node:http2';

import { createMockServerWithPlugins } from '@blaizejs/testing-utils';

import { generateDevCertificates } from './dev-certificate';
import { startServer } from './start';

import type { ServerOptions, UnknownServer } from '@blaize-types/server';

// Mock the dependencies
vi.mock('node:fs');
vi.mock('node:http');
vi.mock('node:http2');
vi.mock('./dev-certificate');

describe('Server Module', () => {
  // Setup mocks
  const mockServer = {
    listen: vi.fn((_port, _host, cb) => {
      cb();
      return mockServer;
    }),
    on: vi.fn((_event, _handler) => mockServer),
  };

  const mockHttp2Server = {
    listen: vi.fn((_port, _host, cb) => {
      cb();
      return mockHttp2Server;
    }),
    on: vi.fn((_event, _handler) => mockHttp2Server),
  };

  // Create a mock server instance
  let serverInstance: UnknownServer;
  let serverOptions: ServerOptions;

  beforeEach(() => {
    // Reset mocks
    vi.resetAllMocks();

    // Mock implementation for HTTP server creation
    vi.mocked(http.createServer).mockReturnValue(mockServer as unknown as http.Server);

    // Mock implementation for HTTP2 server creation
    vi.mocked(http2.createSecureServer).mockReturnValue(
      mockHttp2Server as unknown as http2.Http2SecureServer
    );

    // Mock file system readFileSync
    vi.mocked(fs.readFileSync).mockImplementation(path => {
      return Buffer.from(`mock content for ${path}`);
    });

    // Mock certificate generation
    vi.mocked(generateDevCertificates).mockResolvedValue({
      keyFile: '/tmp/dev.key',
      certFile: '/tmp/dev.cert',
    });

    serverInstance = createMockServerWithPlugins(2).server;

    // Default server options
    serverOptions = {
      port: 3000,
      eventSchemas: {},
      host: 'localhost',
      routesDir: './routes',
      middleware: [],
      plugins: [],
      bodyLimits: {
        json: 512 * 1024,
        form: 1024 * 1024,
        text: 5 * 1024 * 1024,
        raw: 10 * 1024 * 1024,
        multipart: {
          maxFileSize: 50 * 1024 * 1024,
          maxTotalSize: 100 * 1024 * 1024,
          maxFiles: 10,
          maxFieldSize: 1024 * 1024,
        },
      },
    };

    // Mock process.env
    vi.stubEnv('NODE_ENV', 'development');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('startServer function', () => {
    it('should do nothing if server is already running', async () => {
      // Setup a server instance that's already running
      serverInstance.server = {} as http.Server;

      await startServer(serverInstance, serverOptions);

      // Verify no server was created
      expect(http.createServer).not.toHaveBeenCalled();
      expect(http2.createSecureServer).not.toHaveBeenCalled();
    });

    it('should create an HTTP server when HTTP/2 is disabled', async () => {
      // Configure server options with HTTP/2 disabled
      const options = {
        ...serverOptions,
        http2: { enabled: false },
      };

      await startServer(serverInstance, options);

      // Verify HTTP server was created
      expect(http.createServer).toHaveBeenCalled();
      expect(http2.createSecureServer).not.toHaveBeenCalled();
      expect(serverInstance.server).toBe(mockServer);
      expect(mockServer.listen).toHaveBeenCalledWith(3000, 'localhost', expect.any(Function));
    });

    it('should create an HTTP/2 server when HTTP/2 is enabled with certificates', async () => {
      // Configure server options with HTTP/2 enabled and certificates
      const options = {
        ...serverOptions,
        http2: {
          enabled: true,
          keyFile: './test.key',
          certFile: './test.cert',
        },
      };

      await startServer(serverInstance, options);

      // Verify HTTP/2 server was created
      expect(http2.createSecureServer).toHaveBeenCalled();
      expect(http.createServer).not.toHaveBeenCalled();
      expect(serverInstance.server).toBe(mockHttp2Server);
      expect(fs.readFileSync).toHaveBeenCalledWith('./test.key');
      expect(fs.readFileSync).toHaveBeenCalledWith('./test.cert');
    });

    it('should generate dev certificates when HTTP/2 is enabled but no certificates provided in dev mode', async () => {
      // Configure server options with HTTP/2 enabled but no certificates
      const options = {
        ...serverOptions,
        http2: {
          enabled: true,
        },
      };

      await startServer(serverInstance, options);

      // Verify certificates were generated
      expect(generateDevCertificates).toHaveBeenCalled();
      expect(http2.createSecureServer).toHaveBeenCalled();
      expect(fs.readFileSync).toHaveBeenCalledWith('/tmp/dev.key');
      expect(fs.readFileSync).toHaveBeenCalledWith('/tmp/dev.cert');
    });

    it('should throw an error when HTTP/2 is enabled with no certificates in production', async () => {
      // Mock production environment
      vi.stubEnv('NODE_ENV', 'production');

      // Configure server options with HTTP/2 enabled but no certificates
      const options = {
        ...serverOptions,
        http2: {
          enabled: true,
        },
      };

      // Expect the function to throw
      await expect(startServer(serverInstance, options)).rejects.toThrow(
        'HTTP/2 requires SSL certificates'
      );
    });

    it('should override port and host from startOptions', async () => {
      const options = {
        ...serverOptions,
        port: 4000,
        host: '0.0.0.0',
      };

      await startServer(serverInstance, options);

      // expect(mockHttp2Server.listen).toHaveBeenCalled();
      expect(mockHttp2Server.listen).toHaveBeenCalledWith(4000, '0.0.0.0', expect.any(Function));
      expect(serverInstance.port).toBe(4000);
      expect(serverInstance.host).toBe('0.0.0.0');
    });

    it('should initialize plugins', async () => {
      await startServer(serverInstance, serverOptions);

      // Verify plugin initialization was called
      expect(serverInstance.plugins[0]!.initialize).toHaveBeenCalledWith(serverInstance);
    });

    it('should handle file system errors when reading certificates', async () => {
      // Setup file system to throw an error
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('File not found');
      });

      // Configure server options with HTTP/2 enabled and certificates
      const options = {
        ...serverOptions,
        http2: {
          enabled: true,
          keyFile: './test.key',
          certFile: './test.cert',
        },
      };

      // Expect the function to throw
      await expect(startServer(serverInstance, options)).rejects.toThrow(
        'Failed to read certificate files: File not found'
      );
    });

    it('should configure request handling', async () => {
      await startServer(serverInstance, serverOptions);

      // Verify 'request' event handler was added
      expect(mockHttp2Server.on).toHaveBeenCalledWith('request', expect.any(Function));
    });

    it('should handle server listen errors', async () => {
      // Setup server to emit an error on listen
      mockHttp2Server.listen.mockImplementation((_port, _host, _cb) => {
        // Don't call the callback, instead trigger the error handler
        setTimeout(() => {
          const errorHandler = mockHttp2Server.on.mock.calls.find(call => call[0] === 'error')![1];
          errorHandler(new Error('Port in use'));
        }, 10);
        return mockServer;
      });

      // Expect the function to throw
      await expect(startServer(serverInstance, serverOptions)).rejects.toThrow('Port in use');
    });
  });
});
