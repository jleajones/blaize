import { parseArgs } from './parse-args';
import { CLIError } from '../utils/errors';

describe('parseArgs', () => {
  let consoleLogSpy: any;
  let processExitSpy: any;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    // Mock process.exit to throw immediately when called
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as any);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  describe('successful parsing', () => {
    it('should parse project name with default options', () => {
      const argv = ['node', 'script', 'my-app'];
      const result = parseArgs(argv);

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected success');

      expect(result.value.name).toBe('my-app');
      expect(result.value.template).toBe('minimal');
      expect(result.value.typescript).toBe(true);
      expect(result.value.git).toBe(true);
      expect(result.value.install).toBe(true);
      expect(result.value.latest).toBe(false);
      expect(result.value.dryRun).toBe(false);
      expect(result.value.packageManager).toBeUndefined();
    });

    it('should parse all boolean flags', () => {
      const argv = [
        'node',
        'script',
        'my-app',
        '--no-typescript',
        '--no-git',
        '--no-install',
        '--latest',
        '--dry-run',
      ];
      const result = parseArgs(argv);

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected success');

      expect(result.value.typescript).toBe(false);
      expect(result.value.git).toBe(false);
      expect(result.value.install).toBe(false);
      expect(result.value.latest).toBe(true);
      expect(result.value.dryRun).toBe(true);
    });

    it('should parse package manager option', () => {
      const argv = ['node', 'script', 'my-app', '--pm', 'pnpm'];
      const result = parseArgs(argv);

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected success');

      expect(result.value.packageManager).toBe('pnpm');
    });

    it('should accept all valid package managers', () => {
      const managers = ['npm', 'pnpm', 'yarn', 'bun'];

      for (const pm of managers) {
        const argv = ['node', 'script', 'test-app', '--pm', pm];
        const result = parseArgs(argv);

        expect(result.ok).toBe(true);
        if (!result.ok) throw new Error('Expected success');
        expect(result.value.packageManager).toBe(pm);
      }
    });

    it('should handle project names with valid characters', () => {
      const validNames = [
        'my-app',
        'my_app',
        'MyApp',
        'app123',
        'test_project-2024',
        'UPPERCASE',
        'lowercase',
        '123app',
      ];

      for (const name of validNames) {
        const argv = ['node', 'script', name];
        const result = parseArgs(argv);

        expect(result.ok).toBe(true);
        if (!result.ok) throw new Error(`Expected success for name: ${name}`);
        expect(result.value.name).toBe(name);
      }
    });
  });

  describe('error handling', () => {
    it('should return error when project name is missing', () => {
      const argv = ['node', 'script'];
      const result = parseArgs(argv);

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('Expected error');

      expect(result.error).toBeInstanceOf(CLIError);
      expect((result.error as CLIError).code).toBe('MISSING_PROJECT_NAME');
      expect(result.error.message).toContain('Project name is required');
    });

    it('should return error for invalid package manager', () => {
      const argv = ['node', 'script', 'my-app', '--pm', 'invalid'];
      const result = parseArgs(argv);

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('Expected error');

      expect(result.error).toBeInstanceOf(CLIError);
      expect((result.error as CLIError).code).toBe('INVALID_PACKAGE_MANAGER');
      expect(result.error.message).toContain('Invalid package manager: invalid');
    });

    it('should return error for invalid project names', () => {
      const invalidNames = [
        'my app', // spaces
        'my/app', // slashes
        'my\\app', // backslashes
        'my.app', // dots
        'my@app', // special chars
        'my#app',
        'my$app',
        'my%app',
        'my&app',
        'my*app',
        'my(app)',
        'my[app]',
        'my{app}',
      ];

      for (const name of invalidNames) {
        const argv = ['node', 'script', name];
        const result = parseArgs(argv);

        expect(result.ok).toBe(false);
        if (result.ok) throw new Error(`Expected error for name: ${name}`);
        expect(result.error.message).toContain(
          'can only contain letters, numbers, hyphens, and underscores'
        );
      }
    });

    it('should return error for empty project name', () => {
      const argv = ['node', 'script', ''];
      const result = parseArgs(argv);

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('Expected error');

      expect(result.error).toBeInstanceOf(CLIError);
    });
  });

  describe('help and version flags', () => {
    it('should display help and exit when --help is used', () => {
      const argv = ['node', 'script', '--help'];

      try {
        parseArgs(argv);
        // If we get here, process.exit wasn't called
        expect.fail('Expected process.exit to be called');
      } catch (error: any) {
        // Check if the error is from our mock or from expect.fail
        if (error.message === 'Expected process.exit to be called') {
          throw error; // Re-throw if it's from expect.fail (meaning process.exit wasn't called)
        }
        expect(error.message).toBe('process.exit called');
      }

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('create-blaize-app - Create BlaizeJS applications')
      );
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    it('should display help with -h alias', () => {
      const argv = ['node', 'script', '-h'];

      try {
        parseArgs(argv);
        expect.fail('Expected process.exit to be called');
      } catch (error: any) {
        if (error.message === 'Expected process.exit to be called') {
          throw error;
        }
        expect(error.message).toBe('process.exit called');
      }

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('create-blaize-app - Create BlaizeJS applications')
      );
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    it('should display version and exit when --version is used', () => {
      const argv = ['node', 'script', '--version'];

      try {
        parseArgs(argv);
        expect.fail('Expected process.exit to be called');
      } catch (error: any) {
        if (error.message === 'Expected process.exit to be called') {
          throw error;
        }
        expect(error.message).toBe('process.exit called');
      }

      expect(consoleLogSpy).toHaveBeenCalledWith('0.1.0');
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    it('should display version with -v alias', () => {
      const argv = ['node', 'script', '-v'];

      try {
        parseArgs(argv);
        expect.fail('Expected process.exit to be called');
      } catch (error: any) {
        if (error.message === 'Expected process.exit to be called') {
          throw error;
        }
        expect(error.message).toBe('process.exit called');
      }

      expect(consoleLogSpy).toHaveBeenCalledWith('0.1.0');
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    it('should prioritize help over other options', () => {
      const argv = ['node', 'script', 'my-app', '--help', '--version'];

      try {
        parseArgs(argv);
        expect.fail('Expected process.exit to be called');
      } catch (error: any) {
        if (error.message === 'Expected process.exit to be called') {
          throw error;
        }
        expect(error.message).toBe('process.exit called');
      }

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('create-blaize-app - Create BlaizeJS applications')
      );
      expect(consoleLogSpy).not.toHaveBeenCalledWith('0.1.0');
    });
  });

  describe('template validation', () => {
    it('should accept minimal template', () => {
      const argv = ['node', 'script', 'my-app', '--template', 'minimal'];
      const result = parseArgs(argv);

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected success');

      expect(result.value.template).toBe('minimal');
    });

    it('should accept advanced template', () => {
      // ← CHANGED: Test now expects advanced to work
      const argv = ['node', 'script', 'my-app', '--template', 'advanced'];
      const result = parseArgs(argv);

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected success');

      expect(result.value.template).toBe('advanced');
    });

    it('should default to minimal template', () => {
      const argv = ['node', 'script', 'my-app'];
      const result = parseArgs(argv);

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected success');

      expect(result.value.template).toBe('minimal');
    });

    it('should reject invalid template names', () => {
      // ← CHANGED: Now expects rejection for invalid templates
      const argv = ['node', 'script', 'my-app', '--template', 'react'];
      const result = parseArgs(argv);

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('Expected error');

      expect(result.error).toBeInstanceOf(CLIError);
      expect((result.error as CLIError).code).toBe('VALIDATION_ERROR');
    });
  });

  describe('edge cases', () => {
    it('should handle multiple flags together', () => {
      const argv = [
        'node',
        'script',
        'complex-app',
        '--pm',
        'yarn',
        '--no-git',
        '--latest',
        '--dry-run',
      ];
      const result = parseArgs(argv);

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected success');

      expect(result.value.name).toBe('complex-app');
      expect(result.value.packageManager).toBe('yarn');
      expect(result.value.git).toBe(false);
      expect(result.value.latest).toBe(true);
      expect(result.value.dryRun).toBe(true);
      expect(result.value.install).toBe(true); // Still default
    });

    it('should handle unknown flags gracefully', () => {
      const argv = ['node', 'script', 'my-app', '--unknown', '--foo', 'bar'];
      const result = parseArgs(argv);

      // Unknown flags are ignored by minimist
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected success');

      expect(result.value.name).toBe('my-app');
    });

    it('should handle positional arguments after flags', () => {
      const argv = ['node', 'script', '--pm', 'npm', 'my-app'];
      const result = parseArgs(argv);

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected success');

      expect(result.value.name).toBe('my-app');
      expect(result.value.packageManager).toBe('npm');
    });

    it('should handle equals syntax for options', () => {
      const argv = ['node', 'script', 'my-app', '--pm=pnpm'];
      const result = parseArgs(argv);

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected success');

      expect(result.value.packageManager).toBe('pnpm');
    });
  });

  describe('return value structure', () => {
    it('should return Result type with ok=true on success', () => {
      const argv = ['node', 'script', 'valid-app'];
      const result = parseArgs(argv);

      expect(result).toHaveProperty('ok');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result).toHaveProperty('value');
        expect(result.value).toHaveProperty('name');
      }
    });

    it('should return Result type with ok=false on error', () => {
      const argv = ['node', 'script'];
      const result = parseArgs(argv);

      expect(result).toHaveProperty('ok');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result).toHaveProperty('error');
        expect(result.error).toBeInstanceOf(Error);
      }
    });

    it('should always set help and version to false in returned args', () => {
      const argv = ['node', 'script', 'my-app'];
      const result = parseArgs(argv);

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected success');

      expect(result.value.help).toBe(false);
      expect(result.value.version).toBe(false);
    });
  });
});
