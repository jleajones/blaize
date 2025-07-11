import { Readable } from 'node:stream';

import {
  createMockHttp1Request,
  createMockHttp2Request,
  createMockResponse,
} from '@blaizejs/testing-utils';

import { createContext, getCurrentContext, isInRequestContext } from './create';
import * as storeModule from './store';

// Mock the store module
vi.mock('./store', () => ({
  hasContext: vi.fn(),
  getContext: vi.fn(),
  runWithContext: vi.fn(),
}));

describe('Context Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createContext', () => {
    test('should create a context with HTTP/2 request', async () => {
      const req = createMockHttp2Request();
      const res = createMockResponse();

      const context = await createContext(req as any, res as any);

      expect(context).toBeDefined();
      expect(context.request.method).toBe('GET');
      expect(context.request.path).toBe('/test');
      expect(context.request.query).toEqual({
        foo: 'bar',
        arr: ['1', '2'],
      });
      expect(context.request.isHttp2).toBe(true);
      expect(context.request.protocol).toBe('https'); // From x-forwarded-proto
      expect(context.state).toEqual({});
    });

    test('should create a context with a insecure HTTP/1.1 request', async () => {
      const req = {
        ...createMockHttp1Request(),
      };
      const res = createMockResponse();

      const context = await createContext(req as any, res as any);

      expect(context).toBeDefined();
      expect(context.request.method).toBe('GET');
      expect(context.request.path).toBe('/test');
      expect(context.request.isHttp2).toBe(false);
      expect(context.request.protocol).toBe('http'); // From socket.encrypted
    });

    test('should create a context with a secure HTTP/1.1 request', async () => {
      const req = {
        ...createMockHttp1Request(),
        headers: {
          'x-forwarded-proto': 'https',
        },
      };
      const res = createMockResponse();

      const context = await createContext(req as any, res as any);

      expect(context).toBeDefined();
      expect(context.request.method).toBe('GET');
      expect(context.request.path).toBe('/test');
      expect(context.request.isHttp2).toBe(false);
      expect(context.request.protocol).toBe('https'); // From socket.encrypted
    });

    test('should include initial state if provided', async () => {
      const req = createMockHttp1Request();
      const res = createMockResponse();
      const initialState = { user: { id: 1, name: 'Test User' } };

      const context = await createContext(req as any, res as any, { initialState });

      expect(context.state).toEqual(initialState);
    });

    test('should handle invalid URLs gracefully', async () => {
      const req = {
        ...createMockHttp2Request(),
        url: '::::', // Invalid URL format
        headers: {
          host: 'e*ampl3[.co',
        },
      };

      const res = createMockResponse();
      await expect(createContext(req as any, res as any)).rejects.toThrow(/Invalid URL/);
    });
  });

  describe('Request Header Access', () => {
    test('request.header should return header values', async () => {
      const req = createMockHttp2Request();
      const res = createMockResponse();

      const context = await createContext(req as any, res as any);

      expect(context.request.header('user-agent')).toBe('test-agent');
      expect(context.request.header('x-custom-header')).toBe('custom-value');
      expect(context.request.header('non-existent')).toBeUndefined();
    });

    test('request.headers should return all or specified headers', async () => {
      const req = createMockHttp2Request();
      const res = createMockResponse();

      const context = await createContext(req as any, res as any);

      // Get all headers
      const allHeaders = context.request.headers();
      expect(allHeaders['host']).toBe('example.com');
      expect(allHeaders['user-agent']).toBe('test-agent');

      // Get specific headers
      const specificHeaders = context.request.headers(['host', 'non-existent']);
      expect(specificHeaders).toEqual({
        host: 'example.com',
        'non-existent': undefined,
      });
    });
  });

  describe('Response Methods', () => {
    test('response.status should set status code', async () => {
      const req = createMockHttp2Request();
      const res = createMockResponse();

      const context = await createContext(req as any, res as any);

      context.response.status(404);
      expect(res.statusCode).toBe(404);
    });

    test('response.header should set a single header', async () => {
      const req = createMockHttp2Request();
      const res = createMockResponse();

      const context = await createContext(req as any, res as any);

      context.response.header('X-Custom', 'Value');
      expect(res.setHeader).toHaveBeenCalledWith('X-Custom', 'Value');
    });

    test('response.headers should set multiple headers', async () => {
      const req = createMockHttp2Request();
      const res = createMockResponse();

      const context = await createContext(req as any, res as any);

      context.response.headers({
        'X-Custom1': 'Value1',
        'X-Custom2': 'Value2',
      });

      expect(res.setHeader).toHaveBeenCalledWith('X-Custom1', 'Value1');
      expect(res.setHeader).toHaveBeenCalledWith('X-Custom2', 'Value2');
    });

    test('response.type should set content type header', async () => {
      const req = createMockHttp2Request();
      const res = createMockResponse();

      const context = await createContext(req as any, res as any);

      context.response.type('application/xml');
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/xml');
    });

    test('response.json should send JSON response', async () => {
      const req = createMockHttp2Request();
      const res = createMockResponse();

      const context = await createContext(req as any, res as any);
      const data = { success: true, message: 'Test' };

      context.response.json(data, 201);

      expect(res.statusCode).toBe(201);
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json');
      expect(res.end).toHaveBeenCalledWith(JSON.stringify(data));
      expect(context.response.sent).toBe(true);
    });

    test('response.text should send text response', async () => {
      const req = createMockHttp2Request();
      const res = createMockResponse();

      const context = await createContext(req as any, res as any);

      context.response.text('Hello World', 200);

      expect(res.statusCode).toBe(200);
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/plain');
      expect(res.end).toHaveBeenCalledWith('Hello World');
      expect(context.response.sent).toBe(true);
    });

    test('response.html should send HTML response', async () => {
      const req = createMockHttp2Request();
      const res = createMockResponse();

      const context = await createContext(req as any, res as any);

      context.response.html('<p>Hello</p>', 200);

      expect(res.statusCode).toBe(200);
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/html');
      expect(res.end).toHaveBeenCalledWith('<p>Hello</p>');
      expect(context.response.sent).toBe(true);
    });

    test('response.redirect should send redirect response', async () => {
      const req = createMockHttp2Request();
      const res = createMockResponse();

      const context = await createContext(req as any, res as any);

      context.response.redirect('/new-location', 301);

      expect(res.statusCode).toBe(301);
      expect(res.setHeader).toHaveBeenCalledWith('Location', '/new-location');
      expect(res.end).toHaveBeenCalled();
      expect(context.response.sent).toBe(true);
    });

    test('response.stream should handle streaming response', async () => {
      const req = createMockHttp2Request();
      const res = createMockResponse();
      const readable = new Readable({
        read() {
          this.push('test data');
          this.push(null);
        },
      });

      // Mock pipe
      readable.pipe = vi.fn();

      const context = await createContext(req as any, res as any);

      context.response.stream(readable, {
        status: 200,
        contentType: 'text/plain',
        headers: { 'X-Stream': 'test' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/plain');
      expect(res.setHeader).toHaveBeenCalledWith('X-Stream', 'test');
      expect(readable.pipe).toHaveBeenCalledWith(res);

      // Simulate stream end
      const endHandler = readable.listeners('end')[0];
      if (endHandler) endHandler();
      expect(context.response.sent).toBe(true);
    });

    test('response.stream should handle stream errors', async () => {
      const req = createMockHttp2Request();
      const res = createMockResponse();
      const readable = new Readable({
        read() {},
      });

      // Mock pipe
      readable.pipe = vi.fn();

      // Spy on console.error
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const context = await createContext(req as any, res as any);

      context.response.stream(readable);

      // Simulate stream error
      const errorHandler = readable.listeners('error')[0];
      if (errorHandler) errorHandler(new Error('Stream test error'));

      expect(res.statusCode).toBe(500);
      expect(res.end).toHaveBeenCalledWith('Stream error');
      expect(context.response.sent).toBe(true);
      expect(consoleErrorSpy).toHaveBeenCalled();

      // Restore console.error
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Response Sent Errors', () => {
    test('should throw error when trying to modify a sent response', async () => {
      const req = createMockHttp2Request();
      const res = createMockResponse();

      const context = await createContext(req as any, res as any);

      // Send the response
      context.response.text('Done');

      // Try to modify after sending
      expect(() => context.response.status(500)).toThrow('Response has already been sent');
      expect(() => context.response.header('X-Test', 'value')).toThrow(
        'Cannot set header after response has been sent'
      );
      expect(() => context.response.headers({ 'X-Test': 'value' })).toThrow(
        'Cannot set header after response has been sent'
      );
      expect(() => context.response.type('text/plain')).toThrow(
        'Cannot set content type after response has been sent'
      );
      expect(() => context.response.json({ error: true })).toThrow(
        'Response has already been sent'
      );
      expect(() => context.response.text('Error')).toThrow('Response has already been sent');
      expect(() => context.response.html('<p>Error</p>')).toThrow('Response has already been sent');
      expect(() => context.response.redirect('/error')).toThrow('Response has already been sent');

      const readable = new Readable({
        read() {},
      });
      readable.pipe = vi.fn();

      expect(() => context.response.stream(readable)).toThrow('Response has already been sent');
    });
  });

  describe('getCurrentContext', () => {
    test('should return context if it exists', () => {
      const mockContext = {
        request: {} as any,
        response: {} as any,
        state: {},
      };

      vi.mocked(storeModule.getContext).mockReturnValue(mockContext);

      const context = getCurrentContext();
      expect(context).toBe(mockContext);
    });

    test('should throw error if context does not exist', () => {
      vi.mocked(storeModule.getContext).mockReturnValue(undefined);

      expect(() => getCurrentContext()).toThrow('No context found');
    });
  });

  describe('isInRequestContext', () => {
    test('should return true if context exists', () => {
      vi.mocked(storeModule.hasContext).mockReturnValue(true);

      expect(isInRequestContext()).toBe(true);
    });

    test('should return false if context does not exist', () => {
      vi.mocked(storeModule.hasContext).mockReturnValue(false);

      expect(isInRequestContext()).toBe(false);
    });
  });

  describe('Multipart/Form-Data Support', () => {
    // Helper to create multipart request body
    function createMultipartBody(
      boundary: string,
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

        if (part.filename) {
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

    function createMultipartRequest(body: Buffer, boundary: string) {
      const readable = Readable.from(body);
      return {
        ...createMockHttp1Request({ method: 'POST' }),
        headers: {
          'content-type': `multipart/form-data; boundary=${boundary}`,
          'content-length': body.length.toString(),
        },
        // Add async iterator support
        [Symbol.asyncIterator]: readable[Symbol.asyncIterator].bind(readable),
      };
    }

    test('should automatically parse multipart form with files', async () => {
      const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
      const body = createMultipartBody(boundary, [
        { name: 'title', content: 'Test Upload' },
        { name: 'description', content: 'A test file upload' },
        {
          name: 'avatar',
          content: 'fake image data',
          filename: 'profile.jpg',
          contentType: 'image/jpeg',
        },
      ]);

      const req = createMultipartRequest(body, boundary);
      const res = createMockResponse();

      const context = await createContext(req as any, res as any, { parseBody: true });

      // Check that multipart data was parsed
      expect(context.request.multipart).toBeDefined();
      expect(context.request.files).toBeDefined();

      // Check fields (should be in body for backward compatibility)
      expect(context.request.body).toEqual({
        title: 'Test Upload',
        description: 'A test file upload',
      });

      // Check files
      expect(context.request.files?.avatar).toBeDefined();
      const avatar = context.request.files?.avatar as any;
      expect(avatar.filename).toBe('profile.jpg');
      expect(avatar.mimetype).toBe('image/jpeg');
      expect(avatar.size).toBe('fake image data'.length);
      expect(avatar.fieldname).toBe('avatar');

      // Check complete multipart data
      expect(context.request.multipart?.fields).toEqual({
        title: 'Test Upload',
        description: 'A test file upload',
      });
      expect(context.request.multipart?.files.avatar).toBeDefined();
    });

    test('should handle form-only multipart (no files)', async () => {
      const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
      const body = createMultipartBody(boundary, [
        { name: 'username', content: 'john' },
        { name: 'email', content: 'john@example.com' },
        { name: 'tags', content: 'tag1' },
        { name: 'tags', content: 'tag2' },
      ]);

      const req = createMultipartRequest(body, boundary);
      const res = createMockResponse();

      const context = await createContext(req as any, res as any, { parseBody: true });

      // Check that multipart data was parsed
      expect(context.request.multipart).toBeDefined();
      expect(context.request.files).toBeDefined();

      // Check fields
      expect(context.request.body).toEqual({
        username: 'john',
        email: 'john@example.com',
        tags: ['tag1', 'tag2'], // Multiple values should be arrays
      });

      // Should have no files
      expect(Object.keys(context.request.files || {})).toHaveLength(0);

      // Check complete multipart data
      expect(context.request.multipart?.fields).toEqual({
        username: 'john',
        email: 'john@example.com',
        tags: ['tag1', 'tag2'],
      });
    });

    test('should handle multiple files with same field name', async () => {
      const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
      const body = createMultipartBody(boundary, [
        { name: 'category', content: 'documents' },
        {
          name: 'files',
          content: 'document 1 content',
          filename: 'doc1.txt',
          contentType: 'text/plain',
        },
        {
          name: 'files',
          content: 'document 2 content',
          filename: 'doc2.txt',
          contentType: 'text/plain',
        },
      ]);

      const req = createMultipartRequest(body, boundary);
      const res = createMockResponse();

      const context = await createContext(req as any, res as any, { parseBody: true });

      // Check fields
      expect(context.request.body).toEqual({
        category: 'documents',
      });

      // Check multiple files
      expect(Array.isArray(context.request.files?.files)).toBe(true);
      const files = context.request.files?.files as any[];
      expect(files).toHaveLength(2);
      expect(files[0].filename).toBe('doc1.txt');
      expect(files[1].filename).toBe('doc2.txt');
    });

    test('should handle multipart parsing errors gracefully', async () => {
      const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
      // Create invalid multipart data (missing boundary)
      const invalidBody = Buffer.from('invalid multipart data');

      const req = createMultipartRequest(invalidBody, boundary);
      const res = createMockResponse();

      const context = await createContext(req as any, res as any, { parseBody: true });

      // Should handle error gracefully
      expect(context.request.body).toBeNull();
      expect(context.state._bodyError).toBeDefined();
      expect(context.state._bodyError?.type).toBe('multipart_parse_error');
      expect(context.state._bodyError?.message).toContain('Failed to parse multipart data');
    });

    test('should not attempt multipart parsing for non-multipart content', async () => {
      const req = {
        ...createMockHttp1Request({ method: 'POST' }),
        headers: {
          'content-type': 'application/json',
          'content-length': '20',
        },
      };
      const res = createMockResponse();

      const context = await createContext(req as any, res as any, { parseBody: true });

      // Should not have multipart properties for non-multipart requests
      expect(context.request.multipart).toBeUndefined();
      expect(context.request.files).toBeUndefined();
    });

    test('should respect file size limits during parsing', async () => {
      const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
      const largeContent = 'x'.repeat(100* 1024 * 1024); // 100MB - larger than default 50MB limit
      const body = createMultipartBody(boundary, [
        {
          name: 'largefile',
          content: largeContent,
          filename: 'large.txt',
          contentType: 'text/plain',
        },
      ]);

      const req = createMultipartRequest(body, boundary);
      const res = createMockResponse();

      const context = await createContext(req as any, res as any, { parseBody: true });

      // Should handle size limit error
      expect(context.request.body).toBeNull();
      expect(context.state._bodyError).toBeDefined();
      expect(context.state._bodyError?.type).toBe('multipart_parse_error');
    });

    test('should provide proper TypeScript types for multipart properties', async () => {
      const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
      const body = createMultipartBody(boundary, [
        { name: 'title', content: 'Test' },
        { name: 'file', content: 'content', filename: 'test.txt' },
      ]);

      const req = createMultipartRequest(body, boundary);
      const res = createMockResponse();

      const context = await createContext(req as any, res as any, { parseBody: true });

      // These should all be properly typed (test compilation)
      const multipart = context.request.multipart;
      const files = context.request.files;
      const fields = multipart?.fields;
      const fileList = multipart?.files;

      // TypeScript should understand these types
      expect(typeof multipart).toBe('object');
      expect(typeof files).toBe('object');
      expect(typeof fields).toBe('object');
      expect(typeof fileList).toBe('object');
    });
  });
});
