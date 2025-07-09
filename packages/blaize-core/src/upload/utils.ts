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

/**
 * Validate file against constraints
 */
export function validateFileConstraints(
  file: { size: number; mimetype: string; filename?: string },
  options: {
    maxFileSize?: number;
    allowedMimeTypes?: readonly string[];
    allowedExtensions?: readonly string[];
  }
): { valid: boolean; error?: string } {
  const { size, mimetype, filename } = file;

  if (options.maxFileSize && size > options.maxFileSize) {
    return {
      valid: false,
      error: `File size ${size} exceeds maximum ${options.maxFileSize} bytes`,
    };
  }

  if (options.allowedMimeTypes?.length) {
    const mimeSet = new Set(options.allowedMimeTypes);
    if (!isAllowedMimeType(mimetype, [...mimeSet])) {
      return {
        valid: false,
        error: `MIME type ${mimetype} not allowed`,
      };
    }
  }

  if (options.allowedExtensions?.length) {
    const ext = getFileExtension(filename);
    const extSet = new Set(options.allowedExtensions.map(e => e.toLowerCase()));
    if (!ext || !extSet.has(ext)) {
      return {
        valid: false,
        error: `File extension .${ext ?? 'unknown'} not allowed`,
      };
    }
  }

  return { valid: true };
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename?: string): string | null {
  if (!filename) return null;
  const dotIndex = filename.lastIndexOf('.');
  if (dotIndex <= 0 || dotIndex === filename.length - 1) return null;
  return filename.slice(dotIndex + 1).toLowerCase();
}

/**
 * Sanitize filename
 */
export function sanitizeFilename(filename?: string): string {
  if (!filename) return 'unnamed_file';

  // Replace disallowed characters with _
  let clean = Array.from(filename)
    .map(c => {
      const code = c.charCodeAt(0);
      return code < 32 || `<>:"/\\|?*`.includes(c) ? '_' : c;
    })
    .join('');

  // Replace spaces and collapse multiple underscores
  clean = clean.replace(/\s+/g, '_').replace(/_+/g, '_');

  // Preserve file extension
  const dotIndex = clean.lastIndexOf('.');
  let name = dotIndex > 0 ? clean.slice(0, dotIndex) : clean;
  const ext = dotIndex > 0 ? clean.slice(dotIndex) : '';

  // Remove leading/trailing underscores from the base name
  name = name.replace(/^_+|_+$/g, '');

  // Truncate if too long
  let result = name + ext;
  if (result.length > 255) {
    const maxBaseLength = 255 - ext.length;
    result = name.slice(0, maxBaseLength) + ext;
  }

  return result || 'unnamed_file';
}

/**
 * Format file size to readable string
 */
export function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`;
  const kb = size / 1024;
  if (kb < 1024) return `${Math.round(kb * 10) / 10} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${Math.round(mb * 10) / 10} MB`;
  const gb = mb / 1024;
  return `${Math.round(gb * 10) / 10} GB`;
}

/**
 * Check if MIME type matches pattern (with wildcards)
 */
export function matchesMimeType(mime: string, pattern: string): boolean {
  if (pattern === '*/*') return true;

  const [type, subtype] = mime.split('/');
  const [pType, pSubtype] = pattern.split('/');

  return (pType === '*' || pType === type) && (pSubtype === '*' || pSubtype === subtype);
}

/**
 * Check if MIME type is allowed based on pattern list
 */
export function isAllowedMimeType(mime: string, allowed: string[]): boolean {
  if (!allowed.length) return true;
  return allowed.some(pattern => matchesMimeType(mime, pattern));
}
