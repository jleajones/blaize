/**
 * Tests for z.file() Zod Extension
 *
 * Task [T1.2]: Implement z.file() Zod Extension
 *
 * Tests verify:
 * - MIME type validation (exact matches and wildcards)
 * - Size validation (min/max using parseSize)
 * - Zod combinator compatibility (.optional, .array, .refine)
 * - Type inference to UploadedFile
 * - Schema detection marker (isFileSchema: true)
 * - Edge cases and error messages
 *
 * Run with: vitest
 */

import { z } from 'zod';

import { file, isFileSchema } from './schema';

import type { UploadedFile } from '@blaize-types/upload';

// Helper to create mock uploaded files using the updated interface
function createMockFile(overrides?: Partial<UploadedFile>): UploadedFile {
  return {
    fieldname: 'file',
    originalname: 'test.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    size: 1024 * 1024, // 1MB
    buffer: Buffer.from('fake-image-data'),
    ...overrides,
  };
}

describe('z.file() Schema Creation', () => {
  // =========================================================================
  // Test Suite 1: Basic Schema Creation
  // =========================================================================

  describe('Schema Creation', () => {
    it('should create file schema without options', () => {
      const schema = file();

      expect(schema).toBeDefined();
      // schema should be a valid Zod type
      expect(schema.safeParse).toBeDefined();
    });

    it('should create file schema with options', () => {
      const schema = file({
        maxSize: '5MB',
        accept: ['image/jpeg', 'image/png'],
      });

      expect(schema).toBeDefined();
    });

    it('should have isFileSchema marker', () => {
      const schema = file();

      // The schema should be detectable as a file schema
      expect(isFileSchema(schema)).toBe(true);
    });

    it('should infer to UploadedFile type', () => {
      const _schema = file();

      type Inferred = z.infer<typeof _schema>;
      expectTypeOf<Inferred>().toEqualTypeOf<UploadedFile>();
    });
  });

  // =========================================================================
  // Test Suite 2: MIME Type Validation - Exact Matches
  // =========================================================================

  describe('MIME Type Validation - Exact Matches', () => {
    it('should accept file with exact MIME match', () => {
      const schema = file({ accept: ['image/jpeg', 'image/png'] });
      const mockFile = createMockFile({ mimetype: 'image/jpeg' });

      const result = schema.safeParse(mockFile);
      expect(result.success).toBe(true);
    });

    it('should reject file with non-matching MIME', () => {
      const schema = file({ accept: ['image/jpeg'] });
      const mockFile = createMockFile({ mimetype: 'image/png' });

      const result = schema.safeParse(mockFile);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]!.message).toContain('Invalid file type');
        expect(result.error.issues[0]!.message).toContain('image/png');
      }
    });

    it('should accept multiple MIME types', () => {
      const schema = file({ accept: ['image/jpeg', 'image/png', 'image/gif'] });

      const jpeg = createMockFile({ mimetype: 'image/jpeg' });
      const png = createMockFile({ mimetype: 'image/png' });
      const gif = createMockFile({ mimetype: 'image/gif' });

      expect(schema.safeParse(jpeg).success).toBe(true);
      expect(schema.safeParse(png).success).toBe(true);
      expect(schema.safeParse(gif).success).toBe(true);
    });

    it('should accept any MIME type when accept is not specified', () => {
      const schema = file();

      const jpeg = createMockFile({ mimetype: 'image/jpeg' });
      const pdf = createMockFile({ mimetype: 'application/pdf' });
      const txt = createMockFile({ mimetype: 'text/plain' });

      expect(schema.safeParse(jpeg).success).toBe(true);
      expect(schema.safeParse(pdf).success).toBe(true);
      expect(schema.safeParse(txt).success).toBe(true);
    });
  });

  // =========================================================================
  // Test Suite 3: MIME Type Validation - Wildcards
  // =========================================================================

  describe('MIME Type Validation - Wildcards', () => {
    it('should support image/* wildcard', () => {
      const schema = file({ accept: ['image/*'] });

      const jpeg = createMockFile({ mimetype: 'image/jpeg' });
      const png = createMockFile({ mimetype: 'image/png' });
      const gif = createMockFile({ mimetype: 'image/gif' });
      const webp = createMockFile({ mimetype: 'image/webp' });

      expect(schema.safeParse(jpeg).success).toBe(true);
      expect(schema.safeParse(png).success).toBe(true);
      expect(schema.safeParse(gif).success).toBe(true);
      expect(schema.safeParse(webp).success).toBe(true);
    });

    it('should reject non-matching wildcard types', () => {
      const schema = file({ accept: ['image/*'] });
      const pdf = createMockFile({ mimetype: 'application/pdf' });

      const result = schema.safeParse(pdf);
      expect(result.success).toBe(false);
    });

    it('should support video/* wildcard', () => {
      const schema = file({ accept: ['video/*'] });

      const mp4 = createMockFile({ mimetype: 'video/mp4' });
      const webm = createMockFile({ mimetype: 'video/webm' });

      expect(schema.safeParse(mp4).success).toBe(true);
      expect(schema.safeParse(webm).success).toBe(true);
    });

    it('should support audio/* wildcard', () => {
      const schema = file({ accept: ['audio/*'] });

      const mp3 = createMockFile({ mimetype: 'audio/mpeg' });
      const wav = createMockFile({ mimetype: 'audio/wav' });

      expect(schema.safeParse(mp3).success).toBe(true);
      expect(schema.safeParse(wav).success).toBe(true);
    });

    it('should support mixing exact and wildcard matches', () => {
      const schema = file({ accept: ['image/*', 'application/pdf'] });

      const jpeg = createMockFile({ mimetype: 'image/jpeg' });
      const pdf = createMockFile({ mimetype: 'application/pdf' });
      const txt = createMockFile({ mimetype: 'text/plain' });

      expect(schema.safeParse(jpeg).success).toBe(true);
      expect(schema.safeParse(pdf).success).toBe(true);
      expect(schema.safeParse(txt).success).toBe(false);
    });
  });

  // =========================================================================
  // Test Suite 4: Size Validation - Maximum
  // =========================================================================

  describe('Size Validation - Maximum', () => {
    it('should accept file within max size', () => {
      const schema = file({ maxSize: '5MB' });
      const mockFile = createMockFile({ size: 1024 * 1024 }); // 1MB

      const result = schema.safeParse(mockFile);
      expect(result.success).toBe(true);
    });

    it('should reject file exceeding max size', () => {
      const schema = file({ maxSize: '5MB' });
      const mockFile = createMockFile({ size: 10 * 1024 * 1024 }); // 10MB

      const result = schema.safeParse(mockFile);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]!.message).toContain('exceeds maximum');
        expect(result.error.issues[0]!.message).toContain('10 MB');
        expect(result.error.issues[0]!.message).toContain('5 MB');
      }
    });

    it('should accept file exactly at max size', () => {
      const schema = file({ maxSize: '5MB' });
      const mockFile = createMockFile({ size: 5 * 1024 * 1024 }); // Exactly 5MB

      const result = schema.safeParse(mockFile);
      expect(result.success).toBe(true);
    });

    it('should accept numeric maxSize (bytes)', () => {
      const schema = file({ maxSize: 1024 * 1024 }); // 1MB in bytes
      const mockFile = createMockFile({ size: 512 * 1024 }); // 512KB

      const result = schema.safeParse(mockFile);
      expect(result.success).toBe(true);
    });
  });

  // =========================================================================
  // Test Suite 5: Size Validation - Minimum
  // =========================================================================

  describe('Size Validation - Minimum', () => {
    it('should accept file above min size', () => {
      const schema = file({ minSize: '100KB' });
      const mockFile = createMockFile({ size: 500 * 1024 }); // 500KB

      const result = schema.safeParse(mockFile);
      expect(result.success).toBe(true);
    });

    it('should reject file below min size', () => {
      const schema = file({ minSize: '100KB' });
      const mockFile = createMockFile({ size: 50 * 1024 }); // 50KB

      const result = schema.safeParse(mockFile);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]!.message).toContain('below minimum');
        expect(result.error.issues[0]!.message).toContain('50 KB');
        expect(result.error.issues[0]!.message).toContain('100 KB');
      }
    });

    it('should accept file exactly at min size', () => {
      const schema = file({ minSize: '100KB' });
      const mockFile = createMockFile({ size: 100 * 1024 }); // Exactly 100KB

      const result = schema.safeParse(mockFile);
      expect(result.success).toBe(true);
    });
  });

  // =========================================================================
  // Test Suite 6: Size Validation - Min and Max Together
  // =========================================================================

  describe('Size Validation - Min and Max Together', () => {
    it('should accept file within range', () => {
      const schema = file({ minSize: '100KB', maxSize: '5MB' });
      const mockFile = createMockFile({ size: 1024 * 1024 }); // 1MB

      const result = schema.safeParse(mockFile);
      expect(result.success).toBe(true);
    });

    it('should reject file below min', () => {
      const schema = file({ minSize: '100KB', maxSize: '5MB' });
      const mockFile = createMockFile({ size: 50 * 1024 }); // 50KB

      const result = schema.safeParse(mockFile);
      expect(result.success).toBe(false);
    });

    it('should reject file above max', () => {
      const schema = file({ minSize: '100KB', maxSize: '5MB' });
      const mockFile = createMockFile({ size: 10 * 1024 * 1024 }); // 10MB

      const result = schema.safeParse(mockFile);
      expect(result.success).toBe(false);
    });
  });

  // =========================================================================
  // Test Suite 7: Combined Validation (MIME + Size)
  // =========================================================================

  describe('Combined Validation', () => {
    it('should validate both MIME and size', () => {
      const schema = file({
        accept: ['image/jpeg', 'image/png'],
        maxSize: '5MB',
      });

      // Valid file
      const valid = createMockFile({
        mimetype: 'image/jpeg',
        size: 1024 * 1024, // 1MB
      });
      expect(schema.safeParse(valid).success).toBe(true);

      // Invalid MIME
      const invalidMime = createMockFile({
        mimetype: 'application/pdf',
        size: 1024 * 1024,
      });
      expect(schema.safeParse(invalidMime).success).toBe(false);

      // Invalid size
      const invalidSize = createMockFile({
        mimetype: 'image/jpeg',
        size: 10 * 1024 * 1024, // 10MB
      });
      expect(schema.safeParse(invalidSize).success).toBe(false);
    });

    it('should provide clear error messages for multiple violations', () => {
      const schema = file({
        accept: ['image/*'],
        maxSize: '1MB',
      });

      const badFile = createMockFile({
        mimetype: 'application/pdf',
        size: 5 * 1024 * 1024, // 5MB
      });

      const result = schema.safeParse(badFile);
      expect(result.success).toBe(false);
      if (!result.success) {
        // Should have error for both MIME and size
        const messages = result.error.issues.map(i => i.message).join(' ');
        expect(messages).toContain('Invalid file type');
        expect(messages).toContain('exceeds maximum');
      }
    });
  });

  // =========================================================================
  // Test Suite 8: Zod Combinators (.optional, .array, .refine)
  // =========================================================================

  describe('Zod Combinators', () => {
    it('should work with .optional()', () => {
      const schema = file({ maxSize: '5MB' }).optional();

      // Undefined is valid
      expect(schema.safeParse(undefined).success).toBe(true);

      // Valid file is valid
      const mockFile = createMockFile({ size: 1024 * 1024 });
      expect(schema.safeParse(mockFile).success).toBe(true);

      // Invalid file is still invalid
      const bigFile = createMockFile({ size: 10 * 1024 * 1024 });
      expect(schema.safeParse(bigFile).success).toBe(false);
    });

    it('should work with .array()', () => {
      const schema = z.array(file({ maxSize: '5MB' }));

      const files = [
        createMockFile({ size: 1024 * 1024 }),
        createMockFile({ size: 2 * 1024 * 1024 }),
      ];

      expect(schema.safeParse(files).success).toBe(true);

      // One invalid file makes whole array invalid
      const filesWithBad = [
        createMockFile({ size: 1024 * 1024 }),
        createMockFile({ size: 10 * 1024 * 1024 }), // Too large
      ];

      expect(schema.safeParse(filesWithBad).success).toBe(false);
    });

    it('should work with .refine() for custom validation', () => {
      const schema = file({ maxSize: '5MB' }).refine(file => file.originalname.endsWith('.jpg'), {
        message: 'File must have .jpg extension',
      });

      const validFile = createMockFile({ originalname: 'photo.jpg' });
      expect(schema.safeParse(validFile).success).toBe(true);

      const invalidFile = createMockFile({ originalname: 'photo.png' });
      const result = schema.safeParse(invalidFile);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]!.message).toBe('File must have .jpg extension');
      }
    });

    it('should work with .nullable()', () => {
      const schema = file().nullable();

      expect(schema.safeParse(null).success).toBe(true);
      expect(schema.safeParse(createMockFile()).success).toBe(true);
    });

    it('should work with .default()', () => {
      const defaultFile = createMockFile({ originalname: 'default.jpg' });
      const schema = file().default(defaultFile);

      const result = schema.parse(undefined);
      expect(result).toBe(defaultFile);
    });
  });

  // =========================================================================
  // Test Suite 9: Edge Cases
  // =========================================================================

  describe('Edge Cases', () => {
    it('should handle zero-byte files', () => {
      const schema = file({ minSize: '0B' });
      const emptyFile = createMockFile({ size: 0 });

      expect(schema.safeParse(emptyFile).success).toBe(true);
    });

    it('should handle very large files', () => {
      const schema = file({ maxSize: '5GB' });
      const largeFile = createMockFile({ size: 1024 * 1024 * 1024 }); // 1GB

      expect(schema.safeParse(largeFile).success).toBe(true);
    });

    it('should handle files without mimetype', () => {
      const schema = file({ accept: ['image/*'] });
      const fileWithoutMime = createMockFile({ mimetype: '' });

      const result = schema.safeParse(fileWithoutMime);
      expect(result.success).toBe(false);
    });

    it('should handle malformed MIME types gracefully', () => {
      const schema = file({ accept: ['image/jpeg'] });
      const malformed = createMockFile({ mimetype: 'invalid' });

      const result = schema.safeParse(malformed);
      expect(result.success).toBe(false);
    });

    it('should reject non-file objects', () => {
      const schema = file();

      expect(schema.safeParse({}).success).toBe(false);
      expect(schema.safeParse('not a file').success).toBe(false);
      expect(schema.safeParse(123).success).toBe(false);
      expect(schema.safeParse(null).success).toBe(false);
    });

    it('should handle negative size (corrupted file)', () => {
      const schema = file();
      const corruptedFile = createMockFile({ size: -100 });

      const result = schema.safeParse(corruptedFile);
      expect(result.success).toBe(false);
    });

    it('should accept files without buffer (stream strategy)', () => {
      const schema = file({ maxSize: '5MB' });
      const streamFile = createMockFile({
        buffer: undefined,
        stream: undefined as any, // Would be a Readable in real usage
      });

      // Should still validate MIME and size even without buffer
      expect(schema.safeParse(streamFile).success).toBe(true);
    });
  });

  // =========================================================================
  // Test Suite 10: Error Messages Quality
  // =========================================================================

  describe('Error Messages', () => {
    it('should provide helpful MIME type error', () => {
      const schema = file({ accept: ['image/jpeg', 'image/png'] });
      const badFile = createMockFile({ mimetype: 'application/pdf' });

      const result = schema.safeParse(badFile);
      expect(result.success).toBe(false);
      if (!result.success) {
        const message = result.error.issues[0]!.message;
        expect(message).toContain('Invalid file type');
        expect(message).toContain('application/pdf');
        expect(message).toContain('image/jpeg');
        expect(message).toContain('image/png');
      }
    });

    it('should provide helpful size error with formatted bytes', () => {
      const schema = file({ maxSize: '5MB' });
      const bigFile = createMockFile({ size: 10 * 1024 * 1024 });

      const result = schema.safeParse(bigFile);
      expect(result.success).toBe(false);
      if (!result.success) {
        const message = result.error.issues[0]!.message;
        expect(message).toContain('10 MB'); // Actual size formatted
        expect(message).toContain('5 MB'); // Max size formatted
      }
    });

    it('should provide context in error path', () => {
      const schema = file({ maxSize: '5MB' });
      const bigFile = createMockFile({ size: 10 * 1024 * 1024 });

      const result = schema.safeParse(bigFile);
      expect(result.success).toBe(false);
      if (!result.success) {
        // Path should be empty for top-level validation
        expect(result.error.issues[0]!.path).toEqual([]);
      }
    });
  });
});

// =============================================================================
// isFileSchema() Helper Tests
// =============================================================================

describe('isFileSchema() Detection Helper', () => {
  it('should detect file schemas', () => {
    const schema = file();
    expect(isFileSchema(schema)).toBe(true);
  });

  it('should detect file schemas with options', () => {
    const schema = file({ maxSize: '5MB', accept: ['image/*'] });
    expect(isFileSchema(schema)).toBe(true);
  });

  it('should detect wrapped file schemas (.optional)', () => {
    const schema = file().optional();
    expect(isFileSchema(schema)).toBe(true);
  });

  it('should detect wrapped file schemas (.nullable)', () => {
    const schema = file().nullable();
    expect(isFileSchema(schema)).toBe(true);
  });

  it('should detect file schemas in arrays', () => {
    const schema = z.array(file());
    expect(isFileSchema(schema)).toBe(true);
  });

  it('should NOT detect non-file schemas', () => {
    expect(isFileSchema(z.string())).toBe(false);
    expect(isFileSchema(z.number())).toBe(false);
    expect(isFileSchema(z.object({}))).toBe(false);
    expect(isFileSchema(z.custom())).toBe(false);
  });

  it('should handle nested schemas', () => {
    const nested = file().optional().array();
    expect(isFileSchema(nested)).toBe(true);
  });
});
