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
    zod: '^3.0.0',
  };
};

/**
 * Get all dev dependencies for a template
 */
export const getDevDependencies = async (): Promise<Record<string, string>> => {
  return {
    '@types/node': '^22.0.0',
    '@types/selfsigned': '^2.1.0',
    chokidar: '^4.0.3',
    selfsigned: '^2.4.1',
    typescript: '^5.0.0',
    tsx: '^4.0.0',
  };
};
