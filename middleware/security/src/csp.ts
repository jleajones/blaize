/**
 * Content Security Policy (CSP) header builder
 *
 * Converts CSP directive configuration into valid CSP header strings.
 * Handles camelCase to kebab-case conversion and multiple value types.
 *
 * @module @blaizejs/middleware-security/src/csp
 */

import type { CSPOptions } from './types.js';

/**
 * Build Content-Security-Policy header string from directives.
 *
 * Converts camelCase directive names to kebab-case per CSP specification
 * and formats values according to their type (array, boolean, or string).
 *
 * @param options - CSP configuration options
 * @returns Valid CSP header string with semicolon-separated directives
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy | MDN CSP}
 * @see {@link https://www.w3.org/TR/CSP3/ | W3C CSP Level 3}
 *
 * @example
 * ```typescript
 * // Basic directives
 * buildCSPHeader({
 *   directives: {
 *     defaultSrc: ["'self'"],
 *     scriptSrc: ["'self'", "https://cdn.example.com"]
 *   }
 * });
 * // Returns: "default-src 'self'; script-src 'self' https://cdn.example.com"
 * ```
 *
 * @example
 * ```typescript
 * // Boolean directives
 * buildCSPHeader({
 *   directives: {
 *     defaultSrc: ["'self'"],
 *     upgradeInsecureRequests: true,
 *     blockAllMixedContent: false  // Excluded from output
 *   }
 * });
 * // Returns: "default-src 'self'; upgrade-insecure-requests"
 * ```
 *
 * @example
 * ```typescript
 * // String directives (legacy)
 * buildCSPHeader({
 *   directives: {
 *     defaultSrc: ["'self'"],
 *     sandbox: "allow-forms allow-scripts"
 *   }
 * });
 * // Returns: "default-src 'self'; sandbox allow-forms allow-scripts"
 * ```
 *
 * @example
 * ```typescript
 * // Extensible directives (auto-converted to kebab-case)
 * buildCSPHeader({
 *   directives: {
 *     defaultSrc: ["'self'"],
 *     workerSrc: ["'self'"],        // → worker-src
 *     frameAncestors: ["'none'"],   // → frame-ancestors
 *     formAction: ["'self'"]        // → form-action
 *   }
 * });
 * // Returns: "default-src 'self'; worker-src 'self'; frame-ancestors 'none'; form-action 'self'"
 * ```
 */
export function buildCSPHeader(options: CSPOptions): string {
  const directives: string[] = [];

  // Iterate over all directive entries
  for (const [key, value] of Object.entries(options.directives)) {
    // Skip undefined values
    if (value === undefined) continue;

    // Convert camelCase to kebab-case (scriptSrc → script-src)
    const directiveName = camelToKebab(key);

    // Format the directive based on its value type
    const formattedDirective = formatDirective(directiveName, value);

    // Add to directives array if non-empty
    if (formattedDirective) {
      directives.push(formattedDirective);
    }
  }

  // Join all directives with semicolon and space
  return directives.join('; ');
}

/**
 * Convert camelCase string to kebab-case.
 *
 * Converts directive names from JavaScript camelCase convention
 * to CSP specification kebab-case format.
 *
 * @internal
 * @param str - camelCase string
 * @returns kebab-case string
 *
 * @example
 * ```typescript
 * camelToKebab('scriptSrc')              // → 'script-src'
 * camelToKebab('defaultSrc')             // → 'default-src'
 * camelToKebab('upgradeInsecureRequests') // → 'upgrade-insecure-requests'
 * camelToKebab('frameAncestors')         // → 'frame-ancestors'
 * ```
 */
function camelToKebab(str: string): string {
  return str.replace(/([A-Z])/g, '-$1').toLowerCase();
}

/**
 * Format a single CSP directive based on its value type.
 *
 * Handles three value types per CSP specification:
 * - Array: Joined with spaces (most common)
 * - Boolean: Directive name only if true (e.g., upgrade-insecure-requests)
 * - String: Used as-is (legacy support, rarely used)
 *
 * @internal
 * @param name - kebab-case directive name
 * @param value - directive value (array, boolean, or string)
 * @returns formatted directive string or empty string if value is falsy
 *
 * @example
 * ```typescript
 * // Array values (most common)
 * formatDirective('script-src', ["'self'", "https://cdn.example.com"])
 * // → "script-src 'self' https://cdn.example.com"
 *
 * // Boolean values (valueless directives)
 * formatDirective('upgrade-insecure-requests', true)
 * // → "upgrade-insecure-requests"
 *
 * formatDirective('block-all-mixed-content', false)
 * // → ""
 *
 * // String values (legacy, for sandbox and other special directives)
 * formatDirective('sandbox', "allow-forms allow-scripts")
 * // → "sandbox allow-forms allow-scripts"
 *
 * // Empty arrays are skipped
 * formatDirective('script-src', [])
 * // → ""
 * ```
 */
function formatDirective(name: string, value: string[] | boolean | string): string {
  // Boolean directives (e.g., upgrade-insecure-requests)
  if (typeof value === 'boolean') {
    return value ? name : '';
  }

  // String directives (e.g., sandbox, legacy support)
  if (typeof value === 'string') {
    return `${name} ${value}`;
  }

  // Array directives (most common case)
  if (Array.isArray(value) && value.length > 0) {
    return `${name} ${value.join(' ')}`;
  }

  // Empty or invalid values
  return '';
}
