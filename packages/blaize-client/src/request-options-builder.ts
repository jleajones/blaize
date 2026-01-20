/**
 * Request Options Builder for BlaizeJS Client
 *
 * Task [T2.3]: Update buildRequestOptions with Auto-Detection
 *
 * Automatically detects files and switches between multipart/form-data
 * and application/json based on request content.
 *
 * @packageDocumentation
 */

import { containsFileObjects } from './file-detection';
import { buildFormData } from './form-data-builder';

import type { ClientConfig, InternalRequestArgs, RequestOptions } from '@blaize-types/client';

/**
 * Build request options for HTTP client
 *
 * Automatically detects file uploads and switches encoding:
 * - **Files detected** → multipart/form-data (Content-Type omitted for browser boundary)
 * - **No files** → application/json
 *
 * **File Detection:**
 * - Checks `args.files` property (preferred)
 * - Checks `args.body` property (legacy support)
 * - Uses deep detection (2 levels) via `containsFileObjects()`
 *
 * **Headers:**
 * - Correlation ID added via `x-correlation-id` header
 * - Default headers from config merged
 * - Content-Type set for JSON, omitted for multipart
 *
 * **Methods Without Body:**
 * - GET, HEAD, DELETE, OPTIONS → body is undefined
 *
 * @param config - Client configuration with base URL, headers, timeout
 * @param method - HTTP method (GET, POST, PUT, DELETE, etc.)
 * @param args - Request arguments (params, query, body, files)
 * @param correlationId - Optional correlation ID for tracing
 * @returns Request options ready for fetch/HTTP client
 *
 * @example File upload (multipart/form-data)
 * ```typescript
 * const options = buildRequestOptions(
 *   config,
 *   'POST',
 *   {
 *     params: { userId: '123' },
 *     files: { avatar: fileObject }
 *   },
 *   'corr-abc123'
 * );
 * // Returns:
 * // {
 * //   method: 'POST',
 * //   url: 'https://api.com/users/123',
 * //   headers: { 'x-correlation-id': 'corr-abc123' },
 * //   body: FormData,
 * //   timeout: 30000
 * // }
 * // Note: No Content-Type header (browser adds boundary)
 * ```
 *
 * @example JSON request
 * ```typescript
 * const options = buildRequestOptions(
 *   config,
 *   'POST',
 *   {
 *     body: { name: 'John', email: 'john@example.com' }
 *   },
 *   'corr-xyz789'
 * );
 * // Returns:
 * // {
 * //   method: 'POST',
 * //   url: 'https://api.com/endpoint',
 * //   headers: {
 * //     'Content-Type': 'application/json',
 * //     'x-correlation-id': 'corr-xyz789'
 * //   },
 * //   body: '{"name":"John","email":"john@example.com"}',
 * //   timeout: 30000
 * // }
 * ```
 *
 * @example GET request (no body)
 * ```typescript
 * const options = buildRequestOptions(
 *   config,
 *   'GET',
 *   {
 *     params: { userId: '123' },
 *     query: { include: 'posts' }
 *   },
 *   'corr-get123'
 * );
 * // Returns:
 * // {
 * //   method: 'GET',
 * //   url: 'https://api.com/users/123?include=posts',
 * //   headers: { 'x-correlation-id': 'corr-get123' },
 * //   body: undefined,
 * //   timeout: 30000
 * // }
 * ```
 *
 * @example Mixed request (body + files)
 * ```typescript
 * const options = buildRequestOptions(
 *   config,
 *   'POST',
 *   {
 *     body: { title: 'Report', category: 'finance' },
 *     files: { document: pdfFile }
 *   }
 * );
 * // Body and files merged into FormData
 * // Content-Type omitted (browser adds boundary)
 * ```
 */
export function buildRequestOptions(
  config: ClientConfig,
  method: string,
  args: InternalRequestArgs = {},
  correlationId?: string
): RequestOptions {
  // Start with default headers from config
  const headers: Record<string, string> = {
    ...config.defaultHeaders,
  };

  // Add correlation ID if provided
  if (correlationId) {
    headers['x-correlation-id'] = correlationId;
  }

  // Methods that should not have request bodies
  const methodsWithoutBody = ['GET', 'HEAD', 'DELETE', 'OPTIONS'];
  const upperMethod = method.toUpperCase();

  let body: FormData | string | undefined;

  // Check for files in methods that shouldn't have bodies (warn in dev mode)
  if (methodsWithoutBody.includes(upperMethod)) {
    // Warn if user tried to send files in a method that doesn't support bodies
    const hasFiles =
      (args.files && containsFileObjects(args.files)) ||
      (args.body && containsFileObjects(args.body));

    if (hasFiles) {
      if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
        warnFileInInvalidMethod(upperMethod);
      }
    }

    body = undefined;
  } else {
    // Methods that support request bodies (POST, PUT, PATCH)
    // Check for files in either args.files or args.body (legacy)
    const hasFilesInFilesProperty = args.files && containsFileObjects(args.files);
    const hasFilesInBodyProperty = args.body && containsFileObjects(args.body);
    const hasFiles = hasFilesInFilesProperty || hasFilesInBodyProperty;

    if (hasFiles) {
      // Build FormData for multipart upload
      body = buildFormData(args);

      // CRITICAL: Do NOT set Content-Type header
      // The browser will automatically add:
      // Content-Type: multipart/form-data; boundary=----WebKitFormBoundary...
      //
      // If we set Content-Type manually, we'd need to generate the boundary,
      // which is complex and browser-dependent. Let the browser handle it.
    } else if (args.body !== undefined) {
      // JSON encoding for non-file requests
      body = JSON.stringify(args.body);
      headers['Content-Type'] = 'application/json';
    }
  }

  return {
    method: upperMethod,
    url: '', // Will be set by caller (needs route path)
    headers,
    body,
    timeout: config.timeout || 30000, // Default 30 seconds
  };
}

/**
 * Log development warning when files are detected in GET/DELETE/HEAD requests
 *
 * These methods should not have request bodies according to HTTP specifications,
 * so files in these requests are likely a developer mistake.
 *
 * This warning only appears in development mode (NODE_ENV !== 'production').
 *
 * @param method - HTTP method (GET, POST, PUT, DELETE, etc.)
 *
 * @internal
 */
function warnFileInInvalidMethod(method: string): void {
  // Only warn in development
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') {
    return;
  }

  const upperMethod = method.toUpperCase();

  // Methods that should not have bodies
  const invalidMethods = ['GET', 'DELETE', 'HEAD', 'OPTIONS'];

  if (invalidMethods.includes(upperMethod)) {
    console.warn(
      `[BlaizeJS Client] Warning: File objects detected in ${upperMethod} request. ` +
        `${upperMethod} requests should not have request bodies. ` +
        `Files should be sent via POST, PUT, or PATCH instead.`
    );
  }
}
