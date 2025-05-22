import { RouteDefinition } from '@blaizejs/types';

import { create } from './create';

describe('route create function', () => {
  // Test successful route creation with defaults
  test('creates a route with default base path', () => {
    // Arrange
    const mockHandler = vi.fn();
    const definition: RouteDefinition = {
      GET: {
        handler: mockHandler,
      },
    };

    // Act
    const route = create(definition);

    // Assert
    expect(route).toEqual({
      GET: {
        handler: mockHandler,
      },
      path: '/',
    });
  });

  // Test successful route creation with custom base path
  test('creates a route with custom base path', () => {
    // Arrange
    const mockHandler = vi.fn();
    const definition: RouteDefinition = {
      POST: {
        handler: mockHandler,
      },
    };

    // Act
    const route = create(definition, { basePath: '/api/users' });

    // Assert
    expect(route).toEqual({
      POST: {
        handler: mockHandler,
      },
      path: '/api/users',
    });
  });

  // Test route creation with multiple HTTP methods
  test('creates a route with multiple HTTP methods', () => {
    // Arrange
    const getHandler = vi.fn();
    const postHandler = vi.fn();
    const definition: RouteDefinition = {
      GET: {
        handler: getHandler,
      },
      POST: {
        handler: postHandler,
      },
    };

    // Act
    const route = create(definition);

    // Assert
    expect(route).toEqual({
      GET: {
        handler: getHandler,
      },
      POST: {
        handler: postHandler,
      },
      path: '/',
    });
  });

  // Test route creation with middleware
  test('creates a route with middleware', () => {
    // Arrange
    const mockHandler = vi.fn();
    const mockMiddleware1 = { name: 'test-middleware', execute: vi.fn() };
    const mockMiddleware2 = { name: 'test-middleware-2', execute: vi.fn() };
    const definition: RouteDefinition = {
      GET: {
        handler: mockHandler,
        middleware: [mockMiddleware1, mockMiddleware2],
      },
    };

    // Act
    const route = create(definition);

    // Assert
    expect(route).toEqual({
      GET: {
        handler: mockHandler,
        middleware: [mockMiddleware1, mockMiddleware2],
      },
      path: '/',
    });
  });

  // Test validation errors

  // Test: Empty route definition
  test('throws error when route definition is empty', () => {
    // Arrange
    const definition = {};

    // Act & Assert
    expect(() => create(definition)).toThrow(
      'Route definition must contain at least one HTTP method'
    );
  });

  // Test: Missing handler
  test('throws error when handler is missing', () => {
    // Arrange
    const definition = {
      GET: {
        // Missing handler
      },
    };

    // Act & Assert
    // @ts-expect-error - expecting error due to missing handler
    expect(() => create(definition)).toThrow('Handler for method GET must be a function');
  });

  // Test: Handler not a function
  test('throws error when handler is not a function', () => {
    // Arrange
    const definition = {
      GET: {
        handler: 'not a function' as any,
      },
    };

    // Act & Assert
    expect(() => create(definition)).toThrow('Handler for method GET must be a function');
  });

  // Test: Middleware not an array
  test('throws error when middleware is not an array', () => {
    // Arrange
    const mockHandler = vi.fn();
    const definition = {
      GET: {
        handler: mockHandler,
        middleware: {} as any, // Not an array
      },
    };

    // Act & Assert
    expect(() => create(definition)).toThrow('Middleware for method GET must be an array');
  });

  // Test: Valid method with null/undefined value should be skipped
  test('skips validation for null/undefined method values', () => {
    // Arrange
    const mockHandler = vi.fn();
    const definition = {
      GET: {
        handler: mockHandler,
      },
      POST: null as any,
    };

    // Act
    const route = create(definition);

    // Assert - should not throw error and process the valid method
    expect(route).toEqual({
      GET: {
        handler: mockHandler,
      },
      POST: null,
      path: '/',
    });
  });
});
