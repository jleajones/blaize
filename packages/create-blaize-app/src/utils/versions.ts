/**
 * Version management for BlaizeJS packages
 * Simple approach: latest for BlaizeJS, major versions for others
 */

/**
 * Get all dependencies for a template
 */
export const getDependencies = async (): Promise<Record<string, string>> => {
  // Always use latest for BlaizeJS packages
  // Use major version ranges for external packages
  return {
    blaizejs: 'latest',
    '@blaizejs/middleware-security': 'latest',
    zod: '^3.24.4',
  };
};

/**
 * Get all dev dependencies for a template
 */
export const getDevDependencies = async (): Promise<Record<string, string>> => {
  return {
    '@blaizejs/testing-utils': 'latest',
    '@types/node': '^22.0.0',
    '@types/selfsigned': '^2.1.0',
    '@vitest/coverage-v8': '^3.1.3',
    chokidar: '^4.0.3',
    rimraf: '^6.0.1',
    selfsigned: '^2.4.1',
    tsx: '^4.19.4',
    typescript: '^5.8.3',
    vitest: '^3.1.3',
  };
};
