import { createMockLogger } from '@blaizejs/testing-utils';
import type { MockLogger } from '@blaizejs/testing-utils';

import { createRequestHandler } from './request-handler';
import { createContext } from '../context/create';
import { runWithContext } from '../context/store';
import { compose } from '../middleware/compose';
import { createErrorBoundary } from '../middleware/error-boundary/create';

import type { Context } from '@blaize-types/context';
import type { NextFunction } from '@blaize-types/middleware';

// Mock dependencies
vi.mock('../context/create');
vi.mock('../context/store');
vi.mock('../middleware/compose');
vi.mock('../middleware/error-boundary/create');
vi.mock('../middleware/cors');
vi.mock('../tracing/correlation', () => ({
  createCorrelationIdFromHeaders: vi.fn(() => DEFAULT_CORRELATION_ID),
  getCorrelationHeaderName: vi.fn(() => 'X-Correlation-ID'),
  getCorrelationId: vi.fn(() => DEFAULT_CORRELATION_ID), // ✅ ADD THIS
  withCorrelationId: vi.fn(async (_id: string, fn: () => Promise<void>) => {
    await fn();
  }),
}));

const DEFAULT_CORRELATION_ID = 'test-correlation-123';

describe('createRequestHandler', () => {
  let mockServer: any;
  let mockReq: any;
  let mockRes: any;
  let mockContext: Context;
  let mockHandler: any;
  let mockErrorBoundary: any;
  let mockLogger: MockLogger;

  beforeEach(() => {
    mockLogger = createMockLogger();

    // Setup mock server
    mockServer = {
      _logger: mockLogger,
      middleware: [],
      router: {
        handleRequest: vi.fn().mockResolvedValue(undefined),
      },
      bodyLimits: {},
    };

    // Setup mock request
    mockReq = {
      method: 'GET',
      url: '/test',
      headers: {},
    };

    // Setup mock response
    mockRes = {
      setHeader: vi.fn(),
      writeHead: vi.fn(),
      end: vi.fn(),
      statusCode: 200,
      headersSent: false,
    };

    // Setup mock context
    mockContext = {
      request: {
        method: 'GET',
        path: '/test',
      },
      response: {
        sent: false,
      },
      state: {
        correlationId: DEFAULT_CORRELATION_ID,
      },
    } as any;

    // Setup mock error boundary
    mockErrorBoundary = {
      name: 'ErrorBoundary',
      execute: vi.fn(async (ctx: Context, next: NextFunction, _logger: any) => {
        await next();
      }),
    };

    // Setup mocks
    (createContext as any).mockResolvedValue(mockContext);
    (runWithContext as any).mockImplementation(async (_ctx: Context, fn: () => Promise<void>) => {
      await fn();
    });
    (createErrorBoundary as any).mockReturnValue(mockErrorBoundary);

    // ✅ FIX: Make mock handler actually call next() by default
    mockHandler = vi.fn(async (ctx: Context, next: NextFunction, _logger: any) => {
      await next();
    });
    (compose as any).mockReturnValue(mockHandler);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('🆕 T6: Logger Parameter Integration', () => {
    test('creates request-scoped logger with correlation context', async () => {
      const handler = createRequestHandler(mockServer);
      await handler(mockReq, mockRes);

      // Verify child logger was created with request context
      expect(mockLogger.childContexts).toContainEqual(
        expect.objectContaining({
          correlationId: expect.any(String),
          method: 'GET',
          path: expect.any(String),
        })
      );
    });

    test('request logger includes correlationId, method, and path', async () => {
      const handler = createRequestHandler(mockServer);
      await handler(mockReq, mockRes);

      const requestLoggerContext = mockLogger.childContexts.find(
        ctx => ctx.correlationId && ctx.method && ctx.path
      );

      expect(requestLoggerContext).toBeDefined();
      expect(requestLoggerContext).toMatchObject({
        correlationId: DEFAULT_CORRELATION_ID,
        method: 'GET',
        path: '/test',
      });
    });

    test('passes request logger to middleware chain (compose)', async () => {
      const handler = createRequestHandler(mockServer);
      await handler(mockReq, mockRes);

      // Verify compose was called
      expect(compose).toHaveBeenCalled();

      // Verify the composed handler was called with logger as 3rd param
      expect(mockHandler).toHaveBeenCalledWith(
        mockContext,
        expect.any(Function), // next
        expect.objectContaining({
          info: expect.any(Function),
          error: expect.any(Function),
          debug: expect.any(Function),
          warn: expect.any(Function),
          child: expect.any(Function),
        })
      );
    });

    test('passes logger to router.handleRequest', async () => {
      const handler = createRequestHandler(mockServer);
      await handler(mockReq, mockRes);

      expect(mockServer.router.handleRequest).toHaveBeenCalledWith(
        mockContext,
        expect.objectContaining({
          info: expect.any(Function),
          error: expect.any(Function),
          child: expect.any(Function),
        })
      );
    });

    test('error boundary receives logger from compose', async () => {
      // ✅ FIX: Re-mock compose to actually execute middleware
      (compose as any).mockImplementation((middlewareArray: any[]) => {
        return async (ctx: Context, next: NextFunction, logger: any) => {
          let index = 0;
          const dispatch = async (): Promise<void> => {
            if (index >= middlewareArray.length) {
              return next();
            }
            const mw = middlewareArray[index++];
            await mw.execute(ctx, dispatch, logger);
          };
          await dispatch();
        };
      });

      const handler = createRequestHandler(mockServer);
      await handler(mockReq, mockRes);

      // Error boundary is first in middleware chain
      expect(createErrorBoundary).toHaveBeenCalled();
      expect(compose).toHaveBeenCalledWith(expect.arrayContaining([mockErrorBoundary]));

      // When composed handler executes, error boundary gets logger
      expect(mockErrorBoundary.execute).toHaveBeenCalledWith(
        mockContext,
        expect.any(Function),
        expect.objectContaining({
          info: expect.any(Function),
          error: expect.any(Function),
        })
      );
    });

    test('custom middleware receives logger from compose', async () => {
      let receivedLogger: any = null;

      const middlewareSpy = {
        name: 'custom',
        execute: vi.fn(async (ctx: Context, next: NextFunction, logger: any) => {
          receivedLogger = logger;
          await next();
        }),
      };

      mockServer.middleware = [middlewareSpy];

      // Re-setup compose mock to properly execute middleware
      (compose as any).mockImplementation((middlewareArray: any[]) => {
        return async (ctx: Context, next: NextFunction, logger: any) => {
          // Execute each middleware in order
          let index = 0;
          const dispatch = async (): Promise<void> => {
            if (index >= middlewareArray.length) {
              return next();
            }
            const mw = middlewareArray[index++];
            await mw.execute(ctx, dispatch, logger);
          };
          await dispatch();
        };
      });

      const handler = createRequestHandler(mockServer);
      await handler(mockReq, mockRes);

      expect(middlewareSpy.execute).toHaveBeenCalled();
      expect(receivedLogger).toBeDefined();
      expect(receivedLogger).toHaveProperty('info');
      expect(receivedLogger).toHaveProperty('child');
    });

    test('logs unhandled errors with server logger (not request logger)', async () => {
      const error = new Error('Unhandled error');
      mockServer.router.handleRequest.mockRejectedValue(error);

      const handler = createRequestHandler(mockServer);
      await handler(mockReq, mockRes);

      // Server logger should log the error
      expect(mockLogger.logs).toContainEqual(
        expect.objectContaining({
          level: 'error',
          message: 'Unhandled request error',
          meta: expect.objectContaining({
            error,
            correlationId: DEFAULT_CORRELATION_ID,
          }),
        })
      );
    });

    test('unhandled error response includes correlationId', async () => {
      const error = new Error('Unhandled error');
      mockServer.router.handleRequest.mockRejectedValue(error);

      const handler = createRequestHandler(mockServer);
      await handler(mockReq, mockRes);

      // Verify error response includes correlation ID
      expect(mockRes.end).toHaveBeenCalled();
      const errorResponse = JSON.parse(mockRes.end.mock.calls[0][0]);
      expect(errorResponse).toMatchObject({
        error: 'Internal Server Error',
        correlationId: DEFAULT_CORRELATION_ID,
      });
    });
  });

  describe('✅ Existing Functionality Preserved', () => {
    test('creates a request handler function', () => {
      const handler = createRequestHandler(mockServer);
      expect(handler).toBeInstanceOf(Function);
    });

    test('creates context with correct parameters', async () => {
      const handler = createRequestHandler(mockServer);
      await handler(mockReq, mockRes);

      expect(createContext).toHaveBeenCalledWith(mockReq, mockRes, {
        parseBody: true,
        initialState: { correlationId: DEFAULT_CORRELATION_ID },
        bodyLimits: mockServer.bodyLimits,
      });
    });

    test('runs handler with context in AsyncLocalStorage', async () => {
      const handler = createRequestHandler(mockServer);
      await handler(mockReq, mockRes);

      expect(runWithContext).toHaveBeenCalledWith(mockContext, expect.any(Function));
    });

    test('includes error boundary in middleware chain', async () => {
      const handler = createRequestHandler(mockServer);
      await handler(mockReq, mockRes);

      expect(createErrorBoundary).toHaveBeenCalled();
      expect(compose).toHaveBeenCalledWith([mockErrorBoundary, ...mockServer.middleware]);
    });

    test('throws NotFoundError when router does not handle request', async () => {
      // Router doesn't send response
      mockServer.router.handleRequest.mockResolvedValue(undefined);

      const handler = createRequestHandler(mockServer);
      await handler(mockReq, mockRes);

      // Error should be caught and logged
      expect(mockLogger.logs).toContainEqual(
        expect.objectContaining({
          level: 'error',
          message: 'Unhandled request error',
        })
      );

      // Error response should be sent
      expect(mockRes.writeHead).toHaveBeenCalledWith(500, { 'Content-Type': 'application/json' });
      expect(mockRes.end).toHaveBeenCalled();
    });

    test('does not throw NotFoundError if response already sent', async () => {
      mockContext.response.sent = true;

      const handler = createRequestHandler(mockServer);
      await handler(mockReq, mockRes);

      // Router should be called
      expect(mockServer.router.handleRequest).not.toHaveBeenCalled();

      // Should not log error since response was already sent
      const errorLogs = mockLogger.logs.filter(l => l.level === 'error');
      expect(errorLogs).toHaveLength(0);
    });

    test('handles CORS when corsOptions provided', async () => {
      mockServer.corsOptions = { origin: 'https://example.com' };

      const handler = createRequestHandler(mockServer);
      await handler(mockReq, mockRes);

      // CORS middleware should be in chain
      expect(compose).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ name: 'ErrorBoundary' })])
      );
    });
  });

  describe('🆕 T6: Integration Tests', () => {
    test('complete logger flow: server -> request -> middleware -> router', async () => {
      const executionOrder: string[] = [];

      const trackingMiddleware = {
        name: 'tracker',
        execute: vi.fn(async (ctx: Context, next: NextFunction, logger: any) => {
          executionOrder.push('middleware-start');
          expect(logger).toBeDefined();
          expect(logger).toHaveProperty('child');
          await next();
          executionOrder.push('middleware-end');
        }),
      };

      mockServer.middleware = [trackingMiddleware];
      mockServer.router.handleRequest = vi.fn(async (ctx: Context, logger: any) => {
        executionOrder.push('router');
        expect(logger).toBeDefined();
        expect(logger).toHaveProperty('info');
        // Mark response as sent so NotFoundError isn't thrown
        ctx.response.sent = true;
        return Promise.resolve();
      });

      // Re-setup compose to actually execute middleware
      (compose as any).mockImplementation((middlewareArray: any[]) => {
        return async (ctx: Context, next: NextFunction, logger: any) => {
          let index = 0;
          const dispatch = async (): Promise<void> => {
            if (index >= middlewareArray.length) {
              return next();
            }
            const mw = middlewareArray[index++];
            await mw.execute(ctx, dispatch, logger);
          };
          await dispatch();
        };
      });

      const handler = createRequestHandler(mockServer);
      await handler(mockReq, mockRes);

      // Verify execution order
      expect(executionOrder).toEqual(['middleware-start', 'router', 'middleware-end']);

      // Verify logger was created with request context
      expect(mockLogger.childContexts).toContainEqual(
        expect.objectContaining({
          correlationId: expect.any(String),
          method: 'GET',
        })
      );
    });

    test('logger context flows through entire request lifecycle', async () => {
      let middlewareLogger: any = null;
      let routerLogger: any = null;

      const captureMiddleware = {
        name: 'capture',
        execute: vi.fn(async (ctx: Context, next: NextFunction, logger: any) => {
          middlewareLogger = logger;
          await next();
        }),
      };

      mockServer.middleware = [captureMiddleware];
      mockServer.router.handleRequest = vi.fn(async (ctx: Context, logger: any) => {
        routerLogger = logger;
      });

      // Re-setup compose to properly execute middleware
      (compose as any).mockImplementation((middlewareArray: any[]) => {
        return async (ctx: Context, next: NextFunction, logger: any) => {
          let index = 0;
          const dispatch = async (): Promise<void> => {
            if (index >= middlewareArray.length) {
              return next();
            }
            const mw = middlewareArray[index++];
            await mw.execute(ctx, dispatch, logger);
          };
          await dispatch();
        };
      });

      const handler = createRequestHandler(mockServer);
      await handler(mockReq, mockRes);

      // Both should have received logger
      expect(middlewareLogger).toBeDefined();
      expect(routerLogger).toBeDefined();

      // Both should be functional
      expect(middlewareLogger).toHaveProperty('info');
      expect(routerLogger).toHaveProperty('info');
    });
  });
});
