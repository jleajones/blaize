/**
 * Tests for CORS validation schemas
 */

import { getDefaultCorsOptions } from './defaults';
import {
  corsOptionsSchema,
  serverCorsSchema,
  validateCorsOptions,
  validateOriginSecurity,
  mergeCorsOptions,
  isOriginString,
  isOriginRegExp,
  isOriginFunction,
  isOriginArray,
} from './validation';

import type { CorsOptions } from '@blaize-types/cors';

describe('CORS Validation Schemas', () => {
  describe('corsOptionsSchema', () => {
    test('should accept empty options object', () => {
      const result = corsOptionsSchema.parse({});
      expect(result).toEqual({});
    });

    test('should accept complete valid configuration', () => {
      const config: CorsOptions = {
        origin: 'https://example.com',
        methods: ['GET', 'POST', 'PUT'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        exposedHeaders: ['X-Total-Count'],
        credentials: true,
        maxAge: 86400,
        preflightContinue: false,
        optionsSuccessStatus: 204,
      };

      const result = corsOptionsSchema.parse(config);
      expect(result).toEqual(config);
    });

    describe('origin validation', () => {
      test('should accept boolean origin', () => {
        expect(corsOptionsSchema.parse({ origin: true })).toEqual({ origin: true });
        expect(corsOptionsSchema.parse({ origin: false })).toEqual({ origin: false });
      });

      test('should accept string origin', () => {
        const config = { origin: 'https://example.com' };
        expect(corsOptionsSchema.parse(config)).toEqual(config);
      });

      test('should accept RegExp origin', () => {
        const config = { origin: /^https:\/\/.*\.example\.com$/ };
        expect(corsOptionsSchema.parse(config)).toEqual(config);
      });

      test('should accept function origin', () => {
        const fn = (origin: string) => origin === 'https://example.com';
        const config = { origin: fn };
        const result = corsOptionsSchema.parse(config);
        expect(result.origin).toBe(fn);
      });

      test('should accept async function origin', () => {
        const fn = async (origin: string) => origin === 'https://example.com';
        const config = { origin: fn };
        const result = corsOptionsSchema.parse(config);
        expect(result.origin).toBe(fn);
      });

      test('should accept array of mixed origin types', () => {
        const fn = (origin: string) => origin.endsWith('.local');
        const config = {
          origin: ['https://app1.com', /^https:\/\/.*\.dev\.com$/, fn],
        };
        const result = corsOptionsSchema.parse(config);
        expect(Array.isArray(result.origin)).toBe(true);
        expect((result.origin as any)[0]).toBe('https://app1.com');
        expect((result.origin as any)[1]).toBeInstanceOf(RegExp);
        expect((result.origin as any)[2]).toBe(fn);
      });

      test('should reject invalid origin types', () => {
        expect(() => corsOptionsSchema.parse({ origin: 123 })).toThrow();
        expect(() => corsOptionsSchema.parse({ origin: {} })).toThrow();
        expect(() => corsOptionsSchema.parse({ origin: null })).toThrow();
      });
    });

    describe('methods validation', () => {
      test('should accept array of valid HTTP methods', () => {
        const config = { methods: ['GET', 'POST', 'CONNECT', 'TRACE'] };
        expect(corsOptionsSchema.parse(config)).toEqual(config);
      });

      test('should accept comma-delimited string of methods', () => {
        const config = { methods: 'GET, POST, PUT' };
        const result = corsOptionsSchema.parse(config);
        expect(result.methods).toEqual(['GET', 'POST', 'PUT']);
      });

      test('should trim whitespace from comma-delimited methods', () => {
        const config = { methods: ' GET , POST , PUT ' };
        const result = corsOptionsSchema.parse(config);
        expect(result.methods).toEqual(['GET', 'POST', 'PUT']);
      });

      test('should reject invalid HTTP methods', () => {
        expect(() => corsOptionsSchema.parse({ methods: ['INVALID'] })).toThrow();
        expect(() => corsOptionsSchema.parse({ methods: ['GET', 'FAKE'] })).toThrow();
      });

      test('should accept empty methods array', () => {
        const config = { methods: [] };
        expect(corsOptionsSchema.parse(config)).toEqual(config);
      });
    });

    describe('headers validation', () => {
      test('should accept array of header strings', () => {
        const config = {
          allowedHeaders: ['Content-Type', 'X-Custom-Header'],
          exposedHeaders: ['X-Total-Count', 'X-Page'],
        };
        expect(corsOptionsSchema.parse(config)).toEqual(config);
      });

      test('should accept comma-delimited header string', () => {
        const config = {
          allowedHeaders: 'Content-Type, Authorization',
          exposedHeaders: 'X-Total-Count, X-Page',
        };
        const result = corsOptionsSchema.parse(config);
        expect(result.allowedHeaders).toEqual(['Content-Type', 'Authorization']);
        expect(result.exposedHeaders).toEqual(['X-Total-Count', 'X-Page']);
      });

      test('should handle empty headers arrays', () => {
        const config = {
          allowedHeaders: [],
          exposedHeaders: [],
        };
        expect(corsOptionsSchema.parse(config)).toEqual(config);
      });

      test('should handle special header characters', () => {
        const config = {
          allowedHeaders: ['X-Custom-Header-123', 'Accept-*'],
        };
        expect(corsOptionsSchema.parse(config)).toEqual(config);
      });
    });

    describe('other options validation', () => {
      test('should validate credentials as boolean', () => {
        expect(corsOptionsSchema.parse({ credentials: true })).toEqual({ credentials: true });
        expect(corsOptionsSchema.parse({ credentials: false })).toEqual({ credentials: false });
        expect(() => corsOptionsSchema.parse({ credentials: 'true' })).toThrow();
      });

      test('should validate maxAge as integer', () => {
        expect(corsOptionsSchema.parse({ maxAge: 3600 })).toEqual({ maxAge: 3600 });
        expect(corsOptionsSchema.parse({ maxAge: -1 })).toEqual({ maxAge: -1 });
        expect(corsOptionsSchema.parse({ maxAge: 0 })).toEqual({ maxAge: 0 });
        expect(() => corsOptionsSchema.parse({ maxAge: 3.14 })).toThrow();
        expect(() => corsOptionsSchema.parse({ maxAge: '3600' })).toThrow();
      });

      test('should validate optionsSuccessStatus as HTTP status', () => {
        expect(corsOptionsSchema.parse({ optionsSuccessStatus: 200 })).toEqual({
          optionsSuccessStatus: 200,
        });
        expect(corsOptionsSchema.parse({ optionsSuccessStatus: 204 })).toEqual({
          optionsSuccessStatus: 204,
        });
        expect(corsOptionsSchema.parse({ optionsSuccessStatus: 299 })).toEqual({
          optionsSuccessStatus: 299,
        });
        expect(() => corsOptionsSchema.parse({ optionsSuccessStatus: 199 })).toThrow();
        expect(() => corsOptionsSchema.parse({ optionsSuccessStatus: 300 })).toThrow();
      });

      test('should validate preflightContinue as boolean', () => {
        expect(corsOptionsSchema.parse({ preflightContinue: true })).toEqual({
          preflightContinue: true,
        });
        expect(corsOptionsSchema.parse({ preflightContinue: false })).toEqual({
          preflightContinue: false,
        });
      });
    });

    test('should reject unknown properties (strict mode)', () => {
      expect(() =>
        corsOptionsSchema.parse({
          unknownOption: 'value',
        })
      ).toThrow();

      expect(() =>
        corsOptionsSchema.parse({
          origin: true,
          invalidField: 123,
        })
      ).toThrow();
    });
  });

  describe('serverCorsSchema', () => {
    test('should accept boolean values', () => {
      expect(serverCorsSchema.parse(true)).toBe(true);
      expect(serverCorsSchema.parse(false)).toBe(false);
    });

    test('should accept CorsOptions object', () => {
      const options = { origin: 'https://example.com', credentials: true };
      expect(serverCorsSchema.parse(options)).toEqual(options);
    });

    test('should accept undefined', () => {
      expect(serverCorsSchema.parse(undefined)).toBeUndefined();
    });
  });

  describe('validateCorsOptions', () => {
    test('should handle boolean shortcuts', () => {
      expect(validateCorsOptions(true)).toEqual({ origin: true });
      expect(validateCorsOptions(false)).toEqual({ origin: false });
    });

    test('should validate CorsOptions object', () => {
      const options = { origin: 'https://example.com', credentials: true };
      expect(validateCorsOptions(options)).toEqual(options);
    });

    test('should provide detailed error messages for invalid options', () => {
      expect(() => validateCorsOptions({ origin: 123 })).toThrow(/Invalid CORS options:/);

      expect(() => validateCorsOptions({ methods: ['INVALID'] })).toThrow(/Invalid CORS options:/);
    });
  });

  describe('validateOriginSecurity', () => {
    test('should allow wildcard without credentials', () => {
      expect(() =>
        validateOriginSecurity({
          origin: true,
          credentials: false,
        })
      ).not.toThrow();

      expect(() =>
        validateOriginSecurity({
          origin: '*',
          credentials: false,
        })
      ).not.toThrow();
    });

    test('should reject wildcard with credentials', () => {
      expect(() =>
        validateOriginSecurity({
          origin: true,
          credentials: true,
        })
      ).toThrow(/Cannot use wildcard origin/);

      expect(() =>
        validateOriginSecurity({
          origin: '*',
          credentials: true,
        })
      ).toThrow(/Cannot use wildcard origin/);
    });

    test('should reject wildcard in array with credentials', () => {
      expect(() =>
        validateOriginSecurity({
          origin: ['https://example.com', '*'],
          credentials: true,
        })
      ).toThrow(/Cannot include wildcard origin/);
    });

    test('should allow specific origins with credentials', () => {
      expect(() =>
        validateOriginSecurity({
          origin: 'https://example.com',
          credentials: true,
        })
      ).not.toThrow();

      expect(() =>
        validateOriginSecurity({
          origin: /^https:\/\//,
          credentials: true,
        })
      ).not.toThrow();
    });

    test('should handle undefined origin with credentials', () => {
      expect(() =>
        validateOriginSecurity({
          credentials: true,
          // origin is undefined
        })
      ).not.toThrow();
    });

    test('should handle origin false with credentials', () => {
      expect(() =>
        validateOriginSecurity({
          origin: false,
          credentials: true,
        })
      ).not.toThrow();
    });
  });

  describe('getDefaultCorsOptions', () => {
    test('should return permissive defaults for development', () => {
      const options = getDefaultCorsOptions(true);
      expect(options).toEqual({
        origin: true,
        methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
        credentials: false,
        optionsSuccessStatus: 204,
      });
    });

    test('should return restrictive defaults for production', () => {
      const options = getDefaultCorsOptions(false);
      expect(options).toEqual({
        origin: false,
        methods: ['GET', 'HEAD'],
        credentials: false,
        optionsSuccessStatus: 204,
      });
    });
  });

  describe('mergeCorsOptions', () => {
    const defaults: CorsOptions = {
      origin: false,
      methods: ['GET', 'HEAD'],
      credentials: false,
    };

    test('should handle boolean true', () => {
      const result = mergeCorsOptions(true, defaults);
      expect(result).toEqual({ ...defaults, origin: true });
    });

    test('should handle boolean false', () => {
      const result = mergeCorsOptions(false, defaults);
      expect(result).toEqual({ origin: false });
    });

    test('should handle undefined', () => {
      const result = mergeCorsOptions(undefined, defaults);
      expect(result).toEqual(defaults);
    });

    test('should merge user options with defaults', () => {
      const userOptions = { origin: 'https://example.com', maxAge: 3600 };
      const result = mergeCorsOptions(userOptions, defaults);
      expect(result).toEqual({
        ...defaults,
        ...userOptions,
      });
    });

    test('should not overwrite with undefined values', () => {
      const userOptions = {
        origin: 'https://example.com',
        methods: undefined,
        allowedHeaders: undefined,
      };
      const result = mergeCorsOptions(userOptions, defaults);
      expect(result.methods).toEqual(defaults.methods);
      expect(result.allowedHeaders).toBeUndefined();
    });
  });

  describe('type guards', () => {
    test('isOriginString', () => {
      expect(isOriginString('https://example.com')).toBe(true);
      expect(isOriginString(/regex/)).toBe(false);
      expect(isOriginString(() => true)).toBe(false);
      expect(isOriginString(['array'])).toBe(false);
      expect(isOriginString(undefined)).toBe(false);
      expect(isOriginString(true)).toBe(false);
    });

    test('isOriginRegExp', () => {
      expect(isOriginRegExp(/regex/)).toBe(true);
      expect(isOriginRegExp('string')).toBe(false);
      expect(isOriginRegExp(() => true)).toBe(false);
      expect(isOriginRegExp(['array'])).toBe(false);
      expect(isOriginRegExp(undefined)).toBe(false);
    });

    test('isOriginFunction', () => {
      expect(isOriginFunction(() => true)).toBe(true);
      expect(isOriginFunction(async () => true)).toBe(true);
      expect(isOriginFunction('string')).toBe(false);
      expect(isOriginFunction(/regex/)).toBe(false);
      expect(isOriginFunction(['array'])).toBe(false);
      expect(isOriginFunction(undefined)).toBe(false);
    });

    test('isOriginArray', () => {
      expect(isOriginArray(['string', /regex/])).toBe(true);
      expect(isOriginArray([])).toBe(true);
      expect(isOriginArray('string')).toBe(false);
      expect(isOriginArray(/regex/)).toBe(false);
      expect(isOriginArray(() => true)).toBe(false);
      expect(isOriginArray(undefined)).toBe(false);
    });
  });
});
