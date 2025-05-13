import { hasContext, getContext } from './store';
import {
  QueryParams,
  Context,
  ContextOptions,
  UnifiedRequest,
  UnifiedResponse,
  RequestParams,
  StreamOptions,
  State,
} from './types';

const CONTENT_TYPE_HEADER = 'Content-Type';

class ResponseSentError extends Error {
  constructor(message: string = 'Response has already been sent') {
    super(message);
    this.name = 'ResponseSentError';
  }
}

class ResponseSentHeaderError extends ResponseSentError {
  constructor(message: string = 'Cannot set header after response has been sent') {
    super(message);
  }
}

class ResponseSentContentError extends ResponseSentError {
  constructor(message: string = 'Cannot set content type after response has been sent') {
    super(message);
  }
}

class ParseUrlError extends ResponseSentError {
  constructor(message: string = 'Invalide URL') {
    super(message);
  }
}

/**
 * Parse URL and extract path and query parameters using modern URL API
 */
function parseRequestUrl(req: UnifiedRequest): {
  path: string;
  url: URL | null;
  query: QueryParams;
} {
  const originalUrl = (req as any).url || '/';

  console.log('Original req:', req);

  // Construct full URL for parsing
  const host = req.headers.host || 'localhost';
  const protocol = req.socket && (req.socket as any).encrypted ? 'https' : 'http';
  const fullUrl = `${protocol}://${host}${originalUrl.startsWith('/') ? '' : '/'}${originalUrl}`;

  console.log('Full Url:', fullUrl);
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
export async function createContext(
  req: UnifiedRequest,
  res: UnifiedResponse,
  options: ContextOptions = {}
): Promise<Context> {
  // Extract basic request information
  const { path, url, query } = parseRequestUrl(req);
  const method = req.method || 'GET';
  const isHttp2 = isHttp2Request(req);
  const protocol = getProtocol(req);

  // Initialize state
  const params: RequestParams = {};
  const state = { ...(options.initialState || {}) };

  // Track response status
  const responseState = { sent: false };

  // Create the context object with its components
  const ctx: Context<typeof state> = {
    request: createRequestObject(req, { path, url, query, params, method, isHttp2, protocol }),
    response: {} as Context['response'],
    state,
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
function createRequestObject(
  req: UnifiedRequest,
  info: {
    path: string;
    url: URL | null;
    query: QueryParams;
    params: RequestParams;
    method: string;
    isHttp2: boolean;
    protocol: string;
  }
): Context['request'] {
  return {
    raw: req,
    ...info,
    header: createRequestHeaderGetter(req),
    headers: createRequestHeadersGetter(req),
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
 * Create the response object portion of the context
 */
function createResponseObject(
  res: UnifiedResponse,
  responseState: { sent: boolean },
  ctx: Context
): Context['response'] {
  return {
    raw: res,

    get sent() {
      return responseState.sent;
    },

    status: createStatusSetter(res, responseState, ctx),
    header: createHeaderSetter(res, responseState, ctx),
    headers: createHeadersSetter(res, responseState, ctx),
    type: createContentTypeSetter(res, responseState, ctx),

    json: createJsonResponder(res, responseState),
    text: createTextResponder(res, responseState),
    html: createHtmlResponder(res, responseState),
    redirect: createRedirectResponder(res, responseState),
    stream: createStreamResponder(res, responseState),
  };
}

/**
 * Create a function to set response status
 */
function createStatusSetter(res: UnifiedResponse, responseState: { sent: boolean }, ctx: Context) {
  return function statusSetter(code: number): Context {
    if (responseState.sent) {
      throw new ResponseSentError();
    }
    res.statusCode = code;
    return ctx;
  };
}

/**
 * Create a function to set a response header
 */
function createHeaderSetter(res: UnifiedResponse, responseState: { sent: boolean }, ctx: Context) {
  return function headerSetter(name: string, value: string) {
    if (responseState.sent) {
      throw new ResponseSentHeaderError();
    }
    res.setHeader(name, value);
    return ctx;
  };
}

/**
 * Create a function to set multiple response headers
 */
function createHeadersSetter(res: UnifiedResponse, responseState: { sent: boolean }, ctx: Context) {
  return function headersSetter(headers: Record<string, string>) {
    if (responseState.sent) {
      throw new ResponseSentHeaderError();
    }
    for (const [name, value] of Object.entries(headers)) {
      res.setHeader(name, value);
    }
    return ctx;
  };
}

/**
 * Create a function to set content type header
 */
function createContentTypeSetter(
  res: UnifiedResponse,
  responseState: { sent: boolean },
  ctx: Context
) {
  return function typeSetter(type: string) {
    if (responseState.sent) {
      throw new ResponseSentContentError();
    }
    res.setHeader(CONTENT_TYPE_HEADER, type);
    return ctx;
  };
}

/**
 * Create a function to send JSON response
 */
function createJsonResponder(res: UnifiedResponse, responseState: { sent: boolean }) {
  return function jsonResponder(body: unknown, status?: number) {
    if (responseState.sent) {
      throw new ResponseSentError();
    }

    if (status !== undefined) {
      res.statusCode = status;
    }

    res.setHeader(CONTENT_TYPE_HEADER, 'application/json');
    res.end(JSON.stringify(body));
    responseState.sent = true;
  };
}

/**
 * Create a function to send text response
 */
function createTextResponder(res: UnifiedResponse, responseState: { sent: boolean }) {
  return function textResponder(body: string, status?: number) {
    if (responseState.sent) {
      throw new ResponseSentError();
    }

    if (status !== undefined) {
      res.statusCode = status;
    }

    res.setHeader(CONTENT_TYPE_HEADER, 'text/plain');
    res.end(body);
    responseState.sent = true;
  };
}

/**
 * Create a function to send HTML response
 */
function createHtmlResponder(res: UnifiedResponse, responseState: { sent: boolean }) {
  return function htmlResponder(body: string, status?: number) {
    if (responseState.sent) {
      throw new ResponseSentError();
    }

    if (status !== undefined) {
      res.statusCode = status;
    }

    res.setHeader(CONTENT_TYPE_HEADER, 'text/html');
    res.end(body);
    responseState.sent = true;
  };
}

/**
 * Create a function to send redirect response
 */
function createRedirectResponder(res: UnifiedResponse, responseState: { sent: boolean }) {
  return function redirectResponder(url: string, status = 302) {
    if (responseState.sent) {
      throw new ResponseSentError();
    }

    res.statusCode = status;
    res.setHeader('Location', url);
    res.end();
    responseState.sent = true;
  };
}

/**
 * Create a function to stream response
 */
function createStreamResponder(res: UnifiedResponse, responseState: { sent: boolean }) {
  return function streamResponder(readable: NodeJS.ReadableStream, options: StreamOptions = {}) {
    if (responseState.sent) {
      throw new ResponseSentError();
    }

    if (options.status !== undefined) {
      res.statusCode = options.status;
    }

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
 */
async function parseBodyIfNeeded(
  _req: UnifiedRequest,
  _ctx: Context,
  _options: ContextOptions
): Promise<void> {
  // Body parsing implementation would go here
  // This is a placeholder for future implementation
}

/**
 * Get the current context or throw an error if none exists
 */
export function getCurrentContext<S extends State = State>(): Context<S> {
  const ctx = getContext<S>();
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
