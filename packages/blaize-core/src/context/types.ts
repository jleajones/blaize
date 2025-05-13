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

/**
 * Context object representing a request/response cycle
 */
export interface Context<S extends State = State> {
  /**
   * Original request object (HTTP/1.1 or HTTP/2)
   */
  request: UnifiedRequest;

  /**
   * Original response object (HTTP/1.1 or HTTP/2)
   */
  response: UnifiedResponse;

  /**
   * Route parameters extracted from URL path
   */
  params: RequestParams;

  /**
   * Query parameters from URL
   */
  query: QueryParams;

  /**
   * Request-scoped state for storing data during the request lifecycle
   */
  state: S;

  /**
   * Request path
   */
  path: string;

  /**
   * HTTP method (GET, POST, etc.)
   */
  method: string;

  /**
   * Whether the request is HTTP/2
   */
  isHttp2: boolean;

  /**
   * Send a JSON response
   */
  json: (body: unknown, status?: number) => void;

  /**
   * Send a plain text response
   */
  text: (body: string, status?: number) => void;

  /**
   * Send an HTML response
   */
  html: (body: string, status?: number) => void;

  /**
   * Send a redirect response
   */
  redirect: (url: string, status?: number) => void;

  /**
   * Send a streaming response
   */
  stream: (readable: NodeJS.ReadableStream, options?: StreamOptions) => void;

  /**
   * Set response status code
   */
  status: (code: number) => Context<S>;

  /**
   * Set a response header
   */
  header: (name: string, value: string) => Context<S>;

  /**
   * Get a request header
   */
  get: (name: string) => string | undefined;
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
