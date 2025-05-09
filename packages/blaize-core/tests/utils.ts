/**
 * BlaizeJS Test Utilities
 *
 * Common utilities for testing the BlaizeJS framework.
 */

import { Context } from '../src/context';

import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Create a mock request object for testing
 */
export function createMockRequest(overrides: Partial<IncomingMessage> = {}): IncomingMessage {
  return {
    url: '/',
    method: 'GET',
    headers: {},
    ...overrides,
  } as IncomingMessage;
}

/**
 * Create a mock response object for testing
 */
export function createMockResponse(overrides: Partial<ServerResponse> = {}): ServerResponse {
  const res = {
    statusCode: 200,
    getHeader: vi.fn().mockReturnValue(null),
    setHeader: vi.fn(),
    getHeaders: vi.fn().mockReturnValue({}),
    hasHeader: vi.fn().mockReturnValue(false),
    removeHeader: vi.fn(),
    end: vi.fn(),
    write: vi.fn(),
    writeHead: vi.fn(),
    ...overrides,
  } as unknown as ServerResponse;

  return res;
}

/**
 * Create a mock context object for testing
 */
export function createMockContext(
  reqOverrides: Partial<IncomingMessage> = {},
  resOverrides: Partial<ServerResponse> = {}
): Context {
  const req = createMockRequest(reqOverrides);
  const res = createMockResponse(resOverrides);

  // This will throw an error until Context implementation is complete
  try {
    return new Context(req, res);
  } catch {
    // Return a mock context for now
    return {
      request: {
        ...req,
        params: {},
        query: {},
        body: undefined,
        originalUrl: req.url || '/',
        path: (req.url || '/').split('?')[0],
      },
      response: {
        ...res,
        body: undefined,
      },
      state: {},
      sent: false,
      json: vi.fn(),
      text: vi.fn(),
      html: vi.fn(),
      redirect: vi.fn(),
    } as unknown as Context;
  }
}
