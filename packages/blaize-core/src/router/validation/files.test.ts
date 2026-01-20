import { Readable } from 'node:stream';

import { z } from 'zod';

import { validateFiles } from './files';
import { file } from '../../upload/schema';

import type { UploadedFile } from '@blaize-types/upload';

/**
 * Helper to create mock UploadedFile objects for testing
 */
function createMockFile(overrides?: Partial<UploadedFile>): UploadedFile {
  return {
    fieldname: 'file',
    originalname: 'test.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    size: 1024 * 100, // 100KB
    buffer: Buffer.from('fake image data'),
    stream: new Readable({
      read() {
        this.push(Buffer.from('fake image data'));
        this.push(null);
      },
    }),
    ...overrides,
  };
}

describe('validateFiles', () => {
  // ============================================================================
  // Basic Validation Tests
  // ============================================================================

  it('should validate a single file against a schema', () => {
    // Define a simple schema
    const schema = z.object({
      avatar: file({ maxSize: '5MB' }),
    });

    // Valid file data
    const validFiles = {
      avatar: createMockFile({
        fieldname: 'avatar',
        originalname: 'profile.jpg',
        mimetype: 'image/jpeg',
        size: 1024 * 500, // 500KB
      }),
    };

    // Validate the files
    const result = validateFiles(validFiles, schema);

    // The result should match the input
    expect(result).toEqual(validFiles);
    expect(result.avatar.originalname).toBe('profile.jpg');
    expect(result.avatar.mimetype).toBe('image/jpeg');
  });

  it('should throw an error for invalid file data', () => {
    // Define a schema with size limit
    const schema = z.object({
      avatar: file({ maxSize: '1MB' }),
    });

    // Invalid file data (exceeds size limit)
    const invalidFiles = {
      avatar: createMockFile({
        size: 5 * 1024 * 1024, // 5MB - exceeds 1MB limit
      }),
    };

    // Validation should throw an error
    expect(() => {
      validateFiles(invalidFiles, schema);
    }).toThrow();
  });

  // ============================================================================
  // Multiple Files Tests
  // ============================================================================

  it('should validate multiple files', () => {
    // Schema with multiple file fields
    const schema = z.object({
      avatar: file({ maxSize: '5MB', accept: ['image/*'] }),
      resume: file({ maxSize: '10MB', accept: ['application/pdf'] }),
    });

    // Valid multiple files
    const validFiles = {
      avatar: createMockFile({
        fieldname: 'avatar',
        originalname: 'photo.jpg',
        mimetype: 'image/jpeg',
      }),
      resume: createMockFile({
        fieldname: 'resume',
        originalname: 'cv.pdf',
        mimetype: 'application/pdf',
      }),
    };

    // Validate the files
    const result = validateFiles(validFiles, schema);

    // The result should match the input
    expect(result).toEqual(validFiles);
    expect(result.avatar.mimetype).toBe('image/jpeg');
    expect(result.resume.mimetype).toBe('application/pdf');
  });

  // ============================================================================
  // Array of Files Tests
  // ============================================================================

  it('should validate arrays of files', () => {
    // Schema with file array
    const schema = z.object({
      photos: z.array(file({ maxSize: '10MB', accept: ['image/*'] })),
    });

    // Valid array of files
    const validFiles = {
      photos: [
        createMockFile({
          fieldname: 'photos',
          originalname: 'photo1.jpg',
          mimetype: 'image/jpeg',
        }),
        createMockFile({
          fieldname: 'photos',
          originalname: 'photo2.png',
          mimetype: 'image/png',
        }),
      ],
    };

    // Validate the files
    const result = validateFiles(validFiles, schema);

    // The result should match the input
    expect(result).toEqual(validFiles);
    expect(result.photos).toHaveLength(2);
    expect(result.photos[0]!.originalname).toBe('photo1.jpg');
    expect(result.photos[1]!.originalname).toBe('photo2.png');
  });

  it('should validate array constraints (min/max)', () => {
    // Schema with array size constraints
    const schema = z.object({
      photos: z.array(file({ maxSize: '5MB' })).min(1).max(3),
    });

    // Valid: 2 files (within min/max)
    const validFiles = {
      photos: [
        createMockFile({ originalname: 'photo1.jpg' }),
        createMockFile({ originalname: 'photo2.jpg' }),
      ],
    };

    expect(validateFiles(validFiles, schema)).toEqual(validFiles);

    // Invalid: 0 files (below min)
    const tooFewFiles = {
      photos: [],
    };

    expect(() => {
      validateFiles(tooFewFiles, schema);
    }).toThrow();

    // Invalid: 4 files (above max)
    const tooManyFiles = {
      photos: [
        createMockFile({ originalname: 'photo1.jpg' }),
        createMockFile({ originalname: 'photo2.jpg' }),
        createMockFile({ originalname: 'photo3.jpg' }),
        createMockFile({ originalname: 'photo4.jpg' }),
      ],
    };

    expect(() => {
      validateFiles(tooManyFiles, schema);
    }).toThrow();
  });

  // ============================================================================
  // Optional Files Tests
  // ============================================================================

  it('should handle optional files', () => {
    // Schema with optional file field
    const schema = z.object({
      avatar: file({ maxSize: '5MB' }).optional(),
      banner: file({ maxSize: '10MB' }).optional(),
    });

    // Data with missing optional fields
    const validFiles = {};

    // Validate the files
    const result = validateFiles(validFiles, schema);

    // The result should match the input (empty object)
    expect(result).toEqual({});
    expect(result.avatar).toBeUndefined();
    expect(result.banner).toBeUndefined();
  });

  it('should handle partial optional files', () => {
    // Schema with optional files
    const schema = z.object({
      avatar: file({ maxSize: '5MB' }).optional(),
      banner: file({ maxSize: '10MB' }).optional(),
    });

    // Only avatar provided
    const validFiles = {
      avatar: createMockFile({ originalname: 'avatar.jpg' }),
    };

    // Validate the files
    const result = validateFiles(validFiles, schema);

    expect(result.avatar).toBeDefined();
    expect(result.avatar?.originalname).toBe('avatar.jpg');
    expect(result.banner).toBeUndefined();
  });

  // ============================================================================
  // Nested Objects Tests
  // ============================================================================

  it('should validate nested file objects', () => {
    // Schema with nested objects
    const schema = z.object({
      profile: z.object({
        avatar: file({ maxSize: '5MB' }),
        banner: file({ maxSize: '10MB' }).optional(),
      }),
    });

    // Valid nested file data
    const validFiles = {
      profile: {
        avatar: createMockFile({ originalname: 'avatar.jpg' }),
        banner: createMockFile({ originalname: 'banner.jpg' }),
      },
    };

    // Validate the files
    const result = validateFiles(validFiles, schema);

    expect(result).toEqual(validFiles);
    expect(result.profile.avatar.originalname).toBe('avatar.jpg');
    expect(result.profile.banner?.originalname).toBe('banner.jpg');
  });

  // ============================================================================
  // MIME Type Validation Tests
  // ============================================================================

  it('should validate MIME type restrictions', () => {
    // Schema accepting only images
    const schema = z.object({
      photo: file({ accept: ['image/jpeg', 'image/png'] }),
    });

    // Valid MIME type
    const validFiles = {
      photo: createMockFile({ mimetype: 'image/jpeg' }),
    };

    expect(validateFiles(validFiles, schema)).toEqual(validFiles);

    // Invalid MIME type
    const invalidFiles = {
      photo: createMockFile({ mimetype: 'application/pdf' }),
    };

    expect(() => {
      validateFiles(invalidFiles, schema);
    }).toThrow();
  });

  it('should validate wildcard MIME types', () => {
    // Schema accepting all images
    const schema = z.object({
      image: file({ accept: ['image/*'] }),
    });

    // Valid: various image types
    const validJpeg = {
      image: createMockFile({ mimetype: 'image/jpeg' }),
    };
    const validPng = {
      image: createMockFile({ mimetype: 'image/png' }),
    };
    const validWebp = {
      image: createMockFile({ mimetype: 'image/webp' }),
    };

    expect(validateFiles(validJpeg, schema).image.mimetype).toBe('image/jpeg');
    expect(validateFiles(validPng, schema).image.mimetype).toBe('image/png');
    expect(validateFiles(validWebp, schema).image.mimetype).toBe('image/webp');

    // Invalid: not an image
    const invalidFiles = {
      image: createMockFile({ mimetype: 'application/pdf' }),
    };

    expect(() => {
      validateFiles(invalidFiles, schema);
    }).toThrow();
  });

  // ============================================================================
  // Size Validation Tests
  // ============================================================================

  it('should validate minimum file size', () => {
    // Schema with minimum size
    const schema = z.object({
      document: file({ minSize: '100KB', maxSize: '10MB' }),
    });

    // Valid: 500KB (above minimum)
    const validFiles = {
      document: createMockFile({ size: 500 * 1024 }),
    };

    expect(validateFiles(validFiles, schema)).toEqual(validFiles);

    // Invalid: 50KB (below minimum)
    const invalidFiles = {
      document: createMockFile({ size: 50 * 1024 }),
    };

    expect(() => {
      validateFiles(invalidFiles, schema);
    }).toThrow();
  });

  it('should validate maximum file size', () => {
    // Schema with maximum size
    const schema = z.object({
      video: file({ maxSize: '50MB' }),
    });

    // Valid: 30MB (below maximum)
    const validFiles = {
      video: createMockFile({ size: 30 * 1024 * 1024 }),
    };

    expect(validateFiles(validFiles, schema)).toEqual(validFiles);

    // Invalid: 100MB (above maximum)
    const invalidFiles = {
      video: createMockFile({ size: 100 * 1024 * 1024 }),
    };

    expect(() => {
      validateFiles(invalidFiles, schema);
    }).toThrow();
  });

  // ============================================================================
  // Custom Validation Tests
  // ============================================================================

  it('should work with custom refinements', () => {
    // Schema with custom validation
    const schema = z.object({
      image: file({ maxSize: '5MB' }).refine(
        file => file.originalname.endsWith('.jpg') || file.originalname.endsWith('.jpeg'),
        {
          message: 'Only .jpg and .jpeg files are allowed',
        }
      ),
    });

    // Valid: .jpg extension
    const validFiles = {
      image: createMockFile({ originalname: 'photo.jpg' }),
    };

    expect(validateFiles(validFiles, schema)).toEqual(validFiles);

    // Invalid: .png extension
    const invalidFiles = {
      image: createMockFile({ originalname: 'photo.png' }),
    };

    expect(() => {
      validateFiles(invalidFiles, schema);
    }).toThrow('Only .jpg and .jpeg files are allowed');
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  it('should throw detailed validation errors', () => {
    // Schema with multiple validation rules
    const schema = z.object({
      avatar: file({ maxSize: '1MB', accept: ['image/jpeg', 'image/png'] }),
      resume: file({ maxSize: '5MB', accept: ['application/pdf'] }),
    });

    // Invalid data with multiple issues
    const invalidFiles = {
      avatar: createMockFile({
        size: 5 * 1024 * 1024, // 5MB - exceeds limit
        mimetype: 'image/gif', // Not in accept list
      }),
      resume: createMockFile({
        mimetype: 'application/msword', // Wrong MIME type
      }),
    };

    try {
      validateFiles(invalidFiles, schema);
      // Should not reach here
      expect(true).toBe(false);
    } catch (error) {
      // Type guard to check if it's a ZodError
      if (error instanceof z.ZodError) {
        expect(error.name).toBe('ZodError');
        const issues = error.issues;

        // Check that we have validation errors
        expect(issues.length).toBeGreaterThan(0);

        // Check for avatar errors
        const avatarIssues = issues.filter(issue => issue.path[0] === 'avatar');
        expect(avatarIssues.length).toBeGreaterThan(0);

        // Check for resume errors
        const resumeIssues = issues.filter(issue => issue.path[0] === 'resume');
        expect(resumeIssues.length).toBeGreaterThan(0);
      } else {
        // If it's not a ZodError, fail the test
        expect(true).toBe(false);
        throw new Error('Expected ZodError but got a different error type');
      }
    }
  });

  // ============================================================================
  // Union Types Tests
  // ============================================================================

  it('should work with union types', () => {
    // Schema with union (different file requirements based on type)
    const schema = z.union([
      z.object({
        type: z.literal('image'),
        file: file({ accept: ['image/*'], maxSize: '5MB' }),
      }),
      z.object({
        type: z.literal('document'),
        file: file({ accept: ['application/pdf'], maxSize: '10MB' }),
      }),
    ]);

    // Valid image upload
    const imageData = {
      type: 'image' as const,
      file: createMockFile({ mimetype: 'image/jpeg' }),
    };

    // Valid document upload
    const documentData = {
      type: 'document' as const,
      file: createMockFile({ mimetype: 'application/pdf' }),
    };

    // Both should validate
    expect(validateFiles(imageData, schema)).toEqual(imageData);
    expect(validateFiles(documentData, schema)).toEqual(documentData);

    // Invalid: wrong file type for 'image' type
    const invalidData = {
      type: 'image' as const,
      file: createMockFile({ mimetype: 'application/pdf' }),
    };

    expect(() => {
      validateFiles(invalidData, schema);
    }).toThrow();
  });

  // ============================================================================
  // Type Safety Tests
  // ============================================================================

  it('should maintain type safety with generics', () => {
    // Define a schema with a specific output type
    interface FileUpload {
      avatar: UploadedFile;
      name: string;
    }

    const uploadSchema = z.object({
      avatar: file({ maxSize: '5MB' }),
      name: z.string(),
    }) as z.ZodType<FileUpload>;

    // Valid upload data
    const validUpload = {
      avatar: createMockFile({ originalname: 'avatar.jpg' }),
      name: 'profile-picture',
    };

    // Validate with explicit type
    const result = validateFiles<FileUpload>(validUpload, uploadSchema);

    // Type checks (these validate at compile time)
    const avatar: UploadedFile = result.avatar;
    const name: string = result.name;

    // Runtime checks
    expect(result).toEqual(validUpload);
    expect(typeof avatar.originalname).toBe('string');
    expect(typeof name).toBe('string');
  });

  // ============================================================================
  // Edge Cases Tests
  // ============================================================================

  it('should handle empty file objects for optional schemas', () => {
    // All fields are optional
    const schema = z.object({
      avatar: file().optional(),
      banner: file().optional(),
    });

    // Empty files object
    const emptyFiles = {};

    // Should validate successfully
    const result = validateFiles(emptyFiles, schema);
    expect(result).toEqual({});
  });

  it('should reject extra fields in strict mode', () => {
    // Schema expecting only avatar
    const schema = z.object({
      avatar: file({ maxSize: '5MB' }),
    });

    // Files with extra unexpected field
    const filesWithExtra = {
      avatar: createMockFile({ originalname: 'avatar.jpg' }),
      unexpected: createMockFile({ originalname: 'extra.jpg' }),
    };

    // With .strict() mode (which is default in validateFiles for ZodObject)
    expect(() => {
      validateFiles(filesWithExtra, schema);
    }).toThrow();
  });

  it('should handle non-object schemas', () => {
    // Direct file schema (not wrapped in object)
    const schema = file({ maxSize: '5MB', accept: ['image/*'] });

    // Single file (not in object)
    const singleFile = createMockFile({ mimetype: 'image/jpeg' });

    // Should validate
    const result = validateFiles(singleFile, schema);
    expect(result).toEqual(singleFile);
    expect(result.mimetype).toBe('image/jpeg');
  });

  it('should validate file arrays at root level', () => {
    // Array schema at root
    const schema = z.array(file({ maxSize: '5MB' }));

    // Array of files
    const fileArray = [
      createMockFile({ originalname: 'file1.jpg' }),
      createMockFile({ originalname: 'file2.jpg' }),
    ];

    // Should validate
    const result = validateFiles(fileArray, schema);
    expect(result).toEqual(fileArray);
    expect(result).toHaveLength(2);
  });

  // ============================================================================
  // Real-world Scenario Tests
  // ============================================================================

  it('should validate a complete user profile upload', () => {
    // Realistic schema for user profile update
    const schema = z.object({
      avatar: file({
        maxSize: '5MB',
        accept: ['image/jpeg', 'image/png', 'image/webp'],
      }).optional(),
      coverPhoto: file({
        maxSize: '10MB',
        accept: ['image/*'],
      }).optional(),
      documents: z
        .array(
          file({
            maxSize: '20MB',
            accept: ['application/pdf', 'application/msword'],
          })
        )
        .max(5)
        .optional(),
    });

    // Complete upload
    const completeUpload = {
      avatar: createMockFile({
        originalname: 'profile.jpg',
        mimetype: 'image/jpeg',
        size: 2 * 1024 * 1024, // 2MB
      }),
      coverPhoto: createMockFile({
        originalname: 'cover.png',
        mimetype: 'image/png',
        size: 5 * 1024 * 1024, // 5MB
      }),
      documents: [
        createMockFile({
          originalname: 'resume.pdf',
          mimetype: 'application/pdf',
          size: 1024 * 1024, // 1MB
        }),
        createMockFile({
          originalname: 'certificate.pdf',
          mimetype: 'application/pdf',
          size: 500 * 1024, // 500KB
        }),
      ],
    };

    const result = validateFiles(completeUpload, schema);
    expect(result).toEqual(completeUpload);
    expect(result.avatar?.originalname).toBe('profile.jpg');
    expect(result.documents).toHaveLength(2);
  });

  it('should validate a minimal user profile upload', () => {
    const schema = z.object({
      avatar: file({ maxSize: '5MB' }).optional(),
      documents: z.array(file({ maxSize: '20MB' })).optional(),
    });

    // Minimal upload (nothing provided)
    const minimalUpload = {};

    const result = validateFiles(minimalUpload, schema);
    expect(result).toEqual({});
  });
});