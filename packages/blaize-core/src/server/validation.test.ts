import { z } from 'zod';

import { createMockMiddleware } from '@blaizejs/testing-utils';

import { DEFAULT_OPTIONS } from './create';
import { validateServerOptions, serverOptionsSchema } from './validation';

import type { Middleware } from '@blaize-types/middleware';
import type { Plugin } from '@blaize-types/plugins';
import type { ServerOptions } from '@blaize-types/server';

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
    it('should accept valid custom options', () => {
      // Arrange
      const mockMiddleware: Middleware = createMockMiddleware();
      const mockPlugin: Plugin = {
        name: 'test-plugin',
        version: '1.0.0',
        register: vi.fn(),
      };

      const options: ServerOptions = {
        port: 8080,
        eventSchemas: {},
        cors: {
          origin: ['https://example.com'],
        },
        host: '0.0.0.0',
        routesDir: './api',
        http2: {
          enabled: false,
        },
        middleware: [mockMiddleware],
        plugins: [mockPlugin],

        bodyLimits: DEFAULT_OPTIONS.bodyLimits,
      };

      // Act
      const result = validateServerOptions(options);

      // Assert
      expect(result).toEqual({
        port: 8080,
        cors: {
          origin: ['https://example.com'],
        },
        eventSchemas: {},
        host: '0.0.0.0',
        routesDir: './api',
        http2: {
          enabled: false,
        },
        middleware: [mockMiddleware],
        plugins: [mockPlugin],
        bodyLimits: {
          json: 512 * 1024,
          form: 1024 * 1024,
          text: 5 * 1024 * 1024,
          raw: 10 * 1024 * 1024,
          multipart: {
            maxFileSize: 50 * 1024 * 1024,
            maxTotalSize: 100 * 1024 * 1024,
            maxFiles: 10,
            maxFieldSize: 1024 * 1024,
          },
        },
      });
    });

    it('should throw error for negative port number', () => {
      // Arrange
      const options: ServerOptions = {
        port: -1,
        eventSchemas: {},
        host: 'localhost',
        routesDir: './routes',
        bodyLimits: DEFAULT_OPTIONS.bodyLimits,
      };

      // Act & Assert
      expect(() => validateServerOptions(options)).toThrow('Invalid server options');
    });

    it('should throw error for invalid middleware', () => {
      // Arrange
      const options: ServerOptions = {
        port: 8080,
        eventSchemas: {},
        host: 'localhost',
        routesDir: './routes',
        bodyLimits: DEFAULT_OPTIONS.bodyLimits,
        middleware: ['not-a-function' as any],
      };

      // Act & Assert
      expect(() => validateServerOptions(options)).toThrow('Invalid server options');
    });

    it('should throw error for invalid plugin', () => {
      // Arrange
      const options: ServerOptions = {
        port: 8080,
        eventSchemas: {},
        host: 'localhost',
        routesDir: './routes',
        bodyLimits: DEFAULT_OPTIONS.bodyLimits,
        plugins: [{ name: 'invalid-plugin' } as any],
      };

      // Act & Assert
      expect(() => validateServerOptions(options)).toThrow('Invalid server options');
    });

    it('should validate body limits are positive numbers', () => {
      expect(() =>
        validateServerOptions({
          port: 8080,
          cors: {
            origin: ['https://example.com'],
          },
          eventSchemas: {},
          host: '0.0.0.0',
          routesDir: './api',
          http2: {
            enabled: false,
          },
          bodyLimits: {
            json: -1000, // Invalid
            form: 1024 * 1024,
            text: 5 * 1024 * 1024,
            raw: 10 * 1024 * 1024,
            multipart: {
              maxFileSize: 50 * 1024 * 1024,
              maxTotalSize: 100 * 1024 * 1024,
              maxFiles: 10,
              maxFieldSize: 1024 * 1024,
            },
          },
        })
      ).toThrow(/Invalid server options/);

      // Verify the error contains useful information
      expect(() =>
        validateServerOptions({
          port: 8080,
          cors: {
            origin: ['https://example.com'],
          },
          host: '0.0.0.0',
          routesDir: './api',
          http2: {
            enabled: false,
          },
          eventSchemas: {},
          bodyLimits: {
            json: -1000, // Invalid
            form: 1024 * 1024,
            text: 5 * 1024 * 1024,
            raw: 10 * 1024 * 1024,
            multipart: {
              maxFileSize: 50 * 1024 * 1024,
              maxTotalSize: 100 * 1024 * 1024,
              maxFiles: 10,
              maxFieldSize: 1024 * 1024,
            },
          },
        })
      ).toThrow(/Invalid server options/); // Should mention "positive" in error
    });

    it('should reject negative multipart limits', () => {
      expect(() =>
        validateServerOptions({
          port: 8080,
          cors: {
            origin: ['https://example.com'],
          },
          host: '0.0.0.0',
          routesDir: './api',
          http2: {
            enabled: false,
          },
          eventSchemas: {},
          bodyLimits: {
            json: 512 * 1024,
            form: 1024 * 1024,
            text: 5 * 1024 * 1024,
            raw: 10 * 1024 * 1024,
            multipart: {
              maxFileSize: 50 * 1024 * 1024,
              maxTotalSize: -100, // Invalid
              maxFiles: 10,
              maxFieldSize: 1024 * 1024,
            },
          },
        })
      ).toThrow();
    });

    it('should reject zero values', () => {
      expect(() =>
        validateServerOptions({
          port: 8080,
          cors: {
            origin: ['https://example.com'],
          },
          host: '0.0.0.0',
          routesDir: './api',
          http2: {
            enabled: false,
          },
          eventSchemas: {},
          bodyLimits: {
            json: 512 * 1024,
            form: 1024 * 1024,
            text: 5 * 1024 * 1024,
            raw: 10 * 1024 * 1024,
            multipart: {
              maxFileSize: 50 * 1024 * 1024,
              maxTotalSize: 0, // Invalid
              maxFiles: 10,
              maxFieldSize: 1024 * 1024,
            },
          },
        })
      ).toThrow();
    });

    it('should reject non-integer maxFiles', () => {
      expect(() =>
        validateServerOptions({
          port: 8080,
          eventSchemas: {},
          host: 'localhost',
          routesDir: './routes',
          bodyLimits: {
            json: 512 * 1024,
            form: 1024 * 1024,
            text: 5 * 1024 * 1024,
            raw: 10 * 1024 * 1024,
            multipart: {
              maxFiles: 3.5, // Must be integer
              maxFileSize: 50 * 1024 * 1024,
              maxTotalSize: 100 * 1024 * 1024,
              maxFieldSize: 1024 * 1024,
            },
          },
        })
      ).toThrow();
    });

    it('should accept valid custom limits', () => {
      const result = validateServerOptions({
        port: 8080,
        cors: {
          origin: ['https://example.com'],
        },
        host: '0.0.0.0',
        routesDir: './api',
        http2: {
          enabled: false,
        },
        eventSchemas: {},
        bodyLimits: {
          json: 10 * 1024 * 1024,
          form: 5 * 1024 * 1024,
          text: 5 * 1024 * 1024,
          raw: 10 * 1024 * 1024,
          multipart: {
            maxFileSize: 200 * 1024 * 1024,
            maxTotalSize: 50 * 1024 * 1024,
            maxFiles: 50,
            maxFieldSize: 1024 * 1024,
          },
        },
      });

      expect(result.bodyLimits.json).toBe(10 * 1024 * 1024);
      expect(result.bodyLimits.form).toBe(5 * 1024 * 1024);
      expect(result.bodyLimits.multipart.maxFileSize).toBe(200 * 1024 * 1024);
      expect(result.bodyLimits.multipart.maxFiles).toBe(50);
    });
  });

  describe('HTTP/2 validation', () => {
    it('should not require SSL files in development mode', () => {
      // Arrange
      process.env.NODE_ENV = 'development';
      const options: ServerOptions = {
        http2: {
          enabled: true,
          // No keyFile or certFile provided
        },
        host: 'localhost',
        port: 3000,
        routesDir: './routes',
        eventSchemas: {},
        bodyLimits: DEFAULT_OPTIONS.bodyLimits,
      };

      // Act & Assert - should not throw
      expect(() => validateServerOptions(options)).not.toThrow();
    });

    it('should require SSL files in production mode when http2 is enabled', () => {
      // Arrange
      process.env.NODE_ENV = 'production';
      const options: ServerOptions = {
        http2: {
          enabled: true,
          // No keyFile or certFile provided
        },
        eventSchemas: {},
        host: 'localhost',
        port: 3000,
        routesDir: './routes',
        bodyLimits: DEFAULT_OPTIONS.bodyLimits,
      };

      // Act & Assert
      expect(() => validateServerOptions(options)).toThrow(/keyFile and certFile must be provided/);
    });

    it('should accept valid SSL files in production mode', () => {
      // Arrange
      process.env.NODE_ENV = 'production';
      const options: ServerOptions = {
        http2: {
          enabled: true,
          keyFile: '/path/to/key.pem',
          certFile: '/path/to/cert.pem',
        },
        eventSchemas: {},
        host: 'localhost',
        port: 3000,
        routesDir: './routes',
        bodyLimits: DEFAULT_OPTIONS.bodyLimits,
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
      const options: ServerOptions = {
        http2: {
          enabled: false,
          // No keyFile or certFile provided
        },
        eventSchemas: {},
        host: 'localhost',
        port: 3000,
        routesDir: './routes',
        bodyLimits: DEFAULT_OPTIONS.bodyLimits,
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
        validateServerOptions({
          port: 'invalid' as any,
          host: 'localhost',
          eventSchemas: {},
          routesDir: './routes',
          bodyLimits: DEFAULT_OPTIONS.bodyLimits,
        });
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
        validateServerOptions({
          port: 8080,
          host: 'localhost',
          eventSchemas: {},
          routesDir: './routes',
          bodyLimits: DEFAULT_OPTIONS.bodyLimits,
        });
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

  describe('serverId validation', () => {
    it('should accept valid serverId string', () => {
      const result = validateServerOptions({
        port: 3000,
        host: 'localhost',
        routesDir: './routes',
        bodyLimits: DEFAULT_OPTIONS.bodyLimits,
        serverId: 'my-server-1',
        eventSchemas: {},
      });

      expect(result.serverId).toBe('my-server-1');
    });

    it('should accept UUID format serverId', () => {
      const uuid = '123e4567-e89b-12d3-a456-426614174000';
      const result = validateServerOptions({
        port: 3000,
        host: 'localhost',
        routesDir: './routes',
        bodyLimits: DEFAULT_OPTIONS.bodyLimits,
        serverId: uuid,
        eventSchemas: {},
      });

      expect(result.serverId).toBe(uuid);
    });

    it('should accept serverId as optional (undefined)', () => {
      const result = validateServerOptions({
        port: 3000,
        host: 'localhost',
        routesDir: './routes',

        eventSchemas: {},
        bodyLimits: DEFAULT_OPTIONS.bodyLimits,
        // No serverId provided
      });

      expect(result.serverId).toBeUndefined();
    });

    it('should accept alphanumeric serverId with hyphens', () => {
      const result = validateServerOptions({
        port: 3000,
        host: 'localhost',

        eventSchemas: {},
        routesDir: './routes',
        bodyLimits: DEFAULT_OPTIONS.bodyLimits,
        serverId: 'api-server-1-prod',
      });

      expect(result.serverId).toBe('api-server-1-prod');
    });

    it('should reject non-string serverId', () => {
      expect(() =>
        validateServerOptions({
          port: 3000,
          eventSchemas: {},
          host: 'localhost',
          routesDir: './routes',
          bodyLimits: DEFAULT_OPTIONS.bodyLimits,
          serverId: 123 as any,
        })
      ).toThrow(/Invalid server options/);
    });

    it('should reject empty string serverId', () => {
      expect(() =>
        validateServerOptions({
          port: 3000,
          host: 'localhost',

          eventSchemas: {},
          routesDir: './routes',
          bodyLimits: DEFAULT_OPTIONS.bodyLimits,
          serverId: '',
        })
      ).toThrow(/Invalid server options/);
    });
  });
});
