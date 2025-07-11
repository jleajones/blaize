import { extractBoundary, formatFileSize, getFileExtension, isAllowedMimeType, isMultipartContent, matchesMimeType, parseContentDisposition, parseContentType, sanitizeFilename, validateFileConstraints } from "./utils";

describe('Upload Utils', () => {
  describe('extractBoundary', () => {
    test('should extract boundary from content-type', () => {
      const contentType = 'multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW';
      const boundary = extractBoundary(contentType);
      expect(boundary).toBe('----WebKitFormBoundary7MA4YWxkTrZu0gW');
    });

    test('should handle quoted boundaries', () => {
      const contentType = 'multipart/form-data; boundary="----WebKitFormBoundary7MA4YWxkTrZu0gW"';
      const boundary = extractBoundary(contentType);
      expect(boundary).toBe('----WebKitFormBoundary7MA4YWxkTrZu0gW');
    });

    test('should handle boundary with additional parameters', () => {
      const contentType = 'multipart/form-data; charset=utf-8; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW';
      const boundary = extractBoundary(contentType);
      expect(boundary).toBe('----WebKitFormBoundary7MA4YWxkTrZu0gW');
    });

    test('should return null for missing boundary', () => {
      const contentType = 'multipart/form-data';
      const boundary = extractBoundary(contentType);
      expect(boundary).toBeNull();
    });

    test('should return null for empty boundary', () => {
      const contentType = 'multipart/form-data; boundary=';
      const boundary = extractBoundary(contentType);
      expect(boundary).toBeNull();
    });

    test('should handle case insensitive boundary parameter', () => {
      const contentType = 'multipart/form-data; BOUNDARY=test123';
      const boundary = extractBoundary(contentType);
      expect(boundary).toBe('test123');
    });
  });

  describe('parseContentDisposition', () => {
    test('should parse form field disposition', () => {
      const headers = 'Content-Disposition: form-data; name="username"';
      const result = parseContentDisposition(headers);
      expect(result).toEqual({ name: 'username' });
    });

    test('should parse file field disposition', () => {
      const headers = 'Content-Disposition: form-data; name="avatar"; filename="profile.jpg"';
      const result = parseContentDisposition(headers);
      expect(result).toEqual({ name: 'avatar', filename: 'profile.jpg' });
    });

    test('should handle empty filename', () => {
      const headers = 'Content-Disposition: form-data; name="file"; filename=""';
      const result = parseContentDisposition(headers);
      expect(result).toEqual({ name: 'file', filename: '' });
    });

    test('should handle filename with spaces and special characters', () => {
      const headers = 'Content-Disposition: form-data; name="document"; filename="my file (1).pdf"';
      const result = parseContentDisposition(headers);
      expect(result).toEqual({ name: 'document', filename: 'my file (1).pdf' });
    });

    test('should return null for invalid header', () => {
      const headers = 'Invalid-Header: something';
      const result = parseContentDisposition(headers);
      expect(result).toBeNull();
    });

    test('should return null for missing name', () => {
      const headers = 'Content-Disposition: form-data; filename="test.txt"';
      const result = parseContentDisposition(headers);
      expect(result).toBeNull();
    });

    test('should handle multiline headers', () => {
      const headers = `Content-Disposition: form-data; name="upload";\r\n filename="test.txt"`;
      const result = parseContentDisposition(headers);
      expect(result).toEqual({ name: 'upload', filename: 'test.txt' });
    });
  });

  describe('parseContentType', () => {
    test('should extract mime type', () => {
      const headers = 'Content-Type: image/jpeg';
      const result = parseContentType(headers);
      expect(result).toBe('image/jpeg');
    });

    test('should handle complex content type', () => {
      const headers = 'Content-Type: text/plain; charset=utf-8';
      const result = parseContentType(headers);
      expect(result).toBe('text/plain; charset=utf-8');
    });

    test('should default to application/octet-stream', () => {
      const headers = 'Some-Other-Header: value';
      const result = parseContentType(headers);
      expect(result).toBe('application/octet-stream');
    });

    test('should handle empty content type', () => {
      const headers = 'Content-Type: ';
      const result = parseContentType(headers);
      expect(result).toBe('application/octet-stream');
    });

    test('should handle case insensitive header', () => {
      const headers = 'content-type: application/json';
      const result = parseContentType(headers);
      expect(result).toBe('application/json');
    });
  });

  describe('isMultipartContent', () => {
    test('should detect multipart content', () => {
      const contentType = 'multipart/form-data; boundary=test';
      expect(isMultipartContent(contentType)).toBe(true);
    });

    test('should reject non-multipart content', () => {
      const contentType = 'application/json';
      expect(isMultipartContent(contentType)).toBe(false);
    });

    test('should be case insensitive', () => {
      const contentType = 'MULTIPART/FORM-DATA; boundary=test';
      expect(isMultipartContent(contentType)).toBe(true);
    });

    test('should handle mixed case', () => {
      const contentType = 'Multipart/Form-Data; boundary=test';
      expect(isMultipartContent(contentType)).toBe(true);
    });
  });

  describe('validateFileConstraints', () => {
    const mockFile = {
      size: 1024,
      mimetype: 'image/jpeg',
      filename: 'test.jpg'
    };

    test('should pass valid file', () => {
      const result = validateFileConstraints(mockFile, {
        maxFileSize: 2048,
        allowedMimeTypes: ['image/jpeg', 'image/png'],
        allowedExtensions: ['jpg', 'jpeg', 'png']
      });
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('should fail on size limit', () => {
      const result = validateFileConstraints(mockFile, {
        maxFileSize: 512
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds maximum');
      expect(result.error).toContain('512');
    });

    test('should fail on mime type', () => {
      const result = validateFileConstraints(mockFile, {
        allowedMimeTypes: ['image/png', 'image/gif']
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('MIME type');
      expect(result.error).toContain('image/jpeg');
    });

    test('should fail on extension', () => {
      const result = validateFileConstraints(mockFile, {
        allowedExtensions: ['png', 'gif']
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('extension');
      expect(result.error).toContain('jpg');
    });

    test('should pass with no constraints', () => {
      const result = validateFileConstraints(mockFile, {});
      expect(result.valid).toBe(true);
    });

    test('should handle file without filename', () => {
      const fileWithoutName = { ...mockFile, filename: undefined };
      const result = validateFileConstraints(fileWithoutName, {
        allowedExtensions: ['jpg']
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('unknown');
    });

    test('should handle empty allowed arrays as no restrictions', () => {
      const result = validateFileConstraints(mockFile, {
        allowedMimeTypes: [],
        allowedExtensions: []
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('getFileExtension', () => {
    test('should extract extension from filename', () => {
      expect(getFileExtension('test.jpg')).toBe('jpg');
      expect(getFileExtension('document.pdf')).toBe('pdf');
      expect(getFileExtension('archive.tar.gz')).toBe('gz');
    });

    test('should handle uppercase extensions', () => {
      expect(getFileExtension('test.JPG')).toBe('jpg');
      expect(getFileExtension('DOCUMENT.PDF')).toBe('pdf');
    });

    test('should return null for no extension', () => {
      expect(getFileExtension('filename')).toBeNull();
      expect(getFileExtension('.')).toBeNull();
    });

    test('should return null for undefined filename', () => {
      expect(getFileExtension(undefined)).toBeNull();
    });

    test('should handle empty filename', () => {
      expect(getFileExtension('')).toBeNull();
    });
  });

  describe('sanitizeFilename', () => {
    test('should remove dangerous characters', () => {
      const dangerous = 'file<>:"/\\|?*name.txt';
      const result = sanitizeFilename(dangerous);
      expect(result).toBe('file_name.txt');
    });

    test('should replace spaces with underscores', () => {
      const result = sanitizeFilename('my file name.txt');
      expect(result).toBe('my_file_name.txt');
    });

    test('should collapse multiple underscores', () => {
      const result = sanitizeFilename('file___name.txt');
      expect(result).toBe('file_name.txt');
    });

    test('should remove leading and trailing underscores', () => {
      const result = sanitizeFilename('___filename___.txt');
      expect(result).toBe('filename.txt');
    });

    test('should handle undefined filename', () => {
      const result = sanitizeFilename(undefined);
      expect(result).toBe('unnamed_file');
    });

    test('should limit length', () => {
      const longName = 'a'.repeat(300) + '.txt';
      const result = sanitizeFilename(longName);
      expect(result.length).toBeLessThanOrEqual(255);
    });

    test('should provide fallback for completely invalid filename', () => {
      const result = sanitizeFilename('///:::***');
      expect(result).toBe('unnamed_file');
    });
  });

  describe('formatFileSize', () => {
    test('should format bytes', () => {
      expect(formatFileSize(0)).toBe('0 B');
      expect(formatFileSize(512)).toBe('512 B');
      expect(formatFileSize(1023)).toBe('1023 B');
    });

    test('should format kilobytes', () => {
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(2048)).toBe('2 KB');
      expect(formatFileSize(1536)).toBe('1.5 KB');
    });

    test('should format megabytes', () => {
      expect(formatFileSize(1024 * 1024)).toBe('1 MB');
      expect(formatFileSize(1024 * 1024 * 2.5)).toBe('2.5 MB');
    });

    test('should format gigabytes', () => {
      expect(formatFileSize(1024 * 1024 * 1024)).toBe('1 GB');
      expect(formatFileSize(1024 * 1024 * 1024 * 1.5)).toBe('1.5 GB');
    });
  });

  describe('matchesMimeType', () => {
    test('should match exact mime types', () => {
      expect(matchesMimeType('image/jpeg', 'image/jpeg')).toBe(true);
      expect(matchesMimeType('text/plain', 'text/plain')).toBe(true);
    });

    test('should match wildcard patterns', () => {
      expect(matchesMimeType('image/jpeg', 'image/*')).toBe(true);
      expect(matchesMimeType('text/plain', 'text/*')).toBe(true);
      expect(matchesMimeType('application/json', '*/*')).toBe(true);
    });

    test('should not match different types', () => {
      expect(matchesMimeType('image/jpeg', 'text/plain')).toBe(false);
      expect(matchesMimeType('text/plain', 'image/*')).toBe(false);
    });
  });

  describe('isAllowedMimeType', () => {
    test('should allow when no restrictions', () => {
      expect(isAllowedMimeType('image/jpeg', [])).toBe(true);
    });

    test('should check against allowed patterns', () => {
      const allowed = ['image/*', 'application/pdf'];
      expect(isAllowedMimeType('image/jpeg', allowed)).toBe(true);
      expect(isAllowedMimeType('image/png', allowed)).toBe(true);
      expect(isAllowedMimeType('application/pdf', allowed)).toBe(true);
      expect(isAllowedMimeType('text/plain', allowed)).toBe(false);
    });
  });
});