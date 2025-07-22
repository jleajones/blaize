import {
  extractBoundary,
  isMultipartContent,
  parseContentDisposition,
  parseContentType,
} from './utils';

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
      const contentType =
        'multipart/form-data; charset=utf-8; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW';
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
});
