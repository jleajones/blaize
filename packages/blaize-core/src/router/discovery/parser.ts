import * as path from 'node:path';

import { ParsedRoute } from '@blaizejs/types';

/**
 * Parse a file path into a route path
 * Works consistently across Windows and Unix-like file systems
 */
export function parseRoutePath(filePath: string, basePath: string): ParsedRoute {
  // Clean file:// URLs if present
  if (filePath.startsWith('file://')) {
    filePath = filePath.replace('file://', '');
  }
  if (basePath.startsWith('file://')) {
    basePath = basePath.replace('file://', '');
  }

  // Convert all backslashes to forward slashes for consistent handling
  const forwardSlashFilePath = filePath.replace(/\\/g, '/');
  const forwardSlashBasePath = basePath.replace(/\\/g, '/');

  // Ensure the base path ends with a slash for proper prefix removal
  const normalizedBasePath = forwardSlashBasePath.endsWith('/')
    ? forwardSlashBasePath
    : `${forwardSlashBasePath}/`;

  // Remove the base path to get the relative path
  let relativePath = forwardSlashFilePath;
  if (forwardSlashFilePath.startsWith(normalizedBasePath)) {
    relativePath = forwardSlashFilePath.substring(normalizedBasePath.length);
  } else if (forwardSlashFilePath.startsWith(forwardSlashBasePath)) {
    relativePath = forwardSlashFilePath.substring(forwardSlashBasePath.length);
    // If base path didn't end with a slash but we still matched, ensure relative path doesn't start with a slash
    if (relativePath.startsWith('/')) {
      relativePath = relativePath.substring(1);
    }
  } else {
    // If base path isn't a prefix of file path, use path.relative as a fallback
    // But convert to forward slashes for consistency
    relativePath = path.relative(forwardSlashBasePath, forwardSlashFilePath).replace(/\\/g, '/');
  }

  // Remove file extension (anything after the last dot)
  relativePath = relativePath.replace(/\.[^.]+$/, '');

  // Split the path into segments
  const segments = relativePath.split('/').filter(Boolean);
  const params: string[] = [];

  // Transform file path segments to route path segments
  const routeSegments = segments.map(segment => {
    // Handle dynamic parameters ([param])
    if (segment.startsWith('[') && segment.endsWith(']')) {
      const paramName = segment.slice(1, -1);
      params.push(paramName);
      return `:${paramName}`;
    }
    return segment;
  });

  // Create the final route path
  let routePath = routeSegments.length > 0 ? `/${routeSegments.join('/')}` : '/';

  // Handle index routes
  if (routePath.endsWith('/index')) {
    routePath = routePath.slice(0, -6) || '/';
  }

  return {
    filePath,
    routePath,
    params,
  };
}
