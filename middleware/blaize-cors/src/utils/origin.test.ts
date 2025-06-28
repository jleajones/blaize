import { createTestContext } from '@blaizejs/testing-utils';

import { isOriginAllowed } from './origin';

import type { Context } from 'blaizejs';

describe('Origin Utility', () => {
  let ctx: Context;

  beforeEach(() => {
    ctx = createTestContext();
  });

  test('should allow undefined origin', async () => {
    const result = await isOriginAllowed(undefined, '*', ctx);
    expect(result).toBe(true);
  });

  test('should handle boolean origins', async () => {
    expect(await isOriginAllowed('https://example.com', true, ctx)).toBe(true);
    expect(await isOriginAllowed('https://example.com', false, ctx)).toBe(false);
  });

  test('should handle wildcard string', async () => {
    const result = await isOriginAllowed('https://example.com', '*', ctx);
    expect(result).toBe(true);
  });

  test('should cache string comparisons for performance', async () => {
    const origin = 'https://example.com';
    const corsOrigin = 'https://example.com';

    // First call
    const result1 = await isOriginAllowed(origin, corsOrigin, ctx);

    // Second call should use cache
    const result2 = await isOriginAllowed(origin, corsOrigin, ctx);

    expect(result1).toBe(true);
    expect(result2).toBe(true);
  });

  test('should handle RegExp patterns', async () => {
    const pattern = /^https:\/\/.*\.example\.com$/;

    expect(await isOriginAllowed('https://api.example.com', pattern, ctx)).toBe(true);
    expect(await isOriginAllowed('https://evil.com', pattern, ctx)).toBe(false);
  });

  test('should handle arrays of origins', async () => {
    const origins = ['https://example.com', 'https://test.com'];

    expect(await isOriginAllowed('https://example.com', origins, ctx)).toBe(true);
    expect(await isOriginAllowed('https://evil.com', origins, ctx)).toBe(false);
  });

  test('should handle function validators', async () => {
    const validator = vi.fn().mockResolvedValue(true);

    const result = await isOriginAllowed('https://example.com', validator, ctx);

    expect(result).toBe(true);
    expect(validator).toHaveBeenCalledWith('https://example.com', ctx);
  });
});
