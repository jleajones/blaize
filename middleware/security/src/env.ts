/**
 * Check if the current environment is production.
 *
 * Uses NODE_ENV environment variable to determine the environment.
 * Defaults to development if NODE_ENV is not set.
 *
 * @internal
 * @returns true if production environment, false otherwise
 *
 * @example
 * ```typescript
 * // NODE_ENV=production
 * isProduction(); // true
 *
 * // NODE_ENV=development
 * isProduction(); // false
 *
 * // NODE_ENV not set
 * isProduction(); // false (defaults to development)
 * ```
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}
