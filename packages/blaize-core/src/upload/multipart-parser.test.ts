import { Readable } from 'node:stream';

import { parseMultipartRequest } from './multipart-parser';

import type { UploadedFile } from '@blaize-types';
import type { UnifiedRequest } from '@blaize-types/context';

describe('Multipart Parser', () => {
  const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
  const contentType = `multipart/form-data; boundary=${boundary}`;

  function createMultipartBody(
    parts: Array<{
      name: string;
      content: string;
      filename?: string;
      contentType?: string;
    }>
  ): Buffer {
    const chunks: Buffer[] = [];

    for (const part of parts) {
      chunks.push(Buffer.from(`--${boundary}\r\n`));

      if (part.filename !== undefined) {
        chunks.push(
          Buffer.from(
            `Content-Disposition: form-data; name="${part.name}"; filename="${part.filename}"\r\n`
          )
        );
        chunks.push(
          Buffer.from(`Content-Type: ${part.contentType || 'application/octet-stream'}\r\n`)
        );
      } else {
        chunks.push(Buffer.from(`Content-Disposition: form-data; name="${part.name}"\r\n`));
      }

      chunks.push(Buffer.from('\r\n'));
      chunks.push(Buffer.from(part.content));
      chunks.push(Buffer.from('\r\n'));
    }

    chunks.push(Buffer.from(`--${boundary}--\r\n`));
    return Buffer.concat(chunks);
  }

  function createMockRequest(body: Buffer): UnifiedRequest {
    const readable = Readable.from(body);
    const request = readable as any;
    request.headers = {
      'content-type': contentType,
      'content-length': body.length.toString(),
    };
    request.method = 'POST';
    request.url = '/test';
    return request;
  }

  describe('Basic Parsing', () => {
    test('should parse simple form fields', async () => {
      const body = createMultipartBody([
        { name: 'username', content: 'john' },
        { name: 'email', content: 'john@example.com' },
      ]);

      const request = createMockRequest(body);
      const result = await parseMultipartRequest(request, { strategy: 'memory' });

      expect(result.fields.username).toBe('john');
      expect(result.fields.email).toBe('john@example.com');
      expect(Object.keys(result.files)).toHaveLength(0);
    });

    test('should parse file uploads', async () => {
      const fileContent = 'fake image data';
      const body = createMultipartBody([
        { name: 'userId', content: '123' },
        {
          name: 'avatar',
          content: fileContent,
          filename: 'profile.jpg',
          contentType: 'image/jpeg',
        },
      ]);

      const request = createMockRequest(body);
      const result = await parseMultipartRequest(request, { strategy: 'memory' });

      expect(result.fields.userId).toBe('123');
      expect(result.files.avatar).toBeDefined();

      const avatar = result.files.avatar as UploadedFile;
      expect(avatar.originalname).toBe('profile.jpg');
      expect(avatar.mimetype).toBe('image/jpeg');
      expect(avatar.size).toBe(fileContent.length);
      expect(avatar.buffer?.toString()).toBe(fileContent);
      expect(avatar.fieldname).toBe('avatar');
    });

    test('should handle multiple files with same field name', async () => {
      const body = createMultipartBody([
        {
          name: 'documents',
          content: 'doc1 content',
          filename: 'doc1.txt',
          contentType: 'text/plain',
        },
        {
          name: 'documents',
          content: 'doc2 content',
          filename: 'doc2.txt',
          contentType: 'text/plain',
        },
      ]);

      const request = createMockRequest(body);
      const result = await parseMultipartRequest(request, { strategy: 'memory' });

      expect(Array.isArray(result.files.documents)).toBe(true);
      const docs = result.files.documents as UploadedFile[];
      expect(docs).toHaveLength(2);
      expect(docs[0]?.originalname).toBe('doc1.txt');
      expect(docs[1]?.originalname).toBe('doc2.txt');
      expect(docs[0]?.buffer?.toString()).toBe('doc1 content');
      expect(docs[1]?.buffer?.toString()).toBe('doc2 content');
    });

    test('should handle multiple form fields with same name', async () => {
      const body = createMultipartBody([
        { name: 'tags', content: 'tag1' },
        { name: 'tags', content: 'tag2' },
        { name: 'tags', content: 'tag3' },
      ]);

      const request = createMockRequest(body);
      const result = await parseMultipartRequest(request, { strategy: 'memory' });

      expect(Array.isArray(result.fields.tags)).toBe(true);
      expect(result.fields.tags).toEqual(['tag1', 'tag2', 'tag3']);
    });

    test('should handle mixed fields and files', async () => {
      const body = createMultipartBody([
        { name: 'title', content: 'My Upload' },
        { name: 'description', content: 'A test upload' },
        {
          name: 'file',
          content: 'file content',
          filename: 'test.txt',
          contentType: 'text/plain',
        },
        { name: 'category', content: 'documents' },
      ]);

      const request = createMockRequest(body);
      const result = await parseMultipartRequest(request, { strategy: 'memory' });

      // Check fields
      expect(result.fields.title).toBe('My Upload');
      expect(result.fields.description).toBe('A test upload');
      expect(result.fields.category).toBe('documents');

      // Check file
      expect(result.files.file).toBeDefined();
      const file = result.files.file as UploadedFile;
      expect(file.originalname).toBe('test.txt');
      expect(file.mimetype).toBe('text/plain');
      expect(file.buffer?.toString()).toBe('file content');
    });
  });

  describe('Different Strategies', () => {
    test('should handle memory strategy', async () => {
      const body = createMultipartBody([
        { name: 'field', content: 'value' },
        {
          name: 'file',
          content: 'file content',
          filename: 'test.txt',
          contentType: 'text/plain',
        },
      ]);

      const request = createMockRequest(body);
      const result = await parseMultipartRequest(request, { strategy: 'memory' });

      expect(result.fields.field).toBe('value');
      const file = result.files.file as UploadedFile;
      expect(file.buffer).toBeDefined();
      expect(file.buffer?.toString()).toBe('file content');
      expect(file.tempPath).toBeUndefined();
    });

    test('should handle stream strategy', async () => {
      const body = createMultipartBody([
        { name: 'field', content: 'value' },
        {
          name: 'file',
          content: 'file content',
          filename: 'test.txt',
          contentType: 'text/plain',
        },
      ]);

      const request = createMockRequest(body);
      const result = await parseMultipartRequest(request, { strategy: 'stream' });

      expect(result.fields.field).toBe('value');
      const file = result.files.file as any;
      expect(file.stream).toBeDefined();
      expect(file.buffer).toBeUndefined();
      expect(file.tempPath).toBeUndefined();
    });

    test('should handle temp strategy', async () => {
      const body = createMultipartBody([
        { name: 'field', content: 'value' },
        {
          name: 'file',
          content: 'file content',
          filename: 'test.txt',
          contentType: 'text/plain',
        },
      ]);

      const request = createMockRequest(body);
      const result = await parseMultipartRequest(request, { strategy: 'temp' });

      expect(result.fields.field).toBe('value');
      const file = result.files.file as UploadedFile;
      expect(file.stream).toBeDefined();
      expect(file.tempPath).toBeDefined();
      expect(file.buffer).toBeUndefined();
    });
  });

  describe('Validation and Limits', () => {
    test('should enforce file size limits', async () => {
      const largeContent = 'x'.repeat(1000);
      const body = createMultipartBody([
        {
          name: 'file',
          content: largeContent,
          filename: 'large.txt',
          contentType: 'text/plain',
        },
      ]);

      const request = createMockRequest(body);

      await expect(
        parseMultipartRequest(request, {
          strategy: 'memory',
          maxFileSize: 500,
        })
      ).rejects.toThrow('File size exceeds limit');
    });

    test('should enforce field size limits', async () => {
      const largeContent = 'x'.repeat(2000);
      const body = createMultipartBody([{ name: 'description', content: largeContent }]);

      const request = createMockRequest(body);

      await expect(
        parseMultipartRequest(request, {
          strategy: 'memory',
          maxFieldSize: 1000,
        })
      ).rejects.toThrow('Field size exceeds limit');
    });

    test('should enforce file count limits', async () => {
      const body = createMultipartBody([
        { name: 'file1', content: 'content1', filename: 'file1.txt' },
        { name: 'file2', content: 'content2', filename: 'file2.txt' },
        { name: 'file3', content: 'content3', filename: 'file3.txt' },
      ]);

      const request = createMockRequest(body);

      await expect(
        parseMultipartRequest(request, {
          strategy: 'memory',
          maxFiles: 2,
        })
      ).rejects.toThrow('Too many files');
    });

    test('should enforce MIME type restrictions', async () => {
      const body = createMultipartBody([
        {
          name: 'file',
          content: 'content',
          filename: 'file.txt',
          contentType: 'text/plain',
        },
      ]);

      const request = createMockRequest(body);

      await expect(
        parseMultipartRequest(request, {
          strategy: 'memory',
          allowedMimeTypes: ['image/jpeg', 'image/png'],
        })
      ).rejects.toThrow('not allowed');
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty multipart request', async () => {
      const body = Buffer.from(`--${boundary}--\r\n`);
      const request = createMockRequest(body);
      await expect(parseMultipartRequest(request)).rejects.toThrow('Empty multipart request');
    });

    test('should handle files without filename', async () => {
      const body = createMultipartBody([
        {
          name: 'file',
          content: 'content',
          filename: '',
          contentType: 'text/plain',
        },
      ]);

      const request = createMockRequest(body);
      const result = await parseMultipartRequest(request, { strategy: 'memory' });

      const file = result.files.file as UploadedFile;
      expect(file.originalname).toBe('');
      expect(file.mimetype).toBe('text/plain');
    });

    test('should handle large multipart requests', async () => {
      const parts = [];
      for (let i = 0; i < 50; i++) {
        parts.push({ name: `field${i}`, content: `value${i}` });
      }

      const body = createMultipartBody(parts);
      const request = createMockRequest(body);
      const result = await parseMultipartRequest(request, { strategy: 'memory' });

      expect(Object.keys(result.fields)).toHaveLength(50);
      expect(result.fields.field0).toBe('value0');
      expect(result.fields.field49).toBe('value49');
    });

    test('should reject invalid boundary', async () => {
      const readable = Readable.from(Buffer.from('invalid multipart data'));
      const request = readable as any;
      request.headers = {
        'content-type': 'multipart/form-data', // No boundary
      };

      await expect(parseMultipartRequest(request)).rejects.toThrow('Missing boundary');
    });

    test('should handle malformed multipart data', async () => {
      const malformedData = Buffer.from('not-multipart-data');
      const request = createMockRequest(malformedData);
      await expect(parseMultipartRequest(request)).rejects.toThrow(
        'No valid multipart boundary found'
      );
    });
  });

  describe('Default Options', () => {
    test('should use default options when none provided', async () => {
      const body = createMultipartBody([
        { name: 'field', content: 'value' },
        { name: 'file', content: 'content', filename: 'test.txt' },
      ]);

      const request = createMockRequest(body);

      // Should not throw with default options
      const result = await parseMultipartRequest(request);

      expect(result.fields.field).toBe('value');
      expect(result.files.file).toBeDefined();
    });

    test('should handle partial options', async () => {
      const body = createMultipartBody([
        { name: 'file', content: 'content', filename: 'test.txt' },
      ]);

      const request = createMockRequest(body);

      const result = await parseMultipartRequest(request, {
        maxFileSize: 1024,
        // Other options should use defaults
      });

      expect(result.files.file).toBeDefined();
    });
  });
});
