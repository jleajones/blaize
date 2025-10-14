/**
 * Tests for CORS Default Configurations
 *
 * Verifies environment-aware defaults and security validations
 */

import {
  getDefaultCorsOptions,
  isDevelopmentEnvironment,
  getEnvironmentName,
  validateProductionConfig,
} from './defaults';

import type { CorsOptions } from '@blaize-types/cors';

describe('CORS Defaults', () => {
  let originalNodeEnv: string | undefined;

  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe('getDefaultCorsOptions', () => {
    it('should return development defaults when NODE_ENV is not production', () => {
      process.env.NODE_ENV = 'development';

      const options = getDefaultCorsOptions();

      expect(options.origin).toBe(true); // Allow all origins
      expect(options.credentials).toBe(false); // No credentials with wildcard
      expect(options.methods).toEqual(['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE']);
      expect(options.optionsSuccessStatus).toBe(204);
    });

    it('should return production defaults when NODE_ENV is production', () => {
      process.env.NODE_ENV = 'production';

      const options = getDefaultCorsOptions();

      expect(options.origin).toBe(false); // Deny all cross-origin
      expect(options.credentials).toBe(false); // No credentials
      expect(options.methods).toEqual(['GET', 'HEAD']); // Read-only
      expect(options.optionsSuccessStatus).toBe(204);
    });

    it('should respect explicit isDevelopment parameter over environment', () => {
      process.env.NODE_ENV = 'production';

      // Force development mode despite production environment
      const devOptions = getDefaultCorsOptions(true);
      expect(devOptions.origin).toBe(true);
      expect(devOptions.methods).toEqual(['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE']);

      // Force production mode despite development environment
      process.env.NODE_ENV = 'development';
      const prodOptions = getDefaultCorsOptions(false);
      expect(prodOptions.origin).toBe(false);
      expect(prodOptions.methods).toEqual(['GET', 'HEAD']);
    });

    it('should treat undefined NODE_ENV as development', () => {
      delete process.env.NODE_ENV;

      const options = getDefaultCorsOptions();

      expect(options.origin).toBe(true); // Development defaults
    });

    it('should treat custom NODE_ENV values as development', () => {
      process.env.NODE_ENV = 'staging';

      const options = getDefaultCorsOptions();

      expect(options.origin).toBe(true); // Development defaults
    });

    it('should return new object instances to prevent mutation', () => {
      const options1 = getDefaultCorsOptions(true);
      const options2 = getDefaultCorsOptions(true);

      expect(options1).not.toBe(options2);
      expect(options1).toEqual(options2);
    });
  });

  describe('isDevelopmentEnvironment', () => {
    it('should return true for development', () => {
      process.env.NODE_ENV = 'development';
      expect(isDevelopmentEnvironment()).toBe(true);
    });

    it('should return false for production', () => {
      process.env.NODE_ENV = 'production';
      expect(isDevelopmentEnvironment()).toBe(false);
    });

    it('should return true for undefined NODE_ENV', () => {
      delete process.env.NODE_ENV;
      expect(isDevelopmentEnvironment()).toBe(true);
    });

    it('should return true for custom environments', () => {
      process.env.NODE_ENV = 'test';
      expect(isDevelopmentEnvironment()).toBe(true);

      process.env.NODE_ENV = 'staging';
      expect(isDevelopmentEnvironment()).toBe(true);
    });
  });

  describe('getEnvironmentName', () => {
    it('should return current NODE_ENV', () => {
      process.env.NODE_ENV = 'production';
      expect(getEnvironmentName()).toBe('production');

      process.env.NODE_ENV = 'development';
      expect(getEnvironmentName()).toBe('development');

      process.env.NODE_ENV = 'test';
      expect(getEnvironmentName()).toBe('test');
    });

    it('should return development for undefined NODE_ENV', () => {
      delete process.env.NODE_ENV;
      expect(getEnvironmentName()).toBe('development');
    });
  });

  describe('validateProductionConfig', () => {
    let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleWarnSpy.mockRestore();
    });

    it('should return true for secure production config', () => {
      const options: CorsOptions = {
        origin: 'https://app.example.com',
        credentials: true,
        methods: ['GET', 'POST', 'PUT'],
      };

      expect(validateProductionConfig(options)).toBe(true);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should warn about wildcard origin', () => {
      process.env.NODE_ENV = 'production';

      const options: CorsOptions = {
        origin: true,
        credentials: false,
      };

      expect(validateProductionConfig(options)).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Wildcard origin (*) should not be used in production')
      );
    });

    it('should return false for credentials with wildcard', () => {
      process.env.NODE_ENV = 'production';

      const options: CorsOptions = {
        origin: true,
        credentials: true, // Invalid combination
      };

      expect(validateProductionConfig(options)).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cannot use credentials with wildcard origin')
      );
    });

    it('should warn about dangerous HTTP methods', () => {
      process.env.NODE_ENV = 'production';

      const options: CorsOptions = {
        origin: 'https://app.example.com',
        methods: ['GET', 'POST', 'DELETE', 'TRACE'],
      };

      expect(validateProductionConfig(options)).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Dangerous HTTP methods')
      );
    });

    it('should handle methods as string', () => {
      process.env.NODE_ENV = 'production';

      const options: CorsOptions = {
        origin: 'https://app.example.com',
        methods: 'GET, POST, DELETE',
      };

      expect(validateProductionConfig(options)).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Dangerous HTTP methods')
      );
    });

    it('should not log warnings in development', () => {
      process.env.NODE_ENV = 'development';

      const options: CorsOptions = {
        origin: true,
        credentials: false,
      };

      validateProductionConfig(options);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });

  describe('Security implications', () => {
    it('should never allow credentials with wildcard in defaults', () => {
      // Development defaults
      const devOptions = getDefaultCorsOptions(true);
      if (devOptions.origin === true || devOptions.origin === '*') {
        expect(devOptions.credentials).toBe(false);
      }

      // Production defaults
      const prodOptions = getDefaultCorsOptions(false);
      expect(prodOptions.origin).toBe(false); // No wildcard at all
    });

    it('should use restrictive defaults in production', () => {
      process.env.NODE_ENV = 'production';
      const options = getDefaultCorsOptions();

      // Should deny cross-origin by default
      expect(options.origin).toBe(false);

      // Should only allow safe methods
      expect(options.methods).not.toContain('DELETE');
      expect(options.methods).not.toContain('PUT');
      expect(options.methods).not.toContain('PATCH');
    });
  });
});
