import path from 'node:path';

import fs from 'fs-extra';

import { validateInputs } from './validate';
import { advancedTemplate } from '../templates/advanced'; // ← ADDED
import { minimalTemplate } from '../templates/minimal';
import { CLIError } from '../utils/errors';
import { detectPackageManager } from '../utils/package-manager';

import type { ParsedArgs } from '@/types';

// Mock fs-extra
vi.mock('fs-extra');

// Mock package-manager detection
vi.mock('../utils/package-manager', () => ({
  detectPackageManager: vi.fn(),
}));

describe('validateInputs', () => {
  const mockCwd = '/test/dir';
  const defaultArgs: ParsedArgs = {
    name: 'my-app',
    template: 'minimal',
    typescript: true,
    git: true,
    install: true,
    latest: false,
    dryRun: false,
    packageManager: undefined,
    help: false,
    version: false,
  };

  beforeEach(() => {
    // Mock process.cwd()
    vi.spyOn(process, 'cwd').mockReturnValue(mockCwd);

    // Reset all mocks
    vi.clearAllMocks();

    // Default mock implementations
    (fs.pathExists as any).mockResolvedValue(false);
    (fs.stat as any).mockResolvedValue({ isDirectory: () => true });
    (fs.readdir as any).mockResolvedValue([]);
    (detectPackageManager as any).mockReturnValue('npm');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('successful validation', () => {
    it('should validate inputs with default values', async () => {
      const result = await validateInputs(defaultArgs);

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected success');

      const validated = result.value;
      expect(validated.name).toBe('my-app');
      expect(validated.typescript).toBe(true);
      expect(validated.git).toBe(true);
      expect(validated.install).toBe(true);
      expect(validated.latest).toBe(false);
      expect(validated.dryRun).toBe(false);
      expect(validated.help).toBe(false);
      expect(validated.version).toBe(false);
      expect(validated.projectPath).toBe(path.join(mockCwd, 'my-app'));
      expect(validated.packageManager).toBe('npm');
      expect(validated.template).toBe(minimalTemplate);
    });

    it('should use specified package manager when provided', async () => {
      const args: ParsedArgs = {
        ...defaultArgs,
        packageManager: 'yarn',
      };

      const result = await validateInputs(args);

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected success');

      expect(result.value.packageManager).toBe('yarn');
      expect(detectPackageManager).not.toHaveBeenCalled();
    });

    it('should detect package manager when not specified', async () => {
      (detectPackageManager as any).mockReturnValue('pnpm');

      const result = await validateInputs(defaultArgs);

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected success');

      expect(result.value.packageManager).toBe('pnpm');
      expect(detectPackageManager).toHaveBeenCalledTimes(1);
    });

    it('should handle relative paths correctly', async () => {
      const args: ParsedArgs = {
        ...defaultArgs,
        name: './subfolder/my-app',
      };

      const result = await validateInputs(args);

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected success');

      expect(result.value.projectPath).toBe(path.join(mockCwd, 'subfolder', 'my-app'));
    });

    it('should handle absolute paths correctly', async () => {
      const args: ParsedArgs = {
        ...defaultArgs,
        name: '/absolute/path/to/my-app',
      };

      const result = await validateInputs(args);

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected success');

      expect(result.value.projectPath).toBe('/absolute/path/to/my-app');
    });

    it('should allow creating in empty existing directory', async () => {
      (fs.pathExists as any).mockResolvedValue(true);
      (fs.stat as any).mockResolvedValue({ isDirectory: () => true });
      (fs.readdir as any).mockResolvedValue([]);

      const result = await validateInputs(defaultArgs);

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected success');

      expect(result.value.projectPath).toBe(path.join(mockCwd, 'my-app'));
    });

    it('should skip directory check in dry-run mode', async () => {
      const args: ParsedArgs = {
        ...defaultArgs,
        dryRun: true,
      };

      // Even if directory exists and is not empty, it should succeed
      (fs.pathExists as any).mockResolvedValue(true);
      (fs.stat as any).mockResolvedValue({ isDirectory: () => true });
      (fs.readdir as any).mockResolvedValue(['existing-file.txt']);

      const result = await validateInputs(args);

      expect(result.ok).toBe(true);
      expect(fs.pathExists).not.toHaveBeenCalled();
      expect(fs.stat).not.toHaveBeenCalled();
      expect(fs.readdir).not.toHaveBeenCalled();
    });

    it('should pass through all boolean flags', async () => {
      const args: ParsedArgs = {
        ...defaultArgs,
        typescript: false,
        git: false,
        install: false,
        latest: true,
        dryRun: true,
        help: true,
        version: true,
      };

      const result = await validateInputs(args);

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected success');

      const validated = result.value;
      expect(validated.typescript).toBe(false);
      expect(validated.git).toBe(false);
      expect(validated.install).toBe(false);
      expect(validated.latest).toBe(true);
      expect(validated.dryRun).toBe(true);
      expect(validated.help).toBe(true);
      expect(validated.version).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should throw error if directory exists and is not empty', async () => {
      (fs.pathExists as any).mockResolvedValue(true);
      (fs.stat as any).mockResolvedValue({ isDirectory: () => true });
      (fs.readdir as any).mockResolvedValue(['existing-file.txt']);

      await expect(validateInputs(defaultArgs)).rejects.toThrow(CLIError);
      await expect(validateInputs(defaultArgs)).rejects.toThrow(
        'Directory my-app already exists and is not empty'
      );
    });

    it('should throw error with correct error code for existing directory', async () => {
      (fs.pathExists as any).mockResolvedValue(true);
      (fs.stat as any).mockResolvedValue({ isDirectory: () => true });
      (fs.readdir as any).mockResolvedValue(['file.txt']);

      try {
        await validateInputs(defaultArgs);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(CLIError);
        expect((error as CLIError).code).toBe('EEXIST');
        expect((error as CLIError).suggestion).toBe(
          'Choose a different name or remove the existing directory'
        );
      }
    });

    it('should throw error if path exists but is a file', async () => {
      (fs.pathExists as any).mockResolvedValue(true);
      (fs.stat as any).mockResolvedValue({ isDirectory: () => false });

      // The current implementation doesn't handle this case explicitly,
      // but it would fail when trying to readdir on a file
      (fs.readdir as any).mockRejectedValue(new Error('ENOTDIR'));

      await expect(validateInputs(defaultArgs)).rejects.toThrow();
    });

    it('should throw error for invalid template', async () => {
      const args: ParsedArgs = {
        ...defaultArgs,
        template: 'nonexistent' as any,
      };

      await expect(validateInputs(args)).rejects.toThrow(CLIError);
      await expect(validateInputs(args)).rejects.toThrow("Template 'nonexistent' not found");
    });

    it('should throw error with correct code for invalid template', async () => {
      const args: ParsedArgs = {
        ...defaultArgs,
        template: 'invalid-template' as any,
      };

      try {
        await validateInputs(args);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(CLIError);
        expect((error as CLIError).code).toBe('TEMPLATE_NOT_FOUND');
        // ← CHANGED: Now expects both templates in error message
        expect((error as CLIError).suggestion).toBe('Available templates: minimal, advanced');
      }
    });

    it('should handle fs errors gracefully', async () => {
      const fsError = new Error('Permission denied');
      (fs.pathExists as any).mockRejectedValue(fsError);

      await expect(validateInputs(defaultArgs)).rejects.toThrow('Permission denied');
    });

    it('should handle readdir errors', async () => {
      (fs.pathExists as any).mockResolvedValue(true);
      (fs.stat as any).mockResolvedValue({ isDirectory: () => true });
      (fs.readdir as any).mockRejectedValue(new Error('Cannot read directory'));

      await expect(validateInputs(defaultArgs)).rejects.toThrow('Cannot read directory');
    });
  });

  describe('edge cases', () => {
    it('should handle dot (.) as project name', async () => {
      const args: ParsedArgs = {
        ...defaultArgs,
        name: '.',
      };

      const result = await validateInputs(args);

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected success');

      expect(result.value.projectPath).toBe(mockCwd);
    });

    it('should handle double dot (..) in path', async () => {
      const args: ParsedArgs = {
        ...defaultArgs,
        name: '../sibling-app',
      };

      const result = await validateInputs(args);

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected success');

      expect(result.value.projectPath).toBe(path.join(mockCwd, '..', 'sibling-app'));
    });

    it('should handle paths with spaces', async () => {
      const args: ParsedArgs = {
        ...defaultArgs,
        name: 'my app with spaces',
      };

      const result = await validateInputs(args);

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected success');

      expect(result.value.projectPath).toBe(path.join(mockCwd, 'my app with spaces'));
    });

    it('should handle empty string name', async () => {
      const args: ParsedArgs = {
        ...defaultArgs,
        name: '',
      };

      const result = await validateInputs(args);

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected success');

      // Empty string resolves to current directory
      expect(result.value.projectPath).toBe(mockCwd);
    });

    it('should handle Windows-style paths', async () => {
      const args: ParsedArgs = {
        ...defaultArgs,
        name: 'C:\\Users\\test\\my-app',
      };

      const result = await validateInputs(args);

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected success');

      // path.resolve should handle this correctly on the current platform
      expect(result.value.projectPath).toBe(path.resolve(mockCwd, 'C:\\Users\\test\\my-app'));
    });
  });

  describe('template validation', () => {
    it('should accept minimal template', async () => {
      const args: ParsedArgs = {
        ...defaultArgs,
        template: 'minimal',
      };

      const result = await validateInputs(args);

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected success');

      expect(result.value.template).toBe(minimalTemplate);
    });

    it('should accept advanced template', async () => {
      // ← ADDED: Test for advanced template
      const args: ParsedArgs = {
        ...defaultArgs,
        template: 'advanced',
      };

      const result = await validateInputs(args);

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected success');

      expect(result.value.template).toBe(advancedTemplate);
    });

    it('should provide helpful error message for unknown templates', async () => {
      const templates = ['react', 'vue', 'angular', 'nextjs', 'remix'];

      for (const template of templates) {
        const args: ParsedArgs = {
          ...defaultArgs,
          template: template as any,
        };

        try {
          await validateInputs(args);
          expect.fail(`Should have thrown for template: ${template}`);
        } catch (error) {
          expect(error).toBeInstanceOf(CLIError);
          expect((error as CLIError).message).toContain(`Template '${template}' not found`);
          // ← CHANGED: Now expects both templates in error message
          expect((error as CLIError).suggestion).toContain(
            'Available templates: minimal, advanced'
          );
        }
      }
    });
  });

  describe('integration scenarios', () => {
    it('should handle typical create-app flow', async () => {
      const args: ParsedArgs = {
        name: 'awesome-app',
        template: 'minimal',
        typescript: true,
        git: true,
        install: true,
        latest: false,
        dryRun: false,
        packageManager: undefined,
        help: false,
        version: false,
      };

      (detectPackageManager as any).mockReturnValue('pnpm');

      const result = await validateInputs(args);

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected success');

      const validated = result.value;
      expect(validated.name).toBe('awesome-app');
      expect(validated.projectPath).toBe(path.join(mockCwd, 'awesome-app'));
      expect(validated.packageManager).toBe('pnpm');
      expect(validated.template).toBe(minimalTemplate);
      expect(validated.typescript).toBe(true);
      expect(validated.git).toBe(true);
      expect(validated.install).toBe(true);
    });

    it('should handle advanced template flow', async () => {
      // ← ADDED: Test for advanced template integration
      const args: ParsedArgs = {
        name: 'production-app',
        template: 'advanced',
        typescript: true,
        git: true,
        install: true,
        latest: false,
        dryRun: false,
        packageManager: 'pnpm',
        help: false,
        version: false,
      };

      const result = await validateInputs(args);

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected success');

      const validated = result.value;
      expect(validated.name).toBe('production-app');
      expect(validated.template).toBe(advancedTemplate);
      expect(validated.packageManager).toBe('pnpm');
    });

    it('should handle CI/CD scenario with specific options', async () => {
      const args: ParsedArgs = {
        name: 'ci-test-app',
        template: 'minimal',
        typescript: false,
        git: false,
        install: false,
        latest: true,
        dryRun: true,
        packageManager: 'npm',
        help: false,
        version: false,
      };

      const result = await validateInputs(args);

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected success');

      const validated = result.value;
      expect(validated.dryRun).toBe(true);
      expect(validated.install).toBe(false);
      expect(validated.git).toBe(false);
      expect(validated.latest).toBe(true);
      expect(validated.packageManager).toBe('npm');

      // Should not check directory in dry-run mode
      expect(fs.pathExists).not.toHaveBeenCalled();
    });
  });
});
