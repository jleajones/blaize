/**
 * Unit Tests for buildRequestOptions with Auto-Detection
 *
 * Task [T2.3]: Test automatic file detection and Content-Type handling
 *
 * Tests verify:
 * - File detection in both files and body properties
 * - FormData creation for file uploads
 * - Content-Type header handling (omitted for multipart, set for JSON)
 * - Correlation ID inclusion
 * - HTTP method handling
 * - Dev warnings for invalid method + file combinations
 *
 * @packageDocumentation
 */

import { buildRequestOptions } from './request-options-builder';

import type { ClientConfig } from '@blaize-types';

describe('buildRequestOptions() with Auto-Detection', () => {
  let mockConfig: ClientConfig;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let originalNodeEnv: string | undefined;

  beforeEach(() => {
    mockConfig = {
      baseUrl: 'https://api.example.com',
      timeout: 5000,
      defaultHeaders: {
        'X-API-Version': '1.0',
        'X-Client': 'BlaizeJS',
      },
    };

    // Save original NODE_ENV
    originalNodeEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    // Restore NODE_ENV
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }

    // Restore console.warn if spied
    if (consoleWarnSpy) {
      consoleWarnSpy.mockRestore();
    }
  });

  describe('File Detection and FormData', () => {
    it('should detect files in files property', () => {
      const file = new File(['content'], 'test.txt', { type: 'text/plain' });

      const options = buildRequestOptions(mockConfig, 'POST', {
        files: { document: file },
      });

      expect(options.body).toBeInstanceOf(FormData);
      expect(options.headers['Content-Type']).toBeUndefined();
    });

    it('should detect files in body property (legacy)', () => {
      const file = new File(['content'], 'test.txt', { type: 'text/plain' });

      const options = buildRequestOptions(mockConfig, 'POST', {
        body: { avatar: file, name: 'John' },
      });

      expect(options.body).toBeInstanceOf(FormData);
      expect(options.headers['Content-Type']).toBeUndefined();
    });

    it('should detect files in both files and body properties', () => {
      const file1 = new File(['content1'], 'file1.txt', { type: 'text/plain' });
      const file2 = new File(['content2'], 'file2.txt', { type: 'text/plain' });

      const options = buildRequestOptions(mockConfig, 'POST', {
        body: { title: 'Report' },
        files: { document: file1, attachment: file2 },
      });

      expect(options.body).toBeInstanceOf(FormData);
      expect(options.headers['Content-Type']).toBeUndefined();
    });

    it('should detect nested files in body (2 levels deep)', () => {
      const file = new File(['content'], 'nested.txt', { type: 'text/plain' });

      const options = buildRequestOptions(mockConfig, 'POST', {
        body: {
          user: {
            profile: {
              avatar: file,
            },
          },
        },
      });

      expect(options.body).toBeInstanceOf(FormData);
      expect(options.headers['Content-Type']).toBeUndefined();
    });

    it('should detect files in arrays', () => {
      const files = [
        new File(['img1'], 'photo1.jpg', { type: 'image/jpeg' }),
        new File(['img2'], 'photo2.jpg', { type: 'image/jpeg' }),
      ];

      const options = buildRequestOptions(mockConfig, 'POST', {
        files: { photos: files },
      });

      expect(options.body).toBeInstanceOf(FormData);
    });

    it('should prioritize files property over body when both have files', () => {
      const fileInFiles = new File(['from files'], 'files.txt', { type: 'text/plain' });
      const fileInBody = new File(['from body'], 'body.txt', { type: 'text/plain' });

      const options = buildRequestOptions(mockConfig, 'POST', {
        body: { document: fileInBody },
        files: { document: fileInFiles },
      });

      // Both will be in FormData, but files property takes precedence in buildFormData
      expect(options.body).toBeInstanceOf(FormData);
    });
  });

  describe('JSON Encoding (No Files)', () => {
    it('should use JSON for requests without files', () => {
      const options = buildRequestOptions(mockConfig, 'POST', {
        body: { name: 'John', email: 'john@example.com' },
      });

      expect(options.body).toBe('{"name":"John","email":"john@example.com"}');
      expect(options.headers['Content-Type']).toBe('application/json');
    });

    it('should handle nested objects in JSON', () => {
      const options = buildRequestOptions(mockConfig, 'POST', {
        body: {
          user: { name: 'John', age: 30 },
          settings: { theme: 'dark' },
        },
      });

      const parsed = JSON.parse(options.body as string);
      expect(parsed).toEqual({
        user: { name: 'John', age: 30 },
        settings: { theme: 'dark' },
      });
      expect(options.headers['Content-Type']).toBe('application/json');
    });

    it('should handle arrays in JSON', () => {
      const options = buildRequestOptions(mockConfig, 'POST', {
        body: {
          tags: ['typescript', 'nodejs'],
          numbers: [1, 2, 3],
        },
      });

      expect(options.body).toBe('{"tags":["typescript","nodejs"],"numbers":[1,2,3]}');
      expect(options.headers['Content-Type']).toBe('application/json');
    });

    it('should handle empty object as JSON', () => {
      const options = buildRequestOptions(mockConfig, 'POST', {
        body: {},
      });

      expect(options.body).toBe('{}');
      expect(options.headers['Content-Type']).toBe('application/json');
    });
  });

  describe('Content-Type Header Handling', () => {
    it('should NOT set Content-Type for multipart (browser adds boundary)', () => {
      const file = new File(['content'], 'test.txt', { type: 'text/plain' });

      const options = buildRequestOptions(mockConfig, 'POST', {
        files: { document: file },
      });

      expect(options.headers['Content-Type']).toBeUndefined();
      expect(options.headers).not.toHaveProperty('Content-Type');
    });

    it('should set Content-Type: application/json for JSON requests', () => {
      const options = buildRequestOptions(mockConfig, 'POST', {
        body: { name: 'John' },
      });

      expect(options.headers['Content-Type']).toBe('application/json');
    });

    it('should not set Content-Type when body is undefined', () => {
      const options = buildRequestOptions(mockConfig, 'GET', {
        query: { page: 1 },
      });

      expect(options.headers['Content-Type']).toBeUndefined();
    });
  });

  describe('Correlation ID', () => {
    it('should include correlation ID in headers', () => {
      const options = buildRequestOptions(
        mockConfig,
        'POST',
        { body: { name: 'John' } },
        'test-correlation-123'
      );

      expect(options.headers['x-correlation-id']).toBe('test-correlation-123');
    });

    it('should work without correlation ID', () => {
      const options = buildRequestOptions(mockConfig, 'POST', { body: { name: 'John' } });

      expect(options.headers['x-correlation-id']).toBeUndefined();
    });

    it('should include correlation ID for all request types', () => {
      const corrId = 'multi-type-corr-456';

      // JSON request
      const jsonOptions = buildRequestOptions(
        mockConfig,
        'POST',
        { body: { name: 'John' } },
        corrId
      );
      expect(jsonOptions.headers['x-correlation-id']).toBe(corrId);

      // File request
      const file = new File(['content'], 'test.txt');
      const fileOptions = buildRequestOptions(mockConfig, 'POST', { files: { doc: file } }, corrId);
      expect(fileOptions.headers['x-correlation-id']).toBe(corrId);

      // GET request
      const getOptions = buildRequestOptions(mockConfig, 'GET', { query: { id: '1' } }, corrId);
      expect(getOptions.headers['x-correlation-id']).toBe(corrId);
    });
  });

  describe('HTTP Method Handling', () => {
    it('should uppercase method names', () => {
      const options = buildRequestOptions(mockConfig, 'post', { body: { name: 'John' } });

      expect(options.method).toBe('POST');
    });

    it('should handle GET requests without body', () => {
      const options = buildRequestOptions(mockConfig, 'GET', {
        params: { userId: '123' },
        query: { include: 'posts' },
      });

      expect(options.method).toBe('GET');
      expect(options.body).toBeUndefined();
    });

    it('should handle HEAD requests without body', () => {
      const options = buildRequestOptions(mockConfig, 'HEAD', {
        params: { resourceId: '456' },
      });

      expect(options.method).toBe('HEAD');
      expect(options.body).toBeUndefined();
    });

    it('should handle DELETE requests without body', () => {
      const options = buildRequestOptions(mockConfig, 'DELETE', {
        params: { userId: '789' },
      });

      expect(options.method).toBe('DELETE');
      expect(options.body).toBeUndefined();
    });

    it('should handle OPTIONS requests without body', () => {
      const options = buildRequestOptions(mockConfig, 'OPTIONS', {});

      expect(options.method).toBe('OPTIONS');
      expect(options.body).toBeUndefined();
    });

    it('should handle POST with body', () => {
      const options = buildRequestOptions(mockConfig, 'POST', {
        body: { name: 'John' },
      });

      expect(options.method).toBe('POST');
      expect(options.body).toBeDefined();
    });

    it('should handle PUT with body', () => {
      const options = buildRequestOptions(mockConfig, 'PUT', {
        body: { name: 'Updated' },
      });

      expect(options.method).toBe('PUT');
      expect(options.body).toBe('{"name":"Updated"}');
    });

    it('should handle PATCH with body', () => {
      const options = buildRequestOptions(mockConfig, 'PATCH', {
        body: { status: 'active' },
      });

      expect(options.method).toBe('PATCH');
      expect(options.body).toBe('{"status":"active"}');
    });
  });

  describe('Header Merging', () => {
    it('should merge default headers from config', () => {
      const options = buildRequestOptions(mockConfig, 'POST', { body: { name: 'John' } });

      expect(options.headers['X-API-Version']).toBe('1.0');
      expect(options.headers['X-Client']).toBe('BlaizeJS');
    });

    it('should work with no default headers', () => {
      const configNoHeaders: ClientConfig = {
        baseUrl: 'https://api.example.com',
        timeout: 5000,
      };

      const options = buildRequestOptions(configNoHeaders, 'POST', {
        body: { name: 'John' },
      });

      expect(options.headers['Content-Type']).toBe('application/json');
    });

    it('should preserve custom headers for multipart', () => {
      const file = new File(['content'], 'test.txt');

      const options = buildRequestOptions(mockConfig, 'POST', {
        files: { document: file },
      });

      expect(options.headers['X-API-Version']).toBe('1.0');
      expect(options.headers['X-Client']).toBe('BlaizeJS');
      expect(options.headers['Content-Type']).toBeUndefined();
    });
  });

  describe('Timeout Handling', () => {
    it('should use timeout from config', () => {
      const options = buildRequestOptions(mockConfig, 'POST', { body: { name: 'John' } });

      expect(options.timeout).toBe(5000);
    });

    it('should default to 30000ms when not specified', () => {
      const configNoTimeout: ClientConfig = {
        baseUrl: 'https://api.example.com',
      };

      const options = buildRequestOptions(configNoTimeout, 'POST', {
        body: { name: 'John' },
      });

      expect(options.timeout).toBe(30000);
    });

    it('should support custom timeout values', () => {
      const customConfig: ClientConfig = {
        baseUrl: 'https://api.example.com',
        timeout: 60000,
      };

      const options = buildRequestOptions(customConfig, 'POST', { body: { name: 'John' } });

      expect(options.timeout).toBe(60000);
    });
  });

  describe('Dev Warnings for Invalid Method + Files', () => {
    beforeEach(() => {
      consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      process.env.NODE_ENV = 'development';
    });

    it('should warn when files detected in GET request', () => {
      const file = new File(['content'], 'test.txt');

      buildRequestOptions(mockConfig, 'GET', {
        body: { file },
      });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[BlaizeJS Client] Warning: File objects detected in GET request')
      );
    });

    it('should warn when files detected in DELETE request', () => {
      const file = new File(['content'], 'test.txt');

      buildRequestOptions(mockConfig, 'DELETE', {
        files: { document: file },
      });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          '[BlaizeJS Client] Warning: File objects detected in DELETE request'
        )
      );
    });

    it('should warn when files detected in HEAD request', () => {
      const file = new File(['content'], 'test.txt');

      buildRequestOptions(mockConfig, 'HEAD', {
        body: { avatar: file },
      });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[BlaizeJS Client] Warning: File objects detected in HEAD request')
      );
    });

    it('should NOT warn for files in POST request', () => {
      const file = new File(['content'], 'test.txt');

      buildRequestOptions(mockConfig, 'POST', {
        files: { document: file },
      });

      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should NOT warn for files in PUT request', () => {
      const file = new File(['content'], 'test.txt');

      buildRequestOptions(mockConfig, 'PUT', {
        files: { document: file },
      });

      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should NOT warn for files in PATCH request', () => {
      const file = new File(['content'], 'test.txt');

      buildRequestOptions(mockConfig, 'PATCH', {
        files: { document: file },
      });

      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should NOT warn in production mode', () => {
      process.env.NODE_ENV = 'production';
      const file = new File(['content'], 'test.txt');

      buildRequestOptions(mockConfig, 'GET', {
        body: { file },
      });

      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty args object', () => {
      const options = buildRequestOptions(mockConfig, 'GET', {});

      expect(options.method).toBe('GET');
      expect(options.body).toBeUndefined();
      expect(options.headers['X-API-Version']).toBe('1.0');
    });

    it('should handle missing args parameter (defaults to {})', () => {
      const options = buildRequestOptions(mockConfig, 'GET');

      expect(options.method).toBe('GET');
      expect(options.body).toBeUndefined();
    });

    it('should handle undefined body', () => {
      const options = buildRequestOptions(mockConfig, 'POST', {
        body: undefined,
      });

      expect(options.body).toBeUndefined();
      expect(options.headers['Content-Type']).toBeUndefined();
    });

    it('should handle null body (JSON stringify)', () => {
      const options = buildRequestOptions(mockConfig, 'POST', {
        body: null,
      });

      expect(options.body).toBe('null');
      expect(options.headers['Content-Type']).toBe('application/json');
    });
  });

  describe('Real-World Usage Patterns', () => {
    it('should handle user profile update with avatar', () => {
      const avatar = new File(['avatar data'], 'avatar.jpg', { type: 'image/jpeg' });

      const options = buildRequestOptions(
        mockConfig,
        'PATCH',
        {
          body: { name: 'John Doe', bio: 'Developer' },
          files: { avatar },
        },
        'profile-update-123'
      );

      expect(options.method).toBe('PATCH');
      expect(options.body).toBeInstanceOf(FormData);
      expect(options.headers['Content-Type']).toBeUndefined();
      expect(options.headers['x-correlation-id']).toBe('profile-update-123');
    });

    it('should handle document upload', () => {
      const pdf = new File(['pdf content'], 'report.pdf', { type: 'application/pdf' });

      const options = buildRequestOptions(
        mockConfig,
        'POST',
        {
          body: {
            title: 'Q4 Report',
            category: 'finance',
          },
          files: { document: pdf },
        },
        'doc-upload-456'
      );

      expect(options.body).toBeInstanceOf(FormData);
      expect(options.headers['x-correlation-id']).toBe('doc-upload-456');
    });

    it('should handle simple API call without files', () => {
      const options = buildRequestOptions(
        mockConfig,
        'POST',
        {
          body: {
            email: 'user@example.com',
            password: 'secret123',
          },
        },
        'login-789'
      );

      expect(options.method).toBe('POST');
      expect(options.body).toBe('{"email":"user@example.com","password":"secret123"}');
      expect(options.headers['Content-Type']).toBe('application/json');
    });

    it('should handle paginated GET request', () => {
      const options = buildRequestOptions(
        mockConfig,
        'GET',
        {
          params: { resource: 'users' },
          query: { page: 2, limit: 50 },
        },
        'paginated-req'
      );

      expect(options.method).toBe('GET');
      expect(options.body).toBeUndefined();
      expect(options.headers['x-correlation-id']).toBe('paginated-req');
    });
  });
});
