import type { Plugin } from '@blaizejs/types';

import { PluginValidationError } from './errors';

export interface PluginValidationOptions {
  /** Require specific plugin properties */
  requireVersion?: boolean;
  /** Validate plugin name format */
  validateNameFormat?: boolean;
  /** Check for reserved plugin names */
  checkReservedNames?: boolean;
}

/**
 * Reserved plugin names that cannot be used
 */
const RESERVED_NAMES = new Set([
  'core',
  'server',
  'router',
  'middleware',
  'context',
  'blaize',
  'blaizejs',
]);

/**
 * Valid plugin name pattern (lowercase, letters, numbers, hyphens)
 */
const VALID_NAME_PATTERN = /^[a-z]([a-z0-9-]*[a-z0-9])?$/;

/**
 * Valid semantic version pattern
 */
const VALID_VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[a-zA-Z0-9-.]+)?(?:\+[a-zA-Z0-9-.]+)?$/;

/**
 * Validate a plugin object
 */
export function validatePlugin(
  plugin: unknown,
  options: PluginValidationOptions = {}
): asserts plugin is Plugin {
  const { requireVersion = true, validateNameFormat = true, checkReservedNames = true } = options;

  // Basic type validation
  if (!plugin || typeof plugin !== 'object') {
    throw new PluginValidationError('', 'Plugin must be an object');
  }

  const p = plugin as any;

  // Validate name
  if (!p.name || typeof p.name !== 'string') {
    throw new PluginValidationError('', 'Plugin must have a name (string)');
  }

  // Validate name format
  if (validateNameFormat && !VALID_NAME_PATTERN.test(p.name)) {
    throw new PluginValidationError(
      p.name,
      'Plugin name must be lowercase letters, numbers, and hyphens only'
    );
  }

  // Check reserved names
  if (checkReservedNames && RESERVED_NAMES.has(p.name.toLowerCase())) {
    throw new PluginValidationError(p.name, `Plugin name "${p.name}" is reserved`);
  }

  // Validate version
  if (requireVersion) {
    if (!p.version || typeof p.version !== 'string') {
      throw new PluginValidationError(p.name, 'Plugin must have a version (string)');
    }

    if (!VALID_VERSION_PATTERN.test(p.version)) {
      throw new PluginValidationError(
        p.name,
        'Plugin version must follow semantic versioning (e.g., "1.0.0")'
      );
    }
  }

  // Validate register method
  if (!p.register || typeof p.register !== 'function') {
    throw new PluginValidationError(p.name, 'Plugin must have a register method (function)');
  }

  // Validate optional lifecycle methods
  const lifecycleMethods = ['initialize', 'terminate', 'onServerStart', 'onServerStop'];

  for (const method of lifecycleMethods) {
    if (p[method] && typeof p[method] !== 'function') {
      throw new PluginValidationError(p.name, `Plugin ${method} must be a function if provided`);
    }
  }

  // Validate dependencies if present
  // if (p.dependencies) {
  //   if (!Array.isArray(p.dependencies) && typeof p.dependencies !== 'string') {
  //     throw new PluginValidationError(
  //       p.name,
  //       'Plugin dependencies must be a string or array of strings'
  //     );
  //   }

  //   const deps = Array.isArray(p.dependencies) ? p.dependencies : [p.dependencies];
  //   for (const dep of deps) {
  //     if (typeof dep !== 'string') {
  //       throw new PluginValidationError(p.name, 'Plugin dependencies must be strings');
  //     }
  //   }
  // }
}

/**
 * Validate plugin options object
 */
export function validatePluginOptions(pluginName: string, options: unknown, schema?: any): void {
  // Basic validation
  if (options !== undefined && typeof options !== 'object') {
    throw new PluginValidationError(pluginName, 'Plugin options must be an object');
  }

  // If a schema is provided, validate against it
  if (schema && options) {
    try {
      schema.parse(options);
    } catch (error) {
      throw new PluginValidationError(
        pluginName,
        `Plugin options validation failed: ${(error as Error).message}`
      );
    }
  }
}

/**
 * Validate plugin factory function
 */
export function validatePluginFactory(
  factory: unknown
): asserts factory is (...args: any[]) => any {
  if (typeof factory !== 'function') {
    throw new PluginValidationError('', 'Plugin factory must be a function');
  }
}

/**
 * Check if a plugin name is valid
 */
export function isValidPluginName(name: string): boolean {
  return (
    typeof name === 'string' &&
    name.length > 0 &&
    VALID_NAME_PATTERN.test(name) &&
    !RESERVED_NAMES.has(name.toLowerCase())
  );
}

/**
 * Check if a version string is valid
 */
export function isValidVersion(version: string): boolean {
  return typeof version === 'string' && VALID_VERSION_PATTERN.test(version);
}

/**
 * Sanitize plugin name (remove invalid characters)
 */
export function sanitizePluginName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}
