import { RequestArgs } from "@blaizejs/types";

export function buildUrl(
  baseUrl: string, 
  path: string, 
  args?: RequestArgs
): string {
  // TODO: Replace path parameters (:userId -> actual values)
  // TODO: Add query parameters
  // TODO: Handle URL encoding
  
  let url = `${baseUrl}${path}`;
  
  // Replace URL parameters
  if (args?.params) {
    url = replacePathParameters(url, args.params);
  }
  
  // Add query parameters
  if (args?.query) {
    url = addQueryParameters(url, args.query);
  }
  
  return url;
}

function replacePathParameters(url: string, params: Record<string, string>): string {
  // TODO: Replace :param with actual values
  let result = url;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(`:${key}`, encodeURIComponent(value));
  }
  return result;
}

function addQueryParameters(url: string, query: Record<string, any>): string {
  // TODO: Build query string
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  }
  
  const queryString = searchParams.toString();
  return queryString ? `${url}?${queryString}` : url;
}