/**
 * Extract parameter values from a URL path
 */
export function extractParams(
  path: string,
  pattern: RegExp,
  paramNames: string[]
): Record<string, string> {
  const match = pattern.exec(path);
  if (!match) {
    return {};
  }

  const params: Record<string, string> = {};

  // Extract parameter values from regex match groups
  for (let i = 0; i < paramNames.length; i++) {
    // Add 1 to index since the first capture group is at index 1
    params[paramNames[i]!] = match[i + 1] || '';
  }

  return params;
}

/**
 * Compile a path pattern with parameters
 */
export function compilePathPattern(path: string): { pattern: RegExp; paramNames: string[] } {
  const paramNames: string[] = [];

  // Special case for root path
  if (path === '/') {
    return {
      pattern: /^\/$/,
      paramNames: [],
    };
  }

  // First escape special regex characters (except for : and [ ] which we process specially)
  let patternString = path.replace(/([.+*?^$(){}|\\])/g, '\\$1');

  // Replace route parameters with regex capture groups
  patternString = patternString
    // Replace :param syntax with capture groups
    .replace(/\/:([^/]+)/g, (_, paramName) => {
      paramNames.push(paramName);
      return '/([^/]+)';
    })
    // Replace [param] syntax (for file-based routing)
    .replace(/\/\[([^\]]+)\]/g, (_, paramName) => {
      paramNames.push(paramName);
      return '/([^/]+)';
    });

  // Make the trailing slash optional (if not already the root path)
  // This adds an optional trailing slash to the end of the pattern
  patternString = `${patternString}(?:/)?`;

  // Create the regex pattern
  // This is safe because we've escaped special RegExp characters and
  // we're using developer-defined routes, not user input
  const pattern = new RegExp(`^${patternString}$`);

  return {
    pattern,
    paramNames,
  };
}

/**
 * Convert parameters object to URL query string
 */
export function paramsToQuery(params: Record<string, string | number | boolean>): string {
  const parts: string[] = [];

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      const encodedKey = encodeURIComponent(key);
      const encodedValue = encodeURIComponent(String(value));
      parts.push(`${encodedKey}=${encodedValue}`);
    }
  }

  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

/**
 * Build a URL with path parameters
 */
export function buildUrl(
  pathPattern: string,
  params: Record<string, string | number | boolean> = {},
  query: Record<string, string | number | boolean> = {}
): string {
  // Extract path parameters and query parameters
  const pathParams: Record<string, string | number | boolean> = {};
  const queryParams: Record<string, string | number | boolean> = { ...query };

  // Find all parameter names in the path
  const paramNames: string[] = [];
  pathPattern.replace(/\/:([^/]+)/g, (_, paramName) => {
    paramNames.push(paramName);
    return '/';
  });

  // Separate params into path params and additional query params
  for (const [key, value] of Object.entries(params)) {
    if (paramNames.includes(key)) {
      pathParams[key] = value;
    } else {
      queryParams[key] = value;
    }
  }

  // Replace path parameters
  let url = pathPattern;
  for (const [key, value] of Object.entries(pathParams)) {
    url = url.replace(`:${key}`, encodeURIComponent(String(value)));
  }

  // Add query string if needed
  const queryString = paramsToQuery(queryParams);

  return url + queryString;
}
