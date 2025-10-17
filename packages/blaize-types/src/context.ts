import { IncomingMessage, ServerResponse } from 'node:http';
import { Http2ServerRequest, Http2ServerResponse } from 'node:http2';

import type { BodyParseError } from './errors';
import type { MultipartData, UploadedFile } from './upload';

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
  /**
   * Body parsing error information
   * Set when body parsing fails during request processing
   */
  _bodyError?: BodyParseError;
}

/**
 * Services container for storing injectable services/dependencies
 * Allows middleware to contribute services that are accessible throughout the request lifecycle
 */
export interface Services {
  [key: string]: unknown;
}

export interface ContextResponse<S extends State = State> {
  raw: UnifiedResponse;

  // State
  sent: boolean;
  statusCode: number;

  // Status and headers
  status: (code: number) => ContextResponse<S>;
  header: (name: string, value: string) => ContextResponse<S>;
  headers: (headers: Record<string, string>) => ContextResponse<S>;
  type: (contentType: string) => ContextResponse<S>;

  // Response methods
  json: (body: unknown, status?: number) => void;
  text: (body: string, status?: number) => void;
  html: (body: string, status?: number) => void;
  redirect: (url: string, status?: number) => void;
  stream: (readable: NodeJS.ReadableStream, options?: StreamOptions) => void;
}

export interface ContextRequest<TBody = unknown> {
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
  body?: TBody;

  /**
   * Uploaded files from multipart/form-data requests
   * Available when Content-Type is multipart/form-data
   */
  files?: Record<string, UploadedFile | UploadedFile[]>;

  /**
   * Complete multipart data (files + fields)
   * Available when Content-Type is multipart/form-data
   */
  multipart?: MultipartData;

  // Accessors
  header: (name: string) => string | undefined;
  headers: (names?: string[]) => Record<string, string | undefined>;
}

/**
 * Context object representing a request/response cycle
 * @template S - Type of the state object
 * @template Svc - Type of the services object
 * @template TBody - Type of the request body
 * @template TQuery - Type of the query parameters
 */
export interface Context<
  S extends State = State,
  Svc extends Services = Services,
  TBody = unknown,
  TQuery = QueryParams,
> {
  /**
   * Request information
   */
  request: Omit<ContextRequest, 'body' | 'query'> & {
    body: TBody;
    query: TQuery;
  };

  /**
   * Response handling
   */
  response: ContextResponse<S>;

  /**
   * Request-scoped state for storing data during the request lifecycle
   */
  state: S;

  /**
   * Services container for accessing injected services/dependencies
   * Populated by middleware that contribute services
   */
  services: Svc;
}

export interface BodyLimits {
  /** Maximum JSON body size in bytes (default: 512KB) */
  json: number;

  /** Maximum form data size in bytes (default: 1MB) */
  form: number;

  /** Maximum text body size in bytes (default: 5MB) */
  text: number;

  /** Maximum raw/binary body size in bytes (default: 10MB) */
  raw: number;

  /** Multipart/form-data limits */
  multipart: MultipartLimits;
}

// Define the multipart limits type properly
export type MultipartLimits = {
  maxFileSize?: number;
  maxTotalSize?: number;
  maxFiles?: number;
  maxFieldSize?: number;
};

/**
 * Options for creating a context
 */
export interface ContextOptions {
  /**
   * Whether to parse the request body
   */
  parseBody?: boolean;

  /**
   * Initial state to include in the context
   *
   */
  initialState?: State;

  /**
   * Initial services to include in the context
   *
   */
  initialServices?: Services;

  /**
   * Limits for various body types to prevent abuse
   */
  bodyLimits?: BodyLimits;
}

/**
 * Function to get the current context from AsyncLocalStorage
 */
export type GetContextFn = <S extends State = State, Svc extends Services = Services>() =>
  | Context<S, Svc>
  | undefined;

/**
 * Factory function for creating a new context
 */
export type CreateContextFn = (
  req: UnifiedRequest,
  res: UnifiedResponse,
  options?: ContextOptions
) => Promise<Context>;

/**
 * Type representing unknown function
 *
 * This is a generic function type that can accept any number of arguments
 * and return any type of value. It is used for type inference in various
 * contexts where the specific function signature is not known or not
 * important.
 */
export type UnknownFunction = (...args: unknown[]) => unknown;
