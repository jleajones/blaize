// config/runtime-config.ts
interface RuntimeConfig {
  routesDir?: string;
  basePath?: string;
  // Add other runtime configuration as needed
}

// Internal state - not exported
let config: RuntimeConfig = {};

/**
 * Set runtime configuration
 */
export function setRuntimeConfig(newConfig: Partial<RuntimeConfig>): void {
  config = { ...config, ...newConfig };
}

/**
 * Get full runtime configuration
 */
export function getRuntimeConfig(): RuntimeConfig {
  return { ...config };
}

/**
 * Get the configured routes directory
 */
export function getRoutesDir(): string {
  if (!config.routesDir) {
    throw new Error('Routes directory not configured. Make sure server is properly initialized.');
  }
  return config.routesDir;
}

/**
 * Get the configured base path
 */
export function getBasePath(): string {
  return config.basePath || '';
}

/**
 * Clear configuration (useful for testing)
 */
export function clearRuntimeConfig(): void {
  config = {};
}
