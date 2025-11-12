/**
 * Base error class for plugin-related errors
 */
export class PluginError extends Error {
  constructor(
    public pluginName: string,
    message: string,
    public cause?: Error
  ) {
    super(`Plugin "${pluginName}": ${message}`);
    this.name = 'PluginError';
  }
}

/**
 * Error thrown when a plugin fails during a lifecycle phase
 */
export class PluginLifecycleError extends PluginError {
  constructor(
    pluginName: string,
    public phase: 'register' | 'initialize' | 'terminate' | 'start' | 'stop',
    cause: Error
  ) {
    super(pluginName, `Failed during ${phase} phase: ${cause.message}`, cause);
    this.name = 'PluginLifecycleError';
  }
}

/**
 * Error thrown when a plugin has missing dependencies
 */
export class PluginDependencyError extends PluginError {
  constructor(
    pluginName: string,
    public missingDependency: string
  ) {
    super(pluginName, `Missing dependency: ${missingDependency}`);
    this.name = 'PluginDependencyError';
  }
}

/**
 * Error thrown when plugin validation fails
 */
export class PluginValidationError extends Error {
  constructor(
    public pluginName: string,
    message: string
  ) {
    super(`Plugin validation error${pluginName ? ` for "${pluginName}"` : ''}: ${message}`);
    this.name = 'PluginValidationError';
  }
}

/**
 * Error thrown when plugin registration fails
 */
export class PluginRegistrationError extends Error {
  constructor(
    public pluginName: string,
    message: string
  ) {
    super(`Plugin registration error for "${pluginName}": ${message}`);
    this.name = 'PluginRegistrationError';
  }
}
