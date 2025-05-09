/**
 * BlaizeJS Utilities
 *
 * Common utility functions used throughout the framework.
 */

/**
 * Check if a value is a plain object
 */
export function isPlainObject(value: any): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

/**
 * Deep merge objects
 */
export function deepMerge<T extends Record<string, any>>(
  target: T,
  ...sources: Record<string, any>[]
): T {
  if (!sources.length) return target;
  const source = sources.shift();

  if (isPlainObject(target) && isPlainObject(source)) {
    for (const key in source) {
      if (isPlainObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        deepMerge(target[key], source[key]);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }

  return deepMerge(target, ...sources);
}

/**
 * Parse a URL path into parts and parameters
 */
export function parsePath(path: string): {
  parts: string[];
  params: Record<string, string>;
} {
  const parts = path.split('/').filter(Boolean);
  const params: Record<string, string> = {};

  // Extract parameters (like :id or [id])
  const processedParts = parts.map(part => {
    if (part.startsWith(':')) {
      const paramName = part.slice(1);
      params[paramName] = '';
      return `__param__${paramName}`;
    }

    // Handle bracket syntax [id]
    if (part.startsWith('[') && part.endsWith(']')) {
      const paramName = part.slice(1, -1);
      params[paramName] = '';
      return `__param__${paramName}`;
    }

    return part;
  });

  return { parts: processedParts, params };
}

/**
 * Create a debug logger
 */
export function createDebugger(namespace: string) {
  return (message: string, ...args: any[]) => {
    if (process.env.DEBUG === '*' || process.env.DEBUG?.includes(namespace)) {
      console.log(`[${namespace}] ${message}`, ...args);
    }
  };
}

/**
 * Generate a random ID
 */
export function generateId(length = 21): string {
  return (
    Math.random()
      .toString(36)
      .substring(2, 2 + length) +
    Math.random()
      .toString(36)
      .substring(2, 2 + length)
  );
}
