import { IncomingMessage, ServerResponse } from 'node:http';
import { Http2ServerRequest, Http2ServerResponse } from 'node:http2';

/**
 * Unified request type supporting both HTTP/1.1 and HTTP/2
 */
export type UnifiedRequest = IncomingMessage | Http2ServerRequest;

/**
 * Unified response type supporting both HTTP/1.1 and HTTP/2
 */
export type UnifiedResponse = ServerResponse | Http2ServerResponse;

/**
 * Request parameters extracted from URL path
 */
export interface RequestParams {
  [key: string]: string;
}

/**
 * Query parameters from URL
 */
export interface QueryParams {
  [key: string]: string | string[] | undefined;
}

/**
 * Options for streaming responses
 */
export interface StreamOptions {
  contentType?: string;
  status?: number;
  headers?: Record<string, string>;
}

/**
 * State container for storing request-scoped data
 * Allows for proper typing with generics
 */
export interface State {
  [key: string]: unknown;
}

export interface ContextResponse<S extends State = State> {
  raw: UnifiedResponse;

  // State
  sent: boolean;

  // Status and headers
  status: (code: number) => Context<S>;
  header: (name: string, value: string) => Context<S>;
  headers: (headers: Record<string, string>) => Context<S>;
  type: (contentType: string) => Context<S>;

  // Response methods
  json: (body: unknown, status?: number) => void;
  text: (body: string, status?: number) => void;
  html: (body: string, status?: number) => void;
  redirect: (url: string, status?: number) => void;
  stream: (readable: NodeJS.ReadableStream, options?: StreamOptions) => void;
}

export interface ContextRequest {
  // Original objects
  raw: UnifiedRequest;

  // Essential properties
  method: string;
  path: string;
  url: URL | null;
  query: QueryParams;
  params: RequestParams;
  protocol: string;
  isHttp2: boolean;

  // Accessors
  header: (name: string) => string | undefined;
  headers: (names?: string[]) => Record<string, string | undefined>;
}

/**
 * Context object representing a request/response cycle
 */
export interface Context<S extends State = State> {
  /**
   * Request information
   */
  request: ContextRequest;

  /**
   * Response handling
   */
  response: ContextResponse;

  /**
   * Request-scoped state for storing data during the request lifecycle
   */
  state: S;
}

/**
 * Options for creating a context
 */
export interface ContextOptions {
  /**
   * Whether to parse the request body
   */
  parseBody?: boolean;

  /**
   * Additional state to merge into the context
   */
  initialState?: State;
}

/**
 * Function to get the current context from AsyncLocalStorage
 */
export type GetContextFn = <S extends State = State>() => Context<S> | undefined;

/**
 * Factory function for creating a new context
 */
export type CreateContextFn = (
  req: UnifiedRequest,
  res: UnifiedResponse,
  options?: ContextOptions
) => Promise<Context>;
