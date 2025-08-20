/**
 * Version management for BlaizeJS packages
 * These versions are tested and known to work well together
 * Updated quarterly after thorough testing
 */

/**
 * Pinned versions for stable, tested combinations
 */
export const VERSIONS = {
  // Core dependencies
  blaizejs: '^0.3.0',
  zod: '^3.24.4',

  // Dev dependencies
  typescript: '^5.8.3',
  tsx: '^4.19.4',
  '@types/node': '^22.15.17',

  // Testing dependencies
  '@blaizejs/testing-utils': '^0.3.0',
  vitest: '^3.1.3',
  '@vitest/coverage-v8': '^3.1.3',

  // Additional utilities
  rimraf: '^6.0.1',
} as const;

/**
 * Version options type
 */
export interface VersionOptions {
  latest?: boolean;
  fallback?: string;
}

/**
 * Version cache to avoid repeated fetches
 */
const versionCache = new Map<string, string>();

/**
 * Get version for a package
 */
export const getVersion = async (pkg: string, options: VersionOptions = {}): Promise<string> => {
  // Use pinned version by default
  if (!options.latest && VERSIONS[pkg as keyof typeof VERSIONS]) {
    return VERSIONS[pkg as keyof typeof VERSIONS];
  }

  // Check cache for latest versions
  const cacheKey = `${pkg}:latest`;
  if (options.latest && versionCache.has(cacheKey)) {
    return versionCache.get(cacheKey)!;
  }

  // Try to fetch latest if requested
  if (options.latest) {
    try {
      const version = await fetchLatestVersion(pkg);
      versionCache.set(cacheKey, version);
      return version;
    } catch (error) {
      if (process.env.DEBUG) {
        console.warn(`Failed to fetch latest version for ${pkg}:`, error);
      }
      return options.fallback || VERSIONS[pkg as keyof typeof VERSIONS] || 'latest';
    }
  }

  return VERSIONS[pkg as keyof typeof VERSIONS] || 'latest';
};

/**
 * Fetch latest version from npm registry
 */
async function fetchLatestVersion(pkg: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(`https://registry.npmjs.org/${pkg}/latest`, {
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = (await response.json()) as { version: string };
    return `^${data.version}`;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Get all dependencies for a template
 */
export const getDependencies = async (
  options: VersionOptions = {}
): Promise<Record<string, string>> => {
  return {
    blaizejs: await getVersion('blaizejs', options),
    zod: await getVersion('zod', options),
  };
};

/**
 * Get all dev dependencies for a template
 */
export const getDevDependencies = async (
  options: VersionOptions = {}
): Promise<Record<string, string>> => {
  return {
    '@types/node': await getVersion('@types/node', options),
    '@blaizejs/testing-utils': await getVersion('@blaizejs/testing-utils', options),
    typescript: await getVersion('typescript', options),
    tsx: await getVersion('tsx', options),
    vitest: await getVersion('vitest', options),
    '@vitest/coverage-v8': await getVersion('@vitest/coverage-v8', options),
    rimraf: await getVersion('rimraf', options),
  };
};
