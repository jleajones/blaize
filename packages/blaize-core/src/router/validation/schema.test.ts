import { z } from 'zod';

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
import { InternalServerError } from '../../errors/internal-server-error';
import { ValidationError } from '../../errors/validation-error';

describe('Schema Validation Middleware (Task 1.6 Updates)', () => {
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

  describe('🆕 Task 1.6: ValidationError Integration', () => {
    test('ValidationError thrown for invalid params with structured field errors', async () => {
      // Arrange
      const schema = {
        params: z.object({ id: z.string().uuid() }),
      };

      const paramsError = new z.ZodError([
        {
          code: z.ZodIssueCode.invalid_string,
          path: ['id'],
          message: 'Invalid UUID format',
          validation: 'uuid',
        },
      ]);

      (validateParams as any).mockImplementation(() => {
        throw paramsError;
      });

      // Act & Assert
      const middleware = createRequestValidator(schema);

      await expect(middleware.execute(ctx, next)).rejects.toThrow(ValidationError);

      // Verify next was not called
      expect(next).not.toHaveBeenCalled();
    });

    test('ValidationError thrown for invalid query with structured field errors', async () => {
      // Arrange
      const schema = {
        query: z.object({ limit: z.coerce.number().positive() }),
      };

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

      // Act & Assert
      const middleware = createRequestValidator(schema);

      await expect(middleware.execute(ctx, next)).rejects.toThrow(ValidationError);

      // Verify next was not called
      expect(next).not.toHaveBeenCalled();
    });

    test('ValidationError thrown for invalid body with structured field errors', async () => {
      // Arrange
      const schema = {
        body: z.object({
          email: z.string().email(),
          age: z.number().positive(),
        }),
      };

      const bodyError = new z.ZodError([
        {
          code: z.ZodIssueCode.invalid_string,
          path: ['email'],
          message: 'Invalid email format',
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

      // Act & Assert
      const middleware = createRequestValidator(schema);

      await expect(middleware.execute(ctx, next)).rejects.toThrow(ValidationError);

      // Verify next was not called
      expect(next).not.toHaveBeenCalled();
    });

    test('ValidationError contains structured error details', async () => {
      // Arrange
      const schema = {
        params: z.object({ id: z.string().uuid() }),
      };

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

      // Act & Assert
      const middleware = createRequestValidator(schema);

      try {
        await middleware.execute(ctx, next);
        expect.fail('Expected ValidationError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);

        // Verify error details structure matches the interface
        const validationError = error as ValidationError;
        expect(validationError.title).toBe('Request validation failed');
        expect(validationError.details).toEqual({
          fields: [{ field: 'id', messages: ['Invalid UUID'] }],
          errorCount: 1,
          section: 'params',
        });
      }

      expect(next).not.toHaveBeenCalled();
    });

    test('ValidationError with multiple field errors in body', async () => {
      // Arrange
      const schema = {
        body: z.object({
          name: z.string().min(3),
          email: z.string().email(),
          age: z.number().min(18),
        }),
      };

      const bodyError = new z.ZodError([
        {
          code: z.ZodIssueCode.too_small,
          path: ['name'],
          message: 'String must contain at least 3 character(s)',
          minimum: 3,
          inclusive: true,
          type: 'string',
        },
        {
          code: z.ZodIssueCode.invalid_string,
          path: ['email'],
          message: 'Invalid email',
          validation: 'email',
        },
        {
          code: z.ZodIssueCode.too_small,
          path: ['age'],
          message: 'Number must be greater than or equal to 18',
          minimum: 18,
          inclusive: true,
          type: 'number',
        },
      ]);

      (validateBody as any).mockImplementation(() => {
        throw bodyError;
      });

      // Act & Assert
      const middleware = createRequestValidator(schema);

      try {
        await middleware.execute(ctx, next);
        expect.fail('Expected ValidationError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);

        const validationError = error as ValidationError;
        expect(validationError.title).toBe('Request validation failed');
        expect(validationError.details).toEqual({
          fields: [
            { field: 'name', messages: ['String must contain at least 3 character(s)'] },
            { field: 'email', messages: ['Invalid email'] },
            { field: 'age', messages: ['Number must be greater than or equal to 18'] },
          ],
          errorCount: 3,
          section: 'body',
        });
      }

      expect(next).not.toHaveBeenCalled();
    });

    test('ValidationError with nested field paths', async () => {
      // Arrange
      const schema = {
        body: z.object({
          user: z.object({
            profile: z.object({
              email: z.string().email(),
            }),
          }),
        }),
      };

      const bodyError = new z.ZodError([
        {
          code: z.ZodIssueCode.invalid_string,
          path: ['user', 'profile', 'email'],
          message: 'Invalid email',
          validation: 'email',
        },
      ]);

      (validateBody as any).mockImplementation(() => {
        throw bodyError;
      });

      // Act & Assert
      const middleware = createRequestValidator(schema);

      try {
        await middleware.execute(ctx, next);
        expect.fail('Expected ValidationError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);

        const validationError = error as ValidationError;
        expect(validationError.details).toEqual({
          fields: [{ field: 'user.profile.email', messages: ['Invalid email'] }],
          errorCount: 1,
          section: 'body',
        });
      }

      expect(next).not.toHaveBeenCalled();
    });

    test('ValidationError throws immediately on first failure (params before query)', async () => {
      // Arrange - both params and query have schemas, but params will fail first
      const schema = {
        params: z.object({ id: z.string().uuid() }),
        query: z.object({ limit: z.coerce.number().positive() }),
      };

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

      // Act & Assert
      const middleware = createRequestValidator(schema);

      try {
        await middleware.execute(ctx, next);
        expect.fail('Expected ValidationError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);

        const validationError = error as ValidationError;
        expect(validationError.details).toEqual({
          fields: [{ field: 'id', messages: ['Invalid UUID'] }],
          errorCount: 1,
          section: 'params',
        });
      }

      // Verify that query validation was never called because params failed first
      expect(validateParams).toHaveBeenCalled();
      expect(validateQuery).not.toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    test('ValidationError for query when params pass but query fails', async () => {
      // Arrange
      const schema = {
        params: z.object({ id: z.string() }),
        query: z.object({ limit: z.coerce.number().positive() }),
      };

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

      // Params pass, query fails
      (validateQuery as any).mockImplementation(() => {
        throw queryError;
      });

      // Act & Assert
      const middleware = createRequestValidator(schema);

      try {
        await middleware.execute(ctx, next);
        expect.fail('Expected ValidationError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);

        const validationError = error as ValidationError;
        expect(validationError.details).toEqual({
          fields: [{ field: 'limit', messages: ['Number must be greater than 0'] }],
          errorCount: 1,
          section: 'query',
        });
      }

      // Verify that params passed but query failed
      expect(validateParams).toHaveBeenCalled();
      expect(validateQuery).toHaveBeenCalled();
      expect(validateBody).not.toHaveBeenCalled(); // Body validation never reached
      expect(next).not.toHaveBeenCalled();
    });

    test('No ValidationError when all fields are valid', async () => {
      // Arrange
      const schema = {
        params: z.object({ id: z.string() }),
        query: z.object({ sort: z.string() }),
        body: z.object({ name: z.string() }),
      };

      // All validations should pass (using default mock implementations)

      // Act
      const middleware = createRequestValidator(schema);
      await middleware.execute(ctx, next);

      // Assert
      expect(next).toHaveBeenCalled();
      expect(validateParams).toHaveBeenCalledWith(ctx.request.params, schema.params);
      expect(validateQuery).toHaveBeenCalledWith(ctx.request.query, schema.query);
      expect(validateBody).toHaveBeenCalledWith(ctx.request.body, schema.body);
    });
  });

  describe('✅ Preserved Existing Behavior', () => {
    test('should validate all request components when schemas are provided', async () => {
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
    });

    test('should only validate parts of the request that have schemas', async () => {
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

    test('should skip body validation when no body schema is provided', async () => {
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
    });

    test('middleware structure preserved with name, execute, and debug', () => {
      const schema = {
        params: z.object({ id: z.string() }),
      };

      const middleware = createRequestValidator(schema, true);

      expect(middleware).toEqual({
        name: 'RequestValidator',
        execute: expect.any(Function),
        debug: true,
      });

      const responseMiddleware = createResponseValidator(z.object({ test: z.string() }), false);

      expect(responseMiddleware).toEqual({
        name: 'ResponseValidator',
        execute: expect.any(Function),
        debug: false,
      });
    });
  });

  describe('🔄 Backward Compatibility', () => {
    test('formatValidationError deprecated but still works', () => {
      // Test with ZodError-like object
      const mockZodError = {
        format: vi.fn().mockReturnValue({ field: { _errors: ['Error message'] } }),
      };

      const result = formatValidationError(mockZodError);
      expect(mockZodError.format).toHaveBeenCalled();
      expect(result).toEqual({ field: { _errors: ['Error message'] } });

      // Test with regular Error
      const regularError = new Error('Regular error message');
      const errorResult = formatValidationError(regularError);
      expect(errorResult).toBe('Regular error message');

      // Test with string
      const stringResult = formatValidationError('String error');
      expect(stringResult).toBe('String error');
    });
  });

  describe('🆕 Task 1.6: InternalServerError for Response Validation', () => {
    test('InternalServerError thrown for response validation failures', async () => {
      // Arrange
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

      // Act & Assert
      const middleware = createResponseValidator(responseSchema);
      await middleware.execute(ctx, next);

      // Try to call the overridden json method with invalid data
      const invalidResponse = { id: 123, name: 'Test' }; // id should be string, not number

      try {
        ctx.response.json(invalidResponse);
        expect.fail('Expected InternalServerError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(InternalServerError);
      }
    });

    test('InternalServerError contains structured error details', async () => {
      // Arrange
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

      // Act & Assert
      const middleware = createResponseValidator(responseSchema);
      await middleware.execute(ctx, next);

      const invalidResponse = { id: 123, name: 'Test' };

      try {
        ctx.response.json(invalidResponse);
        expect.fail('Expected InternalServerError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(InternalServerError);

        const internalError = error as InternalServerError;
        expect(internalError.title).toBe('Response validation failed');
        expect(internalError.details).toEqual({
          responseSchema: responseSchema.description || 'Unknown schema',
          validationError: [{ field: 'id', messages: ['Expected string, received number'] }],
          originalResponse: invalidResponse,
        });
      }
    });
  });

  describe('✅ Response Validation (Updated)', () => {
    test('response validation still works as before', async () => {
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

      // Json method should be overridden
      expect(ctx.response.json).not.toBe(originalJson);

      // Call the new json method with valid data
      const responseData = { id: '123', name: 'Example' };
      ctx.response.json(responseData);

      // Should validate response
      expect(validateResponse).toHaveBeenCalledWith(responseData, responseSchema);

      // Original json should be called with validated data
      expect(originalJson).toHaveBeenCalledWith(responseData, undefined);
    });
  });
});
