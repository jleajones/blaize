import type { IncomingHttpHeaders } from 'node:http';

interface MockRequestBase {
  url: string;
  method: string;
  headers: IncomingHttpHeaders;
  socket: {
    encrypted: boolean;
  };
}

interface MockHttp2Request extends MockRequestBase {
  stream: object;
  httpVersionMajor: number;
}

// Create mock HTTP/1.1 request with overrides
export const createMockHttp1Request = (
  overrides: Partial<MockRequestBase> = {}
): MockRequestBase => ({
  url: '/test?foo=bar&arr=1&arr=2',
  method: 'GET',
  headers: {
    host: 'example.com',
    'user-agent': 'test-agent',
    'x-custom-header': 'custom-value',
    ...(overrides.headers ?? {}),
  },
  socket: {
    encrypted: false,
    ...(overrides.socket ?? {}),
  },
  ...overrides,
});

// Create mock HTTP/2 request with overrides
export const createMockHttp2Request = (
  overrides: Partial<MockHttp2Request> = {}
): MockHttp2Request => ({
  url: '/test?foo=bar&arr=1&arr=2',
  method: 'GET',
  headers: {
    host: 'example.com',
    'user-agent': 'test-agent',
    'x-custom-header': 'custom-value',
    ...(overrides.headers ?? {}),
  },
  socket: {
    encrypted: true,
    ...(overrides.socket ?? {}),
  },
  stream: {},
  httpVersionMajor: 2,
  ...overrides,
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
