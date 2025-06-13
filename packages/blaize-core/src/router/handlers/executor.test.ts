import * as z from 'zod';

import { createMockMiddleware } from '@blaizejs/testing-utils';

import { executeHandler } from './executor';
import { compose } from '../../middleware/compose';
import { createRequestValidator, createResponseValidator } from '../validation/schema';

import type { Context, RouteMethodOptions } from '../../index';

// Mock the dependencies
vi.mock('../../middleware/compose', () => ({
  compose: vi.fn(_middleware => {
    return async (ctx: any, next: any) => {
      await next();
    };
  }),
}));

vi.mock('../validation/schema', () => ({
  createRequestValidator: vi.fn(() => ({
    name: 'request-validator',
    execute: async (ctx: any, next: any) => {
      await next();
    },
  })),
  createResponseValidator: vi.fn(() => ({
    name: 'response-validator',
    execute: async (ctx: any, next: any) => {
      await next();
    },
  })),
}));

describe('executeHandler', () => {
  // Setup common test variables
  let ctx: Context;
  let routeOptions: RouteMethodOptions;
  let params: Record<string, string>;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Set up test context
    ctx = {
      request: {},
      response: {
        sent: false,
        json: vi.fn(),
        text: vi.fn(),
      },
    } as unknown as Context;

    // Default route options
    routeOptions = {
      handler: vi.fn().mockResolvedValue({ message: 'success' }),
      middleware: [],
    };

    // Route parameters
    params = { id: '123' };
  });

  test('should execute the handler and set the response', async () => {
    await executeHandler(ctx, routeOptions, params);

    // Verify the handler was called with context and params
    expect(routeOptions.handler).toHaveBeenCalledWith(ctx, params);

    // Verify the response was set
    expect(ctx.response.json).toHaveBeenCalledWith({ message: 'success' });
  });

  test('should not set response if result is undefined', async () => {
    routeOptions.handler = vi.fn().mockResolvedValue(undefined);

    await executeHandler(ctx, routeOptions, params);

    // Verify the handler was called
    expect(routeOptions.handler).toHaveBeenCalledWith(ctx, params);

    // Verify response.json was not called
    expect(ctx.response.json).not.toHaveBeenCalled();
  });

  test('should not set response if already sent', async () => {
    ctx.response.sent = true;

    await executeHandler(ctx, routeOptions, params);

    // Verify the handler was called
    expect(routeOptions.handler).toHaveBeenCalledWith(ctx, params);

    // Verify response.json was not called
    expect(ctx.response.json).not.toHaveBeenCalled();
  });

  test('should compose middleware with the handler', async () => {
    // Create mock middleware using the helper
    const middleware1 = createMockMiddleware({
      name: 'middleware1',
      execute: vi.fn().mockImplementation((_, next) => next()),
    });

    const middleware2 = createMockMiddleware({
      name: 'middleware2',
      execute: vi.fn().mockImplementation((_, next) => next()),
    });

    routeOptions.middleware = [middleware1, middleware2];

    await executeHandler(ctx, routeOptions, params);

    // Verify compose was called with middleware plus handler
    expect(compose).toHaveBeenCalled();
    const composedMiddleware = (compose as any).mock.calls[0][0];
    expect(composedMiddleware).toHaveLength(2); // middleware1, middleware2
  });

  test('should add request validator if schema provided', async () => {
    routeOptions.schema = {
      params: z.object({ id: z.string() }),
    };

    await executeHandler(ctx, routeOptions, params);

    // Verify createRequestValidator was called
    expect(createRequestValidator).toHaveBeenCalledWith(routeOptions.schema);

    // Verify compose included the validator
    expect(compose).toHaveBeenCalled();
    const composedMiddleware = (compose as any).mock.calls[0][0];
    expect(composedMiddleware.length).toBeGreaterThan(0);
  });

  test('should add response validator if schema provided', async () => {
    routeOptions.schema = {
      response: z.object({ message: z.string() }),
    };

    await executeHandler(ctx, routeOptions, params);

    // Verify createResponseValidator was called
    expect(createResponseValidator).toHaveBeenCalledWith(routeOptions.schema.response);

    // Verify compose included the validator
    expect(compose).toHaveBeenCalled();
    const composedMiddleware = (compose as any).mock.calls[0][0];
    expect(composedMiddleware.length).toBeGreaterThan(0);
  });

  test('should handle middleware that throws errors', async () => {
    const error = new Error('Middleware error');

    // Mock compose to throw an error
    (compose as any).mockImplementationOnce(() => {
      return async () => {
        throw error;
      };
    });

    // Expect the handler to propagate the error
    await expect(executeHandler(ctx, routeOptions, params)).rejects.toThrow(error);

    // Verify the handler was not called (since middleware threw)
    expect(routeOptions.handler).not.toHaveBeenCalled();
  });

  test('should handle handler that throws errors', async () => {
    const error = new Error('Handler error');
    routeOptions.handler = vi.fn().mockRejectedValue(error);

    // Expect the handler to propagate the error
    await expect(executeHandler(ctx, routeOptions, params)).rejects.toThrow(error);
  });

  test('should add both request and response validators when both schemas provided', async () => {
    routeOptions.schema = {
      params: z.object({ id: z.string() }),
      query: z.object({ sort: z.string().optional() }),
      body: z.object({ name: z.string() }),
      response: z.object({ message: z.string() }),
    };

    await executeHandler(ctx, routeOptions, params);

    // Verify both validators were created
    expect(createRequestValidator).toHaveBeenCalledWith(routeOptions.schema);
    expect(createResponseValidator).toHaveBeenCalledWith(routeOptions.schema.response);

    // Verify compose included both validators
    expect(compose).toHaveBeenCalled();
  });

  test('should skip middleware when its skip function returns true', async () => {
    // Create a middleware that should be skipped
    const skippedMiddleware = createMockMiddleware({
      name: 'skipped-middleware',
      execute: vi.fn().mockImplementation((_, next) => next()),
      skip: () => true, // This will cause the middleware to be skipped
    });

    // Create a normal middleware
    const normalMiddleware = createMockMiddleware({
      name: 'normal-middleware',
      execute: vi.fn().mockImplementation((_, next) => next()),
    });

    routeOptions.middleware = [skippedMiddleware, normalMiddleware];

    await executeHandler(ctx, routeOptions, params);

    // We're not actually testing the skipping logic here since that would be handled by the compose function
    // Instead, we're ensuring that middleware with skip functions are correctly passed to compose
    expect(compose).toHaveBeenCalled();
    const composedMiddleware = (compose as any).mock.calls[0][0];
    expect(composedMiddleware).toContain(skippedMiddleware);
    expect(composedMiddleware).toContain(normalMiddleware);
  });

  test('should handle middleware with debug mode enabled', async () => {
    // Create a middleware with debug mode enabled
    const debugMiddleware = createMockMiddleware({
      name: 'debug-middleware',
      execute: vi.fn().mockImplementation((_, next) => next()),
      debug: true,
    });

    routeOptions.middleware = [debugMiddleware];

    await executeHandler(ctx, routeOptions, params);

    // Again, not testing the debug behavior since that would be in the compose function
    // Just ensuring the middleware with debug flag is passed to compose
    expect(compose).toHaveBeenCalled();
    const composedMiddleware = (compose as any).mock.calls[0][0];
    expect(composedMiddleware).toContain(debugMiddleware);
  });
});
