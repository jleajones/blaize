// Hoisted regex patterns
const BOUNDARY_REGEX = /boundary=([^;]+)/i;
const CONTENT_DISPOSITION_REGEX =
  /Content-Disposition:\s*form-data;\s*name="([^"]+)"(?:;[\s\r\n]*filename="([^"]*)")?/i;
const CONTENT_TYPE_REGEX = /Content-Type:\s*([^\r\n]+)/i;
const MULTIPART_REGEX = /multipart\/form-data/i;

/**
 * Extract boundary from Content-Type header
 */
export function extractBoundary(contentType: string): string | null {
  const match = contentType.match(BOUNDARY_REGEX);
  if (!match || !match[1]) return null;

  let boundary = match[1].trim();
  if (boundary.startsWith('"') && boundary.endsWith('"')) {
    boundary = boundary.slice(1, -1);
  }

  return boundary || null;
}

/**
 * Parse Content-Disposition header
 */
export function parseContentDisposition(
  headers: string
): { name: string; filename?: string } | null {
  const match = headers.match(CONTENT_DISPOSITION_REGEX);
  if (!match || !match[1]) return null;

  return {
    name: match[1],
    filename: match[2] !== undefined ? match[2] : undefined,
  };
}

/**
 * Parse Content-Type header
 */
export function parseContentType(headers: string): string {
  const match = headers.match(CONTENT_TYPE_REGEX);
  return match && match[1]?.trim() ? match[1].trim() : 'application/octet-stream';
}

/**
 * Check if content type is multipart
 */
export function isMultipartContent(contentType: string): boolean {
  return MULTIPART_REGEX.test(contentType);
}
