/**
 * SSE Connection Factory
 * Location: packages/blaize-client/src/sse/connection.ts
 *
 * Factory function for creating SSE connections, used by the proxy
 * to establish connections when $sse methods are called.
 */

import { createSSEClient } from './sse-client';

import type { SSEClient, SSEClientOptions } from '@blaize-types/sse-client';

/**
 * Create an SSE connection
 *
 * @internal
 * @param url - The SSE endpoint URL
 * @param options - Connection options
 * @returns Promise that resolves to an SSE client
 */
export async function createSSEConnection<
  TEvents extends Record<string, unknown> = Record<string, unknown>,
>(url: string, options: SSEClientOptions = {}): Promise<SSEClient<TEvents>> {
  return createSSEClient<TEvents>(url, options);
}
