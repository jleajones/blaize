import { Readable } from 'node:stream';

import {
  createMockContext,
  createMockHttp1Request,
  createMockHttp2Request,
  createMockResponse,
} from '@blaizejs/testing-utils';

import { createContext, getCurrentContext, isInRequestContext } from './create';
import { ResponseSentError } from './errors';
import * as storeModule from './store';
import { runWithContext } from './store';
import { PayloadTooLargeError } from '../errors/payload-too-large-error';
import { UnsupportedMediaTypeError } from '../errors/unsupported-media-type-error';
import { DEFAULT_OPTIONS } from '../server/create';
import { _setCorrelationConfig } from '../tracing/correlation';

import type { ContextOptions, Services, State } from '@blaize-types/context';

// Mock the store module
vi.mock('./store', () => ({
  hasContext: vi.fn(),
  getContext: vi.fn(),
  runWithContext: vi.fn(),
}));

describe('Context Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    _setCorrelationConfig('x-correlation-id');
  });

  describe('createContext', () => {
    test('should create a context with HTTP/2 request', async () => {
      const req = createMockHttp2Request();
      const res = createMockResponse();

      const context = await createContext(req as any, res as any, {
        bodyLimits: DEFAULT_OPTIONS.bodyLimits,
      });

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

      const context = await createContext(req as any, res as any, {
        bodyLimits: DEFAULT_OPTIONS.bodyLimits,
      });

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

      const context = await createContext(req as any, res as any, {
        bodyLimits: DEFAULT_OPTIONS.bodyLimits,
      });

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

      const context = await createContext(req as any, res as any, {
        bodyLimits: DEFAULT_OPTIONS.bodyLimits,
        initialState,
      });

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
      await expect(
        createContext(req as any, res as any, {
          bodyLimits: DEFAULT_OPTIONS.bodyLimits,
        })
      ).rejects.toThrow(/Invalid URL/);
    });
  });

  describe('Request Header Access', () => {
    test('request.header should return header values', async () => {
      const req = createMockHttp2Request();
      const res = createMockResponse();

      const context = await createContext(req as any, res as any, {
        bodyLimits: DEFAULT_OPTIONS.bodyLimits,
      });

      expect(context.request.header('user-agent')).toBe('test-agent');
      expect(context.request.header('x-custom-header')).toBe('custom-value');
      expect(context.request.header('non-existent')).toBeUndefined();
    });

    test('request.headers should return all or specified headers', async () => {
      const req = createMockHttp2Request();
      const res = createMockResponse();

      const context = await createContext(req as any, res as any, {
        bodyLimits: DEFAULT_OPTIONS.bodyLimits,
      });

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

      const context = await createContext(req as any, res as any, {
        bodyLimits: DEFAULT_OPTIONS.bodyLimits,
      });

      context.response.status(404);
      expect(res.statusCode).toBe(404);
    });

    test('response.header should set a single header', async () => {
      const req = createMockHttp2Request();
      const res = createMockResponse();

      const context = await createContext(req as any, res as any, {
        bodyLimits: DEFAULT_OPTIONS.bodyLimits,
      });

      context.response.header('X-Custom', 'Value');
      expect(res.setHeader).toHaveBeenCalledWith('X-Custom', 'Value');
    });

    test('response.headers should set multiple headers', async () => {
      const req = createMockHttp2Request();
      const res = createMockResponse();

      const context = await createContext(req as any, res as any, {
        parseBody: true,
        bodyLimits: DEFAULT_OPTIONS.bodyLimits,
      });

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

      const context = await createContext(req as any, res as any, {
        bodyLimits: DEFAULT_OPTIONS.bodyLimits,
      });

      context.response.type('application/xml');
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/xml');
    });

    test('response.json should send JSON response', async () => {
      const req = createMockHttp2Request();
      const res = createMockResponse();

      const context = await createContext(req as any, res as any, {
        bodyLimits: DEFAULT_OPTIONS.bodyLimits,
      });
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

      const context = await createContext(req as any, res as any, {
        bodyLimits: DEFAULT_OPTIONS.bodyLimits,
      });

      context.response.text('Hello World', 200);

      expect(res.statusCode).toBe(200);
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/plain');
      expect(res.end).toHaveBeenCalledWith('Hello World');
      expect(context.response.sent).toBe(true);
    });

    test('response.html should send HTML response', async () => {
      const req = createMockHttp2Request();
      const res = createMockResponse();

      const context = await createContext(req as any, res as any, {
        bodyLimits: DEFAULT_OPTIONS.bodyLimits,
      });

      context.response.html('<p>Hello</p>', 200);

      expect(res.statusCode).toBe(200);
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/html');
      expect(res.end).toHaveBeenCalledWith('<p>Hello</p>');
      expect(context.response.sent).toBe(true);
    });

    test('response.redirect should send redirect response', async () => {
      const req = createMockHttp2Request();
      const res = createMockResponse();

      const context = await createContext(req as any, res as any, {
        bodyLimits: DEFAULT_OPTIONS.bodyLimits,
      });

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

      const context = await createContext(req as any, res as any, {
        bodyLimits: DEFAULT_OPTIONS.bodyLimits,
      });

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

      const context = await createContext(req as any, res as any, {
        bodyLimits: DEFAULT_OPTIONS.bodyLimits,
      });

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

      const context = await createContext(req as any, res as any, {
        bodyLimits: DEFAULT_OPTIONS.bodyLimits,
      });

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
      const mockContext = createMockContext();

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

      const context = await createContext(req as any, res as any, {
        parseBody: true,
        bodyLimits: DEFAULT_OPTIONS.bodyLimits,
      });

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

      const context = await createContext(req as any, res as any, {
        parseBody: true,
        bodyLimits: DEFAULT_OPTIONS.bodyLimits,
      });

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

      const context = await createContext(req as any, res as any, {
        parseBody: true,
        bodyLimits: DEFAULT_OPTIONS.bodyLimits,
      });

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

    test('should throw UnsupportedMediaTypeError for invalid multipart data', async () => {
      const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
      // Create invalid multipart data (missing boundary)
      const invalidBody = Buffer.from('invalid multipart data');

      const req = createMultipartRequest(invalidBody, boundary);
      const res = createMockResponse();

      // ✅ Expect createContext to throw instead of setting state
      await expect(
        createContext(req as any, res as any, {
          parseBody: true,
          bodyLimits: DEFAULT_OPTIONS.bodyLimits,
        })
      ).rejects.toThrow(UnsupportedMediaTypeError);
    });

    test('should not attempt multipart parsing for non-multipart content', async () => {
      const jsonBody = { name: 'test' };
      const req = createMockHttp1Request({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': String(JSON.stringify(jsonBody).length),
        },
      });

      const res = createMockResponse();

      const context = await createContext(req as any, res as any, {
        parseBody: true,
        bodyLimits: DEFAULT_OPTIONS.bodyLimits,
      });

      // ✅ Should have parsed JSON body
      expect(context.request.body).toEqual(jsonBody);

      // ✅ Should NOT have multipart properties for non-multipart requests
      expect(context.request.multipart).toBeUndefined();
      expect(context.request.files).toBeUndefined();
    });

    test('should not attempt multipart parsing when content-type is not multipart', async () => {
      const req = createMockHttp1Request({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': '0', // ✅ Empty body to avoid parsing
        },
      });

      const res = createMockResponse();

      const context = await createContext(req as any, res as any, {
        parseBody: true,
        bodyLimits: DEFAULT_OPTIONS.bodyLimits,
      });

      // Should not have multipart properties
      expect(context.request.multipart).toBeUndefined();
      expect(context.request.files).toBeUndefined();

      // Body should be undefined (empty)
      expect(context.request.body).toBeUndefined();
    });

    test('should respect file size limits during parsing', async () => {
      const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
      const largeContent = 'x'.repeat(100 * 1024 * 1024); // 100MB - larger than default 50MB limit
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

      // ✅ Expect createContext to throw PayloadTooLargeError
      await expect(
        createContext(req as any, res as any, {
          parseBody: true,
          bodyLimits: DEFAULT_OPTIONS.bodyLimits,
        })
      ).rejects.toThrow(PayloadTooLargeError);
    });

    test('should provide proper TypeScript types for multipart properties', async () => {
      const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
      const body = createMultipartBody(boundary, [
        { name: 'title', content: 'Test' },
        { name: 'file', content: 'content', filename: 'test.txt' },
      ]);

      const req = createMultipartRequest(body, boundary);
      const res = createMockResponse();

      const context = await createContext(req as any, res as any, {
        parseBody: true,
        bodyLimits: DEFAULT_OPTIONS.bodyLimits,
      });

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

  describe('Context Correlation Header Support', () => {
    let mockReq: any;
    let mockRes: any;

    describe('JSON Response', () => {
      test('should include correlation header when sending JSON response', async () => {
        mockReq = createMockHttp1Request();
        mockRes = createMockResponse();

        const context = await createContext(mockReq, mockRes, {
          parseBody: false,
          bodyLimits: DEFAULT_OPTIONS.bodyLimits,
        });

        // Set correlation ID in state
        context.state.correlationId = 'test-json-123';

        // Send JSON response
        context.response.json({ success: true });

        // Verify correlation header was set
        expect(mockRes.setHeader).toHaveBeenCalledWith('x-correlation-id', 'test-json-123');
        expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json');
        expect(mockRes.end).toHaveBeenCalledWith(JSON.stringify({ success: true }));
      });

      test('should not add correlation header if correlationId not in state', async () => {
        mockReq = createMockHttp1Request();
        mockRes = createMockResponse();

        const context = await createContext(mockReq, mockRes, {
          parseBody: false,
          bodyLimits: DEFAULT_OPTIONS.bodyLimits,
        });

        // No correlation ID in state
        context.response.json({ success: true });

        // Verify correlation header was NOT set
        expect(mockRes.setHeader).not.toHaveBeenCalledWith('x-correlation-id', expect.anything());
        expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json');
      });

      test('should use custom header name when configured', async () => {
        // Configure custom header name
        _setCorrelationConfig('x-request-id');

        mockReq = createMockHttp1Request();
        mockRes = createMockResponse();

        const context = await createContext(mockReq, mockRes, {
          parseBody: false,
          bodyLimits: DEFAULT_OPTIONS.bodyLimits,
        });

        context.state.correlationId = 'custom-header-456';
        context.response.json({ data: 'test' });

        // Verify custom header name was used
        expect(mockRes.setHeader).toHaveBeenCalledWith('x-request-id', 'custom-header-456');
      });
    });

    describe('Text Response', () => {
      test('should include correlation header when sending text response', async () => {
        mockReq = createMockHttp2Request();
        mockRes = createMockResponse();

        const context = await createContext(mockReq, mockRes, {
          parseBody: false,
          bodyLimits: DEFAULT_OPTIONS.bodyLimits,
        });

        context.state.correlationId = 'test-text-789';
        context.response.text('Hello World');

        expect(mockRes.setHeader).toHaveBeenCalledWith('x-correlation-id', 'test-text-789');
        expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/plain');
        expect(mockRes.end).toHaveBeenCalledWith('Hello World');
      });
    });

    describe('HTML Response', () => {
      test('should include correlation header when sending HTML response', async () => {
        mockReq = createMockHttp1Request();
        mockRes = createMockResponse();

        const context = await createContext(mockReq, mockRes, {
          parseBody: false,
          bodyLimits: DEFAULT_OPTIONS.bodyLimits,
        });

        context.state.correlationId = 'test-html-abc';
        const html = '<h1>Hello</h1>';
        context.response.html(html);

        expect(mockRes.setHeader).toHaveBeenCalledWith('x-correlation-id', 'test-html-abc');
        expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/html');
        expect(mockRes.end).toHaveBeenCalledWith(html);
      });
    });

    describe('Redirect Response', () => {
      test('should include correlation header when sending redirect', async () => {
        mockReq = createMockHttp1Request();
        mockRes = createMockResponse();

        const context = await createContext(mockReq, mockRes, {
          parseBody: false,
          bodyLimits: DEFAULT_OPTIONS.bodyLimits,
        });

        context.state.correlationId = 'test-redirect-xyz';
        context.response.redirect('/new-location', 301);

        expect(mockRes.setHeader).toHaveBeenCalledWith('x-correlation-id', 'test-redirect-xyz');
        expect(mockRes.setHeader).toHaveBeenCalledWith('Location', '/new-location');
        expect(mockRes.statusCode).toBe(301);
        expect(mockRes.end).toHaveBeenCalled();
      });

      test('should use default 302 status for redirect', async () => {
        mockReq = createMockHttp1Request();
        mockRes = createMockResponse();

        const context = await createContext(mockReq, mockRes, {
          parseBody: false,
          bodyLimits: DEFAULT_OPTIONS.bodyLimits,
        });

        context.state.correlationId = 'test-redirect-default';
        context.response.redirect('/another-location');

        expect(mockRes.statusCode).toBe(302);
        expect(mockRes.setHeader).toHaveBeenCalledWith('x-correlation-id', 'test-redirect-default');
      });
    });

    describe('Stream Response', () => {
      test('should include correlation header when streaming', async () => {
        mockReq = createMockHttp2Request();
        mockRes = createMockResponse();

        const context = await createContext(mockReq, mockRes, {
          parseBody: false,
          bodyLimits: DEFAULT_OPTIONS.bodyLimits,
        });

        // Create a mock readable stream
        const mockStream = {
          on: vi.fn((event, callback) => {
            if (event === 'end') {
              // Simulate stream end
              setTimeout(callback, 0);
            }
            return mockStream;
          }),
          pipe: vi.fn(() => mockStream),
        };

        context.state.correlationId = 'test-stream-999';
        context.response.stream(mockStream as any, {
          contentType: 'application/octet-stream',
        });

        // Verify correlation header was set before streaming
        expect(mockRes.setHeader).toHaveBeenCalledWith('x-correlation-id', 'test-stream-999');
        expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'application/octet-stream');
        expect(mockStream.pipe).toHaveBeenCalledWith(mockRes);
      });

      test('should handle stream errors with correlation', async () => {
        mockReq = createMockHttp1Request();
        mockRes = createMockResponse();

        const context = await createContext(mockReq, mockRes, {
          parseBody: false,
          bodyLimits: DEFAULT_OPTIONS.bodyLimits,
        });

        let errorCallback: any;
        const mockStream = {
          on: vi.fn((event, callback) => {
            if (event === 'error') {
              errorCallback = callback;
            }
            return mockStream;
          }),
          pipe: vi.fn(() => mockStream),
        };

        context.state.correlationId = 'test-stream-error';
        context.response.stream(mockStream as any);

        // Simulate stream error
        errorCallback(new Error('Stream failed'));

        expect(mockRes.statusCode).toBe(500);
        expect(mockRes.end).toHaveBeenCalledWith('Stream error');
      });
    });

    describe('HTTP/2 Support', () => {
      test('should work with HTTP/2 requests', async () => {
        mockReq = createMockHttp2Request();
        mockRes = createMockResponse();

        const context = await createContext(mockReq, mockRes, {
          parseBody: false,
          bodyLimits: DEFAULT_OPTIONS.bodyLimits,
        });

        context.state.correlationId = 'test-http2-correlation';
        context.response.json({ http2: true });

        // The context abstraction handles HTTP/2 vs HTTP/1.1 differences
        // We just verify the header is set correctly
        expect(mockRes.setHeader).toHaveBeenCalledWith(
          'x-correlation-id',
          'test-http2-correlation'
        );
      });
    });

    describe('Response Status with Correlation', () => {
      test('should include correlation header with custom status', async () => {
        mockReq = createMockHttp1Request();
        mockRes = createMockResponse();

        const context = await createContext(mockReq, mockRes, {
          parseBody: false,
          bodyLimits: DEFAULT_OPTIONS.bodyLimits,
        });

        context.state.correlationId = 'test-status-201';
        context.response.json({ created: true }, 201);

        expect(mockRes.statusCode).toBe(201);
        expect(mockRes.setHeader).toHaveBeenCalledWith('x-correlation-id', 'test-status-201');
      });
    });

    describe('Edge Cases', () => {
      test('should handle non-string correlation ID gracefully', async () => {
        mockReq = createMockHttp1Request();
        mockRes = createMockResponse();

        const context = await createContext(mockReq, mockRes, {
          parseBody: false,
          bodyLimits: DEFAULT_OPTIONS.bodyLimits,
        });

        // Set a non-string value (shouldn't happen in practice)
        context.state.correlationId = 12345 as any;
        context.response.json({ test: true });

        // Should convert to string
        expect(mockRes.setHeader).toHaveBeenCalledWith('x-correlation-id', '12345');
      });

      test('should not interfere with other state properties', async () => {
        mockReq = createMockHttp1Request();
        mockRes = createMockResponse();

        const context = await createContext(mockReq, mockRes, {
          parseBody: false,
          bodyLimits: DEFAULT_OPTIONS.bodyLimits,
        });

        context.state.correlationId = 'test-other-state';
        context.state.user = { id: 1, name: 'Test User' };
        context.state.customProp = 'custom value';

        context.response.json({ data: 'test' });

        // Verify only correlation header is added, not other state
        expect(mockRes.setHeader).toHaveBeenCalledWith('x-correlation-id', 'test-other-state');
        expect(mockRes.setHeader).not.toHaveBeenCalledWith('user', expect.anything());
        expect(mockRes.setHeader).not.toHaveBeenCalledWith('customProp', expect.anything());
      });

      test('should throw ResponseSentError if response already sent', async () => {
        mockReq = createMockHttp1Request();
        mockRes = createMockResponse();

        const context = await createContext(mockReq, mockRes, {
          parseBody: false,
          bodyLimits: DEFAULT_OPTIONS.bodyLimits,
        });

        context.state.correlationId = 'test-already-sent';

        // Send first response
        context.response.json({ first: true });

        // Try to send second response
        expect(() => {
          context.response.json({ second: true });
        }).toThrow(ResponseSentError);
      });
    });
  });

  describe('Context Services Initialization', () => {
    let req: any;
    let res: any;

    beforeEach(() => {
      req = createMockHttp1Request();
      res = createMockResponse();
    });

    test('should initialize context with empty services by default', async () => {
      const ctx = await createContext(req, res, {
        parseBody: false,
        bodyLimits: DEFAULT_OPTIONS.bodyLimits,
      });

      expect(ctx.services).toBeDefined();
      expect(ctx.services).toEqual({});
      expect(typeof ctx.services).toBe('object');
    });

    test('should initialize context with provided services', async () => {
      const initialServices = {
        db: { connected: true },
        cache: new Map(),
        logger: console.log,
      };

      const options: ContextOptions = {
        initialServices,
        parseBody: false,
        bodyLimits: DEFAULT_OPTIONS.bodyLimits,
      };

      const ctx = await createContext(req, res, options);

      expect(ctx.services).toBeDefined();
      expect(ctx.services).toEqual(initialServices);
      expect(ctx.services.db).toEqual({ connected: true });
      expect(ctx.services.cache).toBeInstanceOf(Map);
      expect(ctx.services.logger).toBe(console.log);
    });

    test('services should be mutable', async () => {
      const ctx = await createContext(req, res, {
        parseBody: false,
        bodyLimits: DEFAULT_OPTIONS.bodyLimits,
      });

      // Add new service - need to type assert or use proper typing
      ctx.services.newService = { test: 'value' };
      expect(ctx.services.newService).toEqual({ test: 'value' });

      // Modify existing service - need to handle the unknown type
      const service = ctx.services.newService as { test: string };
      service.test = 'updated';
      expect(service.test).toBe('updated');

      // Delete service
      delete ctx.services.newService;
      expect(ctx.services.newService).toBeUndefined();
    });

    // Alternative approach - more type-safe version:
    test('services should be mutable (type-safe version)', async () => {
      // Define the service type
      interface TestService {
        test: string;
      }

      const ctx = await createContext(req, res, {
        parseBody: false,
        bodyLimits: DEFAULT_OPTIONS.bodyLimits,
      });

      // Add new service with type assertion
      ctx.services.newService = { test: 'value' } as TestService;

      // Now TypeScript knows the type
      const service = ctx.services.newService as TestService;
      expect(service).toEqual({ test: 'value' });

      // Modify existing service
      service.test = 'updated';
      expect(service.test).toBe('updated');

      // Delete service
      delete ctx.services.newService;
      expect(ctx.services.newService).toBeUndefined();
    });

    test('should work with typed services', async () => {
      interface AppServices extends Services {
        database: {
          query: (sql: string) => Promise<any[]>;
          execute: (sql: string) => Promise<void>;
        };
        cache: {
          get: (key: string) => any;
          set: (key: string, value: any) => void;
        };
      }

      const services: AppServices = {
        database: {
          query: async _sql => [],
          execute: async _sql => {},
        },
        cache: {
          get: _key => null,
          set: (_key, _value) => {},
        },
      };

      const ctx = await createContext<State, AppServices>(req, res, {
        initialServices: services,
        parseBody: false,
        bodyLimits: DEFAULT_OPTIONS.bodyLimits,
      });

      // TypeScript should know the exact types
      const _result = await ctx.services.database.query('SELECT * FROM users');
      ctx.services.cache.set('key', 'value');

      expect(ctx.services.database).toBeDefined();
      expect(ctx.services.cache).toBeDefined();
    });

    test('should maintain services through context retrieval', async () => {
      interface TestServices extends Services {
        testService: { value: number };
      }
      const services = {
        testService: { value: 42 },
      };

      const ctx = await createContext(req, res, {
        initialServices: services,
        parseBody: false,
        bodyLimits: DEFAULT_OPTIONS.bodyLimits,
      });

      await runWithContext(ctx, async () => {
        const retrievedCtx = getCurrentContext<State, TestServices>();
        expect(retrievedCtx.services).toEqual(services);
        expect(retrievedCtx.services.testService.value).toBe(42);
      });
    });

    test('should allow middleware to add services', async () => {
      interface DbService {
        query: (sql: string) => Promise<string[]>;
      }

      interface AppServices extends Services {
        db: DbService;
      }

      const ctx = await createContext<State, AppServices>(req, res, {
        parseBody: false,
        bodyLimits: DEFAULT_OPTIONS.bodyLimits,
      });

      // Simulate middleware adding a service
      const addDatabaseMiddleware = async () => {
        ctx.services.db = {
          query: async (sql: string) => [`Result for: ${sql}`],
        };
      };

      await addDatabaseMiddleware();
      expect(ctx.services.db).toBeDefined();

      const result = await ctx.services.db.query('SELECT 1');
      expect(result).toEqual(['Result for: SELECT 1']);
    });

    test('should handle both state and services initialization', async () => {
      // Define the types
      interface AppState extends State {
        requestId: string;
        user: { id: string; name: string };
      }

      interface AppServices extends Services {
        logger: { log: (msg: string) => void };
        config: { apiUrl: string };
      }

      const options: ContextOptions = {
        initialState: {
          requestId: 'req-123',
          user: { id: '1', name: 'Test' },
        },
        initialServices: {
          logger: { log: (msg: string) => console.log(msg) },
          config: { apiUrl: 'https://api.example.com' },
        },
        parseBody: false,
        bodyLimits: DEFAULT_OPTIONS.bodyLimits,
      };

      const ctx = await createContext<AppState, AppServices>(req, res, options);

      // Check state
      expect(ctx.state.requestId).toBe('req-123');
      expect(ctx.state.user).toEqual({ id: '1', name: 'Test' });

      // Check services
      expect(ctx.services.logger).toBeDefined();
      expect(ctx.services.config.apiUrl).toBe('https://api.example.com');
    });

    test('should not interfere with existing functionality', async () => {
      const ctx = await createContext(req, res, {
        parseBody: false,
        initialState: { test: 'value' },
        bodyLimits: DEFAULT_OPTIONS.bodyLimits,
      });

      // Existing properties should work as before
      expect(ctx.request).toBeDefined();
      expect(ctx.response).toBeDefined();
      expect(ctx.state).toBeDefined();
      expect(ctx.state.test).toBe('value');

      // Services should be added without breaking anything
      expect(ctx.services).toBeDefined();
      expect(ctx.services).toEqual({});
    });

    test('getCurrentContext should return context with services', async () => {
      interface TestServices extends Services {
        test: { value: number };
      }

      const ctx = await createContext<State, TestServices>(req, res, {
        initialServices: { test: { value: 100 } },
        parseBody: false,
        bodyLimits: DEFAULT_OPTIONS.bodyLimits,
      });

      await runWithContext(ctx, () => {
        const current = getCurrentContext<State, TestServices>();
        expect(current.services.test.value).toBe(100);
      });
    });

    test('services should be separate per request context', async () => {
      const ctx1 = await createContext(req, res, {
        initialServices: { id: 'context-1' },
        parseBody: false,
        bodyLimits: DEFAULT_OPTIONS.bodyLimits,
      });

      const ctx2 = await createContext(req, res, {
        initialServices: { id: 'context-2' },
        parseBody: false,
        bodyLimits: DEFAULT_OPTIONS.bodyLimits,
      });

      await runWithContext(ctx1, () => {
        const current = getCurrentContext();
        expect(current.services.id).toBe('context-1');
      });

      await runWithContext(ctx2, () => {
        const current = getCurrentContext();
        expect(current.services.id).toBe('context-2');
      });
    });
  });
});
