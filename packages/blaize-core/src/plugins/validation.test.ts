import { createMockPlugin } from '@blaizejs/testing-utils';

import { PluginValidationError } from './errors';
import {
  validatePlugin,
  validatePluginOptions,
  validatePluginFactory,
  isValidPluginName,
  isValidVersion,
  sanitizePluginName,
} from './validation';

describe('Plugin Validation', () => {
  describe('validatePlugin', () => {
    describe('basic validation', () => {
      test('should pass for valid plugin', () => {
        const plugin = createMockPlugin();

        expect(() => validatePlugin(plugin)).not.toThrow();
      });

      test('should throw for null/undefined plugin', () => {
        expect(() => validatePlugin(null)).toThrow(
          new PluginValidationError('', 'Plugin must be an object')
        );

        expect(() => validatePlugin(undefined)).toThrow(
          new PluginValidationError('', 'Plugin must be an object')
        );
      });

      test('should throw for non-object plugin', () => {
        expect(() => validatePlugin('not-an-object')).toThrow(
          new PluginValidationError('', 'Plugin must be an object')
        );

        expect(() => validatePlugin(123)).toThrow(
          new PluginValidationError('', 'Plugin must be an object')
        );

        expect(() => validatePlugin([])).toThrow(
          new PluginValidationError('', 'Plugin must have a name (string)')
        );
      });
    });

    describe('name validation', () => {
      test('should throw for missing name', () => {
        const plugin = createMockPlugin();
        delete (plugin as any).name;

        expect(() => validatePlugin(plugin)).toThrow(
          new PluginValidationError('', 'Plugin must have a name (string)')
        );
      });

      test('should throw for non-string name', () => {
        const plugin = createMockPlugin({ name: 123 as any });

        expect(() => validatePlugin(plugin)).toThrow(
          new PluginValidationError('', 'Plugin must have a name (string)')
        );
      });

      test('should throw for empty name string', () => {
        const plugin = createMockPlugin({ name: '' });

        expect(() => validatePlugin(plugin)).toThrow(
          new PluginValidationError('', 'Plugin must have a name (string)')
        );
      });

      test('should throw for invalid name format', () => {
        const invalidNames = [
          'Test-Plugin', // uppercase
          'test_plugin', // underscore
          'test plugin', // space
          'test@plugin', // special character
          '123plugin', // starts with number
          'test-', // ends with hyphen
          '-test', // starts with hyphen
        ];

        invalidNames.forEach(name => {
          const plugin = createMockPlugin({ name });

          expect(() => validatePlugin(plugin)).toThrow(
            new PluginValidationError(
              name,
              'Plugin name must be lowercase letters, numbers, and hyphens only'
            )
          );
        });
      });

      test('should accept valid name formats', () => {
        const validNames = ['test', 'test-plugin', 'test123', 'test-plugin-123', 'a', 'plugin2'];

        validNames.forEach(name => {
          const plugin = createMockPlugin({ name });

          expect(() => validatePlugin(plugin)).not.toThrow();
        });
      });

      test('should throw for reserved names', () => {
        const reservedNames = [
          'core',
          'server',
          'router',
          'middleware',
          'context',
          'blaize',
          'blaizejs',
          'core',
          'server',
        ];

        reservedNames.forEach(name => {
          const plugin = createMockPlugin({ name });

          expect(() => validatePlugin(plugin)).toThrow(
            new PluginValidationError(name, `Plugin name "${name}" is reserved`)
          );
        });
      });

      test('should skip name format validation when disabled', () => {
        const plugin = createMockPlugin({ name: 'Invalid_Name' });

        expect(() => validatePlugin(plugin, { validateNameFormat: false })).not.toThrow();
      });

      test('should skip reserved name check when disabled', () => {
        const plugin = createMockPlugin({ name: 'core' });

        expect(() => validatePlugin(plugin, { checkReservedNames: false })).not.toThrow();
      });
    });

    describe('version validation', () => {
      test('should throw for missing version when required', () => {
        const plugin = createMockPlugin();
        delete (plugin as any).version;

        expect(() => validatePlugin(plugin)).toThrow(
          new PluginValidationError('test-plugin', 'Plugin must have a version (string)')
        );
      });

      test('should throw for non-string version', () => {
        const plugin = createMockPlugin({ version: 1.0 as any });

        expect(() => validatePlugin(plugin)).toThrow(
          new PluginValidationError('test-plugin', 'Plugin must have a version (string)')
        );
      });

      test('should throw for empty version string', () => {
        const plugin = createMockPlugin({ version: '' });

        expect(() => validatePlugin(plugin)).toThrow(
          new PluginValidationError('test-plugin', 'Plugin must have a version (string)')
        );
      });

      test('should throw for invalid version format', () => {
        const invalidVersions = [
          '1.0', // missing patch
          '1', // missing minor and patch
          'v1.0.0', // has prefix
          '1.0.0.0', // too many parts
          'abc', // non-numeric
          '1.0.a', // invalid patch
        ];

        invalidVersions.forEach(version => {
          const plugin = createMockPlugin({ version });

          expect(() => validatePlugin(plugin)).toThrow(
            new PluginValidationError(
              'test-plugin',
              'Plugin version must follow semantic versioning (e.g., "1.0.0")'
            )
          );
        });
      });

      test('should accept valid version formats', () => {
        const validVersions = [
          '1.0.0',
          '10.20.30',
          '1.0.0-alpha',
          '1.0.0-beta.1',
          '1.0.0+build.123',
          '1.0.0-alpha+build',
        ];

        validVersions.forEach(version => {
          const plugin = createMockPlugin({ version });

          expect(() => validatePlugin(plugin)).not.toThrow();
        });
      });

      test('should skip version validation when disabled', () => {
        const plugin = createMockPlugin();
        delete (plugin as any).version;

        expect(() => validatePlugin(plugin, { requireVersion: false })).not.toThrow();
      });
    });

    describe('register method validation', () => {
      test('should throw for missing register method', () => {
        const plugin = createMockPlugin();
        delete (plugin as any).register;

        expect(() => validatePlugin(plugin)).toThrow(
          new PluginValidationError('test-plugin', 'Plugin must have a register method (function)')
        );
      });

      test('should throw for non-function register method', () => {
        const plugin = createMockPlugin({ register: 'not-a-function' as any });

        expect(() => validatePlugin(plugin)).toThrow(
          new PluginValidationError('test-plugin', 'Plugin must have a register method (function)')
        );
      });
    });

    describe('lifecycle method validation', () => {
      test('should accept valid lifecycle methods', () => {
        // createMockPlugin already includes all lifecycle methods as functions
        const plugin = createMockPlugin();

        expect(() => validatePlugin(plugin)).not.toThrow();
      });

      test('should accept missing optional lifecycle methods', () => {
        const plugin = createMockPlugin();
        // Remove optional lifecycle methods - these should be allowed to be missing
        delete (plugin as any).initialize;
        delete (plugin as any).terminate;
        delete (plugin as any).onServerStart;
        delete (plugin as any).onServerStop;

        expect(() => validatePlugin(plugin)).not.toThrow();
      });

      test('should throw for non-function lifecycle methods', () => {
        const lifecycleMethods = ['initialize', 'terminate', 'onServerStart', 'onServerStop'];

        lifecycleMethods.forEach(method => {
          const plugin = createMockPlugin({
            [method]: 'not-a-function' as any,
          });

          expect(() => validatePlugin(plugin)).toThrow(
            new PluginValidationError(
              'test-plugin',
              `Plugin ${method} must be a function if provided`
            )
          );
        });
      });
    });

    // REMOVED: dependencies validation section since dependencies property doesn't exist
  });

  describe('validatePluginOptions', () => {
    test('should pass for undefined options', () => {
      expect(() => validatePluginOptions('test-plugin', undefined)).not.toThrow();
    });

    test('should pass for valid object options', () => {
      expect(() => validatePluginOptions('test-plugin', { setting: 'value' })).not.toThrow();
    });

    test('should throw for non-object options', () => {
      expect(() => validatePluginOptions('test-plugin', 'not-object')).toThrow(
        new PluginValidationError('test-plugin', 'Plugin options must be an object')
      );

      expect(() => validatePluginOptions('test-plugin', 123)).toThrow(
        new PluginValidationError('test-plugin', 'Plugin options must be an object')
      );
    });

    test('should validate against schema when provided', () => {
      const mockSchema = {
        parse: vi.fn(),
      };
      const options = { setting: 'value' };

      validatePluginOptions('test-plugin', options, mockSchema);

      expect(mockSchema.parse).toHaveBeenCalledWith(options);
    });

    test('should throw PluginValidationError for schema validation failure', () => {
      const mockSchema = {
        parse: vi.fn().mockImplementation(() => {
          throw new Error('Schema validation failed');
        }),
      };

      expect(() => validatePluginOptions('test-plugin', { invalid: 'data' }, mockSchema)).toThrow(
        new PluginValidationError(
          'test-plugin',
          'Plugin options validation failed: Schema validation failed'
        )
      );
    });
  });

  describe('validatePluginFactory', () => {
    test('should pass for function', () => {
      const factory = () => ({});

      expect(() => validatePluginFactory(factory)).not.toThrow();
    });

    test('should throw for non-function', () => {
      expect(() => validatePluginFactory('not-function')).toThrow(
        new PluginValidationError('', 'Plugin factory must be a function')
      );

      expect(() => validatePluginFactory({})).toThrow(
        new PluginValidationError('', 'Plugin factory must be a function')
      );
    });
  });

  describe('isValidPluginName', () => {
    test('should return true for valid names', () => {
      const validNames = ['test', 'test-plugin', 'plugin123', 'a'];

      validNames.forEach(name => {
        expect(isValidPluginName(name)).toBe(true);
      });
    });

    test('should return false for invalid names', () => {
      const invalidNames = [
        'Test-Plugin', // uppercase
        'test_plugin', // underscore
        'test plugin', // space
        'core', // reserved
        'blaize', // reserved
        '', // empty
        123 as any, // non-string
      ];

      invalidNames.forEach(name => {
        expect(isValidPluginName(name)).toBe(false);
      });
    });
  });

  describe('isValidVersion', () => {
    test('should return true for valid versions', () => {
      const validVersions = ['1.0.0', '10.20.30', '1.0.0-alpha'];

      validVersions.forEach(version => {
        expect(isValidVersion(version)).toBe(true);
      });
    });

    test('should return false for invalid versions', () => {
      const invalidVersions = ['1.0', 'v1.0.0', '', 123 as any];

      invalidVersions.forEach(version => {
        expect(isValidVersion(version)).toBe(false);
      });
    });
  });

  describe('sanitizePluginName', () => {
    test('should sanitize invalid characters', () => {
      expect(sanitizePluginName('Test_Plugin@123')).toBe('test-plugin-123');
      expect(sanitizePluginName('My Cool Plugin!')).toBe('my-cool-plugin');
      expect(sanitizePluginName('test__plugin')).toBe('test-plugin');
    });

    test('should remove leading/trailing hyphens', () => {
      expect(sanitizePluginName('-test-plugin-')).toBe('test-plugin');
      expect(sanitizePluginName('---test---')).toBe('test');
    });

    test('should collapse multiple hyphens', () => {
      expect(sanitizePluginName('test---plugin')).toBe('test-plugin');
    });

    test('should handle edge cases', () => {
      expect(sanitizePluginName('')).toBe('');
      expect(sanitizePluginName('---')).toBe('');
      expect(sanitizePluginName('a')).toBe('a');
    });
  });
});
