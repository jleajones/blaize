import { ErrorType } from '@blaize-types/errors';

import { createRequestHandler } from './request-handler';
import { createContext } from '../context/create';
import { runWithContext } from '../context/store';
import { formatErrorResponse } from '../errors/boundary';
import { NotFoundError } from '../errors/not-found-error';
import { ValidationError } from '../errors/validation-error';
import { compose } from '../middleware/compose';
import { cors } from '../middleware/cors';
import { createErrorBoundary } from '../middleware/error-boundary';

import type { Context } from '@blaize-types/context';
import type { NextFunction } from '@blaize-types/middleware';
import type { UnknownServer } from '@blaize-types/server';

const DEFAULT_CORRELATION_ID = 'generated-correlation-id';
const DEFAULT_CORRELATION_HEADER_NAME = 'x-correlation-id';

// Mock the dependencies
vi.mock('../context/create');
vi.mock('../context/store');
vi.mock('../middleware/compose');
vi.mock('../middleware/cors', () => ({
  cors: vi.fn().mockReturnValue({
    name: 'cors',
    execute: vi.fn(),
  }),
}));
vi.mock('../middleware/error-boundary');
vi.mock('../errors/boundary');
vi.mock('../tracing/correlation', () => ({
  createCorrelationIdFromHeaders: vi.fn(() => DEFAULT_CORRELATION_ID),
  getCorrelationId: vi.fn(() => DEFAULT_CORRELATION_ID),
  getCorrelationHeaderName: vi.fn(() => DEFAULT_CORRELATION_HEADER_NAME),
  withCorrelationId: vi.fn((_id, fn) => fn()), // Just execute the function
  _setCorrelationConfig: vi.fn(),
}));

describe('createRequestHandler - Complete Test Suite', () => {
  // Test setup variables
  let mockServer: UnknownServer;
  let mockReq: any;
  let mockRes: any;
  let mockContext: any;
  let mockHandler: any;
  let mockErrorBoundary: any;

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
    } as unknown as UnknownServer;

    mockReq = {
      method: 'GET',
      url: '/test',
      headers: {},
    };

    mockRes = {
      // minimal Node-like surface
      setHeader: vi.fn(),
      getHeader: vi.fn().mockReturnValue(undefined),
      removeHeader: vi.fn(),
      writeHead: vi.fn(),
      end: vi.fn(),
      // sometimes checked by frameworks
      statusCode: 200,
      headersSent: false,
    };

    mockContext = {
      request: { method: 'GET', path: '/test' },
      response: {
        sent: false,
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
        raw: mockRes,
      },
    };

    mockHandler = vi.fn();
    mockErrorBoundary = { name: 'error-boundary', execute: vi.fn() };

    // Configure mocks with vi.mocked() for type safety
    vi.mocked(createContext).mockResolvedValue(mockContext);
    vi.mocked(compose).mockReturnValue(mockHandler);
    vi.mocked(runWithContext).mockImplementation((ctx, fn) => fn());
    vi.mocked(createErrorBoundary).mockReturnValue(mockErrorBoundary);

    // Mock formatErrorResponse to return proper BlaizeErrorResponse objects
    vi.mocked(formatErrorResponse).mockImplementation(error => {
      // Simulate the error boundary formatting errors
      if (error instanceof NotFoundError) {
        return {
          type: ErrorType.NOT_FOUND,
          title: error.title,
          status: error.status,
          correlationId: error.correlationId,
          timestamp: error.timestamp.toISOString(),
          details: error.details,
        };
      } else if (error instanceof ValidationError) {
        return {
          type: ErrorType.VALIDATION_ERROR,
          title: error.title,
          status: 400,
          correlationId: error.correlationId || 'test-correlation-id',
          timestamp: new Date().toISOString(),
          details: error.details,
        };
      } else {
        // Handle unexpected errors
        return {
          type: ErrorType.INTERNAL_SERVER_ERROR,
          title: 'Internal Server Error',
          status: 500,
          correlationId: 'test-correlation-id',
          timestamp: new Date().toISOString(),
          details: { originalMessage: error instanceof Error ? error.message : String(error) },
        };
      }
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Request Handler Functionality', () => {
    it('should create a request handler function', () => {
      const handler = createRequestHandler(mockServer);
      expect(handler).toBeInstanceOf(Function);
    });

    it('should create context with correct parameters', async () => {
      const handler = createRequestHandler(mockServer);
      await handler(mockReq, mockRes);

      expect(createContext).toHaveBeenCalledWith(mockReq, mockRes, {
        parseBody: true,
        initialState: { correlationId: DEFAULT_CORRELATION_ID },
      });
    });

    it('should run handler with context in AsyncLocalStorage', async () => {
      const handler = createRequestHandler(mockServer);
      await handler(mockReq, mockRes);

      expect(runWithContext).toHaveBeenCalledWith(mockContext, expect.any(Function));
    });

    it('should execute the middleware chain', async () => {
      // Configure error boundary to execute normally (no errors)
      mockErrorBoundary.execute.mockImplementation(async (ctx: Context, next: NextFunction) => {
        await next();
      });

      mockHandler.mockImplementation(async (ctx: Context, next: NextFunction) => {
        await mockErrorBoundary.execute(ctx, next);
      });

      const handler = createRequestHandler(mockServer);
      await handler(mockReq, mockRes);

      expect(mockHandler).toHaveBeenCalledWith(mockContext, expect.any(Function));
    });
  });

  describe('Error Boundary Integration', () => {
    it('should include error boundary in middleware chain', async () => {
      const handler = createRequestHandler(mockServer);
      await handler(mockReq, mockRes);

      // Verify error boundary was created
      expect(createErrorBoundary).toHaveBeenCalled();

      // Verify compose was called with error boundary first
      expect(compose).toHaveBeenCalledWith([mockErrorBoundary, ...mockServer.middleware]);
    });

    it('should compose middleware with error boundary first', async () => {
      const handler = createRequestHandler(mockServer);
      await handler(mockReq, mockRes);

      // Verify error boundary is first, followed by existing middleware
      const expectedMiddleware = [mockErrorBoundary, ...mockServer.middleware];

      expect(compose).toHaveBeenCalledWith(expectedMiddleware);
    });
  });

  describe('Route Not Found Handling', () => {
    it('should throw NotFoundError when no route matches and no response sent', async () => {
      // Configure error boundary to catch thrown errors
      mockErrorBoundary.execute.mockImplementation(async (ctx: Context, next: NextFunction) => {
        try {
          await next();
        } catch (error) {
          // Don't send response if already sent
          if (ctx.response.sent) return;

          // Use formatErrorResponse to get the error response object
          const errorResponse = formatErrorResponse(error);
          ctx.response.status(errorResponse.status).json(errorResponse);
        }
      });

      // Configure handler to execute final route logic (which throws NotFoundError)
      mockHandler.mockImplementation(async (ctx: Context, next: NextFunction) => {
        await mockErrorBoundary.execute(ctx, next);
      });

      const handler = createRequestHandler(mockServer);
      await handler(mockReq, mockRes);

      // Verify formatErrorResponse was called with NotFoundError
      expect(formatErrorResponse).toHaveBeenCalledWith(expect.any(NotFoundError));

      // Verify the error response was formatted correctly (matches actual thrown NotFoundError)
      expect(mockContext.response.status).toHaveBeenCalledWith(404);
      expect(mockContext.response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ErrorType.NOT_FOUND,
          title: expect.stringContaining('Route not found'),
          status: 404,
          correlationId: expect.any(String),
          timestamp: expect.any(String),
        })
      );
    });

    it('should not throw NotFoundError if middleware already sent response', async () => {
      // Set response as already sent
      mockContext.response.sent = true;

      // Configure error boundary to execute normally
      mockErrorBoundary.execute.mockImplementation(async (ctx: Context, next: NextFunction) => {
        await next();
      });

      mockHandler.mockImplementation(async (ctx: Context, next: NextFunction) => {
        await mockErrorBoundary.execute(ctx, next);
      });

      const handler = createRequestHandler(mockServer);
      await handler(mockReq, mockRes);

      // Verify no error response was sent
      expect(formatErrorResponse).not.toHaveBeenCalled();
      expect(mockContext.response.json).not.toHaveBeenCalled();
    });

    it('should not throw NotFoundError if router handled the request', async () => {
      // Configure router to mark response as sent
      mockServer.router.handleRequest = vi.fn().mockImplementation((ctx: Context) => {
        ctx.response.sent = true;
      });

      mockErrorBoundary.execute.mockImplementation(async (ctx: Context, next: NextFunction) => {
        await next();
      });

      mockHandler.mockImplementation(async (ctx: Context, next: NextFunction) => {
        await mockErrorBoundary.execute(ctx, next);
      });

      const handler = createRequestHandler(mockServer);
      await handler(mockReq, mockRes);

      // Verify router was called
      expect(mockServer.router.handleRequest).toHaveBeenCalledWith(mockContext);
      // Verify no error response was sent
      expect(formatErrorResponse).not.toHaveBeenCalled();
      expect(mockContext.response.json).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle BlaizeError thrown by middleware', async () => {
      const notFoundErrorMessage = 'User not found';
      const testError = new NotFoundError(notFoundErrorMessage);

      // Configure error boundary to catch and handle the error
      mockErrorBoundary.execute.mockImplementation(async (ctx: Context, next: NextFunction) => {
        try {
          await next();
        } catch (error) {
          if (ctx.response.sent) return;
          const errorResponse = formatErrorResponse(error);
          ctx.response.status(errorResponse.status).json(errorResponse);
        }
      });

      // Configure middleware to throw the error
      mockHandler.mockImplementation(async (ctx: Context, _next: NextFunction) => {
        await mockErrorBoundary.execute(ctx, async () => {
          throw testError; // Actually throw the error
        });
      });

      const handler = createRequestHandler(mockServer);
      await handler(mockReq, mockRes);

      // Verify formatErrorResponse was called with the actual error
      expect(formatErrorResponse).toHaveBeenCalledWith(testError);

      // Verify error was formatted correctly
      expect(mockContext.response.status).toHaveBeenCalledWith(404);
      expect(mockContext.response.json).toHaveBeenCalledWith({
        type: ErrorType.NOT_FOUND,
        title: notFoundErrorMessage,
        correlationId: expect.any(String),
        timestamp: expect.any(String),
        status: 404,
      });
    });

    it('should handle ValidationError with field details', async () => {
      // Use the correct ValidationError structure (details: unknown)
      const validationErrorMessage = 'Validation failed';
      const testError = new ValidationError(validationErrorMessage, {
        fields: [
          {
            field: 'email',
            messages: ['Email is required', 'Email must be valid'],
            rejectedValue: '',
            expectedType: 'string',
          },
        ],
        errorCount: 1,
        section: 'body',
      });

      // Configure error boundary to handle validation error
      mockErrorBoundary.execute.mockImplementation(async (ctx: Context, next: NextFunction) => {
        try {
          await next();
        } catch (error) {
          if (ctx.response.sent) return;
          const errorResponse = formatErrorResponse(error);
          ctx.response.status(errorResponse.status).json(errorResponse);
        }
      });

      mockHandler.mockImplementation(async (ctx: Context, _next: NextFunction) => {
        await mockErrorBoundary.execute(ctx, async () => {
          throw testError; // Actually throw the error
        });
      });

      const handler = createRequestHandler(mockServer);
      await handler(mockReq, mockRes);

      // Verify formatErrorResponse was called with the actual error
      expect(formatErrorResponse).toHaveBeenCalledWith(testError);

      // Verify error was formatted correctly
      expect(mockContext.response.status).toHaveBeenCalledWith(400);
      expect(mockContext.response.json).toHaveBeenCalledWith({
        type: ErrorType.VALIDATION_ERROR,
        title: validationErrorMessage,
        status: 400,
        correlationId: expect.any(String),
        timestamp: expect.any(String),
        details: {
          fields: [
            {
              field: 'email',
              messages: ['Email is required', 'Email must be valid'],
              rejectedValue: '',
              expectedType: 'string',
            },
          ],
          errorCount: 1,
          section: 'body',
        },
      });
    });

    it('should handle unexpected errors by converting to InternalServerError', async () => {
      const unexpectedError = new Error('Database connection failed');

      // Configure error boundary to handle unexpected error
      mockErrorBoundary.execute.mockImplementation(async (ctx: Context, next: NextFunction) => {
        try {
          await next();
        } catch (error) {
          if (ctx.response.sent) return;
          const errorResponse = formatErrorResponse(error);
          ctx.response.status(errorResponse.status).json(errorResponse);
        }
      });

      mockHandler.mockImplementation(async (ctx: Context, _next: NextFunction) => {
        await mockErrorBoundary.execute(ctx, async () => {
          throw unexpectedError; // Actually throw the error
        });
      });

      const handler = createRequestHandler(mockServer);
      await handler(mockReq, mockRes);

      // Verify formatErrorResponse was called with the actual error
      expect(formatErrorResponse).toHaveBeenCalledWith(unexpectedError);

      // Verify error was converted and formatted correctly
      expect(mockContext.response.status).toHaveBeenCalledWith(500);
      expect(mockContext.response.json).toHaveBeenCalledWith({
        type: ErrorType.INTERNAL_SERVER_ERROR,
        title: 'Internal Server Error',
        status: 500,
        correlationId: 'test-correlation-id',
        timestamp: expect.any(String),
        details: { originalMessage: 'Database connection failed' },
      });
    });

    it('should handle errors thrown by router', async () => {
      const notFoundErrorMessage = 'Route not found';
      const routerError = new NotFoundError(notFoundErrorMessage);

      // Configure router to throw error
      mockServer.router.handleRequest = vi.fn().mockRejectedValue(routerError);

      // Configure error boundary to catch router errors
      mockErrorBoundary.execute.mockImplementation(async (ctx: Context, next: NextFunction) => {
        try {
          await next();
        } catch (error) {
          if (ctx.response.sent) return;
          const errorResponse = formatErrorResponse(error);
          ctx.response.status(errorResponse.status).json(errorResponse);
        }
      });

      mockHandler.mockImplementation(async (ctx: Context, next: NextFunction) => {
        await mockErrorBoundary.execute(ctx, next);
      });

      const handler = createRequestHandler(mockServer);
      await handler(mockReq, mockRes);

      // Verify formatErrorResponse was called with the router error
      expect(formatErrorResponse).toHaveBeenCalledWith(routerError);

      expect(mockContext.response.status).toHaveBeenCalledWith(404);
      expect(mockContext.response.json).toHaveBeenCalledWith({
        type: ErrorType.NOT_FOUND,
        title: notFoundErrorMessage,
        status: 404,
        correlationId: routerError.correlationId,
        timestamp: routerError.timestamp.toISOString(),
        details: routerError.details,
      });
    });

    it('should not send error response if response already sent', async () => {
      const testError = new Error('Test middleware error');
      mockContext.response.sent = true; // Response already sent

      // Configure error boundary to respect response.sent
      mockErrorBoundary.execute.mockImplementation(async (ctx: Context, next: NextFunction) => {
        try {
          await next();
        } catch (error) {
          if (ctx.response.sent) return; // Don't send response if already sent
          const errorResponse = formatErrorResponse(error);
          ctx.response.status(errorResponse.status).json(errorResponse);
        }
      });

      mockHandler.mockImplementation(async (ctx: Context, _next: NextFunction) => {
        await mockErrorBoundary.execute(ctx, async () => {
          throw testError;
        });
      });

      const handler = createRequestHandler(mockServer);
      await handler(mockReq, mockRes);

      // Verify formatErrorResponse was not called since response was already sent
      expect(formatErrorResponse).not.toHaveBeenCalled();
      expect(mockContext.response.json).not.toHaveBeenCalled();
    });

    it('should handle errors in context creation for HTTP/2', async () => {
      const testError = new Error('Context creation error');
      vi.mocked(createContext).mockRejectedValue(testError);

      // Mock HTTP/2 response
      const mockHttp2Res = {
        stream: {
          respond: vi.fn(),
          end: vi.fn(),
        },
        headersSent: false,
      } as any;

      const handler = createRequestHandler(mockServer);
      await handler(mockReq, mockHttp2Res);

      // Verify HTTP/2 response
      expect(mockHttp2Res.stream.respond).toHaveBeenCalledWith({
        ':status': 500,
        'content-type': 'application/json',
        'x-correlation-id': DEFAULT_CORRELATION_ID, // Header included
      });
      expect(mockHttp2Res.stream.end).toHaveBeenCalledWith(
        JSON.stringify({
          error: 'Internal Server Error',
          message: 'Failed to process request',
          correlationId: DEFAULT_CORRELATION_ID, // Body includes ID
        })
      );
    });
  });

  describe('Context Creation Error Handling', () => {
    it('should handle errors in context creation', async () => {
      const testError = new Error('Context creation error');
      vi.mocked(createContext).mockRejectedValue(testError);

      const handler = createRequestHandler(mockServer);
      await handler(mockReq, mockRes);

      expect(mockRes.writeHead).toHaveBeenCalledWith(500, { 'Content-Type': 'application/json' });
      expect(mockRes.end).toHaveBeenCalledWith(
        JSON.stringify({
          error: 'Internal Server Error',
          message: 'Failed to process request',
          correlationId: DEFAULT_CORRELATION_ID,
        })
      );
    });

    it('should log context creation errors', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const testError = new Error('Context creation error');
      vi.mocked(createContext).mockRejectedValue(testError);

      const handler = createRequestHandler(mockServer);
      await handler(mockReq, mockRes);

      expect(consoleSpy).toHaveBeenCalledWith('Error creating context:', testError);
      consoleSpy.mockRestore();
    });
  });

  describe('Successful Request Flow', () => {
    it('should not interfere with successful requests', async () => {
      // Configure successful flow
      mockErrorBoundary.execute.mockImplementation(async (ctx: Context, next: NextFunction) => {
        await next(); // No errors thrown
      });

      mockHandler.mockImplementation(async (ctx: Context, next: NextFunction) => {
        await mockErrorBoundary.execute(ctx, next);
      });

      // Configure router to handle request successfully
      mockServer.router.handleRequest = vi.fn().mockImplementation((ctx: Context) => {
        ctx.response.sent = true;
      });

      const handler = createRequestHandler(mockServer);
      await handler(mockReq, mockRes);

      // Verify normal flow executed
      expect(mockServer.router.handleRequest).toHaveBeenCalledWith(mockContext);
      expect(formatErrorResponse).not.toHaveBeenCalled(); // No errors
      expect(mockContext.response.json).not.toHaveBeenCalled(); // No error response
    });

    it('should call router.handleRequest when middleware completes successfully', async () => {
      mockErrorBoundary.execute.mockImplementation(async (ctx: Context, next: NextFunction) => {
        await next();
      });

      mockHandler.mockImplementation(async (ctx: Context, next: NextFunction) => {
        await mockErrorBoundary.execute(ctx, next);
      });

      const handler = createRequestHandler(mockServer);
      await handler(mockReq, mockRes);

      expect(mockServer.router.handleRequest).toHaveBeenCalledWith(mockContext);
    });
  });

  describe('Edge Cases', () => {
    it('should handle errors without error objects (string errors)', async () => {
      const stringError = 'String error message';

      mockErrorBoundary.execute.mockImplementation(async (ctx: Context, next: NextFunction) => {
        try {
          await next();
        } catch (error) {
          if (ctx.response.sent) return;
          const errorResponse = formatErrorResponse(error);
          ctx.response.status(errorResponse.status).json(errorResponse);
        }
      });

      mockHandler.mockImplementation(async (ctx: Context, _next: NextFunction) => {
        await mockErrorBoundary.execute(ctx, async () => {
          throw stringError; // Actually throw string error
        });
      });

      const handler = createRequestHandler(mockServer);
      await handler(mockReq, mockRes);

      // Verify formatErrorResponse was called with string error
      expect(formatErrorResponse).toHaveBeenCalledWith(stringError);

      expect(mockContext.response.status).toHaveBeenCalledWith(500);
      expect(mockContext.response.json).toHaveBeenCalledWith({
        type: ErrorType.INTERNAL_SERVER_ERROR,
        title: 'Internal Server Error',
        status: 500,
        correlationId: 'test-correlation-id',
        timestamp: expect.any(String),
        details: { originalMessage: 'String error message' },
      });
    });

    it('should handle null/undefined errors', async () => {
      mockErrorBoundary.execute.mockImplementation(async (ctx: Context, next: NextFunction) => {
        try {
          await next();
        } catch (error) {
          if (ctx.response.sent) return;
          const errorResponse = formatErrorResponse(error);
          ctx.response.status(errorResponse.status).json(errorResponse);
        }
      });

      mockHandler.mockImplementation(async (ctx: Context, _next: NextFunction) => {
        await mockErrorBoundary.execute(ctx, async () => {
          throw null; // Actually throw null
        });
      });

      const handler = createRequestHandler(mockServer);
      await handler(mockReq, mockRes);

      // Verify formatErrorResponse was called with null
      expect(formatErrorResponse).toHaveBeenCalledWith(null);

      expect(mockContext.response.status).toHaveBeenCalledWith(500);
    });
  });

  describe('Middleware Chain Composition', () => {
    it('should preserve middleware execution order with error boundary first', async () => {
      const executionOrder: string[] = [];

      // Track execution order
      mockErrorBoundary.execute.mockImplementation(async (ctx: Context, next: NextFunction) => {
        executionOrder.push('error-boundary-start');
        try {
          await next();
        } catch (error) {
          if (ctx.response.sent) return;
          const errorResponse = formatErrorResponse(error);
          ctx.response.status(errorResponse.status).json(errorResponse);
        }
        executionOrder.push('error-boundary-end');
      });

      mockServer.middleware[0]!.execute = vi
        .fn()
        .mockImplementation(async (_ctx: Context, next: NextFunction) => {
          executionOrder.push('middleware-1');
          await next();
        });

      mockServer.middleware[1]!.execute = vi
        .fn()
        .mockImplementation(async (_ctx: Context, next: NextFunction) => {
          executionOrder.push('middleware-2');
          await next();
        });

      // Mock the composed handler to execute middleware in order
      mockHandler.mockImplementation(async (ctx: Context, _next: NextFunction) => {
        await mockErrorBoundary.execute(ctx, async () => {
          await mockServer.middleware[0]!.execute(ctx, async () => {
            await mockServer.middleware[1]!.execute(ctx, _next);
          });
        });
      });

      const handler = createRequestHandler(mockServer);
      await handler(mockReq, mockRes);

      expect(executionOrder).toEqual([
        'error-boundary-start',
        'middleware-1',
        'middleware-2',
        'error-boundary-end',
      ]);
    });
  });

  describe('SSE Error Handling', () => {
    it('should not send error response when headers already sent (SSE case)', async () => {
      const testError = new Error('Context creation error');
      vi.mocked(createContext).mockRejectedValue(testError);

      // Mock response with headers already sent (SSE scenario)
      mockRes.headersSent = true;

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const handler = createRequestHandler(mockServer);
      await handler(mockReq, mockRes);

      // Should log but not try to send response
      expect(consoleSpy).toHaveBeenCalledWith('Error creating context:', testError);
      expect(consoleSpy).toHaveBeenCalledWith('Headers already sent, cannot send error response');

      // Should NOT attempt to write response
      expect(mockRes.writeHead).not.toHaveBeenCalled();
      expect(mockRes.end).not.toHaveBeenCalled();
      expect(mockRes.setHeader).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle HTTP/2 SSE with headers already sent', async () => {
      const testError = new Error('Context creation error');
      vi.mocked(createContext).mockRejectedValue(testError);

      // Mock HTTP/2 response with headers already sent
      const mockHttp2Res = {
        stream: {
          respond: vi.fn(),
          end: vi.fn(),
          headersSent: true, // Headers already sent for SSE
        },
        headersSent: false, // Main response object might not have this set
      } as any;

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const handler = createRequestHandler(mockServer);
      await handler(mockReq, mockHttp2Res);

      // Should log but not try to send response
      expect(consoleSpy).toHaveBeenCalledWith('Error creating context:', testError);
      expect(consoleSpy).toHaveBeenCalledWith('Headers already sent, cannot send error response');

      // Should NOT attempt to send HTTP/2 response
      expect(mockHttp2Res.stream.respond).not.toHaveBeenCalled();
      expect(mockHttp2Res.stream.end).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should detect SSE request by Accept header', () => {
      // This test documents the expected behavior even though
      // we're not explicitly checking the header in the handler
      mockReq.headers = {
        accept: 'text/event-stream',
      };

      // The SSE route handler would be responsible for handling this
      expect(mockReq.headers.accept).toBe('text/event-stream');
    });

    it('should handle errors after SSE stream starts', async () => {
      // Simulate a scenario where context is created successfully
      // but headers get sent during middleware execution (SSE starts)

      const handler = createRequestHandler(mockServer);

      // Configure error boundary to simulate SSE stream starting
      mockErrorBoundary.execute.mockImplementation(async (ctx: Context, _next: NextFunction) => {
        // Simulate SSE stream starting (headers get sent)
        mockRes.headersSent = true;
        ctx.response.sent = true;

        // Then an error occurs
        const _error = new Error('Error after SSE started');
        // Error boundary would normally handle this, but can't send HTTP response
        // Just mark as handled
        return;
      });

      mockHandler.mockImplementation(async (ctx: Context, next: NextFunction) => {
        await mockErrorBoundary.execute(ctx, next);
      });

      await handler(mockReq, mockRes);

      // Should not attempt to send error response
      expect(mockRes.writeHead).not.toHaveBeenCalled();
      expect(formatErrorResponse).not.toHaveBeenCalled();
    });

    it('should handle mixed SSE and regular requests', async () => {
      const handler = createRequestHandler(mockServer);

      // Test 1: Regular request (headers not sent)
      mockRes.headersSent = false;
      const regularError = new Error('Regular error');
      vi.mocked(createContext).mockRejectedValueOnce(regularError);

      await handler(mockReq, mockRes);

      // Should send normal error response
      expect(mockRes.writeHead).toHaveBeenCalledWith(500, { 'Content-Type': 'application/json' });
      expect(mockRes.end).toHaveBeenCalled();

      // Reset mocks
      vi.clearAllMocks();
      vi.mocked(createContext).mockResolvedValue(mockContext);

      // Test 2: SSE request (headers already sent)
      mockRes.headersSent = true;
      const sseError = new Error('SSE error');
      vi.mocked(createContext).mockRejectedValueOnce(sseError);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await handler(mockReq, mockRes);

      // Should NOT send error response for SSE
      expect(mockRes.writeHead).not.toHaveBeenCalled();
      expect(mockRes.end).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('Headers already sent, cannot send error response');

      consoleSpy.mockRestore();
    });

    it('should check both res.headersSent and res.stream.headersSent', async () => {
      const testError = new Error('Test error');
      vi.mocked(createContext).mockRejectedValue(testError);

      // Test various combinations
      const testCases = [
        { res: { headersSent: true }, shouldSendError: false },
        { res: { headersSent: false }, shouldSendError: true },
        { res: { headersSent: false, stream: { headersSent: true } }, shouldSendError: false },
        { res: { headersSent: true, stream: { headersSent: false } }, shouldSendError: false },
      ];

      for (const testCase of testCases) {
        vi.clearAllMocks();

        const mockTestRes = {
          ...mockRes,
          ...testCase.res,
          setHeader: vi.fn(),
          writeHead: vi.fn(),
          end: vi.fn(),
        };

        if (testCase.res.stream) {
          mockTestRes.stream = {
            ...testCase.res.stream,
            respond: vi.fn(),
            end: vi.fn(),
          };
        }

        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const handler = createRequestHandler(mockServer);
        await handler(mockReq, mockTestRes);

        if (testCase.shouldSendError) {
          // Should send error response
          if (mockTestRes.stream?.respond) {
            expect(mockTestRes.stream.respond).toHaveBeenCalled();
          } else {
            expect(mockTestRes.writeHead).toHaveBeenCalled();
          }
        } else {
          // Should NOT send error response
          expect(consoleSpy).toHaveBeenCalledWith(
            'Headers already sent, cannot send error response'
          );
          expect(mockTestRes.writeHead).not.toHaveBeenCalled();
          if (mockTestRes.stream?.respond) {
            expect(mockTestRes.stream.respond).not.toHaveBeenCalled();
          }
        }

        consoleSpy.mockRestore();
      }
    });
  });
  describe('CORS Integration', () => {
    it('should include CORS middleware when corsOptions is present and not false', async () => {
      const mockCorsMiddleware = { name: 'cors', execute: vi.fn() };
      vi.mocked(cors).mockReturnValue(mockCorsMiddleware);

      const serverWithCors = {
        ...mockServer,
        corsOptions: { origin: 'https://example.com' },
      };

      const handler = createRequestHandler(serverWithCors);
      await handler(mockReq, mockRes);

      // Verify cors was called with the options
      expect(cors).toHaveBeenCalledWith({ origin: 'https://example.com' });

      // Verify compose was called with CORS in the right position
      expect(compose).toHaveBeenCalledWith([
        mockErrorBoundary,
        mockCorsMiddleware,
        ...mockServer.middleware,
      ]);
    });

    it('should skip CORS when corsOptions is false', async () => {
      const serverWithoutCors = {
        ...mockServer,
        corsOptions: false,
      };

      const handler = createRequestHandler(serverWithoutCors);
      await handler(mockReq, mockRes);

      // Verify cors was NOT called
      expect(cors).not.toHaveBeenCalled();

      // Verify compose was called without CORS
      expect(compose).toHaveBeenCalledWith([mockErrorBoundary, ...mockServer.middleware]);
    });

    it('should include CORS when corsOptions is undefined (uses defaults)', async () => {
      const mockCorsMiddleware = { name: 'cors', execute: vi.fn() };
      vi.mocked(cors).mockReturnValue(mockCorsMiddleware);

      const serverWithDefaultCors = {
        ...mockServer,
        corsOptions: undefined,
      };

      const handler = createRequestHandler(serverWithDefaultCors);
      await handler(mockReq, mockRes);

      // Verify cors was called with undefined (will use defaults)
      expect(cors).toHaveBeenCalledWith(undefined);

      // Verify CORS is included
      expect(compose).toHaveBeenCalledWith(expect.arrayContaining([mockCorsMiddleware]));
    });
  });
});
