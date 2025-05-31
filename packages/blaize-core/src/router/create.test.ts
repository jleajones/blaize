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
});
