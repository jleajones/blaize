/* eslint-disable @typescript-eslint/no-unsafe-function-type */
import { EventEmitter } from 'node:events';

import type { Context, QueryParams, Services, State } from '@blaize-types';

/**
 * Configuration options for creating test contexts
 */
export interface TestContextConfig {
  method?: string;
  path?: string;
  query?: Record<string, string | string[]>;
  params?: Record<string, string>;
  headers?: Record<string, string>;
  body?: unknown;
  initialState?: Record<string, unknown>;
  initialServices?: Record<string, unknown>;
  withEventEmitter?: boolean;
}

/**
 * Create a test context for BlaizeJS testing
 *
 * Creates a complete Context object suitable for testing route handlers and middleware.
 *
 * The function uses a generic approach that allows the context to be used with
 * handlers that expect different query types (including `never` for SSE routes).
 *
 * @param config Configuration options for the context
 * @returns Complete BlaizeJS Context object
 *
 * @example
 * ```typescript
 * // Basic usage
 * const ctx = createMockContext();
 *
 * // With configuration
 * const ctx = createMockContext({
 *   method: 'POST',
 *   path: '/api/users',
 *   body: { name: 'John Doe' },
 *   headers: { authorization: 'Bearer token' }
 * });
 *
 * // For SSE testing
 * const ctx = createMockContext({
 *   withEventEmitter: true,
 *   headers: { accept: 'text/event-stream' }
 * });
 * ```
 */
export function createMockContext<
  S extends State = State,
  Svc extends Services = Services,
  TBody = unknown,
  TQuery = QueryParams,
>(config: TestContextConfig = {}): Context<S, Svc, TBody, TQuery> {
  const {
    method = 'GET',
    path = '/test',
    query = {},
    params = {},
    headers = {},
    body,
    initialState = {},
    initialServices = {},
    withEventEmitter = false,
  } = config;

  // Normalize headers for case-insensitive lookup
  const normalizedHeaders = Object.keys(headers).reduce<Record<string, string>>((acc, key) => {
    const value = headers[key];
    if (value !== undefined) {
      acc[key.toLowerCase()] = value;
    }
    return acc;
  }, {});

  // Create raw request object - either with event emitter methods (for SSE) or minimal mocks
  let rawRequest: {
    on: ReturnType<typeof vi.fn>;
    once?: ReturnType<typeof vi.fn>;
    removeListener?: ReturnType<typeof vi.fn>;
    removeAllListeners?: ReturnType<typeof vi.fn>;
    emit?: ReturnType<typeof vi.fn>;
    [key: string]: unknown;
  };

  if (withEventEmitter) {
    const emitter = new EventEmitter();
    rawRequest = {
      ...emitter,
      // Mock the event emitter methods while preserving functionality
      on: vi.fn((event: string, handler: Function) => {
        emitter.on(event, handler as any);
        return rawRequest;
      }),
      once: vi.fn((event: string, handler: Function) => {
        emitter.once(event, handler as any);
        return rawRequest;
      }),
      removeListener: vi.fn((event: string, handler: Function) => {
        emitter.removeListener(event, handler as any);
        return rawRequest;
      }),
      removeAllListeners: vi.fn((event?: string) => {
        emitter.removeAllListeners(event);
        return rawRequest;
      }),
      emit: vi.fn((event: string, ...args: any[]) => {
        return emitter.emit(event, ...args);
      }),
    };
  } else {
    rawRequest = {
      on: vi.fn().mockReturnThis(),
      once: vi.fn().mockReturnThis(),
      removeListener: vi.fn().mockReturnThis(),
      removeAllListeners: vi.fn().mockReturnThis(),
      emit: vi.fn().mockReturnValue(true),
    };
  }

  // Create raw response object with SSE-related methods
  const rawResponse = {
    writeHead: vi.fn().mockReturnThis(),
    write: vi.fn().mockReturnValue(true),
    end: vi.fn().mockReturnThis(),
    writableEnded: false,
    finished: false,
    headersSent: false,
    statusCode: 200,
    statusMessage: '',
    setHeader: vi.fn().mockReturnThis(),
    getHeader: vi.fn(),
    getHeaders: vi.fn().mockReturnValue({}),
    removeHeader: vi.fn().mockReturnThis(),
    hasHeader: vi.fn().mockReturnValue(false),
    flushHeaders: vi.fn(),
  };

  // Create response object that properly chains
  const responseObj: Context<S, Svc, TBody, TQuery>['response'] = {
    raw: rawResponse as any,
    sent: false,
    statusCode: 200,

    status: vi.fn(function (this: typeof responseObj, code: number) {
      this.statusCode = code;
      rawResponse.statusCode = code;
      return this;
    }),

    header: vi.fn(function (this: typeof responseObj, name: string, value: string) {
      rawResponse.setHeader(name, value);
      return this;
    }),

    headers: vi.fn(function (this: typeof responseObj, headerObj: Record<string, string>) {
      Object.entries(headerObj).forEach(([name, value]) => {
        rawResponse.setHeader(name, value);
      });
      return this;
    }),

    type: vi.fn(function (this: typeof responseObj, contentType: string) {
      rawResponse.setHeader('Content-Type', contentType);
      return this;
    }),

    json: vi.fn(function (this: typeof responseObj, _body: unknown, status?: number) {
      if (status) this.statusCode = status;
      this.sent = true;
    }),

    text: vi.fn(function (this: typeof responseObj, _body: string, status?: number) {
      if (status) this.statusCode = status;
      this.sent = true;
    }),

    html: vi.fn(function (this: typeof responseObj, _body: string, status?: number) {
      if (status) this.statusCode = status;
      this.sent = true;
    }),

    redirect: vi.fn(function (this: typeof responseObj, _url: string, status?: number) {
      this.statusCode = status || 302;
      this.sent = true;
    }),

    stream: vi.fn(function (
      this: typeof responseObj,
      _readable: NodeJS.ReadableStream,
      _options?: any
    ) {
      this.sent = true;
    }),
  };

  const contextRequest: Context<S, Svc, TBody, TQuery>['request'] = {
    raw: rawRequest as any,
    method,
    path,
    url: path.startsWith('http') ? new URL(path) : new URL(`http://localhost${path}`),
    query: query as TQuery,
    params,
    protocol: 'http',
    isHttp2: false,
    body: body as TBody,

    // Header function with case-insensitive lookup
    header: vi.fn((name: string): string | undefined => {
      return normalizedHeaders[name.toLowerCase()];
    }),

    // Headers function
    headers: vi.fn((names?: string[]): Record<string, string | undefined> => {
      if (names && Array.isArray(names)) {
        return names.reduce<Record<string, string | undefined>>((acc, name) => {
          acc[name] = normalizedHeaders[name.toLowerCase()];
          return acc;
        }, {});
      }
      return { ...headers };
    }),
  };

  return {
    request: contextRequest,
    response: responseObj,
    state: { ...initialState } as S,
    services: { ...initialServices } as Svc,
  };
}

/**
 * Create a mock context specifically for SSE routes
 * This version ensures compatibility with SSE route handlers
 */
export function createSSEMockContext<
  S extends State = State,
  Svc extends Services = Services,
  TQuery = QueryParams,
>(config: TestContextConfig = {}): Context<S, Svc, never, TQuery> {
  return createMockContext<S, Svc, never, TQuery>({
    ...config,
    withEventEmitter: true,
    headers: {
      accept: 'text/event-stream',
      ...config.headers,
    },
  });
}
