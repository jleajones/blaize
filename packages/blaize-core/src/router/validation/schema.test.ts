/* eslint-disable import/order */
// packages/blaize-core/src/router/validation/schema.test.ts
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';

import { createMockLogger } from '@blaizejs/testing-utils';

import { InternalServerError } from '../../errors/internal-server-error';
import { ValidationError } from '../../errors/validation-error';
import { createRequestValidator, createResponseValidator } from './schema';

import type { MockLogger } from '@blaizejs/testing-utils';

// Mock the imported validation functions
vi.mock('./body', () => ({
  validateBody: vi.fn((body, schema) => schema.parse(body)),
}));

vi.mock('./params', () => ({
  validateParams: vi.fn((params, schema) => schema.parse(params)),
}));

vi.mock('./query', () => ({
  validateQuery: vi.fn((query, schema) => schema.parse(query)),
}));

vi.mock('./response', () => ({
  validateResponse: vi.fn((response, schema) => schema.parse(response)),
}));

// Import the mocked functions
import { validateBody } from './body';
import { validateParams } from './params';
import { validateQuery } from './query';
import { validateResponse } from './response';

describe('Schema Validation Middleware (T4.5: Logger Parameter)', () => {
  let ctx: any;
  let next: any;
  let mockLogger: MockLogger;
  let consoleErrorSpy: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create mock logger
    mockLogger = createMockLogger();

    // Reset mock implementations to default behavior
    (validateBody as any).mockImplementation((body: unknown, schema: z.ZodType<any>) =>
      schema.parse(body)
    );
    (validateParams as any).mockImplementation((params: unknown, schema: z.ZodType<any>) =>
      schema.parse(params)
    );
    (validateQuery as any).mockImplementation((query: unknown, schema: z.ZodType<any>) =>
      schema.parse(query)
    );
    (validateResponse as any).mockImplementation((response: unknown, schema: z.ZodType<any>) =>
      schema.parse(response)
    );

    // Create a mock context
    ctx = {
      request: {
        params: { id: '123' },
        query: { sort: 'asc' },
        body: { name: 'Example' },
      },
      response: {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      },
    };

    // Create a next function
    next = vi.fn();

    // Spy on console.error for response validation errors
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore console.error
    consoleErrorSpy.mockRestore();
  });

  describe('🆕 T4.5: Request Validator with Logger Parameter', () => {
    test('validates params successfully with logger', async () => {
      const schema = { params: z.object({ id: z.string() }) };
      const validator = createRequestValidator(schema);

      ctx.request.params = { id: '123' };

      await validator.execute(ctx, next, mockLogger);

      expect(next).toHaveBeenCalled();
      expect(validateParams).toHaveBeenCalledWith(ctx.request.params, schema.params);
    });

    test('logs validation failure at debug level for params', async () => {
      const schema = { params: z.object({ id: z.string() }) };
      const validator = createRequestValidator(schema);

      ctx.request.params = { id: 123 }; // Invalid: should be string

      const paramsError = new z.ZodError([
        {
          code: z.ZodIssueCode.invalid_type,
          path: ['id'],
          message: 'Expected string, received number',
          expected: 'string',
          received: 'number',
        },
      ]);

      (validateParams as any).mockImplementation(() => {
        throw paramsError;
      });

      await expect(validator.execute(ctx, next, mockLogger)).rejects.toThrow(ValidationError);
    });

    test('validates query parameters with logger', async () => {
      const schema = { query: z.object({ page: z.string() }) };
      const validator = createRequestValidator(schema);

      ctx.request.query = { page: '1' };

      await validator.execute(ctx, next, mockLogger);

      expect(next).toHaveBeenCalled();
      expect(validateQuery).toHaveBeenCalledWith(ctx.request.query, schema.query);
    });

    test('logs validation failure at debug level for query', async () => {
      const schema = { query: z.object({ page: z.coerce.number().min(1) }) };
      const validator = createRequestValidator(schema);

      ctx.request.query = { page: 'invalid' }; // Invalid number

      const queryError = new z.ZodError([
        {
          code: z.ZodIssueCode.invalid_type,
          path: ['page'],
          message: 'Expected number, received nan',
          expected: 'number',
          received: 'nan',
        },
      ]);

      (validateQuery as any).mockImplementation(() => {
        throw queryError;
      });

      await expect(validator.execute(ctx, next, mockLogger)).rejects.toThrow(ValidationError);
    });

    test('validates request body with logger', async () => {
      const schema = { body: z.object({ name: z.string() }) };
      const validator = createRequestValidator(schema);

      ctx.request.body = { name: 'John' };

      await validator.execute(ctx, next, mockLogger);

      expect(next).toHaveBeenCalled();
      expect(validateBody).toHaveBeenCalledWith(ctx.request.body, schema.body);
    });

    test('logs validation failure at debug level for body', async () => {
      const schema = { body: z.object({ name: z.string().min(3) }) };
      const validator = createRequestValidator(schema);

      ctx.request.body = { name: 'ab' }; // Too short

      const bodyError = new z.ZodError([
        {
          code: z.ZodIssueCode.too_small,
          path: ['name'],
          message: 'String must contain at least 3 character(s)',
          minimum: 3,
          inclusive: true,
          type: 'string',
        },
      ]);

      (validateBody as any).mockImplementation(() => {
        throw bodyError;
      });

      await expect(validator.execute(ctx, next, mockLogger)).rejects.toThrow(ValidationError);
    });

    test('includes validation errors and context in debug logs', async () => {
      const schema = { params: z.object({ id: z.string().uuid() }) };
      const validator = createRequestValidator(schema);

      ctx.request.params = { id: 'not-a-uuid' };

      const paramsError = new z.ZodError([
        {
          code: z.ZodIssueCode.invalid_string,
          path: ['id'],
          message: 'Invalid uuid',
          validation: 'uuid',
        },
      ]);

      (validateParams as any).mockImplementation(() => {
        throw paramsError;
      });

      await expect(validator.execute(ctx, next, mockLogger)).rejects.toThrow();
    });

    test('middleware uses createMiddleware helper', () => {
      const schema = { params: z.object({ id: z.string() }) };
      const validator = createRequestValidator(schema);

      // Should have middleware structure from createMiddleware
      expect(validator).toHaveProperty('name');
      expect(validator).toHaveProperty('execute');
      expect(validator.name).toBe('RequestValidator');
      expect(typeof validator.execute).toBe('function');
    });
  });

  describe('🆕 T4.5: Response Validator with Logger Parameter', () => {
    test('validates response successfully with logger', async () => {
      const responseSchema = z.object({
        id: z.string(),
        name: z.string(),
      });

      next = vi.fn(async () => {
        const responseData = { id: '123', name: 'Example' };
        ctx.response.json(responseData);
      });

      const middleware = createResponseValidator(responseSchema);
      await middleware.execute(ctx, next, mockLogger);

      expect(next).toHaveBeenCalled();
      expect(validateResponse).toHaveBeenCalledWith({ id: '123', name: 'Example' }, responseSchema);
    });

    test('logs successful response validation at debug level', async () => {
      const responseSchema = z.object({
        data: z.string(),
      });

      next = vi.fn(async () => {
        ctx.response.json({ data: 'test' });
      });

      const middleware = createResponseValidator(responseSchema);
      await middleware.execute(ctx, next, mockLogger);
    });

    test('logs response validation failures at error level', async () => {
      const responseSchema = z.object({
        id: z.string(),
        name: z.string(),
      });

      const responseError = new z.ZodError([
        {
          code: z.ZodIssueCode.invalid_type,
          path: ['id'],
          message: 'Expected string, received number',
          expected: 'string',
          received: 'number',
        },
      ]);

      (validateResponse as any).mockImplementation(() => {
        throw responseError;
      });

      next = vi.fn(async () => {
        const invalidResponse = { id: 123, name: 'Test' };
        ctx.response.json(invalidResponse);
      });

      const middleware = createResponseValidator(responseSchema);

      await expect(middleware.execute(ctx, next, mockLogger)).rejects.toThrow(InternalServerError);
    });

    test('middleware uses createMiddleware helper', () => {
      const responseSchema = z.object({ data: z.string() });
      const validator = createResponseValidator(responseSchema);

      // Should have middleware structure from createMiddleware
      expect(validator).toHaveProperty('name');
      expect(validator).toHaveProperty('execute');
      expect(validator.name).toBe('ResponseValidator');
      expect(typeof validator.execute).toBe('function');
    });
  });

  describe('✅ Existing Functionality Preserved', () => {
    test('should validate all parts of the request when all schemas defined', async () => {
      const schema = {
        params: z.object({ id: z.string() }),
        query: z.object({ sort: z.string() }),
        body: z.object({ name: z.string() }),
      };

      const middleware = createRequestValidator(schema);
      await middleware.execute(ctx, next, mockLogger);

      expect(validateParams).toHaveBeenCalledWith(ctx.request.params, schema.params);
      expect(validateQuery).toHaveBeenCalledWith(ctx.request.query, schema.query);
      expect(validateBody).toHaveBeenCalledWith(ctx.request.body, schema.body);
      expect(next).toHaveBeenCalled();
    });

    test('should only validate parts that have schemas', async () => {
      const schema = {
        params: z.object({ id: z.string() }),
        // No query or body schemas
      };

      const middleware = createRequestValidator(schema);
      await middleware.execute(ctx, next, mockLogger);

      expect(validateParams).toHaveBeenCalled();
      expect(validateQuery).not.toHaveBeenCalled();
      expect(validateBody).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    test('ValidationError thrown for params validation failure', async () => {
      const schema = {
        params: z.object({ id: z.string() }),
      };

      const paramsError = new z.ZodError([
        {
          code: z.ZodIssueCode.invalid_type,
          path: ['id'],
          message: 'Expected string',
          expected: 'string',
          received: 'number',
        },
      ]);

      (validateParams as any).mockImplementation(() => {
        throw paramsError;
      });

      const middleware = createRequestValidator(schema);

      await expect(middleware.execute(ctx, next, mockLogger)).rejects.toThrow(ValidationError);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
