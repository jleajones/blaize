import { describe, it, expect } from 'vitest';

import { weakenEtag } from './etag';

describe('weakenEtag', () => {
  it('should convert a strong ETag to a weak ETag', () => {
    expect(weakenEtag('"abc123"')).toBe('W/"abc123"');
  });

  it('should return an already weak ETag unchanged', () => {
    expect(weakenEtag('W/"abc123"')).toBe('W/"abc123"');
  });

  it('should return undefined for undefined input', () => {
    expect(weakenEtag(undefined)).toBeUndefined();
  });

  it('should return undefined for empty string input', () => {
    expect(weakenEtag('')).toBeUndefined();
  });

  it('should handle ETag without quotes', () => {
    expect(weakenEtag('abc123')).toBe('W/abc123');
  });

  it('should handle complex ETag values', () => {
    expect(weakenEtag('"v1.2.3-abc"')).toBe('W/"v1.2.3-abc"');
  });
});

