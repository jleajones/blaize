import type { Context, State, QueryParams } from '../../../blaize-types/src';

export interface TestContextConfig<TState extends State = State, TRequest = unknown> {
  method?: string;
  path?: string;
  query?: Record<string, string | string[]>;
  params?: Record<string, string>;
  headers?: Record<string, string>;
  body?: TRequest;
  initialState?: Partial<TState>;
}

export function createMockContext<
  TState extends State = State,
  TRequest = unknown,
  TQuery extends QueryParams = QueryParams,
>(config: TestContextConfig<TState, TRequest> = {}): Context<TState, TRequest, TQuery> {
  const {
    method = 'GET',
    path = '/test',
    query = {},
    params = {},
    headers = {},
    body,
    initialState = {},
  } = config;

  // Create response object that properly chains
  const responseObj: Context<TState, TRequest, TQuery>['response'] = {
    raw: null as any, // Mock response object
    sent: false,

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
      url: null as any, // URL object would be parsed in real implementation
      query: query as TQuery,
      params,
      protocol: 'http',
      isHttp2: false,
      body: body as TRequest,

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
    state: { ...initialState } as TState,
  };
}
