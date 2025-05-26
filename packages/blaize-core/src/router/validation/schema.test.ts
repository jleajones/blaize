import { z } from 'zod';

import { createFormattedZodError } from '@blaizejs/testing-utils';

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
import { createRequestValidator, createResponseValidator, formatValidationError } from './schema';

describe('Schema Validation Middleware', () => {
  let ctx: any;
  let next: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Explicitly reset mock implementations to default behavior
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

  describe('createRequestValidator', () => {
    it('should validate all request components when schemas are provided', async () => {
      // Define schemas for all parts of the request
      const schema = {
        params: z.object({ id: z.string() }),
        query: z.object({ sort: z.string() }),
        body: z.object({ name: z.string() }),
      };

      // Create and execute the middleware
      const middleware = createRequestValidator(schema);
      await middleware.execute(ctx, next);

      // All validation functions should be called
      expect(validateParams).toHaveBeenCalledWith(ctx.request.params, schema.params);
      expect(validateQuery).toHaveBeenCalledWith(ctx.request.query, schema.query);
      expect(validateBody).toHaveBeenCalledWith(ctx.request.body, schema.body);

      // Next should be called (validation passed)
      expect(next).toHaveBeenCalled();

      // Status and json should not be called (no errors)
      expect(ctx.response.status).not.toHaveBeenCalled();
      expect(ctx.response.json).not.toHaveBeenCalled();
    });

    it('should only validate parts of the request that have schemas', async () => {
      // Define schema for only params
      const schema = {
        params: z.object({ id: z.string() }),
        // No query or body schemas
      };

      // Create and execute the middleware
      const middleware = createRequestValidator(schema);
      await middleware.execute(ctx, next);

      // Only params validation should be called
      expect(validateParams).toHaveBeenCalled();
      expect(validateQuery).not.toHaveBeenCalled();
      expect(validateBody).not.toHaveBeenCalled();

      // Next should be called (validation passed)
      expect(next).toHaveBeenCalled();
    });

    it('should handle validation errors in params', async () => {
      // Define schema with params validation
      const schema = {
        params: z.object({ id: z.string().uuid() }), // Requires UUID format
      };

      // Set up mock to throw validation error
      const paramsError = new z.ZodError([
        {
          code: z.ZodIssueCode.invalid_string,
          path: ['id'],
          message: 'Invalid UUID',
          validation: 'uuid',
        },
      ]);

      (validateParams as any).mockImplementation(() => {
        throw paramsError;
      });

      // Format the error for comparison - include the root _errors property
      const formattedError = createFormattedZodError({
        id: ['Invalid UUID'],
      });

      vi.spyOn(paramsError, 'format').mockReturnValue(formattedError);

      // Create and execute the middleware
      const middleware = createRequestValidator(schema);
      await middleware.execute(ctx, next);

      // Next should not be called (validation failed)
      expect(next).not.toHaveBeenCalled();

      // Error response should be sent
      expect(ctx.response.status).toHaveBeenCalledWith(400);
      expect(ctx.response.json).toHaveBeenCalledWith({
        error: 'Validation Error',
        details: {
          params: formattedError,
        },
      });
    });

    it('should handle validation errors in query', async () => {
      // Define schema with query validation
      const schema = {
        query: z.object({ limit: z.coerce.number().positive() }), // Requires positive number
      };

      // Override the mock context with invalid query
      ctx.request.query = { limit: '-5' };

      // Set up mock to throw validation error
      const queryError = new z.ZodError([
        {
          code: z.ZodIssueCode.too_small,
          path: ['limit'],
          message: 'Number must be greater than 0',
          minimum: 1,
          inclusive: true,
          type: 'number',
        },
      ]);

      (validateQuery as any).mockImplementation(() => {
        throw queryError;
      });

      // Format the error for comparison
      const formattedError = createFormattedZodError({
        limit: ['Number must be greater than 0'],
      });
      vi.spyOn(queryError, 'format').mockReturnValue(formattedError);

      // Create and execute the middleware
      const middleware = createRequestValidator(schema);
      await middleware.execute(ctx, next);

      // Next should not be called (validation failed)
      expect(next).not.toHaveBeenCalled();

      // Error response should be sent
      expect(ctx.response.status).toHaveBeenCalledWith(400);
      expect(ctx.response.json).toHaveBeenCalledWith({
        error: 'Validation Error',
        details: {
          query: formattedError,
        },
      });
    });

    it('should handle validation errors in body', async () => {
      // Define schema with body validation
      const schema = {
        body: z.object({
          email: z.string().email(), // Requires valid email
          age: z.number().int().positive(), // Requires positive integer
        }),
      };

      // Override the mock context with invalid body
      ctx.request.body = {
        email: 'not-an-email',
        age: -5,
      };

      // Set up mock to throw validation error
      const bodyError = new z.ZodError([
        {
          code: z.ZodIssueCode.invalid_string,
          path: ['email'],
          message: 'Invalid email',
          validation: 'email',
        },
        {
          code: z.ZodIssueCode.too_small,
          path: ['age'],
          message: 'Number must be greater than 0',
          minimum: 1,
          inclusive: true,
          type: 'number',
        },
      ]);

      (validateBody as any).mockImplementation(() => {
        throw bodyError;
      });

      // Format the error for comparison
      const formattedError = createFormattedZodError({
        email: ['Invalid email'],
        age: ['Number must be greater than 0'],
      });
      vi.spyOn(bodyError, 'format').mockReturnValue(formattedError);

      // Create and execute the middleware
      const middleware = createRequestValidator(schema);
      await middleware.execute(ctx, next);

      // Next should not be called (validation failed)
      expect(next).not.toHaveBeenCalled();

      // Error response should be sent
      expect(ctx.response.status).toHaveBeenCalledWith(400);
      expect(ctx.response.json).toHaveBeenCalledWith({
        error: 'Validation Error',
        details: {
          body: formattedError,
        },
      });
    });

    it('should handle multiple validation errors across params, query, and body', async () => {
      // Define schema for all parts
      const schema = {
        params: z.object({ id: z.string().uuid() }),
        query: z.object({ limit: z.coerce.number().positive() }),
        body: z.object({ email: z.string().email() }),
      };

      // Set up mocks to throw validation errors
      const paramsError = new z.ZodError([
        {
          code: z.ZodIssueCode.invalid_string,
          path: ['id'],
          message: 'Invalid UUID',
          validation: 'uuid',
        },
      ]);

      const queryError = new z.ZodError([
        {
          code: z.ZodIssueCode.too_small,
          path: ['limit'],
          message: 'Number must be greater than 0',
          minimum: 1,
          inclusive: true,
          type: 'number',
        },
      ]);

      const bodyError = new z.ZodError([
        {
          code: z.ZodIssueCode.invalid_string,
          path: ['email'],
          message: 'Invalid email',
          validation: 'email',
        },
      ]);

      (validateParams as any).mockImplementation(() => {
        throw paramsError;
      });
      (validateQuery as any).mockImplementation(() => {
        throw queryError;
      });
      (validateBody as any).mockImplementation(() => {
        throw bodyError;
      });

      // Format the errors for comparison
      const paramsFormatted = createFormattedZodError({
        id: ['Invalid UUID'],
      });
      const queryFormatted = createFormattedZodError({
        limit: ['Number must be greater than 0'],
      });
      const bodyFormatted = createFormattedZodError({
        email: ['Invalid email'],
      });

      vi.spyOn(paramsError, 'format').mockReturnValue(paramsFormatted);
      vi.spyOn(queryError, 'format').mockReturnValue(queryFormatted);
      vi.spyOn(bodyError, 'format').mockReturnValue(bodyFormatted);

      // Create and execute the middleware
      const middleware = createRequestValidator(schema);
      await middleware.execute(ctx, next);

      // Next should not be called (validation failed)
      expect(next).not.toHaveBeenCalled();

      // Error response should include all errors
      expect(ctx.response.status).toHaveBeenCalledWith(400);
      expect(ctx.response.json).toHaveBeenCalledWith({
        error: 'Validation Error',
        details: {
          params: paramsFormatted,
          query: queryFormatted,
          body: bodyFormatted,
        },
      });
    });

    it('should include debug flag in the middleware', () => {
      const middleware = createRequestValidator({}, true);
      expect(middleware.debug).toBe(true);

      const middlewareNoDebug = createRequestValidator({});
      expect(middlewareNoDebug.debug).toBe(false);
    });

    it('should validate body even when request body is undefined', async () => {
      // Define schema with required body
      const schema = {
        body: z.object({
          name: z.string(),
          email: z.string().email(),
        }),
      };

      // Set request body to undefined (simulating missing body)
      ctx.request.body = undefined;

      // Set up mock to throw validation error for undefined body
      const bodyError = new z.ZodError([
        {
          code: z.ZodIssueCode.invalid_type,
          path: [],
          message: 'Expected object, received undefined',
          expected: 'object',
          received: 'undefined',
        },
      ]);

      (validateBody as any).mockImplementation(() => {
        throw bodyError;
      });

      // Format the error for comparison
      const formattedError = createFormattedZodError({
        _errors: ['Expected object, received undefined'],
      });
      vi.spyOn(bodyError, 'format').mockReturnValue(formattedError);

      // Create and execute the middleware
      const middleware = createRequestValidator(schema);
      await middleware.execute(ctx, next);

      // validateBody should still be called even with undefined body
      expect(validateBody).toHaveBeenCalledWith(undefined, schema.body);

      // Next should not be called (validation failed)
      expect(next).not.toHaveBeenCalled();

      // Error response should be sent
      expect(ctx.response.status).toHaveBeenCalledWith(400);
      expect(ctx.response.json).toHaveBeenCalledWith({
        error: 'Validation Error',
        details: {
          body: formattedError,
        },
      });
    });

    it('should validate body even when request body is null', async () => {
      // Define schema with required body
      const schema = {
        body: z.object({
          name: z.string(),
        }),
      };

      // Set request body to null
      ctx.request.body = null;

      // Set up mock to throw validation error for null body
      const bodyError = new z.ZodError([
        {
          code: z.ZodIssueCode.invalid_type,
          path: [],
          message: 'Expected object, received null',
          expected: 'object',
          received: 'null',
        },
      ]);

      (validateBody as any).mockImplementation(() => {
        throw bodyError;
      });

      // Format the error for comparison
      const formattedError = createFormattedZodError({
        _errors: ['Expected object, received null'],
      });
      vi.spyOn(bodyError, 'format').mockReturnValue(formattedError);

      // Create and execute the middleware
      const middleware = createRequestValidator(schema);
      await middleware.execute(ctx, next);

      // validateBody should still be called even with null body
      expect(validateBody).toHaveBeenCalledWith(null, schema.body);

      // Next should not be called (validation failed)
      expect(next).not.toHaveBeenCalled();

      // Error response should be sent
      expect(ctx.response.status).toHaveBeenCalledWith(400);
      expect(ctx.response.json).toHaveBeenCalledWith({
        error: 'Validation Error',
        details: {
          body: formattedError,
        },
      });
    });

    it('should validate body even when request body is an empty object', async () => {
      // Define schema with required fields
      const schema = {
        body: z.object({
          name: z.string(),
          email: z.string().email(),
        }),
      };

      // Set request body to empty object
      ctx.request.body = {};

      // Set up mock to throw validation error for missing required fields
      const bodyError = new z.ZodError([
        {
          code: z.ZodIssueCode.invalid_type,
          path: ['name'],
          message: 'Required',
          expected: 'string',
          received: 'undefined',
        },
        {
          code: z.ZodIssueCode.invalid_type,
          path: ['email'],
          message: 'Required',
          expected: 'string',
          received: 'undefined',
        },
      ]);

      (validateBody as any).mockImplementation(() => {
        throw bodyError;
      });

      // Format the error for comparison
      const formattedError = createFormattedZodError({
        name: ['Required'],
        email: ['Required'],
      });
      vi.spyOn(bodyError, 'format').mockReturnValue(formattedError);

      // Create and execute the middleware
      const middleware = createRequestValidator(schema);
      await middleware.execute(ctx, next);

      // validateBody should be called with empty object
      expect(validateBody).toHaveBeenCalledWith({}, schema.body);

      // Next should not be called (validation failed)
      expect(next).not.toHaveBeenCalled();

      // Error response should be sent
      expect(ctx.response.status).toHaveBeenCalledWith(400);
      expect(ctx.response.json).toHaveBeenCalledWith({
        error: 'Validation Error',
        details: {
          body: formattedError,
        },
      });
    });

    it('should skip body validation when no body schema is provided', async () => {
      // Define schema without body validation
      const schema = {
        params: z.object({ id: z.string() }),
        // No body schema
      };

      // Set request body to undefined
      ctx.request.body = undefined;
      ctx.request.params = { id: 'jason' };

      // Create and execute the middleware
      const middleware = createRequestValidator(schema);
      await middleware.execute(ctx, next);

      // validateBody should NOT be called when no schema provided
      expect(validateBody).not.toHaveBeenCalled();

      // Next should be called (no validation needed)
      expect(next).toHaveBeenCalled();

      // No error response should be sent
      expect(ctx.response.status).not.toHaveBeenCalled();
      expect(ctx.response.json).not.toHaveBeenCalled();
    });
  });

  describe('createResponseValidator', () => {
    it('should override and restore the json method', async () => {
      // Define a simple response schema
      const responseSchema = z.object({
        id: z.string(),
        name: z.string(),
      });

      // Get reference to original json method
      const originalJson = ctx.response.json;

      // Create and execute the middleware
      const middleware = createResponseValidator(responseSchema);
      await middleware.execute(ctx, next);

      // Next should be called
      expect(next).toHaveBeenCalled();

      // Json method should be different after execution (overridden)
      expect(ctx.response.json).not.toBe(originalJson);

      // Call the new json method
      const responseData = { id: '123', name: 'Example' };
      ctx.response.json(responseData);

      // Should validate response
      expect(validateResponse).toHaveBeenCalledWith(responseData, responseSchema);

      // Original json should be called with validated data
      expect(originalJson).toHaveBeenCalledWith(responseData, undefined);

      // Json method should be restored to original
      expect(ctx.response.json).toBe(originalJson);
    });

    it('should handle validation errors in response data', async () => {
      // Define schema with validation rules
      const responseSchema = z.object({
        id: z.string().uuid(),
        createdAt: z.string().datetime(),
      });

      // Set up mock to throw validation error
      const responseError = new Error('Response validation failed');
      (validateResponse as any).mockImplementation(() => {
        throw responseError;
      });

      // Create and execute the middleware
      const middleware = createResponseValidator(responseSchema);
      await middleware.execute(ctx, next);

      // Get reference to the new json method
      const newJson = ctx.response.json;

      // Test with invalid response data
      const invalidData = {
        id: 'not-a-uuid',
        createdAt: 'not-a-date',
      };

      // Call the overridden json method
      newJson(invalidData);

      // Should try to validate
      expect(validateResponse).toHaveBeenCalledWith(invalidData, responseSchema);

      // Should log error
      expect(consoleErrorSpy).toHaveBeenCalledWith('Response validation error:', responseError);

      // Should send error response
      expect(ctx.response.status).toHaveBeenCalledWith(500);
      expect(ctx.response.json).toHaveBeenCalledWith({
        error: 'Internal Server Error',
        message: 'Response validation failed',
      });
    });

    it('should keep method overridden until json is called', async () => {
      const responseSchema = z.object({
        id: z.string(),
        name: z.string(),
      });

      const originalJson = ctx.response.json;

      // Create and execute the middleware
      const middleware = createResponseValidator(responseSchema);
      await middleware.execute(ctx, next);

      // Method should be overridden after middleware execution
      expect(ctx.response.json).not.toBe(originalJson);

      // Method should stay overridden until it's actually called
      // (This is the expected behavior - no automatic restoration)
      expect(ctx.response.json).not.toBe(originalJson);

      // When we do call it, it should restore itself
      ctx.response.json({ id: '123', name: 'test' });
      expect(ctx.response.json).toBe(originalJson);
    });

    it('should include debug flag in the middleware', () => {
      const responseSchema = z.object({ id: z.string() });

      const middleware = createResponseValidator(responseSchema, true);
      expect(middleware.debug).toBe(true);

      const middlewareNoDebug = createResponseValidator(responseSchema);
      expect(middlewareNoDebug.debug).toBe(false);
    });

    it('should validate complex response objects', async () => {
      // Define a more complex schema
      const userSchema = z.object({
        id: z.string(),
        name: z.string(),
        email: z.string().email(),
      });

      const responseSchema = z.object({
        data: z.array(userSchema),
        meta: z.object({
          total: z.number(),
          page: z.number(),
          pageSize: z.number(),
        }),
      });

      // Set up successful validation
      (validateResponse as any).mockImplementation((data: unknown) => data);

      // Create and execute the middleware
      const middleware = createResponseValidator(responseSchema);
      await middleware.execute(ctx, next);

      // Get reference to the new json method
      const newJson = ctx.response.json;

      // Create sample response data
      const responseData = {
        data: [
          { id: '1', name: 'User 1', email: 'user1@example.com' },
          { id: '2', name: 'User 2', email: 'user2@example.com' },
        ],
        meta: {
          total: 10,
          page: 1,
          pageSize: 2,
        },
      };

      // Call the new json method
      newJson(responseData);

      // Should validate response with schema
      expect(validateResponse).toHaveBeenCalledWith(responseData, responseSchema);
    });
  });

  describe('formatValidationError', () => {
    it('should format Zod errors using their format method', () => {
      // Create a mock Zod error
      const zodError = new Error('Validation failed');
      const formattedError = { field: { _errors: ['Invalid field'] } };
      (zodError as any).format = vi.fn().mockReturnValue(formattedError);

      // Format the error
      const result = formatValidationError(zodError);

      // Should call format method
      expect((zodError as any).format).toHaveBeenCalled();

      // Should return formatted error
      expect(result).toBe(formattedError);
    });

    it('should return error message for regular Error objects', () => {
      // Create standard error
      const error = new Error('Standard error message');

      // Format the error
      const result = formatValidationError(error);

      // Should return error message
      expect(result).toBe('Standard error message');
    });

    it('should convert non-Error values to strings', () => {
      // Test with various types
      expect(formatValidationError('string error')).toBe('string error');
      expect(formatValidationError(123)).toBe('123');
      expect(formatValidationError(null)).toBe('null');
      expect(formatValidationError(undefined)).toBe('undefined');
      expect(formatValidationError({ custom: 'object' })).toBe('[object Object]');
    });
  });

  describe('Integration testing', () => {
    it('should compose request and response validation middleware correctly', async () => {
      // Define schemas
      const requestSchema = {
        params: z.object({ id: z.string() }),
        query: z.object({ format: z.string() }),
        body: z.object({ data: z.string() }),
      };

      const responseSchema = z.object({
        id: z.string(),
        data: z.string(),
        format: z.string(),
        timestamp: z.number(),
      });

      // Create middlewares
      const requestValidator = createRequestValidator(requestSchema);
      const responseValidator = createResponseValidator(responseSchema);

      // Set up successful validations
      (validateParams as any).mockImplementation((data: unknown) => data);
      (validateQuery as any).mockImplementation((data: unknown) => data);
      (validateBody as any).mockImplementation((data: unknown) => data);
      (validateResponse as any).mockImplementation((data: unknown) => data);

      // Execute request validator
      await requestValidator.execute(ctx, next);

      // Next should be called (validation passed)
      expect(next).toHaveBeenCalledTimes(1);

      // Reset next
      next.mockReset();

      // Execute response validator
      await responseValidator.execute(ctx, next);

      // Next should be called (registration succeeded)
      expect(next).toHaveBeenCalledTimes(1);

      // Get reference to the new json method
      const newJson = ctx.response.json;

      // Create response data combining request data
      const responseData = {
        id: ctx.request.params.id,
        format: ctx.request.query.format,
        data: ctx.request.body.data,
        timestamp: Date.now(),
      };

      // Send the response
      newJson(responseData);

      // Should validate response
      expect(validateResponse).toHaveBeenCalledWith(responseData, responseSchema);
    });
  });
});
