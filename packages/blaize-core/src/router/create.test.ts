import { z } from 'zod';

import {
  createGetRoute,
  createPostRoute,
  createPutRoute,
  createDeleteRoute,
  createPatchRoute,
  createHeadRoute,
  createOptionsRoute,
} from './create';

// Mock the internal functions
vi.mock('../config', () => ({
  getRoutesDir: vi.fn(() => '/project/routes'),
}));

// Mock the path parsing
vi.mock('./discovery/parser', () => ({
  parseRoutePath: vi.fn((filePath, _routesDir) => ({
    filePath,
    routePath: '/mocked/path',
    params: [],
  })),
}));

describe('Method-specific route creators', () => {
  describe('createGetRoute', () => {
    test('creates a GET route with default path', () => {
      // Arrange
      const mockHandler = vi.fn();
      const config = {
        handler: mockHandler,
      };

      // Act
      const route = createGetRoute(config);

      // Assert
      expect(route).toEqual({
        GET: {
          handler: mockHandler,
        },
        path: '/mocked/path',
      });
    });

    test('creates a GET route with custom path', () => {
      // Arrange
      const mockHandler = vi.fn();
      const config = {
        handler: mockHandler,
      };

      // Act
      const route = createGetRoute(config);

      // Assert
      expect(route).toEqual({
        GET: {
          handler: mockHandler,
        },
        path: '/mocked/path',
      });
    });

    test('creates a GET route with schema and middleware', () => {
      // Arrange
      const mockHandler = vi.fn();
      const mockMiddleware = { name: 'auth', execute: vi.fn() };
      const config = {
        schema: {
          params: z.object({ id: z.string() }),
          query: z.object({ include: z.string().optional() }),
          response: z.object({ user: z.object({ id: z.string() }) }),
        },
        handler: mockHandler,
        middleware: [mockMiddleware],
      };

      // Act
      const route = createGetRoute(config);

      // Assert
      expect(route).toEqual({
        GET: {
          schema: config.schema,
          handler: mockHandler,
          middleware: [mockMiddleware],
        },
        path: '/mocked/path',
      });
    });

    test('warns when body schema is provided for GET route', () => {
      // Arrange
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const config = {
        schema: {
          body: z.object({ name: z.string() }), // Should warn
        },
        handler: vi.fn(),
      };

      // @ts-expect-error - Testing runtime validation with intentionally invalid schema
      createGetRoute(config);

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        "Warning: GET requests typically don't have request bodies"
      );

      consoleSpy.mockRestore();
    });
  });

  describe('createPostRoute', () => {
    test('creates a POST route with default path', () => {
      // Arrange
      const mockHandler = vi.fn();
      const config = {
        handler: mockHandler,
      };

      // Act
      const route = createPostRoute(config);

      // Assert
      expect(route).toEqual({
        POST: {
          handler: mockHandler,
        },
        path: '/mocked/path',
      });
    });

    test('creates a POST route with body schema', () => {
      // Arrange
      const mockHandler = vi.fn();
      const config = {
        schema: {
          body: z.object({ name: z.string(), email: z.string().email() }),
          response: z.object({ id: z.string(), name: z.string(), email: z.string() }),
        },
        handler: mockHandler,
      };

      // Act
      const route = createPostRoute(config);

      // Assert
      expect(route).toEqual({
        POST: {
          schema: config.schema,
          handler: mockHandler,
        },
        path: '/mocked/path',
      });
    });

    test('does not warn when body schema is provided for POST route', () => {
      // Arrange
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const config = {
        schema: {
          body: z.object({ name: z.string() }),
        },
        handler: vi.fn(),
      };

      // Act
      createPostRoute(config);

      // Assert
      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('createPutRoute', () => {
    test('creates a PUT route with params and body schema', () => {
      // Arrange
      const mockHandler = vi.fn();
      const config = {
        schema: {
          params: z.object({ id: z.string() }),
          body: z.object({ name: z.string().optional() }),
          response: z.object({ success: z.boolean() }),
        },
        handler: mockHandler,
      };

      // Act
      const route = createPutRoute(config);

      // Assert
      expect(route).toEqual({
        PUT: {
          schema: config.schema,
          handler: mockHandler,
        },
        path: '/mocked/path',
      });
    });
  });

  describe('createDeleteRoute', () => {
    test('creates a DELETE route', () => {
      // Arrange
      const mockHandler = vi.fn();
      const config = {
        schema: {
          params: z.object({ id: z.string() }),
          response: z.object({ deleted: z.boolean() }),
        },
        handler: mockHandler,
      };

      // Act
      const route = createDeleteRoute(config);

      // Assert
      expect(route).toEqual({
        DELETE: {
          schema: config.schema,
          handler: mockHandler,
        },
        path: '/mocked/path',
      });
    });

    test('warns when body schema is provided for DELETE route', () => {
      // Arrange
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const config = {
        schema: {
          body: z.object({ reason: z.string() }), // Should warn
        },
        handler: vi.fn(),
      };

      // Act
      // @ts-expect-error - Testing runtime validation with intentionally invalid schema
      createDeleteRoute(config);

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        "Warning: DELETE requests typically don't have request bodies"
      );

      consoleSpy.mockRestore();
    });
  });

  describe('createPatchRoute', () => {
    test('creates a PATCH route with body schema', () => {
      // Arrange
      const mockHandler = vi.fn();
      const config = {
        schema: {
          params: z.object({ id: z.string() }),
          body: z.object({
            name: z.string().optional(),
            email: z.string().email().optional(),
          }),
          response: z.object({ updated: z.boolean() }),
        },
        handler: mockHandler,
      };

      // Act
      const route = createPatchRoute(config);

      // Assert
      expect(route).toEqual({
        PATCH: {
          schema: config.schema,
          handler: mockHandler,
        },
        path: '/mocked/path',
      });
    });
  });

  describe('createHeadRoute', () => {
    test('creates a HEAD route', () => {
      // Arrange
      const mockHandler = vi.fn();
      const config = {
        handler: mockHandler,
      };

      // Act
      const route = createHeadRoute(config);

      // Assert
      expect(route).toEqual({
        HEAD: {
          handler: mockHandler,
        },
        path: '/mocked/path',
      });
    });

    test('warns when body schema is provided for HEAD route', () => {
      // Arrange
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const config = {
        schema: {
          body: z.object({ data: z.string() }), // Should warn
        },
        handler: vi.fn(),
      };

      // Act
      // @ts-expect-error - Testing runtime validation with intentionally invalid schema
      createHeadRoute(config);

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        "Warning: HEAD requests typically don't have request bodies"
      );

      consoleSpy.mockRestore();
    });
  });

  describe('createOptionsRoute', () => {
    test('creates an OPTIONS route', () => {
      // Arrange
      const mockHandler = vi.fn();
      const config = {
        handler: mockHandler,
      };

      // Act
      const route = createOptionsRoute(config);

      // Assert
      expect(route).toEqual({
        OPTIONS: {
          handler: mockHandler,
        },
        path: '/mocked/path',
      });
    });
  });

  // Validation tests that apply to all creators
  describe('Validation', () => {
    test.each([
      ['createGetRoute', createGetRoute],
      ['createPostRoute', createPostRoute],
      ['createPutRoute', createPutRoute],
      ['createDeleteRoute', createDeleteRoute],
      ['createPatchRoute', createPatchRoute],
      ['createHeadRoute', createHeadRoute],
      ['createOptionsRoute', createOptionsRoute],
    ])('%s throws error when handler is missing', (name, creator) => {
      // Arrange
      const config = {
        // Missing handler
      };

      // Act & Assert
      // @ts-expect-error - expecting error due to missing handler
      expect(() => creator(config)).toThrow(
        `Handler for method ${name.replace('create', '').replace('Route', '').toUpperCase()} must be a function`
      );
    });

    test.each([
      ['createGetRoute', createGetRoute, 'GET'],
      ['createPostRoute', createPostRoute, 'POST'],
      ['createPutRoute', createPutRoute, 'PUT'],
      ['createDeleteRoute', createDeleteRoute, 'DELETE'],
      ['createPatchRoute', createPatchRoute, 'PATCH'],
      ['createHeadRoute', createHeadRoute, 'HEAD'],
      ['createOptionsRoute', createOptionsRoute, 'OPTIONS'],
    ])('%s throws error when handler is not a function', (name, creator, method) => {
      // Arrange
      const config = {
        handler: 'not a function' as any,
      };

      // Act & Assert

      // @ts-expect-error - handler is not a function
      expect(() => creator(config)).toThrow(`Handler for method ${method} must be a function`);
    });

    test.each([
      ['createGetRoute', createGetRoute, 'GET'],
      ['createPostRoute', createPostRoute, 'POST'],
      ['createPutRoute', createPutRoute, 'PUT'],
      ['createDeleteRoute', createDeleteRoute, 'DELETE'],
      ['createPatchRoute', createPatchRoute, 'PATCH'],
      ['createHeadRoute', createHeadRoute, 'HEAD'],
      ['createOptionsRoute', createOptionsRoute, 'OPTIONS'],
    ])('%s throws error when middleware is not an array', (name, creator, method) => {
      // Arrange
      const config = {
        handler: vi.fn(),
        middleware: 'not an array' as any,
      };

      // Act & Assert
      // @ts-expect-error - expecting error due to invalid middleware type
      expect(() => creator(config)).toThrow(`Middleware for method ${method} must be an array`);
    });
  });

  // Schema validation tests
  describe('Schema validation', () => {
    test('throws error when params schema is not a Zod schema', () => {
      // Arrange
      const config = {
        schema: {
          params: { not: 'zod schema' } as any,
        },
        handler: vi.fn(),
      };

      // Act & Assert
      expect(() => createGetRoute(config)).toThrow(
        'Params schema for GET must be a valid Zod schema'
      );
    });

    test('throws error when query schema is not a Zod schema', () => {
      // Arrange
      const config = {
        schema: {
          query: 'invalid' as any,
        },
        handler: vi.fn(),
      };

      // Act & Assert
      expect(() => createGetRoute(config)).toThrow(
        'Query schema for GET must be a valid Zod schema'
      );
    });

    test('throws error when body schema is not a Zod schema', () => {
      // Arrange
      const config = {
        schema: {
          body: 123 as any,
        },
        handler: vi.fn(),
      };

      // Act & Assert
      expect(() => createPostRoute(config)).toThrow(
        'Body schema for POST must be a valid Zod schema'
      );
    });

    test('throws error when response schema is not a Zod schema', () => {
      // Arrange
      const config = {
        schema: {
          response: [] as any,
        },
        handler: vi.fn(),
      };

      // Act & Assert
      expect(() => createGetRoute(config)).toThrow(
        'Response schema for GET must be a valid Zod schema'
      );
    });

    test('accepts valid Zod schemas', () => {
      // Arrange
      const config = {
        schema: {
          params: z.object({ id: z.string() }),
          query: z.object({ filter: z.string().optional() }),
          response: z.object({ data: z.any() }),
        },
        handler: vi.fn(),
      };

      // Act & Assert
      expect(() => createGetRoute(config)).not.toThrow();
    });
  });

  describe('Route Handler Type Inference', () => {
    test('GET route should have correct types after transforms', () => {
      const route = createGetRoute({
        schema: {
          params: z.object({
            userId: z.string().transform(str => parseInt(str, 10)),
            slug: z.string().transform(str => str.toLowerCase()),
          }),
          query: z.object({
            page: z.coerce.number().default(1),
            includeDeleted: z
              .string()
              .optional()
              .transform(val => val === 'true'),
            sortBy: z.enum(['name', 'date']).optional(),
          }),
          response: z.object({
            userId: z.number(),
            slug: z.string(),
            page: z.number(),
            includeDeleted: z.boolean().optional(),
            sortBy: z.enum(['name', 'date']).optional(),
          }),
        },
        handler: async (ctx, params) => {
          // These type assertions verify that TypeScript sees the correct types
          // If the types were wrong, TypeScript would error here

          // params should have transformed types
          const userId: number = params.userId; // Should be number, not string
          const slug: string = params.slug; // Should be string (lowercased)

          // query should have transformed types
          const page: number = ctx.request.query.page; // Should be number
          const includeDeleted: boolean | undefined = ctx.request.query.includeDeleted; // Should be boolean | undefined
          const sortBy: 'name' | 'date' | undefined = ctx.request.query.sortBy; // Should be enum

          // Runtime checks to ensure transforms actually work
          expect(typeof userId).toBe('number');
          expect(typeof slug).toBe('string');
          expect(typeof page).toBe('number');
          if (includeDeleted !== undefined) {
            expect(typeof includeDeleted).toBe('boolean');
          }

          return {
            userId,
            slug,
            page,
            includeDeleted,
            sortBy,
          };
        },
      });

      expect(route.GET.handler).toBeDefined();
    });

    test('POST route should handle body transforms correctly', () => {
      const route = createPostRoute({
        schema: {
          params: z.object({
            organizationId: z.string().transform(str => parseInt(str, 10)),
          }),
          body: z.object({
            name: z.string().trim(),
            priority: z.string().transform(str => parseInt(str, 10)),
            tags: z.string().transform(str => str.split(',').map(t => t.trim())),
            publishAt: z.string().transform(str => new Date(str)),
            settings: z
              .string()
              .optional()
              .transform(val => (val ? JSON.parse(val) : null)),
          }),
          response: z.object({
            success: z.boolean(),
            data: z.object({
              orgId: z.number(),
              name: z.string(),
              priority: z.number(),
              tags: z.array(z.string()),
              publishAt: z.date(),
              settings: z.any(),
            }),
          }),
        },
        handler: async (ctx, params) => {
          // Verify params transform
          const orgId: number = params.organizationId; // Should be number

          // Verify body transforms
          const name: string = ctx.request.body.name; // Still string (trim doesn't change type)
          const priority: number = ctx.request.body.priority; // Should be number
          const tags: string[] = ctx.request.body.tags; // Should be string[]
          const publishAt: Date = ctx.request.body.publishAt; // Should be Date
          const settings: any = ctx.request.body.settings; // Should be any (from JSON.parse)

          // Runtime verification
          expect(typeof orgId).toBe('number');
          expect(typeof priority).toBe('number');
          expect(Array.isArray(tags)).toBe(true);
          expect(publishAt instanceof Date).toBe(true);

          return {
            success: true,
            data: {
              orgId,
              name,
              priority,
              tags,
              publishAt,
              settings,
            },
          };
        },
      });

      expect(route.POST.handler).toBeDefined();
    });

    test('PUT route with mixed transforms', () => {
      const route = createPutRoute({
        schema: {
          params: z.object({
            id: z
              .string()
              .regex(/^\d+$/)
              .transform(str => parseInt(str, 10)),
          }),
          body: z.object({
            // Nested object with transforms
            user: z.object({
              age: z.string().transform(str => parseInt(str, 10)),
              isActive: z.string().transform(val => val === 'true'),
            }),
            // Array with transform
            scores: z.array(z.string().transform(str => parseFloat(str))),
            // Optional with transform
            expiresIn: z
              .string()
              .optional()
              .transform(val => (val ? parseInt(val, 10) : undefined)),
          }),
          response: z.object({
            updated: z.boolean(),
          }),
        },
        handler: async (ctx, params) => {
          // Params
          const id: number = params.id; // Should be number

          // Body - nested object
          const age: number = ctx.request.body.user.age; // Should be number
          const isActive: boolean = ctx.request.body.user.isActive; // Should be boolean

          // Body - array of transforms
          const scores: number[] = ctx.request.body.scores; // Should be number[]

          // Body - optional transform
          const _expiresIn: number | undefined = ctx.request.body.expiresIn; // Should be number | undefined

          // Runtime checks
          expect(typeof id).toBe('number');
          expect(typeof age).toBe('number');
          expect(typeof isActive).toBe('boolean');
          expect(Array.isArray(scores)).toBe(true);
          if (scores.length > 0) {
            expect(typeof scores[0]).toBe('number');
          }

          return { updated: true };
        },
      });

      expect(route.PUT.handler).toBeDefined();
    });

    test('Complex real-world example with multiple transform types', () => {
      // This mimics a real-world API endpoint
      const route = createPostRoute({
        schema: {
          params: z.object({
            workspaceId: z
              .string()
              .uuid()
              .transform(() => crypto.randomUUID()), // Transform to new UUID
          }),
          query: z.object({
            dryRun: z
              .string()
              .optional()
              .default('false') // Default as string 'false'
              .transform(val => val === 'true'), // Then transform to boolean
            format: z.enum(['json', 'csv']).default('json'),
          }),
          body: z.object({
            // Date string to Date object
            startDate: z.string().transform(str => new Date(str)),
            endDate: z.string().transform(str => new Date(str)),

            // Comma-separated string to array
            userIds: z.string().transform(str => str.split(',').map(id => id.trim())),

            // JSON string to object
            filters: z.string().transform(str => {
              try {
                return JSON.parse(str) as Record<string, any>;
              } catch {
                return {};
              }
            }),

            // Number transforms with validation
            limit: z
              .string()
              .transform(str => parseInt(str, 10))
              .pipe(z.number().min(1).max(1000)),

            // Enum-like transform
            status: z.string().transform(str => {
              const statusMap = { '1': 'active', '2': 'inactive', '3': 'pending' };
              return statusMap[str as keyof typeof statusMap] || 'unknown';
            }),
          }),
          response: z.object({
            processed: z.boolean(),
            summary: z.object({
              workspaceId: z.string(),
              dryRun: z.boolean(),
              format: z.enum(['json', 'csv']),
              dateRange: z.object({
                startDate: z.date(),
                endDate: z.date(),
              }),
              userCount: z.number(),
              filterCount: z.number(),
              limit: z.number(),
              status: z.string(),
            }),
          }),
        },
        handler: async (ctx, params) => {
          // All these type assertions should work without TypeScript errors
          const workspaceId: string = params.workspaceId; // UUID string

          const dryRun: boolean = ctx.request.query.dryRun;
          const format: 'json' | 'csv' = ctx.request.query.format;

          const startDate: Date = ctx.request.body.startDate;
          const endDate: Date = ctx.request.body.endDate;
          const userIds: string[] = ctx.request.body.userIds;
          const filters: Record<string, any> = ctx.request.body.filters;
          const limit: number = ctx.request.body.limit;
          const status: string = ctx.request.body.status;

          // Runtime verifications
          expect(typeof workspaceId).toBe('string');
          expect(typeof dryRun).toBe('boolean');
          expect(format === 'json' || format === 'csv').toBe(true);
          expect(startDate instanceof Date).toBe(true);
          expect(endDate instanceof Date).toBe(true);
          expect(Array.isArray(userIds)).toBe(true);
          expect(typeof filters).toBe('object');
          expect(typeof limit).toBe('number');
          expect(typeof status).toBe('string');

          return {
            processed: true,
            summary: {
              workspaceId,
              dryRun,
              format,
              dateRange: { startDate, endDate },
              userCount: userIds.length,
              filterCount: Object.keys(filters).length,
              limit,
              status,
            },
          };
        },
      });

      expect(route.POST.handler).toBeDefined();
    });
  });
});
