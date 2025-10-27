import {
  ParseUrlError,
  ResponseSentContentError,
  ResponseSentError,
  ResponseSentHeaderError,
} from './errors';
import { hasContext, getContext } from './store';
import { PayloadTooLargeError } from '../errors/payload-too-large-error';
import { UnsupportedMediaTypeError } from '../errors/unsupported-media-type-error';
import { ValidationError } from '../errors/validation-error';
import { getCorrelationHeaderName, getCorrelationId } from '../tracing/correlation';
import { parseMultipartRequest } from '../upload/multipart-parser';
import { isMultipartContent } from '../upload/utils';

import type {
  Context,
  ContextOptions,
  MultipartLimits,
  QueryParams,
  RequestParams,
  State,
  StreamOptions,
  UnifiedRequest,
  UnifiedResponse,
  Services,
} from '@blaize-types/context';

const CONTENT_TYPE_HEADER = 'Content-Type';

/**
 * Parse URL and extract path and query parameters using modern URL API
 */
function parseRequestUrl(req: UnifiedRequest): {
  path: string;
  url: URL | null;
  query: QueryParams;
} {
  const originalUrl = (req as any).url || '/';

  // Construct full URL for parsing
  const host = req.headers.host || 'localhost';
  const protocol = req.socket && (req.socket as any).encrypted ? 'https' : 'http';
  const fullUrl = `${protocol}://${host}${originalUrl.startsWith('/') ? '' : '/'}${originalUrl}`;
  try {
    const url = new URL(fullUrl);

    // Extract path
    const path = url.pathname;

    // Parse query parameters using URLSearchParams
    const query: QueryParams = {};
    url.searchParams.forEach((value, key) => {
      // Handle array parameters (key=value1&key=value2)
      if (query[key] !== undefined) {
        if (Array.isArray(query[key])) {
          (query[key] as string[]).push(value);
        } else {
          query[key] = [query[key] as string, value];
        }
      } else {
        query[key] = value;
      }
    });

    return { path, url, query };
  } catch (error) {
    // Fallback for invalid URLs
    console.warn(`Invalid URL: ${fullUrl}`, error);
    throw new ParseUrlError(`Invalid URL: ${fullUrl}`);
  }
}

/**
 * Determine if the request is using HTTP/2
 */
function isHttp2Request(req: UnifiedRequest): boolean {
  // Check for HTTP/2 specific properties
  return 'stream' in req || ('httpVersionMajor' in req && (req as any).httpVersionMajor === 2);
}

/**
 * Get the HTTP protocol (http or https)
 */
function getProtocol(req: UnifiedRequest): string {
  // Check for encrypted socket
  const encrypted = req.socket && (req.socket as any).encrypted;
  // Check for X-Forwarded-Proto header (common in proxy environments)
  const forwardedProto = req.headers['x-forwarded-proto'];

  if (forwardedProto) {
    if (Array.isArray(forwardedProto)) {
      // Handle array of header values (uncommon but possible)
      return forwardedProto[0]?.split(',')[0]?.trim() || 'http';
    } else {
      // Handle string header value (typical case)
      return forwardedProto.split(',')[0]?.trim() || 'http';
    }
  }

  // Default protocol based on socket encryption
  return encrypted ? 'https' : 'http';
}

/**
 * Create a new context object for a request/response cycle
 */
export async function createContext<
  S extends State = State,
  Svc extends Services = Services,
  TBody = unknown,
  TQuery = QueryParams,
>(
  req: UnifiedRequest,
  res: UnifiedResponse,
  options: ContextOptions
): Promise<Context<S, Svc, TBody, TQuery>> {
  // Extract basic request information
  const { path, url, query } = parseRequestUrl(req);
  const method = req.method || 'GET';
  const isHttp2 = isHttp2Request(req);
  const protocol = getProtocol(req);

  // Initialize state
  const params: RequestParams = {};
  const state = { ...(options.initialState || {}) } as S;
  const services = { ...(options.initialServices || {}) } as Svc;

  // Track response status
  const responseState = { sent: false };

  // Create the context object with its components
  const ctx: Context<S, Svc, TBody, TQuery> = {
    request: createRequestObject<TBody, TQuery>(req, {
      path,
      url,
      query: query as TQuery,
      params,
      method,
      isHttp2,
      protocol,
    }),
    response: {} as Context<S, Svc, TBody, TQuery>['response'],
    state,
    services,
  };

  ctx.response = createResponseObject(res, responseState, ctx);

  // Parse body if requested
  if (options.parseBody) {
    await parseBodyIfNeeded(req, ctx, options);
  }

  return ctx;
}

/**
 * Create the request object portion of the context
 */
function createRequestObject<TBody = unknown, TQuery = QueryParams>(
  req: UnifiedRequest,
  info: {
    path: string;
    url: URL | null;
    query: TQuery;
    params: RequestParams;
    method: string;
    isHttp2: boolean;
    protocol: string;
  }
): Context<State, Services, TBody, TQuery>['request'] {
  return {
    raw: req,
    ...info,
    header: createRequestHeaderGetter(req),
    headers: createRequestHeadersGetter(req),
    body: undefined as unknown as TBody,
  };
}

/**
 * Create a function to get a single request header
 */
function createRequestHeaderGetter(req: UnifiedRequest) {
  return (name: string): string | undefined => {
    const value = req.headers[name.toLowerCase()];
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    return value || undefined;
  };
}

/**
 * Create a function to get multiple request headers
 */
function createRequestHeadersGetter(req: UnifiedRequest) {
  const headerGetter = createRequestHeaderGetter(req);

  return (names?: string[]): Record<string, string | undefined> => {
    if (names && Array.isArray(names) && names.length > 0) {
      return names.reduce<Record<string, string | undefined>>((acc, name) => {
        acc[name] = headerGetter(name);
        return acc;
      }, {});
    } else {
      return Object.entries(req.headers).reduce<Record<string, string | undefined>>(
        (acc, [key, value]) => {
          acc[key] = Array.isArray(value) ? value.join(', ') : value || undefined;
          return acc;
        },
        {}
      );
    }
  };
}

/**
 * Helper to add correlation header if available in state
 * Works for both HTTP/1.1 and HTTP/2 by using the context's setHeader abstraction
 */
function addCorrelationHeader(res: UnifiedResponse, state: State): void {
  // Only add if correlation ID exists in state
  if (state.correlationId) {
    const headerName = getCorrelationHeaderName();
    const correlationValue = String(state.correlationId);
    res.setHeader(headerName, correlationValue);
  }
}

/**
 * Create the response object portion of the context
 */
function createResponseObject<
  S extends State = State,
  Svc extends Services = Services,
  TBody = unknown,
  TQuery = QueryParams,
>(
  res: UnifiedResponse,
  responseState: { sent: boolean },
  ctx: Context<S, Svc, TBody, TQuery>
): Context<S, Svc, TBody, TQuery>['response'] {
  return {
    raw: res,

    // TODO: this does not work well and should be enhanced
    get statusCode() {
      return res.statusCode || 200;
    },

    get sent() {
      return responseState.sent;
    },

    status: createStatusSetter(res, responseState, ctx),
    header: createHeaderSetter(res, responseState, ctx),
    headers: createHeadersSetter(res, responseState, ctx),
    type: createContentTypeSetter(res, responseState, ctx),

    json: createJsonResponder(res, responseState, ctx.state),
    text: createTextResponder(res, responseState, ctx.state),
    html: createHtmlResponder(res, responseState, ctx.state),
    redirect: createRedirectResponder(res, responseState, ctx.state),
    stream: createStreamResponder(res, responseState, ctx.state),
  };
}

/**
 * Create a function to set response status
 */
function createStatusSetter<
  S extends State = State,
  Svc extends Services = Services,
  TBody = unknown,
  TQuery = QueryParams,
>(res: UnifiedResponse, responseState: { sent: boolean }, ctx: Context<S, Svc, TBody, TQuery>) {
  return function statusSetter(code: number): Context['response'] {
    if (responseState.sent) {
      throw new ResponseSentError();
    }
    res.statusCode = code;
    return ctx.response;
  };
}

/**
 * Create a function to set a response header
 */
function createHeaderSetter<
  S extends State = State,
  Svc extends Services = Services,
  TBody = unknown,
  TQuery = QueryParams,
>(res: UnifiedResponse, responseState: { sent: boolean }, ctx: Context<S, Svc, TBody, TQuery>) {
  return function headerSetter(name: string, value: string) {
    if (responseState.sent) {
      throw new ResponseSentHeaderError();
    }
    res.setHeader(name, value);
    return ctx.response;
  };
}

/**
 * Create a function to set multiple response headers
 */
function createHeadersSetter<
  S extends State = State,
  Svc extends Services = Services,
  TBody = unknown,
  TQuery = QueryParams,
>(res: UnifiedResponse, responseState: { sent: boolean }, ctx: Context<S, Svc, TBody, TQuery>) {
  return function headersSetter(headers: Record<string, string>) {
    if (responseState.sent) {
      throw new ResponseSentHeaderError();
    }
    for (const [name, value] of Object.entries(headers)) {
      res.setHeader(name, value);
    }
    return ctx.response;
  };
}

/**
 * Create a function to set content type header
 */
function createContentTypeSetter<
  S extends State = State,
  Svc extends Services = Services,
  TBody = unknown,
  TQuery = QueryParams,
>(res: UnifiedResponse, responseState: { sent: boolean }, ctx: Context<S, Svc, TBody, TQuery>) {
  return function typeSetter(type: string) {
    if (responseState.sent) {
      throw new ResponseSentContentError();
    }
    res.setHeader(CONTENT_TYPE_HEADER, type);
    return ctx.response;
  };
}

/**
 * Create a function to send JSON response
 */
function createJsonResponder(res: UnifiedResponse, responseState: { sent: boolean }, state: State) {
  return function jsonResponder(body: unknown, status?: number) {
    if (responseState.sent) {
      throw new ResponseSentError();
    }

    if (status !== undefined) {
      res.statusCode = status;
    }

    addCorrelationHeader(res, state);
    res.setHeader(CONTENT_TYPE_HEADER, 'application/json');
    res.end(JSON.stringify(body));
    responseState.sent = true;
  };
}

/**
 * Create a function to send text response
 */
function createTextResponder(res: UnifiedResponse, responseState: { sent: boolean }, state: State) {
  return function textResponder(body: string, status?: number) {
    if (responseState.sent) {
      throw new ResponseSentError();
    }

    if (status !== undefined) {
      res.statusCode = status;
    }

    addCorrelationHeader(res, state);
    res.setHeader(CONTENT_TYPE_HEADER, 'text/plain');
    res.end(body);
    responseState.sent = true;
  };
}

/**
 * Create a function to send HTML response
 */
function createHtmlResponder(res: UnifiedResponse, responseState: { sent: boolean }, state: State) {
  return function htmlResponder(body: string, status?: number) {
    if (responseState.sent) {
      throw new ResponseSentError();
    }

    if (status !== undefined) {
      res.statusCode = status;
    }

    addCorrelationHeader(res, state);
    res.setHeader(CONTENT_TYPE_HEADER, 'text/html');
    res.end(body);
    responseState.sent = true;
  };
}

/**
 * Create a function to send redirect response
 */
function createRedirectResponder(
  res: UnifiedResponse,
  responseState: { sent: boolean },
  state: State
) {
  return function redirectResponder(url: string, status = 302) {
    if (responseState.sent) {
      throw new ResponseSentError();
    }

    addCorrelationHeader(res, state);
    res.statusCode = status;
    res.setHeader('Location', url);
    res.end();
    responseState.sent = true;
  };
}

/**
 * Create a function to stream response
 */
function createStreamResponder(
  res: UnifiedResponse,
  responseState: { sent: boolean },
  state: State
) {
  return function streamResponder(readable: NodeJS.ReadableStream, options: StreamOptions = {}) {
    if (responseState.sent) {
      throw new ResponseSentError();
    }

    if (options.status !== undefined) {
      res.statusCode = options.status;
    }

    addCorrelationHeader(res, state);
    if (options.contentType) {
      res.setHeader(CONTENT_TYPE_HEADER, options.contentType);
    }

    if (options.headers) {
      for (const [name, value] of Object.entries(options.headers)) {
        res.setHeader(name, value);
      }
    }

    // Handle streaming
    readable.pipe(res);

    // Mark as sent when the stream ends
    readable.on('end', () => {
      responseState.sent = true;
    });

    // Handle errors
    readable.on('error', err => {
      console.error('Stream error:', err);
      if (!responseState.sent) {
        res.statusCode = 500;
        res.end('Stream error');
        responseState.sent = true;
      }
    });
  };
}

/**
 * Parse request body if enabled in options
 *
 * Throws appropriate errors on parsing failures:
 * - ValidationError (400) for malformed data
 * - PayloadTooLargeError (413) for size limit violations
 * - UnsupportedMediaTypeError (415) for unsupported content types
 */
async function parseBodyIfNeeded<TBody = unknown, TQuery = QueryParams>(
  req: UnifiedRequest,
  ctx: Context<State, Services, TBody, TQuery>,
  options: ContextOptions
): Promise<void> {
  // Skip parsing for methods that typically don't have bodies
  if (shouldSkipParsing(req.method)) {
    return;
  }

  const contentType = req.headers['content-type'] || '';
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);

  // Skip if no content
  if (contentLength === 0) {
    return;
  }

  const limits = options.bodyLimits;

  // ✅ Check size limits BEFORE parsing and throw immediately
  if (contentType.includes('application/json')) {
    if (contentLength > limits.json) {
      throw new PayloadTooLargeError(
        'JSON body exceeds size limit',
        {
          currentSize: contentLength,
          maxSize: limits.json,
          contentType: 'application/json',
        },
        getCorrelationId()
      );
    }
    await parseJsonBody(req, ctx); // Throws ValidationError on malformed JSON
  } else if (contentType.includes('application/x-www-form-urlencoded')) {
    if (contentLength > limits.form) {
      throw new PayloadTooLargeError(
        'Form body exceeds size limit',
        {
          currentSize: contentLength,
          maxSize: limits.form,
          contentType: 'application/x-www-form-urlencoded',
        },
        getCorrelationId()
      );
    }
    await parseFormUrlEncodedBody(req, ctx); // Throws ValidationError on malformed form
  } else if (contentType.includes('text/')) {
    if (contentLength > limits.text) {
      throw new PayloadTooLargeError(
        'Text body exceeds size limit',
        {
          currentSize: contentLength,
          maxSize: limits.text,
          contentType,
        },
        getCorrelationId()
      );
    }
    await parseTextBody(req, ctx);
  } else if (isMultipartContent(contentType)) {
    // Multipart has its own size validation in parseMultipartRequest
    // Throws PayloadTooLargeError or UnsupportedMediaTypeError
    await parseMultipartBody(req, ctx, limits.multipart);
  } else {
    // Unknown content type - apply raw limit
    if (contentLength > limits.raw) {
      throw new PayloadTooLargeError(
        'Request body exceeds size limit',
        {
          currentSize: contentLength,
          maxSize: limits.raw,
          contentType: contentType || 'unknown',
        },
        getCorrelationId()
      );
    }
    // Don't parse unknown content types, but allow them through
    return;
  }

  // ✅ No try/catch - let errors bubble up to error boundary
}

/**
 * Determine if body parsing should be skipped based on HTTP method
 */
function shouldSkipParsing(method?: string): boolean {
  const skipMethods = ['GET', 'HEAD', 'OPTIONS'];
  return skipMethods.includes(method || 'GET');
}

/**
 * Parse JSON request body
 */
async function parseJsonBody<TBody = unknown, TQuery = QueryParams>(
  req: UnifiedRequest,
  ctx: Context<State, Services, TBody, TQuery>
): Promise<void> {
  const body = await readRequestBody(req);

  if (!body) {
    console.warn('Empty body, skipping JSON parsing');
    return;
  }

  // Check if the body is actually "null" string
  if (body.trim() === 'null') {
    console.warn('Body is the string "null"');
    ctx.request.body = null as TBody;
    return;
  }

  try {
    const json = JSON.parse(body);
    ctx.request.body = json as TBody;
  } catch (error) {
    throw new ValidationError(
      'Invalid JSON in request body',
      {
        fields: [
          {
            field: 'body',
            messages: [
              'Request body contains malformed JSON',
              error instanceof Error ? error.message : 'JSON parse failed',
            ],
          },
        ],
        errorCount: 1,
        section: 'body',
      },
      getCorrelationId()
    );
  }
}

/**
 * Parse URL-encoded form data
 */
async function parseFormUrlEncodedBody<TBody = unknown, TQuery = QueryParams>(
  req: UnifiedRequest,
  ctx: Context<State, Services, TBody, TQuery>
): Promise<void> {
  const body = await readRequestBody(req);
  if (!body) return;

  try {
    ctx.request.body = parseUrlEncodedData(body) as TBody;
  } catch (error) {
    throw new ValidationError(
      'Request body contains malformed form data',
      {
        fields: [
          {
            field: 'body',
            messages: [
              'Invalid URL-encoded form data',
              error instanceof Error ? error.message : 'Form parse failed',
            ],
          },
        ],
        errorCount: 1,
        section: 'body',
      },
      getCorrelationId()
    );
  }
}

/**
 * Parse URL-encoded data into an object
 */
function parseUrlEncodedData(body: string): Record<string, string | string[]> {
  const params = new URLSearchParams(body);
  const formData: Record<string, string | string[]> = {};

  params.forEach((value, key) => {
    if (formData[key] !== undefined) {
      if (Array.isArray(formData[key])) {
        (formData[key] as string[]).push(value);
      } else {
        formData[key] = [formData[key] as string, value];
      }
    } else {
      formData[key] = value;
    }
  });

  return formData;
}

/**
 * Parse plain text body
 */
async function parseTextBody<TBody = null, TQuery = QueryParams>(
  req: UnifiedRequest,
  ctx: Context<State, Services, TBody, TQuery>
): Promise<void> {
  const body = await readRequestBody(req);
  if (body) {
    ctx.request.body = body as TBody;
  }
}

/**
 * Parse multipart/form-data request body with improved error handling
 */
async function parseMultipartBody<TBody = unknown, TQuery = QueryParams>(
  req: UnifiedRequest,
  ctx: Context<State, Services, TBody, TQuery>,
  multipartLimits: MultipartLimits
): Promise<void> {
  try {
    const limits = multipartLimits;
    const multipartData = await parseMultipartRequest(req, {
      strategy: 'stream',
      maxFileSize: limits.maxFileSize,
      maxFiles: limits.maxFiles,
      maxFieldSize: limits.maxFieldSize,
      // Could add total size validation here
    });

    // Extend context with multipart data (type-safe assignments)
    (ctx.request as any).multipart = multipartData;
    (ctx.request as any).files = multipartData.files;

    // Set body to fields for backward compatibility with existing form handling
    ctx.request.body = multipartData.fields as TBody;
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      throw error; // Already correct type
    }
    if (error instanceof UnsupportedMediaTypeError) {
      throw error; // Already correct type
    }
    // Generic multipart errors
    throw new UnsupportedMediaTypeError(
      'Failed to parse multipart/form-data',
      {
        receivedContentType: req.headers['content-type'],
        expectedFormat: 'multipart/form-data; boundary=...',
      },
      getCorrelationId()
    );
  }
}

/**
 * Read the entire request body as a string
 */
async function readRequestBody(req: UnifiedRequest): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];

    req.on('data', (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });

    req.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf8'));
    });

    req.on('error', err => {
      reject(err);
    });
  });
}

/**
 * Get the current context or throw an error if none exists
 */
export function getCurrentContext<
  S extends State = State,
  Svc extends Services = Services,
  TBody = unknown,
  TQuery = QueryParams,
>(): Context<S, Svc, TBody, TQuery> {
  const ctx = getContext<S, Svc, TBody, TQuery>();
  if (!ctx) {
    throw new Error(
      'No context found. Ensure this function is called within a request handler, ' +
        'middleware, or function wrapped with runWithContext().'
    );
  }
  return ctx;
}

/**
 * Check if we're currently in a request context
 */
export function isInRequestContext(): boolean {
  return hasContext();
}
