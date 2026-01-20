/* eslint-disable import/order */
// packages/blaize-core/src/router/validation/schema.test.ts
import { z } from 'zod';

import { createMockEventBus, createMockLogger } from '@blaizejs/testing-utils';

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

vi.mock('./files', () => ({
  validateFiles: vi.fn((files, schema) => schema.parse(files)),
}));

// Import the mocked functions
import { validateBody } from './body';
import { validateFiles } from './files';
import { validateParams } from './params';
import { validateQuery } from './query';
import { validateResponse } from './response';
import type { EventSchemas, TypedEventBus } from '@blaize-types';

describe('Schema Validation Middleware (T4.5: Logger Parameter)', () => {
  let ctx: any;
  let next: any;
  let mockLogger: MockLogger;
  let consoleErrorSpy: any;
  let mockEventBus: TypedEventBus<EventSchemas>;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create mock logger
    mockLogger = createMockLogger();
    mockEventBus = createMockEventBus();

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
    (validateFiles as any).mockImplementation((files: unknown, schema: z.ZodType<any>) =>
      schema.parse(files)
    );

    // Create a mock context
    ctx = {
      request: {
        params: { id: '123' },
        query: { sort: 'asc' },
        body: { name: 'Example' },
        header: vi.fn(name => {
          if (name.toLowerCase() === 'content-type') {
            return 'multipart/form-data; boundary=----WebKitFormBoundary';
          }
          return undefined;
        }),
        files: {},
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

      await validator.execute({ ctx, next, logger: mockLogger, eventBus: mockEventBus });

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

      await expect(
        validator.execute({ ctx, next, logger: mockLogger, eventBus: mockEventBus })
      ).rejects.toThrow(ValidationError);
    });

    test('validates query parameters with logger', async () => {
      const schema = { query: z.object({ page: z.string() }) };
      const validator = createRequestValidator(schema);

      ctx.request.query = { page: '1' };

      await validator.execute({ ctx, next, logger: mockLogger, eventBus: mockEventBus });

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

      await expect(
        validator.execute({ ctx, next, logger: mockLogger, eventBus: mockEventBus })
      ).rejects.toThrow(ValidationError);
    });

    test('validates request body with logger', async () => {
      const schema = { body: z.object({ name: z.string() }) };
      const validator = createRequestValidator(schema);

      ctx.request.body = { name: 'John' };

      await validator.execute({ ctx, next, logger: mockLogger, eventBus: mockEventBus });

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

      await expect(
        validator.execute({ ctx, next, logger: mockLogger, eventBus: mockEventBus })
      ).rejects.toThrow(ValidationError);
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

      await expect(
        validator.execute({ ctx, next, logger: mockLogger, eventBus: mockEventBus })
      ).rejects.toThrow();
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
      await middleware.execute({ ctx, next, logger: mockLogger, eventBus: mockEventBus });

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
      await middleware.execute({ ctx, next, logger: mockLogger, eventBus: mockEventBus });
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

      await expect(
        middleware.execute({ ctx, next, logger: mockLogger, eventBus: mockEventBus })
      ).rejects.toThrow(InternalServerError);
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
      await middleware.execute({ ctx, next, logger: mockLogger, eventBus: mockEventBus });

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
      await middleware.execute({ ctx, next, logger: mockLogger, eventBus: mockEventBus });

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

      await expect(
        middleware.execute({ ctx, next, logger: mockLogger, eventBus: mockEventBus })
      ).rejects.toThrow(ValidationError);
      expect(next).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // 🆕 Task [T1.5]: File Validation Tests
  // ============================================================================
  // Add these tests to the existing schema.test.ts file

  describe('🆕 T1.5: File Validation with Request Validator', () => {
    // Mock UploadedFile helper
    const createMockFile = (overrides?: any) => ({
      fieldname: 'file',
      originalname: 'test.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      size: 1024 * 100, // 100KB
      buffer: Buffer.from('fake data'),
      ...overrides,
    });

    beforeEach(() => {
      // Add header method to context
      ctx.request.header = vi.fn((name: string) => {
        if (name.toLowerCase() === 'content-type') {
          return 'multipart/form-data; boundary=----WebKitFormBoundary';
        }
        return undefined;
      });

      // Add files to request
      ctx.request.files = {};
    });

    // ==========================================================================
    // File Validation Tests
    // ==========================================================================

    describe('File Validation', () => {
      test('should validate files against schema successfully', async () => {
        const schema = {
          files: z.object({
            avatar: z.any(),
          }),
        };

        ctx.request.files = {
          avatar: createMockFile({ originalname: 'profile.jpg' }),
        };

        const validator = createRequestValidator(schema);

        await validator.execute({ ctx, next, logger: mockLogger, eventBus: mockEventBus });

        expect(validateFiles).toHaveBeenCalledWith(ctx.request.files, schema.files);
        expect(next).toHaveBeenCalled();
      });

      test('should throw ValidationError with section="files" on validation failure', async () => {
        const schema = {
          files: z.object({
            avatar: z.any(),
          }),
        };

        ctx.request.files = {
          avatar: createMockFile(),
        };

        const filesError = new z.ZodError([
          {
            code: z.ZodIssueCode.custom,
            path: ['avatar'],
            message: 'File size exceeds maximum',
          },
        ]);

        (validateFiles as any).mockImplementation(() => {
          throw filesError;
        });

        const validator = createRequestValidator(schema);

        try {
          await validator.execute({ ctx, next, logger: mockLogger, eventBus: mockEventBus });
          expect(true).toBe(false);
        } catch (error: any) {
          expect(error).toBeInstanceOf(ValidationError);
          expect(error.details.section).toBe('files');
          expect(error.details.fields[0].field).toBe('avatar');
          expect(next).not.toHaveBeenCalled();
        }
      });

      test('should handle empty files object and let Zod enforce required', async () => {
        const schema = {
          files: z.object({
            avatar: z.any(), // Required field
          }),
        };

        ctx.request.files = {}; // Empty - no files uploaded

        const filesError = new z.ZodError([
          {
            code: z.ZodIssueCode.invalid_type,
            path: ['avatar'],
            message: 'Required',
            expected: 'object',
            received: 'undefined',
          },
        ]);

        (validateFiles as any).mockImplementation(() => {
          throw filesError;
        });

        const validator = createRequestValidator(schema);

        try {
          await validator.execute({ ctx, next, logger: mockLogger, eventBus: mockEventBus });
          expect(true).toBe(false);
        } catch (error: any) {
          expect(error).toBeInstanceOf(ValidationError);
          expect(error.details.section).toBe('files');
        }
      });

      test('should validate multiple file fields', async () => {
        const schema = {
          files: z.object({
            avatar: z.any(),
            resume: z.any(),
          }),
        };

        ctx.request.files = {
          avatar: createMockFile({ originalname: 'photo.jpg' }),
          resume: createMockFile({ originalname: 'cv.pdf', mimetype: 'application/pdf' }),
        };

        const validator = createRequestValidator(schema);

        await validator.execute({ ctx, next, logger: mockLogger, eventBus: mockEventBus });

        expect(validateFiles).toHaveBeenCalledWith(ctx.request.files, schema.files);
        expect(next).toHaveBeenCalled();
      });

      test('should validate file arrays', async () => {
        const schema = {
          files: z.object({
            photos: z.array(z.any()),
          }),
        };

        ctx.request.files = {
          photos: [
            createMockFile({ originalname: 'photo1.jpg' }),
            createMockFile({ originalname: 'photo2.jpg' }),
          ],
        };

        const validator = createRequestValidator(schema);

        await validator.execute({ ctx, next, logger: mockLogger, eventBus: mockEventBus });

        expect(validateFiles).toHaveBeenCalled();
        expect(next).toHaveBeenCalled();
      });
    });

    // ==========================================================================
    // Integration Tests (Body + Files)
    // ==========================================================================

    describe('Integration: Body + Files Validation', () => {
      test('should validate both body and files together', async () => {
        const schema = {
          body: z.object({
            name: z.string(),
            description: z.string().optional(),
          }),
          files: z.object({
            avatar: z.any(),
          }),
        };

        ctx.request.body = {
          name: 'John Doe',
          description: 'Profile update',
        };

        ctx.request.files = {
          avatar: createMockFile(),
        };

        const validator = createRequestValidator(schema);

        await validator.execute({ ctx, next, logger: mockLogger, eventBus: mockEventBus });

        expect(validateBody).toHaveBeenCalledWith(ctx.request.body, schema.body);
        expect(validateFiles).toHaveBeenCalledWith(ctx.request.files, schema.files);
        expect(next).toHaveBeenCalled();
      });

      test('should validate params + query + body + files together', async () => {
        const schema = {
          params: z.object({ userId: z.string() }),
          query: z.object({ update: z.string().optional() }),
          body: z.object({ name: z.string() }),
          files: z.object({ avatar: z.any() }),
        };

        ctx.request.params = { userId: 'user-123' };
        ctx.request.query = { update: 'profile' };
        ctx.request.body = { name: 'Jane' };
        ctx.request.files = { avatar: createMockFile() };

        const validator = createRequestValidator(schema);

        await validator.execute({ ctx, next, logger: mockLogger, eventBus: mockEventBus });

        expect(validateParams).toHaveBeenCalledWith(ctx.request.params, schema.params);
        expect(validateQuery).toHaveBeenCalledWith(ctx.request.query, schema.query);
        expect(validateBody).toHaveBeenCalledWith(ctx.request.body, schema.body);
        expect(validateFiles).toHaveBeenCalledWith(ctx.request.files, schema.files);
        expect(next).toHaveBeenCalled();
      });

      test('should stop at first validation failure (params before files)', async () => {
        const schema = {
          params: z.object({ id: z.string().uuid() }),
          files: z.object({ avatar: z.any() }),
        };

        ctx.request.params = { id: 'invalid-uuid' };
        ctx.request.files = { avatar: createMockFile() };

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

        const validator = createRequestValidator(schema);

        await expect(
          validator.execute({ ctx, next, logger: mockLogger, eventBus: mockEventBus })
        ).rejects.toThrow(ValidationError);

        // Files validation should not be called (params failed first)
        expect(validateParams).toHaveBeenCalled();
        expect(validateFiles).not.toHaveBeenCalled();
        expect(next).not.toHaveBeenCalled();
      });

      test('should validate files after body succeeds', async () => {
        const schema = {
          body: z.object({ name: z.string() }),
          files: z.object({ avatar: z.any() }),
        };

        ctx.request.body = { name: 'John' };
        ctx.request.files = { avatar: createMockFile() };

        const validator = createRequestValidator(schema);

        await validator.execute({ ctx, next, logger: mockLogger, eventBus: mockEventBus });

        // Verify order: body validated first, then files
        const bodyCallOrder = (validateBody as any).mock.invocationCallOrder[0];
        const filesCallOrder = (validateFiles as any).mock.invocationCallOrder[0];

        expect(bodyCallOrder).toBeLessThan(filesCallOrder);
        expect(next).toHaveBeenCalled();
      });
    });

    // ==========================================================================
    // Error Message Quality Tests
    // ==========================================================================

    describe('Error Message Quality', () => {
      test('should include detailed field errors for file validation', async () => {
        const schema = {
          files: z.object({
            avatar: z.any(),
            resume: z.any(),
          }),
        };

        ctx.request.files = {
          avatar: createMockFile(),
          resume: createMockFile(),
        };

        const filesError = new z.ZodError([
          {
            code: z.ZodIssueCode.custom,
            path: ['avatar'],
            message: 'File size exceeds maximum 5MB',
          },
          {
            code: z.ZodIssueCode.custom,
            path: ['resume'],
            message: 'Invalid file type "image/jpeg". Accepted types: application/pdf',
          },
        ]);

        (validateFiles as any).mockImplementation(() => {
          throw filesError;
        });

        const validator = createRequestValidator(schema);

        try {
          await validator.execute({ ctx, next, logger: mockLogger, eventBus: mockEventBus });
        } catch (error: any) {
          expect(error.details.fields).toHaveLength(2);
          expect(error.details.fields[0].field).toBe('avatar');
          expect(error.details.fields[1].field).toBe('resume');
          expect(error.details.errorCount).toBe(2);
        }
      });

      test('should group multiple errors per field', async () => {
        const schema = {
          files: z.object({ document: z.any() }),
        };

        ctx.request.files = { document: createMockFile() };

        const filesError = new z.ZodError([
          {
            code: z.ZodIssueCode.custom,
            path: ['document'],
            message: 'File size exceeds maximum',
          },
          {
            code: z.ZodIssueCode.custom,
            path: ['document'],
            message: 'Invalid file type',
          },
        ]);

        (validateFiles as any).mockImplementation(() => {
          throw filesError;
        });

        const validator = createRequestValidator(schema);

        try {
          await validator.execute({ ctx, next, logger: mockLogger, eventBus: mockEventBus });
        } catch (error: any) {
          expect(error.details.fields).toHaveLength(1);
          expect(error.details.fields[0].field).toBe('document');
          expect(error.details.fields[0].messages).toHaveLength(2);
          expect(error.details.errorCount).toBe(2);
        }
      });
    });

    // ==========================================================================
    // Edge Cases
    // ==========================================================================

    describe('Edge Cases', () => {
      test('should handle optional file fields with no files uploaded', async () => {
        const schema = {
          files: z.object({
            avatar: z.any().optional(),
          }),
        };

        ctx.request.files = {}; // No files uploaded

        const validator = createRequestValidator(schema);

        await validator.execute({ ctx, next, logger: mockLogger, eventBus: mockEventBus });

        expect(validateFiles).toHaveBeenCalled();
        expect(next).toHaveBeenCalled();
      });

      test('should handle Content-Type with boundary parameter', async () => {
        const schema = {
          files: z.object({ file: z.any() }),
        };

        ctx.request.header = vi.fn((name: string) => {
          if (name.toLowerCase() === 'content-type') {
            return 'multipart/form-data; boundary=----WebKitFormBoundaryABC123';
          }
          return undefined;
        });

        ctx.request.files = { file: createMockFile() };

        const validator = createRequestValidator(schema);

        // Should accept Content-Type with boundary
        await validator.execute({ ctx, next, logger: mockLogger, eventBus: mockEventBus });
        expect(next).toHaveBeenCalled();
      });

      test('should be case-insensitive for Content-Type header name', async () => {
        const schema = {
          files: z.object({ file: z.any() }),
        };

        // Test different cases
        const headerCases = ['content-type', 'Content-Type', 'CONTENT-TYPE'];

        for (const _headerCase of headerCases) {
          ctx.request.header = vi.fn((name: string) => {
            if (name.toLowerCase() === 'content-type') {
              return 'multipart/form-data';
            }
            return undefined;
          });

          ctx.request.files = { file: createMockFile() };

          const validator = createRequestValidator(schema);

          await validator.execute({ ctx, next, logger: mockLogger, eventBus: mockEventBus });
          expect(next).toHaveBeenCalled();

          vi.clearAllMocks();
        }
      });
    });

    // ==========================================================================
    // Backward Compatibility Tests
    // ==========================================================================

    describe('Backward Compatibility', () => {
      test('should not break existing routes without files schema', async () => {
        const schema = {
          params: z.object({ id: z.string() }),
          query: z.object({ sort: z.string() }),
          body: z.object({ name: z.string() }),
          // No files schema
        };

        ctx.request.params = { id: '123' };
        ctx.request.query = { sort: 'asc' };
        ctx.request.body = { name: 'Test' };

        const validator = createRequestValidator(schema);

        await validator.execute({ ctx, next, logger: mockLogger, eventBus: mockEventBus });

        expect(validateParams).toHaveBeenCalled();
        expect(validateQuery).toHaveBeenCalled();
        expect(validateBody).toHaveBeenCalled();
        expect(validateFiles).not.toHaveBeenCalled();
        expect(next).toHaveBeenCalled();
      });

      test('should work with empty schema object', async () => {
        const schema = {}; // No validation rules

        const validator = createRequestValidator(schema);

        await validator.execute({ ctx, next, logger: mockLogger, eventBus: mockEventBus });

        expect(validateParams).not.toHaveBeenCalled();
        expect(validateQuery).not.toHaveBeenCalled();
        expect(validateBody).not.toHaveBeenCalled();
        expect(validateFiles).not.toHaveBeenCalled();
        expect(next).toHaveBeenCalled();
      });
    });
  });
});
