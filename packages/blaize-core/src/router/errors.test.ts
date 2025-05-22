import {
  RouterError,
  RouteNotFoundError,
  MethodNotAllowedError,
  ValidationError,
  RouteLoadError,
} from './errors';

describe('Router Error Classes', () => {
  describe('RouterError', () => {
    test('creates a basic router error with default status', () => {
      // Arrange
      const errorMessage = 'Generic router error';

      // Act
      const error = new RouterError(errorMessage);

      // Assert
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(RouterError);
      expect(error.message).toBe(errorMessage);
      expect(error.name).toBe('RouterError');
      expect(error.status).toBe(500); // Default status
      expect(error.stack).toBeDefined();
    });

    test('creates a router error with custom status', () => {
      // Arrange
      const errorMessage = 'Generic router error';
      const errorStatus = 418; // I'm a teapot!

      // Act
      const error = new RouterError(errorMessage, errorStatus);

      // Assert
      expect(error.message).toBe(errorMessage);
      expect(error.status).toBe(errorStatus);
    });
  });

  describe('RouteNotFoundError', () => {
    test('creates a not found error with appropriate message and status', () => {
      // Arrange
      const path = '/users/123';
      const method = 'GET';

      // Act
      const error = new RouteNotFoundError(path, method);

      // Assert
      expect(error).toBeInstanceOf(RouterError);
      expect(error).toBeInstanceOf(RouteNotFoundError);
      expect(error.message).toBe(`Route not found: ${method} ${path}`);
      expect(error.name).toBe('RouteNotFoundError');
      expect(error.status).toBe(404);
      expect(error.stack).toBeDefined();
    });
  });

  describe('MethodNotAllowedError', () => {
    test('creates a method not allowed error with allowed methods', () => {
      // Arrange
      const path = '/users/123';
      const method = 'POST';
      const allowedMethods = ['GET', 'PUT', 'DELETE'];

      // Act
      const error = new MethodNotAllowedError(path, method, allowedMethods);

      // Assert
      expect(error).toBeInstanceOf(RouterError);
      expect(error).toBeInstanceOf(MethodNotAllowedError);
      expect(error.message).toBe(`Method ${method} not allowed for route ${path}`);
      expect(error.name).toBe('MethodNotAllowedError');
      expect(error.status).toBe(405);
      expect(error.allowedMethods).toEqual(allowedMethods);
      expect(error.stack).toBeDefined();
    });

    test('handles empty allowed methods array', () => {
      // Arrange
      const path = '/users/123';
      const method = 'POST';
      const allowedMethods: string[] = [];

      // Act
      const error = new MethodNotAllowedError(path, method, allowedMethods);

      // Assert
      expect(error.allowedMethods).toEqual([]);
    });
  });

  describe('ValidationError', () => {
    test('creates a validation error with details', () => {
      // Arrange
      const errorMessage = 'Validation failed';
      const errorDetails = {
        field: 'email',
        errors: ['Invalid email format'],
      };

      // Act
      const error = new ValidationError(errorMessage, errorDetails);

      // Assert
      expect(error).toBeInstanceOf(RouterError);
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBe(errorMessage);
      expect(error.name).toBe('ValidationError');
      expect(error.status).toBe(400);
      expect(error.details).toEqual(errorDetails);
      expect(error.stack).toBeDefined();
    });

    test('handles null details', () => {
      // Arrange
      const errorMessage = 'Validation failed';

      // Act
      const error = new ValidationError(errorMessage, null);

      // Assert
      expect(error.details).toBeNull();
    });

    test('handles complex error details', () => {
      // Arrange
      const errorMessage = 'Validation failed';
      const complexDetails = {
        fields: [
          { name: 'email', errors: ['Invalid format', 'Required'] },
          { name: 'password', errors: ['Too short'] },
        ],
        source: 'body',
        timestamp: Date.now(),
      };

      // Act
      const error = new ValidationError(errorMessage, complexDetails);

      // Assert
      expect(error.details).toEqual(complexDetails);
    });
  });

  describe('RouteLoadError', () => {
    test('creates a route load error with cause', () => {
      // Arrange
      const filePath = '/app/routes/users.ts';
      const cause = new Error('Module not found');

      // Act
      const error = new RouteLoadError(filePath, cause);

      // Assert
      expect(error).toBeInstanceOf(RouterError);
      expect(error).toBeInstanceOf(RouteLoadError);
      expect(error.message).toBe(`Failed to load route from ${filePath}: ${cause.message}`);
      expect(error.name).toBe('RouteLoadError');
      expect(error.status).toBe(500);
      expect(error.cause).toBe(cause);
      expect(error.stack).toBeDefined();
    });

    test('preserves cause properties', () => {
      // Arrange
      const filePath = '/app/routes/users.ts';
      const cause = new Error('Syntax error');
      // Add custom property to the cause
      (cause as any).line = 42;
      (cause as any).column = 17;

      // Act
      const error = new RouteLoadError(filePath, cause);

      // Assert
      expect(error.cause).toBe(cause);
      expect((error.cause as any).line).toBe(42);
      expect((error.cause as any).column).toBe(17);
    });

    test('handles cause with nested error', () => {
      // Arrange
      const filePath = '/app/routes/users.ts';
      const innerCause = new Error('Original error');
      const cause = new Error('Wrapper error');
      (cause as any).cause = innerCause;

      // Act
      const error = new RouteLoadError(filePath, cause);

      // Assert
      expect(error.cause).toBe(cause);
      expect((error.cause as any).cause).toBe(innerCause);
    });
  });

  describe('Error inheritance', () => {
    test('instanceof works correctly for all error types', () => {
      // Arrange & Act
      const baseError = new RouterError('Base error');
      const notFoundError = new RouteNotFoundError('/path', 'GET');
      const methodNotAllowedError = new MethodNotAllowedError('/path', 'POST', ['GET']);
      const validationError = new ValidationError('Invalid input', { field: 'email' });
      const loadError = new RouteLoadError('/path/to/file.ts', new Error('Import error'));

      // Assert
      // All are JavaScript Error instances
      expect(baseError instanceof Error).toBe(true);
      expect(notFoundError instanceof Error).toBe(true);
      expect(methodNotAllowedError instanceof Error).toBe(true);
      expect(validationError instanceof Error).toBe(true);
      expect(loadError instanceof Error).toBe(true);

      // All are RouterError instances
      expect(baseError instanceof RouterError).toBe(true);
      expect(notFoundError instanceof RouterError).toBe(true);
      expect(methodNotAllowedError instanceof RouterError).toBe(true);
      expect(validationError instanceof RouterError).toBe(true);
      expect(loadError instanceof RouterError).toBe(true);

      // Specific types
      expect(notFoundError instanceof RouteNotFoundError).toBe(true);
      expect(methodNotAllowedError instanceof MethodNotAllowedError).toBe(true);
      expect(validationError instanceof ValidationError).toBe(true);
      expect(loadError instanceof RouteLoadError).toBe(true);

      // Cross-checks (should be false)
      expect(notFoundError instanceof ValidationError).toBe(false);
      expect(methodNotAllowedError instanceof RouteLoadError).toBe(false);
      expect(validationError instanceof MethodNotAllowedError).toBe(false);
      expect(loadError instanceof RouteNotFoundError).toBe(false);
    });
  });

  describe('Error behavior in try/catch', () => {
    test('errors can be caught and identified properly', () => {
      // Arrange
      let caughtError: unknown = null;

      // Act
      try {
        throw new RouteNotFoundError('/users', 'GET');
      } catch (error) {
        caughtError = error;
      }

      // Assert
      expect(caughtError).toBeInstanceOf(RouteNotFoundError);
      expect(caughtError).toBeInstanceOf(RouterError);
      expect((caughtError as RouteNotFoundError).status).toBe(404);
    });

    test('errors maintain additional properties when caught', () => {
      // Arrange
      let caughtError: unknown = null;
      const allowedMethods = ['GET', 'PUT'];

      // Act
      try {
        throw new MethodNotAllowedError('/users', 'POST', allowedMethods);
      } catch (error) {
        caughtError = error;
      }

      // Assert
      expect(caughtError).toBeInstanceOf(MethodNotAllowedError);
      expect((caughtError as MethodNotAllowedError).allowedMethods).toEqual(allowedMethods);
    });
  });
});
