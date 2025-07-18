import { createRequestHandler } from './request-handler';
import { createContext } from '../context/create';
import { runWithContext } from '../context/store';
import { compose } from '../middleware/compose';

import type { Context } from '@blaize-types/context';
import type { NextFunction } from '@blaize-types/middleware';
import type { Server } from '@blaize-types/server';

// Mock the dependencies
vi.mock('../context/create');
vi.mock('../context/store');
vi.mock('../middleware/compose');

describe('createRequestHandler', () => {
  // Test setup variables
  let mockServer: Server;
  let mockReq: any;
  let mockRes: any;
  let mockContext: any;
  let mockHandler: any;

  beforeEach(() => {
    // Reset mocks
    vi.resetAllMocks();

    // Set up test doubles
    mockServer = {
      middleware: [
        { name: 'test-middleware', execute: vi.fn() },
        { name: 'test-middleware-2', execute: vi.fn() },
      ],
      router: {
        handleRequest: vi.fn().mockResolvedValue(undefined),
        getRoutes: vi.fn().mockReturnValue([]),
        addRoute: vi.fn(),
      },
    } as unknown as Server;

    mockReq = {
      method: 'GET',
      url: '/test',
      headers: {},
    };

    mockRes = {
      writeHead: vi.fn(),
      end: vi.fn(),
    };

    mockContext = {
      request: { method: 'GET', url: '/test' },
      response: {
        sent: false,
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      },
    };

    mockHandler = vi.fn();

    // Configure mocks with vi.mocked() for type safety
    vi.mocked(createContext).mockResolvedValue(mockContext);
    vi.mocked(compose).mockReturnValue(mockHandler);
    vi.mocked(runWithContext).mockImplementation((ctx, fn) => fn());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should create a request handler function', () => {
    const handler = createRequestHandler(mockServer);
    expect(handler).toBeInstanceOf(Function);
  });

  it('should create context with correct parameters', async () => {
    const handler = createRequestHandler(mockServer);
    await handler(mockReq, mockRes);

    expect(createContext).toHaveBeenCalledWith(mockReq, mockRes, {
      parseBody: true,
    });
  });

  it('should compose middleware from server instance', async () => {
    const handler = createRequestHandler(mockServer);
    await handler(mockReq, mockRes);
    expect(compose).toHaveBeenCalled();
    expect(compose).toHaveBeenCalledWith(mockServer.middleware);
  });

  it('should run handler with context in AsyncLocalStorage', async () => {
    const handler = createRequestHandler(mockServer);
    await handler(mockReq, mockRes);

    expect(runWithContext).toHaveBeenCalledWith(mockContext, expect.any(Function));
  });

  it('should execute the middleware chain', async () => {
    const handler = createRequestHandler(mockServer);
    await handler(mockReq, mockRes);

    expect(mockHandler).toHaveBeenCalledWith(mockContext, expect.any(Function));
  });

  it('should send a default response if middleware does not respond', async () => {
    // Configure mockHandler to execute the final handler function
    mockHandler.mockImplementation((_ctx: Context, next: NextFunction) => next());

    const handler = createRequestHandler(mockServer);
    await handler(mockReq, mockRes);

    expect(mockContext.response.status).toHaveBeenCalledWith(404);
    expect(mockContext.response.json).toHaveBeenCalledWith({
      message: 'Route not found: GET undefined',
      error: 'Not Found',
    });
  });

  it('should not send default response if middleware already sent a response', async () => {
    // Set response as already sent
    mockContext.response.sent = true;
    mockHandler.mockImplementation((_ctx: Context, next: NextFunction) => next());

    const handler = createRequestHandler(mockServer);
    await handler(mockReq, mockRes);

    expect(mockContext.response.json).not.toHaveBeenCalled();
  });

  it('should handle errors in middleware chain', async () => {
    const testError = new Error('Test middleware error');
    mockHandler.mockRejectedValue(testError);

    const handler = createRequestHandler(mockServer);
    await handler(mockReq, mockRes);

    expect(mockContext.response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Internal Server Error',
      }),
      500
    );
  });

  it('should not send error response if middleware already sent a response', async () => {
    const testError = new Error('Test middleware error');
    mockHandler.mockRejectedValue(testError);
    mockContext.response.sent = true;

    const handler = createRequestHandler(mockServer);
    await handler(mockReq, mockRes);

    expect(mockContext.response.json).not.toHaveBeenCalled();
  });

  it('should handle errors in context creation', async () => {
    const testError = new Error('Context creation error');
    vi.mocked(createContext).mockRejectedValue(testError);

    const handler = createRequestHandler(mockServer);
    await handler(mockReq, mockRes);

    expect(mockRes.writeHead).toHaveBeenCalledWith(500, { 'Content-Type': 'application/json' });
    expect(mockRes.end).toHaveBeenCalledWith(expect.stringContaining('Internal Server Error'));
  });

  it('should include error details in development mode', async () => {
    // Save original NODE_ENV
    const originalNodeEnv = process.env.NODE_ENV;

    // Set NODE_ENV to development
    process.env.NODE_ENV = 'development';

    const testError = new Error('Test error message');
    mockHandler.mockRejectedValue(testError);

    const handler = createRequestHandler(mockServer);
    await handler(mockReq, mockRes);

    expect(mockContext.response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: testError,
      }),
      500
    );

    // Restore original NODE_ENV
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('should handle errors without error objects', async () => {
    // Test with string error
    mockHandler.mockRejectedValue('String error');

    const handler = createRequestHandler(mockServer);
    await handler(mockReq, mockRes);

    expect(mockContext.response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Internal Server Error',
      }),
      500
    );
  });
});
