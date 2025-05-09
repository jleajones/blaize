/**
 * BlaizeJS Context Module
 *
 * Provides the request context system used throughout the framework.
 */

import { AsyncLocalStorage } from 'node:async_hooks';

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Http2ServerRequest, Http2ServerResponse } from 'node:http2';

/**
 * Base request type
 */
type BaseRequest = IncomingMessage | Http2ServerRequest;

/**
 * Base response type
 */
type BaseResponse = ServerResponse | Http2ServerResponse;

/**
 * Extended request interface
 */
export interface Request {
  /** Original request object */
  raw: BaseRequest;

  /** Request method */
  method: string;

  /** Request URL */
  url: string;

  /** Request headers */
  headers: Record<string, string | string[] | undefined>;

  /** Request path parameters */
  params: Record<string, string>;

  /** Parsed query parameters */
  query: Record<string, string | string[]>;

  /** Parsed body (if applicable) */
  body: any;

  /** Original URL */
  originalUrl: string;

  /** Path without query parameters */
  path: string;

  /** HTTP version */
  httpVersion: string;

  /** Is HTTP/2 request */
  isHttp2: boolean;
}

/**
 * Extended response interface
 */
export interface Response {
  /** Original response object */
  raw: BaseResponse;

  /** Response status code */
  statusCode: number;

  /** Response headers */
  headers: Record<string, string | string[] | undefined>;

  /** Response body that will be sent */
  body: any;

  /** Set a response header */
  setHeader(name: string, value: string | string[]): void;

  /** Get a response header */
  getHeader(name: string): string | string[] | undefined;

  /** Remove a response header */
  removeHeader(name: string): void;

  /** Write to the response */
  write(chunk: any): boolean;

  /** End the response */
  end(data?: any): void;
}

/**
 * Request context object
 */
export class Context {
  /** The incoming request */
  request: Request;

  /** The outgoing response */
  response: Response;

  /** State storage for request-scoped data */
  state: Record<string, any> = {};

  /** Used to track if the response has been sent */
  sent = false;

  /** Storage for the current context */
  private static storage?: AsyncLocalStorage<Context>;

  /**
   * Create a new context object
   */
  constructor(
    _req: IncomingMessage | Http2ServerRequest,
    _res: ServerResponse | Http2ServerResponse
  ) {
    // Implementation placeholder
    throw new Error('Context implementation not yet available');
  }

  /**
   * Get the current context from AsyncLocalStorage
   */
  static current(): Context | undefined {
    if (!Context.storage) {
      return undefined;
    }
    return Context.storage.getStore();
  }

  /**
   * Set the storage provider for contexts
   */
  static setStorage(storage: AsyncLocalStorage<Context>): void {
    Context.storage = storage;
  }

  /**
   * Send a JSON response
   */
  json(_data: any, _status = 200): void {
    // Implementation placeholder
  }

  /**
   * Send a text response
   */
  text(_data: string, _status = 200): void {
    // Implementation placeholder
  }

  /**
   * Send an HTML response
   */
  html(_data: string, _status = 200): void {
    // Implementation placeholder
  }

  /**
   * Redirect to another URL
   */
  redirect(_url: string, _status = 302): void {
    // Implementation placeholder
  }
}
