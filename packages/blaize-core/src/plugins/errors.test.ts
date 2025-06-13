import {
  PluginError,
  PluginLifecycleError,
  PluginDependencyError,
  PluginValidationError,
  PluginRegistrationError,
} from './errors';

describe('Plugin Error Classes', () => {
  const TEST_PLUGIN_ERROR_NAME = 'test-plugin';
  describe('PluginError', () => {
    test('should create error with plugin name and message', () => {
      const error = new PluginError(TEST_PLUGIN_ERROR_NAME, 'Something went wrong');

      expect(error.name).toBe('PluginError');
      expect(error.pluginName).toBe(TEST_PLUGIN_ERROR_NAME);
      expect(error.message).toBe('Plugin "test-plugin": Something went wrong');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(PluginError);
    });

    test('should create error with cause', () => {
      const cause = new Error('Original error');
      const error = new PluginError(TEST_PLUGIN_ERROR_NAME, 'Wrapper error', cause);

      expect(error.pluginName).toBe(TEST_PLUGIN_ERROR_NAME);
      expect(error.cause).toBe(cause);
      expect(error.message).toBe('Plugin "test-plugin": Wrapper error');
    });

    test('should handle empty plugin name', () => {
      const error = new PluginError('', 'No plugin name');

      expect(error.pluginName).toBe('');
      expect(error.message).toBe('Plugin "": No plugin name');
    });

    test('should be throwable and catchable', () => {
      expect(() => {
        throw new PluginError(TEST_PLUGIN_ERROR_NAME, 'Test error');
      }).toThrow('Plugin "test-plugin": Test error');

      try {
        throw new PluginError(TEST_PLUGIN_ERROR_NAME, 'Test error');
      } catch (error) {
        expect(error).toBeInstanceOf(PluginError);
        expect((error as PluginError).pluginName).toBe(TEST_PLUGIN_ERROR_NAME);
      }
    });
  });

  describe('PluginLifecycleError', () => {
    test('should create lifecycle error with phase information', () => {
      const cause = new Error('Initialization failed');
      const error = new PluginLifecycleError('auth-plugin', 'initialize', cause);

      expect(error.name).toBe('PluginLifecycleError');
      expect(error.pluginName).toBe('auth-plugin');
      expect(error.phase).toBe('initialize');
      expect(error.cause).toBe(cause);
      expect(error.message).toBe(
        'Plugin "auth-plugin": Failed during initialize phase: Initialization failed'
      );
    });

    test('should inherit from PluginError', () => {
      const cause = new Error('Registration failed');
      const error = new PluginLifecycleError(TEST_PLUGIN_ERROR_NAME, 'register', cause);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(PluginError);
      expect(error).toBeInstanceOf(PluginLifecycleError);
    });

    test('should work with all lifecycle phases', () => {
      const phases: Array<'register' | 'initialize' | 'terminate' | 'start' | 'stop'> = [
        'register',
        'initialize',
        'terminate',
        'start',
        'stop',
      ];

      phases.forEach(phase => {
        const cause = new Error(`${phase} failed`);
        const error = new PluginLifecycleError(TEST_PLUGIN_ERROR_NAME, phase, cause);

        expect(error.phase).toBe(phase);
        expect(error.message).toContain(`Failed during ${phase} phase`);
      });
    });
  });

  describe('PluginDependencyError', () => {
    test('should create dependency error with missing dependency info', () => {
      const error = new PluginDependencyError('auth-plugin', 'database-plugin');

      expect(error.name).toBe('PluginDependencyError');
      expect(error.pluginName).toBe('auth-plugin');
      expect(error.missingDependency).toBe('database-plugin');
      expect(error.message).toBe('Plugin "auth-plugin": Missing dependency: database-plugin');
    });

    test('should inherit from PluginError', () => {
      const error = new PluginDependencyError(TEST_PLUGIN_ERROR_NAME, 'missing-plugin');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(PluginError);
      expect(error).toBeInstanceOf(PluginDependencyError);
    });
  });

  describe('PluginValidationError', () => {
    test('should create validation error with plugin name', () => {
      const error = new PluginValidationError(TEST_PLUGIN_ERROR_NAME, 'Invalid configuration');

      expect(error.name).toBe('PluginValidationError');
      expect(error.pluginName).toBe(TEST_PLUGIN_ERROR_NAME);
      expect(error.message).toBe(
        'Plugin validation error for "test-plugin": Invalid configuration'
      );
    });

    test('should handle empty plugin name', () => {
      const error = new PluginValidationError('', 'General validation error');

      expect(error.pluginName).toBe('');
      expect(error.message).toBe('Plugin validation error: General validation error');
    });

    test('should be a direct Error subclass', () => {
      const error = new PluginValidationError(TEST_PLUGIN_ERROR_NAME, 'Test error');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(PluginValidationError);
      // Should NOT be instance of PluginError (it's a separate hierarchy)
      expect(error).not.toBeInstanceOf(PluginError);
    });
  });

  describe('PluginRegistrationError', () => {
    test('should create registration error with plugin name', () => {
      const error = new PluginRegistrationError(TEST_PLUGIN_ERROR_NAME, 'Failed to register');

      expect(error.name).toBe('PluginRegistrationError');
      expect(error.pluginName).toBe(TEST_PLUGIN_ERROR_NAME);
      expect(error.message).toBe('Plugin registration error for "test-plugin": Failed to register');
    });

    test('should be a direct Error subclass', () => {
      const error = new PluginRegistrationError(TEST_PLUGIN_ERROR_NAME, 'Test error');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(PluginRegistrationError);
      // Should NOT be instance of PluginError (separate hierarchy)
      expect(error).not.toBeInstanceOf(PluginError);
    });
  });
});
