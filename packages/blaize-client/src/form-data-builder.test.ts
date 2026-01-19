/**
 * Unit Tests for FormData Builder
 *
 * Task [T2.2]: Test FormData building with all serialization strategies
 *
 * Tests cover:
 * - Primitive value serialization
 * - Object/array JSON serialization
 * - File/Blob handling
 * - Array handling (files vs primitives)
 * - Mixed body + files
 * - Precedence rules
 * - Edge cases
 *
 * @packageDocumentation
 */

import { buildFormData } from './form-data-builder';

describe('buildFormData()', () => {
  describe('Primitive Values', () => {
    it('should serialize strings as-is', () => {
      const formData = buildFormData({
        body: {
          name: 'John Doe',
          email: 'john@example.com',
        },
      });

      expect(formData.get('name')).toBe('John Doe');
      expect(formData.get('email')).toBe('john@example.com');
    });

    it('should convert numbers to strings', () => {
      const formData = buildFormData({
        body: {
          age: 30,
          price: 99.99,
          count: 0,
          negative: -42,
        },
      });

      expect(formData.get('age')).toBe('30');
      expect(formData.get('price')).toBe('99.99');
      expect(formData.get('count')).toBe('0');
      expect(formData.get('negative')).toBe('-42');
    });

    it('should convert booleans to strings', () => {
      const formData = buildFormData({
        body: {
          active: true,
          deleted: false,
        },
      });

      expect(formData.get('active')).toBe('true');
      expect(formData.get('deleted')).toBe('false');
    });

    it('should skip null values', () => {
      const formData = buildFormData({
        body: {
          name: 'John',
          middleName: null,
          lastName: 'Doe',
        },
      });

      expect(formData.get('name')).toBe('John');
      expect(formData.get('middleName')).toBeNull(); // Not in FormData
      expect(formData.get('lastName')).toBe('Doe');
      expect(formData.has('middleName')).toBe(false);
    });

    it('should skip undefined values', () => {
      const formData = buildFormData({
        body: {
          name: 'John',
          bio: undefined,
          email: 'john@example.com',
        },
      });

      expect(formData.get('name')).toBe('John');
      expect(formData.get('bio')).toBeNull(); // Not in FormData
      expect(formData.get('email')).toBe('john@example.com');
      expect(formData.has('bio')).toBe(false);
    });
  });

  describe('Objects and Arrays', () => {
    it('should JSON stringify objects', () => {
      const formData = buildFormData({
        body: {
          user: { name: 'John', role: 'admin' },
          settings: { theme: 'dark', notifications: true },
        },
      });

      expect(formData.get('user')).toBe('{"name":"John","role":"admin"}');
      expect(formData.get('settings')).toBe('{"theme":"dark","notifications":true}');
    });

    it('should JSON stringify nested objects', () => {
      const formData = buildFormData({
        body: {
          config: {
            server: {
              host: 'localhost',
              port: 3000,
            },
            database: {
              url: 'mongodb://localhost',
            },
          },
        },
      });

      const parsed = JSON.parse(formData.get('config') as string);
      expect(parsed).toEqual({
        server: { host: 'localhost', port: 3000 },
        database: { url: 'mongodb://localhost' },
      });
    });

    it('should JSON stringify primitive arrays', () => {
      const formData = buildFormData({
        body: {
          tags: ['typescript', 'nodejs', 'web'],
          numbers: [1, 2, 3, 4, 5],
          flags: [true, false, true],
        },
      });

      expect(formData.get('tags')).toBe('["typescript","nodejs","web"]');
      expect(formData.get('numbers')).toBe('[1,2,3,4,5]');
      expect(formData.get('flags')).toBe('[true,false,true]');
    });

    it('should JSON stringify array of objects', () => {
      const formData = buildFormData({
        body: {
          users: [
            { id: 1, name: 'Alice' },
            { id: 2, name: 'Bob' },
          ],
        },
      });

      const parsed = JSON.parse(formData.get('users') as string);
      expect(parsed).toEqual([
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ]);
    });

    it('should skip empty arrays', () => {
      const formData = buildFormData({
        body: {
          name: 'John',
          emptyArray: [],
          email: 'john@example.com',
        },
      });

      expect(formData.get('name')).toBe('John');
      expect(formData.has('emptyArray')).toBe(false);
      expect(formData.get('email')).toBe('john@example.com');
    });
  });

  describe('File and Blob Handling', () => {
    it('should append File objects directly', () => {
      const file = new File(['content'], 'test.txt', { type: 'text/plain' });

      const formData = buildFormData({
        files: {
          document: file,
        },
      });

      const retrievedFile = formData.get('document');
      expect(retrievedFile).toBeInstanceOf(File);
      expect((retrievedFile as File).name).toBe('test.txt');
      expect((retrievedFile as File).type).toBe('text/plain');
    });

    it('should append Blob objects directly', () => {
      const blob = new Blob(['binary data'], { type: 'application/octet-stream' });

      const formData = buildFormData({
        files: {
          data: blob,
        },
      });

      const retrievedBlob = formData.get('data');
      expect(retrievedBlob).toBeInstanceOf(Blob);
      expect((retrievedBlob as Blob).type).toBe('application/octet-stream');
    });

    it('should append multiple File fields', () => {
      const avatar = new File(['avatar'], 'avatar.jpg', { type: 'image/jpeg' });
      const cover = new File(['cover'], 'cover.png', { type: 'image/png' });

      const formData = buildFormData({
        files: {
          avatar,
          coverPhoto: cover,
        },
      });

      expect(formData.get('avatar')).toBeInstanceOf(File);
      expect(formData.get('coverPhoto')).toBeInstanceOf(File);
      expect((formData.get('avatar') as File).name).toBe('avatar.jpg');
      expect((formData.get('coverPhoto') as File).name).toBe('cover.png');
    });
  });

  describe('File Arrays', () => {
    it('should append file array as multiple entries with same key', () => {
      const files = [
        new File(['img1'], 'photo1.jpg', { type: 'image/jpeg' }),
        new File(['img2'], 'photo2.jpg', { type: 'image/jpeg' }),
        new File(['img3'], 'photo3.jpg', { type: 'image/jpeg' }),
      ];

      const formData = buildFormData({
        files: {
          images: files,
        },
      });

      const retrievedFiles = formData.getAll('images');
      expect(retrievedFiles).toHaveLength(3);
      expect(retrievedFiles.every(f => f instanceof File)).toBe(true);
      expect((retrievedFiles[0] as File).name).toBe('photo1.jpg');
      expect((retrievedFiles[1] as File).name).toBe('photo2.jpg');
      expect((retrievedFiles[2] as File).name).toBe('photo3.jpg');
    });

    it('should handle single file in array', () => {
      const file = new File(['content'], 'single.txt', { type: 'text/plain' });

      const formData = buildFormData({
        files: {
          document: [file],
        },
      });

      const retrievedFiles = formData.getAll('document');
      expect(retrievedFiles).toHaveLength(1);
      expect(retrievedFiles[0]).toBeInstanceOf(File);
    });
  });

  describe('Mixed body + files', () => {
    it('should handle both body and files together', () => {
      const file = new File(['content'], 'document.pdf', { type: 'application/pdf' });

      const formData = buildFormData({
        body: {
          title: 'Report',
          category: 'finance',
          metadata: { author: 'John', version: 1 },
        },
        files: {
          document: file,
        },
      });

      expect(formData.get('title')).toBe('Report');
      expect(formData.get('category')).toBe('finance');
      expect(formData.get('metadata')).toBe('{"author":"John","version":1}');
      expect(formData.get('document')).toBeInstanceOf(File);
    });

    it('should handle complex mixed scenario', () => {
      const productImage = new File(['img'], 'product.jpg', { type: 'image/jpeg' });
      const docs = [
        new File(['spec1'], 'spec1.pdf', { type: 'application/pdf' }),
        new File(['spec2'], 'spec2.pdf', { type: 'application/pdf' }),
      ];

      const formData = buildFormData({
        body: {
          name: 'Laptop',
          price: 1299.99,
          inStock: true,
          specs: { ram: '16GB', storage: '512GB SSD' },
          tags: ['electronics', 'computers'],
        },
        files: {
          image: productImage,
          specifications: docs,
        },
      });

      expect(formData.get('name')).toBe('Laptop');
      expect(formData.get('price')).toBe('1299.99');
      expect(formData.get('inStock')).toBe('true');
      expect(formData.get('specs')).toBe('{"ram":"16GB","storage":"512GB SSD"}');
      expect(formData.get('tags')).toBe('["electronics","computers"]');
      expect(formData.get('image')).toBeInstanceOf(File);

      const retrievedDocs = formData.getAll('specifications');
      expect(retrievedDocs).toHaveLength(2);
    });
  });

  describe('Precedence Rules', () => {
    it('should let files property take precedence over body for same keys', () => {
      const fileFromFiles = new File(['from files'], 'files.txt', { type: 'text/plain' });

      const formData = buildFormData({
        body: {
          document: 'string from body',
        },
        files: {
          document: fileFromFiles,
        },
      });

      // files property should win
      const result = formData.get('document');
      expect(result).toBeInstanceOf(File);
      expect((result as File).name).toBe('files.txt');
    });

    it('should merge non-overlapping keys from body and files', () => {
      const file = new File(['content'], 'file.txt', { type: 'text/plain' });

      const formData = buildFormData({
        body: {
          title: 'Title from body',
          description: 'Description from body',
        },
        files: {
          attachment: file,
        },
      });

      expect(formData.get('title')).toBe('Title from body');
      expect(formData.get('description')).toBe('Description from body');
      expect(formData.get('attachment')).toBeInstanceOf(File);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty body object', () => {
      const formData = buildFormData({
        body: {},
      });

      // FormData should be empty
      expect([...formData.keys()]).toHaveLength(0);
    });

    it('should handle empty files object', () => {
      const formData = buildFormData({
        files: {},
      });

      // FormData should be empty
      expect([...formData.keys()]).toHaveLength(0);
    });

    it('should handle missing body and files', () => {
      const formData = buildFormData({});

      // FormData should be empty
      expect([...formData.keys()]).toHaveLength(0);
    });

    it('should handle Date objects via JSON stringify', () => {
      const date = new Date('2024-01-15T10:30:00Z');

      const formData = buildFormData({
        body: {
          createdAt: date,
        },
      });

      // Date gets JSON stringified
      expect(formData.get('createdAt')).toBe(JSON.stringify(date));
    });

    it('should skip function values with dev warning', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      (process.env as any).NODE_ENV = 'development';

      const formData = buildFormData({
        body: {
          name: 'John',
          callback: () => console.log('test'),
          email: 'john@example.com',
        },
      });

      expect(formData.get('name')).toBe('John');
      expect(formData.has('callback')).toBe(false);
      expect(formData.get('email')).toBe('john@example.com');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Skipping function value for key "callback"')
      );

      consoleWarnSpy.mockRestore();
      delete (process.env as any).NODE_ENV;
    });

    it('should not warn about functions in production', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      (process.env as any).NODE_ENV = 'production';

      const _formData = buildFormData({
        body: {
          callback: () => {},
        },
      });

      expect(consoleWarnSpy).not.toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
      delete (process.env as any).NODE_ENV;
    });
  });

  describe('Server Coercion Compatibility', () => {
    it('should send numbers as strings for server coercion', () => {
      // Client sends "42" as string
      const formData = buildFormData({
        body: {
          count: 42,
          price: 99.99,
        },
      });

      // FormData has strings
      expect(formData.get('count')).toBe('42');
      expect(formData.get('price')).toBe('99.99');

      // Server with z.object({ count: z.coerce.number() })
      // will receive actual numbers after Zod coercion
    });

    it('should send booleans as strings for server coercion', () => {
      const formData = buildFormData({
        body: {
          active: true,
          deleted: false,
        },
      });

      expect(formData.get('active')).toBe('true');
      expect(formData.get('deleted')).toBe('false');

      // Server with z.coerce.boolean() will convert back
    });
  });

  describe('Real-World Scenarios', () => {
    it('should handle user profile update', () => {
      const avatar = new File(['avatar data'], 'avatar.jpg', { type: 'image/jpeg' });

      const formData = buildFormData({
        body: {
          name: 'John Doe',
          email: 'john@example.com',
          bio: 'Software engineer',
          age: 30,
        },
        files: {
          avatar,
        },
      });

      expect(formData.get('name')).toBe('John Doe');
      expect(formData.get('email')).toBe('john@example.com');
      expect(formData.get('bio')).toBe('Software engineer');
      expect(formData.get('age')).toBe('30');
      expect(formData.get('avatar')).toBeInstanceOf(File);
    });

    it('should handle document upload with metadata', () => {
      const pdf = new File(['pdf content'], 'report.pdf', { type: 'application/pdf' });

      const formData = buildFormData({
        body: {
          title: 'Q4 Financial Report',
          category: 'finance',
          tags: ['quarterly', 'financial', 'report'],
          metadata: {
            author: 'John Doe',
            department: 'Finance',
            confidential: true,
          },
        },
        files: {
          document: pdf,
        },
      });

      expect(formData.get('title')).toBe('Q4 Financial Report');
      expect(formData.get('category')).toBe('finance');
      expect(formData.get('tags')).toBe('["quarterly","financial","report"]');
      expect(JSON.parse(formData.get('metadata') as string)).toEqual({
        author: 'John Doe',
        department: 'Finance',
        confidential: true,
      });
      expect(formData.get('document')).toBeInstanceOf(File);
    });

    it('should handle gallery upload', () => {
      const images = [
        new File(['img1'], 'vacation1.jpg', { type: 'image/jpeg' }),
        new File(['img2'], 'vacation2.jpg', { type: 'image/jpeg' }),
        new File(['img3'], 'vacation3.jpg', { type: 'image/jpeg' }),
      ];

      const formData = buildFormData({
        body: {
          albumTitle: 'Summer Vacation 2024',
          description: 'Beach trip with family',
          location: 'Hawaii',
        },
        files: {
          photos: images,
        },
      });

      expect(formData.get('albumTitle')).toBe('Summer Vacation 2024');
      expect(formData.get('description')).toBe('Beach trip with family');
      expect(formData.get('location')).toBe('Hawaii');

      const photos = formData.getAll('photos');
      expect(photos).toHaveLength(3);
      expect(photos.every(p => p instanceof File)).toBe(true);
    });
  });
});
