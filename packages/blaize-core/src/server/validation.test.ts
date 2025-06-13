import { z } from 'zod';

import { createMockMiddleware } from '@blaizejs/testing-utils';

import { validateServerOptions, serverOptionsSchema } from './validation';

import type { ServerOptionsInput, Middleware, Plugin } from '../index';

describe('Server Options Validation', () => {
  // Store original NODE_ENV and restore after tests
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    // Reset NODE_ENV before each test
    process.env.NODE_ENV = 'development';
  });

  afterEach(() => {
    // Restore original NODE_ENV after each test
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe('validateServerOptions', () => {
    it('should return default options when empty input is provided', () => {
      // Act
      const result = validateServerOptions({});

      // Assert
      expect(result).toEqual({
        port: 3000,
        host: 'localhost',
        routesDir: './routes',
        http2: {
          enabled: true,
        },
        middleware: [],
        plugins: [],
      });
    });

    it('should accept valid custom options', () => {
      // Arrange
      const mockMiddleware: Middleware = createMockMiddleware();
      const mockPlugin: Plugin = {
        name: 'test-plugin',
        version: '1.0.0',
        register: vi.fn(),
      };

      const options: ServerOptionsInput = {
        port: 8080,
        host: '0.0.0.0',
        routesDir: './api',
        http2: {
          enabled: false,
        },
        middleware: [mockMiddleware],
        plugins: [mockPlugin],
      };

      // Act
      const result = validateServerOptions(options);

      // Assert
      expect(result).toEqual({
        port: 8080,
        host: '0.0.0.0',
        routesDir: './api',
        http2: {
          enabled: false,
        },
        middleware: [mockMiddleware],
        plugins: [mockPlugin],
      });
    });

    it('should throw error for negative port number', () => {
      // Arrange
      const options: ServerOptionsInput = {
        port: -1,
      };

      // Act & Assert
      expect(() => validateServerOptions(options)).toThrow('Invalid server options');
    });

    it('should throw error for invalid middleware', () => {
      // Arrange
      const options: ServerOptionsInput = {
        middleware: ['not-a-function' as any],
      };

      // Act & Assert
      expect(() => validateServerOptions(options)).toThrow('Invalid server options');
    });

    it('should throw error for invalid plugin', () => {
      // Arrange
      const options: ServerOptionsInput = {
        plugins: [{ name: 'invalid-plugin' } as any],
      };

      // Act & Assert
      expect(() => validateServerOptions(options)).toThrow('Invalid server options');
    });
  });

  describe('HTTP/2 validation', () => {
    it('should not require SSL files in development mode', () => {
      // Arrange
      process.env.NODE_ENV = 'development';
      const options: ServerOptionsInput = {
        http2: {
          enabled: true,
          // No keyFile or certFile provided
        },
      };

      // Act & Assert - should not throw
      expect(() => validateServerOptions(options)).not.toThrow();
    });

    it('should require SSL files in production mode when http2 is enabled', () => {
      // Arrange
      process.env.NODE_ENV = 'production';
      const options: ServerOptionsInput = {
        http2: {
          enabled: true,
          // No keyFile or certFile provided
        },
      };

      // Act & Assert
      expect(() => validateServerOptions(options)).toThrow(/keyFile and certFile must be provided/);
    });

    it('should accept valid SSL files in production mode', () => {
      // Arrange
      process.env.NODE_ENV = 'production';
      const options: ServerOptionsInput = {
        http2: {
          enabled: true,
          keyFile: '/path/to/key.pem',
          certFile: '/path/to/cert.pem',
        },
      };

      // Act
      const result = validateServerOptions(options);

      // Assert
      expect(result.http2).toEqual({
        enabled: true,
        keyFile: '/path/to/key.pem',
        certFile: '/path/to/cert.pem',
      });
    });

    it('should not require SSL files when http2 is disabled in production', () => {
      // Arrange
      process.env.NODE_ENV = 'production';
      const options: ServerOptionsInput = {
        http2: {
          enabled: false,
          // No keyFile or certFile provided
        },
      };

      // Act & Assert - should not throw
      expect(() => validateServerOptions(options)).not.toThrow();
    });
  });

  describe('Error formatting', () => {
    it('should format ZodError for better readability', () => {
      // Arrange
      const mockFormatError = {
        _errors: ['Expected number, received string'],
        port: { _errors: ['Expected number, received string'] },
      };

      const mockZodError = new z.ZodError([]);
      mockZodError.format = vi.fn().mockReturnValue(mockFormatError);

      // Mock Zod's parse to throw our prepared error
      const originalParse = serverOptionsSchema.parse;
      serverOptionsSchema.parse = vi.fn().mockImplementation(() => {
        throw mockZodError;
      });

      // Act & Assert
      try {
        validateServerOptions({ port: 'invalid' as any });
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Invalid server options');
        expect((error as Error).message).toContain(JSON.stringify(mockFormatError, null, 2));
      } finally {
        // Restore original method
        serverOptionsSchema.parse = originalParse;
      }
    });

    it('should handle non-ZodError errors', () => {
      // Arrange
      const customError = new Error('Custom error');

      // Mock Zod's parse to throw our custom error
      const originalParse = serverOptionsSchema.parse;
      serverOptionsSchema.parse = vi.fn().mockImplementation(() => {
        throw customError;
      });

      // Act & Assert
      try {
        validateServerOptions({});
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Invalid server options: Error: Custom error');
      } finally {
        // Restore original method
        serverOptionsSchema.parse = originalParse;
      }
    });
  });
});
