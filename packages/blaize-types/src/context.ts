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

export interface ContextResponse<S extends State = State> {
  raw: UnifiedResponse;

  // State
  sent: boolean;

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
 */
export interface Context<S extends State = State, TBody = unknown, TQuery = QueryParams> {
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
   * Additional state to merge into the context
   */
  initialState?: State;
  /**
   * Limits for various body types to prevent abuse
   */
  bodyLimits?: {
    json?: number; // Default: 512KB (large JSON usually indicates design issues)
    form?: number; // Default: 1MB (reasonable for form data)
    text?: number; // Default: 5MB (documents, logs, code)
    multipart?: MultipartLimits;
    raw?: number; // Default: 10MB (for custom content types)
  };
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

/**
 * Type representing unknown function
 *
 * This is a generic function type that can accept any number of arguments
 * and return any type of value. It is used for type inference in various
 * contexts where the specific function signature is not known or not
 * important.
 */
export type UnknownFunction = (...args: unknown[]) => unknown;
