// Create mock HTTP/1.1 request
export const createMockHttp1Request = () => ({
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
export const createMockHttp2Request = () => ({
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
export const createMockResponse = () => ({
  statusCode: 200,
  setHeader: vi.fn(),
  getHeader: vi.fn(),
  removeHeader: vi.fn(),
  end: vi.fn(),
  write: vi.fn(),
  on: vi.fn(),
});
