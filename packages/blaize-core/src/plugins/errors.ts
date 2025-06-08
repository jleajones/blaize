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

export class PluginDependencyError extends PluginError {
  constructor(
    pluginName: string,
    public missingDependency: string
  ) {
    super(pluginName, `Missing dependency: ${missingDependency}`);
    this.name = 'PluginDependencyError';
  }
}

// packages/blaizejs/src/plugins/errors.ts (or add to existing errors file)

export class PluginValidationError extends Error {
  constructor(
    public pluginName: string,
    message: string
  ) {
    super(`Plugin validation error${pluginName ? ` for "${pluginName}"` : ''}: ${message}`);
    this.name = 'PluginValidationError';
  }
}

export class PluginRegistrationError extends Error {
  constructor(
    public pluginName: string,
    message: string
  ) {
    super(`Plugin registration error for "${pluginName}": ${message}`);
    this.name = 'PluginRegistrationError';
  }
}
