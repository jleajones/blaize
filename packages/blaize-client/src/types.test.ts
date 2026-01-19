/**
 * Type Tests for InternalRequestArgs with File Support
 *
 * Task [T2.0]: Verify explicit file support in client types
 *
 * These tests verify that:
 * - files property accepts File and File[]
 * - Both body and files work together
 * - Backward compatibility is maintained
 * - TypeScript inference works correctly
 *
 * @packageDocumentation
 */

import type { InternalRequestArgs } from '@blaize-types';

describe('InternalRequestArgs Type Tests', () => {
  describe('Basic Structure', () => {
    it('should have all expected properties', () => {
      type Args = InternalRequestArgs;

      expectTypeOf<Args>().toHaveProperty('params');
      expectTypeOf<Args>().toHaveProperty('query');
      expectTypeOf<Args>().toHaveProperty('body');
      expectTypeOf<Args>().toHaveProperty('files');
    });

    it('should make all properties optional', () => {
      // Empty object should be valid
      const emptyArgs: InternalRequestArgs = {};
      expectTypeOf(emptyArgs).toMatchTypeOf<InternalRequestArgs>();
    });
  });

  describe('files Property - Single File', () => {
    it('should accept File object', () => {
      const file = new File(['content'], 'test.txt', { type: 'text/plain' });

      const args: InternalRequestArgs = {
        files: {
          avatar: file,
        },
      };

      expectTypeOf(args.files).toEqualTypeOf<
        Record<string, File | File[] | Blob | Blob[]> | undefined
      >();
    });

    it('should accept Blob object', () => {
      const blob = new Blob(['content'], { type: 'text/plain' });

      const args: InternalRequestArgs = {
        files: {
          data: blob,
        },
      };

      expectTypeOf(args).toMatchTypeOf<InternalRequestArgs>();
    });

    it('should accept multiple file fields', () => {
      const avatar = new File(['avatar'], 'avatar.jpg', { type: 'image/jpeg' });
      const cover = new File(['cover'], 'cover.png', { type: 'image/png' });

      const args: InternalRequestArgs = {
        files: {
          avatar,
          coverPhoto: cover,
        },
      };

      expectTypeOf(args).toMatchTypeOf<InternalRequestArgs>();
    });
  });

  describe('files Property - Multiple Files (Arrays)', () => {
    it('should accept File[]', () => {
      const files = [
        new File(['1'], 'file1.txt'),
        new File(['2'], 'file2.txt'),
        new File(['3'], 'file3.txt'),
      ];

      const args: InternalRequestArgs = {
        files: {
          documents: files,
        },
      };

      expectTypeOf(args).toMatchTypeOf<InternalRequestArgs>();
    });

    it('should accept Blob[]', () => {
      const blobs = [new Blob(['data1']), new Blob(['data2']), new Blob(['data3'])];

      const args: InternalRequestArgs = {
        files: {
          attachments: blobs,
        },
      };

      expectTypeOf(args).toMatchTypeOf<InternalRequestArgs>();
    });

    it('should accept mixed File and File[] in same object', () => {
      const avatar = new File(['avatar'], 'avatar.jpg');
      const documents = [new File(['doc1'], 'doc1.pdf'), new File(['doc2'], 'doc2.pdf')];

      const args: InternalRequestArgs = {
        files: {
          avatar,
          documents,
        },
      };

      expectTypeOf(args).toMatchTypeOf<InternalRequestArgs>();
    });
  });

  describe('body and files Together', () => {
    it('should accept both body and files', () => {
      const args: InternalRequestArgs = {
        body: {
          title: 'Product Name',
          description: 'Product description',
          price: 99.99,
        },
        files: {
          productImage: new File(['image'], 'product.jpg'),
          documents: [new File(['doc'], 'spec.pdf')],
        },
      };

      expectTypeOf(args).toMatchTypeOf<InternalRequestArgs>();
    });

    it('should keep body type as any for flexibility', () => {
      const args: InternalRequestArgs = {
        body: {
          nested: {
            deep: {
              value: 123,
            },
          },
        },
      };

      expectTypeOf(args.body).toEqualTypeOf<any>();
    });
  });

  describe('Backward Compatibility', () => {
    it('should still accept files in body (legacy pattern)', () => {
      const file = new File(['content'], 'file.txt');

      const args: InternalRequestArgs = {
        body: {
          avatar: file,
          name: 'John',
        },
      };

      expectTypeOf(args).toMatchTypeOf<InternalRequestArgs>();
    });

    it('should accept body without files property', () => {
      const args: InternalRequestArgs = {
        body: {
          name: 'John Doe',
          email: 'john@example.com',
        },
      };

      expectTypeOf(args).toMatchTypeOf<InternalRequestArgs>();
    });

    it('should accept params and query without body or files', () => {
      const args: InternalRequestArgs = {
        params: { userId: '123' },
        query: { include: 'posts' },
      };

      expectTypeOf(args).toMatchTypeOf<InternalRequestArgs>();
    });
  });

  describe('Real-World Usage Patterns', () => {
    it('should support user profile update with avatar', () => {
      const avatarFile = new File(['avatar'], 'avatar.jpg', { type: 'image/jpeg' });

      const args: InternalRequestArgs = {
        params: { userId: '123' },
        body: {
          name: 'John Doe',
          email: 'john@example.com',
          bio: 'Software engineer',
        },
        files: {
          avatar: avatarFile,
        },
      };

      expectTypeOf(args).toMatchTypeOf<InternalRequestArgs>();
    });

    it('should support document upload with metadata', () => {
      const pdfFile = new File(['pdf content'], 'document.pdf', { type: 'application/pdf' });

      const args: InternalRequestArgs = {
        body: {
          title: 'Q4 Report',
          category: 'finance',
          tags: ['report', 'quarterly'],
        },
        files: {
          document: pdfFile,
        },
      };

      expectTypeOf(args).toMatchTypeOf<InternalRequestArgs>();
    });

    it('should support gallery upload with multiple images', () => {
      const images = [
        new File(['img1'], 'photo1.jpg', { type: 'image/jpeg' }),
        new File(['img2'], 'photo2.jpg', { type: 'image/jpeg' }),
        new File(['img3'], 'photo3.jpg', { type: 'image/jpeg' }),
      ];

      const args: InternalRequestArgs = {
        body: {
          albumTitle: 'Vacation 2024',
          description: 'Summer trip photos',
        },
        files: {
          images,
        },
      };

      expectTypeOf(args).toMatchTypeOf<InternalRequestArgs>();
    });

    it('should support product creation with image and documents', () => {
      const productImage = new File(['img'], 'product.jpg', { type: 'image/jpeg' });
      const specifications = [
        new File(['spec1'], 'spec1.pdf', { type: 'application/pdf' }),
        new File(['spec2'], 'spec2.pdf', { type: 'application/pdf' }),
      ];

      const args: InternalRequestArgs = {
        body: {
          name: 'Laptop',
          price: 1299.99,
          category: 'electronics',
          brand: 'TechCorp',
        },
        files: {
          image: productImage,
          specifications,
        },
      };

      expectTypeOf(args).toMatchTypeOf<InternalRequestArgs>();
    });
  });

  describe('Edge Cases', () => {
    it('should accept empty files object', () => {
      const args: InternalRequestArgs = {
        files: {},
      };

      expectTypeOf(args).toMatchTypeOf<InternalRequestArgs>();
    });

    it('should accept undefined for files', () => {
      const args: InternalRequestArgs = {
        files: undefined,
      };

      expectTypeOf(args).toMatchTypeOf<InternalRequestArgs>();
    });

    it('should accept files with Blob types', () => {
      const blob = new Blob(['binary data'], { type: 'application/octet-stream' });

      const args: InternalRequestArgs = {
        files: {
          data: blob,
        },
      };

      expectTypeOf(args).toMatchTypeOf<InternalRequestArgs>();
    });

    it('should NOT accept non-File/Blob objects', () => {
      const _invalidArgs: InternalRequestArgs = {
        files: {
          // @ts-expect-error - String is not a valid file type
          notAFile: 'string value',
        },
      };
    });

    it('should NOT accept numbers in files', () => {
      const _invalidArgs: InternalRequestArgs = {
        files: {
          // @ts-expect-error - Number is not a valid file type
          notAFile: 123,
        },
      };
    });

    it('should NOT accept plain objects in files', () => {
      const _invalidArgs: InternalRequestArgs = {
        files: {
          // @ts-expect-error - Plain object is not a valid file type
          notAFile: { data: 'value' },
        },
      };
    });
  });

  describe('params and query Properties', () => {
    it('should accept string values in params', () => {
      const args: InternalRequestArgs = {
        params: {
          userId: '123',
          postId: '456',
        },
      };

      expectTypeOf(args.params).toEqualTypeOf<Record<string, any> | undefined>();
    });

    it('should accept various types in query', () => {
      const args: InternalRequestArgs = {
        query: {
          search: 'term',
          page: 1,
          active: true,
          tags: ['tag1', 'tag2'],
        },
      };

      expectTypeOf(args.query).toEqualTypeOf<Record<string, any> | undefined>();
    });

    it('should work with all properties together', () => {
      const args: InternalRequestArgs = {
        params: { userId: '123' },
        query: { include: 'posts', limit: 10 },
        body: { name: 'Updated Name' },
        files: { avatar: new File([''], 'avatar.jpg') },
      };

      expectTypeOf(args).toMatchTypeOf<InternalRequestArgs>();
    });
  });
});
