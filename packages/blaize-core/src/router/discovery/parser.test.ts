import * as path from 'node:path';

import { parseRoutePath } from './parser';

import type { ParsedRoute } from '@blaize-types/router';

describe('parseRoutePath', () => {
  const basePath = '/app/routes';

  it('should parse a simple route without parameters', () => {
    const filePath = path.join(basePath, 'users.ts');
    const result = parseRoutePath(filePath, basePath);

    const expected: ParsedRoute = {
      filePath,
      routePath: '/users',
      params: [],
    };

    expect(result).toEqual(expected);
  });

  it('should parse a nested route without parameters', () => {
    const filePath = path.join(basePath, 'api', 'products.ts');
    const result = parseRoutePath(filePath, basePath);

    const expected: ParsedRoute = {
      filePath,
      routePath: '/api/products',
      params: [],
    };

    expect(result).toEqual(expected);
  });

  it('should handle index routes correctly', () => {
    const filePath = path.join(basePath, 'index.ts');
    const result = parseRoutePath(filePath, basePath);

    const expected: ParsedRoute = {
      filePath,
      routePath: '/',
      params: [],
    };

    expect(result).toEqual(expected);
  });

  it('should handle nested index routes correctly', () => {
    const filePath = path.join(basePath, 'api', 'index.ts');
    const result = parseRoutePath(filePath, basePath);

    const expected: ParsedRoute = {
      filePath,
      routePath: '/api',
      params: [],
    };

    expect(result).toEqual(expected);
  });

  it('should parse a route with a single parameter', () => {
    const filePath = path.join(basePath, 'users', '[id].ts');
    const result = parseRoutePath(filePath, basePath);

    const expected: ParsedRoute = {
      filePath,
      routePath: '/users/:id',
      params: ['id'],
    };

    expect(result).toEqual(expected);
  });

  it('should parse a route with multiple parameters', () => {
    const filePath = path.join(basePath, '[category]', '[productId].ts');
    const result = parseRoutePath(filePath, basePath);

    const expected: ParsedRoute = {
      filePath,
      routePath: '/:category/:productId',
      params: ['category', 'productId'],
    };

    expect(result).toEqual(expected);
  });

  it('should handle mixed static and dynamic segments', () => {
    const filePath = path.join(basePath, 'products', '[category]', 'items', '[id].ts');
    const result = parseRoutePath(filePath, basePath);

    const expected: ParsedRoute = {
      filePath,
      routePath: '/products/:category/items/:id',
      params: ['category', 'id'],
    };

    expect(result).toEqual(expected);
  });

  it('should correctly remove different file extensions', () => {
    const filePath = path.join(basePath, 'users.jsx');
    const result = parseRoutePath(filePath, basePath);

    const expected: ParsedRoute = {
      filePath,
      routePath: '/users',
      params: [],
    };

    expect(result).toEqual(expected);
  });

  it('should handle a file at the root level with no extension', () => {
    const filePath = path.join(basePath, 'about');
    const result = parseRoutePath(filePath, basePath);

    const expected: ParsedRoute = {
      filePath,
      routePath: '/about',
      params: [],
    };

    expect(result).toEqual(expected);
  });

  it('should handle edge case with an empty basePath', () => {
    const filePath = path.join('users', '[id].ts');
    const result = parseRoutePath(filePath, '');

    const expected: ParsedRoute = {
      filePath,
      routePath: '/users/:id',
      params: ['id'],
    };

    expect(result).toEqual(expected);
  });

  it('should handle path separators correctly across different platforms', () => {
    // Instead of directly using a string with backslashes (which gets interpreted as escapes),
    // let's construct a Windows-style path in a way that preserves backslashes
    const segments = ['api', 'users', '[id].ts'];

    // For a Windows-style test path, join using backslash
    const windowsStylePath = `${basePath}\\${segments.join('\\')}`;

    const result = parseRoutePath(windowsStylePath, basePath);

    // Verify just the key properties
    expect(result.routePath).toEqual('/api/users/:id');
    expect(result.params).toEqual(['id']);
  });
});
