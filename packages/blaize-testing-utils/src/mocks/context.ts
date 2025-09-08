import { Context, QueryParams, Services, State } from '../../../blaize-types/src';

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
}

/**
 * Create a test context for BlaizeJS testing
 *
 * Creates a complete Context object suitable for testing route handlers and middleware.
 *
 * @param config Configuration options for the context
 * @returns Complete BlaizeJS Context object
 *
 * @example
 * ```typescript
 * // Basic usage
 * const ctx = createTestContext();
 *
 * // With configuration
 * const ctx = createTestContext({
 *   method: 'POST',
 *   path: '/api/users',
 *   body: { name: 'John Doe' },
 *   headers: { authorization: 'Bearer token' }
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
  } = config;

  // Create response object that properly chains
  const responseObj: Context['response'] = {
    raw: null as any, // Mock response object
    sent: false,
    statusCode: 200,

    status: vi.fn().mockImplementation((_code: number) => responseObj),
    header: vi.fn().mockImplementation((_name: string, _value: string) => responseObj),
    headers: vi.fn().mockImplementation((_headerObj: Record<string, string>) => responseObj),
    type: vi.fn().mockImplementation((_contentType: string) => responseObj),

    json: vi.fn().mockImplementation((_body: unknown, _status?: number) => {
      responseObj.sent = true;
    }),
    text: vi.fn().mockImplementation((_body: string, _status?: number) => {
      responseObj.sent = true;
    }),
    html: vi.fn().mockImplementation((_body: string, _status?: number) => {
      responseObj.sent = true;
    }),
    redirect: vi.fn().mockImplementation((_url: string, _status?: number) => {
      responseObj.sent = true;
    }),
    stream: vi.fn().mockImplementation((_readable: NodeJS.ReadableStream, _options?: any) => {
      responseObj.sent = true;
    }),
  };

  return {
    request: {
      raw: null as any, // Mock request object
      method,
      path,
      url: null, // URL object would be parsed in real implementation
      query: query as TQuery,
      params,
      protocol: 'http',
      isHttp2: false,
      body: body as TBody,

      // Required header function
      header: vi.fn().mockImplementation((name: string): string | undefined => {
        return headers[name.toLowerCase()];
      }),

      // Required headers function
      headers: vi
        .fn()
        .mockImplementation((names?: string[]): Record<string, string | undefined> => {
          if (names && Array.isArray(names)) {
            return names.reduce<Record<string, string | undefined>>((acc, name) => {
              acc[name] = headers[name.toLowerCase()];
              return acc;
            }, {});
          }
          return { ...headers };
        }),
    },
    response: responseObj,
    state: { ...initialState } as S,
    services: { ...initialServices } as Svc,
  };
}
