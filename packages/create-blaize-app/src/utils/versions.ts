/**
 * Version management for BlaizeJS packages
 * Simple approach: latest for BlaizeJS, major versions for others
 */

/**
 * Version options type
 */
export interface VersionOptions {
  latest?: boolean;
}

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
    typescript: '^5.0.0',
    tsx: '^4.0.0',
  };
};
