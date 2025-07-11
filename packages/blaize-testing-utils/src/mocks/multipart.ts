import { Readable } from 'node:stream';

import type { UnifiedRequest } from '../../../blaize-types/src/index';

/**
 * Create a multipart form data buffer for testing
 */
export function createMultipartBody(
  parts: Array<{
    name: string;
    content: string;
    filename?: string;
    contentType?: string;
  }>,
  boundary: string
): Buffer {
  const chunks: Buffer[] = [];

  for (const part of parts) {
    chunks.push(Buffer.from(`--${boundary}\r\n`));

    if (part.filename !== undefined) {
      chunks.push(
        Buffer.from(
          `Content-Disposition: form-data; name="${part.name}"; filename="${part.filename}"\r\n`
        )
      );
      chunks.push(
        Buffer.from(`Content-Type: ${part.contentType || 'application/octet-stream'}\r\n`)
      );
    } else {
      chunks.push(Buffer.from(`Content-Disposition: form-data; name="${part.name}"\r\n`));
    }

    chunks.push(Buffer.from('\r\n'));
    chunks.push(Buffer.from(part.content));
    chunks.push(Buffer.from('\r\n'));
  }

  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return Buffer.concat(chunks);
}

/**
 * Create a mock multipart request for testing
 */
export function createMultipartRequest(
  data: Buffer | FormData,
  boundary: string,
  options?: {
    contentLength?: number;
    headers?: Record<string, string>;
  }
): UnifiedRequest {
  const body = Buffer.isBuffer(data) ? data : Buffer.from(''); // Handle FormData conversion if needed

  const readable = Readable.from(body);
  const request = readable as any;

  request.headers = {
    'content-type': `multipart/form-data; boundary=${boundary}`,
    'content-length': (options?.contentLength ?? body.length).toString(),
    ...options?.headers,
  };

  request.method = 'POST';
  request.url = '/test';

  return request;
}

/**
 * Create specific invalid multipart scenarios for testing
 */
export function createInvalidMultipartRequest(
  scenario: 'missing_boundary' | 'corrupted_data' | 'oversized' | 'empty_boundary'
): UnifiedRequest {
  const boundary = '----TestBoundary';

  let body: Buffer;
  let contentType: string;

  switch (scenario) {
    case 'missing_boundary':
      body = Buffer.from('some data without boundaries');
      contentType = 'multipart/form-data'; // No boundary parameter
      break;

    case 'corrupted_data':
      body = Buffer.from('not-multipart-data-at-all');
      contentType = `multipart/form-data; boundary=${boundary}`;
      break;

    case 'oversized':
      body = Buffer.alloc(20 * 1024 * 1024); // 20MB of zeros
      contentType = `multipart/form-data; boundary=${boundary}`;
      break;

    case 'empty_boundary':
      body = Buffer.from(`--${boundary}--\r\n`); // Just end boundary
      contentType = `multipart/form-data; boundary=${boundary}`;
      break;

    default:
      throw new Error(`Unknown scenario: ${scenario}`);
  }

  const readable = Readable.from(body);
  const request = readable as any;

  request.headers = {
    'content-type': contentType,
    'content-length': body.length.toString(),
  };

  request.method = 'POST';
  request.url = '/test';

  return request;
}

/**
 * Create a valid multipart request with mixed content for testing
 */
export function createValidMultipartRequest(options?: {
  fields?: Record<string, string>;
  files?: Array<{ name: string; content: string; filename: string; mimeType?: string }>;
  boundary?: string;
}): { request: UnifiedRequest; boundary: string } {
  const boundary = options?.boundary || '----TestBoundaryValid';
  const parts: Array<{
    name: string;
    content: string;
    filename?: string;
    contentType?: string;
  }> = [];

  // Add fields
  if (options?.fields) {
    for (const [name, content] of Object.entries(options.fields)) {
      parts.push({ name, content });
    }
  }

  // Add files
  if (options?.files) {
    for (const file of options.files) {
      parts.push({
        name: file.name,
        content: file.content,
        filename: file.filename,
        contentType: file.mimeType || 'application/octet-stream',
      });
    }
  }

  const body = createMultipartBody(parts, boundary);
  const request = createMultipartRequest(body, boundary);

  return { request, boundary };
}
