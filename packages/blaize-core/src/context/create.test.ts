import { Readable } from 'node:stream';

import { createContext, getCurrentContext, isInRequestContext } from './create';
import * as storeModule from './store'; // We'll mock this

// Mock the store module
vi.mock('./store', () => ({
  hasContext: vi.fn(),
  getContext: vi.fn(),
  runWithContext: vi.fn(),
}));

describe('Context Module', () => {
  // Create mock HTTP/1.1 request
  const createMockHttp1Request = () => ({
    url: '/test?foo=bar&arr=1&arr=2',
    method: 'GET',
    headers: {
      host: 'example.com',
      'user-agent': 'test-agent',
      'x-custom-header': 'custom-value',
    },
    socket: {
      encrypted: false,
    },
  });

  // Create mock HTTP/2 request
  const createMockHttp2Request = () => ({
    url: '/test?foo=bar&arr=1&arr=2',
    method: 'GET',
    headers: {
      host: 'example.com',
      'user-agent': 'test-agent',
      'x-custom-header': 'custom-value',
    },
    socket: {
      encrypted: true,
    },
    stream: {}, // HTTP/2 specific property
    httpVersionMajor: 2,
  });

  // Create mock response
  const createMockResponse = () => ({
    statusCode: 200,
    setHeader: vi.fn(),
    getHeader: vi.fn(),
    removeHeader: vi.fn(),
    end: vi.fn(),
    write: vi.fn(),
    on: vi.fn(),
  });

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
});
