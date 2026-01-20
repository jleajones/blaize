/**
 * Unit Tests for Platform-Aware File Detection
 *
 * Task [T2.1]: Test file detection across all platforms
 *
 * Tests cover:
 * - Browser File/Blob objects
 * - Node.js Buffer and ReadStream
 * - Duck-typing for File-like objects
 * - Recursive detection (arrays, objects, nested)
 * - Edge cases (null, undefined, empty arrays)
 * - No false positives on plain objects
 *
 * @packageDocumentation
 */

import { containsFileObjects, warnFileInInvalidMethod } from './file-detection';

describe('containsFileObjects()', () => {
  describe('Direct File/Blob Detection', () => {
    it('should detect File objects', () => {
      // Browser File object
      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      expect(containsFileObjects(file)).toBe(true);
    });

    it('should detect Blob objects', () => {
      // Browser Blob object
      const blob = new Blob(['content'], { type: 'text/plain' });
      expect(containsFileObjects(blob)).toBe(true);
    });

    it('should detect File with image MIME type', () => {
      const imageFile = new File(['binary'], 'photo.jpg', { type: 'image/jpeg' });
      expect(containsFileObjects(imageFile)).toBe(true);
    });

    it('should detect empty File', () => {
      const emptyFile = new File([], 'empty.txt', { type: 'text/plain' });
      expect(containsFileObjects(emptyFile)).toBe(true);
    });
  });

  describe('File in Objects', () => {
    it('should detect File in object property', () => {
      const data = {
        name: 'John',
        avatar: new File(['content'], 'avatar.jpg', { type: 'image/jpeg' }),
      };
      expect(containsFileObjects(data)).toBe(true);
    });

    it('should detect Blob in object property', () => {
      const data = {
        document: new Blob(['content'], { type: 'application/pdf' }),
      };
      expect(containsFileObjects(data)).toBe(true);
    });

    it('should detect File among multiple properties', () => {
      const data = {
        name: 'Alice',
        email: 'alice@example.com',
        age: 30,
        avatar: new File(['content'], 'avatar.png', { type: 'image/png' }),
        bio: 'Software engineer',
      };
      expect(containsFileObjects(data)).toBe(true);
    });
  });

  describe('File in Arrays', () => {
    it('should detect File in array', () => {
      const files = [new File(['content'], 'file1.txt'), new File(['content'], 'file2.txt')];
      expect(containsFileObjects(files)).toBe(true);
    });

    it('should detect File in object with array property', () => {
      const data = {
        images: [new File(['img1'], 'image1.jpg'), new File(['img2'], 'image2.jpg')],
      };
      expect(containsFileObjects(data)).toBe(true);
    });

    it('should detect File in mixed array (files + primitives)', () => {
      const mixed = [
        'string value',
        123,
        new File(['content'], 'file.txt'),
        true,
        { nested: 'object' },
      ];
      expect(containsFileObjects(mixed)).toBe(true);
    });

    it('should detect Blob in array of mixed types', () => {
      const mixed = ['text', new Blob(['data']), 42];
      expect(containsFileObjects(mixed)).toBe(true);
    });
  });

  describe('Nested File Detection (1 Level)', () => {
    it('should detect File in nested object', () => {
      const data = {
        profile: {
          avatar: new File(['content'], 'avatar.jpg'),
        },
      };
      expect(containsFileObjects(data)).toBe(true);
    });

    it('should detect File in array within object', () => {
      const data = {
        attachments: [new File(['doc'], 'document.pdf')],
      };
      expect(containsFileObjects(data)).toBe(true);
    });

    it('should detect File exactly 1 level deep (at the recursion limit)', () => {
      // File is exactly 1 level deep - this SHOULD be detected
      const data = {
        level1: {
          file: new File(['content'], 'file.txt'),
        },
      };
      expect(containsFileObjects(data)).toBe(true);
    });

    it('should detect File at 2 levels deep (at the recursion limit)', () => {
      // File at level 2 is within our 2-level recursion depth
      const deep = {
        user: {
          profile: {
            photo: new File(['photo'], 'photo.jpg'),
          },
        },
      };

      // Should detect - file is 2 levels deep, within our limit
      expect(containsFileObjects(deep)).toBe(true);
    });

    it('should detect File in array of objects', () => {
      const data = [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2', file: new File(['content'], 'file.txt') },
      ];
      expect(containsFileObjects(data)).toBe(true);
    });
  });

  describe('No False Positives', () => {
    it('should return false for primitive values', () => {
      expect(containsFileObjects(null)).toBe(false);
      expect(containsFileObjects(undefined)).toBe(false);
      expect(containsFileObjects('string')).toBe(false);
      expect(containsFileObjects(123)).toBe(false);
      expect(containsFileObjects(true)).toBe(false);
      expect(containsFileObjects(false)).toBe(false);
    });

    it('should return false for plain objects', () => {
      const plainObject = {
        name: 'John',
        email: 'john@example.com',
        age: 30,
        active: true,
      };
      expect(containsFileObjects(plainObject)).toBe(false);
    });

    it('should return false for arrays of primitives', () => {
      const primitives = ['string', 123, true, null];
      expect(containsFileObjects(primitives)).toBe(false);
    });

    it('should return false for empty object', () => {
      expect(containsFileObjects({})).toBe(false);
    });

    it('should return false for empty array', () => {
      expect(containsFileObjects([])).toBe(false);
    });

    it('should return false for nested plain objects', () => {
      const nested = {
        user: {
          name: 'Alice',
          settings: {
            theme: 'dark',
            notifications: true,
          },
        },
      };
      expect(containsFileObjects(nested)).toBe(false);
    });

    it('should return false for objects with file-like property names', () => {
      // Object has "file" property but not a File object
      const data = {
        file: 'not-a-file',
        filename: 'document.pdf',
        size: 12345,
        type: 'application/pdf',
      };
      expect(containsFileObjects(data)).toBe(false);
    });

    it('should return false for Date objects', () => {
      const data = {
        createdAt: new Date(),
      };
      expect(containsFileObjects(data)).toBe(false);
    });

    it('should return false for RegExp objects', () => {
      const data = {
        pattern: /test/,
      };
      expect(containsFileObjects(data)).toBe(false);
    });
  });

  describe('Node.js-Specific Detection', () => {
    it('should detect Buffer objects', () => {
      // Only run if Buffer is available (Node.js environment)
      if (typeof Buffer !== 'undefined') {
        const buffer = Buffer.from('test data');
        expect(containsFileObjects(buffer)).toBe(true);
      } else {
        // Skip test in browser environment
        expect(true).toBe(true);
      }
    });

    it('should detect Buffer in object property', () => {
      if (typeof Buffer !== 'undefined') {
        const data = {
          image: Buffer.from('binary data'),
        };
        expect(containsFileObjects(data)).toBe(true);
      } else {
        expect(true).toBe(true);
      }
    });
  });

  describe('Duck-Typing for File-Like Objects', () => {
    it('should detect object with File-like interface', () => {
      // Mock File-like object (duck-typing)
      const fileLike = {
        name: 'test.txt',
        size: 1024,
        type: 'text/plain',
        arrayBuffer: async () => new ArrayBuffer(0),
        slice: () => new Blob([]),
        stream: () => new ReadableStream(),
        text: async () => 'content',
      };

      expect(containsFileObjects(fileLike)).toBe(true);
    });

    it('should detect object with Blob-like interface', () => {
      // Mock Blob-like object (duck-typing)
      const blobLike = {
        size: 2048,
        type: 'application/json',
        arrayBuffer: async () => new ArrayBuffer(0),
        slice: () => new Blob([]),
        stream: () => new ReadableStream(),
        text: async () => '{}',
      };

      expect(containsFileObjects(blobLike)).toBe(true);
    });

    it('should NOT detect partial File-like object (missing methods)', () => {
      // Has some File properties but missing required methods
      const notFileLike = {
        name: 'test.txt',
        size: 1024,
        type: 'text/plain',
        // Missing: arrayBuffer, slice, stream, text
      };

      expect(containsFileObjects(notFileLike)).toBe(false);
    });

    it('should NOT detect object with only file-like properties', () => {
      // Has properties but no methods
      const propertiesOnly = {
        name: 'file.txt',
        size: 500,
        type: 'text/plain',
      };

      expect(containsFileObjects(propertiesOnly)).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle circular references gracefully', () => {
      // Create circular reference
      const circular: any = { name: 'test' };
      circular.self = circular;

      // Should not throw, should return false (no files)
      expect(() => containsFileObjects(circular)).not.toThrow();
      expect(containsFileObjects(circular)).toBe(false);
    });

    it('should detect files at 2-level depth (at the limit)', () => {
      // File at level 2 is within our 2-level recursion depth
      const deep = {
        level1: {
          level2: {
            file: new File(['content'], 'deep.txt'),
          },
        },
      };

      // Should detect - we recurse 2 levels deep
      expect(containsFileObjects(deep)).toBe(true);
    });

    it('should NOT detect files beyond 2-level depth limit', () => {
      // File at level 3 is beyond our 2-level recursion depth
      const veryDeep = {
        level1: {
          level2: {
            level3: {
              file: new File(['content'], 'very-deep.txt'),
            },
          },
        },
      };

      // Should NOT detect - we only recurse 2 levels deep
      expect(containsFileObjects(veryDeep)).toBe(false);
    });

    it('should handle objects with null values', () => {
      const data = {
        name: 'John',
        avatar: null,
        email: 'john@example.com',
      };
      expect(containsFileObjects(data)).toBe(false);
    });

    it('should handle objects with undefined values', () => {
      const data = {
        name: 'Alice',
        bio: undefined,
        file: new File(['content'], 'file.txt'),
      };
      expect(containsFileObjects(data)).toBe(true);
    });

    it('should handle arrays with null/undefined', () => {
      const data = [null, undefined, 'string', 123];
      expect(containsFileObjects(data)).toBe(false);
    });

    it('should handle Map objects', () => {
      const map = new Map<string, string | File>([
        ['key1', 'value1'],
        ['key2', new File(['content'], 'file.txt')],
      ]);

      // Map.values() should be iterable
      expect(containsFileObjects(map)).toBe(false); // Maps not directly supported
    });

    it('should handle Set objects', () => {
      const set = new Set([1, 2, 3, new File(['content'], 'file.txt')]);

      // Sets are not directly supported (not plain objects)
      expect(containsFileObjects(set)).toBe(false);
    });
  });

  describe('Real-World Scenarios', () => {
    it('should detect files in user profile update', () => {
      const profileData = {
        name: 'John Doe',
        email: 'john@example.com',
        bio: 'Software developer',
        avatar: new File(['avatar data'], 'avatar.jpg', { type: 'image/jpeg' }),
        coverPhoto: new File(['cover data'], 'cover.png', { type: 'image/png' }),
      };

      expect(containsFileObjects(profileData)).toBe(true);
    });

    it('should detect files in multi-file upload', () => {
      const uploadData = {
        category: 'documents',
        files: [
          new File(['doc1'], 'document1.pdf', { type: 'application/pdf' }),
          new File(['doc2'], 'document2.pdf', { type: 'application/pdf' }),
          new File(['doc3'], 'document3.pdf', { type: 'application/pdf' }),
        ],
      };

      expect(containsFileObjects(uploadData)).toBe(true);
    });

    it('should NOT detect files in JSON-only request', () => {
      const jsonData = {
        userId: 'user_123',
        action: 'update_profile',
        data: {
          name: 'Updated Name',
          settings: {
            theme: 'dark',
            notifications: {
              email: true,
              push: false,
            },
          },
        },
      };

      expect(containsFileObjects(jsonData)).toBe(false);
    });

    it('should detect file in form with both files and data', () => {
      const formData = {
        title: 'Product Upload',
        description: 'New product listing',
        price: 99.99,
        category: 'electronics',
        images: [new File(['img1'], 'product1.jpg'), new File(['img2'], 'product2.jpg')],
        specifications: {
          brand: 'BrandName',
          model: 'Model123',
        },
      };

      expect(containsFileObjects(formData)).toBe(true);
    });
  });
});

describe('warnFileInInvalidMethod()', () => {
  let consoleWarnSpy: any;

  beforeEach(() => {
    // Spy on console.warn
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore console.warn
    consoleWarnSpy.mockRestore();
    // Reset NODE_ENV
    delete (process.env as any).NODE_ENV;
  });

  describe('Development Mode Warnings', () => {
    beforeEach(() => {
      // Set development mode
      (process.env as any).NODE_ENV = 'development';
    });

    it('should warn for GET request with files', () => {
      warnFileInInvalidMethod('GET');

      expect(consoleWarnSpy).toHaveBeenCalledOnce();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[BlaizeJS Client] Warning: File objects detected in GET request')
      );
    });

    it('should warn for DELETE request with files', () => {
      warnFileInInvalidMethod('DELETE');

      expect(consoleWarnSpy).toHaveBeenCalledOnce();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          '[BlaizeJS Client] Warning: File objects detected in DELETE request'
        )
      );
    });

    it('should warn for HEAD request with files', () => {
      warnFileInInvalidMethod('HEAD');

      expect(consoleWarnSpy).toHaveBeenCalledOnce();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[BlaizeJS Client] Warning: File objects detected in HEAD request')
      );
    });

    it('should warn for OPTIONS request with files', () => {
      warnFileInInvalidMethod('OPTIONS');

      expect(consoleWarnSpy).toHaveBeenCalledOnce();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          '[BlaizeJS Client] Warning: File objects detected in OPTIONS request'
        )
      );
    });

    it('should handle lowercase method names', () => {
      warnFileInInvalidMethod('get');

      expect(consoleWarnSpy).toHaveBeenCalledOnce();
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('GET request'));
    });

    it('should NOT warn for POST request', () => {
      warnFileInInvalidMethod('POST');

      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should NOT warn for PUT request', () => {
      warnFileInInvalidMethod('PUT');

      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should NOT warn for PATCH request', () => {
      warnFileInInvalidMethod('PATCH');

      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });

  describe('Production Mode Silence', () => {
    beforeEach(() => {
      // Set production mode
      (process.env as any).NODE_ENV = 'production';
    });

    it('should NOT warn in production for GET', () => {
      warnFileInInvalidMethod('GET');

      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should NOT warn in production for DELETE', () => {
      warnFileInInvalidMethod('DELETE');

      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should NOT warn in production for HEAD', () => {
      warnFileInInvalidMethod('HEAD');

      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      (process.env as any).NODE_ENV = 'development';
    });

    it('should handle mixed-case method names', () => {
      warnFileInInvalidMethod('GeT');

      expect(consoleWarnSpy).toHaveBeenCalledOnce();
    });

    it('should handle custom HTTP methods', () => {
      warnFileInInvalidMethod('CUSTOM');

      // Custom methods are not in the invalid list, so no warning
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });
});
